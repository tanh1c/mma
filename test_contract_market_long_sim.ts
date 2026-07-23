import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { advanceTime } from './src/lib/engine';
import { autoBookEventsAndContracts, maintainDeals, repairFutureEventAvailability, repairPastScheduledEvents, simulateDueEvents } from './src/lib/game/autobooker';
import { runObserverDecisions } from './src/lib/game/observer';
import { syncCalendarSlots, validateSeasonCalendarState } from './src/lib/game/season';
import { runAutopilotTournaments, syncTournamentTitleShotFlags, validateTitleShotDebtState, validateTournamentState } from './src/lib/game/tournament';
import { validateContractMarketState } from './src/lib/game/contractMarket';
import { validatePromotionEconomies } from './src/lib/game/promotionEconomy';
import type { GameState } from './src/types/game';

let randomState = 2110;
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

const checkpointErrors = (state: GameState) => {
  const errors = [...validatePromotionEconomies(state), ...validateContractMarketState(state), ...validateSeasonCalendarState(state), ...validateTournamentState(state), ...validateTitleShotDebtState(state)];
  const activeOfferKeys = new Set<string>();
  const historyIds = new Set<string>();

  for (const fighter of Object.values(state.fighters)) {
    const ownerId = fighter.contract?.promotionId;
    if (ownerId && !state.promotions[ownerId]) errors.push(`unknown-owner:${fighter.id}:${ownerId}`);
  }
  for (const offer of Object.values(state.contractMarket.offers)) {
    if (offer.status !== 'active') continue;
    const key = `${offer.windowId}:${offer.buyerPromotionId}:${offer.fighterId}`;
    if (activeOfferKeys.has(key)) errors.push(`duplicate-active-offer:${key}`);
    activeOfferKeys.add(key);
    if (!state.fighters[offer.fighterId] || !state.promotions[offer.buyerPromotionId] || (offer.sellerPromotionId && !state.promotions[offer.sellerPromotionId])) {
      errors.push(`missing-offer-entity:${offer.id}`);
    }
  }
  for (const item of state.contractMarket.history) {
    if (historyIds.has(item.id)) errors.push(`duplicate-history:${item.id}`);
    historyIds.add(item.id);
  }
  for (const [promotionId, economy] of Object.entries(state.promotionEconomies)) {
    const settlementCategories = new Set<string>();
    for (const entry of economy.ledger) {
      if (entry.category === 'liability_payment') continue;
      const key = `${entry.settlementKey}:${entry.category}`;
      if (settlementCategories.has(key)) errors.push(`duplicate-economy-settlement:${promotionId}:${key}`);
      settlementCategories.add(key);
    }
    if (new Set(economy.settledEventIds).size !== economy.settledEventIds.length) errors.push(`duplicate-event-settlement:${promotionId}`);
  }
  for (const [promotionId, titles] of Object.entries(state.titlesByPromotion)) {
    for (const title of Object.values(titles)) {
      for (const fighterId of [title.undisputedChampionId, title.interimChampionId]) {
        if (fighterId && state.fighters[fighterId]?.contract?.promotionId !== promotionId) errors.push(`domestic-title-owner:${promotionId}:${fighterId}`);
      }
    }
  }
  for (const window of Object.values(state.contractMarket.windows)) {
    if (window.status !== 'closed') continue;
    if (Object.values(state.contractMarket.offers).some(offer => offer.windowId === window.id && offer.status === 'active')) errors.push(`closed-active-offer:${window.id}`);
    if (Object.values(state.contractMarket.pendingSettlements).some(item => item.windowId === window.id)) errors.push(`closed-pending-settlement:${window.id}`);
  }
  for (const event of Object.values(state.events)) {
    if (event.isCompleted && event.fights.some(fight => !fight.result)) errors.push(`completed-event-missing-result:${event.id}`);
  }
  for (const fight of Object.values(state.fightArchive)) {
    for (const round of fight.roundStats ?? []) {
      if (!round.judges || round.judges.length < 3) errors.push(`invalid-round-stats:${fight.id}`);
    }
  }
  return errors;
};

const run = (initial: GameState, days: number) => {
  randomState = 2110;
  const originalRandom = Math.random;
  Math.random = nextRandom;
  try {
    let state = structuredClone(initial);
    for (let day = 1; day <= days; day++) {
      state = advanceOneDay(state);
      assert.deepEqual(validatePromotionEconomies(state), [], `Economy invariant errors on day ${day} (${state.currentDate})`);
      assert.deepEqual(validateContractMarketState(state), [], `Market invariant errors on day ${day} (${state.currentDate})`);
      if (day % 365 === 0) assert.deepEqual(checkpointErrors(state), [], `Yearly checkpoint failed on day ${day}`);
    }
    return state;
  } finally {
    Math.random = originalRandom;
  }
};

const compact = (state: GameState) => ({
  currentDate: state.currentDate,
  promotions: Object.fromEntries(Object.entries(state.promotions).map(([id, promotion]) => [id, promotion.money])),
  ownership: Object.fromEntries(Object.values(state.fighters).map(fighter => [fighter.id, fighter.contract?.promotionId ?? null])),
  windows: state.contractMarket.windows,
  activeOffers: Object.values(state.contractMarket.offers).filter(offer => offer.status === 'active'),
  pendingSettlements: state.contractMarket.pendingSettlements,
  history: state.contractMarket.history
});

const initial = generateInitialWorld(2110);
initial.mode = 'observer';
initial.autopilot = { ...initial.autopilot, enabled: true };
const runA = run(initial, 1825);
const runB = run(initial, 1825);

assert.deepEqual(compact(runA), compact(runB));
assert.ok(Object.values(runA.contractMarket.windows).filter(window => window.status === 'closed').length >= 2, 'At least two market windows must close');
assert.ok(Object.values(runA.contractMarket.offers).some(offer => runA.promotions[offer.buyerPromotionId]?.control === 'ai'), 'AI must generate at least one offer');
assert.ok(runA.contractMarket.history.length > 0, 'Market history must contain at least one result');

console.log('Contract market long-sim checks passed.');
