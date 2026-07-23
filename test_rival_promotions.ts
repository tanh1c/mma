import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { WEIGHT_CLASSES } from './src/lib/game/constants';

const state = generateInitialWorld(1804);
const playerPromotions = Object.values(state.promotions).filter(promotion => promotion.control === 'player');
const rivals = Object.values(state.promotions).filter(promotion => promotion.control === 'ai');

assert.equal(playerPromotions.length, 1);
assert.equal(rivals.length, 2);
for (const promotion of rivals) {
  assert.ok(promotion.nextAiEventDate);
  for (const weightClass of WEIGHT_CLASSES) {
    const roster = Object.values(state.fighters).filter(fighter => fighter.weightClass === weightClass && fighter.contract?.promotionId === promotion.id);
    assert.equal(roster.length, 8);
    assert.ok(state.rankingsByPromotion[promotion.id][weightClass].length > 0);
    assert.ok(state.titlesByPromotion[promotion.id][weightClass].undisputedChampionId);
  }
}
assert.ok(Object.values(state.fighters).some(fighter => !fighter.contract));

console.log('Rival promotion generation checks passed.');
