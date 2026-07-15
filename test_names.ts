import assert from 'node:assert/strict';
import { firstNames, getLocalizedFighterName, lastNames, nationalities } from './src/lib/names';
import { generateFighter, generateInitialWorld } from './src/lib/game/generator';
import { PRNG } from './src/lib/game/rng';
import { validateAndMigrateState } from './src/lib/game/save';

nationalities.forEach(nationality => {
  const name = getLocalizedFighterName(nationality, 12345);
  assert.ok(name.firstName.length > 0);
  assert.ok(name.lastName.length > 0);
  assert.deepEqual(name, getLocalizedFighterName(nationality, 12345));
});

const latinName = /^\p{Script=Latin}[\p{Script=Latin}\p{Mark}]*(?:[ '’\-]\p{Script=Latin}[\p{Script=Latin}\p{Mark}]*)*$/u;
nationalities.forEach(nationality => {
  for (let seed = 0; seed < 1000; seed++) {
    const name = getLocalizedFighterName(nationality, seed);
    assert.match(name.firstName, latinName, `${nationality} first name at seed ${seed}`);
    assert.match(name.lastName, latinName, `${nationality} last name at seed ${seed}`);
    assert.deepEqual(name, getLocalizedFighterName(nationality, seed));
  }
});

const fallback = getLocalizedFighterName('Unknown', 4);
assert.equal(fallback.firstName, firstNames[4]);
assert.equal(fallback.lastName, lastNames[4]);

const fighter = generateFighter(new PRNG(42), 'Prospect', 'Lightweight');
assert.ok(fighter.firstName.length > 0);
assert.ok(fighter.lastName.length > 0);
assert.ok(nationalities.includes(fighter.nationality as typeof nationalities[number]));

const legacy = structuredClone(generateInitialWorld(9));
const russian = Object.values(legacy.fighters).find(candidate => candidate.nationality === 'Russia')!;
russian.firstName = 'Прохор';
russian.lastName = 'Кононов';
const migrated = validateAndMigrateState(legacy)!;
assert.match(migrated.fighters[russian.id].firstName, latinName);
assert.match(migrated.fighters[russian.id].lastName, latinName);
assert.equal(migrated.fighters[russian.id].nationality, 'Russia');

console.log('Localized name tests passed.');
