import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateInitialWorld } from './src/lib/game/generator';
import { autoBookEventsAndContracts } from './src/lib/game/autobooker';
import { createGrandPrixTournament } from './src/lib/game/tournament';
import { chooseObserverCampFocus, runObserverDecisions } from './src/lib/game/observer';
import type { Event, Fighter, FightMatchup } from './src/types/game';

const state = generateInitialWorld(41);
const [red, blue] = Object.values(state.fighters).filter(fighter => fighter.weightClass === 'Lightweight').slice(0, 2);
const fight: FightMatchup = { id: 'observer-fight', redCornerId: red.id, blueCornerId: blue.id, weightClass: 'Lightweight', isTitleFight: false, rounds: 3, campFocus: 'balanced', socialHype: 0 };
const attributes = (fighter: Fighter, values: Partial<Fighter['attributes']>) => ({ ...fighter, fatigue: 0, attributes: { ...fighter.attributes, striking: 60, power: 60, wrestling: 60, grappling: 60, submissions: 60, ...values } });
const balancedRed = attributes(red, {});
const balancedBlue = attributes(blue, {});
const wrestlingRed = attributes(red, { wrestling: 85, grappling: 85, submissions: 85 });
const wrestlingBlue = attributes(blue, { wrestling: 85, grappling: 85, submissions: 85 });
const strikingRed = attributes(red, { striking: 85, power: 85 });
const strikingBlue = attributes(blue, { striking: 85, power: 85 });

assert.equal(chooseObserverCampFocus(fight, { ...balancedRed, fatigue: 40 }, balancedBlue, '2025-02-01', '2025-01-01'), 'recovery');
assert.equal(chooseObserverCampFocus(fight, balancedRed, balancedBlue, '2025-01-10', '2025-01-01'), 'recovery');
assert.equal(chooseObserverCampFocus({ ...fight, rounds: 5 }, balancedRed, balancedBlue, '2025-02-01', '2025-01-01'), 'cardio');
assert.equal(chooseObserverCampFocus(fight, wrestlingRed, wrestlingBlue, '2025-02-01', '2025-01-01'), 'wrestling');
assert.equal(chooseObserverCampFocus(fight, strikingRed, strikingBlue, '2025-02-01', '2025-01-01'), 'striking');
assert.equal(chooseObserverCampFocus(fight, balancedRed, balancedBlue, '2025-02-01', '2025-01-01'), 'balanced');

const event: Event = { id: 'observer-event', name: 'Observer Decisions', date: '2025-02-01', venueId: Object.keys(state.venues)[0], ticketPrice: 20, marketingSpend: 500, isCompleted: false, fights: [fight] };
const base = { ...state, currentDate: '2025-01-01', events: { ...state.events, [event.id]: event }, fighters: { ...state.fighters, [red.id]: strikingRed, [blue.id]: strikingBlue }, socialFeed: [] };
const managerState = { ...base, mode: 'manager' as const, autopilot: { ...base.autopilot, enabled: true } };
const manager = runObserverDecisions(managerState);
assert.strictEqual(manager, managerState);
assert.equal(manager.events[event.id].fights[0].campFocus, 'balanced');
const observer = runObserverDecisions({ ...base, mode: 'observer', autopilot: { ...base.autopilot, enabled: true } });
assert.equal(observer.events[event.id].fights[0].campFocus, 'striking');

const promotionEvent: Event = { ...event, date: '2025-01-11', fights: [{ ...fight, isTitleFight: true, rounds: 5 }] };
const important = { ...red, contract: null, popularity: 70, counterOffer: { payPerFight: 12000, winBonus: 12000, fights: 4, interest: 75, expiresDate: '2025-01-15' } };
const ordinary = { ...blue, contract: null, age: 35, popularity: 10, potential: 40, counterOffer: { payPerFight: 101000, winBonus: 101000, fights: 4, interest: 40, expiresDate: '2025-01-15' } };
const decisionBase = { ...base, mode: 'observer' as const, autopilot: { ...base.autopilot, enabled: true }, promotion: { ...base.promotion, money: 250000 }, events: { [promotionEvent.id]: promotionEvent }, fighters: { ...base.fighters, [red.id]: important, [blue.id]: ordinary }, news: [], socialFeed: [] };
const firstPass = runObserverDecisions(decisionBase);
const secondPass = runObserverDecisions(firstPass);
assert.equal(firstPass.socialFeed.filter(item => item.actionKey === `fight:${fight.id}:promotion-announce`).length, 1);
assert.equal(secondPass.socialFeed.filter(item => item.actionKey === `fight:${fight.id}:promotion-announce`).length, 1);
assert.equal(firstPass.socialFeed.filter(item => item.actionKey === `fight:${fight.id}:promotion-hype`).length, 1);
assert.equal(secondPass.socialFeed.filter(item => item.actionKey === `fight:${fight.id}:promotion-hype`).length, 1);
assert.deepEqual(firstPass.fighters[red.id].contract && { payPerFight: firstPass.fighters[red.id].contract.payPerFight, winBonus: firstPass.fighters[red.id].contract.winBonus, fightsRemaining: firstPass.fighters[red.id].contract.fightsRemaining }, { payPerFight: 12000, winBonus: 12000, fightsRemaining: 4 });
assert.equal(firstPass.fighters[red.id].contract?.endDate, '2026-12-22');
assert.equal(firstPass.fighters[red.id].counterOffer, undefined);
assert.equal(firstPass.fighters[blue.id].contract, null);
assert.equal(firstPass.fighters[blue.id].counterOffer, undefined);
assert.equal(firstPass.news.filter(item => item.id === `observer-counter-${red.id}-2025-01-01`).length, 1);
assert.equal(secondPass.news.filter(item => item.id === `observer-counter-${red.id}-2025-01-01`).length, 1);

const mismatchRed = attributes(red, Object.fromEntries(Object.keys(red.attributes).map(key => [key, 90])) as Partial<Fighter['attributes']>);
const mismatchBlue = attributes(blue, Object.fromEntries(Object.keys(blue.attributes).map(key => [key, 40])) as Partial<Fighter['attributes']>);
const mismatchFight = { ...fight, id: 'mismatch', redCornerId: mismatchRed.id, blueCornerId: mismatchBlue.id };
const mismatchState = runObserverDecisions({ ...decisionBase, events: { [event.id]: { ...promotionEvent, fights: [mismatchFight] } }, fighters: { ...decisionBase.fighters, [red.id]: { ...mismatchRed, popularity: 10, counterOffer: undefined }, [blue.id]: { ...mismatchBlue, popularity: 10, counterOffer: undefined } }, socialFeed: [], news: [] });
assert.equal(mismatchState.socialFeed.some(item => item.actionKey === 'fight:mismatch:promotion-hype'), false);

function rivalryBookingState() {
  const next = generateInitialWorld(51);
  next.mode = 'observer';
  next.autopilot = { ...next.autopilot, enabled: true, targetTournamentWeightClass: null };
  next.currentDate = '2025-01-01';
  next.promotion = { ...next.promotion, money: 500000, reputation: 40 };
  next.events = {};
  const candidates = Object.values(next.fighters).filter(candidate => candidate.weightClass === 'Lightweight' && !candidate.isChampion).slice(0, 8);
  candidates.forEach((candidate, index) => { next.fighters[candidate.id] = { ...candidate, popularity: 90 - index * 5, contract: { fightsRemaining: 4, payPerFight: 5000, winBonus: 5000, exclusivity: true, endDate: '2026-12-31' }, injuryStatus: null, medicalSuspension: null, fatigue: 0 }; });
  Object.values(next.fighters).filter(candidate => !candidates.some(item => item.id === candidate.id)).forEach(candidate => { next.fighters[candidate.id] = { ...candidate, contract: null }; });
  next.titles.Lightweight = { ...next.titles.Lightweight, undisputedChampionId: null, interimChampionId: null, status: 'active', lastUndisputedDefenseDate: '2025-01-01' };
  const rivals = [candidates[1], candidates[6]];
  next.storylines = [{ id: 'peak-rivalry', type: 'Rivalry', fighterIds: rivals.map(item => item.id), description: 'Peak rivalry', isActive: true, intensity: 3, createdDate: next.currentDate }];
  next.seasonPlans = { 2025: { year: 2025, createdDate: next.currentDate, targetEvents: 1, targetTentpoles: 0, targetGrandPrix: 0, status: 'active', slots: [{ id: 'rivalry-slot', year: 2025, date: '2025-01-02', type: 'regular_event', status: 'planned', priority: 1, notes: [] }] } };
  return { state: next, rivals, candidates };
}

const rivalrySetup = rivalryBookingState();
const rivalryBooked = autoBookEventsAndContracts(rivalrySetup.state);
const rivalryEvent = Object.values(rivalryBooked.events).find(candidate => candidate.date === '2025-01-02')!;
assert.ok(rivalryEvent.fights.some(candidate => new Set([candidate.redCornerId, candidate.blueCornerId]).size === 2 && candidate.redCornerId !== candidate.blueCornerId && [candidate.redCornerId, candidate.blueCornerId].every(id => rivalrySetup.rivals.some(rival => rival.id === id))));

const blockedSetup = rivalryBookingState();
blockedSetup.state = createGrandPrixTournament(blockedSetup.state, { name: 'Blocking GP', weightClass: 'Lightweight', format: 'four_man', titleShotPromised: true, participantIds: blockedSetup.candidates.slice(3, 6).map(item => item.id).concat(blockedSetup.rivals[0].id), reserveIds: [] });
const blockedBooked = autoBookEventsAndContracts(blockedSetup.state);
const blockedEvent = Object.values(blockedBooked.events).find(candidate => candidate.date === '2025-01-02')!;
assert.equal(blockedEvent.fights.some(candidate => [candidate.redCornerId, candidate.blueCornerId].every(id => blockedSetup.rivals.some(rival => rival.id === id))), false);

const storeSource = readFileSync(new URL('./src/store/gameStore.ts', import.meta.url), 'utf8');
assert.match(storeSource, /repairFutureEventAvailability\(gameState\);\s*gameState = runObserverDecisions\(gameState\);\s*gameState = advanceTime/);

console.log('Observer decision tests passed.');
