import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import type { GameState } from './src/types/game';

let randomState = 1;
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

const { autoBookEventsAndContracts, maintainDeals, repairFutureEventAvailability, repairPastScheduledEvents, simulateDueEvents } = await import('./src/lib/game/autobooker');
const { advanceTime } = await import('./src/lib/engine');
const { WEIGHT_CLASSES } = await import('./src/lib/game/constants');
const { generateInitialWorld } = await import('./src/lib/game/generator');
const { runObserverDecisions } = await import('./src/lib/game/observer');
const { syncCalendarSlots, validateSeasonCalendarState } = await import('./src/lib/game/season');
const { runAutopilotTournaments, syncTournamentTitleShotFlags } = await import('./src/lib/game/tournament');

function resetRandom(seed: number): void {
  randomState = seed >>> 0;
  Math.random = nextRandom;
}

function advanceObserverDay(state: GameState, language: 'en' | 'vi'): GameState {
  let next = syncCalendarSlots(state);
  next = repairPastScheduledEvents(next, language);
  next = syncCalendarSlots(simulateDueEvents(next, false, language).state);
  next = autoBookEventsAndContracts(next, language);
  next = runAutopilotTournaments(next, language);
  next = repairFutureEventAvailability(next, language);
  next = runObserverDecisions(next, language);
  next = advanceTime(next, 1, language);
  next = maintainDeals(next, language);
  next = repairFutureEventAvailability(next, language);
  next = syncTournamentTitleShotFlags(next);
  next = repairPastScheduledEvents(next, language);
  return syncCalendarSlots(simulateDueEvents(next, false, language).state);
}

function assertDramaState(state: GameState, elapsedDays: number): void {
  const incidents = Object.values(state.drama.incidents);
  assert.equal(incidents.some(item => item.status === 'pending'), false, `${state.currentDate}: pending Observer incident`);
  assert.equal(new Set(state.drama.triggerKeys).size, state.drama.triggerKeys.length, `${state.currentDate}: duplicate drama trigger key`);
  assert.ok(incidents.length <= Math.ceil(elapsedDays / 28) * 4 + 12, `${state.currentDate}: incident history grew to ${incidents.length}`);
  assert.deepEqual(validateSeasonCalendarState(state), [], `${state.currentDate}: invalid season calendar`);
  assert.ok(Object.values(state.fighters).every(fighter => fighter.personalityTraits.length >= 1 && fighter.personalityTraits.length <= 2));
  for (const weightClass of WEIGHT_CLASSES) {
    const viable = Object.values(state.fighters).filter(fighter => fighter.weightClass === weightClass && fighter.careerPhase !== 'retired' && fighter.contract);
    assert.ok(viable.length >= 4, `${state.currentDate}: ${weightClass} has only ${viable.length} viable signed fighters`);
  }
  const rewardIds = state.financeLedger.filter(entry => entry.id.startsWith('objective-reward-')).map(entry => entry.id);
  assert.equal(new Set(rewardIds).size, rewardIds.length, `${state.currentDate}: duplicate objective reward`);
}

function deterministicOutcome(state: GameState) {
  return {
    ...state,
    news: [],
    socialFeed: [],
    financeLedger: state.financeLedger.map(entry => ({ ...entry, description: '' }))
  };
}

function runSimulation(seed: number, language: 'en' | 'vi') {
  resetRandom(seed);
  let state = generateInitialWorld(seed);
  state = { ...state, mode: 'observer', autopilot: { ...state.autopilot, enabled: true } };
  const chunkDays = [366, 365, 365];
  const timings: number[] = [];
  let elapsedDays = 0;

  for (const days of chunkDays) {
    const started = performance.now();
    for (let day = 0; day < days; day++) state = advanceObserverDay(state, language);
    state = runObserverDecisions(state, language);
    timings.push(performance.now() - started);
    elapsedDays += days;
    assertDramaState(state, elapsedDays);
  }

  return { state, timings };
}

const first = runSimulation(1807, 'en');
const second = runSimulation(1807, 'en');
assert.deepEqual(deterministicOutcome(second.state), deterministicOutcome(first.state));

const reviewYears = Object.keys(first.state.drama.seasonReviews).map(Number).sort();
assert.equal(reviewYears.length, 3);
assert.deepEqual(reviewYears, [...new Set(reviewYears)]);
for (const year of reviewYears) {
  assert.equal(first.state.drama.objectives[year]?.length, 3, `${year}: expected one objective set`);
  assert.deepEqual(first.state.drama.seasonReviews[year].objectiveIds, first.state.drama.objectives[year].map(item => item.id));
}
const baseline = first.timings[0];
for (const timing of first.timings.slice(1)) {
  assert.ok(timing <= Math.max(baseline * 2.5, baseline + 5_000), `Later chunk slowed materially: ${first.timings.map(value => Math.round(value)).join(', ')}ms`);
}

console.log(`Three-year drama simulation passed (${first.timings.map(value => Math.round(value)).join(', ')}ms).`);
