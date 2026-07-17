# Fighter Career Ecosystem and Editor Design

## Goal

Make multi-decade Observer simulations behave like a sustainable MMA world: fighters develop, peak, decline, retire, leave active rankings, and are replaced by recurring rookie classes and emergency prospects. Add a controlled Fighter Editor without allowing edits that corrupt titles, records, contracts, archives, or scheduled competition.

## Scope

This feature consists of two bounded systems:

1. A career ecosystem covering progression, decline, retirement, prospect generation, roster maintenance, activity-aware rankings, and Hall of Fame induction.
2. A Fighter Detail editor for profile, physical, and performance values.

They share fighter validation and ranking refresh behavior but remain independently callable and testable. The feature must preserve archived fights, title lineage, historical prose, and existing save data.

## Current Problems

The initial world is the only source of fighters. The game has no retirement state or recurring fighter generation, so the original cohort remains responsible for every division indefinitely. Aging only weakly reduces cardio, speed, and chin; POT never declines; rankings preserve historical ELO without an inactivity exit; and Observer automation can renew champions and popular veterans indefinitely. Consequently, fighters can remain active and highly ranked into their fifties.

## Data Model

Each fighter gains persisted lifecycle metadata:

- `careerPhase`: `developing | prime | declining | retired`.
- `primeEndAge`: an integer from 30 through 34, derived once from stable fighter identity and career traits.
- `lastLifecycleYear`: the last season for which annual lifecycle processing completed.
- `retiredDate`: present only after retirement.
- `retirementReason`: a stable reason code, not localized prose.
- `hallOfFame`: optional induction metadata containing `inductedYear` and the frozen legacy score used for induction.

The existing computed OVR remains derived from attributes. No separate persisted OVR is introduced. Existing POT remains persisted but becomes age-aware.

Save migration increments the save version and supplies deterministic defaults. `primeEndAge` is derived from fighter ID, style, cardio, toughness, fight IQ, and existing injury history. Existing retired metadata is never inferred merely because an old-save fighter is currently old: migrated fighters enter a valid phase at the current season and begin normal lifecycle processing from that point, avoiding retroactive multi-year decline.

## Stable Lifecycle Timing

Annual lifecycle work runs at most once per fighter per calendar year. The result is independent of whether a user advances one day repeatedly or advances a large block of days.

All random-looking annual outcomes use a stable seed composed from fighter ID, season, and operation kind. Annual processing must not consume the global simulation RNG or depend on iteration order. Reprocessing the same fighter and year is idempotent because `lastLifecycleYear` prevents duplicate work.

Daily automation may check roster shortages, but generated prospect IDs and cooldown keys are stable by date, division, and generation purpose, preventing duplicate generation when repair paths run more than once.

## Career Phases and Prime

`primeEndAge` varies between 30 and 34. Style, cardio, toughness, fight IQ, and injury burden influence the derived age, with a stable ID-based tiebreaker. The value does not change after creation or migration.

Career phase derives from age and retirement state:

- Developing: before the main prime window.
- Prime: the final development years through `primeEndAge`.
- Declining: older than `primeEndAge` and still active.
- Retired: after retirement is finalized.

## Development

Before prime ends, annual progression is based on:

- Age and current career phase.
- Attribute headroom below POT.
- Fights and performance in the recent period.
- Wins and competitive outcomes.
- Inactivity.
- Injury burden.

Development favors style-relevant attributes through the existing fighter-rating priorities. Consistent activity and strong performance accelerate growth; inactivity and injury reduce it. Progression cannot raise computed OVR above POT.

During prime, progression becomes small. POT gradually converges toward OVR so projected upside stops remaining unrealistically high.

## Decline and POT Convergence

When a fighter passes `primeEndAge`, POT is set to computed OVR. From then onward, POT follows OVR after each annual decline.

Decline occurs in tiers:

1. Speed, cardio, and chin decline first.
2. Striking, wrestling, grappling, submissions, and defensive output decline as aging progresses.
3. Power, toughness, and fight IQ are preserved longer and decline more slowly.

The decline rate increases with age, accumulated injury burden, inactivity, and losing streaks. Attribute floors remain valid. The annual pass recomputes OVR and then sets POT equal to OVR for post-prime fighters.

## Retirement

Retirement eligibility begins at age 37. Its stable annual likelihood increases with:

- Age.
- Post-prime decline.
- Injury burden.
- Inactivity.
- Losing streaks and poor recent performance.

All fighters must retire no later than age 45. A fighter selected for retirement is finalized once and receives a stable reason code such as age, injuries, decline, or inactivity.

Retirement cleanup must:

- End the active contract.
- Remove the fighter from future events.
- Trigger existing tournament replacement, delay, or repair behavior rather than leaving an invalid bracket.
- Vacate an undisputed or interim title held by the fighter and synchronize champion flags.
- Clear an unused Grand Prix title-shot entitlement involving the fighter.
- Exclude the fighter from active roster, free-agent, matchmaking, inbox, signing, and ranking candidate lists.
- Preserve the fighter record, history, archived fights, title lineage, achievements, news, and social history.

Fighter Detail remains accessible from historical surfaces and displays retirement date, retirement age, and a localized description derived from the reason code. Retirement announcements are generated in the operation's fixed language; existing persisted prose remains unchanged.

## Rookie Classes

At the first annual lifecycle run for a season, the world creates one small rookie class. Recruits are 18–24 years old and begin as unsigned free agents.

Division allocation considers:

- Current signed depth.
- Available free-agent depth.
- Number of aging or likely-to-retire fighters.
- Existing scheduled and tournament demand.

Most recruits have ordinary starting OVR and moderate POT. High-potential prospects are rare. Generation reuses existing name, nationality, style, avatar, physical profile, and attribute-generation rules. Annual class generation uses stable season/division seeds and stable IDs so it cannot duplicate.

Observer AI decides whom to sign. Rookies do not bypass contracts or appear directly on the promotion roster.

## Emergency Prospects and Observer Roster Policy

Daily roster maintenance checks each division. If signed depth is below the operational minimum and the free-agent pool lacks enough eligible candidates, the game creates only the number of prospects required to restore the pool. Emergency generation has a division/date purpose key and cooldown, preventing repeated population bursts.

Observer signing ranks candidates using a combined evaluation of age, POT, OVR, popularity, requested compensation, and division need. This replaces popularity-only selection when maintaining depth.

Renewal policy accounts for career phase, age, recent performance, activity, compensation, and roster alternatives. A former champion or popular veteran is not renewed indefinitely solely because of historic status or ELO.

## Activity-Aware Rankings

Stored `rankingScore` remains the historical competitive rating and continues to update through fight results. Inactivity does not destructively rewrite ELO.

Ranking order uses an effective score combining ELO, recent form, and an inactivity penalty:

- No inactivity penalty during the first nine months after a fight.
- A progressively larger penalty after nine months.
- Removal from active rankings after eighteen months without a fight.
- A returning fighter becomes eligible after competing again but does not automatically recover the previous effective position.

Retired and unsigned fighters are excluded. Current champions remain anchored above contenders while they legally hold a title, with existing title-stall and vacancy rules responsible for unavailable champions.

The Rankings UI shows a localized inactivity or declining-career marker where relevant so movement remains understandable. Structured ELO and status values remain language-independent.

## Hall of Fame

Hall of Fame appears inside History & Stats rather than adding navigation.

At the first annual lifecycle run, the game evaluates retired fighters who have waited at least one full season and have not previously been inducted. A legacy score uses existing historical evidence:

- Undisputed and interim title reigns.
- Successful title defenses and unifications.
- Grand Prix championships and final appearances.
- Annual awards.
- Promotion record and winning streaks.
- Fight performance and major wins.
- Popularity and career milestones.

Every eligible fighter above the induction threshold enters that year's class; there is no annual numeric cap. `inductedYear` and the score at induction are frozen so future formula changes do not rewrite history. Retired fighters below the threshold remain available through archives and Fighter Detail but do not appear in Hall of Fame.

Induction generates localized news once per fighter. Re-running or loading the same season cannot duplicate an induction.

## Fighter Editor

Fighter Detail includes an `Edit Profile` action in both Manager and Observer modes. It opens an inline editor on the same page with Save and Cancel controls; no new route is introduced.

Editable fields:

- First name, last name, and nickname.
- Age and nationality.
- Weight class and style.
- Height, fight weight, and walk-around weight.
- Every combat and physical attribute.
- POT, popularity, morale, momentum, and fatigue.

Protected fields:

- Record and fight history.
- Contract and counter-offer state.
- Champion flags, title lineage, and title state.
- Injury and medical suspension.
- Ranking score.
- Retirement and Hall of Fame metadata.

The UI validates text boundaries and numeric domains. Physical values retain valid relationships. Attributes use existing valid bounds. Saving recomputes OVR through the existing rating helper. If entered POT is below OVR, POT is raised to OVR. For a fighter already past `primeEndAge`, POT is synchronized exactly to OVR.

Weight-class changes are blocked while the fighter holds an undisputed or interim title, is booked in a future event, participates in an active/planned Grand Prix, or owns a pending title-shot entitlement. The UI explains the blocking reason and preserves all edits until the user resolves or cancels them.

A single store action validates the complete edit at the trust boundary, applies the normalized fighter, synchronizes champion flags, and refreshes rankings. The store does not accept arbitrary patches for protected fields.

Editing age may change the displayed career phase, but it does not immediately run annual progression, decline, retirement, rookie generation, or Hall of Fame evaluation. Those occur during the next eligible lifecycle pass. This prevents a profile edit from unexpectedly triggering broad game-world mutations.

## Localization

All new UI, retirement reasons, ranking markers, news, rookie announcements, and Hall of Fame copy are added symmetrically to English and Vietnamese resources. Names and structured status codes remain unchanged. Each lifecycle or automation operation captures one language at entry and passes it through generated-prose children, preserving the established determinism boundary.

## Failure Handling and Invariants

Lifecycle operations must preserve these invariants:

- No active fighter is older than 45 after annual processing.
- Retired fighters cannot hold contracts, titles, pending bookings, tournament slots, title-shot debt, or active ranking positions.
- Active title and tournament structures remain internally valid after cleanup.
- OVR is derived only from attributes.
- POT is never below OVR and equals OVR after prime.
- Each fighter receives at most one lifecycle pass per year.
- Rookie and emergency prospect IDs do not duplicate.
- Each Hall of Fame induction occurs once.
- Translation does not alter seeds, branches, generated identities, ranking values, or lifecycle outcomes.

If a retirement cleanup cannot immediately replace a tournament fighter, existing tournament delay/repair behavior is used. The system must not silently delete historical entities or fabricate fight results.

## Testing

Add small assert-based checks for:

- Stable prime-end derivation between 30 and 34.
- Development based on age, activity, performance, headroom, and injury.
- Prime POT convergence and post-prime `POT === OVR`.
- Tiered decline and age-45 mandatory retirement.
- Idempotent annual processing and equivalent outcomes for daily versus block advancement.
- Champion retirement, title vacancy, event cleanup, tournament repair, and title-shot cleanup.
- Annual rookie class uniqueness and balanced division allocation.
- Emergency generation producing only required depth and respecting cooldown.
- Observer signing and renewal considering lifecycle value rather than popularity alone.
- Nine-month ranking penalty, eighteen-month exclusion, and return eligibility.
- Hall of Fame waiting period, threshold, frozen score, and no duplicate induction.
- Editor field validation, protected-field safety, POT normalization, post-prime normalization, and blocked weight-class changes.
- Save migration from the previous version without retroactive multi-year processing.
- English/Vietnamese prose differing while structured outcomes remain equal.

Run all existing gameplay, tournament, management, calendar, navigation, i18n, long-simulation, lint, and build checks. Add a 20–30 year Observer acceptance simulation verifying sustainable division depth, recurring cohorts, plausible age distribution, no active fighter over 45, no retired/inactive ranking entries, and valid titles/tournaments. Browser verification covers the Fighter Editor, retirement presentation, Rankings markers, and Hall of Fame on desktop and mobile in both languages.

## Explicitly Excluded

- Exact birthdays or daily biological aging.
- Coaches, gyms, scouting budgets, or training-camp allocation systems.
- User-edited records, contracts, injuries, suspensions, titles, ELO, retirement, or Hall of Fame state.
- Deleting retired fighters or rewriting historical archives.
- A separate Hall of Fame route or induction ceremony UI.
- Cloud persistence, multiplayer, or server-side simulation.
