import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { createFightSession, fightSessionToResult, runFightSession, stepFightSession, validateFightSession } from './src/lib/game/liveFight';
import { simulateFight, validateRoundStats } from './src/lib/game/fightSimulator';
import { useGameStore } from './src/store/gameStore';
import type { Event, FightMatchup } from './src/types/game';

const state = generateInitialWorld(2601);
const [red, blue] = Object.values(state.fighters).filter(fighter => fighter.weightClass === 'Lightweight').slice(0, 2);
const matchup: FightMatchup = { id: 'live-test', redCornerId: red.id, blueCornerId: blue.id, weightClass: 'Lightweight', isTitleFight: false, rounds: 3 };

assert.throws(() => fightSessionToResult(createFightSession(matchup, red, blue, 12345)), /finished/);
const first = runFightSession(createFightSession(matchup, red, blue, 12345));
const second = runFightSession(createFightSession(matchup, red, blue, 12345));
assert.deepEqual(first, second);
assert.equal(first.phase, 'finished');
assert.deepEqual(validateFightSession(first), []);
assert.deepEqual(stepFightSession(first), first);
assert.ok(first.timeline.length > 1);
assert.ok(first.red.condition >= 0 && first.red.condition <= 100);
assert.ok(first.blue.condition >= 0 && first.blue.condition <= 100);

const result = fightSessionToResult(first);
assert.deepEqual(simulateFight(matchup, red, blue, 12345), result);
assert.ok(result.winnerId === null || result.winnerId === red.id || result.winnerId === blue.id);
assert.ok(result.loserId === null || result.loserId === red.id || result.loserId === blue.id);
assert.ok(result.round >= 1 && result.round <= matchup.rounds);
assert.match(result.time, /^\d:\d{2}$/);
assert.ok(result.commentary.length > 0);
assert.ok(result.performanceRating >= 10 && result.performanceRating <= 100);
assert.deepEqual(validateRoundStats(result.roundStats ?? []), []);
assert.equal(result.roundStats?.length, result.round);
assert.deepEqual(Object.keys(result.popularityDelta ?? {}).sort(), [blue.id, red.id].sort());
assert.deepEqual(Object.keys(result.moraleDelta ?? {}).sort(), [blue.id, red.id].sort());
assert.deepEqual(Object.keys(result.momentumDelta ?? {}).sort(), [blue.id, red.id].sort());
if (result.method.includes('Decision') || result.method === 'Draw') assert.equal(result.scorecards?.length, 3);
if (first.red.condition === 0 || first.blue.condition === 0) assert.equal(result.method, 'KO/TKO');

let submissionSession: ReturnType<typeof runFightSession> | null = null;
for (let seed = 1; seed <= 2000 && !submissionSession; seed++) {
  const candidate = runFightSession(createFightSession(matchup, red, blue, seed));
  if (candidate.method === 'Submission') submissionSession = candidate;
}
assert.ok(submissionSession, 'Expected a deterministic submission seed');
const submissionLoser = submissionSession.loserId === red.id ? submissionSession.red : submissionSession.blue;
assert.ok(submissionLoser.condition > 0);
assert.equal(fightSessionToResult(submissionSession).method, 'Submission');

let session = createFightSession(matchup, red, blue, 6789);
let ticks = 0;
while (session.phase !== 'finished') {
  session = stepFightSession(session);
  assert.deepEqual(validateFightSession(session), []);
  assert.ok(++ticks <= matchup.rounds * 80);
}

let finalSecondTakedown: ReturnType<typeof stepFightSession> | null = null;
for (let seed = 1; seed <= 100 && !finalSecondTakedown; seed++) {
  const candidate = createFightSession(matchup, red, blue, seed);
  candidate.clock = 1;
  candidate.position = 'clinch';
  candidate.currentRoundStats.red.controlSeconds = 150;
  candidate.currentRoundStats.blue.controlSeconds = 149;
  const stepped = stepFightSession(candidate);
  if (stepped.timeline.some(event => event.type === 'takedown')) finalSecondTakedown = stepped;
}
assert.ok(finalSecondTakedown, 'Expected a deterministic final-second takedown seed');
assert.ok(finalSecondTakedown.roundStats[0].red.controlSeconds + finalSecondTakedown.roundStats[0].blue.controlSeconds <= 300);

const fiveRound = runFightSession(createFightSession({ ...matchup, id: 'live-five', rounds: 5 }, red, blue, 9876));
assert.equal(fiveRound.phase, 'finished');
assert.ok(fiveRound.round <= 5);
assert.deepEqual(validateFightSession(fiveRound), []);
assert.equal(typeof first.red.bodyDamage, 'number');
assert.equal(typeof first.red.legDamage, 'number');
const invalidLocalizedDamage = structuredClone(first) as typeof first & { red: { bodyDamage?: number; legDamage: number } };
delete invalidLocalizedDamage.red.bodyDamage;
invalidLocalizedDamage.red.legDamage = Number.NaN;
assert.ok(validateFightSession(invalidLocalizedDamage).some(error => error.includes('damage')));
const invalidResources = structuredClone(first);
invalidResources.red.condition = Number.NaN;
invalidResources.blue.stamina = Number.NaN;
assert.ok(validateFightSession(invalidResources).some(error => error.includes('condition')));
assert.ok(validateFightSession(invalidResources).some(error => error.includes('stamina')));

const zeroCondition = createFightSession(matchup, red, blue, 42);
zeroCondition.blue.condition = 0;
const stopped = stepFightSession(zeroCondition);
assert.equal(stopped.phase, 'finished');
assert.equal(stopped.method, 'KO/TKO');
assert.equal(stopped.winnerId, red.id);
assert.ok(validateFightSession(zeroCondition).some(error => error.includes('condition')));

const healthySession = createFightSession(matchup, red, blue, 333);
const compromised = structuredClone(red);
compromised.age = 39;
compromised.morale = 20;
compromised.momentum = 10;
compromised.fatigue = 75;
compromised.injuryStatus = { id: 'live-test-injury', type: 'Knee Injury', daysRemaining: 30 };
const compromisedSession = createFightSession(matchup, compromised, blue, 333);
assert.ok(compromisedSession.red.modifier < healthySession.red.modifier);
assert.notEqual(compromisedSession.rngState, 333);
assert.deepEqual(createFightSession(matchup, compromised, blue, 333), compromisedSession);

const boxer = structuredClone(red);
const wrestler = structuredClone(red);
boxer.style = 'Boxer';
wrestler.style = 'Wrestler';
const styleOpponent = structuredClone(blue);
styleOpponent.attributes = { ...styleOpponent.attributes, striking: boxer.attributes.striking, wrestling: boxer.attributes.wrestling, grappling: boxer.attributes.grappling, submissions: boxer.attributes.submissions };
const boxerSession = runFightSession(createFightSession({ ...matchup, id: 'boxer-style' }, boxer, styleOpponent, 444));
const wrestlerSession = runFightSession(createFightSession({ ...matchup, id: 'wrestler-style' }, wrestler, styleOpponent, 444));
assert.notDeepEqual(boxerSession.timeline.map(event => event.type), wrestlerSession.timeline.map(event => event.type));

const invalidStats = createFightSession(matchup, red, blue, 55);
invalidStats.currentRoundStats.red.totalStrikesAttempted = -1;
assert.ok(validateFightSession(invalidStats).some(error => error.includes('statistics')));
const invalidRoundStats = structuredClone(result.roundStats!);
invalidRoundStats[0].red.damageGiven = Number.NaN;
invalidRoundStats[0].blue.submissionAttempts = -1;
invalidRoundStats[0].judges = [];
assert.ok(validateRoundStats(invalidRoundStats).some(error => error.includes('finite')));
assert.ok(validateRoundStats(invalidRoundStats).some(error => error.includes('judges')));
const stalled = createFightSession(matchup, red, blue, 56);
stalled.matchup.rounds = 0;
assert.throws(() => runFightSession(stalled), /did not finish/);

const storeWorld = generateInitialWorld(2602);
const [storeRed, storeBlue] = Object.values(storeWorld.fighters).filter(fighter => fighter.weightClass === 'Lightweight').slice(0, 2);
const liveEvent: Event = {
  id: 'live-store-event',
  name: 'Live Store Event',
  date: storeWorld.currentDate,
  venueId: Object.keys(storeWorld.venues)[0],
  ticketPrice: 20,
  marketingSpend: 0,
  isCompleted: false,
  fights: [{ id: 'live-store-fight', redCornerId: storeRed.id, blueCornerId: storeBlue.id, weightClass: 'Lightweight', isTitleFight: false, rounds: 3 }]
};
useGameStore.setState({ ...storeWorld, events: { ...storeWorld.events, [liveEvent.id]: liveEvent }, activeEventSimulation: null });
const store = () => useGameStore.getState();
store().startEventSimulation(liveEvent.id);
const storeFightIndex = store().events[liveEvent.id].fights.length - 1;
assert.deepEqual(store().activeEventSimulation, { eventId: liveEvent.id, activeFightIndex: storeFightIndex, session: null, status: 'idle', playbackSpeed: 1 });
store().startLiveFight();
const startedSession = structuredClone(store().activeEventSimulation!.session!);
assert.equal(store().activeEventSimulation!.status, 'running');
store().startLiveFight();
assert.deepEqual(store().activeEventSimulation!.session, startedSession);
store().toggleLiveFightPause();
assert.equal(store().activeEventSimulation!.status, 'paused');
store().advanceLiveFight();
assert.deepEqual(store().activeEventSimulation!.session, startedSession);
store().toggleLiveFightPause();
store().setLiveFightPlayback(4);
assert.equal(store().activeEventSimulation!.playbackSpeed, 4);
store().advanceLiveFight();
assert.notDeepEqual(store().activeEventSimulation!.session, startedSession);
const beforeSkip = structuredClone(store().activeEventSimulation!.session!);
store().skipLiveFight();
assert.equal(store().activeEventSimulation!.status, 'finished');
assert.deepEqual(store().activeEventSimulation!.session, runFightSession(beforeSkip));
const finishedSession = structuredClone(store().activeEventSimulation!.session!);
store().advanceLiveFight();
assert.deepEqual(store().activeEventSimulation!.session, finishedSession);
store().confirmPendingFightAndAdvance();
assert.ok(store().events[liveEvent.id].fights[storeFightIndex].result);
assert.deepEqual(store().activeEventSimulation, { eventId: liveEvent.id, activeFightIndex: storeFightIndex - 1, session: null, status: storeFightIndex === 0 ? 'completed' : 'idle', playbackSpeed: 4 });
const confirmedArchiveCount = Object.keys(store().fightArchive).length;
store().confirmPendingFightAndAdvance();
assert.equal(Object.keys(store().fightArchive).length, confirmedArchiveCount);

console.log('Live fight session tests passed.');
