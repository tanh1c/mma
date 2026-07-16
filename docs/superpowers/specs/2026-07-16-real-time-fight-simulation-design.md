# Real-Time Fight Simulation Design

## Goal

Replace the commentary-only fight replay with a deterministic real-time simulation. Two animated fighter avatars face each other while live Condition (HP), Stamina, round clock, position, actions, commentary, and statistics update from the same ticks that determine the result.

The user watches and controls playback speed only. There are no player-selected attacks or between-round tactics.

## Product Decisions

- Simulation mode: direct tick-based simulation, not replay of a precomputed result.
- Presentation: existing fighter portraits animated with CSS; no sprite or art dependency.
- Default duration: approximately 2–3 minutes per bout at x1.
- Playback controls: pause/resume, x1, x2, x4, and skip to result.
- Condition represents overall ability to continue, not literal blood or localized health.
- Condition reaching 0 always ends the bout by `KO/TKO`.
- Submission may end a bout before Condition reaches 0.
- Stamina affects offense, defense, takedowns, submissions, and recovery.
- Playback speed must not change the timeline or result.
- In-progress sessions are temporary and are not added to the save format.

## Architecture

### One authoritative simulator

Refactor the current simulator into a pure session API used by both live and quick simulation:

```ts
createFightSession(matchup, red, blue, seed): FightSession
stepFightSession(session): FightSession
runFightSession(session): FightSession
fightSessionToResult(session): FightResult
```

`stepFightSession` advances exactly one simulated action interval. `runFightSession` repeatedly steps until completion. The existing `simulateFight` remains the public compatibility wrapper and returns `fightSessionToResult(runFightSession(createFightSession(...)))`.

This ensures manual live bouts, quick simulation, Observer automation, tournaments, tests, and debug simulations share one balance model.

### Determinism

`FightSession` owns serializable RNG state. A tick consumes RNG in a fixed order independent of rendering and wall-clock timing. Pause consumes no RNG. x1/x2/x4 only alter timer cadence. Skip runs the remaining ticks without animation.

### State boundary

The active fight session lives in Zustand's existing `ActiveSimulation` state. It is temporary UI state and is not persisted by save/export. No save migration is required.

A completed session is converted to the existing `FightResult`. Existing application paths then remain authoritative for applying records, contracts, fatigue, title changes, tournament progression, rankings, archives, social content, and event finances.

## Fight Session Model

`FightSession` contains only simulation state:

- matchup and fighter identifiers
- deterministic RNG state
- current round and remaining round seconds
- maximum rounds
- phase: `pre-fight`, `fighting`, `between-rounds`, or `finished`
- position: `distance`, `clinch`, or `ground`
- red and blue combat state
- accumulated round statistics and judge scores
- structured timeline events and generated commentary
- winner, loser, method, finish round, and finish time when complete

Each fighter's combat state contains:

- Condition, clamped to `0–100`
- Stamina, clamped to `0–100`
- accumulated head, body, and leg damage used internally
- cut severity
- knockdowns and control state
- pre-fight modifiers derived from camp, age, physical ratings, morale, momentum, fatigue, injury, weight cut, style, and seeded night variance

Internal localized damage remains available for action resolution, doctor stoppage, and commentary even though the primary UI exposes one Condition meter.

## Structured Tick Events

Each tick emits one `FightTimelineEvent` with:

- stable sequence number
- round and clock
- event type
- acting and target corner when applicable
- position before and after
- Condition and Stamina deltas
- short headline and commentary text
- presentation intensity

Required event types are:

- `round-start`
- `strike`
- `takedown`
- `clinch`
- `position-change`
- `submission-attempt`
- `knockdown`
- `recovery`
- `round-end`
- `finish`

The UI derives animation from event type and actor; it does not parse commentary strings.

## Tick Resolution

Each tick represents approximately 5–10 seconds of fight time and follows a fixed pipeline:

1. Determine initiative from speed, fight IQ, current Stamina, position, and modifiers.
2. Select an action family from style, attributes, position, accumulated damage, and Stamina.
3. Resolve offense against relevant defense and generate statistics.
4. Apply Stamina cost and Condition/local damage where applicable.
5. Resolve position transitions, control, knockdowns, and submission attempts.
6. If Condition reaches 0, finish immediately by `KO/TKO`.
7. Otherwise, resolve eligible submission or doctor stoppage outcomes.
8. Decrease the round clock and process the round boundary if required.

### Condition

Condition starts at 100. Damage is moderated by chin, toughness, defense, position, and current Stamina. Stamina depletion makes defense less effective, increasing later Condition loss.

Condition can recover only slightly between rounds. It cannot recover from 0 because the bout has already ended.

### Stamina

Stamina starts from cardio, weight-cut, fatigue, injury, camp, and physical modifiers. Every meaningful action costs Stamina. Low Stamina reduces accuracy, defensive reactions, takedown success, submission pressure, and recovery. Between rounds, Stamina recovers based on cardio and accumulated body damage.

### Finishes and decisions

- Condition `<= 0`: mandatory `KO/TKO` for the opponent.
- Submission: may occur from a valid ground/clinch submission attempt before Condition reaches 0.
- Doctor stoppage: may occur from severe cut/local damage while Condition remains above 0.
- Decision: generated from completed round scores after the final bell.
- Draw: remains possible through judge scores.

The resulting method must continue to use existing `FightResult` method values.

## Store Lifecycle

### Start

`simulateNextFightPreview` is replaced or narrowed to create a live session for the current bout. Starting twice while a session exists is idempotent.

### Advance

A store action advances exactly one tick. It refuses to advance a paused or finished session. React owns the wall-clock timer and cleans it up on pause, bout change, unmount, and completion.

### Playback

- x1: default tick interval chosen to produce a typical 2–3 minute bout.
- x2 and x4: shorter wall-clock intervals only.
- Pause: no ticks or RNG consumption.
- Skip: run the current session synchronously to completion and expose the final state.

### Confirm

After the finish presentation, confirmation converts the session to `FightResult` and passes it through the existing `applyFightResult` flow. The next bout starts idle. Completing the final bout retains the existing event finalization behavior.

Refreshing before confirmation returns to the pre-fight state because the temporary session is not persisted and no fight result has been applied.

## Fight Stage UI

### Primary layout

Replace separate corner cards and commentary-first replay with one fight stage:

- compact event/bout header
- current round and `m:ss` clock centered above the stage
- red fighter on the left and blue fighter on the right
- large existing `FighterAvatar` portraits facing inward
- rank, name, record, and corner identity near each fighter
- labeled Condition and Stamina meters for both corners
- central position label: `DISTANCE`, `CLINCH`, or `GROUND`
- current action headline between the fighters
- controls directly below the stage
- live commentary feed and live round statistics below or alongside the stage

Desktop uses a horizontal versus layout. Mobile preserves the opposing layout with smaller portraits and meters; commentary and statistics move below. The page must not introduce horizontal document overflow at 390px.

### Avatar animation

Animation is derived from the latest structured event:

- strike: attacker advances; target flashes and recoils
- takedown: fighters converge; target shifts down
- clinch: both move toward center
- ground/position change: both lower and offset
- submission attempt: controlled pulse/tension effect
- knockdown: target tilts/drops and stage flashes
- recovery/round break: fighters return toward corners
- finish: loser remains down/recoiled; winner receives emphasis

Use CSS transforms, opacity, filters, and short keyframes only. Do not add an animation or graphics dependency. With `prefers-reduced-motion: reduce`, replace movement with color/border state changes.

### Controls and result

Controls are real buttons with visible selected speed and disabled states where appropriate:

- Pause / Resume
- x1
- x2
- x4
- Skip to result

On completion, show a winner overlay with method, round, and time, then the existing confirm/next-fight action. Controls must prevent duplicate confirmation.

### Accessibility

- Condition and Stamina use `role="meter"`, stable accessible names, and current/min/max values.
- Current round and clock are readable without relying on color.
- The latest action uses `aria-live="polite"`; the full commentary history is not repeatedly announced.
- Red and blue identities include text, not color alone.
- All controls are keyboard reachable and retain visible focus.
- Reduced-motion behavior is mandatory.

## Compatibility

The final `FightResult` must retain:

- winner and loser IDs
- method, round, and time
- commentary
- performance rating
- scorecards
- round statistics
- injuries and medical suspensions
- popularity, morale, and momentum deltas
- title-change metadata added by existing downstream logic

No changes are required to event, archive, tournament, ranking, finance, title, social-feed, or save schemas unless implementation proves an existing type cannot represent a required final result. Temporary session types must not be added to `GameState` persistence.

## Validation and Safety

Session creation returns no session for a missing matchup/fighter or an already completed fight. Tick state is clamped and validated at its pure function boundary:

- Condition and Stamina stay within `0–100`
- round and clock never move outside legal bounds
- accumulated statistics never become negative
- a finished session cannot advance again
- a session cannot apply its result more than once

Timer cleanup prevents stale ticks from advancing the next bout.

## Testing

### Pure engine contracts

Add runnable assert-based tests covering:

- same seed and matchup produce the same timeline and result
- x1/x2/x4/skip execute the same number/order of simulation ticks and produce the same result
- every tick preserves Condition, Stamina, clock, round, and statistic invariants
- Condition reaching 0 always creates a `KO/TKO` finish
- submission can finish while the loser has positive Condition
- a finished session is idempotent
- conversion produces a complete existing `FightResult`

### Regression and balance

Run existing fight, tournament, long-simulation, management, ranking, and event-finalization tests. Extend statistical benchmarks enough to detect major regressions in:

- favorite versus underdog win rates
- striker, wrestler, and grappler matchup behavior
- KO/TKO, submission, and decision distribution
- three-round versus five-round duration
- age, cardio, weight-cut, camp, injury, fatigue, morale, and physical-rating effects

Exact historical random sequences do not need preservation, but established gameplay advantages and plausible method distributions must remain.

### UI contracts and browser verification

Add source/UI contracts for meters, playback controls, reduced motion, accessible live status, and mobile layout. In the browser, verify:

- one decision, one KO/TKO, and one submission path
- pause/resume does not advance while paused
- x1/x2/x4 affect cadence but not a seeded result
- skip reaches the same result
- live meters, clock, position, commentary, and stats update
- confirmation applies exactly once and advances the event
- 390×844 portrait, short mobile landscape, and desktop have no page-level overflow

## Explicitly Excluded

- direct player attack controls
- between-round tactical choices
- full-body sprites or new fighter art
- audio, commentary voice, blood, or gore
- persisted mid-bout sessions
- multiplayer or network synchronization
- replacing existing post-fight detail and archive pages

These can be reconsidered only after the deterministic live simulator and its balance are stable.