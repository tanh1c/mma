import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { CURRENT_SAVE_VERSION, validateAndMigrateState } from './src/lib/game/save';

const current = generateInitialWorld(2101);
assert.ok(current.contractMarket);
assert.ok(current.contractMarket.windows['market-window-2025']);

const legacy = structuredClone(current) as any;
legacy.saveVersion = 13;
delete legacy.contractMarket;
const ownershipBefore = Object.fromEntries(
  Object.values(legacy.fighters).map((fighter: any) => [
    fighter.id,
    fighter.contract?.promotionId ?? null
  ])
);
const contractsBefore = Object.fromEntries(
  Object.values(legacy.fighters).map((fighter: any) => [
    fighter.id,
    fighter.contract
  ])
);

const migrated = validateAndMigrateState(legacy)!;
assert.equal(CURRENT_SAVE_VERSION, 16);
assert.equal(migrated.saveVersion, 16);
assert.deepEqual(
  Object.fromEntries(
    Object.values(migrated.fighters).map(fighter => [
      fighter.id,
      fighter.contract?.promotionId ?? null
    ])
  ),
  ownershipBefore
);
assert.deepEqual(
  Object.fromEntries(
    Object.values(migrated.fighters).map(fighter => [fighter.id, fighter.contract])
  ),
  contractsBefore
);
assert.deepEqual(migrated.contractMarket.listings, {});
assert.deepEqual(migrated.contractMarket.offers, {});
assert.deepEqual(migrated.contractMarket.pendingSettlements, {});
assert.deepEqual(migrated.contractMarket.history, []);
assert.equal(Object.values(migrated.contractMarket.windows).length, 1);
assert.deepEqual(validateAndMigrateState(structuredClone(migrated)), migrated);

console.log('Contract market migration checks passed.');
