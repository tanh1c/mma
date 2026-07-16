# Ranking Context UI Design

## Goal

Expose the existing promotion rankings wherever fighter identity or matchup context matters, while preserving accurate historical and former-promotion context.

## Rank Semantics

All UI uses one shared resolver and badge:

- `C`: current undisputed champion.
- `IC`: current interim champion.
- `#1` through `#15`: current ranked contenders.
- `UR`: not currently ranked.
- `Former #N · UR`: free agent's final promotion rank plus current unranked state.

The resolver derives current status from `GameState.rankings` and `GameState.titles`; pages do not calculate display positions independently. Champion state takes precedence over numeric rank. Visible text and tooltips explain abbreviated states, so meaning does not depend on color.

## Shared UI Unit

Add a compact `FighterRankBadge` component backed by a pure rank-context helper. The helper accepts the fighter ID, division rankings, and title state and returns a display label, semantic label, and sortable numeric value. It also supports explicit historical and former-rank values without pretending they are current.

The badge remains inline with fighter names, uses the existing mono/status visual language, wraps with metadata on narrow screens, and never creates a new table column unless sorting needs it.

## Current-Rank Surfaces

Show the shared badge in:

- Event Builder fighter selectors, matchup comparison, recommendations, and booked fight rows.
- Dashboard Next Event fight rows.
- Event Simulation pre-fight card and completed result headers.
- Fight Battle corner cards.
- Fighter Detail identity/header.
- Roster fighter cells, with rank sorting.
- Tournament participant picker and bracket. Tournament seed remains distinct and is displayed alongside rank.
- Social Hub items where a structured fighter ID identifies the author or referenced fighter.
- History summaries and Fight Detail as explicitly labelled current context.

Free Agents show current `UR`. If a last promotion rank exists, they show `Former #N · UR`. Fighters never ranked show only `UR`.

Unstructured news/media/fan text is excluded: the UI must not infer identity or rank from names embedded in prose.

## Historical Rank Snapshots

Extend `FightArchiveItem` with optional `redRankAtFight` and `blueRankAtFight` snapshots. Values use semantic strings (`C`, `IC`, `#N`, or `UR`) so a championship state is not lost as a numeric array index.

Snapshots are captured during event finalization, before subsequent ranking updates can change current standings. Archived fight views show both:

- `At fight: <snapshot>`
- `Current: <resolved current rank>`

Old archives without snapshots show `At fight: —`; they never substitute current rank as historical rank.

## Former Promotion Rank

Extend `Fighter` with optional `lastPromotionRank`. Before a ranked fighter becomes unsigned through release or contract lifecycle processing, preserve the fighter's current semantic contender rank. Champion departures preserve `C` or `IC` as their former status.

The value remains informational only. It does not influence sorting, contracts, matchmaking, ranking calculation, or re-entry into rankings. When a fighter is signed and ranked again, current rank takes precedence; the former value remains dormant until they are a free agent again.

## Persistence and Migration

Increase the save version because new optional historical information is persisted. Migration accepts saves without archive snapshots or former ranks and leaves those fields undefined. Existing ranking arrays, ranking scores, championship state, event results, and save data remain otherwise unchanged.

No algorithmic changes are made to Elo, ranking generation, title transitions, fight simulation, tournament seeding, booking, or Observer mode.

## Error and Missing-Data Behavior

- Missing fighter: omit the badge.
- Signed fighter absent from the top ranking list: `UR`.
- Free agent without former rank: `UR`.
- Missing historical snapshot: `—`.
- Conflicting champion and ranking data: title state wins for display, matching championship source-of-truth behavior.

## Responsive and Accessibility

Rank badges use short visible labels and descriptive `title`/accessible text. They remain adjacent to the associated fighter name in DOM order. Matchup rows wrap rather than add page-level horizontal overflow. Existing wide tables retain local horizontal scrolling. Color is supplementary.

## Verification

Use runnable Node assertion regressions for:

1. Undisputed, interim, contender, and unranked resolution.
2. Correct contender numbering with and without champion entries.
3. Former-rank capture before a fighter leaves the promotion.
4. Immutable rank-at-fight snapshots after current rankings change.
5. Old-save migration without fabricated historical data.
6. Source contracts for every approved UI surface.

Run existing ranking, management, tournament, calendar, navigation, lint, and build checks. Drive the actual Vite app at desktop and `390×844`, exercising booking, live simulation, completed fight history, Roster, Free Agents, Fighter Detail, Tournament bracket, and structured Social Hub posts. Confirm no page-level overflow and no ambiguous historical/current labels.

## Exclusions

- No new ranking algorithm, Elo policy, title logic, or matchmaking behavior.
- No rank inference from unstructured text.
- No fabricated historical ranks for old saves.
- No rank column added to Calendar.
- No dependency, design-system rewrite, or broad page refactor.
