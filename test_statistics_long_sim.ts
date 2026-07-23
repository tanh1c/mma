import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { advanceTime } from './src/lib/engine';
import { autoBookEventsAndContracts, maintainDeals, repairFutureEventAvailability, repairPastScheduledEvents, simulateDueEvents } from './src/lib/game/autobooker';
import { runObserverDecisions } from './src/lib/game/observer';
import { syncCalendarSlots, validateSeasonCalendarState } from './src/lib/game/season';
import { runAutopilotTournaments, syncTournamentTitleShotFlags, validateTitleShotDebtState, validateTournamentState } from './src/lib/game/tournament';
import { validateContractMarketState } from './src/lib/game/contractMarket';
import { validatePromotionEconomies } from './src/lib/game/promotionEconomy';
import { validateRoundStats } from './src/lib/game/fightSimulator';
import { getFighterStatistics, getStatisticsIndex, getStatsBoard, type StatisticsFilter } from './src/lib/game/statistics';
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

function assertFiniteTree(label: string, value: unknown, seen = new Set<unknown>()): void {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), `${label} contains a non-finite number: ${value}`);
    return;
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (value instanceof Map) {
    for (const [key, item] of value) {
      assertFiniteTree(`${label}.<key>`, key, seen);
      assertFiniteTree(`${label}.<value>`, item, seen);
    }
    return;
  }
  if (value instanceof Set) {
    for (const item of value) assertFiniteTree(`${label}.<set>`, item, seen);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertFiniteTree(`${label}[${index}]`, item, seen));
    return;
  }
  for (const [key, item] of Object.entries(value)) assertFiniteTree(`${label}.${key}`, item, seen);
}

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

const checkpointErrors = (state: GameState) => [
  ...validatePromotionEconomies(state),
  ...validateContractMarketState(state),
  ...validateSeasonCalendarState(state),
  ...validateTournamentState(state),
  ...validateTitleShotDebtState(state)
];

const run = (initial: GameState, days: number) => {
  randomState = 2110;
  const originalRandom = Math.random;
  Math.random = nextRandom;
  try {
    let state = structuredClone(initial);
    for (let day = 1; day <= days; day++) {
      state = advanceOneDay(state);
      if (day % 365 === 0) assert.deepEqual(checkpointErrors(state), [], `Yearly checkpoint failed on day ${day}`);
    }
    return state;
  } finally {
    Math.random = originalRandom;
  }
};

function assertUniqueIds(label: string, rows: Array<{ id: string }>): void {
  assert.equal(new Set(rows.map(row => row.id)).size, rows.length, `${label} contains duplicate IDs`);
}

function assertCompensation(state: GameState): void {
  for (const fight of Object.values(state.fightArchive)) {
    const compensation = fight.compensation ?? [];
    if (fight.scope !== 'international') assert.equal(compensation.length, 2, `Domestic fight ${fight.id} must have two compensation rows`);
    if (compensation.length) {
      assert.deepEqual(new Set(compensation.map(item => item.fighterId)), new Set([fight.redFighterId, fight.blueFighterId]), `Compensation corners mismatch for ${fight.id}`);
      for (const item of compensation) {
        assert.ok(Number.isFinite(item.basePurse) && item.basePurse >= 0, `Invalid base purse for ${fight.id}`);
        assert.ok(Number.isFinite(item.winBonus) && item.winBonus >= 0, `Invalid win bonus for ${fight.id}`);
        assert.ok(Number.isFinite(item.total) && item.total >= 0, `Invalid total purse for ${fight.id}`);
        assert.equal(item.total, item.basePurse + item.winBonus, `Compensation total mismatch for ${fight.id}`);
        assert.equal(item.winBonus, fight.winnerId === item.fighterId ? item.winBonus : 0, `Loser bonus mismatch for ${fight.id}`);
      }
    }
  }
}

function assertRankingHistory(state: GameState): void {
  const ids = new Set<string>();
  for (const item of state.fighterRankingHistory) {
    assert.equal(ids.has(item.id), false, `Duplicate ranking history ID: ${item.id}`);
    ids.add(item.id);
    assert.ok(item.date >= state.statisticsTrackingStartedAt, `Ranking history predates tracking boundary: ${item.id}`);
    assert.ok(item.date <= state.currentDate, `Ranking history is in the future: ${item.id}`);
    assert.ok(state.fighters[item.fighterId], `Ranking history references missing fighter: ${item.id}`);
    assert.ok(item.scope === 'promotion' || item.scope === 'world', `Invalid ranking scope: ${item.id}`);
    if (item.promotionId) assert.ok(state.promotions[item.promotionId], `Ranking history references missing promotion: ${item.id}`);
    for (const rank of [item.previousRank, item.rank]) {
      if (rank !== undefined) assert.ok(Number.isInteger(rank) && rank > 0, `Invalid ranking position: ${item.id}`);
    }
  }
}

function assertRoundStats(state: GameState): void {
  for (const fight of Object.values(state.fightArchive)) {
    if (!fight.roundStats) continue;
    assert.deepEqual(validateRoundStats(fight.roundStats), [], `Invalid round stats for ${fight.id}`);
    fight.roundStats.forEach((round, index) => {
      assert.equal(round.round, index + 1, `Round stats are not ordered for ${fight.id}`);
      assert.equal(round.judges.length, 3, `Round stats must have three judges for ${fight.id}`);
    });
  }
}

function assertStatsBoard(state: GameState): void {
  const index = getStatisticsIndex(state);
  assertFiniteTree('statistics index', index);
  for (const fighterId of Object.keys(state.fighters)) assertFiniteTree(`fighter ${fighterId}`, getFighterStatistics(state, fighterId));
  const promotionId = Object.keys(state.promotions)[0];
  assert.ok(promotionId, 'Expected at least one promotion');
  const filters: StatisticsFilter[] = [
    { period: { kind: 'all-time' }, scope: { kind: 'world' }, weightClass: 'all' },
    { period: { kind: 'current-season' }, scope: { kind: 'world' }, weightClass: 'all' },
    { period: { kind: 'all-time' }, scope: { kind: 'promotion', promotionId }, weightClass: 'all' },
    { period: { kind: 'all-time' }, scope: { kind: 'international' }, weightClass: 'all' }
  ];
  for (const year of index.years) filters.push({ period: { kind: 'year', year }, scope: { kind: 'world' }, weightClass: 'all' });
  for (const filter of filters) {
    const board = getStatsBoard(state, filter);
    assertFiniteTree(`stats board ${JSON.stringify(filter)}`, board);
    for (const rows of Object.values(board.fighterLeaders)) assertUniqueIds('fighter leaders', rows);
    assertUniqueIds('fight records', board.fightRecords);
    assertUniqueIds('events', board.events);
    assertUniqueIds('promotions', board.promotions);
    assertUniqueIds('titles', board.titles);
    assertUniqueIds('tournaments', board.tournaments);
    for (const row of board.fighterLeaders.winPercentage.concat(board.fighterLeaders.strikingAccuracy, board.fighterLeaders.takedownAccuracy)) assert.ok(row.value >= 0 && row.value <= 1, `Invalid fighter percentage: ${row.id}`);
    for (const row of board.events) if (row.finishRate !== null) assert.ok(row.finishRate >= 0 && row.finishRate <= 1, `Invalid event finish rate: ${row.id}`);
    for (const row of board.tournaments) if (row.finishRate !== null) assert.ok(row.finishRate >= 0 && row.finishRate <= 1, `Invalid tournament finish rate: ${row.id}`);
    for (const row of board.fighterLeaders.wins) assert.ok(state.fighters[row.fighterId], `Missing fighter leader reference: ${row.id}`);
    for (const row of board.fightRecords) assert.ok(state.fightArchive[row.fightId], `Missing fight record reference: ${row.id}`);
    for (const row of board.events) assert.ok(state.eventArchive[row.eventId], `Missing event reference: ${row.id}`);
    for (const row of board.promotions) assert.ok(state.promotions[row.promotionId], `Missing promotion reference: ${row.id}`);
    for (const row of board.titles) {
      assert.ok(state.fighters[row.fighterId], `Missing title fighter reference: ${row.id}`);
      if (row.promotionId) assert.ok(state.promotions[row.promotionId], `Missing title promotion reference: ${row.id}`);
    }
    for (const row of board.tournaments) assert.ok(state.tournaments[row.tournamentId], `Missing tournament reference: ${row.id}`);
  }
}

const compact = (state: GameState) => ({
  currentDate: state.currentDate,
  fights: Object.values(state.fightArchive).map(fight => [fight.id, fight.date, fight.redFighterId, fight.blueFighterId, fight.winnerId, fight.method, fight.round, fight.time, fight.performanceRating, fight.roundStats?.length ?? 0, fight.compensation]),
  events: Object.values(state.eventArchive).map(event => [event.id, event.date, event.fightIds, event.revenue, event.cost, event.profit]),
  titleHistory: state.titleHistory,
  fighterRankingHistory: state.fighterRankingHistory,
  statsBoard: getStatsBoard(state, { period: { kind: 'all-time' }, scope: { kind: 'world' }, weightClass: 'all' })
});

const initial = generateInitialWorld(2110);
initial.mode = 'observer';
initial.autopilot = { ...initial.autopilot, enabled: true };
const runA = run(initial, 1825);
const runB = run(initial, 1825);

assert.deepEqual(compact(runA), compact(runB));
assert.ok(Object.values(runA.fightArchive).some(fight => fight.roundStats?.length), 'Long simulation must produce archived round statistics');
assert.ok(runA.fighterRankingHistory.length > 0, 'Long simulation must produce ranking history');
assertCompensation(runA);
assertRankingHistory(runA);
assertRoundStats(runA);
assertStatsBoard(runA);
console.log('Statistics long-sim checks passed.');
