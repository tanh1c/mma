import assert from 'node:assert/strict';
import { ensureEmergencyProspectPool, generateAnnualRookieClass, scoreObserverRosterCandidate, shouldObserverRenewFighter } from './src/lib/game/careerEcosystem';
import { autoBookEventsAndContracts } from './src/lib/game/autobooker';
import { getFighterOverall } from './src/lib/game/fighterRatings';
import { generateInitialWorld } from './src/lib/game/generator';
import { WEIGHT_CLASSES } from './src/lib/game/constants';

const stripProse = (state: ReturnType<typeof generateInitialWorld>) => ({
  ...state,
  news: state.news.map(({ title: _title, content: _content, ...item }) => item)
});

const base = generateInitialWorld(91);
const english = generateAnnualRookieClass(structuredClone(base), 2026, 'en');
const vietnamese = generateAnnualRookieClass(structuredClone(base), 2026, 'vi');
const rookieIds = Object.keys(english.fighters).filter(id => id.startsWith('rookie:2026:'));
assert.equal(rookieIds.length, 12);
for (const weightClass of WEIGHT_CLASSES) {
  assert.equal(rookieIds.filter(id => english.fighters[id].weightClass === weightClass).length, 2);
}
assert.ok(rookieIds.every(id => english.fighters[id].age >= 18 && english.fighters[id].age <= 24));
assert.ok(rookieIds.every(id => english.fighters[id].contract === null && english.fighters[id].careerPhase === 'developing'));
assert.ok(rookieIds.every(id => english.fighters[id].lastLifecycleYear === 2026));
assert.deepEqual(stripProse(english), stripProse(vietnamese));
assert.notEqual(english.news[0].title, vietnamese.news[0].title);
assert.deepEqual(generateAnnualRookieClass(english, 2026, 'en'), english);

const depleted = structuredClone(base);
depleted.currentDate = '2026-04-15';
for (const fighter of Object.values(depleted.fighters)) {
  if (fighter.weightClass === 'Lightweight') fighter.careerPhase = 'retired';
}
const emergency = ensureEmergencyProspectPool(depleted, depleted.currentDate);
const emergencyIds = Object.keys(emergency.fighters).filter(id => id.startsWith('emergency:2026-04-15:Lightweight:'));
assert.equal(emergencyIds.length, 6);
assert.equal(emergency.careerEcosystem.emergencyProspectDates.Lightweight, depleted.currentDate);
assert.deepEqual(ensureEmergencyProspectPool(emergency, '2026-04-16'), emergency);
for (const weightClass of WEIGHT_CLASSES.filter(weightClass => weightClass !== 'Lightweight')) {
  assert.equal(Object.keys(emergency.fighters).some(id => id.includes(`:${weightClass}:`) && id.startsWith('emergency:')), false);
}

const divisionState = structuredClone(base);
const [prospectBase, veteranBase] = Object.values(divisionState.fighters).filter(fighter => fighter.weightClass === 'Welterweight').slice(0, 2);
const prospect = {
  ...prospectBase,
  id: 'policy-prospect',
  age: 22,
  careerPhase: 'developing' as const,
  potential: Math.min(95, getFighterOverall(prospectBase) + 15),
  popularity: 25,
  contract: null,
  lastFightDate: '2025-12-01'
};
const veteran = {
  ...veteranBase,
  id: 'policy-veteran',
  age: 40,
  careerPhase: 'declining' as const,
  potential: getFighterOverall(veteranBase),
  popularity: 85,
  contract: { fightsRemaining: 1, payPerFight: 80_000, winBonus: 80_000, exclusivity: true, endDate: '2026-05-01' },
  lastFightDate: '2023-01-01'
};
divisionState.currentDate = '2026-01-01';
divisionState.fighters[prospect.id] = prospect;
divisionState.fighters[veteran.id] = veteran;
assert.ok(scoreObserverRosterCandidate(divisionState, prospect) > scoreObserverRosterCandidate(divisionState, veteran));
assert.equal(shouldObserverRenewFighter(divisionState, veteran), false);
assert.equal(shouldObserverRenewFighter(divisionState, { ...prospect, contract: veteran.contract }), true);

const integrated = structuredClone(base);
integrated.currentDate = '2026-04-15';
integrated.mode = 'observer';
integrated.promotion.money = 500_000;
integrated.autopilot = { ...integrated.autopilot, enabled: true, nextBookingAttemptDate: '2026-04-16' };
integrated.events = {
  completed: {
    id: 'completed',
    name: 'Recent Event',
    date: '2026-04-01',
    venueId: Object.keys(integrated.venues)[0],
    fights: [],
    ticketPrice: 20,
    marketingSpend: 500,
    isCompleted: true
  }
};
const lightweight = Object.values(integrated.fighters).filter(fighter => fighter.weightClass === 'Lightweight');
for (const fighter of lightweight) integrated.fighters[fighter.id] = { ...fighter, careerPhase: 'retired', contract: null };
const integratedProspect = { ...lightweight[0], id: 'integrated-prospect', age: 21, careerPhase: 'developing' as const, potential: 100, popularity: 30, contract: null, lastFightDate: '2026-03-01' };
const integratedVeteran = { ...lightweight[1], id: 'integrated-veteran', age: 42, careerPhase: 'declining' as const, potential: getFighterOverall(lightweight[1]), popularity: 95, contract: null, lastFightDate: '2022-01-01' };
const integratedRetiree = { ...lightweight[2], id: 'integrated-retiree', careerPhase: 'retired' as const, isChampion: true, contract: null };
integrated.fighters[integratedProspect.id] = integratedProspect;
integrated.fighters[integratedVeteran.id] = integratedVeteran;
integrated.fighters[integratedRetiree.id] = integratedRetiree;
const suppliedIntegrated = ensureEmergencyProspectPool(integrated, integrated.currentDate, 'en');
const expectedSigning = Object.values(suppliedIntegrated.fighters)
  .filter(fighter => fighter.weightClass === 'Lightweight' && !fighter.contract && fighter.careerPhase !== 'retired')
  .sort((a, b) => scoreObserverRosterCandidate(suppliedIntegrated, b) - scoreObserverRosterCandidate(suppliedIntegrated, a) || a.id.localeCompare(b.id))[0];
const maintained = autoBookEventsAndContracts(suppliedIntegrated, 'en');
const integratedEmergencyIds = Object.keys(maintained.fighters).filter(id => id.startsWith('emergency:2026-04-15:Lightweight:'));
assert.equal(integratedEmergencyIds.length, 4);
assert.ok(maintained.fighters[expectedSigning.id].contract);
assert.equal(maintained.fighters[integratedVeteran.id].contract, null);
assert.equal(maintained.fighters[integratedRetiree.id].contract, null);
const maintainedAgain = autoBookEventsAndContracts(maintained, 'en');
assert.equal(Object.keys(maintainedAgain.fighters).filter(id => id.startsWith('emergency:2026-04-15:Lightweight:')).length, 4);

console.log('Career ecosystem tests passed.');
