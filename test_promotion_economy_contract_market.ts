import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import {
  applyPendingSettlement,
  getPromotionContractBudget,
  upsertTransferOffer,
  validateContractMarketState
} from './src/lib/game/contractMarket';
import {
  canPromotionAffordContractCommitment,
  getPromotionFinancialSnapshot,
  refreshPromotionEconomy,
  validatePromotionEconomies
} from './src/lib/game/promotionEconomy';
import type { PendingTransferSettlement } from './src/types/game';

const base = generateInitialWorld(2212);
const buyerId = base.playerPromotionId;
const sellerId = Object.keys(base.promotions).find(id => id !== buyerId)!;
const baseline = getPromotionFinancialSnapshot(base, buyerId)!;

const withBuyerMoney = (money: number) => {
  const state = structuredClone(base);
  state.promotions[buyerId].money = money;
  state.promotion = state.promotions[buyerId];
  state.promotionEconomies[buyerId] = {
    ...state.promotionEconomies[buyerId],
    outstandingLiabilities: 0,
    recoveryMode: false,
    ledgerOpeningBalance: money,
    ledger: []
  };
  return refreshPromotionEconomy(state, buyerId);
};

const growth = withBuyerMoney(baseline.requiredReserve * 3);
const stable = withBuyerMoney(Math.ceil(baseline.requiredReserve * 1.25));
const cautious = withBuyerMoney(-base.promotionEconomies[buyerId].debtLimit + Math.ceil(baseline.nextMonthObligations * 0.5));
const recovery = withBuyerMoney(-base.promotionEconomies[buyerId].debtLimit + Math.floor(baseline.nextMonthObligations * 0.2));
assert.equal(getPromotionContractBudget(growth, buyerId), getPromotionFinancialSnapshot(growth, buyerId)!.contractBudget);
assert.ok(getPromotionContractBudget(growth, buyerId) > getPromotionContractBudget(stable, buyerId));
assert.ok(getPromotionContractBudget(stable, buyerId) > getPromotionContractBudget(cautious, buyerId));
assert.equal(getPromotionContractBudget(recovery, buyerId), 0);
assert.equal(canPromotionAffordContractCommitment(growth, buyerId, getPromotionContractBudget(growth, buyerId)), null);
assert.equal(canPromotionAffordContractCommitment(growth, buyerId, getPromotionContractBudget(growth, buyerId) + 1), 'required_reserve');
assert.equal(canPromotionAffordContractCommitment(recovery, buyerId, 1), 'recovery_mode');
const liable = structuredClone(growth);
liable.promotionEconomies[buyerId].outstandingLiabilities = 1;
assert.equal(getPromotionContractBudget(liable, buyerId), 0);
assert.equal(canPromotionAffordContractCommitment(liable, buyerId, 1), 'outstanding_liabilities');

const openOfferState = structuredClone(growth);
openOfferState.currentDate = '2025-12-01';
openOfferState.contractMarket.windows['market-window-2025'] = {
  ...openOfferState.contractMarket.windows['market-window-2025'],
  openDate: '2025-12-01',
  closeDate: '2025-12-31',
  status: 'open'
};
const offerTarget = Object.values(openOfferState.fighters).find(item =>
  item.contract?.promotionId !== buyerId && item.contract?.endDate > '2025-12-31'
)!;
const rejectedOffer = upsertTransferOffer(openOfferState, {
  buyerPromotionId: buyerId,
  fighterId: offerTarget.id,
  transferFee: getPromotionContractBudget(openOfferState, buyerId) + 1,
  terms: { fights: 1, payPerFight: 1, winBonus: 0 }
});
assert.equal(rejectedOffer.ok, false);
if (rejectedOffer.ok) throw new Error('over-budget offer unexpectedly accepted');
assert.equal(rejectedOffer.reason, 'insufficient_cash');
assert.equal(rejectedOffer.state, openOfferState);

let settlementState = structuredClone(growth);
settlementState.currentDate = '2025-12-31';
settlementState.promotions[sellerId] = { ...settlementState.promotions[sellerId], money: 25_000 };
settlementState.promotionEconomies[sellerId] = {
  ...settlementState.promotionEconomies[sellerId],
  outstandingLiabilities: 4_000,
  recoveryMode: true,
  financialMode: 'recovery',
  ledgerOpeningBalance: 25_000,
  ledger: []
};
settlementState = refreshPromotionEconomy(settlementState, sellerId);
const fighter = Object.values(settlementState.fighters).find(item =>
  item.contract?.promotionId === sellerId && !item.isChampion
)!;
settlementState.fighters[fighter.id] = {
  ...fighter,
  contract: { ...fighter.contract!, endDate: '2026-12-31' }
};
const transferFee = 10_000;
const settlement: PendingTransferSettlement = {
  id: 'market-settlement-economy',
  windowId: 'market-window-2025',
  offerId: 'market-offer-economy',
  fighterId: fighter.id,
  buyerPromotionId: buyerId,
  sellerPromotionId: sellerId,
  transferFee,
  terms: { fights: 4, payPerFight: 1_000, winBonus: 500 }
};
const buyerMoneyBefore = settlementState.promotions[buyerId].money;
const sellerMoneyBefore = settlementState.promotions[sellerId].money;
const applied = applyPendingSettlement(settlementState, settlement, 'en');
assert.notEqual(applied.outcome, 'invalid', applied.reason);
assert.equal(applied.state.fighters[fighter.id].contract?.promotionId, buyerId);
assert.equal(applied.state.promotions[buyerId].money, buyerMoneyBefore - transferFee);
assert.equal(applied.state.promotions[sellerId].money, sellerMoneyBefore + transferFee - 4_000);
const buyerEntry = applied.state.promotionEconomies[buyerId].ledger.find(entry => entry.id === `economy-${buyerId}-${settlement.id}-buyer`)!;
const sellerEntry = applied.state.promotionEconomies[sellerId].ledger.find(entry => entry.id === `economy-${sellerId}-${settlement.id}-seller`)!;
assert.equal(buyerEntry.category, 'transfer_fee');
assert.equal(sellerEntry.category, 'transfer_fee');
assert.equal(buyerEntry.amount, -transferFee);
assert.equal(sellerEntry.amount, transferFee);
assert.equal(applied.state.promotionEconomies[sellerId].outstandingLiabilities, 0);
assert.ok(applied.state.promotionEconomies[sellerId].ledger.some(entry => entry.category === 'liability_payment' && entry.amount === -4_000));
assert.deepEqual(validateContractMarketState(applied.state), []);
assert.deepEqual(validatePromotionEconomies(applied.state), []);

const stale = structuredClone(settlementState);
stale.promotions[buyerId].money = -stale.promotionEconomies[buyerId].debtLimit;
stale.promotion = stale.promotions[buyerId];
stale.promotionEconomies[buyerId] = {
  ...stale.promotionEconomies[buyerId],
  ledgerOpeningBalance: stale.promotions[buyerId].money,
  ledger: []
};
const staleEconomy = refreshPromotionEconomy(stale, buyerId);
const staleBefore = structuredClone(staleEconomy);
const rejected = applyPendingSettlement(staleEconomy, settlement, 'en');
assert.equal(rejected.outcome, 'invalid');
assert.equal(rejected.reason, 'insufficient_cash');
assert.deepEqual(rejected.state, staleBefore);

console.log('Promotion economy contract market checks passed.');
