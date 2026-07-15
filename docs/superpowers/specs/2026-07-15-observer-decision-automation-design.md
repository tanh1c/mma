# Observer Decision Automation Design

**Date:** 2026-07-15
**Status:** Approved

## Goal

Make Observer mode automatically choose fight camps, operate promotion social actions, and resolve actionable management decisions while preserving Manager mode and the existing event, tournament, calendar, and economy safeguards.

## Scope

The feature adds one deterministic Observer-only decision pass to the existing daily autopilot loop. It reuses current systems rather than turning the derived Promotion Inbox into a second command engine.

Included:

- Automatic matchup-level fight camp selection.
- Idempotent matchup announcements and selective fight hype.
- Balanced acceptance or rejection of active contract counter-offers.
- Clear Observer handling of expiring contracts, rivalry opportunities, roster depth, and high-value free agents.
- Delegation of event, tournament, title-shot, and availability issues to their existing automation owners.

Excluded:

- Continuous real-time simulation without an Advance command.
- Per-corner fight camps; the current model stores one camp focus per matchup.
- New social-action costs, cooldowns, or marketing systems.
- New Inbox persistence, decision history, settings, or command queues.
- Changes to Manager-mode behavior.

## Architecture

Add a focused pure game-state module, `src/lib/game/observer.ts`, with a single orchestration entry point:

```ts
export function runObserverDecisions(state: GameState): GameState
```

The function returns the input unchanged unless both conditions hold:

```ts
state.mode === 'observer' && state.autopilot.enabled
```

`advanceAutopilot` calls this function once per simulated day after `autoBookEventsAndContracts`, `runAutopilotTournaments`, and future-event availability repair have produced viable cards, but before `advanceTime` moves to the next date. This ordering lets the decision pass operate on newly created or repaired fights without racing the existing event and tournament systems.

The Promotion Inbox remains a derived read model. Observer decisions operate through existing state transitions and helpers; they do not iterate Inbox items or reimplement their resolution paths.

## Fight Camp Policy

Add a pure deterministic selector:

```ts
export function chooseObserverCampFocus(
  fight: FightMatchup,
  red: Fighter,
  blue: Fighter,
  eventDate: string,
  currentDate: string
): FightCampFocus
```

Because `FightMatchup.campFocus` applies to both corners, the policy evaluates the matchup as a whole.

Priority order:

1. `recovery` when either fighter has fatigue at least 35, or the fight is booked with fewer than 14 days of preparation.
2. `cardio` for five-round fights or title fights.
3. `wrestling` when the pair's average wrestling/grappling/submissions score exceeds its average striking/power score by at least five points.
4. `striking` when the pair's average striking/power score exceeds its average wrestling/grappling/submissions score by at least five points.
5. `balanced` otherwise.

The Observer pass applies this selection to every fight in every incomplete event dated on or after the current date. It may replace the default `balanced` value because Observer owns automated preparation. It does not modify completed events or Manager-mode cards.

No simulator changes are required. `simulateFight` already interprets `campFocus`, and post-fight fatigue/injury handling already applies the corresponding consequences.

## Promotion Social Policy

The Observer pass reuses `applyPromotionSocialAction` for all mutations, retaining action-key and stable-key idempotency.

### Announcements

For every fight in an incomplete event dated on or after the current date, apply `announce` once. Existing action keys prevent repeats across subsequent daily passes.

### Hype

Apply `hype` once when an event is between 1 and 14 days away and the fight satisfies at least one condition:

- title fight;
- tournament fight;
- linked active rivalry;
- overall-rating gap below 10;
- combined fighter popularity at least 120.

A non-title, non-tournament, non-rivalry fight with a large overall mismatch and low combined popularity is not hyped. This avoids spending the one available action on an unattractive mismatch and avoids the existing underdog morale penalty unless another meaningful reason warrants promotion.

No cash, reputation, or marketing cost is added. Social effects remain those already implemented by `applyPromotionSocialAction`.

## Observer Management Decisions

### Counter-offers

Process every active counter-offer before its expiry. Accept it when all of these are true:

- the fighter is a champion, has popularity at least 60, is a prospect, or belongs to a contracted division with fewer than six fighters;
- the promotion has at least $50,000 after reserving the offered pay plus win bonus;
- the offered terms have positive fight count and non-negative pay values.

Acceptance signs a free agent or renews a contracted fighter using the exact counter-offer terms, recalculates the contract end date with the existing contract helper, clears the counter-offer, and adds one contract news item.

If the conditions fail, Observer explicitly rejects the offer by clearing it. This prevents an unresolved urgent Inbox item from repeating until expiry. Rejection has no extra morale or reputation effect.

### Expiring Contracts and Roster Depth

Existing `maintainRoster` remains the owner of:

- champion renewals;
- renewal of popular fighters;
- releases from oversized divisions under financial pressure;
- signings for divisions below six contracted fighters.

The Observer decision pass must not duplicate these operations. Counter-offer handling runs against the post-maintenance roster state so an already renewed fighter cannot be processed twice.

### Rivalries

Intensity-three active rivalries become a priority source for the regular-card fill phase of automatic event generation. A rivalry pair may be selected only when both fighters:

- are contracted;
- share the required weight class;
- are healthy and unsuspended for the event date;
- are not already booked;
- are not active tournament participants needed by another round.

Title fights, Grand Prix title-shot debts, unification bouts, vacant/interim titles, and tournament fights retain their existing higher priority. A rivalry does not create a separate event and does not bypass availability or card-integrity rules.

### Delegated Inbox Conditions

The following conditions remain owned by existing automation and are not separately handled by `runObserverDecisions`:

- due events: `simulateDueEvents`;
- incomplete or empty cards: card rebuild and empty-event cleanup;
- unavailable booked fighters: future availability repair;
- Grand Prix scheduling or delay: tournament autopilot;
- Grand Prix title-shot debt: calendar reservation and autobooker;
- roster-depth opportunities and high-value free agents: roster maintenance.

This prevents duplicate scheduling, signings, news entries, or tournament mutations.

## Daily Data Flow

For each simulated Observer day:

1. Synchronize calendar slots and repair past events.
2. Process an already-due event, respecting Watch Events Live.
3. Run event/contract autobooking.
4. Run tournament autopilot.
5. Repair future event availability.
6. Run `runObserverDecisions`:
   - resolve active counter-offers;
   - assign camps to current upcoming fights;
   - announce newly created fights;
   - selectively hype fights in the 14-day window.
7. Advance the date by one day.
8. Maintain sponsor/media deals and execute the existing post-advance repairs and due-event processing.

The function is idempotent for the same state and date except for the first intentional application of unresolved decisions.

## Error Handling and Safeguards

- Missing fighters, events, or malformed counter-offers are skipped or rejected without throwing.
- Social actions use their existing idempotency keys.
- Camp selection is deterministic and has no random input.
- Counter-offer acceptance never spends cash immediately because current contracts pay at fight settlement; the $50,000 reserve is a policy affordability guard, not a new transaction.
- Existing calendar, tournament, title, roster-availability, and event-card validators remain authoritative.
- Manager mode returns unchanged state from the new Observer decision module.

## Testing

Use test-first deterministic regressions.

### Unit behavior

- Every camp branch: recovery by fatigue, recovery by short notice, cardio for five rounds/title fight, wrestling advantage, striking advantage, and balanced fallback.
- Manager mode and disabled autopilot leave state unchanged.
- Announcement is added once and remains single after repeated decision passes.
- Eligible hype is added once within 14 days; an ordinary low-value mismatch is skipped.
- Important affordable counter-offer is accepted with exact terms and removed from Inbox.
- Unimportant or unaffordable counter-offer is cleared without signing or renewal.

### Integration behavior

- Automatic event creation produces non-default camps where policy applies.
- An intensity-three eligible rivalry is selected before an ordinary regular matchup but never before title or tournament obligations.
- Repeated Observer days do not duplicate social actions, contracts, or news.
- Manager-mode advance and manually built events retain their selected camp behavior.

### Regression behavior

Run Observer long simulation and assert existing:

- calendar integrity;
- tournament invariants;
- fighter availability invariants;
- title-shot debt behavior;
- finance and completed-event cadence expectations.

Also run lint, production build, and runtime Observer advancement with Social Hub, Inbox, Calendar, and an upcoming Event Builder card inspected after the advance.

## Files Expected to Change

- Create `src/lib/game/observer.ts` for pure Observer policy and orchestration.
- Modify `src/store/gameStore.ts` to insert the Observer decision pass.
- Modify `src/lib/game/autobooker.ts` only for rivalry priority and any minimal shared eligibility/export needed by the policy.
- Extend `test_management_depth.ts` or add one focused `test_observer_decisions.ts` runnable regression.
- Extend long-simulation assertions only if the new behavior needs a directly observable invariant.

No dependency, schema-version, or UI component changes are required.
