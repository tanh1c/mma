# Seasonal Contract Market Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic 30-day post-season market in which every promotion can list, buy, retain, and compete for fighters through one sealed offer per promotion/fighter, with atomic settlement and a player-facing Contract Market.

**Architecture:** Persist only canonical market records on `GameState`, and place all calendar, valuation, AI, privacy, and settlement behavior in one pure `src/lib/game/contractMarket.ts` module. Existing Zustand actions remain thin adapters; `advanceTime` calls one idempotent daily market orchestrator before contract expiry and again after international progression so expired deals cannot bypass the market and newly completed cups can open it. Each winning package is validated and applied to a candidate state, then committed only after money, ownership, title, ranking, event-registration, and history invariants pass.

**Tech Stack:** TypeScript 5.8, React 19, Zustand 5, Vite 6, i18next, date-fns, existing `uuid` dependency for player-created IDs, root-level `node:assert/strict` tests executed with `npx tsx`.

## Global Constraints

- Phase 1 includes the approved seasonal window, two-way listings, contracted purchases, free agency, renewals, sealed offers, deterministic AI, atomic transfers, UI, migration, and multi-season acceptance coverage.
- Fighter choice uses only expected money, promotion prestige, title opportunity, and loyalty; money has the largest single weight but does not automatically win.
- A promotion has at most one active offer per fighter and may revise it only while the window is open.
- Rival offer values remain sealed; the player sees only interest count/competition level except for the player's own offers and incoming transfer fees requiring a seller response.
- No fighter changes promotion while registered in a planned or active international tournament.
- Preserve deterministic behavior for equivalent state and IDs; market code must not call `Math.random()`.
- Preserve `GameState.promotion`, `rankings`, `titles`, and `belts` as the player-promotion compatibility view through `syncPlayerPromotionSnapshot()`.
- Save migration is additive and idempotent; do not alter existing contracts or ownership.
- Phase 1 does not add debt, bankruptcy, agents, signing bonuses, guaranteed purses, clauses, personality preferences, relocation, brand fit, media competition, or commercial rivalries.
- Use the existing TypeScript, React, Zustand, date-fns, i18next, and UI primitives. Do not add assets or dependencies.
- Do not refactor unrelated systems.
- Do not run Playwright or browser automation; the user performs visual checks.
- Do not stage, commit, push, discard, or rewrite unrelated working-tree changes.
- Verification is focused `npx tsx` tests, long simulation, `npm run lint`, `npm run build`, and `git diff --check`.

## Canonical Interfaces

Tasks below build these exact interfaces in `src/types/game.ts` and `src/lib/game/contractMarket.ts`:

```ts
export type TransferWindowStatus = 'scheduled' | 'open' | 'resolving' | 'closed';
export type TransferListingStatus = 'active' | 'withdrawn' | 'sold' | 'expired';
export type TransferOfferStatus = 'active' | 'withdrawn' | 'accepted' | 'rejected' | 'invalid';
export type SellerDecisionStatus = 'pending' | 'accepted' | 'rejected';
export type TransferHistoryOutcome = 'transferred' | 'renewed' | 'signed' | 'rejected' | 'invalid';

export interface MarketContractTerms {
  fights: number;
  payPerFight: number;
  winBonus: number;
}

export interface TransferWindow {
  id: string;
  season: number;
  openDate: string;
  closeDate: string;
  status: TransferWindowStatus;
  lastAiRunDate?: string;
  resolvedDate?: string;
}

export interface TransferListing {
  id: string;
  windowId: string;
  fighterId: string;
  sellerPromotionId: string;
  minimumFee: number;
  status: TransferListingStatus;
  createdDate: string;
  updatedDate: string;
}

export interface TransferOffer {
  id: string;
  windowId: string;
  fighterId: string;
  buyerPromotionId: string;
  sellerPromotionId: string | null;
  transferFee: number;
  terms: MarketContractTerms;
  status: TransferOfferStatus;
  sellerDecision: SellerDecisionStatus;
  sellerReason?: MarketReason;
  createdDate: string;
  updatedDate: string;
}

export interface PendingTransferSettlement {
  id: string;
  windowId: string;
  offerId: string;
  fighterId: string;
  buyerPromotionId: string;
  sellerPromotionId: string | null;
  transferFee: number;
  terms: MarketContractTerms;
}

export interface TransferHistoryItem {
  id: string;
  windowId: string;
  offerId: string;
  fighterId: string;
  buyerPromotionId: string;
  sellerPromotionId: string | null;
  transferFee: number;
  terms: MarketContractTerms;
  outcome: TransferHistoryOutcome;
  reason: MarketReason;
  date: string;
}

export interface ContractMarketState {
  windows: Record<string, TransferWindow>;
  listings: Record<string, TransferListing>;
  offers: Record<string, TransferOffer>;
  pendingSettlements: Record<string, PendingTransferSettlement>;
  history: TransferHistoryItem[];
}

export type MarketReason =
  | 'submitted'
  | 'withdrawn'
  | 'seller_accepted'
  | 'seller_rejected'
  | 'seller_no_response'
  | 'seller_fee_too_low'
  | 'better_expected_pay'
  | 'better_prestige'
  | 'better_title_opportunity'
  | 'loyalty'
  | 'outbid'
  | 'fighter_missing'
  | 'promotion_missing'
  | 'ownership_changed'
  | 'window_not_open'
  | 'offer_missing'
  | 'insufficient_cash'
  | 'international_competition_active'
  | 'invalid_terms'
  | 'no_eligible_offer';

export type MarketMutationResult =
  | { ok: true; state: GameState; id: string }
  | { ok: false; state: GameState; reason: MarketReason };
```

`GameState` gains one persisted field:

```ts
contractMarket: ContractMarketState;
```

Use stable record IDs:

```ts
const windowId = (season: number) => `market-window-${season}`;
const listingId = (window: string, fighter: string) => `market-listing-${window}-${fighter}`;
const offerId = (window: string, buyer: string, fighter: string) => `market-offer-${window}-${buyer}-${fighter}`;
const settlementId = (window: string, fighter: string) => `market-settlement-${window}-${fighter}`;
const historyId = (window: string, offer: string) => `market-history-${window}-${offer}`;
```

---

### Task 1: Persist Market State and Migrate Version 13 Saves

**Files:**
- Modify: `src/types/game.ts:119-128,203-212,601-643`
- Modify: `src/lib/game/generator.ts:387-460`
- Modify: `src/lib/game/save.ts:17,19-23,69-105,122-335`
- Create: `src/lib/game/contractMarket.ts`
- Create: `test_contract_market_migration.ts`

**Interfaces:**
- Consumes: existing `GameState`, `Contract`, `Promotion`, `GrandPrixTournament`, and save migration.
- Produces:

```ts
export const CONTRACT_MARKET_FALLBACK_MONTH_DAY = '12-01';
export function initializeContractMarketState(state: Pick<GameState, 'currentDate'>, existing?: Partial<ContractMarketState>): ContractMarketState;
export function scheduleContractWindow(state: GameState, season: number): GameState;
```

- [ ] **Step 1: Write the failing migration test**

Create `test_contract_market_migration.ts`:

```ts
import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { CURRENT_SAVE_VERSION, validateAndMigrateState } from './src/lib/game/save';

const current = generateInitialWorld(2101);
assert.ok(current.contractMarket);
assert.ok(current.contractMarket.windows['market-window-2025']);

const legacy = structuredClone(current) as any;
legacy.saveVersion = 13;
delete legacy.contractMarket;
const ownershipBefore = Object.fromEntries(Object.values(legacy.fighters).map((fighter: any) => [fighter.id, fighter.contract?.promotionId ?? null]));
const contractsBefore = Object.fromEntries(Object.values(legacy.fighters).map((fighter: any) => [fighter.id, fighter.contract]));

const migrated = validateAndMigrateState(legacy)!;
assert.equal(CURRENT_SAVE_VERSION, 14);
assert.equal(migrated.saveVersion, 14);
assert.deepEqual(Object.fromEntries(Object.values(migrated.fighters).map(fighter => [fighter.id, fighter.contract?.promotionId ?? null])), ownershipBefore);
assert.deepEqual(Object.fromEntries(Object.values(migrated.fighters).map(fighter => [fighter.id, fighter.contract])), contractsBefore);
assert.deepEqual(migrated.contractMarket.listings, {});
assert.deepEqual(migrated.contractMarket.offers, {});
assert.deepEqual(migrated.contractMarket.pendingSettlements, {});
assert.deepEqual(migrated.contractMarket.history, []);
assert.equal(Object.values(migrated.contractMarket.windows).length, 1);
assert.deepEqual(validateAndMigrateState(structuredClone(migrated)), migrated);

console.log('Contract market migration checks passed.');
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx tsx test_contract_market_migration.ts
```

Expected: FAIL because `contractMarket` is absent and `CURRENT_SAVE_VERSION` is still 13.

- [ ] **Step 3: Add the canonical market types**

Add the interfaces from **Canonical Interfaces** to `src/types/game.ts`, then add:

```ts
contractMarket: ContractMarketState;
```

Do not add market fields to `Contract`; accepted offers create an ordinary existing contract.

- [ ] **Step 4: Implement deterministic empty state and initial schedule**

In `src/lib/game/contractMarket.ts`, use date-fns only:

```ts
import { addDays, format } from 'date-fns';
import type { ContractMarketState, GameState, TransferWindow } from '../../types/game';

export const CONTRACT_MARKET_FALLBACK_MONTH_DAY = '12-01';

export function initializeContractMarketState(
  state: Pick<GameState, 'currentDate'>,
  existing: Partial<ContractMarketState> = {}
): ContractMarketState {
  return {
    windows: { ...(existing.windows || {}) },
    listings: { ...(existing.listings || {}) },
    offers: { ...(existing.offers || {}) },
    pendingSettlements: { ...(existing.pendingSettlements || {}) },
    history: [...(existing.history || [])]
  };
}

export function scheduleContractWindow(state: GameState, season: number): GameState {
  const id = `market-window-${season}`;
  if (state.contractMarket.windows[id]) return state;
  const openDate = `${season}-${CONTRACT_MARKET_FALLBACK_MONTH_DAY}`;
  const window: TransferWindow = {
    id,
    season,
    openDate,
    closeDate: format(addDays(new Date(openDate), 30), 'yyyy-MM-dd'),
    status: 'scheduled'
  };
  return {
    ...state,
    contractMarket: {
      ...state.contractMarket,
      windows: { ...state.contractMarket.windows, [id]: window }
    }
  };
}
```

Initialize `contractMarket` in `generateInitialWorld`, then call `scheduleContractWindow(initialState, new Date(currentDate).getFullYear())` before the final ranking/snapshot return.

- [ ] **Step 5: Add the version-14 migration**

Set `CURRENT_SAVE_VERSION = 14`, include `contractMarket` in `extractSaveState`, and before the final `saveVersion` assignment normalize with:

```ts
state.contractMarket = initializeContractMarketState(state, state.contractMarket);
const currentSeason = new Date(state.currentDate).getFullYear();
state = scheduleContractWindow(state as GameState, currentSeason);
```

Keep all existing ownership normalization unchanged. Run market initialization before `syncChampionFlags` and `syncPlayerPromotionSnapshot`; repeated migration must not create a second window.

- [ ] **Step 6: Verify GREEN and existing migration**

Run:

```bash
npx tsx test_contract_market_migration.ts
npx tsx test_multi_league_migration.ts
npm run lint
```

Expected: all PASS. Update `test_multi_league_migration.ts` only where it asserts save version 13; its ownership assertions must remain unchanged.

---

### Task 2: Schedule, Open, Resolve, and Close 30-Day Windows

**Files:**
- Modify: `src/lib/game/contractMarket.ts`
- Create: `test_contract_market_calendar.ts`

**Interfaces:**
- Consumes: international tournament `scope`, `createdDate`, `status`, and `completedDate`.
- Produces:

```ts
export function getCurrentContractWindow(state: GameState): TransferWindow | null;
export function getInternationalSeasonCompletionDate(state: GameState, season: number): string | null;
export function advanceContractMarketCalendar(state: GameState): GameState;
```

- [ ] **Step 1: Write failing calendar lifecycle tests**

Create `test_contract_market_calendar.ts` with three fixtures:

```ts
import assert from 'node:assert/strict';
import { addDays, format } from 'date-fns';
import { generateInitialWorld } from './src/lib/game/generator';
import { advanceContractMarketCalendar, getCurrentContractWindow } from './src/lib/game/contractMarket';

const date = (value: string, days: number) => format(addDays(new Date(value), days), 'yyyy-MM-dd');
let state = generateInitialWorld(2102);
const season = 2025;
const windowId = `market-window-${season}`;

state.currentDate = '2025-08-01';
state.internationalCompetitionYears = [season];
for (const tournament of Object.values(state.tournaments)) {
  if (tournament.scope === 'international') {
    tournament.createdDate = '2025-07-01';
    tournament.status = 'completed';
    tournament.completedDate = '2025-07-31';
  }
}
state = advanceContractMarketCalendar(state);
assert.equal(state.contractMarket.windows[windowId].status, 'open');
assert.equal(state.contractMarket.windows[windowId].openDate, '2025-08-01');
assert.equal(state.contractMarket.windows[windowId].closeDate, date('2025-08-01', 30));

state.currentDate = date('2025-08-01', 29);
assert.equal(advanceContractMarketCalendar(state).contractMarket.windows[windowId].status, 'open');
state.currentDate = date('2025-08-01', 30);
assert.equal(advanceContractMarketCalendar(state).contractMarket.windows[windowId].status, 'resolving');

let fallback = generateInitialWorld(2103);
fallback.currentDate = '2025-12-01';
fallback.internationalCompetitionYears = [];
fallback = advanceContractMarketCalendar(fallback);
assert.equal(getCurrentContractWindow(fallback)?.status, 'open');

const closed = structuredClone(fallback);
closed.contractMarket.windows[windowId].status = 'closed';
closed.contractMarket.windows[windowId].resolvedDate = closed.currentDate;
const next = advanceContractMarketCalendar(closed);
assert.ok(next.contractMarket.windows['market-window-2026']);
assert.deepEqual(advanceContractMarketCalendar(next), next);

console.log('Contract market calendar checks passed.');
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx tsx test_contract_market_calendar.ts
```

Expected: FAIL because completion-date and lifecycle helpers do not exist.

- [ ] **Step 3: Derive cup completion from tournaments, not creation years alone**

Implement:

```ts
export function getInternationalSeasonCompletionDate(state: GameState, season: number): string | null {
  const tournaments = Object.values(state.tournaments).filter(tournament =>
    tournament.scope === 'international' &&
    new Date(tournament.createdDate).getFullYear() === season
  );
  if (!state.internationalCompetitionYears.includes(season) || !tournaments.length) return null;
  if (tournaments.some(tournament => tournament.status !== 'completed' || !tournament.completedDate)) return null;
  return tournaments.map(tournament => tournament.completedDate!).sort().at(-1)!;
}
```

Cancelled, planned, or active cups do not count as completed; the December 1 fallback prevents permanent lockout.

- [ ] **Step 4: Implement idempotent state transitions**

`advanceContractMarketCalendar` must:

1. Schedule the current season if neither it nor a closed current-season window exists.
2. While `scheduled`, move `openDate` to the day after the latest completed international tournament when that date is earlier than December 1; recompute `closeDate = openDate + 30 days`.
3. Open when `currentDate >= openDate`.
4. Move `open -> resolving` when `currentDate >= closeDate`; no listing/offer mutation is possible after this transition.
5. Leave `resolving` for the resolver in Task 6.
6. After a closed window, schedule the next season exactly once.

Select the current window by status priority `open`, `resolving`, `scheduled`, then latest season. Never reopen a closed window.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
npx tsx test_contract_market_calendar.ts
npx tsx test_contract_market_migration.ts
```

Expected: both PASS.

---

### Task 3: Add Listings, One Sealed Offer, Seller Responses, and Privacy Selectors

**Files:**
- Modify: `src/lib/game/contractMarket.ts`
- Create: `test_contract_market_offers.ts`

**Interfaces:**
- Consumes: active window and `getContractStatus()`.
- Produces:

```ts
export function listFighter(state: GameState, sellerPromotionId: string, fighterId: string, minimumFee: number): MarketMutationResult;
export function withdrawListing(state: GameState, sellerPromotionId: string, listingId: string): MarketMutationResult;
export function upsertTransferOffer(state: GameState, input: {
  buyerPromotionId: string;
  fighterId: string;
  transferFee: number;
  terms: MarketContractTerms;
}): MarketMutationResult;
export function withdrawTransferOffer(state: GameState, buyerPromotionId: string, offerId: string): MarketMutationResult;
export function respondToIncomingOffer(state: GameState, sellerPromotionId: string, offerId: string, accepted: boolean): MarketMutationResult;
export function getMarketCompetition(state: GameState, fighterId: string): { interestedPromotions: number; level: 'none' | 'low' | 'medium' | 'high' };
export function getVisibleMarketOffers(state: GameState, viewerPromotionId: string): Array<{
  id: string;
  fighterId: string;
  buyerPromotionId: string;
  direction: 'mine' | 'incoming';
  transferFee: number;
  terms: MarketContractTerms | null;
  status: TransferOfferStatus;
  sellerDecision: SellerDecisionStatus;
}>;
```

- [ ] **Step 1: Write failing mutation and privacy tests**

Create `test_contract_market_offers.ts` using one open window, one player fighter, one rival fighter, and one free agent. Assert:

```ts
const first = upsertTransferOffer(state, {
  buyerPromotionId: state.playerPromotionId,
  fighterId: rival.id,
  transferFee: 100_000,
  terms: { fights: 4, payPerFight: 20_000, winBonus: 20_000 }
});
assert.equal(first.ok, true);
const revised = upsertTransferOffer(first.state, {
  buyerPromotionId: state.playerPromotionId,
  fighterId: rival.id,
  transferFee: 120_000,
  terms: { fights: 5, payPerFight: 25_000, winBonus: 25_000 }
});
assert.equal(revised.ok, true);
assert.equal(Object.values(revised.state.contractMarket.offers).filter(offer => offer.status === 'active' && offer.buyerPromotionId === state.playerPromotionId && offer.fighterId === rival.id).length, 1);
assert.equal(revised.id, first.id);

const rivalBid = upsertTransferOffer(revised.state, {
  buyerPromotionId: rivalPromotionId,
  fighterId: playerFighter.id,
  transferFee: 80_000,
  terms: { fights: 4, payPerFight: 30_000, winBonus: 30_000 }
});
assert.equal(rivalBid.ok, true);
const visible = getVisibleMarketOffers(rivalBid.state, state.playerPromotionId);
assert.equal(visible.find(item => item.id === rivalBid.id)?.terms, null);
assert.equal(visible.find(item => item.id === rivalBid.id)?.transferFee, 80_000);
assert.ok(!visible.some(item => item.direction === 'incoming' && item.fighterId === rival.id));
assert.equal(getMarketCompetition(rivalBid.state, playerFighter.id).interestedPromotions, 1);

const closed = structuredClone(rivalBid.state);
closed.contractMarket.windows[windowId].status = 'closed';
assert.deepEqual(upsertTransferOffer(closed, {
  buyerPromotionId: state.playerPromotionId,
  fighterId: freeAgent.id,
  transferFee: 0,
  terms: { fights: 4, payPerFight: 10_000, winBonus: 10_000 }
}), { ok: false, state: closed, reason: 'window_not_open' });
```

Also assert listing ownership, non-negative integer fee/terms validation, revision dates, withdrawal, player seller accept/reject, and no mutation after close.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx tsx test_contract_market_offers.ts
```

Expected: FAIL because mutation and visibility helpers do not exist.

- [ ] **Step 3: Implement one-record upserts and boundary validation**

All mutation functions first resolve an `open` window. Validate external numeric inputs with `Number.isSafeInteger`, `fee >= 0`, `fights >= 1`, `payPerFight >= 1`, and `winBonus >= 0`.

For an expiring fighter (`contract.endDate <= window.closeDate`) or free agent, force `sellerPromotionId: null` and `transferFee: 0`; the current promotion may submit a renewal offer as an ordinary buyer. For a contracted fighter, capture current ownership in `sellerPromotionId`.

Use the stable offer ID so a revision replaces the same active record and preserves `createdDate`. Set `sellerDecision` to:

- `pending` for contracted transfers;
- `accepted` for free-agent/expiring offers because no seller fee is required.

Listing an expiring/free-agent fighter fails with `ownership_changed`. Listing withdrawal and offer withdrawal change status rather than deleting records.

- [ ] **Step 4: Implement player seller responses and sealed selectors**

Only `offer.sellerPromotionId === sellerPromotionId` can respond. Set `sellerDecision`, `sellerReason`, and `updatedDate`; do not accept/reject the fighter contract yet.

`getVisibleMarketOffers` returns:

- full transfer fee and contract terms for offers where viewer is buyer;
- incoming fee but `terms: null` where viewer is seller;
- no other offers.

`getMarketCompetition` counts distinct active buyer IDs and returns `none=0`, `low=1`, `medium=2`, `high>=3`; it never returns rival values.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
npx tsx test_contract_market_offers.ts
npx tsx test_contract_market_calendar.ts
```

Expected: both PASS.

---

### Task 4: Make Seller and Fighter Decisions Deterministic

**Files:**
- Modify: `src/lib/game/contractMarket.ts`
- Create: `test_contract_market_decisions.ts`

**Interfaces:**
- Consumes: promotion-scoped titles/rankings, roster ownership, and active offers.
- Produces:

```ts
export interface FighterOfferScore {
  offerId: string;
  expectedMoney: number;
  prestige: number;
  titleOpportunity: number;
  loyalty: number;
  utility: number;
}

export function evaluateSellerFee(state: GameState, offer: TransferOffer): { accepted: boolean; minimumFee: number; reason: MarketReason };
export function scoreFighterOffer(state: GameState, fighterId: string, offer: TransferOffer, eligibleOffers: TransferOffer[]): FighterOfferScore;
export function selectFighterOffer(state: GameState, fighterId: string, eligibleOffers: TransferOffer[]): { offer: TransferOffer | null; score: FighterOfferScore | null; reason: MarketReason };
```

- [ ] **Step 1: Write failing seller and utility tests**

Create `test_contract_market_decisions.ts` and assert:

1. The same state/IDs always produce deep-equal seller decisions and score breakdowns.
2. A listed fighter has a lower seller threshold than the same unlisted fighter.
3. Champion/top-ranked/replacement-scarce fighters require higher fees.
4. A high enough fee is accepted and a low fee rejected.
5. Fighter utility changes when only pay, prestige, title opportunity, or current-owner loyalty changes.
6. Fighter utility does not change when only age, popularity, potential, personality, nationality, injury, record, or marketability changes.
7. A moderately lower-paying offer can beat the top-paying offer through combined prestige/title opportunity/loyalty.
8. Exact utility ties resolve by `offer.id.localeCompare()`.

Use explicit packages such as:

```ts
const rich = offer('offer-rich', lowPrestigePromotionId, { fights: 4, payPerFight: 40_000, winBonus: 40_000 });
const opportunity = offer('offer-opportunity', highPrestigePromotionId, { fights: 4, payPerFight: 36_000, winBonus: 36_000 });
assert.equal(selectFighterOffer(state, fighter.id, [rich, opportunity]).offer?.id, opportunity.id);
```

Tune fixture promotion reputation/roster depth, not production weights, to prove the approved behavior.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx tsx test_contract_market_decisions.ts
```

Expected: FAIL because valuation functions do not exist.

- [ ] **Step 3: Implement seller valuation from approved factors**

Calculate a deterministic integer threshold:

```ts
const remainingContractValue = contract.fightsRemaining * (contract.payPerFight + Math.round(contract.winBonus * 0.5));
const titlePremium = domesticTitleHolder ? remainingContractValue : 0;
const rankPremium = Math.max(0, 16 - domesticRank) * contract.payPerFight;
const replacementPremium = Math.max(0, 8 - sameDivisionRosterSize) * contract.payPerFight;
const listedDiscount = listing ? Math.max(listing.minimumFee, Math.round(remainingContractValue * 0.75)) : 0;
const minimumFee = listing
  ? Math.max(listing.minimumFee, listedDiscount + titlePremium + Math.round(replacementPremium * 0.5))
  : remainingContractValue + titlePremium + rankPremium + replacementPremium;
```

Expiring/free agents never call seller valuation. A listed offer at or above the threshold is accepted; an unsolicited offer uses the higher threshold. Cash benefit is represented only by comparing the offered fee to this threshold; do not add personality or randomness.

- [ ] **Step 4: Implement the four-factor fighter score**

For eligible offers, compute:

```ts
expectedMoney = terms.payPerFight + Math.round(terms.winBonus * 0.5);
moneyScore = maxExpectedMoney ? expectedMoney / maxExpectedMoney * 100 : 0;
prestigeScore = buyer.reputation;
titleOpportunityScore = clamp(100 - sameDivisionRosterSize * 6 - (activeChampion ? 15 : 0), 0, 100);
loyaltyScore = buyerPromotionId === currentPromotionId ? 100 : 0;
utility = round(moneyScore * 0.55 + prestigeScore * 0.20 + titleOpportunityScore * 0.20 + loyaltyScore * 0.05, 4);
```

These are the only score inputs. Select descending utility, then ascending stable offer ID. Derive the winning reason from the winner's largest positive advantage over the runner-up, checking in order money, prestige, title opportunity, loyalty; a sole offer uses its strongest weighted component.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
npx tsx test_contract_market_decisions.ts
```

Expected: PASS with no `Math.random` in `contractMarket.ts`.

---

### Task 5: Generate AI Shortlists and Budgeted Sealed Offers

**Files:**
- Modify: `src/lib/game/contractMarket.ts`
- Modify: `src/lib/game/generator.ts:213-230` only if rival starting cash is zero in the current fixture
- Modify: `src/lib/game/save.ts` only to normalize missing AI cash, never existing non-zero cash
- Create: `test_contract_market_ai.ts`

**Interfaces:**
- Consumes: `getContractExpectation()`, promotion rosters/rankings/titles, market mutation APIs.
- Produces:

```ts
export const AI_MARKET_STARTING_CASH = 500_000;
export function getPromotionContractBudget(state: GameState, promotionId: string): number;
export function getPromotionRosterNeeds(state: GameState, promotionId: string): Partial<Record<WeightClass, number>>;
export function buildAiMarketShortlist(state: GameState, buyerPromotionId: string): string[];
export function createAiMarketOffer(state: GameState, buyerPromotionId: string, fighterId: string): TransferOffer | null;
export function runAiContractMarket(state: GameState): GameState;
```

- [ ] **Step 1: Write failing AI tests**

Create `test_contract_market_ai.ts` and assert:

- `getPromotionContractBudget` is `Math.floor(Math.max(0, promotion.money) * 0.20)`.
- A division already at 10+ contracted fighters has no depth need; a division below 8 has positive need.
- Expected departures (`contract.endDate <= window.closeDate`) increase need.
- Shortlists are stable for equivalent states and ordered by need, rank/record/popularity, age/potential balance, availability, injury risk, then fighter ID.
- AI returns no offer when the fighter solves no roster need.
- `transferFee + fights * (payPerFight + winBonus * 0.5)` never exceeds budget.
- AI does not offer for its own non-expiring fighter.
- AI offers for player-owned, rival-owned, expiring, and free-agent targets only when needed.
- Calling `runAiContractMarket` twice on the same date is idempotent; a later open-window date may revise the same stable offer ID, never create a duplicate.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx tsx test_contract_market_ai.ts
```

Expected: FAIL because roster need, budget, and AI offer helpers do not exist.

- [ ] **Step 3: Establish the Phase-1 cash boundary**

Rival promotions currently start with zero cash, which would make the approved market inert. Set newly generated AI promotions to `AI_MARKET_STARTING_CASH` instead of zero. During migration, only fill a missing/non-finite AI `money`; preserve every finite saved value, including zero. Tests that intentionally set zero must continue proving no bids.

This is a fixed Phase-1 operating balance, not event income, debt, or bankruptcy. Phase 2 replaces only `getPromotionContractBudget()` and AI cash flow.

- [ ] **Step 4: Implement deterministic roster needs and shortlists**

For each weight class:

```ts
need = Math.max(0, 8 - retainedRosterSize)
  + (noChampion ? 2 : 0)
  + (topFiveCount < 3 ? 1 : 0)
  + expectedDepartures;
```

`retainedRosterSize` excludes contracts ending by window close. Candidate ordering uses a numeric sporting/commercial score from existing rank, wins-losses, popularity, potential-age balance, and injury/suspension penalties. These values shortlist candidates only; they must never enter fighter utility.

Exclude retired fighters, the buyer's retained fighters, active international participants, and fighters already selected beyond the first bounded 5 candidates per needed division.

- [ ] **Step 5: Build one budgeted package per target**

Use `getContractExpectation(fighter, buyer)` for base purse/bonus/fights. Calculate seller maximum from `evaluateSellerFee` and sporting/commercial/need/risk, then cap the full commitment to the budget. Return `null` when:

- no roster need remains;
- buyer is missing or not AI-controlled;
- full commitment exceeds budget;
- contracted seller fee cannot meet the deterministic seller threshold;
- buyer would need negative cash.

Call the same `upsertTransferOffer` path as player offers. Sort AI buyers by ID and shortlist IDs by their deterministic order.

- [ ] **Step 6: Run AI once per open-window date**

`runAiContractMarket` returns unchanged unless the current window is open and `lastAiRunDate !== currentDate`. Process all AI promotions, update the window's `lastAiRunDate`, and keep stable offer IDs. Do not expose rival offer values through selectors.

- [ ] **Step 7: Verify GREEN**

Run:

```bash
npx tsx test_contract_market_ai.ts
npx tsx test_contract_market_offers.ts
npx tsx test_rival_promotions.ts
```

Expected: all PASS.

---

### Task 6: Resolve Offers and Apply Each Transfer Atomically

**Files:**
- Modify: `src/lib/game/contractMarket.ts`
- Modify: `src/lib/game/autobooker.ts:1121-1243,1487-1501`
- Reuse: `src/lib/engine.ts:1158-1227` (`syncChampionFlags`)
- Reuse: `src/lib/game/rankings.ts:183-236` (`updateRankings`)
- Create: `test_contract_market_settlement.ts`

**Interfaces:**
- Consumes: seller/fighter decisions, rankings, champion sync, event repair.
- Produces:

```ts
export function isFighterInActiveInternationalCompetition(state: GameState, fighterId: string): boolean;
export function validatePendingSettlement(state: GameState, settlement: PendingTransferSettlement): MarketReason | null;
export function applyPendingSettlement(state: GameState, settlement: PendingTransferSettlement, language?: Language): { state: GameState; outcome: TransferHistoryOutcome; reason: MarketReason };
export function resolveContractMarket(state: GameState, language?: Language): GameState;
export function validateContractMarketState(state: GameState): string[];
```

- [ ] **Step 1: Write failing atomic settlement tests**

Create `test_contract_market_settlement.ts` with isolated fixtures proving:

1. Seller-approved contracted transfer debits buyer and credits seller by exactly the same fee.
2. Free-agent signing and renewal move no transfer fee.
3. Winner gets a normal contract with buyer `promotionId`, offered purse/bonus/fights, `exclusivity: true`, and `endDate = getContractEndDate(resolutionDate, fights)`.
4. Seller domestic undisputed/interim title is vacated through `syncChampionFlags`; international titles remain attached to the fighter.
5. Seller and buyer rankings, player compatibility snapshots, world rankings, availability, and title history are synchronized.
6. A player-owned seller offer with `pending` response is rejected with `seller_no_response`.
7. AI seller decision is deterministic and applied before fighter utility.
8. Insufficient cash, changed ownership, missing entities, invalid terms, or active international registration produce explicit invalid history and leave money/contracts/titles/rankings/ownership byte-for-byte unchanged.
9. Rival offers that lose receive `outbid`; the winner stores one of the four approved explanation reasons.
10. Calling the resolver twice adds no second history item, second debit, or second contract update.
11. Closed windows have no active offers or pending settlements.

Snapshot the protected fields before an invalid transaction:

```ts
const before = structuredClone({
  promotions: state.promotions,
  promotion: state.promotion,
  fighters: state.fighters,
  titles: state.titles,
  titlesByPromotion: state.titlesByPromotion,
  rankings: state.rankings,
  rankingsByPromotion: state.rankingsByPromotion,
  worldRankings: state.worldRankings,
  events: state.events,
  tournaments: state.tournaments
});
const result = applyPendingSettlement(state, settlement, 'en');
assert.deepEqual({
  promotions: result.state.promotions,
  promotion: result.state.promotion,
  fighters: result.state.fighters,
  titles: result.state.titles,
  titlesByPromotion: result.state.titlesByPromotion,
  rankings: result.state.rankings,
  rankingsByPromotion: result.state.rankingsByPromotion,
  worldRankings: result.state.worldRankings,
  events: result.state.events,
  tournaments: result.state.tournaments
}, before);
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx tsx test_contract_market_settlement.ts
```

Expected: FAIL because settlement and resolver functions do not exist.

- [ ] **Step 3: Revalidate every package before selection**

Reject an offer before utility when:

- fighter/buyer/seller is missing;
- status is not active or window does not match;
- ownership no longer equals captured seller;
- terms are invalid;
- buyer cash is below transfer fee;
- buyer equals contracted seller unless this is an expiring renewal;
- fighter is in a planned/active international tournament.

For contracted AI sellers, call `evaluateSellerFee`. For player sellers, require stored `sellerDecision === 'accepted'`; pending becomes `seller_no_response`. Rejected seller fees never reach `selectFighterOffer`.

- [ ] **Step 4: Build stable pending settlements and histories**

At `open -> resolving`, group active offers by fighter ID. Sort fighters and offers by ID. Mark invalid/rejected packages with stable `market-history-${windowId}-${offerId}` records. Select one eligible offer and add exactly one `PendingTransferSettlement`; mark other eligible offers rejected/outbid.

Keep history bounded to the newest 500 records after each resolution. Never store transient utility score arrays.

- [ ] **Step 5: Apply a candidate transaction, then validate**

`applyPendingSettlement` must construct a new candidate state and perform, in this order:

1. Revalidate entities, ownership, fee, cash, terms, and international registration.
2. Clone buyer/seller promotions; debit/credit fee. When either is the player promotion, update both `promotion` and `promotions[playerPromotionId]`.
3. Replace only the winner fighter's contract; clear legacy `fighter.counterOffer` and `contract.counterOffer`.
4. Call `syncChampionFlags(candidate)` to vacate seller domestic titles and preserve international titles.
5. Call `updateRankings(candidate, undefined, sellerId)` when seller exists, then buyer; refresh world rankings.
6. Repair future event availability using ownership-aware checks.
7. Add one transfer news item and leave title/history changes from `syncChampionFlags` intact.
8. Run `validateContractMarketState(candidate)` plus money/owner/title checks.
9. Return the original state unchanged if any invariant fails; otherwise return the candidate.

No mutation occurs on the input state. There is no rollback branch because candidate state is not committed until validation passes.

- [ ] **Step 6: Make event availability ownership-aware**

In `repairEventAvailability`, a fighter is unavailable when:

```ts
const ownsFighter = (fighter: Fighter | undefined) =>
  Boolean(fighter?.contract) &&
  (event.scope === 'international' || fighter!.contract!.promotionId === event.promotionId);
```

Use the same rule for replacement candidates. International events accept any valid domestic contract; domestic events require matching ownership. This makes settlement registration repair meaningful without changing active international brackets.

- [ ] **Step 7: Close only after all pending settlements are consumed**

`resolveContractMarket` applies pending settlements in stable ID order, writes accepted/invalid history, removes each consumed pending record, marks listings sold/expired, resolves every remaining active offer, then sets:

```ts
status: 'closed',
resolvedDate: state.currentDate
```

A second call sees a closed window and returns unchanged.

- [ ] **Step 8: Verify GREEN and competition regressions**

Run:

```bash
npx tsx test_contract_market_settlement.ts
npx tsx test_scoped_rankings_titles.ts
npx tsx test_international_competitions.ts
npx tsx test_tournament.ts
```

Expected: all PASS.

---

### Task 7: Integrate Market Days With Contract Expiry and Autopilot

**Files:**
- Modify: `src/lib/game/contractMarket.ts`
- Modify: `src/lib/engine.ts:172-384`
- Modify: `src/lib/game/observer.ts`
- Modify: `src/lib/game/autobooker.ts`
- Modify: `src/lib/game/tournament.ts` only at optional/emergency direct-signing paths
- Modify: `src/store/gameStore.ts:269-418`
- Modify: `test_long_sim.ts:1-40,169 onward`
- Create: `test_contract_market_integration.ts`

**Interfaces:**
- Produces:

```ts
export function isContractMarketOpen(state: GameState): boolean;
export function isContractProtectedUntilResolution(state: GameState, fighterId: string, nextDate: string): boolean;
export function advanceContractMarket(state: GameState, language?: Language): GameState;
```

- [ ] **Step 1: Write failing daily-integration tests**

Create `test_contract_market_integration.ts` and prove:

- An expiring contract inside an open window remains attached until resolution, allowing the incumbent and rivals to submit sealed packages.
- The same contract expires through existing behavior when no window is open.
- Resolution with no eligible winner releases the expired fighter and vacates a domestic title.
- `advanceTime(state, 1)` opens after cups/fallback, runs AI at most once for the date, resolves at close, and schedules the next season.
- `advanceTime(state, 35)` and 35 repeated one-day calls end with the same window status and no duplicate market record for a controlled fixture with random injury disabled by using no contracted non-target fighters.
- Existing observer/autobooker/tournament direct signing does not create or renew contracts while the market is open; it resumes after close.
- Saving/loading in the middle of an open window preserves deadline, records, and final deterministic outcome.
- An active international participant keeps ownership and receives invalid history rather than switching.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx tsx test_contract_market_integration.ts
```

Expected: FAIL because `advanceTime` ignores the market and expiry clears pending renewals.

- [ ] **Step 3: Add the single daily orchestrator**

Implement:

```ts
export function advanceContractMarket(state: GameState, language: Language = 'en'): GameState {
  let next = advanceContractMarketCalendar(state);
  if (isContractMarketOpen(next)) next = runAiContractMarket(next);
  if (getCurrentContractWindow(next)?.status === 'resolving') next = resolveContractMarket(next, language);
  return advanceContractMarketCalendar(next);
}
```

It must be idempotent for the same date and state.

- [ ] **Step 4: Protect expiring contracts only during an active resolution cycle**

Before the fighter expiry loop in `advanceTime`, call the market orchestrator on `{ ...newState, currentDate: nextDate }`. During expiry, skip nulling a contract only when:

```ts
isContractProtectedUntilResolution(newState, fighter.id, nextDate)
```

The helper returns true only for `open`/`resolving` windows and contracts ending on/before window close. At resolver close, any expired fighter without an accepted offer becomes a free agent before champion/ranking synchronization.

Do not globally change `getContractStatus()` semantics.

- [ ] **Step 5: Recheck calendar after international progression**

The existing international tournament advancement occurs near the end of `advanceTime`. Pass that result through `advanceContractMarket(...)` before the final social/news return so a cup completed today can open the market today/next eligible date. Both calls are safe because AI and resolver records are date/idempotency guarded.

- [ ] **Step 6: Prevent old direct-signing paths from bypassing sealed offers**

When `isContractMarketOpen(state)`:

- `runObserverDecisions` skips sign/renew/release contract decisions;
- optional roster replenishment in `autoBookEventsAndContracts` skips direct contracts but continues ordinary event booking;
- tournament emergency signing skips direct contracts and reports its existing delay path;
- manual store sign/renew/release guards are added in Task 8.

Do not disable fight simulation, healing, calendar repair, tournament progression, or ordinary event settlement.

- [ ] **Step 7: Use the same one-day market order in autopilot and long sim**

Because autopilot already calls `advanceTime(gameState, 1)`, do not add a second store-level market call. Extend `test_long_sim.ts` diagnostics and its `runDaysSimulation` path only as needed to call `validateContractMarketState` and report:

- multiple ownership errors;
- missing-entity active offers;
- negative cash caused by settlement;
- domestic champion ownership errors;
- unresolved offers in closed windows;
- duplicate history IDs.

- [ ] **Step 8: Verify GREEN**

Run:

```bash
npx tsx test_contract_market_integration.ts
npx tsx test_autopilot_async.ts
npx tsx test_observer_decisions.ts
```

Expected: market/integration and async tests PASS. If the known observer fixture still fails before market changes, report it separately; do not weaken market guards or unrelated contract rules to make it pass.

---

### Task 8: Add Thin Store Actions and Guard Legacy Contract Actions

**Files:**
- Modify: `src/store/gameStore.ts:35,72-124,493-664`
- Create: `test_contract_market_store.ts`

**Interfaces:**
- Produces additions to `GameStore`:

```ts
listMarketFighter: (fighterId: string, minimumFee: number) => MarketReason | null;
withdrawMarketListing: (listingId: string) => MarketReason | null;
submitMarketOffer: (fighterId: string, transferFee: number, terms: MarketContractTerms) => MarketReason | null;
withdrawMarketOffer: (offerId: string) => MarketReason | null;
respondToMarketOffer: (offerId: string, accepted: boolean) => MarketReason | null;
```

- [ ] **Step 1: Write failing store-adapter tests**

Create `test_contract_market_store.ts`. Seed the real store with a generated state and open window, then assert:

- each action uses `playerPromotionId`, not a caller-provided owner;
- successful actions update only the expected market record and return `null`;
- invalid actions return the pure helper's `MarketReason` and do not mutate store state;
- rival-owned fighters cannot be listed by the player;
- incoming responses apply only to player-owned seller offers;
- existing `signFighter`, `renewFighter`, and `releaseFighter` do not bypass an open market;
- load/import/new game carry/reset only persisted `contractMarket`, while transient `autopilotRun` behavior remains unchanged.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx tsx test_contract_market_store.ts
```

Expected: FAIL because market actions do not exist.

- [ ] **Step 3: Implement one thin adapter pattern**

Each action follows:

```ts
submitMarketOffer: (fighterId, transferFee, terms) => {
  const result = upsertTransferOffer(get(), {
    buyerPromotionId: get().playerPromotionId,
    fighterId,
    transferFee,
    terms
  });
  if (!result.ok) return result.reason;
  set(result.state);
  return null;
}
```

Use the same pattern for listing, withdrawal, and seller response. Do not duplicate validation or valuation in Zustand.

- [ ] **Step 4: Guard legacy player actions**

At the start of `signFighter`, `renewFighter`, and `releaseFighter`, return without mutation while the market is open when the fighter is market-eligible or referenced by an active listing/offer. Outside an open window, preserve existing behavior exactly.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
npx tsx test_contract_market_store.ts
npx tsx test_management_depth.ts
npx tsx test_autopilot_async.ts
```

Expected: all applicable tests PASS.

---

### Task 9: Add the Contract Market Page, Navigation, Privacy UI, and i18n

**Files:**
- Create: `src/pages/ContractMarket.tsx`
- Modify: `src/store/gameStore.ts:35`
- Modify: `src/App.tsx:11-26,57-80`
- Modify: `src/components/AppShell.tsx:3-23,28-57,84-101`
- Modify: `src/pages/FighterDetail.tsx` contract controls
- Modify: `src/pages/FreeAgents.tsx` signing controls
- Modify: `src/i18n/resources/en.ts`
- Modify: `src/i18n/resources/vi.ts`
- Modify: `test_ui_contracts.ts`
- Modify: `test_i18n.ts`

**Interfaces:**
- Consumes: store actions and privacy selectors.
- Produces: `GameView = ... | 'contract-market'` and one responsive market destination with tabs `available | listings | incoming | offers | history`.

- [ ] **Step 1: Write failing UI and translation contracts**

Extend `test_ui_contracts.ts`:

```ts
const market = readFileSync('src/pages/ContractMarket.tsx', 'utf8');
for (const token of [
  'useTranslation',
  '$.contractMarket.title',
  'getCurrentContractWindow',
  'getMarketCompetition',
  'getVisibleMarketOffers',
  'listMarketFighter',
  'submitMarketOffer',
  'respondToMarketOffer',
  "'available'",
  "'listings'",
  "'incoming'",
  "'offers'",
  "'history'",
  'aria-live="polite"',
  'type="button"',
  'grid-cols-1',
  'min-w-0'
]) assert.ok(market.includes(token), `Contract Market UI missing ${token}`);

assert.ok(app.includes("case 'contract-market'"));
assert.ok(shell.includes("case 'contract-market'"));
assert.ok(labels.includes('Contract Market'));
assert.ok(!market.includes('contractMarket.offers['), 'UI must use sealed visibility selectors rather than raw rival offer values');
```

Add `ContractMarket.tsx` to translated pages in `test_i18n.ts`, and require matching `navigation.contractMarket` plus `contractMarket` object keys in English/Vietnamese.

- [ ] **Step 2: Run UI tests and verify RED**

Run:

```bash
npx tsx test_ui_contracts.ts
npx tsx test_i18n.ts
```

Expected: FAIL because route, page, and copy do not exist.

- [ ] **Step 3: Add route and navigation**

Add `'contract-market'` to `GameView`, lazy-load `ContractMarket`, render it in `App.tsx`, and add one Competition item using the already installed Lucide `Handshake` icon:

```ts
{ label: 'Contract Market', view: 'contract-market', icon: Handshake }
```

Map the view to `t($ => $.navigation.contractMarket)` in `navLabel`.

- [ ] **Step 4: Build the five-tab responsive page**

Use existing `PageHeader`, `Panel`, `Button`, `Select`, `Stat`, and localization helpers. The page shows:

- Window status, open/close date, days remaining, and an `aria-live="polite"` action/result message.
- **Available:** listed, expiring-by-deadline, and free-agent targets; ownership, minimum fee, affordability, eligibility, interested promotion count, and low/medium/high competition. Never show rival offer values.
- **My Listings:** player-owned active listings with minimum fee and withdraw action.
- **Incoming Offers:** only selector-produced incoming fee, buyer identity, accept/reject buttons, and no rival contract terms.
- **My Offers:** player offer fee/terms/status with revise/withdraw controls.
- **History:** compact outcome, buyer/seller, fee, and localized reason.

Offer form accepts fee/pay/bonus/fights as controlled number inputs, validates at the store boundary, and reports returned `MarketReason`. All controls are semantic buttons/labels, minimum 44px, wrap on mobile, and use `grid-cols-1`/`min-w-0`. Do not create another component abstraction unless the page exceeds the existing project style materially.

- [ ] **Step 5: Block bypass controls visibly during the window**

In `FighterDetail.tsx` and `FreeAgents.tsx`, disable direct sign/renew/release controls for market-eligible fighters while a market is open and render a button/link to `setView('contract-market')`. Outside the market, preserve current forms.

- [ ] **Step 6: Add matching English/Vietnamese copy**

Add at minimum:

```ts
navigation: { contractMarket: 'Contract Market' }
contractMarket: {
  eyebrow: 'Competition', title: 'Contract Market',
  tabs: { available: 'Available', listings: 'My Listings', incoming: 'Incoming Offers', offers: 'My Offers', history: 'History' },
  status: { scheduled: 'Scheduled', open: 'Open', resolving: 'Resolving', closed: 'Closed' },
  deadline: 'Deadline {{date}}', daysRemaining: '{{count}} days remaining',
  interested: '{{count}} interested promotions', competition: 'Competition: {{level}}',
  affordable: 'Affordable', unaffordable: 'Insufficient funds', list: 'List fighter', withdraw: 'Withdraw',
  submit: 'Submit sealed offer', revise: 'Revise offer', accept: 'Accept fee', reject: 'Reject fee',
  noItems: 'No records in this section.', marketRequired: 'Contract activity is handled through the open market.',
  reasons: {
    betterExpectedPay: 'Superior expected pay', betterPrestige: 'Stronger promotion prestige',
    betterTitleOpportunity: 'Better title opportunity', loyalty: 'Loyalty to current promotion',
    outbid: 'Another package was preferred', sellerRejected: 'Seller rejected the fee',
    sellerNoResponse: 'Seller did not approve the fee', sellerFeeTooLow: 'Transfer fee was too low',
    insufficientCash: 'Buyer no longer had enough cash', internationalCompetitionActive: 'Fighter remained in an active international competition',
    invalid: 'Package became invalid'
  }
}
```

Add equivalent Vietnamese values with the exact same typed key structure.

- [ ] **Step 7: Verify GREEN without browser automation**

Run:

```bash
npx tsx test_ui_contracts.ts
npx tsx test_i18n.ts
npm run lint
npm run build
```

Expected: all PASS. The user performs manual responsive/visual verification.

---

### Task 10: Add Multi-Season Acceptance Invariants and Run the Full Gate

**Files:**
- Create: `test_contract_market_long_sim.ts`
- Modify: `test_long_sim.ts` diagnostics only
- Modify only production files directly implicated by a failing invariant; do not add scope.

**Interfaces:**
- Consumes: all previous task outputs.
- Produces: deterministic multi-season proof and a buildable Phase-1 vertical slice.

- [ ] **Step 1: Write the long-market acceptance script**

Create `test_contract_market_long_sim.ts` using the same one-day order as `test_long_sim.ts`. Run two copies of `generateInitialWorld(2110)` for 1,825 days and assert equal compact market outputs:

```ts
const compact = (state: GameState) => ({
  currentDate: state.currentDate,
  promotions: Object.fromEntries(Object.entries(state.promotions).map(([id, promotion]) => [id, promotion.money])),
  ownership: Object.fromEntries(Object.values(state.fighters).map(fighter => [fighter.id, fighter.contract?.promotionId ?? null])),
  windows: state.contractMarket.windows,
  activeOffers: Object.values(state.contractMarket.offers).filter(offer => offer.status === 'active'),
  pendingSettlements: state.contractMarket.pendingSettlements,
  history: state.contractMarket.history
});
assert.deepEqual(compact(runA), compact(runB));
```

For every yearly checkpoint assert zero:

- fighters with an unknown promotion owner;
- duplicate active buyer/fighter offers;
- active offers referencing missing entities;
- promotions below zero due to transfer settlement;
- domestic champions whose contract owner differs from title promotion;
- closed windows containing active offers or pending settlements;
- duplicate history IDs;
- ownership changes for planned/active international participants;
- `validateContractMarketState` errors;
- existing calendar, tournament, title-debt, round-stat, missing-result, and crash errors.

Also assert at least two windows close, at least one AI offer is generated, and at least one market history result exists; otherwise the test is not exercising the feature.

- [ ] **Step 2: Run the test and verify RED if any acceptance gap remains**

Run:

```bash
npx tsx test_contract_market_long_sim.ts
```

Expected before final fixes: either PASS or a meaningful invariant failure identifying the incomplete integration. Do not weaken assertions to obtain GREEN.

- [ ] **Step 3: Fix only the identified market invariant**

For each failure, add the smallest focused assertion to the relevant earlier market test, observe RED, make the minimal production correction, then rerun that focused test before rerunning the long script.

- [ ] **Step 4: Run all focused Contract Market tests**

Run:

```bash
npx tsx test_contract_market_migration.ts
npx tsx test_contract_market_calendar.ts
npx tsx test_contract_market_offers.ts
npx tsx test_contract_market_decisions.ts
npx tsx test_contract_market_ai.ts
npx tsx test_contract_market_settlement.ts
npx tsx test_contract_market_integration.ts
npx tsx test_contract_market_store.ts
npx tsx test_contract_market_long_sim.ts
```

Expected: all nine scripts PASS.

- [ ] **Step 5: Run impacted existing regressions**

Run:

```bash
npx tsx test_multi_league_foundation.ts
npx tsx test_multi_league_migration.ts
npx tsx test_scoped_rankings_titles.ts
npx tsx test_rival_promotions.ts
npx tsx test_rival_simulation.ts
npx tsx test_international_competitions.ts
npx tsx test_management_depth.ts
npx tsx test_ranking_context.ts
npx tsx test_tournament.ts
npx tsx test_calendar.ts
npx tsx test_autopilot_async.ts
npx tsx test_live_fight.ts
npx tsx test_ui_contracts.ts
npx tsx test_i18n.ts
npx tsx test_long_sim.ts
```

Expected: all applicable scripts PASS with zero existing long-simulation error counters. Report any reproducible pre-existing unrelated failure separately rather than changing unrelated behavior.

- [ ] **Step 6: Run static and production verification**

Run:

```bash
npm run lint
npm run build
git diff --check
```

Expected: TypeScript exits 0, Vite builds successfully, and `git diff --check` prints no output.

- [ ] **Step 7: Confirm scope and working-tree safety**

Run:

```bash
git status --short
git diff --stat
```

Expected: only Contract Market source/tests/plan plus the user's pre-existing uncommitted files are changed. Do not stage, commit, push, discard, or rewrite unrelated files.

## Deferred to Later Approved Phases

- Real AI event income, recurring payroll, debt, bankruptcy, brand investment, sponsor/media revenue, and replacement of the 20% cash budget boundary.
- Promotion creation/dissolution, administration, tier movement, promotion/relegation, and contract settlement caused by closure.
- Rolling international coefficients, variable cup places, group/league phases, qualification ties, and home/away events.
- Manager identity, job offers, and switching the player-controlled promotion.
- Agents, signing bonuses, guaranteed purses, clauses, personality/relocation/brand-fit utility, media-rights bidding, sponsor exclusivity, audience overlap, and persistent commercial rivalries.
