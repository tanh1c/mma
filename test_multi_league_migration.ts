import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { CURRENT_SAVE_VERSION, validateAndMigrateState } from './src/lib/game/save';

const legacy = structuredClone(generateInitialWorld(1802)) as any;
const legacyPlayerPromotionId = legacy.playerPromotionId;
legacy.saveVersion = 12;
for (const fighter of Object.values(legacy.fighters) as any[]) {
  if (fighter.contract?.promotionId !== legacyPlayerPromotionId) fighter.contract = null;
  else delete fighter.contract.promotionId;
}
for (const key of ['playerPromotionId', 'promotions', 'rankingsByPromotion', 'titlesByPromotion', 'beltsByPromotion', 'worldRankings']) delete legacy[key];
delete legacy.promotion.control;
for (const event of Object.values(legacy.events) as any[]) {
  delete event.promotionId;
  delete event.scope;
}
for (const belt of Object.values(legacy.belts) as any[]) delete belt.promotionId;

const migrated = validateAndMigrateState(legacy)!;
assert.equal(CURRENT_SAVE_VERSION, 16);
assert.equal(migrated.saveVersion, 16);
assert.equal(migrated.playerPromotionId, migrated.promotion.id);
assert.equal(migrated.promotions[migrated.playerPromotionId].control, 'player');
assert.deepEqual(migrated.rankingsByPromotion[migrated.playerPromotionId], migrated.rankings);
assert.deepEqual(migrated.titlesByPromotion[migrated.playerPromotionId], migrated.titles);
assert.equal(Object.values(migrated.promotions).filter(promotion => promotion.control === 'ai').length, 2);
for (const fighter of Object.values(migrated.fighters)) if (fighter.contract) assert.ok(migrated.promotions[fighter.contract.promotionId!]);
for (const belt of Object.values(migrated.belts)) assert.equal(belt.promotionId, migrated.playerPromotionId);
assert.deepEqual(validateAndMigrateState(structuredClone(migrated)), migrated);

console.log('Multi-league migration checks passed.');
