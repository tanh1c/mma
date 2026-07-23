import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { getPromotionFinancialSnapshot } from './src/lib/game/promotionEconomy';
import {
  buildAiMarketShortlist,
  createAiMarketOffer,
  getPromotionContractBudget,
  getPromotionRosterNeeds,
  runAiContractMarket
} from './src/lib/game/contractMarket';

let state = generateInitialWorld(2106);
state.currentDate = '2025-12-02';
state.contractMarket.windows['market-window-2025'] = {
  ...state.contractMarket.windows['market-window-2025'],
  openDate: '2025-12-01',
  closeDate: '2025-12-31',
  status: 'open'
};
const buyerId = Object.keys(state.promotions).find(
  id => state.promotions[id].control === 'ai'
)!;
state.promotions[buyerId] = { ...state.promotions[buyerId], money: 1_000_000 };
assert.equal(getPromotionContractBudget(state, buyerId), getPromotionFinancialSnapshot(state, buyerId)!.contractBudget);

const fullDivision = 'Bantamweight' as const;
const fullDivisionRoster = Object.values(state.fighters).filter(
  fighter => fighter.weightClass === fullDivision &&
    fighter.contract?.promotionId === buyerId
);
assert.equal(fullDivisionRoster.length, 8);
for (const fighter of fullDivisionRoster) {
  state.fighters[fighter.id] = {
    ...fighter,
    contract: { ...fighter.contract!, endDate: '2026-12-31' }
  };
}
assert.equal(getPromotionRosterNeeds(state, buyerId)[fullDivision] ?? 0, 0);

const neededDivision = 'Lightweight' as const;
const buyerLightweights = Object.values(state.fighters)
  .filter(fighter =>
    fighter.weightClass === neededDivision &&
    fighter.contract?.promotionId === buyerId
  )
  .sort((a, b) => a.id.localeCompare(b.id));
for (const fighter of buyerLightweights.slice(3)) {
  state.fighters[fighter.id] = { ...fighter, contract: null };
}
const needs = getPromotionRosterNeeds(state, buyerId);
assert.ok((needs[neededDivision] ?? 0) > 0);

const target = Object.values(state.fighters).find(fighter =>
  fighter.weightClass === neededDivision &&
  fighter.contract &&
  fighter.contract.promotionId !== buyerId
)!;
state.fighters[target.id] = {
  ...target,
  contract: {
    ...target.contract!,
    fightsRemaining: 1,
    payPerFight: 1_000,
    winBonus: 1_000,
    endDate: '2026-12-31'
  },
  popularity: 10,
  marketability: 10
};
for (const candidate of Object.values(state.fighters)) {
  if (
    candidate.id !== target.id &&
    candidate.weightClass === neededDivision &&
    candidate.contract?.promotionId !== buyerId
  ) {
    state.fighters[candidate.id] = { ...candidate, careerPhase: 'retired' };
  }
}
const shortlistA = buildAiMarketShortlist(state, buyerId);
const shortlistB = buildAiMarketShortlist(structuredClone(state), buyerId);
assert.deepEqual(shortlistA, shortlistB);
assert.ok(shortlistA.includes(target.id));

const noNeedTarget = Object.values(state.fighters).find(fighter =>
  fighter.weightClass === fullDivision &&
  fighter.contract?.promotionId !== buyerId
)!;
assert.equal(createAiMarketOffer(state, buyerId, noNeedTarget.id), null);
const offer = createAiMarketOffer(state, buyerId, target.id);
assert.ok(offer);
assert.equal(offer?.buyerPromotionId, buyerId);
const commitment = offer!.transferFee + offer!.terms.fights * (
  offer!.terms.payPerFight + offer!.terms.winBonus * 0.5
);
assert.ok(commitment <= getPromotionContractBudget(state, buyerId));

const ownRetained = buyerLightweights[0];
state.fighters[ownRetained.id] = {
  ...state.fighters[ownRetained.id],
  contract: { ...state.fighters[ownRetained.id].contract!, endDate: '2026-12-31' }
};
assert.equal(createAiMarketOffer(state, buyerId, ownRetained.id), null);
const zeroCash = structuredClone(state);
zeroCash.promotions[buyerId].money = 0;
assert.equal(createAiMarketOffer(zeroCash, buyerId, target.id), null);

const firstRun = runAiContractMarket(state);
const secondRun = runAiContractMarket(firstRun);
assert.deepEqual(secondRun, firstRun);
assert.equal(
  firstRun.contractMarket.windows['market-window-2025'].lastAiRunDate,
  state.currentDate
);
const activeKeys = Object.values(firstRun.contractMarket.offers)
  .filter(item => item.status === 'active')
  .map(item => `${item.buyerPromotionId}:${item.fighterId}`);
assert.equal(new Set(activeKeys).size, activeKeys.length);

console.log('Contract market AI checks passed.');
