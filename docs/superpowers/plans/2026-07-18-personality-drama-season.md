# Fighter Personality, Drama, and Season Goals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic fighter personality, contextual drama decisions, explainable Observer resolution, and annual objectives/reviews with bilingual responsive UI.

**Architecture:** Persist one compact `drama` root containing incidents, cooldown keys, objectives, reviews, and promoter identity; persist at most two traits on each fighter. Keep creation/resolution and annual scoring in focused pure game modules, call them only at existing daily/event/annual boundaries, and reuse Inbox, Social Hub, awards, archives, event repair, and current fighter/promotion values rather than adding parallel systems.

**Tech Stack:** React 19, TypeScript 5.8, Zustand 5, Vite 6, Tailwind CSS 4, i18next/react-i18next, date-fns, deterministic `stableCareerSeed`, Node `assert` scripts via `tsx`.

## Global Constraints

- Personality changes behavior, not OVR, POT, ranking score, or direct fight odds.
- Manager mode stores consequential incidents; Observer mode resolves them immediately without pausing simulation.
- Generated outcomes, IDs, traits, objectives, and AI tiebreakers must be deterministic and independent of locale or iteration order.
- Reuse existing morale, popularity, fatigue, injuries, contracts, social hype, rivalries, money, reputation, fanbase, archives, awards, and season plans.
- No relationship graph, staff, gym, commission, debt, finance-slider, LLM, network service, modal, charting, state-management, or responsive dependency.
- Every user-visible string and generated message must exist in English and Vietnamese with matching translation-key shapes.
- Support 390x844 portrait, 740x390 short landscape, and desktop; no page-level horizontal overflow or hover-only disclosure.
- Preserve event, tournament, title, archive, ranking, save, and Observer determinism invariants.
- Do not run `test_long_sim.ts`; use only a bounded purpose-built simulation check.
- Do not stage, commit, or push; ignore `.superpowers/` and `belt/`.

---

## File Structure

- `src/types/game.ts`: persisted trait, incident, consequence, objective, review, and drama-root contracts.
- `src/lib/game/personality.ts`: deterministic trait assignment and bounded behavior modifiers.
- `src/lib/game/drama.ts`: incident trigger detection, response validation, Manager resolution, Observer scoring, consequence application, and report creation.
- `src/lib/game/seasonObjectives.ts`: valid annual objective generation, progress/completion, one-time rewards, snapshots, and season review.
- `src/lib/game/generator.ts`: initialize traits and drama state for new worlds.
- `src/lib/game/careerEcosystem.ts`: assign traits to annual and emergency prospects.
- `src/lib/game/save.ts`: schema version 12, persistence whitelist, and idempotent migration.
- `src/lib/engine.ts`: meaningful date/event/year integration boundaries.
- `src/lib/game/observer.ts`: immediate Observer incident resolution.
- `src/store/gameStore.ts`: preserve drama state, expose Manager response and promoter-identity actions, and block only affected due events.
- `src/lib/game/inbox.ts`, `src/pages/Inbox.tsx`: pending incident list/detail decision UX.
- `src/pages/FighterDetail.tsx`: authoritative personality display.
- `src/pages/Dashboard.tsx`, `src/pages/HistoryStats.tsx`: active objectives, Observer report summary, and season reviews.
- `src/i18n/resources/en.ts`, `src/i18n/resources/vi.ts`: mirrored UI/generated copy.
- `test_personality_drama.ts`: focused deterministic engine, migration, resolution, Observer, and integrity tests.
- `test_season_objectives.ts`: objective/reward/review tests.
- `test_ui_contracts.ts`, `test_i18n.ts`, `test_observer_decisions.ts`: integration contracts.
- `test_drama_long_sim.ts`: bounded history-growth and non-stall acceptance check.

---

### Task 1: Persist deterministic personality and drama state

**Files:**
- Modify: `src/types/game.ts`
- Create: `src/lib/game/personality.ts`
- Modify: `src/lib/game/generator.ts`
- Modify: `src/lib/game/careerEcosystem.ts`
- Modify: `src/lib/game/save.ts`
- Create: `test_personality_drama.ts`

**Interfaces:**
- Produces `FighterPersonalityTrait`, `PromoterIdentity`, `DramaIncident`, `DramaState`, `assignPersonalityTraits(fighter): FighterPersonalityTrait[]`, and `ensurePersonalityTraits(fighter): Fighter`.
- Later tasks consume `GameState.drama`, `Fighter.personalityTraits`, and `stableCareerSeed`-backed assignments.

- [ ] **Step 1: Add a failing persistence and determinism test**

Create `test_personality_drama.ts` with assertions that:

```ts
import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { validateAndMigrateState, CURRENT_SAVE_VERSION } from './src/lib/game/save';
import { assignPersonalityTraits } from './src/lib/game/personality';

const first = generateInitialWorld(701);
const second = generateInitialWorld(701);
assert.equal(CURRENT_SAVE_VERSION, 12);
assert.deepEqual(
  Object.fromEntries(Object.values(first.fighters).map(f => [f.id, f.personalityTraits])),
  Object.fromEntries(Object.values(second.fighters).map(f => [f.id, f.personalityTraits]))
);
for (const fighter of Object.values(first.fighters)) {
  assert.ok(fighter.personalityTraits.length >= 1 && fighter.personalityTraits.length <= 2);
  assert.equal(new Set(fighter.personalityTraits).size, fighter.personalityTraits.length);
  assert.equal(fighter.personalityTraits.includes('loyal') && fighter.personalityTraits.includes('mercenary'), false);
  assert.deepEqual(assignPersonalityTraits(fighter), fighter.personalityTraits);
}
const legacy = structuredClone(first) as any;
delete legacy.drama;
legacy.saveVersion = 11;
for (const fighter of Object.values(legacy.fighters) as any[]) delete fighter.personalityTraits;
const migrated = validateAndMigrateState(legacy)!;
const migratedAgain = validateAndMigrateState(structuredClone(migrated))!;
assert.deepEqual(migratedAgain, migrated);
assert.equal(migrated.drama.promoterIdentity, 'meritocracy');
assert.deepEqual(migrated.drama.incidents, {});
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx test_personality_drama.ts`

Expected: compile failure because personality/drama contracts and module do not exist, or assertion failure because save version remains 11.

- [ ] **Step 3: Add minimal persisted contracts**

Add to `src/types/game.ts`:

```ts
export type FighterPersonalityTrait = 'professional' | 'trash_talker' | 'diva' | 'loyal' | 'mercenary' | 'risk_taker' | 'hot_head' | 'company_fighter';
export type PromoterIdentity = 'meritocracy' | 'spectacle' | 'prospect_builder' | 'conservative';
export type DramaIncidentType = 'weight_cut' | 'camp_injury' | 'trash_talk' | 'press_altercation' | 'pay_demand' | 'short_notice_refusal' | 'title_picture_complaint';
export type DramaIncidentStatus = 'pending' | 'resolved' | 'expired';
export type DramaSeverity = 'minor' | 'major' | 'critical';
export type DramaRisk = 'low' | 'medium' | 'high';
export type DramaConsequenceKind = 'money' | 'reputation' | 'fanbase' | 'morale' | 'popularity' | 'fatigue' | 'social_hype' | 'rivalry' | 'injury' | 'booking';

export interface DramaConsequence {
  kind: DramaConsequenceKind;
  value: number;
  fighterId?: string;
  fightId?: string;
  descriptionKey: string;
}

export interface DramaIncident {
  id: string;
  type: DramaIncidentType;
  severity: DramaSeverity;
  status: DramaIncidentStatus;
  createdDate: string;
  fighterIds: string[];
  responseKeys: string[];
  fightId?: string;
  eventId?: string;
  storylineId?: string;
  selectedResponseKey?: string;
  resolverMode?: 'manager' | 'observer';
  rationaleKey?: string;
  resolvedDate?: string;
  expiredReason?: string;
  consequences?: DramaConsequence[];
}

export type SeasonObjectiveCategory = 'sporting' | 'entertainment' | 'business';
export type SeasonObjectiveKind = 'active_champion' | 'title_fights' | 'prospect_top_five' | 'profitable_grand_prix' | 'strong_rivalry' | 'award_candidate' | 'profit' | 'fanbase_growth';

export interface SeasonObjective {
  id: string;
  year: number;
  category: SeasonObjectiveCategory;
  kind: SeasonObjectiveKind;
  target: number;
  progress: number;
  completed: boolean;
  rewardGranted: boolean;
  fighterId?: string;
  weightClass?: WeightClass;
}

export interface SeasonSnapshot {
  year: number;
  money: number;
  reputation: number;
  fanbase: number;
  signedFighters: number;
}

export interface SeasonReview {
  year: number;
  objectiveIds: string[];
  completedObjectives: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  topIncidentId?: string;
  snapshot: SeasonSnapshot;
}

export interface DramaState {
  promoterIdentity: PromoterIdentity;
  incidents: Record<string, DramaIncident>;
  triggerKeys: string[];
  cooldowns: Record<string, string>;
  objectives: Record<number, SeasonObjective[]>;
  seasonSnapshots: Record<number, SeasonSnapshot>;
  seasonReviews: Record<number, SeasonReview>;
}
```

Add `personalityTraits: FighterPersonalityTrait[]` to `Fighter` and `drama: DramaState` to `GameState`.

- [ ] **Step 4: Implement deterministic assignment**

Create `src/lib/game/personality.ts` using `stableCareerSeed(fighter.id, 'personality', slot)` to select one or two traits from a fixed ordered list. Remove duplicates and reject the conflicting pairs `loyal/mercenary` and `professional/hot_head`. Export:

```ts
export function assignPersonalityTraits(fighter: Fighter): FighterPersonalityTrait[];
export function ensurePersonalityTraits(fighter: Fighter): Fighter;
export function hasPersonalityTrait(fighter: Fighter, trait: FighterPersonalityTrait): boolean;
```

Use one trait for roughly one third of stable seeds and two otherwise; do not call global RNG.

- [ ] **Step 5: Initialize and migrate**

- In `generateFighter`, pass the completed fighter through `ensurePersonalityTraits`.
- In `buildProspect`, preserve generated traits.
- In `generateInitialWorld`, initialize:

```ts
drama: {
  promoterIdentity: 'meritocracy',
  incidents: {},
  triggerKeys: [],
  cooldowns: {},
  objectives: {},
  seasonSnapshots: {},
  seasonReviews: {}
}
```

- In `save.ts`, set `CURRENT_SAVE_VERSION = 12`, persist `drama`, normalize every fighter with `ensurePersonalityTraits`, and backfill/normalize each drama collection without mutating input arrays.

- [ ] **Step 6: Verify GREEN and regressions**

Run:

```bash
npx tsx test_personality_drama.ts
npx tsx test_career_ecosystem.ts
npx tsx test_management_depth.ts
```

Expected: all pass.

---

### Task 2: Build bounded incident generation and Manager resolution

**Files:**
- Create: `src/lib/game/drama.ts`
- Modify: `src/lib/engine.ts`
- Modify: `src/store/gameStore.ts`
- Modify: `test_personality_drama.ts`

**Interfaces:**
- Consumes `GameState.drama`, fighter traits, event/fight state, `stableCareerSeed`, and existing event/tournament repair helpers.
- Produces:

```ts
export function generateScheduledDrama(state: GameState, date?: string, language?: Language): GameState;
export function resolveDramaIncident(state: GameState, incidentId: string, responseKey: string, resolverMode: 'manager' | 'observer', rationaleKey?: string, language?: Language): GameState;
export function hasPendingIncidentForEvent(state: GameState, eventId: string): boolean;
export function getValidDramaResponses(state: GameState, incident: DramaIncident): DramaResponse[];
```

- [ ] **Step 1: Extend the failing test with a controlled fight-week fixture**

Add one future event with two contracted healthy fighters, set current date to seven days before it, and assert:

```ts
const generated = generateScheduledDrama(fixture, fixture.currentDate, 'en');
const repeated = generateScheduledDrama(generated, fixture.currentDate, 'en');
assert.deepEqual(repeated, generated);
assert.ok(Object.values(generated.drama.incidents).length <= 1);
const incident = Object.values(generated.drama.incidents)[0];
assert.ok(incident);
assert.equal(incident.status, 'pending');
assert.equal(hasPendingIncidentForEvent(generated, event.id), true);
const resolved = resolveDramaIncident(generated, incident.id, incident.responseKeys[0], 'manager', undefined, 'en');
assert.equal(resolved.drama.incidents[incident.id].status, 'resolved');
assert.deepEqual(resolveDramaIncident(resolved, incident.id, incident.responseKeys[0], 'manager', undefined, 'en'), resolved);
```

Also assert no incident is generated for a completed event, no more than one incident per fight, and bounded consequences keep morale/popularity/reputation within 0-100 and money/fanbase non-negative.

- [ ] **Step 2: Verify RED**

Run: `npx tsx test_personality_drama.ts`

Expected: failure because `drama.ts` exports do not exist.

- [ ] **Step 3: Implement stable boundary detection**

In `src/lib/game/drama.ts`:

- Sort future events and fights by ID/date before evaluation.
- Evaluate only `daysUntil === 14` or `daysUntil === 7`.
- Build trigger keys as `drama:<date>:<eventId>:<fightId>:<boundary>`.
- Enforce one primary incident per fight, two disruptive incidents per event, and four incidents per month.
- Derive eligibility/weight from traits, fighter popularity, rivalry intensity, title/tournament status, promotion reputation, and fanbase tier.
- Choose incident type/severity through `stableCareerSeed(triggerKey, 'incident')`, never global RNG.
- Persist every evaluated trigger key so repeated repair paths cannot reroll.
- Supply only response keys valid for the incident and current state.

Keep first-release response effects minimal:

- `weight_cut`: `accept_catchweight`, `fine_fighter`, `replace_or_cancel`.
- `camp_injury`: `rest_and_continue`, `replace_or_cancel`.
- `trash_talk`: `amplify`, `deescalate`.
- `press_altercation`: `fine_both`, `use_for_hype`.
- `pay_demand`: `improve_terms`, `hold_line`.
- `short_notice_refusal`: `respect_refusal`, `apply_pressure`.
- `title_picture_complaint`: `promise_eliminator`, `reject_demand`.

- [ ] **Step 4: Implement atomic resolution**

`resolveDramaIncident` must:

1. Return unchanged state for missing/non-pending incident.
2. Recompute valid responses against current references.
3. Expire the incident with `expiredReason: 'stale_reference'` when no valid response remains.
4. Reject an invalid response by returning state unchanged.
5. Clone only mutated root records/arrays.
6. Derive uncertain branch from `stableCareerSeed(incident.id, responseKey, 'outcome')`.
7. Clamp existing values and record structured consequences.
8. Use existing event repair behavior for replacement/cancellation rather than editing tournament/archive history.
9. Add stable-ID localized news/social output.
10. Mark incident resolved exactly once.

- [ ] **Step 5: Integrate the meaningful date boundary and store action**

- Call `generateScheduledDrama` near the end of `advanceTime` after availability/title/ranking updates and before generated social output.
- Add `resolveDramaIncident(incidentId, responseKey)` and `setPromoterIdentity(identity)` to `GameStore`.
- Preserve `drama` in the manual `advanceAutopilot` state reconstruction.
- Before quick-simulating a due Manager event, skip only that event if `hasPendingIncidentForEvent` is true; Observer must never leave such incidents pending.

- [ ] **Step 6: Verify GREEN and event integrity**

Run:

```bash
npx tsx test_personality_drama.ts
npx tsx test_tournament.ts
npx tsx test_management_depth.ts
```

Expected: all pass, including existing tournament/calendar invariants.

---

### Task 3: Add explainable Observer promoter policies

**Files:**
- Modify: `src/lib/game/drama.ts`
- Modify: `src/lib/game/observer.ts`
- Modify: `src/types/game.ts`
- Modify: `test_observer_decisions.ts`
- Modify: `test_personality_drama.ts`

**Interfaces:**
- Produces:

```ts
export function resolveObserverDrama(state: GameState, language?: Language): GameState;
export function chooseObserverDramaResponse(state: GameState, incident: DramaIncident): { responseKey: string; rationaleKey: string } | null;
```

- Extends `AutopilotSummary` with optional `drama` aggregate fields without changing existing callers.

- [ ] **Step 1: Add failing policy tests**

Build one pending incident with at least two valid responses, clone it across all four identities, and assert:

```ts
for (const identity of ['meritocracy', 'spectacle', 'prospect_builder', 'conservative'] as const) {
  const choice = chooseObserverDramaResponse({ ...fixture, drama: { ...fixture.drama, promoterIdentity: identity } }, incident);
  assert.ok(choice);
  assert.ok(incident.responseKeys.includes(choice.responseKey));
  assert.ok(choice.rationaleKey.startsWith(`generated.drama.rationale.${identity}`));
}
const autoResolved = resolveObserverDrama(observerFixture, 'en');
assert.equal(autoResolved.drama.incidents[incident.id].status, 'resolved');
assert.equal(autoResolved.drama.incidents[incident.id].resolverMode, 'observer');
assert.deepEqual(resolveObserverDrama(autoResolved, 'en'), autoResolved);
```

Assert English and Vietnamese runs are structurally equal after stripping localized prose.

- [ ] **Step 2: Verify RED**

Run: `npx tsx test_personality_drama.ts && npx tsx test_observer_decisions.ts`

Expected: failure because policy functions are missing.

- [ ] **Step 3: Implement deterministic response scoring**

Give every valid response a bounded integer score from:

- Identity preference.
- Event title/tournament importance.
- Promotion cash safety.
- Fighter age, career phase, popularity, and traits.
- Expected booking disruption.

Use stable response-key lexical order and `stableCareerSeed(incident.id, responseKey, identity)` only as the final tiebreak. Do not expose numeric scores in reports. Return a rationale translation key for the dominant policy factor.

- [ ] **Step 4: Resolve all pending Observer incidents in the existing policy pass**

At the start of `runObserverDecisions`, after counter-offers and before social announce/hype, call `resolveObserverDrama`. The result must contain no pending incident attached to an event that can become due. Record each resolution in stable news/social items and update optional summary aggregates when `advanceAutopilot` produces its final summary.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
npx tsx test_personality_drama.ts
npx tsx test_observer_decisions.ts
npx tsx test_social_hub.ts
```

Expected: all pass; repeated Observer passes do not duplicate reports or consequences.

---

### Task 4: Generate objectives, rewards, snapshots, and season reviews

**Files:**
- Create: `src/lib/game/seasonObjectives.ts`
- Modify: `src/lib/engine.ts`
- Modify: `src/lib/game/generator.ts`
- Create: `test_season_objectives.ts`

**Interfaces:**
- Produces:

```ts
export function ensureSeasonObjectives(state: GameState, year: number): GameState;
export function refreshSeasonObjectives(state: GameState, year: number): GameState;
export function finalizeSeasonReview(state: GameState, year: number): GameState;
export function getSeasonObjectiveProgress(state: GameState, objective: SeasonObjective): number;
```

- [ ] **Step 1: Write failing objective tests**

Assert that a valid world receives exactly one sporting, entertainment, and business objective; repeated calls are identical; a vacant-title world never gets `active_champion`; an empty viable GP pool never gets `profitable_grand_prix`; completion rewards apply once; and final review references existing awards and one top incident without duplicating entities.

Core assertions:

```ts
const initialized = ensureSeasonObjectives(state, 2025);
assert.deepEqual(initialized.drama.objectives[2025].map(item => item.category).sort(), ['business', 'entertainment', 'sporting']);
assert.deepEqual(ensureSeasonObjectives(initialized, 2025), initialized);
const completed = refreshSeasonObjectives(completionFixture, 2025);
const repeated = refreshSeasonObjectives(completed, 2025);
assert.deepEqual(repeated, completed);
assert.equal(completed.drama.objectives[2025].filter(item => item.rewardGranted).length, 1);
const reviewed = finalizeSeasonReview(completed, 2025);
assert.deepEqual(finalizeSeasonReview(reviewed, 2025), reviewed);
assert.ok(reviewed.drama.seasonReviews[2025]);
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx test_season_objectives.ts`

Expected: compile failure because the module does not exist.

- [ ] **Step 3: Implement deterministic valid candidate selection**

- Snapshot money/reputation/fanbase/signed roster at objective initialization.
- Build category candidate lists only from achievable current state.
- Sort candidates by stable objective key and select with `stableCareerSeed(year, category, promotion.id)`.
- Store exactly three objectives when each category has a candidate; otherwise omit only the impossible category.
- Derive progress from authoritative title, ranking, event archive, fight archive, tournament, storyline, finance, fanbase, and award data.
- Grant one bounded reward exactly once through `rewardGranted` and a stable finance/news entry where relevant.

- [ ] **Step 4: Build final review**

After awards for the old year exist, calculate the final objective states, pick the highest-impact resolved incident by absolute recorded consequence with stable ID tiebreak, record the ending snapshot, and assign grade:

```ts
const grade = completed === 3 ? 'S' : completed === 2 ? 'A' : completed === 1 ? 'B' : improved ? 'C' : 'D';
```

Reference IDs only; do not copy fighter/fight/event records.

- [ ] **Step 5: Integrate annual lifecycle**

In `advanceTime`:

1. Ensure current-year objectives for new and migrated games.
2. Refresh progress after relevant state mutations.
3. On year rollover, generate awards, refresh old-year objectives, finalize old-year review, then create new-year objectives after lifecycle/rookie generation.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
npx tsx test_season_objectives.ts
npx tsx test_career_ecosystem.ts
npx tsx test_management_depth.ts
```

Expected: all pass.

---

### Task 5: Build bilingual responsive Manager decision UX

**Files:**
- Modify: `src/lib/game/inbox.ts`
- Modify: `src/pages/Inbox.tsx`
- Modify: `src/i18n/resources/en.ts`
- Modify: `src/i18n/resources/vi.ts`
- Modify: `test_ui_contracts.ts`
- Modify: `test_i18n.ts`

**Interfaces:**
- Inbox items may target a drama incident through `incidentId?: string`.
- `Inbox.tsx` calls `state.resolveDramaIncident(incidentId, responseKey)`.

- [ ] **Step 1: Add failing source/UI contracts**

Assert source contains:

- Pending drama incidents included by `getPromotionInbox`.
- `selectedIncidentId` list/detail state.
- A mobile back action.
- Decision buttons with `min-h-11`, `w-full`, and `type="button"`.
- `min-w-0`, wrapping consequence text, and no fixed-width dialog.
- Risk text labels independent of color.
- EN/VI flattened-key equality.

- [ ] **Step 2: Verify RED**

Run: `npx tsx test_ui_contracts.ts && npx tsx test_i18n.ts`

Expected: assertion failure for missing drama decision contracts.

- [ ] **Step 3: Extend derived Inbox data**

Map pending Manager incidents to `critical` or `urgent` items sorted before ordinary opportunities. Include `incidentId`, relevant event/fighter, localized title/summary, and a dedicated target that opens the incident detail inside Inbox rather than navigating away.

- [ ] **Step 4: Implement responsive list/detail flow**

- Use a one-column list by default and `lg:grid lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]` for wide screens.
- On narrow screens, render either list or detail, with an explicit back button.
- Render response cards from `getValidDramaResponses`.
- Show certain consequences and localized low/medium/high risk text.
- Use semantic headings, visible focus, buttons at least 44px tall, `min-w-0`, and wrapping text.
- Do not use a modal or viewport hook.

- [ ] **Step 5: Add mirrored translation trees**

Add matching keys under `inbox.drama`, `personality`, `objectives`, `seasonReview`, and `generated.drama` in both resources. Persist only keys/codes in game state; generated news at resolution uses the fixed language passed to the operation.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
npx tsx test_ui_contracts.ts
npx tsx test_i18n.ts
npx tsx test_management_depth.ts
```

Expected: all pass.

---

### Task 6: Surface traits, objectives, Observer reports, and season reviews

**Files:**
- Modify: `src/pages/FighterDetail.tsx`
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/pages/HistoryStats.tsx`
- Modify: `src/i18n/resources/en.ts`
- Modify: `src/i18n/resources/vi.ts`
- Modify: `test_ui_contracts.ts`

**Interfaces:**
- Reads `fighter.personalityTraits`, current-year `state.drama.objectives`, `state.lastAutopilotSummary?.drama`, resolved incidents, and `state.drama.seasonReviews`.
- No new route or dependency.

- [ ] **Step 1: Add failing UI source contracts**

Assert:

- Fighter Detail renders no more than the persisted two trait badges and uses a tap/click-accessible explanation element.
- Dashboard renders current objective progress and compact Observer incident summary.
- History & Stats renders season reviews and a filterable resolved-incident timeline.
- Grids are one-column by default and expand at breakpoints.
- Wide history tables use local `overflow-x-auto`; compact controls wrap.

- [ ] **Step 2: Verify RED**

Run: `npx tsx test_ui_contracts.ts`

Expected: failure for missing personality/objective/review surfaces.

- [ ] **Step 3: Add trait disclosure**

On Fighter Detail, render one or two localized badges and an accessible disclosure panel/button explaining behavioral impact. Do not use hover-only tooltips and do not duplicate trait logic in UI.

- [ ] **Step 4: Add active objectives and Observer summary**

On Dashboard, render objectives as `grid gap-3 sm:grid-cols-2 xl:grid-cols-3`, with textual progress (`progress / target`) plus a visual bar. When the last autopilot summary contains drama, show incident/resolution/fight/money/hype totals and a link to History & Stats.

- [ ] **Step 5: Add season review and drama timeline**

On History & Stats, add:

- Season review cards sorted newest first.
- Objective completion, grade, award links, top incident, and year-over-year values.
- Filter controls for incident severity/type/event/fighter that wrap on narrow screens.
- Resolved incident cards with selected response, rationale, and consequences.

Missing fighter/event/fight references use localized fallback labels.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
npx tsx test_ui_contracts.ts
npx tsx test_i18n.ts
npm run lint
```

Expected: all pass.

---

### Task 7: Prove bounded long-run behavior and verify the application

**Files:**
- Create: `test_drama_long_sim.ts`
- Modify only if a regression exposes a root cause in prior task files.

**Interfaces:**
- Uses real `generateInitialWorld`, `advanceTime`, Observer decisions/autobooker, and integrity validators.
- Produces one bounded acceptance script; does not import browser-only store code.

- [ ] **Step 1: Write the bounded acceptance test**

Simulate a fixed-seed Observer world in bounded chunks covering at least three year transitions, without `test_long_sim.ts`. Assert after every chunk:

```ts
assert.equal(Object.values(state.drama.incidents).some(item => item.status === 'pending'), false);
assert.equal(new Set(state.drama.triggerKeys).size, state.drama.triggerKeys.length);
assert.ok(Object.values(state.drama.incidents).length <= simulatedMonths * 4 + scheduledFightAllowance);
assert.ok(validateSeasonCalendarState(state).length === 0);
assert.ok(Object.values(state.fighters).every(f => f.personalityTraits.length >= 1 && f.personalityTraits.length <= 2));
```

Also assert same seed produces the same state after stripping localized prose, each elapsed year has at most one review, rewards are not duplicated, division rosters remain viable, and later bounded chunks do not show material incident-history slowdown.

- [ ] **Step 2: Verify bounded simulation**

Run: `npx tsx test_drama_long_sim.ts`

Expected: PASS within a bounded runtime comparable across chunks.

- [ ] **Step 3: Run focused and broad non-long regressions**

Run individually, never through `test_*.ts` glob:

```bash
npx tsx test_personality_drama.ts
npx tsx test_season_objectives.ts
npx tsx test_observer_decisions.ts
npx tsx test_social_hub.ts
npx tsx test_management_depth.ts
npx tsx test_career_ecosystem.ts
npx tsx test_tournament.ts
npx tsx test_ui_contracts.ts
npx tsx test_i18n.ts
npm run lint
npm run build
git diff --check
```

Expected: all pass; the existing Vite chunk-size warning may remain but no new error/warning is introduced.

- [ ] **Step 4: Run the real browser surface**

Start the existing app with `npm run dev` on port 3000 and use a temporary external Playwright/Chromium script without adding a dependency or committing the script.

At 390x844, 740x390, and desktop:

- Open Fighter Detail and operate trait disclosure by mouse and keyboard.
- Open Manager Inbox, select a pending incident, inspect all responses, resolve one, and confirm it cannot apply again.
- Verify decisions, long fighter names, translated prose, and currency wrap without page-level horizontal overflow.
- Switch to Observer, simulate through incidents, confirm no popup blocks progress, and inspect rationale in summary/timeline.
- Inspect objectives and season reviews in English and Vietnamese.
- Verify focus visibility, 44px touch targets, local table scrolling, mobile back behavior, and no clipped compact controls.

- [ ] **Step 5: Consolidated final review**

Review the actual working-tree diff once for:

- Missing persistence/autopilot reconstruction fields.
- Locale-dependent gameplay decisions.
- Duplicate incident/reward application.
- Mutation of input/archive/history.
- Invalid tournament/title/event repair.
- Unbounded history scans.
- Desktop/mobile accessibility regressions.

Fix only confirmed issues, rerun the affected focused test, then rerun lint/build and `git diff --check`. Leave all changes uncommitted.
