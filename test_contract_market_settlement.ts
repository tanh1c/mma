import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { refreshPromotionEconomy } from './src/lib/game/promotionEconomy';
import {
  applyPendingSettlement,
  resolveContractMarket,
  upsertTransferOffer,
  validateContractMarketState
} from './src/lib/game/contractMarket';
import type { PendingTransferSettlement } from './src/types/game';

let state = generateInitialWorld(2107);
state.currentDate = '2025-12-31';
state.contractMarket.windows['market-window-2025'] = {
  ...state.contractMarket.windows['market-window-2025'],
  openDate: '2025-12-01',
  closeDate: '2025-12-31',
  status: 'open'
};
const buyerId = state.playerPromotionId;
const sellerId = Object.keys(state.promotions).find(id => id !== buyerId)!;
state.promotions[buyerId] = { ...state.promotions[buyerId], money: 1_000_000 };
state.promotion = { ...state.promotion, money: 1_000_000 };
state.promotions[sellerId] = { ...state.promotions[sellerId], money: 500_000 };
for (const promotionId of [buyerId, sellerId]) {
  state.promotionEconomies[promotionId] = {
    ...state.promotionEconomies[promotionId],
    ledgerOpeningBalance: state.promotions[promotionId].money,
    ledger: []
  };
  state = refreshPromotionEconomy(state, promotionId);
}
const fighter = Object.values(state.fighters).find(item =>
  item.contract?.promotionId === sellerId && !item.isChampion
)!;
state.fighters[fighter.id] = {
  ...fighter,
  contract: {
    ...fighter.contract!,
    fightsRemaining: 1,
    payPerFight: 1_000,
    winBonus: 1_000,
    endDate: '2026-12-31'
  }
};
const submitted = upsertTransferOffer(state, {
  buyerPromotionId: buyerId,
  fighterId: fighter.id,
  transferFee: 100_000,
  terms: { fights: 4, payPerFight: 20_000, winBonus: 20_000 }
});
assert.equal(submitted.ok, true);
if (!submitted.ok) throw new Error('offer setup failed');
state = submitted.state;
state.contractMarket.offers[submitted.id] = {
  ...state.contractMarket.offers[submitted.id],
  sellerDecision: 'accepted',
  sellerReason: 'seller_accepted'
};
state.contractMarket.windows['market-window-2025'].status = 'resolving';

const buyerBefore = state.promotions[buyerId].money;
const sellerBefore = state.promotions[sellerId].money;
const resolved = resolveContractMarket(state, 'en');
assert.equal(resolved.contractMarket.windows['market-window-2025'].status, 'closed');
assert.equal(resolved.fighters[fighter.id].contract?.promotionId, buyerId, resolved.contractMarket.history.at(-1)?.reason);
assert.equal(resolved.fighters[fighter.id].contract?.fightsRemaining, 4);
assert.equal(resolved.fighters[fighter.id].contract?.payPerFight, 20_000);
assert.equal(resolved.promotions[buyerId].money, buyerBefore - 100_000);
assert.equal(resolved.promotions[sellerId].money, sellerBefore + 100_000);
assert.equal(resolved.promotion.money, resolved.promotions[buyerId].money);
assert.equal(resolved.contractMarket.history.length, 1);
assert.equal(resolved.contractMarket.history[0].outcome, 'transferred');
assert.deepEqual(validateContractMarketState(resolved), []);
assert.deepEqual(resolveContractMarket(resolved, 'en'), resolved);

const invalidState = generateInitialWorld(2108);
const invalidFighter = Object.values(invalidState.fighters).find(item => item.contract)!;
const invalidSettlement: PendingTransferSettlement = {
  id: 'market-settlement-invalid',
  windowId: 'market-window-2025',
  offerId: 'missing-offer',
  fighterId: invalidFighter.id,
  buyerPromotionId: 'missing-promotion',
  sellerPromotionId: invalidFighter.contract!.promotionId ?? null,
  transferFee: 100,
  terms: { fights: 4, payPerFight: 10_000, winBonus: 10_000 }
};
const before = structuredClone({
  promotions: invalidState.promotions,
  promotion: invalidState.promotion,
  fighters: invalidState.fighters,
  titles: invalidState.titles,
  titlesByPromotion: invalidState.titlesByPromotion,
  rankings: invalidState.rankings,
  rankingsByPromotion: invalidState.rankingsByPromotion,
  worldRankings: invalidState.worldRankings,
  events: invalidState.events,
  tournaments: invalidState.tournaments
});
const invalid = applyPendingSettlement(invalidState, invalidSettlement, 'en');
assert.equal(invalid.reason, 'promotion_missing');
assert.equal(invalid.outcome, 'invalid');
assert.deepEqual({
  promotions: invalid.state.promotions,
  promotion: invalid.state.promotion,
  fighters: invalid.state.fighters,
  titles: invalid.state.titles,
  titlesByPromotion: invalid.state.titlesByPromotion,
  rankings: invalid.state.rankings,
  rankingsByPromotion: invalid.state.rankingsByPromotion,
  worldRankings: invalid.state.worldRankings,
  events: invalid.state.events,
  tournaments: invalid.state.tournaments
}, before);

console.log('Contract market settlement checks passed.');
