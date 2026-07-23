import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import {
  applyPromotionTransaction,
  getPromotionFinancialSnapshot,
  refreshPromotionEconomy,
  validatePromotionEconomies
} from './src/lib/game/promotionEconomy';

const base = generateInitialWorld(2203);
const promotionId = base.playerPromotionId;

const withMoney = (money: number, liabilities = 0, recoveryMode = false) => {
  const state = structuredClone(base);
  state.promotions[promotionId].money = money;
  state.promotion = state.promotions[promotionId];
  state.promotionEconomies[promotionId] = {
    ...state.promotionEconomies[promotionId],
    outstandingLiabilities: liabilities,
    recoveryMode,
    financialMode: recoveryMode ? 'recovery' : state.promotionEconomies[promotionId].financialMode,
    ledgerOpeningBalance: money,
    ledger: []
  };
  return refreshPromotionEconomy(state, promotionId);
};

const baseline = getPromotionFinancialSnapshot(base, promotionId)!;
const debtLimit = base.promotionEconomies[promotionId].debtLimit;

const growth = withMoney(baseline.requiredReserve * 3);
assert.equal(getPromotionFinancialSnapshot(growth, promotionId)?.financialMode, 'growth');
const stable = withMoney(Math.ceil(baseline.requiredReserve * 1.25));
assert.equal(getPromotionFinancialSnapshot(stable, promotionId)?.financialMode, 'stable');
const cautious = withMoney(-debtLimit + Math.ceil(baseline.nextMonthObligations * 0.5));
assert.equal(getPromotionFinancialSnapshot(cautious, promotionId)?.financialMode, 'cautious');
const recovery = withMoney(-debtLimit + Math.floor(baseline.nextMonthObligations * 0.2));
assert.equal(getPromotionFinancialSnapshot(recovery, promotionId)?.financialMode, 'recovery');

const hysteresisCandidate = withMoney(
  -debtLimit + Math.ceil(baseline.nextMonthObligations * 1.5),
  0,
  true
);
assert.equal(getPromotionFinancialSnapshot(hysteresisCandidate, promotionId)?.financialMode, 'recovery');
const sameBalanceWithoutHistory = structuredClone(hysteresisCandidate);
sameBalanceWithoutHistory.promotionEconomies[promotionId].recoveryMode = false;
sameBalanceWithoutHistory.promotionEconomies[promotionId].financialMode = 'cautious';
assert.equal(getPromotionFinancialSnapshot(sameBalanceWithoutHistory, promotionId)?.financialMode, 'cautious');

const boundary = withMoney(-debtLimit + 1_000);
const mandatory = applyPromotionTransaction(boundary, {
  id: 'mandatory-shortfall',
  promotionId,
  date: boundary.currentDate,
  settlementKey: 'monthly-test',
  category: 'operating_cost',
  amount: -5_000,
  transactionClass: 'mandatory',
  descriptionKey: 'economy.operatingCost'
});
assert.equal(mandatory.ok, true);
assert.equal(mandatory.state.promotions[promotionId].money, -debtLimit);
assert.equal(mandatory.state.promotionEconomies[promotionId].outstandingLiabilities, 4_000);
assert.equal(mandatory.state.promotionEconomies[promotionId].ledger.at(-1)?.amount, -1_000);
assert.equal(mandatory.state.promotionEconomies[promotionId].ledger.at(-1)?.liabilityDelta, 4_000);

const income = applyPromotionTransaction(mandatory.state, {
  id: 'recovery-income',
  promotionId,
  date: boundary.currentDate,
  settlementKey: 'monthly-test',
  category: 'monthly_sponsor',
  amount: 3_000,
  transactionClass: 'income',
  descriptionKey: 'economy.sponsorIncome',
  repayLiabilities: true
});
assert.equal(income.ok, true);
assert.equal(income.state.promotions[promotionId].money, -debtLimit);
assert.equal(income.state.promotionEconomies[promotionId].outstandingLiabilities, 1_000);
assert.deepEqual(
  income.state.promotionEconomies[promotionId].ledger.slice(-2).map(entry => [entry.category, entry.amount, entry.liabilityDelta]),
  [['monthly_sponsor', 3_000, 0], ['liability_payment', -3_000, -3_000]]
);

const blockedBefore = structuredClone(income.state);
const blocked = applyPromotionTransaction(income.state, {
  id: 'blocked-brand',
  promotionId,
  date: boundary.currentDate,
  settlementKey: 'brand-test',
  category: 'brand_investment',
  amount: -1_000,
  transactionClass: 'discretionary',
  descriptionKey: 'economy.brandInvestment'
});
assert.deepEqual(blocked, { ok: false, state: income.state, reason: 'outstanding_liabilities' });
assert.deepEqual(income.state, blockedBefore);

const duplicate = applyPromotionTransaction(income.state, {
  id: 'recovery-income',
  promotionId,
  date: boundary.currentDate,
  settlementKey: 'monthly-test',
  category: 'monthly_sponsor',
  amount: 3_000,
  transactionClass: 'income',
  descriptionKey: 'economy.sponsorIncome'
});
assert.deepEqual(duplicate, { ok: false, state: income.state, reason: 'duplicate_transaction' });
assert.deepEqual(validatePromotionEconomies(income.state), []);

console.log('Promotion economy debt checks passed.');
