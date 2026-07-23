import { addMonths, format, isAfter, startOfMonth } from 'date-fns';
import { calculateEventProjections } from './economy';
import type {
  FinanceLedgerEntry,
  EventResults,
  FightMatchup,
  GameState,
  PromotionEconomy,
  PromotionFinancialMode,
  PromotionLedgerCategory,
  PromotionLedgerEntry
} from '../../types/game';

export type PromotionEconomyReason =
  | 'promotion_missing'
  | 'economy_missing'
  | 'invalid_amount'
  | 'duplicate_transaction'
  | 'debt_limit'
  | 'outstanding_liabilities'
  | 'recovery_mode'
  | 'required_reserve';

export type PromotionTransactionClass = 'income' | 'mandatory' | 'discretionary';

export interface PromotionTransactionInput {
  id: string;
  promotionId: string;
  date: string;
  settlementKey: string;
  category: PromotionLedgerCategory;
  amount: number;
  transactionClass: PromotionTransactionClass;
  sourceId?: string;
  descriptionKey: string;
  repayLiabilities?: boolean;
}

export type PromotionEconomyMutationResult =
  | { ok: true; state: GameState; entryIds: string[] }
  | { ok: false; state: GameState; reason: PromotionEconomyReason };

export interface PromotionFinancialSnapshot {
  debtHeadroom: number;
  requiredReserve: number;
  nextMonthObligations: number;
  recurringNetIncome: number;
  estimatedRunwayMonths: number;
  financialMode: PromotionFinancialMode;
  contractBudget: number;
}

export interface AiEventFinancialPlan {
  venueId: string;
  ticketPrice: number;
  marketingSpend: number;
  projectedProfit: number;
}

export interface BrandInvestmentEffect {
  fanbaseGain: number;
  reputationGain: number;
}

export function getBrandInvestmentEffect(amount: number): BrandInvestmentEffect {
  if (!Number.isFinite(amount) || amount <= 0) return { fanbaseGain: 0, reputationGain: 0 };
  const growth = Math.log1p(amount / 10_000);
  return {
    fanbaseGain: Math.min(5_000, Math.floor(growth * 750)),
    reputationGain: Math.min(5, Math.round(growth * 100) / 100)
  };
}

function getRawDiscretionaryCapacity(state: GameState, promotionId: string): number {
  const economy = state.promotionEconomies[promotionId];
  const snapshot = getPromotionFinancialSnapshot(state, promotionId);
  if (!economy || !snapshot || economy.outstandingLiabilities > 0) return 0;
  return Math.max(0, snapshot.debtHeadroom - snapshot.nextMonthObligations - snapshot.requiredReserve);
}

export function getAiBrandInvestment(state: GameState, promotionId: string): number {
  const economy = state.promotionEconomies[promotionId];
  if (!economy) return 0;
  const rate = { growth: 0.15, stable: 0.05, cautious: 0, recovery: 0 }[economy.financialMode];
  const candidate = Math.floor((economy.monthlySponsorIncome + economy.monthlyMediaIncome) * rate / 1_000) * 1_000;
  return Math.min(candidate, getRawDiscretionaryCapacity(state, promotionId));
}

export function planAiPromotionEvent(state: GameState, promotionId: string): AiEventFinancialPlan | null {
  const promotion = state.promotions[promotionId];
  const economy = state.promotionEconomies[promotionId];
  if (!promotion || !economy || economy.outstandingLiabilities > 0) return null;
  const fighters = Object.values(state.fighters)
    .filter(fighter => fighter.contract?.promotionId === promotionId && fighter.careerPhase !== 'retired')
    .sort((a, b) => b.popularity - a.popularity || a.id.localeCompare(b.id));
  const fights: FightMatchup[] = [];
  for (let index = 0; index + 1 < fighters.length && fights.length < 4; index += 2) {
    const red = fighters[index];
    const blue = fighters[index + 1];
    if (red.weightClass !== blue.weightClass) continue;
    fights.push({ id: `ai-plan-${promotionId}-${fights.length}`, redCornerId: red.id, blueCornerId: blue.id, weightClass: red.weightClass, isTitleFight: false, rounds: 3, campFocus: 'balanced', socialHype: 0 });
  }
  if (!fights.length) return null;
  const mode = economy.financialMode;
  const ticketMultiplier = { growth: 1.1, stable: 1, cautious: 0.9, recovery: 0.8 }[mode];
  const ticketPrice = Math.max(10, Math.round((20 + promotion.reputation * 0.8) * ticketMultiplier));
  const marketingCap = { growth: 20_000, stable: 10_000, cautious: 2_000, recovery: 0 }[mode];
  const marketingSpend = Math.min(marketingCap, getRawDiscretionaryCapacity(state, promotionId));
  const candidates = Object.values(state.venues).sort((a, b) => a.id.localeCompare(b.id)).map(venue => {
    const projection = calculateEventProjections(fights, state.fighters, venue, ticketPrice, marketingSpend, promotion, state.storylines, state.titlesByPromotion[promotionId], state.tournaments);
    return { venueId: venue.id, ticketPrice, marketingSpend, projectedProfit: projection.expectedProfit, venueCost: venue.cost };
  }).sort(mode === 'recovery'
    ? (a, b) => a.venueCost - b.venueCost || a.venueId.localeCompare(b.venueId)
    : (a, b) => b.projectedProfit - a.projectedProfit || a.venueCost - b.venueCost || a.venueId.localeCompare(b.venueId));
  const plan = candidates[0];
  if (!plan || (mode === 'recovery' && (plan.projectedProfit < 0 || promotion.money + plan.projectedProfit < -economy.debtLimit))) return null;
  return { venueId: plan.venueId, ticketPrice: plan.ticketPrice, marketingSpend: plan.marketingSpend, projectedProfit: plan.projectedProfit };
}

export function getMonthKey(date: string): string {
  return date.slice(0, 7);
}

export function calculateMonthlyRosterRetainer(state: GameState, promotionId: string, settlementDate: string): number {
  return Object.values(state.fighters).reduce((total, fighter) => {
    const contract = fighter.contract;
    if (fighter.careerPhase === 'retired' || contract?.promotionId !== promotionId || contract.endDate < settlementDate) return total;
    return total + Math.round((contract.payPerFight + contract.winBonus * 0.5) * 0.08);
  }, 0);
}

function getPlayerCommercialIncome(state: GameState, promotionId: string, settlementDate = state.currentDate): { sponsor: number; media: number } {
  if (promotionId !== state.playerPromotionId) return { sponsor: 0, media: 0 };
  const activeOnSettlementDate = (deal: { isActive: boolean; expiresDate: string }) => deal.isActive && deal.expiresDate >= settlementDate;
  return {
    sponsor: (state.sponsorDeals ?? []).filter(activeOnSettlementDate).reduce((total, deal) => total + deal.monthlyIncome, 0),
    media: (state.mediaDeals ?? []).filter(activeOnSettlementDate).reduce((total, deal) => total + deal.monthlyIncome, 0)
  };
}

function getEconomyInputs(state: GameState, promotionId: string, settlementDate = state.currentDate) {
  const promotion = state.promotions[promotionId];
  const playerIncome = getPlayerCommercialIncome(state, promotionId, settlementDate);
  const monthlySponsorIncome = promotionId === state.playerPromotionId
    ? playerIncome.sponsor
    : Math.round(5_000 + promotion.reputation * 250 + promotion.fanbase * 0.025);
  const monthlyMediaIncome = promotionId === state.playerPromotionId
    ? playerIncome.media
    : Math.round(7_500 + promotion.reputation * 350 + promotion.fanbase * 0.035);
  const monthlyOperatingCost = Math.round(12_000 + promotion.reputation * 180 + promotion.fanbase * 0.02);
  const monthlyRosterRetainer = calculateMonthlyRosterRetainer(state, promotionId, settlementDate);
  const debtLimit = Math.max(
    100_000,
    Math.round((monthlySponsorIncome + monthlyMediaIncome) * 4 + promotion.reputation * 2_500 + promotion.fanbase * 0.5)
  );
  return { monthlySponsorIncome, monthlyMediaIncome, monthlyOperatingCost, monthlyRosterRetainer, debtLimit };
}

export function derivePromotionFinancialSnapshot(state: GameState, promotionId: string, previousRecoveryMode = false): PromotionFinancialSnapshot {
  const promotion = state.promotions[promotionId];
  const existing = state.promotionEconomies?.[promotionId];
  const inputs = getEconomyInputs(state, promotionId);
  const outstandingLiabilities = existing?.outstandingLiabilities ?? 0;
  const debtHeadroom = Math.max(0, promotion.money + inputs.debtLimit);
  const nextMonthObligations = inputs.monthlyOperatingCost + inputs.monthlyRosterRetainer;
  const requiredReserve = Math.max(50_000, nextMonthObligations * 2);
  const recurringNetIncome = inputs.monthlySponsorIncome + inputs.monthlyMediaIncome - nextMonthObligations;
  const estimatedRunwayMonths = recurringNetIncome >= 0
    ? 24
    : Math.min(24, Math.max(0, Math.floor((debtHeadroom - outstandingLiabilities) / Math.abs(recurringNetIncome))));
  let financialMode: PromotionFinancialMode;
  if (outstandingLiabilities > 0 || debtHeadroom <= nextMonthObligations * 0.25) financialMode = 'recovery';
  else if (previousRecoveryMode && !(debtHeadroom >= nextMonthObligations * 2 && estimatedRunwayMonths >= 6)) financialMode = 'recovery';
  else if (promotion.money >= requiredReserve * 2 && estimatedRunwayMonths >= 12) financialMode = 'growth';
  else if (debtHeadroom >= requiredReserve && estimatedRunwayMonths >= 6) financialMode = 'stable';
  else financialMode = 'cautious';
  const rawCapacity = Math.max(0, debtHeadroom - outstandingLiabilities - nextMonthObligations - requiredReserve);
  const multiplier = { growth: 0.6, stable: 0.4, cautious: 0.15, recovery: 0 }[financialMode];
  return {
    debtHeadroom,
    requiredReserve,
    nextMonthObligations,
    recurringNetIncome,
    estimatedRunwayMonths,
    financialMode,
    contractBudget: Math.floor(rawCapacity * multiplier)
  };
}

function createPromotionEconomy(state: GameState, promotionId: string): PromotionEconomy {
  const promotion = state.promotions[promotionId];
  const inputs = getEconomyInputs(state, promotionId);
  const snapshot = derivePromotionFinancialSnapshot(state, promotionId);
  return {
    promotionId,
    debtLimit: inputs.debtLimit,
    recoveryMode: snapshot.financialMode === 'recovery',
    financialMode: snapshot.financialMode,
    monthlyOperatingCost: inputs.monthlyOperatingCost,
    monthlyRosterRetainer: inputs.monthlyRosterRetainer,
    monthlySponsorIncome: inputs.monthlySponsorIncome,
    monthlyMediaIncome: inputs.monthlyMediaIncome,
    scheduledBrandInvestment: 0,
    outstandingLiabilities: 0,
    estimatedRunwayMonths: snapshot.estimatedRunwayMonths,
    contractBudget: snapshot.contractBudget,
    lastMonthlySettlement: getMonthKey(state.currentDate),
    settledEventIds: [],
    ledgerOpeningBalance: promotion.money,
    legacyFinanceLedgerIds: promotionId === state.playerPromotionId ? (state.financeLedger ?? []).map(entry => entry.id) : [],
    ledger: []
  };
}

export function initializePromotionEconomies(state: GameState): GameState {
  const missingPromotionIds = Object.keys(state.promotions).filter(promotionId => !state.promotionEconomies?.[promotionId]);
  if (!missingPromotionIds.length) return state;
  const promotionEconomies = { ...(state.promotionEconomies ?? {}) };
  const next = { ...state, promotionEconomies };
  for (const promotionId of missingPromotionIds) promotionEconomies[promotionId] = createPromotionEconomy(next, promotionId);
  return next;
}

export function getPromotionFinancialSnapshot(state: GameState, promotionId: string): PromotionFinancialSnapshot | null {
  if (!state.promotions[promotionId] || !state.promotionEconomies[promotionId]) return null;
  return derivePromotionFinancialSnapshot(
    state,
    promotionId,
    state.promotionEconomies[promotionId].recoveryMode
  );
}

export function canPromotionAffordContractCommitment(
  state: GameState,
  promotionId: string,
  commitment: number
): PromotionEconomyReason | null {
  const promotion = state.promotions[promotionId];
  const economy = state.promotionEconomies[promotionId];
  if (!promotion) return 'promotion_missing';
  if (!economy) return 'economy_missing';
  if (!Number.isFinite(commitment) || commitment < 0) return 'invalid_amount';
  if (commitment === 0) return null;
  if (economy.outstandingLiabilities > 0) return 'outstanding_liabilities';
  if (economy.recoveryMode) return 'recovery_mode';
  const snapshot = getPromotionFinancialSnapshot(state, promotionId)!;
  if (commitment <= snapshot.contractBudget) return null;
  return promotion.money - commitment < -economy.debtLimit ? 'debt_limit' : 'required_reserve';
}

export function refreshPromotionEconomy(state: GameState, promotionId: string): GameState {
  const promotion = state.promotions[promotionId];
  const economy = state.promotionEconomies[promotionId];
  if (!promotion || !economy) return state;
  const inputs = getEconomyInputs(state, promotionId);
  const snapshot = derivePromotionFinancialSnapshot(state, promotionId, economy.recoveryMode);
  return {
    ...state,
    promotion: promotionId === state.playerPromotionId ? promotion : state.promotion,
    promotionEconomies: {
      ...state.promotionEconomies,
      [promotionId]: {
        ...economy,
        debtLimit: inputs.debtLimit,
        recoveryMode: snapshot.financialMode === 'recovery',
        financialMode: snapshot.financialMode,
        monthlyOperatingCost: inputs.monthlyOperatingCost,
        monthlyRosterRetainer: inputs.monthlyRosterRetainer,
        monthlySponsorIncome: inputs.monthlySponsorIncome,
        monthlyMediaIncome: inputs.monthlyMediaIncome,
        estimatedRunwayMonths: snapshot.estimatedRunwayMonths,
        contractBudget: snapshot.contractBudget
      }
    }
  };
}

export function getCrossedMonthKeys(fromDate: string, throughDate: string): string[] {
  const firstMonth = startOfMonth(addMonths(new Date(`${fromDate}T00:00:00`), 1));
  const lastMonth = startOfMonth(new Date(`${throughDate}T00:00:00`));
  const months: string[] = [];
  for (let month = firstMonth; !isAfter(month, lastMonth); month = addMonths(month, 1)) {
    months.push(format(month, 'yyyy-MM'));
  }
  return months;
}

export function settlePromotionMonth(state: GameState, promotionId: string, monthKey: string): GameState {
  const economy = state.promotionEconomies[promotionId];
  if (!state.promotions[promotionId] || !economy || monthKey <= economy.lastMonthlySettlement) return state;
  const settlementDate = `${monthKey}-01`;
  const settlementKey = `monthly-${promotionId}-${monthKey}`;
  const inputs = getEconomyInputs(state, promotionId, settlementDate);
  let next = { ...state, currentDate: settlementDate };
  const apply = (id: string, category: PromotionLedgerCategory, amount: number, transactionClass: PromotionTransactionClass, descriptionKey: string, repayLiabilities = false) => {
    if (amount === 0) return;
    const result = applyPromotionTransaction(next, {
      id,
      promotionId,
      date: settlementDate,
      settlementKey,
      category,
      amount,
      transactionClass,
      descriptionKey,
      repayLiabilities
    });
    if (result.ok) next = result.state;
  };
  apply(`${monthKey}-sponsor`, 'monthly_sponsor', inputs.monthlySponsorIncome, 'income', 'economy.sponsorIncome', true);
  apply(`${monthKey}-media`, 'monthly_media', inputs.monthlyMediaIncome, 'income', 'economy.mediaIncome', true);
  apply(`${monthKey}-operating`, 'operating_cost', -inputs.monthlyOperatingCost, 'mandatory', 'economy.operatingCost');
  apply(`${monthKey}-roster-retainer`, 'roster_retainer', -inputs.monthlyRosterRetainer, 'mandatory', 'economy.rosterRetainer');

  let brandInvestment = 0;
  if (promotionId !== state.playerPromotionId) {
    const amount = getAiBrandInvestment(next, promotionId);
    if (amount > 0) {
      const result = applyPromotionTransaction(next, {
        id: `${monthKey}-brand-investment`,
        promotionId,
        date: settlementDate,
        settlementKey,
        category: 'brand_investment',
        amount: -amount,
        transactionClass: 'discretionary',
        descriptionKey: 'economy.brandInvestment'
      });
      if (result.ok) {
        brandInvestment = amount;
        const promotion = result.state.promotions[promotionId];
        const effect = getBrandInvestmentEffect(amount);
        next = refreshPromotionEconomy({
          ...result.state,
          promotions: {
            ...result.state.promotions,
            [promotionId]: {
              ...promotion,
              fanbase: promotion.fanbase + effect.fanbaseGain,
              reputation: Math.min(100, promotion.reputation + effect.reputationGain)
            }
          }
        }, promotionId);
      }
    }
  }

  next = {
    ...next,
    currentDate: state.currentDate,
    promotionEconomies: {
      ...next.promotionEconomies,
      [promotionId]: {
        ...next.promotionEconomies[promotionId],
        scheduledBrandInvestment: brandInvestment,
        lastMonthlySettlement: monthKey
      }
    }
  };
  return next;
}

export function settlePromotionEconomiesThroughDate(state: GameState, throughDate: string): GameState {
  let next = state;
  for (const promotionId of Object.keys(state.promotions)) {
    let economy = next.promotionEconomies[promotionId];
    if (!economy) continue;
    for (const monthKey of getCrossedMonthKeys(`${economy.lastMonthlySettlement}-01`, throughDate)) {
      next = settlePromotionMonth(next, promotionId, monthKey);
      economy = next.promotionEconomies[promotionId];
    }
  }
  return next;
}

const legacyTypeFor = (category: PromotionLedgerCategory): FinanceLedgerEntry['type'] => {
  if (category === 'monthly_sponsor') return 'sponsor_monthly';
  if (category === 'monthly_media') return 'media_monthly';
  if (category === 'event_gate' || category === 'event_media') return 'event_revenue';
  if (category === 'event_sponsor') return 'sponsor_event_bonus';
  if (category === 'venue') return 'venue_cost';
  if (category === 'event_marketing') return 'marketing_cost';
  if (category === 'fighter_purse' || category === 'win_bonus' || category === 'transfer_fee') return 'contract_payment';
  return 'other';
};

function appendEntry(
  state: GameState,
  promotionId: string,
  entry: PromotionLedgerEntry
): GameState {
  const economy = state.promotionEconomies[promotionId];
  const next = {
    ...state,
    promotionEconomies: {
      ...state.promotionEconomies,
      [promotionId]: {
        ...economy,
        outstandingLiabilities: economy.outstandingLiabilities + entry.liabilityDelta,
        ledger: [...economy.ledger, entry]
      }
    }
  };
  if (promotionId !== state.playerPromotionId) return next;
  const mirrorId = `economy-mirror-${entry.id}`;
  if ((state.financeLedger ?? []).some(item => item.id === mirrorId)) return next;
  return {
    ...next,
    financeLedger: [
      ...(state.financeLedger ?? []),
      {
        id: mirrorId,
        date: entry.date,
        type: legacyTypeFor(entry.category),
        amount: entry.amount,
        description: entry.descriptionKey,
        eventId: entry.category.startsWith('event_') ? entry.sourceId : undefined,
        isSummary: false,
        affectsCash: false
      }
    ]
  };
}

function withPromotionMoney(state: GameState, promotionId: string, money: number): GameState {
  const promotion = { ...state.promotions[promotionId], money };
  return {
    ...state,
    promotions: { ...state.promotions, [promotionId]: promotion },
    promotion: promotionId === state.playerPromotionId ? promotion : state.promotion
  };
}

export function applyPromotionTransaction(
  state: GameState,
  input: PromotionTransactionInput
): PromotionEconomyMutationResult {
  const promotion = state.promotions[input.promotionId];
  const economy = state.promotionEconomies[input.promotionId];
  if (!promotion) return { ok: false, state, reason: 'promotion_missing' };
  if (!economy) return { ok: false, state, reason: 'economy_missing' };
  if (!input.id || !input.settlementKey || !Number.isSafeInteger(input.amount) || input.amount === 0) {
    return { ok: false, state, reason: 'invalid_amount' };
  }
  if (input.transactionClass === 'income' ? input.amount < 0 : input.amount > 0) {
    return { ok: false, state, reason: 'invalid_amount' };
  }
  const entryId = `economy-${input.promotionId}-${input.id}`;
  if (economy.ledger.some(entry => entry.id === entryId)) {
    return { ok: false, state, reason: 'duplicate_transaction' };
  }
  if (input.transactionClass === 'discretionary') {
    if (economy.outstandingLiabilities > 0) return { ok: false, state, reason: 'outstanding_liabilities' };
    if (economy.recoveryMode) return { ok: false, state, reason: 'recovery_mode' };
    const snapshot = getPromotionFinancialSnapshot(state, input.promotionId)!;
    const resultingMoney = promotion.money + input.amount;
    if (resultingMoney < -economy.debtLimit) return { ok: false, state, reason: 'debt_limit' };
    if (resultingMoney + economy.debtLimit < snapshot.requiredReserve + snapshot.nextMonthObligations) {
      return { ok: false, state, reason: 'required_reserve' };
    }
  }

  const requestedCost = Math.abs(Math.min(0, input.amount));
  const availableHeadroom = Math.max(0, promotion.money + economy.debtLimit);
  const paidCost = input.transactionClass === 'mandatory'
    ? Math.min(requestedCost, availableHeadroom)
    : requestedCost;
  const unpaid = input.transactionClass === 'mandatory' ? requestedCost - paidCost : 0;
  const appliedAmount = input.transactionClass === 'mandatory' ? -paidCost : input.amount;
  let next = withPromotionMoney(state, input.promotionId, promotion.money + appliedAmount);
  const entry: PromotionLedgerEntry = {
    id: entryId,
    promotionId: input.promotionId,
    date: input.date,
    settlementKey: input.settlementKey,
    category: input.category,
    amount: appliedAmount,
    balanceAfter: promotion.money + appliedAmount,
    liabilityDelta: unpaid,
    sourceId: input.sourceId,
    descriptionKey: input.descriptionKey
  };
  next = appendEntry(next, input.promotionId, entry);
  const entryIds = [entry.id];

  const latestEconomy = next.promotionEconomies[input.promotionId];
  const liabilityPayment = input.transactionClass === 'income' && input.repayLiabilities
    ? Math.min(input.amount, latestEconomy.outstandingLiabilities)
    : 0;
  if (liabilityPayment > 0) {
    const paymentId = `${entryId}-liability-payment`;
    const currentMoney = next.promotions[input.promotionId].money;
    next = withPromotionMoney(next, input.promotionId, currentMoney - liabilityPayment);
    next = appendEntry(next, input.promotionId, {
      id: paymentId,
      promotionId: input.promotionId,
      date: input.date,
      settlementKey: input.settlementKey,
      category: 'liability_payment',
      amount: -liabilityPayment,
      balanceAfter: currentMoney - liabilityPayment,
      liabilityDelta: -liabilityPayment,
      sourceId: input.sourceId,
      descriptionKey: 'economy.liabilityPayment'
    });
    entryIds.push(paymentId);
  }

  next = refreshPromotionEconomy(next, input.promotionId);
  return { ok: true, state: next, entryIds };
}

export function investInPromotionBrand(
  state: GameState,
  promotionId: string,
  amount: number
): PromotionEconomyMutationResult {
  const economy = state.promotionEconomies[promotionId];
  if (!state.promotions[promotionId]) return { ok: false, state, reason: 'promotion_missing' };
  if (!economy) return { ok: false, state, reason: 'economy_missing' };
  if (!Number.isSafeInteger(amount) || amount < 1_000) return { ok: false, state, reason: 'invalid_amount' };

  const ordinal = economy.ledger.filter(entry => entry.category === 'brand_investment').length + 1;
  const id = `brand-${promotionId}-${state.currentDate}-${ordinal}`;
  const transaction = applyPromotionTransaction(state, {
    id,
    promotionId,
    date: state.currentDate,
    settlementKey: id,
    category: 'brand_investment',
    amount: -amount,
    transactionClass: 'discretionary',
    descriptionKey: 'economy.brandInvestment'
  });
  if (!transaction.ok) return transaction;

  const promotion = transaction.state.promotions[promotionId];
  const effect = getBrandInvestmentEffect(amount);
  const updatedPromotion = {
    ...promotion,
    fanbase: promotion.fanbase + effect.fanbaseGain,
    reputation: Math.min(100, promotion.reputation + effect.reputationGain)
  };
  const candidate = refreshPromotionEconomy({
    ...transaction.state,
    promotions: { ...transaction.state.promotions, [promotionId]: updatedPromotion },
    promotion: promotionId === state.playerPromotionId ? updatedPromotion : transaction.state.promotion
  }, promotionId);
  if (validatePromotionEconomies(candidate).length) return { ok: false, state, reason: 'invalid_amount' };
  return { ok: true, state: candidate, entryIds: transaction.entryIds };
}

export function settlePromotionEvent(state: GameState, eventId: string, results: EventResults, sponsorBonus: number): GameState {
  const event = state.events[eventId];
  const promotionId = event?.promotionId ?? state.playerPromotionId;
  const economy = state.promotionEconomies[promotionId];
  if (!event || event.scope === 'international' || !economy || economy.settledEventIds.includes(eventId)) return state;
  const settlementKey = `event-${promotionId}-${eventId}`;
  let next = state;
  const apply = (suffix: string, category: PromotionLedgerCategory, amount: number, transactionClass: PromotionTransactionClass, descriptionKey: string, repayLiabilities = false) => {
    if (amount === 0) return;
    const result = applyPromotionTransaction(next, {
      id: `${eventId}-${suffix}`,
      promotionId,
      date: event.date,
      settlementKey,
      category,
      amount,
      transactionClass,
      sourceId: eventId,
      descriptionKey,
      repayLiabilities
    });
    if (result.ok) next = result.state;
  };
  apply('gate', 'event_gate', results.gateRevenue, 'income', 'economy.eventGate', true);
  apply('media', 'event_media', results.broadcastRevenue - sponsorBonus, 'income', 'economy.eventMedia', true);
  apply('sponsor', 'event_sponsor', sponsorBonus, 'income', 'economy.eventSponsor', true);
  apply('purses', 'fighter_purse', -results.fighterBasePay, 'mandatory', 'economy.fighterPurse');
  apply('win-bonuses', 'win_bonus', -results.fighterWinBonuses, 'mandatory', 'economy.winBonus');
  apply('venue', 'venue', -results.venueCost, 'mandatory', 'economy.venue');
  apply('marketing', 'event_marketing', -results.marketingCost, 'mandatory', 'economy.eventMarketing');
  return {
    ...next,
    promotionEconomies: {
      ...next.promotionEconomies,
      [promotionId]: {
        ...next.promotionEconomies[promotionId],
        settledEventIds: [...next.promotionEconomies[promotionId].settledEventIds, eventId]
      }
    }
  };
}

export function validatePromotionEconomies(state: GameState): string[] {
  const errors: string[] = [];
  for (const promotionId of Object.keys(state.promotions)) {
    const economy = state.promotionEconomies[promotionId];
    if (!economy) {
      errors.push(`missing-economy:${promotionId}`);
      continue;
    }
    if (state.promotions[promotionId].money < -economy.debtLimit) errors.push(`debt-limit-breach:${promotionId}`);
    if (economy.outstandingLiabilities < 0 || !Number.isFinite(economy.outstandingLiabilities)) errors.push(`negative-liability:${promotionId}`);
    const ids = new Set<string>();
    let balance = economy.ledgerOpeningBalance;
    for (const entry of economy.ledger) {
      if (ids.has(entry.id)) errors.push(`duplicate-ledger-id:${entry.id}`);
      ids.add(entry.id);
      if (entry.promotionId !== promotionId) errors.push(`ledger-promotion:${entry.id}`);
      balance += entry.amount;
      if (entry.balanceAfter !== balance) errors.push(`ledger-balance:${entry.id}`);
    }
    const snapshot = derivePromotionFinancialSnapshot(state, promotionId, economy.recoveryMode);
    if (economy.financialMode !== snapshot.financialMode || economy.recoveryMode !== (snapshot.financialMode === 'recovery')) {
      errors.push(`stale-mode:${promotionId}`);
    }
    if (economy.contractBudget !== snapshot.contractBudget) errors.push(`stale-budget:${promotionId}`);
  }
  for (const economyId of Object.keys(state.promotionEconomies)) {
    if (!state.promotions[economyId]) errors.push(`unknown-promotion:${economyId}`);
  }
  return errors;
}
