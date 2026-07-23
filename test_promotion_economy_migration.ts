import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { CURRENT_SAVE_VERSION, validateAndMigrateState } from './src/lib/game/save';

const current = generateInitialWorld(2202);
const legacy = structuredClone(current) as any;
legacy.saveVersion = 14;
delete legacy.promotionEconomies;
legacy.financeLedger = [{
  id: 'legacy-event-row',
  date: legacy.currentDate,
  type: 'event_profit',
  amount: 12_345,
  description: 'Legacy event',
  isSummary: true,
  affectsCash: false
}];
const balances = Object.fromEntries(
  Object.entries(legacy.promotions).map(([id, promotion]: any) => [id, promotion.money])
);

const migrated = validateAndMigrateState(legacy)!;
assert.equal(CURRENT_SAVE_VERSION, 16);
assert.equal(migrated.saveVersion, 16);
assert.deepEqual(
  Object.fromEntries(Object.entries(migrated.promotions).map(([id, promotion]) => [id, promotion.money])),
  balances
);
assert.deepEqual(Object.keys(migrated.promotionEconomies).sort(), Object.keys(migrated.promotions).sort());
assert.deepEqual(
  migrated.promotionEconomies[migrated.playerPromotionId].legacyFinanceLedgerIds,
  ['legacy-event-row']
);
assert.equal(
  migrated.promotionEconomies[migrated.playerPromotionId].lastMonthlySettlement,
  migrated.currentDate.slice(0, 7)
);
assert.deepEqual(migrated.promotionEconomies[migrated.playerPromotionId].ledger, []);
assert.deepEqual(validateAndMigrateState(structuredClone(migrated)), migrated);

console.log('Promotion economy migration checks passed.');
