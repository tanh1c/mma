import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { recordRankingHistory, updateRankings } from './src/lib/game/rankings';
import type { GameState, RankingItem, WeightClass } from './src/types/game';

const replacePositions = (items: RankingItem[], fighterIds: string[]): RankingItem[] => fighterIds.map((fighterId, rank) => ({ fighterId, rank, trend: 0 }));
const scopedRows = (state: GameState, scope: 'promotion' | 'world', weightClass: WeightClass, promotionId?: string) => state.fighterRankingHistory
  .filter(item => item.scope === scope && item.weightClass === weightClass && item.promotionId === promotionId)
  .map(item => [item.fighterId, item.previousRank, item.rank]);

const before = structuredClone(generateInitialWorld(2303));
before.statisticsTrackingStartedAt = before.currentDate;
before.fighterRankingHistory = [];
const promotionId = before.playerPromotionId;
const weightClass: WeightClass = 'Lightweight';
const original = before.rankings[weightClass];
const [a, b] = original;
const after = structuredClone(before);
after.rankings[weightClass] = [...replacePositions(original, [b.fighterId, a.fighterId]), ...original.slice(2).map((item, index) => ({ ...item, rank: index + 2 }))];
after.rankingsByPromotion[promotionId] = after.rankings;

const recorded = recordRankingHistory(before, after);
assert.deepEqual(scopedRows(recorded, 'promotion', weightClass, promotionId), [
  [a.fighterId, 1, 2],
  [b.fighterId, 2, 1]
].sort(([left], [right]) => String(left).localeCompare(String(right))));
assert.deepEqual(recordRankingHistory(before, recorded), recorded);

const worldAfter = structuredClone(before);
const worldFirst = worldAfter.worldRankings[weightClass][0];
worldAfter.worldRankings[weightClass] = worldAfter.worldRankings[weightClass].slice(1).map((item, rank) => ({ ...item, rank }));
const worldRecorded = recordRankingHistory(before, worldAfter);
assert.deepEqual(scopedRows(worldRecorded, 'world', weightClass).find(([fighterId]) => fighterId === worldFirst.fighterId), [worldFirst.fighterId, 1, undefined]);
assert.equal(worldRecorded.fighterRankingHistory.some(item => item.scope === 'promotion'), false);

const entryBefore = structuredClone(before);
entryBefore.rankings[weightClass] = entryBefore.rankings[weightClass].slice(1).map((item, rank) => ({ ...item, rank }));
entryBefore.rankingsByPromotion[promotionId] = entryBefore.rankings;
const entryAfter = structuredClone(entryBefore);
entryAfter.rankings[weightClass] = [a, ...entryAfter.rankings[weightClass]].map((item, rank) => ({ ...item, rank }));
entryAfter.rankingsByPromotion[promotionId] = entryAfter.rankings;
const entryRecorded = recordRankingHistory(entryBefore, entryAfter);
assert.deepEqual(scopedRows(entryRecorded, 'promotion', weightClass, promotionId).find(([fighterId]) => fighterId === a.fighterId), [a.fighterId, undefined, 1]);

const movedAgain = structuredClone(recorded);
movedAgain.rankings[weightClass] = [
  { ...movedAgain.rankings[weightClass][0], rank: 1 },
  { ...movedAgain.rankings[weightClass][1], rank: 0 },
  ...movedAgain.rankings[weightClass].slice(2)
];
movedAgain.rankingsByPromotion[promotionId] = movedAgain.rankings;
const returned = recordRankingHistory(recorded, movedAgain);
assert.equal(returned.fighterRankingHistory.some(item => item.scope === 'promotion' && item.weightClass === weightClass && [a.fighterId, b.fighterId].includes(item.fighterId)), false);

const secondMove = structuredClone(recorded);
const third = secondMove.rankings[weightClass][2];
secondMove.rankings[weightClass] = [
  { ...third, rank: 0 },
  { ...secondMove.rankings[weightClass][0], rank: 1 },
  { ...secondMove.rankings[weightClass][1], rank: 2 },
  ...secondMove.rankings[weightClass].slice(3)
];
secondMove.rankingsByPromotion[promotionId] = secondMove.rankings;
const coalesced = recordRankingHistory(recorded, secondMove);
const aRow = coalesced.fighterRankingHistory.find(item => item.scope === 'promotion' && item.weightClass === weightClass && item.fighterId === a.fighterId)!;
assert.equal(aRow.previousRank, 1);
assert.equal(aRow.rank, 3);
assert.equal(coalesced.fighterRankingHistory.filter(item => item.id === aRow.id).length, 1);

const otherDivision = structuredClone(before);
const featherweight: WeightClass = 'Featherweight';
const [fa, fb] = otherDivision.rankings[featherweight];
otherDivision.rankings[featherweight] = [fb, fa, ...otherDivision.rankings[featherweight].slice(2)].map((item, rank) => ({ ...item, rank }));
otherDivision.rankingsByPromotion[promotionId] = otherDivision.rankings;
const multiDivision = recordRankingHistory(before, otherDivision);
assert.ok(multiDivision.fighterRankingHistory.every(item => item.weightClass === featherweight));

const preTracking = structuredClone(before);
preTracking.statisticsTrackingStartedAt = '2025-02-01';
const preTrackingAfter = { ...after, statisticsTrackingStartedAt: '2025-02-01' };
assert.strictEqual(recordRankingHistory(preTracking, preTrackingAfter), preTrackingAfter);

const scoreState = structuredClone(generateInitialWorld(2313));
scoreState.statisticsTrackingStartedAt = scoreState.currentDate;
scoreState.fighterRankingHistory = [];
const scoreItems = scoreState.rankings[weightClass];
scoreState.fighters[scoreItems[5].fighterId].rankingScore = 10_000;
const updated = updateRankings(scoreState, undefined, scoreState.playerPromotionId);
assert.ok(updated.fighterRankingHistory.some(item => item.scope === 'promotion' && item.weightClass === weightClass));
assert.ok(updated.fighterRankingHistory.some(item => item.scope === 'world' && item.weightClass === weightClass));
assert.deepEqual(updateRankings(updated, undefined, updated.playerPromotionId).fighterRankingHistory, updated.fighterRankingHistory);

console.log('Ranking history checks passed.');
