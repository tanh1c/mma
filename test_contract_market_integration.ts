import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { advanceTime } from './src/lib/engine';
import { runObserverDecisions } from './src/lib/game/observer';
import { autoBookEventsAndContracts } from './src/lib/game/autobooker';
import { maintainTournamentRosterDepth } from './src/lib/game/tournament';
import { syncChampionFlags } from './src/lib/game/contracts';
import {
  advanceContractMarket,
  isContractMarketOpen,
  isContractProtectedUntilResolution,
  upsertTransferOffer
} from './src/lib/game/contractMarket';

const openMarketState = () => {
  const state = generateInitialWorld(2201);
  state.currentDate = '2025-12-01';
  const window = state.contractMarket.windows['market-window-2025'];
  state.contractMarket.windows['market-window-2025'] = {
    ...window,
    openDate: '2025-12-01',
    closeDate: '2025-12-31',
    status: 'open'
  };
  return state;
};

const target = (state: ReturnType<typeof generateInitialWorld>) =>
  Object.values(state.fighters).find(fighter =>
    fighter.contract && !fighter.isChampion
  )!;

let state = openMarketState();
const expiring = target(state);
state.fighters[expiring.id] = {
  ...expiring,
  contract: { ...expiring.contract!, endDate: '2025-12-01' }
};
assert.equal(isContractMarketOpen(state), true);
assert.equal(isContractProtectedUntilResolution(state, expiring.id, '2025-12-02'), true);
const advanced = advanceTime(state, 1, 'en');
assert.equal(advanced.currentDate, '2025-12-02');
assert.ok(advanced.fighters[expiring.id].contract);

state = generateInitialWorld(2202);
state.currentDate = '2025-01-01';
const ordinaryExpiry = target(state);
state.fighters[ordinaryExpiry.id] = {
  ...ordinaryExpiry,
  contract: { ...ordinaryExpiry.contract!, endDate: '2025-01-01' }
};
const expired = advanceTime(state, 1, 'en');
assert.equal(expired.fighters[ordinaryExpiry.id].contract, null);

state = openMarketState();
state.mode = 'observer';
state.autopilot.enabled = true;
state.promotion.money = 500_000;
const freeAgent = Object.values(state.fighters).find(fighter =>
  !fighter.contract && fighter.careerPhase !== 'retired'
)!;
state.fighters[freeAgent.id] = {
  ...freeAgent,
  counterOffer: {
    fights: 4,
    payPerFight: 5_000,
    winBonus: 5_000,
    interest: 50,
    expiresDate: '2025-12-10'
  }
};
const observerState = runObserverDecisions(state, 'en');
assert.equal(observerState.fighters[freeAgent.id].contract, null);
assert.deepEqual(observerState.fighters[freeAgent.id].counterOffer, state.fighters[freeAgent.id].counterOffer);

state = openMarketState();
const incumbent = target(state);
const incumbentOwnerId = incumbent.contract!.promotionId!;
state.promotions[incumbentOwnerId] = {
  ...state.promotions[incumbentOwnerId],
  money: 1_000_000
};
if (incumbentOwnerId === state.playerPromotionId) {
  state.promotion = { ...state.promotion, money: 1_000_000 };
}
state.fighters[incumbent.id] = {
  ...incumbent,
  contract: {
    ...incumbent.contract!,
    fightsRemaining: 1,
    endDate: '2025-12-15'
  }
};
const renewal = upsertTransferOffer(state, {
  buyerPromotionId: incumbentOwnerId,
  fighterId: incumbent.id,
  transferFee: 0,
  terms: { fights: 4, payPerFight: 10_000, winBonus: 10_000 }
});
assert.equal(renewal.ok, true);
if (!renewal.ok) throw new Error('renewal setup failed');
state = renewal.state;
state.currentDate = '2025-12-31';
state.contractMarket.windows['market-window-2025'].status = 'resolving';
const renewed = advanceContractMarket(state, 'en');
assert.equal(renewed.fighters[incumbent.id].contract?.promotionId, incumbentOwnerId);
assert.equal(renewed.fighters[incumbent.id].contract?.fightsRemaining, 4);
assert.equal(renewed.contractMarket.history.at(-1)?.outcome, 'renewed');

state = openMarketState();
state.promotion = { ...state.promotion, money: 500_000 };
state.promotions[state.playerPromotionId] = state.promotion;
const playerChampion = Object.values(state.fighters).find(fighter =>
  fighter.isChampion && fighter.contract?.promotionId === state.playerPromotionId
)!;
state.fighters[playerChampion.id] = {
  ...playerChampion,
  contract: { ...playerChampion.contract!, fightsRemaining: 1 }
};
const marketAutobooked = autoBookEventsAndContracts(state, 'en');
assert.equal(marketAutobooked.fighters[playerChampion.id].contract?.fightsRemaining, 1);
marketAutobooked.contractMarket.windows['market-window-2025'].status = 'closed';
const postMarketAutobooked = autoBookEventsAndContracts(marketAutobooked, 'en');
assert.equal(postMarketAutobooked.fighters[playerChampion.id].contract?.fightsRemaining, 4);

state = openMarketState();
state.contractMarket.windows['market-window-2025'].status = 'closed';
const rivalTitle = Object.entries(state.titlesByPromotion)
  .flatMap(([promotionId, titles]) => Object.values(titles).map(title => ({ promotionId, fighterId: title.undisputedChampionId })))
  .find(item => item.promotionId !== state.playerPromotionId && item.fighterId);
assert.ok(rivalTitle?.fighterId);
const rivalChampion = state.fighters[rivalTitle.fighterId];
const rivalOwnerId = rivalTitle.promotionId;
state.fighters[rivalChampion.id] = {
  ...rivalChampion,
  contract: { ...rivalChampion.contract!, fightsRemaining: 1 }
};
const rivalAutobooked = autoBookEventsAndContracts(syncChampionFlags(state), 'en');
assert.equal(rivalAutobooked.fighters[rivalChampion.id].contract?.promotionId, rivalOwnerId);
assert.equal(rivalAutobooked.fighters[rivalChampion.id].contract?.fightsRemaining, 1);
assert.equal(
  rivalAutobooked.titlesByPromotion[rivalOwnerId][rivalChampion.weightClass].undisputedChampionId,
  rivalChampion.id
);

state = openMarketState();
state.promotion = { ...state.promotion, money: 500_000 };
const playerLightweights = Object.values(state.fighters).filter(fighter =>
  fighter.weightClass === 'Lightweight' &&
  fighter.contract?.promotionId === state.playerPromotionId
);
for (const fighter of playerLightweights.slice(2)) {
  state.fighters[fighter.id] = { ...fighter, contract: null };
}
const lightweightContractsBefore = Object.values(state.fighters).filter(fighter =>
  fighter.weightClass === 'Lightweight' &&
  fighter.contract?.promotionId === state.playerPromotionId
).length;
const marketTournamentDepth = maintainTournamentRosterDepth(state, 'Lightweight', 'en');
assert.equal(
  Object.values(marketTournamentDepth.fighters).filter(fighter =>
    fighter.weightClass === 'Lightweight' &&
    fighter.contract?.promotionId === state.playerPromotionId
  ).length,
  lightweightContractsBefore
);
marketTournamentDepth.contractMarket.windows['market-window-2025'].status = 'closed';
const postMarketTournamentDepth = maintainTournamentRosterDepth(marketTournamentDepth, 'Lightweight', 'en');
assert.ok(
  Object.values(postMarketTournamentDepth.fighters).filter(fighter =>
    fighter.weightClass === 'Lightweight' &&
    fighter.contract?.promotionId === state.playerPromotionId
  ).length > lightweightContractsBefore
);

state = openMarketState();
const champion = Object.values(state.fighters).find(fighter =>
  fighter.contract && fighter.isChampion
)!;
const championOwnerId = champion.contract!.promotionId!;
const championTitle = state.titlesByPromotion[championOwnerId][champion.weightClass];
state.fighters[champion.id] = {
  ...champion,
  contract: { ...champion.contract!, endDate: '2025-12-15' }
};
state.currentDate = '2025-12-31';
state.contractMarket.windows['market-window-2025'].status = 'resolving';
const releasedChampion = advanceTime(state, 1, 'en');
assert.equal(releasedChampion.fighters[champion.id].contract, null);
assert.notEqual(
  releasedChampion.titlesByPromotion[championOwnerId][champion.weightClass].undisputedChampionId,
  championTitle.undisputedChampionId
);

assert.equal(typeof advanceContractMarket, 'function');
console.log('Contract market integration checks passed.');
