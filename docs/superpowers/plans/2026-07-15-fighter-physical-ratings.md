# Fighter Physical Profile and Ratings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add height, fight/walk-around weight, derived OVR, POT-capped development, lower new-world ratings, and bounded use of the new values throughout gameplay and UI.

**Architecture:** Put all rating, prospect, physical-profile, and POT-safe growth rules in one pure `fighterRatings.ts` module. Persist only physical measurements and the existing `potential`; derive OVR from current attributes. Migrate legacy saves deterministically, then replace existing ad hoc strength comparisons without disturbing rankings, title obligations, calendar, or GP safety.

**Tech Stack:** TypeScript, React 19, Zustand, Vite, Node strict assertions via `tsx`.

## Global Constraints

- Work directly on `main` as authorized.
- Do not commit or push.
- No new dependency.
- OVR is derived and never serialized.
- Existing saves keep their current attributes; only new worlds receive lower stats.
- Physical fight effects remain secondary and clamped to `0.95–1.05`.
- Preserve Observer mode, calendar, contracts, camps, rivalries, inbox, tournaments, title-shot debt, and long-simulation invariants.

---

### Task 1: Central ratings and physical-profile rules

**Files:**
- Create: `src/lib/game/fighterRatings.ts`
- Create: `test_fighter_ratings.ts`
- Modify: `src/types/game.ts`

**Interfaces:**
- Produces `getFighterOverall(fighter: Pick<Fighter, 'attributes' | 'style'>): number`.
- Produces `getWeightCutPercent(fighter: Pick<Fighter, 'fightWeightLb' | 'walkAroundWeightLb'>): number`.
- Produces `getPhysicalFightModifier(fighter: Fighter, opponent: Fighter): number`.
- Produces `getPhysicalProfile(weightClass: WeightClass, randomInt: (min: number, max: number) => number): FighterPhysicalProfile`.
- Produces `getDeterministicPhysicalProfile(weightClass: WeightClass, identity: string): FighterPhysicalProfile`.
- Produces `isProspect(fighter: Fighter): boolean`.
- Produces `improveFighterTowardPotential(fighter: Fighter, randomInt: ..., random: ...): Fighter`.

- [ ] Add required `heightCm`, `fightWeightLb`, and `walkAroundWeightLb` fields to `Fighter`.
- [ ] Write assertions covering OVR determinism/range, every attribute affecting OVR, valid class-specific physical profiles, deterministic migration profiles, weight-cut validity, modifier bounds, prospect classification, and POT-safe growth.
- [ ] Run `npx tsx test_fighter_ratings.ts`; expect failure because the module and fields do not exist.
- [ ] Implement a style-aware weighted average using all eleven attributes, clamped and rounded to 10–95.
- [ ] Implement the approved class ranges and stable string hash for migration.
- [ ] Implement a physical modifier from relative height, walk-around mass, and weight-cut burden, clamped to 0.95–1.05.
- [ ] Implement POT-safe growth that improves at most a few trainable attributes, slows near POT, and rolls back increments that would put OVR above POT.
- [ ] Run `npx tsx test_fighter_ratings.ts`; expect pass.

### Task 2: Generation balance and legacy migration

**Files:**
- Modify: `src/lib/game/generator.ts`
- Modify: `src/lib/game/save.ts`
- Modify: `src/lib/game/constants.ts`
- Modify: `test_fighter_ratings.ts`
- Modify: `test_management_depth.ts`

**Interfaces:**
- Consumes all Task 1 helpers.
- Produces generated fighters with complete physical fields, attributes at most 95, and `potential >= OVR`.
- Produces save version 8 migration with deterministic, idempotent physical fields and repaired POT.

- [ ] Add failing multi-seed assertions for the six archetypes' broad OVR bands and save migration idempotence.
- [ ] Confirm the new assertions fail.
- [ ] Set new generation baselines to approximately Champion 78–86, Contender 65–76, Prospect 48–60, Veteran 55–66, Journeyman 43–54, and Can 32–43; reduce style spikes where necessary and cap newly generated attributes at 95.
- [ ] Generate physical profiles with the existing seeded PRNG and set POT from the approved archetype bands, never below OVR.
- [ ] Replace initial-world raw attribute-sum sorting with `getFighterOverall()`.
- [ ] Raise `CURRENT_SAVE_VERSION` to 8. During migration, fill/clamp physical fields deterministically, preserve attributes, and repair POT to `max(existing POT, OVR)` within 10–95.
- [ ] Run `npx tsx test_fighter_ratings.ts && npx tsx test_management_depth.ts`; expect pass.

### Task 3: Progression, camps, and fight simulation

**Files:**
- Modify: `src/lib/engine.ts`
- Modify: `src/lib/game/fightSimulator.ts`
- Modify: `test_fighter_ratings.ts`
- Modify: `test_balance.ts`

**Interfaces:**
- Consumes `getFighterOverall()`, `getPhysicalFightModifier()`, and `improveFighterTowardPotential()`.
- Produces POT-capped passive growth, POT-aware temporary camp boosts, and bounded physical effects in actual fight simulation.

- [ ] Add assertions that fighters at POT do not grow, near-POT fighters cannot exceed POT, and physical profile differences can affect otherwise identical seeded simulations without mutating source fighters.
- [ ] Replace young-fighter direct stat increments in `advanceTime()` with the POT-safe helper; retain age decline.
- [ ] Scale temporary camp boosts by remaining `POT - OVR` room so a fighter at POT receives no skill boost; retain recovery/fatigue behavior.
- [ ] Use OVR for favorite/mismatch comparisons and apply the bounded physical modifier to each pre-fight modifier. Apply weight-cut burden modestly to initial cardio/bad-night risk without adding missed weight.
- [ ] Convert old raw-sum mismatch thresholds to OVR-gap thresholds with equivalent broad behavior.
- [ ] Run `npx tsx test_fighter_ratings.ts && npx tsx test_balance.ts`; inspect favorite/upset and finish-method diversity.

### Task 4: Management logic integration

**Files:**
- Modify: `src/lib/game/insights.ts`
- Modify: `src/lib/game/contracts.ts`
- Modify: `src/lib/game/tournament.ts`
- Modify: `src/lib/game/autobooker.ts`
- Modify: `src/lib/game/inbox.ts`
- Modify: `test_insights.ts`
- Modify: `test_tournament.ts`
- Modify: `test_management_depth.ts`

**Interfaces:**
- Consumes `getFighterOverall()` and `isProspect()`.
- Extends `FighterComparison` with `redOverall`, `blueOverall`, and optional mismatch warning.

- [ ] Add failing assertions that matchup recommendations prefer smaller OVR gaps when other inputs are equal, contracts react modestly to OVR/POT, and tournament ranking ties use OVR before popularity.
- [ ] Replace insight attribute averages with OVR and add OVR-gap reasons/warnings; include OVR closeness as a secondary recommendation score.
- [ ] Replace legacy prospect predicates with `isProspect()`.
- [ ] Add modest OVR/current-ability and high-POT prospect components to contract expectations without overtaking popularity/record.
- [ ] Keep tournament ranking first, then OVR, then popularity/POT.
- [ ] Pair normal autobooker opponents by close ranking/OVR where practical; do not change title, GP, availability, or calendar priorities.
- [ ] Run the three focused scripts; expect pass.

### Task 5: Scouting UI

**Files:**
- Modify: `src/pages/FighterDetail.tsx`
- Modify: `src/pages/Roster.tsx`
- Modify: `src/pages/FreeAgents.tsx`
- Modify: `src/pages/EventBuilder.tsx`
- Modify: `src/pages/Tournaments.tsx`
- Modify: `test_ui_contracts.ts`

**Interfaces:**
- Consumes `getFighterOverall()`, `getWeightCutPercent()`, and `isProspect()`.
- Displays OVR/POT consistently without storing OVR.

- [ ] Add UI contract assertions for OVR, POT, Height, Fight Weight, Walk-around Weight, Weight Cut, Toughness, and matchup mismatch copy.
- [ ] On Fighter Detail, add prominent OVR/POT stats, responsive physical cards, weight-cut percentage, and Toughness.
- [ ] Add sortable OVR/POT columns to Roster and Free Agents; keep physical data in compact secondary fighter text rather than permanent wide columns.
- [ ] Add OVR to Event Builder selectors/comparison/fight cards and show non-blocking severe-mismatch copy.
- [ ] Add OVR to tournament eligibility rows while preserving rank-first seed wording.
- [ ] Run `npx tsx test_ui_contracts.ts && npm run lint`; expect pass.

### Task 6: Full regression and runtime verification

**Files:**
- Modify only if a verified defect is found by these checks.

- [ ] Run focused tests: `npx tsx test_fighter_ratings.ts`, `test_management_depth.ts`, `test_insights.ts`, `test_balance.ts`, and `test_ui_contracts.ts`.
- [ ] Run invariant suites: `test_calendar.ts`, `test_tournament.ts`, and `test_long_sim.ts`.
- [ ] Run `npm run lint` and `npm run build`.
- [ ] Launch the Vite app and directly inspect a fresh-world Fighter Detail, Roster, Free Agents, Event Builder, and Tournaments on desktop and mobile widths.
- [ ] Confirm old-save import migration in the running app and verify no source fighter attributes are reduced.
- [ ] Stop the dev server and report exact results. Do not commit or push.
