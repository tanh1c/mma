# Multi-Promotion Ecosystem Roadmap Design

## Goal

Evolve the existing promotion-scoped domestic leagues and neutral international knockout cups into a persistent ecosystem where promotions compete for fighters, money, status, international places, managers, audiences, sponsors, and media rights.

## Delivery Strategy

Ship vertical slices. Each phase must provide usable gameplay, its own save migration, focused tests, and long-simulation invariants before the next phase begins. Later phases consume stable outputs from earlier phases instead of reaching into their internals.

## Phase 1: Contract Market

Add a seasonal transfer window, two-way transfer listings, contracted-fighter purchases, free agency, renewals, sealed offers, deterministic AI bidding, and atomic roster transfers. Fighter decisions use expected money, promotion prestige, title opportunity, and loyalty.

## Phase 2: AI Economy

Give every promotion a real operating model: event income, payroll, recurring costs, sponsor and media income, debt runway, brand investment, and contract budgets. Replace Phase 1's conservative cash-percentage budget through the same market-facing budget interface.

## Phase 3: Promotion Lifecycle

Add sporting, financial, and brand standings. Promotions can move between tiers, enter administration, be created, or dissolve. Lifecycle transitions must settle contracts, titles, calendars, and international registrations through existing ownership and market rules.

## Phase 4: International Competition Evolution

Track rolling international coefficients across seasons and derive variable Champions Cup and Challenge Cup places. Replace knockout-only competition orchestration with formats that support group or league phases, home/away events, qualification ties, and knockout rounds while reusing the existing event and fight settlement engine.

## Phase 5: Manager Career

Separate manager identity and career history from `playerPromotionId`. Add job offers and controlled promotion switching at season boundaries. Switching must not move money, fighters, titles, or contracts between promotions and must preserve the former promotion under AI control.

## Phase 6: Commercial Market and Rivalries

Add media-rights bidding, sponsor categories and exclusivity, audience-market overlap, promotion identities, and persistent inter-promotion rivalries. Commercial outcomes affect revenue, prestige, contract attraction, event scheduling, and international narratives.

## Shared Constraints

- Preserve deterministic simulation for equivalent state and seed.
- Keep ownership promotion-scoped and international competitions neutral.
- Use native TypeScript, React, Zustand, and existing dependencies.
- Add no assets or dependencies unless a later approved design requires them.
- Never change fighter ownership, money, titles, rankings, or registrations partially.
- Keep every migration idempotent and every phase loadable from existing saves.
- Validate each phase with focused `npx tsx` tests, long simulation, lint, build, and `git diff --check`.

## Explicit Phase Boundaries

Phase 1 does not model debt, bankruptcy, agents, signing bonuses, guaranteed money, clauses, personality fit, or commercial rivalry. Phase 2 does not create or dissolve promotions. Phase 3 does not replace international competition formats. Phase 4 does not permit manager switching. Phase 5 does not add commercial bidding. These exclusions prevent circular dependencies and keep each phase independently shippable.
