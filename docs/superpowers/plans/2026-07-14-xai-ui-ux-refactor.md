# xAI UI/UX Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor every Cage Dynasty screen into the restrained, dark, engineered interface defined by `C:\Users\LG\Downloads\DESIGN-x.ai.md`, without changing game behavior.

**Architecture:** Add a presentation-only UI layer containing design tokens, shared primitives, and a responsive app shell. Migrate pages in behavior-risk order while leaving Zustand actions, game-engine calls, form state, validation, save data, history checkpoints, avatars, and flags intact.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, Zustand, lucide-react, existing `CountryFlag`, `FighterAvatar`, and `Select` components.

---

## File map

### Create
- `src/components/AppShell.tsx` — desktop navigation rail, mobile drawer, context bar, utilities, and only the shell layout.
- `src/components/ui.tsx` — presentation-only `Button`, `PageHeader`, `Panel`, `DataSurface`, `StatusBadge`, `Stat`, plus exported class helpers used by the regression test.
- `test_ui_contracts.ts` — no-framework contract checks for the shared visual system and preserved file import/export wiring.

### Modify
- `src/index.css` — xAI-inspired colors, typography, focus treatment, scrollbar, and document defaults.
- `src/App.tsx` — retain all navigation/save/import callbacks and lazy view mapping; delegate chrome to `AppShell`.
- `src/components/Select.tsx` — retain controlled props and option logic; apply shared surface/focus/touch-target treatment.
- `src/pages/Dashboard.tsx`, `Roster.tsx`, `FreeAgents.tsx`, `Rankings.tsx`, `Calendar.tsx`, `HistoryStats.tsx`, `News.tsx`, `FighterDetail.tsx`, `EventBuilder.tsx`, `Tournaments.tsx`, `EventSimulation.tsx`, `FightBattle.tsx`, `FightDetail.tsx`, `MmaGuide.tsx`, `DebugSim.tsx` — replace only repeated visual chrome with shared primitives and design tokens.

### Do not modify
- `src/store/gameStore.ts`
- `src/lib/**`
- `src/types/**`
- save versioning/migrations
- booking/tournament/simulation rules

## Visual contract

- Canvas: `#0a0a0a`; elevated surface: `#101114`; inset surface: `#15171b`; hairline: `#2a2c31`.
- Display text uses normal weight, tight tracking; labels use mono uppercase with expanded tracking.
- Interactive controls are 44px minimum height, rounded full, outlined by default, with a `focus-visible` ring.
- A white filled primary action is allowed once per local context. Semantic status/corner colors remain text/border accents, not large colored panels.
- Do not introduce gradients, box shadows, new UI packages, routes, theme switching, or persisted layout state.
- Preserve `CountryFlag` and `FighterAvatar` wherever they currently appear; migrate their containers only.

### Task 1: Establish visual tokens and regression contract

**Files:**
- Create: `test_ui_contracts.ts`
- Create: `src/components/ui.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Write the failing contract test**

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buttonVariantClasses,
  dataSurfaceClasses,
  statusToneClasses
} from './src/components/ui';

assert.match(buttonVariantClasses('primary'), /rounded-full/);
assert.match(buttonVariantClasses('primary'), /min-h-11/);
assert.match(buttonVariantClasses('primary'), /focus-visible/);
assert.match(buttonVariantClasses('secondary'), /border/);
assert.doesNotMatch(buttonVariantClasses('secondary'), /shadow/);
assert.match(buttonVariantClasses('danger'), /red/);
assert.match(dataSurfaceClasses, /border/);
assert.doesNotMatch(dataSurfaceClasses, /shadow/);
for (const tone of ['neutral', 'success', 'warning', 'danger'] as const) {
  assert.ok(statusToneClasses(tone));
}

const css = readFileSync('src/index.css', 'utf8');
assert.match(css, /#0a0a0a/);
assert.match(css, /:focus-visible/);
console.log('UI visual contracts passed.');
```

- [ ] **Step 2: Run the test and confirm the expected missing-module failure**

Run: `npx tsx test_ui_contracts.ts`

Expected: `ERR_MODULE_NOT_FOUND` for `src/components/ui`.

- [ ] **Step 3: Add the minimum shared primitives**

Create `src/components/ui.tsx` with this public API. Keep it presentation-only and avoid a generic `className` merging framework unless a component needs it.

```tsx
import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'quiet';
export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger';

export const buttonVariantClasses = (variant: ButtonVariant) => ({
  primary: 'min-h-11 rounded-full bg-white px-4 text-sm text-black transition-colors hover:bg-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40',
  secondary: 'min-h-11 rounded-full border border-[#2a2c31] px-4 text-sm text-white transition-colors hover:border-neutral-500 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40',
  danger: 'min-h-11 rounded-full border border-red-900 px-4 text-sm text-red-300 transition-colors hover:border-red-500 hover:bg-red-950/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300 disabled:cursor-not-allowed disabled:opacity-40',
  quiet: 'min-h-11 rounded-full px-3 text-sm text-neutral-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40'
}[variant]);

export const dataSurfaceClasses = 'overflow-hidden rounded-lg border border-[#2a2c31] bg-[#101114]';

export const statusToneClasses = (tone: StatusTone) => ({
  neutral: 'border-[#2a2c31] text-neutral-300',
  success: 'border-emerald-900 text-emerald-300',
  warning: 'border-amber-900 text-amber-300',
  danger: 'border-red-900 text-red-300'
}[tone]);

export function Button({ variant = 'secondary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={`${buttonVariantClasses(variant)} ${className}`} {...props} />;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return <header className="flex flex-col gap-4 border-b border-[#2a2c31] pb-6 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0"><p className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">{eyebrow}</p><h1 className="mt-2 text-3xl font-normal tracking-[-0.04em] text-white sm:text-4xl">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm text-neutral-400">{description}</p>}</div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </header>;
}

export function Panel({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <section className={`rounded-lg border border-[#2a2c31] bg-[#101114] p-4 sm:p-6 ${className}`}>{children}</section>;
}

export function DataSurface({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <div className={`${dataSurfaceClasses} ${className}`}>{children}</div>;
}

export function StatusBadge({ children, tone = 'neutral' }: PropsWithChildren<{ tone?: StatusTone }>) {
  return <span className={`inline-flex rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${statusToneClasses(tone)}`}>{children}</span>;
}

export function Stat({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return <div className="border-l border-[#2a2c31] pl-3"><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">{label}</p><p className="mt-1 text-xl font-normal tracking-[-0.03em] text-white">{value}</p>{detail && <p className="mt-1 text-xs text-neutral-500">{detail}</p>}</div>;
}
```

- [ ] **Step 4: Replace global styling with the token layer**

Update `src/index.css` so it retains `@import "tailwindcss"` and adds:

```css
:root { color: #f5f5f5; background: #0a0a0a; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; min-height: 100svh; background: #0a0a0a; color: #f5f5f5; }
button, input, select, textarea { font: inherit; }
:focus-visible { outline: 2px solid #f5f5f5; outline-offset: 3px; }
.custom-scrollbar { scrollbar-color: #3f4147 #0a0a0a; scrollbar-width: thin; }
.custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #3f4147; border-radius: 999px; }
.custom-scrollbar::-webkit-scrollbar-track { background: #0a0a0a; }
```

- [ ] **Step 5: Run the contract test and type check**

Run: `npx tsx test_ui_contracts.ts && npm run lint`

Expected: `UI visual contracts passed.` and TypeScript exits 0.

- [ ] **Step 6: Inspect the focused diff**

Run: `git diff -- src/index.css src/components/ui.tsx test_ui_contracts.ts`

Expected: only presentation tokens, shared primitives, and their regression contract changed. Create a commit only if the user explicitly requests one.

### Task 2: Replace the application chrome with a responsive shell

**Files:**
- Create: `src/components/AppShell.tsx`
- Modify: `src/App.tsx`
- Modify: `test_ui_contracts.ts`

- [ ] **Step 1: Extend the regression test with shell contracts**

Add after the existing assertions:

```ts
import { APP_NAV_GROUPS } from './src/components/AppShell';

const labels = APP_NAV_GROUPS.flatMap(group => group.items.map(item => item.label));
for (const label of ['Dashboard', 'Roster', 'Calendar', 'Book Event', 'Rankings', 'Tournaments', 'Free Agents', 'News', 'History & Stats', 'Debug Sim']) {
  assert.ok(labels.includes(label), `Missing navigation item: ${label}`);
}
for (const label of ['Save', 'Load', 'Export', 'Import']) assert.ok(!labels.includes(label));
const app = readFileSync('src/App.tsx', 'utf8');
for (const token of ['accept=".json"', 'reader.readAsText(file)', 'saveGame', 'loadGame', 'exportGame', 'importGame']) assert.ok(app.includes(token));
```

- [ ] **Step 2: Run the check and confirm the expected import failure**

Run: `npx tsx test_ui_contracts.ts`

Expected: module export failure for `APP_NAV_GROUPS`.

- [ ] **Step 3: Implement `AppShell` without store coupling**

Create `src/components/AppShell.tsx`. Export `APP_NAV_GROUPS` with the exact labels above and `view` values already used by `GameView`. Its props must receive `currentView`, `onNavigate`, `title`, `date`, `money`, `reputation`, `onAdvanceWeek`, `isAdvancing`, and a `utilities` React node. Use local `useState(false)` only for the mobile drawer.

Required layout:

```tsx
<div className="flex min-h-svh bg-[#0a0a0a] text-white">
  <aside className="hidden w-60 shrink-0 border-r border-[#2a2c31] bg-[#0d0e10] md:flex md:flex-col">...</aside>
  {isOpen && <div className="fixed inset-0 z-40 bg-black/70 md:hidden" onClick={() => setIsOpen(false)} />}
  <aside className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-[#2a2c31] bg-[#0d0e10] p-3 transition-transform md:hidden ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>...</aside>
  <div className="min-w-0 flex-1"><header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-[#2a2c31] bg-[#0a0a0a]/95 px-4 backdrop-blur md:px-6">...</header><main className="h-[calc(100svh-4rem)] overflow-y-auto custom-scrollbar"><div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">{children}</div></main></div>
</div>
```

Each nav item must be a native button with `min-h-11`, an icon already available from `lucide-react`, an active left/bottom white indicator, and `onClick={() => { onNavigate(item.view); setIsOpen(false); }}`. Render utility controls outside `APP_NAV_GROUPS` at rail bottom and mobile drawer bottom.

- [ ] **Step 4: Refactor `App.tsx` to pass existing behavior into the shell**

Keep `useGameStore`, all lazy page imports, `renderView`, file input, `handleImport`, confirmation prompts, and every existing action callback. Delete only the old wrapper/sidebar/topbar JSX and wrap the existing rendered view as:

```tsx
<AppShell
  currentView={currentView}
  onNavigate={view => setView(view)}
  title={promotion.name}
  date={currentDate}
  money={promotion.money}
  reputation={promotion.reputation}
  onAdvanceWeek={() => advanceDays(7)}
  isAdvancing={isAdvancing}
  utilities={<>{/* Move the existing New Game, Save, Load, Export, Import controls here unchanged. */}</>}
>
  {renderView()}
</AppShell>
```

Do not change `handleImport` or omit the hidden `input accept=".json"`.

- [ ] **Step 5: Run regression checks**

Run: `npx tsx test_ui_contracts.ts && npx tsx test_navigation.ts && npm run lint`

Expected: all pass.

- [ ] **Step 6: Inspect the focused diff**

Run: `git diff -- src/App.tsx src/components/AppShell.tsx test_ui_contracts.ts`

Expected: layout and navigation presentation changed; all existing save/import/navigation handlers remain present. Create a commit only if the user explicitly requests one.

### Task 3: Align the existing Select and page-action controls

**Files:**
- Modify: `src/components/Select.tsx`
- Modify: `src/pages/Calendar.tsx`
- Modify: `src/pages/News.tsx`
- Modify: `src/pages/MmaGuide.tsx`
- Modify: `src/pages/DebugSim.tsx`

- [ ] **Step 1: Add a failing static assertion for accessible Select styling**

Append to `test_ui_contracts.ts`:

```ts
const select = readFileSync('src/components/Select.tsx', 'utf8');
for (const token of ['aria-expanded', 'aria-haspopup="listbox"', 'min-h-11', 'focus-visible']) assert.ok(select.includes(token));
```

- [ ] **Step 2: Confirm it fails if a required token is absent**

Run: `npx tsx test_ui_contracts.ts`

Expected: assertion failure naming the absent Select token.

- [ ] **Step 3: Restyle `Select` without changing its props or selection behavior**

Keep its existing controlled value, option, outside-click, keyboard, and `onChange` implementation. Update trigger/menu classes to use `min-h-11 rounded-lg border border-[#2a2c31] bg-[#101114]`, mono uppercase metadata where applicable, `focus-visible`, and listbox semantics. Set `aria-haspopup="listbox"` on the trigger and keep `aria-expanded={isOpen}`.

- [ ] **Step 4: Apply low-risk shared composition to static/utility pages**

For Calendar, News, MMA Guide, and DebugSim:
- replace outer `max-w-*` wrapper/header chrome with `PageHeader`;
- replace repeated neutral card strings with `Panel` or `DataSurface`;
- replace page-level buttons with `Button` variants;
- preserve every data transform, table/filter, handler, confirmation, debug trigger, tooltip, and `setView` call verbatim;
- preserve Calendar GP and title-shot contextual help.

- [ ] **Step 5: Run checks**

Run: `npx tsx test_ui_contracts.ts && npx tsx test_mma_guide.ts && npm run lint`

Expected: all pass.

- [ ] **Step 6: Inspect the focused diff**

Run: `git diff -- src/components/Select.tsx src/pages/Calendar.tsx src/pages/News.tsx src/pages/MmaGuide.tsx src/pages/DebugSim.tsx test_ui_contracts.ts`

Expected: only visual composition and accessibility attributes changed. Create a commit only if the user explicitly requests one.

### Task 4: Refactor list, ranking, and archive data surfaces

**Files:**
- Modify: `src/pages/Roster.tsx`
- Modify: `src/pages/FreeAgents.tsx`
- Modify: `src/pages/Rankings.tsx`
- Modify: `src/pages/HistoryStats.tsx`

- [ ] **Step 1: Add a source-level regression guard for required identity components**

Append to `test_ui_contracts.ts`:

```ts
for (const path of ['src/pages/Roster.tsx', 'src/pages/FreeAgents.tsx', 'src/pages/Rankings.tsx']) {
  const source = readFileSync(path, 'utf8');
  assert.ok(source.includes('FighterAvatar'), `${path} lost fighter avatars`);
  assert.ok(source.includes('CountryFlag'), `${path} lost country flags`);
}
```

- [ ] **Step 2: Run and confirm it passes before style-only changes**

Run: `npx tsx test_ui_contracts.ts`

Expected: pass; this proves the test guards existing identity cues.

- [ ] **Step 3: Migrate Roster and Free Agents**

Use `PageHeader` with filters/actions in its `actions` prop, `DataSurface` for the overflow table, `StatusBadge` for contract/injury/rank/champion states, and `Button` for row actions. Keep `FighterAvatar`, `CountryFlag`, current table columns, sort/filter state, fighter detail navigation, sign/release calls, disabled conditions, and horizontal scroll containers.

- [ ] **Step 4: Migrate Rankings and History/Stats**

Use `Panel` for division/champion summaries and `DataSurface` for ranking/history tables. Preserve champion/interim/unification/pending-defense text and native title tooltips, all archive filters, `setView('fighter-detail')`, `setView('fight-detail')`, and existing mobile horizontal scrolling.

- [ ] **Step 5: Verify data navigation and static contracts**

Run: `npx tsx test_ui_contracts.ts && npx tsx test_navigation.ts && npm run lint`

Expected: all pass.

- [ ] **Step 6: Inspect the focused diff**

Run: `git diff -- src/pages/Roster.tsx src/pages/FreeAgents.tsx src/pages/Rankings.tsx src/pages/HistoryStats.tsx test_ui_contracts.ts`

Expected: tables retain every data column, filter, and detail navigation. Create a commit only if the user explicitly requests one.

### Task 5: Refactor dashboard and fighter identity view

**Files:**
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/pages/FighterDetail.tsx`

- [ ] **Step 1: Add a regression guard for preserved Dashboard collapse semantics**

Append to `test_ui_contracts.ts`:

```ts
const dashboard = readFileSync('src/pages/Dashboard.tsx', 'utf8');
for (const token of ['isFinanceOpen', 'isNewsOpen', 'aria-expanded']) assert.ok(dashboard.includes(token));
const fighterDetail = readFileSync('src/pages/FighterDetail.tsx', 'utf8');
for (const token of ['FighterAvatar', 'CountryFlag', 'goBack']) assert.ok(fighterDetail.includes(token));
```

- [ ] **Step 2: Run the guard before restyling**

Run: `npx tsx test_ui_contracts.ts`

Expected: pass.

- [ ] **Step 3: Recompose Dashboard hierarchy**

Use `PageHeader` for the promotion context. Keep Action Items and Next Event as the first content blocks, render their principal action with `Button variant="primary"`, use `Stat` for money/reputation/event metrics, use `Panel` for Champions/Finance/News, and retain current collapse state and `aria-expanded`. Do not change alert priority calculation, action handlers, event selection, or finance/news content.

- [ ] **Step 4: Recompose Fighter Detail**

Keep the avatar/flag identity header. Use `PageHeader` with the existing Back action, `Panel` for contract/profile/history sections, `Stat` for record/physical/market values, and `StatusBadge` for champion/injury/title-shot status. Preserve signing, renewal, release, history selection, all `setView` calls, and `goBack(fallback)` behavior.

- [ ] **Step 5: Verify UX behavior checks**

Run: `npx tsx test_ui_contracts.ts && npx tsx test_ux_guidance.ts && npx tsx test_navigation.ts && npm run lint`

Expected: all pass.

- [ ] **Step 6: Inspect the focused diff**

Run: `git diff -- src/pages/Dashboard.tsx src/pages/FighterDetail.tsx test_ui_contracts.ts`

Expected: Dashboard collapse state and Fighter Detail identity/back navigation remain intact. Create a commit only if the user explicitly requests one.

### Task 6: Refactor event booking and tournament workflows

**Files:**
- Modify: `src/pages/EventBuilder.tsx`
- Modify: `src/pages/Tournaments.tsx`

- [ ] **Step 1: Add source-contract checks for booking and GP safeguards**

Append to `test_ui_contracts.ts`:

```ts
const eventBuilder = readFileSync('src/pages/EventBuilder.tsx', 'utf8');
for (const token of ['getEventName', 'goBack', 'FighterAvatar', 'CountryFlag']) assert.ok(eventBuilder.includes(token));
const tournaments = readFileSync('src/pages/Tournaments.tsx', 'utf8');
for (const token of ['getTournamentBranding', 'FighterAvatar', 'CountryFlag', 'Promise Undisputed Title Shot']) assert.ok(tournaments.includes(token));
```

- [ ] **Step 2: Run the checks before style work**

Run: `npx tsx test_ui_contracts.ts`

Expected: pass.

- [ ] **Step 3: Recompose Event Builder without changing form rules**

Use a `PageHeader` with Back/save actions; group basic event details, card construction, booking warnings, projections, and confirmation controls into separate `Panel`s. Use `DataSurface` for the fight card. Keep event name generation, slot binding, title/GP labels and tooltips, disabled controls, fighter availability restrictions, projection calculation, confirmation dialog, update booking behavior, and `{ replace: true }` completion navigation exactly as-is.

- [ ] **Step 4: Recompose Tournaments without changing bracket rules**

Use panels for the create form, participant selection, schedule controls, GP status/delay notices, and bracket; use `DataSurface` for the bracket/participants. Preserve format limits, reserves, title-shot toggle and tooltip, calendar scheduling, cancel/confirm prompts, winner progress, all tournament action calls, and current `FighterAvatar`/`CountryFlag` markers.

- [ ] **Step 5: Run workflow regressions**

Run: `npx tsx test_ui_contracts.ts && npx tsx test_branding.ts && npx tsx test_long_sim.ts && npm run lint`

Expected: all pass, with every long-simulation invariant count at zero.

- [ ] **Step 6: Inspect the focused diff**

Run: `git diff -- src/pages/EventBuilder.tsx src/pages/Tournaments.tsx test_ui_contracts.ts`

Expected: event/GP naming, slot binding, validation, controls, and title-shot messaging remain intact. Create a commit only if the user explicitly requests one.

### Task 7: Refactor live fight, event results, and archive detail screens

**Files:**
- Modify: `src/pages/EventSimulation.tsx`
- Modify: `src/pages/FightBattle.tsx`
- Modify: `src/pages/FightDetail.tsx`

- [ ] **Step 1: Add source-contract checks for simulation and back navigation**

Append to `test_ui_contracts.ts`:

```ts
for (const [path, tokens] of Object.entries({
  'src/pages/EventSimulation.tsx': ['FightBattle', 'goBack', 'FighterAvatar', 'CountryFlag'],
  'src/pages/FightBattle.tsx': ['FighterAvatar', 'CountryFlag'],
  'src/pages/FightDetail.tsx': ['goBack']
})) {
  const source = readFileSync(path, 'utf8');
  for (const token of tokens) assert.ok(source.includes(token), `${path} lost ${token}`);
}
```

- [ ] **Step 2: Run the regression test before presentation changes**

Run: `npx tsx test_ui_contracts.ts`

Expected: pass.

- [ ] **Step 3: Recompose Event Simulation and Fight Battle**

Use `PageHeader`, `Panel`, `DataSurface`, and `Stat` for card/results/profit data. Preserve the current red/blue corner color distinction, fighter avatar/flag components, start/resume behavior, active simulation branch, fight expansion state, commentary ordering, scorecards, injuries, and completed-event `goBack('dashboard')` fallback.

- [ ] **Step 4: Recompose Fight Detail**

Use `PageHeader` and `Panel` for identity, official result, scorecards, title/injury status, totals, round stats, and commentary. Preserve archive fallbacks, belt references, title-state messages, stats reduction logic, all scorecards/commentary, and `goBack('history')`.

- [ ] **Step 5: Run simulation/navigation regressions**

Run: `npx tsx test_ui_contracts.ts && npx tsx test_navigation.ts && npm run lint`

Expected: all pass.

- [ ] **Step 6: Inspect the focused diff**

Run: `git diff -- src/pages/EventSimulation.tsx src/pages/FightBattle.tsx src/pages/FightDetail.tsx test_ui_contracts.ts`

Expected: simulation branching, results, scorecards, commentary, stats, and Back fallbacks remain intact. Create a commit only if the user explicitly requests one.

### Task 8: Validate production output and manual golden paths

**Files:**
- Modify only if verification identifies a presentation regression.

- [ ] **Step 1: Run all automated checks together**

Run:

```bash
npx tsx test_ui_contracts.ts && npx tsx test_branding.ts && npx tsx test_ux_guidance.ts && npx tsx test_mma_guide.ts && npx tsx test_navigation.ts && npx tsx test_long_sim.ts && npm run lint && npm run build
```

Expected: every script reports success, all long-simulation invariant counts are zero, TypeScript exits 0, and Vite production build exits 0.

- [ ] **Step 2: Start the app for desktop and narrow-mobile verification**

Run: `npm run dev`

Expected: Vite prints its local server address.

- [ ] **Step 3: Manually verify the desktop paths**

1. Use every desktop rail item; selected state changes and no top-level page is unreachable.
2. Open Roster → Fighter Detail → Back, and History → Fight Detail → Back; each returns to its actual source.
3. Book an event from Dashboard and from a Calendar slot; verify card validation, title/GP warnings, confirmation, edit flow, and return destination.
4. Create and schedule 4-man and 8-man GPs; verify reserves, bracket, linked slot, delay messaging, title-shot label, and cancellation controls.
5. Start an event, enter Fight Battle, autoplay/reveal/finalize, open results and Fight Detail, and verify commentary/scorecards/injuries.
6. Use New Game confirmation, Save, Load, Export, valid Import, and invalid Import.

- [ ] **Step 4: Manually verify narrow mobile paths**

1. Open and dismiss the drawer via button, backdrop, and keyboard; changing view closes it.
2. Confirm rail controls are at least 44px high and keyboard focus is visible.
3. Check one roster table, ranking table, history table, and calendar table scroll horizontally rather than clipping columns.
4. Check Dashboard, Fighter Detail, Event Builder, Tournament bracket, Event Results, and Fight Detail use readable single-column layout with no hidden actions.

- [ ] **Step 5: Review and report any verification-only corrections**

If manual validation requires source changes, rerun the full automated command after each correction and inspect its focused diff. Create a commit only if the user explicitly requests one.
