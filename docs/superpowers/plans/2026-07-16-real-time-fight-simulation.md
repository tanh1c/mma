# Real-Time Fight Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the precomputed commentary replay with a deterministic tick-based fight simulator and a responsive two-avatar live fight stage with Condition and Stamina meters.

**Architecture:** Add one pure `liveFight` session engine whose ticks are authoritative for both interactive and quick simulation. Keep the existing `FightResult` boundary so records, contracts, tournaments, titles, rankings, archives, social content, and finances remain unchanged; Zustand stores only the temporary active session and React controls wall-clock playback.

**Tech Stack:** TypeScript 5.8, React 19, Zustand 5, Tailwind CSS 4, Node assert scripts, Vite 6.

## Global Constraints

- Direct tick simulation; do not precompute a result for the live UI.
- Existing fighter avatars and CSS animation only; add no dependency or art asset.
- Typical x1 bout duration is approximately 2–3 minutes; x2/x4 alter cadence only.
- Condition `<= 0` always produces `KO/TKO`; submission may finish with positive Condition.
- Pause consumes no ticks/RNG; skip must produce the same result as stepping.
- Do not persist mid-bout session state or change the save version.
- Preserve the existing `FightResult` contract and all downstream game systems.
- No direct attack controls, between-round tactics, audio, gore, sprites, or multiplayer.
- Do not commit changes unless the user explicitly requests a commit.

---

## File Map

- Create `src/lib/game/liveFight.ts`: pure seeded session creation, one-tick transition, run-to-finish, invariants, and `FightResult` conversion.
- Modify `src/lib/game/fightSimulator.ts`: make `simulateFight` the compatibility wrapper around `liveFight`; keep `validateRoundStats` exported.
- Modify `src/store/gameStore.ts`: replace pending replay state/actions with temporary live session lifecycle.
- Modify `src/pages/FightBattle.tsx`: render and control the live fight stage.
- Modify `src/index.css`: add short avatar event keyframes and reduced-motion overrides only if Tailwind utility composition cannot express them.
- Create `test_live_fight.ts`: deterministic engine and store-independent regression checks.
- Modify `test_ui_contracts.ts`: source contracts for accessible meters, live status, playback controls, reduced motion, and narrow layout.

---

### Task 1: Build the deterministic fight session core

**Files:**
- Create: `src/lib/game/liveFight.ts`
- Create: `test_live_fight.ts`

**Interfaces:**
- Produces:
  - `type FightCorner = 'red' | 'blue'`
  - `type FightPosition = 'distance' | 'clinch' | 'ground'`
  - `type FightPhase = 'fighting' | 'between-rounds' | 'finished'`
  - `interface FightTimelineEvent`
  - `interface FightCombatantState`
  - `interface FightSession`
  - `createFightSession(matchup: FightMatchup, red: Fighter, blue: Fighter, seed?: number): FightSession`
  - `stepFightSession(session: FightSession): FightSession`
  - `runFightSession(session: FightSession): FightSession`
  - `validateFightSession(session: FightSession): string[]`

- [ ] **Step 1: Write failing deterministic and invariant tests**

Create `test_live_fight.ts` with real generated fighters and assertions equivalent to:

```ts
import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { createFightSession, runFightSession, stepFightSession, validateFightSession } from './src/lib/game/liveFight';

const state = generateInitialWorld(2601);
const [red, blue] = Object.values(state.fighters).filter(f => f.weightClass === 'Lightweight').slice(0, 2);
const matchup = { id: 'live-test', redCornerId: red.id, blueCornerId: blue.id, weightClass: 'Lightweight', isTitleFight: false, rounds: 3 } as const;
const first = runFightSession(createFightSession(matchup, red, blue, 12345));
const second = runFightSession(createFightSession(matchup, red, blue, 12345));
assert.deepEqual(first, second);
assert.equal(first.phase, 'finished');
assert.deepEqual(validateFightSession(first), []);
assert.deepEqual(stepFightSession(first), first);
assert.ok(first.timeline.length > 1);
assert.ok(first.red.condition >= 0 && first.red.condition <= 100);
assert.ok(first.blue.stamina >= 0 && first.blue.stamina <= 100);
```

Add a loop that validates every intermediate tick and fails if a three- or five-round bout exceeds the maximum legal tick count.

- [ ] **Step 2: Run the test and verify RED**

Run: `npx tsx test_live_fight.ts`

Expected: FAIL because `src/lib/game/liveFight.ts` does not exist.

- [ ] **Step 3: Implement serializable seeded RNG and session types**

Use an integer LCG stored as `session.rngState`; do not close over `Math.random`. `FightSession` must include matchup/fighter snapshots, round/clock, position, combatants, current round accumulators, completed round stats, judge totals, timeline, commentary, finish metadata, and a monotonically increasing event sequence.

Session creation applies existing camp/physical inputs directly from fighter data and starts with a `round-start` event at `5:00`.

- [ ] **Step 4: Implement one pure tick**

Implement fixed-order tick resolution:

```ts
export function stepFightSession(session: FightSession): FightSession {
  if (session.phase === 'finished') return session;
  if (session.phase === 'between-rounds') return startNextRound(session);
  // Clone mutable branches, consume RNG in fixed order, choose initiative/action,
  // resolve offense/defense, clamp resources, append one structured event,
  // then process finish or round boundary.
}
```

Every fighting tick consumes 5–10 simulated seconds. Select strike/grapple actions from style and position. Condition loss must use power or grappling pressure against defense/chin/toughness and increase when defender Stamina is low. Stamina costs must affect later accuracy, defense, takedowns, submissions, and between-round recovery.

- [ ] **Step 5: Implement required outcomes and round progression**

Implement these exact priorities:

1. Condition `<= 0` → opponent wins `KO/TKO`.
2. Successful ground/clinch submission check → `Submission` while loser Condition may remain positive.
3. Severe cut/local damage check → `Doctor Stoppage`.
4. Clock `<= 0` → produce `RoundStats`, judge the round, recover bounded resources, then start the next round or decide the bout.

A decision must produce the existing decision/draw method strings and three scorecard strings.

- [ ] **Step 6: Implement run-to-finish and invariants**

`runFightSession` loops `stepFightSession` with a hard ceiling of `rounds * 80` steps and throws only if the pure engine violates its own legal bound. `validateFightSession` checks resources, legal clock/round, non-negative statistics, attempts ≥ landed, and no post-finish mutation.

- [ ] **Step 7: Run the engine test and verify GREEN**

Run: `npx tsx test_live_fight.ts`

Expected: PASS with deterministic equality and no invariant errors.

---

### Task 2: Convert completed sessions to the existing result contract

**Files:**
- Modify: `src/lib/game/liveFight.ts`
- Modify: `src/lib/game/fightSimulator.ts`
- Modify: `test_live_fight.ts`

**Interfaces:**
- Consumes: Task 1 `FightSession` API.
- Produces:
  - `fightSessionToResult(session: FightSession): FightResult`
  - existing `simulateFight(matchup, red, blue, seed?)` backed by the session engine.

- [ ] **Step 1: Add failing result compatibility tests**

Assert that `fightSessionToResult` rejects unfinished sessions and that a finished result contains winner/loser, legal method/round/time, commentary, `performanceRating` in `10–100`, scorecards for decisions, valid `roundStats`, and bounded fighter deltas. Assert:

```ts
const stepped = runFightSession(createFightSession(matchup, red, blue, 77));
assert.deepEqual(simulateFight(matchup, red, blue, 77), fightSessionToResult(stepped));
if (stepped.red.condition === 0 || stepped.blue.condition === 0) {
  assert.equal(fightSessionToResult(stepped).method, 'KO/TKO');
}
```

Search deterministic seeds until one submission occurs, then assert loser Condition is positive.

- [ ] **Step 2: Run and verify RED**

Run: `npx tsx test_live_fight.ts`

Expected: FAIL because the adapter/wrapper does not yet match.

- [ ] **Step 3: Implement `fightSessionToResult`**

Derive excitement from total damage, knockdowns, submission attempts, pace, finish type, and competitiveness. Generate injuries, medical suspensions, popularity, morale, and momentum deltas using the session RNG state through the same deterministic helper; use deterministic IDs based on matchup ID/corner instead of `crypto.randomUUID` inside the pure result adapter.

- [ ] **Step 4: Switch `simulateFight` to the live engine**

Make the exported function exactly:

```ts
export function simulateFight(matchup: FightMatchup, red: Fighter, blue: Fighter, seed?: number): FightResult {
  return fightSessionToResult(runFightSession(createFightSession(matchup, red, blue, seed)));
}
```

Remove the superseded simulator implementation rather than retaining two balance engines. Preserve `validateRoundStats` as a focused exported validator.

- [ ] **Step 5: Run focused and simulator consumers**

Run:

```bash
npx tsx test_live_fight.ts
npx tsx test_tournament.ts
npx tsx test_management_depth.ts
npx tsx test_ranking_context.ts
```

Expected: all PASS.

---

### Task 3: Wire temporary live sessions into Zustand

**Files:**
- Modify: `src/store/gameStore.ts`
- Modify: `test_live_fight.ts`

**Interfaces:**
- Consumes: Task 1 session functions and Task 2 adapter.
- Produces in `ActiveSimulation`:
  - `session: FightSession | null`
  - `status: 'idle' | 'running' | 'paused' | 'finished' | 'completed'`
  - `playbackSpeed: 1 | 2 | 4`
- Produces actions:
  - `startLiveFight(): void`
  - `advanceLiveFight(): void`
  - `setLiveFightPlayback(speed: 1 | 2 | 4): void`
  - `toggleLiveFightPause(): void`
  - `skipLiveFight(): void`
  - existing `confirmPendingFightAndAdvance(): void` converts the finished session once.

- [ ] **Step 1: Add failing source/store lifecycle contracts**

Add assertions that initial simulation state has a null session, starting is idempotent, pause prevents `advanceLiveFight`, finished sessions do not advance, skip runs the same seed/session to the same result, and confirmation applies one `FightResult` then resets the next bout to idle.

- [ ] **Step 2: Run and verify RED**

Run: `npx tsx test_live_fight.ts`

Expected: FAIL for missing store lifecycle/action shape.

- [ ] **Step 3: Replace replay fields and actions**

Remove `pendingResult` and `revealedLines`. Seed session creation deterministically from fight ID and stable fighter/matchup data so wall-clock speed never changes a bout. Keep `updateActiveSimulation` only if another caller still needs it; otherwise delete it.

- [ ] **Step 4: Make confirmation idempotent**

Convert only a `finished` session to a result, call existing `applyFightResult`, decrement `activeFightIndex`, and create the next `ActiveSimulation` with `session: null`, `status: 'idle'`, and retained playback speed. Existing final event financialization remains unchanged.

- [ ] **Step 5: Verify lifecycle and downstream paths**

Run:

```bash
npx tsx test_live_fight.ts
npx tsx test_tournament.ts
npx tsx test_social_hub.ts
npx tsx test_ranking_context.ts
```

Expected: all PASS.

---

### Task 4: Build the responsive live fight stage

**Files:**
- Modify: `src/pages/FightBattle.tsx`
- Modify: `src/index.css` only for named keyframes/reduced-motion rules
- Modify: `test_ui_contracts.ts`

**Interfaces:**
- Consumes: Task 3 active session and actions.
- Produces: accessible spectator UI with no new public game interface.

- [ ] **Step 1: Add failing UI contracts**

Assert `FightBattle.tsx` contains four labeled `role="meter"` resources with `aria-valuemin`, `aria-valuemax`, and `aria-valuenow`; `aria-live="polite"` for the latest event; Pause/Resume, x1/x2/x4, and Skip controls; round/clock/position text; and mobile-safe `min-w-0`/responsive layout classes. Assert CSS includes `prefers-reduced-motion` if custom keyframes are introduced.

- [ ] **Step 2: Run and verify RED**

Run: `npx tsx test_ui_contracts.ts`

Expected: FAIL on the missing live-stage contracts.

- [ ] **Step 3: Replace commentary replay timer with tick timer**

Use one effect that schedules `advanceLiveFight()` only when status is `running`. Base interval is approximately `1400ms / playbackSpeed`; cleanup the timeout on every dependency change/unmount. Begin creates a session. Pause consumes no ticks. Skip calls the synchronous store action.

- [ ] **Step 4: Build fight stage and resources**

Render two inward-facing `FighterAvatar` components in one responsive stage. Add a small `ResourceMeter` helper using native divs and ARIA meter semantics. Display round, `m:ss`, position, latest structured event, names/ranks/records, and red/blue text labels without relying on color.

- [ ] **Step 5: Map structured events to CSS animation**

Map latest event type/actor to short attacker/target classes for strike, takedown, clinch, ground, submission, knockdown, recovery, and finish. Keep animation decorative; all state remains readable without it. Add a reduced-motion media override that removes transforms/animations while preserving borders/flash state.

- [ ] **Step 6: Add live commentary, stats, and finish overlay**

Show a bounded recent timeline feed and current/completed round statistics. On finish show winner, method, round, time, and one confirmation button. Disable duplicate actions while finished/confirming.

- [ ] **Step 7: Run UI and type checks**

Run:

```bash
npx tsx test_ui_contracts.ts
npm run lint
npm run build
```

Expected: all commands exit 0; build may retain the existing chunk-size warning only.

---

### Task 5: Balance, integration, and browser verification

**Files:**
- Modify: `test_live_fight.ts` only for missing high-value regression cases discovered during verification.
- No committed browser script.

**Interfaces:**
- Consumes the completed engine/store/UI.
- Produces verification evidence only.

- [ ] **Step 1: Run deterministic outcome distribution checks**

Use fixed seeds for several hundred representative bouts and assert non-zero KO/TKO, submission, and decision counts; stronger fighters win a clear majority without reaching 100%; grapplers produce more submission attempts than pure strikers; five-round bouts allow more late finishes than three-round bouts. Keep thresholds broad enough to detect broken mechanics, not tune exact percentages.

- [ ] **Step 2: Run the relevant regression suite**

Run:

```bash
npx tsx test_live_fight.ts
npx tsx test_balance.ts
npx tsx test_long_sim.ts
npx tsx test_tournament.ts
npx tsx test_management_depth.ts
npx tsx test_social_hub.ts
npx tsx test_ranking_context.ts
npx tsx test_ui_contracts.ts
npm run lint
npm run build
```

Expected: all commands exit 0 except any pre-existing benchmark script that reports metrics without assertions; no new errors or warnings.

- [ ] **Step 3: Exercise the real browser UI**

At `http://127.0.0.1:3000`, run a temporary external Playwright script that starts an event and verifies Begin, meter updates, clock decrement, pause stability, x2/x4 cadence, skip, result overlay, confirm, and next bout. Check 1280×800, 390×844, and 740×390 for document overflow.

- [ ] **Step 4: Inspect final diff**

Run:

```bash
git diff --check
git diff --stat
git status --short
```

Expected: no whitespace errors; only planned files plus the user's pre-existing changes are present. Do not commit.
