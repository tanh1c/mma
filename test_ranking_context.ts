import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { finalizeEventFinancials } from './src/lib/engine';
import { getFighterRankContext, updateRankings } from './src/lib/game/rankings';
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

const legacy: any = structuredClone(archiveState);
legacy.saveVersion = CURRENT_SAVE_VERSION - 1;
delete legacy.fighters[red.id].lastPromotionRank;
delete legacy.fightArchive[archived.id].redRankAtFight;
delete legacy.fightArchive[archived.id].blueRankAtFight;
const migrated = validateAndMigrateState(legacy)!;
assert.ok(migrated);
assert.equal(migrated.fighters[red.id].lastPromotionRank, undefined);
assert.equal(migrated.fightArchive[archived.id].redRankAtFight, undefined);
console.log('Ranking context contracts passed.');
