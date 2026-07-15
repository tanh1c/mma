# Observer Decision Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Observer mode deterministically select fight camps, operate promotion social actions, resolve counter-offers, and prioritize peak rivalries without changing Manager mode.

**Architecture:** Add one pure `src/lib/game/observer.ts` policy module and invoke it once per Observer day after booking, tournament scheduling, and availability repair. Keep event, roster, tournament, and title-shot ownership in their existing systems; modify only the regular-card pairing step to prioritize eligible intensity-three rivalries.

**Tech Stack:** TypeScript, Zustand store, date-fns, existing game-state helpers, Node assert-based runnable regressions, Vite.

## Global Constraints

- Run only when `state.mode === 'observer' && state.autopilot.enabled`.
- Do not alter Manager-mode behavior.
- Reuse existing social, contract, autobooker, tournament, and simulator behavior.
- Add no dependency, save-schema version, setting, command queue, or UI component.
- Keep all decisions deterministic and idempotent.
- Work directly in the authorized dirty `main` working tree; do not commit or push.

---

### Task 1: Observer camp policy

**Files:**
- Create: `src/lib/game/observer.ts`
- Create: `test_observer_decisions.ts`

**Interfaces:**
- Consumes: `GameState`, `FightMatchup`, `Fighter`, `FightCampFocus` from `src/types/game.ts`.
- Produces: `chooseObserverCampFocus(fight, red, blue, eventDate, currentDate): FightCampFocus` and `runObserverDecisions(state): GameState`.

- [ ] **Step 1: Write the failing camp-policy regression**

Create `test_observer_decisions.ts` with deterministic fixtures based on `generateInitialWorld(41)`. Set fighter attributes explicitly and assert:

```ts
assert.equal(chooseObserverCampFocus(fight, { ...red, fatigue: 40 }, blue, '2025-02-01', '2025-01-01'), 'recovery');
assert.equal(chooseObserverCampFocus(fight, red, blue, '2025-01-10', '2025-01-01'), 'recovery');
assert.equal(chooseObserverCampFocus({ ...fight, rounds: 5 }, red, blue, '2025-02-01', '2025-01-01'), 'cardio');
assert.equal(chooseObserverCampFocus(fight, wrestlingRed, wrestlingBlue, '2025-02-01', '2025-01-01'), 'wrestling');
assert.equal(chooseObserverCampFocus(fight, strikingRed, strikingBlue, '2025-02-01', '2025-01-01'), 'striking');
assert.equal(chooseObserverCampFocus(fight, balancedRed, balancedBlue, '2025-02-01', '2025-01-01'), 'balanced');
```

Also create one upcoming event and assert `runObserverDecisions` leaves it unchanged in Manager mode and writes the selected focus in enabled Observer mode.

- [ ] **Step 2: Run the regression to verify RED**

Run: `npx tsx test_observer_decisions.ts`

Expected: FAIL because `src/lib/game/observer.ts` or its exports do not exist.

- [ ] **Step 3: Implement the minimal camp selector and Observer guard**

Create `src/lib/game/observer.ts` with:

```ts
import { differenceInCalendarDays } from 'date-fns';
import type { FightCampFocus, Fighter, FightMatchup, GameState } from '../../types/game';

export function chooseObserverCampFocus(fight: FightMatchup, red: Fighter, blue: Fighter, eventDate: string, currentDate: string): FightCampFocus {
  if (red.fatigue >= 35 || blue.fatigue >= 35 || differenceInCalendarDays(new Date(eventDate), new Date(currentDate)) < 14) return 'recovery';
  if (fight.isTitleFight || fight.rounds === 5) return 'cardio';
  const striking = (red.attributes.striking + red.attributes.power + blue.attributes.striking + blue.attributes.power) / 4;
  const wrestling = (red.attributes.wrestling + red.attributes.grappling + red.attributes.submissions + blue.attributes.wrestling + blue.attributes.grappling + blue.attributes.submissions) / 6;
  if (wrestling >= striking + 5) return 'wrestling';
  if (striking >= wrestling + 5) return 'striking';
  return 'balanced';
}

export function runObserverDecisions(state: GameState): GameState {
  if (state.mode !== 'observer' || !state.autopilot.enabled) return state;
  const events = Object.fromEntries(Object.entries(state.events).map(([id, event]) => [id, event.isCompleted || event.date < state.currentDate ? event : {
    ...event,
    fights: event.fights.map(fight => {
      const red = state.fighters[fight.redCornerId];
      const blue = state.fighters[fight.blueCornerId];
      return red && blue ? { ...fight, campFocus: chooseObserverCampFocus(fight, red, blue, event.date, state.currentDate) } : fight;
    })
  }]));
  return { ...state, events };
}
```

- [ ] **Step 4: Run the regression to verify GREEN**

Run: `npx tsx test_observer_decisions.ts`

Expected: PASS for all camp branches and Manager/Observer guards.

---

### Task 2: Observer social and counter-offer decisions

**Files:**
- Modify: `src/lib/game/observer.ts`
- Modify: `test_observer_decisions.ts`

**Interfaces:**
- Consumes: `applyPromotionSocialAction`, `getContractEndDate`, `isProspect`, `getFighterOverall` and current `GameState` fields.
- Produces: idempotent Observer announcements/hype and accepted/rejected counter-offer state transitions through `runObserverDecisions`.

- [ ] **Step 1: Add failing social and counter-offer regressions**

Extend `test_observer_decisions.ts` to assert:

```ts
const firstPass = runObserverDecisions(observerStateWithUpcomingFight);
const secondPass = runObserverDecisions(firstPass);
assert.equal(firstPass.socialFeed.filter(item => item.actionKey === `fight:${fight.id}:promotion-announce`).length, 1);
assert.equal(secondPass.socialFeed.filter(item => item.actionKey === `fight:${fight.id}:promotion-announce`).length, 1);
```

Use an event 10 days away and assert a title/close/rivalry fight receives exactly one `promotion-hype` action, while a low-popularity 15+ OVR mismatch receives none.

Create two counter-offers:

```ts
important.counterOffer = { payPerFight: 12000, winBonus: 12000, fights: 4, interest: 75, expiresDate: '2025-01-15' };
ordinary.counterOffer = { payPerFight: 100000, winBonus: 100000, fights: 4, interest: 40, expiresDate: '2025-01-15' };
```

Assert the important affordable fighter receives the exact terms and a computed end date, both offers are cleared, and a second pass does not add duplicate contract news.

- [ ] **Step 2: Run the regression to verify RED**

Run: `npx tsx test_observer_decisions.ts`

Expected: FAIL because the current Observer pass only sets camps.

- [ ] **Step 3: Implement minimal balanced decision helpers**

In `src/lib/game/observer.ts`:

1. Resolve active counter-offers first. A fighter is important when champion, popularity `>= 60`, `isProspect(fighter)`, or their division has `1..5` contracted fighters. Accept only when terms are valid and `promotion.money - payPerFight - winBonus >= 50000`.
2. For acceptance, set a contract with exact terms, `exclusivity: true`, `endDate: getContractEndDate`, and `lastNegotiationDate`; clear `counterOffer`; prepend a stable news entry `observer-counter-${fighter.id}-${state.currentDate}` only if absent.
3. For rejection, only clear `counterOffer`.
4. Apply camps against the post-counter state.
5. Apply `announce` to every upcoming fight through `applyPromotionSocialAction`.
6. Apply `hype` only at `1..14` days when title, tournament, active rivalry, OVR gap `<10`, or combined popularity `>=120`.

Use the existing social action helper rather than constructing feed entries directly.

- [ ] **Step 4: Run the focused regression to verify GREEN**

Run: `npx tsx test_observer_decisions.ts`

Expected: PASS with no duplicate social actions or contract news.

- [ ] **Step 5: Run adjacent management and social regressions**

Run:

```bash
npx tsx test_management_depth.ts
npx tsx test_social_hub.ts
```

Expected: both PASS.

---

### Task 3: Prefer eligible peak rivalries in automatic regular-card fill

**Files:**
- Modify: `src/lib/game/autobooker.ts:864-882`
- Modify: `test_observer_decisions.ts`

**Interfaces:**
- Consumes: active `Storyline` records, the existing `available` fighter list, `bookedFighters`, and active/planned tournament participants.
- Produces: regular auto-card pairing that selects an eligible intensity-three rivalry before ordinary popularity/OVR pairing while retaining all title and tournament priorities.

- [ ] **Step 1: Write a failing rivalry-priority integration regression**

Build a deterministic Observer state with:

- one imminent planned regular-event calendar slot;
- at least six healthy contracted fighters in one division;
- no title obligation in that division;
- one active `Rivalry` storyline at intensity `3` between two eligible fighters who would not otherwise be selected as the first optimal pair;
- enough money for an event.

Call `autoBookEventsAndContracts(state)` and assert one newly created regular fight contains the rivalry pair. Add a second case where one rival is an active tournament participant and assert that pair is not booked as a regular rivalry fight.

- [ ] **Step 2: Run the regression to verify RED**

Run: `npx tsx test_observer_decisions.ts`

Expected: FAIL because regular-card fill currently pairs only by popularity and OVR proximity.

- [ ] **Step 3: Add the smallest rivalry-first pairing step**

Immediately before the existing `while (available.length >= 2)` loop for each weight class:

1. Build a set of participant/reserve IDs from active or planned tournaments.
2. Find active intensity-three rivalry storylines whose two fighter IDs are both in `available` and absent from that tournament set.
3. Select deterministically by storyline ID.
4. Push that matchup, mark both fighters booked, and remove both from `available`.
5. Continue through the existing ordinary pairing loop.

Do not change title-fight branches, GP scheduling, availability filtering, card-size targets, or venue/economy selection.

- [ ] **Step 4: Run focused regression to verify GREEN**

Run: `npx tsx test_observer_decisions.ts`

Expected: PASS for eligible rivalry priority and tournament-participant exclusion.

- [ ] **Step 5: Run autobooker/calendar/tournament regressions**

Run:

```bash
npx tsx test_calendar.ts
npx tsx test_tournament.ts
```

Expected: both PASS.

---

### Task 4: Integrate the Observer pass into the real daily loop

**Files:**
- Modify: `src/store/gameStore.ts:321-325`
- Modify: `test_long_sim.ts:1-29`
- Modify: `test_observer_decisions.ts`

**Interfaces:**
- Consumes: `runObserverDecisions(state): GameState`.
- Produces: one Observer decision pass per simulated day after event/tournament repair and before `advanceTime`.

- [ ] **Step 1: Write the failing real-loop contract**

Add a source-level UI/store contract assertion to `test_observer_decisions.ts` that reads `src/store/gameStore.ts` and requires:

```ts
assert.match(storeSource, /repairFutureEventAvailability\(gameState\);\s*gameState = runObserverDecisions\(gameState\);\s*gameState = advanceTime/);
```

Update `test_long_sim.ts` to call `runObserverDecisions(state)` at the same point in its acceptance loop so it exercises the production order.

- [ ] **Step 2: Run the focused regression to verify RED**

Run: `npx tsx test_observer_decisions.ts`

Expected: FAIL because the store does not import or invoke the Observer pass.

- [ ] **Step 3: Wire the production loop**

In `src/store/gameStore.ts`, import `runObserverDecisions` and insert exactly:

```ts
gameState = repairFutureEventAvailability(gameState);
gameState = runObserverDecisions(gameState);
gameState = advanceTime(gameState, 1);
```

Do not invoke it from `advanceDays`; Manager mode and the header advance behavior remain outside this feature.

- [ ] **Step 4: Run focused and long-simulation checks**

Run:

```bash
npx tsx test_observer_decisions.ts
npx tsx test_long_sim.ts
```

Expected: Observer regression passes; long simulation reports zero crashes, calendar errors, tournament errors, title-shot debt errors, past scheduled events, unavailable upcoming fighters, and double bookings.

---

### Task 5: Final static and runtime verification

**Files:**
- No production changes expected.

**Interfaces:**
- Verifies the completed feature through CI checks and the running Vite UI.

- [ ] **Step 1: Run complete relevant regression set**

Run:

```bash
npx tsx test_observer_decisions.ts
npx tsx test_management_depth.ts
npx tsx test_social_hub.ts
npx tsx test_calendar.ts
npx tsx test_tournament.ts
npx tsx test_long_sim.ts
```

Expected: all PASS. If an unrelated pre-existing stale save-version assertion appears, report it separately rather than changing unrelated behavior.

- [ ] **Step 2: Run lint and production build**

Run:

```bash
npm run lint
npm run build
```

Expected: both exit successfully; the existing Vite large-chunk warning is allowed.

- [ ] **Step 3: Verify the running app on port 3000**

Using the existing Vite process at `http://127.0.0.1:3000/`:

1. Start a fresh world and select Observer mode.
2. Turn Watch Events Live off.
3. Advance until an event is booked and inside the 14-day promotion window.
4. Inspect Event Builder: each fight shows a policy-selected camp, with at least one non-balanced focus when the card supplies a matching condition.
5. Inspect Social Hub: each upcoming fight has one announcement; eligible fights have one hype action and disabled manual buttons.
6. Inspect Inbox: accepted/rejected counter-offers do not remain; delegated tournament/event issues behave through existing automation.
7. Repeat an Observer advance and confirm no duplicate social actions or contract decisions.

Capture desktop and mobile screenshots and assert no page-level horizontal overflow on mobile.

- [ ] **Step 4: Preserve working-tree state**

Run: `git status --short`

Expected: changes remain uncommitted on `main`. Do not commit or push.
