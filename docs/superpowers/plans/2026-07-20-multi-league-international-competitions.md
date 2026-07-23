# Multi-League and International Competitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-promotion world into one player-managed promotion plus AI rival promotions whose domestic champions and ranked contenders qualify for neutral international Grand Prix competitions and international belts.

**Architecture:** Keep the existing top-level `promotion`, `rankings`, `titles`, and `belts` fields as the player-promotion compatibility view so the current manager UI and economy remain stable. Add canonical promotion collections and promotion-scoped rankings/titles/belts, tag contracts and competition records with ownership, then reuse the existing fight and Grand Prix engines for lightweight rival events and neutral international tournaments. Deliver each task as a runnable slice; do not begin international competition work until save migration and scoped title behavior are green.

**Tech Stack:** TypeScript 5.8, React 19, Zustand 5, Vite 6, i18next, date-fns, existing seeded fight simulator, root-level `node:assert/strict` tests executed with `tsx`.

## Global Constraints

- The player manages exactly one promotion; every other domestic promotion is AI-controlled.
- International competitions are neutral and never own a domestic roster, domestic ranking, sponsor deal, media deal, or finance ledger.
- Preserve `GameState.promotion`, `rankings`, `titles`, and `belts` as the player-promotion compatibility view for this MVP.
- Existing version-12 saves must migrate without losing fighters, contracts, events, archives, rankings, champions, belts, or tournaments.
- Do not add assets or dependencies.
- Do not refactor unrelated systems.
- Do not add rival-promotion finances, transfer bidding, media markets, sponsor markets, or player control of AI promotions.
- Do not run Playwright or browser automation; the user performs visual checks.
- Do not stage or commit changes.
- Verification is focused `npx tsx` tests, `npm run lint`, `npm run build`, and `git diff --check`.

## Delivery Sequence

1. **Foundation:** save-safe league identity and promotion ownership with no gameplay change.
2. **Domestic scope:** independent rankings, titles, belts, and champion state per promotion.
3. **Rival world:** two deterministic AI promotions using fighters from the existing world pool.
4. **Rival simulation:** one lightweight four-fight event per AI promotion every six weeks.
5. **International layer:** annual Champions Cup and Challenge Cup qualification, neutral tournaments, and international belts.
6. **Player visibility:** a Leagues page plus domestic/international tournament filters.

Each numbered task below is an independently testable delivery gate. Stop and fix failures before moving to the next task.

---

### Task 1: Add Promotion Ownership and Player Compatibility Helpers

**Files:**
- Modify: `src/types/game.ts:119-127,199-206,339-416,486-493,582-615,688-717`
- Create: `src/lib/game/leagues.ts`
- Modify: `src/lib/game/generator.ts:213-428`
- Modify: `src/store/gameStore.ts:493-559,712-795`
- Modify: `src/lib/game/autobooker.ts:360-390`
- Modify: `src/lib/game/observer.ts:20-45`
- Modify: `src/lib/game/tournament.ts:620-660,930-960`
- Test: `test_multi_league_foundation.ts`
- Test: contract literals in existing root `test_*.ts` files reported by `npm run lint`

**Interfaces:**
- Consumes: existing `GameState`, `Promotion`, `Fighter`, `Contract`, `RankingItem`, `WeightClassTitleState`, and `BeltInfo`.
- Produces:

```ts
export type PromotionControl = 'player' | 'ai';
export type CompetitionScope = 'promotion' | 'international';

export function getPlayerPromotionId(state: Pick<GameState, 'playerPromotionId' | 'promotion'>): string;
export function getFighterPromotionId(fighter: Fighter): string | null;
export function isFighterInPromotion(fighter: Fighter, promotionId: string): boolean;
export function getScopedRankings(state: GameState, promotionId: string): Record<WeightClass, RankingItem[]>;
export function getScopedTitles(state: GameState, promotionId: string): Record<WeightClass, WeightClassTitleState>;
export function getScopedBelts(state: GameState, promotionId: string): Record<string, BeltInfo>;
export function syncPlayerPromotionSnapshot(state: GameState): GameState;
```

- [ ] **Step 1: Write the failing foundation test**

Create `test_multi_league_foundation.ts`:

```ts
import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { getFighterPromotionId, getPlayerPromotionId, getScopedRankings } from './src/lib/game/leagues';

const state = generateInitialWorld(1801);
const playerPromotionId = getPlayerPromotionId(state);

assert.equal(state.promotions[playerPromotionId].control, 'player');
assert.equal(state.promotion.id, playerPromotionId);
assert.deepEqual(state.rankings, getScopedRankings(state, playerPromotionId));
for (const fighter of Object.values(state.fighters)) {
  if (fighter.contract) assert.equal(getFighterPromotionId(fighter), playerPromotionId);
}

console.log('Multi-league foundation checks passed.');
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx tsx test_multi_league_foundation.ts
```

Expected: FAIL because `src/lib/game/leagues.ts`, `playerPromotionId`, and `promotions` do not exist.

- [ ] **Step 3: Add exact ownership fields**

In `src/types/game.ts`, add and modify these shapes:

```ts
export type PromotionControl = 'player' | 'ai';
export type CompetitionScope = 'promotion' | 'international';

export interface Contract {
  promotionId: string;
  fightsRemaining: number;
  payPerFight: number;
  winBonus: number;
  exclusivity: boolean;
  endDate: string;
  lastNegotiationDate?: string;
  counterOffer?: ContractCounterOffer;
}

export interface Promotion {
  id: string;
  name: string;
  shortName: string;
  money: number;
  reputation: number;
  fanbase: number;
  control: PromotionControl;
  nextAiEventDate?: string;
}
```

Add ownership to persisted competition records:

```ts
promotionId: string | null;
scope: CompetitionScope;
```

Add both fields to `Event`, `FightArchiveItem`, and `EventArchiveItem`. Add `promotionId: string | null`, `scope: CompetitionScope`, and `beltId?: string` to `TitleHistoryItem`. Add `promotionId: string | null` to `BeltInfo`. Add `promotionId: string | null` and `scope: CompetitionScope` to `GrandPrixTournament`.

Add canonical collections while retaining the player aliases:

```ts
export interface GameState {
  currentDate: string;
  playerPromotionId: string;
  promotions: Record<string, Promotion>;
  promotion: Promotion;
  fighters: Record<string, Fighter>;
  events: Record<string, Event>;
  venues: Record<string, Venue>;
  rankingsByPromotion: Record<string, Record<WeightClass, RankingItem[]>>;
  titlesByPromotion: Record<string, Record<WeightClass, WeightClassTitleState>>;
  beltsByPromotion: Record<string, Record<string, BeltInfo>>;
  worldRankings: Record<WeightClass, RankingItem[]>;
  rankings: Record<WeightClass, RankingItem[]>;
  titles: Record<WeightClass, WeightClassTitleState>;
  belts: Record<string, BeltInfo>;
  // retain the remaining existing fields unchanged
}
```

- [ ] **Step 4: Implement the smallest ownership helper**

Create `src/lib/game/leagues.ts`:

```ts
import type { BeltInfo, Fighter, GameState, RankingItem, WeightClass, WeightClassTitleState } from '../../types/game';

export function getPlayerPromotionId(state: Pick<GameState, 'playerPromotionId' | 'promotion'>): string {
  return state.playerPromotionId || state.promotion.id;
}

export function getFighterPromotionId(fighter: Fighter): string | null {
  return fighter.contract?.promotionId ?? null;
}

export function isFighterInPromotion(fighter: Fighter, promotionId: string): boolean {
  return fighter.careerPhase !== 'retired' && fighter.contract?.promotionId === promotionId;
}

export function getScopedRankings(state: GameState, promotionId: string): Record<WeightClass, RankingItem[]> {
  return promotionId === getPlayerPromotionId(state) ? state.rankings : state.rankingsByPromotion[promotionId];
}

export function getScopedTitles(state: GameState, promotionId: string): Record<WeightClass, WeightClassTitleState> {
  return promotionId === getPlayerPromotionId(state) ? state.titles : state.titlesByPromotion[promotionId];
}

export function getScopedBelts(state: GameState, promotionId: string): Record<string, BeltInfo> {
  return promotionId === getPlayerPromotionId(state) ? state.belts : state.beltsByPromotion[promotionId];
}

export function syncPlayerPromotionSnapshot(state: GameState): GameState {
  const promotionId = getPlayerPromotionId(state);
  return {
    ...state,
    promotions: { ...state.promotions, [promotionId]: state.promotion },
    rankingsByPromotion: { ...state.rankingsByPromotion, [promotionId]: state.rankings },
    titlesByPromotion: { ...state.titlesByPromotion, [promotionId]: state.titles },
    beltsByPromotion: { ...state.beltsByPromotion, [promotionId]: state.belts }
  };
}
```

The player aliases remain authoritative for existing manager code. New scoped systems must call these helpers rather than reading rival data through player aliases.

- [ ] **Step 5: Initialize ownership in the world generator**

Move promotion creation before contracts in `generateInitialWorld`, set `control: 'player'`, add `promotionId: promotion.id` to every generated contract, and tag generated belts/history:

```ts
const promotion: Promotion = {
  id: uuidv4(),
  name: 'Cage Dynasty',
  shortName: 'CD',
  money: 250000,
  reputation: 20,
  fanbase: 1000,
  control: 'player'
};
```

Initialize the new state fields:

```ts
playerPromotionId: promotion.id,
promotions: { [promotion.id]: promotion },
rankingsByPromotion: { [promotion.id]: rankings },
titlesByPromotion: { [promotion.id]: titles },
beltsByPromotion: { [promotion.id]: belts },
worldRankings: rankings,
```

After initial ranking generation, return:

```ts
return syncPlayerPromotionSnapshot(syncLegacyNewsToSocialFeed(ensureSeasonObjectives(initialState, 2025)));
```

- [ ] **Step 6: Tag all newly created player-owned records**

Use `getPlayerPromotionId(state)` in the existing contract constructors in `gameStore.ts`, `autobooker.ts`, `observer.ts`, and `tournament.ts`:

```ts
contract: {
  promotionId: getPlayerPromotionId(state),
  fightsRemaining: fights,
  payPerFight: pay,
  winBonus,
  exclusivity: true,
  endDate: getContractEndDate(state.currentDate, fights)
}
```

Player-created events receive:

```ts
const newEvt: Event = {
  ...eventData,
  id,
  isCompleted: false,
  promotionId: getPlayerPromotionId(state),
  scope: 'promotion'
};
```

Domestic Grand Prix records receive the same player `promotionId` and `scope: 'promotion'`. Update root-test contract and event literals with their fixture state's `playerPromotionId`; do not use an empty placeholder ID.

Change the store action inputs so player UI callers never provide ownership:

```ts
createEvent: (event: Omit<Event, 'id' | 'isCompleted' | 'promotionId' | 'scope'>) => void;
updateEvent: (eventId: string, event: Partial<Omit<Event, 'id' | 'isCompleted' | 'promotionId' | 'scope'>>) => void;
```

`createEvent` supplies player ownership. `updateEvent` preserves the existing event's `promotionId` and `scope` and ignores ownership input. Replace the field-by-field `GameState` reconstruction inside `advanceAutopilot` with `let gameState: GameState = { ...newState };` so every new required collection survives autopilot without repeating the save schema.

- [ ] **Step 7: Run foundation and existing contract tests**

Run:

```bash
npx tsx test_multi_league_foundation.ts
npx tsx test_management_depth.ts
npx tsx test_tournament.ts
npm run lint
```

Expected: all commands PASS. TypeScript must report no missing `promotionId`, `scope`, or `control` fields.

---

### Task 2: Migrate Version-12 Saves Without Data Loss

**Files:**
- Modify: `src/lib/game/save.ts:13-19,66-106,108-287`
- Modify: `src/lib/game/leagues.ts`
- Test: `test_multi_league_migration.ts`

**Interfaces:**
- Consumes: ownership types and `syncPlayerPromotionSnapshot()` from Task 1.
- Produces: `CURRENT_SAVE_VERSION = 13` and idempotent normalization of all persisted ownership fields.

- [ ] **Step 1: Write the failing migration test**

Create `test_multi_league_migration.ts`:

```ts
import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { CURRENT_SAVE_VERSION, validateAndMigrateState } from './src/lib/game/save';

const legacy = structuredClone(generateInitialWorld(1802)) as any;
const legacyPlayerPromotionId = legacy.playerPromotionId;
legacy.saveVersion = 12;
for (const fighter of Object.values(legacy.fighters) as any[]) {
  if (fighter.contract?.promotionId !== legacyPlayerPromotionId) fighter.contract = null;
  else delete fighter.contract.promotionId;
}
for (const key of ['playerPromotionId', 'promotions', 'rankingsByPromotion', 'titlesByPromotion', 'beltsByPromotion', 'worldRankings']) delete legacy[key];
delete legacy.promotion.control;
for (const event of Object.values(legacy.events) as any[]) {
  delete event.promotionId;
  delete event.scope;
}
for (const belt of Object.values(legacy.belts) as any[]) delete belt.promotionId;

const migrated = validateAndMigrateState(legacy)!;
assert.equal(CURRENT_SAVE_VERSION, 13);
assert.equal(migrated.saveVersion, 13);
assert.equal(migrated.playerPromotionId, migrated.promotion.id);
assert.equal(migrated.promotions[migrated.playerPromotionId].control, 'player');
assert.deepEqual(migrated.rankingsByPromotion[migrated.playerPromotionId], migrated.rankings);
assert.deepEqual(migrated.titlesByPromotion[migrated.playerPromotionId], migrated.titles);
for (const fighter of Object.values(migrated.fighters)) if (fighter.contract) assert.equal(fighter.contract.promotionId, migrated.playerPromotionId);
for (const belt of Object.values(migrated.belts)) assert.equal(belt.promotionId, migrated.playerPromotionId);
assert.deepEqual(validateAndMigrateState(structuredClone(migrated)), migrated);

console.log('Multi-league migration checks passed.');
```

- [ ] **Step 2: Run the migration test and verify RED**

Run:

```bash
npx tsx test_multi_league_migration.ts
```

Expected: FAIL because save version remains 12 and missing ownership fields are not normalized.

- [ ] **Step 3: Extend save extraction and contract normalization**

Set:

```ts
export const CURRENT_SAVE_VERSION = 13;
```

Add canonical fields to `extractSaveState`:

```ts
playerPromotionId: state.playerPromotionId,
promotions: state.promotions,
rankingsByPromotion: state.rankingsByPromotion,
titlesByPromotion: state.titlesByPromotion,
beltsByPromotion: state.beltsByPromotion,
worldRankings: state.worldRankings,
```

Change contract normalization to require the owning promotion:

```ts
function normalizeContract(contract: any, currentDate: string, promotionId: string): Contract | null {
  if (!contract || typeof contract !== 'object') return null;
  const fightsRemaining = Math.max(0, Number(contract.fightsRemaining) || 0);
  const endDate = typeof contract.endDate === 'string' && !Number.isNaN(Date.parse(contract.endDate))
    ? contract.endDate
    : addDays(new Date(currentDate), Math.max(90, fightsRemaining * CONTRACT_DAYS_PER_FIGHT)).toISOString().slice(0, 10);
  const counterOffer = contract.counterOffer && typeof contract.counterOffer === 'object' && typeof contract.counterOffer.expiresDate === 'string'
    ? contract.counterOffer
    : undefined;
  return { ...contract, promotionId: contract.promotionId || promotionId, fightsRemaining, endDate, counterOffer };
}
```

- [ ] **Step 4: Add idempotent ownership migration**

Immediately after validating `parsed.promotion`, establish the player identity:

```ts
const playerPromotionId = state.playerPromotionId || state.promotion.id;
state.playerPromotionId = playerPromotionId;
state.promotion = { ...state.promotion, id: playerPromotionId, control: 'player' };
state.promotions = {
  ...(state.promotions || {}),
  [playerPromotionId]: state.promotion
};
```

Normalize every contract with `normalizeContract(f.contract, state.currentDate, playerPromotionId)`.

After existing title/belt migration, normalize the scoped collections and records:

```ts
for (const belt of Object.values(state.belts) as any[]) belt.promotionId ||= playerPromotionId;
for (const event of Object.values(state.events || {}) as any[]) {
  event.promotionId ??= playerPromotionId;
  event.scope ??= 'promotion';
}
for (const fight of Object.values(state.fightArchive || {}) as any[]) {
  fight.promotionId ??= playerPromotionId;
  fight.scope ??= 'promotion';
}
for (const event of Object.values(state.eventArchive || {}) as any[]) {
  event.promotionId ??= playerPromotionId;
  event.scope ??= 'promotion';
}
for (const item of state.titleHistory as any[]) {
  item.promotionId ??= playerPromotionId;
  item.scope ??= 'promotion';
}
for (const tournament of Object.values(state.tournaments || {}) as any[]) {
  tournament.promotionId ??= playerPromotionId;
  tournament.scope ??= 'promotion';
}
state.rankingsByPromotion = { ...(state.rankingsByPromotion || {}), [playerPromotionId]: state.rankings };
state.titlesByPromotion = { ...(state.titlesByPromotion || {}), [playerPromotionId]: state.titles };
state.beltsByPromotion = { ...(state.beltsByPromotion || {}), [playerPromotionId]: state.belts };
state.worldRankings ||= state.rankings;
```

Return `syncPlayerPromotionSnapshot(...)` after existing social/champion migrations.

- [ ] **Step 5: Verify migration and prior save behavior**

Run:

```bash
npx tsx test_multi_league_migration.ts
npx tsx test_management_depth.ts
npm run lint
```

Expected: PASS, including the repeated-migration deep equality assertion.

---

### Task 3: Scope Domestic Rankings, Titles, and Champion Flags

**Files:**
- Modify: `src/lib/game/rankings.ts:12-30,107-265`
- Modify: `src/lib/engine.ts:407-712,715-1084,1102-1171`
- Modify: `src/lib/game/leagues.ts`
- Modify: `src/store/gameStore.ts:493-625,973-985`
- Test: `test_scoped_rankings_titles.ts`
- Test: `test_ranking_context.ts`

**Interfaces:**
- Consumes: `isFighterInPromotion()`, scoped collections, player aliases.
- Produces:

```ts
export function buildPromotionRankings(state: GameState, promotionId?: string, affectedWeightClasses?: WeightClass[]): RankingBuildResult;
export function buildWorldRankings(state: GameState): Record<WeightClass, RankingItem[]>;
export function updateRankings(state: GameState, eventId?: string, promotionId?: string): GameState;
export function getFighterRankContext(state: RankingState, fighterId: string, promotionId?: string): RankContext | null;
export function syncChampionFlags(state: GameState, promotionId?: string): GameState;
```

- [ ] **Step 1: Write two-promotion title and ranking regressions**

Create `test_scoped_rankings_titles.ts`:

```ts
import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { buildPromotionRankings, buildWorldRankings, getFighterRankContext } from './src/lib/game/rankings';
import { syncChampionFlags } from './src/lib/engine';

const state = generateInitialWorld(1803);
const rivalId = 'promotion-rival-test';
state.promotions[rivalId] = { id: rivalId, name: 'Rival Combat', shortName: 'RC', money: 0, reputation: 45, fanbase: 50000, control: 'ai' };
const rivals = Object.values(state.fighters).filter(fighter => fighter.weightClass === 'Lightweight' && !fighter.contract).slice(0, 3);
for (const fighter of rivals) state.fighters[fighter.id] = { ...fighter, contract: { promotionId: rivalId, fightsRemaining: 4, payPerFight: 1, winBonus: 1, exclusivity: true, endDate: '2027-01-01' } };
state.titlesByPromotion[rivalId] = { ...structuredClone(state.titles), Lightweight: { weightClass: 'Lightweight', undisputedChampionId: rivals[0].id, undisputedDefenses: 0, status: 'active' } };
state.rankingsByPromotion[rivalId] = structuredClone(state.rankings);
state.beltsByPromotion[rivalId] = {};

const rivalRankings = buildPromotionRankings(state, rivalId).newRankings;
assert.ok(rivalRankings.Lightweight.every(item => state.fighters[item.fighterId].contract?.promotionId === rivalId));
state.rankingsByPromotion[rivalId] = rivalRankings;
assert.equal(getFighterRankContext(state, rivals[0].id, rivalId)?.label, 'C');
assert.ok(buildWorldRankings(state).Lightweight.some(item => rivals.some(fighter => fighter.id === item.fighterId)));

const synced = syncChampionFlags(state);
assert.equal(synced.fighters[rivals[0].id].isChampion, true);
assert.equal(synced.titles.Lightweight.undisputedChampionId, state.titles.Lightweight.undisputedChampionId);

console.log('Scoped rankings and titles checks passed.');
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx tsx test_scoped_rankings_titles.ts
```

Expected: FAIL because ranking and champion APIs cannot select a promotion.

- [ ] **Step 3: Parameterize ranking reads without changing default callers**

Change `RankingState` to include scoped state and make `promotionId` optional. Default it through `getPlayerPromotionId(state)` so existing UI remains unchanged.

In `buildPromotionRankings`, resolve:

```ts
const selectedPromotionId = promotionId ?? getPlayerPromotionId(state);
const currentRankings = getScopedRankings(state, selectedPromotionId);
const currentTitles = getScopedTitles(state, selectedPromotionId);
```

Replace `f.contract` filters with:

```ts
isFighterInPromotion(f, selectedPromotionId)
```

Use `currentRankings` and `currentTitles` everywhere in the function. Preserve the existing rank score, inactivity, trend, champion-first, and top-16 rules.

Add world rankings using existing ranking score calculation but no promotion filter:

```ts
export function buildWorldRankings(state: GameState): Record<WeightClass, RankingItem[]> {
  return Object.fromEntries(WEIGHT_CLASSES.map(weightClass => [
    weightClass,
    Object.values(state.fighters)
      .filter(fighter => fighter.weightClass === weightClass && fighter.contract && fighter.careerPhase !== 'retired' && getRankingActivityStatus(fighter, state.currentDate) !== 'unranked-inactive')
      .sort((a, b) => getEffectiveRankingScore(state, b) - getEffectiveRankingScore(state, a) || a.id.localeCompare(b.id))
      .slice(0, 50)
      .map((fighter, rank) => ({ fighterId: fighter.id, rank, trend: 0 }))
  ])) as Record<WeightClass, RankingItem[]>;
}
```

- [ ] **Step 4: Write scoped updates back to the correct owner**

`updateRankings(state, eventId?, promotionId?)` must:

1. Resolve `selectedPromotionId` from the explicit argument, event ownership, or player ID.
2. Apply existing Elo updates once for completed fight results.
3. Write the ranking result to `rankings` when selected promotion is the player, otherwise to `rankingsByPromotion[selectedPromotionId]`.
4. Always refresh `worldRankings` after Elo changes.
5. Call `syncPlayerPromotionSnapshot` before returning.

Do not calculate Elo a second time when rebuilding world rankings.

- [ ] **Step 5: Make title application and champion sync scope-aware**

In `applyFightResult` and `finalizeEventFinancials`, derive:

```ts
const event = state.events[eventId];
const promotionId = event.promotionId ?? getPlayerPromotionId(state);
const titles = getScopedTitles(state, promotionId);
```

Domestic title changes mutate only that promotion's title table. For player events, continue writing `state.titles`; for rivals, write `titlesByPromotion[promotionId]`. Archive records copy `event.scope` and `event.promotionId`. Every domestic title-history lookup, closure, defense, vacate, and append must filter `scope === 'promotion'` and `item.promotionId === promotionId`; never close another promotion's or an international belt's reign.

Replace `syncChampionFlags` with a full scoped derivation:

```ts
const championIds = new Set<string>();
for (const titles of Object.values(state.titlesByPromotion)) {
  for (const title of Object.values(titles)) {
    if (title.undisputedChampionId) championIds.add(title.undisputedChampionId);
    if (title.interimChampionId) championIds.add(title.interimChampionId);
  }
}
```

Vacate a domestic title only when its champion is missing or `contract?.promotionId !== promotionId`. Set `fighter.isChampion = championIds.has(fighter.id)` after vacating invalid entries.

- [ ] **Step 6: Keep player store actions scoped**

`signFighter`, `renewFighter`, and `releaseFighter` must reject fighters owned by another promotion and only mutate player titles. End each successful player state mutation with `syncPlayerPromotionSnapshot(updateRankings(...))`.

- [ ] **Step 7: Verify domestic isolation**

Run:

```bash
npx tsx test_scoped_rankings_titles.ts
npx tsx test_ranking_context.ts
npx tsx test_management_depth.ts
npx tsx test_tournament.ts
npm run lint
```

Expected: all PASS; two promotions can simultaneously own a Lightweight champion.

---

### Task 4: Generate Two AI Rival Promotions From the Existing Fighter Pool

**Files:**
- Modify: `src/lib/game/generator.ts:213-428`
- Modify: `src/lib/game/leagues.ts`
- Test: `test_rival_promotions.ts`

**Interfaces:**
- Consumes: promotion-scoped ranking/title helpers from Tasks 1-3.
- Produces:

```ts
export const RIVAL_PROMOTION_TEMPLATES: readonly Pick<Promotion, 'id' | 'name' | 'shortName' | 'reputation' | 'fanbase'>[];
export function seedRivalPromotions(state: GameState): GameState;
```

- [ ] **Step 1: Write deterministic rival-world assertions**

Create `test_rival_promotions.ts`:

```ts
import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { WEIGHT_CLASSES } from './src/lib/game/constants';

const state = generateInitialWorld(1804);
const playerPromotions = Object.values(state.promotions).filter(promotion => promotion.control === 'player');
const rivals = Object.values(state.promotions).filter(promotion => promotion.control === 'ai');

assert.equal(playerPromotions.length, 1);
assert.equal(rivals.length, 2);
for (const promotion of rivals) {
  assert.ok(promotion.nextAiEventDate);
  for (const weightClass of WEIGHT_CLASSES) {
    const roster = Object.values(state.fighters).filter(fighter => fighter.weightClass === weightClass && fighter.contract?.promotionId === promotion.id);
    assert.equal(roster.length, 8);
    assert.ok(state.rankingsByPromotion[promotion.id][weightClass].length > 0);
    assert.ok(state.titlesByPromotion[promotion.id][weightClass].undisputedChampionId);
  }
}
assert.ok(Object.values(state.fighters).some(fighter => !fighter.contract));

console.log('Rival promotion generation checks passed.');
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx tsx test_rival_promotions.ts
```

Expected: FAIL because new worlds contain no AI promotions.

- [ ] **Step 3: Add the fixed rival identities**

In `src/lib/game/leagues.ts`:

```ts
export const RIVAL_PROMOTION_TEMPLATES = [
  { id: 'promotion-apex-combat', name: 'Apex Combat League', shortName: 'ACL', reputation: 55, fanbase: 85000 },
  { id: 'promotion-global-fight', name: 'Global Fight Alliance', shortName: 'GFA', reputation: 48, fanbase: 65000 }
] as const;
```

Use fixed promotion IDs so migration and annual qualification do not create duplicates.

- [ ] **Step 4: Seed rival rosters without generating more fighters**

Implement `seedRivalPromotions(state)` by selecting existing unsigned, non-retired fighters. For each rival and weight class:

1. Sort eligible fighters by `getFighterOverall` descending, then ID.
2. Assign exactly eight contracts with `promotionId: rival.id`, four fights, and an end date from `getContractEndDate`.
3. Make the strongest assigned fighter the undisputed domestic champion.
4. Create a domestic belt whose ID includes promotion and weight class.
5. Build that promotion's rankings using `buildPromotionRankings`.
6. Set `nextAiEventDate` to 28 days for ACL and 42 days for GFA after `currentDate`.

Use:

```ts
const promotion: Promotion = {
  ...template,
  money: 0,
  control: 'ai',
  nextAiEventDate: format(addDays(new Date(state.currentDate), 28 + index * 14), 'yyyy-MM-dd')
};
```

Rival `money` remains zero because rival finance simulation is explicitly deferred.

- [ ] **Step 5: Integrate rival seeding into new games only**

Call `seedRivalPromotions(initialState)` after player rankings are initialized and before the final player snapshot is synchronized. Do not seed rivals in save migration during Task 4. Task 5 adds idempotent migration-time rival seeding after player ownership normalization.

Update `test_multi_league_foundation.ts` for the post-rival world:

```ts
assert.equal(Object.values(state.promotions).filter(promotion => promotion.control === 'player').length, 1);
for (const fighter of Object.values(state.fighters)) {
  const promotionId = getFighterPromotionId(fighter);
  if (promotionId) assert.ok(state.promotions[promotionId], `Missing contract promotion ${promotionId}`);
}
```

Keep the original assertion that the player aliases resolve through `playerPromotionId`; remove only the obsolete assertion that every contract belongs to the player.

- [ ] **Step 6: Verify generation and player behavior**

Run:

```bash
npx tsx test_rival_promotions.ts
npx tsx test_multi_league_foundation.ts
npx tsx test_scoped_rankings_titles.ts
npx tsx test_management_depth.ts
npm run lint
```

Expected: PASS; no fighter has more than one contract because ownership lives on one `Contract` object.

---

### Task 5: Simulate Minimal Rival-League Events

**Files:**
- Create: `src/lib/game/rivalPromotions.ts`
- Modify: `src/lib/engine.ts:116-322,407-1084`
- Modify: `src/lib/game/save.ts:108-287`
- Test: `test_rival_simulation.ts`

**Interfaces:**
- Consumes: existing `simulateFight`, scoped `applyFightResult`, scoped `finalizeEventFinancials`, and ranking helpers.
- Produces:

```ts
export function ensureRivalPromotions(state: GameState): GameState;
export function simulateRivalPromotionEvent(state: GameState, promotionId: string, language?: Language): GameState;
export function advanceRivalPromotions(state: GameState, language?: Language): GameState;
```

- [ ] **Step 1: Write the rival simulation regression**

Create `test_rival_simulation.ts`:

```ts
import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { advanceTime } from './src/lib/engine';

const state = generateInitialWorld(1805);
const rival = Object.values(state.promotions).find(promotion => promotion.control === 'ai')!;
state.sponsorDeals = [];
state.mediaDeals = [];
const playerMoney = state.promotion.money;
const rivalRecordsBefore = Object.fromEntries(Object.values(state.fighters).filter(fighter => fighter.contract?.promotionId === rival.id).map(fighter => [fighter.id, { ...fighter.record }]));
const advanced = advanceTime(state, 60, 'en');
const rivalEvents = Object.values(advanced.eventArchive).filter(event => event.promotionId === rival.id);

assert.ok(rivalEvents.length >= 1);
assert.equal(advanced.promotion.money, playerMoney);
assert.ok(Object.entries(rivalRecordsBefore).some(([id, record]) => JSON.stringify(advanced.fighters[id].record) !== JSON.stringify(record)));
assert.ok(Object.values(advanced.fightArchive).filter(fight => fight.promotionId === rival.id).every(fight => fight.scope === 'promotion'));
assert.ok((advanced.financeLedger ?? []).every(entry => !rivalEvents.some(event => event.id === entry.eventId)));
assert.ok(new Date(advanced.promotions[rival.id].nextAiEventDate!).getTime() > new Date(advanced.currentDate).getTime());

console.log('Rival promotion simulation checks passed.');
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx tsx test_rival_simulation.ts
```

Expected: FAIL because advancing time does not simulate rival events.

- [ ] **Step 3: Implement idempotent rival availability**

`ensureRivalPromotions(state)` returns the state unchanged when both fixed rival IDs exist. Otherwise it calls `seedRivalPromotions(state)`. Invoke it during version-13 migration after player ownership fields exist so version-12 saves gain rivals without duplicating them on repeated load.

- [ ] **Step 4: Build one bounded rival card**

In `simulateRivalPromotionEvent`, select eligible fighters with:

```ts
fighter.contract?.promotionId === promotionId &&
fighter.careerPhase !== 'retired' &&
!fighter.injuryStatus &&
!(fighter.medicalSuspension && fighter.medicalSuspension.daysRemaining > 0) &&
fighter.fatigue < 75
```

For each weight class, sort by that promotion's current rank. Prefer one champion-versus-highest-contender matchup if both are eligible and not already selected. Fill the remaining card to at most four fights by pairing adjacent ranked fighters in the same weight class. A card with fewer than two eligible fighters returns unchanged except `nextAiEventDate` moving forward 14 days.

Create a temporary persisted event:

```ts
const event: Event = {
  id: `rival-event-${promotionId}-${state.currentDate}`,
  name: `${state.promotions[promotionId].shortName} Fight Night`,
  date: state.currentDate,
  venueId: Object.keys(state.venues)[0],
  ticketPrice: 0,
  marketingSpend: 0,
  fights,
  isCompleted: false,
  promotionId,
  scope: 'promotion'
};
```

Run each fight through `simulateFight`, then existing scoped `applyFightResult`. Finalize the event through the scoped engine branch from Step 5. Do not create drama, sponsorship, media, or finance entries for AI promotions.

- [ ] **Step 5: Make rival event finalization finance-neutral**

In `finalizeEventFinancials`, branch on `promotionId !== playerPromotionId`:

- Mark the event complete.
- Write `EventArchiveItem` and `FightArchiveItem` ownership.
- Progress any attached domestic tournament.
- Rebuild that rival's rankings and world rankings.
- Skip attendance revenue, promotion money, sponsor/media bonuses, player reputation/fanbase, finance ledger, season objectives, and player event news.

The existing player branch remains byte-for-byte behaviorally equivalent.

- [ ] **Step 6: Advance rival schedules without loops**

`advanceRivalPromotions` examines each AI promotion once per `advanceTime` call. If `nextAiEventDate <= state.currentDate`, call `simulateRivalPromotionEvent` once and keep the schedule returned by that function: 14 days after an underfilled/no-card attempt, or 42 days after a completed card. Do not overwrite `nextAiEventDate` in the caller and do not backfill multiple missed AI events in one call. This bound prevents long save migrations or large time skips from generating hundreds of cards.

Call `advanceRivalPromotions` in `advanceTime` after injury/suspension recovery and lifecycle updates, but before the final world-ranking rebuild.

- [ ] **Step 7: Verify rival evolution and existing time advancement**

Run:

```bash
npx tsx test_rival_simulation.ts
npx tsx test_rival_promotions.ts
npx tsx test_management_depth.ts
npx tsx test_long_sim.ts
npm run lint
```

Expected: all PASS; AI events alter rival records but never player cash.

---

### Task 6: Add Annual Neutral International Competitions and Belts

**Files:**
- Modify: `src/types/game.ts:486-515,582-615,688-717`
- Create: `src/lib/game/internationalCompetitions.ts`
- Modify: `src/lib/game/tournament.ts:26-227,230-864,866-1296,1439-1595`
- Modify: `src/lib/engine.ts:407-1084`
- Modify: `src/lib/game/save.ts:66-93,108-287`
- Test: `test_international_competitions.ts`
- Test: `test_tournament.ts`

**Interfaces:**
- Consumes: promotion-scoped domestic rankings, rival promotions, Grand Prix progression, scoped event finalization.
- Produces:

```ts
export type InternationalCompetitionTier = 'champions_cup' | 'challenge_cup';
export type InternationalTitles = Record<InternationalCompetitionTier, Record<WeightClass, WeightClassTitleState>>;

export function getInternationalQualifiers(state: GameState, weightClass: WeightClass, tier: InternationalCompetitionTier): { participantIds: string[]; reserveIds: string[]; qualifyingPromotionIds: string[] };
export function createInternationalGrandPrixTournament(state: GameState, options: InternationalTournamentOptions, language?: Language): GameState;
export function ensureAnnualInternationalCompetitions(state: GameState, year: number, language?: Language): GameState;
```

- [ ] **Step 1: Write qualification and belt regressions**

Create `test_international_competitions.ts`:

```ts
import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { createInternationalGrandPrixTournament, getInternationalQualifiers } from './src/lib/game/internationalCompetitions';

let state = generateInitialWorld(1806);
const qualifiers = getInternationalQualifiers(state, 'Lightweight', 'champions_cup');
assert.equal(qualifiers.participantIds.length, 8);
assert.ok(new Set(qualifiers.participantIds.map(id => state.fighters[id].contract?.promotionId)).size >= 2);
assert.ok(qualifiers.participantIds.every(id => state.fighters[id].weightClass === 'Lightweight'));

const domesticTitlesBefore = structuredClone(state.titlesByPromotion);
const playerMoneyBefore = state.promotion.money;
state = createInternationalGrandPrixTournament(state, {
  weightClass: 'Lightweight',
  tier: 'champions_cup',
  name: 'Lightweight World Champions Cup',
  participantIds: qualifiers.participantIds,
  reserveIds: qualifiers.reserveIds
}, 'en');
const tournament = Object.values(state.tournaments).find(item => item.scope === 'international')!;
assert.equal(tournament.promotionId, null);
assert.equal(tournament.titleShotPromised, false);
assert.equal(tournament.internationalTier, 'champions_cup');
assert.deepEqual(state.titlesByPromotion, domesticTitlesBefore);
assert.equal(state.promotion.money, playerMoneyBefore);

console.log('International competition checks passed.');
```

Extend this test during Step 5 by completing the final through existing tournament helpers and asserting that the winner owns `state.internationalTitles.champions_cup.Lightweight` while domestic titles and player money remain unchanged.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx tsx test_international_competitions.ts
```

Expected: FAIL because international tiers, qualifiers, and tournament creation do not exist.

- [ ] **Step 3: Add international title state**

In `src/types/game.ts`:

```ts
export type InternationalCompetitionTier = 'champions_cup' | 'challenge_cup';
export type InternationalTitles = Record<InternationalCompetitionTier, Record<WeightClass, WeightClassTitleState>>;
```

Extend `BeltInfo.type` to:

```ts
type: 'undisputed' | 'international';
```

Add to `GrandPrixTournament`:

```ts
internationalTier?: InternationalCompetitionTier;
winnerBeltId?: string;
qualifyingPromotionIds?: string[];
```

Add to `GameState`:

```ts
internationalTitles: InternationalTitles;
internationalBelts: Record<InternationalCompetitionTier, Record<string, BeltInfo>>;
internationalCompetitionYears: number[];
```

Generator and migration must initialize both tiers for every weight class as vacant. International belts use `promotionId: null`, `type: 'international'`, and IDs containing tier plus weight class. Save extraction persists all three fields. Replace any remaining field-by-field `GameState` literal, especially `advanceAutopilot`, with a spread of the current state or explicitly carry all three international fields so autopilot cannot erase them.

- [ ] **Step 4: Implement deterministic qualification**

In `getInternationalQualifiers`:

- Iterate promotions ordered by ID.
- Champions Cup candidates per promotion are the undisputed champion followed by domestic contenders in rank order.
- Challenge Cup candidates are domestic contenders not selected by Champions Cup, starting after the first two eligible names from each promotion.
- Take one candidate per promotion per pass until eight participants exist.
- Fill remaining slots from `worldRankings[weightClass]`, excluding selected IDs.
- Return up to three reserves from the next world-ranked eligible fighters.
- Require at least two distinct promotion IDs; otherwise throw `International competition requires fighters from at least two promotions.`

This round-robin rule prevents the highest-reputation promotion from occupying the entire bracket.

- [ ] **Step 5: Reuse Grand Prix construction with neutral validation**

Implement `createInternationalGrandPrixTournament` as a thin call into a scope-aware `createGrandPrixTournament`:

```ts
return createGrandPrixTournament(state, {
  weightClass: options.weightClass,
  name: options.name,
  titleShotPromised: false,
  format: 'eight_man',
  participantIds: options.participantIds,
  reserveIds: options.reserveIds,
  scope: 'international',
  promotionId: null,
  internationalTier: options.tier,
  qualifyingPromotionIds: [...new Set(options.participantIds.map(id => state.fighters[id].contract!.promotionId))],
  winnerBeltId: internationalBeltId(options.tier, options.weightClass)
}, language);
```

Extend the domestic creator options with default `scope: 'promotion'` and `promotionId: getPlayerPromotionId(state)`. Domestic validation requires matching contract ownership. International validation accepts any active domestic contract but requires at least two promotions. Keep seeding by ranking score and all existing bracket structure.

- [ ] **Step 6: Award only the international belt at the final**

In `applyTournamentProgression`, when an international final completes:

1. Set `tournament.winnerId` and complete the tournament as today.
2. Set the tier/weight-class international champion to the winner.
3. Close the previous active international `TitleHistoryItem` only when `scope === 'international'`, `promotionId === null`, and `beltId === winnerBeltId`.
4. Append a new history item with `scope: 'international'`, `promotionId: null`, and `beltId: winnerBeltId`.
5. Do not set `titleShotPromised`.
6. Do not mutate any `titlesByPromotion`, `beltsByPromotion`, or player finance fields.
7. Extend `syncChampionFlags` to include active champions from `internationalTitles`; international champions set `fighter.isChampion` but never mutate domestic titles. Vacate an international title only if its fighter is missing, retired, or has no active domestic contract.

International event finalization updates fighter records, fatigue, injuries, world rankings, archives, and tournament progression, but skips domestic title validation and finance.

- [ ] **Step 7: Create annual competitions exactly once**

`ensureAnnualInternationalCompetitions(state, year)` returns unchanged if `internationalCompetitionYears` includes `year`. Otherwise, for each weight class create one Champions Cup and one Challenge Cup only when each tier has eight eligible qualifiers. Append the year only after attempting all divisions.

Call it from `advanceTime` when the resulting date is on or after July 1 for a year not yet recorded. Add an explicit `advanceInternationalCompetitions(state, language)` path called from `advanceTime`: for each due international tournament, create one neutral event with `scope: 'international'` and `promotionId: null`, schedule the next incomplete round through the existing bracket helpers, quick-simulate and finalize that neutral event, and advance at most one round per tournament per `advanceTime` call. Do not depend on existing player events, player calendar slots, reputation, money, or title-shot settings. Neutral event IDs include tournament and round IDs so repeated advancement is idempotent.

- [ ] **Step 8: Verify international isolation and domestic regression**

Run:

```bash
npx tsx test_international_competitions.ts
npx tsx test_tournament.ts
npx tsx test_scoped_rankings_titles.ts
npx tsx test_rival_simulation.ts
npm run lint
```

Expected: PASS; an international winner receives only the international belt, and ordinary Grand Prix behavior remains unchanged.

---

### Task 7: Expose Leagues, Qualification, and International Tournaments

**Files:**
- Create: `src/pages/Leagues.tsx`
- Modify: `src/store/gameStore.ts:29-55`
- Modify: `src/App.tsx:55-80`
- Modify: `src/components/AppShell.tsx:26-55`
- Modify: `src/pages/Tournaments.tsx`
- Modify: `src/pages/Calendar.tsx`
- Modify: `src/i18n/resources/en.ts`
- Modify: `src/i18n/resources/vi.ts`
- Modify: `test_ui_contracts.ts:27-33,41-83`
- Modify: `test_i18n.ts`

**Interfaces:**
- Consumes: `promotions`, scoped rankings/titles, international titles, qualifiers, and tournament scope.
- Produces: `GameView = ... | 'leagues'` and one read-only league overview page; no rival-management actions.

- [ ] **Step 1: Write UI source-contract assertions first**

Extend `test_ui_contracts.ts`:

```ts
const leagues = readFileSync('src/pages/Leagues.tsx', 'utf8');
for (const token of [
  'useTranslation',
  '$.leagues.title',
  'state.promotions',
  'rankingsByPromotion',
  'titlesByPromotion',
  'internationalTitles',
  'getInternationalQualifiers',
  "setView('fighter-detail'",
  'min-w-0',
  'grid-cols-1'
]) assert.ok(leagues.includes(token), `Leagues UI missing ${token}`);
assert.ok(labels.includes('Leagues'), 'Missing Leagues navigation item');
for (const token of ["scope === 'promotion'", "scope === 'international'", '$.tournaments.domestic', '$.tournaments.international']) assert.ok(tournamentsPage.includes(token), `Tournament scope UI missing ${token}`);
```

Add `Leagues.tsx` to the translated-page loop. Add matching English/Vietnamese key assertions to `test_i18n.ts`.

- [ ] **Step 2: Run UI tests and verify RED**

Run:

```bash
npx tsx test_ui_contracts.ts
npx tsx test_i18n.ts
```

Expected: FAIL because `Leagues.tsx`, navigation, and translation keys do not exist.

- [ ] **Step 3: Add the Leagues route and navigation**

Add `'leagues'` to `GameView`, lazy-load `Leagues`, handle `case 'leagues'` in `App.tsx`, and add one Competition navigation item:

```ts
{ view: 'leagues', label: 'Leagues', icon: Globe2 }
```

Use the translation selector for the rendered label and accessible mobile navigation text, following existing `AppShell` patterns.

- [ ] **Step 4: Implement one read-only responsive page**

`Leagues.tsx` must provide:

- Promotion selector buttons for the player and both AI promotions.
- Promotion name, control label, reputation, and fanbase.
- Weight-class selector.
- Selected promotion's undisputed/interim champion and top 15 ranking.
- Champions Cup and Challenge Cup current qualifier previews from `getInternationalQualifiers`.
- Current international champions for the selected weight class.
- Fighter rows as semantic buttons opening `fighter-detail`.
- No sign, release, finance, booking, or title-edit controls for AI promotions.

Reuse existing `dataSurfaceClasses`, `buttonVariantClasses`, `FighterRankBadge`, and `ChampionshipBelt`. Use `grid grid-cols-1`, `min-w-0`, wrapping controls, and 44px actions; create no new UI abstraction.

- [ ] **Step 5: Filter tournament and calendar views by scope**

Add Domestic and International filter buttons in `Tournaments.tsx`. Domestic shows only player-promotion tournaments; International shows neutral tournaments and promotion short names beside participants. Hide domestic title-shot controls for international records.

`Calendar.tsx` keeps player domestic events and adds international events. Rival domestic events remain archive-only and do not clutter the player's booking calendar.

- [ ] **Step 6: Add exact English and Vietnamese copy groups**

Add matching typed objects to both resources:

```ts
leagues: {
  title: 'World Leagues',
  playerControlled: 'Player managed',
  aiControlled: 'AI managed',
  domesticChampion: 'Domestic Champion',
  domesticRankings: 'Domestic Rankings',
  championsCupQualification: 'Champions Cup Qualification',
  challengeCupQualification: 'Challenge Cup Qualification',
  internationalChampions: 'International Champions',
  noChampion: 'Vacant'
}
```

Vietnamese values:

```ts
leagues: {
  title: 'Hệ thống giải thế giới',
  playerControlled: 'Người chơi quản lý',
  aiControlled: 'AI quản lý',
  domesticChampion: 'Vô địch quốc nội',
  domesticRankings: 'Bảng xếp hạng quốc nội',
  championsCupQualification: 'Suất Champions Cup',
  challengeCupQualification: 'Suất Challenge Cup',
  internationalChampions: 'Nhà vô địch quốc tế',
  noChampion: 'Đang bỏ trống'
}
```

Add `navigation.leagues`, `tournaments.domestic`, and `tournaments.international` in both languages.

- [ ] **Step 7: Verify UI contracts without browser automation**

Run:

```bash
npx tsx test_ui_contracts.ts
npx tsx test_i18n.ts
npm run lint
npm run build
```

Expected: all PASS. The user performs manual responsive and visual checking afterward.

---

### Task 8: Consolidated Regression and Save-Safety Gate

**Files:**
- Modify only files implicated by a failing verification; do not add scope during this task.

**Interfaces:**
- Consumes: all previous task outputs.
- Produces: a buildable, migration-safe multi-league MVP ready for manual checking.

- [ ] **Step 1: Run every focused multi-league test together**

Run:

```bash
npx tsx test_multi_league_foundation.ts
npx tsx test_multi_league_migration.ts
npx tsx test_scoped_rankings_titles.ts
npx tsx test_rival_promotions.ts
npx tsx test_rival_simulation.ts
npx tsx test_international_competitions.ts
```

Expected: all six scripts PASS.

- [ ] **Step 2: Run impacted existing regressions**

Run:

```bash
npx tsx test_management_depth.ts
npx tsx test_ranking_context.ts
npx tsx test_tournament.ts
npx tsx test_calendar.ts
npx tsx test_ui_contracts.ts
npx tsx test_i18n.ts
npx tsx test_long_sim.ts
```

Expected: all PASS with no player-promotion economy, title, ranking, calendar, tournament, save, or i18n regression.

- [ ] **Step 3: Run static and production verification**

Run:

```bash
npm run lint
npm run build
git diff --check
```

Expected: TypeScript exits 0, Vite builds successfully, and `git diff --check` prints no output.

- [ ] **Step 4: Confirm scope and working-tree safety**

Run:

```bash
git status --short
git diff --stat
```

Expected: only planned source/test files plus the user's pre-existing changes are present. Do not stage, commit, push, discard, or rewrite unrelated working-tree files.

## Deferred Until the MVP Is Proven

- Rival promotion bank balances, sponsor/media deals, venue economics, and bankruptcy.
- Transfer offers, bidding wars, contract poaching, loans, or fighter-controlled free agency negotiations between AI promotions.
- Player ownership or direct booking control of rival promotions.
- Promotion coefficient systems, geographic confederations, relegation, and expansion leagues.
- Dedicated assets, international venues, belt art, broadcast presentation, or new dependencies.
- More than one rival event per promotion per `advanceTime` call.

Add these only after the user confirms that domestic qualification, rival progression, and international belts create useful long-term gameplay.