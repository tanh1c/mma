# Fighter Personality, Drama, and Season Goals Design

## Goal

Make Manager and Observer saves generate memorable, explainable stories instead of only advancing schedules and statistics. Fighter personality drives contextual drama; Manager mode resolves major incidents through consequential choices; Observer mode resolves them automatically and reports why; season goals and reviews give each year a visible arc.

## Scope

The first release contains four bounded systems:

1. Deterministic fighter personality traits.
2. Contextual drama incidents and decisions.
3. Observer promoter identity and automatic incident resolution.
4. Three annual objectives plus a season review.

The systems reuse existing morale, popularity, fatigue, injuries, contracts, event cards, social hype, rivalries, money, reputation, fanbase, archives, awards, and season plans. They do not add a relationship graph, finance sliders, PPV clauses, staff management, or new fighter performance meters.

## Experience Principles

- Personality changes behavior, not OVR.
- Incidents arise from current game context rather than arbitrary flavor text.
- A Manager decision shows certain consequences and describes uncertain risk before confirmation.
- Observer simulation never pauses for an incident.
- Every Observer decision records the selected response, rationale, and consequences.
- Drama grows as the promotion becomes larger and more star-driven, while strict caps prevent constant disruption.
- No incident may corrupt a tournament, title state, calendar, archive, or completed event.
- All new UI and generated text support English and Vietnamese.

## Fighter Personality

Each active or historical fighter persists no more than two distinct traits:

- `professional`: reduces disciplinary and preparation incidents.
- `trash_talker`: increases rivalry and hype opportunities, with backlash risk.
- `diva`: reacts badly to low card placement, weak offers, and being passed over.
- `loyal`: accepts reasonable renewals and short-notice help more readily.
- `mercenary`: prioritizes compensation and is more likely to demand improved terms.
- `risk_taker`: accepts difficult or short-notice fights but accumulates preparation risk.
- `hot_head`: increases confrontation and disciplinary incidents.
- `company_fighter`: accepts replacement duty and public promotion requests more readily.

Trait assignment is deterministic from stable fighter identity and career data. New fighters receive traits during generation. Save migration assigns the same traits whenever the same old save is migrated. Trait badges are descriptive and do not directly modify attributes, POT, ranking score, or fight simulation output.

Traits supply small, bounded modifiers to existing decisions and incident eligibility. Conflicting combinations that would make behavior incoherent, such as `loyal` with `mercenary`, are not assigned together.

## Drama Incident Model

A drama incident is persisted structured data rather than localized prose. It contains:

- Stable incident ID and type.
- Created date and relevant fighter, fight, event, storyline, or contract IDs.
- Severity and lifecycle status: pending, resolved, or expired.
- Valid response keys.
- Selected response, resolver mode, rationale key, and resolution date after completion.
- Structured consequences for audit and season reporting.

The first release supports:

1. Difficult weight cut or missed weight.
2. Minor camp injury scare.
3. Trash talk that can create or intensify a rivalry.
4. Press-conference altercation.
5. Pay demand or public contract complaint.
6. Refusal of a short-notice fight.
7. Complaint about being passed over in the title picture.

Incidents are evaluated only at meaningful boundaries:

- Fourteen days before a scheduled fight.
- Fight-week entry.
- Offer or counter-offer evaluation.
- Short-notice replacement selection.
- Post-fight processing.
- Annual season initialization.

Daily time advancement may detect that a boundary has been reached, but it must not perform an unbounded history scan. Stable trigger keys make repeated repair and simulation paths idempotent.

## Frequency and Escalation

Drama frequency increases with promotion reputation, fanbase tier, event importance, combined fighter popularity, active rivalry intensity, and relevant personality traits. Early saves remain comparatively stable; established promotions with stars generate more incidents.

The escalation curve changes frequency and eligible severity, not deterministic reproducibility. Limits apply regardless of promotion size:

- At most one primary fight-week incident per fight.
- At most two disruptive incidents per event.
- A bounded number of incidents per calendar month.
- Fighter- and incident-type cooldowns prevent repetitive stories.
- Completed events and archived fights are never eligible.

Most incidents adjust narrative and existing values. Fight cancellation, forced replacement, severe contract fallout, or title disruption remains rare and requires both suitable context and a high-severity result.

## Manager Decisions

Manager mode stores consequential incidents as pending decisions surfaced in Inbox. Each incident offers two or three responses drawn only from currently valid actions.

A response card displays:

- The action in plain language.
- Guaranteed financial, morale, hype, reputation, or booking consequences.
- Uncertain secondary risk as low, medium, or high without revealing its resolved outcome.
- Disabled or omitted responses when the referenced replacement, contract, event, or fighter is no longer valid.

Example responses to a missed-weight incident can include keeping a catchweight bout, imposing a fine, or replacing/cancelling the matchup. The exact options depend on opponent consent, replacement availability, tournament constraints, title status, and event timing.

A required decision blocks only simulation of its affected event. General navigation and time advancement remain available before the event date. If the underlying event or fight becomes invalid through another legitimate action, the incident expires safely and records the reason.

Resolving an incident is atomic: validate current references, choose the deterministic uncertain outcome, apply consequences, repair affected event/tournament state through existing helpers, record the resolution, and publish localized news/social output. A resolved incident cannot apply twice.

## Promoter Identity and Observer Resolution

Observer mode has one persisted promoter identity:

- `meritocracy`: protects rankings, title legitimacy, and competitive fairness.
- `spectacle`: prioritizes stars, hype, rivalries, and event value.
- `prospect_builder`: protects young talent and long-term roster value.
- `conservative`: prioritizes safety, cash, and schedule stability.

Identity influences response scoring, booking preference, social promotion, and incident rationale. It does not bypass hard validity rules or rewrite core simulation odds.

When an incident is created in Observer mode, the AI:

1. Removes responses that are currently invalid.
2. Scores remaining responses from promoter identity, promotion finances, event importance, title/tournament constraints, fighter value, and expected disruption.
3. Uses a stable incident-ID tiebreaker.
4. Resolves immediately without pausing simulation.
5. Creates a report naming the incident, selected response, rationale, and applied consequences.

There is always a conservative no-corruption fallback response, such as accepting a minor consequence or cancelling an invalid matchup through existing repair logic. The fallback is a valid gameplay outcome, not a silent catch-all that hides errors.

Autopilot summaries add incident counts, resolved incidents by severity, rescued or cancelled fights, money impact, social-hype impact, and major decisions. The report explains behavior without exposing internal score arithmetic.

## Consequences

Consequences reuse existing state wherever possible:

- Fighter morale, popularity, fatigue, injury status, or contract/counter-offer state.
- Fight social hype and rivalry intensity.
- Event card composition, projections, and eventual fan reaction.
- Promotion money, reputation, and fanbase.
- News, Social Hub items, and Observer summaries.

Consequences are clamped to existing domain bounds. Structured consequence records preserve before/after deltas for reports and save/load verification. Incident handling does not directly edit ranking positions, completed results, title history, or archives; downstream existing systems derive those outcomes normally.

## Season Objectives

At the first season initialization for each year, the promotion receives exactly three deterministic objectives when valid candidates exist:

1. One sporting objective.
2. One entertainment objective.
3. One business objective.

Examples include keeping a champion active, booking a target number of title fights, developing a prospect into the top five, completing a profitable Grand Prix, creating a high-intensity rivalry, producing a Fight of the Year candidate, reaching a profit threshold, or increasing fanbase.

Objective generation reads current titles, roster depth, tournaments, finances, archives, reputation, and fanbase. It excludes impossible goals: no Grand Prix goal without viable roster depth, no champion-defense goal for a vacant division, and no prospect-ranking goal without an eligible developing fighter.

Progress is derived from authoritative game data and refreshed at existing event, ranking, finance, and annual boundaries. Completion is persisted once. Rewards are deliberately small and granted exactly once: bounded reputation, fanbase, or sponsor cash bonuses. Failure has no large penalty; objectives provide direction rather than enforce a single strategy.

Manager and Observer modes use the same objectives. In Observer mode they measure and explain AI performance rather than requesting input.

## Season Review

After yearly awards are finalized, one persisted season review summarizes:

- Objectives and completion status.
- Fight, fighter, event, knockout, submission, upset, and prospect awards already generated by the game.
- The highest-impact incident and its resolution.
- Notable champion, rivalry, and prospect stories.
- Annual profit, fanbase, reputation, and signed-roster changes compared with the previous season snapshot.
- An overall performance grade derived from objective completion and bounded year-over-year changes.

The review references archive and fighter IDs instead of duplicating full historical entities. Missing historical references degrade to localized fallback labels without breaking the page.

## Responsive UI/UX

### Drama Inbox

On wide screens, Inbox uses a list/detail layout. On narrow screens, it becomes a single-column flow: the list opens a dedicated detail state and provides an explicit back action. It does not depend on a tall modal.

Decision cards occupy the available width and show action, guaranteed consequences, and risk. Primary actions have at least a 44-pixel touch target. Pending-state badges remain visible without covering navigation or content.

### Personality Surfaces

Fighter Detail is the authoritative trait view. Compact trait badges may also appear on roster and fight-preview surfaces when space permits. No surface displays more than two badges. Badge rows wrap; labels are localized; explanation is available by click/tap and keyboard focus rather than hover alone.

### Objectives and Review

Objective cards form a responsive grid: one column on narrow screens and up to three columns when space allows. Progress labels remain textual in addition to visual bars. Season Review uses stacked sections on mobile. Only inherently tabular history uses local horizontal scrolling.

### Observer Reports

The post-simulation summary shows a compact incident overview and links to a filterable drama timeline. Observer reports never appear as blocking popups. Decision rationale is readable text and does not rely on color or icons alone.

### Responsive Contract

The feature is audited at 390×844 portrait, 740×390 short landscape, and the desktop-shell breakpoint. Containers use `min-w-0`; long names, currency, and generated prose can wrap; compact controls wrap instead of starting offscreen. The page itself must not overflow horizontally. CSS breakpoints are preferred over viewport JavaScript. Keyboard navigation, visible focus, semantic labels, touch targets, and English/Vietnamese copy are required.

## Save Migration and Determinism

The save schema increments once and supplies deterministic defaults for:

- Fighter personality traits.
- Promoter identity.
- Incident history and pending decisions.
- Season objectives, reward state, snapshots, and reviews.
- Incident cooldown and trigger bookkeeping.

Migration is idempotent. Loading an old save repeatedly cannot change traits, create duplicate incidents, re-resolve decisions, or grant rewards twice. Generated IDs and uncertain outcomes use stable seeds composed from persisted identifiers, date/season, and operation kind. They do not use `Math.random()`, `Date.now()`, locale-dependent sorting, or iteration-order-dependent global RNG consumption.

Pending Manager decisions survive save/load. Observer decisions are resolved in the same transaction in which they are created, so a saved Observer state cannot contain a decision that should have paused simulation.

## Integrity and Error Handling

- References are validated at decision resolution because the player may have changed the card after incident creation.
- Invalid optional responses are removed; invalid required incidents expire with a recorded reason.
- Tournament replacements, event repair, title synchronization, and contract changes reuse existing domain helpers.
- Completed event and fight history is immutable.
- An incident cannot be generated or resolved more than once.
- Objective rewards and season reviews are created at most once per year.
- Observer always chooses among valid responses and never stalls daily simulation.
- Incident and objective processing remain bounded as history grows.

## Testing and Acceptance

Focused `node:assert` scripts cover:

- Deterministic trait assignment, valid pairings, migration, and rookie assignment.
- Trigger boundaries, eligibility, cooldowns, monthly/event caps, and duplicate prevention.
- Each incident response, consequence clamps, stale-reference expiry, and event/tournament integrity.
- Manager pending decisions, save/load round-trip, event-only blocking, and exactly-once resolution.
- All promoter identities, stable tiebreaking, valid fallback behavior, rationale/report output, and non-blocking Observer simulation.
- Objective validity, progress derivation, exactly-once rewards, annual review generation, and missing-reference fallbacks.
- Same save plus same action producing structurally identical results.
- A bounded long simulation proving no stalls, no unbounded incident growth, healthy division/card/title/tournament invariants, and no material slowdown as incident history accumulates.

Browser verification exercises Manager decisions, trait disclosure, objectives, Season Review, and Observer reports in English and Vietnamese at the required portrait, short-landscape, and desktop viewports. It checks keyboard operation, touch targets, focus visibility, local table scrolling, long-content wrapping, and absence of page-level horizontal overflow.

Final verification runs focused regressions, existing affected gameplay scripts, lint, build, and `git diff --check`. The unbounded `test_long_sim.ts` benchmark remains excluded unless explicitly requested.

## Explicit Exclusions

- No full fighter relationship graph.
- No staff, gym, commission, debt, or strategic budget subsystem.
- No configurable probability sliders in the first release.
- No contract clause expansion beyond consequences represented by existing contract and title-shot state.
- No LLM or network service for AI decisions or prose.
- No new modal, charting, state-management, or responsive dependency.
- No change to core fight simulation probabilities solely because a personality trait exists.
