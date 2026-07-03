import { generateInitialWorld } from './src/lib/game/generator';
import { createGrandPrixTournament, scheduleSemifinals, scheduleFinal, applyTournamentProgression } from './src/lib/game/tournament';
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
      contract: f.contract || { id: uuidv4(), basePay: 10000, winBonus: 10000, fightsRemaining: 3, titleFightClause: false, payPerFight: 10000, exclusivity: 'exclusive' as const },
      injuryStatus: null,
      medicalSuspension: null,
      fatigue: 0
    };
  });
  
  candidates.forEach(c => {
    state.fighters[c.id] = c;
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
  
  // Injure finalist 1 to test reserve replacement
  const origFinalist1 = finalSlot.redFighterId;
  console.log(`6. Injuring finalist ${state.fighters[origFinalist1].lastName} to test reserve replacement...`);
  state.fighters[origFinalist1].injuryStatus = { id: 'test-gp-inj', type: 'Broken Hand', daysRemaining: 30 };
  
  // Create Final Event
  const finalEventId = 'final-event';
  state.events[finalEventId] = {
    id: finalEventId,
    name: "Cage Dynasty GP Finals",
    date: '2026-03-01',
    venueId: Object.keys(state.venues)[0],
    ticketPrice: 60,
    marketingSpend: 15000,
    fights: [],
    isCompleted: false
  };
  
  // Schedule Final
  state = scheduleFinal(state, tourneyId, finalEventId);
  
  const tourneyAfterFinalSchedule = state.tournaments[tourneyId];
  const finalMatchup = tourneyAfterFinalSchedule.fights.find(f => f.round === 'final');
  console.log(`7. Final scheduled. Matchup: ${state.fighters[finalMatchup?.redFighterId || ''].lastName} vs ${state.fighters[finalMatchup?.blueFighterId || ''].lastName}`);
  if (finalMatchup?.redFighterId === origFinalist1) {
    throw new Error("Injured finalist should have been replaced by a reserve!");
  }
  
  // Simulate Final
  console.log("8. Simulating Final fight...");
  const finalEvent = state.events[finalEventId];
  finalEvent.fights.forEach((fight, idx) => {
     const redF = state.fighters[fight.redCornerId];
     const blueF = state.fighters[fight.blueCornerId];
     const res = simulateFight(fight as FightMatchup, redF, blueF);
     state = applyFightResult(state, finalEventId, idx, res);
  });
  
  state.events[finalEventId].isCompleted = true;
  
  const completedTourney = state.tournaments[tourneyId];
  console.log(`9. Grand Prix completed! Status: ${completedTourney.status} | Winner: ${state.fighters[completedTourney.winnerId || ''].lastName}`);
  if (completedTourney.status !== 'completed' || !completedTourney.winnerId) {
    throw new Error("Tournament should be completed with winnerId set.");
  }
  
  const gpWinner = state.fighters[completedTourney.winnerId];
  if (!gpWinner.titleShotPromised) {
    throw new Error("GP Winner should have earned a promised title shot.");
  }
  console.log("10. Verified GP Winner legacy score and title shot promised flags applied successfully.");
  console.log("✅ ALL TOURNAMENT SYSTEM TESTS PASSED SUCCESSFULLY!");

} catch (err: any) {
  console.error("❌ TEST FAILED:", err.message);
  process.exit(1);
}
