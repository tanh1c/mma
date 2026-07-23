import assert from 'node:assert/strict';
import { advanceTime } from './src/lib/engine';
import { autoBookEventsAndContracts, maintainDeals } from './src/lib/game/autobooker';
import { validateContractMarketState } from './src/lib/game/contractMarket';
import { generateInitialWorld } from './src/lib/game/generator';
import {
  calculateMonthlyRosterRetainer,
  getCrossedMonthKeys,
  refreshPromotionEconomy,
  settlePromotionEconomiesThroughDate,
  validatePromotionEconomies
} from './src/lib/game/promotionEconomy';

const prepareState = () => {
  const state = structuredClone(generateInitialWorld(2205));
  const playerId = state.playerPromotionId;
  const rivalId = Object.keys(state.promotions).find(id => id !== playerId)!;
  const fighters = Object.values(state.fighters).slice(0, 5);
  state.currentDate = '2026-01-31';
  state.sponsorDeals = [{
    id: 'monthly-sponsor',
    name: 'Monthly Sponsor',
    tier: 'national',
    monthlyIncome: 11_000,
    expiresDate: '2026-02-15',
    reputationRequirement: 0,
    isActive: true
  }];
  state.mediaDeals = [{
    id: 'monthly-media',
    name: 'Monthly Media',
    tier: 'national',
    monthlyIncome: 13_000,
    expiresDate: '2026-04-30',
    reputationRequirement: 0,
    isActive: true
  }];
  for (const fighter of Object.values(state.fighters)) fighter.contract = null;
  state.fighters[fighters[0].id] = {
    ...fighters[0],
    careerPhase: 'prime',
    contract: { promotionId: playerId, fightsRemaining: 4, payPerFight: 10_000, winBonus: 5_000, exclusivity: true, endDate: '2026-04-01' }
  };
  state.fighters[fighters[1].id] = {
    ...fighters[1],
    careerPhase: 'prime',
    contract: { promotionId: playerId, fightsRemaining: 4, payPerFight: 50_000, winBonus: 25_000, exclusivity: true, endDate: '2026-01-31' }
  };
  state.fighters[fighters[2].id] = {
    ...fighters[2],
    careerPhase: 'retired',
    contract: { promotionId: playerId, fightsRemaining: 4, payPerFight: 50_000, winBonus: 25_000, exclusivity: true, endDate: '2026-12-31' }
  };
  state.fighters[fighters[3].id] = {
    ...fighters[3],
    careerPhase: 'prime',
    contract: { promotionId: rivalId, fightsRemaining: 4, payPerFight: 50_000, winBonus: 25_000, exclusivity: true, endDate: '2026-12-31' }
  };
  state.events['international-retainer-check'] = {
    id: 'international-retainer-check',
    name: 'International Retainer Check',
    date: '2026-02-20',
    venueId: Object.keys(state.venues)[0],
    ticketPrice: 0,
    marketingSpend: 0,
    isCompleted: false,
    scope: 'international',
    fights: [{
      id: 'international-retainer-fight',
      redCornerId: fighters[0].id,
      blueCornerId: fighters[4].id,
      weightClass: fighters[0].weightClass,
      isTitleFight: false,
      rounds: 3,
      campFocus: 'balanced',
      socialHype: 0
    }]
  };
  let prepared = state;
  for (const promotionId of Object.keys(state.promotions)) {
    prepared = refreshPromotionEconomy(prepared, promotionId);
    const money = prepared.promotions[promotionId].money;
    prepared.promotionEconomies[promotionId] = {
      ...prepared.promotionEconomies[promotionId],
      lastMonthlySettlement: '2026-01',
      outstandingLiabilities: 0,
      recoveryMode: false,
      ledgerOpeningBalance: money,
      ledger: []
    };
  }
  return prepared;
};

assert.deepEqual(getCrossedMonthKeys('2026-01-31', '2026-04-01'), ['2026-02', '2026-03', '2026-04']);
assert.deepEqual(getCrossedMonthKeys('2026-04-01', '2026-04-30'), []);

const state = prepareState();
const playerId = state.playerPromotionId;
assert.equal(calculateMonthlyRosterRetainer(state, playerId, '2026-02-01'), 1_000);

const settled = settlePromotionEconomiesThroughDate(state, '2026-04-01');
for (const economy of Object.values(settled.promotionEconomies)) assert.equal(economy.lastMonthlySettlement, '2026-04');
assert.deepEqual(settlePromotionEconomiesThroughDate(settled, '2026-04-30'), settled);
assert.deepEqual(validatePromotionEconomies({ ...settled, currentDate: '2026-04-01' }), []);

const playerMonthlyEntries = settled.promotionEconomies[playerId].ledger.filter(entry => entry.settlementKey.startsWith('monthly-'));
assert.deepEqual(
  playerMonthlyEntries.map(entry => [entry.date, entry.category, entry.amount]),
  [
    ['2026-02-01', 'monthly_sponsor', 11_000],
    ['2026-02-01', 'monthly_media', 13_000],
    ['2026-02-01', 'operating_cost', -state.promotionEconomies[playerId].monthlyOperatingCost],
    ['2026-02-01', 'roster_retainer', -1_000],
    ['2026-03-01', 'monthly_media', 13_000],
    ['2026-03-01', 'operating_cost', -state.promotionEconomies[playerId].monthlyOperatingCost],
    ['2026-03-01', 'roster_retainer', -1_000],
    ['2026-04-01', 'monthly_media', 13_000],
    ['2026-04-01', 'operating_cost', -state.promotionEconomies[playerId].monthlyOperatingCost],
    ['2026-04-01', 'roster_retainer', -1_000]
  ]
);
assert.equal(playerMonthlyEntries.filter(entry => entry.category === 'roster_retainer').length, 3);

for (const promotionId of Object.keys(state.promotions).filter(id => id !== playerId)) {
  const promotion = state.promotions[promotionId];
  const economy = state.promotionEconomies[promotionId];
  const sponsor = Math.round(5_000 + promotion.reputation * 250 + promotion.fanbase * 0.025);
  const media = Math.round(7_500 + promotion.reputation * 350 + promotion.fanbase * 0.035);
  const february = settled.promotionEconomies[promotionId].ledger.filter(entry => entry.settlementKey.endsWith('2026-02'));
  assert.equal(february.find(entry => entry.category === 'monthly_sponsor')?.amount, sponsor);
  assert.equal(february.find(entry => entry.category === 'monthly_media')?.amount, media);
}

const boundary = prepareState();
const boundaryPlayerId = boundary.playerPromotionId;
const boundaryEconomy = boundary.promotionEconomies[boundaryPlayerId];
boundary.promotions[boundaryPlayerId].money = -boundaryEconomy.debtLimit + 500;
boundary.promotion = boundary.promotions[boundaryPlayerId];
boundaryEconomy.outstandingLiabilities = 25_000;
boundaryEconomy.recoveryMode = true;
boundaryEconomy.financialMode = 'recovery';
boundaryEconomy.ledgerOpeningBalance = boundary.promotions[boundaryPlayerId].money;
const boundarySettled = settlePromotionEconomiesThroughDate(boundary, '2026-02-01');
assert.equal(boundarySettled.promotions[boundaryPlayerId].money, -boundaryEconomy.debtLimit);
assert.equal(
  boundarySettled.promotionEconomies[boundaryPlayerId].outstandingLiabilities,
  1_000 + boundaryEconomy.monthlyOperatingCost + 1_000 - 500
);
assert.deepEqual(validatePromotionEconomies(boundarySettled), []);
assert.equal(validateContractMarketState(boundarySettled).some(error => error.startsWith('negative-cash:')), false);

const oneMonth = prepareState();
const advanced = advanceTime(oneMonth, 1, 'en');
for (const economy of Object.values(advanced.promotionEconomies)) assert.equal(economy.lastMonthlySettlement, '2026-02');
assert.equal(
  advanced.financeLedger?.some(entry => entry.affectsCash === true && (entry.type === 'sponsor_monthly' || entry.type === 'media_monthly')),
  false
);

const expiryState = structuredClone(generateInitialWorld(2212));
expiryState.currentDate = '2025-01-15';
const expiryPlayerId = expiryState.playerPromotionId;
const expiryFighter = Object.values(expiryState.fighters).find(fighter =>
  fighter.contract?.promotionId !== expiryPlayerId &&
  !fighter.isChampion &&
  !Object.values(expiryState.tournaments).some(tournament =>
    tournament.scope === 'international' &&
    (tournament.status === 'planned' || tournament.status === 'active') &&
    tournament.participants.some(participant => participant.fighterId === fighter.id)
  )
)!;
const expiryPromotionId = expiryFighter.contract!.promotionId;
expiryState.fighters[expiryFighter.id] = {
  ...expiryFighter,
  contract: { ...expiryFighter.contract!, endDate: expiryState.currentDate }
};
const refreshedExpiryState = refreshPromotionEconomy(expiryState, expiryPromotionId);
const expiredState = advanceTime(refreshedExpiryState, 1, 'en');
assert.equal(expiredState.fighters[expiryFighter.id].contract, null);
assert.deepEqual(validatePromotionEconomies(expiredState), []);

const dealState = structuredClone(generateInitialWorld(2213));
const dealPlayerId = dealState.playerPromotionId;
dealState.sponsorDeals = [{
  id: 'expiring-sponsor',
  name: 'Expiring Sponsor',
  tier: 'local',
  monthlyIncome: 1,
  expiresDate: dealState.currentDate,
  reputationRequirement: 0,
  isActive: true
}];
dealState.mediaDeals = [{
  id: 'expiring-media',
  name: 'Expiring Media',
  tier: 'local',
  monthlyIncome: 1,
  expiresDate: dealState.currentDate,
  reputationRequirement: 0,
  isActive: true
}];
const refreshedDealState = refreshPromotionEconomy(dealState, dealPlayerId);
const maintainedDealState = maintainDeals(refreshedDealState, 'en');
assert.ok(maintainedDealState.sponsorDeals.some(deal => deal.isActive && deal.monthlyIncome > refreshedDealState.promotionEconomies[dealPlayerId].monthlySponsorIncome));
assert.deepEqual(validatePromotionEconomies(maintainedDealState), []);

const renewalState = structuredClone(generateInitialWorld(2211));
const renewalPlayerId = renewalState.playerPromotionId;
const renewalChampion = Object.values(renewalState.fighters).find(fighter =>
  fighter.contract?.promotionId === renewalPlayerId &&
  fighter.isChampion
)!;
renewalState.fighters[renewalChampion.id] = {
  ...renewalChampion,
  contract: {
    ...renewalChampion.contract!,
    fightsRemaining: 1,
    payPerFight: 1,
    winBonus: 1
  }
};
const renewedState = autoBookEventsAndContracts(refreshPromotionEconomy(renewalState, renewalPlayerId));
assert.ok(renewedState.fighters[renewalChampion.id].contract!.payPerFight > 1);
assert.deepEqual(validatePromotionEconomies(renewedState), []);

console.log('Promotion economy monthly settlement checks passed.');
