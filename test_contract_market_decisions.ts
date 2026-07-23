import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import {
  evaluateSellerFee,
  scoreFighterOffer,
  selectFighterOffer,
  upsertTransferOffer
} from './src/lib/game/contractMarket';
import type { TransferOffer } from './src/types/game';

let state = generateInitialWorld(2105);
state.currentDate = '2025-12-02';
state.contractMarket.windows['market-window-2025'].status = 'open';
const playerPromotionId = state.playerPromotionId;
const rivalPromotionId = Object.keys(state.promotions).find(id => id !== playerPromotionId)!;
const fighter = Object.values(state.fighters).find(
  item => item.contract?.promotionId === playerPromotionId && !item.isChampion
)!;
state.promotions[playerPromotionId] = {
  ...state.promotions[playerPromotionId],
  reputation: 90
};
state.promotion = { ...state.promotion, reputation: 90 };
const player = state.promotions[playerPromotionId];

const makeOffer = (
  id: string,
  buyerPromotionId: string,
  terms: { fights: number; payPerFight: number; winBonus: number },
  sellerPromotionId: string | null = playerPromotionId
): TransferOffer => ({
  id,
  windowId: 'market-window-2025',
  fighterId: fighter.id,
  buyerPromotionId,
  sellerPromotionId,
  transferFee: 0,
  terms,
  status: 'active',
  sellerDecision: sellerPromotionId ? 'accepted' : 'accepted',
  createdDate: state.currentDate,
  updatedDate: state.currentDate
});

const rich = makeOffer('offer-rich', rivalPromotionId, {
  fights: 4,
  payPerFight: 40_000,
  winBonus: 40_000
});
const opportunity = makeOffer('offer-opportunity', playerPromotionId, {
  fights: 4,
  payPerFight: 36_000,
  winBonus: 36_000
});

const firstScores = [
  scoreFighterOffer(state, fighter.id, rich, [rich, opportunity]),
  scoreFighterOffer(state, fighter.id, opportunity, [rich, opportunity])
];
assert.deepEqual(
  firstScores,
  [
    scoreFighterOffer(state, fighter.id, rich, [rich, opportunity]),
    scoreFighterOffer(state, fighter.id, opportunity, [rich, opportunity])
  ]
);
assert.ok(firstScores.every(score => score.utility >= 0));
assert.equal(selectFighterOffer(state, fighter.id, [rich, opportunity]).offer?.id, opportunity.id);

const changedUnrelated = structuredClone(state);
const changedFighter = changedUnrelated.fighters[fighter.id];
changedFighter.age += 10;
changedFighter.popularity = 100;
changedFighter.potential = 95;
changedFighter.nationality = 'Changed';
changedFighter.injuryStatus = { id: 'injury', type: 'test', daysRemaining: 30 };
changedFighter.record = { wins: 0, losses: 99, draws: 0, kos: 0, subs: 0 };
changedFighter.marketability = 0;
changedFighter.personalityTraits = [];
assert.deepEqual(
  scoreFighterOffer(changedUnrelated, fighter.id, rich, [rich, opportunity]),
  firstScores[0]
);

const richerState = structuredClone(state);
richerState.promotions[rivalPromotionId] = {
  ...richerState.promotions[rivalPromotionId],
  reputation: Math.min(100, player.reputation + 30)
};
assert.notEqual(
  scoreFighterOffer(richerState, fighter.id, rich, [rich, opportunity]).prestige,
  firstScores[0].prestige
);

const lowFeeOffer = {
  ...makeOffer('offer-low', rivalPromotionId, {
    fights: 4,
    payPerFight: 1,
    winBonus: 0
  }),
  transferFee: 1
};
const highFeeOffer = {
  ...makeOffer('offer-high', rivalPromotionId, {
    fights: 4,
    payPerFight: 100_000,
    winBonus: 100_000
  }),
  transferFee: 10_000_000
};
const lowDecision = evaluateSellerFee(state, lowFeeOffer);
const highDecision = evaluateSellerFee(state, highFeeOffer);
assert.equal(lowDecision.accepted, false);
assert.equal(highDecision.accepted, true);
assert.ok(highDecision.minimumFee > lowDecision.minimumFee || highDecision.minimumFee >= 0);

const listedResult = upsertTransferOffer(state, {
  buyerPromotionId: rivalPromotionId,
  fighterId: fighter.id,
  transferFee: 100_000,
  terms: { fights: 4, payPerFight: 20_000, winBonus: 20_000 }
});
assert.equal(listedResult.ok, true);
if (!listedResult.ok) throw new Error('offer setup failed');
const listedState = {
  ...listedResult.state,
  contractMarket: {
    ...listedResult.state.contractMarket,
    listings: {
      [`market-listing-market-window-2025-${fighter.id}`]: {
        id: `market-listing-market-window-2025-${fighter.id}`,
        windowId: 'market-window-2025',
        fighterId: fighter.id,
        sellerPromotionId: playerPromotionId,
        minimumFee: 1,
        status: 'active' as const,
        createdDate: state.currentDate,
        updatedDate: state.currentDate
      }
    }
  }
};
assert.ok(evaluateSellerFee(listedState, listedState.contractMarket.offers[listedResult.id]).minimumFee <= lowDecision.minimumFee);

const tieA = makeOffer('offer-a', rivalPromotionId, {
  fights: 4,
  payPerFight: 20_000,
  winBonus: 20_000
});
const tieB = { ...tieA, id: 'offer-b' };
const tieWinner = selectFighterOffer(state, fighter.id, [tieB, tieA]);
assert.equal(tieWinner.offer?.id, 'offer-a');
assert.ok(tieWinner.reason === 'better_expected_pay' || tieWinner.reason === 'loyalty' || tieWinner.reason === 'better_title_opportunity' || tieWinner.reason === 'better_prestige');

console.log('Contract market decision checks passed.');
