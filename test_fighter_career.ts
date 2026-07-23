import assert from 'node:assert/strict';
import { applyFighterEdit, calculateHallOfFameScore, derivePrimeEndAge, processAnnualCareerLifecycle, processFighterCareerYear, retireFighter, updateHallOfFame, type FighterEditInput } from './src/lib/game/career';
import { getFighterOverall } from './src/lib/game/fighterRatings';
import { advanceTime } from './src/lib/engine';
import { generateInitialWorld } from './src/lib/game/generator';
import { CURRENT_SAVE_VERSION, validateAndMigrateState } from './src/lib/game/save';
import { validateTournamentState } from './src/lib/game/tournament';
import type { Fighter, FightArchiveItem } from './src/types/game';

const world = generateInitialWorld(71);
for (const fighter of Object.values(world.fighters)) {
  assert.ok(fighter.primeEndAge >= 30 && fighter.primeEndAge <= 34);
  assert.equal(fighter.primeEndAge, derivePrimeEndAge(fighter));
  assert.equal(fighter.lastLifecycleYear, 2025);
  assert.ok(['developing', 'prime', 'declining'].includes(fighter.careerPhase));
  if (fighter.careerPhase === 'declining') assert.equal(fighter.potential, getFighterOverall(fighter));
}
assert.deepEqual(world.careerEcosystem, { rookieClassYears: [], emergencyProspectDates: {} });

const legacy = structuredClone(world) as any;
legacy.saveVersion = 10;
delete legacy.careerEcosystem;
for (const fighter of Object.values(legacy.fighters) as any[]) {
  delete fighter.careerPhase;
  delete fighter.primeEndAge;
  delete fighter.lastLifecycleYear;
}
const oldFighter = Object.values(legacy.fighters)[0] as any;
oldFighter.age = 50;
const migrated = validateAndMigrateState(legacy)!;
assert.equal(CURRENT_SAVE_VERSION, 16);
assert.equal(migrated.saveVersion, 16);
assert.equal(migrated.fighters[oldFighter.id].lastLifecycleYear, 2025);
assert.notEqual(migrated.fighters[oldFighter.id].careerPhase, 'retired');
assert.ok(migrated.fighters[oldFighter.id].primeEndAge >= 30 && migrated.fighters[oldFighter.id].primeEndAge <= 34);
assert.deepEqual(migrated.careerEcosystem, { rookieClassYears: [], emergencyProspectDates: {} });

const baseFighter = Object.values(world.fighters).find(fighter => fighter.age <= 24)!;
const editInput = (fighter: Fighter, overrides: Partial<FighterEditInput> = {}): FighterEditInput => ({
  firstName: fighter.firstName,
  lastName: fighter.lastName,
  nickname: fighter.nickname,
  age: fighter.age,
  nationality: fighter.nationality,
  weightClass: fighter.weightClass,
  heightCm: fighter.heightCm,
  fightWeightLb: fighter.fightWeightLb,
  walkAroundWeightLb: fighter.walkAroundWeightLb,
  style: fighter.style,
  attributes: { ...fighter.attributes },
  potential: fighter.potential,
  popularity: fighter.popularity,
  morale: fighter.morale,
  momentum: fighter.momentum,
  fatigue: fighter.fatigue,
  ...overrides
});

const editable = { ...baseFighter, rankingScore: 1234, injuryStatus: { id: 'protected-injury', type: 'Hand Injury', daysRemaining: 30 } };
const editWorld = { ...world, fighters: { ...world.fighters, [editable.id]: editable } };
const protectedBefore = {
  record: editable.record,
  contract: editable.contract,
  counterOffer: editable.counterOffer,
  isChampion: editable.isChampion,
  titleDefenses: editable.titleDefenses,
  rankingScore: editable.rankingScore,
  history: editable.history,
  injuryStatus: editable.injuryStatus,
  medicalSuspension: editable.medicalSuspension,
  titleShotPromised: editable.titleShotPromised,
  primeEndAge: editable.primeEndAge,
  lastLifecycleYear: editable.lastLifecycleYear,
  retiredDate: editable.retiredDate,
  retirementReason: editable.retirementReason,
  hallOfFame: editable.hallOfFame
};
const editedResult = applyFighterEdit(editWorld, editable.id, editInput(editable, {
  firstName: '  Edited  ',
  lastName: ' Fighter ',
  nickname: '  The Test  ',
  age: 40,
  nationality: '  Canada  ',
  attributes: Object.fromEntries(Object.keys(editable.attributes).map(key => [key, 80])) as unknown as Fighter['attributes'],
  potential: 20,
  popularity: 70,
  morale: 65,
  momentum: 60,
  fatigue: 25
}));
assert.equal(editedResult.ok, true);
if (!editedResult.ok) throw new Error('Expected fighter edit to succeed.');
const edited = editedResult.state.fighters[editable.id];
assert.equal(edited.firstName, 'Edited');
assert.equal(edited.lastName, 'Fighter');
assert.equal(edited.nickname, 'The Test');
assert.equal(edited.nationality, 'Canada');
assert.equal(edited.age, 40);
assert.equal(edited.careerPhase, 'declining');
assert.equal(edited.potential, getFighterOverall(edited));
assert.deepEqual({
  record: edited.record,
  contract: edited.contract,
  counterOffer: edited.counterOffer,
  isChampion: edited.isChampion,
  titleDefenses: edited.titleDefenses,
  rankingScore: edited.rankingScore,
  history: edited.history,
  injuryStatus: edited.injuryStatus,
  medicalSuspension: edited.medicalSuspension,
  titleShotPromised: edited.titleShotPromised,
  primeEndAge: edited.primeEndAge,
  lastLifecycleYear: edited.lastLifecycleYear,
  retiredDate: edited.retiredDate,
  retirementReason: edited.retirementReason,
  hallOfFame: edited.hallOfFame
}, protectedBefore);
assert.equal(editedResult.state.titleHistory, editWorld.titleHistory);
assert.equal(editedResult.state.fightArchive, editWorld.fightArchive);

const invalidEdit = applyFighterEdit(editWorld, editable.id, editInput(editable, { firstName: '   ' }));
assert.deepEqual(invalidEdit, { ok: false, error: 'invalid-name', state: editWorld });
const physicalEdit = applyFighterEdit(editWorld, editable.id, editInput(editable, { walkAroundWeightLb: editable.fightWeightLb }));
assert.deepEqual(physicalEdit, { ok: false, error: 'invalid-physical-profile', state: editWorld });
const fractionalAttributes = applyFighterEdit(editWorld, editable.id, editInput(editable, { attributes: { ...editable.attributes, fightIq: 72.5 } }));
assert.equal(fractionalAttributes.ok, true);

const expectEditError = (result: ReturnType<typeof applyFighterEdit>, error: string) => {
  assert.equal(result.ok, false);
  if (result.ok) throw new Error('Expected fighter edit to fail.');
  assert.equal(result.error, error);
};
const otherWeightClass = editable.weightClass === 'Lightweight' ? 'Welterweight' : 'Lightweight';
const weightClassInput = editInput(editable, { weightClass: otherWeightClass });
const titledWorld = structuredClone(editWorld);
titledWorld.titles[editable.weightClass].undisputedChampionId = editable.id;
expectEditError(applyFighterEdit(titledWorld, editable.id, weightClassInput), 'weight-class-title');
const bookedWorld = structuredClone(editWorld);
bookedWorld.events.editorBooking = { id: 'editorBooking', name: 'Editor Booking', date: '2026-03-01', venueId: Object.keys(bookedWorld.venues)[0], ticketPrice: 50, marketingSpend: 1000, isCompleted: false, fights: [{ id: 'editorFight', redCornerId: editable.id, blueCornerId: Object.values(bookedWorld.fighters).find(fighter => fighter.id !== editable.id)!.id, weightClass: editable.weightClass, isTitleFight: false, rounds: 3 }] };
expectEditError(applyFighterEdit(bookedWorld, editable.id, weightClassInput), 'weight-class-booked');
const gpWorld = structuredClone(editWorld);
gpWorld.tournaments.editorGp = { id: 'editorGp', name: 'Editor GP', shortName: 'EGP', weightClass: editable.weightClass, status: 'planned', format: 'four_man', createdDate: '2026-01-01', participants: [{ fighterId: editable.id, seed: 1 }], reserveFighterIds: [], fights: [], prestige: 50 };
expectEditError(applyFighterEdit(gpWorld, editable.id, weightClassInput), 'weight-class-tournament');
const debtWorld = structuredClone(editWorld);
debtWorld.tournaments.editorDebt = { id: 'editorDebt', name: 'Editor Debt', shortName: 'ED', weightClass: editable.weightClass, status: 'completed', format: 'four_man', createdDate: '2025-01-01', completedDate: '2025-06-01', participants: [], reserveFighterIds: [], fights: [], winnerId: editable.id, titleShotPromised: true, titleShotUsed: false, prestige: 50 };
expectEditError(applyFighterEdit(debtWorld, editable.id, weightClassInput), 'weight-class-title-shot');

const developing: Fighter = {
  ...baseFighter,
  age: 23,
  primeEndAge: 32,
  careerPhase: 'developing',
  potential: Math.min(95, getFighterOverall(baseFighter) + 15),
  injuryStatus: null,
  lastFightDate: '2025-11-01'
};
const opponent = Object.values(world.fighters).find(fighter => fighter.id !== developing.id)!;
const careerFight = (id: string, date: string, winnerId: string | null, performanceRating: number): FightArchiveItem => ({
  id,
  date,
  eventId: `event-${id}`,
  eventName: 'Career Test',
  weightClass: developing.weightClass,
  redFighterId: developing.id,
  blueFighterId: opponent.id,
  winnerId,
  method: 'Unanimous Decision',
  round: 3,
  time: '5:00',
  isTitleFight: false,
  performanceRating
});
const activeState = {
  ...world,
  currentDate: '2026-01-01',
  fighters: { ...world.fighters, [developing.id]: developing },
  fightArchive: {
    active1: careerFight('active1', '2025-06-01', developing.id, 82),
    active2: careerFight('active2', '2025-11-01', developing.id, 88)
  }
};
const activeOutcome = processFighterCareerYear(activeState, developing, 2026);
const repeatedOutcome = processFighterCareerYear(activeState, developing, 2026);
assert.deepEqual(activeOutcome, repeatedOutcome);
assert.ok(getFighterOverall(activeOutcome.fighter) >= getFighterOverall(developing));
assert.ok(getFighterOverall(activeOutcome.fighter) <= activeOutcome.fighter.potential);

const inactiveInjured = { ...developing, id: `${developing.id}-inactive`, injuryStatus: { id: 'career-injury', type: 'Knee Injury', daysRemaining: 120 }, lastFightDate: '2023-01-01' };
const inactiveOutcome = processFighterCareerYear({ ...activeState, fighters: { ...activeState.fighters, [inactiveInjured.id]: inactiveInjured }, fightArchive: {} }, inactiveInjured, 2026);
assert.ok(getFighterOverall(activeOutcome.fighter) >= getFighterOverall(inactiveOutcome.fighter));

const prime = { ...developing, age: 31, careerPhase: 'prime' as const, potential: Math.min(95, getFighterOverall(developing) + 8) };
const primeOutcome = processFighterCareerYear({ ...activeState, fighters: { ...activeState.fighters, [prime.id]: prime } }, prime, 2026);
assert.ok(primeOutcome.fighter.potential <= prime.potential);
assert.ok(primeOutcome.fighter.potential >= getFighterOverall(primeOutcome.fighter));

const declining = { ...developing, age: 38, careerPhase: 'declining' as const, potential: getFighterOverall(developing), lastFightDate: '2023-01-01' };
const decliningOutcome = processFighterCareerYear({ ...activeState, fighters: { ...activeState.fighters, [declining.id]: declining }, fightArchive: {} }, declining, 2026);
const earlyLoss = (developing.attributes.speed - decliningOutcome.fighter.attributes.speed)
  + (developing.attributes.cardio - decliningOutcome.fighter.attributes.cardio)
  + (developing.attributes.chin - decliningOutcome.fighter.attributes.chin);
const preservedLoss = (developing.attributes.power - decliningOutcome.fighter.attributes.power)
  + (developing.attributes.toughness - decliningOutcome.fighter.attributes.toughness)
  + (developing.attributes.fightIq - decliningOutcome.fighter.attributes.fightIq);
assert.ok(earlyLoss >= preservedLoss);
assert.equal(decliningOutcome.fighter.potential, getFighterOverall(decliningOutcome.fighter));

const mandatoryRetirement = processFighterCareerYear(activeState, { ...declining, age: 45 }, 2026);
assert.equal(mandatoryRetirement.shouldRetire, true);
assert.equal(mandatoryRetirement.retirementReason, 'age');

const retiring: Fighter = {
  ...declining,
  id: 'retirement-fixture',
  age: 45,
  contract: { fightsRemaining: 3, payPerFight: 100_000, winBonus: 50_000, exclusivity: true, endDate: '2028-01-01' },
  counterOffer: { payPerFight: 120_000, winBonus: 60_000, fights: 4, expiresDate: '2026-02-01', interest: 80 },
  isChampion: true,
  titleDefenses: 2,
  titleShotPromised: true,
  history: ['Preserved career history']
};
const retirementWorld = structuredClone(world);
retirementWorld.currentDate = '2026-01-01';
const retirementPromotionId = Object.keys(retirementWorld.promotions).find(id => id !== retirementWorld.playerPromotionId)!;
retiring.contract = { ...retiring.contract!, promotionId: retirementPromotionId };
retirementWorld.fighters[retiring.id] = retiring;
retirementWorld.titles[retiring.weightClass] = {
  ...retirementWorld.titles[retiring.weightClass],
  undisputedChampionId: retiring.id,
  undisputedDefenses: 2,
  status: 'active'
};
retirementWorld.titlesByPromotion[retirementPromotionId][retiring.weightClass] = {
  ...retirementWorld.titlesByPromotion[retirementPromotionId][retiring.weightClass],
  undisputedChampionId: retiring.id,
  undisputedDefenses: 2,
  status: 'active'
};
retirementWorld.rankings[retiring.weightClass] = [
  { fighterId: retiring.id, rank: 1, trend: 0 },
  ...retirementWorld.rankings[retiring.weightClass].filter(item => item.fighterId !== retiring.id)
];
const retirementPool = Object.values(retirementWorld.fighters).filter(fighter => fighter.id !== retiring.id && fighter.id !== opponent.id && fighter.weightClass === retiring.weightClass && fighter.contract);
const [retirementReserve, retirementOtherRed, retirementOtherBlue] = retirementPool;
retirementWorld.events.retirementEvent = {
  id: 'retirementEvent',
  name: 'Retirement Booking',
  date: '2026-03-01',
  venueId: Object.keys(retirementWorld.venues)[0],
  ticketPrice: 50,
  marketingSpend: 1000,
  isCompleted: false,
  fights: [{ id: 'retirementFight', redCornerId: retiring.id, blueCornerId: opponent.id, weightClass: retiring.weightClass, isTitleFight: true, rounds: 5 }]
};
retirementWorld.events.retirementGpEvent = {
  id: 'retirementGpEvent',
  name: 'Retirement GP Semifinal',
  date: '2026-03-08',
  venueId: Object.keys(retirementWorld.venues)[0],
  ticketPrice: 50,
  marketingSpend: 1000,
  isCompleted: false,
  fights: [
    { id: 'retirementGpFight', redCornerId: retiring.id, blueCornerId: opponent.id, weightClass: retiring.weightClass, isTitleFight: false, rounds: 3, tournamentId: 'activeRetirementGp', tournamentRound: 'semifinal', tournamentFightSlotId: 'activeRetirementSlot' },
    { id: 'retirementGpOtherFight', redCornerId: retirementOtherRed.id, blueCornerId: retirementOtherBlue.id, weightClass: retiring.weightClass, isTitleFight: false, rounds: 3, tournamentId: 'activeRetirementGp', tournamentRound: 'semifinal', tournamentFightSlotId: 'activeRetirementOtherSemi' }
  ]
};
retirementWorld.tournaments.activeRetirementGp = {
  id: 'activeRetirementGp',
  name: 'Active Retirement GP',
  shortName: 'ARGP',
  weightClass: retiring.weightClass,
  status: 'active',
  format: 'four_man',
  createdDate: '2025-12-01',
  participants: [{ fighterId: retiring.id, seed: 1 }, { fighterId: opponent.id, seed: 2 }, { fighterId: retirementOtherRed.id, seed: 3 }, { fighterId: retirementOtherBlue.id, seed: 4 }],
  reserveFighterIds: [retirementReserve.id],
  fights: [
    { id: 'activeRetirementSlot', round: 'semifinal', fightId: 'retirementGpFight', eventId: 'retirementGpEvent', redFighterId: retiring.id, blueFighterId: opponent.id, isCompleted: false },
    { id: 'activeRetirementOtherSemi', round: 'semifinal', fightId: 'retirementGpOtherFight', eventId: 'retirementGpEvent', redFighterId: retirementOtherRed.id, blueFighterId: retirementOtherBlue.id, isCompleted: false },
    { id: 'activeRetirementFinal', round: 'final', isCompleted: false }
  ],
  titleShotPromised: true,
  titleShotUsed: false,
  prestige: 80
};
retirementWorld.seasonPlans = {
  2026: {
    year: 2026,
    createdDate: '2025-12-01',
    targetEvents: 1,
    targetTentpoles: 0,
    targetGrandPrix: 1,
    status: 'active',
    slots: [{
      id: 'retirement-gp-calendar-slot',
      year: 2026,
      date: '2026-03-08',
      type: 'grand_prix_round',
      status: 'scheduled',
      targetWeightClass: retiring.weightClass,
      tournamentId: 'activeRetirementGp',
      tournamentRound: 'semifinal',
      eventId: 'retirementGpEvent',
      priority: 1
    }]
  }
};
const completedSemifinalResult = {
  winnerId: retirementOtherRed.id,
  loserId: retirementOtherBlue.id,
  method: 'Unanimous Decision' as const,
  round: 3,
  time: '5:00',
  commentary: ['Completed before retirement cleanup.'],
  performanceRating: 75
};
retirementWorld.events.retirementGpEvent.fights[1].result = completedSemifinalResult;
Object.assign(retirementWorld.tournaments.activeRetirementGp.fights[1], {
  isCompleted: true,
  winnerId: retirementOtherRed.id,
  loserId: retirementOtherBlue.id
});
retirementWorld.tournaments.retirementGp = {
  id: 'retirementGp',
  name: 'Completed Retirement GP',
  shortName: 'RGP',
  weightClass: retiring.weightClass,
  status: 'completed',
  format: 'four_man',
  createdDate: '2025-01-01',
  completedDate: '2025-12-01',
  participants: [],
  reserveFighterIds: [],
  fights: [],
  winnerId: retiring.id,
  titleShotPromised: true,
  titleShotUsed: false,
  prestige: 80
};
retirementWorld.titleHistory.push({
  id: 'retirement-title-history',
  weightClass: retiring.weightClass,
  fighterId: retiring.id,
  dateWon: '2025-01-01',
  dateLost: null,
  defenses: 2,
  wonFromFighterId: null,
  status: 'active',
  beltType: 'undisputed'
});
retirementWorld.fightArchive.preserved = careerFight('preserved', '2025-01-01', retiring.id, 90);
const retired = retireFighter(retirementWorld, retiring.id, 'age', '2026-01-01', 'en');
assert.equal(retired.fighters[retiring.id].careerPhase, 'retired');
assert.equal(retired.fighters[retiring.id].retiredDate, '2026-01-01');
assert.equal(retired.fighters[retiring.id].contract, null);
assert.equal(retired.fighters[retiring.id].counterOffer, undefined);
assert.equal(retired.fighters[retiring.id].titleShotPromised, false);
assert.equal(retired.fighters[retiring.id].isChampion, false);
assert.equal(retired.titles[retiring.weightClass].undisputedChampionId, null);
assert.equal(retired.titlesByPromotion[retirementPromotionId][retiring.weightClass].undisputedChampionId, null);
assert.equal(retired.rankings[retiring.weightClass].some(item => item.fighterId === retiring.id), false);
assert.equal(retired.events.retirementEvent.fights.length, 0);
assert.equal(retired.events.retirementGpEvent.fights.length, 2);
const preservedCompletedSemifinal = retired.events.retirementGpEvent.fights.find(fight => fight.id === 'retirementGpOtherFight')!;
assert.deepEqual(preservedCompletedSemifinal.result, completedSemifinalResult);
assert.equal(retired.tournaments.activeRetirementGp.fights.find(item => item.id === 'activeRetirementOtherSemi')?.isCompleted, true);
const repairedRetirementFight = retired.events.retirementGpEvent.fights.find(fight => fight.tournamentFightSlotId === 'activeRetirementSlot')!;
assert.equal(repairedRetirementFight.redCornerId, retirementReserve.id);
assert.equal(retired.tournaments.activeRetirementGp.participants.some(item => item.fighterId === retiring.id), false);
assert.equal(retired.tournaments.activeRetirementGp.participants.some(item => item.fighterId === retirementReserve.id && item.replacementForFighterId === retiring.id), true);
assert.equal(retired.tournaments.activeRetirementGp.reserveFighterIds.includes(retirementReserve.id), false);
assert.equal(retired.tournaments.activeRetirementGp.fights.some(item => item.redFighterId === retiring.id || item.blueFighterId === retiring.id), false);
const repairedRetirementSlot = retired.tournaments.activeRetirementGp.fights.find(item => item.id === 'activeRetirementSlot')!;
assert.equal(repairedRetirementSlot.redFighterId, retirementReserve.id);
assert.equal(retired.tournaments.retirementGp.titleShotUsed, true);
assert.equal(retired.titleHistory.find(item => item.id === 'retirement-title-history')?.status, 'vacated');
assert.equal(retired.fightArchive.preserved, retirementWorld.fightArchive.preserved);
assert.deepEqual(retired.fighters[retiring.id].history, ['Preserved career history']);
assert.equal(retired.news.filter(item => item.id === 'career-retirement-fixture-2026-01-01').length, 1);
assert.deepEqual(retireFighter(retired, retiring.id, 'age', '2026-01-01', 'en'), retired);

const noReserveWorld = structuredClone(retirementWorld);
noReserveWorld.tournaments.activeRetirementGp.reserveFighterIds = [];
const retiredWithoutDeclaredReserve = retireFighter(noReserveWorld, retiring.id, 'age', '2026-01-01', 'en');
const repairedWithoutDeclaredReserve = retiredWithoutDeclaredReserve.tournaments.activeRetirementGp;
assert.equal(repairedWithoutDeclaredReserve.participants.some(item => item.fighterId === retiring.id), false);
assert.equal(repairedWithoutDeclaredReserve.fights.some(item => item.redFighterId === retiring.id || item.blueFighterId === retiring.id), false);
assert.equal(Object.values(retiredWithoutDeclaredReserve.events).some(event => !event.isCompleted && event.fights.some(fight => fight.redCornerId === retiring.id || fight.blueCornerId === retiring.id)), false);

const noReplacementWorld = structuredClone(noReserveWorld);
const originalCalendarSlot = structuredClone(noReplacementWorld.seasonPlans![2026].slots[0]);
const tournamentFighterIds = new Set(noReplacementWorld.tournaments.activeRetirementGp.participants.map(item => item.fighterId));
for (const candidate of Object.values(noReplacementWorld.fighters)) {
  if (candidate.weightClass === retiring.weightClass && !tournamentFighterIds.has(candidate.id)) candidate.contract = null;
}
const retiredWithoutReplacement = retireFighter(noReplacementWorld, retiring.id, 'age', '2026-01-01', 'en');
assert.equal(retiredWithoutReplacement.tournaments.activeRetirementGp.status, 'cancelled');
assert.equal(retiredWithoutReplacement.tournaments.activeRetirementGp.participants.some(item => item.fighterId === retiring.id), false);
assert.equal(retiredWithoutReplacement.tournaments.activeRetirementGp.fights.some(item => !item.isCompleted && (item.redFighterId === retiring.id || item.blueFighterId === retiring.id)), false);
assert.equal(retiredWithoutReplacement.tournaments.activeRetirementGp.fights.some(item => !item.isCompleted && (item.eventId || item.fightId)), false);
assert.equal(Object.values(retiredWithoutReplacement.events).some(event => !event.isCompleted && event.fights.some(fight => fight.tournamentId === 'activeRetirementGp' && !fight.result)), false);
assert.deepEqual(retiredWithoutReplacement.events.retirementGpEvent.fights.find(fight => fight.id === 'retirementGpOtherFight')?.result, completedSemifinalResult);
assert.equal(retiredWithoutReplacement.seasonPlans![2026].slots[0].status, 'cancelled');
assert.equal(retiredWithoutReplacement.seasonPlans![2026].slots[0].eventId, undefined);
assert.deepEqual(noReplacementWorld.seasonPlans![2026].slots[0], originalCalendarSlot);
assert.deepEqual(validateTournamentState(retiredWithoutReplacement), []);

const annualWorld = structuredClone(world);
annualWorld.currentDate = '2026-01-01';
const annualFighterId = Object.values(annualWorld.fighters)[0].id;
annualWorld.fighters[annualFighterId] = {
  ...annualWorld.fighters[annualFighterId],
  age: 44,
  primeEndAge: 32,
  careerPhase: 'declining',
  lastLifecycleYear: 2025
};
const annualProcessed = processAnnualCareerLifecycle(annualWorld, 2026, 'en');
assert.equal(annualProcessed.fighters[annualFighterId].age, 45);
assert.equal(annualProcessed.fighters[annualFighterId].lastLifecycleYear, 2026);
assert.equal(annualProcessed.fighters[annualFighterId].careerPhase, 'retired');
assert.deepEqual(processAnnualCareerLifecycle(annualProcessed, 2026, 'en'), annualProcessed);

const protectedAnnualWorld = structuredClone(annualWorld);
protectedAnnualWorld.tournaments.protectedInternational = {
  id: 'protectedInternational',
  name: 'Protected International Cup',
  shortName: 'PIC',
  weightClass: protectedAnnualWorld.fighters[annualFighterId].weightClass,
  status: 'active',
  format: 'eight_man',
  createdDate: '2025-07-01',
  participants: [{ fighterId: annualFighterId, seed: 1 }],
  reserveFighterIds: [],
  fights: [],
  scope: 'international',
  promotionId: null,
  titleShotPromised: false,
  titleShotUsed: false,
  prestige: 90
};
const protectedAnnualProcessed = processAnnualCareerLifecycle(protectedAnnualWorld, 2026, 'en');
assert.notEqual(protectedAnnualProcessed.fighters[annualFighterId].careerPhase, 'retired');
assert.equal(protectedAnnualProcessed.fighters[annualFighterId].contract?.promotionId, protectedAnnualWorld.fighters[annualFighterId].contract?.promotionId);

const multiYearWorld = structuredClone(world);
multiYearWorld.currentDate = '2025-12-31';
const multiYearId = Object.values(multiYearWorld.fighters)[0].id;
multiYearWorld.fighters[multiYearId] = {
  ...multiYearWorld.fighters[multiYearId],
  age: 20,
  potential: getFighterOverall(multiYearWorld.fighters[multiYearId]),
  lastLifecycleYear: 2025
};
const multiYearAdvanced = advanceTime(multiYearWorld, 732, 'en');
assert.equal(multiYearAdvanced.fighters[multiYearId].age, 23);
assert.equal(multiYearAdvanced.fighters[multiYearId].lastLifecycleYear, 2028);

const hallWorld = structuredClone(world);
hallWorld.currentDate = '2027-01-01';
const hallBase = Object.values(hallWorld.fighters).slice(0, 3);
const hallIds = ['hall-elite-one', 'hall-elite-two', 'hall-below'];
for (let index = 0; index < hallIds.length; index++) {
  hallWorld.fighters[hallIds[index]] = {
    ...hallBase[index],
    id: hallIds[index],
    careerPhase: 'retired',
    retiredDate: '2026-01-01',
    contract: null,
    record: index < 2
      ? { wins: 24, losses: 4, draws: 0, kos: 10, subs: 5 }
      : { wins: 4, losses: 8, draws: 0, kos: 1, subs: 0 },
    popularity: index < 2 ? 85 : 20
  };
}
for (const fighterId of hallIds.slice(0, 2)) {
  hallWorld.titleHistory.push({ id: `hall-title-${fighterId}`, weightClass: hallWorld.fighters[fighterId].weightClass, fighterId, dateWon: '2022-01-01', dateLost: '2025-01-01', defenses: 4, wonFromFighterId: null, status: 'lost', beltType: 'undisputed' });
  hallWorld.tournaments[`hall-gp-${fighterId}`] = { id: `hall-gp-${fighterId}`, name: 'Hall GP', shortName: 'HGP', weightClass: hallWorld.fighters[fighterId].weightClass, status: 'completed', format: 'four_man', createdDate: '2023-01-01', completedDate: '2023-06-01', participants: [], reserveFighterIds: [], fights: [], winnerId: fighterId, prestige: 80 };
}
assert.ok(calculateHallOfFameScore(hallWorld, hallIds[0]) >= 100);
assert.ok(calculateHallOfFameScore(hallWorld, hallIds[2]) < 100);
assert.equal(updateHallOfFame({ ...hallWorld, currentDate: '2026-12-31' }, 2026, 'en').fighters[hallIds[0]].hallOfFame, undefined);
const hallEnglish = updateHallOfFame(structuredClone(hallWorld), 2027, 'en');
const hallVietnamese = updateHallOfFame(structuredClone(hallWorld), 2027, 'vi');
assert.deepEqual(hallEnglish.fighters[hallIds[0]].hallOfFame, hallVietnamese.fighters[hallIds[0]].hallOfFame);
assert.equal(hallEnglish.fighters[hallIds[0]].hallOfFame?.inductedYear, 2027);
assert.equal(hallEnglish.fighters[hallIds[1]].hallOfFame?.inductedYear, 2027);
assert.equal(hallEnglish.fighters[hallIds[2]].hallOfFame, undefined);
assert.notEqual(hallEnglish.news[0].title, hallVietnamese.news[0].title);
const frozen = hallEnglish.fighters[hallIds[0]].hallOfFame;
const hallRepeated = updateHallOfFame({ ...hallEnglish, fighters: { ...hallEnglish.fighters, [hallIds[0]]: { ...hallEnglish.fighters[hallIds[0]], popularity: 0 } } }, 2028, 'en');
assert.deepEqual(hallRepeated.fighters[hallIds[0]].hallOfFame, frozen);
assert.equal(hallRepeated.news.filter(item => item.id.startsWith(`hall-of-fame:${hallIds[0]}:`)).length, 1);

console.log('Fighter career tests passed.');
