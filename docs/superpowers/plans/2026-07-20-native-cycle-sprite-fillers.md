# Native-Cycle Sprite Fillers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let every live-fight action show its complete native spritesheet cycle without leaving a static final frame for the rest of a gameplay event.

**Architecture:** Keep simulation timing deterministic and clamp only the action families whose current minimum can truncate an existing spritesheet. In the renderer, replace the 75/25 event split with the source action's native full-cycle duration, then use the scene's existing position-appropriate follow-up; looping sources continue looping and terminal `holdLast` sources remain held. Expire non-looping impact effects after one native cycle.

**Tech Stack:** TypeScript 5.8, React 19, assert-based `tsx` checks, Vite 6.

## Global Constraints

- Do not add assets or dependencies.
- Do not consume additional fight RNG or change seeded determinism.
- Do not refactor outside live-fight timing and sprite playback.
- Do not run Playwright or browser automation; the user will manually inspect visuals.
- Do not stage or commit changes.
- Verify with focused tests, `npm run lint`, `npm run build`, and `git diff --check` only.
- A bell-truncated final event may be shorter than its native sprite cycle so each round still consumes exactly 300,000 ms.

---

### Task 1: Prevent ordinary events from truncating source sprites

**Files:**
- Modify: `test_live_fight.ts:44-63`
- Modify: `src/lib/game/liveFight.ts:289-321`

**Interfaces:**
- Consumes: existing `FightTimelineEvent.visual.action`, `durationMs`, and `clockAfterMs`.
- Produces: unchanged deterministic `stepFightSession()` output with minimum ordinary durations of movement 664 ms, strike/knockdown 800 ms, clinch 800 ms, and ground-and-pound 800 ms.

- [ ] **Step 1: Add the failing duration regression**

After the round-duration assertions in `test_live_fight.ts`, add:

```ts
const minimumVisualDurationMs: Partial<Record<NonNullable<(typeof first.timeline)[number]['visual']['action']>, number>> = {
  movement: 664,
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
}
```

- [ ] **Step 2: Run RED**

Run: `npx tsx test_live_fight.ts`

Expected: FAIL on a generated strike, clinch, movement, or ground-pound event below its required native-cycle minimum.

- [ ] **Step 3: Raise only the affected family minimums**

Change `ACTION_DURATION_MS` in `src/lib/game/liveFight.ts` to:

```ts
const ACTION_DURATION_MS: Record<MicroActionFamily, readonly [number, number]> = {
  movement: [664, 1_500],
  strike: [800, 900],
  clinch: [800, 1_400],
  takedown: [900, 1_800],
  'ground-control': [1_000, 2_500],
  'ground-pound': [800, 1_200],
  submission: [1_000, 2_500],
  recovery: [1_200, 2_500]
};
```

Keep `consumeFightTime()` unchanged so an event may still be clipped by the bell and round totals remain exact.

- [ ] **Step 4: Run GREEN**

Run: `npx tsx test_live_fight.ts`

Expected: PASS with no output other than the script's existing success behavior.

---

### Task 2: Switch non-looping sources to natural fillers after one native cycle

**Files:**
- Modify: `test_fight_sprites.ts:32-121`
- Modify: `src/lib/game/fightSprites.ts:107-186`
- Modify: `src/components/FightSpriteStage.tsx:39-133`
- Modify: `test_ui_contracts.ts:148-165`

**Interfaces:**
- Consumes: manifest `frameCount`, `durationMs`, `loop`, `holdLast`; scene `followUpAnimationId`; existing `eventElapsedMs`.
- Produces: `fightSpriteCycleDuration(action, playbackSpeed): number`; native-cycle source segmentation; idle follow-ups for distance strike/recovery actions; native-duration effect expiry.

- [ ] **Step 1: Replace the 75/25 assertions with native-cycle assertions**

In `test_fight_sprites.ts`, import `fightSpriteCycleDuration`, then replace the existing cross segment assertions with:

```ts
assert.equal(fightSpriteCycleDuration(cross, 1), 402);
assert.equal(fightSpriteCycleDuration(cross, 2), 201);
assert.deepEqual(fightSpritePlaybackSegment(cross, idle, 800, 401), { action: cross, elapsedMs: 401, durationMs: 402, finite: true });
assert.deepEqual(fightSpritePlaybackSegment(cross, idle, 800, 402), { action: idle, elapsedMs: 0, durationMs: 398, finite: false });
assert.deepEqual(fightSpritePlaybackSegment(cross, idle, 800, 700), { action: idle, elapsedMs: 298, durationMs: 398, finite: false });
assert.equal(fightSpriteSourceSegmentDuration(cross, 800, true), 402);
```

Add filler and hold/loop assertions:

```ts
assert.equal(strikeScene.blue.followUpAnimationId, 'fighter-idle');
const recoveryScene = resolveFightSpriteScene(event({ action: 'recovery', intensity: 'light', transition: 'ground-to-distance' }, 'red', 'ground', 'distance'));
assert.equal(recoveryScene.red.followUpAnimationId, 'fighter-idle');
assert.equal(recoveryScene.blue.followUpAnimationId, 'fighter-idle');
assert.equal(fightSpriteSourceSegmentDuration(loopingIdle, 1_000, true), 1_000);
const victory = manifest.actions['fighter-victory'];
assert.equal(fightSpriteSourceSegmentDuration(victory, 1_000, false), 1_000);
```

Update finished-submission assertions so both eight-frame sources have an 800 ms native source segment, the attacker holds its terminal source, and the defender switches to tap-out at 800 ms.

- [ ] **Step 2: Run sprite RED**

Run: `npx tsx test_fight_sprites.ts`

Expected: FAIL because `fightSpriteCycleDuration` is not exported and source segments still use 75% of event duration.

- [ ] **Step 3: Add native-cycle timing and missing fillers**

In `src/lib/game/fightSprites.ts`, add:

```ts
export function fightSpriteCycleDuration(action: FightSpriteAction, playbackSpeed: number): number {
  return action.frameCount * action.durationMs / playbackSpeed;
}
```

Change source segmentation to:

```ts
export function fightSpriteSourceSegmentDuration(action: FightSpriteAction, eventDurationMs: number, hasFollowUp: boolean): number {
  const duration = Math.max(1, eventDurationMs);
  if (action.loop || action.holdLast && !hasFollowUp) return duration;
  return Math.min(duration, fightSpriteCycleDuration(action, 1));
}
```

Update `fightSpritePlaybackSegment()` to pass `source` into that helper. Keep the existing zero-duration behavior and follow-up elapsed-time calculation.

Update scene mapping:

```ts
scene = actorScene(event.actor, strikeAnimations[cue.strike], targetAnimation, 'fighter-idle', 'fighter-idle');
```

For movement from ground and ground-to-distance recovery, assign `fighter-idle` as the follow-up for every non-looping participant. Do not add follow-ups to terminal finish scenes.

- [ ] **Step 4: Use native source duration in the stage and expire effects**

Update `FightSpriteStage.tsx` to call the new source-duration signature with `actorAction`. In `EffectStrip`, return `null` after `fightSpriteCycleDuration(action, 1)` when the effect is neither looping nor `holdLast`; before expiry, continue deriving frames from `elapsedMs`.

Do not add timers or component state: pause and x2/x4 continue to work through the existing `eventElapsedMs` input.

- [ ] **Step 5: Update source contracts and run GREEN**

In `test_ui_contracts.ts`, replace the old source-duration token with checks for:

```ts
'fightSpriteCycleDuration'
'fightSpriteSourceSegmentDuration(actorAction'
'elapsedMs >= fightSpriteCycleDuration(action, 1)'
```

Run:

```bash
npx tsx test_fight_sprites.ts
npx tsx test_ui_contracts.ts
npx tsx test_fight_playback.ts
npx tsx test_live_fight.ts
```

Expected:

```text
Fight sprite mapping checks passed.
UI visual contracts passed.
Fight playback checks passed.
```

`test_live_fight.ts` exits successfully. If its pre-existing hardcoded playback checkpoint intermittently reports `370 !== 400`, rerun once to confirm that known unrelated flaky assertion; do not alter it in this task.

---

### Task 3: Final lightweight verification

**Files:**
- Verify only; do not modify files unless a command exposes an in-scope failure.

**Interfaces:**
- Consumes: completed Tasks 1-2.
- Produces: automated evidence ready for the user's manual visual check.

- [ ] **Step 1: Run compiler and production build**

```bash
npm run lint
npm run build
```

Expected: TypeScript exits zero and Vite completes the production bundle.

- [ ] **Step 2: Check patch hygiene**

Run: `git diff --check`

Expected: no output.

- [ ] **Step 3: Inspect final scope**

Run: `git status --short`

Expected: only existing worktree changes plus the in-scope live-fight files are modified; nothing is staged or committed.

- [ ] **Step 4: Hand off visual validation**

Keep the Vite URL available for the user. Ask them to manually confirm that strikes/takedowns complete once, then naturally settle into distance, clinch, or ground posture without a long frozen action frame.
