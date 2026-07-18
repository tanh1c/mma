# Calendar and Grand Prix Mobile Card Design

## Goal

Make Season Calendar and Grand Prix/Tournaments fully usable at 390×844 and 740×390 without horizontal page overflow, clipped content, or compressed actions, while preserving desktop layouts and all game behavior.

## Scope

### Season Calendar

- Keep the existing table at `md` and wider.
- Render the same filtered slots as stacked cards below `md`.
- Each card exposes date, slot type, status, target details, linked event, warnings, Grand Prix explanation, notes, and available actions without horizontal scrolling.
- Long names and generated notes wrap within the card. Mobile content must not rely on hover titles to be readable.
- Booking and cancellation actions use a one-column mobile layout and return to intrinsic width from `sm` upward.
- Filters remain wrapping controls so every option is immediately reachable.

### Grand Prix/Tournaments

- Keep the existing tournament creation, scheduling, cancellation, filtering, bracket, and navigation behavior.
- Participant rows stack fighter identity above participant/reserve actions at narrow widths. Text regions use `min-w-0`; actions use full-width touch targets on mobile.
- Status filters use a two-column mobile grid and four columns from `sm` upward.
- Tournament list cards and detail headers allow titles, badges, division labels, and action groups to wrap.
- Bracket rounds stay one column at 390px and may use their existing multi-column layout from `sm` upward for short landscape screens.
- Fighter rows reserve space for winner icons and wrap or truncate names without pushing cards wider than the viewport.
- Linked-event controls are semantic buttons with keyboard and touch support.
- The final badge must not overlap the final heading or fighter content.
- Form, detail, and scheduling-modal footers stack buttons on mobile and restore horizontal alignment from `sm` upward.

## Responsive and Accessibility Contracts

- No page-level horizontal overflow at 390×844, 740×390, or 1280×800.
- Interactive mobile actions have at least 44px height.
- No information required for operation is available only through hover.
- Icon and status decorations do not shrink fighter names or action controls out of view.
- Desktop table and bracket behavior remain unchanged beyond responsive class adjustments.

## Implementation Boundaries

- Modify only `src/pages/Calendar.tsx`, `src/pages/Tournaments.tsx`, and the existing focused UI regression where necessary.
- Reuse existing `Panel`, `Button`, `StatusBadge`, and localization functions.
- Do not add dependencies, viewport hooks, duplicated game state, translation keys, or game-logic changes.
- Share Calendar slot rendering only when it shortens the implementation; do not introduce a new component file solely for mobile markup.

## Verification

- Add source-contract regressions for the mobile Calendar card/table split and Grand Prix stacking/grid/min-width contracts; confirm they fail before implementation and pass afterward.
- Run `npx tsx test_ui_contracts.ts`, `npx tsx test_navigation.ts`, `npm run lint`, and `npm run build`.
- Use the local Vite app on port 3000 with an external Playwright script to exercise Calendar filters/actions and Grand Prix list, creation rows, bracket links, scheduling controls, and modal actions at all three target viewports.
- Verify no console errors and no document-level horizontal overflow. Do not add a browser-test dependency or commit the external audit script.
