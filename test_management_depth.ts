import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { createCounterOffer, getContractEndDate, getContractStatus } from './src/lib/game/contracts';
import { validateAndMigrateState } from './src/lib/game/save';
import { advanceTime } from './src/lib/engine';
import { simulateFight } from './src/lib/game/fightSimulator';
import { coolRivalries, getPairKey, updateRivalryAfterFight } from './src/lib/game/news';
import { getPromotionInbox } from './src/lib/game/inbox';

const state = generateInitialWorld(1);
const fighter = Object.values(state.fighters).find(candidate => candidate.contract)!;
assert.equal(typeof fighter.contract!.endDate, 'string');
assert.equal(getContractEndDate('2026-01-01', 2), '2026-12-27');
assert.equal(getContractStatus({ fightsRemaining: 2, payPerFight: 1, winBonus: 1, exclusivity: true, endDate: '2026-01-20' }, '2026-01-01'), 'expiring');
assert.equal(getContractStatus({ fightsRemaining: 0, payPerFight: 1, winBonus: 1, exclusivity: true, endDate: '2027-01-01' }, '2026-01-01'), 'expired');
const counter = createCounterOffer(10000, 5000, 3, 75, '2026-01-01');
assert.equal(counter.expiresDate, '2026-01-15');
assert.ok(counter.payPerFight >= 10000);
const counterOfferState = generateInitialWorld(8);
const counterOfferFighter = Object.values(counterOfferState.fighters).find(candidate => !candidate.contract)!;
counterOfferState.fighters[counterOfferFighter.id] = { ...counterOfferFighter, counterOffer: createCounterOffer(10000, 10000, 3, 75, counterOfferState.currentDate) };
assert.ok(getPromotionInbox(counterOfferState).some(item => item.id === `counter-${counterOfferFighter.id}`));
assert.equal(advanceTime(counterOfferState, 15).fighters[counterOfferFighter.id].counterOffer, undefined);

const legacy = generateInitialWorld(2) as any;
legacy.saveVersion = 6;
const legacyFighter = Object.values(legacy.fighters).find((candidate: any) => candidate.contract) as any;
delete legacyFighter.contract.endDate;
const migrated = validateAndMigrateState(legacy)!;
const migratedFighter = Object.values(migrated.fighters).find(candidate => candidate.contract)!;
assert.ok(migratedFighter.contract!.endDate >= migrated.currentDate);
assert.equal(migrated.saveVersion, 10);

const expiryState = generateInitialWorld(3);
const expiring = Object.values(expiryState.fighters).find(candidate => candidate.contract)!;
expiryState.fighters[expiring.id] = { ...expiring, contract: { ...expiring.contract!, fightsRemaining: 2, endDate: '2025-01-01' } };
const afterExpiry = advanceTime(expiryState, 1);
assert.equal(afterExpiry.fighters[expiring.id].contract, null);

const moraleState = generateInitialWorld(4);
const idle = Object.values(moraleState.fighters).find(candidate => candidate.contract)!;
moraleState.fighters[idle.id] = { ...idle, morale: 60, contract: { ...idle.contract!, fightsRemaining: 1, endDate: '2025-01-20' } };
const afterPressure = advanceTime(moraleState, 7);
assert.ok(afterPressure.fighters[idle.id].morale < 60);

const campState = generateInitialWorld(5);
const [red, blue] = Object.values(campState.fighters).filter(candidate => candidate.weightClass === 'Lightweight').slice(0, 2);
const matchup = { id: 'camp-test', redCornerId: red.id, blueCornerId: blue.id, weightClass: 'Lightweight' as const, isTitleFight: false, rounds: 3 };
const beforeCamp = structuredClone(red.attributes);
const balancedResult = simulateFight({ ...matchup, campFocus: 'balanced' }, red, blue, 99);
const strikingResult = simulateFight({ ...matchup, campFocus: 'striking' }, red, blue, 99);
assert.deepEqual(red.attributes, beforeCamp);
assert.notDeepEqual(strikingResult.roundStats, balancedResult.roundStats);

const rivalryState = generateInitialWorld(6);
const [first, second] = Object.values(rivalryState.fighters).slice(0, 2);
const escalated = updateRivalryAfterFight(rivalryState, [first.id, second.id], '2026-01-01', true, false);
const intensified = updateRivalryAfterFight(escalated, [second.id, first.id], '2026-01-15', true, false);
const rivalry = intensified.storylines.find(storyline => storyline.type === 'Rivalry' && getPairKey(storyline.fighterIds) === getPairKey([first.id, second.id]))!;
assert.equal(rivalry.intensity, 2);
assert.equal(intensified.storylines.filter(storyline => storyline.type === 'Rivalry' && getPairKey(storyline.fighterIds) === getPairKey([first.id, second.id])).length, 1);
const resolved = updateRivalryAfterFight(intensified, [first.id, second.id], '2026-02-01', true, true);
assert.equal(resolved.storylines.find(storyline => storyline.id === rivalry.id)!.isActive, false);
const cooled = coolRivalries(escalated, '2026-04-02');
assert.equal(cooled.storylines.find(storyline => storyline.type === 'Rivalry')!.isActive, false);

const inboxState = generateInitialWorld(7);
const inboxFighter = Object.values(inboxState.fighters).find(candidate => candidate.contract)!;
inboxState.fighters[inboxFighter.id] = { ...inboxFighter, contract: { ...inboxFighter.contract!, fightsRemaining: 1, endDate: '2026-01-20' } };
const inbox = getPromotionInbox(inboxState);
assert.equal(inbox[0].severity, 'urgent');
assert.equal(inbox[0].fighterId, inboxFighter.id);
const renewed = { ...inboxState, fighters: { ...inboxState.fighters, [inboxFighter.id]: { ...inboxState.fighters[inboxFighter.id], contract: { ...inboxState.fighters[inboxFighter.id].contract!, fightsRemaining: 3, endDate: '2027-01-01' } } } };
assert.equal(getPromotionInbox(renewed).some(item => item.fighterId === inboxFighter.id), false);

console.log('Management depth tests passed.');
