# Championship Belts Visual Integration Design

**Date:** 2026-07-15
**Status:** Approved

## Goal

Integrate the twelve approved championship-belt PNGs into the current title UI so every division, champion type, and title-fight context has a consistent visual identity without changing championship gameplay or save data.

## Scope

Included:

- Six distinct division designs: Bantamweight Crown, Featherweight Throne, Lightweight Gold, Welterweight Scepter, Middleweight Iron Crown, and Heavyweight World Crown.
- Separate Undisputed and Interim images for every division.
- Prominent belt presentation on Rankings and current-champion Fighter Detail pages.
- Compact belt presentation on Dashboard champion cards and title-fight contexts.
- Responsive sizing, consistent containment, meaningful text alternatives, and no mobile overflow.

Excluded:

- Championship engine, title transitions, booking policy, or fighter eligibility changes.
- Save-schema changes, asset paths stored in game state, or migration work.
- Custom promotions, belt editors, belt collections, belt-room screens, animation, or dynamic recoloring.
- Adding belt art to every history row, news post, social post, or statistics table.
- Recreating the approved art with SVG or CSS.

## Approved Assets

The source set contains twelve transparent PNGs in the repository's `belt/` directory:

| Weight class | Undisputed source | Interim source |
| --- | --- | --- |
| Bantamweight | `belt-bantamweight-crown-Photoroom.png` | `belt-bantamweight-crown-interim-Photoroom.png` |
| Featherweight | `belt-featherweight-throne-Photoroom.png` | `belt-featherweight-throne-interim-Photoroom.png` |
| Lightweight | `belt-lightweight-gold-Photoroom.png` | `belt-lightweight-gold-interim-Photoroom.png` |
| Welterweight | `belt-welterweight-scepter-Photoroom.png` | `belt-welterweight-scepter-interim-Photoroom.png` |
| Middleweight | `belt-middleweight-iron-crown-Photoroom.png` | `belt-middleweight-iron-crown-interim-Photoroom.png` |
| Heavyweight | `belt-heavyweight-world-crown-Photoroom.png` | `belt-heavyweight-world-crown-interim-Photoroom.png` |

For production, copy these files unchanged into `public/belts/` using stable names such as `lightweight-undisputed.png` and `lightweight-interim.png`. The images remain transparent PNGs; no processing dependency or generated derivative is required.

## Architecture

Add one UI-only component:

```tsx
<ChampionshipBelt
  weightClass="Lightweight"
  type="undisputed"
  size="hero"
/>
```

The component lives at `src/components/ChampionshipBelt.tsx` and owns:

- the complete `WeightClass` plus `undisputed | interim` asset map;
- a small set of visual sizes;
- a fixed, responsive containment frame;
- `object-fit: contain` behavior;
- semantic or decorative alternative text according to context.

Pages remain responsible for deciding whether a belt should appear and which type applies. The component does not inspect game state or decide who is champion.

The data flow is:

```text
Existing title state or fight titleFightType
                    ↓
Page derives WeightClass and belt type
                    ↓
ChampionshipBelt resolves the approved PNG
                    ↓
Responsive image frame renders the belt
```

The art is a derived presentation concern. Do not add image paths to `BeltInfo`, `WeightClassTitleState`, `GameState`, or serialized saves. No save-version bump is needed.

## Belt-Type Rules

### Current champions

- `undisputedChampionId === fighter.id` selects the Undisputed image.
- `interimChampionId === fighter.id` selects the Interim image.
- A former champion who holds neither current ID does not receive a current belt hero.

### Title fights

- `titleFightType === 'interim'` selects the Interim image.
- `undisputed`, `vacant_undisputed`, and `unification` select the Undisputed image.
- An absent or unrecognized title type must not invent an Interim state; preserve the existing textual UI and omit an uncertain image when necessary.

### Division title states

- A normal champion shows belt art, champion identity, and existing defense information.
- An Interim champion always shows the Interim image and an explicit `INTERIM` label.
- A vacant division may show the Undisputed image with an explicit `VACANT` label but no placeholder champion.
- A unification fight shows the Undisputed image with an explicit `UNIFICATION` label.
- An inactive champion retains the appropriate belt alongside the existing warning state.
- When legacy or malformed data lacks enough title information, preserve the existing textual fallback rather than showing the wrong belt.

## UI Placement

### Rankings

Rankings is the primary belt surface.

- Show the selected division's Undisputed belt in the division title panel at hero scale.
- Keep the existing branded belt name and title-status text; the image does not replace them.
- Show an Interim belt with the Interim champion card when one exists.
- Undisputed remains visually dominant when both champions exist.

### Fighter Detail

- Show a large belt within the profile hero only when the fighter is the current Undisputed or Interim champion of their division.
- Place it beside the identity block on wide screens and below that block on narrow screens.
- Keep title-fight totals, achievements, timeline, contract warnings, and champion status text unchanged.
- Do not show a current belt for title history alone.

### Dashboard

- Add a card-scale belt beside each entry in Current Champions.
- The image must not crowd the fighter name, division, record, or status badge.
- Interim champions use the black-strap Interim image as well as the existing textual distinction.
- A small title-fight marker may appear on the Next Event fight row if space remains usable, but Current Champions has priority.

### Event Builder

- Add a marker-scale belt to booked title-fight rows.
- Keep the explicit title label and five-round metadata.
- Preserve all booking, tournament, title-shot, camp, ordering, removal, and Manager/Observer behavior.

### Event Simulation and Results

- Show a marker-scale belt on title fights before simulation.
- Retain the belt in title-result metadata so a title change reads as championship context at a glance.
- Existing result and title-change text remains authoritative.

### Lower-priority surfaces

Fight Detail, title lineage, and other history views may adopt the same component later. They are not required for the first integration because repeating large art throughout dense archival tables would add noise without improving the core current-title experience.

## Visual Hierarchy

Use four responsive size roles rather than page-specific image dimensions:

| Role | Intended surface | Approximate rendered width |
| --- | --- | --- |
| `hero` | Rankings division panel | 240–300px |
| `champion` | Fighter Detail profile | 180–240px |
| `card` | Dashboard champion card | 96–128px |
| `marker` | Fight-card/title metadata | 44–64px |

These are presentation ranges, not JavaScript viewport rules. CSS media queries and the surrounding layout determine the final width.

Every role uses a stable frame and `object-contain` so differing source canvases do not crop straps or center plates. The image must never force page-level horizontal scrolling.

## Language and Accessibility

Belt art supplements text; it is not the only title indicator.

- A standalone meaningful image uses an alternative such as `Lightweight Gold undisputed championship belt`.
- A thumbnail directly beside a complete title label is decorative and uses `alt=""` to avoid duplicate screen-reader output.
- Interim status is always written as text, not communicated only through the black strap.
- Vacant, inactive, and unification states retain explicit text and existing status tones.
- No information is available only on hover.
- The image itself is not interactive and receives no tab stop.

## Responsive Behavior

- Rankings and Fighter Detail stack belt art beneath textual identity on narrow screens.
- Dashboard cards allow the text region to shrink with `min-width: 0`; the belt frame does not push actions or status outside the card.
- Fight-card markers stay compact and metadata may wrap.
- At `390×844`, all center plates remain visible, labels remain readable, and the document has no horizontal overflow.
- Desktop layouts preserve the current density and navigation behavior.

No responsive JavaScript hook or viewport state is required.

## Error Handling

- The resolver is exhaustive for the six current `WeightClass` values and both belt types.
- Missing source files are caught by a runnable asset contract before runtime verification.
- Unknown or incomplete title context keeps the current text and omits uncertain art.
- Broken-image placeholders are not used as a fallback.
- The component introduces no loading state because all assets are local static files.

## Testing

Use a small source/asset contract before production integration.

### Asset and component contracts

- All six weight classes resolve both Undisputed and Interim images.
- Every mapped file exists under `public/belts/`.
- The component supports semantic and decorative alternative text.
- The four size roles use containment rather than crop behavior.
- Rankings, Fighter Detail, Dashboard, Event Builder, and Event Simulation use the shared component rather than duplicating asset maps.

### Existing regressions

Run the focused UI and title-related regressions. No title-engine or save migration behavior should change, and the save format must remain unchanged.

### Runtime verification

At the running Vite app:

1. Cycle Rankings through all six divisions and confirm each distinct Undisputed design.
2. Observe a division with an Interim champion and confirm the correct Interim image and text.
3. Open current Undisputed, current Interim, and non-champion Fighter Detail profiles.
4. Inspect Dashboard champion cards for text collision or oversized art.
5. Exercise Undisputed, Interim, vacant-title, and unification contexts in Event Builder/Event Simulation where the current game state makes them available.
6. Confirm every belt request returns successfully with no `404`.
7. Repeat the primary surfaces at desktop and `390×844`, checking center-plate visibility and page-level overflow.

## Files Expected to Change

- Create `src/components/ChampionshipBelt.tsx`.
- Copy twelve approved assets into `public/belts/` with stable production names.
- Modify `src/pages/Rankings.tsx`.
- Modify `src/pages/FighterDetail.tsx`.
- Modify `src/pages/Dashboard.tsx`.
- Modify `src/pages/EventBuilder.tsx`.
- Modify `src/pages/EventSimulation.tsx`.
- Extend the existing runnable UI contract test or add one focused belt asset/UI contract.

No dependency, game-state type, title engine, save schema, migration, or gameplay-policy changes are required.
