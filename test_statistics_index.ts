import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { getFightElapsedSeconds, getFighterStatistics, getStatisticsIndex, safeRatio } from './src/lib/game/statistics';
import type { FightArchiveItem, RoundStats } from './src/types/game';

const state = generateInitialWorld(2304);
const [fighter, opponent] = Object.values(state.fighters).slice(0, 2);
const round: RoundStats = {
  round: 1,
  red: {
    totalStrikesAttempted: 20, totalStrikesLanded: 10,
    significantStrikesAttempted: 12, significantStrikesLanded: 6,
    headStrikesLanded: 3, bodyStrikesLanded: 2, legStrikesLanded: 1,
    takedownsAttempted: 2, takedownsLanded: 1,
    submissionAttempts: 1, reversals: 0, knockdowns: 1,
    controlSeconds: 45, damageGiven: 30, damageTaken: 12,
    staminaStart: 100, staminaEnd: 80
  },
  blue: {
    totalStrikesAttempted: 10, totalStrikesLanded: 4,
    significantStrikesAttempted: 8, significantStrikesLanded: 3,
    headStrikesLanded: 2, bodyStrikesLanded: 1, legStrikesLanded: 0,
    takedownsAttempted: 1, takedownsLanded: 0,
    submissionAttempts: 0, reversals: 1, knockdowns: 0,
    controlSeconds: 10, damageGiven: 12, damageTaken: 30,
    staminaStart: 100, staminaEnd: 75
  },
  judges: [], redTechnicalScore: 10, blueTechnicalScore: 9,
  summary: '', keyMoments: []
};
const tracked: FightArchiveItem = {
  id: 'tracked', promotionId: state.playerPromotionId, scope: 'promotion', date: '2025-01-02', eventId: 'event-tracked', eventName: 'Tracked Event',
  weightClass: fighter.weightClass, redFighterId: fighter.id, blueFighterId: opponent.id, winnerId: fighter.id,
  method: 'Unanimous Decision', round: 2, time: '1:30', isTitleFight: true, performanceRating: 80,
  roundStats: [round], titleChangeInfo: { type: 'new_champion', previousChampionId: opponent.id },
  compensation: [
    { fighterId: fighter.id, promotionIdAtFight: state.playerPromotionId, basePurse: 12_000, winBonus: 8_000, total: 20_000 },
    { fighterId: opponent.id, promotionIdAtFight: state.playerPromotionId, basePurse: 9_000, winBonus: 0, total: 9_000 }
  ]
};
const legacy: FightArchiveItem = {
  id: 'legacy', promotionId: state.playerPromotionId, scope: 'promotion', date: '2025-02-03', eventId: 'event-legacy', eventName: 'Legacy Event',
  weightClass: fighter.weightClass, redFighterId: opponent.id, blueFighterId: fighter.id, winnerId: opponent.id,
  method: 'KO/TKO', round: 1, time: '2:00', isTitleFight: false, performanceRating: 65
};
state.fightArchive = { tracked, legacy };
state.eventArchive = {};
state.titleHistory = [{
  id: 'reign', promotionId: state.playerPromotionId, scope: 'promotion', weightClass: fighter.weightClass,
  fighterId: fighter.id, dateWon: tracked.date, dateLost: null, defenses: 2, wonFromFighterId: opponent.id,
  status: 'active', beltType: 'undisputed', winEventId: tracked.eventId
}];
state.fighterRankingHistory = [
  { id: 'ranking-old', date: '2025-01-03', fighterId: fighter.id, scope: 'promotion', promotionId: state.playerPromotionId, weightClass: fighter.weightClass, previousRank: 5, rank: 4 },
  { id: 'ranking-new', date: '2025-02-04', fighterId: fighter.id, scope: 'world', weightClass: fighter.weightClass, previousRank: 8, rank: 6 }
];

const first = getStatisticsIndex(state);
assert.strictEqual(getStatisticsIndex(state), first);
assert.notStrictEqual(getStatisticsIndex({ ...state, fightArchive: { ...state.fightArchive } }), first);

const stats = getFighterStatistics(state, fighter.id);
assert.equal(stats.fights, 2);
assert.equal(stats.wins, 1);
assert.equal(stats.losses, 1);
assert.equal(stats.draws, 0);
assert.equal(stats.decisionWins, 1);
assert.equal(stats.currentWinStreak, 0);
assert.equal(stats.longestWinStreak, 1);
assert.equal(stats.titleFights, 1);
assert.equal(stats.titleWins, 1);
assert.equal(stats.titleDefenses, 2);
assert.equal(stats.trackedEarnings, 20_000);
assert.equal(stats.trackedFightCount, 1);
assert.equal(stats.technical.fightsWithStats, 1);
assert.equal(stats.technical.totalStrikesLanded, 10);
assert.equal(stats.technical.damageGiven, 30);
assert.equal(stats.technical.damageTaken, 12);
assert.equal(stats.perFight.find(row => row.id === 'legacy')!.payout, null);
assert.deepEqual(stats.rankingHistory.map(item => item.id), ['ranking-new', 'ranking-old']);

const opponentStats = getFighterStatistics(state, opponent.id);
assert.equal(opponentStats.technical.totalStrikesLanded, 4);
assert.equal(opponentStats.technical.damageGiven, 12);
assert.equal(opponentStats.technical.damageTaken, 30);
assert.equal(safeRatio(1, 0), null);
assert.equal(safeRatio(3, 2), 1.5);
assert.equal(getFightElapsedSeconds(2, '1:30'), 390);

console.log('Statistics index checks passed.');
