import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { initializePromotionEconomies } from './src/lib/game/promotionEconomy';

const state = generateInitialWorld(2201);

assert.deepEqual(Object.keys(state.promotionEconomies).sort(), Object.keys(state.promotions).sort());
for (const [promotionId, economy] of Object.entries(state.promotionEconomies)) {
  assert.equal(economy.promotionId, promotionId);
  assert.equal(economy.lastMonthlySettlement, state.currentDate.slice(0, 7));
  assert.equal(economy.ledgerOpeningBalance, state.promotions[promotionId].money);
  assert.equal(economy.outstandingLiabilities, 0);
  assert.ok(economy.debtLimit >= 100_000);
  assert.ok(['growth', 'stable', 'cautious', 'recovery'].includes(economy.financialMode));
}

const rivalIds = Object.keys(state.promotions).filter(id => id !== state.playerPromotionId);
for (const rivalId of rivalIds) {
  const contracts = Object.values(state.fighters).flatMap(fighter => fighter.contract?.promotionId === rivalId ? [fighter.contract] : []);
  assert.ok(contracts.length > 0);
  assert.ok(contracts.every(contract => contract.payPerFight > 1 && contract.winBonus > 1));
}

assert.deepEqual(initializePromotionEconomies(state), state);

console.log('Promotion economy initialization checks passed.');
