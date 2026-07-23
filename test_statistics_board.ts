import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { getStatsBoard, MIN_ACCURACY_ATTEMPTS, MIN_WIN_PERCENTAGE_FIGHTS } from './src/lib/game/statistics';
import type { EventArchiveItem, FightArchiveItem, FighterRoundStats, GrandPrixTournament, RoundStats, WeightClass } from './src/types/game';

const state = generateInitialWorld(2305);
state.currentDate = '2026-06-01';
const [player, rival] = Object.values(state.promotions);
assert.ok(player && rival);
const fighters = Object.values(state.fighters).slice(0, 6);
const [a, b, c, d, e, f] = fighters;
const lightweight: WeightClass = 'Lightweight';
const welterweight: WeightClass = 'Welterweight';
for (const fighter of [a, b, c, d]) fighter.weightClass = lightweight;
for (const fighter of [e, f]) fighter.weightClass = welterweight;
state.fighters[a.id] = { ...a, contract: { ...a.contract!, promotionId: rival.id } };

const side = (attempted: number, landed: number, knockdowns = 0, controlSeconds = 0): FighterRoundStats => ({
  totalStrikesAttempted: attempted + 5, totalStrikesLanded: landed + 2,
  significantStrikesAttempted: attempted, significantStrikesLanded: landed,
  headStrikesLanded: landed, bodyStrikesLanded: 0, legStrikesLanded: 0,
  takedownsAttempted: attempted >= 20 ? 20 : 2, takedownsLanded: attempted >= 20 ? 10 : 1,
  submissionAttempts: 0, reversals: 0, knockdowns, controlSeconds,
  damageGiven: landed * 2, damageTaken: landed, staminaStart: 100, staminaEnd: 80
});
const round = (red: FighterRoundStats, blue: FighterRoundStats): RoundStats => ({ round: 1, red, blue, judges: [], redTechnicalScore: 10, blueTechnicalScore: 9, summary: '', keyMoments: [] });
const fight = (input: Partial<FightArchiveItem> & Pick<FightArchiveItem, 'id' | 'date' | 'eventId' | 'eventName' | 'redFighterId' | 'blueFighterId' | 'winnerId'>): FightArchiveItem => ({
  promotionId: player.id, scope: 'promotion', weightClass: lightweight, method: 'Unanimous Decision', round: 3, time: '5:00', isTitleFight: false, performanceRating: 70,
  ...input
});
const owned = (redId: string, blueId: string, redPromotionId: string | null, bluePromotionId: string | null) => [
  { fighterId: redId, promotionIdAtFight: redPromotionId, basePurse: 10_000, winBonus: 5_000, total: 15_000 },
  { fighterId: blueId, promotionIdAtFight: bluePromotionId, basePurse: 8_000, winBonus: 0, total: 8_000 }
];

const fights: FightArchiveItem[] = [
  fight({ id: 'p1-2025', date: '2025-03-01', eventId: 'event-p1-2025', eventName: 'P1 2025', redFighterId: a.id, blueFighterId: b.id, winnerId: a.id, method: 'KO/TKO', round: 1, time: '1:00', performanceRating: 95, isTitleFight: true, titleChangeInfo: { type: 'new_champion', previousChampionId: b.id }, roundStats: [round(side(25, 15, 2, 60), side(19, 8, 0, 10))], compensation: owned(a.id, b.id, player.id, player.id) }),
  fight({ id: 'p1-2026-a', date: '2026-02-01', eventId: 'event-p1-2026', eventName: 'P1 2026', redFighterId: a.id, blueFighterId: c.id, winnerId: a.id, method: 'Submission', round: 2, time: '2:00', performanceRating: 80, isTitleFight: true, titleChangeInfo: { type: 'title_defense', previousChampionId: a.id }, roundStats: [round(side(20, 10, 1, 90), side(10, 4, 0, 20))], compensation: owned(a.id, c.id, player.id, rival.id) }),
  fight({ id: 'p1-2026-b', date: '2026-03-01', eventId: 'event-p1-2026', eventName: 'P1 2026', redFighterId: d.id, blueFighterId: a.id, winnerId: a.id, method: 'Split Decision', performanceRating: 75, roundStats: [round(side(8, 3, 0, 15), side(20, 11, 1, 100))], compensation: owned(d.id, a.id, rival.id, player.id) }),
  fight({ id: 'p2-2025', date: '2025-04-01', eventId: 'event-p2-2025', eventName: 'P2 2025', promotionId: rival.id, redFighterId: c.id, blueFighterId: d.id, winnerId: c.id, compensation: owned(c.id, d.id, rival.id, rival.id) }),
  fight({ id: 'welter-2025', date: '2025-05-01', eventId: 'event-p1-welter', eventName: 'Welter 2025', weightClass: welterweight, redFighterId: e.id, blueFighterId: f.id, winnerId: e.id, compensation: owned(e.id, f.id, player.id, player.id) }),
  fight({ id: 'international', date: '2026-04-01', eventId: 'event-international', eventName: 'Champions Cup', promotionId: null, scope: 'international', redFighterId: a.id, blueFighterId: c.id, winnerId: a.id, method: 'KO/TKO', round: 1, time: '0:30', performanceRating: 90, compensation: owned(a.id, c.id, player.id, rival.id).map(item => ({ ...item, basePurse: 0, winBonus: 0, total: 0 })) }),
  fight({ id: 'legacy', date: '2025-06-01', eventId: 'event-legacy', eventName: 'Legacy', redFighterId: a.id, blueFighterId: d.id, winnerId: d.id }),
  fight({ id: 'future', date: '2026-12-01', eventId: 'event-future', eventName: 'Future', redFighterId: b.id, blueFighterId: a.id, winnerId: b.id, compensation: owned(b.id, a.id, player.id, player.id) })
];
state.fightArchive = Object.fromEntries(fights.map(item => [item.id, item]));

const event = (id: string, name: string, date: string, promotionId: string | null, scope: 'promotion' | 'international', fightIds: string[], revenue: number, cost: number, fanReaction: number): EventArchiveItem => ({
  id, name, date, promotionId, scope, attendance: revenue / 10, revenue, cost, profit: revenue - cost, fanReaction, fightIds,
  fighterBasePay: 18_000, fighterWinBonuses: 5_000
});
state.eventArchive = Object.fromEntries([
  event('event-p1-2025', 'P1 2025', '2025-03-01', player.id, 'promotion', ['p1-2025'], 100_000, 60_000, 92),
  event('event-p1-2026', 'P1 2026', '2026-03-01', player.id, 'promotion', ['p1-2026-a', 'p1-2026-b'], 150_000, 90_000, 85),
  event('event-p2-2025', 'P2 2025', '2025-04-01', rival.id, 'promotion', ['p2-2025'], 80_000, 50_000, 70),
  event('event-p1-welter', 'Welter 2025', '2025-05-01', player.id, 'promotion', ['welter-2025'], 50_000, 55_000, 65),
  event('event-international', 'Champions Cup', '2026-04-01', null, 'international', ['international'], 0, 0, 90)
].map(item => [item.id, item]));

state.titleHistory = [
  { id: 'active-reign', promotionId: player.id, scope: 'promotion', weightClass: lightweight, fighterId: a.id, dateWon: '2025-03-01', dateLost: null, defenses: 1, wonFromFighterId: b.id, status: 'active', beltType: 'undisputed' },
  { id: 'completed-reign', promotionId: rival.id, scope: 'promotion', weightClass: lightweight, fighterId: c.id, dateWon: '2025-01-01', dateLost: '2025-04-01', defenses: 2, wonFromFighterId: d.id, status: 'lost', beltType: 'undisputed' }
];
const tournament = (id: string, name: string, promotionId: string | null, scope: 'promotion' | 'international', internationalTier?: 'champions_cup' | 'challenge_cup'): GrandPrixTournament => ({
  id, name, shortName: name, promotionId, scope, internationalTier, weightClass: lightweight, status: 'completed', format: 'four_man', createdDate: '2025-01-01', completedDate: '2026-04-01',
  participants: [{ fighterId: a.id, seed: 1 }, { fighterId: c.id, seed: 2 }], reserveFighterIds: [], winnerId: a.id, prestige: 80,
  qualifyingPromotionIds: internationalTier ? [player.id, rival.id] : undefined,
  fights: [{ id: `${id}-fight`, round: 'final', redFighterId: a.id, blueFighterId: c.id, winnerId: a.id, loserId: c.id, isCompleted: true, fightArchiveId: internationalTier ? 'international' : 'p1-2026-a' }]
});
state.tournaments = {
  domestic: tournament('domestic', 'Domestic GP', player.id, 'promotion'),
  champions: tournament('champions', 'Champions Cup', null, 'international', 'champions_cup')
};
state.fighters[a.id] = { ...state.fighters[a.id], weightClass: welterweight };
state.promotionEconomies[player.id] = {
  ...state.promotionEconomies[player.id], outstandingLiabilities: 12_345,
  ledger: [
    { id: 'sponsor', promotionId: player.id, date: '2025-02-01', settlementKey: 'month', category: 'monthly_sponsor', amount: 20_000, balanceAfter: 20_000, liabilityDelta: 0, descriptionKey: 'sponsor' },
    { id: 'retainer', promotionId: player.id, date: '2025-02-01', settlementKey: 'month', category: 'roster_retainer', amount: -5_000, balanceAfter: 15_000, liabilityDelta: 0, descriptionKey: 'retainer' }
  ]
};

assert.equal(MIN_WIN_PERCENTAGE_FIGHTS, 3);
assert.equal(MIN_ACCURACY_ATTEMPTS, 20);
const world = getStatsBoard(state, { period: { kind: 'all-time' }, scope: { kind: 'world' }, weightClass: 'all' });
const player2025 = getStatsBoard(state, { period: { kind: 'year', year: 2025 }, scope: { kind: 'promotion', promotionId: player.id }, weightClass: lightweight });
const current = getStatsBoard(state, { period: { kind: 'current-season' }, scope: { kind: 'world' }, weightClass: 'all' });
const international = getStatsBoard(state, { period: { kind: 'all-time' }, scope: { kind: 'international' }, weightClass: 'all' });

assert.equal(world.fighterLeaders.wins[0].fighterId, a.id);
assert.equal(world.fighterLeaders.wins[0].value, 4);
assert.equal(world.fighterLeaders.winPercentage.find(row => row.fighterId === a.id)?.denominator, 5);
assert.equal(world.fighterLeaders.strikingAccuracy.find(row => row.fighterId === b.id), undefined);
assert.ok(world.fighterLeaders.strikingAccuracy.some(row => row.fighterId === a.id));
assert.ok(player2025.fighterLeaders.wins.every(row => row.weightClass === lightweight));
assert.equal(player2025.fighterLeaders.wins.find(row => row.fighterId === a.id)?.value, 1);
assert.equal(player2025.fighterLeaders.wins.find(row => row.fighterId === d.id), undefined);
assert.ok(international.fightRecords.every(row => row.scope === 'international'));
assert.ok(player2025.promotions.every(row => row.promotionId === player.id));
assert.ok(current.fightRecords.every(row => !row.date.startsWith('2025-') && row.date <= state.currentDate));
assert.ok(current.fightRecords.every(row => row.fightId !== 'future'));
assert.equal(world.fightRecords.find(row => row.category === 'fastestFinish')?.fightId, 'international');
assert.equal(world.events.find(row => row.eventId === 'event-p1-2025')?.finishRate, 1);
assert.equal(world.promotions.find(row => row.promotionId === player.id)?.currentLiabilities, 12_345);
assert.equal(world.promotions.find(row => row.promotionId === player.id)?.sponsorMediaIncome, 20_000);
assert.equal(world.titles.find(row => row.id === 'active-reign')?.reignDays, 457);
assert.ok(world.tournaments.some(row => row.type === 'domestic_gp'));
assert.ok(world.tournaments.some(row => row.type === 'champions_cup'));
assert.deepEqual(world.years, [2025, 2026]);

console.log('Statistics board checks passed.');
