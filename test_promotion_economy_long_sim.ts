import assert from 'node:assert/strict';
import { advanceTime } from './src/lib/engine';
import {
  autoBookEventsAndContracts,
  maintainDeals,
  repairFutureEventAvailability,
  repairPastScheduledEvents,
  simulateDueEvents
} from './src/lib/game/autobooker';
import { validateContractMarketState } from './src/lib/game/contractMarket';
import { generateInitialWorld } from './src/lib/game/generator';
import { runObserverDecisions } from './src/lib/game/observer';
import { refreshPromotionEconomy, validatePromotionEconomies } from './src/lib/game/promotionEconomy';
import { syncCalendarSlots, validateSeasonCalendarState } from './src/lib/game/season';
import {
  runAutopilotTournaments,
  syncTournamentTitleShotFlags,
  validateTitleShotDebtState,
  validateTournamentState
} from './src/lib/game/tournament';
import type { GameState, PromotionLedgerEntry } from './src/types/game';

let randomState = 2211;
const nextRandom = () => {
  randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
  return randomState / 0x100000000;
};
const deterministicCrypto = {
  getRandomValues<T extends ArrayBufferView | null>(array: T): T {
    if (!array) return array;
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(nextRandom() * 256);
    return array;
  },
  randomUUID(): `${string}-${string}-${string}-${string}-${string}` {
    const bytes = deterministicCrypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
};
Object.defineProperty(globalThis, 'crypto', { configurable: true, value: deterministicCrypto });

type Coverage = {
  enteredRecovery: Set<string>;
  exitedRecovery: Set<string>;
  liabilityAccrued: boolean;
  liabilityReduced: boolean;
  profitableEvent: boolean;
  lossEvent: boolean;
  aiBrandInvestments: number;
  recoveryBrandInvestments: number;
  ownerCashInjections: number;
};

const activeInternationalOwners = (state: GameState) => Object.fromEntries(
  Object.values(state.tournaments)
    .filter(tournament => tournament.scope === 'international' && (tournament.status === 'planned' || tournament.status === 'active'))
    .flatMap(tournament => tournament.participants)
    .map(participant => [participant.fighterId, state.fighters[participant.fighterId]?.contract?.promotionId ?? null])
);

const advanceOneDay = (state: GameState) => {
  const protectedOwners = activeInternationalOwners(state);
  let next = syncCalendarSlots(state);
  next = repairPastScheduledEvents(next);
  next = simulateDueEvents(next, false).state;
  next = syncCalendarSlots(next);
  next = autoBookEventsAndContracts(next);
  next = runAutopilotTournaments(next);
  next = repairFutureEventAvailability(next);
  next = runObserverDecisions(next);
  next = advanceTime(next, 1);
  next = maintainDeals(next);
  next = repairFutureEventAvailability(next);
  next = syncTournamentTitleShotFlags(next);
  next = repairPastScheduledEvents(next);
  next = simulateDueEvents(next, false).state;
  next = syncCalendarSlots(next);
  for (const [fighterId, ownerId] of Object.entries(protectedOwners)) {
    assert.equal(next.fighters[fighterId]?.contract?.promotionId ?? null, ownerId, `International participant ownership changed on ${state.currentDate}: ${fighterId}`);
  }
  return next;
};

const newLedgerEntries = (before: GameState, after: GameState, promotionId: string): PromotionLedgerEntry[] => {
  const previousIds = new Set(before.promotionEconomies[promotionId]?.ledger.map(entry => entry.id) ?? []);
  return after.promotionEconomies[promotionId].ledger.filter(entry => !previousIds.has(entry.id));
};

const updateCoverage = (coverage: Coverage, before: GameState, after: GameState) => {
  for (const [promotionId, economy] of Object.entries(after.promotionEconomies)) {
    const previous = before.promotionEconomies[promotionId];
    if (!previous) continue;
    if (!previous.recoveryMode && economy.recoveryMode) coverage.enteredRecovery.add(promotionId);
    if (previous.recoveryMode && !economy.recoveryMode) coverage.exitedRecovery.add(promotionId);
    const entries = newLedgerEntries(before, after, promotionId);
    if (entries.some(entry => entry.liabilityDelta > 0)) coverage.liabilityAccrued = true;
    if (entries.some(entry => entry.liabilityDelta < 0)) coverage.liabilityReduced = true;
    const brandEntries = entries.filter(entry => entry.category === 'brand_investment');
    if (after.promotions[promotionId].control === 'ai') coverage.aiBrandInvestments += brandEntries.length;
    if (previous.recoveryMode) coverage.recoveryBrandInvestments += brandEntries.length;
  }

  const previousEvents = new Set(Object.keys(before.eventArchive));
  for (const event of Object.values(after.eventArchive)) {
    if (previousEvents.has(event.id) || event.scope === 'international') continue;
    if (event.profit > 0) coverage.profitableEvent = true;
    if (event.profit < 0) coverage.lossEvent = true;
  }
  const previousLedgerIds = new Set((before.financeLedger ?? []).map(entry => entry.id));
  coverage.ownerCashInjections += (after.financeLedger ?? []).filter(entry => !previousLedgerIds.has(entry.id) && entry.type === 'owner_injection').length;
};

const duplicateSettlementErrors = (state: GameState) => {
  const errors: string[] = [];
  for (const [promotionId, economy] of Object.entries(state.promotionEconomies)) {
    const settledEvents = new Set<string>();
    for (const eventId of economy.settledEventIds) {
      if (settledEvents.has(eventId)) errors.push(`duplicate-event-settlement:${promotionId}:${eventId}`);
      settledEvents.add(eventId);
    }
    const transactionKeys = new Set<string>();
    for (const entry of economy.ledger) {
      if (entry.category === 'liability_payment') continue;
      const key = `${entry.settlementKey}:${entry.category}`;
      if (transactionKeys.has(key)) errors.push(`duplicate-settlement-category:${promotionId}:${key}`);
      transactionKeys.add(key);
    }
  }
  const historyIds = new Set<string>();
  for (const item of state.contractMarket.history) {
    if (historyIds.has(item.id)) errors.push(`duplicate-market-history:${item.id}`);
    historyIds.add(item.id);
  }
  return errors;
};

const eventSettlementErrors = (state: GameState) => {
  const errors: string[] = [];
  const settlements = Object.values(state.promotionEconomies).flatMap(economy => economy.settledEventIds);
  for (const event of Object.values(state.eventArchive)) {
    const count = settlements.filter(eventId => eventId === event.id).length;
    if (event.scope === 'international') {
      if (count) errors.push(`international-event-settled:${event.id}`);
    } else if (count !== 1) {
      errors.push(`domestic-event-settlement-count:${event.id}:${count}`);
    }
  }
  for (const plan of Object.values(state.seasonPlans ?? {})) {
    for (const slot of plan.slots) {
      if (slot.status === 'cancelled' && slot.eventId && settlements.includes(slot.eventId)) errors.push(`cancelled-event-settled:${slot.eventId}`);
    }
  }
  return errors;
};

const checkpointErrors = (state: GameState) => {
  const errors = [
    ...validatePromotionEconomies(state),
    ...validateContractMarketState(state),
    ...validateSeasonCalendarState(state),
    ...validateTournamentState(state),
    ...validateTitleShotDebtState(state),
    ...duplicateSettlementErrors(state),
    ...eventSettlementErrors(state)
  ];
  const player = state.promotions[state.playerPromotionId];
  if (state.promotion.money !== player.money || state.promotion.reputation !== player.reputation || state.promotion.fanbase !== player.fanbase) errors.push('stale-player-promotion-snapshot');

  for (const fighter of Object.values(state.fighters)) {
    const ownerId = fighter.contract?.promotionId;
    if (ownerId && !state.promotions[ownerId]) errors.push(`unknown-owner:${fighter.id}:${ownerId}`);
  }
  for (const [promotionId, titles] of Object.entries(state.titlesByPromotion)) {
    for (const title of Object.values(titles)) {
      for (const fighterId of [title.undisputedChampionId, title.interimChampionId]) {
        if (fighterId && state.fighters[fighterId]?.contract?.promotionId !== promotionId) errors.push(`domestic-title-owner:${promotionId}:${fighterId}`);
      }
    }
  }
  for (const fight of Object.values(state.fightArchive)) {
    if (!fight.method || !fight.roundStats?.length) errors.push(`invalid-fight-result:${fight.id}`);
    for (const round of fight.roundStats ?? []) {
      if (!round.judges || round.judges.length < 3) errors.push(`invalid-round-stats:${fight.id}`);
    }
  }
  for (const offer of Object.values(state.contractMarket.offers)) {
    if (offer.status !== 'active') continue;
    const economy = state.promotionEconomies[offer.buyerPromotionId];
    const commitment = offer.transferFee + offer.terms.fights * (offer.terms.payPerFight + offer.terms.winBonus * 0.5);
    if (!economy || economy.recoveryMode || economy.outstandingLiabilities > 0 || commitment > economy.contractBudget) errors.push(`unprotected-active-offer:${offer.id}`);
  }
  return errors;
};

const run = (initial: GameState, days: number) => {
  randomState = 2211;
  const originalRandom = Math.random;
  Math.random = nextRandom;
  const coverage: Coverage = {
    enteredRecovery: new Set(),
    exitedRecovery: new Set(),
    liabilityAccrued: false,
    liabilityReduced: false,
    profitableEvent: false,
    lossEvent: false,
    aiBrandInvestments: 0,
    recoveryBrandInvestments: 0,
    ownerCashInjections: 0
  };
  try {
    let state = structuredClone(initial);
    for (let day = 1; day <= days; day++) {
      const before = state;
      state = advanceOneDay(state);
      updateCoverage(coverage, before, state);
      assert.deepEqual(validatePromotionEconomies(state), [], `Economy invariant errors on day ${day} (${state.currentDate})`);
      assert.deepEqual(validateContractMarketState(state), [], `Market invariant errors on day ${day} (${state.currentDate})`);
      if (day % 365 === 0) assert.deepEqual(checkpointErrors(state), [], `Yearly checkpoint failed on day ${day} (${state.currentDate})`);
    }
    return { state, coverage };
  } finally {
    Math.random = originalRandom;
  }
};

const compact = (state: GameState) => ({
  currentDate: state.currentDate,
  promotions: Object.fromEntries(Object.entries(state.promotions).map(([id, promotion]) => [id, {
    money: promotion.money,
    reputation: promotion.reputation,
    fanbase: promotion.fanbase
  }])),
  economies: Object.fromEntries(Object.entries(state.promotionEconomies).map(([id, economy]) => [id, {
    debtLimit: economy.debtLimit,
    recoveryMode: economy.recoveryMode,
    financialMode: economy.financialMode,
    outstandingLiabilities: economy.outstandingLiabilities,
    contractBudget: economy.contractBudget,
    lastMonthlySettlement: economy.lastMonthlySettlement,
    settledEventIds: economy.settledEventIds,
    ledger: economy.ledger
  }])),
  ownership: Object.fromEntries(Object.values(state.fighters).map(fighter => [fighter.id, fighter.contract?.promotionId ?? null])),
  marketHistory: state.contractMarket.history,
  eventArchive: state.eventArchive
});

randomState = 2211;
let initial = generateInitialWorld(2211);
initial.mode = 'observer';
initial.autopilot = { ...initial.autopilot, enabled: true };
const stressedPromotionId = Object.keys(initial.promotions).find(id => id !== initial.playerPromotionId)!;
initial.promotions[stressedPromotionId].money = -initial.promotionEconomies[stressedPromotionId].debtLimit + 40_000;
initial.promotionEconomies[stressedPromotionId] = {
  ...initial.promotionEconomies[stressedPromotionId],
  lastMonthlySettlement: '2024-12',
  ledgerOpeningBalance: initial.promotions[stressedPromotionId].money,
  ledger: []
};
initial = refreshPromotionEconomy(initial, stressedPromotionId);
const runA = run(initial, 1825);
const runB = run(initial, 1825);

assert.deepEqual(compact(runA.state), compact(runB.state));
assert.deepEqual(runA.coverage, runB.coverage);
assert.ok(runA.coverage.enteredRecovery.size > 0, 'At least one promotion must enter recovery');
assert.ok([...runA.coverage.enteredRecovery].some(id => runA.coverage.exitedRecovery.has(id)), 'At least one promotion must exit recovery after entering');
assert.equal(runA.coverage.liabilityAccrued, true, 'At least one liability must accrue');
assert.equal(runA.coverage.liabilityReduced, true, 'At least one liability must later be reduced');
assert.equal(runA.coverage.profitableEvent, true, 'At least one domestic event must make a profit');
assert.equal(runA.coverage.lossEvent, true, 'At least one domestic event must make a loss');
assert.ok(runA.coverage.aiBrandInvestments > 0, 'AI must make at least one brand investment');
assert.equal(runA.coverage.recoveryBrandInvestments, 0, 'Recovery-mode promotions must not invest in brand');
assert.ok(Object.values(runA.state.contractMarket.windows).filter(window => window.status === 'closed').length >= 2, 'At least two market windows must close');
assert.ok(runA.state.contractMarket.history.some(item => item.outcome === 'transferred'), 'At least one contracted fighter must transfer');
assert.equal(runA.coverage.ownerCashInjections, 0, 'Owner cash injection is not allowed');

console.log('Promotion economy long-sim checks passed.');
