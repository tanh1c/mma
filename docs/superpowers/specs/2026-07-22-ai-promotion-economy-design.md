# AI Promotion Economy Design

## Status

Approved for implementation planning on 2026-07-22.

## Context

Phase 1 introduced a seasonal Contract Market across player and AI promotions. Promotions now own fighters, rankings, titles, events, and cash independently, but only the player promotion has meaningful event finance and recurring deal income. Rival events currently produce no operating revenue or cost, rival contracts use placeholder compensation, and the Contract Market limits spending to a fixed percentage of cash.

Phase 2 gives every promotion the same deterministic operating economy. It must connect event performance, roster cost, commercial income, brand investment, debt runway, and Contract Market spending without adding bankruptcy, promotion creation, or dissolution. Those lifecycle outcomes remain Phase 3 work.

## Goals

- Apply one promotion-scoped economy model to player and AI promotions.
- Settle event revenue and cost for every domestic promotion.
- Settle recurring income and expenses once per calendar month.
- Make large and expensive rosters carry a recurring cost.
- Replace the fixed Contract Market cash percentage with a runway-aware budget.
- Let promotions enter and recover from constrained financial states.
- Let the player invest manually in long-term brand growth.
- Let AI promotions adjust spending based on their current financial health.
- Expose exact financial information for player and rival promotions.
- Preserve deterministic simulation, save compatibility, and atomic market settlement.

## Non-goals

- Bankruptcy, administration, promotion dissolution, or promotion creation.
- Loans, interest, repayment schedules, investors, or emergency cash injections.
- Promotion personality profiles or fixed financial archetypes.
- Replacing per-fight purses with salary-only contracts.
- A new sponsor or media negotiation system.
- International competition commercial pooling or revenue sharing.
- New dependencies, assets, or browser automation.
- Unrelated economy, event, store, or UI refactors.

## Architecture

`GameState` gains a promotion-scoped economy map:

```ts
promotionEconomies: Record<string, PromotionEconomy>;
```

`Promotion.money` remains the authoritative cash balance. `PromotionEconomy` stores operating configuration, derived financial state, settlement markers, and an auditable ledger. There must not be a second cash balance.

A focused pure game module owns economy initialization, monthly settlement, debt and runway calculations, brand investment, contract budget calculation, ledger mutation, and validation. Existing event finance remains the source of player event calculations and is extended so rival events use the same financial concepts instead of zero-value archives.

Player and AI promotions use the same formulas and constraints. They differ only in who chooses discretionary spending: the player acts through store actions and UI, while AI choices are deterministic functions of financial health.

## Data Model

The implementation may refine names while preserving these responsibilities:

```ts
interface PromotionEconomy {
  promotionId: string;
  debtLimit: number;
  recoveryMode: boolean;
  monthlyOperatingCost: number;
  monthlyRosterRetainer: number;
  monthlySponsorIncome: number;
  monthlyMediaIncome: number;
  outstandingLiabilities: number;
  brandInvestment: number;
  contractBudget: number;
  lastMonthlySettlement: string;
  ledger: PromotionLedgerEntry[];
}
```

A ledger entry records:

- deterministic unique ID;
- promotion ID;
- transaction date;
- transaction category;
- signed amount;
- resulting cash balance;
- source entity or settlement key where applicable;
- concise localized or localizable description data.

At minimum, categories distinguish event gate, event media, event sponsor, fighter purse, win bonus, venue, event marketing, monthly sponsor, monthly media, operating cost, roster retainer, liability payment, brand investment, and transfer fee.

`outstandingLiabilities` records mandatory operating and roster costs that could not be paid without crossing the debt limit. It is not spendable cash and must be paid before any discretionary expense.

Derived values such as runway, financial mode, and current contract budget may be stored for UI and save stability, but they must be recomputed after any relevant mutation. Cash is never duplicated outside `Promotion.money`.

## Financial Modes

Every promotion is classified dynamically from its balance, debt headroom, recurring net income, and near-term obligations:

- `growth`: strong runway and sufficient reserves;
- `stable`: healthy but not overfunded;
- `cautious`: low runway or shrinking headroom;
- `recovery`: the promotion has reached its debt boundary or cannot safely fund normal discretionary spending.

These are derived states, not permanent promotion personalities.

A promotion leaves recovery only after both its balance and runway exceed a safety threshold. Hysteresis is required so a promotion cannot alternate between recovery and cautious around one boundary on consecutive settlements.

## Event Settlement

Every completed domestic event settles promotion-scoped finances exactly once:

```text
gate revenue
+ event media revenue
+ event sponsor bonuses
- fighter purses
- win bonuses
- venue cost
- marketing spend
= event net
```

Event settlement also applies the existing reputation and fanbase effects. Player event behavior remains compatible with current projections and finalization. Rival events must stop using zero ticket price, zero marketing, and zero financial archives.

AI event configuration is deterministic and depends on promotion reputation, fanbase, available roster, financial mode, venue options, and projected profitability. AI does not consume extra randomness solely for financial choices.

Recovery-mode events must be projected before booking. The promotion may still run a minimum viable domestic card when it is projected not to deepen debt beyond the permitted boundary. Cancelled events produce no event revenue or event operating cost. Fight purses must not be charged twice when an international fight is represented in domestic state.

## Monthly Settlement

On the first advancement that crosses into a new calendar month, each promotion settles once:

```text
monthly sponsor income
+ monthly media income
- monthly operating cost
- monthly roster retainer
- scheduled brand investment
= monthly net
```

Settlement is keyed by `promotionId + YYYY-MM`. Re-running the same pipeline, loading a save, or calling economy maintenance from multiple orchestration paths cannot settle the same month twice.

If time advances across multiple calendar months, each missed month is settled in chronological order. The settlement uses the roster and economy configuration applicable to the simulated progression rather than paying the final month repeatedly.

Incoming monthly revenue first pays existing `outstandingLiabilities`. Mandatory operating cost and roster retainer are then charged only up to the debt limit; any unpaid remainder is added to liabilities instead of pushing cash through the boundary. Liabilities carry forward without interest in Phase 2 and block every discretionary expense until cleared.

Monthly sponsor and media values for the player reflect the existing selected deals. AI commercial income is initialized and updated deterministically from reputation and fanbase. Phase 2 does not add AI deal negotiations or new deal UI.

## Roster Retainer

Existing `payPerFight` and `winBonus` remain the fighter's event compensation and Contract Market terms. Phase 2 does not add a separate salary field to every contract.

A monthly retainer is derived deterministically from each active contract's pay values and counts only fighters whose `contract.promotionId` matches the promotion on the settlement date. This makes roster size and contract quality create recurring cost while keeping the Phase 1 contract schema intact.

Expired, free-agent, retired, or differently owned fighters are excluded. International participation does not change ownership and therefore does not duplicate retainer charges.

## Debt and Recovery

Each promotion has a debt limit derived from its reputation, fanbase, and stable commercial income. Cash may become negative, but no approved transaction may produce a balance below the current debt limit.

As runway falls:

- contract budget decreases;
- AI marketing and brand investment decrease;
- AI prefers profitable or lower-cost event configurations;
- discretionary transfer spending is reduced before core roster retention.

At the debt boundary or while liabilities remain, recovery mode:

- blocks new transfer-fee spending;
- blocks unaffordable contract offers and renewals;
- blocks new brand investment;
- blocks events projected to deepen the breach;
- still allows monthly settlement and commercial income;
- uses incoming cash to clear liabilities before discretionary spending;
- still permits a minimum viable event that satisfies the debt rule;
- permits essential roster retention only within the available budget.

Mandatory monthly costs never create cash and never cross the debt limit. Unpaid cost becomes `outstandingLiabilities`; it is visible, carries no Phase 2 interest, and keeps the promotion in recovery until repaid. The existing player emergency cash injection is removed or bypassed once the shared recovery model is authoritative. Phase 2 never silently creates money and never dissolves a promotion.

## Brand Investment

The player receives a manual brand investment action. The UI accepts an amount, shows its projected fanbase and reputation effect, and rejects the transaction when:

- the amount is invalid;
- the promotion is in recovery;
- the transaction would cross the debt limit;
- required operating reserves would be violated.

The accepted investment is charged and recorded exactly once. Its effect is deterministic and bounded, with diminishing returns sufficient to prevent unlimited linear reputation purchases.

AI promotions choose brand investment automatically:

- growth promotions invest the most;
- stable promotions invest moderately;
- cautious promotions invest little or nothing;
- recovery promotions invest nothing.

Brand investment is a long-term economy action, separate from event marketing spend.

## Contract Market Integration

`getPromotionContractBudget(state, promotionId)` remains the public Contract Market seam but changes from a fixed percentage of cash to a promotion-economy calculation:

```text
available debt headroom
- next-month operating obligations
- required reserve
= spendable contract capacity
```

The result is adjusted by financial mode and cannot be negative. Offer creation uses this budget, and pending settlement validates the latest budget and debt headroom again before changing cash, ownership, rankings, titles, or contracts.

Market settlement remains atomic. A stale offer that became unaffordable fails without partial transfer-fee, contract, fighter, title, or ranking mutations.

Transfer fees paid and received are written to the appropriate promotion ledgers using the same market transaction identity.

## AI Financial Decisions

AI spending decisions are deterministic functions of current state:

- Growth promotions can schedule stronger cards, market more, invest in brand, and compete for high-value fighters.
- Stable promotions maintain a sustainable event cadence and target roster needs within reserves.
- Cautious promotions lower marketing, avoid marginal transfers, and protect the core roster.
- Recovery promotions stop discretionary spending and only choose actions that respect the debt boundary.

No fixed identity or hidden financial personality is added in this phase. Different behavior emerges from promotion money, reputation, fanbase, roster obligations, event results, and market activity.

## Frontend

Add a `Promotion Finances` view accessible from normal navigation and linked from relevant Dashboard and Contract Market summaries.

The view allows selection of any promotion and publicly displays exact values for player and rivals:

- cash balance;
- debt limit and remaining headroom;
- outstanding liabilities;
- estimated runway;
- current financial mode;
- current month income and expenses;
- monthly sponsor and media income;
- monthly operating cost;
- monthly roster retainer;
- current contract budget;
- recent event profit or loss;
- full promotion ledger;
- brand investment history.

For the player promotion, the view also contains the manual brand investment form and projected effect. Rival promotions are read-only.

The Dashboard and Contract Market show only concise status and navigation links. They do not duplicate the detailed ledger. Existing player sponsor and media deal controls remain in place and feed the unified economy state.

The view uses existing responsive and accessibility conventions, including semantic form labels, keyboard-accessible controls, clear signed currency, status text independent of color, and an `aria-live` result message.

## Mutation and Validation Rules

- Every multi-entity finance mutation is prepared on a candidate state and committed only after validation.
- No transaction may move promotion cash below its debt limit.
- Monthly settlement occurs at most once per promotion and month.
- Event settlement occurs at most once per completed event.
- Every ledger entry maps to one cash mutation, and its recorded resulting balance must match transaction order.
- Ledger IDs are deterministic and unique.
- Roster retainer follows promotion-scoped contract ownership.
- Cancelled events have no event settlement.
- International competition cannot cause duplicate domestic event settlement or duplicate purse cost.
- Recovery mode cannot block mandatory monthly settlement or incoming revenue.
- Mandatory cost beyond available debt headroom becomes a non-negative liability rather than a cash-balance breach.
- Incoming revenue clears liabilities before discretionary spending becomes available.
- Brand investment is non-refundable and applied once.
- Contract Market settlement preserves atomic ownership, money, title, and ranking updates.
- Validators detect missing economy records, unknown promotion references, invalid numeric values, duplicate settlement keys, duplicate ledger IDs, ledger/balance inconsistencies, debt-limit breaches, and stale derived budgets.

## Save Migration

Increase the save version once and make migration idempotent.

For every promotion in an older save:

1. Create a `PromotionEconomy` record without changing `Promotion.money`.
2. Initialize debt limit, operating cost, commercial income, zero outstanding liabilities, financial mode, and contract budget deterministically from current promotion and roster state.
3. Reflect the player's existing sponsor and media deals in its economy record without paying them again.
4. Preserve existing player finance history by importing or referencing it without changing the current balance.
5. Initialize AI commercial values from reputation and fanbase.
6. Set the last monthly settlement to the current save month so migration cannot generate retrospective income or cost.
7. Recompute runway, recovery mode, and budget.

Running migration again must not add ledger rows, change balances, or shift settlement markers.

## Testing Strategy

Development follows standalone `node:assert/strict` and `npx tsx` TDD conventions.

Focused tests cover:

1. Promotion economy types, world initialization, and complete promotion coverage.
2. Save migration, balance preservation, no retrospective settlement, and idempotency.
3. Monthly settlement for player and AI promotions.
4. Multi-month advancement and duplicate-settlement prevention.
5. Roster retainers across ownership, expiry, retirement, and international participation.
6. Rival event projection and financial settlement.
7. Debt limits, liability accrual and repayment, mode transitions, hysteresis, and recovery restrictions.
8. Player brand investment validation, ledger entries, and bounded effects.
9. Dynamic Contract Market budgets and atomic stale-offer rejection.
10. AI spending choices for growth, stable, cautious, and recovery states.
11. Store actions, routing, navigation, i18n, accessibility, and responsive UI contracts.

A deterministic multi-season acceptance test runs identical seeded worlds and compares compact economy output. At yearly checkpoints it verifies:

- no duplicate monthly or event settlements;
- ledger order and balance consistency;
- no debt-limit breaches and no negative liability balances;
- liability accrual and repayment preserve ledger/balance consistency;
- promotions can experience profitable and loss-making periods;
- recovery mode can be entered and exited;
- Contract Market never spends protected reserves;
- event, tournament, calendar, title, ranking, ownership, and Contract Market invariants remain valid;
- both seeded runs produce identical economy records, budgets, balances, and relevant market history.

Final verification uses focused tests, impacted regressions, long simulation, `npm run lint`, `npm run build`, and `git diff --check`. No browser automation is required; the user performs manual visual checking.

## Delivery Boundary

Phase 2 is complete when all promotions participate in one deterministic operating economy, event and monthly finances affect their cash, roster cost constrains growth, Contract Market budgets respond to runway, recovery prevents unbounded debt, player brand investment works, AI spending adapts to financial health, and exact finances are visible in the frontend.

Promotion bankruptcy, administration, creation, dissolution, and structural promotion lifecycle changes remain explicitly deferred to Phase 3.
