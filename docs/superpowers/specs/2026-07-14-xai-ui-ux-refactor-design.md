# xAI-Inspired UI/UX Refactor Design

## Goal
Refactor the complete Cage Dynasty interface to follow `DESIGN-x.ai.md`: a precise, dark, engineered interface with a clear visual hierarchy. Preserve all game rules, Zustand navigation, saves, simulation behavior, booking validation, calendar/tournament links, and import/export flows.

## Visual system
- Use a near-black application canvas (`#0a0a0a`) with a small hierarchy of dark surfaces and hairline borders.
- Use normal-weight display text with tight tracking; reserve uppercase mono text for labels, filters, status, and metadata.
- Make controls compact outlined pills by default. Use a white filled action only for the highest-priority action in a context; destructive actions remain restrained red outlines.
- Remove decorative gradients, drop shadows, oversized bold headings, emoji-based visual hierarchy, and broad colored panels. Status color remains semantic and sparse.
- Retain existing real fighter avatars and SVG flags as identity cues; render them against neutral surfaces.

## Shared presentation layer
Create a small set of reusable presentation primitives rather than page-specific style systems:
- `AppShell`: responsive navigation, top context/action bar, and one scroll owner.
- `PageHeader`: mono eyebrow, light-weight title, supporting copy, and grouped actions.
- `Panel` and `DataSurface`: bordered dark containers for sections, stats, lists, and horizontally scrollable tables.
- `Button`: `primary`, `secondary`, `danger`, and `quiet` variants; each keeps accessible focus styling and 44px touch targets.
- `StatusBadge`: compact mono label with semantic tone.
- `Stat`: consistent label/value tile.
- Use the current `Select` component as the form-control baseline; update it to match the shared surface tokens.

Keep primitives presentation-only. Business conditions, calls to Zustand actions, data filtering, and booking logic stay in their existing pages.

## App shell and navigation
- Desktop: replace the dense permanent sidebar styling with a narrow, scroll-safe navigation rail. Group game progression, management, and records; place save/import controls in a separate utility section.
- Mobile: replace the always-visible sidebar with a menu trigger and dismissible drawer. Preserve every navigation action and save/import control.
- Keep store-driven `currentView` navigation and existing checkpoint Back behavior. No router, URL sync, or gameplay state changes.
- Add a concise top context bar for current date, promotion identity, money/reputation, and the single primary progression action.

## Page treatment
Apply the same composition to every existing view without deleting functional controls:
- **Dashboard:** action items and next event lead. Finance/news stay collapsible but use restrained data surfaces.
- **Roster, Free Agents, Rankings, History, Calendar:** shared dense tables with fixed metadata labels, compact filters, status badges, and mobile horizontal scrolling.
- **Fighter Detail:** a clean identity hero with derived avatar/flag, followed by contract, record, attributes, rankings, and history panels.
- **Event Builder and Tournaments:** sequence form controls and projections into bordered panels. Keep disabled states, confirmation dialogs, calendar slot metadata, GP constraints, and title-shot explanations visible.
- **Fight Battle, Event Simulation, Fight Detail:** make red/blue corner identity the only strong color usage; place stats, commentary, scorecards, results, and actions in clear stacked panels.
- **MMA Guide and Debug:** adopt the shared shell, headers, panels, and typography while retaining their static/debug content.

## Responsive and accessibility behavior
- Use mobile-first layouts: single-column content below `md`, compact but readable header actions, and `min-h-11` interactive targets.
- Collapse desktop grids to one column; tables retain their columns with horizontal scrolling rather than hiding operational data.
- Preserve native buttons, labels, keyboard handling, disabled state semantics, `aria-expanded` collapse controls, image alt text, flag labels, and visible focus rings.
- Use semantic color only as a second signal; text/status naming remains present for color-blind and low-contrast contexts.

## Non-goals
- No real MMA brands, new gameplay systems, new routes, persisted layout preferences, theme switching, chart library, design framework, or external image requests.
- No migration or save-state changes.
- No wholesale rewrite of state/store/game engine code.

## Validation
- Add focused static UI checks only where shared primitive contracts need regression coverage.
- Run existing `tsx` acceptance checks, TypeScript linting, and production build.
- Start the Vite app and manually exercise the desktop and narrow-mobile golden paths: navigation drawer/rail, roster-to-fighter Back flow, booking an event, tournament setup, fight simulation, and save/import controls.
