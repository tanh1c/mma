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
const viteConfig = readFileSync('vite.config.ts', 'utf8');
for (const chunk of ['manualChunks', "'game-core'", "'react-vendor'", "'i18n'"]) assert.ok(viteConfig.includes(chunk), `Missing production chunk split: ${chunk}`);
assert.ok(!viteConfig.includes('@faker-js/faker'));
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
for (const token of ['accept=".json"', 'reader.readAsText(file)', 'saveGame', 'loadGame', 'exportGame', 'importGame', "case 'inbox'", 'useTranslation', '$.common.save', '$.search.placeholder']) assert.ok(app.includes(token));
const shell = readFileSync('src/components/AppShell.tsx', 'utf8');
const dashboard = readFileSync('src/pages/Dashboard.tsx', 'utf8');
const eventBuilder = readFileSync('src/pages/EventBuilder.tsx', 'utf8');
const fighterDetail = readFileSync('src/pages/FighterDetail.tsx', 'utf8');
const rankings = readFileSync('src/pages/Rankings.tsx', 'utf8');
const eventSimulation = readFileSync('src/pages/EventSimulation.tsx', 'utf8');
const roster = readFileSync('src/pages/Roster.tsx', 'utf8');
const freeAgents = readFileSync('src/pages/FreeAgents.tsx', 'utf8');
const socialHub = readFileSync('src/pages/News.tsx', 'utf8');
const historyStats = readFileSync('src/pages/HistoryStats.tsx', 'utf8');
const calendarPage = readFileSync('src/pages/Calendar.tsx', 'utf8');
const tournamentsPage = readFileSync('src/pages/Tournaments.tsx', 'utf8');
const inboxData = readFileSync('src/lib/game/inbox.ts', 'utf8');
const inboxPage = readFileSync('src/pages/Inbox.tsx', 'utf8');
for (const token of ['incidentId?: string', "state.mode === 'manager'", "incident.status === 'pending'", '$.generated.inbox.dramaTitle']) assert.ok(inboxData.includes(token), `Drama Inbox data missing ${token}`);
for (const token of ['selectedIncidentId', 'setSelectedIncidentId', 'getValidDramaResponses', 'resolveDramaIncident', 'lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]', 'min-w-0', '$.inbox.drama.backToList', '$.inbox.drama.risk.low', '$.inbox.drama.risk.medium', '$.inbox.drama.risk.high', 'min-h-11 w-full']) assert.ok(inboxPage.includes(token), `Drama Inbox UI missing ${token}`);
for (const token of ['$.socialHub.title', '$.socialHub.filters.all', '$.socialHub.filters.news', '$.socialHub.filters.articles', '$.socialHub.filters.fighterPosts', '$.socialHub.filters.threads', 'socialFeed', 'applyPromotionSocialAction', '$.socialHub.trending', 'engagement', 'replies', "setView('fighter-detail'", "setView('event-builder'"]) assert.ok(socialHub.includes(token), `Social Hub missing ${token}`);
for (const token of ['fighter.hallOfFame', 'hallOfFame.legacyScore', '$.historyStats.hallOfFameTitle', "setView('fighter-detail'"]) assert.ok(historyStats.includes(token), `Hall of Fame missing ${token}`);
for (const token of ['personalityTraits.slice(0, 2)', '<details', '$.personality.title', '$.personality.traits.professional', 'AchievementVisual', "achievement.visual === 'belt'", 'ChampionshipBelt', 'Trophy', 'Medal', 'Flame']) assert.ok(fighterDetail.includes(token), `Fighter profile presentation missing ${token}`);
assert.match(fighterDetail, /\$\.fighterDetail\.attributes[\s\S]{0,3000}\$\.personality\.title[\s\S]{0,3000}\$\.fighterDetail\.editor\.title/, 'Attributes must contain personality and precede the fighter editor.');
for (const token of ['drama.objectives', 'lastAutopilotSummary.drama', 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3', '$.objectives.title', "setView('history'", "item.incidentId ? setView('inbox')"]) assert.ok(dashboard.includes(token), `Season Dashboard missing ${token}`);
for (const token of ['drama.seasonReviews', "status === 'resolved'", 'incidentSeverityFilter', 'incidentTypeFilter', 'incidentEventFilter', 'incidentFighterFilter', 'flex flex-wrap gap-2', '$.seasonReview.title', '$.dramaTimeline.title', '$.inbox.drama.incident.weightCut', '$.inbox.drama.response.acceptCatchweight', '$.dramaTimeline.rationaleFactors.identity', '$.dramaTimeline.consequences.socialHype']) assert.ok(historyStats.includes(token), `Drama history UI missing ${token}`);
assert.ok(shell.includes("view: 'inbox'"));
assert.ok(shell.includes("view: 'settings'"));
for (const token of ['useEffect', "event.key === 'Escape'", '{isOpen && <aside', "closest('[data-navigation-action]')", 'useTranslation', '$.navigation.dashboard', '$.shell.openNavigation', 'formatCurrency', 'formatDate']) assert.ok(shell.includes(token), `Mobile shell missing ${token}`);
assert.match(shell, /<main className="[^"]*\[overflow-wrap:anywhere\]/, 'Main content must wrap long values on mobile');
assert.ok(socialHub.includes('flex flex-wrap gap-2'), 'Social Hub filters must wrap on mobile');
assert.ok(fighterDetail.includes('flex flex-wrap border-b'), 'Fighter detail tabs must wrap on mobile');
for (const token of ['md:hidden', 'hidden md:block', 'grid grid-cols-1 gap-2 sm:grid-cols-2', 'min-w-0 break-words', 'min-h-11 w-full sm:w-auto']) assert.ok(calendarPage.includes(token), `Calendar mobile cards missing ${token}`);
for (const token of ['grid grid-cols-2 gap-1 sm:grid-cols-4', 'flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', 'min-h-11 w-full sm:w-auto', "isEight ? 'sm:grid-cols-3' : 'sm:grid-cols-2'", 'min-w-0 truncate', 'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end']) assert.ok(tournamentsPage.includes(token), `Tournament mobile cards missing ${token}`);
assert.ok(!tournamentsPage.includes('<span \n                                      className="text-purple-400 cursor-pointer'));
assert.ok(!tournamentsPage.includes('className="mt-2 rounded bg-purple-600 px-2.5 py-1 text-[10px]'), 'Tournament schedule suggestion must remain a 44px mobile action.');
assert.match(tournamentsPage, /statusFilters\.map\(filter => \([\s\S]{0,400}className=\{`[^`]*min-h-11/, 'Tournament status filters must remain 44px mobile actions.');
assert.match(tournamentsPage, /renderFightStatsLink[\s\S]{0,700}<button\s+type="button"[\s\S]{0,250}className="[^"]*min-h-11/, 'Tournament fight stats links must be semantic 44px actions.');
assert.match(tournamentsPage, /activeTourneyList\.map[\s\S]{0,500}<button\s+type="button"\s+key=\{t\.id\}/, 'Tournament cards must be keyboard-accessible buttons.');
for (const token of ['grid grid-cols-1 gap-4 sm:grid-cols-2', 'grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]', 'min-w-0', '$.eventBuilder.card.moveUp', '$.eventBuilder.card.moveDown', '$.eventBuilder.card.remove']) assert.ok(eventBuilder.includes(token), `Event Builder mobile layout missing ${token}`);
assert.ok(app.includes("case 'settings'"));
const settings = readFileSync('src/pages/Settings.tsx', 'utf8');
for (const token of ['useTranslation', 'type="radio"', 'setUnitSystem', 'setLanguage', '$.settings.metric', '$.common.vietnamese']) assert.ok(settings.includes(token), `Settings missing ${token}`);
for (const path of ['Inbox.tsx', 'Calendar.tsx', 'Rankings.tsx', 'MmaGuide.tsx', 'Dashboard.tsx', 'EventBuilder.tsx', 'Tournaments.tsx']) {
  const source = readFileSync(`src/pages/${path}`, 'utf8');
  assert.ok(source.includes('useTranslation'), `${path} must use translations.`);
}
assert.ok(dashboard.includes('getPromotionInbox'));
assert.ok(eventBuilder.includes('campFocus'));
for (const token of ['OVR', 'POT', 'formatHeight', '$.fighterDetail.fightWeight', '$.fighterDetail.walkAroundWeight', '$.fighterDetail.weightCut', '$.fighterDetail.attribute.toughness', '$.fighterDetail.tabs.storylines', 'getFighterStorylines', 'getFighterSocialFeed', '$.fighterDetail.intensity', 'expiresDate', "setView('fighter-detail'", '$.fighterDetail.socialActivity']) assert.ok(fighterDetail.includes(token), `Fighter detail missing ${token}`);
for (const token of ['editFighter', 'FighterEditInput', '$.fighterDetail.editor.edit', '$.fighterDetail.editor.save', '$.fighterDetail.editor.cancel', '$.fighterDetail.editor.error', 'type="number"', 'draft.attributes', 'setEditError']) assert.ok(fighterDetail.includes(token), `Fighter editor missing ${token}`);
for (const token of ['f.careerPhase', 'f.retiredDate', 'f.retirementReason', 'f.hallOfFame', '$.fighterDetail.career.retired', '$.fighterDetail.career.retiredOn', '$.fighterDetail.career.retirementAge', '$.fighterDetail.career.hallOfFame']) assert.ok(fighterDetail.includes(token), `Retired fighter profile missing ${token}`);
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
for (const token of ["setView('fight-detail'", 'fightArchiveId', '$.fight.event.viewDetailsLabel']) assert.ok(eventSimulation.includes(token), `Past event results missing ${token}`);
for (const path of ['EventBuilder.tsx', 'Dashboard.tsx', 'EventSimulation.tsx', 'FightBattle.tsx', 'Tournaments.tsx', 'Roster.tsx', 'FreeAgents.tsx', 'FighterDetail.tsx', 'News.tsx', 'FightDetail.tsx', 'HistoryStats.tsx']) {
  const source = readFileSync(`src/pages/${path}`, 'utf8');
  assert.ok(source.includes('FighterRankBadge'), `Missing ranking context in ${path}`);
}
assert.ok(readFileSync('src/pages/Roster.tsx', 'utf8').includes("'rank'"), 'Roster must support rank sorting.');
assert.ok(readFileSync('src/pages/FightDetail.tsx', 'utf8').includes('$.fight.common.atFight'), 'Fight history must distinguish rank-at-fight.');
assert.ok(readFileSync('src/pages/FightDetail.tsx', 'utf8').includes('$.fight.common.current'), 'Fight history must distinguish current rank.');
const fightBattle = readFileSync('src/pages/FightBattle.tsx', 'utf8');
for (const token of ['role="meter"', 'aria-valuemin={0}', 'aria-valuemax={100}', 'aria-valuenow={value}', 'aria-live="polite"', '$.fight.battle.pause', '$.fight.battle.resume', '([1, 2, 4] as const)', 'x{speed}', '$.fight.battle.skip', '$.fight.common.round', 'positionLabels[session.position]', 'min-w-0']) assert.ok(fightBattle.includes(token), `Live fight stage missing ${token}`);
for (const token of ['$.fight.battle.redCorner', '$.fight.battle.blueCorner', '$.fight.battle.condition', '$.fight.battle.stamina', 'aria-label={label}']) assert.ok(fightBattle.includes(token), `Live fight meter missing ${token}`);
for (const token of ['fight-strike', 'fight-takedown', 'fight-clinch', 'fight-ground', 'fight-submission', 'fight-knockdown', 'fight-recovery', 'fight-finish', 'prefers-reduced-motion']) assert.ok(css.includes(token), `Live fight motion CSS missing ${token}`);
console.log('UI visual contracts passed.');
