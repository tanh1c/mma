import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { buildPromotionRankings, buildWorldRankings, getFighterRankContext } from './src/lib/game/rankings';
import { syncChampionFlags } from './src/lib/engine';

const state = generateInitialWorld(1803);
const rivalId = 'promotion-rival-test';
state.promotions[rivalId] = { id: rivalId, name: 'Rival Combat', shortName: 'RC', money: 0, reputation: 45, fanbase: 50000, control: 'ai' };
const rivals = Object.values(state.fighters).filter(fighter => fighter.weightClass === 'Lightweight' && !fighter.contract).slice(0, 3);
for (const fighter of rivals) state.fighters[fighter.id] = { ...fighter, contract: { promotionId: rivalId, fightsRemaining: 4, payPerFight: 1, winBonus: 1, exclusivity: true, endDate: '2027-01-01' } };
state.titlesByPromotion[rivalId] = { ...structuredClone(state.titles), Lightweight: { weightClass: 'Lightweight', undisputedChampionId: rivals[0].id, undisputedDefenses: 0, status: 'active' } };
state.rankingsByPromotion[rivalId] = structuredClone(state.rankings);
state.beltsByPromotion[rivalId] = {};

const rivalRankings = buildPromotionRankings(state, rivalId).newRankings;
assert.ok(rivalRankings.Lightweight.every(item => state.fighters[item.fighterId].contract?.promotionId === rivalId));
state.rankingsByPromotion[rivalId] = rivalRankings;
assert.equal(getFighterRankContext(state, rivals[0].id, rivalId)?.label, 'C');
assert.ok(buildWorldRankings(state).Lightweight.some(item => rivals.some(fighter => fighter.id === item.fighterId)));

const synced = syncChampionFlags(state);
assert.equal(synced.fighters[rivals[0].id].isChampion, true);
assert.equal(synced.titles.Lightweight.undisputedChampionId, state.titles.Lightweight.undisputedChampionId);

console.log('Scoped rankings and titles checks passed.');
