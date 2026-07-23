import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import {
  getMarketCompetition,
  getVisibleMarketOffers,
  listFighter,
  respondToIncomingOffer,
  upsertTransferOffer,
  withdrawListing,
  withdrawTransferOffer
} from './src/lib/game/contractMarket';

let state = generateInitialWorld(2104);
const windowId = 'market-window-2025';
state.currentDate = '2025-12-02';
state.contractMarket.windows[windowId] = {
  ...state.contractMarket.windows[windowId],
  openDate: '2025-12-01',
  closeDate: '2025-12-31',
  status: 'open'
};
const rivalPromotionId = Object.keys(state.promotions).find(
  id => id !== state.playerPromotionId
)!;
const playerFighter = Object.values(state.fighters).find(
  fighter => fighter.contract?.promotionId === state.playerPromotionId
)!;
const rival = Object.values(state.fighters).find(
  fighter => fighter.contract?.promotionId === rivalPromotionId
)!;
const freeAgent = Object.values(state.fighters).find(fighter => !fighter.contract)!;

const listed = listFighter(state, state.playerPromotionId, playerFighter.id, 50_000);
assert.equal(listed.ok, true);
if (!listed.ok) throw new Error('listing failed');
assert.equal(listed.state.contractMarket.listings[listed.id].minimumFee, 50_000);
assert.deepEqual(
  listFighter(state, rivalPromotionId, playerFighter.id, 50_000),
  { ok: false, state, reason: 'ownership_changed' }
);
assert.deepEqual(
  listFighter(state, state.playerPromotionId, playerFighter.id, -1),
  { ok: false, state, reason: 'invalid_terms' }
);
const unlisted = withdrawListing(listed.state, state.playerPromotionId, listed.id);
assert.equal(unlisted.ok, true);
if (!unlisted.ok) throw new Error('withdraw failed');
assert.equal(unlisted.state.contractMarket.listings[listed.id].status, 'withdrawn');

const first = upsertTransferOffer(state, {
  buyerPromotionId: state.playerPromotionId,
  fighterId: rival.id,
  transferFee: 20_000,
  terms: { fights: 4, payPerFight: 10_000, winBonus: 10_000 }
});
assert.equal(first.ok, true);
if (!first.ok) throw new Error('offer failed');
const revised = upsertTransferOffer(first.state, {
  buyerPromotionId: state.playerPromotionId,
  fighterId: rival.id,
  transferFee: 25_000,
  terms: { fights: 5, payPerFight: 8_000, winBonus: 8_000 }
});
assert.equal(revised.ok, true);
if (!revised.ok) throw new Error('revision failed');
assert.equal(
  Object.values(revised.state.contractMarket.offers).filter(
    offer => offer.status === 'active' &&
      offer.buyerPromotionId === state.playerPromotionId &&
      offer.fighterId === rival.id
  ).length,
  1
);
assert.equal(revised.id, first.id);
assert.equal(revised.state.contractMarket.offers[revised.id].createdDate, state.currentDate);
assert.equal(revised.state.contractMarket.offers[revised.id].transferFee, 25_000);

const rivalBid = upsertTransferOffer(revised.state, {
  buyerPromotionId: rivalPromotionId,
  fighterId: playerFighter.id,
  transferFee: 20_000,
  terms: { fights: 4, payPerFight: 10_000, winBonus: 10_000 }
});
assert.equal(rivalBid.ok, true);
if (!rivalBid.ok) throw new Error('rival bid failed');
const visible = getVisibleMarketOffers(rivalBid.state, state.playerPromotionId);
assert.equal(visible.find(item => item.id === rivalBid.id)?.terms, null);
assert.equal(visible.find(item => item.id === rivalBid.id)?.transferFee, 20_000);
assert.ok(!visible.some(item => item.direction === 'incoming' && item.fighterId === rival.id));
assert.equal(getMarketCompetition(rivalBid.state, playerFighter.id).interestedPromotions, 1);

const accepted = respondToIncomingOffer(
  rivalBid.state,
  state.playerPromotionId,
  rivalBid.id,
  true
);
assert.equal(accepted.ok, true);
if (!accepted.ok) throw new Error('response failed');
assert.equal(accepted.state.contractMarket.offers[rivalBid.id].sellerDecision, 'accepted');
assert.deepEqual(
  respondToIncomingOffer(rivalBid.state, rivalPromotionId, rivalBid.id, true),
  { ok: false, state: rivalBid.state, reason: 'ownership_changed' }
);

const freeAgentBid = upsertTransferOffer(state, {
  buyerPromotionId: state.playerPromotionId,
  fighterId: freeAgent.id,
  transferFee: 999,
  terms: { fights: 4, payPerFight: 10_000, winBonus: 10_000 }
});
assert.equal(freeAgentBid.ok, true);
if (!freeAgentBid.ok) throw new Error('free agent offer failed');
assert.equal(freeAgentBid.state.contractMarket.offers[freeAgentBid.id].transferFee, 0);
assert.equal(freeAgentBid.state.contractMarket.offers[freeAgentBid.id].sellerDecision, 'accepted');
const withdrawn = withdrawTransferOffer(
  freeAgentBid.state,
  state.playerPromotionId,
  freeAgentBid.id
);
assert.equal(withdrawn.ok, true);
if (!withdrawn.ok) throw new Error('offer withdrawal failed');
assert.equal(withdrawn.state.contractMarket.offers[freeAgentBid.id].status, 'withdrawn');

assert.deepEqual(
  upsertTransferOffer(state, {
    buyerPromotionId: state.playerPromotionId,
    fighterId: freeAgent.id,
    transferFee: 0,
    terms: { fights: 0, payPerFight: 10_000, winBonus: 10_000 }
  }),
  { ok: false, state, reason: 'invalid_terms' }
);
const closed = structuredClone(rivalBid.state);
closed.contractMarket.windows[windowId].status = 'closed';
assert.deepEqual(
  upsertTransferOffer(closed, {
    buyerPromotionId: state.playerPromotionId,
    fighterId: freeAgent.id,
    transferFee: 0,
    terms: { fights: 4, payPerFight: 10_000, winBonus: 10_000 }
  }),
  { ok: false, state: closed, reason: 'window_not_open' }
);

console.log('Contract market offer checks passed.');
