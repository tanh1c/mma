# Full-Time Live Fight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace compressed 5–10 second fight ticks with deterministic gameplay micro-events whose animation and fight-clock durations create a continuous five-real-minute round at x1.

**Architecture:** Keep combat resolution in `liveFight.ts`, but make one `stepFightSession` append exactly one event with millisecond timing. Add one small pure playback helper for progress/interpolation math; Zustand owns resolved session snapshots and the between-round gate, while `FightBattle` owns the local `requestAnimationFrame` loop and `FightSpriteStage` renders manifest frames from normalized event progress.

**Tech Stack:** TypeScript 5.8, React 19, Zustand 5, Vite 6, CSS sprite strips, Node assert scripts.

## Global Constraints

- x1 must use a 1:1 fight clock: a complete round lasts `300_000ms`; x2/x4 accelerate fight time and sprite progress together.
- Every visible action must be a deterministic gameplay micro-event; do not add decorative strikes.
- A call to `stepFightSession` on a valid, unfinished session must append exactly one event; a finished session remains idempotent. The renderer must never skip an action beneath a boundary or finish marker.
- Fight-clock actions have positive integer `durationMs`; round/finish/recovery markers use `durationMs: 0`.
- Pause and playback speed must not consume RNG, restart an event, duplicate an event, or change the final session.
- Non-final rounds wait for an explicit **Continue round** action; repeated clicks for the same round gate do nothing.
- Persist at most 12 highlights per round in `FightResult.commentary`; never persist routine micro-events.
- Use the existing 51 sprite sheets and manifest metadata. Do not add assets, audio, dependencies, workers, or animation frameworks.
- Do not change save/export schemas for active fight state.
- Do not preserve old seed snapshots; preserve same-seed determinism, watched/skip equality, and style/position influence.
- Do not refactor unrelated simulation, event, archive, tournament, ranking, finance, or navigation code.
- Work in the current working tree, preserve unrelated uncommitted changes, and do not stage or commit.

## File Map

- Modify `src/lib/game/liveFight.ts`: millisecond session/event model, one-event stepping, micro-action selection/resolution, round gates, highlights, validation, and balance.
- Create `src/lib/game/fightPlayback.ts`: pure snapshot, elapsed-time, interpolation, and display-state helpers.
- Modify `src/store/gameStore.ts`: playback snapshot/checkpoint state, one-shot round gate, and status transitions.
- Modify `src/pages/FightBattle.tsx`: local rAF clock, event completion, smooth display state, and manual between-round UI.
- Modify `src/components/FightSpriteStage.tsx`: derive sprite phase from event elapsed time instead of native CSS completion.
- Modify `src/lib/game/fightSprites.ts`: pure event-window segment/frame helpers.
- Modify `src/i18n/resources/en.ts` and `src/i18n/resources/vi.ts`: between-round UI copy.
- Modify `src/index.css`: paused negative-delay sprite playback and reduced-motion contract.
- Modify `test_live_fight.ts`: engine timing, legality, determinism, balance, highlights, skip, and store-gate regressions.
- Create `test_fight_playback.ts`: pure pause/speed/interpolation checks.
- Modify `test_fight_sprites.ts`: event-window source/follow-up frame checks.
- Modify `test_ui_contracts.ts`: rAF, no fixed timer, manual gate, renderer progress, and accessibility contracts.

---

### Task 1: Establish Millisecond Events and One-Event Stepping

**Files:**
- Modify: `src/lib/game/liveFight.ts:6-104, 252-321, 619-672, 699-789, 873-915`
- Modify: `test_live_fight.ts:14-22, 53-77, 127-151`

**Interfaces:**
- Consumes: existing `createFightSession`, `stepFightSession`, `runFightSession`, and `FightTimelineEvent.visual` contracts.
- Produces: `FightSession.clockMs`, `FightTimelineEvent.clockBeforeMs`, `clockAfterMs`, `durationMs`, `importance`, `pendingRoundEnd`, and `pendingFinish`; each unfinished step appends exactly one event.

- [ ] **Step 1: Replace the obsolete exact snapshot with failing timing and one-event assertions**

In `test_live_fight.ts`, remove the old timeline hash/result snapshot block and add:

```ts
const ROUND_MS = 300_000;

const firstAction = stepFightSession(createFightSession(matchup, red, blue, 12345));
const firstActionEvent = firstAction.timeline.at(-1)!;
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

for (const event of first.timeline) {
  assert.ok(Number.isInteger(event.durationMs) && event.durationMs >= 0);
  assert.ok(event.clockBeforeMs >= event.clockAfterMs);
  assert.ok(event.clockBeforeMs <= ROUND_MS && event.clockAfterMs >= 0);
  if (['round-start', 'round-end', 'recovery', 'finish'].includes(event.type)) assert.equal(event.durationMs, 0);
  else assert.ok(event.durationMs > 0);
}
assert.ok(first.timeline.some(event => event.type === 'finish' && event.durationMs === 0));
```

Update remaining test references from `session.clock` to `session.clockMs` and from tick limits of `rounds * 80` to `rounds * 1_000`.

- [ ] **Step 2: Run the live-fight test and verify the expected red failure**

Run:

```bash
npx tsx test_live_fight.ts
```

Expected: FAIL because `clockMs`, `clockBeforeMs`, `clockAfterMs`, `durationMs`, and one-event boundary behavior do not exist.

- [ ] **Step 3: Add the millisecond event/session model**

In `liveFight.ts`, use these exact public fields:

```ts
export type FightEventImportance = 'routine' | 'notable' | 'key';

type PendingFightFinish = {
  winner: FightCorner | null;
  method: FightMethod;
  commentary: string;
};

export interface FightTimelineEvent {
  sequence: number;
  round: number;
  clockBeforeMs: number;
  clockAfterMs: number;
  durationMs: number;
  importance: FightEventImportance;
  type: FightEventType;
  actor?: FightCorner;
  target?: FightCorner;
  positionBefore: FightPosition;
  positionAfter: FightPosition;
  redConditionDelta: number;
  blueConditionDelta: number;
  redStaminaDelta: number;
  blueStaminaDelta: number;
  headline: string;
  commentary: string;
  intensity: number;
  visual: FightVisualCue;
}

export interface FightSession {
  // retain existing fields
  clockMs: number;
  pressure: FightCorner | null;
  controller: FightCorner | null;
  pendingRoundEnd: boolean;
  pendingFinish: PendingFightFinish | null;
}

const ROUND_MS = 300_000;
const MAX_EVENTS_PER_ROUND = 1_000;
```

Remove `FightSession.clock`. Update clock formatting:

```ts
const clockTime = (elapsedMs: number) => {
  const elapsedSeconds = Math.floor(elapsedMs / 1_000);
  return `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')}`;
};
```

- [ ] **Step 4: Make event insertion derive exact timing from the resolved session**

Replace `addEvent` with:

```ts
function addEvent(
  session: FightSession,
  event: Omit<FightTimelineEvent, 'sequence' | 'round' | 'clockBeforeMs' | 'clockAfterMs'>
): FightSession {
  const full: FightTimelineEvent = {
    sequence: session.timeline.length + 1,
    round: session.round,
    clockBeforeMs: session.clockMs + event.durationMs,
    clockAfterMs: session.clockMs,
    ...event,
    redConditionDelta: round1(event.redConditionDelta),
    blueConditionDelta: round1(event.blueConditionDelta),
    redStaminaDelta: round1(event.redStaminaDelta),
    blueStaminaDelta: round1(event.blueStaminaDelta),
    intensity: round0(clamp(event.intensity))
  };
  return { ...session, timeline: [...session.timeline, full] };
}

function consumeFightTime(session: FightSession, requestedMs: number): [FightSession, number] {
  const durationMs = Math.min(Math.max(1, Math.trunc(requestedMs)), session.clockMs);
  return [{ ...session, clockMs: session.clockMs - durationMs }, durationMs];
}
```

All round-start, round-end, recovery, and finish calls pass `durationMs: 0`; action methods pass the positive duration returned by `consumeFightTime`. Initialize sessions with:

```ts
clockMs: ROUND_MS,
pressure: null,
controller: null,
pendingRoundEnd: false,
pendingFinish: null
```

- [ ] **Step 5: Separate action, boundary, and finish events across steps**

Do not call `finishSession` or append `round-end` from the same function that appends an action. Use:

```ts
function queueFinish(session: FightSession, winner: FightCorner | null, method: FightMethod, commentary: string): FightSession {
  return { ...session, pendingFinish: { winner, method, commentary }, pendingRoundEnd: false };
}

function completeActionStep(session: FightSession): FightSession {
  return session.clockMs === 0 && !session.pendingFinish
    ? { ...session, pendingRoundEnd: true }
    : session;
}
```

`checkImmediateFinish` queues instead of appending. Submission success queues its finish after appending the submission action. `endRound` appends only one zero-duration `round-end` marker and sets `phase: 'between-rounds'`; it must not call `finishDecision` in the same step.

Use this step order:

```ts
export function stepFightSession(session: FightSession): FightSession {
  if (session.phase === 'finished') return session;
  const snapshot = clone(session);
  if (snapshot.pendingFinish) {
    const { winner, method, commentary } = snapshot.pendingFinish;
    return finishSession({ ...snapshot, pendingFinish: null }, winner, method, commentary);
  }
  const stopped = finishPreExistingZeroCondition(snapshot);
  if (stopped.phase === 'finished') return stopped;
  if (snapshot.pendingRoundEnd) return endRound({ ...snapshot, pendingRoundEnd: false });
  if (snapshot.phase === 'between-rounds') {
    return snapshot.round >= snapshot.matchup.rounds ? finishDecision(snapshot) : recoverBetweenRounds(snapshot);
  }
  return fightTick(snapshot);
}
```

`recoverBetweenRounds` emits one zero-duration marker whose `round` is the completed round, then returns `round + 1`, `clockMs: ROUND_MS`, `position: 'distance'`, `pressure: null`, `controller: null`, and fresh round stats. `finishSession` always appends one zero-duration `finish` event and uses `clockTime(ROUND_MS - session.clockMs)`.

- [ ] **Step 6: Update validation and the synchronous runner**

Validate all timing fields:

```ts
if (!Number.isInteger(session.clockMs) || session.clockMs < 0 || session.clockMs > ROUND_MS) errors.push('Clock out of bounds');

session.timeline.forEach((event, index) => {
  if (!Number.isInteger(event.durationMs) || event.durationMs < 0) errors.push(`Timeline event ${event.sequence} duration invalid`);
  if (event.clockBeforeMs < event.clockAfterMs || event.clockBeforeMs > ROUND_MS || event.clockAfterMs < 0) errors.push(`Timeline event ${event.sequence} clock out of bounds`);
  if (event.clockBeforeMs - event.clockAfterMs !== event.durationMs) errors.push(`Timeline event ${event.sequence} timing mismatch`);
  const marker = ['round-start', 'round-end', 'recovery', 'finish'].includes(event.type);
  if (marker !== (event.durationMs === 0)) errors.push(`Timeline event ${event.sequence} marker duration invalid`);
});
```

Raise the runner guard without changing its synchronous behavior:

```ts
const maxSteps = session.matchup.rounds * MAX_EVENTS_PER_ROUND;
for (let step = 0; step < maxSteps && next.phase !== 'finished'; step++) next = stepFightSession(next);
if (next.phase !== 'finished') throw new Error(`Fight session did not finish within ${maxSteps} steps`);
```

- [ ] **Step 7: Run the focused engine test**

Run:

```bash
npx tsx test_live_fight.ts
```

Expected: PASS for timing, one-event stepping, exact round totals, deterministic equality, validation, and existing finish/result contracts. Old exact timeline snapshots are intentionally gone.

---

### Task 2: Resolve Dense, Legal, Real Micro-Actions and Bound Highlights

**Files:**
- Modify: `src/lib/game/liveFight.ts:139-169, 252-570, 689-723, 796-870`
- Modify: `test_live_fight.ts:23-52, 81-125, 184-205`

**Interfaces:**
- Consumes: Task 1 timing fields and one-event step lifecycle.
- Produces: one-attempt strike events, routine movement/control events, deterministic repetition-aware selection, realistic broad balance, and result commentary capped at 12 highlights per round.

- [ ] **Step 1: Add failing legality, density, repetition, balance, and highlight assertions**

Replace the old 500-seed total counters with a bounded 100-seed sample to keep the script fast under micro-events:

```ts
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
      if (event.visual.targetZone === 'leg') assert.equal(event.visual.strike, 'low-kick');
    }
    if (event.visual.action === 'submission') assert.notEqual(event.positionBefore, 'distance');
    if (event.visual.action === 'ground-pound') assert.equal(event.positionBefore, 'ground');
    if (event.visual.action === 'takedown') assert.notEqual(event.positionBefore, 'ground');
  }
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
```

Retain and extend the existing Boxer/Wrestler comparison to aggregate at least 30 shared seeds; assert the Boxer produces more standing strike attempts while the Wrestler produces more takedown attempts. This verifies style bias without requiring exact per-seed winners.

Add a per-event attempt check for a known non-ground strike:

```ts
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
```

- [ ] **Step 2: Run the test and verify the old aggregate model fails**

Run:

```bash
npx tsx test_live_fight.ts
```

Expected: FAIL because one visible strike still records multiple attempts, there are no routine movement/control micro-events, and result commentary is not capped.

- [ ] **Step 3: Add deterministic action-duration and repetition helpers**

Use these bounded fight-time ranges:

```ts
type MicroActionFamily = 'movement' | 'strike' | 'clinch' | 'takedown' | 'ground-control' | 'ground-pound' | 'submission' | 'recovery';

const ACTION_DURATION_MS: Record<MicroActionFamily, readonly [number, number]> = {
  movement: [600, 1_500],
  strike: [350, 900],
  clinch: [700, 1_400],
  takedown: [900, 1_800],
  'ground-control': [1_000, 2_500],
  'ground-pound': [600, 1_200],
  submission: [1_000, 2_500],
  recovery: [1_200, 2_500]
};

function consumeActionTime(session: FightSession, family: MicroActionFamily): [FightSession, number] {
  const [min, max] = ACTION_DURATION_MS[family];
  const [requested, rngState] = randInt(session, min, max);
  return consumeFightTime({ ...session, rngState }, requested);
}

const FAMILY_VISUAL: Record<MicroActionFamily, FightVisualAction> = {
  movement: 'movement',
  strike: 'strike',
  clinch: 'clinch',
  takedown: 'takedown',
  'ground-control': 'idle',
  'ground-pound': 'ground-pound',
  submission: 'submission',
  recovery: 'recovery'
};

function repetitionPenalty(session: FightSession, family: MicroActionFamily): number {
  const action = FAMILY_VISUAL[family];
  const matches = session.timeline.slice(-3).filter(event => event.visual.action === action).length;
  return 1 / (1 + matches * 0.75);
}
```

Use the penalty when calculating action-family weights, not as a hard ban. Keep one RNG draw for the weighted family selection.

- [ ] **Step 4: Convert aggregate strikes to one real attempt**

Resolve one selected `FightStrikeVisual` per strike event. Use:

```ts
const attempted = 1;
const significant = strike === 'jab' ? 0 : 1;
const baseDamage = strike === 'jab' ? 0.55 : strike === 'cross' || strike === 'body-hook' ? 0.9 : strike.includes('kick') ? 1.1 : 0.95;
const rawDamage = landed ? baseDamage * (0.65 + attacker.fighter.attributes.power / 125) * powerRoll : 0;
```

Use strike-specific target compatibility before resolution. Record exactly one total attempt, zero or one landed, and zero or one significant attempt. Scale stamina to one action:

```ts
const attackCost = strike === 'jab' ? 0.14 : strike.includes('kick') ? 0.32 : 0.22;
const defenseCost = outcome === 'blocked' || outcome === 'dodged' ? 0.12 : 0.06;
```

A miss resolves deterministically to `blocked` or `dodged` and remains a real attempt. Keep knockdown, cut, and finish checks, but recalibrate their thresholds against single-strike damage rather than aggregate combo damage.

- [ ] **Step 5: Add routine movement and ground-control events**

Add two focused functions; do not introduce a class or strategy hierarchy:

```ts
function applyMovement(session: FightSession, actor: FightCorner): FightSession {
  const [timed, durationMs] = consumeActionTime(session, 'movement');
  const target = otherCorner(actor);
  const retreating = timed.pressure === target;
  const red = spendStamina(timed.red, actor === 'red' ? 0.05 : 0.03);
  const blue = spendStamina(timed.blue, actor === 'blue' ? 0.05 : 0.03);
  const contextual = { ...withUpdatedCombatants(timed, red, blue), pressure: retreating ? null : actor };
  return completeActionStep(addEvent(contextual, {
    durationMs,
    importance: 'routine',
    type: 'position-change',
    actor,
    target,
    positionBefore: timed.position,
    positionAfter: timed.position,
    redConditionDelta: 0,
    blueConditionDelta: 0,
    redStaminaDelta: red.stamina - timed.red.stamina,
    blueStaminaDelta: blue.stamina - timed.blue.stamina,
    headline: '',
    commentary: '',
    intensity: 10,
    visual: { action: 'movement', outcome: 'landed', intensity: 'light', transition: retreating ? 'disengage' : 'close-distance' }
  }));
}

function applyGroundControl(session: FightSession, actor: FightCorner): FightSession {
  const [timed, durationMs] = consumeActionTime(session, 'ground-control');
  const seconds = durationMs / 1_000;
  const stats = currentStats(timed, actor);
  stats.controlSeconds = Math.min(300, round1(stats.controlSeconds + seconds));
  const state = combatant(timed, actor);
  const updated = { ...state, accumulatedControlSeconds: round1(state.accumulatedControlSeconds + seconds) };
  const next = actor === 'red' ? { ...timed, red: updated, controller: actor } : { ...timed, blue: updated, controller: actor };
  return completeActionStep(addEvent(next, {
    durationMs,
    importance: 'routine',
    type: 'position-change',
    actor,
    target: otherCorner(actor),
    positionBefore: 'ground',
    positionAfter: 'ground',
    redConditionDelta: 0,
    blueConditionDelta: 0,
    redStaminaDelta: 0,
    blueStaminaDelta: 0,
    headline: '',
    commentary: '',
    intensity: 12,
    visual: { action: 'idle', outcome: 'landed', intensity: 'light' }
  }));
}
```

Clamp combined round control totals through the final action duration. Successful takedowns and reversals update `controller`; stand-up/disengagement clears it. Include `pressure`/`controller` in subsequent family/actor weights so movement and control change the next action context. Map ground `idle` to the existing top/bottom stance in Task 6.

- [ ] **Step 6: Replace threshold-only fightTick with position-valid weighted families**

Use style-derived base weights, stamina, and `repetitionPenalty`. Required families by position:

```ts
const choices = session.position === 'ground'
  ? [
      { action: 'ground-control', weight: 24 },
      { action: 'ground-pound', weight: 42 },
      { action: 'submission', weight: shouldSubmit(attacker, defender) },
      { action: 'recovery', weight: 18 }
    ]
  : session.position === 'clinch'
    ? [
        { action: 'strike', weight: 44 * styleBias(attacker.fighter.style, 'strike') },
        { action: 'takedown', weight: shouldGrapple(attacker, defender) },
        { action: 'movement', weight: 18 }
      ]
    : [
        { action: 'movement', weight: 28 },
        { action: 'strike', weight: 62 * styleBias(attacker.fighter.style, 'strike') },
        { action: 'takedown', weight: shouldGrapple(attacker, defender) * 0.55 }
      ];
```

Normalize weighted choices after applying repetition penalties, select with one seeded roll, and dispatch only to valid handlers. Ground recovery invokes a real position-change attempt; distance movement does not silently enter clinch. Keep style influence and do not add quotas.

- [ ] **Step 7: Classify highlights and cap archived commentary**

Every `addEvent` call supplies `importance`:

- `routine`: movement, idle control, misses, ordinary blocks/dodges, light landed jabs.
- `notable`: clean significant strike, takedown, reversal, dangerous submission, meaningful transition.
- `key`: knockdown, round boundary, finish.

Keep the full active timeline. Derive result commentary at conversion:

```ts
function resultHighlights(session: FightSession): string[] {
  return Array.from({ length: session.matchup.rounds }, (_, index) => index + 1).flatMap(round => {
    const events = session.timeline.filter(event => event.round === round && event.importance !== 'routine');
    const selected = [...events.filter(event => event.importance === 'key'), ...events.filter(event => event.importance === 'notable')]
      .filter((event, index, all) => all.findIndex(candidate => candidate.sequence === event.sequence) === index)
      .slice(0, 12)
      .sort((a, b) => a.sequence - b.sequence);
    return selected.map(event => event.commentary).filter(Boolean);
  });
}
```

Use `commentary: resultHighlights(session)` in `fightSessionToResult`. Remove redundant `FightSession.commentary`; the active feed reads the filtered timeline and the result owns the bounded archive copy. Update localization determinism assertions to compare non-routine timeline prose and `fightSessionToResult(...).commentary` rather than `session.commentary`. Do not persist the detailed timeline.

- [ ] **Step 8: Run focused engine and sprite mapping tests; tune only broad balance constants**

Run:

```bash
npx tsx test_live_fight.ts && npx tsx test_fight_sprites.ts
```

Expected: PASS. If only broad distribution assertions fail, tune weights, single-action damage/stamina, or finish thresholds. Do not loosen legality, exact timing, one-attempt, highlight-cap, or deterministic assertions.

---

### Task 3: Add Pure Playback Progress and Display Interpolation

**Files:**
- Create: `src/lib/game/fightPlayback.ts`
- Create: `test_fight_playback.ts`

**Interfaces:**
- Consumes: Task 1 `FightSession.clockMs` and latest event timing/deltas.
- Produces: `FightPlaybackSnapshot`, `advanceFightElapsed`, `fightPlaybackProgress`, `remainingFightWallMs`, and `interpolateFightDisplay` for store/UI use.

- [ ] **Step 1: Write the failing pure playback test**

Create `test_fight_playback.ts`:

```ts
import assert from 'node:assert/strict';
import { advanceFightElapsed, fightPlaybackProgress, remainingFightWallMs, interpolateFightDisplay } from './src/lib/game/fightPlayback';

assert.equal(advanceFightElapsed(0, 250, 1, 1_000), 250);
assert.equal(advanceFightElapsed(250, 250, 2, 1_000), 750);
assert.equal(advanceFightElapsed(750, 250, 4, 1_000), 1_000);
assert.equal(advanceFightElapsed(400, 5_000, 0, 1_000), 400, 'Paused time must not advance');
assert.equal(fightPlaybackProgress(250, 1_000), 0.25);
assert.equal(fightPlaybackProgress(2_000, 1_000), 1);
assert.equal(remainingFightWallMs(250, 1_000, 1), 750);
assert.equal(remainingFightWallMs(250, 1_000, 2), 375);
assert.equal(remainingFightWallMs(250, 1_000, 4), 187.5);

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
```

- [ ] **Step 2: Run it and verify the module-not-found red failure**

Run:

```bash
npx tsx test_fight_playback.ts
```

Expected: FAIL because `fightPlayback.ts` does not exist.

- [ ] **Step 3: Implement the smallest pure helper**

Create `src/lib/game/fightPlayback.ts`:

```ts
import type { FightSession, FightTimelineEvent } from './liveFight';

export type FightPlaybackSnapshot = {
  sequence: number;
  clockBeforeMs: number;
  redCondition: number;
  blueCondition: number;
  redStamina: number;
  blueStamina: number;
  currentRoundStats: FightSession['currentRoundStats'];
};

export type FightDisplayState = {
  clockMs: number;
  redCondition: number;
  blueCondition: number;
  redStamina: number;
  blueStamina: number;
};

type FightDisplaySnapshot = Pick<FightPlaybackSnapshot, 'clockBeforeMs' | 'redCondition' | 'blueCondition' | 'redStamina' | 'blueStamina'>;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const interpolate = (from: number, delta: number, progress: number) => from + delta * progress;

export function createFightPlaybackSnapshot(session: FightSession, nextSequence: number): FightPlaybackSnapshot {
  return {
    sequence: nextSequence,
    clockBeforeMs: session.clockMs,
    redCondition: session.red.condition,
    blueCondition: session.blue.condition,
    redStamina: session.red.stamina,
    blueStamina: session.blue.stamina,
    currentRoundStats: structuredClone(session.currentRoundStats)
  };
}

export function advanceFightElapsed(elapsedFightMs: number, elapsedWallMs: number, speed: 0 | 1 | 2 | 4, durationMs: number): number {
  return Math.min(durationMs, Math.max(0, elapsedFightMs + Math.max(0, elapsedWallMs) * speed));
}

export function fightPlaybackProgress(elapsedFightMs: number, durationMs: number): number {
  return durationMs <= 0 ? 1 : clamp01(elapsedFightMs / durationMs);
}

export function remainingFightWallMs(elapsedFightMs: number, durationMs: number, speed: 1 | 2 | 4): number {
  return Math.max(0, durationMs - elapsedFightMs) / speed;
}

export function interpolateFightDisplay(snapshot: FightDisplaySnapshot, event: Pick<FightTimelineEvent, 'clockBeforeMs' | 'clockAfterMs' | 'redConditionDelta' | 'blueConditionDelta' | 'redStaminaDelta' | 'blueStaminaDelta'>, progress: number): FightDisplayState {
  const value = clamp01(progress);
  return {
    clockMs: interpolate(event.clockBeforeMs, event.clockAfterMs - event.clockBeforeMs, value),
    redCondition: interpolate(snapshot.redCondition, event.redConditionDelta, value),
    blueCondition: interpolate(snapshot.blueCondition, event.blueConditionDelta, value),
    redStamina: interpolate(snapshot.redStamina, event.redStaminaDelta, value),
    blueStamina: interpolate(snapshot.blueStamina, event.blueStaminaDelta, value)
  };
}
```

- [ ] **Step 4: Run the pure playback check**

Run:

```bash
npx tsx test_fight_playback.ts
```

Expected: `Fight playback checks passed.`

---

### Task 4: Wire Store Snapshots, Event Completion, Skip, and Round Gates

**Files:**
- Modify: `src/store/gameStore.ts:22-28, 47-83, 324-370, 826-902`
- Modify: `test_live_fight.ts:207-250`

**Interfaces:**
- Consumes: Task 1 one-event engine and Task 3 `FightPlaybackSnapshot`.
- Produces: `ActiveSimulation.playbackSnapshot`, `eventElapsedMs`, `roundGateToken`; `checkpointLiveFightPlayback`; `continueLiveFightRound`; status includes `between-rounds`.

- [ ] **Step 1: Add failing store lifecycle assertions**

Update the store test setup expected state and add:

```ts
assert.equal(store().activeEventSimulation!.eventElapsedMs, 0);
assert.ok(store().activeEventSimulation!.playbackSnapshot);
assert.equal(store().activeEventSimulation!.playbackSnapshot!.sequence, store().activeEventSimulation!.session!.timeline.at(-1)!.sequence);
assert.notStrictEqual(store().activeEventSimulation!.playbackSnapshot!.currentRoundStats, store().activeEventSimulation!.session!.currentRoundStats, 'Snapshot statistics must be immutable copies');

const playbackSequence = store().activeEventSimulation!.session!.timeline.at(-1)!.sequence;
store().checkpointLiveFightPlayback(playbackSequence, 400);
assert.equal(store().activeEventSimulation!.eventElapsedMs, 400);
store().checkpointLiveFightPlayback(playbackSequence - 1, 700);
assert.equal(store().activeEventSimulation!.eventElapsedMs, 400, 'A stale event checkpoint must be ignored');
store().toggleLiveFightPause();
store().advanceLiveFight();
assert.equal(store().activeEventSimulation!.eventElapsedMs, 400);
store().toggleLiveFightPause();
store().advanceLiveFight();
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
```

Retain watched-prefix plus `runFightSession(beforeSkip)` equality.

- [ ] **Step 2: Run the store/engine test and verify missing fields/actions fail**

Run:

```bash
npx tsx test_live_fight.ts
```

Expected: FAIL because playback checkpoint and round-gate state do not exist.

- [ ] **Step 3: Extend ActiveSimulation without touching persisted GameState**

Use:

```ts
export interface ActiveSimulation {
  eventId: string | null;
  activeFightIndex: number;
  session: FightSession | null;
  status: 'idle' | 'running' | 'paused' | 'between-rounds' | 'finished' | 'completed';
  playbackSpeed: 1 | 2 | 4;
  playbackSnapshot: FightPlaybackSnapshot | null;
  eventElapsedMs: number;
  roundGateToken: number | null;
}
```

Add actions:

```ts
checkpointLiveFightPlayback: (sequence: number, elapsedFightMs: number) => void;
continueLiveFightRound: () => void;
```

Every new `ActiveSimulation` initializer supplies `playbackSnapshot: null`, `eventElapsedMs: 0`, and `roundGateToken: null`. `startLiveFight` immediately executes one `stepFightSession` from the round-start session and snapshots the pre-step state, so the first displayed fighting action has positive duration rather than auto-skipping the zero-duration round-start marker. These fields remain outside `GameState` persistence.

- [ ] **Step 4: Capture pre-event state when advancing exactly one step**

Use a small local status helper:

```ts
const liveFightStatus = (session: FightSession): ActiveSimulation['status'] =>
  session.phase === 'finished'
    ? 'finished'
    : session.phase === 'between-rounds' && session.round < session.matchup.rounds
      ? 'between-rounds'
      : 'running';
```

Implement advance:

```ts
advanceLiveFight: () => set(state => {
  const sim = state.activeEventSimulation;
  if (!sim?.session || sim.status !== 'running') return state;
  const before = sim.session;
  const session = stepFightSession(before);
  const latestEvent = session.timeline.at(-1)!;
  const playbackSnapshot = createFightPlaybackSnapshot(before, latestEvent.sequence);
  return {
    activeEventSimulation: {
      ...sim,
      session,
      status: liveFightStatus(session),
      playbackSnapshot,
      eventElapsedMs: 0,
      roundGateToken: session.phase === 'between-rounds' && session.round < session.matchup.rounds ? session.round : null
    }
  };
})
```

The final-round `round-end` marker stays `running` for one zero-duration step so the next call emits the decision finish event without a false Continue gate.

- [ ] **Step 5: Add checkpoint and one-shot Continue behavior**

```ts
checkpointLiveFightPlayback: (sequence, eventElapsedMs) => set(state => {
  const sim = state.activeEventSimulation;
  if (!sim?.session || !sim.playbackSnapshot || sequence !== sim.playbackSnapshot.sequence || sequence !== sim.session.timeline.at(-1)?.sequence) return state;
  const durationMs = sim.session.timeline.at(-1)?.durationMs ?? 0;
  return { activeEventSimulation: { ...sim, eventElapsedMs: Math.min(durationMs, Math.max(0, eventElapsedMs)) } };
}),

continueLiveFightRound: () => set(state => {
  const sim = state.activeEventSimulation;
  if (!sim?.session || sim.status !== 'between-rounds' || sim.roundGateToken !== sim.session.round) return state;
  const before = sim.session;
  const session = stepFightSession(before);
  const latestEvent = session.timeline.at(-1)!;
  return {
    activeEventSimulation: {
      ...sim,
      session,
      status: 'running',
      playbackSnapshot: createFightPlaybackSnapshot(before, latestEvent.sequence),
      eventElapsedMs: 0,
      roundGateToken: null
    }
  };
})
```

Pause leaves `eventElapsedMs` unchanged. Speed changes only `playbackSpeed`. Skip still calls `runFightSession(sim.session)` and clears playback-only fields.

- [ ] **Step 6: Run the store lifecycle test**

Run:

```bash
npx tsx test_live_fight.ts
```

Expected: PASS, including paused no-op, checkpoint preservation, one-event advancement, one-shot round continuation, skip equality, and idempotent result confirmation.

---

### Task 5: Drive the Live UI with One Local Playback Clock

**Files:**
- Modify: `src/pages/FightBattle.tsx:1-124, 154-205`
- Modify: `src/i18n/resources/en.ts` fight battle/prose block
- Modify: `src/i18n/resources/vi.ts:442-447`
- Modify: `test_ui_contracts.ts:119-132`

**Interfaces:**
- Consumes: Task 3 progress/interpolation helpers and Task 4 store fields/actions.
- Produces: rAF-driven `eventElapsedMs`, smooth clock/meters, automatic zero-marker/action completion, and accessible Continue-round UI.

- [ ] **Step 1: Add failing UI source contracts**

Add to `test_ui_contracts.ts`:

```ts
assert.ok(!fightBattle.includes('setTimeout(advanceLiveFight, 1400 / playbackSpeed)'));
for (const token of [
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'advanceFightElapsed',
  'fightPlaybackProgress',
  'interpolateFightDisplay',
  'eventElapsedMs',
  'checkpointLiveFightPlayback',
  'continueLiveFightRound',
  "status === 'between-rounds'",
  '$.fight.battle.continueRound'
]) assert.ok(fightBattle.includes(token), `Full-time fight playback missing ${token}`);
```

Add source checks that the visible clock uses interpolated `display.clockMs`, `Combatant` receives display Condition/Stamina rather than authoritative post-event values, the current-round statistics use the snapshot until event completion, and both commentary plus the `aria-live="polite"` headline derive from `importance !== 'routine'` events.

- [ ] **Step 2: Run the UI contract and verify the fixed-timer implementation fails**

Run:

```bash
npx tsx test_ui_contracts.ts
```

Expected: FAIL because the page still uses a 1,400ms timeout and has no manual round gate.

- [ ] **Step 3: Replace the fixed timeout with a sequence-scoped rAF loop**

In `FightBattle`, read `playbackSnapshot`, `eventElapsedMs`, `checkpointLiveFightPlayback`, and `continueLiveFightRound`. Keep elapsed time local and seed it from the store checkpoint whenever event sequence changes.

Use refs for frame time, elapsed value, and completion guard:

```ts
const [localElapsedMs, setLocalElapsedMs] = useState(eventElapsedMs);
const elapsedRef = useRef(eventElapsedMs);
const frameRef = useRef<number | null>(null);
const lastWallRef = useRef<number | null>(null);
const completedSequenceRef = useRef<number | null>(null);

useEffect(() => {
  elapsedRef.current = eventElapsedMs;
  setLocalElapsedMs(eventElapsedMs);
  lastWallRef.current = null;
  completedSequenceRef.current = null;
}, [latestEvent?.sequence, eventElapsedMs]);
```

The running effect must use the prior speed for each measured frame because the effect restarts and resets `lastWallRef` when speed changes:

```ts
useEffect(() => {
  const durationMs = latestEvent?.durationMs ?? 0;
  if (status !== 'running' || !session || !latestEvent) return;
  if (durationMs === 0) {
    if (completedSequenceRef.current !== latestEvent.sequence) {
      completedSequenceRef.current = latestEvent.sequence;
      advanceLiveFight();
    }
    return;
  }
  const frame = (now: number) => {
    const previous = lastWallRef.current ?? now;
    lastWallRef.current = now;
    const elapsed = advanceFightElapsed(elapsedRef.current, now - previous, playbackSpeed, durationMs);
    elapsedRef.current = elapsed;
    setLocalElapsedMs(elapsed);
    if (elapsed >= durationMs) {
      if (completedSequenceRef.current !== latestEvent.sequence) {
        completedSequenceRef.current = latestEvent.sequence;
        advanceLiveFight();
      }
      return;
    }
    frameRef.current = requestAnimationFrame(frame);
  };
  frameRef.current = requestAnimationFrame(frame);
  return () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    lastWallRef.current = null;
  };
}, [status, playbackSpeed, latestEvent?.sequence, latestEvent?.durationMs, session, advanceLiveFight]);
```

On effect cleanup caused by pause, speed change, navigation, or unmount, call `checkpointLiveFightPlayback(latestEvent.sequence, elapsedRef.current)` before resetting frame refs. The sequence token makes stale cleanups no-ops after the next event has replaced the session. Do not write Zustand inside each frame.

- [ ] **Step 4: Render interpolated display state**

Compute:

```ts
const eventProgress = fightPlaybackProgress(localElapsedMs, latestEvent?.durationMs ?? 0);
const display = session && latestEvent && playbackSnapshot?.sequence === latestEvent.sequence
  ? interpolateFightDisplay(playbackSnapshot, latestEvent, eventProgress)
  : session
    ? { clockMs: session.clockMs, redCondition: session.red.condition, blueCondition: session.blue.condition, redStamina: session.red.stamina, blueStamina: session.blue.stamina }
    : null;
```

Format the visible clock with `Math.ceil(display.clockMs / 1_000)` so it begins at `5:00` and reaches `0:00` only at the bell. Pass display Condition/Stamina into `Combatant` and its meters. While an event is in progress, render current-round statistics from `playbackSnapshot.currentRoundStats`; switch to authoritative `session.currentRoundStats` only when progress reaches `1`, so attempts/landings do not appear before the visible impact. Do not interpolate individual statistic counters.

Pass `eventElapsedMs={localElapsedMs}` to `FightSpriteStage` in Task 6.

- [ ] **Step 5: Add the between-round panel and localized copy**

Derive `highlightEvents = session.timeline.filter(event => event.importance !== 'routine')`; render only its latest 12 entries in the commentary feed, and use its latest non-empty headline in the existing `aria-live="polite"` region so routine movement does not spam assistive output.

When `status === 'between-rounds'`, do not run the rAF effect. Render the completed round summary and:

```tsx
<Button variant="primary" onClick={continueLiveFightRound} className="px-8">
  {t($ => $.fight.battle.continueRound, { round: session.round + 1 })}
</Button>
```

Add translations:

```ts
// en.ts
continueRound: 'Continue to round {{round}}',
betweenRounds: 'Round {{round}} complete',

// vi.ts
continueRound: 'Tiếp tục hiệp {{round}}',
betweenRounds: 'Hiệp {{round}} đã kết thúc',
```

The button is semantic, keyboard accessible, and absent on the final round.

- [ ] **Step 6: Run playback and UI contracts**

Run:

```bash
npx tsx test_fight_playback.ts && npx tsx test_ui_contracts.ts
```

Expected: both scripts pass. Confirm source contains no fixed 1,400ms timer and no per-frame store update.

---

### Task 6: Make Sprite Playback Follow Event Progress

**Files:**
- Modify: `src/lib/game/fightSprites.ts:3-37, 148-154`
- Modify: `src/components/FightSpriteStage.tsx:5-137`
- Modify: `src/index.css:66-84, 95-115`
- Modify: `test_fight_sprites.ts:32-40, 94-106`
- Modify: `test_ui_contracts.ts:123-131`

**Interfaces:**
- Consumes: Task 1 event `durationMs`, Task 5 `eventElapsedMs`, and existing scene follow-up IDs.
- Produces: `fightSpritePlaybackSegment` and a renderer whose frame progress is controlled by the same event clock, including mid-event speed changes and pause.

- [ ] **Step 1: Add failing event-window segment tests**

Import `fightSpritePlaybackSegment` and add:

```ts
const strikeScene = resolveFightSpriteScene(event({ action: 'strike', strike: 'cross', outcome: 'landed', targetZone: 'head', intensity: 'light' }));
const cross = manifest.actions[strikeScene.red.animationId];
const idle = manifest.actions[strikeScene.red.followUpAnimationId!];

assert.deepEqual(fightSpritePlaybackSegment(cross, idle, 800, 0), { action: cross, elapsedMs: 0, durationMs: 600, finite: true });
assert.deepEqual(fightSpritePlaybackSegment(cross, idle, 800, 599), { action: cross, elapsedMs: 599, durationMs: 600, finite: true });
assert.deepEqual(fightSpritePlaybackSegment(cross, idle, 800, 700), { action: idle, elapsedMs: 100, durationMs: 200, finite: false });
assert.deepEqual(fightSpritePlaybackSegment(cross, undefined, 800, 700), { action: cross, elapsedMs: 700, durationMs: 800, finite: true });
assert.deepEqual(fightSpritePlaybackSegment(manifest.actions['fighter-victory'], undefined, 0, 0), { action: manifest.actions['fighter-victory'], elapsedMs: 1, durationMs: 1, finite: true });
```

The source action receives 75% of the event when a follow-up exists; without a follow-up it fills the whole event. For zero-duration markers, return `durationMs: 1`, `finite: true`, and `elapsedMs: 1` only for `holdLast` actions; non-holding round/recovery markers use `elapsedMs: 0`. This holds finish poses without introducing a playback delay.

- [ ] **Step 2: Run sprite checks and verify the helper is missing**

Run:

```bash
npx tsx test_fight_sprites.ts
```

Expected: FAIL because event-window segmentation does not exist.

- [ ] **Step 3: Add the pure segment helper**

In `fightSprites.ts`:

```ts
export type FightSpritePlaybackSegment = {
  action: FightSpriteAction;
  elapsedMs: number;
  durationMs: number;
  finite: boolean;
};

export function fightSpritePlaybackSegment(source: FightSpriteAction, followUp: FightSpriteAction | undefined, eventDurationMs: number, eventElapsedMs: number): FightSpritePlaybackSegment {
  if (eventDurationMs <= 0) return { action: source, elapsedMs: source.holdLast ? 1 : 0, durationMs: 1, finite: true };
  const duration = Math.max(1, eventDurationMs);
  if (!followUp) return { action: source, elapsedMs: Math.min(duration, Math.max(0, eventElapsedMs)), durationMs: duration, finite: true };
  const sourceDuration = Math.max(1, Math.round(duration * 0.75));
  if (eventElapsedMs < sourceDuration) return { action: source, elapsedMs: Math.max(0, eventElapsedMs), durationMs: sourceDuration, finite: true };
  const followUpDuration = Math.max(1, duration - sourceDuration);
  return { action: followUp, elapsedMs: Math.min(followUpDuration, eventElapsedMs - sourceDuration), durationMs: followUpDuration, finite: false };
}
```

Markers with zero duration use the manifest's held/looping finish or idle pose and do not schedule automatic animation completion.

- [ ] **Step 4: Remove animation-end React state from SpriteStrip**

Change `FightSpriteStage` props:

```ts
eventElapsedMs: number;
```

Remove `playbackSpeed`, `paused`, `selection`, `setSelection`, `onAnimationEnd`, and event-sequence follow-up state from `SpriteStrip`. Resolve the segment directly:

```ts
const followUp = followUpAnimationId ? manifest.actions[followUpAnimationId] : undefined;
const segment = fightSpritePlaybackSegment(action, followUp, eventDurationMs, eventElapsedMs);
const current = segment.action;
const paired = Boolean(current.interaction);
const style = stripStyle(current, segment.durationMs, segment.elapsedMs, mirror, segment.finite);
```

Use the latest event's `durationMs` at the stage boundary. A zero-duration finish marker keeps its manifest hold-last/loop pose instead of calling the next simulation step itself.

- [ ] **Step 5: Drive CSS frame position with paused negative delay**

Replace `stripStyle` with:

```ts
function stripStyle(action: FightSpriteAction, durationMs: number, elapsedMs: number, mirror: boolean, finite: boolean): CSSProperties {
  return {
    backgroundImage: `url(/sprites/${action.path})`,
    backgroundSize: `${action.frameCount * 100}% 100%`,
    animationDuration: `${Math.max(1, durationMs)}ms`,
    animationDelay: `${-Math.max(0, elapsedMs)}ms`,
    animationTimingFunction: `steps(${Math.max(1, action.frameCount - 1)}, end)`,
    animationIterationCount: action.loop && !finite ? 'infinite' : '1',
    animationFillMode: action.holdLast || finite ? 'forwards' : 'none',
    animationPlayState: 'paused',
    transform: mirror ? 'scaleX(-1)' : undefined
  };
}
```

The React rAF updates only `animationDelay`; speed never appears in the sprite component, so speed changes cannot restart a CSS animation. For effects, derive `impactProgress = impactFrame / Math.max(1, actorAction.frameCount - 1)` and render the effect only when `eventElapsedMs / Math.max(1, eventDurationMs) >= impactProgress`; drive its frame with `effectElapsedMs = eventElapsedMs - eventDurationMs * impactProgress`. Do not use native manifest milliseconds as a second clock.

Keep the reduced-motion rule: CSS disables strip animation and displays one representative/held frame while the React event clock continues for the full duration. Add a UI/CSS contract asserting that `prefers-reduced-motion` does not alter `durationMs`, call `advanceLiveFight`, or hide textual updates. Do not add a second animation clock.

- [ ] **Step 6: Update renderer source contracts**

Replace obsolete `forceFinite`/`onAnimationEnd` assertions with:

```ts
for (const token of [
  'eventElapsedMs',
  'fightSpritePlaybackSegment',
  'animationDelay: `${-Math.max(0, elapsedMs)}ms`',
  "animationPlayState: 'paused'",
  'const paired = Boolean(current.interaction)'
]) assert.ok(fightSpriteStage.includes(token), `Event-clock sprite playback missing ${token}`);
assert.ok(!fightSpriteStage.includes('onAnimationEnd'));
assert.ok(!fightSpriteStage.includes('useState({ eventSequence'));
```

- [ ] **Step 7: Run sprite, playback, and UI checks**

Run:

```bash
npx tsx test_fight_sprites.ts && npx tsx test_fight_playback.ts && npx tsx test_ui_contracts.ts
```

Expected: all pass. Strike, clinch, takedown, ground, submission, knockdown, and finish mappings remain valid for all 51 manifest actions.

---

### Task 7: Verify Balance, Build, and the Full Browser Experience

Use one consolidated whole-change review after all implementation and verification steps; do not dispatch per-task reviewers. Resolve Critical/Important findings, rerun their focused checks, and repeat the single final review once if fixes changed behavior.

**Files:**
- Verify only; no additional production files expected.

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: final evidence for deterministic mechanics, timing, store/UI integration, production build, and real browser behavior.

- [ ] **Step 1: Run focused checks**

Run:

```bash
npx tsx test_live_fight.ts && npx tsx test_fight_playback.ts && npx tsx test_fight_sprites.ts && npx tsx test_ui_contracts.ts
```

Expected:

```text
Live fight session tests passed.
Fight playback checks passed.
Fight sprite mapping checks passed.
UI visual contracts passed.
```

- [ ] **Step 2: Run affected regression scripts**

Run:

```bash
npx tsx test_fighter_ratings.ts && npx tsx test_fighter_career.ts && npx tsx test_fighter_career_long_sim.ts && npx tsx test_personality_drama.ts
```

Expected: all pass. If an exact old fight snapshot fails solely because the approved micro-event balance changed, replace it with deterministic/invariant assertions; do not weaken downstream record, career, tournament, or event-finalization contracts.

- [ ] **Step 3: Run static and production checks**

Run:

```bash
npm run lint && npm run build
```

Expected: TypeScript exits successfully and Vite completes a production bundle with no errors.

- [ ] **Step 4: Launch and observe one full x1 round**

Start the repository's Vite run workflow, begin a live event fight, and capture timestamps at `5:00`, `4:00`, `3:00`, `2:00`, `1:00`, and `0:00`.

Expected:

- elapsed wall time from `5:00` to `0:00` is five minutes within ordinary browser timer tolerance
- animations remain active with no long unintended idle gaps
- every visible strike/defense/position matches the current state and live statistics
- distance, clinch, takedown, ground, submission, knockdown, and recovery transitions remain coherent when reached
- commentary records highlights without logging every routine movement or miss

- [ ] **Step 5: Verify pause and mid-event speed changes**

During a visible strike or takedown:

1. Pause for at least five wall seconds.
2. Confirm clock and sprite frame remain fixed.
3. Resume and confirm the same action continues rather than restarting.
4. Change x1 → x2 → x4 during later actions.

Expected: the current animation keeps normalized progress, each event completes once, and the clock accelerates without jumping backward or duplicating stats/commentary.

- [ ] **Step 6: Verify the between-round gate**

At `0:00`, confirm automatic playback stops and round statistics remain visible. Click **Continue round** twice rapidly.

Expected: only one recovery marker is created, the next round starts once at `5:00`, and no background timer advances while the gate is open.

- [ ] **Step 7: Verify skip equality and asset fallback**

Use a fixed debug seed if the current browser workflow exposes one; otherwise compare an automated stepped prefix plus store skip through `test_live_fight.ts`. Force the sprite manifest or one image request to fail in browser devtools.

Expected: skip reaches the same resolved session as normal stepping, and fallback avatars continue with the same clock, stats, controls, and result overlay.

- [ ] **Step 8: Inspect the final diff without staging or committing**

Run:

```bash
git diff -- src/lib/game/liveFight.ts src/lib/game/fightPlayback.ts src/lib/game/fightSprites.ts src/store/gameStore.ts src/pages/FightBattle.tsx src/components/FightSpriteStage.tsx src/i18n/resources/en.ts src/i18n/resources/vi.ts src/index.css test_live_fight.ts test_fight_playback.ts test_fight_sprites.ts test_ui_contracts.ts
```

Expected: only approved micro-event timing/balance, playback, round gate, sprite synchronization, localized copy, and regression changes. Do not stage or commit.

- [ ] **Step 9: Request one consolidated final code review**

Give the reviewer the approved design, this plan, and the complete uncommitted diff for the listed files. Require two verdicts: specification compliance and code quality. Critical/Important findings must be fixed with focused TDD checks before completion; Minor findings are reported without expanding scope. Do not stage or commit during review or fixes.
