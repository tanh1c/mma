# Fighter Career Ecosystem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make long Observer simulations sustain realistic fighter careers, rankings, roster depth, and Hall of Fame history while adding a safe bilingual Fighter Detail editor.

**Architecture:** Add one pure `career.ts` domain module for deterministic lifecycle calculations, prospect generation, Hall of Fame scoring, and complete editor validation. `engine.ts` invokes annual lifecycle work when a year boundary is crossed; `gameStore.ts` remains the orchestration boundary that invokes existing event/tournament repair after lifecycle mutations, avoiding the existing `engine.ts ↔ autobooker.ts` import cycle. Stored ELO remains historical; rankings derive an activity-adjusted effective score without mutating ELO.

**Tech Stack:** TypeScript 5.8, React 19, Zustand 5, Vite 6, date-fns, i18next/react-i18next, Node `assert` scripts through `npx tsx`.

## Global Constraints

- OVR remains derived from attributes; never persist a separate OVR.
- `potential >= OVR` for active pre-prime fighters and `potential === OVR` after prime.
- Annual lifecycle outcomes use stable fighter/year/operation seeds and consume no global simulation RNG.
- Each fighter receives at most one lifecycle pass per year.
- All fighters retire no later than age 45; retirement begins probabilistically at age 37.
- Retirement preserves archives, records, title lineage, achievements, news, social history, and persisted prose.
- Retired fighters cannot retain contracts, title ownership, future bookings, tournament slots, title-shot debt, or active ranking positions.
- Rookie and emergency prospect IDs are stable and cannot duplicate.
- Generated English/Vietnamese prose may differ; structured outcomes must remain identical.
- Do not add dependencies, routes, cloud storage, birthday simulation, coaches, gyms, scouting, or editable protected fighter fields.
- Do not commit or push without explicit user authorization.

---

## File map

**Create**
- `src/lib/game/career.ts` — deterministic lifecycle, retirement state transition, prospect generation, Hall of Fame scoring, editor validation.
- `test_fighter_career.ts` — focused assert checks for lifecycle, generation, rankings, Hall of Fame, editor, migration, and localization determinism.
- `test_fighter_career_long_sim.ts` — 25-year Observer acceptance simulation.

**Modify**
- `src/types/game.ts` — lifecycle/editor/ecosystem persisted types.
- `src/lib/game/generator.ts` — deterministic optional fighter/injury IDs and initial lifecycle defaults.
- `src/lib/game/save.ts` — save v11 migration.
- `src/lib/engine.ts` — replace probabilistic aging with annual lifecycle invocation.
- `src/lib/game/rankings.ts` — activity-aware ranking eligibility/effective score.
- `src/lib/game/autobooker.ts` — retired filtering, emergency pool maintenance, lifecycle-aware signing/renewal scoring.
- `src/lib/game/observer.ts` — lifecycle-aware counter-offer decisions.
- `src/lib/game/tournament.ts` — retired eligibility and title-shot cleanup compatibility.
- `src/store/gameStore.ts` — lifecycle repair orchestration and validated editor action.
- `src/pages/FighterDetail.tsx` — inline editor and retirement presentation.
- `src/pages/Rankings.tsx` — inactivity/declining markers.
- `src/pages/HistoryStats.tsx` — Hall of Fame panel.
- `src/pages/Roster.tsx`, `src/pages/FreeAgents.tsx`, `src/pages/EventBuilder.tsx` — explicit retired exclusion at active UI boundaries.
- `src/i18n/resources/en.ts`, `src/i18n/resources/vi.ts` — symmetric lifecycle/editor/ranking/Hall of Fame copy.
- Existing source-contract and gameplay scripts where signatures change.

---

### Task 1: Persist deterministic career metadata and migrate saves

**Files:**
- Modify: `src/types/game.ts`
- Modify: `src/lib/game/generator.ts`
- Modify: `src/lib/game/save.ts`
- Create: `src/lib/game/career.ts`
- Create: `test_fighter_career.ts`

**Interfaces:**

```ts
export type CareerPhase = 'developing' | 'prime' | 'declining' | 'retired';
export type RetirementReason = 'age' | 'injuries' | 'decline' | 'inactivity';

export interface HallOfFameInduction {
  inductedYear: number;
  legacyScore: number;
}

export interface CareerEcosystemState {
  rookieClassYears: number[];
  emergencyProspectDates: Partial<Record<WeightClass, string>>;
}

export interface FighterEditInput {
  firstName: string;
  lastName: string;
  nickname: string;
  age: number;
  nationality: string;
  weightClass: WeightClass;
  style: FighterStyle;
  heightCm: number;
  fightWeightLb: number;
  walkAroundWeightLb: number;
  attributes: FighterAttributes;
  potential: number;
  popularity: number;
  morale: number;
  momentum: number;
  fatigue: number;
}

export type FighterEditError =
  | 'fighter-not-found'
  | 'invalid-name'
  | 'invalid-age'
  | 'invalid-nationality'
  | 'invalid-physical-profile'
  | 'invalid-attribute'
  | 'invalid-value'
  | 'weight-class-title'
  | 'weight-class-booking'
  | 'weight-class-tournament'
  | 'weight-class-title-shot';

export type FighterEditResult =
  | { ok: true; state: GameState }
  | { ok: false; error: FighterEditError };
```

Add directly to `Fighter`:

```ts
careerPhase: CareerPhase;
primeEndAge: number;
lastLifecycleYear: number;
retiredDate?: string;
retirementReason?: RetirementReason;
hallOfFame?: HallOfFameInduction;
```

Add to `GameState`:

```ts
careerEcosystem: CareerEcosystemState;
```

Add to `career.ts`:

```ts
export function stableCareerSeed(...parts: Array<string | number>): number;
export function derivePrimeEndAge(fighter: Pick<Fighter, 'id' | 'style' | 'attributes' | 'injuryStatus'>): number;
export function deriveCareerPhase(age: number, primeEndAge: number, retiredDate?: string): CareerPhase;
export function ensureCareerMetadata(fighter: Fighter, currentYear: number): Fighter;
```

- [ ] **Step 1: Write failing type/migration checks**

In `test_fighter_career.ts`, create a world, assert every fighter has `primeEndAge` in `[30, 34]`, a phase, and `lastLifecycleYear`. Clone a save, delete those values and `careerEcosystem`, set `saveVersion = 10`, migrate it, and assert deterministic defaults plus `saveVersion === 11`. Assert an age-50 migrated fighter is not retroactively retired and has `lastLifecycleYear` equal to the current year.

```ts
const world = generateInitialWorld(71);
for (const fighter of Object.values(world.fighters)) {
  assert.ok(fighter.primeEndAge >= 30 && fighter.primeEndAge <= 34);
  assert.equal(fighter.primeEndAge, derivePrimeEndAge(fighter));
}

const legacy = structuredClone(world) as any;
legacy.saveVersion = 10;
delete legacy.careerEcosystem;
for (const fighter of Object.values(legacy.fighters) as any[]) {
  delete fighter.careerPhase;
  delete fighter.primeEndAge;
  delete fighter.lastLifecycleYear;
}
const oldFighter = Object.values(legacy.fighters)[0] as any;
oldFighter.age = 50;
const migrated = validateAndMigrateState(legacy)!;
assert.equal(migrated.saveVersion, 11);
assert.equal(migrated.fighters[oldFighter.id].lastLifecycleYear, 2025);
assert.notEqual(migrated.fighters[oldFighter.id].careerPhase, 'retired');
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npx tsx test_fighter_career.ts`

Expected: TypeScript/module failure because career metadata and `career.ts` do not exist.

- [ ] **Step 3: Implement stable metadata and deterministic generator IDs**

Use a small 32-bit FNV-1a-style hash in `stableCareerSeed`; derive `primeEndAge` from stable identity plus bounded bonuses for cardio, toughness, fight IQ, durable styles, and current injury burden, clamped to `30..34`. Do not use `Math.random()`.

Change `generateFighter` to accept an optional identity without changing existing callers:

```ts
export function generateFighter(
  rng: PRNG,
  archetype: FighterArchetype,
  weightClass: WeightClass,
  identity?: { fighterId: string; injuryId: string }
): Fighter
```

Use `identity?.fighterId ?? uuidv4()` and `identity?.injuryId ?? uuidv4()`, then derive lifecycle defaults after the fighter object exists. New generated fighters use `lastLifecycleYear` equal to their creation year at the call site; initial fighters use the initial world year.

- [ ] **Step 4: Implement save v11 migration**

Set `CURRENT_SAVE_VERSION = 11`. During migration, call `ensureCareerMetadata(fighter, currentYear)` once; never replay missed years. Initialize:

```ts
state.careerEcosystem ??= {
  rookieClassYears: [],
  emergencyProspectDates: {}
};
```

Preserve valid retirement and Hall of Fame metadata. Normalize active POT to at least OVR; normalize declining fighters to exactly OVR. Finish with existing champion/news synchronization and ranking refresh behavior.

- [ ] **Step 5: Run focused test**

Run: `npx tsx test_fighter_career.ts`

Expected: PASS for metadata and migration checks.

---

### Task 2: Implement annual development, decline, and retirement decisions

**Files:**
- Modify: `src/lib/game/career.ts`
- Modify: `test_fighter_career.ts`

**Interfaces:**

```ts
export interface AnnualCareerOutcome {
  fighter: Fighter;
  shouldRetire: boolean;
  retirementReason?: RetirementReason;
}

export function getRecentCareerForm(state: GameState, fighterId: string, year: number): {
  fights: number;
  wins: number;
  losses: number;
  performance: number;
  inactivityDays: number;
  losingStreak: number;
};

export function processFighterCareerYear(
  state: GameState,
  fighter: Fighter,
  year: number
): AnnualCareerOutcome;
```

- [ ] **Step 1: Add failing progression/decline checks**

Build controlled fighters with identical identity but different recent activity, performance, injuries, and POT headroom. Assert:

- Active young winners improve more than inactive/injured peers.
- Computed OVR never exceeds POT.
- Prime progression is small and POT moves toward OVR.
- Post-prime speed/cardio/chin lose at least as much as power/toughness/fight IQ.
- Post-prime `potential === calculateOverallRating(fighter)`.
- Age 45 always returns `shouldRetire === true`.
- Repeating the same fighter/year yields an identical outcome.

- [ ] **Step 2: Verify focused failure**

Run: `npx tsx test_fighter_career.ts`

Expected: FAIL because annual career processing is absent.

- [ ] **Step 3: Implement recent form from structured archives**

Read `fightArchive` entries in the previous 365 days and derive fights, wins, losses, performance, and losing streak without parsing localized prose. Use `lastFightDate` only for inactivity. Keep calculations order-independent by sorting archive entries by date/id before streak evaluation.

- [ ] **Step 4: Implement deterministic annual development**

For developing/prime fighters, derive a bounded annual point budget from age, POT headroom, recent fights, wins, performance, inactivity, and injury burden. Select style-relevant attributes using existing rating priorities and stable per-attribute seeds. Apply at most one point per selected pass, recompute OVR after each pass, and stop before OVR would exceed POT. During prime, cap the budget to a small value and lower POT toward `max(OVR, POT - 1)`.

- [ ] **Step 5: Implement deterministic tiered decline and retirement**

After `primeEndAge`, lower speed/cardio/chin first; technical attributes next; power/toughness/fight IQ only at higher age/severity. Clamp all attributes to existing valid bounds, recompute OVR, and set POT exactly to OVR. At age 37–44 compare a stable annual roll against a probability derived from age, years post-prime, injuries, inactivity, and losing streak; at age 45 force retirement. Select the highest contributing stable reason code.

- [ ] **Step 6: Run focused checks**

Run: `npx tsx test_fighter_career.ts`

Expected: PASS for development, decline, POT, retirement, and deterministic outcome checks.

---

### Task 3: Finalize retirement and integrate annual processing safely

**Files:**
- Modify: `src/lib/game/career.ts`
- Modify: `src/lib/engine.ts`
- Modify: `src/store/gameStore.ts`
- Modify: `src/lib/game/tournament.ts`
- Modify: `test_fighter_career.ts`
- Modify: `test_tournament.ts`

**Interfaces:**

```ts
export function retireFighter(
  state: GameState,
  fighterId: string,
  reason: RetirementReason,
  date: string,
  language?: Language
): GameState;

export function processAnnualCareerLifecycle(
  state: GameState,
  year: number,
  language?: Language
): GameState;
```

- [ ] **Step 1: Add failing cleanup and idempotence checks**

Create a fighter who simultaneously has a contract, title, future booking, tournament slot, and pending title-shot entitlement. Retire them and assert:

- contract/counter-offer/title-shot flag cleared;
- title vacated and all champion flags synchronized;
- future regular fight removed;
- tournament structure does not retain the fighter after store-level repair;
- archives/history/record remain unchanged;
- rankings no longer contain the fighter;
- news announcement occurs once;
- processing the same year twice is structurally equal;
- daily crossing of January 1 and one block crossing produce equivalent lifecycle outcomes after stripping unrelated day-by-day automation prose.

- [ ] **Step 2: Verify failure**

Run: `npx tsx test_fighter_career.ts && npx tsx test_tournament.ts`

Expected: FAIL on missing retirement/lifecycle cleanup.

- [ ] **Step 3: Implement the canonical retirement state transition**

`retireFighter` must be idempotent. It marks the fighter retired, sets date/reason, clears contract/counter-offer/title-shot entitlement, vacates undisputed/interim title ownership, removes future non-tournament fights involving the fighter, and removes the fighter from ranking arrays. Preserve all archived collections and title history. Generate one localized news item with stable ID `retirement:${fighterId}:${date}`.

Do not import `autobooker.ts` from `career.ts` or `engine.ts`.

- [ ] **Step 4: Implement annual lifecycle pass**

Sort fighters by ID, skip fighters whose `lastLifecycleYear >= year`, run exactly one `processFighterCareerYear`, finalize retirement when selected, and set `lastLifecycleYear = year`. Invoke annual rookie and Hall of Fame helpers from Tasks 4 and 6 in this same operation. All child prose receives the fixed `language` captured at operation entry.

- [ ] **Step 5: Replace old random aging in `advanceTime`**

Delete the existing probabilistic age/progression/decline block. For each crossed calendar year from `oldYear + 1` through `newYear`, increment active fighter ages once and call `processAnnualCareerLifecycle`. This makes a block advance and repeated daily advances cross the same annual boundaries.

- [ ] **Step 6: Orchestrate existing repair in the store**

After each `advanceTime` call in manual and Observer advancement paths, run:

```ts
gameState = repairFutureEventAvailability(gameState, language);
gameState = syncTournamentTitleShotFlags(gameState);
gameState = updateRankings(gameState);
```

Keep these imports in `gameStore.ts`; never create `engine ↔ autobooker` or `career ↔ autobooker` cycles. Ensure tournament eligibility predicates reject `careerPhase === 'retired'` even if a malformed legacy contract remains.

- [ ] **Step 7: Run focused cleanup tests**

Run: `npx tsx test_fighter_career.ts && npx tsx test_tournament.ts`

Expected: PASS.

---

### Task 4: Generate annual rookies and emergency prospects; improve Observer roster policy

**Files:**
- Modify: `src/lib/game/career.ts`
- Modify: `src/lib/game/generator.ts`
- Modify: `src/lib/game/autobooker.ts`
- Modify: `src/lib/game/observer.ts`
- Modify: `test_fighter_career.ts`
- Modify: `test_observer_decisions.ts`

**Interfaces:**

```ts
export function generateAnnualRookieClass(state: GameState, year: number): GameState;
export function ensureEmergencyProspectPool(state: GameState, date?: string): GameState;
export function scoreObserverRosterCandidate(state: GameState, fighter: Fighter): number;
export function shouldObserverRenewFighter(state: GameState, fighter: Fighter): boolean;
```

- [ ] **Step 1: Add failing generation/policy checks**

Assert annual generation:

- creates one small unsigned class of ages 18–24;
- favors divisions with lower total usable depth and older cohorts;
- uses stable `rookie:${year}:${weightClass}:${index}` IDs;
- creates the same structured fighters in English and Vietnamese;
- does not duplicate when called twice.

Assert emergency generation:

- creates exactly the number needed to restore the unsigned eligible pool;
- uses stable `emergency:${date}:${weightClass}:${index}` IDs;
- does nothing when depth is sufficient;
- respects the persisted cooldown date.

Assert Observer policy prefers a younger high-POT affordable prospect over an older popular expensive declining fighter when division need is equal, and refuses indefinite renewal of a poor inactive veteran.

- [ ] **Step 2: Verify focused failure**

Run: `npx tsx test_fighter_career.ts && npx tsx test_observer_decisions.ts`

Expected: FAIL on missing generation and lifecycle-aware decisions.

- [ ] **Step 3: Implement deterministic prospect construction**

Use `PRNG(stableCareerSeed(...))` with `generateFighter(..., identity)`. Normalize generated rookies to age 18–24, unsigned contract, no counter-offer/title flags, developing phase, deterministic prime end, and creation-year lifecycle marker. Use existing nationality, Romanized name, avatar, style, physical, and attribute generation paths; never duplicate them in `career.ts`.

- [ ] **Step 4: Implement annual division allocation**

Compute each division need from signed depth, eligible free agents, fighters aged 35+, and scheduled/tournament demand. Allocate a small fixed world class across the highest-need divisions with stable weight-class tie ordering. Record the year only after generation succeeds.

- [ ] **Step 5: Implement emergency pool repair and cooldown**

For each division, compare operational signed depth and unsigned eligible depth against existing autobooker minimums. Generate only the missing unsigned prospects. Record the generation date per division and refuse another burst inside the chosen cooldown window. Call this once per Observer day before signing decisions.

- [ ] **Step 6: Replace popularity-only selection and renewal**

Export one score combining division need, age, career phase, POT headroom, OVR, recent form, popularity, and requested compensation. Use it in `autoBookEventsAndContracts` candidate ordering and in `observer.ts` counter-offer acceptance. Add `careerPhase !== 'retired'` to every active candidate list.

- [ ] **Step 7: Run generation and Observer tests**

Run: `npx tsx test_fighter_career.ts && npx tsx test_observer_decisions.ts`

Expected: PASS.

---

### Task 5: Make rankings activity-aware without rewriting ELO

**Files:**
- Modify: `src/lib/game/rankings.ts`
- Modify: `src/pages/Rankings.tsx`
- Modify: `test_fighter_career.ts`
- Modify: `test_ranking_context.ts`

**Interfaces:**

```ts
export type RankingActivityStatus = 'active' | 'inactive' | 'unranked-inactive';

export function getFighterInactivityDays(fighter: Fighter, currentDate: string): number;
export function getRankingActivityStatus(fighter: Fighter, currentDate: string): RankingActivityStatus;
export function getEffectiveRankingScore(state: GameState, fighter: Fighter): number;
```

- [ ] **Step 1: Add failing ranking checks**

Use controlled dates to assert:

- no penalty through nine months;
- progressive penalty after nine months;
- non-champion exclusion after eighteen months;
- retired/unsigned exclusion immediately;
- champion remains anchored while legally holding title;
- a fighter who fights again becomes eligible but ordering uses current effective form rather than restoring a stored historical position;
- `rankingScore` remains unchanged by inactivity-only refresh.

- [ ] **Step 2: Verify failure**

Run: `npx tsx test_fighter_career.ts && npx tsx test_ranking_context.ts`

Expected: FAIL on inactivity behavior.

- [ ] **Step 3: Implement eligibility and effective score**

Compute inactivity in calendar days. Apply no penalty for 274 days, then a progressive capped penalty through 548 days. Combine historical ELO with recent structured fight form. Filter retired and unsigned fighters before sorting; filter 18-month inactive non-champions. Keep existing champion-first ordering and movement-history capture.

- [ ] **Step 4: Add localized status markers**

In `Rankings.tsx`, show an inactivity marker after nine months and a declining-career marker for active post-prime fighters. Use derived helpers only; do not persist localized labels or effective score.

- [ ] **Step 5: Run ranking checks**

Run: `npx tsx test_fighter_career.ts && npx tsx test_ranking_context.ts`

Expected: PASS.

---

### Task 6: Score and induct Hall of Fame classes

**Files:**
- Modify: `src/lib/game/career.ts`
- Modify: `src/pages/HistoryStats.tsx`
- Modify: `test_fighter_career.ts`

**Interfaces:**

```ts
export function calculateHallOfFameScore(state: GameState, fighterId: string): number;
export function updateHallOfFame(state: GameState, year: number, language?: Language): GameState;
```

- [ ] **Step 1: Add failing Hall of Fame checks**

Create retired fighters with controlled title reigns, defenses, unifications, GP wins/finals, awards, records, streaks, major wins, and popularity. Assert:

- no induction until at least the season after retirement;
- every fighter above threshold is inducted with no annual cap;
- below-threshold fighters remain uninducted;
- `inductedYear` and `legacyScore` freeze;
- repeat calls create no duplicate induction/news;
- English and Vietnamese prose differs while induction metadata is equal.

- [ ] **Step 2: Verify failure**

Run: `npx tsx test_fighter_career.ts`

Expected: FAIL on missing Hall of Fame helpers.

- [ ] **Step 3: Implement structured legacy score and induction**

Calculate only from structured title history, fighter history metadata already represented structurally, fight/event archives, GP state, yearly awards, record/streaks, major wins, performance, popularity, and milestones. Sort candidates by ID before evaluation. Store the score and year once and generate one stable localized news item `hall-of-fame:${fighterId}:${year}`.

- [ ] **Step 4: Add Hall of Fame panel**

Inside `HistoryStats.tsx`, render inducted fighters sorted by year then frozen score, linking to existing Fighter Detail navigation. Show induction year, legacy score, record, and major achievements. Do not add a route or navigation item.

- [ ] **Step 5: Run Hall of Fame checks**

Run: `npx tsx test_fighter_career.ts`

Expected: PASS.

---

### Task 7: Add one validated Fighter Editor action and inline UI

**Files:**
- Modify: `src/lib/game/career.ts`
- Modify: `src/store/gameStore.ts`
- Modify: `src/pages/FighterDetail.tsx`
- Modify: `test_fighter_career.ts`
- Modify: `test_ui_contracts.ts`

**Interfaces:**

```ts
export function applyFighterEdit(
  state: GameState,
  fighterId: string,
  input: FighterEditInput
): FighterEditResult;
```

Add to `GameStore`:

```ts
editFighter: (fighterId: string, input: FighterEditInput) => FighterEditResult;
```

- [ ] **Step 1: Add failing validation and protected-field checks**

Assert valid edits update only allowed fields and recompute OVR through the existing helper. Assert:

- trimmed non-empty bounded names/nationality;
- valid age and numeric ranges;
- existing attribute bounds;
- valid physical relationships;
- POT below OVR normalizes to OVR;
- post-prime POT normalizes exactly to OVR;
- age edit updates displayed phase but does not run lifecycle/world generation;
- record, contract, title state/history, injuries, suspension, ELO, retirement, and Hall of Fame metadata remain byte-equal;
- weight-class edit returns each exact block code for title, future booking, active/planned GP, and pending title shot;
- success refreshes rankings and champion flags.

Add source/UI contracts for one inline `Edit Profile` action, Save/Cancel controls, labels, numeric inputs, and error presentation in both modes.

- [ ] **Step 2: Verify failure**

Run: `npx tsx test_fighter_career.ts && npx tsx test_ui_contracts.ts`

Expected: FAIL on missing editor action/UI.

- [ ] **Step 3: Implement complete trust-boundary validation**

Validate the whole `FighterEditInput`; never accept `Partial<Fighter>`. Build the normalized fighter from the existing fighter plus explicitly enumerated editable fields. Detect weight-class constraints from titles, future events, active/planned tournaments, and pending title-shot debt. Return the original state on failure. On success recompute career phase, normalize POT, synchronize champion flags, and refresh rankings.

- [ ] **Step 4: Wire the store action**

Call `applyFighterEdit` inside one Zustand action, update store only on success, and return the typed result so the UI can retain draft values and show the exact blocking reason.

- [ ] **Step 5: Build the inline editor**

In Fighter Detail Overview, add `Edit Profile` in Manager and Observer modes. Use local draft state initialized from the fighter. Render profile, physical, combat/physical attributes, and management values in responsive fieldsets. Save calls the single store action; Cancel discards draft. Failed Save preserves every draft value and shows localized reason. Do not add a route, modal dependency, or arbitrary patch action.

- [ ] **Step 6: Run editor checks**

Run: `npx tsx test_fighter_career.ts && npx tsx test_ui_contracts.ts`

Expected: PASS.

---

### Task 8: Complete retirement surfaces and bilingual resources

**Files:**
- Modify: `src/pages/FighterDetail.tsx`
- Modify: `src/pages/Roster.tsx`
- Modify: `src/pages/FreeAgents.tsx`
- Modify: `src/pages/EventBuilder.tsx`
- Modify: `src/i18n/resources/en.ts`
- Modify: `src/i18n/resources/vi.ts`
- Modify: `test_i18n.ts`
- Modify: `test_ui_contracts.ts`

- [ ] **Step 1: Add failing localization and active-list contracts**

Assert symmetric keys exist for phases, retirement reasons, retirement announcement, annual rookie announcement, Hall of Fame induction, ranking markers, editor labels/actions/validation, and weight-class block reasons. Assert active roster/free-agent/event-builder source filters explicitly exclude retired fighters.

- [ ] **Step 2: Verify failure**

Run: `npx tsx test_i18n.ts && npx tsx test_ui_contracts.ts`

Expected: FAIL on missing keys and retired filters.

- [ ] **Step 3: Add retirement presentation**

Fighter Detail stays reachable from historical links. Show retired status, retirement date, computed retirement age, localized reason, and Hall of Fame induction metadata when present. Do not rewrite existing fighter history or archived prose.

- [ ] **Step 4: Exclude retired fighters from active UI candidates**

Add explicit `careerPhase !== 'retired'` boundaries to roster, free-agent signing, matchmaking/event builder, inbox/signing candidate derivations, and tournament selectors even when contract corruption would otherwise include them.

- [ ] **Step 5: Add symmetric resources**

Add the same object shape to English and Vietnamese resources. Keep reason/status codes, seeds, IDs, ELO, and numeric decisions language-independent. Capture language once at lifecycle/automation operation entry.

- [ ] **Step 6: Run i18n/UI checks**

Run: `npx tsx test_i18n.ts && npx tsx test_ui_contracts.ts`

Expected: PASS.

---

### Task 9: Prove long-run sustainability and run the full regression/browser audit

**Files:**
- Create: `test_fighter_career_long_sim.ts`
- Modify only production/test files required by failures rooted in this feature.

- [ ] **Step 1: Write the 25-year Observer acceptance check**

Create a seeded Observer world, advance 25 years through the real store/game orchestration path, and assert after each year:

```ts
assert.equal(activeFighters.some(fighter => fighter.age > 45), false);
assert.equal(rankedFighters.some(fighter => fighter.careerPhase === 'retired'), false);
assert.equal(rankedFighters.some(fighter => fighter.contract === null), false);
assert.equal(validateTournamentState(state).length, 0);
assert.equal(validateTitleShotDebtState(state).length, 0);
assert.equal(validateCareerState(state).length, 0);
```

Also assert recurring birth cohorts, plausible age spread, minimum operational depth per division, stable unique IDs, valid title holders, and Hall of Fame entries after the waiting period. Run the same seeded simulation twice and compare structured career outcomes.

- [ ] **Step 2: Run focused and long checks**

Run:

```bash
npx tsx test_fighter_career.ts
npx tsx test_fighter_career_long_sim.ts
npx tsx test_observer_decisions.ts
npx tsx test_tournament.ts
npx tsx test_ranking_context.ts
```

Expected: all PASS.

- [ ] **Step 3: Run all existing gameplay regressions**

Run every repository `test_*.ts` script through `npx tsx`, then:

```bash
npm run lint
npm run build
```

Expected: all scripts exit 0, TypeScript exits 0, and Vite produces `dist` successfully.

- [ ] **Step 4: Perform one consolidated code review**

Review the complete diff once for correctness, security, deterministic language boundaries, import cycles, save compatibility, protected editor fields, active-list exclusions, and accidental unrelated changes. Fix only confirmed findings and rerun affected checks.

- [ ] **Step 5: Verify the real browser surface**

Run the app on port 3000 and use the existing temporary external Playwright approach. At desktop `1280×800` and mobile `390×844`, in both English and Vietnamese:

- open Fighter Detail from active roster and edit profile/stats;
- verify Cancel, successful Save, POT normalization, and retained draft plus localized weight-class block error;
- inspect a retired fighter through History/archives;
- inspect Rankings inactivity/decline markers;
- inspect Hall of Fame inside History & Stats;
- verify no horizontal overflow and no console/page errors.

Do not add Playwright to project dependencies or commit the temporary audit script.

- [ ] **Step 6: Report without committing**

Summarize changed systems, exact verification results, browser evidence, and any excluded behavior. Leave all changes uncommitted unless the user explicitly asks for commit/push.
