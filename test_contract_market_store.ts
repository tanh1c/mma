import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { upsertTransferOffer } from './src/lib/game/contractMarket';
import { refreshPromotionEconomy } from './src/lib/game/promotionEconomy';
import { useGameStore } from './src/store/gameStore';

const openMarketState = () => {
  let state = generateInitialWorld(2203);
  state.currentDate = '2025-12-02';
  state.contractMarket.windows['market-window-2025'] = {
    ...state.contractMarket.windows['market-window-2025'],
    openDate: '2025-12-01',
    closeDate: '2025-12-31',
    status: 'open'
  };
  for (const promotionId of Object.keys(state.promotions)) {
    state.promotions[promotionId] = { ...state.promotions[promotionId], money: 1_000_000 };
    state.promotionEconomies[promotionId] = {
      ...state.promotionEconomies[promotionId],
      ledgerOpeningBalance: 1_000_000,
      ledger: []
    };
    state = refreshPromotionEconomy(state, promotionId);
  }
  state.promotion = state.promotions[state.playerPromotionId];
  return state;
};

let state = openMarketState();
const playerFighter = Object.values(state.fighters).find(fighter =>
  fighter.contract?.promotionId === state.playerPromotionId && !fighter.isChampion
)!;
const rivalPromotionId = Object.keys(state.promotions).find(id =>
  id !== state.playerPromotionId
)!;
const rivalFighter = Object.values(state.fighters).find(fighter =>
  fighter.contract?.promotionId === rivalPromotionId
)!;
const freeAgent = Object.values(state.fighters).find(fighter => !fighter.contract)!;
state.fighters[playerFighter.id] = {
  ...playerFighter,
  contract: { ...playerFighter.contract!, endDate: '2026-12-31' }
};
state.fighters[rivalFighter.id] = {
  ...rivalFighter,
  contract: { ...rivalFighter.contract!, endDate: '2026-12-31' }
};
useGameStore.setState(state);

assert.equal(
  useGameStore.getState().listMarketFighter(playerFighter.id, 50_000),
  null
);
const listingId = `market-listing-market-window-2025-${playerFighter.id}`;
assert.equal(useGameStore.getState().contractMarket.listings[listingId].minimumFee, 50_000);

const listingsBeforeInvalid = useGameStore.getState().contractMarket.listings;
assert.equal(
  useGameStore.getState().listMarketFighter(rivalFighter.id, 50_000),
  'ownership_changed'
);
assert.equal(useGameStore.getState().contractMarket.listings, listingsBeforeInvalid);
assert.equal(useGameStore.getState().withdrawMarketListing(listingId), null);
assert.equal(useGameStore.getState().contractMarket.listings[listingId].status, 'withdrawn');

const terms = { fights: 4, payPerFight: 20_000, winBonus: 20_000 };
assert.equal(
  useGameStore.getState().submitMarketOffer(rivalFighter.id, 100_000, terms),
  null
);
const offerId = `market-offer-market-window-2025-${state.playerPromotionId}-${rivalFighter.id}`;
assert.equal(
  useGameStore.getState().contractMarket.offers[offerId].buyerPromotionId,
  state.playerPromotionId
);
const offersBeforeInvalid = useGameStore.getState().contractMarket.offers;
assert.equal(
  useGameStore.getState().submitMarketOffer(rivalFighter.id, 100_000, { ...terms, fights: 0 }),
  'invalid_terms'
);
assert.equal(useGameStore.getState().contractMarket.offers, offersBeforeInvalid);
assert.equal(useGameStore.getState().withdrawMarketOffer(offerId), null);
assert.equal(useGameStore.getState().contractMarket.offers[offerId].status, 'withdrawn');

const incoming = upsertTransferOffer(useGameStore.getState(), {
  buyerPromotionId: rivalPromotionId,
  fighterId: playerFighter.id,
  transferFee: 100_000,
  terms
});
assert.equal(incoming.ok, true);
if (!incoming.ok) throw new Error('incoming offer setup failed');
useGameStore.setState(incoming.state);
assert.equal(useGameStore.getState().respondToMarketOffer(incoming.id, true), null);
assert.equal(
  useGameStore.getState().contractMarket.offers[incoming.id].sellerDecision,
  'accepted'
);
assert.equal(
  useGameStore.getState().respondToMarketOffer(offerId, true),
  'ownership_changed'
);

const openStore = useGameStore.getState();
const playerContractBefore = openStore.fighters[playerFighter.id].contract;
openStore.signFighter(freeAgent.id, 10_000, 10_000, 4);
useGameStore.getState().renewFighter(playerFighter.id, 30_000, 30_000, 6);
useGameStore.getState().releaseFighter(playerFighter.id);
assert.equal(useGameStore.getState().fighters[freeAgent.id].contract, null);
assert.equal(useGameStore.getState().fighters[playerFighter.id].contract, playerContractBefore);

useGameStore.setState(current => ({
  contractMarket: {
    ...current.contractMarket,
    windows: {
      ...current.contractMarket.windows,
      'market-window-2025': {
        ...current.contractMarket.windows['market-window-2025'],
        status: 'closed'
      }
    }
  }
}));
useGameStore.getState().signFighter(freeAgent.id, 10_000, 10_000, 4);
assert.equal(
  useGameStore.getState().fighters[freeAgent.id].contract?.promotionId,
  state.playerPromotionId
);
useGameStore.getState().renewFighter(playerFighter.id, 30_000, 30_000, 6);
assert.equal(useGameStore.getState().fighters[playerFighter.id].contract?.fightsRemaining, 6);
useGameStore.getState().releaseFighter(playerFighter.id);
assert.equal(useGameStore.getState().fighters[playerFighter.id].contract, null);

useGameStore.setState({
  autopilotRun: {
    active: true,
    targetDays: 180,
    daysCompleted: 14,
    batchSize: 7,
    stoppedEarly: false,
    error: null
  }
});
useGameStore.getState().newGame();
assert.deepEqual(useGameStore.getState().autopilotRun, {
  active: false,
  targetDays: 0,
  daysCompleted: 0,
  batchSize: 7,
  stoppedEarly: false,
  error: null
});
assert.ok(useGameStore.getState().contractMarket.windows['market-window-2025']);

console.log('Contract market store checks passed.');
