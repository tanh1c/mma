import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { resolveDramaIncident } from './src/lib/game/drama';
import { applyPromotionTransaction, refreshPromotionEconomy, validatePromotionEconomies } from './src/lib/game/promotionEconomy';
import { refreshSeasonObjectives } from './src/lib/game/seasonObjectives';

const state = generateInitialWorld(2204);
const playerId = state.playerPromotionId;
const rivalId = Object.keys(state.promotions).find(id => id !== playerId)!;
const playerBefore = state.promotions[playerId].money;

const playerResult = applyPromotionTransaction(state, {
  id: 'player-income',
  promotionId: playerId,
  date: state.currentDate,
  settlementKey: 'transaction-test',
  category: 'objective_reward',
  amount: 10_000,
  transactionClass: 'income',
  sourceId: 'objective-test',
  descriptionKey: 'economy.objectiveReward'
});
assert.equal(playerResult.ok, true);
assert.equal(playerResult.state.promotions[playerId].money, playerBefore + 10_000);
assert.equal(playerResult.state.promotion.money, playerBefore + 10_000);
const playerEntry = playerResult.state.promotionEconomies[playerId].ledger.at(-1)!;
assert.equal(playerEntry.id, `economy-${playerId}-player-income`);
assert.equal(playerEntry.balanceAfter, playerBefore + 10_000);
const mirror = playerResult.state.financeLedger?.find(entry => entry.id === `economy-mirror-${playerEntry.id}`);
assert.ok(mirror);
assert.equal(mirror?.amount, 10_000);
assert.equal(mirror?.affectsCash, false);

const rivalBefore = playerResult.state.promotions[rivalId].money;
const playerSnapshotBefore = playerResult.state.promotion;
const rivalResult = applyPromotionTransaction(playerResult.state, {
  id: 'rival-cost',
  promotionId: rivalId,
  date: state.currentDate,
  settlementKey: 'transaction-test',
  category: 'operating_cost',
  amount: -5_000,
  transactionClass: 'mandatory',
  descriptionKey: 'economy.operatingCost'
});
assert.equal(rivalResult.ok, true);
assert.equal(rivalResult.state.promotions[rivalId].money, rivalBefore - 5_000);
assert.deepEqual(rivalResult.state.promotion, playerSnapshotBefore);
assert.equal(rivalResult.state.financeLedger?.length, playerResult.state.financeLedger?.length);
assert.deepEqual(validatePromotionEconomies(rivalResult.state), []);

const objectiveFixture = structuredClone(state);
objectiveFixture.drama.objectives[2025] = [{
  id: 'objective-economy-profit',
  year: 2025,
  category: 'business',
  kind: 'profit',
  target: 1,
  progress: 0,
  completed: false,
  rewardGranted: false
}];
objectiveFixture.drama.seasonSnapshots[2025] = {
  year: 2025,
  money: objectiveFixture.promotion.money - 10_000,
  reputation: objectiveFixture.promotion.reputation,
  fanbase: objectiveFixture.promotion.fanbase,
  signedFighters: 1
};
const objectiveMoneyBefore = objectiveFixture.promotion.money;
const objectiveResult = refreshSeasonObjectives(objectiveFixture, 2025, 'en');
const objectiveEntry = objectiveResult.promotionEconomies[playerId].ledger.find(entry =>
  entry.category === 'objective_reward' && entry.sourceId === 'objective-economy-profit'
)!;
assert.ok(objectiveEntry);
assert.equal(objectiveEntry.amount, 10_000);
assert.equal(objectiveResult.promotion.money, objectiveMoneyBefore + 10_000);
assert.equal(objectiveResult.promotions[playerId].money, objectiveResult.promotion.money);
assert.equal(objectiveResult.financeLedger.filter(entry => entry.id === `economy-mirror-${objectiveEntry.id}`).length, 1);
assert.deepEqual(refreshSeasonObjectives(objectiveResult, 2025, 'en'), objectiveResult);

const dramaBase = generateInitialWorld(2205);
const dramaPlayerId = dramaBase.playerPromotionId;
const [lead, opponent] = Object.values(dramaBase.fighters).slice(0, 2);
const incident = {
  id: 'incident-economy-fine',
  type: 'weight_cut' as const,
  severity: 'minor' as const,
  status: 'pending' as const,
  createdDate: dramaBase.currentDate,
  fighterIds: [lead.id, opponent.id] as [string, string],
  responseKeys: ['fine_fighter']
};
const fineFixture = {
  ...dramaBase,
  drama: {
    ...dramaBase.drama,
    incidents: { ...dramaBase.drama.incidents, [incident.id]: incident }
  }
};
const fineMoneyBefore = fineFixture.promotion.money;
const fined = resolveDramaIncident(fineFixture, incident.id, 'fine_fighter', 'manager', undefined, 'en');
const fineEntry = fined.promotionEconomies[dramaPlayerId].ledger.find(entry =>
  entry.category === 'drama' && entry.sourceId === incident.id
)!;
assert.ok(fineEntry);
assert.equal(fineEntry.amount, 5_000);
assert.equal(fined.promotion.money, fineMoneyBefore + 5_000);
assert.equal(fined.promotions[dramaPlayerId].money, fined.promotion.money);
assert.equal(fined.financeLedger.filter(entry => entry.id === `economy-mirror-${fineEntry.id}`).length, 1);

const blocked = structuredClone(dramaBase);
const blockedIncident = {
  ...incident,
  id: 'incident-economy-blocked',
  type: 'pay_demand' as const,
  responseKeys: ['improve_terms']
};
blocked.drama.incidents[blockedIncident.id] = blockedIncident;
blocked.promotions[dramaPlayerId].money = -blocked.promotionEconomies[dramaPlayerId].debtLimit;
blocked.promotion = blocked.promotions[dramaPlayerId];
blocked.promotionEconomies[dramaPlayerId] = {
  ...blocked.promotionEconomies[dramaPlayerId],
  ledgerOpeningBalance: blocked.promotion.money,
  ledger: []
};
const blockedFixture = refreshPromotionEconomy(blocked, dramaPlayerId);
const blockedBefore = structuredClone(blockedFixture);
assert.deepEqual(
  resolveDramaIncident(blockedFixture, blockedIncident.id, 'improve_terms', 'manager', undefined, 'en'),
  blockedBefore
);

console.log('Promotion economy transaction checks passed.');
