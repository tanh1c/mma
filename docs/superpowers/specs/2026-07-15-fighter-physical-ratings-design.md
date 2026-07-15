# Fighter Physical Profile and Ratings Design

## Goal

Add meaningful physical measurements and a coherent OVR/POT model to every fighter, lower the inflated ratings in newly generated worlds, and use the new values consistently in progression, fight simulation, matchmaking, contracts, tournaments, UI, and save migration.

## Scope

This change adds:

- Height in centimeters.
- Official fight weight in pounds.
- Walk-around weight in pounds.
- A dynamically derived overall rating (OVR).
- Potential (POT) as a real development ceiling.
- A lower, more differentiated skill distribution for newly generated fighters.
- Small, bounded physical and weight-cut effects in fight simulation.
- OVR-aware matchmaking, tournament tie-breaking, contracts, and scouting UI.

This change does not add reach, selectable weight-cut plans, missed weight, catchweight bouts, fight cancellation, nutrition staff, or a full weight-class-change system.

## Data model

Add these required fields to `Fighter`:

```ts
heightCm: number;
fightWeightLb: number;
walkAroundWeightLb: number;
```

Keep the existing serialized field:

```ts
potential: number;
```

`potential` is displayed as POT and becomes the fighter's true development ceiling. The field is not renamed, preserving existing saves and consumers.

OVR is never serialized. It is calculated from current attributes whenever needed, preventing stale ratings after training, aging, injury-related changes, or migration.

## Central ratings module

Create a focused fighter-ratings module that owns:

```ts
getFighterOverall(fighter: Fighter): number;
getWeightCutPercent(fighter: Fighter): number;
getPhysicalFightModifiers(fighter: Fighter): PhysicalFightModifiers;
canImproveFighter(fighter: Fighter): boolean;
```

`getFighterOverall()` returns an integer from 10 through 95. It uses all eleven fighter attributes and never includes popularity, record, ranking score, morale, momentum, fatigue, injury status, height, weight, or title status.

The formula uses a stable baseline weight for cardio, defense, fight IQ, chin, and toughness, plus modest style-specific weighting for the fighter's primary skills. Style weighting must not allow a one-dimensional specialist to receive an elite OVR solely from one or two attributes.

Every subsystem that currently computes an attribute sum or average to represent current ability must use this helper. Situation-specific fight calculations continue using individual attributes.

## OVR and POT semantics

OVR represents current fighting ability. POT represents the highest OVR a fighter can reach through normal development.

Rules:

- New fighters must be generated with `potential >= OVR`.
- Young-fighter development only occurs while OVR is below POT.
- Improvement probability and size decline as OVR approaches POT.
- A development update must not leave OVR above POT.
- POT does not decrease with age. It represents peak capability, not present form.
- Age-related attribute decline remains possible and naturally lowers OVR.
- Training camps obey the same POT ceiling.
- Existing saves with `potential < OVR` are migrated to `potential = OVR`.

Prospect classification should use age, POT, and remaining development room rather than popularity plus a fixed POT threshold. A fighter is a prospect when they are young, have meaningful `POT - OVR` headroom, and have sufficiently high POT.

## New-world ratings balance

Newly generated fighters target these OVR bands:

| Archetype | Target OVR | Typical POT |
|---|---:|---:|
| Can | 35–48 | 40–58 |
| Journeyman | 45–60 | 50–68 |
| Veteran | 55–72 | 55–74 |
| Prospect | 50–68 | 72–90 |
| Contender | 65–80 | 74–88 |
| Champion | 78–90 | 82–94 |

The generator should lower archetype base attributes and reduce excessive style spikes while retaining recognizable specialists. Individual attributes remain clamped to 10–95. Values above 90 should be rare and identify exceptional skills.

The generator may retry or minimally normalize generated attributes to place a fighter inside the intended broad archetype band. It must not flatten every fighter to the same OVR or erase style identity.

Existing saved fighters keep their current attributes. Migration does not rebalance or reduce them.

## Physical generation

Physical measurements are generated from a weight-class configuration. Values are plausible rather than medically exact.

Recommended ranges:

| Weight class | Height | Fight weight | Walk-around excess |
|---|---:|---:|---:|
| Bantamweight | 160–175 cm | 130–135 lb | 7–15% |
| Featherweight | 165–180 cm | 140–145 lb | 7–15% |
| Lightweight | 168–183 cm | 150–155 lb | 7–15% |
| Welterweight | 173–188 cm | 165–170 lb | 7–15% |
| Middleweight | 178–193 cm | 180–185 lb | 6–14% |
| Heavyweight | 183–205 cm | 225–265 lb | 3–10% |

`fightWeightLb` represents official bout weight and must fit the configured division range. `walkAroundWeightLb` must always be greater than `fightWeightLb`.

Generation uses the existing seeded PRNG. Save migration uses a stable hash derived from fighter identity and weight class rather than `Math.random()`, so repeatedly loading the same legacy save yields the same measurements.

## Fight simulation integration

OVR replaces local raw attribute totals only when the simulator needs a general-strength comparison, such as identifying the favorite or scaling mismatch-related upset logic. Individual exchanges continue to use the relevant technical attributes.

Physical effects remain secondary and bounded:

- Height gives a small striking and distance-management advantage against a shorter opponent in the same division.
- Greater walk-around mass gives a small power or grappling-strength advantage.
- A larger weight cut reduces effective cardio and slightly increases fatigue or bad-night risk.
- Excessive cuts never grant an unbounded size advantage.
- The combined physical modifier for a fighter is clamped to approximately `0.95–1.05`.

Height must not globally penalize grappling. Any leverage trade-off should be small and situation-specific. Skill, cardio, defense, fight IQ, readiness, and randomness remain more important than body measurements.

No fighter misses weight or has a bout canceled in this scope.

## Development, aging, and camps

Young-fighter progression is moved behind the central OVR/POT helpers:

- Fighters below age 28 may improve when healthy enough to train.
- Style-relevant attributes and weaker trainable attributes receive higher improvement chances.
- Improvement slows as `OVR / POT` approaches 1.
- Each update validates that the resulting OVR does not exceed POT; if it would, the increase is reduced or skipped.
- Camps use the same guarded improvement path rather than directly increasing attributes without checking POT.

Existing age decline remains:

- Speed and cardio decline after the existing age threshold.
- Chin decline remains for older fighters.
- Fight IQ may mature before decline.
- Decline is not blocked by POT because POT is an upper ceiling, not a lower floor.

## Management logic integration

### Matchmaking and insights

- Replace ad hoc attribute averages with OVR.
- General matchup comparisons show OVR difference alongside readiness and style information.
- When multiple similarly ranked and available opponents exist, prefer a reasonable OVR matchup.
- Do not sacrifice title obligations, ranking logic, tournament progression, availability, or calendar safety solely to equalize OVR.
- Warn on severe mismatches rather than forbidding them.

### Autobooker

- Continue prioritizing ranking, title rules, popularity, availability, and event needs.
- Use OVR only as a secondary pairing quality signal.
- Avoid a very large mismatch when another similarly suitable opponent is available.
- Preserve all existing no-double-booking, injury, suspension, contract, GP, and calendar safeguards.

### Tournaments

- Tournament seeding remains ranking-first.
- OVR is the tie-break after ranking score and before popularity when rankings are equal or absent.
- POT is used for scouting/signing reserves and prospects, not to seed an unproven fighter above a better-ranked fighter.

### Contracts and economy

- Contract expectation receives a modest current-ability component from OVR.
- Young fighters with high POT and meaningful development room receive a modest prospect premium.
- Popularity, record, champion status, morale, and promotion reputation remain the dominant commercial factors.
- Physical measurements do not directly affect pay or event revenue.
- Rankings remain result-driven Elo and do not directly use OVR.

## UI and UX

### Fighter Detail

Show a prominent OVR/POT pair near the fighter identity. Add:

- Height in centimeters, optionally with a derived feet/inches display.
- Fight weight in pounds.
- Walk-around weight in pounds.
- Weight-cut percentage.
- All eleven attributes, including the currently omitted Toughness.

The layout must remain readable on mobile: physical measurements should wrap into compact cards rather than force a wide table.

### Roster and Free Agents

- Add sortable OVR and POT columns.
- Keep the main table compact; height and weights belong in a secondary detail line, responsive expansion, or tooltip rather than three permanent columns.
- Update prospect filters/badges to use the new prospect rule.
- Preserve current filters, contract actions, and mobile horizontal behavior.

### Event Builder

- Show OVR next to selectable fighters and matchup comparisons.
- Display a non-blocking warning for a severe OVR mismatch.
- Keep readiness, rankings, title rules, contract status, and availability visible and authoritative.

### Tournament UI

- Show OVR in the eligible-fighter list and bracket participant details where space permits.
- Explain that seed order remains ranking-based.

### Other surfaces

Rankings, fight presentation, history, and inbox may display OVR where it adds immediate scouting value, but should not gain redundant physical columns. Avoid changing every screen merely because the data exists.

## Save migration

Increase `CURRENT_SAVE_VERSION` and migrate every fighter before consumers access the new required fields.

For each legacy fighter:

1. Derive missing physical values deterministically from a stable fighter identity hash and weight class.
2. Validate and clamp malformed imported values to the configured class ranges.
3. Ensure `walkAroundWeightLb > fightWeightLb`.
4. Preserve all existing attributes without rebalancing.
5. Calculate OVR from the preserved attributes.
6. If POT is missing, use a safe age/OVR-based default.
7. If POT is lower than OVR, raise POT to OVR.
8. Clamp POT to the supported 10–95 range while never leaving it below OVR.

Migration is idempotent: loading, saving, and loading again does not change physical values or POT.

Fight and event archives continue relying on stored names and IDs. No archive schema expansion is required unless a current archive view reads a full Fighter object.

## Validation and tests

Add focused assertion scripts or extend existing root-level scripts to cover:

### Ratings and generation

- OVR is deterministic and always within 10–95.
- Every one of the eleven attributes influences OVR.
- Style weighting remains bounded and does not dominate the formula.
- Generated fighters fall inside broad archetype OVR expectations across multiple seeds.
- New attributes are clamped to 10–95 and values above 90 remain uncommon.
- POT is never below generated OVR.

### Physical measurements

- Every generated fighter receives valid height, fight weight, and walk-around weight for their class.
- Walk-around weight is always greater than fight weight.
- Weight-cut percentage is valid.
- Combined physical modifiers stay within 0.95–1.05.
- Same seeded world produces the same physical profiles.

### Progression

- Fighters below POT may improve.
- Improvement slows near POT.
- Growth never leaves OVR above POT.
- Fighters at POT do not receive camp or passive stat growth.
- Age decline can reduce OVR normally.

### Migration

- Legacy fighters receive deterministic physical data.
- Existing attributes are unchanged.
- POT is repaired to at least OVR.
- Repeated migration is idempotent.
- Import/export remains valid.

### Game integration

- Matchmaking prefers a closer OVR pairing when rank, availability, and obligations are otherwise equivalent.
- Severe mismatch warnings are generated but do not invalidate a legal booking.
- Tournament seeding remains ranking-first with OVR tie-breaking.
- Contract expectations react modestly to OVR/POT without overwhelming popularity and results.

### Balance and regression

Run statistical fight samples and compare:

- Favorite win rate.
- Upset rate.
- KO/TKO rate.
- Submission rate.
- Decision rate.
- Injury and medical-suspension rates.

The change must not create deterministic favorite wins, collapse finish diversity, or destabilize event cadence.

Run all affected assertion scripts, including calendar, tournament, management, UI contracts, fight simulation/balance, save migration, and long-simulation acceptance. Then run TypeScript checking, production build, and direct desktop/mobile UI verification.

## Compatibility constraints

- No multiplayer, real fighters, real promotions, rival promotions, new belt types, or season standings.
- Preserve Observer mode, manual manager mode, GP progression, title-shot debt, calendar integrity, contracts, camps, rivalries, inbox, save/import/export, and long-simulation safety.
- No new dependency is needed.
- Do not commit or push without explicit user instruction.

## Explicit exclusions

- Reach and limb measurements.
- Gender-specific physiology systems.
- User-controlled diet or weight-cut plans.
- Missed weight, purse penalties, bout cancellation, or catchweights.
- Automatic weight-class changes.
- Retroactive stat nerfs for existing saves.
- Stored OVR values.
