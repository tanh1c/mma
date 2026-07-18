# Calendar and Grand Prix Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Calendar and Grand Prix cards usable without page overflow or compressed controls at 390×844 and 740×390 while preserving desktop and game behavior.

**Architecture:** Keep Calendar’s current table for `md` and wider and add a mobile card rendering of the same `filteredSlots`. Apply mobile-first stacking, `min-w-0`, wrapping, semantic buttons, and 44px actions directly to the existing Tournaments markup; no state or game logic changes.

**Tech Stack:** React 19, TypeScript 5.8, Tailwind CSS 4, Zustand 5, i18next, Node assert scripts, external Playwright.

## Global Constraints

- Modify production behavior only in `src/pages/Calendar.tsx` and `src/pages/Tournaments.tsx`.
- Reuse existing UI and localization helpers; add no dependency, viewport hook, state duplication, or translation key.
- Preserve Calendar filtering/booking/cancellation and all tournament creation/scheduling/cancellation/bracket navigation.
- No page-level horizontal overflow at 390×844, 740×390, or 1280×800.
- Mobile actions must be at least 44px high and operational information must not depend on hover.
- Do not commit or push unless explicitly requested; ignore `.superpowers/` and `belt/`.

---

### Task 1: Calendar Mobile Slot Cards

**Files:**
- Modify: `test_ui_contracts.ts`
- Modify: `src/pages/Calendar.tsx:98-169`

**Interfaces:**
- Consumes: existing `filteredSlots`, `events`, `eventArchive`, `tournaments`, `diagnoses`, `setView`, `cancelCalendarSlot`, and localization helpers.
- Produces: a `md:hidden` card list and an unchanged `hidden md:block` desktop table rendering the same slots.

- [ ] **Step 1: Write the failing source contract**

Add Calendar source loading and assertions to `test_ui_contracts.ts`:

```ts
const calendarPage = readFileSync('src/pages/Calendar.tsx', 'utf8');
for (const token of [
  'md:hidden',
  'hidden md:block',
  'grid grid-cols-1 gap-2 sm:grid-cols-2',
  'min-w-0 break-words',
  'min-h-11 w-full sm:w-auto'
]) {
  assert.ok(calendarPage.includes(token), `Calendar mobile cards missing ${token}`);
}
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx test_ui_contracts.ts`

Expected: FAIL with `Calendar mobile cards missing md:hidden`.

- [ ] **Step 3: Implement the minimum responsive rendering**

In `Calendar.tsx`, compute each slot’s event/warnings/Grand Prix explanation once through a local function inside the component:

```ts
const getSlotDisplay = (slot: (typeof slots)[number]) => {
  const event = events[slot.eventId || ''] || eventArchive[slot.eventId || ''];
  const isPast = slot.date < currentDate;
  const isApproaching = slot.date >= currentDate && slot.date <= addDaysStr(currentDate, 28);
  const warnings: string[] = [];
  if (event && slot.date !== event.date) warnings.push(t($ => $.calendar.warnings.dateMismatch));
  if (slot.type === 'grand_prix_round' && !slot.tournamentId) warnings.push(t($ => $.calendar.warnings.noTournament));
  if (isPast && slot.status === 'planned' && !(slot.notes || []).some(note => note.toLowerCase().includes('delayed') || note.toLowerCase().includes('rescheduled'))) warnings.push(t($ => $.calendar.warnings.overdueSlot));
  if ((slot.notes || []).some(note => note.toLowerCase().includes('delayed') || note.toLowerCase().includes('delay'))) warnings.push(t($ => $.calendar.warnings.delayedRound));
  return {
    event,
    isPast,
    isApproaching,
    warnings,
    gpExplanation: getGrandPrixExplanation(slot, slot.tournamentId ? diagnoses[slot.tournamentId] : undefined, language)
  };
};
```

Render `filteredSlots` below `md` as cards. Each card must use these exact responsive contracts:

```tsx
<div className="space-y-3 md:hidden">
  {filteredSlots.map(slot => (
    <article key={slot.id} className="min-w-0 space-y-4 border-b border-[#2a2c31] p-4 last:border-b-0">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        {/* date, overdue/approaching label, slot/status badges */}
      </div>
      <dl className="grid min-w-0 grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        {/* target details, linked event, notes and warnings; long content uses min-w-0 break-words */}
      </dl>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {/* existing Book Card and Cancel actions with className="min-h-11 w-full sm:w-auto" */}
      </div>
    </article>
  ))}
</div>
```

Wrap the existing table section with:

```tsx
<div className="hidden md:block">
  <div className="overflow-x-auto custom-scrollbar">
    {/* existing table */}
  </div>
</div>
```

Use normal wrapping for all mobile notes and Grand Prix details; retain desktop truncation and titles.

- [ ] **Step 4: Verify GREEN**

Run: `npx tsx test_ui_contracts.ts`

Expected: `UI visual contracts passed.`

---

### Task 2: Grand Prix Mobile Cards and Bracket

**Files:**
- Modify: `test_ui_contracts.ts`
- Modify: `src/pages/Tournaments.tsx:161-699`

**Interfaces:**
- Consumes: all existing tournament local state and Zustand actions unchanged.
- Produces: mobile-first creation rows, filters, tournament cards, detail header, bracket fighter rows, and modal footers.

- [ ] **Step 1: Write the failing source contract**

Add Tournaments source loading and assertions:

```ts
const tournamentsPage = readFileSync('src/pages/Tournaments.tsx', 'utf8');
for (const token of [
  'grid grid-cols-2 gap-1 sm:grid-cols-4',
  'flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
  'w-full min-h-11 sm:w-auto',
  "isEight ? 'sm:grid-cols-3' : 'sm:grid-cols-2'",
  'min-w-0 truncate',
  'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'
]) {
  assert.ok(tournamentsPage.includes(token), `Tournament mobile cards missing ${token}`);
}
assert.ok(!tournamentsPage.includes('<span \n                                      className="text-purple-400 cursor-pointer'));
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx test_ui_contracts.ts`

Expected: FAIL with `Tournament mobile cards missing grid grid-cols-2 gap-1 sm:grid-cols-4`.

- [ ] **Step 3: Apply mobile-first layout classes**

Make these exact localized changes without changing handlers:

```tsx
<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
<div className="grid max-h-60 grid-cols-1 gap-2 overflow-y-auto pr-2 sm:grid-cols-2">
<div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
<div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
<button className="min-h-11 w-full ...">...</button>
```

Change the status filter to:

```tsx
<div className="grid grid-cols-2 gap-1 rounded-lg border border-[#2a2c31] bg-black/10 p-1 sm:grid-cols-4">
```

Allow tournament card headings and detail header to wrap with `min-w-0`, `flex-wrap`, and stacked mobile actions. Use `w-full min-h-11 sm:w-auto` for schedule/cancel controls.

Change bracket breakpoints only:

```tsx
<div className={`grid grid-cols-1 ${isEight ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} items-center gap-4 rounded-lg border border-neutral-800 bg-neutral-950/50 p-4 sm:gap-6 sm:p-6`}>
```

For every fighter row, preserve icons with `shrink-0`, constrain the name area with `min-w-0 truncate`, and keep winner check icons `shrink-0`. Convert each linked-event span into:

```tsx
<button
  type="button"
  className="min-h-11 shrink-0 text-right text-[10px] text-purple-400 hover:underline"
  onClick={() => setView('event-builder', { eventId: slot.eventId })}
>
  {translate($ => $.tournaments.linkedEvent)}
</button>
```

Move the final badge into normal flow above the final heading rather than absolute positioning. Stack creation and modal footers:

```tsx
<div className="flex flex-col-reverse gap-2 border-t border-neutral-800 pt-4 sm:flex-row sm:justify-end">
```

Use `grid-cols-1 sm:grid-cols-2` for additional information so 740px landscape gains two columns without affecting 390px portrait.

- [ ] **Step 4: Verify GREEN**

Run: `npx tsx test_ui_contracts.ts`

Expected: `UI visual contracts passed.`

---

### Task 3: Runtime and Regression Verification

**Files:**
- Temporary only: `%TEMP%/mma-calendar-gp-mobile-audit.cjs`
- Verify: `src/pages/Calendar.tsx`
- Verify: `src/pages/Tournaments.tsx`

**Interfaces:**
- Consumes: Vite app at `http://127.0.0.1:3000` and external Playwright already available in the npm cache.
- Produces: runtime evidence only; no repository browser-test file or dependency.

- [ ] **Step 1: Run focused and adjacent checks**

Run individually:

```bash
npx tsx test_ui_contracts.ts
npx tsx test_navigation.ts
npm run lint
npm run build
git diff --check
```

Expected: all commands pass; Vite may retain its existing chunk-size warning.

- [ ] **Step 2: Start or reuse Vite on port 3000**

Run `npm run dev -- --host 127.0.0.1 --port 3000` in the background only if port 3000 is not already serving the app.

Expected: `http://127.0.0.1:3000` responds.

- [ ] **Step 3: Exercise Calendar in the browser**

At 390×844 and 740×390:

- Navigate to Calendar through the mobile drawer.
- Assert the desktop table is hidden and slot cards are visible.
- Click every filter, including GP Round and Missed/Cancelled.
- Verify long notes/Grand Prix explanations remain inside cards.
- Verify visible Book Card/Cancel actions are at least 44px high.
- Assert `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.

At 1280×800:

- Assert the desktop table is visible and mobile cards are hidden.
- Verify a linked event and available action still navigate correctly.

- [ ] **Step 4: Exercise Grand Prix in the browser**

At each target viewport:

- Navigate to Tournaments and click all four status filters.
- Open a tournament and verify title, status, action header, bracket rounds, fighter names, linked-event buttons, final badge, reserves, and history stay inside their cards.
- Open creation mode and verify participant rows and participant/reserve controls stack without clipping.
- Where state permits, open the scheduling modal and verify its actions are reachable and at least 44px high.
- Assert no page-level horizontal overflow and collect browser console/page errors.

Expected: no overflow, no console errors, and all tested navigation/actions preserve their prior behavior.

- [ ] **Step 5: Inspect screenshots and finish**

Capture one portrait Calendar screenshot and one portrait/landscape Grand Prix screenshot under `%TEMP%`; visually check spacing, wrapping, action order, and bracket readability. Leave repository changes uncommitted.
