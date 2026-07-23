import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { addMonths, format } from 'date-fns';
import { generateInitialWorld } from './src/lib/game/generator';
import {
  getAiBrandInvestment,
  getPromotionFinancialSnapshot,
  planAiPromotionEvent,
  refreshPromotionEconomy,
  settlePromotionMonth
} from './src/lib/game/promotionEconomy';
import { simulateRivalPromotionEvent } from './src/lib/game/rivalPromotions';

const base = generateInitialWorld(2210);
const promotionId = Object.keys(base.promotions).find(id => id !== base.playerPromotionId)!;
const baseline = getPromotionFinancialSnapshot(base, promotionId)!;
const debtLimit = base.promotionEconomies[promotionId].debtLimit;

const withMoney = (money: number) => {
  const state = structuredClone(base);
  state.promotions[promotionId].money = money;
  state.promotionEconomies[promotionId] = {
    ...state.promotionEconomies[promotionId],
    outstandingLiabilities: 0,
    recoveryMode: false,
    ledgerOpeningBalance: money,
    ledger: []
  };
  return refreshPromotionEconomy(state, promotionId);
};

const growth = withMoney(baseline.requiredReserve * 3);
const stable = withMoney(Math.ceil(baseline.requiredReserve * 1.25));
const cautious = withMoney(-debtLimit + Math.ceil(baseline.nextMonthObligations * 0.5));
const recovery = withMoney(-debtLimit + Math.floor(baseline.nextMonthObligations * 0.2));
assert.equal(growth.promotionEconomies[promotionId].financialMode, 'growth');
assert.equal(stable.promotionEconomies[promotionId].financialMode, 'stable');
assert.equal(cautious.promotionEconomies[promotionId].financialMode, 'cautious');
assert.equal(recovery.promotionEconomies[promotionId].financialMode, 'recovery');

const growthPlan = planAiPromotionEvent(growth, promotionId)!;
const stablePlan = planAiPromotionEvent(stable, promotionId)!;
const cautiousPlan = planAiPromotionEvent(cautious, promotionId)!;
assert.ok(growthPlan);
assert.ok(stablePlan);
assert.ok(cautiousPlan);
assert.ok(growthPlan.marketingSpend > stablePlan.marketingSpend);
assert.ok(stablePlan.marketingSpend >= cautiousPlan.marketingSpend);
assert.ok(growthPlan.ticketPrice >= stablePlan.ticketPrice);
assert.ok(stablePlan.ticketPrice >= cautiousPlan.ticketPrice);
const recoveryPlan = planAiPromotionEvent(recovery, promotionId);
if (recoveryPlan) {
  assert.equal(recoveryPlan.marketingSpend, 0);
  assert.ok(recoveryPlan.projectedProfit >= 0);
  assert.ok(recovery.promotions[promotionId].money + recoveryPlan.projectedProfit >= -debtLimit);
}

const growthBrand = getAiBrandInvestment(growth, promotionId);
const stableBrand = getAiBrandInvestment(stable, promotionId);
assert.ok(growthBrand > stableBrand);
assert.ok(stableBrand >= getAiBrandInvestment(cautious, promotionId));
assert.equal(getAiBrandInvestment(recovery, promotionId), 0);

assert.deepEqual(planAiPromotionEvent(structuredClone(growth), promotionId), growthPlan);
let randomCalls = 0;
const originalRandom = Math.random;
Math.random = () => {
  randomCalls += 1;
  return 0.5;
};
assert.deepEqual(planAiPromotionEvent(growth, promotionId), growthPlan);
assert.equal(getAiBrandInvestment(growth, promotionId), growthBrand);
Math.random = originalRandom;
assert.equal(randomCalls, 0);

const liabilities = structuredClone(growth);
liabilities.promotionEconomies[promotionId].outstandingLiabilities = 1;
liabilities.promotionEconomies[promotionId].recoveryMode = true;
liabilities.promotionEconomies[promotionId].financialMode = 'recovery';
assert.equal(getAiBrandInvestment(liabilities, promotionId), 0);
assert.equal(planAiPromotionEvent(liabilities, promotionId), null);

const rivalEventState = structuredClone(growth);
const rivalPlan = planAiPromotionEvent(rivalEventState, promotionId)!;
const simulatedRival = simulateRivalPromotionEvent(rivalEventState, promotionId, 'en');
const rivalEvent = Object.values(simulatedRival.eventArchive).find(event => event.promotionId === promotionId)!;
assert.equal(rivalEvent.venueCost, growth.venues[rivalPlan.venueId].cost);
assert.equal(rivalEvent.gateRevenue, rivalEvent.attendance * rivalPlan.ticketPrice);
assert.equal(rivalEvent.marketingCost, rivalPlan.marketingSpend);

const blockedEventState = structuredClone(liabilities);
const blockedEventCount = Object.keys(blockedEventState.eventArchive).length;
const blockedEventDate = blockedEventState.promotions[promotionId].nextAiEventDate;
const blockedEventResult = simulateRivalPromotionEvent(blockedEventState, promotionId, 'en');
assert.equal(Object.keys(blockedEventResult.eventArchive).length, blockedEventCount);
assert.notEqual(blockedEventResult.promotions[promotionId].nextAiEventDate, blockedEventDate);
assert.ok(blockedEventResult.promotions[promotionId].nextAiEventDate! > blockedEventResult.currentDate);

const brandMonth = format(addMonths(new Date(`${growth.currentDate}T00:00:00`), 1), 'yyyy-MM');
const growthMoneyBefore = growth.promotions[promotionId].money;
const growthReputationBefore = growth.promotions[promotionId].reputation;
const growthFanbaseBefore = growth.promotions[promotionId].fanbase;
const monthlyBrand = settlePromotionMonth(growth, promotionId, brandMonth);
const brandEntries = monthlyBrand.promotionEconomies[promotionId].ledger.filter(entry => entry.category === 'brand_investment');
assert.equal(brandEntries.length, 1);
assert.equal(brandEntries[0].amount, -monthlyBrand.promotionEconomies[promotionId].scheduledBrandInvestment);
assert.ok(monthlyBrand.promotionEconomies[promotionId].scheduledBrandInvestment > 0);
assert.ok(monthlyBrand.promotions[promotionId].money < growthMoneyBefore + growth.promotionEconomies[promotionId].monthlySponsorIncome + growth.promotionEconomies[promotionId].monthlyMediaIncome);
assert.ok(monthlyBrand.promotions[promotionId].reputation > growthReputationBefore);
assert.ok(monthlyBrand.promotions[promotionId].fanbase > growthFanbaseBefore);
assert.deepEqual(settlePromotionMonth(monthlyBrand, promotionId, brandMonth), monthlyBrand);

const playerMonth = format(addMonths(new Date(`${base.currentDate}T00:00:00`), 1), 'yyyy-MM');
const settledPlayer = settlePromotionMonth(base, base.playerPromotionId, playerMonth);
assert.equal(settledPlayer.promotionEconomies[base.playerPromotionId].scheduledBrandInvestment, 0);
assert.equal(settledPlayer.promotionEconomies[base.playerPromotionId].ledger.some(entry => entry.category === 'brand_investment'), false);
const settledRecovery = settlePromotionMonth(recovery, promotionId, brandMonth);
assert.equal(settledRecovery.promotionEconomies[promotionId].scheduledBrandInvestment, 0);
assert.equal(settledRecovery.promotionEconomies[promotionId].ledger.some(entry => entry.category === 'brand_investment'), false);

const autobookerSource = readFileSync('src/lib/game/autobooker.ts', 'utf8');
assert.equal(autobookerSource.includes("type: 'owner_injection'"), false);
assert.equal(autobookerSource.includes('promotion.money += 100000'), false);

console.log('Promotion economy AI finance checks passed.');
