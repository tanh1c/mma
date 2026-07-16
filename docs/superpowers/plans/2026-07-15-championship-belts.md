# Championship Belts Visual Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the twelve approved division-specific Undisputed and Interim belt PNGs into current champion and title-fight UI without changing championship gameplay or save data.

**Architecture:** Add one presentational `ChampionshipBelt` component with an exhaustive static asset resolver keyed by the existing `WeightClass` and `undisputed | interim`. Pages derive the belt type from existing title state or `titleFightType`; no image path enters game state or persistence.

**Tech Stack:** React 19, TypeScript, Vite static assets, Tailwind CSS, Node `assert` runnable contract tests.

## Global Constraints

- Use all twelve approved transparent PNGs, with six distinct division designs and separate Undisputed and Interim variants.
- Add no dependency, SVG recreation, image processing, dynamic recoloring, animation, or new screen.
- Do not modify championship engine behavior, title transitions, booking policy, game-state types, save schema, migration, or save version.
- Belt art supplements explicit title text; it never becomes the only status indicator.
- Preserve Manager/Observer behavior and all existing Event Builder interactions.
- At `390×844`, belt art must not crop its center plate or cause page-level horizontal overflow.
- Work directly on the currently dirty `main` branch as authorized by the user.
- Do not commit or push; the user explicitly requested inline working-tree changes only.

---

### Task 1: Add the exhaustive belt asset contract and shared component

**Files:**
- Create: `test_championship_belts.ts`
- Create: `src/components/ChampionshipBelt.tsx`
- Copy: `belt/*.png` to `public/belts/*.png`

**Interfaces:**
- Consumes: existing `WeightClass` and `getBeltBranding(weightClass)`.
- Produces: `BeltType`, `BeltSize`, `getChampionshipBeltSrc(weightClass, type)`, and `ChampionshipBelt`.

- [ ] **Step 1: Write the failing asset/resolver test**

Create `test_championship_belts.ts`:

```ts
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { getChampionshipBeltSrc } from './src/components/ChampionshipBelt';
import { WeightClass } from './src/types/game';

const weightClasses: WeightClass[] = ['Bantamweight', 'Featherweight', 'Lightweight', 'Welterweight', 'Middleweight', 'Heavyweight'];
for (const weightClass of weightClasses) {
  const undisputed = getChampionshipBeltSrc(weightClass, 'undisputed');
  const interim = getChampionshipBeltSrc(weightClass, 'interim');
  assert.notEqual(undisputed, interim);
  assert.ok(existsSync(`public${undisputed}`), `Missing ${undisputed}`);
  assert.ok(existsSync(`public${interim}`), `Missing ${interim}`);
}
assert.equal(new Set(weightClasses.map(weightClass => getChampionshipBeltSrc(weightClass, 'undisputed'))).size, 6);
const component = readFileSync('src/components/ChampionshipBelt.tsx', 'utf8');
for (const token of ['object-contain', "alt = ''", "size = 'card'"]) assert.ok(component.includes(token), `Missing component contract: ${token}`);
console.log('Championship belt contracts passed.');
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx tsx test_championship_belts.ts
```

Expected: FAIL because `src/components/ChampionshipBelt.tsx` does not exist.

- [ ] **Step 3: Copy the twelve approved assets with stable names**

Create `public/belts/` and copy, without transforming pixels:

```text
belt-bantamweight-crown-Photoroom.png             → bantamweight-undisputed.png
belt-bantamweight-crown-interim-Photoroom.png     → bantamweight-interim.png
belt-featherweight-throne-Photoroom.png           → featherweight-undisputed.png
belt-featherweight-throne-interim-Photoroom.png   → featherweight-interim.png
belt-lightweight-gold-Photoroom.png                → lightweight-undisputed.png
belt-lightweight-gold-interim-Photoroom.png        → lightweight-interim.png
belt-welterweight-scepter-Photoroom.png            → welterweight-undisputed.png
belt-welterweight-scepter-interim-Photoroom.png    → welterweight-interim.png
belt-middleweight-iron-crown-Photoroom.png         → middleweight-undisputed.png
belt-middleweight-iron-crown-interim-Photoroom.png → middleweight-interim.png
belt-heavyweight-world-crown-Photoroom.png         → heavyweight-undisputed.png
belt-heavyweight-world-crown-interim-Photoroom.png → heavyweight-interim.png
```

- [ ] **Step 4: Implement the minimum shared resolver/component**

Create `src/components/ChampionshipBelt.tsx`:

```tsx
import { getBeltBranding } from '../lib/branding';
import { WeightClass } from '../types/game';

export type BeltType = 'undisputed' | 'interim';
export type BeltSize = 'hero' | 'champion' | 'card' | 'marker';

const beltSources: Record<WeightClass, Record<BeltType, string>> = {
  Bantamweight: { undisputed: '/belts/bantamweight-undisputed.png', interim: '/belts/bantamweight-interim.png' },
  Featherweight: { undisputed: '/belts/featherweight-undisputed.png', interim: '/belts/featherweight-interim.png' },
  Lightweight: { undisputed: '/belts/lightweight-undisputed.png', interim: '/belts/lightweight-interim.png' },
  Welterweight: { undisputed: '/belts/welterweight-undisputed.png', interim: '/belts/welterweight-interim.png' },
  Middleweight: { undisputed: '/belts/middleweight-undisputed.png', interim: '/belts/middleweight-interim.png' },
  Heavyweight: { undisputed: '/belts/heavyweight-undisputed.png', interim: '/belts/heavyweight-interim.png' }
};

const sizeClasses: Record<BeltSize, string> = {
  hero: 'h-36 w-full max-w-[300px] sm:h-44',
  champion: 'h-32 w-full max-w-[240px] sm:h-40',
  card: 'h-20 w-28 sm:h-24 sm:w-32',
  marker: 'h-10 w-14 sm:h-12 sm:w-16'
};

export function getChampionshipBeltSrc(weightClass: WeightClass, type: BeltType): string {
  return beltSources[weightClass][type];
}

export function ChampionshipBelt({ weightClass, type, size = 'card', alt = '', className = '' }: {
  weightClass: WeightClass;
  type: BeltType;
  size?: BeltSize;
  alt?: string;
  className?: string;
}) {
  const label = getBeltBranding(weightClass).name;
  return <img src={getChampionshipBeltSrc(weightClass, type)} alt={alt || ''} title={alt ? `${label} ${type} championship belt` : undefined} className={`${sizeClasses[size]} shrink-0 object-contain ${className}`} />;
}
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```bash
npx tsx test_championship_belts.ts
```

Expected: `Championship belt contracts passed.`

---

### Task 2: Add belt art to current-title surfaces

**Files:**
- Modify: `test_ui_contracts.ts`
- Modify: `src/pages/Rankings.tsx`
- Modify: `src/pages/FighterDetail.tsx`
- Modify: `src/pages/Dashboard.tsx`

**Interfaces:**
- Consumes: `ChampionshipBelt`, `WeightClassTitleState.undisputedChampionId`, and `WeightClassTitleState.interimChampionId`.
- Produces: hero/current-champion visual treatment on Rankings, Fighter Detail, and Dashboard.

- [ ] **Step 1: Add failing UI source contracts**

Extend `test_ui_contracts.ts` with page source reads and assertions:

```ts
const rankings = readFileSync('src/pages/Rankings.tsx', 'utf8');
for (const source of [rankings, fighterDetail, dashboard]) assert.ok(source.includes('ChampionshipBelt'));
assert.ok(rankings.includes('size="hero"'));
assert.ok(rankings.includes("type=\"interim\""));
assert.ok(fighterDetail.includes("currentBeltType"));
assert.ok(fighterDetail.includes('size="champion"'));
assert.ok(dashboard.includes("isInterim ? 'interim' : 'undisputed'"));
```

- [ ] **Step 2: Run the UI test and verify RED**

Run:

```bash
npx tsx test_ui_contracts.ts
```

Expected: FAIL on the first missing `ChampionshipBelt` integration.

- [ ] **Step 3: Integrate Rankings**

- Import `ChampionshipBelt`.
- Make the title panel a wrapping/stacking layout.
- Render the selected division Undisputed belt with `size="hero"` and semantic alt text near the branded belt name.
- Pass `weightClass` and `type` into `ChampionCard`; render only the Interim card belt there to avoid duplicating the Undisputed hero.
- Keep `Vacant title`, defenses, title warnings, and champion navigation unchanged.

- [ ] **Step 4: Integrate Fighter Detail**

Derive exactly one current belt type:

```ts
const titleState = state.titles[f.weightClass];
const currentBeltType = titleState?.undisputedChampionId === f.id
  ? 'undisputed'
  : titleState?.interimChampionId === f.id
    ? 'interim'
    : null;
```

Render `size="champion"` inside the profile panel only when `currentBeltType` is non-null. Include visible `Undisputed Champion` or `Interim Champion` text and meaningful alt text. Keep the identity/stats layout stacked on mobile and side-by-side where space permits.

- [ ] **Step 5: Integrate Dashboard Current Champions**

- Import `ChampionshipBelt`.
- Change each champion card to a `flex min-w-0` layout.
- Render `size="card"`, decorative `alt=""`, and `type={isInterim ? 'interim' : 'undisputed'}`.
- Keep division/belt name, Interim text, record, and click navigation.

- [ ] **Step 6: Run focused contracts and verify GREEN**

Run:

```bash
npx tsx test_championship_belts.ts
npx tsx test_ui_contracts.ts
```

Expected: both pass.

---

### Task 3: Add compact title-fight markers

**Files:**
- Modify: `test_ui_contracts.ts`
- Modify: `src/pages/EventBuilder.tsx`
- Modify: `src/pages/EventSimulation.tsx`

**Interfaces:**
- Consumes: `ChampionshipBelt` and existing `FightMatchup.titleFightType`.
- Produces: compact belt visuals while preserving explicit title labels in booking, pre-fight, result, and title-summary contexts.

- [ ] **Step 1: Add failing marker contracts**

Extend `test_ui_contracts.ts`:

```ts
const eventSimulation = readFileSync('src/pages/EventSimulation.tsx', 'utf8');
for (const source of [eventBuilder, eventSimulation]) {
  assert.ok(source.includes('ChampionshipBelt'));
  assert.ok(source.includes("titleFightType === 'interim' ? 'interim' : 'undisputed'"));
  assert.ok(source.includes('size="marker"'));
}
```

- [ ] **Step 2: Run the UI test and verify RED**

Run:

```bash
npx tsx test_ui_contracts.ts
```

Expected: FAIL because title-fight pages do not yet render `ChampionshipBelt`.

- [ ] **Step 3: Integrate Event Builder**

- Import `ChampionshipBelt`.
- In each booked fight row, render a decorative marker only when `fight.isTitleFight`.
- Select Interim only for `titleFightType === 'interim'`; use Undisputed for undisputed, vacant, and unification.
- Retain visible `INTERIM`, `UNIFICATION`, belt short name, rounds, GP title-shot, tournament round, camp selector, move controls, and remove control.
- Let metadata wrap so the marker cannot create mobile overflow.

- [ ] **Step 4: Integrate Event Simulation**

- Import `ChampionshipBelt`.
- Add a decorative marker to title fights on the pre-simulation card while preserving the `· Title` label.
- Add the same marker to completed result metadata while preserving method, round, and title text.
- Add marker-scale art to title-change summary rows using `change.weightClass`; use Interim only for `interim_won` and `interim_defense`, otherwise Undisputed.
- Preserve every current title-change message and null-fighter guard.

- [ ] **Step 5: Run focused contracts and verify GREEN**

Run:

```bash
npx tsx test_championship_belts.ts
npx tsx test_ui_contracts.ts
```

Expected: both pass.

---

### Task 4: Verify build and real UI surfaces

**Files:**
- Modify only if a verified belt-specific defect requires a minimal test-first correction.

**Interfaces:**
- Consumes: completed Tasks 1–3.
- Produces: runtime evidence that static assets load and responsive title UI remains usable.

- [ ] **Step 1: Run existing focused regressions**

Run:

```bash
npx tsx test_championship_belts.ts
npx tsx test_ui_contracts.ts
npx tsx test_navigation.ts
```

Expected: all pass.

- [ ] **Step 2: Run project quality gates**

Run:

```bash
npm run lint
npm run build
```

Expected: zero lint errors and a successful Vite production build.

- [ ] **Step 3: Launch the actual Vite app on port 3000**

Use the existing project launch path and keep it isolated from unrelated processes. Confirm the HTTP surface responds before driving it.

- [ ] **Step 4: Drive desktop current-title surfaces**

At desktop width:

- Open Rankings and cycle all six divisions.
- Confirm each Undisputed image is distinct and loads without `404`.
- Open a current champion Fighter Detail.
- Inspect Dashboard Current Champions.
- Confirm belt art does not replace title labels or navigation.

- [ ] **Step 5: Drive title-fight surfaces**

- Open an Event Builder card containing a title fight.
- Confirm the correct marker and existing title type text.
- Open Event Simulation before and after completion where current safe state permits.
- Confirm result and title-summary markers preserve all textual result information.

- [ ] **Step 6: Drive the primary surfaces at `390×844`**

Confirm:

- no page-level horizontal overflow;
- no cropped center plate;
- Rankings and Fighter Detail stack cleanly;
- Dashboard champion text remains visible;
- Event Builder and Event Simulation metadata wraps without unusable controls.

- [ ] **Step 7: Report working-tree results without commit or push**

Report exact tests/build/runtime observations and any path not exercised. Leave all existing unrelated dirty changes untouched.
