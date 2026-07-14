# Long-Sim Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Cage Dynasty long simulations leave no stale due events, fake GP events, unavailable bookings, or hidden integrity failures.

**Architecture:** Keep the fix in existing game modules to minimize files: event lifecycle helpers live in `src/lib/game/autobooker.ts`, consumers call them from `src/store/gameStore.ts` and `test_long_sim.ts`, and calendar invariants stay in `src/lib/game/season.ts`. The core loop becomes repair-before-simulate and repair-after-advance, using `event.date <= currentDate` instead of `event.date === currentDate`.

**Tech Stack:** TypeScript, Zustand store, existing game engine helpers (`advanceTime`, `quickSimulateEvent`), existing assert-style test scripts via `tsx`.

---

## Files

- Modify `src/lib/game/autobooker.ts`
  - Export `simulateDueEvents(state, simulateEvents)`.
  - Export `repairPastScheduledEvents(state)`.
  - Extend `repairFutureEventAvailability` to include due events.
  - Harden failed GP round scheduling cleanup.
- Modify `src/store/gameStore.ts`
  - Replace today-only simulation loop with shared due-event helper.
  - Reorder daily autopilot execution.
- Modify `src/lib/game/season.ts`
  - Ensure validator catches long-sim acceptance failures for GP slots/events and scheduled past slots.
- Modify `src/lib/game/tournament.ts`
  - Add or reuse small cleanup behavior if tournament slots must clear `eventId`/`fightId` after failed/deleted round events.
- Modify `test_long_sim.ts`
  - Use shared helpers.
  - Add deterministic stress checks.
  - Aggregate diagnostics and throw on hard-fail metrics.

---

### Task 1: Add due-event and past-event repair helpers

**Files:**
- Modify: `src/lib/game/autobooker.ts`
- Test: `test_long_sim.ts`

- [ ] **Step 1: Add imports needed by helpers**

In `src/lib/game/autobooker.ts`, add `quickSimulateEvent` to imports:

```ts
import { quickSimulateEvent } from '../engine';
```

- [ ] **Step 2: Add shared due-event helper near repair helpers**

Append before `repairFutureEventAvailability` in `src/lib/game/autobooker.ts`:

```ts
export function simulateDueEvents(
  state: GameState,
  simulateEvents: boolean
): { state: GameState; stoppedForManualEvent: boolean; selectedEventId?: string } {
  let newState = { ...state };

  while (true) {
    const dueEvent = Object.values(newState.events)
      .filter(e => !e.isCompleted && e.date <= newState.currentDate)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

    if (!dueEvent) {
      return { state: newState, stoppedForManualEvent: false };
    }

    newState = repairEventAvailability(newState, dueEvent.id);
    newState = checkAndCleanEmptyEvent(newState, dueEvent.id);

    const repairedEvent = newState.events[dueEvent.id];
    if (!repairedEvent || repairedEvent.isCompleted) continue;
    if (repairedEvent.fights.length < 3) continue;

    if (simulateEvents) {
      return {
        state: newState,
        stoppedForManualEvent: true,
        selectedEventId: repairedEvent.id
      };
    }

    newState = quickSimulateEvent(newState, repairedEvent.id);
  }
}
```

- [ ] **Step 3: Add past scheduled repair helper**

Append after `simulateDueEvents`:

```ts
export function repairPastScheduledEvents(state: GameState): GameState {
  let newState = { ...state };
  const pastEvents = Object.values(newState.events)
    .filter(e => !e.isCompleted && e.date < newState.currentDate)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  pastEvents.forEach(event => {
    const currentEvent = newState.events[event.id];
    if (!currentEvent || currentEvent.isCompleted) return;

    if (currentEvent.fights.length < 3) {
      newState = checkAndCleanEmptyEvent(newState, currentEvent.id);
      return;
    }

    if (!newState.seasonPlans) return;
    for (const yearStr in newState.seasonPlans) {
      const year = Number(yearStr);
      const plan = newState.seasonPlans[year];
      if (!plan) continue;

      const slots = plan.slots.map(slot => {
        if (slot.eventId !== currentEvent.id) return slot;
        return {
          ...slot,
          date: currentEvent.date,
          status: 'scheduled' as const,
          notes: [...(slot.notes || []), `Past due event queued for simulation on ${newState.currentDate}.`]
        };
      });
      newState.seasonPlans[year] = { ...plan, slots };
    }
  });

  return newState;
}
```

- [ ] **Step 4: Extend due/future repair window**

Replace `repairFutureEventAvailability` in `src/lib/game/autobooker.ts` with:

```ts
export function repairFutureEventAvailability(state: GameState): GameState {
  let newState = { ...state };
  const cutoffDate = addDays(newState.currentDate, 30);

  const upcomingEvents = Object.values(newState.events).filter(e =>
    !e.isCompleted &&
    e.date <= cutoffDate
  );

  upcomingEvents.forEach(e => {
    newState = repairEventAvailability(newState, e.id);
  });

  return newState;
}
```

- [ ] **Step 5: Run focused type/build check**

Run: `npm run build`
Expected: PASS, or only reveal TypeScript errors from the new helper imports/usages to fix before continuing.

---

### Task 2: Use due-event helper in autopilot daily loop

**Files:**
- Modify: `src/store/gameStore.ts`

- [ ] **Step 1: Import new helpers**

Change the autobooker import in `src/store/gameStore.ts` to include:

```ts
import { autoBookEventsAndContracts, maintainDeals, repairEventAvailability, repairFutureEventAvailability, repairPastScheduledEvents, simulateDueEvents } from '../lib/game/autobooker';
```

- [ ] **Step 2: Replace daily loop order**

Inside `advanceAutopilot`, replace the per-day body from auto-book through today-event simulation with this order:

```ts
gameState = syncCalendarSlots(gameState);
gameState = repairPastScheduledEvents(gameState);

let dueResult = simulateDueEvents(gameState, simulateEvents);
gameState = dueResult.state;
if (dueResult.stoppedForManualEvent && dueResult.selectedEventId) {
  Object.assign(newState, gameState);
  const recheckedEvent = newState.events[dueResult.selectedEventId];
  if (recheckedEvent) {
    newState.currentView = 'simulation';
    newState.selectedEventId = recheckedEvent.id;
    let startIndex = recheckedEvent.fights.length - 1;
    while (startIndex >= 0 && recheckedEvent.fights[startIndex].result) startIndex--;
    newState.activeEventSimulation = {
      eventId: recheckedEvent.id,
      activeFightIndex: startIndex,
      pendingResult: null,
      revealedLines: 0,
      status: 'idle'
    };
  }
  stoppedEarly = true;
  break;
}

gameState = autoBookEventsAndContracts(gameState);
gameState = runAutopilotTournaments(gameState);
gameState = repairFutureEventAvailability(gameState);

gameState = advanceTime(gameState, 1);
gameState = maintainDeals(gameState);
gameState = repairFutureEventAvailability(gameState);
gameState = syncTournamentTitleShotFlags(gameState);
gameState = repairPastScheduledEvents(gameState);

dueResult = simulateDueEvents(gameState, simulateEvents);
gameState = dueResult.state;
daysSimulated++;
Object.assign(newState, gameState);

if (dueResult.stoppedForManualEvent && dueResult.selectedEventId) {
  const recheckedEvent = newState.events[dueResult.selectedEventId];
  if (recheckedEvent) {
    newState.currentView = 'simulation';
    newState.selectedEventId = recheckedEvent.id;
    let startIndex = recheckedEvent.fights.length - 1;
    while (startIndex >= 0 && recheckedEvent.fights[startIndex].result) startIndex--;
    newState.activeEventSimulation = {
      eventId: recheckedEvent.id,
      activeFightIndex: startIndex,
      pendingResult: null,
      revealedLines: 0,
      status: 'idle'
    };
  }
  stoppedEarly = true;
  break;
}
```

- [ ] **Step 3: Import calendar sync**

If `syncCalendarSlots` is not already imported in `src/store/gameStore.ts`, change the season import to:

```ts
import { generateSeasonPlan, syncCalendarSlots } from '../lib/game/season';
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: PASS.

---

### Task 3: Prevent fake GP events after failed scheduling

**Files:**
- Modify: `src/lib/game/autobooker.ts`
- Possibly modify: `src/lib/game/tournament.ts`

- [ ] **Step 1: Add helper to detect tournament fights**

In `src/lib/game/autobooker.ts`, add near helper functions:

```ts
function hasTournamentFights(event: Event): boolean {
  return event.fights.some(f => Boolean(f.tournamentId && f.tournamentRound));
}
```

- [ ] **Step 2: Add GP failure cleanup helper**

Add near `checkAndCleanEmptyEvent`:

```ts
function cancelFailedGrandPrixEvent(
  state: GameState,
  eventId: string,
  tournamentId: string,
  round: TournamentRound,
  reason: string
): GameState {
  let newState = {
    ...state,
    events: { ...state.events },
    tournaments: { ...state.tournaments },
    news: [...state.news]
  };

  const event = newState.events[eventId];
  delete newState.events[eventId];

  const tourney = newState.tournaments[tournamentId];
  if (tourney) {
    newState.tournaments[tournamentId] = {
      ...tourney,
      fights: tourney.fights.map(slot => slot.eventId === eventId ? { ...slot, eventId: undefined, fightId: undefined } : slot),
      roundDelayReason: reason,
      delayedRound: round,
      earliestRoundDate: addDays(newState.currentDate, 14),
      notes: [...(tourney.notes || []), `Round ${round} delayed: ${reason}`]
    };
  }

  if (newState.seasonPlans) {
    for (const yearStr in newState.seasonPlans) {
      const year = Number(yearStr);
      const plan = newState.seasonPlans[year];
      if (!plan) continue;

      const slots = plan.slots.map(slot => {
        if (slot.eventId !== eventId) return slot;
        return {
          ...slot,
          eventId: undefined,
          status: 'planned' as const,
          date: addDays(newState.currentDate, 14),
          notes: [...(slot.notes || []), `GP round delayed: ${reason}`]
        };
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      newState.seasonPlans[year] = { ...plan, slots };
    }
  }

  if (event) {
    newState.news.unshift({
      id: uuidv4(),
      date: newState.currentDate,
      title: `Grand Prix Round Delayed`,
      content: `${event.name} was removed because tournament scheduling failed: ${reason}`,
      type: 'general' as const
    });
  }

  return newState;
}
```

- [ ] **Step 3: Use cleanup after scheduleTournamentRound**

In `autoBookEventsAndContracts`, replace the GP scheduling `try/catch` after new event creation with:

```ts
if (approachingSlot.type === 'grand_prix_round' && approachingSlot.tournamentId && approachingSlot.tournamentRound) {
  try {
    newState = scheduleTournamentRound(
      newState,
      approachingSlot.tournamentId,
      approachingSlot.tournamentRound,
      newEvent.id
    );

    const scheduledEvent = newState.events[newEvent.id];
    if (!scheduledEvent || !hasTournamentFights(scheduledEvent)) {
      newState = cancelFailedGrandPrixEvent(
        newState,
        newEvent.id,
        approachingSlot.tournamentId,
        approachingSlot.tournamentRound,
        'Tournament round produced no valid tournament fights.'
      );
    }
  } catch (e) {
    newState = cancelFailedGrandPrixEvent(
      newState,
      newEvent.id,
      approachingSlot.tournamentId,
      approachingSlot.tournamentRound,
      (e as Error).message
    );
  }
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: PASS.

---

### Task 4: Align validator with long-sim acceptance

**Files:**
- Modify: `src/lib/game/season.ts`

- [ ] **Step 1: Add scheduled GP metadata check**

Inside scheduled slot validation in `validateSeasonCalendarState`, add:

```ts
if (slot.status === 'scheduled' && slot.type === 'grand_prix_round' && (!slot.tournamentId || !slot.tournamentRound)) {
  errors.push(`Slot ${slot.id} (${slot.date}): Scheduled GP round slot is missing tournament metadata.`);
}
```

- [ ] **Step 2: Add scheduled GP event metadata check**

Inside scheduled slot validation after retrieving `event`, add:

```ts
if (event && slot.type === 'grand_prix_round') {
  const hasTournamentMetadata = event.fights.some(f => f.tournamentId && f.tournamentRound);
  if (!hasTournamentMetadata) {
    errors.push(`Slot ${slot.id} (${slot.date}): Scheduled GP round event has no tournament fights.`);
  }
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS.

---

### Task 5: Update long-sim runner and hard-fail acceptance

**Files:**
- Modify: `test_long_sim.ts`

- [ ] **Step 1: Import shared helpers**

Change imports to include:

```ts
import { autoBookEventsAndContracts, maintainDeals, repairFutureEventAvailability, repairPastScheduledEvents, simulateDueEvents } from './src/lib/game/autobooker';
import { syncCalendarSlots, validateSeasonCalendarState } from './src/lib/game/season';
```

Remove unused `repairEventAvailability` and `quickSimulateEvent` imports.

- [ ] **Step 2: Replace `runDaysSimulation` daily loop**

Use this body inside each simulated day:

```ts
state = syncCalendarSlots(state);
state = repairPastScheduledEvents(state);
state = simulateDueEvents(state, false).state;
state = autoBookEventsAndContracts(state);
state = runAutopilotTournaments(state);
state = repairFutureEventAvailability(state);
state = advanceTime(state, 1);
state = maintainDeals(state);
state = repairFutureEventAvailability(state);
state = syncTournamentTitleShotFlags(state);
state = repairPastScheduledEvents(state);
state = simulateDueEvents(state, false).state;
```

- [ ] **Step 3: Aggregate diagnostics**

In `runTests`, collect every diagnostics result:

```ts
const reports: Array<{ label: string; diagnostics: ReturnType<typeof computeDiagnostics> }> = [];
```

After each `printReport(label, diag)` call, push:

```ts
reports.push({ label, diagnostics: diag });
```

- [ ] **Step 4: Add hard-fail checker**

Add below `printReport`:

```ts
function assertAcceptanceReports(reports: Array<{ label: string; diagnostics: ReturnType<typeof computeDiagnostics> }>) {
  const failures: string[] = [];
  const hardFailKeys: Array<keyof ReturnType<typeof computeDiagnostics>> = [
    'crashCount',
    'pastScheduledEvents',
    'scheduledEventsWith0Fights',
    'upcomingUnavailableFighters',
    'doubleBookedCount',
    'slotEventDateMismatches',
    'fakeGPCount',
    'calendarIntegrityErrors',
    'tournamentInvariantErrors',
    'titleShotDebtErrors',
    'roundStatsErrors',
    'completedEventMissingResult'
  ];

  reports.forEach(({ label, diagnostics }) => {
    hardFailKeys.forEach(key => {
      const value = diagnostics[key];
      if (typeof value === 'number' && value > 0) {
        failures.push(`${label}: ${String(key)} = ${value}`);
      }
    });

    if (label === '365 Days' && diagnostics.completedEvents < 3) {
      failures.push(`${label}: completedEvents = ${diagnostics.completedEvents}`);
    }
  });

  if (failures.length > 0) {
    throw new Error(`Long-sim acceptance failed:\n${failures.join('\n')}`);
  }
}
```

Call at the end of `runTests`:

```ts
assertAcceptanceReports(reports);
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: PASS.

---

### Task 6: Add deterministic stress checks

**Files:**
- Modify: `test_long_sim.ts`

- [ ] **Step 1: Add overdue-event deterministic test**

Add this function above `runTests`:

```ts
function runDeterministicOverdueEventTest() {
  let state = generateInitialWorld();
  state.currentDate = '2026-03-01';
  const event = Object.values(state.events).find(e => !e.isCompleted && e.fights.length >= 3);
  if (!event) return;

  state.events[event.id] = { ...event, date: '2026-02-01' };
  state = repairPastScheduledEvents(state);
  state = simulateDueEvents(state, false).state;

  const stale = Object.values(state.events).filter(e => !e.isCompleted && e.date < state.currentDate);
  if (stale.length > 0) {
    throw new Error(`Deterministic overdue event test failed: ${stale.length} stale events remain.`);
  }
}
```

- [ ] **Step 2: Add fake-GP validator deterministic test**

Add this function above `runTests`:

```ts
function runDeterministicFakeGpValidatorTest() {
  const state = generateInitialWorld();
  const event = Object.values(state.events).find(e => !e.isCompleted && e.fights.length >= 3);
  if (!event) return;

  state.events[event.id] = {
    ...event,
    name: 'CD GP Semifinal Deterministic Fake',
    fights: event.fights.map(f => ({ ...f, tournamentId: undefined, tournamentRound: undefined }))
  };

  const errors = validateSeasonCalendarState(state);
  if (!errors.some(e => e.includes('GP event has no tournament fights/metadata'))) {
    throw new Error('Deterministic fake GP validator test failed.');
  }
}
```

- [ ] **Step 3: Call deterministic tests first**

At the start of `runTests`, after the starting log:

```ts
runDeterministicOverdueEventTest();
runDeterministicFakeGpValidatorTest();
```

- [ ] **Step 4: Run deterministic long-sim script**

Run: `npx tsx test_long_sim.ts`
Expected: may FAIL while remaining random long-sim issues exist, but deterministic overdue and fake-GP checks should not be the failing reason.

---

### Task 7: Final verification and targeted cleanup

**Files:**
- Modify only files already touched if verification exposes errors.

- [ ] **Step 1: Run full required suite**

Run:

```bash
npm run lint && npm run build && npx tsx test_tournament.ts && npx tsx test_balance.ts && npx tsx test_calendar.ts && npx tsx test_long_sim.ts
```

Expected: PASS all commands.

- [ ] **Step 2: If long-sim fails on acceptance metrics**

Use the printed metric label to fix the smallest relevant code path:

- `pastScheduledEvents`: inspect due-event loop and `repairPastScheduledEvents`.
- `scheduledEventsWith0Fights`: inspect `checkAndCleanEmptyEvent` slot/event cleanup.
- `upcomingUnavailableFighters`: inspect `repairFutureEventAvailability` and `repairEventAvailability`.
- `fakeGPCount`: inspect `cancelFailedGrandPrixEvent` and GP naming path.
- `tournamentInvariantErrors`: inspect event deletion cleanup for tournament `eventId`/`fightId`.
- `calendarIntegrityErrors`: inspect `validateSeasonCalendarState` output and slot status/date updates.

- [ ] **Step 3: Re-run failing command only**

Run the single failing command until it passes, then run the full suite again.

- [ ] **Step 4: Do not commit unless user asks**

User did not ask for a commit. Leave changes uncommitted and report files changed plus verification results.

---

## Self-review

- Spec coverage: due-event helper, daily ordering, past scheduled repair, fake GP prevention, due/future availability repair, tournament cleanup, long-sim hard fail, deterministic stress checks, and final suite are covered.
- Placeholder scan: no TBD/TODO/fill-later steps remain.
- Type consistency: helper names match the requested API and current file imports.
