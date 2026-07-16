import { generateInitialWorld } from './src/lib/game/generator';
import { createGrandPrixTournament, scheduleQuarterfinals, scheduleSemifinals, scheduleFinal, applyTournamentProgression, cancelTournament, validateTournamentState, runAutopilotTournaments } from './src/lib/game/tournament';
import { applyFightResult } from './src/lib/engine';
import { simulateFight } from './src/lib/game/fightSimulator';
import { FightMatchup } from './src/types/game';
import { v4 as uuidv4 } from 'uuid';

console.log("=== RUNNING GRAND PRIX TOURNAMENT UNIT TESTS ===");

try {
  let state = generateInitialWorld();
  
  // Exclude champions and select top 6 Lightweight fighters
  const lwFighters = Object.values(state.fighters).filter(f => f.weightClass === 'Lightweight' && !f.isChampion);
  if (lwFighters.length < 6) {
    throw new Error("Insufficient Lightweight fighters in initial world.");
  }
  
  console.log("1. Selected top 6 Lightweight participants/reserves");
  const candidates = lwFighters.slice(0, 6).map(f => {
    return {
      ...f,
      contract: f.contract || { fightsRemaining: 3, payPerFight: 10000, winBonus: 10000, exclusivity: true, endDate: '2027-01-01' },
      injuryStatus: null,
      medicalSuspension: null,
      fatigue: 0
    };
  });
  
  candidates.forEach(c => {
    state.fighters[c.id] = c;
  });
  
  Object.values(state.events).forEach(e => {
    if (!e.isCompleted) {
      e.fights = e.fights.filter(f => !candidates.some(c => c.id === f.redCornerId || c.id === f.blueCornerId));
    }
  });
  
  const pIds = candidates.slice(0, 4).map(f => f.id);
  const rIds = candidates.slice(4, 6).map(f => f.id);
  
  // Create Grand Prix
  state = createGrandPrixTournament(state, {
    weightClass: 'Lightweight',
    name: 'Test Lightweight Grand Prix',
    titleShotPromised: true,
    participantIds: pIds,
    reserveIds: rIds
  });
  
  const tourneyId = Object.keys(state.tournaments)[0];
  const tourney = state.tournaments[tourneyId];
  console.log(`2. Created Grand Prix: "${tourney.name}" | Status: ${tourney.status}`);
  if (tourney.status !== 'planned') throw new Error("GP should start as planned.");
  
  // Create Semi Event
  const semiEventId = 'semi-event';
  state.events[semiEventId] = {
    id: semiEventId,
    name: "Cage Dynasty GP Semifinals",
    date: '2026-02-01',
    venueId: Object.keys(state.venues)[0],
    ticketPrice: 50,
    marketingSpend: 10000,
    fights: [],
    isCompleted: false
  };
  
  // Schedule Semifinals
  state = scheduleSemifinals(state, tourneyId, semiEventId);
  console.log("3. Scheduled Semifinals on upcoming event");
  
  const updatedTourney = state.tournaments[tourneyId];
  if (updatedTourney.status !== 'active') throw new Error("GP status should be active after scheduling semis.");
  
  // Simulate semis
  console.log("4. Simulating Semifinal fights...");
  const semiEvent = state.events[semiEventId];
  semiEvent.fights.forEach((fight, idx) => {
    const redF = state.fighters[fight.redCornerId];
    const blueF = state.fighters[fight.blueCornerId];
    const res = simulateFight(fight as FightMatchup, redF, blueF);
    
    // Pass to applyFightResult (which calls applyTournamentProgression internally)
    state = applyFightResult(state, semiEventId, idx, res);
  });
  
  state.events[semiEventId].isCompleted = true;
  
  const tourneyAfterSemis = state.tournaments[tourneyId];
  const finalSlot = tourneyAfterSemis.fights.find(f => f.round === 'final');
  console.log(`5. Semifinals completed. Finalists: ${state.fighters[finalSlot?.redFighterId || ''].lastName} vs ${state.fighters[finalSlot?.blueFighterId || ''].lastName}`);
  
  if (!finalSlot?.redFighterId || !finalSlot?.blueFighterId) {
    throw new Error("Final slot red/blue corners should be populated.");
  }
  
  const origFinalist1 = finalSlot.redFighterId;
  const origFinalist2 = finalSlot.blueFighterId;
  
  // CASE A: Short Medical Suspension (e.g. 20 days)
  console.log("\n--- TESTING CASE A: Short Medical Suspension ---");
  console.log(`Giving finalist ${state.fighters[origFinalist1].lastName} a 20-day medical suspension...`);
  state.fighters[origFinalist1].medicalSuspension = { id: 'test-gp-sus', reason: 'hard_fight', daysRemaining: 20, severity: 'minor' };
  
  const finalEventId = 'final-event-a';
  state.events[finalEventId] = {
    id: finalEventId,
    name: "Cage Dynasty GP Finals A",
    date: '2026-03-01',
    venueId: Object.keys(state.venues)[0],
    ticketPrice: 60,
    marketingSpend: 15000,
    fights: [],
    isCompleted: false
  };
  
  state = scheduleFinal(state, tourneyId, finalEventId);
  const tourneyCaseA = state.tournaments[tourneyId];
  console.log(`Case A Result: finalDelayReason = "${tourneyCaseA.finalDelayReason}" | earliestFinalDate = "${tourneyCaseA.earliestFinalDate}"`);
  if (!tourneyCaseA.finalDelayReason || !tourneyCaseA.earliestFinalDate || tourneyCaseA.delayedFighterId !== origFinalist1) {
    throw new Error("Case A Failed: Short medical suspension should have triggered a delay.");
  }
  if (tourneyCaseA.fights.find(f => f.round === 'final')?.eventId) {
    throw new Error("Case A Failed: Final should remain unscheduled during delay.");
  }
  console.log("✅ Case A Passed!");
  
  // Clear Case A suspension & delay
  state.fighters[origFinalist1].medicalSuspension = null;
  state.fighters[origFinalist2].medicalSuspension = null;
  state.fighters[origFinalist2].injuryStatus = null;
  state.fighters[origFinalist2].fatigue = 0;
  state.tournaments[tourneyId].finalDelayReason = null;
  state.tournaments[tourneyId].earliestFinalDate = null;
  state.tournaments[tourneyId].delayedFighterId = null;
  
  // CASE B: Long Injury / Suspension with Reserve available
  console.log("\n--- TESTING CASE B: Long Injury / Suspension (Reserve Available) ---");
  console.log(`Giving finalist ${state.fighters[origFinalist1].lastName} a long 50-day injury...`);
  state.fighters[origFinalist1].injuryStatus = { id: 'test-gp-inj-long', type: 'ACL Tear', daysRemaining: 50 };
  
  state = scheduleFinal(state, tourneyId, finalEventId);
  const tourneyCaseB = state.tournaments[tourneyId];
  const finalMatchupB = tourneyCaseB.fights.find(f => f.round === 'final')!;
  console.log(`Case B Result: Final scheduled on Event ${finalMatchupB.eventId} | Matchup: ${state.fighters[finalMatchupB.redFighterId || ''].lastName} vs ${state.fighters[finalMatchupB.blueFighterId || ''].lastName}`);
  if (finalMatchupB.redFighterId === origFinalist1) {
    throw new Error("Case B Failed: Injured finalist should have been replaced by a reserve!");
  }
  if (!finalMatchupB.eventId) {
    throw new Error("Case B Failed: Final should be successfully scheduled with reserve.");
  }
  console.log("✅ Case B Passed!");
  
  // Simulate Final to complete it
  console.log("Simulating Final fight for Case B...");
  const finalEvent = state.events[finalEventId];
  finalEvent.fights.forEach((fight, idx) => {
     const redF = state.fighters[fight.redCornerId];
     const blueF = state.fighters[fight.blueCornerId];
     const res = simulateFight(fight as FightMatchup, redF, blueF);
     state = applyFightResult(state, finalEventId, idx, res);
  });
  state.events[finalEventId].isCompleted = true;
  
  const completedTourney = state.tournaments[tourneyId];
  console.log(`Grand Prix completed! Winner: ${state.fighters[completedTourney.winnerId || ''].lastName}`);
  if (completedTourney.status !== 'completed' || !completedTourney.winnerId) {
    throw new Error("Tournament should be completed with winnerId set.");
  }
  
  const gpWinner = state.fighters[completedTourney.winnerId];
  if (!gpWinner.titleShotPromised) {
    throw new Error("GP Winner should have earned a promised title shot.");
  }
  
  // CASE C: Unavailable, No Reserve Available
  console.log("\n--- TESTING CASE C: Long Injury (No Reserve Available) ---");
  let stateC = generateInitialWorld();
  const candidatesC = Object.values(stateC.fighters)
    .filter(f => f.weightClass === 'Lightweight' && !f.isChampion)
    .slice(0, 4) // Only 4 fighters, NO reserves!
    .map(f => ({
      ...f,
      contract: f.contract || { fightsRemaining: 3, payPerFight: 10000, winBonus: 10000, exclusivity: true, endDate: '2027-01-01' },
      injuryStatus: null,
      medicalSuspension: null,
      fatigue: 0
    }));
  
  candidatesC.forEach(c => {
    stateC.fighters[c.id] = c;
  });
  
  Object.values(stateC.events).forEach(e => {
    if (!e.isCompleted) {
      e.fights = e.fights.filter(f => !candidatesC.some(c => c.id === f.redCornerId || c.id === f.blueCornerId));
    }
  });
  
  stateC = createGrandPrixTournament(stateC, {
    weightClass: 'Lightweight',
    name: 'Case C Grand Prix',
    titleShotPromised: true,
    participantIds: candidatesC.slice(0, 4).map(f => f.id),
    reserveIds: [] // NO RESERVES!
  });
  
  const tourneyIdC = Object.keys(stateC.tournaments)[0];
  const semiEventIdC = 'semi-event-c';
  stateC.events[semiEventIdC] = {
    id: semiEventIdC,
    name: "Case C GP Semis",
    date: '2026-02-01',
    venueId: Object.keys(stateC.venues)[0],
    ticketPrice: 50,
    marketingSpend: 10000,
    fights: [],
    isCompleted: false
  };
  
  stateC = scheduleSemifinals(stateC, tourneyIdC, semiEventIdC);
  
  // Simulate semis
  stateC.events[semiEventIdC].fights.forEach((fight, idx) => {
    const redF = stateC.fighters[fight.redCornerId];
    const blueF = stateC.fighters[fight.blueCornerId];
    const res = simulateFight(fight as FightMatchup, redF, blueF);
    stateC = applyFightResult(stateC, semiEventIdC, idx, res);
  });
  stateC.events[semiEventIdC].isCompleted = true;
  
  const finalSlotC = stateC.tournaments[tourneyIdC].fights.find(f => f.round === 'final')!;
  const finalistC1 = finalSlotC.redFighterId!;
  
  console.log(`Giving finalist ${stateC.fighters[finalistC1].lastName} a 60-day injury...`);
  stateC.fighters[finalistC1].injuryStatus = { id: 'test-c-inj', type: 'Broken Leg', daysRemaining: 60 };
  
  const finalEventIdC = 'final-event-c';
  stateC.events[finalEventIdC] = {
    id: finalEventIdC,
    name: "Case C GP Finals",
    date: '2026-03-01',
    venueId: Object.keys(stateC.venues)[0],
    ticketPrice: 60,
    marketingSpend: 15000,
    fights: [],
    isCompleted: false
  };
  
  stateC = scheduleFinal(stateC, tourneyIdC, finalEventIdC);
  const tourneyAfterC = stateC.tournaments[tourneyIdC];
  console.log(`Case C Result: finalDelayReason = "${tourneyAfterC.finalDelayReason}" | earliestFinalDate = "${tourneyAfterC.earliestFinalDate}"`);
  if (!tourneyAfterC.finalDelayReason || !tourneyAfterC.earliestFinalDate) {
    throw new Error("Case C Failed: Long injury with no reserve should have triggered a delay.");
  }
  if (tourneyAfterC.fights.find(f => f.round === 'final')?.eventId) {
    throw new Error("Case C Failed: Final slot should remain unscheduled.");
  }
  console.log("Case C Passed!");
  
  console.log("✅ ALL TOURNAMENT WORKFLOW TESTS PASSED!");

  console.log("\n=== RUNNING DRAWN GRAND PRIX PROGRESSION TESTS ===");
  let drawState = generateInitialWorld();
  const drawCandidates = Object.values(drawState.fighters)
    .filter(f => f.weightClass === 'Lightweight' && !f.isChampion)
    .slice(0, 4)
    .map(f => ({
      ...f,
      contract: f.contract || { fightsRemaining: 3, payPerFight: 10000, winBonus: 10000, exclusivity: true, endDate: '2027-01-01' },
      injuryStatus: null,
      medicalSuspension: null,
      fatigue: 0
    }));

  drawCandidates.forEach(fighter => { drawState.fighters[fighter.id] = fighter; });
  drawState = createGrandPrixTournament(drawState, {
    weightClass: 'Lightweight',
    name: 'Draw Progression Grand Prix',
    titleShotPromised: false,
    participantIds: drawCandidates.map(fighter => fighter.id),
    reserveIds: []
  });

  const drawTourneyId = Object.keys(drawState.tournaments).find(id => drawState.tournaments[id].name === 'Draw Progression Grand Prix')!;
  const drawSemifinals = drawState.tournaments[drawTourneyId].fights.filter(fight => fight.round === 'semifinal');
  drawState = applyTournamentProgression(drawState, drawTourneyId, drawSemifinals[0].id, null, null);
  drawState = applyTournamentProgression(drawState, drawTourneyId, drawSemifinals[1].id, null, null);
  const completedDrawSemis = drawState.tournaments[drawTourneyId].fights.filter(fight => fight.round === 'semifinal');
  const drawFinal = drawState.tournaments[drawTourneyId].fights.find(fight => fight.round === 'final')!;
  if (completedDrawSemis.some(fight => !fight.winnerId) || !drawFinal.redFighterId || !drawFinal.blueFighterId || drawFinal.redFighterId === drawFinal.blueFighterId) {
    throw new Error('Drawn semifinals must produce two distinct finalists.');
  }
  if (validateTournamentState(drawState).some(error => error.includes('missing winnerId'))) {
    throw new Error('Drawn semifinals must not leave a missing tournament winner invariant.');
  }

  drawState = applyTournamentProgression(drawState, drawTourneyId, drawFinal.id, null, null);
  const completedDrawTourney = drawState.tournaments[drawTourneyId];
  const completedDrawFinal = completedDrawTourney.fights.find(fight => fight.round === 'final')!;
  if (completedDrawTourney.status !== 'completed' || !completedDrawTourney.winnerId || !completedDrawFinal.winnerId) {
    throw new Error('A drawn GP final must complete with a bracket winner.');
  }
  if (validateTournamentState(drawState).length > 0) {
    throw new Error(`Drawn GP progression left invariants: ${validateTournamentState(drawState).join('; ')}`);
  }

  let explicitState = generateInitialWorld();
  const explicitCandidates = Object.values(explicitState.fighters).filter(f => f.weightClass === 'Lightweight' && !f.isChampion).slice(0, 4).map(f => ({ ...f, contract: f.contract || { fightsRemaining: 3, payPerFight: 10000, winBonus: 10000, exclusivity: true, endDate: '2027-01-01' }, injuryStatus: null, medicalSuspension: null, fatigue: 0 }));
  explicitCandidates.forEach(fighter => { explicitState.fighters[fighter.id] = fighter; });
  explicitState = createGrandPrixTournament(explicitState, { weightClass: 'Lightweight', name: 'Explicit Winner Grand Prix', titleShotPromised: false, participantIds: explicitCandidates.map(fighter => fighter.id), reserveIds: [] });
  const explicitTourneyId = Object.keys(explicitState.tournaments).find(id => explicitState.tournaments[id].name === 'Explicit Winner Grand Prix')!;
  const explicitSemifinal = explicitState.tournaments[explicitTourneyId].fights.find(fight => fight.round === 'semifinal')!;
  const explicitWinnerId = explicitSemifinal.blueFighterId!;
  explicitState = applyTournamentProgression(explicitState, explicitTourneyId, explicitSemifinal.id, explicitWinnerId, explicitSemifinal.redFighterId!);
  if (explicitState.tournaments[explicitTourneyId].fights.find(fight => fight.id === explicitSemifinal.id)?.winnerId !== explicitWinnerId) {
    throw new Error('Explicit GP winners must advance unchanged.');
  }
  console.log("✅ DRAWN GRAND PRIX PROGRESSION TESTS PASSED!");

  // CANCELLATION TEST
  console.log("\n=== RUNNING CANCEL TOURNAMENT TESTS ===");
  let state2 = generateInitialWorld();
  const candidates2 = Object.values(state2.fighters)
    .filter(f => f.weightClass === 'Lightweight' && !f.isChampion)
    .slice(0, 6)
    .map(f => ({
      ...f,
      contract: f.contract || { fightsRemaining: 3, payPerFight: 10000, winBonus: 10000, exclusivity: true, endDate: '2027-01-01' },
      injuryStatus: null,
      medicalSuspension: null,
      fatigue: 0
    }));
  
  candidates2.forEach(c => {
    state2.fighters[c.id] = c;
  });
  
  Object.values(state2.events).forEach(e => {
    if (!e.isCompleted) {
      e.fights = e.fights.filter(f => !candidates2.some(c => c.id === f.redCornerId || c.id === f.blueCornerId));
    }
  });
  
  state2 = createGrandPrixTournament(state2, {
    weightClass: 'Lightweight',
    name: 'Cancel Test Grand Prix',
    titleShotPromised: true,
    participantIds: candidates2.slice(0, 4).map(f => f.id),
    reserveIds: candidates2.slice(4, 6).map(f => f.id)
  });
  
  const cancelTourneyId = Object.keys(state2.tournaments).find(id => state2.tournaments[id].name === 'Cancel Test Grand Prix')!;
  
  const cancelEventId = 'cancel-event';
  state2.events[cancelEventId] = {
    id: cancelEventId,
    name: "Cancel Event",
    date: '2026-02-01',
    venueId: Object.keys(state2.venues)[0],
    ticketPrice: 50,
    marketingSpend: 10000,
    fights: [],
    isCompleted: false
  };
  
  state2 = scheduleSemifinals(state2, cancelTourneyId, cancelEventId);
  console.log("1. Scheduled semifinals on upcoming event");
  if (state2.events[cancelEventId].fights.length === 0) {
    throw new Error("Fights should be scheduled on upcoming event.");
  }
  
  state2 = cancelTournament(state2, cancelTourneyId);
  console.log("2. Cancelled tournament");
  
  const cancelledTourney = state2.tournaments[cancelTourneyId];
  if (cancelledTourney.status !== 'cancelled') {
    throw new Error("Tournament status should be set to cancelled.");
  }
  
  if (state2.events[cancelEventId].fights.length > 0) {
    throw new Error("Scheduled fights should have been removed from the upcoming event upon cancellation.");
  }
  
  console.log("3. Verified status is cancelled and scheduled fights are successfully removed!");
  console.log("✅ ALL CANCEL TOURNAMENT TESTS PASSED SUCCESSFULLY!");

  // 8-MAN TOURNAMENT INTEGRATION TEST
  console.log("\n=== RUNNING 8-MAN GRAND PRIX INTEGRATION TEST ===");
  let state8 = generateInitialWorld();
  const lwFighters8 = Object.values(state8.fighters).filter(f => f.weightClass === 'Lightweight' && !f.isChampion);
  if (lwFighters8.length < 11) {
     throw new Error("Insufficient Lightweight fighters in initial world for 8-man GP.");
  }
  
  console.log("1. Selected top 11 Lightweight participants/reserves for 8-man");
  const candidates8 = lwFighters8.slice(0, 11).map(f => {
    return {
      ...f,
      contract: f.contract || { fightsRemaining: 4, payPerFight: 10000, winBonus: 10000, exclusivity: true, endDate: '2027-01-01' },
      injuryStatus: null,
      medicalSuspension: null,
      fatigue: 0
    };
  });
  
  candidates8.forEach(c => {
    state8.fighters[c.id] = c;
  });
  
  const pIds8 = candidates8.slice(0, 8).map(f => f.id);
  const rIds8 = candidates8.slice(8, 11).map(f => f.id);
  
  // Create 8-Man GP
  state8 = createGrandPrixTournament(state8, {
    weightClass: 'Lightweight',
    name: 'Test 8-Man Grand Prix',
    titleShotPromised: true,
    format: 'eight_man',
    participantIds: pIds8,
    reserveIds: rIds8
  });
  
  const tourneyId8 = Object.keys(state8.tournaments).find(id => state8.tournaments[id].name === 'Test 8-Man Grand Prix')!;
  const tourney8 = state8.tournaments[tourneyId8];
  console.log(`2. Created 8-Man Grand Prix: "${tourney8.name}" | Format: ${tourney8.format} | Status: ${tourney8.status}`);
  if (tourney8.status !== 'planned' || tourney8.format !== 'eight_man') {
    throw new Error("8-Man GP should start as planned eight_man format.");
  }
  
  // 3. Schedule QFs
  const qfEventId = 'qf-event';
  state8.events[qfEventId] = {
    id: qfEventId,
    name: "8-Man GP Quarterfinals",
    date: '2026-02-01',
    venueId: Object.keys(state8.venues)[0],
    ticketPrice: 50,
    marketingSpend: 10000,
    fights: [],
    isCompleted: false
  };
  
  state8 = scheduleQuarterfinals(state8, tourneyId8, qfEventId);
  console.log("3. Scheduled Quarterfinals on upcoming event");
  if (state8.tournaments[tourneyId8].status !== 'active') throw new Error("GP should be active after scheduling QFs.");
  
  // 4. Simulate QFs
  console.log("4. Simulating Quarterfinal fights...");
  const qfEvent = state8.events[qfEventId];
  if (qfEvent.fights.length !== 4) {
    throw new Error("Should schedule exactly 4 Quarterfinal fights.");
  }
  
  qfEvent.fights.forEach((fight, idx) => {
    const redF = state8.fighters[fight.redCornerId];
    const blueF = state8.fighters[fight.blueCornerId];
    const res = simulateFight(fight as FightMatchup, redF, blueF);
    state8 = applyFightResult(state8, qfEventId, idx, res);
  });
  state8.events[qfEventId].isCompleted = true;
  
  const tourneyAfterQf = state8.tournaments[tourneyId8];
  const qfFights = tourneyAfterQf.fights.filter(f => f.round === 'quarterfinal');
  if (qfFights.some(q => !q.isCompleted)) throw new Error("All Quarterfinals should be completed.");
  
  // 5. Verify Semifinal slots populated
  const sfFights = tourneyAfterQf.fights.filter(f => f.round === 'semifinal');
  console.log(`5. Quarterfinals completed. Semifinalists: SF1: ${state8.fighters[sfFights[0].redFighterId || ''].lastName} vs ${state8.fighters[sfFights[0].blueFighterId || ''].lastName} | SF2: ${state8.fighters[sfFights[1].redFighterId || ''].lastName} vs ${state8.fighters[sfFights[1].blueFighterId || ''].lastName}`);
  if (!sfFights[0].redFighterId || !sfFights[0].blueFighterId || !sfFights[1].redFighterId || !sfFights[1].blueFighterId) {
    throw new Error("Semifinal slots should be fully populated with QF winners.");
  }
  
  // 6. Schedule Semifinals
  const sfEventId = 'sf-event-8';
  state8.events[sfEventId] = {
    id: sfEventId,
    name: "8-Man GP Semifinals",
    date: '2026-03-15',
    venueId: Object.keys(state8.venues)[0],
    ticketPrice: 55,
    marketingSpend: 12000,
    fights: [],
    isCompleted: false
  };
  // Clear any medical suspensions/injuries/fatigue of participants to avoid random delays in test
  Object.keys(state8.fighters).forEach(id => {
    state8.fighters[id].medicalSuspension = null;
    state8.fighters[id].injuryStatus = null;
    state8.fighters[id].fatigue = 0;
  });

  state8 = scheduleSemifinals(state8, tourneyId8, sfEventId);
  console.log("6. Scheduled Semifinals on upcoming event");
  
  // 7. Simulate Semifinals
  console.log("7. Simulating Semifinal fights...");
  const sfEvent = state8.events[sfEventId];
  if (sfEvent.fights.length !== 2) {
    throw new Error("Should schedule exactly 2 Semifinal fights.");
  }
  
  sfEvent.fights.forEach((fight, idx) => {
    const redF = state8.fighters[fight.redCornerId];
    const blueF = state8.fighters[fight.blueCornerId];
    const res = simulateFight(fight as FightMatchup, redF, blueF);
    state8 = applyFightResult(state8, sfEventId, idx, res);
  });
  state8.events[sfEventId].isCompleted = true;
  
  const tourneyAfterSf = state8.tournaments[tourneyId8];
  const sfFightsCompleted = tourneyAfterSf.fights.filter(f => f.round === 'semifinal');
  if (sfFightsCompleted.some(s => !s.isCompleted)) throw new Error("All Semifinals should be completed.");
  
  // 8. Verify Final slot populated
  const finalSlot8 = tourneyAfterSf.fights.find(f => f.round === 'final')!;
  console.log(`8. Semifinals completed. Finalists: ${state8.fighters[finalSlot8.redFighterId || ''].lastName} vs ${state8.fighters[finalSlot8.blueFighterId || ''].lastName}`);
  if (!finalSlot8.redFighterId || !finalSlot8.blueFighterId) {
    throw new Error("Final slot should be populated with SF winners.");
  }
  
  // 9. Schedule Final
  const finalEventId8 = 'final-event-8';
  state8.events[finalEventId8] = {
    id: finalEventId8,
    name: "8-Man GP Final",
    date: '2026-05-01',
    venueId: Object.keys(state8.venues)[0],
    ticketPrice: 65,
    marketingSpend: 15000,
    fights: [],
    isCompleted: false
  };
  // Clear any medical suspensions/injuries/fatigue of finalists to avoid random delays in test
  Object.keys(state8.fighters).forEach(id => {
    state8.fighters[id].medicalSuspension = null;
    state8.fighters[id].injuryStatus = null;
    state8.fighters[id].fatigue = 0;
  });

  state8 = scheduleFinal(state8, tourneyId8, finalEventId8);
  console.log("9. Scheduled Final on upcoming event");
  
  // 10. Simulate Final
  console.log("10. Simulating Final fight...");
  const finalEvent8 = state8.events[finalEventId8];
  finalEvent8.fights.forEach((fight, idx) => {
    const redF = state8.fighters[fight.redCornerId];
    const blueF = state8.fighters[fight.blueCornerId];
    const res = simulateFight(fight as FightMatchup, redF, blueF);
    state8 = applyFightResult(state8, finalEventId8, idx, res);
  });
  state8.events[finalEventId8].isCompleted = true;
  
  // 11. Verify Completion & Winner Title Shot
  const tourneyCompleted8 = state8.tournaments[tourneyId8];
  console.log(`11. Grand Prix completed! Winner: ${state8.fighters[tourneyCompleted8.winnerId || ''].lastName}`);
  if (tourneyCompleted8.status !== 'completed' || !tourneyCompleted8.winnerId) {
    throw new Error("8-Man GP should be completed with a winnerId set.");
  }
  
  const gpWinner8 = state8.fighters[tourneyCompleted8.winnerId];
  if (!gpWinner8.titleShotPromised) {
    throw new Error("8-Man GP Winner should have earned a promised title shot.");
  }
  console.log("✅ 8-MAN TOURNAMENT INTEGRATION TEST PASSED!");

  console.log("\n=== RUNNING EMERGENCY RESERVE SIGNING REGRESSION ===");
  let emergencyState = generateInitialWorld(2026);
  const emergencyCandidates = Object.values(emergencyState.fighters).filter(f => f.weightClass === 'Lightweight' && !f.isChampion).slice(0, 4).map(f => ({ ...f, contract: { fightsRemaining: 1, payPerFight: 5000, winBonus: 5000, exclusivity: true, endDate: '2027-01-01' }, injuryStatus: null, medicalSuspension: null, fatigue: 0 }));
  emergencyCandidates.forEach(f => { emergencyState.fighters[f.id] = f; });
  emergencyState = createGrandPrixTournament(emergencyState, { weightClass: 'Lightweight', name: 'Emergency Reserve Regression GP', titleShotPromised: false, participantIds: emergencyCandidates.map(f => f.id), reserveIds: [] });
  const emergencyTournamentId = Object.keys(emergencyState.tournaments).find(id => emergencyState.tournaments[id].name === 'Emergency Reserve Regression GP')!;
  emergencyState.tournaments[emergencyTournamentId].status = 'active';
  emergencyState.tournaments[emergencyTournamentId].createdDate = '2023-01-01';
  emergencyState.currentDate = '2025-01-01';
  Object.values(emergencyState.fighters).filter(f => f.weightClass === 'Lightweight' && !f.contract).forEach(f => { emergencyState.fighters[f.id] = { ...f, popularity: 0 }; });
  emergencyCandidates.forEach((f, index) => { emergencyState.fighters[f.id] = { ...emergencyState.fighters[f.id], contract: null, popularity: index === 0 ? 100 : 0 }; });
  emergencyState.promotion.money = 100000;
  emergencyState = runAutopilotTournaments(emergencyState);
  const emergencyTournament = emergencyState.tournaments[emergencyTournamentId];
  if (emergencyTournament.reserveFighterIds.some(id => emergencyTournament.participants.some(participant => participant.fighterId === id))) {
    throw new Error('Emergency reserve signing must not add an existing participant as an unused reserve.');
  }
  console.log("✅ EMERGENCY RESERVE SIGNING REGRESSION PASSED!");

  console.log("\n=== RUNNING ACTIVE 4-MAN SEMIFINAL RETRY REGRESSION ===");
  let retryState = generateInitialWorld(2027);
  retryState.currentDate = '2026-06-01';
  const retryCandidates = Object.values(retryState.fighters).filter(f => f.weightClass === 'Lightweight' && !f.isChampion).slice(0, 6).map(f => ({ ...f, contract: { fightsRemaining: 4, payPerFight: 5000, winBonus: 5000, exclusivity: true, endDate: '2027-12-31' }, injuryStatus: null, medicalSuspension: null, fatigue: 0 }));
  retryCandidates.forEach(f => { retryState.fighters[f.id] = f; });
  retryState = createGrandPrixTournament(retryState, { weightClass: 'Lightweight', name: 'Active Semifinal Retry GP', titleShotPromised: false, participantIds: retryCandidates.slice(0, 4).map(f => f.id), reserveIds: retryCandidates.slice(4).map(f => f.id) });
  const retryTournamentId = Object.keys(retryState.tournaments).find(id => retryState.tournaments[id].name === 'Active Semifinal Retry GP')!;
  retryState.tournaments[retryTournamentId] = {
    ...retryState.tournaments[retryTournamentId],
    status: 'active',
    earliestRoundDate: null,
    roundDelayReason: 'Prior semifinal host was cancelled.',
    fights: retryState.tournaments[retryTournamentId].fights.map(slot => slot.round === 'semifinal' ? { ...slot, eventId: undefined, fightId: undefined, isCompleted: false } : slot)
  };
  retryState.events = {
    'retry-host': { id: 'retry-host', name: 'Retry Host Event', date: '2026-06-15', venueId: Object.keys(retryState.venues)[0], ticketPrice: 30, marketingSpend: 1000, fights: [], isCompleted: false }
  };
  retryState = runAutopilotTournaments(retryState);
  const retriedSemifinals = retryState.tournaments[retryTournamentId].fights.filter(slot => slot.round === 'semifinal');
  if (retriedSemifinals.some(slot => slot.eventId !== 'retry-host' || !slot.fightId) || retryState.events['retry-host'].fights.filter(fight => fight.tournamentId === retryTournamentId && fight.tournamentRound === 'semifinal').length !== 2) {
    throw new Error('Observer autopilot must reschedule an unscheduled active 4-man semifinal round.');
  }
  console.log("✅ ACTIVE 4-MAN SEMIFINAL RETRY REGRESSION PASSED!");

  console.log("\n=== RUNNING MULTIPLE TITLE-SHOT PROMISE REGRESSION ===");
  const promiseState = generateInitialWorld(3030);
  const promiseWinner = Object.values(promiseState.fighters).find(fighter => fighter.weightClass === 'Lightweight')!;
  promiseState.fighters[promiseWinner.id] = { ...promiseWinner, titleShotPromised: true };
  const tournamentBase = {
    id: 'used-promise', name: 'Used Promise GP', shortName: 'Used GP', weightClass: 'Lightweight' as const, status: 'completed' as const, format: 'four_man' as const,
    createdDate: '2024-01-01', completedDate: '2024-06-01', participants: [], reserveFighterIds: [], usedReserveFighterIds: [], fights: [], titleShotPromised: true,
    titleShotUsed: true, winnerId: promiseWinner.id, prestige: 70, notes: []
  };
  promiseState.tournaments = {
    used: tournamentBase,
    unused: { ...tournamentBase, id: 'unused-promise', name: 'Unused Promise GP', titleShotUsed: false, completedDate: '2024-12-01' }
  };
  const promiseErrors = validateTournamentState(promiseState);
  if (promiseErrors.some(error => error.includes('still has titleShotPromised: true after titleShotUsed is true'))) {
    throw new Error('A fighter with another unused GP promise must retain titleShotPromised.');
  }
  console.log("✅ MULTIPLE TITLE-SHOT PROMISE REGRESSION PASSED!");

} catch (err: any) {
  console.error("❌ TEST FAILED:", err.message);
  process.exit(1);
}
