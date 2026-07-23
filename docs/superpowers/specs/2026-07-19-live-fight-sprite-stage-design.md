# Live Fight Sprite Stage Design

## Goal

Replace the portrait-based live fight visualization with a shared pixel-art stage driven by the complete `public/sprites` bundle. Every supplied animation and effect must have a valid contextual mapping, while fight outcomes, deterministic simulation, skip equivalence, controls, localization, accessibility, and responsive behavior remain unchanged.

“Use all animations” means every manifest action has a reachable mapping when its situation occurs. A single fight is not required to display all 51 actions.

## Existing Asset Contract

The sprite bundle is the runtime source of truth:

- Manifest: `public/sprites/fighter-sprites.json`
- Schema: `public/sprites/fighter-sprites.schema.json`
- QC report: `public/sprites/sprite-qc-report.json`
- Images: `public/sprites/fighters`, `public/sprites/interactions`, and `public/sprites/effects`

The bundle contains 51 horizontal RGBA sprite strips and 334 frames. All frames are 256×256 with pivot `(128, 228)`, are authored facing right, and can be mirrored for left-facing presentation. The manifest provides frame count, FPS, per-frame duration, loop behavior, hold-last behavior, pivot, impact frames, interaction partner, role-specific mirroring, and pair offsets.

The application must load asset behavior from the manifest rather than duplicate frame metadata in source. Semantic cue-to-animation IDs remain application code because they describe presentation policy rather than asset geometry.

## Architecture

### Simulation-owned visual cues

`FightTimelineEvent` gains an optional semantic `visual` field. The fight engine emits cues where it already knows the action and outcome; it does not expose PNG paths or manifest geometry.

The visual model supports:

- Action family: idle, movement, strike, defense, clinch, takedown, takedown defense, sprawl, ground fighting, submission, knockdown, recovery, and finish.
- Strike subtype: jab, cross, hook, body hook, low kick, body kick, high kick, knee, and elbow.
- Outcome: landed, missed, blocked, dodged, failed, escaped, or finished.
- Target zone: head, body, or leg.
- Presentation intensity: light or heavy.
- Finish context sufficient to distinguish KO, TKO, submission, and decision presentation.

The engine derives cue fields from action-local values that the simulation already computed. Cue creation must not call `random`, `rand`, `randInt`, or otherwise advance `session.rngState`.

Strike variety that is not already mechanically selected uses a pure deterministic selector based on stable event inputs such as the fight seed, sequence, actor, round, position, target zone, and style. The selector does not mutate simulation state. The selected strike must be compatible with context:

- Ground strikes use ground-and-pound, not standing strikes.
- Leg targets can select low kick but not head-only attacks.
- Clinch context can select knees and elbows.
- Distance context can select punches and kicks.
- Style biases distribution without changing damage or action success.

The cue is part of the deterministic timeline. Same inputs and seed must produce an identical full session including cue metadata.

### Presentation-owned animation mapping

A dedicated sprite mapping module converts `FightVisualCue` plus event/session context into semantic animation IDs for the red fighter, blue fighter, and optional effect. It contains no timers, React state, asset geometry, or game-result logic.

The mapping result identifies either:

- Two independent fighter animations; or
- A synchronized interaction pair; and
- An optional effect animation and placement zone.

Animation IDs must be validated against the manifest in tests. Engine code does not contain asset paths, and the renderer does not infer behavior from localized headline/commentary strings.

### Manifest-driven renderer

A dedicated `FightSpriteStage` component owns presentation only:

- Fetch and cache `/sprites/fighter-sprites.json` once per application session.
- Resolve manifest image paths under `/sprites/`.
- Render two 256×256 sprite canvases on one shared stage.
- Drive horizontal frame strips using manifest frame count and FPS.
- Use one event sequence key and one clock for synchronized pairs.
- Apply manifest pivot, interaction offset, partner, mirror, loop, impact frames, and hold-last data.
- Render effects at the action’s impact frame and at the appropriate contact/head/body/leg position.
- Keep frame counters, loaded-image state, and manifest cache outside `GameState` and save data.

Asset-loading failure must not block or alter simulation. If the manifest or required image cannot load, `FightBattle` falls back to the current portrait/CSS visualization while all controls and result confirmation continue working.

## Visual Cue Generation

### Strikes

`applyStrike` retains its current success, damage, condition, stamina, knockdown, prose, and RNG behavior. After those values exist, it adds visual metadata:

- A contextual strike subtype.
- Head/body/leg target zone from the action’s existing target shares.
- Landed versus missed outcome.
- Blocked or dodged classification for misses, derived deterministically from existing context without another RNG draw.
- Light or heavy intensity from existing significant/damage values.

A strike that becomes a knockdown retains its strike subtype for the attacker and marks knockdown response/effect for the defender.

### Takedowns and clinch

Successful takedowns emit a takedown cue. Failed takedown attempts no longer become visually indistinguishable from ordinary clinch entries: the event carries a failed takedown cue that deterministically selects takedown-defense or sprawl based on stable context. Existing event mechanics, position changes, prose, stats, and RNG consumption remain unchanged.

Ordinary clinch entry and ongoing clinch position remain distinct visual contexts.

### Ground fighting

Strikes from ground position map to synchronized ground-and-pound. Ground idle maps to the top/bottom ground-position pair. Transition from ground back to distance maps to stand-up-from-ground.

### Submissions

Submission attempts emit attempt cues. Escaped attempts return to the ground-position pair. Submission finishes map the attacker to submission-finish and the defender to tap-out. Submission visuals remain distinct from KO and zero-condition presentation.

### Knockdown and recovery

A non-final knockdown maps the defender to knockdown. A later recovery maps to get-up. Heavy non-knockdown damage may map the defender to stunned. Ordinary landed damage maps to hurt.

### Finish

- KO: winner victory, loser KO, KO effect.
- TKO: winner victory, loser TKO cover.
- Submission: attacker submission finish, defender tap-out.
- Doctor stoppage: winner victory, loser TKO cover.
- Decision: winner victory, loser defeat.
- Draw: both fighters hold defeat poses.

Finish animations respect manifest `holdLast` and stay visible until the player confirms the result.

## Complete Animation Coverage

### Fighter and movement animations

- `fighter-idle`: neutral distance state and round start.
- `fighter-walk-forward`: visual transition when closing distance.
- `fighter-walk-backward`: visual transition after disengagement or retreat.
- `fighter-block-high`: defended head/body strikes.
- `fighter-block-low`: defended leg strikes.
- `fighter-dodge`: evaded strikes.
- `fighter-hurt`: normal landed-strike response.
- `fighter-stunned`: heavy damage without knockdown.
- All nine standing strike animations map from their matching subtype.
- `fighter-knockdown`: non-final knockdown.
- `fighter-get-up`: recovery from non-final knockdown.
- `fighter-ko`: KO loser pose.
- `fighter-tko-cover`: TKO loser pose.
- `fighter-victory`: KO/TKO/decision winner pose.
- `fighter-defeat`: decision loser pose.
- `fighter-stand-up-from-ground`: ground-to-distance transition.
- `fighter-tap-out`: submission loser pose.

### Synchronized interactions

- Clinch entry and clinch idle pairs map to entering and holding clinch.
- Takedown pair maps to successful takedown.
- Takedown-defense and sprawl pairs map to failed takedowns.
- Ground-position pair maps to stable ground control.
- Ground-and-pound pair maps to ground strikes.
- Submission-attempt pair maps to submission attempts.
- Submission-finish attacker plus tap-out defender maps to submission finishes.

Pairs use the manifest’s `syncPartner`, `interactionOffset`, `role`, and `mirrorAtRuntime`; the renderer must not mirror or position the entire stage as a substitute.

### Effects

- `effect-light-hit`: ordinary landed punch/elbow/knee.
- `effect-heavy-hit`: heavy punch/elbow/knee.
- `effect-kick-impact`: landed kick.
- `effect-block`: blocked strike.
- `effect-knockdown`: knockdown impact.
- `effect-ko`: KO finish.
- `effect-sweat`: high-fatigue or heavy-exertion transition.
- `effect-dust`: forward/backward movement, takedown, sprawl, or stand-up transition.

Effects trigger from manifest `impactFrames`. They do not affect simulation timing or outcomes.

## FightBattle Stage

The current separate portrait visualization is replaced by a single shared stage while the information and control hierarchy remains intact.

- Red fighter stands on the left and faces right.
- Blue fighter stands on the right and faces left through manifest-supported mirroring.
- Both use one ground plane and shared contact coordinate system.
- Names, corner labels, Condition, and Stamina remain visible and associated with the correct fighter.
- Round, clock, position, headline, commentary, pause/resume, speed, skip, result overlay, and confirm behavior remain available.
- The stage is responsive, uses `overflow-hidden`, scales both fighter canvases uniformly, and creates no document-level horizontal overflow at mobile widths.
- Interaction pairs move fighters to manifest offsets; independent animations retain normal corner separation.
- Result overlay remains above the stage without removing held finish poses.

The existing `FighterAvatar`/CSS presentation remains a failure fallback, not a parallel duplicate stage.

## Playback Semantics

Simulation stepping remains owned by the existing Zustand actions. Sprite timers never call simulation functions.

- Pause freezes both simulation stepping and CSS/frame animation at the current frame.
- x1/x2/x4 applies the same multiplier to simulation cadence and sprite animation duration.
- The renderer completes or holds the currently selected animation according to manifest behavior; event identity is keyed by `event.sequence` so a cue restarts once, not on unrelated re-renders.
- Skip still calls `runFightSession` from the current deterministic session and immediately displays the final mapped pose/overlay.
- Confirm still converts only the finished session to the existing `FightResult` and advances the event.

The implementation must preserve the exact existing normal-run/skip equality contract.

## Reduced Motion and Accessibility

Under `prefers-reduced-motion: reduce`:

- Sprite frame animation is disabled.
- The stage updates to a representative or held frame for the current cue.
- The existing live headline remains in an `aria-live="polite"` region.
- Condition and Stamina retain semantic `role="meter"`, min/max/current values, and labels.
- All Begin, pause/resume, speed, skip, and confirm actions remain semantic keyboard-accessible buttons.
- Decorative sprite/effect layers are hidden from assistive technology; fighter identity and changing fight state remain available through existing text.

## Error Handling

Only external asset boundaries require fallback handling:

- Invalid or unavailable manifest: show current portrait/CSS stage.
- Missing or failed sprite image: fall back for the affected stage rather than interrupting gameplay.
- Unknown cue or missing animation ID: use `fighter-idle` for fighters and omit the effect.
- Invalid synchronized pair metadata: use independent safe fallback animations instead of rendering a misaligned pair.

No retry framework, new dependency, service worker, or persisted asset cache is required.

## Testing

### Deterministic engine tests

- Same seed produces identical timeline including visual cues.
- Adding cues does not change damage, condition, stamina, stats, winner, finish method, result, or final RNG state.
- Localized prose remains mechanically and visually equivalent.
- Normal run and skip remain exactly equal.
- Strike subtype coverage includes all nine standing attacks across deterministic scenarios.
- Missed/blocked/dodged, failed takedown, clinch, sprawl, ground strike, submission attempt/escape/finish, knockdown/recovery, and all finish mappings are covered.

### Manifest and mapping tests

- Every application animation ID exists in the manifest.
- Every one of the 51 manifest actions is reachable from a documented mapping.
- Every interaction pair has compatible frame count, FPS, partner, role, and offsets.
- Frame count, dimensions, FPS, loop, hold-last, pivot, impact frames, and image path are consumed from the manifest rather than duplicated.

### UI contracts

- FightBattle renders the sprite stage and preserves meters, live region, controls, result overlay, and fallback.
- Pause state freezes animation.
- x1/x2/x4 reaches the renderer as a duration multiplier.
- Reduced motion disables frame animation.
- Mobile stage uses constrained responsive classes and no document overflow.

### Runtime browser audit

At desktop and mobile viewports:

1. Begin a live fight.
2. Confirm clock, meters, commentary, and sprite cues advance.
3. Pause and verify the visible frame remains stable.
4. Resume at x1, x2, and x4 and confirm synchronized speed.
5. Observe standing strikes, defense, movement, clinch/ground interactions, and effects where deterministic test setup permits.
6. Skip and verify the correct held finish pose, result overlay, and unchanged result.
7. Confirm and verify event progression.
8. Exercise missing-asset fallback and reduced-motion behavior.
9. Assert no browser errors or horizontal overflow.

## Scope Boundaries

- No new dependency.
- No changes to fight balance, damage, winner selection, judging, rankings, finances, or archive format.
- No save migration; live sessions and sprite state remain non-persisted UI state.
- No runtime palette swaps or fighter-specific skin, gear, or body variants because the bundle contains one generic fighter set.
- No audio system, camera shake framework, canvas/WebGL engine, or sprite editor.
- No requirement for one fight to display every animation.
