import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { finalizeEventFinancials, quickSimulateEvent } from './src/lib/engine';
import { buildPromotionRankings, getEffectiveRankingScore, getFighterInactivityDays, getFighterRankContext, getRankingActivityStatus, updateRankings } from './src/lib/game/rankings';
import { CURRENT_SAVE_VERSION, validateAndMigrateState } from './src/lib/game/save';

const state = generateInitialWorld(1701);
const wc = 'Lightweight';
const ranked = state.rankings[wc].map(item => state.fighters[item.fighterId]).filter(Boolean);
assert.ok(ranked.length >= 4);
const undisputed = ranked[0];
const interim = ranked[1];
state.titles[wc] = { ...state.titles[wc], undisputedChampionId: undisputed.id, interimChampionId: interim.id };
undisputed.isChampion = true;
interim.isChampion = true;

assert.equal(getFighterRankContext(state, undisputed.id)?.label, 'C');
assert.equal(getFighterRankContext(state, interim.id)?.label, 'IC');
assert.equal(getFighterRankContext(state, ranked[2].id)?.label, '#1');
assert.equal(getFighterRankContext(state, ranked[3].id)?.label, '#2');
const freeAgent = Object.values(state.fighters).find(fighter => fighter.contract === null)!;
assert.equal(getFighterRankContext(state, freeAgent.id)?.label, 'UR');

const former = ranked[2];
const formerLabel = getFighterRankContext(state, former.id)!.label;
state.fighters[former.id] = { ...former, contract: null };
const reranked = updateRankings(state);
assert.equal(reranked.fighters[former.id].lastPromotionRank, formerLabel);

let archiveState = generateInitialWorld(1702);
const archiveRanking = archiveState.rankings.Lightweight;
const [redItem, blueItem] = archiveRanking.slice(0, 2);
const red = archiveState.fighters[redItem.fighterId];
const blue = archiveState.fighters[blueItem.fighterId];
const redSnapshot = getFighterRankContext(archiveState, red.id)!.label;
const blueSnapshot = getFighterRankContext(archiveState, blue.id)!.label;
archiveState.events = { rankEvent: { id: 'rankEvent', name: 'Rank Snapshot Event', date: archiveState.currentDate, venueId: Object.keys(archiveState.venues)[0], ticketPrice: 20, marketingSpend: 0, isCompleted: false, fights: [{ id: 'rank-fight', redCornerId: red.id, blueCornerId: blue.id, weightClass: 'Lightweight', isTitleFight: false, rounds: 3, result: { winnerId: red.id, loserId: blue.id, method: 'Unanimous Decision', round: 3, time: '5:00', commentary: [], performanceRating: 50 } }] } };
archiveState = finalizeEventFinancials(archiveState, 'rankEvent');
const archived = Object.values(archiveState.fightArchive)[0];
assert.equal(archived.redRankAtFight, redSnapshot);
assert.equal(archived.blueRankAtFight, blueSnapshot);

let quickState = generateInitialWorld(1704);
const [quickRedItem, quickBlueItem] = quickState.rankings.Lightweight.slice(0, 2);
const quickRedScore = quickState.fighters[quickRedItem.fighterId].rankingScore;
const quickBlueScore = quickState.fighters[quickBlueItem.fighterId].rankingScore;
quickState.events.quickRankEvent = {
  id: 'quickRankEvent',
  name: 'Quick Rank Event',
  date: quickState.currentDate,
  venueId: Object.keys(quickState.venues)[0],
  ticketPrice: 20,
  marketingSpend: 0,
  isCompleted: false,
  fights: [{ id: 'quick-rank-fight', redCornerId: quickRedItem.fighterId, blueCornerId: quickBlueItem.fighterId, weightClass: 'Lightweight', isTitleFight: false, rounds: 3 }]
};
quickState = quickSimulateEvent(quickState, 'quickRankEvent', 'en');
assert.ok(quickState.events.quickRankEvent.results?.rankingChanges);
assert.ok(quickState.fighters[quickRedItem.fighterId].rankingScore !== quickRedScore || quickState.fighters[quickBlueItem.fighterId].rankingScore !== quickBlueScore);

const legacy: any = structuredClone(archiveState);
legacy.saveVersion = CURRENT_SAVE_VERSION - 1;
delete legacy.fighters[red.id].lastPromotionRank;
delete legacy.fightArchive[archived.id].redRankAtFight;
delete legacy.fightArchive[archived.id].blueRankAtFight;
const migrated = validateAndMigrateState(legacy)!;
assert.ok(migrated);
assert.equal(migrated.fighters[red.id].lastPromotionRank, undefined);
assert.equal(migrated.fightArchive[archived.id].redRankAtFight, undefined);

const activityState = generateInitialWorld(1703);
activityState.currentDate = '2026-07-01';
const activityRanked = activityState.rankings.Lightweight.map(item => activityState.fighters[item.fighterId]).filter(Boolean);
const activeFighter = { ...activityRanked[0], rankingScore: 1200, lastFightDate: '2026-03-01' };
const nineMonthFighter = { ...activityRanked[1], rankingScore: 1200, lastFightDate: '2025-10-01' };
const inactiveFighter = { ...activityRanked[2], rankingScore: 1200, lastFightDate: '2025-07-01' };
const excludedFighter = { ...activityRanked[3], rankingScore: 1400, lastFightDate: '2024-12-29', isChampion: true };
activityState.fighters[activeFighter.id] = activeFighter;
activityState.fighters[nineMonthFighter.id] = nineMonthFighter;
activityState.fighters[inactiveFighter.id] = inactiveFighter;
activityState.fighters[excludedFighter.id] = excludedFighter;
activityState.titles.Lightweight = { ...activityState.titles.Lightweight, undisputedChampionId: excludedFighter.id };
assert.equal(getFighterInactivityDays(activeFighter, activityState.currentDate), 122);
assert.equal(getRankingActivityStatus(activeFighter, activityState.currentDate), 'active');
assert.equal(getRankingActivityStatus(nineMonthFighter, activityState.currentDate), 'active');
assert.equal(getRankingActivityStatus(inactiveFighter, activityState.currentDate), 'inactive');
assert.equal(getRankingActivityStatus(excludedFighter, activityState.currentDate), 'unranked-inactive');
assert.equal(getEffectiveRankingScore(activityState, activeFighter), 1200);
assert.ok(getEffectiveRankingScore(activityState, inactiveFighter) < inactiveFighter.rankingScore!);
assert.ok(getEffectiveRankingScore(activityState, { ...inactiveFighter, lastFightDate: '2025-04-01' }) < getEffectiveRankingScore(activityState, inactiveFighter));
const storedScores = Object.fromEntries(Object.values(activityState.fighters).map(fighter => [fighter.id, fighter.rankingScore]));
let activityRankings = buildPromotionRankings(activityState).newRankings.Lightweight;
assert.equal(activityRankings[0].fighterId, excludedFighter.id);
const nonChampionExcluded = { ...activityState, titles: { ...activityState.titles, Lightweight: { ...activityState.titles.Lightweight, undisputedChampionId: null } } };
activityRankings = buildPromotionRankings(nonChampionExcluded).newRankings.Lightweight;
assert.equal(activityRankings.some(item => item.fighterId === excludedFighter.id), false);
const retired = activityRanked[4];
activityState.fighters[retired.id] = { ...retired, careerPhase: 'retired' };
const unsigned = activityRanked[5];
activityState.fighters[unsigned.id] = { ...unsigned, contract: null };
activityRankings = buildPromotionRankings(activityState).newRankings.Lightweight;
assert.equal(activityRankings.some(item => item.fighterId === retired.id || item.fighterId === unsigned.id), false);
const refreshed = updateRankings(activityState);
assert.deepEqual(Object.fromEntries(Object.values(refreshed.fighters).map(fighter => [fighter.id, fighter.rankingScore])), storedScores);
const returnedState = { ...nonChampionExcluded, fighters: { ...nonChampionExcluded.fighters, [excludedFighter.id]: { ...excludedFighter, lastFightDate: activityState.currentDate, rankingScore: 1001 } } };
const returnedRankings = buildPromotionRankings(returnedState).newRankings.Lightweight;
assert.equal(returnedRankings.some(item => item.fighterId === excludedFighter.id), true);
assert.notEqual(returnedRankings[0].fighterId, excludedFighter.id);

let archiveScans = 0;
returnedState.fightArchive = new Proxy(returnedState.fightArchive, {
  ownKeys(target) {
    archiveScans++;
    return Reflect.ownKeys(target);
  }
});
buildPromotionRankings(returnedState);
assert.equal(archiveScans, 1, 'A ranking rebuild must scan the fight archive only once.');
console.log('Ranking context contracts passed.');
