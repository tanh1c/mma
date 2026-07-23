import assert from 'node:assert/strict';
import i18n from './src/i18n';
import { generateInitialWorld } from './src/lib/game/generator';
import { createFightSession, fightSessionToResult, runFightSession, stepFightSession, validateFightSession } from './src/lib/game/liveFight';
import { simulateFight, validateRoundStats } from './src/lib/game/fightSimulator';
import { useGameStore } from './src/store/gameStore';
import type { Event, FightMatchup } from './src/types/game';

const ROUND_MS = 300_000;

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
assert.ok(first.timeline.every(event => event.visual), 'Every timeline event needs a visual cue');
const firstActionInput = createFightSession(matchup, red, blue, 12345);
const firstActionInputSnapshot = structuredClone(firstActionInput);
const firstAction = stepFightSession(firstActionInput);
const firstActionEvent = firstAction.timeline.at(-1)!;
assert.deepEqual(firstActionInput, firstActionInputSnapshot, 'A step must not mutate its input session');
assert.strictEqual(firstAction.timeline[0], firstActionInput.timeline[0], 'A step must reuse immutable timeline history');
assert.notStrictEqual(firstAction.currentRoundStats, firstActionInput.currentRoundStats, 'A step must isolate mutable round statistics');
assert.equal(firstAction.timeline.length, 2, 'One step must append exactly one event after round-start');
assert.ok(firstActionEvent.durationMs > 0);
assert.equal(firstActionEvent.clockBeforeMs - firstActionEvent.clockAfterMs, firstActionEvent.durationMs);
assert.equal(firstAction.clockMs, firstActionEvent.clockAfterMs);

let stepped = createFightSession(matchup, red, blue, 6789);
let previousLength = stepped.timeline.length;
let guard = 0;
while (stepped.phase !== 'finished') {
  const next = stepFightSession(stepped);
  assert.equal(next.timeline.length - previousLength, 1, 'Every unfinished step must append exactly one event');
  previousLength = next.timeline.length;
  stepped = next;
  assert.deepEqual(validateFightSession(stepped), []);
  assert.ok(++guard <= matchup.rounds * 1_000);
}
assert.deepEqual(stepFightSession(stepped), stepped, 'Finished sessions must be idempotent');

for (const round of Array.from({ length: first.matchup.rounds }, (_, index) => index + 1)) {
  const events = first.timeline.filter(event => event.round === round && event.durationMs > 0);
  const reachedBell = events.some(event => event.clockAfterMs === 0);
  if (reachedBell) {
    assert.equal(events[0]?.clockBeforeMs, ROUND_MS);
    assert.equal(events.reduce((sum, event) => sum + event.durationMs, 0), ROUND_MS);
    events.slice(1).forEach((event, index) => assert.equal(events[index].clockAfterMs, event.clockBeforeMs));
  } else if (events.length > 0) {
    assert.ok(first.finishRound === round && first.method !== null, `Round ${round} ended early without a finish`);
  }
}

const minimumVisualDurationMs: Partial<Record<(typeof first.timeline)[number]['visual']['action'], number>> = {
  movement: 800,
  strike: 800,
  knockdown: 800,
  clinch: 800,
  'ground-pound': 800,
  takedown: 800,
  'takedown-defense': 800,
  sprawl: 800,
  submission: 800,
  recovery: 800
};

for (const event of first.timeline) {
  const minimum = minimumVisualDurationMs[event.visual.action];
  if (minimum !== undefined && event.durationMs > 0 && event.clockAfterMs > 0) {
    assert.ok(event.durationMs >= minimum, `${event.visual.action} ended after ${event.durationMs}ms before its sprite could finish`);
  }
  assert.ok(Number.isInteger(event.durationMs) && event.durationMs >= 0);
  assert.ok(event.clockBeforeMs >= event.clockAfterMs);
  assert.ok(event.clockBeforeMs <= ROUND_MS && event.clockAfterMs >= 0);
  if (['round-start', 'round-end', 'recovery', 'finish'].includes(event.type)) assert.equal(event.durationMs, 0);
  else assert.ok(event.durationMs > 0);
}
assert.ok(first.timeline.some(event => event.type === 'finish' && event.durationMs === 0));
const sample = Array.from({ length: 100 }, (_, index) => runFightSession(createFightSession(matchup, red, blue, index + 1)));
let completedRounds = 0;
let totalRedAttempts = 0;
let totalBlueAttempts = 0;
let longestRepeat = 0;
let totalLanded = 0;
let totalAttempts = 0;
let totalTakedownsLanded = 0;
let totalTakedownsAttempted = 0;
let distanceMs = 0;
let clinchMs = 0;
let groundMs = 0;
let finalStamina = 0;
const methods = new Set<string>();

for (const candidate of sample) {
  methods.add(candidate.method ?? '');
  const result = fightSessionToResult(candidate);
  const rounds = result.roundStats ?? [];
  if (candidate.method === 'Submission') {
    assert.ok(candidate.timeline.some(event => event.visual.action === 'submission' && event.visual.outcome === 'finished'));
  }
  totalRedAttempts += rounds.reduce((sum, round) => sum + round.red.totalStrikesAttempted, 0);
  totalBlueAttempts += rounds.reduce((sum, round) => sum + round.blue.totalStrikesAttempted, 0);
  completedRounds += rounds.length;
  for (const round of rounds) {
    totalLanded += round.red.totalStrikesLanded + round.blue.totalStrikesLanded;
    totalAttempts += round.red.totalStrikesAttempted + round.blue.totalStrikesAttempted;
    totalTakedownsLanded += round.red.takedownsLanded + round.blue.takedownsLanded;
    totalTakedownsAttempted += round.red.takedownsAttempted + round.blue.takedownsAttempted;
    finalStamina += round.red.staminaEnd + round.blue.staminaEnd;
  }
  let previous = '';
  let run = 0;
  for (const event of candidate.timeline) {
    const action = `${event.positionBefore}:${event.visual.action}:${event.visual.strike ?? ''}`;
    run = action === previous ? run + 1 : 1;
    previous = action;
    longestRepeat = Math.max(longestRepeat, run);
    if (event.durationMs > 0) {
      if (event.positionBefore === 'distance') distanceMs += event.durationMs;
      else if (event.positionBefore === 'clinch') clinchMs += event.durationMs;
      else groundMs += event.durationMs;
    }
    if (event.visual.strike) {
      assert.notEqual(event.positionBefore, 'ground');
      if (event.positionBefore === 'distance') assert.ok(!['knee', 'elbow'].includes(event.visual.strike));
      if (event.visual.targetZone === 'leg') assert.equal(event.visual.strike, 'low-kick');
      if (event.visual.targetZone === 'body') assert.ok(['body-hook', 'body-kick', 'jab', 'cross', 'knee'].includes(event.visual.strike));
      if (event.visual.targetZone === 'head') assert.ok(['jab', 'cross', 'hook', 'high-kick', 'knee', 'elbow'].includes(event.visual.strike));
    }
    if (event.visual.action === 'submission') assert.notEqual(event.positionBefore, 'distance');
    if (event.type === 'knockdown') {
      assert.notEqual(event.positionBefore, 'ground');
      assert.equal(event.visual.action, 'knockdown');
    }
    if (event.visual.action === 'ground-pound') assert.equal(event.positionBefore, 'ground');
    if (event.visual.action === 'takedown') assert.notEqual(event.positionBefore, 'ground');
    if ((event.visual.action === 'takedown-defense' || event.visual.action === 'sprawl') && event.visual.outcome === 'failed') assert.equal(event.positionAfter, event.positionBefore);
    if (event.positionBefore === 'ground' && event.positionAfter === 'distance') {
      assert.equal(event.visual.action, 'recovery');
      assert.equal(event.visual.transition, 'ground-to-distance');
    }
  }
  const visibleTakedowns = candidate.timeline.filter(event => event.visual.action === 'takedown' && event.visual.outcome === 'landed').length;
  const recordedTakedowns = result.roundStats?.reduce((sum, round) => sum + round.red.takedownsLanded + round.blue.takedownsLanded, 0) ?? 0;
  assert.equal(visibleTakedowns, recordedTakedowns, 'Every visible takedown must equal one recorded landed takedown');
  assert.ok(candidate.timeline.some(event => event.importance === 'routine' && event.durationMs > 0));
  assert.ok((result.commentary?.length ?? 0) <= candidate.matchup.rounds * 12);
  assert.ok(result.commentary?.every(line => candidate.timeline.some(event => event.importance !== 'routine' && event.commentary === line)));
}

const attemptsPerFighterRound = (totalRedAttempts + totalBlueAttempts) / Math.max(1, completedRounds * 2);
const accuracy = totalLanded / Math.max(1, totalAttempts);
const takedownAccuracy = totalTakedownsLanded / Math.max(1, totalTakedownsAttempted);
const positionMs = distanceMs + clinchMs + groundMs;
const averageFinalStamina = finalStamina / Math.max(1, completedRounds * 2);
assert.ok(attemptsPerFighterRound >= 25 && attemptsPerFighterRound <= 85, `Unexpected attempts per fighter-round: ${attemptsPerFighterRound}`);
assert.ok(accuracy >= 0.25 && accuracy <= 0.75, `Unexpected strike accuracy: ${accuracy}`);
assert.ok(takedownAccuracy >= 0.1 && takedownAccuracy <= 0.85, `Unexpected takedown accuracy: ${takedownAccuracy}`);
assert.ok(distanceMs / positionMs >= 0.2 && distanceMs / positionMs <= 0.9);
assert.ok(clinchMs > 0 && groundMs > 0);
assert.ok(sample.some(candidate => candidate.timeline.some(event => event.visual.action === 'movement')));
assert.ok(sample.some(candidate => candidate.timeline.some(event => event.visual.action === 'idle' && event.positionBefore === 'ground')));
assert.ok(averageFinalStamina >= 5 && averageFinalStamina <= 90, `Unexpected final stamina: ${averageFinalStamina}`);
assert.ok(longestRepeat <= 5, `Action repetition run too long: ${longestRepeat}`);
assert.ok(methods.has('KO/TKO'));
assert.ok(methods.has('Submission'));
assert.ok([...methods].some(method => method.includes('Decision') || method === 'Draw'));

const favorite = structuredClone(red);
const underdog = structuredClone(blue);
favorite.id = 'favorite';
underdog.id = 'underdog';
for (const key of Object.keys(favorite.attributes) as Array<keyof typeof favorite.attributes>) favorite.attributes[key] = Math.min(95, favorite.attributes[key] + 12);
for (const key of Object.keys(underdog.attributes) as Array<keyof typeof underdog.attributes>) underdog.attributes[key] = Math.max(25, underdog.attributes[key] - 12);
const favoriteMatchup = { ...matchup, id: 'favorite-sample', redCornerId: favorite.id, blueCornerId: underdog.id };
const favoriteWins = Array.from({ length: 60 }, (_, index) => runFightSession(createFightSession(favoriteMatchup, favorite, underdog, index + 1)))
  .filter(candidate => candidate.winnerId === favorite.id).length;
assert.ok(favoriteWins >= 36, `Favorite influence too weak: ${favoriteWins}/60`);
assert.ok(first.red.condition >= 0 && first.red.condition <= 100);
assert.ok(first.blue.condition >= 0 && first.blue.condition <= 100);

const withoutFightProse = (value: typeof first) => ({
  ...value,
  language: undefined,
  commentary: [],
  timeline: value.timeline.map(event => ({ ...event, headline: '', commentary: '' })),
  roundStats: value.roundStats.map(round => ({ ...round, summary: '', keyMoments: [] })),
  currentRoundStats: { ...value.currentRoundStats, keyMoments: [] }
});
const englishFight = runFightSession(createFightSession(matchup, red, blue, 12345, 'en'));
const vietnameseFight = runFightSession(createFightSession(matchup, red, blue, 12345, 'vi'));
assert.deepEqual(withoutFightProse(englishFight), withoutFightProse(vietnameseFight));
assert.deepEqual(englishFight.timeline.map(event => event.visual), vietnameseFight.timeline.map(event => event.visual));
assert.notDeepEqual(englishFight.timeline.filter(event => event.importance !== 'routine').map(event => event.commentary), vietnameseFight.timeline.filter(event => event.importance !== 'routine').map(event => event.commentary));
assert.notDeepEqual(fightSessionToResult(englishFight).commentary, fightSessionToResult(vietnameseFight).commentary);
assert.deepEqual(englishFight, runFightSession(createFightSession(matchup, red, blue, 12345, 'en')));
const vietnameseStart = createFightSession(matchup, red, blue, 54321, 'vi');
await i18n.changeLanguage('en');
const vietnameseAfterGlobalChange = runFightSession(vietnameseStart);
assert.equal(vietnameseAfterGlobalChange.language, 'vi');
assert.ok(vietnameseAfterGlobalChange.timeline.some(event => event.importance !== 'routine' && /hiệp|trọng tài|võ sĩ|góc đài/i.test(event.commentary)));

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
  assert.ok(++ticks <= matchup.rounds * 1_000);
}

let finalSecondTakedown: ReturnType<typeof stepFightSession> | null = null;
for (let seed = 1; seed <= 100 && !finalSecondTakedown; seed++) {
  const candidate = createFightSession(matchup, red, blue, seed);
  candidate.clockMs = 1;
  candidate.position = 'clinch';
  candidate.currentRoundStats.red.controlSeconds = 150;
  candidate.currentRoundStats.blue.controlSeconds = 149;
  const stepped = stepFightSession(candidate);
  if (stepped.timeline.some(event => event.type === 'takedown')) finalSecondTakedown = stepped;
}
assert.ok(finalSecondTakedown, 'Expected a deterministic final-second takedown seed');
const finalSecondScored = finalSecondTakedown.roundStats[0] ? finalSecondTakedown : stepFightSession(finalSecondTakedown);
assert.ok(finalSecondScored.roundStats[0].red.controlSeconds + finalSecondScored.roundStats[0].blue.controlSeconds <= 300);

const groundRoundGate = createFightSession(matchup, red, blue, 9876);
groundRoundGate.phase = 'between-rounds';
groundRoundGate.clockMs = 0;
groundRoundGate.position = 'ground';
groundRoundGate.controller = 'red';
const groundRoundRecovery = stepFightSession(groundRoundGate).timeline.at(-1)!;
assert.equal(groundRoundRecovery.type, 'recovery');
assert.equal(groundRoundRecovery.actor, 'blue');
assert.equal(groundRoundRecovery.target, 'red');

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
let boxerStandingAttempts = 0;
let wrestlerStandingAttempts = 0;
let boxerTakedownAttempts = 0;
let wrestlerTakedownAttempts = 0;
for (let seed = 1; seed <= 30; seed++) {
  const boxerResult = fightSessionToResult(runFightSession(createFightSession({ ...matchup, id: 'boxer-style' }, boxer, styleOpponent, seed)));
  const wrestlerResult = fightSessionToResult(runFightSession(createFightSession({ ...matchup, id: 'wrestler-style' }, wrestler, styleOpponent, seed)));
  boxerStandingAttempts += boxerResult.roundStats?.reduce((sum, round) => sum + round.red.totalStrikesAttempted, 0) ?? 0;
  wrestlerStandingAttempts += wrestlerResult.roundStats?.reduce((sum, round) => sum + round.red.totalStrikesAttempted, 0) ?? 0;
  boxerTakedownAttempts += boxerResult.roundStats?.reduce((sum, round) => sum + round.red.takedownsAttempted, 0) ?? 0;
  wrestlerTakedownAttempts += wrestlerResult.roundStats?.reduce((sum, round) => sum + round.red.takedownsAttempted, 0) ?? 0;
}
assert.ok(boxerStandingAttempts > wrestlerStandingAttempts, `Expected Boxer standing strike bias: ${boxerStandingAttempts}/${wrestlerStandingAttempts}`);
const boxerTakedownShare = boxerTakedownAttempts / Math.max(1, boxerStandingAttempts + boxerTakedownAttempts);
const wrestlerTakedownShare = wrestlerTakedownAttempts / Math.max(1, wrestlerStandingAttempts + wrestlerTakedownAttempts);
assert.ok(wrestlerTakedownShare > boxerTakedownShare, `Expected Wrestler takedown bias: ${wrestlerTakedownShare}/${boxerTakedownShare}`);

let before = createFightSession(matchup, red, blue, 101);
let strikeChecked = false;
for (let step = 0; step < 1_000 && !strikeChecked; step++) {
  const redAttempts = before.currentRoundStats.red.totalStrikesAttempted;
  const blueAttempts = before.currentRoundStats.blue.totalStrikesAttempted;
  const after = stepFightSession(before);
  const event = after.timeline.at(-1)!;
  if (event.sequence > before.timeline.length && event.visual.action === 'strike') {
    const delta = after.currentRoundStats.red.totalStrikesAttempted - redAttempts + after.currentRoundStats.blue.totalStrikesAttempted - blueAttempts;
    assert.equal(delta, 1, 'One visible strike must equal one gameplay attempt');
    strikeChecked = true;
  }
  before = after.phase === 'between-rounds' ? stepFightSession(after) : after;
}
assert.ok(strikeChecked);

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
assert.deepEqual(store().activeEventSimulation, { eventId: liveEvent.id, activeFightIndex: storeFightIndex, session: null, status: 'idle', playbackSpeed: 1, playbackSnapshot: null, eventElapsedMs: 0, roundGateToken: null });
store().startLiveFight();
const startedSession = structuredClone(store().activeEventSimulation!.session!);
assert.equal(store().activeEventSimulation!.status, 'running');
assert.equal(store().activeEventSimulation!.eventElapsedMs, 0);
assert.ok(store().activeEventSimulation!.playbackSnapshot);
assert.equal(store().activeEventSimulation!.playbackSnapshot!.sequence, store().activeEventSimulation!.session!.timeline.at(-1)!.sequence);
assert.notStrictEqual(store().activeEventSimulation!.playbackSnapshot!.currentRoundStats, store().activeEventSimulation!.session!.currentRoundStats, 'Snapshot statistics must be immutable copies');

const playbackSequence = store().activeEventSimulation!.session!.timeline.at(-1)!.sequence;
store().checkpointLiveFightPlayback(playbackSequence, 400);
assert.equal(store().activeEventSimulation!.eventElapsedMs, 400);
store().checkpointLiveFightPlayback(playbackSequence - 1, 700);
assert.equal(store().activeEventSimulation!.eventElapsedMs, 400, 'A stale event checkpoint must be ignored');
store().startLiveFight();
assert.deepEqual(store().activeEventSimulation!.session, startedSession);
store().toggleLiveFightPause();
assert.equal(store().activeEventSimulation!.status, 'paused');
store().advanceLiveFight();
assert.deepEqual(store().activeEventSimulation!.session, startedSession);
assert.equal(store().activeEventSimulation!.eventElapsedMs, 400);
store().toggleLiveFightPause();
store().setLiveFightPlayback(4);
assert.equal(store().activeEventSimulation!.playbackSpeed, 4);
store().advanceLiveFight();
assert.notDeepEqual(store().activeEventSimulation!.session, startedSession);
assert.equal(store().activeEventSimulation!.eventElapsedMs, 0);
let gateGuard = 0;
while (store().activeEventSimulation!.status === 'running' && ++gateGuard < 2_000) store().advanceLiveFight();
if (store().activeEventSimulation!.status === 'between-rounds') {
  const gate = store().activeEventSimulation!.roundGateToken;
  const round = store().activeEventSimulation!.session!.round;
  store().continueLiveFightRound();
  assert.equal(store().activeEventSimulation!.session!.round, round + 1);
  assert.equal(store().activeEventSimulation!.roundGateToken, null);
  const continued = structuredClone(store().activeEventSimulation!.session);
  store().continueLiveFightRound();
  assert.deepEqual(store().activeEventSimulation!.session, continued);
  assert.ok(gate);
}
const beforeSkip = structuredClone(store().activeEventSimulation!.session!);
store().skipLiveFight();
assert.equal(store().activeEventSimulation!.status, 'finished');
assert.deepEqual(store().activeEventSimulation!.session, runFightSession(beforeSkip));
assert.equal(store().activeEventSimulation!.playbackSnapshot, null);
assert.equal(store().activeEventSimulation!.eventElapsedMs, 0);
assert.equal(store().activeEventSimulation!.roundGateToken, null);
const finishedSession = structuredClone(store().activeEventSimulation!.session!);
store().advanceLiveFight();
assert.deepEqual(store().activeEventSimulation!.session, finishedSession);
store().confirmPendingFightAndAdvance();
assert.ok(store().events[liveEvent.id].fights[storeFightIndex].result);
assert.deepEqual(store().activeEventSimulation, { eventId: liveEvent.id, activeFightIndex: storeFightIndex - 1, session: null, status: storeFightIndex === 0 ? 'completed' : 'idle', playbackSpeed: 4, playbackSnapshot: null, eventElapsedMs: 0, roundGateToken: null });
const confirmedArchiveCount = Object.keys(store().fightArchive).length;
store().confirmPendingFightAndAdvance();
assert.equal(Object.keys(store().fightArchive).length, confirmedArchiveCount);

console.log('Live fight session tests passed.');
