import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { CURRENT_SAVE_VERSION, validateAndMigrateState } from './src/lib/game/save';

const generated = generateInitialWorld(2301);
assert.equal(generated.statisticsTrackingStartedAt, generated.currentDate);
assert.deepEqual(generated.fighterRankingHistory, []);

const legacy = structuredClone(generated) as any;
legacy.saveVersion = 15;
delete legacy.statisticsTrackingStartedAt;
delete legacy.fighterRankingHistory;
for (const fight of Object.values(legacy.fightArchive) as any[]) delete fight.compensation;

const migrated = validateAndMigrateState(legacy)!;
assert.equal(CURRENT_SAVE_VERSION, 16);
assert.equal(migrated.saveVersion, 16);
assert.equal(migrated.statisticsTrackingStartedAt, legacy.currentDate);
assert.deepEqual(migrated.fighterRankingHistory, []);
assert.ok(Object.values(migrated.fightArchive).every(fight => fight.compensation === undefined));

migrated.statisticsTrackingStartedAt = '2025-02-03';
migrated.fighterRankingHistory.push({
  id: 'ranking-world-Lightweight-fighter-a-2025-02-04',
  date: '2025-02-04',
  fighterId: 'fighter-a',
  scope: 'world',
  weightClass: 'Lightweight',
  previousRank: 5,
  rank: 4
});
assert.deepEqual(validateAndMigrateState(structuredClone(migrated)), migrated);
console.log('Statistics migration checks passed.');
