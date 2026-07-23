# Fighter and Global Statistics Design

## Status

Approved for specification on 2026-07-23. Awaiting final document review before implementation planning.

## Context

The game already stores rich fighter, fight, round, event, title, tournament, and promotion-economy history. Fighter Profile exposes a fight log, while History & Stats mixes archives, awards, title lineage, Hall of Fame, and drama history. Neither surface provides systematic technical tables, comparable leaderboards, accurate per-fight earnings, or ranking movement over time.

This feature adds a dedicated Statistics tab to Fighter Profile and a separate global Stats Board under Records. It uses archive/history data as the source of truth, records only the missing historical facts needed for future accuracy, and derives all aggregate statistics through a shared runtime index.

## Goals

- Give each fighter a detailed statistical profile with career, striking, grappling, per-fight, earnings, and ranking tables.
- Add a global Stats Board covering fighters, fights, events, promotions, titles, and tournaments.
- Support world, promotion, and international scopes.
- Support all-time, current-season, and individual-year periods.
- Record exact per-fight compensation and future ranking movements.
- Keep old saves valid without inventing historical values.
- Preserve deterministic simulation and use one shared aggregation implementation across both UIs.
- Keep wide tables usable and accessible on desktop and mobile.

## Non-goals

- Charts or graphing dependencies.
- Server-side pagination, virtualization, analytics services, or external databases.
- Estimating historical purse values or rankings that were not recorded.
- Replacing the existing History & Stats page.
- Persisting aggregate leaderboard counters or runtime caches in saves.
- Predictive ratings, betting odds, or popularity-based upset estimates.
- New assets, dependencies, browser automation, or unrelated UI/gameplay refactors.

## Navigation and Page Structure

A new `stats-board` game view appears as **Stats Board** in the Records navigation group. History & Stats remains unchanged and continues to own narrative archives, awards, Hall of Fame, title lineage, and season history.

Fighter Profile gains a separate **Statistics** tab alongside its existing Overview, Achievements, Storylines, Contract, Fights, and Timeline tabs. The existing Fights tab remains the concise fight log; Statistics owns aggregate and per-fight analytical tables.

## Architecture

Archive and history records remain the authoritative data. The implementation adds only facts that cannot be reconstructed accurately:

- exact fighter compensation at the time of each fight;
- participant promotion ownership at the time of each fight;
- ranking change records from the tracking start date onward;
- a stable date marking when exact statistics tracking began.

A focused statistics module builds a `StatisticsIndex` from `fightArchive`, `eventArchive`, title history, tournaments, promotion economy/ledger data, and ranking history. Fighter Profile and Stats Board use selectors over this common index.

The index is cached only in memory. The cache key compares the references of all source collections, including fighters and promotions used for current labels/snapshots. If any source reference changes, the complete index is rebuilt. Filtered views are memoized by period, scope, promotion, weight class, and any date-dependent input. `currentDate` is passed to selectors for current-year boundaries and active-reign durations instead of being embedded in the archive index. No cache or aggregate counter is serialized into Zustand persistence or exported saves.

This deliberately avoids fine-grained cache invalidation and revision counters. If profiling later proves a complete rebuild too slow for very large saves, source revisions or partial indexes can be introduced without changing the public selectors.

## Save Data Additions

The exact type names may follow existing conventions, but the responsibilities must remain:

```ts
interface FighterFightCompensation {
  fighterId: string;
  promotionIdAtFight?: string;
  basePurse: number;
  winBonus: number;
  total: number;
}

interface FighterRankingChange {
  id: string;
  date: string;
  fighterId: string;
  scope: 'promotion' | 'world';
  promotionId?: string;
  weightClass: WeightClass;
  previousRank?: number;
  rank?: number;
}

interface GameState {
  statisticsTrackingStartedAt: string;
  fighterRankingHistory: FighterRankingChange[];
}
```

Each newly archived fight stores compensation for both participants. `promotionIdAtFight` is captured alongside compensation so promotion-period statistics never reinterpret historical fights using a fighter's current contract. International participation does not change domestic ownership; an international fight retains each fighter's domestic promotion ID when one exists.

`basePurse` records contractual fight pay actually settled. `winBonus` records the bonus actually earned, not the contractual maximum. `total` equals their sum. A missing compensation record means unknown historical data; it must never be displayed or aggregated as zero.

Ranking history is an append-only change log, not a daily roster snapshot. A record is added only when a fighter enters, leaves, or changes position in a promotion or world ranking. `previousRank` or `rank` may be absent to represent entering or leaving the ranked list.

## Migration and Historical Accuracy

The save version increases once. Migration is idempotent:

- initialize `fighterRankingHistory` only when absent;
- initialize `statisticsTrackingStartedAt` only when absent, using the save's current in-game date;
- preserve both fields on repeated migration or load;
- leave old fight compensation and historical ownership absent rather than estimating them.

The UI displays “Tracked since {date}” for earnings and ranking history. Rows from before that date show an em dash for unavailable purse data. Rankings before that date are not synthesized from current rankings or current ownership.

Existing fight and round data remains valid for technical and result statistics. Promotion-scoped historical totals include only fights whose archived ownership is known. Unknown historical ownership is counted in world totals and exposed as an `Unknown` scope where relevant, rather than assigned to the fighter's current promotion.

## Data Capture

### Fight settlement

When a fight is settled and archived:

1. Read each participant's active contract and domestic promotion ownership at that exact point.
2. Calculate base purse and the winner's earned win bonus using the same values charged by event settlement.
3. Store one immutable compensation record per participant in the fight archive.
4. Ensure repeated event settlement cannot append or charge the compensation twice.
5. Preserve international ownership semantics and avoid duplicate domestic/international purse settlement.

Statistics reads never mutate or recalculate archived compensation.

### Ranking changes

At the end of a complete ranking-update operation:

1. Compare the rankings at the operation boundary, not intermediate recalculations, for both promotion and world rankings.
2. Emit records only for fighters whose net position changed, including entry and removal.
3. Use deterministic IDs based on date, scope, promotion, weight class, fighter, and transition.
4. Do not append a duplicate record if the same transition is processed again.
5. If another independent ranking operation occurs on the same in-game date, coalesce it into one daily net transition per fighter/scope/division: preserve the first `previousRank` and replace the final `rank`.
6. Remove a same-day record if later processing returns the fighter to that day's starting rank.
7. Keep promotion and world ranking records separate.

## Statistics Index and Rules

`buildStatisticsIndex(state)` normalizes archives into reusable fighter, fight, event, promotion, title, and tournament summaries. Public selectors consume the index rather than raw game state.

Core rules:

- All-time and period records are calculated from fights inside the selected date range, not from the fighter's current career record.
- The game currently models a season as an in-game calendar year. Current season means January 1 through `currentDate` of the current in-game year; an individual completed/current year means January 1 through December 31, capped at `currentDate` so future records are never included.
- Technical totals include only archived fights with `roundStats`.
- Accuracy percentages use landed divided by attempted and show an em dash when attempts are zero.
- Per-15-minute rates use actual recorded fight time and show an em dash when no valid duration exists.
- Damage caused and absorbed are computed from opposing round records without double counting.
- Career earnings sum only known compensation records and always retain the tracking disclosure.
- Active title reign duration ends at `currentDate`; completed reign duration ends at its recorded conclusion.
- Promotion statistics use archived ownership at fight time. Current ownership may be shown separately but cannot rewrite history.
- International scope includes international competition fights/events, while world scope includes all scopes.
- No-contest data is displayed only if the existing result model records it; it is never inferred from draws.
- Every sort has deterministic tie-breakers: primary metric, qualifying sample size, name/date, then stable ID.

## Fighter Profile Statistics Tab

### Career snapshot

Show:

- wins, losses, draws, and total fights;
- win percentage;
- KO/TKO, submission, and decision outcomes;
- current and longest winning streak;
- title fights, title wins, and title defenses;
- exact tracked career earnings and tracking start date.

### Striking table

Provide career total and normalized rows for:

- fights and rounds with technical data;
- total strikes landed/attempted and accuracy;
- significant strikes landed/attempted and accuracy;
- head, body, and leg strikes landed;
- knockdowns and knockdowns per 15 minutes;
- damage caused and absorbed.

The normalized presentation uses per-fight or per-15-minute values where meaningful and labels the unit explicitly.

### Grappling table

Provide:

- takedowns landed/attempted and accuracy;
- submission attempts;
- reversals;
- total control time;
- control time per 15 minutes.

### Per-fight statistics table

Each row contains:

- date, event, opponent, result, method, round, and finish time;
- total/significant strikes;
- takedowns;
- control time;
- knockdowns;
- performance rating;
- exact tracked payout or an em dash.

The table defaults to newest fight first, supports sortable columns, and provides keyboard-accessible navigation to Fight Detail.

### Ranking history table

Each row contains date, scope, promotion where applicable, weight class, and previous-to-new rank. It shows only changes recorded since statistics tracking began.

## Global Stats Board

The page defaults to world scope and shares these filters across tabs:

- period: all-time, current season, or a specific in-game year;
- scope: world, player promotion, any rival promotion, or international;
- weight class: all or one division.

Filter state is local to the page and is not persisted in the save.

### Fighter Leaders

Include sortable leaderboards for:

- total wins;
- win percentage with a visible minimum-fight threshold;
- KO/TKO wins;
- submission wins;
- current and longest winning streak;
- title defenses;
- tracked career earnings;
- striking accuracy;
- takedown accuracy;
- knockdowns;
- control time.

Fighter names navigate to Fighter Profile. Accuracy leaderboards require a minimum attempt/sample threshold so one-action records cannot lead the board; the threshold is displayed with the table.

### Fight Records

Include:

- highest-rated fights;
- fastest finishes;
- longest fights;
- most knockdowns;
- most significant strikes;
- most takedowns;
- most control time.

A comeback leaderboard is included only if round-by-round data provides a deterministic definition such as trailing on completed judges' scores before the finish. Popularity, reputation, or marketability must not be used as a comeback proxy. Fight rows navigate to Fight Detail.

### Events

Include:

- highest attendance;
- highest revenue;
- highest profit and largest loss;
- highest event rating;
- event and fight counts by promotion;
- finish rate;
- title-fight count.

Missing international financial records remain unknown rather than becoming zero.

### Promotions

Include:

- event and fight totals;
- champion and title-defense totals;
- fighter results attributed by ownership at fight time;
- event revenue, cost, and profit;
- sponsor/media income;
- fighter pay and contract spending where ledger/archive sources support it;
- current outstanding liabilities.

Flow metrics respect the selected period. Balance-sheet values such as current liabilities are labeled as current snapshots and are not falsely filtered as historical totals.

### Titles

Include:

- longest reigns;
- most defenses in one reign;
- most title wins by fighter;
- domestic and international champion lineage;
- active reign duration through the current in-game date.

### Tournaments

Include:

- appearances and championships by fighter;
- appearances and championships by promotion;
- highest-rated tournaments;
- fight totals and finish rates;
- separate tournament types for domestic Grand Prix, Champions Cup, and Challenge Cup.

## Table Interaction and Responsive UX

All tables use semantic `<table>`, `<caption>`, `<thead>`, `<tbody>`, and `<th scope="col">`. Sortable headers are buttons with `aria-sort` on the active column. Navigable rows contain an explicit focusable fighter/fight action instead of relying only on row click behavior.

Tables initially show a bounded number of rows and expose a localized **Show more** action. This is client-side expansion, not pagination. Empty filtered results use a clear localized state instead of fabricated zero rows.

Wide tables use horizontal scrolling without global arbitrary word breaking. Identification columns appear first, numeric columns do not wrap, and long names truncate only within constrained cells. Long tables may use sticky headers. Touch actions maintain the existing minimum target size.

All labels, units, captions, empty states, tracking disclosures, scope names, and sort descriptions are available in English and Vietnamese. Existing date, currency, number, and duration formatters are reused.

## Error and Edge-Case Handling

- Missing round data excludes that fight from technical denominators but not from record totals.
- Zero attempts or zero valid duration yields an em dash, never `NaN`, `Infinity`, or a misleading percentage/rate.
- Missing payout yields unknown, never zero.
- Missing historical promotion ownership excludes the fight from a specific promotion total but preserves world totals.
- Removed fighters remain resolvable through stored fighter/archive data when possible; otherwise IDs use a localized unknown-fighter label.
- Ranking entry/removal transitions render as `Unranked → #N` and `#N → Unranked`.
- Imported or migrated saves rebuild runtime caches from their actual source references.
- Cache failures cannot corrupt saves because the cache is disposable and non-persistent.

## Testing Strategy

Use focused `node:assert/strict` tests through `npx tsx` before production changes.

### Data and migration

- New-game initialization creates tracking fields.
- Migration is idempotent and does not invent old purse/ranking records.
- Fight settlement captures exact base purse, earned win bonus, total, and ownership once.
- International and repeated settlement paths cannot duplicate payouts.
- Ranking updates record entries, exits, and changed positions without duplicate records, coalesce same-day net changes, and remove no-op daily transitions.

### Statistics engine

- Aggregates match hand-built multi-fight fixtures.
- Period, scope, promotion, international, and weight-class filters produce correct subsets.
- Accuracy/rate denominators exclude missing data and handle zero safely.
- Streak, title, earnings, event, promotion, and tournament calculations follow the specified rules.
- Historical ownership does not change when current contracts change.
- Deterministic tie-breakers produce stable ordering.
- Runtime index is reused while source references are unchanged and rebuilt after relevant source replacement.

### UI contracts

- Fighter Profile exposes Statistics without changing existing tabs.
- Stats Board navigation, routing, filter labels, semantic tables, captions, sortable headers, empty states, and keyboard actions exist.
- Wide-table overflow and mobile identification columns follow shared UI conventions.
- Both English and Vietnamese resource trees contain matching keys.

### Regression verification

Run focused statistics tests, existing fight archive/event settlement/ranking/migration tests, UI contracts, i18n tests, long deterministic simulations, lint, build, and `git diff --check`. Browser automation is not required; final visual behavior is checked manually by the user.

## Success Criteria

- Fighter Profile shows accurate career, striking, grappling, per-fight, payout, and ranking tables.
- Stats Board compares the whole game across six domains using shared filters.
- New fights store exact compensation and ownership without duplicate settlement.
- Future ranking movements are recorded once and old saves clearly disclose the tracking boundary.
- Promotion statistics do not rewrite history after fighter transfers.
- Cached and uncached selectors return identical deterministic results.
- Save migration remains idempotent and existing simulation/regression checks pass.
