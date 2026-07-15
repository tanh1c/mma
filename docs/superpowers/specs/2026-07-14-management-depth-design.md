# MMA Manager Depth Design

**Goal:** Add balanced roster, booking, and promotion-management decisions through contract lifecycle/negotiation, lightweight camps, evolving rivalries, and a self-clearing Promotion Inbox.

## Scope and constraints

- Preserve the current local single-player model, Zustand checkpoint navigation, event and GP workflows, save/import/export, and fight-result semantics.
- Keep contracts fight-count based while adding a calendar end date: either condition can expire a deal.
- Require no weekly administrative loop. Camp selection defaults to Balanced and is optional to override.
- Reuse the persisted `Storyline` collection for rivalries rather than introduce a second rivalry store.
- Derive Inbox items from live state. Do not save read/dismiss state.
- Keep camps and rivalry effects smaller than core fighter ability, morale, momentum, and normal simulation variance.

## Data model

### Contracts

Extend `Contract` with:

- `endDate`: ISO date set when signing or renewing.
- `lastNegotiationDate`: ISO date used to prevent repeat bargaining inside the same negotiation window.
- `counterOffer`: optional pending one-step response containing required pay, bonus, fights, expiry date, and interest snapshot.

A new contract derives an end date from its length. Renewals replace its pay, bonus, fights remaining, end date, and pending negotiation. Existing saves without an end date receive a deterministic default based on current game date and fights remaining.

### Fight camps

Add an optional `campFocus` to booked `FightMatchup` records:

- `balanced`
- `striking`
- `wrestling`
- `cardio`
- `recovery`

Every new matchup receives `balanced`. The field applies only to that scheduled bout and disappears naturally with the archived fight; no separate training schedule exists.

### Rivalry metadata

Extend `Storyline` with optional compatible metadata:

- `intensity` from 1 to 3.
- `createdDate` and `expiresDate`.
- `resolvedDate` when a qualifying rematch settles the rivalry.

Legacy storylines remain readable and behave as intensity 1 without expiry metadata until new lifecycle processing updates them.

## Contract negotiation and lifecycle

### Offers

The existing fighter detail offer form remains the single negotiation surface.

- An offer that meets current expectations is accepted and creates/renews the contract.
- A failed credible offer produces exactly one counter-offer with a revised amount and deadline.
- Accepting the counter-offer signs or renews immediately.
- A second inadequate offer ends the negotiation window and reduces interest.
- Free agents and contracted fighters use the same offer evaluation, while renewals retain the existing contract context.

### Expiry and morale

A contract is expiring when it has one or fewer fights remaining or 30 or fewer days to `endDate`.

- Contracted fighters with expired fights or a passed end date become free agents unless they are champions.
- Champions keep the existing protected-expiry behavior: they generate a critical decision instead of automatic release.
- An expiring fighter who has not been booked recently loses a small amount of morale during time advancement. The penalty is capped and stops once renewed, booked, or expired.
- Auto-booker behavior must respect end dates and avoid creating a future booking that lands after expiry unless the fighter has been renewed.

## Fight camps and simulation effects

Event Builder displays a camp selector beside each booked fighter, defaulting to Balanced. It shows a plain-language effect summary in fighter comparison and the event-card preview.

Effects are intentionally capped and only apply through existing pre-fight modifier logic:

| Focus | Effect |
| --- | --- |
| Balanced | No extra modifier. |
| Striking | Small striking/power benefit; small post-fight fatigue cost. |
| Wrestling | Small grappling/wrestling benefit; small post-fight fatigue cost. |
| Cardio | Small cardio benefit; modest fatigue reduction. |
| Recovery | Meaningful fatigue reduction and a small injury-risk reduction; no combat benefit. |

Camp modifiers are calculated from the matchup and never permanently alter fighter attributes. Existing injury, suspension, fatigue, morale, momentum, style, and random fight variance continue to dominate outcomes.

## Rivalry and storyline lifecycle

Existing event-news rules continue to create rematch, upset, and rivalry storylines. New logic normalizes pair-based rivalries and updates their intensity:

- Close high-rated fights, decisive upsets, direct rematches, and callout-triggering results raise intensity.
- A rematch between the same pair resolves the active rivalry after the fight.
- Unbooked rivalries cool down on time advancement and expire when their intensity reaches zero or their expiry date passes.
- The highest active pair-specific storyline controls the rivalry effect, preventing duplicate bonuses.

Rivalry intensity adds bounded bonuses to:

- Event projection hype and actual commercial outcome.
- Event Builder recommendation score.
- Promotion Inbox opportunity priority.

A rivalry never changes rankings, records, title rules, or GP progression directly.

## Promotion Inbox

Add a top-level `inbox` destination with a compact, priority-sorted decision queue. It is a pure selector over game state, not persisted data.

### Item groups

**Critical**
- Expired champion contract.
- Title-shot debt needing a booking.
- GP round blocked or delayed.
- Due event missing a viable card.

**Urgent**
- Contract expiring by fights or end date.
- Pending counter-offer near its deadline.
- Booked fighter without a chosen non-default camp on a meaningful fight.
- Booked fighter injured, suspended, or otherwise unavailable.

**Opportunity**
- High-intensity rivalry or rematch ready to book.
- Strong available free agent for a thin division.
- Valuable matchup recommendation.

Each item includes a concise explanation, relevant fighter/event/tournament context, and one direct existing navigation action. Items automatically disappear once the underlying condition resolves.

The Dashboard keeps a short preview of the highest-priority Inbox items and links to the full Inbox instead of duplicating independent alert logic.

## UX and navigation

- Add Inbox to the existing compact app navigation group; retain mobile navigation behavior.
- Use existing `setView` and `goBack` checkpoint behavior for every Inbox action.
- Keep contract negotiation within Fighter Detail and add contextual links from Inbox, Roster, and Free Agents.
- Add camp controls only to Event Builder and read-only camp labels to event preview/simulation screens where useful.
- News remains the historical feed; Inbox remains the present-tense action list.

## Save and migration behavior

- Save new contract, matchup camp, and storyline metadata through the current save/export path.
- Migration fills missing optional fields without changing existing contract pay, fights, historical fight results, fighter records, or archived events.
- Import validation rejects malformed external values only at the import boundary and normalizes valid legacy saves.

## Testing and acceptance

Add focused standalone TypeScript coverage for:

- Contract date migration, expiry by fight count and date, champion protection, morale pressure, counter-offer acceptance/rejection, and auto-booker expiry safety.
- Default camp assignment, per-focus bounded modifiers, no permanent fighter-stat mutation, and camp-fatigue/injury behavior.
- Rivalry escalation, deduplication, cooling/resolution, and bounded economics/recommendation effects.
- Inbox derivation, severity ordering, action targets, and automatic removal after resolution.
- Save/export/import preservation for all new data.

Run all existing contract, calendar, tournament, long-simulation, typecheck, and production-build checks. Long simulation must retain zero calendar and GP invariant errors.

## Explicit exclusions

- No multiplayer, real fighters, real MMA brands, rival promotions, new belt types, or league standings.
- No multi-round bargaining, agent personalities, signing bonuses, title clauses, or contract buyouts.
- No manual weekly camp scheduling, permanent camp stat growth, or custom fight-gameplan scripting.
- No dialogue tree or social-media simulator for rivalries.
- No persisted Inbox read state, notifications, or background timers.
