import assert from 'node:assert/strict';
import { autoBookEventsAndContracts, maintainDeals, repairFutureEventAvailability, repairPastScheduledEvents, simulateDueEvents } from './src/lib/game/autobooker';
import { processAnnualCareerLifecycle } from './src/lib/game/career';
import { ensureEmergencyProspectPool, generateAnnualRookieClass } from './src/lib/game/careerEcosystem';
import { advanceTime } from './src/lib/engine';
import { WEIGHT_CLASSES } from './src/lib/game/constants';
import { getFighterOverall } from './src/lib/game/fighterRatings';
import { generateInitialWorld } from './src/lib/game/generator';
import { runObserverDecisions } from './src/lib/game/observer';
import { buildPromotionRankings } from './src/lib/game/rankings';
import { PRNG } from './src/lib/game/rng';
import { syncCalendarSlots } from './src/lib/game/season';
import { runAutopilotTournaments, syncTournamentTitleShotFlags, validateTitleShotDebtState, validateTournamentState } from './src/lib/game/tournament';
import type { GameState } from './src/types/game';

function advanceObserverDay(state: GameState): GameState {
  let next = syncCalendarSlots(state);
  next = repairPastScheduledEvents(next, 'en');
  next = syncCalendarSlots(simulateDueEvents(next, false, 'en').state);
  next = autoBookEventsAndContracts(next, 'en');
  next = runAutopilotTournaments(next, 'en');
  next = repairFutureEventAvailability(next, 'en');
  next = runObserverDecisions(next, 'en');
  next = advanceTime(next, 1, 'en');
  next = maintainDeals(next, 'en');
  next = repairFutureEventAvailability(next, 'en');
  next = syncTournamentTitleShotFlags(next);
  next = repairPastScheduledEvents(next, 'en');
  return syncCalendarSlots(simulateDueEvents(next, false, 'en').state);
}

function assertCareerState(state: GameState): void {
  const fighters = Object.values(state.fighters);
  const active = fighters.filter(fighter => fighter.careerPhase !== 'retired');
  const rankedIds = Object.values(state.rankings).flat().map(item => item.fighterId);
  assert.deepEqual(active.filter(fighter => fighter.age > 45).map(fighter => `${fighter.id}:${fighter.age}`), [], `${state.currentDate}: active fighters over age 45`);
  assert.deepEqual(rankedIds.filter(id => state.fighters[id]?.careerPhase === 'retired'), [], `${state.currentDate}: retired fighters remain ranked`);
  assert.deepEqual(rankedIds.filter(id => !state.fighters[id]?.contract), [], `${state.currentDate}: unsigned fighters remain ranked`);
  assert.equal(new Set(fighters.map(fighter => fighter.id)).size, fighters.length);
  assert.equal(validateTournamentState(state).length, 0);
  assert.equal(validateTitleShotDebtState(state).length, 0);
  for (const tournament of Object.values(state.tournaments)) {
    if (tournament.status !== 'planned' && tournament.status !== 'active') continue;
    const activeIds = [
      ...tournament.participants.map(item => item.fighterId),
      ...tournament.reserveFighterIds,
      ...tournament.fights.filter(item => !item.isCompleted).flatMap(item => [item.redFighterId, item.blueFighterId])
    ].filter((id): id is string => Boolean(id));
    assert.deepEqual(activeIds.filter(id => state.fighters[id]?.careerPhase === 'retired'), [], `${state.currentDate}: retired fighters remain in active tournament ${tournament.id}`);
  }
  for (const title of Object.values(state.titles)) {
    for (const id of [title.undisputedChampionId, title.interimChampionId]) {
      if (!id) continue;
      assert.ok(state.fighters[id]);
      assert.notEqual(state.fighters[id].careerPhase, 'retired');
      assert.ok(state.fighters[id].contract);
    }
  }
  for (const weightClass of WEIGHT_CLASSES) {
    const ranking = state.rankings[weightClass];
    assert.ok(ranking.length <= 16);
    assert.equal(ranking.every((item, index) => index === 0 || item.rank === ranking[index - 1].rank + 1), true);
    assert.equal(ranking.some(item => state.fighters[item.fighterId]?.weightClass !== weightClass), false);
  }
}

function withSeed<T>(seed: number, run: () => T): T {
  const rng = new PRNG(seed);
  const originalRandom = Math.random;
  Math.random = () => rng.next();
  try {
    return run();
  } finally {
    Math.random = originalRandom;
  }
}

function runObserverSmoke(baseState: GameState, days: number): GameState {
  return withSeed(117, () => {
    let state = structuredClone(baseState);
    state.mode = 'observer';
    state.autopilot = { ...state.autopilot, enabled: true };
    for (let day = 0; day < days; day++) state = advanceObserverDay(state);
    return state;
  });
}

function runAnnualCareerSimulation(baseState: GameState, years: number): GameState {
  return withSeed(117, () => {
    let state = structuredClone(baseState);
    state.mode = 'observer';
    state.autopilot = { ...state.autopilot, enabled: true };
    const firstYear = new Date(state.currentDate).getFullYear() + 1;
    for (let year = firstYear; year < firstYear + years; year++) {
      state = { ...state, currentDate: `${year}-01-01` };
      state = processAnnualCareerLifecycle(state, year, 'en');
      state = generateAnnualRookieClass(state, year, 'en');
      state = ensureEmergencyProspectPool(state, state.currentDate, 'en');
      state = autoBookEventsAndContracts(state, 'en');
      state = { ...state, rankings: buildPromotionRankings(state).newRankings };
      assertCareerState(state);
    }
    return state;
  });
}

function careerOutcome(state: GameState) {
  return {
    fighters: Object.values(state.fighters)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(fighter => ({
        id: fighter.id,
        age: fighter.age,
        attributes: fighter.attributes,
        potential: fighter.potential,
        careerPhase: fighter.careerPhase,
        lastLifecycleYear: fighter.lastLifecycleYear,
        retiredDate: fighter.retiredDate,
        retirementReason: fighter.retirementReason,
        hallOfFame: fighter.hallOfFame,
        signed: Boolean(fighter.contract)
      })),
    rankings: state.rankings,
    careerEcosystem: state.careerEcosystem
  };
}

const baseState = generateInitialWorld(117);
const hallCandidate = Object.values(baseState.fighters).find(fighter => fighter.contract)!;
baseState.fighters[hallCandidate.id] = {
  ...hallCandidate,
  age: 44,
  primeEndAge: 32,
  careerPhase: 'declining',
  potential: getFighterOverall(hallCandidate),
  record: { wins: 30, losses: 4, draws: 0, kos: 15, subs: 10 }
};
baseState.titleHistory.push({
  id: 'long-sim-hall-reign',
  weightClass: hallCandidate.weightClass,
  fighterId: hallCandidate.id,
  dateWon: '2020-01-01',
  dateLost: '2024-01-01',
  defenses: 10,
  wonFromFighterId: null,
  status: 'lost',
  beltType: 'undisputed'
});

const smoke = runObserverSmoke(baseState, 14);
assert.equal(smoke.currentDate, '2025-01-15');
assertCareerState(smoke);

const first = runAnnualCareerSimulation(baseState, 25);
const second = runAnnualCareerSimulation(baseState, 25);
assert.deepEqual(careerOutcome(first), careerOutcome(second));
assert.equal(first.careerEcosystem.rookieClassYears.length, 25);
assert.equal(Object.keys(first.fighters).filter(id => id.startsWith('rookie:')).length, 25 * 12);
assert.ok(Object.values(first.fighters).some(fighter => fighter.careerPhase === 'retired'));
assert.ok(first.fighters[hallCandidate.id].hallOfFame);
assert.ok(Object.values(first.fighters).some(fighter => fighter.age <= 24 && fighter.careerPhase !== 'retired'));
for (const weightClass of WEIGHT_CLASSES) {
  const division = Object.values(first.fighters).filter(fighter => fighter.weightClass === weightClass && fighter.careerPhase !== 'retired');
  assert.ok(division.length >= 24, `${weightClass} active pool fell to ${division.length}`);
  assert.ok(division.filter(fighter => fighter.contract).length >= 4);
  assert.equal(Object.keys(first.fighters).filter(id => id.startsWith('rookie:') && first.fighters[id].weightClass === weightClass).length, 25 * 2);
}

console.log('14-day Observer smoke and 25-year career simulation passed.');
