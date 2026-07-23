import { generateInitialWorld } from './src/lib/game/generator';
import { generateSeasonPlan, validateSeasonCalendarState } from './src/lib/game/season';
import { createGrandPrixTournament, bindTournamentToCalendarSlots, scheduleTournamentRound, validateTournamentState } from './src/lib/game/tournament';
import { autoBookEventsAndContracts, repairEventAvailability } from './src/lib/game/autobooker';
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
    contract: { ...(f.contract || { fightsRemaining: 4, payPerFight: 5000, winBonus: 5000, exclusivity: true, endDate: '2027-01-01' }), promotionId: state.playerPromotionId },
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
    contract: { ...(f.contract || { fightsRemaining: 4, payPerFight: 5000, winBonus: 5000, exclusivity: true, endDate: '2027-01-01' }), promotionId: state.playerPromotionId },
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
  if (repairedEvent.fights.some(fight =>
    state.fighters[fight.redCornerId].contract?.promotionId !== state.playerPromotionId ||
    state.fighters[fight.blueCornerId].contract?.promotionId !== state.playerPromotionId
  )) {
    throw new Error('FAIL: Player event repair inserted a rival fighter.');
  }
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

  // 5. Starter-reputation GP windows must create a 4-man tournament through autopilot.
  console.log("5. Testing starter-reputation GP creation...");
  let starterGpState = generateInitialWorld();
  starterGpState.currentDate = '2026-04-01';
  starterGpState.promotion = { ...starterGpState.promotion, reputation: 20, money: 250000 };
  const starterParticipants = Object.values(starterGpState.fighters)
    .filter(fighter => fighter.weightClass === 'Lightweight' && !fighter.isChampion)
    .slice(0, 6)
    .map(fighter => ({
      ...fighter,
      contract: { promotionId: starterGpState.playerPromotionId, fightsRemaining: 4, payPerFight: 5000, winBonus: 5000, exclusivity: true, endDate: '2027-01-01' },
      injuryStatus: null,
      medicalSuspension: null,
      fatigue: 0
    }));
  starterParticipants.forEach(fighter => { starterGpState.fighters[fighter.id] = fighter; });
  Object.values(starterGpState.events).forEach(event => {
    if (!event.isCompleted) event.fights = event.fights.filter(fight => !starterParticipants.some(fighter => fighter.id === fight.redCornerId || fighter.id === fight.blueCornerId));
  });
  starterGpState.events['starter-completed-event'] = {
    id: 'starter-completed-event', name: 'Starter Completed Event', date: '2026-03-01', venueId: Object.keys(starterGpState.venues)[0], ticketPrice: 20, marketingSpend: 1000, fights: [], isCompleted: true
  };
  starterGpState.seasonPlans = {
    2026: {
      ...starterGpState.seasonPlans[2026],
      slots: [
        { id: 'starter-completed-slot', year: 2026, date: '2026-03-01', type: 'regular_event', status: 'completed', eventId: 'starter-completed-event', priority: 1, notes: [] },
        { id: 'starter-gp-window', year: 2026, date: '2026-04-02', type: 'grand_prix_window', status: 'planned', priority: 1, notes: [] },
        { id: 'starter-gp-final', year: 2026, date: '2026-06-01', type: 'regular_event', status: 'planned', priority: 1, notes: [] }
      ]
    }
  };
  starterGpState = autoBookEventsAndContracts(starterGpState);
  const starterTournament = Object.values(starterGpState.tournaments)[0];
  const starterSlot = starterGpState.seasonPlans[2026].slots.find(slot => slot.id === 'starter-gp-window');
  if (!starterTournament || starterTournament.format !== 'four_man' || starterSlot?.type !== 'grand_prix_round' || starterSlot.tournamentId !== starterTournament.id || starterSlot.tournamentRound !== 'semifinal') {
    throw new Error('FAIL: starter-reputation GP window did not create and link a 4-man tournament.');
  }
  if (!starterSlot.eventId || !starterGpState.events[starterSlot.eventId]?.fights.some(fight => fight.tournamentId === starterTournament.id)) {
    throw new Error('FAIL: starter-reputation GP round did not schedule tournament fights.');
  }
  const starterCalendarErrors = validateSeasonCalendarState(starterGpState);
  const starterTournamentErrors = validateTournamentState(starterGpState);
  if (starterCalendarErrors.length || starterTournamentErrors.length) {
    throw new Error(`FAIL: starter-reputation GP creation violated calendar or tournament invariants: ${[...starterCalendarErrors, ...starterTournamentErrors].join('; ')}`);
  }
  console.log("✅ Starter-reputation GP creation verified.");

  // 6. An existing event on a GP window date must receive the tournament round.
  console.log("6. Testing GP window with an existing event...");
  let existingGpState = structuredClone(starterGpState);
  existingGpState.tournaments = {};
  existingGpState.currentDate = '2026-04-01';
  existingGpState.autopilot.targetTournamentWeightClass = null;
  existingGpState.events = { 'starter-completed-event': existingGpState.events['starter-completed-event'] };
  existingGpState.seasonPlans[2026].slots = existingGpState.seasonPlans[2026].slots.map(slot => slot.id === 'starter-gp-window' ? { ...slot, type: 'grand_prix_window', status: 'planned', targetWeightClass: undefined, tournamentId: undefined, tournamentRound: undefined, eventId: undefined, notes: [] } : slot.id === 'starter-gp-final' ? { ...slot, type: 'regular_event', status: 'planned', targetWeightClass: undefined, tournamentId: undefined, tournamentRound: undefined, eventId: undefined, notes: [] } : slot);
  existingGpState.events['existing-gp-event'] = { id: 'existing-gp-event', name: 'Existing GP Host', date: '2026-04-02', venueId: Object.keys(existingGpState.venues)[0], ticketPrice: 30, marketingSpend: 1000, fights: [], isCompleted: false };
  existingGpState = autoBookEventsAndContracts(existingGpState);
  const existingTournament = Object.values(existingGpState.tournaments)[0];
  const existingEvent = existingGpState.events['existing-gp-event'];
  if (!existingTournament || existingTournament.status !== 'active' || !existingEvent?.fights.some(fight => fight.tournamentId === existingTournament.id)) {
    const slot = existingGpState.seasonPlans[2026].slots.find(item => item.id === 'starter-gp-window');
    throw new Error(`FAIL: existing event on GP window date did not receive and activate the tournament round: tournament=${existingTournament?.status}, slot=${slot?.type}/${slot?.status}/${slot?.tournamentRound}, event=${existingEvent?.fights.length}, notes=${slot?.notes?.join('|')}`);
  }
  console.log("✅ Existing GP host event binding verified.");

  // 7. A blocked GP window must create exactly one retry window.
  console.log("7. Testing blocked GP window retry...");
  let retryState = generateInitialWorld();
  retryState.currentDate = '2026-04-01';
  retryState.promotion = { ...retryState.promotion, reputation: 50, money: 250000 };
  const activeParticipants = Object.values(retryState.fighters).filter(f => f.contract && f.weightClass === 'Lightweight' && !f.isChampion).slice(0, 6);
  activeParticipants.forEach(fighter => {
    retryState.fighters[fighter.id] = { ...fighter, contract: { ...fighter.contract!, promotionId: retryState.playerPromotionId }, injuryStatus: null, medicalSuspension: null, fatigue: 0 };
  });
  retryState = createGrandPrixTournament(retryState, {
    weightClass: 'Lightweight',
    name: 'Blocking Lightweight GP',
    titleShotPromised: true,
    format: 'four_man',
    participantIds: activeParticipants.slice(0, 4).map(fighter => fighter.id),
    reserveIds: activeParticipants.slice(4).map(fighter => fighter.id)
  });
  retryState.seasonPlans = {
    2026: {
      ...retryState.seasonPlans[2026],
      slots: [
        { id: 'completed-regular-event', year: 2026, date: '2026-03-01', type: 'regular_event', status: 'completed', priority: 1, notes: [] },
        { id: 'blocked-gp-window', year: 2026, date: '2026-04-02', type: 'grand_prix_window', status: 'planned', priority: 1, notes: [] }
      ]
    }
  };
  retryState = autoBookEventsAndContracts(retryState);
  const retryPlan = retryState.seasonPlans[2026];
  const convertedWindow = retryPlan.slots.find(slot => slot.id === 'blocked-gp-window');
  const retries = retryPlan.slots.filter(slot => slot.type === 'grand_prix_window' && slot.status === 'planned');
  if (convertedWindow?.type !== 'regular_event' || retries.length !== 1 || retries[0].date <= retryState.currentDate) {
    throw new Error(`FAIL: blocked GP window did not create one future retry: ${retryPlan.slots.map(slot => `${slot.id}:${slot.type}:${slot.status}:${slot.date}`).join(', ')}`);
  }
  retryState = autoBookEventsAndContracts(retryState);
  if (retryState.seasonPlans[2026].slots.filter(slot => slot.type === 'grand_prix_window' && slot.status === 'planned').length !== 1) {
    throw new Error('FAIL: blocked GP window created duplicate retries.');
  }
  console.log("✅ Blocked GP window retry verified.");

  // 8. Validate calendar integrity
  console.log("8. Running Calendar Integrity Validator...");
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
