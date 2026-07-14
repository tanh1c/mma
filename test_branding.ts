import assert from 'node:assert/strict';
import { nationalities } from './src/lib/names';
import { WEIGHT_CLASSES } from './src/lib/game/constants';
import { getBeltBranding, getEventName, getNationalityCode, getNationalitySkinPalette, getTournamentBranding } from './src/lib/branding';

for (const weightClass of WEIGHT_CLASSES) {
  const belt = getBeltBranding(weightClass);
  assert.ok(belt.name.length > weightClass.length);
  assert.ok(belt.shortName.length > 0);
}

assert.match(getEventName('tentpole', 1), /Mega Showdown/);
assert.match(getEventName('grand_prix', 1, 'quarterfinal'), /GP Quarterfinal/);
assert.match(getEventName('grand_prix', 1, 'semifinal'), /GP Semifinal/);
assert.match(getEventName('grand_prix', 1, 'final'), /GP Final/);

for (const nationality of nationalities) {
  assert.match(getNationalityCode(nationality), /^[a-z]{2}$/);
  const palette = getNationalitySkinPalette(nationality);
  assert.ok(palette.length >= 3);
  for (const color of palette) assert.match(color, /^[a-f0-9]{6}$/i);
}

assert.ok(getNationalitySkinPalette('Unknown').length >= 3);

const tournament = getTournamentBranding('Lightweight', 'eight_man');
assert.equal(tournament.shortName, 'Lightweight 8-Man GP');
assert.match(tournament.name, /Lightweight/);

console.log('Branding checks passed.');
