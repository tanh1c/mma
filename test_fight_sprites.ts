import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { FightTimelineEvent } from './src/lib/game/liveFight';
import { fightSpriteCycleDuration, fightSpriteDuration, fightSpriteFrameDelay, fightSpriteFrameIndex, fightSpritePlaybackSegment, fightSpriteSourceSegmentDuration, fightSpriteStrikeOffset, mappedFightSpriteActionIds, resolveFightSpriteScene, validateFightSpriteManifest } from './src/lib/game/fightSprites';

const manifest = validateFightSpriteManifest(JSON.parse(readFileSync('public/sprites/fighter-sprites.json', 'utf8')));
assert.ok(manifest);
assert.equal(Object.keys(manifest.actions).length, 51);
assert.deepEqual([...mappedFightSpriteActionIds()].sort(), Object.keys(manifest.actions).sort());

const event = (visual: FightTimelineEvent['visual'], actor: 'red' | 'blue' = 'red', positionBefore: FightTimelineEvent['positionBefore'] = 'distance', positionAfter = positionBefore): FightTimelineEvent => ({
  sequence: 1, round: 1, clockBeforeMs: 300_000, clockAfterMs: 299_000, durationMs: 1_000, importance: 'notable', type: visual.action === 'finish' ? 'finish' : 'strike', actor, target: actor === 'red' ? 'blue' : 'red', positionBefore, positionAfter,
  redConditionDelta: 0, blueConditionDelta: 0, redStaminaDelta: 0, blueStaminaDelta: 0, headline: '', commentary: '', intensity: visual.intensity === 'heavy' ? 80 : 30, visual
});

for (const [strike, animationId] of Object.entries({ jab: 'fighter-jab', cross: 'fighter-cross', hook: 'fighter-hook', 'body-hook': 'fighter-body-hook', 'low-kick': 'fighter-low-kick', 'body-kick': 'fighter-body-kick', 'high-kick': 'fighter-high-kick', knee: 'fighter-knee-strike', elbow: 'fighter-elbow-strike' }) as Array<[NonNullable<FightTimelineEvent['visual']['strike']>, string]>) {
  const scene = resolveFightSpriteScene(event({ action: 'strike', strike, outcome: 'landed', targetZone: strike === 'low-kick' ? 'leg' : 'head', intensity: 'light' }));
  assert.equal(scene.red.animationId, animationId);
  assert.equal(scene.red.followUpAnimationId, 'fighter-idle');
  assert.equal(scene.blue.animationId, 'fighter-hurt');
}

assert.equal(resolveFightSpriteScene(event({ action: 'strike', strike: 'jab', outcome: 'blocked', targetZone: 'head', intensity: 'light' })).blue.animationId, 'fighter-block-high');
assert.equal(resolveFightSpriteScene(event({ action: 'strike', strike: 'low-kick', outcome: 'blocked', targetZone: 'leg', intensity: 'light' })).blue.animationId, 'fighter-block-low');
assert.equal(resolveFightSpriteScene(event({ action: 'strike', strike: 'cross', outcome: 'dodged', targetZone: 'head', intensity: 'light' })).blue.animationId, 'fighter-dodge');
assert.equal(resolveFightSpriteScene(event({ action: 'strike', strike: 'cross', outcome: 'landed', targetZone: 'head', intensity: 'heavy' })).blue.animationId, 'fighter-stunned');
const knockdownScene = resolveFightSpriteScene(event({ action: 'knockdown', strike: 'hook', outcome: 'landed', targetZone: 'head', intensity: 'heavy' }, 'red', 'distance', 'ground'));
assert.equal(knockdownScene.blue.animationId, 'fighter-knockdown');
assert.equal(knockdownScene.red.followUpAnimationId, 'fighter-ground-position-top');
assert.equal(knockdownScene.blue.followUpAnimationId, 'fighter-ground-position-bottom');

const jab = manifest.actions['fighter-jab'];
assert.equal(fightSpriteDuration(jab, 1), 335);
assert.equal(fightSpriteDuration(jab, 2), 167.5);
assert.equal(fightSpriteFrameDelay(jab, 3, 1), 201);
assert.equal(fightSpriteFrameDelay(jab, 3, 4), 50.25);
const nativeCross = manifest.actions['fighter-cross'];
assert.deepEqual([0, 66, 67, 134, 335, 999].map(elapsedMs => fightSpriteFrameIndex(nativeCross, elapsedMs)), [0, 0, 1, 2, 5, 5]);
const loopingIdle = manifest.actions['fighter-idle'];
assert.deepEqual([0, 99, 100, 500, 600, 700].map(elapsedMs => fightSpriteFrameIndex(loopingIdle, elapsedMs)), [0, 0, 1, 5, 0, 1]);
assert.deepEqual(
  ['jab', 'cross', 'hook', 'body-hook', 'low-kick', 'body-kick', 'high-kick', 'knee', 'elbow'].map(fightSpriteStrikeOffset),
  [35, 37, 29, 32, 32, 35, 34, 21, 26]
);
const strikeScene = resolveFightSpriteScene(event({ action: 'strike', strike: 'cross', outcome: 'landed', targetZone: 'head', intensity: 'light' }));
const cross = manifest.actions[strikeScene.red.animationId];
const idle = manifest.actions[strikeScene.red.followUpAnimationId!];
assert.equal(strikeScene.blue.followUpAnimationId, 'fighter-idle');
assert.equal(fightSpriteCycleDuration(cross, 1), 402);
assert.equal(fightSpriteCycleDuration(cross, 2), 201);
assert.deepEqual(fightSpritePlaybackSegment(cross, idle, 800, 401), { action: cross, elapsedMs: 401, durationMs: 402, finite: true });
assert.deepEqual(fightSpritePlaybackSegment(cross, idle, 800, 402), { action: idle, elapsedMs: 0, durationMs: 398, finite: false });
assert.deepEqual(fightSpritePlaybackSegment(cross, idle, 800, 700), { action: idle, elapsedMs: 298, durationMs: 398, finite: false });
assert.equal(fightSpriteSourceSegmentDuration(cross, 800, true), 402);
assert.equal(fightSpriteSourceSegmentDuration(loopingIdle, 1_000, false), 1_000);
const victory = manifest.actions['fighter-victory'];
assert.equal(fightSpriteSourceSegmentDuration(victory, 1_000, false), 1_000);
assert.deepEqual(fightSpritePlaybackSegment(cross, undefined, 800, 700), { action: cross, elapsedMs: 700, durationMs: 800, finite: true });
assert.deepEqual(fightSpritePlaybackSegment(victory, undefined, 0, 0), { action: victory, elapsedMs: 1, durationMs: 1, finite: true });
const groundRecoveryScene = resolveFightSpriteScene(event({ action: 'recovery', intensity: 'light', transition: 'ground-to-distance' }, 'red', 'ground', 'distance'));
assert.equal(groundRecoveryScene.red.followUpAnimationId, 'fighter-idle');
assert.equal(groundRecoveryScene.blue.followUpAnimationId, 'fighter-idle');
const groundPoundCycle = manifest.actions['fighter-ground-and-pound-attacker'];
assert.equal(fightSpriteSourceSegmentDuration(groundPoundCycle, 1_200, true), 800);
assert.equal(resolveFightSpriteScene(event({ action: 'strike', strike: 'jab', outcome: 'landed', targetZone: 'head', intensity: 'light' })).effect?.anchor, 'target');
assert.equal(resolveFightSpriteScene(event({ action: 'movement', outcome: 'landed', intensity: 'light', transition: 'close-distance' }, 'blue')).effect?.anchor, 'actor');
assert.equal(resolveFightSpriteScene(event({ action: 'takedown', outcome: 'landed', intensity: 'light' }, 'red', 'clinch', 'ground')).effect?.anchor, 'contact');
const actorlessRecovery = event({ action: 'recovery', intensity: 'light', transition: 'ground-to-distance' });
delete actorlessRecovery.actor;
delete actorlessRecovery.target;
const actorlessRecoveryScene = resolveFightSpriteScene(actorlessRecovery);
assert.deepEqual([actorlessRecoveryScene.red.animationId, actorlessRecoveryScene.blue.animationId], ['fighter-get-up', 'fighter-stand-up-from-ground']);
assert.equal(actorlessRecoveryScene.effect, undefined);
const groundRecovery = resolveFightSpriteScene(event({ action: 'recovery', intensity: 'light', transition: 'ground-to-distance' }, 'blue', 'ground', 'distance'));
assert.equal(groundRecovery.blue.animationId, 'fighter-get-up');
assert.equal(groundRecovery.red.animationId, 'fighter-stand-up-from-ground');

const clinchToGroundScene = resolveFightSpriteScene(event({ action: 'takedown', outcome: 'landed', intensity: 'light', transition: 'ground-to-clinch' }, 'blue', 'clinch', 'ground'));
assert.equal(clinchToGroundScene.blue.animationId, 'fighter-takedown-attacker');
assert.equal(clinchToGroundScene.red.animationId, 'fighter-takedown-defender');
assert.equal(clinchToGroundScene.blue.followUpAnimationId, 'fighter-ground-position-top');
assert.equal(clinchToGroundScene.red.followUpAnimationId, 'fighter-ground-position-bottom');

for (const [action, expected, followUp] of [
  ['takedown', ['fighter-takedown-attacker', 'fighter-takedown-defender'], ['fighter-ground-position-top', 'fighter-ground-position-bottom']],
  ['takedown-defense', ['fighter-takedown-defense-attacker', 'fighter-takedown-defense-defender'], ['fighter-clinch-idle-attacker', 'fighter-clinch-idle-defender']],
  ['sprawl', ['fighter-sprawl-attacker', 'fighter-sprawl-defender'], ['fighter-clinch-idle-attacker', 'fighter-clinch-idle-defender']],
  ['ground-pound', ['fighter-ground-and-pound-attacker', 'fighter-ground-and-pound-defender'], ['fighter-ground-position-top', 'fighter-ground-position-bottom']],
  ['submission', ['fighter-submission-attempt-attacker', 'fighter-submission-attempt-defender'], ['fighter-ground-position-top', 'fighter-ground-position-bottom']]
] as const) {
  const scene = resolveFightSpriteScene(event({ action, outcome: action === 'submission' ? 'landed' : 'landed', intensity: 'light' }, 'red', action === 'ground-pound' || action === 'submission' ? 'ground' : 'clinch', action === 'takedown-defense' || action === 'sprawl' ? 'clinch' : 'ground'));
  assert.deepEqual([scene.red.animationId, scene.blue.animationId], expected);
  assert.deepEqual([scene.red.followUpAnimationId, scene.blue.followUpAnimationId], followUp);
}

const groundIdle = resolveFightSpriteScene(event({ action: 'idle', outcome: 'landed', intensity: 'light' }, 'blue', 'ground'));
assert.deepEqual([groundIdle.red.animationId, groundIdle.blue.animationId], ['fighter-ground-position-bottom', 'fighter-ground-position-top']);
const groundPound = resolveFightSpriteScene(event({ action: 'ground-pound', outcome: 'landed', targetZone: 'head', intensity: 'heavy' }, 'red', 'ground'));
assert.equal(groundPound.red.followUpAnimationId, 'fighter-ground-position-top');
assert.equal(groundPound.blue.followUpAnimationId, 'fighter-ground-position-bottom');

const pressuredSubmission = resolveFightSpriteScene(event({ action: 'submission', outcome: 'landed', intensity: 'heavy' }, 'red', 'ground'));
assert.equal(pressuredSubmission.effect?.animationId, 'effect-sweat');
assert.equal(pressuredSubmission.effect?.anchor, 'actor');
const finishedSubmission = resolveFightSpriteScene(event({ action: 'submission', outcome: 'finished', intensity: 'heavy' }, 'red', 'ground'));
assert.equal(finishedSubmission.red.animationId, 'fighter-submission-finish-attacker');
assert.equal(finishedSubmission.blue.animationId, 'fighter-submission-finish-defender');
assert.equal(finishedSubmission.blue.followUpAnimationId, 'fighter-tap-out');
const finishedSubmissionAttacker = manifest.actions[finishedSubmission.red.animationId];
const finishedSubmissionDefender = manifest.actions[finishedSubmission.blue.animationId];
const tapOut = manifest.actions[finishedSubmission.blue.followUpAnimationId!];
const attackerFinishSource = fightSpritePlaybackSegment(finishedSubmissionAttacker, undefined, 1_000, 700, true);
const defenderFinishSource = fightSpritePlaybackSegment(finishedSubmissionDefender, tapOut, 1_000, 700, true);
assert.equal(attackerFinishSource.durationMs, 800);
assert.equal(defenderFinishSource.durationMs, 800);
assert.equal(attackerFinishSource.action, finishedSubmissionAttacker);
assert.equal(defenderFinishSource.action, finishedSubmissionDefender);
const attackerFinishHold = fightSpritePlaybackSegment(finishedSubmissionAttacker, undefined, 1_000, 900, true);
const defenderTapOut = fightSpritePlaybackSegment(finishedSubmissionDefender, tapOut, 1_000, 900, true);
assert.deepEqual(attackerFinishHold, { action: finishedSubmissionAttacker, elapsedMs: 800, durationMs: 800, finite: true });
assert.deepEqual(defenderTapOut, { action: tapOut, elapsedMs: 100, durationMs: 200, finite: false });

const tko = resolveFightSpriteScene(event({ action: 'finish', outcome: 'finished', intensity: 'heavy', finish: 'tko' }, 'red', 'ground'));
assert.equal(tko.red.animationId, 'fighter-victory');
assert.equal(tko.blue.animationId, 'fighter-tko-cover');

const submissionFinish = resolveFightSpriteScene(event({ action: 'finish', outcome: 'finished', intensity: 'heavy', finish: 'submission' }, 'red', 'ground'));
assert.equal(submissionFinish.red.animationId, 'fighter-submission-finish-attacker');
assert.equal(submissionFinish.blue.animationId, 'fighter-tap-out');
assert.equal(fightSpritePlaybackSegment(manifest.actions[submissionFinish.red.animationId], undefined, 0, 0).action, manifest.actions['fighter-submission-finish-attacker']);
assert.equal(fightSpritePlaybackSegment(manifest.actions[submissionFinish.blue.animationId], undefined, 0, 0).action, manifest.actions['fighter-tap-out']);
for (const finish of ['ko', 'tko', 'doctor', 'decision', 'draw'] as const) {
  const scene = resolveFightSpriteScene(event({ action: 'finish', outcome: 'finished', intensity: 'heavy', finish }, 'red'));
  assert.ok(manifest.actions[scene.red.animationId]);
  assert.ok(manifest.actions[scene.blue.animationId]);
}

for (const action of Object.values(manifest.actions)) {
  if (!action.interaction) continue;
  const partner = manifest.actions[action.interaction.syncPartner];
  assert.ok(partner, `Missing partner ${action.interaction.syncPartner}`);
  assert.equal(action.frameCount, partner.frameCount);
  assert.equal(action.fps, partner.fps);
}

assert.equal(validateFightSpriteManifest({}), null);
const incompleteManifest = structuredClone(manifest);
delete incompleteManifest.actions['fighter-jab'];
assert.equal(validateFightSpriteManifest(incompleteManifest), null);
console.log('Fight sprite mapping checks passed.');
