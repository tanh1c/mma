import { generateInitialWorld } from './src/lib/game/generator';
import { autoBookEventsAndContracts, maintainDeals, repairEventAvailability, repairFutureEventAvailability, repairPastScheduledEvents, simulateDueEvents } from './src/lib/game/autobooker';
import { runAutopilotTournaments, syncTournamentTitleShotFlags, validateTournamentState, validateTitleShotDebtState } from './src/lib/game/tournament';
import { advanceTime, applyFightResult } from './src/lib/engine';
import { syncCalendarSlots, validateSeasonCalendarState } from './src/lib/game/season';
import { runObserverDecisions } from './src/lib/game/observer';
import { validateContractMarketState } from './src/lib/game/contractMarket';
import { validatePromotionEconomies } from './src/lib/game/promotionEconomy';
import { GameState, GrandPrixTournament } from './src/types/game';

function runDaysSimulation(initialState: GameState, days: number): { state: GameState; crashCount: number; errorMessage?: string } {
  let state = { ...initialState };
  let crashCount = 0;
  let errorMessage: string | undefined;

  for (let i = 0; i < days; i++) {
    try {
      state = syncCalendarSlots(state);
      state = repairPastScheduledEvents(state);
      state = simulateDueEvents(state, false).state;
      state = syncCalendarSlots(state);
      state = autoBookEventsAndContracts(state);
      state = runAutopilotTournaments(state);
      state = repairFutureEventAvailability(state);
      state = runObserverDecisions(state);
      state = advanceTime(state, 1);
      state = maintainDeals(state);
      state = repairFutureEventAvailability(state);
      state = syncTournamentTitleShotFlags(state);
      state = repairPastScheduledEvents(state);
      state = simulateDueEvents(state, false).state;
      state = syncCalendarSlots(state);
      const economyErrors = validatePromotionEconomies(state);
      if (economyErrors.length) throw new Error(`Promotion economy invariant: ${economyErrors[0]}`);
      const marketErrors = validateContractMarketState(state);
      if (marketErrors.length) throw new Error(`Contract market invariant: ${marketErrors[0]}`);
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
  let duplicateGpRetries = 0;

  if (state.seasonPlans) {
    Object.values(state.seasonPlans).forEach(plan => {
      const retrySlots = plan.slots.filter(slot =>
        slot.type === 'grand_prix_window' &&
        slot.status === 'planned' &&
        (slot.notes || []).some(note => note.startsWith('Rescheduled Grand Prix Window'))
      );
      if (retrySlots.length > 1) duplicateGpRetries += retrySlots.length - 1;

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

  const calendarErrors = validateSeasonCalendarState(state);
  const tournamentErrors = validateTournamentState(state);
  const economyErrors = validatePromotionEconomies(state);
  const marketErrors = validateContractMarketState(state);
  let duplicateEconomySettlements = 0;
  for (const economy of Object.values(state.promotionEconomies)) {
    const keys = new Set<string>();
    for (const entry of economy.ledger) {
      if (entry.category === 'liability_payment') continue;
      const key = `${entry.settlementKey}:${entry.category}`;
      if (keys.has(key)) duplicateEconomySettlements++;
      keys.add(key);
    }
    duplicateEconomySettlements += economy.settledEventIds.length - new Set(economy.settledEventIds).size;
  }
  const domesticChampionOwnershipErrors = Object.entries(state.titlesByPromotion).flatMap(([promotionId, titles]) =>
    Object.values(titles).flatMap(title => [title.undisputedChampionId, title.interimChampionId]
      .filter((fighterId): fighterId is string => Boolean(fighterId))
      .filter(fighterId => state.fighters[fighterId]?.contract?.promotionId !== promotionId))
  ).length;
  const calendarIntegrityErrors = calendarErrors.length;
  const tournamentInvariantErrors = tournamentErrors.length;
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
    duplicateGpRetries,
    fakeGPCount: fakeGPSlots + fakeGPEvents,
    calendarIntegrityErrors,
    tournamentInvariantErrors,
    titleShotDebtErrors,
    promotionEconomyErrors: economyErrors.length,
    duplicateEconomySettlements,
    contractMarketErrors: marketErrors.length,
    domesticChampionOwnershipErrors,
    firstPromotionEconomyError: economyErrors[0],
    firstContractMarketError: marketErrors[0],
    roundStatsErrors,
    completedEventMissingResult,
    firstCalendarError: calendarErrors[0],
    firstTournamentError: tournamentErrors[0],
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
  console.log(`- Duplicate GP Retry Count: ${d.duplicateGpRetries}`);
  console.log(`- Fake GP Slot/Event Count: ${d.fakeGPCount}`);
  console.log(`- Calendar Integrity Errors: ${d.calendarIntegrityErrors}${d.firstCalendarError ? ` (${d.firstCalendarError})` : ''}`);
  console.log(`- Tournament Invariant Errors: ${d.tournamentInvariantErrors}${d.firstTournamentError ? ` (${d.firstTournamentError})` : ''}`);
  console.log(`- Title Shot Debt Errors: ${d.titleShotDebtErrors}`);
  console.log(`- Promotion Economy Errors: ${d.promotionEconomyErrors}${d.firstPromotionEconomyError ? ` (${d.firstPromotionEconomyError})` : ''}`);
  console.log(`- Duplicate Economy Settlements: ${d.duplicateEconomySettlements}`);
  console.log(`- Contract Market Errors: ${d.contractMarketErrors}${d.firstContractMarketError ? ` (${d.firstContractMarketError})` : ''}`);
  console.log(`- Domestic Champion Ownership Errors: ${d.domesticChampionOwnershipErrors}`);
  console.log(`- roundStats Validation Errors: ${d.roundStatsErrors}`);
  console.log(`- Completed Event Missing Result Count: ${d.completedEventMissingResult}`);
  console.log(`- Crash Count: ${d.crashCount}`);
  console.log(`=======================================`);
}

function createDeterministicEvent(state: GameState, date: string, name = 'Deterministic Test Event') {
  const fighters = Object.values(state.fighters).filter(f => f.contract && !f.injuryStatus && !f.medicalSuspension);
  const fights = [0, 2, 4].map((idx) => ({
    id: `det-fight-${idx}`,
    redCornerId: fighters[idx].id,
    blueCornerId: fighters[idx + 1].id,
    weightClass: fighters[idx].weightClass,
    isTitleFight: false,
    rounds: 3
  }));
  const venue = Object.values(state.venues)[0];
  return {
    id: 'det-event',
    name,
    date,
    venueId: venue.id,
    ticketPrice: 20,
    marketingSpend: 500,
    fights,
    isCompleted: false
  };
}

function runDeterministicOverdueEventTest() {
  let state = generateInitialWorld();
  state.currentDate = '2026-03-01';
  const event = createDeterministicEvent(state, '2026-02-01');
  state.events[event.id] = event;

  state = repairPastScheduledEvents(state);
  state = simulateDueEvents(state, false).state;

  const stale = Object.values(state.events).filter(e => !e.isCompleted && e.date < state.currentDate);
  if (stale.length > 0) {
    throw new Error(`Deterministic overdue event test failed: ${stale.length} stale events remain.`);
  }
}

function runDeterministicFakeGpValidatorTest() {
  const state = generateInitialWorld();
  const event = createDeterministicEvent(state, state.currentDate, 'CD GP Semifinal Deterministic Fake');
  state.events[event.id] = event;

  const errors = validateSeasonCalendarState(state);
  if (!errors.some(e => e.includes('GP event has no tournament fights/metadata'))) {
    throw new Error('Deterministic fake GP validator test failed.');
  }
}

function runDeterministicRepairReplacementSelfFightTest() {
  let state = generateInitialWorld();
  state.currentDate = '2026-01-01';
  const fighters = Object.values(state.fighters).filter(f => f.contract && f.weightClass === 'Welterweight');
  const unavailable = fighters[0];
  const opponent = fighters[1];
  const event = createDeterministicEvent(state, '2026-01-20', 'Deterministic Repair Self Fight Event');
  state.fighters[unavailable.id] = {
    ...unavailable,
    medicalSuspension: {
      id: 'det-suspension',
      reason: 'hard_fight',
      daysRemaining: 10,
      sourceFightId: 'det-source',
      severity: 'minor'
    }
  };
  state.events[event.id] = {
    ...event,
    fights: [{
      id: 'det-repair-fight',
      redCornerId: unavailable.id,
      blueCornerId: opponent.id,
      weightClass: 'Welterweight',
      isTitleFight: false,
      rounds: 3
    }]
  };

  state = repairEventAvailability(state, event.id);
  const repairedFight = state.events[event.id]?.fights.find(f => f.id === 'det-repair-fight');
  if (repairedFight?.redCornerId === repairedFight?.blueCornerId) {
    throw new Error('Deterministic repair replacement self-fight test failed.');
  }
}

function runDeterministicGpWinnerChampionSelfFightTest() {
  let state = generateInitialWorld();
  state.currentDate = '2026-01-01';

  const fighters = Object.values(state.fighters).filter(f => f.contract && f.weightClass === 'Middleweight');
  const champ = fighters[0];
  const contender = fighters[1];
  const event = createDeterministicEvent(state, '2026-01-10', 'Deterministic GP Title Shot Event');
  state.titles.Middleweight = {
    ...state.titles.Middleweight,
    undisputedChampionId: champ.id,
    interimChampionId: null,
    status: 'active'
  };
  state.fighters[champ.id] = { ...champ, isChampion: true, titleShotPromised: true };
  state.fighters[contender.id] = { ...contender, titleShotPromised: true };
  state.tournaments['det-used-gp'] = {
    id: 'det-used-gp',
    name: 'Used Middleweight GP',
    shortName: 'Used MW GP',
    weightClass: 'Middleweight',
    status: 'completed',
    format: 'four_man',
    createdDate: '2025-01-01',
    completedDate: '2025-03-01',
    participants: [],
    reserveFighterIds: [],
    usedReserveFighterIds: [],
    fights: [],
    titleShotPromised: true,
    titleShotUsed: true,
    winnerId: champ.id,
    prestige: 70,
    notes: []
  } as GrandPrixTournament;
  state.tournaments['det-open-gp'] = {
    ...state.tournaments['det-used-gp'],
    id: 'det-open-gp',
    name: 'Open Middleweight GP',
    titleShotUsed: false,
    winnerId: contender.id
  } as GrandPrixTournament;
  state.events = {};
  state.events[event.id] = { ...event, fights: [] };
  state.seasonPlans = {
    2026: {
      year: 2026,
      createdDate: state.currentDate,
      targetEvents: 1,
      targetTentpoles: 0,
      targetGrandPrix: 0,
      status: 'active',
      slots: [{
        id: 'det-slot',
        year: 2026,
        date: event.date,
        type: 'title_fight_card',
        status: 'planned',
        priority: 1,
        eventId: event.id
      }]
    }
  };

  state = autoBookEventsAndContracts(state);
  const bookedEvent = state.events[event.id];
  const selfFight = bookedEvent?.fights.find(f => f.redCornerId === f.blueCornerId);
  if (selfFight) {
    throw new Error('Deterministic GP winner champion self-fight test failed.');
  }
}

function runDeterministicUsedTitleShotFlagCleanupTest() {
  let state = generateInitialWorld();
  state.currentDate = '2026-01-01';
  const fighters = Object.values(state.fighters).filter(f => f.contract && f.weightClass === 'Middleweight');
  const champ = fighters[0];
  const challenger = fighters[1];
  const event = createDeterministicEvent(state, state.currentDate, 'Deterministic Title Shot Cleanup Event');
  const fight = {
    ...event.fights[0],
    redCornerId: champ.id,
    blueCornerId: challenger.id,
    weightClass: 'Middleweight' as const,
    isTitleFight: true,
    titleFightType: 'undisputed' as const,
    rounds: 5
  };

  state.titles.Middleweight = {
    ...state.titles.Middleweight,
    undisputedChampionId: champ.id,
    interimChampionId: null,
    status: 'active'
  };
  state.fighters[champ.id] = { ...champ, isChampion: true };
  state.fighters[challenger.id] = { ...challenger, titleShotPromised: true };
  state.tournaments['det-open-gp'] = {
    id: 'det-open-gp',
    name: 'Open Middleweight GP',
    shortName: 'Open MW GP',
    weightClass: 'Middleweight',
    status: 'completed',
    format: 'four_man',
    createdDate: '2025-01-01',
    completedDate: '2025-03-01',
    participants: [],
    reserveFighterIds: [],
    usedReserveFighterIds: [],
    fights: [],
    titleShotPromised: true,
    titleShotUsed: false,
    winnerId: challenger.id,
    prestige: 70,
    notes: []
  } as GrandPrixTournament;
  state.events[event.id] = { ...event, fights: [fight] };

  state = applyFightResult(state, event.id, 0, {
    winnerId: champ.id,
    loserId: challenger.id,
    method: 'Unanimous Decision',
    round: 5,
    time: '5:00',
    commentary: [],
    performanceRating: 80
  });

  if (state.fighters[challenger.id].titleShotPromised || !state.tournaments['det-open-gp'].titleShotUsed) {
    throw new Error('Deterministic used title-shot flag cleanup test failed.');
  }
}

function assertAcceptanceReports(reports: Array<{ label: string; diagnostics: ReturnType<typeof computeDiagnostics> }>) {
  const failures: string[] = [];
  const hardFailKeys: Array<keyof ReturnType<typeof computeDiagnostics>> = [
    'crashCount',
    'pastScheduledEvents',
    'scheduledEventsWith0Fights',
    'upcomingUnavailableFighters',
    'doubleBookedCount',
    'slotEventDateMismatches',
    'duplicateGpRetries',
    'fakeGPCount',
    'calendarIntegrityErrors',
    'tournamentInvariantErrors',
    'titleShotDebtErrors',
    'promotionEconomyErrors',
    'duplicateEconomySettlements',
    'contractMarketErrors',
    'domesticChampionOwnershipErrors',
    'roundStatsErrors',
    'completedEventMissingResult'
  ];

  reports.forEach(({ label, diagnostics }) => {
    hardFailKeys.forEach(key => {
      const value = diagnostics[key];
      if (typeof value === 'number' && value > 0) failures.push(`${label}: ${String(key)} = ${value}`);
    });

    if (label === '365 Days' && diagnostics.completedEvents < 3) {
      failures.push(`${label}: completedEvents = ${diagnostics.completedEvents}`);
    }
  });

  if (failures.length > 0) {
    throw new Error(`Long-sim acceptance failed:\n${failures.join('\n')}`);
  }
}

async function runTests() {
  console.log("Starting Long-Simulation Acceptance Tests...");
  runDeterministicOverdueEventTest();
  runDeterministicFakeGpValidatorTest();
  runDeterministicRepairReplacementSelfFightTest();
  runDeterministicGpWinnerChampionSelfFightTest();
  runDeterministicUsedTitleShotFlagCleanupTest();

  const reports: Array<{ label: string; diagnostics: ReturnType<typeof computeDiagnostics> }> = [];
  const recordReport = (label: string, diagnostics: ReturnType<typeof computeDiagnostics>) => {
    printReport(label, diagnostics);
    reports.push({ label, diagnostics });
  };

  const makeFreshWorld = () => {
    const w = generateInitialWorld();
    w.currentDate = "2026-01-01";
    w.mode = 'observer';
    w.autopilot = { ...w.autopilot, enabled: true };
    return w;
  };

  // Run 365 Days
  console.log("\nRunning 365-day simulation...");
  const sim365 = runDaysSimulation(makeFreshWorld(), 365);
  const diag365 = computeDiagnostics(sim365.state, sim365.crashCount);
  recordReport("365 Days", diag365);

  // Run 730 Days
  console.log("\nRunning 730-day simulation...");
  const sim730 = runDaysSimulation(makeFreshWorld(), 730);
  const diag730 = computeDiagnostics(sim730.state, sim730.crashCount);
  recordReport("730 Days", diag730);

  // Run 1095 Days
  console.log("\nRunning 1095-day simulation...");
  const sim1095 = runDaysSimulation(makeFreshWorld(), 1095);
  const diag1095 = computeDiagnostics(sim1095.state, sim1095.crashCount);
  recordReport("1095 Days", diag1095);

  // Run 1460 Days
  console.log("\nRunning 1460-day simulation...");
  const sim1460 = runDaysSimulation(makeFreshWorld(), 1460);
  const diag1460 = computeDiagnostics(sim1460.state, sim1460.crashCount);
  recordReport("1460 Days", diag1460);

  // Run 1825 Days
  console.log("\nRunning 1825-day simulation...");
  const sim1825 = runDaysSimulation(makeFreshWorld(), 1825);
  const diag1825 = computeDiagnostics(sim1825.state, sim1825.crashCount);
  recordReport("1825 Days", diag1825);

  // Run 5-Run Sample for 1460 Days
  console.log("\nRunning 5-run sample of 1460 days...");
  for (let run = 1; run <= 5; run++) {
    const simSample = runDaysSimulation(makeFreshWorld(), 1460);
    const diagSample = computeDiagnostics(simSample.state, simSample.crashCount);
    recordReport(`1460 Days - Run #${run}`, diagSample);
  }

  // Run 5-Run Sample for 1825 Days
  console.log("\nRunning 5-run sample of 1825 days...");
  for (let run = 1; run <= 5; run++) {
    const simSample = runDaysSimulation(makeFreshWorld(), 1825);
    const diagSample = computeDiagnostics(simSample.state, simSample.crashCount);
    recordReport(`1825 Days - Run #${run}`, diagSample);
  }

  assertAcceptanceReports(reports);
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
