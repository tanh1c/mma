# Seasonal Contract Market Design

## Goal

Create the first complete multi-promotion ecosystem slice: a deterministic post-season market where promotions list, buy, retain, and compete for fighters through sealed offers without disrupting active international competitions.

## Scope

Phase 1 includes:

- a 30-day post-international-season transfer window;
- two-way transfer listings;
- purchases of contracted fighters;
- renewals and free-agent competition;
- one sealed offer per promotion per fighter;
- deterministic AI shortlists and bids;
- deterministic fighter selection;
- atomic settlement;
- player market UI and compact transfer history;
- save migration and multi-season acceptance coverage.

Phase 1 excludes deep AI cash flow, debt, bankruptcy, agents, signing bonuses, guaranteed purses, clauses, personality preferences, relocation, brand fit, media competition, and commercial rivalries.

## Market Calendar

A market window is scheduled after all Champions Cup and Challenge Cup competitions for the season have completed. It opens for 30 calendar days. A fixed post-season fallback date opens the market if the international season was not created or cannot complete, so a save cannot remain permanently locked out.

The window moves through:

```text
scheduled -> open -> resolving -> closed
```

Listings and offers may be created or revised only while open. Transfers settle when the window resolves. Fighters may finish an active international competition before changing ownership; no bracket participant changes promotion mid-competition.

## Market Records

The save stores:

- transfer windows and their season, dates, and status;
- transfer listings with seller, fighter, minimum fee, and status;
- sealed offers with buyer, fighter, optional seller, transfer fee, and the existing contract terms;
- pending transfer settlements;
- compact resolved transfer history with outcome and reason.

IDs are stable. Active records remain resumable after save/load. Resolved records are compacted rather than retaining transient UI data indefinitely.

## Eligibility and Listings

A player or AI promotion may transfer-list a fighter it currently owns. Other promotions may also approach an unlisted contracted fighter, but the owner must accept the transfer fee before the fighter considers the contract package.

Free agents and expiring fighters require no transfer fee. Their current promotion competes through a renewal offer in the same sealed process.

A promotion may keep only one active offer for a fighter. It may revise that offer before the deadline. The player sees the number of interested promotions and an estimated competition level, never rival offer values.

## AI Shortlisting and Valuation

AI promotions shortlist fighters from promotion-scoped roster needs:

- minimum depth by weight class;
- weak champion or contender depth;
- expected departures;
- age and potential balance;
- rank, record, popularity, availability, and injury risk.

Each AI buyer calculates a maximum transfer fee and expected contract cost from sporting value, commercial value, roster need, retention value, and risk. In Phase 1, available contract budget is a conservative share of current promotion cash. Phase 2 replaces that calculation through the same budget boundary.

AI does not bid when the fighter does not solve a roster need or the full commitment exceeds its budget.

## Seller Decision

The owner evaluates a contracted-fighter fee using remaining contract value, sporting importance, title status, replacement difficulty, listing status, and cash benefit. A listed fighter may have a lower acceptance threshold than an unsolicited approach.

Rejected seller fees never reach fighter selection. Accepted fees reserve no money until final settlement, but the resolver revalidates buyer cash and ownership before applying results.

## Fighter Decision

Eligible packages receive deterministic utility from only four factors:

1. expected money from purse and win bonus;
2. promotion prestige;
3. title opportunity from promotion-specific ranking and roster depth;
4. loyalty to the current promotion.

Money is the largest weight but does not automatically win. Stable IDs provide deterministic tie-breaking. The result stores a concise explanation such as better title opportunity, stronger prestige, superior expected pay, or loyalty.

## Atomic Resolution

At the deadline, resolve each fighter once:

1. Revalidate fighter, buyer, seller, ownership, offer status, and buyer cash.
2. Remove invalid packages with an explicit reason.
3. Apply seller approval where required.
4. Select the highest fighter utility among eligible packages.
5. Produce one settlement transaction containing buyer debit, seller credit, new contract, ownership update, title cleanup, ranking rebuild, registration update, news, and history.
6. Apply the transaction only if every invariant succeeds.

No partial settlement or rollback path is permitted. Failed transactions leave money, contracts, titles, rankings, and ownership unchanged.

A departing domestic champion vacates the seller's promotion title unless the fighter remains owned by that promotion. International titles remain attached to their neutral competition history, while future eligibility uses the fighter's new promotion.

## Player Experience

Add a Contract Market destination with:

- **Available**: listed, expiring, and free-agent targets;
- **My Listings**: fighters offered by the player's promotion;
- **Incoming Offers**: fees offered for player-owned fighters;
- **My Offers**: sealed packages submitted by the player;
- **History**: resolved transfers and reasons.

The screen shows window status, deadline, eligibility, estimated competition, affordability, and resolution explanations. Rival internal decisions stay read-only except when they create an incoming offer requiring player action.

All controls use semantic buttons and labels, status changes use accessible live text, and mobile layouts use existing responsive UI patterns.

## Save Migration

Bump the save version once. Migration adds an empty market state and schedules the next valid window without changing existing contracts or ownership. The migration must be idempotent. Loading during an open window preserves deadlines, listings, offers, and deterministic resolution.

## Testing and Acceptance

TDD coverage must prove:

- windows open only after the international season or fallback date and close after 30 days;
- no listing or offer mutation occurs outside an open window;
- each promotion has at most one active offer per fighter;
- rival offer values remain hidden from the player;
- AI bids only for roster need and within budget;
- seller approval and fighter utility are deterministic;
- fighter utility uses only money, prestige, title opportunity, and loyalty;
- transfer fees conserve money between buyer and seller;
- settlement updates contract ownership, titles, champion flags, rankings, availability, and registration atomically;
- international participants do not switch promotion mid-competition;
- save/load during a window produces the same final outcome;
- duplicate resolver calls are idempotent.

Long simulations across multiple seasons must report zero:

- fighters owned by multiple promotions;
- active offers referencing missing entities;
- negative promotion cash caused by settlement;
- domestic champions without the correct promotion contract;
- unresolved active offers after a closed window;
- duplicate transfer-history results;
- calendar, tournament, title-debt, round-stat, missing-result, or crash errors.

Verification uses focused standalone `npx tsx` tests, existing management and multi-league regressions, long simulation, `npm run lint`, `npm run build`, and `git diff --check`. No browser automation, assets, or new dependencies are required.
