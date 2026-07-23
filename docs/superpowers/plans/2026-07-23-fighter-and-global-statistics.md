# Fighter and Global Statistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bổ sung tab Statistics đầy đủ cho Fighter Profile và một Stats Board toàn game, với purse từng trận, lịch sử ranking, sáu nhóm leaderboard, bộ lọc toàn cầu và bảng semantic có thể sort.

**Architecture:** Archive/history tiếp tục là nguồn sự thật. Chỉ purse/ownership tại thời điểm trận đấu, mốc bắt đầu tracking và ranking change-log được persist; mọi tổng hợp còn lại được derive qua `src/lib/game/statistics.ts` và cache theo reference ở runtime. Fighter Profile và Stats Board dùng cùng index/selectors, còn `currentDate` được truyền vào selector để cache archive không stale khi mùa hiện tại hoặc active title reign thay đổi.

**Tech Stack:** TypeScript 5.8, React 19, Zustand 5, Vite 6, Tailwind CSS 4, i18next typed selector, date-fns, `node:assert/strict`, và root-level tests chạy bằng `npx tsx`.

## Global Constraints

- Archive/history là nguồn sự thật; không persist career totals, leaderboard counters hoặc runtime cache.
- `FightResult.compensation` được chụp trước khi contract bị giảm hoặc xóa và `FightArchiveItem.compensation` là snapshot bất biến.
- Missing compensation/ownership của save cũ nghĩa là unknown, không phải `$0` và không được suy diễn từ contract hiện tại.
- Ranking history lưu display position một-based (`1` là `#1`); `undefined` nghĩa là unranked. Title/champion status vẫn thuộc title history, không được mã hóa vào ranking history.
- Mỗi fighter/scope/promotion/division chỉ có một daily net ranking transition; giữ `previousRank` đầu ngày, thay `rank` cuối ngày, và xóa transition nếu quay về hạng đầu ngày.
- Season hiện tại là từ ngày 1 tháng 1 đến `currentDate` của năm trong game. Year filter không bao giờ bao gồm record sau `currentDate`.
- World scope gồm mọi fight/event; promotion scope chỉ gồm archive có ownership snapshot khớp; international scope chỉ gồm `scope === 'international'`.
- Mọi accuracy/rate có mẫu số 0 hoặc dữ liệu thiếu trả `null`; UI render em dash, không render `NaN`, `Infinity` hoặc số 0 gây hiểu nhầm.
- Mọi sort có tie-break deterministic: metric chính, sample size, tên/ngày, rồi stable ID.
- Stats cache là module-local, không nằm trong Zustand/save. Cache source gồm fighters, promotions, fight/event archive, title history, tournaments, promotion economies và ranking history.
- Không thêm dependency, asset, chart, virtualized table, server pagination hoặc browser automation.
- Không refactor History & Stats hoặc các hệ thống ngoài seam trực tiếp của thống kê.
- Không stage, commit, push, amend, reset, clean hoặc sửa/xóa `.superpowers/`, `assets/`, `belt/` và thay đổi không liên quan.
- Người dùng thực hiện manual visual check; execution chỉ chạy focused tests, impacted regressions, deterministic long sim, lint, build và `git diff --check`.

## Canonical Persisted Interfaces

Thêm đúng trách nhiệm sau vào `src/types/game.ts`:

```ts
export interface FighterFightCompensation {
  fighterId: string;
  promotionIdAtFight: string | null;
  basePurse: number;
  winBonus: number;
  total: number;
}

export type FighterRankingScope = 'promotion' | 'world';

export interface FighterRankingChange {
  id: string;
  date: string;
  fighterId: string;
  scope: FighterRankingScope;
  promotionId?: string;
  weightClass: WeightClass;
  previousRank?: number;
  rank?: number;
}
```

Mở rộng:

```ts
interface FightResult {
  compensation?: FighterFightCompensation[];
}

interface FightArchiveItem {
  compensation?: FighterFightCompensation[];
}

interface GameState {
  statisticsTrackingStartedAt: string;
  fighterRankingHistory: FighterRankingChange[];
}
```

`promotionIdAtFight` dùng `null` cho fighter không có domestic owner tại thời điểm trận. Compensation array luôn theo thứ tự `[red, blue]` ở trận mới. Domestic fight lấy contract terms thực tế; winner nhận win bonus, loser/draw nhận `0`. International event hiện không settlement domestic purse nên ghi payout biết chắc là `0/0/0`, không trừ tiền promotion.

## Canonical Runtime Interfaces

Tạo `src/lib/game/statistics.ts` với public API:

```ts
export type StatisticsPeriod =
  | { kind: 'all-time' }
  | { kind: 'current-season' }
  | { kind: 'year'; year: number };

export type StatisticsScope =
  | { kind: 'world' }
  | { kind: 'promotion'; promotionId: string }
  | { kind: 'international' };

export interface StatisticsFilter {
  period: StatisticsPeriod;
  scope: StatisticsScope;
  weightClass: WeightClass | 'all';
}

export interface FighterTechnicalTotals {
  fightsWithStats: number;
  rounds: number;
  recordedSeconds: number;
  totalStrikesAttempted: number;
  totalStrikesLanded: number;
  significantStrikesAttempted: number;
  significantStrikesLanded: number;
  headStrikesLanded: number;
  bodyStrikesLanded: number;
  legStrikesLanded: number;
  takedownsAttempted: number;
  takedownsLanded: number;
  submissionAttempts: number;
  reversals: number;
  knockdowns: number;
  controlSeconds: number;
  damageGiven: number;
  damageTaken: number;
}

export interface FighterStatistics {
  fighterId: string;
  fights: number;
  wins: number;
  losses: number;
  draws: number;
  koWins: number;
  submissionWins: number;
  decisionWins: number;
  currentWinStreak: number;
  longestWinStreak: number;
  titleFights: number;
  titleWins: number;
  titleDefenses: number;
  trackedEarnings: number;
  trackedFightCount: number;
  technical: FighterTechnicalTotals;
  perFight: FighterFightStatisticsRow[];
  rankingHistory: FighterRankingChange[];
}

export interface StatisticsIndex {
  fighters: Map<string, FighterStatistics>;
  fights: IndexedFight[];
  events: IndexedEvent[];
  promotions: Map<string, IndexedPromotion>;
  titles: IndexedTitleReign[];
  tournaments: IndexedTournament[];
  years: number[];
}

export function getStatisticsIndex(state: GameState): StatisticsIndex;
export function getFighterStatistics(state: GameState, fighterId: string): FighterStatistics;
export function getStatsBoard(state: GameState, filter: StatisticsFilter): StatsBoardData;
```

`getStatisticsIndex()` trả cùng object identity khi toàn bộ source references không đổi và trả object mới khi bất kỳ source reference nào đổi. `getStatsBoard()` truyền `state.currentDate` vào period/title calculations; không nhét `currentDate` vào archive index.

---

### Task 1: Add Statistics Schema, New-Game Initialization, and Idempotent Save Migration

**Files:**
- Modify: `src/types/game.ts:484-537,761-805`
- Modify: `src/lib/game/generator.ts:430-490`
- Modify: `src/lib/game/save.ts:19-24,71-109,126-end`
- Create: `test_statistics_migration.ts`
- Modify: `test_contract_market_migration.ts`
- Modify: `test_multi_league_migration.ts`
- Modify: `test_fighter_career.ts`
- Modify: `test_personality_drama.ts`
- Modify: `test_promotion_economy_migration.ts`

**Interfaces:**
- Produces persisted types and `GameState.statisticsTrackingStartedAt`, `GameState.fighterRankingHistory`.
- Increases `CURRENT_SAVE_VERSION` from `15` to `16` exactly once.

- [ ] **Step 1: Write the failing migration test**

Create `test_statistics_migration.ts`:

```ts
import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { CURRENT_SAVE_VERSION, validateAndMigrateState } from './src/lib/game/save';

const generated = generateInitialWorld(2301);
assert.equal(generated.statisticsTrackingStartedAt, generated.currentDate);
assert.deepEqual(generated.fighterRankingHistory, []);

const legacy = structuredClone(generated) as any;
legacy.saveVersion = 15;
delete legacy.statisticsTrackingStartedAt;
delete legacy.fighterRankingHistory;
for (const fight of Object.values(legacy.fightArchive) as any[]) delete fight.compensation;

const migrated = validateAndMigrateState(legacy)!;
assert.equal(CURRENT_SAVE_VERSION, 16);
assert.equal(migrated.saveVersion, 16);
assert.equal(migrated.statisticsTrackingStartedAt, legacy.currentDate);
assert.deepEqual(migrated.fighterRankingHistory, []);
assert.ok(Object.values(migrated.fightArchive).every(fight => fight.compensation === undefined));

migrated.statisticsTrackingStartedAt = '2025-02-03';
migrated.fighterRankingHistory.push({
  id: 'ranking-world-Lightweight-fighter-a-2025-02-04',
  date: '2025-02-04', fighterId: 'fighter-a', scope: 'world',
  weightClass: 'Lightweight', previousRank: 5, rank: 4
});
assert.deepEqual(validateAndMigrateState(structuredClone(migrated)), migrated);
console.log('Statistics migration checks passed.');
```

- [ ] **Step 2: Run the test and verify RED**

```bash
npx tsx test_statistics_migration.ts
```

Expected: TypeScript/compile failure because the new fields and interfaces do not exist, or assertion failure because generated/migrated state has no tracking fields.

- [ ] **Step 3: Add exact persisted types and initialize new games**

Add the canonical interfaces above. In `generateInitialWorld()` initialize:

```ts
statisticsTrackingStartedAt: initialDate,
fighterRankingHistory: [],
```

Use the generator's existing `initialDate`/`currentDate` value, not wall-clock time.

- [ ] **Step 4: Persist and migrate version 16 idempotently**

Set:

```ts
export const CURRENT_SAVE_VERSION = 16;
```

Add to `extractSaveState()`:

```ts
statisticsTrackingStartedAt: state.statisticsTrackingStartedAt,
fighterRankingHistory: state.fighterRankingHistory,
```

In `validateAndMigrateState()`, after `currentDate` is validated and before assigning current save version:

```ts
if (typeof state.statisticsTrackingStartedAt !== 'string' || Number.isNaN(Date.parse(state.statisticsTrackingStartedAt))) {
  state.statisticsTrackingStartedAt = state.currentDate;
}
if (!Array.isArray(state.fighterRankingHistory)) state.fighterRankingHistory = [];
```

Do not add compensation to old archive rows and do not overwrite valid tracking fields.

- [ ] **Step 5: Update only stale hardcoded version assertions**

Change exact `15` expectations to `16` in the listed migration tests. Keep migration/idempotency assertions unchanged; tests already comparing `CURRENT_SAVE_VERSION` require no semantic change.

- [ ] **Step 6: Verify GREEN**

```bash
npx tsx test_statistics_migration.ts
npx tsx test_contract_market_migration.ts
npx tsx test_multi_league_migration.ts
npx tsx test_fighter_career.ts
npx tsx test_personality_drama.ts
npx tsx test_promotion_economy_migration.ts
```

Expected: all PASS; no pre-existing balance, ownership, title, market, economy or archive value changes.

---

### Task 2: Capture Exact Per-Fight Compensation and Historical Ownership Once

**Files:**
- Modify: `src/lib/engine.ts:404-715,748-984`
- Modify: `src/lib/game/economy.ts:281-395`
- Create: `test_fight_compensation.ts`
- Modify: `test_promotion_economy_events.ts`

**Interfaces:**
- Consumes `FighterFightCompensation` from Task 1.
- Produces:

```ts
export function getFightCompensation(
  state: GameState,
  event: Event,
  fight: FightMatchup,
  result: Pick<FightResult, 'winnerId'>
): FighterFightCompensation[];
```

This helper lives in `src/lib/game/economy.ts` and is the only purse formula used by result capture and aggregate event finance.

- [ ] **Step 1: Write failing domestic/international/idempotency tests**

Create `test_fight_compensation.ts` using `generateInitialWorld(2302)`. Select two same-promotion fighters, set explicit contracts, add one completed-result event, and assert:

```ts
red.contract = { ...red.contract!, promotionId, payPerFight: 12_000, winBonus: 8_000 };
blue.contract = { ...blue.contract!, promotionId, payPerFight: 9_000, winBonus: 5_000 };

const applied = applyFightResult(stateWithEvent, eventId, 0, result, 'en');
assert.deepEqual(applied.events[eventId].fights[0].result!.compensation, [
  { fighterId: red.id, promotionIdAtFight: promotionId, basePurse: 12_000, winBonus: 8_000, total: 20_000 },
  { fighterId: blue.id, promotionIdAtFight: promotionId, basePurse: 9_000, winBonus: 0, total: 9_000 }
]);

const finalized = finalizeEventFinancials(applied, eventId, 'en');
const archived = Object.values(finalized.fightArchive).find(fight => fight.eventId === eventId)!;
assert.deepEqual(archived.compensation, applied.events[eventId].fights[0].result!.compensation);
assert.equal(finalized.events[eventId].results!.fighterBasePay, 21_000);
assert.equal(finalized.events[eventId].results!.fighterWinBonuses, 8_000);
assert.deepEqual(finalizeEventFinancials(finalized, eventId, 'en'), finalized);
```

Also assert:

- changing/removing either contract after `applyFightResult` but before finalization does not alter archived compensation;
- draw gives both fighters `winBonus: 0`;
- rival domestic ownership uses the rival promotion IDs at fight time;
- international event records two known zero payouts and original domestic ownership, while every promotion cash/ledger remains unchanged;
- an old archive row with missing compensation remains missing after finalization of another event.

- [ ] **Step 2: Run and verify RED**

```bash
npx tsx test_fight_compensation.ts
```

Expected: FAIL because `FightResult`/archive contain no compensation and aggregate event finance reads mutable post-fight contracts.

- [ ] **Step 3: Implement one canonical compensation helper**

In `economy.ts`:

```ts
export function getFightCompensation(state: GameState, event: Event, fight: FightMatchup, result: Pick<FightResult, 'winnerId'>): FighterFightCompensation[] {
  return [fight.redCornerId, fight.blueCornerId].map(fighterId => {
    const fighter = state.fighters[fighterId];
    const promotionIdAtFight = fighter?.contract?.promotionId ?? null;
    if (event.scope === 'international') {
      return { fighterId, promotionIdAtFight, basePurse: 0, winBonus: 0, total: 0 };
    }
    const basePurse = fighter?.contract?.payPerFight ?? 0;
    const winBonus = result.winnerId === fighterId ? fighter?.contract?.winBonus ?? 0 : 0;
    return { fighterId, promotionIdAtFight, basePurse, winBonus, total: basePurse + winBonus };
  });
}
```

Values are non-negative finite whole currency amounts. Internal generated contracts guarantee valid values; do not add fallback estimation from current popularity or expectation.

- [ ] **Step 4: Capture before contract mutation**

In `applyFightResult()`, after validating red/blue but before line 484 decrements contracts:

```ts
const compensation = getFightCompensation(state, event, matchup, result);
const capturedResult = { ...result, compensation };
```

Use `capturedResult` for `updatedMatchup.result` and all downstream result references in this action. Do not recalculate later.

- [ ] **Step 5: Make aggregate event finance consume captured values**

In `calculateEventFinancials()`, replace per-fighter contract purse summation with:

```ts
const compensation = fight.result?.compensation ?? getFightCompensation(
  { ...minimalState, fighters } as GameState,
  eventContext,
  fight,
  fight.result ?? { winnerId: null }
);
fighterBasePay += compensation.reduce((sum, item) => sum + item.basePurse, 0);
fighterWinBonuses += compensation.reduce((sum, item) => sum + item.winBonus, 0);
```

Because the existing signature does not carry `Event`, minimally extend it with an optional final `event?: Pick<Event, 'scope'>` argument and pass `newEvent` from `finalizeEventFinancials`. Existing callers remain valid. Prefer a small private helper accepting `fighters`, `scope`, `fight`, and result instead of fabricating `GameState`; public `getFightCompensation()` delegates to it.

- [ ] **Step 6: Archive the captured array in both branches**

Add:

```ts
compensation: fight.result.compensation
```

to international and domestic `FightArchiveItem` creation. Never derive from `newState.fighters` during archive writing.

- [ ] **Step 7: Verify GREEN and economy compatibility**

```bash
npx tsx test_fight_compensation.ts
npx tsx test_promotion_economy_events.ts
npx tsx test_live_fight.ts
npx tsx test_international_competitions.ts
```

Expected: all PASS; domestic aggregate purse totals equal compensation rows and no event settles twice.

---

### Task 3: Record Promotion and World Ranking Daily Net History

**Files:**
- Modify: `src/lib/game/rankings.ts:1-236`
- Modify: `src/lib/engine.ts:270-321,404-715`
- Modify: `src/lib/game/autobooker.ts:1080-1110`
- Modify: `src/lib/game/career.ts:130-170`
- Modify: `src/lib/game/contractMarket.ts:890-925`
- Create: `test_ranking_history.ts`

**Interfaces:**
- Produces:

```ts
export function recordRankingHistory(before: GameState, after: GameState): GameState;
```

`updateRankings()` remains public and must call this helper around its complete before/after ranking mutation.

- [ ] **Step 1: Write failing ranking-history tests**

Create `test_ranking_history.ts` with a small generated state and explicit ranking arrays. Test `recordRankingHistory(before, after)` directly:

```ts
const before = structuredClone(generateInitialWorld(2303));
before.statisticsTrackingStartedAt = before.currentDate;
before.fighterRankingHistory = [];
const promotionId = before.playerPromotionId;
const weightClass = 'Lightweight';
const [a, b] = before.rankingsByPromotion[promotionId][weightClass];
const after = structuredClone(before);
after.rankingsByPromotion[promotionId][weightClass] = [b, a, ...after.rankingsByPromotion[promotionId][weightClass].slice(2)]
after.rankings = after.rankingsByPromotion[promotionId];

const recorded = recordRankingHistory(before, after);
assert.deepEqual(recorded.fighterRankingHistory.filter(item => item.scope === 'promotion' && item.weightClass === weightClass).map(item => [item.fighterId, item.previousRank, item.rank]), [
  [a.fighterId, 1, 2],
  [b.fighterId, 2, 1]
]);
```

Add assertions for:

- world and promotion transitions are separate;
- entering list is `undefined → N`, leaving is `N → undefined`;
- internal `rank: 0` is persisted/displayed as `1`;
- same transition replay is byte-for-byte idempotent;
- second operation on same date preserves first `previousRank` and updates final `rank`;
- return to first rank on the same date removes the daily row;
- different weight classes/promotion IDs never coalesce;
- state date before `statisticsTrackingStartedAt` produces no record;
- `updateRankings()` records a real world and scoped movement caused by a controlled ranking-score change.

- [ ] **Step 2: Run and verify RED**

```bash
npx tsx test_ranking_history.ts
```

Expected: compile failure because `recordRankingHistory()` does not exist or empty history assertion failure.

- [ ] **Step 3: Implement deterministic comparison and daily coalescing**

Create normalized maps from every `rankingsByPromotion[promotionId][weightClass]` and `worldRankings[weightClass]`:

```ts
const positionMap = (items: RankingItem[]) => new Map(items.map(item => [item.fighterId, item.rank + 1]));
const dailyKey = [date, scope, promotionId ?? 'world', weightClass, fighterId].join(':');
const id = `ranking-${dailyKey}`;
```

For every unioned fighter ID whose position differs:

- if no same-day row exists, append `{ previousRank, rank }`;
- if one exists, preserve its `previousRank` and replace `rank`;
- delete it when final `rank === previousRank` (including both undefined);
- sort appended history by `date`, `scope`, `promotionId ?? ''`, `weightClass`, `fighterId` for deterministic equality.

Return `after` unchanged by reference when no history mutation occurs.

- [ ] **Step 4: Wrap `updateRankings()`**

At function entry keep:

```ts
const before = state;
```

At return:

```ts
return recordRankingHistory(before, syncPlayerPromotionSnapshot(newState));
```

- [ ] **Step 5: Cover direct ranking mutations outside `updateRankings()`**

Direct `buildPromotionRankings()`/`buildWorldRankings()` assignments currently occur in engine time advance, per-fight application, autobooker roster maintenance, fighter editing, and transfer settlement. For each location:

```ts
const beforeRankings = candidate;
const ranked = { ...candidate, rankings/... };
candidate = recordRankingHistory(beforeRankings, ranked);
```

Do not replace event Elo logic or rebuild unrelated promotions. In contract-market settlement, call history recording once around the final candidate after seller, buyer and world rankings are all rebuilt so one atomic transfer yields one net transition set.

- [ ] **Step 6: Verify GREEN and ranking regressions**

```bash
npx tsx test_ranking_history.ts
npx tsx test_ranking_context.ts
npx tsx test_scoped_rankings_titles.ts
npx tsx test_contract_market_settlement.ts
npx tsx test_fighter_career.ts
npx tsx test_international_competitions.ts
```

Expected: all PASS and replaying any ranking operation on the same state creates no duplicate daily row.

---

### Task 4: Build the Hybrid Statistics Index and Fighter Selectors

**Files:**
- Create: `src/lib/game/statistics.ts`
- Create: `test_statistics_index.ts`

**Interfaces:**
- Produces canonical runtime interfaces plus:

```ts
export interface FighterFightStatisticsRow {
  id: string;
  date: string;
  eventId: string;
  eventName: string;
  opponentId: string;
  result: 'win' | 'loss' | 'draw';
  method: string;
  round: number;
  time: string;
  elapsedSeconds: number;
  performanceRating: number;
  payout: number | null;
  totalStrikesLanded: number | null;
  totalStrikesAttempted: number | null;
  significantStrikesLanded: number | null;
  significantStrikesAttempted: number | null;
  takedownsLanded: number | null;
  takedownsAttempted: number | null;
  controlSeconds: number | null;
  knockdowns: number | null;
}

export function safeRatio(numerator: number, denominator: number): number | null;
export function getFightElapsedSeconds(round: number, time: string): number;
```

- [ ] **Step 1: Write a hand-calculated failing fixture**

Create `test_statistics_index.ts`. Start from `generateInitialWorld(2304)`, replace archives with two explicit fights for one fighter, one with two `RoundStats` rows and compensation and one legacy row without either. Use explicit round values:

```ts
const round: RoundStats = {
  round: 1,
  red: {
    totalStrikesAttempted: 20, totalStrikesLanded: 10,
    significantStrikesAttempted: 12, significantStrikesLanded: 6,
    headStrikesLanded: 3, bodyStrikesLanded: 2, legStrikesLanded: 1,
    takedownsAttempted: 2, takedownsLanded: 1,
    submissionAttempts: 1, reversals: 0, knockdowns: 1,
    controlSeconds: 45, damageGiven: 30, damageTaken: 12,
    staminaStart: 100, staminaEnd: 80
  },
  blue: {
    totalStrikesAttempted: 10, totalStrikesLanded: 4,
    significantStrikesAttempted: 8, significantStrikesLanded: 3,
    headStrikesLanded: 2, bodyStrikesLanded: 1, legStrikesLanded: 0,
    takedownsAttempted: 1, takedownsLanded: 0,
    submissionAttempts: 0, reversals: 1, knockdowns: 0,
    controlSeconds: 10, damageGiven: 12, damageTaken: 30,
    staminaStart: 100, staminaEnd: 75
  },
  judges: [], redTechnicalScore: 10, blueTechnicalScore: 9,
  summary: '', keyMoments: []
};
```

Assert exact values:

```ts
const first = getStatisticsIndex(state);
const second = getStatisticsIndex(state);
assert.strictEqual(second, first);
assert.notStrictEqual(getStatisticsIndex({ ...state, fightArchive: { ...state.fightArchive } }), first);

const stats = getFighterStatistics(state, fighterId);
assert.equal(stats.fights, 2);
assert.equal(stats.wins, 1);
assert.equal(stats.losses, 1);
assert.equal(stats.trackedEarnings, 20_000);
assert.equal(stats.trackedFightCount, 1);
assert.equal(stats.technical.fightsWithStats, 1);
assert.equal(stats.technical.totalStrikesLanded, 10);
assert.equal(stats.technical.damageGiven, 30);
assert.equal(stats.technical.damageTaken, 12);
assert.equal(stats.perFight.find(row => row.id === 'legacy')!.payout, null);
assert.equal(safeRatio(1, 0), null);
assert.equal(getFightElapsedSeconds(2, '1:30'), 390);
```

Also assert red/blue orientation gives the correct fighter side, current/longest streak uses chronological order, decision classification, title fights/wins/defenses, and ranking history is sorted newest first in fighter output.

- [ ] **Step 2: Run and verify RED**

```bash
npx tsx test_statistics_index.ts
```

Expected: module-not-found failure for `statistics.ts`.

- [ ] **Step 3: Implement normalized index construction**

Implement private source comparison:

```ts
interface StatisticsSources {
  fighters: GameState['fighters'];
  promotions: GameState['promotions'];
  fightArchive: GameState['fightArchive'];
  eventArchive: GameState['eventArchive'];
  titleHistory: GameState['titleHistory'];
  tournaments: GameState['tournaments'];
  promotionEconomies: GameState['promotionEconomies'];
  fighterRankingHistory: GameState['fighterRankingHistory'];
}
```

Keep `let cachedSources` and `let cachedIndex` module-local. Compare all fields with `===`. Build maps in one pass per collection. Do not clone source arrays into save state or expose mutable source objects through output rows.

- [ ] **Step 4: Implement time and side aggregation exactly**

Parse elapsed time:

```ts
const [minutes, seconds] = time.split(':').map(Number);
return Math.max(0, (round - 1) * 300 + minutes * 60 + seconds);
```

For each fighter in a fight, choose `round.red` or `round.blue`, sum every technical field, and count the fight in technical denominators only when `roundStats?.length` is positive. Earnings lookup uses:

```ts
const payout = fight.compensation?.find(item => item.fighterId === fighterId)?.total ?? null;
```

No compensation means `null`, including when other participant compensation exists but this fighter row is absent.

- [ ] **Step 5: Derive streak/title values without current fighter record**

Sort fights ascending by `date`, then `id` for streaks. A draw/loss resets winning streak. Derive title fights from archive. Derive title wins/defenses from matching title-history/fight `titleChangeInfo`; do not use current `fighter.titleDefenses` for period/career archive totals.

- [ ] **Step 6: Verify GREEN**

```bash
npx tsx test_statistics_index.ts
npx tsx test_fighter_achievements.ts
npx tsx test_live_fight.ts
```

Expected: all PASS and index identity changes only after a source reference replacement.

---

### Task 5: Add Period/Scope Filters and Six Stats Board Domains

**Files:**
- Modify: `src/lib/game/statistics.ts`
- Create: `test_statistics_board.ts`

**Interfaces:**
- Produces:

```ts
export interface StatsBoardData {
  years: number[];
  fighterLeaders: {
    wins: FighterLeaderRow[];
    winPercentage: FighterLeaderRow[];
    koWins: FighterLeaderRow[];
    submissionWins: FighterLeaderRow[];
    currentStreak: FighterLeaderRow[];
    longestStreak: FighterLeaderRow[];
    titleDefenses: FighterLeaderRow[];
    trackedEarnings: FighterLeaderRow[];
    strikingAccuracy: FighterLeaderRow[];
    takedownAccuracy: FighterLeaderRow[];
    knockdowns: FighterLeaderRow[];
    controlTime: FighterLeaderRow[];
  };
  fightRecords: FightRecordRow[];
  events: EventStatisticsRow[];
  promotions: PromotionStatisticsRow[];
  titles: TitleStatisticsRow[];
  tournaments: TournamentStatisticsRow[];
}
```

Every row has stable `id`. Fighter/fight rows include IDs required for navigation. Percentage rows include numerator, denominator and sample size; UI never recomputes metrics.

- [ ] **Step 1: Write the failing multi-domain fixture**

Create `test_statistics_board.ts` with two promotions, one international event, fights in 2025/2026 across two weight classes, one active and one completed title reign, two tournament types and explicit economy ledger rows. Assert:

```ts
const world = getStatsBoard(state, {
  period: { kind: 'all-time' }, scope: { kind: 'world' }, weightClass: 'all'
});
const player2025 = getStatsBoard(state, {
  period: { kind: 'year', year: 2025 },
  scope: { kind: 'promotion', promotionId: state.playerPromotionId },
  weightClass: 'Lightweight'
});
const international = getStatsBoard(state, {
  period: { kind: 'all-time' }, scope: { kind: 'international' }, weightClass: 'all'
});

assert.equal(world.fighterLeaders.wins[0].value, expectedWorldWins);
assert.ok(player2025.fighterLeaders.wins.every(row => row.weightClass === 'Lightweight'));
assert.ok(international.fightRecords.every(row => row.scope === 'international'));
assert.ok(player2025.promotions.every(row => row.promotionId === state.playerPromotionId));
```

Cover all rules:

- current-season excludes prior years and any future-dated row after `currentDate`;
- unknown historical ownership is present in world but absent from a specific promotion;
- fighter transferred later remains attributed to `promotionIdAtFight`;
- international filter uses fight/event/tournament scope, not current ownership;
- win percentage and accuracy require exported thresholds `MIN_WIN_PERCENTAGE_FIGHTS = 3`, `MIN_ACCURACY_ATTEMPTS = 20`;
- fastest/longest/highest-rating/knockdown/significant-strike/takedown/control records are exact;
- event attendance/revenue/profit/loss/rating and finish/title counts are exact;
- promotion flow totals use period-filtered archive/ledger, while liabilities are marked `snapshot: true`;
- active title reign ends at `currentDate`; completed reign ends at `dateLost`;
- tournament appearances/championships/rating/finish rate separate domestic GP, Champions Cup and Challenge Cup;
- same metric ties sort by sample size, name/date, then ID.

- [ ] **Step 2: Run and verify RED**

```bash
npx tsx test_statistics_board.ts
```

Expected: compile failure because `getStatsBoard()` and row types/domains do not exist.

- [ ] **Step 3: Implement one shared filter predicate**

```ts
function inPeriod(date: string, period: StatisticsPeriod, currentDate: string): boolean {
  if (date > currentDate) return false;
  if (period.kind === 'all-time') return true;
  const year = period.kind === 'current-season'
    ? new Date(currentDate).getFullYear()
    : period.year;
  return date >= `${year}-01-01` && date <= `${year}-12-31`;
}
```

Fight scope predicate:

```ts
world => true
international => fight.scope === 'international'
promotion => fight.scope !== 'international' &&
  fight.compensation?.some(item => item.promotionIdAtFight === promotionId) === true
```

Apply weight class after period/scope. Event/title/tournament scope uses their archived `scope`/`promotionId`; do not inspect current fighter contract.

- [ ] **Step 4: Derive fighter and fight boards from filtered fights**

Reuse one internal aggregator over the filtered `IndexedFight[]`; do not filter career totals already built for all-time. Export thresholds and attach disclosure metadata to affected leaderboards. Fight records return separate category arrays or one discriminated `category` union; choose one representation and make `StatsBoard.tsx` consume it directly without recategorizing metrics.

- [ ] **Step 5: Derive event, promotion, title and tournament boards**

Event rating uses archived `fanReaction`. Promotion revenue/cost/profit and fighter pay use archive values and economy ledger rows within the period. Current liabilities use `promotionEconomies[promotionId].outstandingLiabilities` and set `snapshot: true`.

Title reign days use date-fns `differenceInCalendarDays(end, dateWon)`. Tournament rating is the average performance rating of linked archived fights; return `null` when no linked fight has a rating. Tournament type derives from `internationalTier` or domestic `format`.

- [ ] **Step 6: Verify GREEN**

```bash
npx tsx test_statistics_board.ts
npx tsx test_statistics_index.ts
npx tsx test_promotion_economy_events.ts
npx tsx test_tournament.ts
npx tsx test_international_competitions.ts
```

Expected: all PASS with no selector reading current ownership for historical attribution.

---

### Task 6: Add One Accessible Sortable Statistics Table Primitive

**Files:**
- Create: `src/components/StatisticsTable.tsx`
- Modify: `test_ui_contracts.ts`

**Interfaces:**
- Produces:

```ts
export interface StatisticsColumn<Row> {
  id: string;
  label: string;
  sortValue: (row: Row) => string | number | null;
  render: (row: Row) => ReactNode;
  numeric?: boolean;
  className?: string;
}

export interface StatisticsTableProps<Row extends { id: string }> {
  caption: string;
  rows: Row[];
  columns: StatisticsColumn<Row>[];
  initialSort: { columnId: string; direction: 'asc' | 'desc' };
  emptyLabel: string;
  showMoreLabel: string;
  initialLimit?: number;
  minWidthClass?: string;
}
```

- [ ] **Step 1: Add failing source-contract assertions**

Extend `test_ui_contracts.ts`:

```ts
const statisticsTable = readFileSync('src/components/StatisticsTable.tsx', 'utf8');
for (const token of [
  '<table', '<caption', '<thead', '<tbody', 'scope="col"', 'aria-sort',
  'type="button"', 'overflow-x-auto', 'whitespace-nowrap', 'initialLimit',
  'showMoreLabel', 'emptyLabel', 'min-h-11'
]) assert.ok(statisticsTable.includes(token), `Statistics table missing ${token}`);
assert.doesNotMatch(statisticsTable, /role="button"[^>]*<tr|<tr[^>]*role="button"/);
```

- [ ] **Step 2: Run and verify RED**

```bash
npx tsx test_ui_contracts.ts
```

Expected: ENOENT because `StatisticsTable.tsx` does not exist.

- [ ] **Step 3: Implement controlled internal sorting**

Use local sort and expanded state. Header shape:

```tsx
<th scope="col" aria-sort={active ? direction === 'asc' ? 'ascending' : 'descending' : 'none'}>
  <button type="button" onClick={() => changeSort(column.id)} className="min-h-11 ...">
    {column.label}<SortIcon ... />
  </button>
</th>
```

Comparator behavior:

- `null` always sorts last;
- number compares numerically;
- string uses `localeCompare`;
- tie uses `row.id.localeCompare()`;
- never mutates `rows`.

Render `<caption className="sr-only">`, native cells, horizontal scroll and `whitespace-nowrap` only on numeric cells. `Show more` expands to all rows. Navigable fighter/fight names are explicit buttons supplied by column render callbacks; the table never makes `<tr>` interactive.

- [ ] **Step 4: Verify GREEN and type safety**

```bash
npx tsx test_ui_contracts.ts
npm run lint
```

Expected: both PASS.

---

### Task 7: Add the Fighter Profile Statistics Tab

**Files:**
- Create: `src/components/FighterStatistics.tsx`
- Modify: `src/pages/FighterDetail.tsx:23-32,58-133,278-405`
- Modify: `src/i18n/resources/en.ts`
- Modify: `src/i18n/resources/vi.ts`
- Modify: `test_ui_contracts.ts`
- Modify: `test_i18n.ts`

**Interfaces:**
- Consumes `getFighterStatistics()`, `StatisticsTable`, `statisticsTrackingStartedAt`, `setView('fight-detail', { fightArchiveId })`.
- Produces:

```tsx
export function FighterStatistics({ fighterId }: { fighterId: string }): React.ReactElement;
```

- [ ] **Step 1: Add failing Fighter Statistics UI contracts**

Extend `test_ui_contracts.ts`:

```ts
const fighterStatistics = readFileSync('src/components/FighterStatistics.tsx', 'utf8');
for (const token of [
  'getFighterStatistics', 'StatisticsTable', 'statisticsTrackingStartedAt',
  '$.fighterDetail.statistics.career', '$.fighterDetail.statistics.striking',
  '$.fighterDetail.statistics.grappling', '$.fighterDetail.statistics.perFight',
  '$.fighterDetail.statistics.rankingHistory', "setView('fight-detail'",
  'formatCurrency', 'formatDate', 'formatFightMethod'
]) assert.ok(fighterStatistics.includes(token), `Fighter Statistics missing ${token}`);
assert.ok(fighterDetail.includes("{ id: 'statistics' }"));
assert.ok(fighterDetail.includes("activeTab === 'statistics'"));
```

Extend i18n parity checks by relying on the existing full EN/VI key-tree equality and translated-page scanner.

- [ ] **Step 2: Run and verify RED**

```bash
npx tsx test_ui_contracts.ts
npx tsx test_i18n.ts
```

Expected: ENOENT/missing Statistics tab and translation failures.

- [ ] **Step 3: Add matching EN/VI keys first**

Add `fighterDetail.tabs.statistics` and one matching `fighterDetail.statistics` tree containing:

- section titles/descriptions;
- career labels: fights, wins, losses, draws, win rate, KO, submissions, decisions, current/longest streak, title fights/wins/defenses, tracked earnings;
- striking/grappling columns and total/per-fight/per-15-minute labels;
- per-fight date/event/opponent/result/method/round/time/strikes/takedowns/control/knockdowns/rating/payout;
- ranking date/scope/promotion/division/previous/new/unranked;
- `trackedSince`, `unknown`, `empty`, `showMore`.

Use equivalent natural Vietnamese copy and identical object keys.

- [ ] **Step 4: Build the component from selector output only**

Render:

1. Career summary cards.
2. One striking table with total, per-fight and per-15-minute rows.
3. One grappling table with total and normalized rows.
4. Sortable per-fight table whose opponent/fight action is a native button.
5. Sortable ranking-history table.
6. “Tracked since {date}” next to earnings/ranking sections.

Create local formatters:

```ts
const percent = (value: number | null) => value === null ? '—' : `${(value * 100).toFixed(1)}%`;
const numberOrDash = (value: number | null) => value === null ? '—' : formatNumber(value, language);
```

Use existing localization formatters; do not duplicate locale math in selectors.

- [ ] **Step 5: Wire one new tab without moving existing content**

Add `{ id: 'statistics' }` after `fights`, translate it in `tabLabels`, and render:

```tsx
{activeTab === 'statistics' && <FighterStatistics fighterId={f.id} />}
```

Keep Overview, Fights and Timeline behavior unchanged. The tab keyboard loop automatically includes the new static `tabs` member.

- [ ] **Step 6: Verify GREEN**

```bash
npx tsx test_ui_contracts.ts
npx tsx test_i18n.ts
npx tsx test_statistics_index.ts
npm run lint
npm run build
```

Expected: all PASS. No browser automation; user manually inspects wrapping, horizontal scroll and tab navigation.

---

### Task 8: Add Stats Board Page, Six Domain Tabs, Filters, Routing, Navigation and i18n

**Files:**
- Create: `src/pages/StatsBoard.tsx`
- Modify: `src/store/gameStore.ts:49`
- Modify: `src/App.tsx:11-28,59-85`
- Modify: `src/components/AppShell.tsx:29-61,86-106`
- Modify: `src/i18n/resources/en.ts`
- Modify: `src/i18n/resources/vi.ts`
- Modify: `test_ui_contracts.ts`
- Modify: `test_i18n.ts`

**Interfaces:**
- Produces `GameView = ... | 'stats-board'`.
- Consumes `getStatsBoard()`, `StatisticsFilter`, `StatisticsTable`, `Select`, `setView()`.

- [ ] **Step 1: Add failing route/page/i18n contracts**

Extend `test_ui_contracts.ts`:

```ts
const statsBoard = readFileSync('src/pages/StatsBoard.tsx', 'utf8');
for (const token of [
  'getStatsBoard', 'StatisticsTable', 'StatisticsFilter',
  '$.statsBoard.tabs.fighters', '$.statsBoard.tabs.fights', '$.statsBoard.tabs.events',
  '$.statsBoard.tabs.promotions', '$.statsBoard.tabs.titles', '$.statsBoard.tabs.tournaments',
  "kind: 'world'", "kind: 'promotion'", "kind: 'international'",
  "kind: 'current-season'", "kind: 'year'", "weightClass: 'all'",
  "setView('fighter-detail'", "setView('fight-detail'", 'role="tablist"',
  'aria-selected', 'StatisticsTable'
]) assert.ok(statsBoard.includes(token), `Stats Board missing ${token}`);
assert.ok(app.includes("case 'stats-board'"));
assert.ok(shell.includes("view: 'stats-board'"));
assert.ok(shell.includes("case 'stats-board'"));
```

- [ ] **Step 2: Run and verify RED**

```bash
npx tsx test_ui_contracts.ts
npx tsx test_i18n.ts
```

Expected: ENOENT/missing route, nav and translations.

- [ ] **Step 3: Add route and Records navigation**

Lazy-load `StatsBoard`, add switch case, add `GameView`, add Records nav item using an existing Lucide table/bar icon, and translate `navigation.statsBoard`. Place it adjacent to History & Stats; do not replace History & Stats.

- [ ] **Step 4: Add the shared filter bar**

Local state defaults exactly to:

```ts
const [filter, setFilter] = useState<StatisticsFilter>({
  period: { kind: 'all-time' },
  scope: { kind: 'world' },
  weightClass: 'all'
});
```

Use `Select` controls with visible `<label>`/associated descriptions for period, scope and weight class. Period options are All-time, Current season and every `board.years` value descending. Scope options are World, each promotion and International. Filter state is not persisted.

- [ ] **Step 5: Render six keyboard-accessible tabs**

Use static union:

```ts
type StatsBoardTab = 'fighters' | 'fights' | 'events' | 'promotions' | 'titles' | 'tournaments';
```

Implement native tablist semantics and ArrowLeft/ArrowRight/Home/End behavior matching FighterDetail. Each tab renders bounded `StatisticsTable` instances directly from the relevant `StatsBoardData` domain:

- Fighters: wins, win %, KO, submissions, streaks, defenses, earnings, striking/takedown accuracy, knockdowns, control.
- Fights: rating, fastest, longest, knockdowns, significant strikes, takedowns, control.
- Events: attendance, revenue, profit/loss, rating, event/fight totals, finish rate, title fights.
- Promotions: archive flow metrics and clearly marked current liabilities snapshot.
- Titles: longest reign, defenses, title wins, domestic/international lineage.
- Tournaments: fighter/promotion appearances and wins, rating, fights, finish rate, tournament type.

Do not add comeback table unless selector data includes the deterministic judges-score definition from Task 5. If fixture proves no reliable definition, omit it exactly as allowed by the spec.

- [ ] **Step 6: Add exact EN/VI resource trees**

Add matching:

```ts
navigation: { statsBoard: 'Stats Board' },
statsBoard: {
  eyebrow, title, description,
  filters: { period, scope, weightClass, allTime, currentSeason, year, world, international, allWeights },
  tabs: { fighters, fights, events, promotions, titles, tournaments },
  common: { rank, fighter, fight, event, promotion, value, sample, unknown, currentSnapshot, trackedSince, showMore, empty },
  fighters: { ...all leaderboard titles/columns/disclosures... },
  fights: { ...all record titles/columns... },
  events: { ...all event metric titles/columns... },
  promotions: { ...all promotion metric titles/columns... },
  titles: { ...all reign/lineage titles/columns... },
  tournaments: { ...all tournament titles/columns/types... }
}
```

Every key referenced by JSX exists in both languages; do not use raw English domain labels in JSX.

- [ ] **Step 7: Verify GREEN**

```bash
npx tsx test_ui_contracts.ts
npx tsx test_i18n.ts
npx tsx test_statistics_board.ts
npm run lint
npm run build
```

Expected: all PASS; page is code-split by existing `React.lazy` pattern.

---

### Task 9: Add Deterministic Multi-Season Statistics Acceptance

**Files:**
- Create: `test_statistics_long_sim.ts`
- Modify: `test_long_sim.ts` diagnostics only
- Modify only production files directly implicated by a focused reproducer.

**Interfaces:**
- Consumes all previous tasks.
- Produces five-season proof for compensation, ranking history, cache/selector determinism and existing ecosystem invariants.

- [ ] **Step 1: Create the long-sim script using existing orchestration**

Copy the deterministic RNG/crypto and `advanceOneDay()` orchestration from `test_promotion_economy_long_sim.ts`; do not invent a shorter simulation path. Run two copies of `generateInitialWorld(2309)` for 1,825 days.

Add validators:

```ts
const validateStatisticsState = (state: GameState): string[] => {
  const errors: string[] = [];
  const rankingIds = new Set<string>();
  const rankingDailyKeys = new Set<string>();
  for (const item of state.fighterRankingHistory) {
    if (rankingIds.has(item.id)) errors.push(`duplicate-ranking-id:${item.id}`);
    rankingIds.add(item.id);
    const key = [item.date, item.scope, item.promotionId ?? 'world', item.weightClass, item.fighterId].join(':');
    if (rankingDailyKeys.has(key)) errors.push(`duplicate-ranking-day:${key}`);
    rankingDailyKeys.add(key);
    if (item.previousRank !== undefined && item.previousRank < 1) errors.push(`invalid-previous-rank:${item.id}`);
    if (item.rank !== undefined && item.rank < 1) errors.push(`invalid-rank:${item.id}`);
    if (item.previousRank === item.rank) errors.push(`noop-ranking-change:${item.id}`);
  }
  for (const fight of Object.values(state.fightArchive)) {
    if (fight.date < state.statisticsTrackingStartedAt) continue;
    if (!fight.compensation || fight.compensation.length !== 2) errors.push(`missing-compensation:${fight.id}`);
    for (const item of fight.compensation ?? []) {
      if (![item.basePurse, item.winBonus, item.total].every(Number.isFinite)) errors.push(`invalid-compensation:${fight.id}:${item.fighterId}`);
      if (item.basePurse < 0 || item.winBonus < 0 || item.total !== item.basePurse + item.winBonus) errors.push(`compensation-total:${fight.id}:${item.fighterId}`);
    }
  }
  return errors;
};
```

At yearly checkpoints assert existing economy, market, calendar, tournament, title and ownership validators plus `validateStatisticsState()` are empty.

- [ ] **Step 2: Prove deterministic output and selector stability**

Compact both runs:

```ts
const compact = (state: GameState) => ({
  currentDate: state.currentDate,
  fightCompensation: Object.fromEntries(Object.entries(state.fightArchive).map(([id, fight]) => [id, fight.compensation])),
  fighterRankingHistory: state.fighterRankingHistory,
  allTimeBoard: getStatsBoard(state, { period: { kind: 'all-time' }, scope: { kind: 'world' }, weightClass: 'all' })
});
assert.deepEqual(compact(runA), compact(runB));
assert.strictEqual(getStatisticsIndex(runA), getStatisticsIndex(runA));
```

Require coverage:

- at least 100 archived fights with exact compensation;
- player and at least one rival promotion appear in `promotionIdAtFight`;
- at least one international zero-payout compensation snapshot;
- at least 100 ranking transitions across promotion/world scopes;
- at least two calendar years available in board filters;
- every six Stats Board domains has at least one row;
- no selector result contains `NaN` or `Infinity` after `JSON.stringify`/recursive finite check.

- [ ] **Step 3: Run and observe first meaningful RED**

```bash
npx tsx test_statistics_long_sim.ts
```

Expected after prior tasks: PASS or one precise invariant/coverage failure. Do not weaken thresholds before proving the production path actually ran; if a stochastic coverage threshold is inappropriate for the deterministic seed, choose the smallest deterministic fixture seed adjustment and document it in the test.

- [ ] **Step 4: Fix acceptance gaps through focused TDD only**

For every failure, add a minimal reproducer to `test_fight_compensation.ts`, `test_ranking_history.ts`, `test_statistics_index.ts` or `test_statistics_board.ts`; observe RED, fix the directly implicated production logic, verify focused GREEN, then rerun long sim. Never patch only the long test or unrelated sporting simulation.

- [ ] **Step 5: Add compact diagnostics to general long sim**

Import `validateStatisticsState` only if moved to a reusable test helper; otherwise duplicate the small pure validator in `test_long_sim.ts`. Add counts for missing/invalid compensation and duplicate/no-op ranking history. Preserve every existing report/invariant.

- [ ] **Step 6: Verify long simulations**

```bash
npx tsx test_statistics_long_sim.ts
npx tsx test_promotion_economy_long_sim.ts
npx tsx test_contract_market_long_sim.ts
npx tsx test_long_sim.ts
```

Expected: all PASS deterministically.

---

### Task 10: Run Consolidated Verification and Scope Audit

**Files:**
- Modify only files directly implicated by a reproducible failing focused test.
- Do not stage, commit, push, discard or rewrite any file.

- [ ] **Step 1: Run all focused statistics tests**

```bash
npx tsx test_statistics_migration.ts
npx tsx test_fight_compensation.ts
npx tsx test_ranking_history.ts
npx tsx test_statistics_index.ts
npx tsx test_statistics_board.ts
npx tsx test_statistics_long_sim.ts
npx tsx test_ui_contracts.ts
npx tsx test_i18n.ts
```

Expected: all PASS.

- [ ] **Step 2: Run impacted event, ranking, promotion and tournament regressions**

```bash
npx tsx test_promotion_economy_events.ts
npx tsx test_promotion_economy_migration.ts
npx tsx test_ranking_context.ts
npx tsx test_scoped_rankings_titles.ts
npx tsx test_contract_market_settlement.ts
npx tsx test_contract_market_integration.ts
npx tsx test_multi_league_migration.ts
npx tsx test_rival_promotions.ts
npx tsx test_rival_simulation.ts
npx tsx test_international_competitions.ts
npx tsx test_tournament.ts
npx tsx test_fighter_achievements.ts
npx tsx test_fighter_career.ts
npx tsx test_live_fight.ts
npx tsx test_autopilot_async.ts
```

Expected: all PASS. Một failure tiền tồn tại, reproducible và không liên quan phải được báo riêng thay vì sửa ngoài phạm vi.

- [ ] **Step 3: Run deterministic long regressions**

```bash
npx tsx test_statistics_long_sim.ts
npx tsx test_promotion_economy_long_sim.ts
npx tsx test_contract_market_long_sim.ts
npx tsx test_long_sim.ts
```

Expected: all PASS; no duplicate settlement/ranking history and no compensation drift.

- [ ] **Step 4: Run static and production checks**

```bash
npm run lint
npm run build
git diff --check
```

Expected: TypeScript exits 0, Vite production build succeeds, and `git diff --check` prints no output.

- [ ] **Step 5: Audit working-tree and scope safety**

```bash
git status --short
git diff --stat
```

Expected:

- only statistics spec/plan, focused tests, exact schema/engine/ranking/statistics/UI/i18n integration files are modified;
- `.superpowers/`, `assets/`, `belt/` remain untouched/untracked;
- no dependency/lockfile or asset was added;
- no file is staged;
- no commit/push/browser automation occurred;
- History & Stats and unrelated gameplay behavior were not refactored.

## Deferred

- Charts, trend graphs and third-party visualization libraries.
- Historical purse/ranking estimation before `statisticsTrackingStartedAt`.
- Persisted aggregate counters, database analytics, server pagination and table virtualization.
- Betting odds, prediction models and popularity-based comeback detection.
- Partial cache invalidation/revision counters until profiling demonstrates that complete index rebuilds are too slow.
