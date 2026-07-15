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
for (const label of ['Dashboard', 'Roster', 'Calendar', 'Book Event', 'Rankings', 'Tournaments', 'Free Agents', 'Social Hub', 'History & Stats', 'Debug Sim', 'Settings']) {
  assert.ok(labels.includes(label), `Missing navigation item: ${label}`);
}
for (const label of ['Save', 'Load', 'Export', 'Import']) assert.ok(!labels.includes(label));

const select = readFileSync('src/components/Select.tsx', 'utf8');
for (const token of ['aria-expanded', 'aria-haspopup="listbox"', 'min-h-11', 'focus-visible']) assert.ok(select.includes(token));

const app = readFileSync('src/App.tsx', 'utf8');
for (const token of ['accept=".json"', 'reader.readAsText(file)', 'saveGame', 'loadGame', 'exportGame', 'importGame', "case 'inbox'"]) assert.ok(app.includes(token));
const shell = readFileSync('src/components/AppShell.tsx', 'utf8');
const dashboard = readFileSync('src/pages/Dashboard.tsx', 'utf8');
const eventBuilder = readFileSync('src/pages/EventBuilder.tsx', 'utf8');
const fighterDetail = readFileSync('src/pages/FighterDetail.tsx', 'utf8');
const roster = readFileSync('src/pages/Roster.tsx', 'utf8');
const freeAgents = readFileSync('src/pages/FreeAgents.tsx', 'utf8');
const socialHub = readFileSync('src/pages/News.tsx', 'utf8');
for (const token of ['Social Hub', 'All', 'News', 'Articles', 'Fighter Posts', 'Threads', 'socialFeed', 'applyPromotionSocialAction', 'Trending Storylines', 'engagement', 'replies', "setView('fighter-detail'", "setView('event-builder'"]) assert.ok(socialHub.includes(token), `Social Hub missing ${token}`);
assert.ok(shell.includes("view: 'inbox'"));
assert.ok(shell.includes("view: 'settings'"));
assert.ok(app.includes("case 'settings'"));
const settings = readFileSync('src/pages/Settings.tsx', 'utf8');
for (const token of ['Metric', 'US / Imperial', 'type="radio"', 'setUnitSystem']) assert.ok(settings.includes(token), `Settings missing ${token}`);
assert.ok(dashboard.includes('getPromotionInbox'));
assert.ok(eventBuilder.includes('campFocus'));
for (const token of ['OVR', 'POT', 'Height', 'Fight Weight', 'Walk-around Weight', 'Weight Cut', 'Toughness', 'Storylines', 'getFighterStorylines', 'getFighterSocialFeed', 'Intensity', 'expiresDate', "setView('fighter-detail'", 'Social activity']) assert.ok(fighterDetail.includes(token), `Fighter detail missing ${token}`);
assert.ok(roster.includes('getFighterOverall'));
for (const source of [fighterDetail, roster]) {
  assert.ok(source.includes('useSettingsStore'));
  assert.ok(source.includes('formatHeight'));
  assert.ok(source.includes('formatWeight'));
}
assert.ok(!fighterDetail.includes('`${f.heightCm} cm`'));
assert.ok(!fighterDetail.includes('`${f.fightWeightLb} lb`'));
assert.ok(!roster.includes('{f.heightCm} cm'));
assert.ok(freeAgents.includes('getFighterOverall'));
assert.ok(eventBuilder.includes('mismatchWarning'));
console.log('UI visual contracts passed.');
