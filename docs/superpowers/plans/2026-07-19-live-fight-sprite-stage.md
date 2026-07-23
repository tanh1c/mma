# Live Fight Sprite Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the portrait-based live fight visualization with a deterministic, manifest-driven pixel-art stage whose semantic event cues can reach all 51 supplied fighter, interaction, and effect animations.

**Architecture:** `liveFight.ts` owns deterministic semantic visual cues but never asset paths or extra RNG draws. A pure `fightSprites.ts` module maps cues to animation IDs and validates/loads the public manifest, while `FightSpriteStage.tsx` renders synchronized strips and FightBattle retains simulation controls, text, meters, result flow, and portrait fallback.

**Tech Stack:** React 19, TypeScript 5.8, Zustand 5, Vite 6, Tailwind CSS 4, native `fetch`, CSS sprite animation, Node `assert`, external Playwright runtime audit.

## Global Constraints

- Do not add a dependency.
- Do not change fight balance, damage, winner selection, judging, rankings, finances, result conversion, RNG consumption, or archive/save format.
- Same simulation inputs must preserve the existing seed-12345 mechanical baseline, normal-run/skip equality, and English/Vietnamese mechanical equality.
- Read frame geometry, FPS, looping, hold-last, pivot, pair offsets, mirroring, partners, and impact frames from `/sprites/fighter-sprites.json`; do not duplicate those values in source.
- Every one of the 51 manifest action IDs must have a valid contextual mapping, but one fight need not display every action.
- Preserve Begin, pause/resume, x1/x2/x4, skip, result overlay, confirm, live region, semantic meters, reduced motion, responsive layout, and failure fallback.
- Keep sprite frame/loading state outside `GameState` and saves.
- Do not touch unrelated untracked `.superpowers/`, `assets/`, or `belt/` content.
- Do not run broad `test_*.ts` globs or `test_long_sim.ts`.
- Do not commit or push unless the user explicitly asks after implementation.

---

### Task 1: Add deterministic semantic visual cues

**Files:**
- Modify: `src/lib/game/liveFight.ts:6-40, 206-225, 249-273, 314-505, 555-620, 691-702`
- Modify: `test_live_fight.ts:1-147`

**Interfaces:**
- Produces:

```ts
export type FightStrikeVisual =
  | 'jab' | 'cross' | 'hook' | 'body-hook'
  | 'low-kick' | 'body-kick' | 'high-kick'
  | 'knee' | 'elbow';

export type FightVisualAction =
  | 'idle' | 'movement' | 'strike' | 'defense'
  | 'clinch' | 'takedown' | 'takedown-defense' | 'sprawl'
  | 'ground-pound' | 'submission' | 'knockdown'
  | 'recovery' | 'finish';

export interface FightVisualCue {
  action: FightVisualAction;
  strike?: FightStrikeVisual;
  outcome?: 'landed' | 'missed' | 'blocked' | 'dodged' | 'failed' | 'escaped' | 'finished';
  targetZone?: 'head' | 'body' | 'leg';
  intensity: 'light' | 'heavy';
  finish?: 'ko' | 'tko' | 'doctor' | 'submission' | 'decision' | 'draw';
  transition?: 'close-distance' | 'disengage' | 'ground-to-distance' | 'ground-to-clinch';
}

export interface FightTimelineEvent {
  // existing fields remain unchanged
  visual: FightVisualCue;
}
```

- Consumes no sprite manifest and no React code.

- [ ] **Step 1: Lock the current mechanical baseline before production changes**

Add an assertion after the existing deterministic session checks:

```ts
assert.deepEqual({
  rngState: first.rngState,
  winnerId: first.winnerId,
  loserId: first.loserId,
  method: first.method,
  round: first.round,
  finishRound: first.finishRound,
  finishTime: first.finishTime,
  red: { condition: first.red.condition, stamina: first.red.stamina, damage: first.red.damage },
  blue: { condition: first.blue.condition, stamina: first.blue.stamina, damage: first.blue.damage },
  timelineTypes: first.timeline.map(event => event.type)
}, LIVE_FIGHT_12345_BASELINE);
```

Define `LIVE_FIGHT_12345_BASELINE` using the exact captured values and full current timeline type sequence. This assertion must pass before visual cue implementation.

- [ ] **Step 2: Add failing visual-cue contracts**

Add assertions requiring every event to contain a cue, localized sessions to retain identical cues, standing strike selection to cover all nine subtypes over stable synthetic inputs or deterministic seeds, ground strikes to use `ground-pound`, failed takedowns to expose defense/sprawl, submission attempts to expose escape/finish context, and final events to expose finish type.

Add a helper that removes only `visual` from a session and compare the post-change result against the baseline session mechanics. Assert that generating cues does not alter `rngState` or `fightSessionToResult`.

- [ ] **Step 3: Run the focused test and observe RED**

Run:

```bash
npx tsx test_live_fight.ts
```

Expected: FAIL because `FightTimelineEvent.visual` and strike subtype selection do not exist. The pre-change mechanical baseline must still pass.

- [ ] **Step 4: Add the visual cue types and pure selectors**

In `liveFight.ts`, export the types above. Add pure helpers based on `hashSeed` rather than the session RNG:

```ts
function stableVisualIndex(parts: Array<string | number>, size: number): number {
  return hashSeed(parts.join(':')) % size;
}

function selectStrikeVisual(
  session: FightSession,
  actor: FightCorner,
  position: FightPosition,
  targetZone: FightVisualCue['targetZone']
): FightStrikeVisual {
  // Filter a context/style-compatible fixed list, then index it with
  // matchup id + timeline length + actor + round + clock + position.
}
```

Do not call `nextSeed`, `random`, `rand`, or `randInt` from these helpers.

- [ ] **Step 5: Populate cues at existing decision points**

Populate `visual` in every `addEvent` call:

- Round start/end: idle.
- Distance/clinch strike: representative standing strike plus target zone and defended response.
- Ground strike: ground-pound.
- Knockdown: retain selected strike and mark knockdown action/outcome.
- Successful takedown: takedown.
- Failed takedown: deterministic takedown-defense or sprawl.
- Position change: movement/recovery transition.
- Submission attempt: escaped or active attempt; submission finish event: submission finish.
- Recovery: recovery and ground/knockdown context where available.
- Finish: KO/TKO/doctor/submission/decision/draw.

Derive target zone and intensity from values already computed inside the action. A blocked/dodged miss classification may use `stableVisualIndex`; it must not consume RNG.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
npx tsx test_live_fight.ts
```

Expected: `Live fight session tests passed.` The exact mechanical baseline, localization parity, normal/skip equality, submission behavior, and store lifecycle remain green.

- [ ] **Step 7: Checkpoint without committing**

Run:

```bash
git diff --check -- src/lib/game/liveFight.ts test_live_fight.ts
```

Expected: no output. Do not commit.

---

### Task 2: Build the pure manifest and animation mapping boundary

**Files:**
- Create: `src/lib/game/fightSprites.ts`
- Create: `test_fight_sprites.ts`
- Read only: `public/sprites/fighter-sprites.json`

**Interfaces:**
- Consumes: `FightTimelineEvent`, `FightVisualCue`, `FightSession`, and `FightCorner` from Task 1.
- Produces:

```ts
export type FightSpriteAction = {
  path: string;
  category: 'fighters' | 'interactions' | 'effects';
  frameCount: number;
  frameSize: { width: number; height: number };
  fps: number;
  durationMs: number;
  loop: boolean;
  holdLast: boolean;
  pivot: { x: number; y: number };
  mirrorForLeft: boolean;
  impactFrames: number[];
  nextAnimation?: string;
  role?: string;
  interaction?: {
    pairGroup: string;
    syncPartner: string;
    interactionOffset: { x: number; y: number };
    mirrorAtRuntime: boolean;
    startFrame: number;
  };
};

export type FightSpriteManifest = {
  version: number;
  frameSize: { width: number; height: number };
  pivot: { x: number; y: number };
  actions: Record<string, FightSpriteAction>;
};

export type FightSpriteScene = {
  red: { animationId: string; interactionActor?: FightCorner };
  blue: { animationId: string; interactionActor?: FightCorner };
  effect?: { animationId: string; target: FightCorner; zone: 'head' | 'body' | 'leg' | 'ground' };
};

export function resolveFightSpriteScene(event: FightTimelineEvent): FightSpriteScene;
export function validateFightSpriteManifest(value: unknown): FightSpriteManifest | null;
export function loadFightSpriteManifest(): Promise<FightSpriteManifest>;
export function mappedFightSpriteActionIds(): ReadonlySet<string>;
```

- [ ] **Step 1: Write the failing manifest/mapping test**

In `test_fight_sprites.ts`, read `public/sprites/fighter-sprites.json` with `readFileSync`, validate it, then assert:

```ts
assert.equal(Object.keys(manifest.actions).length, 51);
assert.deepEqual([...mappedFightSpriteActionIds()].sort(), Object.keys(manifest.actions).sort());
```

Construct semantic events for all contexts and assert exact scenes for:

- all nine strikes;
- high/low block, dodge, hurt, stunned;
- clinch entry/idle;
- takedown, takedown-defense, sprawl;
- ground position and ground-and-pound;
- submission attempt/finish/tap-out;
- knockdown/get-up/stand-up;
- KO/TKO/doctor/decision/draw;
- all eight effects.

Validate every mapped ID exists. For each interaction pair, assert equal frame count/FPS and reciprocal `syncPartner` metadata.

- [ ] **Step 2: Run and observe RED**

Run:

```bash
npx tsx test_fight_sprites.ts
```

Expected: FAIL because `src/lib/game/fightSprites.ts` does not exist.

- [ ] **Step 3: Implement the minimum pure mapping**

Create `fightSprites.ts` with explicit semantic ID constants and one `resolveFightSpriteScene` switch. Use helper functions only where they remove repeated actor/target corner assignment. Map the approved coverage exactly:

- independent movement/strike/defense/result actions;
- role-correct synchronized pairs;
- effect choice by strike class, outcome, intensity, fatigue, transition, and finish;
- safe `fighter-idle` fallback for unknown/incomplete cues.

`mappedFightSpriteActionIds()` must report all IDs intentionally reachable by the policy, including idle follow-ups and effects; it must not simply echo manifest keys.

- [ ] **Step 4: Implement strict-enough boundary validation and one cached fetch**

`validateFightSpriteManifest` must reject missing root/action fields needed by the renderer, invalid frame sizes/count/FPS, absent paths, and malformed interaction metadata. It need not duplicate the full JSON Schema.

`loadFightSpriteManifest` uses a module-level promise:

```ts
let manifestPromise: Promise<FightSpriteManifest> | null = null;

export function loadFightSpriteManifest() {
  return manifestPromise ??= fetch('/sprites/fighter-sprites.json')
    .then(response => {
      if (!response.ok) throw new Error(`Sprite manifest failed: ${response.status}`);
      return response.json();
    })
    .then(value => {
      const manifest = validateFightSpriteManifest(value);
      if (!manifest) throw new Error('Invalid sprite manifest');
      return manifest;
    });
}
```

A rejected promise may remain cached for the current stage because FightBattle immediately falls back; no retry framework is needed.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
npx tsx test_fight_sprites.ts
npx tsx test_live_fight.ts
```

Expected: both scripts pass.

- [ ] **Step 6: Checkpoint without committing**

Run:

```bash
git diff --check -- src/lib/game/fightSprites.ts test_fight_sprites.ts
```

Expected: no output. Do not commit.

---

### Task 3: Render a synchronized, manifest-driven sprite stage

**Files:**
- Create: `src/components/FightSpriteStage.tsx`
- Modify: `src/index.css:56-89`
- Modify: `test_ui_contracts.ts:118-123`
- Modify: `test_fight_sprites.ts`

**Interfaces:**
- Consumes: `loadFightSpriteManifest`, `resolveFightSpriteScene`, `FightSpriteManifest`, `FightSpriteAction`, `FightSession`, latest event, playback speed, and running/paused/finished status.
- Produces:

```tsx
export function FightSpriteStage(props: {
  session: FightSession;
  latestEvent?: FightTimelineEvent;
  playbackSpeed: 1 | 2 | 4;
  paused: boolean;
  onAssetError: () => void;
}): JSX.Element;
```

- [ ] **Step 1: Add failing UI/source contracts**

Extend `test_ui_contracts.ts` to require:

- `FightSpriteStage` import/use in `FightBattle`;
- manifest-driven tokens (`loadFightSpriteManifest`, `resolveFightSpriteScene`, `interactionOffset`, `impactFrames`, `holdLast`);
- stage accessibility (`aria-hidden="true"` for decorative sprite layers);
- `animationPlayState`, playback-speed duration scaling, pixelated image rendering, `overflow-hidden`, `min-w-0`, and reduced-motion CSS;
- portrait fallback remains present.

Extend `test_fight_sprites.ts` to test small exported pure style helpers if needed rather than mounting React.

- [ ] **Step 2: Run and observe RED**

Run:

```bash
npx tsx test_ui_contracts.ts
npx tsx test_fight_sprites.ts
```

Expected: UI contract fails because the sprite component/CSS do not exist; pure mapping remains green unless a new helper is required.

- [ ] **Step 3: Implement manifest loading and fallback signaling**

Create `FightSpriteStage.tsx`. Load the manifest in `useEffect`; hold only `loading | ready | failed` component state. Call `onAssetError` once when manifest validation/fetch or any rendered image fails. Do not mutate the fight session or Zustand.

While loading, render a constrained stage shell; FightBattle may keep the portrait fallback visible until ready. Once ready, render the sprite stage.

- [ ] **Step 4: Implement one reusable strip renderer**

Create a local `SpriteStrip` that renders one fixed-aspect box with manifest values:

```tsx
const duration = action.frameCount * action.durationMs / playbackSpeed;
const style = {
  backgroundImage: `url(/sprites/${action.path})`,
  backgroundSize: `${action.frameCount * 100}% 100%`,
  animationDuration: `${duration}ms`,
  animationTimingFunction: `steps(${Math.max(1, action.frameCount - 1)}, end)`,
  animationIterationCount: action.loop ? 'infinite' : '1',
  animationFillMode: action.holdLast ? 'forwards' : 'both',
  animationPlayState: paused ? 'paused' : 'running'
};
```

Use a key containing event sequence and animation ID so animation restarts only for a new event. Keep decorative layers hidden from assistive technology. Use `image-rendering: pixelated`.

- [ ] **Step 5: Implement pair positioning, mirroring, and effects**

Independent fighters use separate left/right anchor positions. Pair scenes share the center contact plane. Convert `interactionOffset.x` to a percentage of the 256px sprite viewport and use the same event key/duration for both roles.

For pair mirroring, use the event actor and manifest `mirrorAtRuntime`: flipping the interaction for a blue actor must reverse the whole pair while preserving role-specific orientation. Do not mirror the complete stage.

Render effects at the manifest action’s first `impactFrames` frame delay. When the actor action has no impact frame, show approved transition/fatigue effects immediately. Effects use their own manifest FPS and remain decorative.

- [ ] **Step 6: Add CSS for the shared stage and reduced motion**

Add minimum classes/keyframes to `src/index.css`:

```css
.fight-sprite-frame {
  image-rendering: pixelated;
  animation-name: fight-sprite-strip;
  background-position: 0 0;
  background-repeat: no-repeat;
}

@keyframes fight-sprite-strip {
  to { background-position: 100% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .fight-sprite-frame {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

Retain the existing `.fight-*` avatar fallback classes.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run:

```bash
npx tsx test_fight_sprites.ts
npx tsx test_ui_contracts.ts
npm run lint
```

Expected: all pass with no TypeScript errors.

- [ ] **Step 8: Checkpoint without committing**

Run:

```bash
git diff --check -- src/components/FightSpriteStage.tsx src/index.css test_ui_contracts.ts
```

Expected: no output. Do not commit.

---

### Task 4: Integrate FightBattle and verify the real runtime

**Files:**
- Modify: `src/pages/FightBattle.tsx:1-175`
- Modify if required by browser evidence only: `src/components/FightSpriteStage.tsx`
- Modify: `test_ui_contracts.ts`
- External temporary audit only: `%TEMP%/mma-live-sprite-audit.cjs`

**Interfaces:**
- Consumes: `FightSpriteStage` from Task 3 and existing Zustand live-fight actions.
- Produces no new store/save interface.

- [ ] **Step 1: Replace the visible portrait arena while preserving fighter information**

Refactor the fight surface into:

1. Existing round/position/clock header.
2. Red/blue fighter identity and accessible Condition/Stamina meters.
3. One shared responsive `FightSpriteStage` between/under the identity blocks.
4. Existing headline live region.
5. Existing controls and result overlay.

Keep `Combatant` or a smaller identity component for labels, rank, flag, record, and meters. Keep the old portrait rendering in a `SpriteFallbackStage` activated only while sprite assets are loading/failed; do not render two simultaneous arenas after ready.

Pass:

```tsx
<FightSpriteStage
  session={session}
  latestEvent={latestEvent}
  playbackSpeed={playbackSpeed}
  paused={status === 'paused'}
  onAssetError={() => setSpriteFailed(true)}
/>
```

The outer surface and stage must retain `min-w-0 overflow-hidden` and scale down without document overflow.

- [ ] **Step 2: Run all focused automated checks**

Run individually:

```bash
npx tsx test_live_fight.ts
npx tsx test_fight_sprites.ts
npx tsx test_ui_contracts.ts
npx tsx test_navigation.ts
npm run lint
npm run build
git diff --check
```

Expected: every command passes; Vite emits no oversized-chunk warning introduced by this work.

- [ ] **Step 3: Start or reuse Vite on port 3000**

Run:

```bash
npm run dev
```

Use a background process only if port 3000 is not already serving the current repository. Verify the actual app responds before browser automation.

- [ ] **Step 4: Write and run an external Playwright audit**

Create `%TEMP%/mma-live-sprite-audit.cjs`, not a repository file. Drive the app at:

- Desktop: 1280×900.
- Mobile portrait: 390×844.
- Mobile landscape: 740×390.

Use the loaded Zustand store to create a deterministic active event, then exercise the user surface:

1. Open Event Simulation and click Begin.
2. Assert the shared sprite stage replaces portraits when assets load.
3. Assert sprite background/image URLs resolve under `/sprites/` with no 404s.
4. Wait for one tick and assert clock, condition/stamina, event sequence, and animation ID change.
5. Pause; capture computed `background-position`/animation state twice and assert it remains stable.
6. Resume and exercise x1, x2, x4; assert computed duration decreases proportionally and both paired sprites share timing.
7. Exercise deterministic contexts for standing strike, defense, movement, clinch, takedown, ground-and-pound, submission, knockdown, and effects by setting a real session/timeline fixture or choosing known seeds; do not mutate production code for test hooks.
8. Click Skip; assert result overlay appears, finish animations match method, `holdLast` persists, and the deterministic result equals `runFightSession` from the pre-skip session.
9. Click Confirm and verify the event advances.
10. Block the manifest or one image request and assert portrait fallback still permits controls.
11. Emulate reduced motion and assert sprite animation does not autoplay.
12. At every viewport assert `scrollWidth <= clientWidth`, no clipped controls, and no console/page errors.

Save temporary screenshots for direct inspection but do not copy them into the repository.

- [ ] **Step 5: Inspect screenshots and fix only evidenced defects**

Read the desktop/mobile screenshots. If a defect appears, add the smallest failing source or pure regression first, observe RED, then patch only the responsible CSS/component code and rerun the affected checks.

- [ ] **Step 6: Final consolidated review without committing**

Review only the final diff once for:

- hidden RNG or result changes;
- all 51 mappings;
- manifest-driven geometry/timing;
- pair synchronization/mirroring;
- pause/speed/skip/finish semantics;
- reduced motion, fallback, accessibility, mobile overflow;
- accidental changes outside the planned files.

Run `git status --short` and report changed/untracked files. Do not commit or push.
