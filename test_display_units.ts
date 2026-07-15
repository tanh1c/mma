import assert from 'node:assert/strict';
import { formatHeight, formatWeight, readUnitSystem, writeUnitSystem } from './src/lib/displayUnits';

assert.equal(formatHeight(180, 'metric'), '180 cm');
assert.equal(formatHeight(180, 'us'), `5' 11"`);
assert.equal(formatHeight(182.88, 'us'), `6' 0"`);
assert.equal(formatWeight(155, 'metric'), '70.3 kg');
assert.equal(formatWeight(155, 'us'), '155 lb');
assert.equal(readUnitSystem(undefined), 'metric');
assert.equal(readUnitSystem({ getItem: () => 'us' }), 'us');
assert.equal(readUnitSystem({ getItem: () => 'broken' }), 'metric');
assert.equal(readUnitSystem({ getItem: () => { throw new Error('blocked'); } }), 'metric');
let stored = '';
writeUnitSystem('us', { setItem: (_key, value) => { stored = value; } });
assert.equal(stored, 'us');
assert.doesNotThrow(() => writeUnitSystem('metric', { setItem: () => { throw new Error('blocked'); } }));
console.log('Display units checks passed.');
