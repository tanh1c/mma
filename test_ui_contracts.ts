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
assert.match(dataSurfaceClasses, /min-w-0/);
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
for (const label of ['Dashboard', 'Roster', 'Calendar', 'Book Event', 'Rankings', 'Tournaments', 'Leagues', 'Free Agents', 'Contract Market', 'Social Hub', 'History & Stats', 'Debug Sim', 'Settings']) {
  assert.ok(labels.includes(label), `Missing navigation item: ${label}`);
}
for (const label of ['Save', 'Load', 'Export', 'Import']) assert.ok(!labels.includes(label));

const select = readFileSync('src/components/Select.tsx', 'utf8');
for (const token of ['aria-expanded', 'aria-haspopup="listbox"', 'role="listbox"', 'role="option"', 'min-h-11', 'focus-visible']) assert.ok(select.includes(token));
assert.ok(!select.includes('role="combobox"'));

const app = readFileSync('src/App.tsx', 'utf8');
for (const token of ['accept=".json"', 'reader.readAsText(file)', 'saveGame', 'loadGame', 'exportGame', 'importGame', "case 'inbox'", 'useTranslation', '$.common.save', '$.search.placeholder']) assert.ok(app.includes(token));
const shell = readFileSync('src/components/AppShell.tsx', 'utf8');
const sharedUi = readFileSync('src/components/ui.tsx', 'utf8');
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
const leagues = readFileSync('src/pages/Leagues.tsx', 'utf8');
const market = readFileSync('src/pages/ContractMarket.tsx', 'utf8');
const finances = readFileSync('src/pages/PromotionFinances.tsx', 'utf8');
const inboxData = readFileSync('src/lib/game/inbox.ts', 'utf8');
const inboxPage = readFileSync('src/pages/Inbox.tsx', 'utf8');
const debugSim = readFileSync('src/pages/DebugSim.tsx', 'utf8');
for (const token of ['autopilotRun', 'daysCompleted', 'targetDays']) assert.ok(dashboard.includes(token), `Observer progress UI missing ${token}`);
assert.ok(!dashboard.includes('setTimeout(() =>'), 'Observer controls must not fake loading with a timeout.');
assert.ok(debugSim.includes('await useGameStore.getState().advanceAutopilot'), 'Debug simulation report must await autopilot completion.');
for (const token of ['inert={locked || undefined}', 'aria-busy={locked || undefined}', 'role="progressbar"', 'aria-valuemin={0}', 'aria-valuemax={lockProgress.max}', 'aria-valuenow={lockProgress.value}']) assert.ok(shell.includes(token), `Global autopilot lock missing ${token}`);
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
assert.doesNotMatch(shell, /<main className="[^"]*\[overflow-wrap:anywhere\]/, 'Main content must not force titles and pill labels to break anywhere.');
assert.match(shell, /const brand = \(\s*<div className="min-w-0 flex-1 border-b/, 'Mobile drawer brand must shrink before pushing its close button off-screen.');
for (const token of ['min-w-0 rounded-lg border', 'leading-tight', 'leading-none']) assert.ok(sharedUi.includes(token), `Shared wrapped-card UI missing ${token}`);
assert.match(sharedUi, /<span className="min-w-0 truncate">\{children\}<\/span>/, 'Status badges must truncate through a shrinkable text wrapper.');
assert.doesNotMatch(sharedUi, /inline-flex max-w-full shrink-0/, 'Status badges must be allowed to shrink inside constrained rows.');
assert.ok(socialHub.includes('flex flex-wrap gap-2'), 'Social Hub filters must wrap on mobile');
assert.ok(fighterDetail.includes('flex flex-wrap border-b'), 'Fighter detail tabs must wrap on mobile');
for (const token of ['md:hidden', 'hidden md:block', 'grid grid-cols-1 gap-2 sm:grid-cols-2', 'min-w-0 break-words', 'min-h-11 w-full sm:w-auto']) assert.ok(calendarPage.includes(token), `Calendar mobile cards missing ${token}`);
for (const token of ['grid grid-cols-2 gap-1 sm:grid-cols-4', 'flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', 'min-h-11 w-full sm:w-auto', "isEight ? 'sm:grid-cols-3' : 'sm:grid-cols-2'", 'min-w-0 truncate', 'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end']) assert.ok(tournamentsPage.includes(token), `Tournament mobile cards missing ${token}`);
for (const token of ['useTranslation', '$.leagues.title', 'state.promotions', 'rankingsByPromotion', 'titlesByPromotion', 'internationalTitles', 'getInternationalQualifiers', "setView('fighter-detail'", 'min-w-0', 'grid grid-cols-1']) assert.ok(leagues.includes(token), `Leagues UI missing ${token}`);
for (const token of ['useTranslation', '$.contractMarket.title', 'getCurrentContractWindow', 'getMarketCompetition', 'getVisibleMarketOffers', 'listMarketFighter', 'submitMarketOffer', 'respondToMarketOffer', "'available'", "'listings'", "'incoming'", "'offers'", "'history'", 'aria-live="polite"', 'type="button"', 'grid-cols-1', 'min-w-0']) assert.ok(market.includes(token), `Contract Market UI missing ${token}`);
assert.ok(app.includes("case 'contract-market'"));
assert.ok(shell.includes("case 'contract-market'"));
for (const token of ['useTranslation', '$.promotionFinances.title', 'promotionEconomies', 'getPromotionFinancialSnapshot', 'investInBrand', 'aria-live="polite"', 'aria-label', '<label', '<table', '<caption', '<th', 'scope="col"', 'type="number"', 'type="submit"', 'grid-cols-1', 'min-w-0', 'min-h-11']) assert.ok(finances.includes(token), `Promotion Finances UI missing ${token}`);
assert.ok(app.includes("case 'promotion-finances'"));
assert.ok(shell.includes("'promotion-finances'"));
assert.ok(dashboard.includes("setView('promotion-finances')"));
assert.ok(market.includes("setView('promotion-finances')"));
assert.ok(!market.includes('contractMarket.offers['), 'UI must use sealed visibility selectors rather than raw rival offer values');
for (const token of ["scope === 'promotion'", "scope === 'international'", '$.tournaments.domestic', '$.tournaments.international']) assert.ok(tournamentsPage.includes(token), `Tournament scope UI missing ${token}`);
for (const token of ["event.scope === 'international'", "event.promotionId === state.playerPromotionId"]) assert.ok(calendarPage.includes(token), `Calendar scope UI missing ${token}`);
assert.ok(!tournamentsPage.includes('<span \n                                      className="text-purple-400 cursor-pointer'));
assert.ok(!tournamentsPage.includes('className="mt-2 rounded bg-purple-600 px-2.5 py-1 text-[10px]'), 'Tournament schedule suggestion must remain a 44px mobile action.');
assert.match(tournamentsPage, /statusFilters\.map\(filter => \([\s\S]{0,400}className=\{`[^`]*min-h-11/, 'Tournament status filters must remain 44px mobile actions.');
assert.match(tournamentsPage, /renderFightStatsLink[\s\S]{0,700}<button\s+type="button"[\s\S]{0,250}className="[^"]*min-h-11/, 'Tournament fight stats links must be semantic 44px actions.');
assert.match(tournamentsPage, /activeTourneyList\.map[\s\S]{0,500}<button\s+type="button"\s+key=\{t\.id\}/, 'Tournament cards must be keyboard-accessible buttons.');
for (const token of ['grid grid-cols-1 gap-4 sm:grid-cols-2', 'grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]', 'min-w-0', '$.eventBuilder.card.moveUp', '$.eventBuilder.card.moveDown', '$.eventBuilder.card.remove']) assert.ok(eventBuilder.includes(token), `Event Builder mobile layout missing ${token}`);
assert.ok(app.includes("case 'settings'"));
const settings = readFileSync('src/pages/Settings.tsx', 'utf8');
for (const token of ['useTranslation', 'type="radio"', 'setUnitSystem', 'setLanguage', '$.settings.metric', '$.common.vietnamese']) assert.ok(settings.includes(token), `Settings missing ${token}`);
for (const path of ['Inbox.tsx', 'Calendar.tsx', 'Rankings.tsx', 'MmaGuide.tsx', 'Dashboard.tsx', 'EventBuilder.tsx', 'Tournaments.tsx', 'Leagues.tsx', 'PromotionFinances.tsx']) {
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
const fightSpriteStage = readFileSync('src/components/FightSpriteStage.tsx', 'utf8');
for (const token of ['role="meter"', 'aria-valuemin={0}', 'aria-valuemax={100}', 'aria-valuenow={value}', 'aria-live="polite"', '$.fight.battle.pause', '$.fight.battle.resume', '([1, 2, 4] as const)', 'x{speed}', '$.fight.battle.skip', '$.fight.common.round', 'positionLabels[session.position]', 'min-w-0']) assert.ok(fightBattle.includes(token), `Live fight stage missing ${token}`);
assert.ok(!fightBattle.includes('setTimeout(advanceLiveFight, 1400 / playbackSpeed)'));
for (const token of [
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'advanceFightPlayback',
  'overflowFightMs',
  'fightPlaybackProgress',
  'interpolateFightDisplay',
  'eventElapsedMs',
  'checkpointLiveFightPlayback',
  'checkpointAtWallTime',
  'performance.now()',
  'continueLiveFightRound',
  "status === 'between-rounds'",
  '$.fight.battle.continueRound'
]) assert.ok(fightBattle.includes(token), `Full-time fight playback missing ${token}`);
assert.ok(fightBattle.includes('Math.ceil(display.clockMs / 1_000)'), 'Visible clock must use interpolated display clock.');
assert.ok(fightBattle.includes('condition={display.redCondition}') && fightBattle.includes('stamina={display.redStamina}') && fightBattle.includes('condition={display.blueCondition}') && fightBattle.includes('stamina={display.blueStamina}'), 'Combatants must receive interpolated display meters.');
assert.ok(fightBattle.includes('eventProgress < 1 ? playbackSnapshot.currentRoundStats : session.currentRoundStats'), 'Current round stats must stay on the snapshot until event completion.');
assert.ok(fightBattle.includes("session.timeline.filter(event => event.importance !== 'routine')"), 'Commentary highlights must ignore routine events.');
assert.match(fightBattle, /aria-live="polite"[^>]*>\{liveHeadline\}/, 'Live headline must use highlight-only output.');
assert.ok(fightBattle.includes('eventElapsedMs={localElapsedMs}'), 'Sprite stage must receive local elapsed progress.');
assert.ok(!fightBattle.includes('checkpointLiveFightPlayback(latestEvent.sequence, elapsed)'), 'Store checkpoint must not run per animation frame.');
assert.ok(fightBattle.includes('onClick={handleTogglePause}') && fightBattle.includes('onClick={() => handleSetPlayback(speed)}'), 'Pause/speed controls must checkpoint wall time before store updates.');
assert.ok(!fightBattle.includes('lastWallRef.current = null;\n    completedSequenceRef.current = null;'), 'Event changes must preserve the wall-clock boundary for overflow accounting.');
for (const token of ['$.fight.battle.redCorner', '$.fight.battle.blueCorner', '$.fight.battle.condition', '$.fight.battle.stamina', 'aria-label={label}', 'FightSpriteStage', 'FighterAvatar']) assert.ok(fightBattle.includes(token), `Live fight meter missing ${token}`);
for (const token of ['loadFightSpriteManifest', 'resolveFightSpriteScene', 'fightSpriteFrameIndex', 'fightSpriteFrameDelay', 'interactionOffset', 'impactFrames', 'aria-hidden="true"', 'backgroundPosition', 'anchor === \'contact\' ? 50', 'w-[46%] max-w-72 sm:w-[40%]', 'overflow-hidden', 'min-w-0', 'onAssetError', 'src={`/sprites/${current.path}`}']) assert.ok(fightSpriteStage.includes(token), `Fight sprite renderer missing ${token}`);
assert.ok(!fightSpriteStage.includes('w-[46%] max-w-72 -translate-x-1/2 sm:w-[40%]'), 'Fighter wrappers must not apply both Tailwind and inline horizontal translation.');
for (const token of [
  'eventElapsedMs',
  'fightSpritePlaybackSegment',
  'fightSpriteCycleDuration',
  'fightSpriteSourceSegmentDuration(actorAction',
  'elapsedMs >= fightSpriteCycleDuration(action, 1)',
  'impactElapsedMs',
  'eventElapsedMs >= impactElapsedMs',
  'fightSpriteFrameIndex(action, elapsedMs)',
  'frame / Math.max(1, action.frameCount - 1) * 100',
  'const paired = Boolean(current.interaction)'
]) assert.ok(fightSpriteStage.includes(token), `Event-clock sprite playback missing ${token}`);
assert.ok(!fightSpriteStage.includes('onAnimationEnd'));
assert.ok(!fightSpriteStage.includes('useState({ eventSequence'));
for (const token of ["fightSpriteStrikeOffset", "event.visual.strike ?? 'hook'", "corner === 'red' ? -strikeOffset : strikeOffset", "anchor === 'contact' ? 0 : anchor === 'actor' ? actorOffset : -actorOffset", "translateX(calc(-50% + ${effectOffset}%)"]) assert.ok(fightSpriteStage.includes(token), `Strike contact distance missing ${token}`);
for (const token of ['fight-strike', 'fight-takedown', 'fight-clinch', 'fight-ground', 'fight-submission', 'fight-knockdown', 'fight-recovery', 'fight-finish', 'fight-sprite-frame', 'fight-sprite-effect', 'image-rendering: pixelated', 'opacity: 1', 'prefers-reduced-motion']) assert.ok(css.includes(token), `Live fight motion CSS missing ${token}`);
assert.ok(!css.includes('@keyframes fight-sprite-strip'), 'Sprite frames must be positioned from deterministic fight elapsed time.');
assert.doesNotMatch(css, /prefers-reduced-motion:[\s\S]*\.fight-sprite-frame\s*\{[^}]*background-position:/, 'Reduced motion must not override deterministic sprite frame progression.');
assert.ok(!fightSpriteStage.includes('advanceLiveFight'), 'Sprite renderer must not advance simulation from motion preferences.');
assert.ok(fightSpriteStage.includes('new Map') && fightSpriteStage.includes('action.path'), 'Sprite preloads must deduplicate shared fighter/effect paths.');
assert.ok(fightSpriteStage.includes('redAction.interaction?.syncPartner === scene.blue.animationId') && fightSpriteStage.includes('blueAction.interaction?.syncPartner === scene.red.animationId'), 'Shared follow-up timing must only apply to synchronized interaction partners.');
assert.match(fightBattle, /aria-live="polite"[^>]*>\{liveHeadline\}/, 'Reduced motion must preserve textual live updates.');
console.log('UI visual contracts passed.');
