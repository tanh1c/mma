import assert from 'node:assert/strict';
import { applyFightResult, finalizeEventFinancials } from './src/lib/engine';
import { generateInitialWorld } from './src/lib/game/generator';
import type { Event, FightResult, GameState } from './src/types/game';

const addEvent = (state: GameState, event: Event): GameState => ({
  ...state,
  events: { ...state.events, [event.id]: event }
});

const resultFor = (winnerId: string | null, loserId: string | null): FightResult => ({
  winnerId,
  loserId,
  method: winnerId ? 'Unanimous Decision' : 'Draw',
  round: 3,
  time: '5:00',
  commentary: [],
  performanceRating: 74
});

const base = generateInitialWorld(2302);
const promotionId = base.playerPromotionId;
const [red, blue] = Object.values(base.fighters).filter(fighter => fighter.contract?.promotionId === promotionId && fighter.weightClass === 'Lightweight').slice(0, 2);
assert.ok(red && blue);
const contracted: GameState = {
  ...base,
  fighters: {
    ...base.fighters,
    [red.id]: { ...red, contract: { ...red.contract!, promotionId, fightsRemaining: 4, payPerFight: 12_000, winBonus: 8_000, endDate: '2027-01-01' } },
    [blue.id]: { ...blue, contract: { ...blue.contract!, promotionId, fightsRemaining: 4, payPerFight: 9_000, winBonus: 5_000, endDate: '2027-01-01' } }
  }
};
const eventId = 'statistics-compensation-domestic';
const event: Event = {
  id: eventId,
  promotionId,
  scope: 'promotion',
  name: 'Statistics Compensation Domestic',
  date: contracted.currentDate,
  venueId: Object.keys(contracted.venues)[0],
  ticketPrice: 45,
  marketingSpend: 8_000,
  fights: [{ id: 'statistics-compensation-fight', redCornerId: red.id, blueCornerId: blue.id, weightClass: red.weightClass, isTitleFight: false, rounds: 3, campFocus: 'balanced', socialHype: 0 }],
  isCompleted: false
};

const applied = applyFightResult(addEvent(contracted, event), eventId, 0, resultFor(red.id, blue.id), 'en');
assert.deepEqual(applied.events[eventId].fights[0].result!.compensation, [
  { fighterId: red.id, promotionIdAtFight: promotionId, basePurse: 12_000, winBonus: 8_000, total: 20_000 },
  { fighterId: blue.id, promotionIdAtFight: promotionId, basePurse: 9_000, winBonus: 0, total: 9_000 }
]);

const contractsChanged = {
  ...applied,
  fighters: {
    ...applied.fighters,
    [red.id]: { ...applied.fighters[red.id], contract: null },
    [blue.id]: { ...applied.fighters[blue.id], contract: { ...applied.fighters[blue.id].contract!, payPerFight: 99_000, winBonus: 99_000 } }
  }
};
const finalized = finalizeEventFinancials(contractsChanged, eventId, 'en');
const archived = Object.values(finalized.fightArchive).find(fight => fight.eventId === eventId)!;
assert.deepEqual(archived.compensation, applied.events[eventId].fights[0].result!.compensation);
assert.equal(finalized.events[eventId].results!.fighterBasePay, 21_000);
assert.equal(finalized.events[eventId].results!.fighterWinBonuses, 8_000);
assert.deepEqual(finalizeEventFinancials(finalized, eventId, 'en'), finalized);

const drawId = 'statistics-compensation-draw';
const drawEvent = { ...event, id: drawId, name: 'Statistics Compensation Draw', fights: [{ ...event.fights[0], id: 'statistics-compensation-draw-fight' }] };
const drawApplied = applyFightResult(addEvent(contracted, drawEvent), drawId, 0, resultFor(null, null), 'en');
assert.deepEqual(drawApplied.events[drawId].fights[0].result!.compensation?.map(item => item.winBonus), [0, 0]);

const rival = Object.values(base.promotions).find(promotion => promotion.control === 'ai')!;
const [rivalRed, rivalBlue] = Object.values(base.fighters).filter(fighter => fighter.contract?.promotionId === rival.id && fighter.weightClass === 'Lightweight').slice(0, 2);
assert.ok(rivalRed && rivalBlue);
const rivalId = 'statistics-compensation-rival';
const rivalEvent: Event = { ...event, id: rivalId, promotionId: rival.id, name: 'Statistics Compensation Rival', fights: [{ ...event.fights[0], id: 'statistics-compensation-rival-fight', redCornerId: rivalRed.id, blueCornerId: rivalBlue.id }] };
const rivalApplied = applyFightResult(addEvent(base, rivalEvent), rivalId, 0, resultFor(rivalRed.id, rivalBlue.id), 'en');
assert.deepEqual(rivalApplied.events[rivalId].fights[0].result!.compensation?.map(item => item.promotionIdAtFight), [rival.id, rival.id]);

const internationalId = 'statistics-compensation-international';
const internationalEvent: Event = { ...event, id: internationalId, promotionId: null, scope: 'international', name: 'Statistics Compensation International', fights: [{ ...event.fights[0], id: 'statistics-compensation-international-fight' }] };
const internationalApplied = applyFightResult(addEvent(contracted, internationalEvent), internationalId, 0, resultFor(red.id, blue.id), 'en');
assert.deepEqual(internationalApplied.events[internationalId].fights[0].result!.compensation, [
  { fighterId: red.id, promotionIdAtFight: promotionId, basePurse: 0, winBonus: 0, total: 0 },
  { fighterId: blue.id, promotionIdAtFight: promotionId, basePurse: 0, winBonus: 0, total: 0 }
]);
const economiesBefore = structuredClone(internationalApplied.promotionEconomies);
const internationalFinal = finalizeEventFinancials(internationalApplied, internationalId, 'en');
assert.deepEqual(internationalFinal.promotionEconomies, economiesBefore);
assert.deepEqual(Object.values(internationalFinal.fightArchive).find(fight => fight.eventId === internationalId)!.compensation, internationalApplied.events[internationalId].fights[0].result!.compensation);

const legacyArchive = { ...contracted.fightArchive, legacy: {
  id: 'legacy', promotionId, scope: 'promotion' as const, date: contracted.currentDate, eventId: 'legacy-event', eventName: 'Legacy', weightClass: red.weightClass,
  redFighterId: red.id, blueFighterId: blue.id, winnerId: red.id, method: 'Decision', round: 3, time: '5:00', isTitleFight: false, performanceRating: 60
} };
const withLegacy = finalizeEventFinancials({ ...applied, fightArchive: legacyArchive }, eventId, 'en');
assert.equal(withLegacy.fightArchive.legacy.compensation, undefined);

console.log('Fight compensation checks passed.');
