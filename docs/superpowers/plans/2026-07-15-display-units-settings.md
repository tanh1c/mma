# Display Units Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a browser-persisted Metric/US display preference, a Settings page, and consistent height/weight formatting across Fighter Detail and Roster.

**Architecture:** Keep canonical fighter measurements unchanged and convert only at render time through pure formatters. A minimal Zustand settings store reads and writes a single localStorage preference independently of game saves; UI pages subscribe directly to it.

**Tech Stack:** TypeScript 5.8, React 19, Zustand 5, Tailwind CSS 4, Vite 6, Node assert-based checks.

## Global Constraints

- Default unit system is Metric (`cm`/`kg`).
- Preference is browser-wide and must not alter GameState, save migration, import/export, new-game behavior, or simulation logic.
- Metric weight uses `lb * 0.45359237` and one decimal place; US height uses rounded total inches.
- Invalid or unavailable localStorage must fall back safely without crashing.
- No new dependency, unrelated refactor, commit, or push.

---

### Task 1: Pure measurement formatting and preference persistence

**Files:**
- Create: `src/lib/displayUnits.ts`
- Create: `test_display_units.ts`

**Interfaces:**
- Produces: `type UnitSystem = 'metric' | 'us'`
- Produces: `formatHeight(heightCm: number, unitSystem: UnitSystem): string`
- Produces: `formatWeight(weightLb: number, unitSystem: UnitSystem): string`
- Produces: `readUnitSystem(storage?: Pick<Storage, 'getItem'>): UnitSystem`
- Produces: `writeUnitSystem(unitSystem: UnitSystem, storage?: Pick<Storage, 'setItem'>): void`

- [ ] **Step 1: Write the failing check**

Create `test_display_units.ts` with deterministic assertions:

```ts
import assert from 'node:assert/strict';
import { formatHeight, formatWeight, readUnitSystem, writeUnitSystem } from './src/lib/displayUnits';

assert.equal(formatHeight(180, 'metric'), '180 cm');
assert.equal(formatHeight(180, 'us'), `5' 11"`);
assert.equal(formatHeight(182.88, 'us'), `6' 0"`);
assert.equal(formatWeight(155, 'metric'), '70.3 kg');
assert.equal(formatWeight(155, 'us'), '155 lb');
assert.equal(readUnitSystem(undefined), 'metric');
assert.equal(readUnitSystem({ getItem: () => 'us' }), 'us');
assert.equal(readUnitSystem({ getItem: () => 'broken' }), 'metric');
assert.equal(readUnitSystem({ getItem: () => { throw new Error('blocked'); } }), 'metric');
let stored = '';
writeUnitSystem('us', { setItem: (_key, value) => { stored = value; } });
assert.equal(stored, 'us');
assert.doesNotThrow(() => writeUnitSystem('metric', { setItem: () => { throw new Error('blocked'); } }));
console.log('Display units checks passed.');
```

- [ ] **Step 2: Run the check and confirm RED**

Run: `npx tsx test_display_units.ts`

Expected: FAIL because `src/lib/displayUnits.ts` does not exist.

- [ ] **Step 3: Implement the minimum pure module**

Create `src/lib/displayUnits.ts`:

```ts
export type UnitSystem = 'metric' | 'us';

const UNIT_SYSTEM_KEY = 'cage-dynasty-unit-system';
const browserStorage = () => typeof localStorage === 'undefined' ? undefined : localStorage;

export function formatHeight(heightCm: number, unitSystem: UnitSystem): string {
  if (unitSystem === 'metric') return `${Math.round(heightCm)} cm`;
  const inches = Math.round(heightCm / 2.54);
  return `${Math.floor(inches / 12)}' ${inches % 12}"`;
}

export function formatWeight(weightLb: number, unitSystem: UnitSystem): string {
  return unitSystem === 'metric' ? `${(weightLb * 0.45359237).toFixed(1)} kg` : `${Math.round(weightLb)} lb`;
}

export function readUnitSystem(storage: Pick<Storage, 'getItem'> | undefined = browserStorage()): UnitSystem {
  try {
    return storage?.getItem(UNIT_SYSTEM_KEY) === 'us' ? 'us' : 'metric';
  } catch {
    return 'metric';
  }
}

export function writeUnitSystem(unitSystem: UnitSystem, storage: Pick<Storage, 'setItem'> | undefined = browserStorage()): void {
  try {
    storage?.setItem(UNIT_SYSTEM_KEY, unitSystem);
  } catch {
    // The in-memory setting remains usable when browser storage is blocked.
  }
}
```

- [ ] **Step 4: Run the check and confirm GREEN**

Run: `npx tsx test_display_units.ts`

Expected: `Display units checks passed.`

---

### Task 2: Reactive settings store and accessible Settings page

**Files:**
- Create: `src/store/settingsStore.ts`
- Create: `src/pages/Settings.tsx`
- Modify: `src/store/gameStore.ts:24`
- Modify: `src/components/AppShell.tsx:2-51`
- Modify: `src/App.tsx:10-74`
- Modify: `test_ui_contracts.ts:24-50`

**Interfaces:**
- Consumes: `UnitSystem`, `readUnitSystem`, `writeUnitSystem` from Task 1.
- Produces: `useSettingsStore()` with `{ unitSystem: UnitSystem; setUnitSystem(unitSystem: UnitSystem): void }`.
- Produces: `GameView` member `'settings'` and route/page navigation.

- [ ] **Step 1: Extend the UI contract first**

Update `test_ui_contracts.ts` to require:

```ts
assert.ok(labels.includes('Settings'), 'Missing navigation item: Settings');
assert.ok(shell.includes("view: 'settings'"));
assert.ok(app.includes("case 'settings'"));
const settings = readFileSync('src/pages/Settings.tsx', 'utf8');
for (const token of ['Metric', 'US / Imperial', 'type="radio"', 'setUnitSystem']) assert.ok(settings.includes(token), `Settings missing ${token}`);
```

- [ ] **Step 2: Run the UI contract and confirm RED**

Run: `npx tsx test_ui_contracts.ts`

Expected: FAIL with `Missing navigation item: Settings`.

- [ ] **Step 3: Add the settings store**

Create `src/store/settingsStore.ts`:

```ts
import { create } from 'zustand';
import { readUnitSystem, writeUnitSystem, type UnitSystem } from '../lib/displayUnits';

type SettingsStore = {
  unitSystem: UnitSystem;
  setUnitSystem: (unitSystem: UnitSystem) => void;
};

export const useSettingsStore = create<SettingsStore>(set => ({
  unitSystem: readUnitSystem(),
  setUnitSystem: unitSystem => {
    writeUnitSystem(unitSystem);
    set({ unitSystem });
  }
}));
```

- [ ] **Step 4: Add the Settings page**

Create `src/pages/Settings.tsx` using existing `PageHeader` and `Panel`. Render one fieldset with legend `Units` and two labeled native radios. Each radio is checked from `unitSystem`, calls `setUnitSystem` on change, and sits in a responsive `grid gap-3 sm:grid-cols-2`; each label has visible focus-within styling and supporting copy (`Centimetres and kilograms` / `Feet, inches, and pounds`).

- [ ] **Step 5: Wire navigation and rendering**

- Add `'settings'` to `GameView` in `src/store/gameStore.ts`.
- Lazy-load `src/pages/Settings.tsx` in `src/App.tsx` and add `case 'settings': return <SettingsPage />;`.
- Add `{ label: 'Settings', view: 'settings', icon: Settings }` to Records in `APP_NAV_GROUPS`.
- Replace Debug Sim's gear with an existing diagnostic icon (`Bug`) from `lucide-react` so icons remain semantically distinct.

- [ ] **Step 6: Run the UI contract and confirm GREEN**

Run: `npx tsx test_ui_contracts.ts`

Expected: `UI visual contracts passed.`

---

### Task 3: Apply the unit preference to fighter UI

**Files:**
- Modify: `src/pages/FighterDetail.tsx:1-147`
- Modify: `src/pages/Roster.tsx:1-232`
- Modify: `test_ui_contracts.ts:40-50`

**Interfaces:**
- Consumes: `useSettingsStore`, `formatHeight`, and `formatWeight`.
- Produces: reactive measurement output in Fighter Detail and Roster.

- [ ] **Step 1: Strengthen the UI contract first**

Add assertions that both page source files import/use shared formatters and no longer interpolate canonical units directly:

```ts
for (const source of [fighterDetail, roster]) {
  assert.ok(source.includes('useSettingsStore'));
  assert.ok(source.includes('formatHeight'));
  assert.ok(source.includes('formatWeight'));
}
assert.ok(!fighterDetail.includes('`${f.heightCm} cm`'));
assert.ok(!fighterDetail.includes('`${f.fightWeightLb} lb`'));
assert.ok(!roster.includes('{f.heightCm} cm'));
```

- [ ] **Step 2: Run the contract and confirm RED**

Run: `npx tsx test_ui_contracts.ts`

Expected: FAIL because the pages do not use `useSettingsStore`.

- [ ] **Step 3: Integrate Fighter Detail minimally**

Import the settings hook and formatters, select `unitSystem`, and replace the three hard-coded values with:

```tsx
<CareerStat label="Height" value={formatHeight(f.heightCm, unitSystem)} />
<CareerStat label="Fight Weight" value={formatWeight(f.fightWeightLb, unitSystem)} />
<CareerStat label="Walk-around Weight" value={formatWeight(f.walkAroundWeightLb, unitSystem)} />
```

- [ ] **Step 4: Integrate Roster minimally**

Import the same hook and formatters, select `unitSystem`, and replace the physical summary with:

```tsx
<div className="text-[10px] text-neutral-500">
  {formatHeight(f.heightCm, unitSystem)} · {formatWeight(f.fightWeightLb, unitSystem)}/{formatWeight(f.walkAroundWeightLb, unitSystem)}
</div>
```

- [ ] **Step 5: Run deterministic checks**

Run:

```bash
npx tsx test_display_units.ts
npx tsx test_ui_contracts.ts
npm run lint
npm run build
```

Expected: both checks print success, TypeScript exits 0, and Vite build completes.

---

### Task 4: Verify the running application on port 3000

**Files:**
- No source changes expected.

**Interfaces:**
- Consumes the complete UI feature through the running Vite app.
- Produces runtime evidence for desktop and mobile behavior.

- [ ] **Step 1: Reuse the existing server**

Open `http://127.0.0.1:3000`. Do not start another Vite process or bind another port.

- [ ] **Step 2: Verify desktop Metric behavior**

At a desktop viewport, open Settings and confirm Metric is initially selected. Open Roster and one Fighter Detail page; capture that height uses `cm` and both weights use `kg` with one decimal place.

- [ ] **Step 3: Verify immediate US behavior and persistence**

Switch to US / Imperial, revisit Roster and Fighter Detail, and confirm height uses feet/inches and weights use `lb`. Refresh the browser and confirm US / Imperial remains selected and fighter output remains converted.

- [ ] **Step 4: Probe mobile behavior**

At a mobile viewport, open the navigation drawer, reach Settings, switch back to Metric using the radio control, and confirm the options stack without horizontal overflow. Return to Roster/Fighter Detail and confirm `cm`/`kg` output.

- [ ] **Step 5: Report without committing**

Run `git status --short`, report changed/created files and exact runtime observations. Do not commit or push.
