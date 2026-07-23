import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { ensureSeasonObjectives, finalizeSeasonReview, refreshSeasonObjectives } from './src/lib/game/seasonObjectives';
import { advanceTime } from './src/lib/engine';

const state = generateInitialWorld(703);
assert.equal(state.drama.objectives[2025].length, 3);
const initialized = ensureSeasonObjectives(state, 2025);
assert.deepEqual(initialized.drama.objectives[2025].map(item => item.category).sort(), ['business', 'entertainment', 'sporting']);
assert.deepEqual(ensureSeasonObjectives(initialized, 2025), initialized);
assert.ok(initialized.drama.seasonSnapshots[2025]);

const vacant = generateInitialWorld(704);
for (const weightClass of Object.keys(vacant.titles) as (keyof typeof vacant.titles)[]) {
  vacant.titles[weightClass] = { ...vacant.titles[weightClass], undisputedChampionId: null, interimChampionId: null, status: 'vacant' };
}
vacant.drama.objectives = {};
const vacantObjectives = ensureSeasonObjectives(vacant, 2025).drama.objectives[2025];
assert.equal(vacantObjectives.some(item => item.kind === 'active_champion'), false);

const completionFixture = structuredClone(initialized);
completionFixture.drama.objectives[2025] = [{
  id: 'objective-profit-2025',
  year: 2025,
  category: 'business',
  kind: 'profit',
  target: 1,
  progress: 0,
  completed: false,
  rewardGranted: false
}];
completionFixture.drama.seasonSnapshots[2025] = { year: 2025, money: completionFixture.promotion.money - 10_000, reputation: completionFixture.promotion.reputation, fanbase: completionFixture.promotion.fanbase, signedFighters: 1 };
const completed = refreshSeasonObjectives(completionFixture, 2025, 'vi');
const repeated = refreshSeasonObjectives(completed, 2025, 'vi');
assert.deepEqual(repeated, completed);
assert.equal(completed.drama.objectives[2025][0].rewardGranted, true);
const objectiveEntry = completed.promotionEconomies[completed.playerPromotionId].ledger.find(entry => entry.sourceId === 'objective-profit-2025')!;
assert.equal(objectiveEntry.category, 'objective_reward');
assert.equal(completed.financeLedger.filter(entry => entry.id === `economy-mirror-${objectiveEntry.id}`).length, 1);
assert.equal(completed.financeLedger.find(entry => entry.id === `economy-mirror-${objectiveEntry.id}`)?.description, 'Hoàn thành mục tiêu mùa giải: Đạt mục tiêu lợi nhuận');

const reviewed = finalizeSeasonReview(completed, 2025);
assert.deepEqual(finalizeSeasonReview(reviewed, 2025), reviewed);
assert.ok(reviewed.drama.seasonReviews[2025]);
assert.equal(reviewed.drama.seasonReviews[2025].objectiveIds[0], 'objective-profit-2025');

const rolloverBase = structuredClone(state);
rolloverBase.currentDate = '2025-12-31';
const rolled = advanceTime(rolloverBase, 1, 'en');
assert.ok(rolled.drama.seasonReviews[2025]);
assert.equal(rolled.drama.objectives[2026].length, 3);

console.log('Season objective tests passed.');
