import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import {
  getBrandInvestmentEffect,
  getPromotionFinancialSnapshot,
  investInPromotionBrand,
  refreshPromotionEconomy,
  validatePromotionEconomies
} from './src/lib/game/promotionEconomy';
import { useGameStore } from './src/store/gameStore';

const effect = getBrandInvestmentEffect(10_000);
assert.deepEqual(effect, getBrandInvestmentEffect(10_000));
const doubled = getBrandInvestmentEffect(20_000);
assert.ok(doubled.fanbaseGain < effect.fanbaseGain * 2);
assert.ok(doubled.reputationGain < effect.reputationGain * 2);

const base = generateInitialWorld(2206);
const playerId = base.playerPromotionId;
const rivalId = Object.keys(base.promotions).find(id => id !== playerId)!;

for (const amount of [999, 1_000.5, Number.MAX_SAFE_INTEGER + 1]) {
  assert.deepEqual(
    investInPromotionBrand(base, playerId, amount),
    { ok: false, state: base, reason: 'invalid_amount' }
  );
}

const liabilities = structuredClone(base);
liabilities.promotionEconomies[playerId] = {
  ...liabilities.promotionEconomies[playerId],
  outstandingLiabilities: 1
};
assert.deepEqual(
  investInPromotionBrand(liabilities, playerId, 1_000),
  { ok: false, state: liabilities, reason: 'outstanding_liabilities' }
);

const recovery = structuredClone(base);
recovery.promotionEconomies[playerId] = {
  ...recovery.promotionEconomies[playerId],
  recoveryMode: true,
  financialMode: 'recovery'
};
assert.deepEqual(
  investInPromotionBrand(recovery, playerId, 1_000),
  { ok: false, state: recovery, reason: 'recovery_mode' }
);

const economy = base.promotionEconomies[playerId];
const promotion = base.promotions[playerId];
assert.deepEqual(
  investInPromotionBrand(base, playerId, promotion.money + economy.debtLimit + 1),
  { ok: false, state: base, reason: 'debt_limit' }
);

const snapshot = getPromotionFinancialSnapshot(base, playerId)!;
const reserveBreakingAmount = promotion.money + economy.debtLimit - snapshot.requiredReserve - snapshot.nextMonthObligations + 1;
assert.ok(reserveBreakingAmount >= 1_000);
assert.deepEqual(
  investInPromotionBrand(base, playerId, reserveBreakingAmount),
  { ok: false, state: base, reason: 'required_reserve' }
);

useGameStore.setState(base);
const playerBefore = useGameStore.getState().promotions[playerId];
const rivalBefore = useGameStore.getState().promotions[rivalId];
const moneyBefore = playerBefore.money;
assert.equal(useGameStore.getState().investInBrand(10_000), null);

let invested = useGameStore.getState();
const firstEntry = invested.promotionEconomies[playerId].ledger.find(entry =>
  entry.id === `economy-${playerId}-brand-${playerId}-${base.currentDate}-1`
)!;
assert.ok(firstEntry);
assert.equal(firstEntry.category, 'brand_investment');
assert.equal(firstEntry.amount, -10_000);
assert.equal(invested.promotions[playerId].money, moneyBefore - 10_000);
assert.equal(invested.promotion.money, invested.promotions[playerId].money);
assert.equal(invested.promotions[playerId].fanbase, playerBefore.fanbase + effect.fanbaseGain);
assert.equal(invested.promotions[playerId].reputation, playerBefore.reputation + effect.reputationGain);
assert.deepEqual(invested.promotions[rivalId], rivalBefore);
assert.equal(invested.financeLedger.filter(entry => entry.id === `economy-mirror-${firstEntry.id}`).length, 1);
assert.deepEqual(validatePromotionEconomies(invested), []);

assert.equal(useGameStore.getState().investInBrand(10_000), null);
invested = useGameStore.getState();
const brandEntries = invested.promotionEconomies[playerId].ledger.filter(entry => entry.category === 'brand_investment');
assert.equal(brandEntries.length, 2);
assert.equal(brandEntries[1].id, `economy-${playerId}-brand-${playerId}-${base.currentDate}-2`);
assert.equal(new Set(brandEntries.map(entry => entry.id)).size, 2);
assert.deepEqual(invested.promotions[rivalId], rivalBefore);

const beforeInvalidStoreAction = useGameStore.getState();
assert.equal(beforeInvalidStoreAction.investInBrand(999), 'invalid_amount');
assert.equal(useGameStore.getState(), beforeInvalidStoreAction);

let contractState = generateInitialWorld(2207);
contractState.contractMarket.windows['market-window-2025'] = {
  ...contractState.contractMarket.windows['market-window-2025'],
  status: 'closed'
};
const contractPlayerId = contractState.playerPromotionId;
const freeAgent = Object.values(contractState.fighters).find(fighter => !fighter.contract)!;
const ownedFighter = Object.values(contractState.fighters).find(fighter =>
  fighter.contract?.promotionId === contractPlayerId && !fighter.isChampion
)!;
const originalOwnedContract = ownedFighter.contract!;
contractState.promotions[contractPlayerId] = {
  ...contractState.promotions[contractPlayerId],
  money: 1_000_000
};
contractState.promotionEconomies[contractPlayerId] = {
  ...contractState.promotionEconomies[contractPlayerId],
  ledgerOpeningBalance: 1_000_000,
  ledger: []
};
contractState.promotion = contractState.promotions[contractPlayerId];
contractState = refreshPromotionEconomy(contractState, contractPlayerId);
useGameStore.setState(contractState);

const unaffordablePay = useGameStore.getState().promotionEconomies[contractPlayerId].contractBudget + 1;
useGameStore.getState().signFighter(freeAgent.id, unaffordablePay, 0, 1);
assert.equal(useGameStore.getState().fighters[freeAgent.id].contract, null);
useGameStore.getState().renewFighter(ownedFighter.id, unaffordablePay, 0, 1);
assert.deepEqual(useGameStore.getState().fighters[ownedFighter.id].contract, originalOwnedContract);

const retainerBeforeSign = useGameStore.getState().promotionEconomies[contractPlayerId].monthlyRosterRetainer;
useGameStore.getState().signFighter(freeAgent.id, 10_000, 5_000, 4);
let contracted = useGameStore.getState();
assert.ok(contracted.promotionEconomies[contractPlayerId].monthlyRosterRetainer > retainerBeforeSign);
assert.deepEqual(validatePromotionEconomies(contracted), []);

const retainerBeforeRenew = contracted.promotionEconomies[contractPlayerId].monthlyRosterRetainer;
contracted.renewFighter(ownedFighter.id, 30_000, 15_000, 6);
contracted = useGameStore.getState();
assert.notEqual(contracted.promotionEconomies[contractPlayerId].monthlyRosterRetainer, retainerBeforeRenew);
assert.deepEqual(validatePromotionEconomies(contracted), []);

const retainerBeforeRelease = contracted.promotionEconomies[contractPlayerId].monthlyRosterRetainer;
contracted.releaseFighter(freeAgent.id);
contracted = useGameStore.getState();
assert.ok(contracted.promotionEconomies[contractPlayerId].monthlyRosterRetainer < retainerBeforeRelease);
assert.deepEqual(validatePromotionEconomies(contracted), []);

let dealState = generateInitialWorld(2208);
const dealPlayerId = dealState.playerPromotionId;
dealState.promotions[dealPlayerId] = {
  ...dealState.promotions[dealPlayerId],
  reputation: 100
};
dealState.promotion = dealState.promotions[dealPlayerId];
dealState = refreshPromotionEconomy(dealState, dealPlayerId);
useGameStore.setState(dealState);

useGameStore.getState().signSponsorDeal('Apex Fight Gear');
let deals = useGameStore.getState();
assert.equal(deals.promotionEconomies[dealPlayerId].monthlySponsorIncome, 120_000);
assert.deepEqual(validatePromotionEconomies(deals), []);

useGameStore.getState().signMediaDeal('Prime Combat Network');
deals = useGameStore.getState();
assert.equal(deals.promotionEconomies[dealPlayerId].monthlyMediaIncome, 200_000);
assert.deepEqual(validatePromotionEconomies(deals), []);

const oldSponsor = deals.sponsorDeals.find(deal => deal.name === 'Combat Athletics Co.')!;
deals.renewDeal(oldSponsor.id, 'sponsor');
deals = useGameStore.getState();
assert.equal(deals.sponsorDeals.find(deal => deal.id === oldSponsor.id)?.isActive, true);
assert.equal(deals.promotionEconomies[dealPlayerId].monthlySponsorIncome, 15_000);
assert.deepEqual(validatePromotionEconomies(deals), []);

const oldMedia = deals.mediaDeals.find(deal => deal.name === 'FightNet Local')!;
deals.renewDeal(oldMedia.id, 'media');
deals = useGameStore.getState();
assert.equal(deals.mediaDeals.find(deal => deal.id === oldMedia.id)?.isActive, true);
assert.equal(deals.promotionEconomies[dealPlayerId].monthlyMediaIncome, 20_000);
assert.deepEqual(validatePromotionEconomies(deals), []);

console.log('Promotion economy store checks passed.');
