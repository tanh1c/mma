import { generateInitialWorld } from './src/lib/game/generator';
import { autoBookEventsAndContracts, maintainDeals, repairEventAvailability, repairFutureEventAvailability } from './src/lib/game/autobooker';
import { runAutopilotTournaments, syncTournamentTitleShotFlags, validateTournamentState, validateTitleShotDebtState } from './src/lib/game/tournament';
import { advanceTime, quickSimulateEvent } from './src/lib/engine';
import { validateSeasonCalendarState } from './src/lib/game/season';
import { GameState } from './src/types/game';

function runDaysSimulation(initialState: GameState, days: number): { state: GameState; crashCount: number; errorMessage?: string } {
  let state = { ...initialState };
  let crashCount = 0;
  let errorMessage: string | undefined;

  for (let i = 0; i < days; i++) {
    try {
      // 1. Auto-book
      state = autoBookEventsAndContracts(state);
      state = runAutopilotTournaments(state);

      // 2. Advance 1 day
      state = advanceTime(state, 1);
      state = maintainDeals(state);
      state = repairFutureEventAvailability(state);
      state = syncTournamentTitleShotFlags(state);

      // 3. Simulate today's events
      let todayEvents = Object.values(state.events).filter(e => e.date === state.currentDate && !e.isCompleted);
      while (todayEvents.length > 0) {
        const event = todayEvents[0];
        state = repairEventAvailability(state, event.id);
        const recheckedEvent = state.events[event.id];
        if (recheckedEvent && recheckedEvent.date === state.currentDate) {
          state = quickSimulateEvent(state, recheckedEvent.id);
          todayEvents = Object.values(state.events).filter(e => e.date === state.currentDate && !e.isCompleted);
        } else {
          // If postponed, get remaining today events
          todayEvents = Object.values(state.events).filter(e => e.date === state.currentDate && !e.isCompleted);
        }
      }
    } catch (err: any) {
      crashCount++;
      errorMessage = err.message || String(err);
      console.error(`Crash on Day ${i + 1}:`, err);
      break;
    }
  }

  return { state, crashCount, errorMessage };
}

function computeDiagnostics(state: GameState, crashCount: number) {
  const completedEvents = Object.values(state.events || {}).filter(e => e.isCompleted).length;
  const upcomingEvents = Object.values(state.events || {}).filter(e => !e.isCompleted).length;
  
  let fightsSimulated = 0;
  if (state.fightArchive) {
    fightsSimulated = Object.keys(state.fightArchive).length;
  }

  const reputation = state.promotion?.reputation ?? 0;
  const money = state.promotion?.money ?? 0;

  const tournaments = Object.values(state.tournaments || {});
  const active4Man = tournaments.filter(t => t.format === 'four_man' && t.status === 'active').length;
  const active8Man = tournaments.filter(t => t.format === 'eight_man' && t.status === 'active').length;
  const completed4Man = tournaments.filter(t => t.format === 'four_man' && t.status === 'completed').length;
  const completed8Man = tournaments.filter(t => t.format === 'eight_man' && t.status === 'completed').length;
  
  const created8Man = tournaments.filter(t => t.format === 'eight_man').length;

  const pastScheduledEvents = Object.values(state.events || {}).filter(e => !e.isCompleted && e.date < state.currentDate).length;
  const scheduledEventsWith0Fights = Object.values(state.events || {}).filter(e => !e.isCompleted && e.fights.length === 0).length;

  let upcomingUnavailableFighters = 0;
  Object.values(state.events || {}).forEach(e => {
    if (!e.isCompleted) {
      e.fights.forEach(f => {
        const red = state.fighters[f.redCornerId];
        const blue = state.fighters[f.blueCornerId];
        if (!red || !red.contract || red.injuryStatus || (red.medicalSuspension && red.medicalSuspension.daysRemaining > 0)) {
          upcomingUnavailableFighters++;
        }
        if (!blue || !blue.contract || blue.injuryStatus || (blue.medicalSuspension && blue.medicalSuspension.daysRemaining > 0)) {
          upcomingUnavailableFighters++;
        }
      });
    }
  });

  // Double-booked future fighters count
  let doubleBookedCount = 0;
  const fighterBookings: Record<string, number> = {};
  Object.values(state.events || {}).forEach(e => {
    if (!e.isCompleted) {
      e.fights.forEach(f => {
        fighterBookings[f.redCornerId] = (fighterBookings[f.redCornerId] || 0) + 1;
        fighterBookings[f.blueCornerId] = (fighterBookings[f.blueCornerId] || 0) + 1;
      });
    }
  });
  Object.values(fighterBookings).forEach(c => {
    if (c > 1) doubleBookedCount += (c - 1);
  });

  let slotEventDateMismatches = 0;
  let fakeGPSlots = 0;
  let stalePlannedSlots = 0;

  if (state.seasonPlans) {
    Object.values(state.seasonPlans).forEach(plan => {
      plan.slots.forEach(slot => {
        if (slot.eventId) {
          const event = state.events[slot.eventId] || state.eventArchive?.[slot.eventId];
          if (event && slot.date !== event.date) {
            slotEventDateMismatches++;
          }
        }
        if (slot.type === 'grand_prix_round' && (!slot.tournamentId || !slot.tournamentRound)) {
          fakeGPSlots++;
        }
        const slotTime = new Date(slot.date).getTime();
        const currTime = new Date(state.currentDate).getTime();
        const diffDays = Math.ceil((currTime - slotTime) / (1000 * 3600 * 24));
        if (diffDays > 14 && slot.status === 'planned') {
          const isDelayed = (slot.notes || []).some(n => n.toLowerCase().includes('delayed') || n.toLowerCase().includes('rescheduled'));
          if (!isDelayed) {
            stalePlannedSlots++;
          }
        }
      });
    });
  }

  let fakeGPEvents = 0;
  Object.values(state.events || {}).forEach(e => {
    const name = e.name.toLowerCase();
    if (name.includes("gp quarter") || name.includes("gp semi") || name.includes("gp final") || name.includes("grand prix")) {
      const hasMetadata = e.fights.some(f => f.tournamentId && f.tournamentRound);
      if (!hasMetadata) {
        fakeGPEvents++;
      }
    }
  });

  const calendarIntegrityErrors = validateSeasonCalendarState(state).length;
  const tournamentInvariantErrors = validateTournamentState(state).length;
  const titleShotDebtErrors = validateTitleShotDebtState(state).length;
  
  // roundStats errors
  let roundStatsErrors = 0;
  Object.values(state.fightArchive || {}).forEach((f: any) => {
    if (f.roundsScored) {
      Object.values(f.roundsScored).forEach((r: any) => {
        if (!r.judgeScores || r.judgeScores.length < 3) {
          roundStatsErrors++;
        }
      });
    }
  });

  let completedEventMissingResult = 0;
  Object.values(state.events || {}).forEach(e => {
    if (e.isCompleted && e.fights.some(f => !f.result)) {
      completedEventMissingResult++;
    }
  });

  return {
    completedEvents,
    upcomingEvents,
    fightsSimulated,
    reputation,
    money: Math.round(money),
    active4Man,
    active8Man,
    completed4Man,
    completed8Man,
    created8Man,
    completed8ManCount: completed8Man,
    pastScheduledEvents,
    scheduledEventsWith0Fights,
    upcomingUnavailableFighters,
    doubleBookedCount,
    slotEventDateMismatches,
    stalePlannedSlots,
    fakeGPCount: fakeGPSlots + fakeGPEvents,
    calendarIntegrityErrors,
    tournamentInvariantErrors,
    titleShotDebtErrors,
    roundStatsErrors,
    completedEventMissingResult,
    crashCount
  };
}

function printReport(label: string, d: ReturnType<typeof computeDiagnostics>) {
  console.log(`\n=== REPORT: ${label} ===`);
  console.log(`- Completed Events: ${d.completedEvents} | Upcoming: ${d.upcomingEvents}`);
  console.log(`- Fights Simulated: ${d.fightsSimulated}`);
  console.log(`- Reputation: ${d.reputation} | Money: $${d.money}`);
  console.log(`- 4-Man GP (Active/Completed): ${d.active4Man} / ${d.completed4Man}`);
  console.log(`- 8-Man GP (Created/Completed): ${d.created8Man} / ${d.completed8ManCount}`);
  console.log(`- Past Scheduled Events Count: ${d.pastScheduledEvents}`);
  console.log(`- Scheduled Events with 0 Fights: ${d.scheduledEventsWith0Fights}`);
  console.log(`- Upcoming Unavailable Fighter Count: ${d.upcomingUnavailableFighters}`);
  console.log(`- Double-Booked Future Fighters Count: ${d.doubleBookedCount}`);
  console.log(`- Slot/Event Date Mismatch Count: ${d.slotEventDateMismatches}`);
  console.log(`- Stale Planned Slot Count: ${d.stalePlannedSlots}`);
  console.log(`- Fake GP Slot/Event Count: ${d.fakeGPCount}`);
  console.log(`- Calendar Integrity Errors: ${d.calendarIntegrityErrors}`);
  console.log(`- Tournament Invariant Errors: ${d.tournamentInvariantErrors}`);
  console.log(`- Title Shot Debt Errors: ${d.titleShotDebtErrors}`);
  console.log(`- roundStats Validation Errors: ${d.roundStatsErrors}`);
  console.log(`- Completed Event Missing Result Count: ${d.completedEventMissingResult}`);
  console.log(`- Crash Count: ${d.crashCount}`);
  console.log(`=======================================`);
}

async function runTests() {
  console.log("Starting Long-Simulation Acceptance Tests...");

  const makeFreshWorld = () => {
    const w = generateInitialWorld();
    w.currentDate = "2026-01-01";
    return w;
  };

  // Run 365 Days
  console.log("\nRunning 365-day simulation...");
  const sim365 = runDaysSimulation(makeFreshWorld(), 365);
  const diag365 = computeDiagnostics(sim365.state, sim365.crashCount);
  printReport("365 Days", diag365);

  // Run 730 Days
  console.log("\nRunning 730-day simulation...");
  const sim730 = runDaysSimulation(makeFreshWorld(), 730);
  const diag730 = computeDiagnostics(sim730.state, sim730.crashCount);
  printReport("730 Days", diag730);

  // Run 1095 Days
  console.log("\nRunning 1095-day simulation...");
  const sim1095 = runDaysSimulation(makeFreshWorld(), 1095);
  const diag1095 = computeDiagnostics(sim1095.state, sim1095.crashCount);
  printReport("1095 Days", diag1095);

  // Run 1460 Days
  console.log("\nRunning 1460-day simulation...");
  const sim1460 = runDaysSimulation(makeFreshWorld(), 1460);
  const diag1460 = computeDiagnostics(sim1460.state, sim1460.crashCount);
  printReport("1460 Days", diag1460);

  // Run 1825 Days
  console.log("\nRunning 1825-day simulation...");
  const sim1825 = runDaysSimulation(makeFreshWorld(), 1825);
  const diag1825 = computeDiagnostics(sim1825.state, sim1825.crashCount);
  printReport("1825 Days", diag1825);

  // Run 5-Run Sample for 1460 Days
  console.log("\nRunning 5-run sample of 1460 days...");
  for (let run = 1; run <= 5; run++) {
    const simSample = runDaysSimulation(makeFreshWorld(), 1460);
    const diagSample = computeDiagnostics(simSample.state, simSample.crashCount);
    printReport(`1460 Days - Run #${run}`, diagSample);
  }

  // Run 5-Run Sample for 1825 Days
  console.log("\nRunning 5-run sample of 1825 days...");
  for (let run = 1; run <= 5; run++) {
    const simSample = runDaysSimulation(makeFreshWorld(), 1825);
    const diagSample = computeDiagnostics(simSample.state, simSample.crashCount);
    printReport(`1825 Days - Run #${run}`, diagSample);
  }
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
