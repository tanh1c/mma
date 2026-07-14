import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buttonVariantClasses,
  dataSurfaceClasses,
  statusToneClasses
} from './src/components/ui';

assert.match(buttonVariantClasses('primary'), /rounded-full/);
assert.match(buttonVariantClasses('primary'), /min-h-11/);
assert.match(buttonVariantClasses('primary'), /focus-visible/);
assert.match(buttonVariantClasses('secondary'), /border/);
assert.doesNotMatch(buttonVariantClasses('secondary'), /shadow/);
assert.match(buttonVariantClasses('danger'), /red/);
assert.match(dataSurfaceClasses, /border/);
assert.doesNotMatch(dataSurfaceClasses, /shadow/);
for (const tone of ['neutral', 'success', 'warning', 'danger'] as const) {
  assert.ok(statusToneClasses(tone));
}

const css = readFileSync('src/index.css', 'utf8');
assert.match(css, /#0a0a0a/);
assert.match(css, /:focus-visible/);
import { APP_NAV_GROUPS } from './src/components/AppShell';

const labels = APP_NAV_GROUPS.flatMap(group => group.items.map(item => item.label));
for (const label of ['Dashboard', 'Roster', 'Calendar', 'Book Event', 'Rankings', 'Tournaments', 'Free Agents', 'News', 'History & Stats', 'Debug Sim']) {
  assert.ok(labels.includes(label), `Missing navigation item: ${label}`);
}
for (const label of ['Save', 'Load', 'Export', 'Import']) assert.ok(!labels.includes(label));

const select = readFileSync('src/components/Select.tsx', 'utf8');
for (const token of ['aria-expanded', 'aria-haspopup="listbox"', 'min-h-11', 'focus-visible']) assert.ok(select.includes(token));

const app = readFileSync('src/App.tsx', 'utf8');
for (const token of ['accept=".json"', 'reader.readAsText(file)', 'saveGame', 'loadGame', 'exportGame', 'importGame']) assert.ok(app.includes(token));
console.log('UI visual contracts passed.');
