import assert from 'node:assert/strict';
import { generateFighter, generateInitialWorld } from './src/lib/game/generator';
import {
  getDeterministicPhysicalProfile,
  getFighterOverall,
  getPhysicalFightModifier,
  getPhysicalProfile,
  getWeightCutPercent,
  improveFighterTowardPotential,
  isProspect
} from './src/lib/game/fighterRatings';
import { PRNG } from './src/lib/game/rng';
import { CURRENT_SAVE_VERSION, validateAndMigrateState } from './src/lib/game/save';
import { Fighter, FighterAttributes, WeightClass } from './src/types/game';

const classes: WeightClass[] = ['Bantamweight', 'Featherweight', 'Lightweight', 'Welterweight', 'Middleweight', 'Heavyweight'];
const base = generateFighter(new PRNG(1), 'Journeyman', 'Lightweight');
const baseOvr = getFighterOverall(base);
assert.ok(baseOvr >= 10 && baseOvr <= 95);
assert.equal(baseOvr, getFighterOverall(base));

(Object.keys(base.attributes) as Array<keyof FighterAttributes>).forEach(key => {
  const changed = { ...base, attributes: { ...base.attributes, [key]: Math.min(95, base.attributes[key] + 10) } };
  assert.notEqual(getFighterOverall(changed), baseOvr, `${key} must affect OVR`);
});

classes.forEach((weightClass, index) => {
  const rng = new PRNG(index + 10);
  const profile = getPhysicalProfile(weightClass, rng.randomInt.bind(rng));
  assert.ok(profile.heightCm > 0);
  assert.ok(profile.walkAroundWeightLb > profile.fightWeightLb);
  const deterministic = getDeterministicPhysicalProfile(weightClass, `fighter-${index}`);
  assert.deepEqual(deterministic, getDeterministicPhysicalProfile(weightClass, `fighter-${index}`));
});

const heavier = { ...base, heightCm: 190, fightWeightLb: 155, walkAroundWeightLb: 177 };
const smaller = { ...base, id: 'smaller', heightCm: 170, fightWeightLb: 150, walkAroundWeightLb: 160 };
assert.ok(getWeightCutPercent(heavier) > 0);
assert.ok(getPhysicalFightModifier(heavier, smaller) >= 0.95 && getPhysicalFightModifier(heavier, smaller) <= 1.05);

const prospect = { ...base, age: 22, potential: Math.min(95, Math.max(72, baseOvr + 15)) };
assert.equal(isProspect(prospect), true);
const improved = improveFighterTowardPotential(prospect, () => 1, () => 0.99);
assert.ok(getFighterOverall(improved) <= improved.potential);
const capped = { ...base, potential: baseOvr };
assert.deepEqual(improveFighterTowardPotential(capped, () => 3, () => 0.99).attributes, capped.attributes);

const expectedBands = {
  Champion: [74, 91], Contender: [61, 82], Prospect: [44, 70], Veteran: [50, 74], Journeyman: [38, 62], Can: [27, 50]
} as const;
for (const [archetype, [min, max]] of Object.entries(expectedBands)) {
  for (let seed = 1; seed <= 20; seed++) {
    const fighter = generateFighter(new PRNG(seed), archetype as keyof typeof expectedBands, 'Lightweight');
    const ovr = getFighterOverall(fighter);
    assert.ok(ovr >= min && ovr <= max, `${archetype} OVR ${ovr} outside ${min}-${max}`);
    assert.ok(fighter.potential >= ovr);
    assert.ok(Math.max(...Object.values(fighter.attributes)) <= 95);
    assert.ok(fighter.walkAroundWeightLb > fighter.fightWeightLb);
  }
}

const legacy = generateInitialWorld(77) as any;
legacy.saveVersion = 7;
const legacyFighter = Object.values(legacy.fighters)[0] as any;
const originalAttributes = structuredClone(legacyFighter.attributes);
delete legacyFighter.heightCm;
delete legacyFighter.fightWeightLb;
delete legacyFighter.walkAroundWeightLb;
legacyFighter.potential = 10;
const migrated = validateAndMigrateState(legacy)!;
const firstMigration = migrated.fighters[legacyFighter.id];
assert.deepEqual(firstMigration.attributes, originalAttributes);
assert.ok(firstMigration.potential >= getFighterOverall(firstMigration));
assert.ok(firstMigration.walkAroundWeightLb > firstMigration.fightWeightLb);
const migratedTwice = validateAndMigrateState(structuredClone(migrated))!;
assert.deepEqual(migratedTwice.fighters[legacyFighter.id], firstMigration);
assert.equal(migrated.saveVersion, CURRENT_SAVE_VERSION);

console.log('Fighter ratings tests passed.');
