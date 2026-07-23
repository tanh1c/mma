import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { getFighterPromotionId, getPlayerPromotionId, getScopedRankings } from './src/lib/game/leagues';

const state = generateInitialWorld(1801);
const playerPromotionId = getPlayerPromotionId(state);

assert.equal(state.promotions[playerPromotionId].control, 'player');
assert.equal(state.promotion.id, playerPromotionId);
assert.deepEqual(state.rankings, getScopedRankings(state, playerPromotionId));
assert.equal(Object.values(state.promotions).filter(promotion => promotion.control === 'player').length, 1);
for (const fighter of Object.values(state.fighters)) {
  const promotionId = getFighterPromotionId(fighter);
  if (promotionId) assert.ok(state.promotions[promotionId], `Missing contract promotion ${promotionId}`);
}

console.log('Multi-league foundation checks passed.');
