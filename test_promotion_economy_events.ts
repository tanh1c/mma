import assert from 'node:assert/strict';
import { finalizeEventFinancials } from './src/lib/engine';
import { getDeterministicEventFinancialRolls } from './src/lib/game/economy';
import { generateInitialWorld } from './src/lib/game/generator';
import { validatePromotionEconomies } from './src/lib/game/promotionEconomy';
import type { Event, FightMatchup, GameState } from './src/types/game';

const makeCompletedFight = (state: GameState, promotionId: string): FightMatchup => {
  const [red, blue] = Object.values(state.fighters).filter(fighter => fighter.contract?.promotionId === promotionId && fighter.careerPhase !== 'retired').slice(0, 2);
  return {
    id: `finance-fight-${promotionId}`,
    redCornerId: red.id,
    blueCornerId: blue.id,
    weightClass: red.weightClass,
    isTitleFight: false,
    rounds: 3,
    campFocus: 'balanced',
    socialHype: 0,
    result: {
      winnerId: red.id,
      loserId: blue.id,
      method: 'Unanimous Decision',
      round: 3,
      time: '5:00',
      commentary: [],
      performanceRating: 70
    }
  };
};

const addEvent = (state: GameState, event: Event) => ({ ...state, events: { ...state.events, [event.id]: event } });

const base = generateInitialWorld(2206);
const playerId = base.playerPromotionId;
const playerEventId = 'player-finance-event';
const playerEvent: Event = {
  id: playerEventId,
  promotionId: playerId,
  scope: 'promotion',
  name: 'Player Finance Event',
  date: base.currentDate,
  venueId: Object.keys(base.venues)[0],
  ticketPrice: 45,
  marketingSpend: 8_000,
  fights: [makeCompletedFight(base, playerId)],
  isCompleted: false
};
const playerBefore = base.promotions[playerId].money;
const playerFinal = finalizeEventFinancials(addEvent(base, playerEvent), playerEventId, 'en');
const playerResults = playerFinal.events[playerEventId].results!;
const playerEntries = playerFinal.promotionEconomies[playerId].ledger.filter(entry => entry.sourceId === playerEventId);
assert.deepEqual(playerEntries.map(entry => entry.category), [
  'event_gate',
  'event_media',
  'event_sponsor',
  'fighter_purse',
  'win_bonus',
  'venue',
  'event_marketing'
]);
assert.equal(playerEntries.reduce((sum, entry) => sum + entry.amount, 0), playerFinal.promotions[playerId].money - playerBefore);
assert.equal(playerFinal.promotions[playerId].money - playerBefore, playerResults.profit);
assert.equal(playerFinal.promotion.money, playerFinal.promotions[playerId].money);
assert.equal(playerFinal.promotionEconomies[playerId].settledEventIds.includes(playerEventId), true);
assert.deepEqual(finalizeEventFinancials(playerFinal, playerEventId, 'en'), playerFinal);
assert.deepEqual(validatePromotionEconomies(playerFinal), []);

const rollsA = getDeterministicEventFinancialRolls('deterministic-event');
const rollsB = getDeterministicEventFinancialRolls('deterministic-event');
assert.deepEqual(rollsA, rollsB);
assert.ok(rollsA.attendance >= 0 && rollsA.attendance < 1);
assert.ok(rollsA.broadcast >= 0 && rollsA.broadcast < 1);
const originalRandom = Math.random;
Math.random = () => { throw new Error('deterministic rival rolls must not call Math.random'); };
assert.deepEqual(getDeterministicEventFinancialRolls('deterministic-event'), rollsA);
Math.random = originalRandom;

const rivalBase = generateInitialWorld(2207);
const rival = Object.values(rivalBase.promotions).find(promotion => promotion.control === 'ai')!;
const rivalEventId = 'rival-finance-event';
const rivalEvent: Event = {
  id: rivalEventId,
  promotionId: rival.id,
  scope: 'promotion',
  name: 'Rival Finance Event',
  date: rivalBase.currentDate,
  venueId: Object.keys(rivalBase.venues)[1],
  ticketPrice: 35,
  marketingSpend: 6_000,
  fights: [makeCompletedFight(rivalBase, rival.id)],
  isCompleted: false
};
const rivalBefore = rivalBase.promotions[rival.id].money;
const rivalPlayerBefore = rivalBase.promotions[rivalBase.playerPromotionId].money;
const rivalFinal = finalizeEventFinancials(addEvent(rivalBase, rivalEvent), rivalEventId, 'en');
const rivalArchive = rivalFinal.eventArchive[rivalEventId];
assert.ok(rivalArchive.attendance > 0);
assert.ok(rivalArchive.revenue > 0);
assert.ok(rivalArchive.cost > 0);
assert.equal(rivalFinal.promotions[rival.id].money - rivalBefore, rivalArchive.profit);
assert.equal(rivalFinal.promotions[rivalBase.playerPromotionId].money, rivalPlayerBefore);
assert.equal(rivalFinal.promotionEconomies[rival.id].settledEventIds.includes(rivalEventId), true);
assert.equal((rivalFinal.financeLedger ?? []).some(entry => entry.eventId === rivalEventId), false);
assert.deepEqual(validatePromotionEconomies(rivalFinal), []);

const internationalBase = generateInitialWorld(2208);
const internationalEventId = 'international-finance-event';
const internationalEvent: Event = {
  id: internationalEventId,
  promotionId: null,
  scope: 'international',
  name: 'International Finance Event',
  date: internationalBase.currentDate,
  venueId: Object.keys(internationalBase.venues)[0],
  ticketPrice: 50,
  marketingSpend: 10_000,
  fights: [makeCompletedFight(internationalBase, internationalBase.playerPromotionId)],
  isCompleted: false
};
const internationalLedgerBefore = structuredClone(internationalBase.promotionEconomies);
const internationalFinal = finalizeEventFinancials(addEvent(internationalBase, internationalEvent), internationalEventId, 'en');
assert.deepEqual(internationalFinal.promotionEconomies, internationalLedgerBefore);
assert.equal(internationalFinal.eventArchive[internationalEventId].profit, 0);

const debtBase = generateInitialWorld(2209);
const debtId = debtBase.playerPromotionId;
const debtEconomy = debtBase.promotionEconomies[debtId];
debtBase.promotions[debtId].money = -debtEconomy.debtLimit + 100;
debtBase.promotion = debtBase.promotions[debtId];
debtEconomy.ledgerOpeningBalance = debtBase.promotions[debtId].money;
const debtEventId = 'debt-boundary-event';
const debtEvent: Event = {
  id: debtEventId,
  promotionId: debtId,
  scope: 'promotion',
  name: 'Debt Boundary Event',
  date: debtBase.currentDate,
  venueId: Object.keys(debtBase.venues)[0],
  ticketPrice: 0,
  marketingSpend: 50_000,
  fights: [makeCompletedFight(debtBase, debtId)],
  isCompleted: false
};
const debtFinal = finalizeEventFinancials(addEvent(debtBase, debtEvent), debtEventId, 'en');
assert.equal(debtFinal.promotions[debtId].money, -debtEconomy.debtLimit);
assert.ok(debtFinal.promotionEconomies[debtId].outstandingLiabilities > 0);
assert.deepEqual(validatePromotionEconomies(debtFinal), []);

console.log('Promotion economy event settlement checks passed.');
