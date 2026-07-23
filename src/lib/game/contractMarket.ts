import { addDays, format } from 'date-fns';
import { getContractEndDate, getContractExpectation, getContractStatus, isContractMarketOpen, syncChampionFlags } from './contracts';
import { buildWorldRankings, getFighterRankContext, updateRankings } from './rankings';
import { WEIGHT_CLASSES } from './constants';
import { repairFutureEventAvailability } from './autobooker';
import {
  applyPromotionTransaction,
  canPromotionAffordContractCommitment,
  getPromotionFinancialSnapshot,
  refreshPromotionEconomy,
  validatePromotionEconomies
} from './promotionEconomy';
import type { Language } from '../localization';
import type {
  ContractMarketState,
  GameState,
  MarketContractTerms,
  MarketMutationResult,
  MarketReason,
  PendingTransferSettlement,
  SellerDecisionStatus,
  TransferHistoryOutcome,
  TransferOffer,
  TransferOfferStatus,
  TransferWindow,
  WeightClass
} from '../../types/game';

export const CONTRACT_MARKET_FALLBACK_MONTH_DAY = '12-01';

export function initializeContractMarketState(
  _state: Pick<GameState, 'currentDate'>,
  existing: Partial<ContractMarketState> = {}
): ContractMarketState {
  return {
    windows: { ...(existing.windows || {}) },
    listings: { ...(existing.listings || {}) },
    offers: { ...(existing.offers || {}) },
    pendingSettlements: { ...(existing.pendingSettlements || {}) },
    history: [...(existing.history || [])]
  };
}

export function scheduleContractWindow(
  state: GameState,
  season: number
): GameState {
  const id = `market-window-${season}`;
  if (state.contractMarket.windows[id]) return state;
  const openDate = `${season}-${CONTRACT_MARKET_FALLBACK_MONTH_DAY}`;
  const window: TransferWindow = {
    id,
    season,
    openDate,
    closeDate: format(addDays(new Date(openDate), 30), 'yyyy-MM-dd'),
    status: 'scheduled'
  };
  return {
    ...state,
    contractMarket: {
      ...state.contractMarket,
      windows: { ...state.contractMarket.windows, [id]: window }
    }
  };
}

export function getCurrentContractWindow(
  state: GameState
): TransferWindow | null {
  const priority: Record<TransferWindow['status'], number> = {
    open: 0,
    resolving: 1,
    scheduled: 2,
    closed: 3
  };
  return Object.values(state.contractMarket.windows)
    .filter(window => window.status !== 'closed')
    .sort((a, b) => priority[a.status] - priority[b.status] || b.season - a.season)[0] ?? null;
}

export function getInternationalSeasonCompletionDate(
  state: GameState,
  season: number
): string | null {
  const tournaments = Object.values(state.tournaments).filter(tournament =>
    tournament.scope === 'international' &&
    new Date(tournament.createdDate).getFullYear() === season
  );
  if (!state.internationalCompetitionYears.includes(season) || !tournaments.length) return null;
  if (tournaments.some(tournament => tournament.status !== 'completed' || !tournament.completedDate)) return null;
  return tournaments.map(tournament => tournament.completedDate!).sort().at(-1)!;
}

export function advanceContractMarketCalendar(state: GameState): GameState {
  const currentSeason = new Date(state.currentDate).getFullYear();
  const windows = Object.values(state.contractMarket.windows);
  const latestClosed = windows
    .filter(window => window.status === 'closed')
    .sort((a, b) => b.season - a.season)[0];
  let next = scheduleContractWindow(
    state,
    latestClosed && latestClosed.season >= currentSeason
      ? latestClosed.season + 1
      : currentSeason
  );
  const current = getCurrentContractWindow(next);
  if (!current) return next;

  let window = current;
  if (window.status === 'scheduled') {
    const fallbackDate = `${window.season}-${CONTRACT_MARKET_FALLBACK_MONTH_DAY}`;
    const completedDate = getInternationalSeasonCompletionDate(next, window.season);
    const cupOpenDate = completedDate
      ? format(addDays(new Date(completedDate), 1), 'yyyy-MM-dd')
      : null;
    const openDate = cupOpenDate && cupOpenDate < fallbackDate ? cupOpenDate : fallbackDate;
    window = {
      ...window,
      openDate,
      closeDate: format(addDays(new Date(openDate), 30), 'yyyy-MM-dd'),
      status: next.currentDate >= openDate ? 'open' : 'scheduled'
    };
  }
  if (window.status === 'open' && next.currentDate >= window.closeDate) {
    window = { ...window, status: 'resolving' };
  }
  if (window === current) return next;
  return {
    ...next,
    contractMarket: {
      ...next.contractMarket,
      windows: { ...next.contractMarket.windows, [window.id]: window }
    }
  };
}

export { isContractMarketOpen } from './contracts';

export function isContractProtectedUntilResolution(
  state: GameState,
  fighterId: string,
  nextDate: string
): boolean {
  const window = getCurrentContractWindow(state);
  const contract = state.fighters[fighterId]?.contract;
  return Boolean(
    contract &&
    (window?.status === 'open' || window?.status === 'resolving') &&
    contract.endDate < nextDate &&
    contract.endDate <= window.closeDate
  );
}

const activeWindow = (state: GameState) => {
  const window = getCurrentContractWindow(state);
  return window?.status === 'open' ? window : null;
};

const validAmount = (value: number, minimum: number) =>
  Number.isSafeInteger(value) && value >= minimum;

const validTerms = (terms: MarketContractTerms) =>
  validAmount(terms.fights, 1) &&
  validAmount(terms.payPerFight, 1) &&
  validAmount(terms.winBonus, 0);

const getContractCommitment = (transferFee: number, terms: MarketContractTerms) =>
  transferFee + terms.fights * (terms.payPerFight + terms.winBonus * 0.5);

export function listFighter(
  state: GameState,
  sellerPromotionId: string,
  fighterId: string,
  minimumFee: number
): MarketMutationResult {
  const window = activeWindow(state);
  if (!window) return { ok: false, state, reason: 'window_not_open' };
  const fighter = state.fighters[fighterId];
  if (!fighter) return { ok: false, state, reason: 'fighter_missing' };
  if (!validAmount(minimumFee, 0)) return { ok: false, state, reason: 'invalid_terms' };
  if (fighter.contract?.promotionId !== sellerPromotionId || fighter.contract.endDate <= window.closeDate) {
    return { ok: false, state, reason: 'ownership_changed' };
  }
  const id = `market-listing-${window.id}-${fighterId}`;
  const existing = state.contractMarket.listings[id];
  return {
    ok: true,
    id,
    state: {
      ...state,
      contractMarket: {
        ...state.contractMarket,
        listings: {
          ...state.contractMarket.listings,
          [id]: {
            id,
            windowId: window.id,
            fighterId,
            sellerPromotionId,
            minimumFee,
            status: 'active',
            createdDate: existing?.createdDate ?? state.currentDate,
            updatedDate: state.currentDate
          }
        }
      }
    }
  };
}

export function withdrawListing(
  state: GameState,
  sellerPromotionId: string,
  listingId: string
): MarketMutationResult {
  if (!activeWindow(state)) return { ok: false, state, reason: 'window_not_open' };
  const listing = state.contractMarket.listings[listingId];
  if (!listing) return { ok: false, state, reason: 'offer_missing' };
  if (listing.sellerPromotionId !== sellerPromotionId || listing.status !== 'active') {
    return { ok: false, state, reason: 'ownership_changed' };
  }
  return {
    ok: true,
    id: listingId,
    state: {
      ...state,
      contractMarket: {
        ...state.contractMarket,
        listings: {
          ...state.contractMarket.listings,
          [listingId]: {
            ...listing,
            status: 'withdrawn',
            updatedDate: state.currentDate
          }
        }
      }
    }
  };
}

export function upsertTransferOffer(
  state: GameState,
  input: {
    buyerPromotionId: string;
    fighterId: string;
    transferFee: number;
    terms: MarketContractTerms;
  }
): MarketMutationResult {
  const window = activeWindow(state);
  if (!window) return { ok: false, state, reason: 'window_not_open' };
  const fighter = state.fighters[input.fighterId];
  if (!fighter) return { ok: false, state, reason: 'fighter_missing' };
  if (!state.promotions[input.buyerPromotionId]) {
    return { ok: false, state, reason: 'promotion_missing' };
  }
  if (!validAmount(input.transferFee, 0) || !validTerms(input.terms)) {
    return { ok: false, state, reason: 'invalid_terms' };
  }
  const contracted = Boolean(
    fighter.contract && fighter.contract.endDate > window.closeDate
  );
  const sellerPromotionId = contracted
    ? fighter.contract!.promotionId ?? null
    : null;
  if (sellerPromotionId === input.buyerPromotionId) {
    return { ok: false, state, reason: 'ownership_changed' };
  }
  if (canPromotionAffordContractCommitment(
    state,
    input.buyerPromotionId,
    getContractCommitment(contracted ? input.transferFee : 0, input.terms)
  )) {
    return { ok: false, state, reason: 'insufficient_cash' };
  }
  const id = `market-offer-${window.id}-${input.buyerPromotionId}-${input.fighterId}`;
  const existing = state.contractMarket.offers[id];
  return {
    ok: true,
    id,
    state: {
      ...state,
      contractMarket: {
        ...state.contractMarket,
        offers: {
          ...state.contractMarket.offers,
          [id]: {
            id,
            windowId: window.id,
            fighterId: input.fighterId,
            buyerPromotionId: input.buyerPromotionId,
            sellerPromotionId,
            transferFee: contracted ? input.transferFee : 0,
            terms: { ...input.terms },
            status: 'active',
            sellerDecision: contracted ? 'pending' : 'accepted',
            createdDate: existing?.createdDate ?? state.currentDate,
            updatedDate: state.currentDate
          }
        }
      }
    }
  };
}

export function withdrawTransferOffer(
  state: GameState,
  buyerPromotionId: string,
  offerId: string
): MarketMutationResult {
  if (!activeWindow(state)) return { ok: false, state, reason: 'window_not_open' };
  const offer = state.contractMarket.offers[offerId];
  if (!offer) return { ok: false, state, reason: 'offer_missing' };
  if (offer.buyerPromotionId !== buyerPromotionId || offer.status !== 'active') {
    return { ok: false, state, reason: 'ownership_changed' };
  }
  return updateOffer(state, offerId, { status: 'withdrawn' });
}

export function respondToIncomingOffer(
  state: GameState,
  sellerPromotionId: string,
  offerId: string,
  accepted: boolean
): MarketMutationResult {
  if (!activeWindow(state)) return { ok: false, state, reason: 'window_not_open' };
  const offer = state.contractMarket.offers[offerId];
  if (!offer) return { ok: false, state, reason: 'offer_missing' };
  if (offer.sellerPromotionId !== sellerPromotionId || offer.status !== 'active') {
    return { ok: false, state, reason: 'ownership_changed' };
  }
  return updateOffer(state, offerId, {
    sellerDecision: accepted ? 'accepted' : 'rejected',
    sellerReason: accepted ? 'seller_accepted' : 'seller_rejected'
  });
}

function updateOffer(
  state: GameState,
  offerId: string,
  update: Partial<{
    status: TransferOfferStatus;
    sellerDecision: SellerDecisionStatus;
    sellerReason: 'seller_accepted' | 'seller_rejected';
  }>
): MarketMutationResult {
  const offer = state.contractMarket.offers[offerId];
  return {
    ok: true,
    id: offerId,
    state: {
      ...state,
      contractMarket: {
        ...state.contractMarket,
        offers: {
          ...state.contractMarket.offers,
          [offerId]: { ...offer, ...update, updatedDate: state.currentDate }
        }
      }
    }
  };
}

export function getMarketCompetition(
  state: GameState,
  fighterId: string
): {
  interestedPromotions: number;
  level: 'none' | 'low' | 'medium' | 'high';
} {
  const interestedPromotions = new Set(
    Object.values(state.contractMarket.offers)
      .filter(offer => offer.fighterId === fighterId && offer.status === 'active')
      .map(offer => offer.buyerPromotionId)
  ).size;
  return {
    interestedPromotions,
    level: interestedPromotions === 0
      ? 'none'
      : interestedPromotions === 1
        ? 'low'
        : interestedPromotions === 2
          ? 'medium'
          : 'high'
  };
}

export function getVisibleMarketOffers(
  state: GameState,
  viewerPromotionId: string
): Array<{
  id: string;
  fighterId: string;
  buyerPromotionId: string;
  direction: 'mine' | 'incoming';
  transferFee: number;
  terms: MarketContractTerms | null;
  status: TransferOfferStatus;
  sellerDecision: SellerDecisionStatus;
}> {
  return Object.values(state.contractMarket.offers)
    .filter(offer =>
      offer.buyerPromotionId === viewerPromotionId ||
      offer.sellerPromotionId === viewerPromotionId
    )
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(offer => ({
      id: offer.id,
      fighterId: offer.fighterId,
      buyerPromotionId: offer.buyerPromotionId,
      direction: offer.buyerPromotionId === viewerPromotionId ? 'mine' : 'incoming',
      transferFee: offer.transferFee,
      terms: offer.buyerPromotionId === viewerPromotionId ? { ...offer.terms } : null,
      status: offer.status,
      sellerDecision: offer.sellerDecision
    }));
}

export interface FighterOfferScore {
  offerId: string;
  expectedMoney: number;
  prestige: number;
  titleOpportunity: number;
  loyalty: number;
  utility: number;
}

export function evaluateSellerFee(
  state: GameState,
  offer: TransferOffer
): { accepted: boolean; minimumFee: number; reason: MarketReason } {
  const fighter = state.fighters[offer.fighterId];
  const contract = fighter?.contract;
  if (!fighter || !contract || !offer.sellerPromotionId) {
    return { accepted: true, minimumFee: 0, reason: 'seller_accepted' };
  }
  const titles = offer.sellerPromotionId === state.playerPromotionId
    ? state.titles
    : state.titlesByPromotion[offer.sellerPromotionId];
  const rankings = offer.sellerPromotionId === state.playerPromotionId
    ? state.rankings
    : state.rankingsByPromotion[offer.sellerPromotionId];
  const title = titles?.[fighter.weightClass];
  const domesticTitleHolder =
    title?.undisputedChampionId === fighter.id ||
    title?.interimChampionId === fighter.id;
  const rank = rankings?.[fighter.weightClass]
    ?.find(item => item.fighterId === fighter.id)?.rank;
  const domesticRank = rank === undefined ? 16 : rank + 1;
  const sameDivisionRosterSize = Object.values(state.fighters).filter(item =>
    item.weightClass === fighter.weightClass &&
    item.contract?.promotionId === offer.sellerPromotionId &&
    item.careerPhase !== 'retired'
  ).length;
  const remainingContractValue = contract.fightsRemaining * (
    contract.payPerFight + Math.round(contract.winBonus * 0.5)
  );
  const titlePremium = domesticTitleHolder ? remainingContractValue : 0;
  const rankPremium = Math.max(0, 16 - domesticRank) * contract.payPerFight;
  const replacementPremium = Math.max(0, 8 - sameDivisionRosterSize) * contract.payPerFight;
  const listing = Object.values(state.contractMarket.listings).find(item =>
    item.fighterId === fighter.id && item.status === 'active'
  );
  const listedDiscount = listing
    ? Math.max(listing.minimumFee, Math.round(remainingContractValue * 0.75))
    : 0;
  const minimumFee = listing
    ? Math.max(
        listing.minimumFee,
        listedDiscount + titlePremium + Math.round(replacementPremium * 0.5)
      )
    : remainingContractValue + titlePremium + rankPremium + replacementPremium;
  return {
    accepted: offer.transferFee >= minimumFee,
    minimumFee,
    reason: offer.transferFee >= minimumFee ? 'seller_accepted' : 'seller_fee_too_low'
  };
}

export function scoreFighterOffer(
  state: GameState,
  fighterId: string,
  offer: TransferOffer,
  eligibleOffers: TransferOffer[]
): FighterOfferScore {
  const fighter = state.fighters[fighterId];
  const buyer = state.promotions[offer.buyerPromotionId];
  const expectedMoney = offer.terms.payPerFight + Math.round(offer.terms.winBonus * 0.5);
  const maxExpectedMoney = Math.max(
    0,
    ...eligibleOffers.map(item =>
      item.terms.payPerFight + Math.round(item.terms.winBonus * 0.5)
    )
  );
  const prestige = buyer?.reputation ?? 0;
  const sameDivisionRosterSize = Object.values(state.fighters).filter(item =>
    item.weightClass === fighter?.weightClass &&
    item.contract?.promotionId === offer.buyerPromotionId &&
    item.careerPhase !== 'retired'
  ).length;
  const buyerTitles = offer.buyerPromotionId === state.playerPromotionId
    ? state.titles
    : state.titlesByPromotion[offer.buyerPromotionId];
  const title = fighter ? buyerTitles?.[fighter.weightClass] : undefined;
  const activeChampion = Boolean(title?.undisputedChampionId || title?.interimChampionId);
  const titleOpportunity = Math.max(
    0,
    Math.min(100, 100 - sameDivisionRosterSize * 6 - (activeChampion ? 15 : 0))
  );
  const loyalty = fighter?.contract?.promotionId === offer.buyerPromotionId ? 100 : 0;
  const moneyScore = maxExpectedMoney ? expectedMoney / maxExpectedMoney * 100 : 0;
  const utility = Number((
    moneyScore * 0.55 +
    prestige * 0.20 +
    titleOpportunity * 0.20 +
    loyalty * 0.05
  ).toFixed(4));
  return {
    offerId: offer.id,
    expectedMoney,
    prestige,
    titleOpportunity,
    loyalty,
    utility
  };
}

export function selectFighterOffer(
  state: GameState,
  fighterId: string,
  eligibleOffers: TransferOffer[]
): {
  offer: TransferOffer | null;
  score: FighterOfferScore | null;
  reason: MarketReason;
} {
  if (!eligibleOffers.length) {
    return { offer: null, score: null, reason: 'no_eligible_offer' };
  }
  const ranked = eligibleOffers
    .map(offer => ({
      offer,
      score: scoreFighterOffer(state, fighterId, offer, eligibleOffers)
    }))
    .sort((a, b) => b.score.utility - a.score.utility || a.offer.id.localeCompare(b.offer.id));
  const winner = ranked[0];
  const runnerUp = ranked[1];
  const advantages = [
    {
      reason: 'better_expected_pay' as const,
      value: winner.score.expectedMoney - (runnerUp?.score.expectedMoney ?? 0),
      weight: 0.55
    },
    {
      reason: 'better_prestige' as const,
      value: winner.score.prestige - (runnerUp?.score.prestige ?? 0),
      weight: 0.20
    },
    {
      reason: 'better_title_opportunity' as const,
      value: winner.score.titleOpportunity - (runnerUp?.score.titleOpportunity ?? 0),
      weight: 0.20
    },
    {
      reason: 'loyalty' as const,
      value: winner.score.loyalty - (runnerUp?.score.loyalty ?? 0),
      weight: 0.05
    }
  ].sort((a, b) => b.value * b.weight - a.value * a.weight);
  return {
    offer: winner.offer,
    score: winner.score,
    reason: advantages.find(item => item.value > 0)?.reason ?? 'better_expected_pay'
  };
}

export const AI_MARKET_STARTING_CASH = 500_000;

export function getPromotionContractBudget(
  state: GameState,
  promotionId: string
): number {
  return getPromotionFinancialSnapshot(state, promotionId)?.contractBudget ?? 0;
}

export function getPromotionRosterNeeds(
  state: GameState,
  promotionId: string
): Partial<Record<WeightClass, number>> {
  const window = activeWindow(state);
  if (!window) return {};
  return Object.fromEntries(WEIGHT_CLASSES.map(weightClass => {
    const roster = Object.values(state.fighters).filter(fighter =>
      fighter.weightClass === weightClass &&
      fighter.contract?.promotionId === promotionId &&
      fighter.careerPhase !== 'retired'
    );
    const retained = roster.filter(fighter => fighter.contract!.endDate > window.closeDate);
    const expectedDepartures = roster.length - retained.length;
    const title = promotionId === state.playerPromotionId
      ? state.titles[weightClass]
      : state.titlesByPromotion[promotionId]?.[weightClass];
    const championId = title?.undisputedChampionId ?? title?.interimChampionId;
    const hasRetainedChampion = Boolean(
      championId && retained.some(fighter => fighter.id === championId)
    );
    const topFiveCount = retained.filter(fighter => {
      const rank = getFighterRankContext(state, fighter.id, promotionId);
      return rank && rank.sortValue <= 6;
    }).length;
    const need = Math.max(0, 8 - retained.length)
      + (hasRetainedChampion ? 0 : 2)
      + (topFiveCount < 3 ? 1 : 0)
      + expectedDepartures;
    return [weightClass, need];
  })) as Partial<Record<WeightClass, number>>;
}

export function isActiveInternationalParticipant(state: GameState, fighterId: string): boolean {
  return Object.values(state.tournaments).some(tournament =>
    tournament.scope === 'international' &&
    (tournament.status === 'planned' || tournament.status === 'active') &&
    tournament.participants.some(participant => participant.fighterId === fighterId)
  );
}

export function buildAiMarketShortlist(
  state: GameState,
  buyerPromotionId: string
): string[] {
  const window = activeWindow(state);
  const buyer = state.promotions[buyerPromotionId];
  if (!window || buyer?.control !== 'ai') return [];
  const needs = getPromotionRosterNeeds(state, buyerPromotionId);
  const ranked = Object.values(state.fighters)
    .filter(fighter => {
      if (fighter.careerPhase === 'retired' || !(needs[fighter.weightClass] ?? 0)) return false;
      if (isActiveInternationalParticipant(state, fighter.id)) return false;
      return fighter.contract?.promotionId !== buyerPromotionId || fighter.contract.endDate <= window.closeDate;
    })
    .map(fighter => {
      const rank = fighter.contract?.promotionId
        ? getFighterRankContext(state, fighter.id, fighter.contract.promotionId)?.sortValue ?? 1000
        : 1000;
      const recordScore = fighter.record.wins * 3 - fighter.record.losses * 2;
      const balance = fighter.potential - Math.max(0, fighter.age - 27) * 2;
      const risk = (fighter.injuryStatus ? 30 : 0) +
        ((fighter.medicalSuspension?.daysRemaining ?? 0) > 0 ? 20 : 0);
      return {
        fighter,
        need: needs[fighter.weightClass] ?? 0,
        score: (1000 - Math.min(rank, 1000)) + recordScore + fighter.popularity + balance - risk
      };
    })
    .sort((a, b) =>
      b.need - a.need ||
      b.score - a.score ||
      a.fighter.id.localeCompare(b.fighter.id)
    );
  const selectedByDivision = new Map<WeightClass, number>();
  return ranked.filter(item => {
    const selected = selectedByDivision.get(item.fighter.weightClass) ?? 0;
    if (selected >= 5) return false;
    selectedByDivision.set(item.fighter.weightClass, selected + 1);
    return true;
  }).map(item => item.fighter.id);
}

export function createAiMarketOffer(
  state: GameState,
  buyerPromotionId: string,
  fighterId: string
): TransferOffer | null {
  const window = activeWindow(state);
  const buyer = state.promotions[buyerPromotionId];
  const fighter = state.fighters[fighterId];
  if (!window || buyer?.control !== 'ai' || !fighter) return null;
  if (!(getPromotionRosterNeeds(state, buyerPromotionId)[fighter.weightClass] ?? 0)) return null;
  if (fighter.contract?.promotionId === buyerPromotionId && fighter.contract.endDate > window.closeDate) return null;
  if (isActiveInternationalParticipant(state, fighterId)) return null;

  const budget = getPromotionContractBudget(state, buyerPromotionId);
  const expectation = getContractExpectation(fighter, buyer);
  const terms: MarketContractTerms = {
    fights: expectation.fights,
    payPerFight: expectation.basePay,
    winBonus: expectation.winBonus
  };
  const contractCommitment = getContractCommitment(0, terms);
  if (canPromotionAffordContractCommitment(state, buyerPromotionId, contractCommitment)) return null;
  const contracted = Boolean(fighter.contract && fighter.contract.endDate > window.closeDate);
  let transferFee = 0;
  if (contracted) {
    const provisional: TransferOffer = {
      id: `market-offer-${window.id}-${buyerPromotionId}-${fighterId}`,
      windowId: window.id,
      fighterId,
      buyerPromotionId,
      sellerPromotionId: fighter.contract!.promotionId ?? null,
      transferFee: budget - contractCommitment,
      terms,
      status: 'active',
      sellerDecision: 'pending',
      createdDate: state.currentDate,
      updatedDate: state.currentDate
    };
    const seller = evaluateSellerFee(state, provisional);
    if (!seller.accepted || seller.minimumFee + contractCommitment > budget) return null;
    transferFee = seller.minimumFee;
  }
  return {
    id: `market-offer-${window.id}-${buyerPromotionId}-${fighterId}`,
    windowId: window.id,
    fighterId,
    buyerPromotionId,
    sellerPromotionId: contracted ? fighter.contract!.promotionId ?? null : null,
    transferFee,
    terms,
    status: 'active',
    sellerDecision: contracted ? 'pending' : 'accepted',
    createdDate: state.currentDate,
    updatedDate: state.currentDate
  };
}

export function runAiContractMarket(state: GameState): GameState {
  const window = activeWindow(state);
  if (!window || window.lastAiRunDate === state.currentDate) return state;
  let next = state;
  const buyers = Object.values(state.promotions)
    .filter(promotion => promotion.control === 'ai')
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const buyer of buyers) {
    for (const fighterId of buildAiMarketShortlist(next, buyer.id)) {
      const offer = createAiMarketOffer(next, buyer.id, fighterId);
      if (!offer) continue;
      const result = upsertTransferOffer(next, {
        buyerPromotionId: buyer.id,
        fighterId,
        transferFee: offer.transferFee,
        terms: offer.terms
      });
      if (result.ok) {
        next = result.state;
        const saved = next.contractMarket.offers[result.id];
        if (saved.sellerPromotionId && saved.sellerPromotionId !== next.playerPromotionId) {
          const decision = evaluateSellerFee(next, saved);
          next = {
            ...next,
            contractMarket: {
              ...next.contractMarket,
              offers: {
                ...next.contractMarket.offers,
                [saved.id]: {
                  ...saved,
                  sellerDecision: decision.accepted ? 'accepted' : 'rejected',
                  sellerReason: decision.reason
                }
              }
            }
          };
        }
      }
    }
  }
  const current = next.contractMarket.windows[window.id];
  return {
    ...next,
    contractMarket: {
      ...next.contractMarket,
      windows: {
        ...next.contractMarket.windows,
        [window.id]: { ...current, lastAiRunDate: state.currentDate }
      }
    }
  };
}

export function advanceContractMarket(
  state: GameState,
  language: Language = 'en'
): GameState {
  let next = advanceContractMarketCalendar(state);
  if (isContractMarketOpen(next)) next = runAiContractMarket(next);
  const resolvingWindow = getCurrentContractWindow(next);
  if (resolvingWindow?.status === 'resolving') {
    next = resolveContractMarket(next, language);
  }
  next = advanceContractMarketCalendar(next);
  if (resolvingWindow && next.contractMarket.windows[resolvingWindow.id]?.status === 'closed') {
    const fighters = { ...next.fighters };
    for (const fighter of Object.values(fighters)) {
      if (
        fighter.contract &&
        getContractStatus(fighter.contract, next.currentDate) === 'expired' &&
        !isFighterInActiveInternationalCompetition(next, fighter.id)
      ) {
        fighters[fighter.id] = { ...fighter, contract: null };
      }
    }
    next = syncChampionFlags({ ...next, fighters });
  }
  return next;
}

export function isFighterInActiveInternationalCompetition(
  state: GameState,
  fighterId: string
): boolean {
  return isActiveInternationalParticipant(state, fighterId);
}

export function validatePendingSettlement(
  state: GameState,
  settlement: PendingTransferSettlement
): MarketReason | null {
  const fighter = state.fighters[settlement.fighterId];
  const buyer = state.promotions[settlement.buyerPromotionId];
  const seller = settlement.sellerPromotionId
    ? state.promotions[settlement.sellerPromotionId]
    : null;
  if (!fighter) return 'fighter_missing';
  if (!buyer || (settlement.sellerPromotionId && !seller)) return 'promotion_missing';
  if (!validAmount(settlement.transferFee, 0) || !validTerms(settlement.terms)) return 'invalid_terms';
  const ownerId = fighter.contract?.promotionId ?? null;
  const window = state.contractMarket.windows[settlement.windowId];
  const incumbentRenewal = settlement.sellerPromotionId === null &&
    ownerId === settlement.buyerPromotionId &&
    Boolean(window && fighter.contract && fighter.contract.endDate <= window.closeDate);
  if (ownerId !== settlement.sellerPromotionId && !incumbentRenewal) return 'ownership_changed';
  if (canPromotionAffordContractCommitment(
    state,
    buyer.id,
    getContractCommitment(settlement.transferFee, settlement.terms)
  )) return 'insufficient_cash';
  if (isFighterInActiveInternationalCompetition(state, fighter.id)) {
    return 'international_competition_active';
  }
  return null;
}

export function applyPendingSettlement(
  state: GameState,
  settlement: PendingTransferSettlement,
  language: Language = 'en'
): {
  state: GameState;
  outcome: TransferHistoryOutcome;
  reason: MarketReason;
} {
  const invalidReason = validatePendingSettlement(state, settlement);
  if (invalidReason) return { state, outcome: 'invalid', reason: invalidReason };
  const fighter = state.fighters[settlement.fighterId];
  const buyer = state.promotions[settlement.buyerPromotionId];
  const seller = settlement.sellerPromotionId
    ? state.promotions[settlement.sellerPromotionId]!
    : null;
  const previousOwner = fighter.contract?.promotionId ?? null;
  let candidate = state;
  if (settlement.transferFee > 0) {
    const buyerPayment = applyPromotionTransaction(candidate, {
      id: `${settlement.id}-buyer`,
      promotionId: buyer.id,
      date: state.currentDate,
      settlementKey: settlement.id,
      category: 'transfer_fee',
      amount: -settlement.transferFee,
      transactionClass: 'discretionary',
      sourceId: settlement.offerId,
      descriptionKey: 'economy.transferFee'
    });
    if (!buyerPayment.ok) return { state, outcome: 'invalid', reason: 'insufficient_cash' };
    candidate = buyerPayment.state;
    if (seller) {
      const sellerPayment = applyPromotionTransaction(candidate, {
        id: `${settlement.id}-seller`,
        promotionId: seller.id,
        date: state.currentDate,
        settlementKey: settlement.id,
        category: 'transfer_fee',
        amount: settlement.transferFee,
        transactionClass: 'income',
        sourceId: settlement.offerId,
        descriptionKey: 'economy.transferFee',
        repayLiabilities: true
      });
      if (!sellerPayment.ok) return { state, outcome: 'invalid', reason: 'insufficient_cash' };
      candidate = sellerPayment.state;
    }
  }
  candidate = {
    ...candidate,
    fighters: {
      ...candidate.fighters,
      [fighter.id]: {
        ...fighter,
        counterOffer: undefined,
        contract: {
          promotionId: buyer.id,
          fightsRemaining: settlement.terms.fights,
          payPerFight: settlement.terms.payPerFight,
          winBonus: settlement.terms.winBonus,
          exclusivity: true,
          endDate: getContractEndDate(state.currentDate, settlement.terms.fights)
        }
      }
    }
  };
  candidate = syncChampionFlags(candidate);
  if (settlement.sellerPromotionId) {
    candidate = updateRankings(candidate, undefined, settlement.sellerPromotionId);
  }
  candidate = updateRankings(candidate, undefined, buyer.id);
  candidate = {
    ...candidate,
    worldRankings: buildWorldRankings(candidate),
    news: [{
      id: `market-news-${settlement.id}`,
      date: state.currentDate,
      type: 'contract',
      title: 'Contract market transfer',
      content: `${fighter.firstName} ${fighter.lastName} joined ${buyer.name}.`
    }, ...candidate.news]
  };
  candidate = repairFutureEventAvailability(candidate, language);
  for (const promotionId of Object.keys(candidate.promotions)) {
    candidate = refreshPromotionEconomy(candidate, promotionId);
  }
  const errors = [
    ...validateContractMarketState(candidate),
    ...validatePromotionEconomies(candidate)
  ];
  if (errors.length) return { state, outcome: 'invalid', reason: 'ownership_changed' };
  return {
    state: candidate,
    outcome: previousOwner === buyer.id
      ? 'renewed'
      : previousOwner
        ? 'transferred'
        : 'signed',
    reason: 'submitted'
  };
}

export function validateContractMarketState(state: GameState): string[] {
  const errors: string[] = [];
  const activeKeys = new Set<string>();
  const historyIds = new Set<string>();
  for (const offer of Object.values(state.contractMarket.offers)) {
    if (offer.status !== 'active') continue;
    if (!state.fighters[offer.fighterId] || !state.promotions[offer.buyerPromotionId]) {
      errors.push(`missing-entity-offer:${offer.id}`);
    }
    const key = `${offer.windowId}:${offer.buyerPromotionId}:${offer.fighterId}`;
    if (activeKeys.has(key)) errors.push(`duplicate-active-offer:${key}`);
    activeKeys.add(key);
  }
  for (const item of state.contractMarket.history) {
    if (historyIds.has(item.id)) errors.push(`duplicate-history:${item.id}`);
    historyIds.add(item.id);
  }
  for (const promotion of Object.values(state.promotions)) {
    const debtLimit = state.promotionEconomies[promotion.id]?.debtLimit ?? 0;
    if (promotion.money < -debtLimit) errors.push(`negative-cash:${promotion.id}`);
  }
  for (const window of Object.values(state.contractMarket.windows)) {
    if (window.status !== 'closed') continue;
    if (Object.values(state.contractMarket.offers).some(offer =>
      offer.windowId === window.id && offer.status === 'active'
    )) errors.push(`closed-window-active-offer:${window.id}`);
    if (Object.values(state.contractMarket.pendingSettlements).some(item =>
      item.windowId === window.id
    )) errors.push(`closed-window-pending:${window.id}`);
  }
  return errors;
}

const historyFor = (
  state: GameState,
  windowId: string,
  offer: TransferOffer,
  outcome: TransferHistoryOutcome,
  reason: MarketReason
) => ({
  id: `market-history-${windowId}-${offer.id}`,
  windowId,
  offerId: offer.id,
  fighterId: offer.fighterId,
  buyerPromotionId: offer.buyerPromotionId,
  sellerPromotionId: offer.sellerPromotionId,
  transferFee: offer.transferFee,
  terms: { ...offer.terms },
  outcome,
  reason,
  date: state.currentDate
});

export function resolveContractMarket(
  state: GameState,
  language: Language = 'en'
): GameState {
  const window = getCurrentContractWindow(state);
  if (!window || window.status !== 'resolving') return state;
  let next = state;
  const offers = Object.values(state.contractMarket.offers)
    .filter(offer => offer.windowId === window.id && offer.status === 'active')
    .sort((a, b) => a.id.localeCompare(b.id));
  const fighterIds = [...new Set(offers.map(offer => offer.fighterId))].sort();
  const offersMap = { ...next.contractMarket.offers };
  let history = [...next.contractMarket.history];

  for (const fighterId of fighterIds) {
    const packages = offers.filter(offer => offer.fighterId === fighterId);
    const eligible: TransferOffer[] = [];
    for (const offer of packages) {
      let reason: MarketReason | null = null;
      if (offer.sellerPromotionId) {
        if (offer.sellerPromotionId === next.playerPromotionId) {
          if (offer.sellerDecision !== 'accepted') {
            reason = offer.sellerDecision === 'rejected'
              ? 'seller_rejected'
              : 'seller_no_response';
          }
        } else {
          const decision = evaluateSellerFee(next, offer);
          if (!decision.accepted) reason = decision.reason;
        }
      }
      const settlement: PendingTransferSettlement = {
        id: `market-settlement-${window.id}-${fighterId}`,
        windowId: window.id,
        offerId: offer.id,
        fighterId,
        buyerPromotionId: offer.buyerPromotionId,
        sellerPromotionId: offer.sellerPromotionId,
        transferFee: offer.transferFee,
        terms: { ...offer.terms }
      };
      reason ??= validatePendingSettlement(next, settlement);
      if (reason) {
        offersMap[offer.id] = { ...offer, status: 'invalid' };
        history.push(historyFor(next, window.id, offer, 'invalid', reason));
      } else {
        eligible.push(offer);
      }
    }
    const selected = selectFighterOffer(next, fighterId, eligible);
    if (!selected.offer) continue;
    for (const offer of eligible) {
      if (offer.id !== selected.offer.id) {
        offersMap[offer.id] = { ...offer, status: 'rejected' };
        history.push(historyFor(next, window.id, offer, 'rejected', 'outbid'));
      }
    }
    const winner = selected.offer;
    const settlement: PendingTransferSettlement = {
      id: `market-settlement-${window.id}-${fighterId}`,
      windowId: window.id,
      offerId: winner.id,
      fighterId,
      buyerPromotionId: winner.buyerPromotionId,
      sellerPromotionId: winner.sellerPromotionId,
      transferFee: winner.transferFee,
      terms: { ...winner.terms }
    };
    const applied = applyPendingSettlement(next, settlement, language);
    next = applied.state;
    offersMap[winner.id] = {
      ...winner,
      status: applied.outcome === 'invalid' ? 'invalid' : 'accepted'
    };
    history.push(historyFor(
      next,
      window.id,
      winner,
      applied.outcome,
      applied.outcome === 'invalid' ? applied.reason : selected.reason
    ));
  }

  const listings = Object.fromEntries(Object.entries(next.contractMarket.listings).map(([id, listing]) => [
    id,
    listing.windowId === window.id && listing.status === 'active'
      ? {
          ...listing,
          status: Object.values(offersMap).some(offer =>
            offer.fighterId === listing.fighterId && offer.status === 'accepted'
          ) ? 'sold' as const : 'expired' as const
        }
      : listing
  ]));
  return {
    ...next,
    contractMarket: {
      ...next.contractMarket,
      windows: {
        ...next.contractMarket.windows,
        [window.id]: {
          ...next.contractMarket.windows[window.id],
          status: 'closed',
          resolvedDate: next.currentDate
        }
      },
      listings,
      offers: offersMap,
      pendingSettlements: Object.fromEntries(
        Object.entries(next.contractMarket.pendingSettlements)
          .filter(([, item]) => item.windowId !== window.id)
      ),
      history: history.slice(-500)
    }
  };
}
