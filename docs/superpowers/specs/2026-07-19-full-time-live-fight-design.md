# Full-Time Live Fight Design

## Goal

Turn live fight playback into a continuous, deterministic simulation where a five-minute round takes five real minutes at x1 and every visible action is a real gameplay event. Movement, strikes, defense, clinch work, takedowns, ground actions, submissions, recovery, and finishes must connect with almost no meaningless idle gap.

This design supersedes the compressed 2–3 minute bout target and 5–10 simulated-second tick model in `2026-07-16-real-time-fight-simulation-design.md`. It retains that design's pure session API and result compatibility. The sprite manifest and mapping contract in `2026-07-19-live-fight-sprite-stage-design.md` remain authoritative.

## Product Decisions

- x1 uses a 1:1 fight clock: a complete round lasts 300 real seconds.
- x2 and x4 accelerate the fight clock, event cadence, and sprite playback together.
- Between rounds, playback stops until the user presses **Continue round**.
- Action density is high: movement, attacks, and defensive reactions connect continuously with very little neutral idle.
- Every visible fighter action belongs to a deterministic micro-event and consumes fight time.
- Every action affects gameplay where applicable; there is no decorative strike choreography layered over unrelated mechanics.
- Balance is recalibrated for realistic action volume and outcomes rather than preserving winners or methods from old seeds.
- The commentary feed shows highlights only, while all micro-events remain available to the active simulator and live statistics.
- Use the existing 51 sprite sheets. Add no assets, audio, animation framework, or dependency.

## Architecture

### One authoritative micro-event engine

Keep the existing pure API:

```ts
createFightSession(matchup, red, blue, seed): FightSession
stepFightSession(session): FightSession
runFightSession(session): FightSession
fightSessionToResult(session): FightResult
```

Change `stepFightSession` from resolving one representative 5–10 second interval to resolving one concrete action with an explicit duration. `runFightSession` repeatedly executes the same micro-event steps without wall-clock delays. Watching, changing speed, pausing, or skipping must not alter RNG consumption or the final result.

React controls when the next step is requested. The engine never reads browser time, starts timers, or depends on animation completion.

### Millisecond fight clock

`FightSession` stores remaining round time in integer milliseconds. Each event records:

```ts
interface FightTimelineEvent {
  sequence: number;
  round: number;
  clockBeforeMs: number;
  clockAfterMs: number;
  durationMs: number;
  // existing actor, target, mechanics, prose, and visual fields
}
```

Fight-clock micro-actions have a positive `durationMs`. Round-start, round-end, between-round recovery, and finish markers use `durationMs: 0`; they record state boundaries but do not consume fight time or schedule an automatic playback delay. The final positive-duration action in a round is clamped to the remaining clock so `clockAfterMs` reaches exactly zero. Across a completed round, positive fight-clock event durations total exactly `300_000ms`.

The engine applies the event's final gameplay state atomically when creating it. When the store replaces the authoritative session, it also captures a lightweight immutable playback snapshot of the prior clock, Condition, Stamina, and current-round statistics. Presentation derives the current frame from that snapshot, the resolved event deltas, and normalized event progress; it never mutates simulation state per frame. The snapshot is temporary active-simulation state, not timeline or save data.

### Separation of active timeline and public highlights

The active session contains the detailed micro-event timeline needed for live playback, deterministic checks, and current-round statistics. Each event has a presentation importance such as `routine`, `notable`, or `key`.

The live commentary feed and archived play-by-play include only notable and key events: clean significant strikes, combinations, takedowns, meaningful transitions, dangerous submissions, knockdowns, finishes, and round boundaries. Routine footwork, probing misses, blocks, and dodges still exist and affect clock, stamina, initiative, and statistics, but do not flood the feed.

The completed `FightResult` keeps aggregate statistics and at most 12 filtered highlights per round, prioritizing key events before notable events. It never persists routine micro-events or the detailed active timeline. This fixed per-round cap bounds commentary growth to 36 highlights for a three-round bout or 60 for a five-round bout. Active sessions remain temporary Zustand state and are not added to save/export schemas. Navigating within the running application preserves the active event; refreshing the application returns to the pre-fight state as before.

## Micro-Event Model

### Action families

Every event belongs to one valid family for the current position:

- Distance: neutral movement, walk forward, walk backward, jab, cross, hook, body hook, low kick, body kick, high kick, and defensive reactions.
- Clinch: clinch pressure, body hook, knee, elbow, disengagement, takedown, takedown defense, and sprawl.
- Ground: stable control, ground-and-pound, submission attempt, escape/reversal, transition to clinch, and stand-up.
- Round and finish: round start, round end, between-round recovery, knockdown, KO/TKO, doctor stoppage, submission finish, decision, and draw.

Illegal combinations are impossible at selection time: no standing kick on the ground, no submission at distance, no low block against a head strike, and no get-up without a ground-to-distance transition.

### Event duration

Each action family has a bounded fight-time duration selected deterministically from action context. Expected ranges are:

- punch or defensive reaction: 350–700ms
- kick, knee, or elbow exchange: 500–900ms
- footwork or neutral pressure: 600–1,500ms
- clinch entry or disengagement: 700–1,400ms
- takedown, defense, or sprawl: 900–1,800ms
- ground-and-pound exchange: 600–1,200ms
- ground control or submission sequence: 1,000–2,500ms
- knockdown or positional recovery: 1,200–2,500ms

These durations describe fight-clock time at x1. The renderer scales the selected sprite animation to the event window rather than reverting to idle after the manifest's short native strip duration.

### Continuous action selection

Action selection uses only session state and seeded RNG. Its inputs include:

- position and recent action history
- fighter style and striking, wrestling, grappling, submission, speed, power, defense, chin, cardio, toughness, and fight IQ attributes
- current stamina, condition, localized damage, cut severity, momentum, and control state
- target zone, pressure, and prior success or failure

Styles bias rather than hard-lock choices:

- Boxers favor hand combinations, defensive movement, and distance control.
- Kickboxers and Muay Thai fighters use more kicks, knees, elbows, and mixed combinations.
- Wrestlers and Sambo fighters close distance and pursue takedowns more often.
- BJJ fighters seek valid ground transitions and submissions.

A short recent-action window applies a soft repetition penalty. It reduces identical consecutive actions without quotas or impossible bans. Fatigue increases slower control and movement actions, lowers long-combination frequency, and weakens offense and defense.

### Real gameplay resolution

Every visible action is resolved by the engine:

- Strike attempts update attempted statistics and stamina.
- Landed strikes update landed statistics, localized damage, condition, and finish pressure.
- Blocks and dodges are genuine resolved outcomes and update the attempt without landed damage.
- Movement consumes time and small stamina, and changes pressure or position context used by the next action.
- Clinch, takedown, defense, sprawl, reversal, and stand-up events change position only when mechanically successful.
- Ground control consumes time and contributes control statistics.
- Submission attempts can be escaped or finish only from a valid position.
- Knockdowns enter ground state; get-up occurs only through a later successful ground-to-distance event.

Ordinary micro-strikes deal less damage and cost less stamina than the old aggregate tick. Accuracy, damage, stamina cost, finish thresholds, and recovery are recalibrated together so realistic action volume does not cause every bout to end immediately.

Balance targets are distributions, not hard per-fight quotas. A completed three-round distance-heavy bout should commonly produce roughly 100–250 strike attempts per fighter, with lower totals when clinch and ground control dominate.

## Playback and UI

### Event playback

When a micro-event is created:

1. The engine returns a session containing the event and its resolved final state.
2. `FightBattle` anchors local playback to the event identity and remaining wall-clock duration.
3. `FightSpriteStage` maps the event to fighter/effect sprites and plays them for `durationMs / playbackSpeed`.
4. The visible clock interpolates from `clockBeforeMs` to `clockAfterMs` with one local `requestAnimationFrame` loop.
5. At event completion, React calls `stepFightSession` exactly once.

There is no fixed 1,400ms timer. Event duration is the cadence.

### Sprite timing

The manifest remains the source of frame count, pairing, pivots, offsets, impact frames, looping, and mirroring. Presentation scales one complete source cycle to fit the event window. A one-shot action cannot finish early and sit idle for the rest of the event.

For event windows longer than a one-shot strip:

- use an explicit contextual follow-up stance when supplied; or
- hold the final frame until event completion.

Looping neutral, clinch-idle, and ground-position actions may loop through their full event window. The next event always replaces the previous animation by event sequence.

### Pause and speed changes

Pause freezes all three clocks together:

- no engine step
- no visible clock interpolation
- no CSS sprite progression

The local playback controller tracks accumulated fight progress, not a mutable timeout deadline. While running, it accumulates `elapsedFightMs += elapsedWallMs * previousSpeed`. Paused wall time contributes zero. Event progress is `clamp(elapsedFightMs / durationMs, 0, 1)` and is retained on pause, so resume continues the same event instead of restarting it.

Changing x1/x2/x4 first accounts for elapsed time at the previous speed, then uses `remainingWallMs = (durationMs - elapsedFightMs) / newSpeed`. The same normalized progress drives both visible clock interpolation and sprite progression. A sequence-scoped completion guard permits exactly one next-step call. Changing speed does not recreate the event, restart the sprite, consume RNG, duplicate statistics, or skip the impact.

### Between-round gate

When the clock reaches zero:

1. The engine records the round score and enters `between-rounds`.
2. The UI stops automatic stepping and displays the completed round statistics and highlights.
3. A **Continue round** button calls `stepFightSession` once to apply deterministic between-round recovery and create the next round at `5:00`.
4. `ActiveSimulation` stores a consumed round-gate token derived from the completed round number. The handler accepts that token once, disables immediately, and ignores repeated clicks for the same gate.

Idempotence belongs to the UI/store handler, not to arbitrary repeated calls of the pure step function: after the first valid transition, another `stepFightSession` would correctly resolve the next fighting action. There is no automatic 60-second wait and no tactical choice in this scope.

### Skip and finish

Skip repeatedly calls the same `stepFightSession` logic from the current resolved session until the fight finishes. It bypasses wall-clock playback only. The same seed and starting session must produce identical winner, method, finish time, statistics, RNG state, and micro-event sequence whether watched at any speed or skipped.

Finish poses hold beneath the existing result overlay until confirmation. Confirmation continues to convert the session once through the existing `FightResult` application path.

## Presentation Failure and Reduced Motion

Asset failures never affect simulation, timers, or results. Invalid manifest or image loading falls back to the existing fighter-avatar stage while the same micro-event cadence continues.

Under `prefers-reduced-motion: reduce`, the event still consumes its full real-time duration and updates the textual state, meters, and clock. The renderer displays representative or held frames without rapid strip movement. Controls remain semantic keyboard-accessible buttons, meters retain accessible values and labels, and the latest notable headline remains in an `aria-live="polite"` region.

## Performance

- Use one local `requestAnimationFrame` callback for visible clock interpolation; do not write Zustand state every frame.
- Render only the current event's fighter pair and effect.
- Keep manifest and image caching unchanged.
- Keep simulation pure and synchronous; a few hundred events per bout must remain fast enough for skip.
- Do not introduce workers, queues, animation libraries, or persisted timeline caches unless measured browser performance later requires them.

## Testing

### Engine contracts

- Same input and seed produce identical micro-events, durations, RNG state, statistics, winner, method, and finish time.
- Every fight-clock micro-action has a positive integer duration; boundary/finish markers have zero duration; all events preserve legal clock bounds.
- Positive fight-clock event durations in each completed round sum to exactly `300_000ms`.
- Every action and outcome is valid for its position and target zone.
- Every visible strike, defense, transition, and interaction corresponds to resolved gameplay data.
- Condition, stamina, damage, control time, and statistics remain internally consistent.
- Finished sessions are idempotent, and the store consumes each between-round gate token at most once.
- Watched stepping and skip produce identical final sessions.
- Completed results persist no routine micro-events and no more than 12 highlights per round.

### Balance contracts

Run deterministic multi-seed samples across styles, attributes, and three/five-round matchups. Assert broad bounds for:

- attempts and landed strikes per fighter
- accuracy and significant-strike proportions
- distance, clinch, and ground time
- takedown attempts and success
- action repetition runs
- stamina depletion by round
- KO/TKO, submission, doctor stoppage, decision, and draw rates
- favorite/underdog and style matchup influence

Use broad regression ranges rather than exact quotas. Exact snapshots from the aggregate-tick engine are intentionally replaced.

### Renderer and store contracts

- Event duration controls both simulation cadence and sprite playback.
- One-shot sprites fill their event window through scaling, follow-up, or held frame.
- Pause preserves current event progress and consumes no RNG.
- Mid-event speed changes neither restart nor complete the event twice.
- The visible clock interpolates without per-frame store writes.
- Round zero enters a manual gate; recovery occurs only after **Continue round**.
- Asset failure uses fallback without changing session evolution.
- x1/x2/x4 and skip retain final-session equality.

### Browser verification

Observe at least one full round at x1 and verify:

- the round lasts five real minutes within normal timer tolerance
- action animation remains continuous with no long unintended idle gaps
- visible actions match position, reaction, headline, and statistics
- distance, clinch, takedown, ground, and recovery sequences connect coherently
- pause/resume freezes and continues the same event
- x2/x4 changes current-event pacing without restart
- the round stops at `0:00` until **Continue round** is pressed
- a finish holds the correct pose and overlay
- forced asset failure keeps the fight clock and result working

## Explicitly Excluded

- new sprites, effects, audio, blood, camera systems, or dependencies
- direct player attack controls or between-round tactical decisions
- frame-by-frame physics or collision simulation
- decorative attacks that do not belong to gameplay events
- preserving old per-seed winners, methods, timeline hashes, or aggregate-tick balance
- persisting active micro-event sessions in save/export
- redesigning pages outside the live fight stage, clock, commentary filtering, and between-round gate
