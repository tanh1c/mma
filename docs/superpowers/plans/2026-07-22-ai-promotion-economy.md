# AI Promotion Economy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every player and AI promotion one deterministic operating economy covering recurring income/cost, event profit/loss, debt recovery, brand investment, and runway-aware Contract Market spending, with exact finances visible in the frontend.

**Architecture:** `Promotion.money` remains the only cash balance. A focused pure `src/lib/game/promotionEconomy.ts` module owns initialization, derived modes, debt/headroom rules, auditable transactions, monthly settlement, brand investment, contract capacity, and validation; existing event, market, objective, and drama paths call this module instead of mutating cash independently. Persisted economy ledgers are promotion-scoped, while the player's legacy `financeLedger` receives stable non-cash mirrors until its existing readers are migrated.

**Tech Stack:** TypeScript 5.8, React 19, Zustand 5, Vite 6, i18next, date-fns, `node:assert/strict`, and root-level tests executed with `npx tsx`.

## Global Constraints

- Apply the same formulas and debt boundary to player and AI promotions; only discretionary decision ownership differs.
- Keep `Promotion.money` authoritative. Never add another cash balance.
- Preserve `GameState.promotion` as the player compatibility snapshot via `syncPlayerPromotionSnapshot()`.
- Financial modes are exactly `growth | stable | cautious | recovery`; do not replace `stable`/`cautious` with `balanced`.
- Cash may be negative but must remain `>= -debtLimit` after every approved transaction.
- Unpaid mandatory operating and roster-retainer costs become non-negative `outstandingLiabilities`; they never push cash below the debt boundary.
- Incoming promotion income repays liabilities before discretionary spending becomes available.
- Recovery mode uses hysteresis and cannot be exited until liabilities are zero and both headroom and runway exceed the exit threshold.
- Monthly settlement is keyed by `promotionId + YYYY-MM`, chronological, and idempotent. Migration initializes the current month as already settled.
- Domestic event settlement is keyed by `promotionId + eventId` and happens at most once. Cancelled and international-neutral events do not create domestic event finance.
- International participation does not duplicate ownership, retainer, event settlement, or fighter purse costs.
- Contract Market settlement remains candidate-state atomic and revalidates current economy capacity before any transfer mutation.
- AI finance choices are deterministic functions of state and stable IDs; they must not call `Math.random()` or consume gameplay RNG.
- Player sponsor/media controls remain the source of player commercial income. Phase 2 adds no AI negotiation UI.
- Preserve existing legacy player finance readers by mirroring new player ledger rows with stable IDs and `affectsCash: false`; mirrored rows must never apply money twice.
- Save migration increases version once from 14 to 15, preserves every promotion balance, performs no retrospective settlement, and is idempotent.
- No bankruptcy, administration, promotion creation/dissolution, loans, interest, investor injection, or automatic fighter release.
- Remove or bypass the existing player owner cash injection once recovery is authoritative; Phase 2 never silently creates cash.
- Do not add assets or dependencies, refactor unrelated systems, or redesign existing sponsor/media negotiations.
- Do not run Playwright or browser automation; the user performs manual visual verification.
- Do not stage, commit, push, discard, or rewrite unrelated working-tree changes.
- Verification uses focused `npx tsx` tests, impacted regressions, a deterministic 1,825-day acceptance, `npm run lint`, `npm run build`, and `git diff --check`.

## Canonical Interfaces and Formulas

Add these exact persisted types to `src/types/game.ts`:

```ts
export type PromotionFinancialMode = 'growth' | 'stable' | 'cautious' | 'recovery';

export type PromotionLedgerCategory =
  | 'event_gate'
  | 'event_media'
  | 'event_sponsor'
  | 'fighter_purse'
  | 'win_bonus'
  | 'venue'
  | 'event_marketing'
  | 'monthly_sponsor'
  | 'monthly_media'
  | 'operating_cost'
  | 'roster_retainer'
  | 'liability_payment'
  | 'brand_investment'
  | 'transfer_fee'
  | 'objective_reward'
  | 'drama';

export interface PromotionLedgerEntry {
  id: string;
  promotionId: string;
  date: string;
  settlementKey: string;
  category: PromotionLedgerCategory;
  amount: number;
  balanceAfter: number;
  liabilityDelta: number;
  sourceId?: string;
  descriptionKey: string;
}

export interface PromotionEconomy {
  promotionId: string;
  debtLimit: number;
  recoveryMode: boolean;
  financialMode: PromotionFinancialMode;
  monthlyOperatingCost: number;
  monthlyRosterRetainer: number;
  monthlySponsorIncome: number;
  monthlyMediaIncome: number;
  scheduledBrandInvestment: number;
  outstandingLiabilities: number;
  estimatedRunwayMonths: number;
  contractBudget: number;
  lastMonthlySettlement: string;
  settledEventIds: string[];
  ledgerOpeningBalance: number;
  legacyFinanceLedgerIds: string[];
  ledger: PromotionLedgerEntry[];
}
```

Add to `GameState`:

```ts
promotionEconomies: Record<string, PromotionEconomy>;
```

Use these exact public economy interfaces in `src/lib/game/promotionEconomy.ts`:

```ts
export type PromotionEconomyReason =
  | 'promotion_missing'
  | 'economy_missing'
  | 'invalid_amount'
  | 'duplicate_transaction'
  | 'debt_limit'
  | 'outstanding_liabilities'
  | 'recovery_mode'
  | 'required_reserve';

export type PromotionTransactionClass = 'income' | 'mandatory' | 'discretionary';

export interface PromotionTransactionInput {
  id: string;
  promotionId: string;
  date: string;
  settlementKey: string;
  category: PromotionLedgerCategory;
  amount: number;
  transactionClass: PromotionTransactionClass;
  sourceId?: string;
  descriptionKey: string;
  repayLiabilities?: boolean;
}

export type PromotionEconomyMutationResult =
  | { ok: true; state: GameState; entryIds: string[] }
  | { ok: false; state: GameState; reason: PromotionEconomyReason };

export interface BrandInvestmentEffect {
  fanbaseGain: number;
  reputationGain: number;
}

export interface PromotionFinancialSnapshot {
  debtHeadroom: number;
  requiredReserve: number;
  nextMonthObligations: number;
  recurringNetIncome: number;
  estimatedRunwayMonths: number;
  financialMode: PromotionFinancialMode;
  contractBudget: number;
}
```

Use deterministic formulas, rounded to whole currency units:

```ts
monthlyOperatingCost = Math.round(12_000 + reputation * 180 + fanbase * 0.02);
monthlyRosterRetainer = sum(active owned contracts, Math.round((payPerFight + winBonus * 0.5) * 0.08));

aiMonthlySponsorIncome = Math.round(5_000 + reputation * 250 + fanbase * 0.025);
aiMonthlyMediaIncome = Math.round(7_500 + reputation * 350 + fanbase * 0.035);

debtLimit = Math.max(
  100_000,
  Math.round((monthlySponsorIncome + monthlyMediaIncome) * 4 + reputation * 2_500 + fanbase * 0.5)
);

debtHeadroom = Math.max(0, promotion.money + debtLimit);
nextMonthObligations = monthlyOperatingCost + monthlyRosterRetainer;
requiredReserve = Math.max(50_000, nextMonthObligations * 2);
recurringNetIncome = monthlySponsorIncome + monthlyMediaIncome - nextMonthObligations;
estimatedRunwayMonths = recurringNetIncome >= 0
  ? 24
  : Math.min(24, Math.max(0, Math.floor((debtHeadroom - outstandingLiabilities) / Math.abs(recurringNetIncome))));
```

Derive modes with hysteresis in this order:

```ts
if (outstandingLiabilities > 0 || debtHeadroom <= nextMonthObligations * 0.25) recovery;
else if (previousRecoveryMode && !(debtHeadroom >= nextMonthObligations * 2 && estimatedRunwayMonths >= 6)) recovery;
else if (promotion.money >= requiredReserve * 2 && estimatedRunwayMonths >= 12) growth;
else if (debtHeadroom >= requiredReserve && estimatedRunwayMonths >= 6) stable;
else cautious;
```

Calculate Contract Market capacity without a fixed cash percentage:

```ts
rawCapacity = Math.max(
  0,
  debtHeadroom - outstandingLiabilities - nextMonthObligations - requiredReserve
);
modeMultiplier = { growth: 0.60, stable: 0.40, cautious: 0.15, recovery: 0 }[financialMode];
contractBudget = Math.floor(rawCapacity * modeMultiplier);
```

Use deterministic brand effects with diminishing returns:

```ts
const growth = Math.log1p(amount / 10_000);
fanbaseGain = Math.min(5_000, Math.floor(growth * 750));
reputationGain = Math.min(5, Math.round(growth * 100) / 100);
```

Stable ledger IDs use the supplied transaction identity, never UUID:

```ts
const entryId = `economy-${promotionId}-${transactionId}`;
const liabilityPaymentId = `${entryId}-liability-payment`;
```

---

### Task 1: Add Economy Types, Initialization, and Real Rival Contract Values

**Files:**
- Modify: `src/types/game.ts`
- Create: `src/lib/game/promotionEconomy.ts`
- Modify: `src/lib/game/generator.ts`
- Create: `test_promotion_economy_initialization.ts`

**Interfaces:**
- Consumes: `Promotion`, `Fighter.contract`, player sponsor/media deals, `getContractExpectation()`, and seeded rival ownership.
- Produces:

```ts
export function getMonthKey(date: string): string;
export function calculateMonthlyRosterRetainer(state: GameState, promotionId: string, settlementDate: string): number;
export function derivePromotionFinancialSnapshot(state: GameState, promotionId: string, previousRecoveryMode?: boolean): PromotionFinancialSnapshot;
export function initializePromotionEconomies(state: GameState): GameState;
```

- [ ] **Step 1: Write the failing initialization test**

Create `test_promotion_economy_initialization.ts`:

```ts
import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { initializePromotionEconomies } from './src/lib/game/promotionEconomy';

const state = generateInitialWorld(2201);
assert.deepEqual(Object.keys(state.promotionEconomies).sort(), Object.keys(state.promotions).sort());
for (const [promotionId, economy] of Object.entries(state.promotionEconomies)) {
  assert.equal(economy.promotionId, promotionId);
  assert.equal(economy.lastMonthlySettlement, state.currentDate.slice(0, 7));
  assert.equal(economy.ledgerOpeningBalance, state.promotions[promotionId].money);
  assert.equal(economy.outstandingLiabilities, 0);
  assert.ok(economy.debtLimit >= 100_000);
  assert.ok(['growth', 'stable', 'cautious', 'recovery'].includes(economy.financialMode));
}
const rivalIds = Object.keys(state.promotions).filter(id => id !== state.playerPromotionId);
for (const rivalId of rivalIds) {
  const contracts = Object.values(state.fighters).flatMap(fighter => fighter.contract?.promotionId === rivalId ? [fighter.contract] : []);
  assert.ok(contracts.length > 0);
  assert.ok(contracts.every(contract => contract.payPerFight > 1 && contract.winBonus > 1));
}
assert.deepEqual(initializePromotionEconomies(state), state);
console.log('Promotion economy initialization checks passed.');
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx tsx test_promotion_economy_initialization.ts
```

Expected: FAIL because `promotionEconomies` and `promotionEconomy.ts` do not exist.

- [ ] **Step 3: Add the canonical types and empty field**

Add the types from **Canonical Interfaces and Formulas** to `src/types/game.ts` and add `promotionEconomies` to `GameState`. Initialize a temporary `{}` in the generator before rival seeding so the state is type-complete.

- [ ] **Step 4: Replace rival `$1/$1` placeholder contracts**

In `seedRivalPromotions`, create each rival promotion first, then derive terms for each owned fighter from the existing helper:

```ts
const expectation = getContractExpectation(fighter, nextState.promotions[template.id]);
contract: {
  promotionId: template.id,
  fightsRemaining: expectation.fights,
  payPerFight: expectation.basePay,
  winBonus: expectation.winBonus,
  exclusivity: true,
  endDate: getContractEndDate(state.currentDate, expectation.fights)
}
```

Do not change player contracts or already-existing rival contracts during initialization.

- [ ] **Step 5: Implement deterministic economy initialization**

Use active player sponsor/media deals for the player. For AI, use the canonical commercial formulas. `calculateMonthlyRosterRetainer` includes only non-retired fighters with matching `contract.promotionId` and `contract.endDate >= settlementDate`; international participation does not alter ownership or add a second charge.

`initializePromotionEconomies` preserves an existing economy record byte-for-byte when all required fields are valid. For a missing record, calculate operating cost, retainer, income, debt, snapshot, and set:

```ts
lastMonthlySettlement: getMonthKey(state.currentDate),
settledEventIds: [],
ledgerOpeningBalance: promotion.money,
legacyFinanceLedgerIds: promotionId === state.playerPromotionId
  ? (state.financeLedger ?? []).map(entry => entry.id)
  : [],
ledger: []
```

Call it after rival promotions/contracts are seeded and before the final `syncPlayerPromotionSnapshot()` return.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
npx tsx test_promotion_economy_initialization.ts
npx tsx test_rival_promotions.ts
npx tsx test_contract_market_ai.ts
```

Expected: all PASS; existing Contract Market behavior may change only through realistic seeded contract values, not ownership or offer rules.

---

### Task 2: Migrate Version 14 Saves to Version 15 Idempotently

**Files:**
- Modify: `src/lib/game/save.ts`
- Modify: `test_contract_market_migration.ts`
- Modify: `test_multi_league_migration.ts`
- Modify: `test_fighter_career.ts`
- Modify: `test_personality_drama.ts`
- Create: `test_promotion_economy_migration.ts`

**Interfaces:**
- Consumes: `initializePromotionEconomies()` after `ensureRivalPromotions()`.
- Produces: save version 15 with persisted `promotionEconomies`.

- [ ] **Step 1: Write the failing migration test**

Create `test_promotion_economy_migration.ts`:

```ts
import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { CURRENT_SAVE_VERSION, validateAndMigrateState } from './src/lib/game/save';

const current = generateInitialWorld(2202);
const legacy = structuredClone(current) as any;
legacy.saveVersion = 14;
delete legacy.promotionEconomies;
legacy.financeLedger = [{
  id: 'legacy-event-row', date: legacy.currentDate, type: 'event_profit', amount: 12_345,
  description: 'Legacy event', affectsCash: true
}];
const balances = Object.fromEntries(Object.entries(legacy.promotions).map(([id, promotion]: any) => [id, promotion.money]));
const migrated = validateAndMigrateState(legacy)!;
assert.equal(CURRENT_SAVE_VERSION, 15);
assert.equal(migrated.saveVersion, 15);
assert.deepEqual(Object.fromEntries(Object.entries(migrated.promotions).map(([id, promotion]) => [id, promotion.money])), balances);
assert.deepEqual(migrated.promotionEconomies[migrated.playerPromotionId].legacyFinanceLedgerIds, ['legacy-event-row']);
assert.equal(migrated.promotionEconomies[migrated.playerPromotionId].lastMonthlySettlement, migrated.currentDate.slice(0, 7));
assert.deepEqual(migrated.promotionEconomies[migrated.playerPromotionId].ledger, []);
assert.deepEqual(validateAndMigrateState(structuredClone(migrated)), migrated);
console.log('Promotion economy migration checks passed.');
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx tsx test_promotion_economy_migration.ts
```

Expected: FAIL because `CURRENT_SAVE_VERSION` is 14 and the save pipeline does not persist or initialize economies.

- [ ] **Step 3: Persist economies and migrate after promotion coverage**

Set `CURRENT_SAVE_VERSION = 15`, include `promotionEconomies` in `extractSaveState`, and in migration order run:

```ts
state = ensureRivalPromotions(state as GameState);
state = initializePromotionEconomies(state as GameState);
state.saveVersion = CURRENT_SAVE_VERSION;
```

Do not modify `Promotion.money`, replay `financeLedger`, settle prior months, or create ledger rows. Existing economy records are normalized only when a field is absent/non-finite; valid saved markers and ledgers are preserved.

- [ ] **Step 4: Update only hardcoded save-version assertions**

Change stale expected versions in the listed existing tests from 14 (or 13) to 15. Do not weaken ownership, contract, title, or idempotency assertions.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
npx tsx test_promotion_economy_migration.ts
npx tsx test_contract_market_migration.ts
npx tsx test_multi_league_migration.ts
npx tsx test_fighter_career.ts
npx tsx test_personality_drama.ts
```

Expected: all PASS and all pre-migration balances remain exact.

---

### Task 3: Implement Atomic Transactions, Debt Modes, Liabilities, and Validation

**Files:**
- Modify: `src/lib/game/promotionEconomy.ts`
- Create: `test_promotion_economy_debt.ts`
- Create: `test_promotion_economy_transactions.ts`

**Interfaces:**
- Produces:

```ts
export function applyPromotionTransaction(state: GameState, input: PromotionTransactionInput): PromotionEconomyMutationResult;
export function refreshPromotionEconomy(state: GameState, promotionId: string): GameState;
export function getPromotionFinancialSnapshot(state: GameState, promotionId: string): PromotionFinancialSnapshot | null;
export function validatePromotionEconomies(state: GameState): string[];
```

- [ ] **Step 1: Write failing debt and transaction tests**

In `test_promotion_economy_debt.ts`, configure one promotion at each threshold and assert:

```ts
assert.equal(getPromotionFinancialSnapshot(growth, id)?.financialMode, 'growth');
assert.equal(getPromotionFinancialSnapshot(stable, id)?.financialMode, 'stable');
assert.equal(getPromotionFinancialSnapshot(cautious, id)?.financialMode, 'cautious');
assert.equal(getPromotionFinancialSnapshot(recovery, id)?.financialMode, 'recovery');
```

Also prove:

- mandatory expense charges only to `-debtLimit` and places the unpaid remainder in `outstandingLiabilities`;
- discretionary expense in recovery or with liabilities returns the original state unchanged;
- income is allowed in recovery and, with `repayLiabilities: true`, adds income then creates a stable liability-payment entry before refreshing mode;
- recovery remains active below the six-month/two-obligation exit thresholds and exits only above both;
- duplicate transaction IDs return `duplicate_transaction` and do not mutate state;
- no approved transaction breaches the debt limit.

In `test_promotion_economy_transactions.ts`, prove player transactions update both `promotions[playerPromotionId]` and `promotion`, rival transactions do not alter the player snapshot, `balanceAfter` follows entry order, and player mirror rows use `economy-mirror-${entry.id}` with `affectsCash: false`.

- [ ] **Step 2: Run both tests and verify RED**

Run:

```bash
npx tsx test_promotion_economy_debt.ts
npx tsx test_promotion_economy_transactions.ts
```

Expected: FAIL because transaction, refresh, snapshot, and validator functions do not exist.

- [ ] **Step 3: Implement candidate-state transaction rules**

Validate safe finite integer currency input and unique `economy-${promotionId}-${input.id}`. For expenses:

```ts
const availableHeadroom = promotion.money + economy.debtLimit;
const requestedCost = Math.abs(input.amount);
const paidCost = input.transactionClass === 'mandatory'
  ? Math.min(requestedCost, Math.max(0, availableHeadroom))
  : requestedCost;
const unpaid = input.transactionClass === 'mandatory' ? requestedCost - paidCost : 0;
```

Reject discretionary expenses when liabilities exist, mode is recovery, the resulting balance crosses the debt limit, or the resulting debt headroom falls below `requiredReserve + nextMonthObligations`. Mandatory expenses append one ledger entry with `amount: -paidCost` and `liabilityDelta: unpaid`; zero paid cost is valid only when `unpaid > 0`.

For positive income with `repayLiabilities: true`, first append the income entry, then pay:

```ts
const liabilityPayment = Math.min(input.amount, economy.outstandingLiabilities);
```

Append a second `liability_payment` row with negative amount, negative `liabilityDelta`, and the post-payment balance. This ensures incoming income cannot become discretionary capacity while old liabilities remain.

- [ ] **Step 4: Keep player compatibility history without duplicate cash**

For each new player ledger entry append one legacy mirror:

```ts
{
  id: `economy-mirror-${entry.id}`,
  date: entry.date,
  type: legacyTypeFor(entry.category),
  amount: entry.amount,
  description: entry.descriptionKey,
  eventId: entry.category.startsWith('event_') ? entry.sourceId : undefined,
  isSummary: false,
  affectsCash: false
}
```

The mirror is display compatibility only. `applyPromotionTransaction` changes cash exactly once through `Promotion.money`.

- [ ] **Step 5: Implement refresh and validation**

`refreshPromotionEconomy` recalculates operating cost, retainer, commercial income, debt limit, snapshot, mode, recovery flag, and budget after any relevant mutation. Preserve ledger, opening balance, settlement markers, and liabilities.

`validatePromotionEconomies` reports exact tagged errors for:

- `missing-economy:<promotionId>`;
- `unknown-promotion:<economyId>`;
- non-finite/negative derived values;
- `debt-limit-breach:<promotionId>`;
- `negative-liability:<promotionId>`;
- duplicate ledger IDs;
- duplicate monthly settlement keys/categories;
- duplicate settled event IDs;
- wrong ledger promotion references;
- incorrect `balanceAfter` sequence from `ledgerOpeningBalance`;
- stale mode, recovery flag, or contract budget compared with a fresh snapshot.

Liability-only mandatory entries are valid when `amount === 0`, `liabilityDelta > 0`, and `balanceAfter` is unchanged.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
npx tsx test_promotion_economy_debt.ts
npx tsx test_promotion_economy_transactions.ts
npx tsx test_promotion_economy_initialization.ts
```

Expected: all PASS.

---

### Task 4: Settle Every Crossed Calendar Month and Owned Roster Retainer

**Files:**
- Modify: `src/lib/game/promotionEconomy.ts`
- Modify: `src/lib/engine.ts`
- Create: `test_promotion_economy_monthly.ts`

**Interfaces:**
- Produces:

```ts
export function getCrossedMonthKeys(fromDate: string, throughDate: string): string[];
export function settlePromotionMonth(state: GameState, promotionId: string, monthKey: string): GameState;
export function settlePromotionEconomiesThroughDate(state: GameState, throughDate: string): GameState;
```

- [ ] **Step 1: Write failing monthly settlement tests**

Create `test_promotion_economy_monthly.ts` and assert:

1. Advancing from `2026-01-31` to `2026-02-01` settles February once for every promotion.
2. Advancing from January to April settles February, March, and April in order with deterministic IDs.
3. Calling settlement twice at the same target date is byte-for-byte idempotent.
4. Player commercial values equal active selected sponsor/media deals for each settlement month.
5. AI commercial values use the canonical formulas.
6. Retainer includes only matching promotion ownership and contracts active on the settlement date; free agents, expired contracts, retired fighters, and differently owned fighters are excluded.
7. An international participant with unchanged ownership is charged once, not twice.
8. Revenue pays prior liabilities before current operating/retainer costs.
9. Mandatory shortfall creates liabilities and never breaches the debt limit.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx tsx test_promotion_economy_monthly.ts
```

Expected: FAIL because the shared monthly settlement pipeline does not exist and `advanceTime` still contains player-only month-number logic.

- [ ] **Step 3: Iterate month keys chronologically**

Use date-fns `startOfMonth`, `addMonths`, `format`, and `isAfter`. Return month keys after `fromDate`'s month through `throughDate`'s month. Use `lastMonthlySettlement` per promotion as the authoritative idempotency marker, not only the caller's date difference.

A settlement transaction identity is:

```ts
const settlementKey = `monthly-${promotionId}-${monthKey}`;
```

Entries are applied in this order:

1. `monthly_sponsor` income with liability repayment;
2. `monthly_media` income with liability repayment;
3. `operating_cost` mandatory expense;
4. `roster_retainer` mandatory expense;
5. AI scheduled brand investment from Task 7, if affordable.

Set `lastMonthlySettlement = monthKey` only after the candidate settlement validates.

- [ ] **Step 4: Replace the legacy player-only month block in `advanceTime`**

After deriving `nextDate`, call:

```ts
let newState = settlePromotionEconomiesThroughDate(state, nextDate);
newState = advanceContractMarket({ ...newState, currentDate: nextDate }, language);
```

Preserve the existing daily engine order around healing, expiry, tournaments, events, objectives, and social feed. Remove only the old sponsor/media cash and UUID ledger block so it cannot pay twice. Deal renewal/expiration continues to use existing deal state; monthly settlement reads the deal active for each `monthKey`.

- [ ] **Step 5: Verify GREEN and time regressions**

Run:

```bash
npx tsx test_promotion_economy_monthly.ts
npx tsx test_contract_market_integration.ts
npx tsx test_autopilot_async.ts
npx tsx test_long_sim.ts
```

Expected: all PASS with no duplicate monthly entries.

---

### Task 5: Settle Player and Rival Domestic Events With One Scoped Ledger

**Files:**
- Modify: `src/lib/game/economy.ts`
- Modify: `src/lib/engine.ts`
- Modify: `src/lib/game/rivalPromotions.ts`
- Create: `test_promotion_economy_events.ts`

**Interfaces:**
- Produces:

```ts
export interface EventFinancialRolls {
  attendance: number;
  broadcast: number;
}

export function getDeterministicEventFinancialRolls(eventId: string): EventFinancialRolls;
export function settlePromotionEvent(state: GameState, eventId: string, results: EventResults, sponsorBonus: number): GameState;
```

Extend without breaking existing callers:

```ts
export function calculateEventFinancials(
  fights: FightMatchup[],
  fighters: Record<string, Fighter>,
  venue: Venue,
  ticketPrice: number,
  marketingSpend: number,
  promotion: Promotion,
  storylines?: Storyline[],
  titles?: Record<string, WeightClassTitleState>,
  tournaments?: Record<string, GrandPrixTournament>,
  rolls?: EventFinancialRolls
): { results: EventResults; reputationChange: number };
```

- [ ] **Step 1: Write failing event settlement tests**

Create `test_promotion_economy_events.ts` and prove:

- a player domestic event applies gate, media, sponsor, purses, win bonuses, venue, and marketing entries whose sum equals `results.profit + sponsorBonus`;
- a rival domestic event has positive ticket price, intentional marketing, non-zero revenue/cost/archive values, and changes only its owning promotion cash;
- repeated finalization creates no second cash mutation or ledger entries;
- an international event does not create domestic promotion entries or duplicate purse cost;
- a cancelled event creates no event entry;
- deterministic rival rolls return the same values for the same event ID and do not call `Math.random()`;
- player callers without explicit rolls retain the current random variance behavior;
- resulting event cash never crosses the promotion debt boundary.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx tsx test_promotion_economy_events.ts
```

Expected: FAIL because rival events still use zero finance and event results bypass promotion economies.

- [ ] **Step 3: Add optional deterministic rolls**

Move the two random draws behind optional rolls:

```ts
const attendanceRoll = rolls?.attendance ?? Math.random();
const broadcastRoll = rolls?.broadcast ?? Math.random();
```

Generate rival values with a stable 32-bit string hash mapped to `[0, 1)`, using keys `${eventId}:attendance` and `${eventId}:broadcast`. Do not add dependencies or alter player results when rolls are omitted.

- [ ] **Step 4: Apply event finance as stable scoped transactions**

For a domestic completed event, apply transaction IDs:

```ts
`${eventId}-gate`
`${eventId}-media`
`${eventId}-sponsor`
`${eventId}-purses`
`${eventId}-win-bonuses`
`${eventId}-venue`
`${eventId}-marketing`
```

Use income with liability repayment for revenue and mandatory transactions for already-incurred event expenses. Event booking/projection must reserve the maximum projected loss; if a due recovery event no longer satisfies the debt boundary, cancel it before fight simulation and produce no finance. Add `eventId` to `settledEventIds` only after all entries and promotion reputation/fanbase changes validate.

- [ ] **Step 5: Remove the rival/international zero-value conflation**

Keep international-neutral events on the no-domestic-finance branch. Rival domestic events call the same calculations using the scoped promotion, scoped titles, chosen venue, ticket price, marketing, and deterministic rolls. Archive the resulting attendance, revenue, cost, and profit.

For the player, stop direct `promotion.money += results.profit`; route all cash through `settlePromotionEvent`, then synchronize the player snapshot. Keep existing reputation/fanbase and deal bonus semantics.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
npx tsx test_promotion_economy_events.ts
npx tsx test_rival_simulation.ts
npx tsx test_live_fight.ts
```

Expected: all existing applicable event tests and the new focused test PASS.

---

### Task 6: Make AI Event and Brand Spending Respond to Financial Mode

**Files:**
- Modify: `src/lib/game/promotionEconomy.ts`
- Modify: `src/lib/game/rivalPromotions.ts`
- Modify: `src/lib/game/autobooker.ts`
- Create: `test_promotion_economy_ai.ts`

**Interfaces:**
- Produces:

```ts
export interface AiEventFinancialPlan {
  venueId: string;
  ticketPrice: number;
  marketingSpend: number;
  projectedProfit: number;
}

export function getAiBrandInvestment(state: GameState, promotionId: string): number;
export function planAiPromotionEvent(state: GameState, promotionId: string): AiEventFinancialPlan | null;
```

- [ ] **Step 1: Write failing AI mode tests**

Create `test_promotion_economy_ai.ts` with equivalent sporting state and only financial mode/headroom varied. Assert:

- growth marketing and brand investment are greater than stable;
- stable values are greater than or equal to cautious;
- cautious may invest zero but still selects an affordable event;
- recovery brand investment is zero;
- recovery returns `null` unless a minimum viable card has non-negative worst-case debt impact;
- venue/ticket/marketing choices are deep-equal for equivalent state and IDs;
- finance planning does not change a sentinel `Math.random` call count;
- no AI plan spends protected reserves or existing liabilities;
- the old owner cash injection never runs below `-100_000`.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx tsx test_promotion_economy_ai.ts
```

Expected: FAIL because AI events use zero ticket/marketing and the autobooker still contains emergency cash injection.

- [ ] **Step 3: Implement deterministic event candidates**

Sort venues by ID. For each venue calculate a mode-based plan:

```ts
const ticketMultiplier = { growth: 1.10, stable: 1.00, cautious: 0.90, recovery: 0.80 }[mode];
const ticketPrice = Math.max(10, Math.round((20 + promotion.reputation * 0.8) * ticketMultiplier));
const marketingCap = { growth: 20_000, stable: 10_000, cautious: 2_000, recovery: 0 }[mode];
const marketingSpend = Math.min(marketingCap, Math.max(0, rawDiscretionaryCapacity));
```

Calculate projections with existing `calculateEventProjections`, select highest projected profit, then lowest venue cost and venue ID. Recovery tests the smallest venue/zero marketing plan and returns it only when the conservative projection leaves cash at or above `-debtLimit`. No random tie breaker is allowed.

- [ ] **Step 4: Implement monthly AI brand amount**

After mandatory monthly settlement refreshes the mode, calculate:

```ts
const rate = { growth: 0.15, stable: 0.05, cautious: 0, recovery: 0 }[mode];
const candidate = Math.floor((monthlySponsorIncome + monthlyMediaIncome) * rate / 1_000) * 1_000;
return Math.min(candidate, Math.max(0, rawDiscretionaryCapacity));
```

Set `scheduledBrandInvestment` to the amount actually charged in that month; apply the same bounded brand effect as player investment.

- [ ] **Step 5: Remove emergency money creation**

Delete/bypass the `promotion.money < -100000` owner injection branch in `autobooker.ts`. Preserve summary shape for save/UI compatibility by leaving `ownerCashInjections` at zero; recovery mode and liabilities replace the behavior.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
npx tsx test_promotion_economy_ai.ts
npx tsx test_rival_promotions.ts
npx tsx test_rival_simulation.ts
npx tsx test_autopilot_async.ts
```

Expected: all PASS and AI finance code contains no `Math.random()`.

---

### Task 7: Replace the Contract Market Cash Percentage With Economy Capacity

**Files:**
- Modify: `src/lib/game/contractMarket.ts`
- Modify: `src/lib/game/promotionEconomy.ts`
- Create: `test_promotion_economy_contract_market.ts`

**Interfaces:**
- Keeps the public seam:

```ts
export function getPromotionContractBudget(state: GameState, promotionId: string): number;
```

- Adds:

```ts
export function canPromotionAffordContractCommitment(state: GameState, promotionId: string, commitment: number): PromotionEconomyReason | null;
```

- [ ] **Step 1: Write failing market-economy tests**

Create `test_promotion_economy_contract_market.ts` and assert:

1. Budget equals the canonical debt-headroom/obligation/reserve formula, not 20% of cash.
2. Growth budget exceeds stable, stable exceeds cautious, and recovery/liabilities produce zero.
3. A negative-cash promotion above its debt boundary may have capacity only when reserves remain.
4. Offer creation rejects commitment above current budget.
5. A previously affordable pending settlement that becomes unaffordable returns the original ownership, contracts, money, titles, rankings, market records, and economy ledgers unchanged.
6. Successful transfer fee creates equal-and-opposite buyer/seller `transfer_fee` entries with one market transaction identity.
7. Seller income repays liabilities first.
8. Validator allows negative cash within the debt limit and rejects only a debt-limit breach.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx tsx test_promotion_economy_contract_market.ts
```

Expected: FAIL because budget remains a fixed 20% and settlement bypasses economy ledgers.

- [ ] **Step 3: Delegate budget calculation to the economy snapshot**

Replace the old implementation with:

```ts
export function getPromotionContractBudget(state: GameState, promotionId: string): number {
  return getPromotionFinancialSnapshot(state, promotionId)?.contractBudget ?? 0;
}
```

Use full contract commitment (`transferFee + fights * (payPerFight + winBonus * 0.5)`) for offer creation and latest settlement validation.

- [ ] **Step 4: Apply transfer fee inside the existing candidate state**

Within `applyPendingSettlement`, after all preconditions pass but before ownership mutation:

- apply buyer discretionary transaction `${settlement.id}-buyer` with negative transfer fee;
- apply seller income `${settlement.id}-seller` with `repayLiabilities: true` when seller exists;
- continue contract/title/ranking/event repair on that candidate;
- run both `validateContractMarketState(candidate)` and `validatePromotionEconomies(candidate)`;
- commit only when every invariant passes.

Do not separately mutate buyer/seller `money`; fee zero creates no ledger row.

- [ ] **Step 5: Update market validation boundary**

Replace `negative-cash:<promotionId>` with debt-aware validation. Missing economies and balances below `-debtLimit` are errors; valid debt is not.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
npx tsx test_promotion_economy_contract_market.ts
npx tsx test_contract_market_ai.ts
npx tsx test_contract_market_settlement.ts
npx tsx test_contract_market_integration.ts
```

Expected: all PASS and stale settlement remains atomic.

---

### Task 8: Route Objective and Drama Cash Through the Shared Ledger

**Files:**
- Modify: `src/lib/game/seasonObjectives.ts`
- Modify: `src/lib/game/drama.ts`
- Modify: `test_promotion_economy_transactions.ts`
- Modify: `test_season_objectives.ts`
- Modify: `test_personality_drama.ts`

**Interfaces:**
- Consumes: `applyPromotionTransaction()` and stable existing objective/drama IDs.
- Produces no new public API.

- [ ] **Step 1: Add failing focused integration assertions**

Extend `test_promotion_economy_transactions.ts` to prove:

- objective reward adds exactly one `objective_reward` row and one player legacy mirror, updates cash once, and rerunning objective maintenance is idempotent;
- `fine_fighter`/`fine_both` produce `drama` income entries;
- `improve_terms` is discretionary, respects reserves/recovery, and records only the amount actually applied;
- blocked drama spending leaves promotion money, reputation/fanbase, consequence list, ledger, and mirror history unchanged;
- player snapshot and scoped promotion remain equal after every accepted consequence.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx tsx test_promotion_economy_transactions.ts
```

Expected: FAIL because objectives and drama still mutate `state.promotion.money` directly.

- [ ] **Step 3: Route stable objective rewards**

Use transaction ID `objective-reward-${objective.id}` with category `objective_reward`, income, and liability repayment. Remove the direct money mutation and hand-written cash ledger row.

Update profit objective progress to subtract accepted objective rewards by category/source ID from the promotion economy ledger rather than filtering `financeLedger.affectsCash`. Legacy mirrors remain display-only.

- [ ] **Step 4: Route drama money consequences**

Use the existing deterministic incident/response identity for the transaction ID. Positive fines are income with liability repayment. Negative `improve_terms` is discretionary and may be rejected; only append a consequence when the transaction succeeds. Remove `Math.max(0, before + value)` because the shared boundary now permits controlled debt.

Do not redesign response selection, non-money consequences, or drama copy.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
npx tsx test_promotion_economy_transactions.ts
npx tsx test_season_objectives.ts
npx tsx test_personality_drama.ts
```

Expected: all PASS without duplicate objective/drama entries.

---

### Task 9: Add Player Brand Investment and Thin Store Action

**Files:**
- Modify: `src/lib/game/promotionEconomy.ts`
- Modify: `src/store/gameStore.ts`
- Create: `test_promotion_economy_store.ts`

**Interfaces:**
- Produces:

```ts
export function getBrandInvestmentEffect(amount: number): BrandInvestmentEffect;
export function investInPromotionBrand(state: GameState, promotionId: string, amount: number): PromotionEconomyMutationResult;
```

Add to `GameStore`:

```ts
investInBrand: (amount: number) => PromotionEconomyReason | null;
```

- [ ] **Step 1: Write failing store and brand tests**

Create `test_promotion_economy_store.ts` with the real Zustand store and assert:

- amount must be a safe integer `>= 1_000`;
- invalid, recovery, liability, debt-limit, and reserve failures return exact reasons and leave state byte-for-byte unchanged;
- success deducts cash once, adds one `brand_investment` row, increases reputation/fanbase by the projected effect, refreshes the economy, and syncs player snapshots;
- equal investment produces equal effects;
- doubling investment produces less than double fanbase/reputation gain;
- repeated transaction identity is impossible because the action identity includes current date plus the next stable brand-history ordinal;
- rival promotion cannot be targeted through the store action.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx tsx test_promotion_economy_store.ts
```

Expected: FAIL because brand APIs and store action do not exist.

- [ ] **Step 3: Implement brand investment as one candidate mutation**

Validate the amount, calculate effect, apply a discretionary `brand_investment` transaction, then update only the selected promotion's reputation/fanbase and refresh its economy. Run `validatePromotionEconomies(candidate)` before returning success.

Use identity:

```ts
const ordinal = economy.ledger.filter(entry => entry.category === 'brand_investment').length + 1;
const id = `brand-${promotionId}-${state.currentDate}-${ordinal}`;
```

- [ ] **Step 4: Add the thin player-only store adapter**

```ts
investInBrand: amount => {
  const result = investInPromotionBrand(get(), get().playerPromotionId, amount);
  if (result.ok === false) return result.reason;
  set(result.state);
  return null;
}
```

Do not duplicate validation or effect formulas in React/Zustand.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
npx tsx test_promotion_economy_store.ts
npx tsx test_management_depth.ts
npx tsx test_autopilot_async.ts
```

Expected: all PASS.

---

### Task 10: Add Promotion Finances Page, Navigation, Links, i18n, and Accessibility

**Files:**
- Create: `src/pages/PromotionFinances.tsx`
- Modify: `src/store/gameStore.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/AppShell.tsx`
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/pages/ContractMarket.tsx`
- Modify: `src/i18n/resources/en.ts`
- Modify: `src/i18n/resources/vi.ts`
- Modify: `test_ui_contracts.ts`
- Modify: `test_i18n.ts`

**Interfaces:**
- Produces `GameView = ... | 'promotion-finances'`.
- Consumes economy snapshots, scoped ledger, legacy referenced rows, event archive, and `investInBrand`.

- [ ] **Step 1: Write failing UI and i18n contracts**

Extend `test_ui_contracts.ts`:

```ts
const finances = readFileSync('src/pages/PromotionFinances.tsx', 'utf8');
for (const token of [
  'useTranslation',
  '$.promotionFinances.title',
  'promotionEconomies',
  'getPromotionFinancialSnapshot',
  'investInBrand',
  'aria-live="polite"',
  'aria-label',
  '<label',
  '<table',
  '<caption',
  '<th',
  'scope="col"',
  'type="number"',
  'type="submit"',
  'grid-cols-1',
  'min-w-0',
  'min-h-11'
]) assert.ok(finances.includes(token), `Promotion Finances UI missing ${token}`);
assert.ok(app.includes("case 'promotion-finances'"));
assert.ok(shell.includes("'promotion-finances'"));
assert.ok(dashboard.includes("setView('promotion-finances')"));
assert.ok(contractMarket.includes("setView('promotion-finances')"));
```

Add `PromotionFinances.tsx` to translated-page checks and require identical English/Vietnamese key shapes.

- [ ] **Step 2: Run UI/i18n tests and verify RED**

Run:

```bash
npx tsx test_ui_contracts.ts
npx tsx test_i18n.ts
```

Expected: FAIL because the page, route, links, and translations do not exist.

- [ ] **Step 3: Add route and normal navigation**

Add `'promotion-finances'` to `GameView`, lazy-load the page in `App.tsx`, add a `case`, and add one navigation entry in the existing management/competition grouping using an already-installed Lucide finance icon. Translate its label with `navigation.promotionFinances`.

- [ ] **Step 4: Build one responsive exact-finance view**

Use existing page/panel/stat/button/select primitives. The page contains:

- promotion selector covering player and every rival;
- exact cash, debt limit, headroom, liabilities, runway, mode, and contract budget;
- current monthly sponsor/media income, operating cost, roster retainer, scheduled brand investment, and net;
- recent domestic event profit/loss from `eventArchive`;
- full new promotion ledger plus player legacy rows referenced by `legacyFinanceLedgerIds`;
- brand investment history filtered by category;
- player-only brand amount input, projected fanbase/reputation effect, submit button, and `aria-live="polite"` result;
- rival read-only explanation.

Render signed currency with explicit `+`/`-`; mode text must accompany color. Use semantic labels, captioned table headers, keyboard-native controls, `min-h-11`, `grid-cols-1`, and `min-w-0`.

- [ ] **Step 5: Keep Dashboard and Contract Market summaries concise**

Dashboard retains existing sponsor/media deal controls but replaces duplicated detailed finance history with cash/mode/runway/liability summary and a link to Promotion Finances. Contract Market shows current budget/mode and the same navigation link. Do not expose a second full ledger on either page.

- [ ] **Step 6: Add matching English and Vietnamese copy**

Add identical structures including:

```ts
navigation: { promotionFinances: 'Promotion Finances' },
promotionFinances: {
  eyebrow: 'Management', title: 'Promotion Finances', description: 'Exact operating finances for every promotion.',
  selectPromotion: 'Promotion', cash: 'Cash balance', debtLimit: 'Debt limit', headroom: 'Remaining headroom',
  liabilities: 'Outstanding liabilities', runway: 'Estimated runway', months: '{{count}} months',
  mode: 'Financial mode', modes: { growth: 'Growth', stable: 'Stable', cautious: 'Cautious', recovery: 'Recovery' },
  contractBudget: 'Contract budget', monthlyIncome: 'Monthly income', monthlyExpenses: 'Monthly expenses',
  sponsorIncome: 'Sponsor income', mediaIncome: 'Media income', operatingCost: 'Operating cost',
  rosterRetainer: 'Roster retainer', brandSpend: 'Brand investment', recentEvent: 'Recent event profit/loss',
  ledger: 'Promotion ledger', ledgerCaption: 'Promotion transactions in settlement order',
  date: 'Date', category: 'Category', description: 'Description', amount: 'Amount', balance: 'Balance after',
  investTitle: 'Invest in brand', investAmount: 'Investment amount', projectedEffect: '+{{fanbase}} fans, +{{reputation}} reputation',
  invest: 'Invest', rivalReadOnly: 'Rival finances are read-only.', noEntries: 'No transactions yet.',
  reasons: {
    invalidAmount: 'Enter a whole amount of at least {{minimum}}.', recoveryMode: 'Brand investment is blocked during recovery.',
    outstandingLiabilities: 'Pay outstanding liabilities before discretionary spending.', debtLimit: 'This would cross the debt limit.',
    requiredReserve: 'This would use required operating reserves.', success: 'Brand investment completed.'
  }
}
```

Add localized ledger category names for every `PromotionLedgerCategory` and equivalent Vietnamese values.

- [ ] **Step 7: Verify GREEN without browser automation**

Run:

```bash
npx tsx test_ui_contracts.ts
npx tsx test_i18n.ts
npm run lint
npm run build
```

Expected: all PASS. The user performs manual responsive and visual checking.

---

### Task 11: Add Deterministic Multi-Season Economy Acceptance

**Files:**
- Create: `test_promotion_economy_long_sim.ts`
- Modify: `test_contract_market_long_sim.ts`
- Modify: `test_long_sim.ts` diagnostics only
- Modify only production files directly implicated by a failing invariant.

**Interfaces:**
- Consumes all previous task outputs.
- Produces deterministic five-season proof for economy, market, events, calendars, tournaments, rankings, titles, and ownership.

- [ ] **Step 1: Write the long economy acceptance script**

Create `test_promotion_economy_long_sim.ts` by reusing the exact one-day orchestration and deterministic `Math.random`/`crypto` setup from `test_contract_market_long_sim.ts`. Run two copies of `generateInitialWorld(2211)` for 1,825 days.

Compact deterministic output:

```ts
const compact = (state: GameState) => ({
  currentDate: state.currentDate,
  promotions: Object.fromEntries(Object.entries(state.promotions).map(([id, promotion]) => [id, {
    money: promotion.money, reputation: promotion.reputation, fanbase: promotion.fanbase
  }])),
  economies: Object.fromEntries(Object.entries(state.promotionEconomies).map(([id, economy]) => [id, {
    debtLimit: economy.debtLimit,
    recoveryMode: economy.recoveryMode,
    financialMode: economy.financialMode,
    outstandingLiabilities: economy.outstandingLiabilities,
    contractBudget: economy.contractBudget,
    lastMonthlySettlement: economy.lastMonthlySettlement,
    settledEventIds: economy.settledEventIds,
    ledger: economy.ledger
  }])),
  ownership: Object.fromEntries(Object.values(state.fighters).map(fighter => [fighter.id, fighter.contract?.promotionId ?? null])),
  marketHistory: state.contractMarket.history,
  eventArchive: state.eventArchive
});
assert.deepEqual(compact(runA), compact(runB));
```

At every yearly checkpoint assert:

- `validatePromotionEconomies(state)` is empty;
- `validateContractMarketState`, calendar, tournament, and title-shot validators are empty;
- no duplicate ledger, monthly settlement, event settlement, market history, or active offer IDs;
- no balance below `-debtLimit` and no negative liability;
- player snapshot balance/reputation/fanbase equals `promotions[playerPromotionId]`;
- no unknown contract owner or domestic title owner mismatch;
- planned/active international participant ownership is unchanged;
- every completed domestic event appears exactly once in its promotion `settledEventIds`;
- international/cancelled events have no domestic settlement;
- Contract Market commitment never exceeds current protected capacity;
- all completed fights retain valid results/round stats.

Track coverage across the whole run and require:

- at least one promotion enters recovery;
- at least one promotion exits recovery after entering;
- at least one liability accrues and is later reduced;
- at least one profitable and one loss-making domestic event;
- at least one AI brand investment and zero recovery-mode brand investments;
- at least two market windows close with at least one successful transfer;
- no owner cash injection.

- [ ] **Step 2: Run acceptance and observe the first meaningful RED**

Run:

```bash
npx tsx test_promotion_economy_long_sim.ts
```

Expected before final corrections: PASS or one precise invariant/coverage failure. Do not weaken assertions merely to obtain GREEN.

- [ ] **Step 3: Correct each acceptance gap through focused TDD**

For each failure, add the smallest reproducing assertion to the relevant earlier focused test, run it to observe RED, implement only the implicated correction, rerun that focused test, then rerun the long acceptance. Do not tune unrelated sporting simulation to force economy coverage; adjust only deterministic economy fixture parameters when the production path is already correct.

- [ ] **Step 4: Extend existing long-sim diagnostics**

Add `validatePromotionEconomies` and debt/liability/duplicate settlement tags to `test_contract_market_long_sim.ts` and `test_long_sim.ts`. Preserve all existing market, event, tournament, calendar, title, ownership, and round-stat checks.

- [ ] **Step 5: Verify the long scripts**

Run:

```bash
npx tsx test_promotion_economy_long_sim.ts
npx tsx test_contract_market_long_sim.ts
npx tsx test_long_sim.ts
```

Expected: all PASS deterministically.

---

### Task 12: Run the Consolidated Verification Gate

**Files:**
- Modify only files directly implicated by a failing focused regression.
- Do not stage, commit, push, or discard any file.

- [ ] **Step 1: Run every focused Phase 2 test**

```bash
npx tsx test_promotion_economy_initialization.ts
npx tsx test_promotion_economy_migration.ts
npx tsx test_promotion_economy_debt.ts
npx tsx test_promotion_economy_transactions.ts
npx tsx test_promotion_economy_monthly.ts
npx tsx test_promotion_economy_events.ts
npx tsx test_promotion_economy_ai.ts
npx tsx test_promotion_economy_contract_market.ts
npx tsx test_promotion_economy_store.ts
npx tsx test_promotion_economy_long_sim.ts
```

Expected: all ten scripts PASS.

- [ ] **Step 2: Run impacted market, multi-promotion, event, and simulation regressions**

```bash
npx tsx test_contract_market_migration.ts
npx tsx test_contract_market_ai.ts
npx tsx test_contract_market_settlement.ts
npx tsx test_contract_market_integration.ts
npx tsx test_contract_market_store.ts
npx tsx test_contract_market_long_sim.ts
npx tsx test_multi_league_foundation.ts
npx tsx test_multi_league_migration.ts
npx tsx test_scoped_rankings_titles.ts
npx tsx test_rival_promotions.ts
npx tsx test_rival_simulation.ts
npx tsx test_international_competitions.ts
npx tsx test_season_objectives.ts
npx tsx test_personality_drama.ts
npx tsx test_fighter_career.ts
npx tsx test_management_depth.ts
npx tsx test_calendar.ts
npx tsx test_tournament.ts
npx tsx test_autopilot_async.ts
npx tsx test_live_fight.ts
npx tsx test_ui_contracts.ts
npx tsx test_i18n.ts
npx tsx test_long_sim.ts
```

Expected: all applicable scripts PASS. Report a reproducible pre-existing unrelated failure separately rather than changing unrelated behavior.

- [ ] **Step 3: Run static and production checks**

```bash
npm run lint
npm run build
git diff --check
```

Expected: TypeScript/lint exits 0, Vite production build succeeds, and `git diff --check` prints no output.

- [ ] **Step 4: Confirm scope and working-tree safety**

```bash
git status --short
git diff --stat
```

Expected: Phase 2 source/tests/plan appear alongside the user's existing uncommitted work. No dependency, asset, unrelated refactor, staged file, commit, push, destructive operation, bankruptcy/lifecycle feature, or browser automation was introduced.

## Deferred to Later Approved Phases

- Bankruptcy, administration, promotion creation/dissolution, loans, interest, investors, and automatic roster liquidation.
- Promotion/relegation, tier movement, dynamic qualification coefficients, and promotion lifecycle settlement.
- International league/group phases, home/away ties, variable slots, and media pooling.
- Manager identity, job offers, and switching the player-controlled promotion.
- Sponsor/media auctions, exclusivity, audience overlap, persistent inter-promotion rivalry, and commercial negotiation redesign.
