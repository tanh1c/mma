import assert from 'node:assert/strict';
import { advanceFightElapsed, advanceFightPlayback, fightPlaybackProgress, remainingFightWallMs, interpolateFightDisplay } from './src/lib/game/fightPlayback';

assert.equal(advanceFightElapsed(0, 250, 1, 1_000), 250);
assert.equal(advanceFightElapsed(250, 250, 2, 1_000), 750);
assert.equal(advanceFightElapsed(750, 250, 4, 1_000), 1_000);
assert.equal(advanceFightElapsed(400, 5_000, 0, 1_000), 400, 'Paused time must not advance');
assert.equal(fightPlaybackProgress(250, 1_000), 0.25);
assert.equal(fightPlaybackProgress(2_000, 1_000), 1);
assert.equal(remainingFightWallMs(250, 1_000, 1), 750);
assert.equal(remainingFightWallMs(250, 1_000, 2), 375);
assert.equal(remainingFightWallMs(250, 1_000, 4), 187.5);
assert.deepEqual(
  advanceFightPlayback(390, 20, 4, 400),
  { elapsedFightMs: 400, overflowFightMs: 70 },
  'Frame time beyond an event boundary must carry into the next event'
);
assert.deepEqual(
  advanceFightPlayback(390, 20, 0, 400),
  { elapsedFightMs: 390, overflowFightMs: 0 },
  'Paused playback must not create overflow'
);

const display = interpolateFightDisplay({
  clockBeforeMs: 300_000,
  redCondition: 100,
  blueCondition: 100,
  redStamina: 80,
  blueStamina: 80
}, {
  clockBeforeMs: 300_000,
  clockAfterMs: 299_000,
  redConditionDelta: 0,
  blueConditionDelta: -10,
  redStaminaDelta: -2,
  blueStaminaDelta: -1
}, 0.5);
assert.deepEqual(display, { clockMs: 299_500, redCondition: 100, blueCondition: 95, redStamina: 79, blueStamina: 79.5 });

console.log('Fight playback checks passed.');
