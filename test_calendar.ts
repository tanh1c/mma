import { generateInitialWorld } from './src/lib/game/generator';
import { generateSeasonPlan, validateSeasonCalendarState } from './src/lib/game/season';
import { createGrandPrixTournament, bindTournamentToCalendarSlots, scheduleTournamentRound } from './src/lib/game/tournament';
import { repairEventAvailability } from './src/lib/game/autobooker';
import { WeightClass } from './src/types/game';
import { v4 as uuidv4 } from 'uuid';

console.log("=== RUNNING SEASON CALENDAR AND FUTURE AVAILABILITY UNIT TESTS ===");

try {
  let state = generateInitialWorld();
  state.currentDate = "2026-01-01";
  const year = 2026;

  // 1. Generate season plan
  console.log("1. Generating season plan for year 2026...");
  state.seasonPlans = {
    [year]: generateSeasonPlan(state, year)
  };
  const plan = state.seasonPlans[year];
  console.log(`   Season plan generated with ${plan.slots.length} slots.`);

  // 2. Ensure GP windows do not create fake GP rounds at generation
  const fakeGPRounds = plan.slots.filter(s => s.type === 'grand_prix_round' && !s.tournamentId);
  if (fakeGPRounds.length > 0) {
    throw new Error(`FAIL: Found ${fakeGPRounds.length} fake grand_prix_round slots without tournamentId.`);
  }
  console.log("✅ GP windows do not create fake GP rounds.");

  // 3. Create 4-man tournament and verify future round slots
  console.log("2. Testing 4-man tournament binding...");
  const lwFighters = Object.values(state.fighters).filter(f => f.weightClass === 'Lightweight' && !f.isChampion);
  const candidates4 = lwFighters.slice(0, 6).map(f => ({
    ...f,
    contract: f.contract || { fightsRemaining: 4, payPerFight: 5000, winBonus: 5000, exclusivity: true },
    injuryStatus: null,
    medicalSuspension: null,
    fatigue: 0
  }));
  candidates4.forEach(c => { state.fighters[c.id] = c; });

  state = createGrandPrixTournament(state, {
    weightClass: 'Lightweight',
    name: 'LW 4-Man GP',
    titleShotPromised: true,
    format: 'four_man',
    participantIds: candidates4.slice(0, 4).map(c => c.id),
    reserveIds: candidates4.slice(4, 6).map(c => c.id)
  });

  const tourney4 = Object.values(state.tournaments).find(t => t.name === 'LW 4-Man GP')!;
  state = bindTournamentToCalendarSlots(state, tourney4.id);

  const bound4Slots = state.seasonPlans[year].slots.filter(s => s.tournamentId === tourney4.id);
  console.log(`   Found ${bound4Slots.length} slots bound to LW 4-Man GP.`);
  if (bound4Slots.length !== 2) {
    throw new Error(`FAIL: 4-Man GP should bind to 2 slots, found ${bound4Slots.length}.`);
  }
  if (bound4Slots.some(s => s.status !== 'planned' || !s.tournamentRound)) {
    throw new Error("FAIL: Bound slots must be planned and have round assigned.");
  }
  console.log("✅ 4-Man GP binding verified successfully.");

  // 4. Create 8-man tournament and verify future round slots
  console.log("3. Testing 8-man tournament binding...");
  const hwFighters = Object.values(state.fighters).filter(f => f.weightClass === 'Heavyweight' && !f.isChampion);
  const candidates8 = hwFighters.slice(0, 11).map(f => ({
    ...f,
    contract: f.contract || { fightsRemaining: 4, payPerFight: 5000, winBonus: 5000, exclusivity: true },
    injuryStatus: null,
    medicalSuspension: null,
    fatigue: 0
  }));
  candidates8.forEach(c => { state.fighters[c.id] = c; });

  state = createGrandPrixTournament(state, {
    weightClass: 'Heavyweight',
    name: 'HW 8-Man GP',
    titleShotPromised: true,
    format: 'eight_man',
    participantIds: candidates8.slice(0, 8).map(c => c.id),
    reserveIds: candidates8.slice(8, 11).map(c => c.id)
  });

  const tourney8 = Object.values(state.tournaments).find(t => t.name === 'HW 8-Man GP')!;
  state = bindTournamentToCalendarSlots(state, tourney8.id);

  const bound8Slots = state.seasonPlans[year].slots.filter(s => s.tournamentId === tourney8.id);
  console.log(`   Found ${bound8Slots.length} slots bound to HW 8-Man GP.`);
  if (bound8Slots.length !== 3) {
    throw new Error(`FAIL: 8-Man GP should bind to 3 slots, found ${bound8Slots.length}.`);
  }
  console.log("✅ 8-Man GP binding verified successfully.");

  // 5. Future availability repair test
  console.log("4. Testing future availability repair...");
  const eventId = uuidv4();
  const f1 = candidates4[0];
  const f2 = candidates4[1];

  // Schedule a normal fight on a dummy event
  state.events[eventId] = {
    id: eventId,
    name: "Test Card",
    date: "2026-06-15",
    venueId: "dummy-venue",
    ticketPrice: 50,
    marketingSpend: 10000,
    isCompleted: false,
    fights: [
      {
        id: uuidv4(),
        redCornerId: f1.id,
        blueCornerId: f2.id,
        weightClass: 'Lightweight',
        isTitleFight: false,
        rounds: 3
      }
    ]
  };

  // Check initial state
  console.log("   Initial scheduled fight: Moore vs Ramirez (or similar candidates)");
  
  // Injure the red corner fighter
  state.fighters[f1.id].injuryStatus = {
    id: uuidv4(),
    type: "Broken Hand",
    daysRemaining: 60
  };
  console.log(`   Injured fighter: ${f1.firstName} ${f1.lastName}`);

  // Run repairEventAvailability
  state = repairEventAvailability(state, eventId);

  const repairedEvent = state.events[eventId];
  const repairedFight = repairedEvent.fights[0];
  if (repairedFight) {
    if (repairedFight.redCornerId === f1.id) {
      throw new Error("FAIL: Injured fighter Moore was not replaced in normal fight.");
    }
    const replFighter = state.fighters[repairedFight.redCornerId];
    console.log(`   Fighter replaced! New matchup: ${replFighter.firstName} ${replFighter.lastName} vs ${f2.firstName} ${f2.lastName}`);
  } else {
    console.log("   No suitable replacement found, fight was removed.");
  }
  console.log("✅ Future availability repair test passed.");

  // 6. Validate calendar integrity
  console.log("5. Running Calendar Integrity Validator...");
  const errors = validateSeasonCalendarState(state);
  if (errors.length > 0) {
    console.error("FAIL: Calendar integrity validation errors detected:");
    errors.forEach(err => console.error(` - ${err}`));
    throw new Error("Calendar validation failed.");
  }
  console.log("✅ Calendar Integrity validation returned 0 errors!");

  console.log("\n✅ ALL CALENDAR AND AVAILABILITY UNIT TESTS PASSED SUCCESSFULLY!");
} catch (e: any) {
  console.error("❌ UNIT TEST FAILED:", e.message);
  process.exit(1);
}
