import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { getChampionshipBeltSrc } from './src/components/ChampionshipBelt';
import { WeightClass } from './src/types/game';

const weightClasses: WeightClass[] = ['Bantamweight', 'Featherweight', 'Lightweight', 'Welterweight', 'Middleweight', 'Heavyweight'];
for (const weightClass of weightClasses) {
  const undisputed = getChampionshipBeltSrc(weightClass, 'undisputed');
  const interim = getChampionshipBeltSrc(weightClass, 'interim');
  assert.notEqual(undisputed, interim);
  assert.ok(existsSync(`public${undisputed}`), `Missing ${undisputed}`);
  assert.ok(existsSync(`public${interim}`), `Missing ${interim}`);
}
assert.equal(new Set(weightClasses.map(weightClass => getChampionshipBeltSrc(weightClass, 'undisputed'))).size, 6);
const component = readFileSync('src/components/ChampionshipBelt.tsx', 'utf8');
for (const token of ['object-contain', "alt = ''", "size = 'card'"]) assert.ok(component.includes(token), `Missing component contract: ${token}`);
console.log('Championship belt contracts passed.');
