# Live Fight Animation Diversity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each live fight visibly less repetitive while keeping action selection deterministic, style-aware, and position-aware.

**Architecture:** Keep combat decisions in `liveFight.ts`, visual-to-sprite mapping in `fightSprites.ts`, and playback transitions in `FightSpriteStage.tsx`. Reduce repeated ground-and-pound probabilistically, make knockdowns achievable, distinguish KO from TKO cues, and let one-shot ground actions settle into the existing ground stance sprites.

**Tech Stack:** TypeScript 5.8, React 19, CSS sprite strips, Node assert scripts, Vite 6.

## Global Constraints

- Do not add assets, dependencies, or new production files.
- Preserve seeded determinism and fighter style/position influence.
- Do not force all 51 sheets into every fight.
- Do not refactor unrelated fight simulation code.
- Do not create a git commit.

## File Map

- Modify `src/lib/game/liveFight.ts`: combat probabilities and finish visual cues.
- Modify `src/lib/game/fightSprites.ts`: cue-to-scene follow-ups and reachable effects.
- Modify `src/components/FightSpriteStage.tsx`: play a looping source action once when it has an explicit follow-up.
- Modify `test_live_fight.ts`: deterministic multi-seed action-distribution and knockdown coverage.
- Modify `test_fight_sprites.ts`: scene mapping and follow-up contracts.
- Modify `test_ui_contracts.ts`: renderer source contract for finite source/follow-up playback.

---

### Task 1: Rebalance Reachable Combat Cues

**Files:**
- Modify: `src/lib/game/liveFight.ts:143-169, 409-425, 560-578, 699-721`
- Test: `test_live_fight.ts:23-29`

**Interfaces:**
- Consumes: `FightTimelineEvent.visual`, seeded `stableVisualIndex`, and the existing `FightSession.timeline`.
- Produces: reachable `knockdown` events, `finish: 'ko' | 'tko'`, and fewer repeated `ground-pound` events without changing public function signatures.

- [ ] **Step 1: Add failing multi-seed coverage**

Extend the existing visual coverage block in `test_live_fight.ts` so it measures complete action distribution rather than only strike names:

```ts
const visualStrikes = new Set<string>();
let groundPounds = 0;
let distanceStrikes = 0;
let knockdowns = 0;
const finishVisuals = new Set<string>();
for (let seed = 1; seed <= 500; seed++) {
  const candidate = runFightSession(createFightSession(matchup, red, blue, seed));
  candidate.timeline.forEach(event => {
    if (event.visual.strike) visualStrikes.add(event.visual.strike);
    if (event.visual.action === 'ground-pound') groundPounds++;
    if (event.visual.action === 'strike') distanceStrikes++;
    if (event.visual.action === 'knockdown') knockdowns++;
    if (event.visual.finish) finishVisuals.add(event.visual.finish);
  });
}
assert.deepEqual([...visualStrikes].sort(), ['body-hook', 'body-kick', 'cross', 'elbow', 'high-kick', 'hook', 'jab', 'knee', 'low-kick']);
assert.ok(groundPounds < distanceStrikes, `Expected fewer ground pounds than distance strikes, got ${groundPounds}/${distanceStrikes}`);
assert.ok(knockdowns > 0, 'Expected knockdowns to be reachable across deterministic seeds');
assert.ok(finishVisuals.has('ko'), 'Expected a reachable KO visual');
assert.ok(finishVisuals.has('tko'), 'Expected a reachable TKO visual');
```

- [ ] **Step 2: Run the live-fight test and confirm the old behavior fails**

Run:

```bash
npx tsx test_live_fight.ts
```

Expected: FAIL because the current 500-seed sample has no reachable knockdown cues, does not emit `tko`, and overuses ground-and-pound relative to distance strikes.

- [ ] **Step 3: Make finish cues use the event that caused the stoppage**

Change `finishVisual` to accept the current session and distinguish a clean knockdown KO from an accumulated-damage TKO:

```ts
function finishVisual(session: FightSession, method: FightMethod): NonNullable<FightVisualCue['finish']> {
  if (method === 'Submission') return 'submission';
  if (method === 'Doctor Stoppage') return 'doctor';
  if (method === 'Draw') return 'draw';
  if (method.includes('Decision')) return 'decision';
  return session.timeline.at(-1)?.visual.action === 'knockdown' ? 'ko' : 'tko';
}
```

Update the finish event call:

```ts
visual: { action: 'finish', outcome: 'finished', intensity: method === 'Draw' ? 'light' : 'heavy', finish: finishVisual(session, method) }
```

- [ ] **Step 4: Replace the impossible knockdown threshold with a normalized threshold**

Replace the current chin-scaled threshold in `applyStrike`:

```ts
const kdThreshold = Math.max(4, defender.fighter.attributes.chin / 18 + defender.stamina / 35);
```

Keep the existing power-weighted `kdRoll` check unchanged so toughness, stamina, damage, and power still influence knockdowns.

- [ ] **Step 5: Reduce consecutive ground-and-pound without quotas**

In the ground branch of `fightTick`, lower the escape/reposition threshold only after a ground-and-pound cue:

```ts
if (rolled.position === 'ground') {
  const repositionThreshold = rolled.timeline.at(-1)?.visual.action === 'ground-pound' ? 68 : 82;
  const next = roll < shouldSubmit(attacker, defender) ? applySubmission(rolled, actor, elapsed) : roll > repositionThreshold ? applyPositionChange(rolled, otherCorner(actor)) : applyStrike(rolled, actor, elapsed);
  return next.phase === 'finished' || next.clock > 0 ? next : endRound(next);
}
```

This retains seeded randomness and allows repeated ground strikes, but makes long runs less likely.

- [ ] **Step 6: Run the live-fight test and tune only if the fixed sample disproves the hypothesis**

Run:

```bash
npx tsx test_live_fight.ts
```

Expected: PASS, including deterministic snapshots, nine strike visuals, `groundPounds < distanceStrikes`, at least one knockdown, and both KO/TKO finish cues. If only the distribution assertion fails, adjust only `repositionThreshold` within `60..72`; do not add a hard repetition cap.

---

### Task 2: Settle Ground Actions Into Position Stances

**Files:**
- Modify: `src/lib/game/fightSprites.ts:86-145`
- Modify: `src/components/FightSpriteStage.tsx:71-97, 126-136`
- Test: `test_fight_sprites.ts:38-67`
- Test: `test_ui_contracts.ts:119-127`

**Interfaces:**
- Consumes: existing `FightSpriteScene.followUpAnimationId` and manifest stance actions.
- Produces: ground-and-pound followed by `fighter-ground-position-top/bottom`, reachable sweat effects for heavy submission pressure, and finite playback for a looping source action with a follow-up.

- [ ] **Step 1: Add failing scene contracts**

Add these assertions to `test_fight_sprites.ts`:

```ts
const groundPound = resolveFightSpriteScene(event({ action: 'ground-pound', outcome: 'landed', targetZone: 'head', intensity: 'heavy' }, 'red', 'ground'));
assert.equal(groundPound.red.followUpAnimationId, 'fighter-ground-position-top');
assert.equal(groundPound.blue.followUpAnimationId, 'fighter-ground-position-bottom');

const pressuredSubmission = resolveFightSpriteScene(event({ action: 'submission', outcome: 'landed', intensity: 'heavy' }, 'red', 'ground'));
assert.equal(pressuredSubmission.effect?.animationId, 'effect-sweat');
assert.equal(pressuredSubmission.effect?.anchor, 'actor');

const tko = resolveFightSpriteScene(event({ action: 'finish', outcome: 'finished', intensity: 'heavy', finish: 'tko' }, 'red', 'ground'));
assert.equal(tko.red.animationId, 'fighter-victory');
assert.equal(tko.blue.animationId, 'fighter-tko-cover');
```

Add a renderer source contract to `test_ui_contracts.ts`:

```ts
assert.ok(fightSpriteStage.includes("const forceFinite = currentId === animationId && Boolean(followUpAnimationId)"));
assert.ok(fightSpriteStage.includes("action.loop && !forceFinite ? 'infinite' : '1'"));
```

- [ ] **Step 2: Run sprite and UI contracts and confirm they fail**

Run:

```bash
npx tsx test_fight_sprites.ts && npx tsx test_ui_contracts.ts
```

Expected: FAIL because ground-and-pound has no follow-up, heavy submissions have no sweat effect, and the renderer always honors the source manifest loop.

- [ ] **Step 3: Add ground stance follow-ups and make sweat reachable**

Update the two mapping branches in `resolveFightSpriteScene` and `withEffect`:

```ts
} else if (cue.action === 'ground-pound') {
  scene = actorScene(event.actor, 'fighter-ground-and-pound-attacker', 'fighter-ground-and-pound-defender', 'fighter-ground-position-top', 'fighter-ground-position-bottom');
```

```ts
} else if ((cue.action === 'clinch' || cue.action === 'submission') && cue.intensity === 'heavy' && event.actor) {
  animationId = 'effect-sweat';
  anchor = 'actor';
}
```

Leave clinch entry behavior unchanged because its manifest already transitions to the clinch idle pair.

- [ ] **Step 4: Play a looping source once when a scene supplies a follow-up**

In `SpriteStrip`, derive whether only the initial action must be finite:

```ts
const forceFinite = currentId === animationId && Boolean(followUpAnimationId);
const duration = fightSpriteDuration(current, playbackSpeed);
const style = stripStyle(current, duration, paused, mirror, forceFinite);
```

Update `stripStyle`:

```ts
function stripStyle(action: FightSpriteAction, duration: number, paused: boolean, mirror: boolean, forceFinite = false): CSSProperties {
  return {
    backgroundImage: `url(/sprites/${action.path})`,
    backgroundSize: `${action.frameCount * 100}% 100%`,
    animationDuration: `${duration}ms`,
    animationTimingFunction: `steps(${Math.max(1, action.frameCount - 1)}, end)`,
    animationIterationCount: action.loop && !forceFinite ? 'infinite' : '1',
    animationFillMode: action.holdLast ? 'forwards' : 'none',
    animationPlayState: paused ? 'paused' : 'running',
    transform: mirror ? 'scaleX(-1)' : undefined
  };
}
```

`EffectStrip` can keep calling `stripStyle` without the fifth argument.

- [ ] **Step 5: Run focused mapping and renderer contracts**

Run:

```bash
npx tsx test_fight_sprites.ts && npx tsx test_ui_contracts.ts
```

Expected: `Fight sprite mapping checks passed.` and `UI visual contracts passed.`

---

### Task 3: Verify the Complete Fight Experience

**Files:**
- Verify only; no additional production files expected.

**Interfaces:**
- Consumes: Tasks 1-2.
- Produces: evidence that simulation, rendering, build, and browser behavior remain correct.

- [ ] **Step 1: Run all focused automated checks**

Run:

```bash
npx tsx test_live_fight.ts && npx tsx test_fight_sprites.ts && npx tsx test_ui_contracts.ts
```

Expected: all three scripts print their success messages with no assertion errors.

- [ ] **Step 2: Run static and production checks**

Run:

```bash
npm run lint && npm run build
```

Expected: TypeScript exits successfully and Vite creates the production bundle without errors.

- [ ] **Step 3: Launch and inspect a live fight in the browser**

Use the project run workflow to start `npm run dev`, open the app, begin an event fight, and observe at least one full round at x1.

Expected:

- Strike sprites vary among punches and kicks allowed by fighter style and target zone.
- Ground-and-pound does not dominate long visual runs and settles into the top/bottom ground stance after one strip cycle.
- Clinch entry settles into the paired clinch idle stance.
- Knockdown, KO, and TKO use distinct reachable cues when their conditions occur.
- No missing asset causes the stage to fall back to fighter avatars.

- [ ] **Step 4: Check controls and edge states**

In the same browser session, verify pause/resume and x2/x4 playback during a ground or clinch transition, then finish or skip the fight.

Expected: animation pause state follows the fight, speed changes shorten both source and follow-up timing, the final overlay appears, and no stale follow-up survives into the next timeline event.

- [ ] **Step 5: Inspect the final diff without committing**

Run:

```bash
git diff -- src/lib/game/liveFight.ts src/lib/game/fightSprites.ts src/components/FightSpriteStage.tsx test_live_fight.ts test_fight_sprites.ts test_ui_contracts.ts
```

Expected: only the approved probability, cue mapping, follow-up playback, and test changes are present. Do not stage or commit files.
