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
for (const token of ['aria-expanded', 'aria-haspopup="listbox"', 'role="listbox"', 'role="option"', 'min-h-11', 'focus-visible']) assert.ok(select.includes(token));
assert.ok(!select.includes('role="combobox"'));

const app = readFileSync('src/App.tsx', 'utf8');
for (const token of ['accept=".json"', 'reader.readAsText(file)', 'saveGame', 'loadGame', 'exportGame', 'importGame', "case 'inbox'"]) assert.ok(app.includes(token));
const shell = readFileSync('src/components/AppShell.tsx', 'utf8');
const dashboard = readFileSync('src/pages/Dashboard.tsx', 'utf8');
const eventBuilder = readFileSync('src/pages/EventBuilder.tsx', 'utf8');
const fighterDetail = readFileSync('src/pages/FighterDetail.tsx', 'utf8');
const rankings = readFileSync('src/pages/Rankings.tsx', 'utf8');
const eventSimulation = readFileSync('src/pages/EventSimulation.tsx', 'utf8');
const roster = readFileSync('src/pages/Roster.tsx', 'utf8');
const freeAgents = readFileSync('src/pages/FreeAgents.tsx', 'utf8');
const socialHub = readFileSync('src/pages/News.tsx', 'utf8');
for (const token of ['Social Hub', 'All', 'News', 'Articles', 'Fighter Posts', 'Threads', 'socialFeed', 'applyPromotionSocialAction', 'Trending Storylines', 'engagement', 'replies', "setView('fighter-detail'", "setView('event-builder'"]) assert.ok(socialHub.includes(token), `Social Hub missing ${token}`);
assert.ok(shell.includes("view: 'inbox'"));
assert.ok(shell.includes("view: 'settings'"));
for (const token of ['useEffect', "event.key === 'Escape'", '{isOpen && <aside', "closest('[data-navigation-action]')"]) assert.ok(shell.includes(token), `Mobile shell missing ${token}`);
assert.ok(socialHub.includes('flex flex-wrap gap-2'), 'Social Hub filters must wrap on mobile');
assert.ok(fighterDetail.includes('flex flex-wrap border-b'), 'Fighter detail tabs must wrap on mobile');
for (const token of ['grid grid-cols-1 gap-4 sm:grid-cols-2', 'grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]', 'min-w-0', 'Move ${slotLabel} up', 'Move ${slotLabel} down', 'Remove ${slotLabel}']) assert.ok(eventBuilder.includes(token), `Event Builder mobile layout missing ${token}`);
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
for (const source of [rankings, fighterDetail, dashboard]) assert.ok(source.includes('ChampionshipBelt'));
assert.ok(rankings.includes('size="hero"'));
assert.ok(rankings.includes('type="interim"'));
assert.ok(fighterDetail.includes('currentBeltType'));
assert.ok(fighterDetail.includes('size="champion"'));
assert.ok(dashboard.includes("isInterim ? 'interim' : 'undisputed'"));
for (const source of [eventBuilder, eventSimulation]) {
  assert.ok(source.includes('ChampionshipBelt'));
  assert.ok(source.includes("titleFightType === 'interim' ? 'interim' : 'undisputed'"));
  assert.ok(source.includes('size="marker"'));
}
for (const token of ["setView('fight-detail'", 'fightArchiveId', 'View fight details']) assert.ok(eventSimulation.includes(token), `Past event results missing ${token}`);
for (const path of ['EventBuilder.tsx', 'Dashboard.tsx', 'EventSimulation.tsx', 'FightBattle.tsx', 'Tournaments.tsx', 'Roster.tsx', 'FreeAgents.tsx', 'FighterDetail.tsx', 'News.tsx', 'FightDetail.tsx', 'HistoryStats.tsx']) {
  const source = readFileSync(`src/pages/${path}`, 'utf8');
  assert.ok(source.includes('FighterRankBadge'), `Missing ranking context in ${path}`);
}
assert.ok(readFileSync('src/pages/Roster.tsx', 'utf8').includes("'rank'"), 'Roster must support rank sorting.');
assert.ok(readFileSync('src/pages/FightDetail.tsx', 'utf8').includes('At fight:'), 'Fight history must distinguish rank-at-fight.');
assert.ok(readFileSync('src/pages/FightDetail.tsx', 'utf8').includes('Current:'), 'Fight history must distinguish current rank.');
const fightBattle = readFileSync('src/pages/FightBattle.tsx', 'utf8');
for (const token of ['role="meter"', 'aria-valuemin={0}', 'aria-valuemax={100}', 'aria-valuenow={value}', 'aria-live="polite"', 'Pause', 'Resume', '([1, 2, 4] as const)', 'x{speed}', 'Skip to result', 'Round {session.round}', 'session.position', 'min-w-0']) assert.ok(fightBattle.includes(token), `Live fight stage missing ${token}`);
for (const token of ["corner === 'red' ? 'Red corner' : 'Blue corner'", '`${label} Condition`', '`${label} Stamina`', 'aria-label={label}']) assert.ok(fightBattle.includes(token), `Live fight meter missing ${token}`);
for (const token of ['fight-strike', 'fight-takedown', 'fight-clinch', 'fight-ground', 'fight-submission', 'fight-knockdown', 'fight-recovery', 'fight-finish', 'prefers-reduced-motion']) assert.ok(css.includes(token), `Live fight motion CSS missing ${token}`);
console.log('UI visual contracts passed.');
