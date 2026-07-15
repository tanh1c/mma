# Display Units Settings Design

**Goal:** Add a Settings page where players choose Metric (cm/kg) or US/Imperial (ft-in/lb), and apply that preference consistently to fighter physical measurements across the UI.

## Scope

- Add a dedicated Settings navigation entry and page.
- Default to Metric.
- Persist the preference per browser, independently of game saves.
- Apply the preference to every current UI surface that displays fighter height or weight: Fighter Detail and Roster.
- Preserve weight-cut percentage display.
- Do not change simulation behavior, fighter data, save schema, import/export format, or existing worlds.

## Data and Architecture

Fighter measurements remain in their canonical existing fields:

- `heightCm`
- `fightWeightLb`
- `walkAroundWeightLb`

A small settings module owns `unitSystem: 'metric' | 'us'`. It reads and writes one localStorage key and defaults to `metric` when the key is absent or invalid. This browser preference applies across all worlds and save files.

Pure shared formatters convert values only at render time:

- Metric height: integer centimetres, for example `180 cm`.
- Metric weight: kilograms rounded to one decimal place using `lb * 0.45359237`, for example `70.3 kg`.
- US height: centimetres converted to rounded total inches and split into feet/inches, for example `5' 11"`.
- US weight: integer pounds from the canonical value, for example `155 lb`.

Game logic continues using canonical values, so changing units has no gameplay effect.

## Settings UI

Add `settings` to `GameView`, lazy-load a Settings page from `App.tsx`, and place a **Settings** item in the sidebar's Records group. The existing gear icon moves from Debug Sim to Settings; Debug Sim receives a more appropriate diagnostic icon already available from the icon library.

The page contains one **Units** section with two accessible radio/card choices:

1. **Metric** — cm, kg
2. **US / Imperial** — ft/in, lb

Selection applies immediately without a Save button. Cards appear side-by-side where space permits and stack on narrow screens. Native radio semantics, visible labels, keyboard operation, and focus-visible styles are required.

## UI Integration

Replace hard-coded measurement strings with shared formatting on:

- Fighter Detail: Height, Fight Weight, Walk-around Weight.
- Roster: compact physical summary.

Weight Cut remains a percentage. Other ratings and physical properties are unchanged. Future height/weight UI must use the same formatters.

## Persistence and Failure Handling

The settings module must tolerate unavailable, missing, or invalid localStorage data. Reads fall back to Metric. A failed write keeps the in-memory selection active for the current session and must not crash the app.

The preference is not included in game save, load, export, import, or new-game operations. Refreshing the page retains a successfully stored preference; creating or loading a world does not reset it.

## Testing and Runtime Verification

Follow TDD with the smallest deterministic checks:

1. Formatter checks cover Metric output, US output, kg precision, and height rounding across a feet boundary.
2. Settings checks cover Metric default, valid stored preference, invalid-value fallback, and persistence.
3. UI contract checks cover the Settings view/navigation and verify Fighter Detail and Roster consume shared formatters rather than hard-coded `cm`/`lb` output.
4. Run existing relevant UI contracts, lint, and build.
5. Against the existing Vite app on port 3000, verify desktop and mobile flows:
   - Open Settings and switch Metric to US/Imperial.
   - Confirm Roster and Fighter Detail update immediately.
   - Refresh and confirm the preference remains.
   - Switch back to Metric and confirm `cm` and `kg` output.

## Exclusions

- No locale auto-detection.
- No per-save or per-world preference.
- No independent height and weight selectors.
- No conversion of stored fighter data.
- No settings framework or additional dependency.
- No commit or push.
