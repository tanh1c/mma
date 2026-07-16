import { addDays, differenceInCalendarDays } from 'date-fns';
import '../../i18n';
import { Contract, ContractCounterOffer, Fighter, Promotion } from '../../types/game';
import { fixedT, readLanguage, type Language } from '../localization';
import { getFighterOverall, isProspect } from './fighterRatings';

export const CONTRACT_DAYS_PER_FIGHT = 180;
export const CONTRACT_MIN_DAYS = 180;
export const CONTRACT_MAX_DAYS = 1080;
export const CONTRACT_EXPIRING_DAYS = 30;
export const COUNTER_OFFER_DAYS = 14;

export function getContractEndDate(currentDate: string, fights: number): string {
  const days = Math.min(CONTRACT_MAX_DAYS, Math.max(CONTRACT_MIN_DAYS, fights * CONTRACT_DAYS_PER_FIGHT));
  return addDays(new Date(currentDate), days).toISOString().slice(0, 10);
}

export type ContractStatus = 'active' | 'expiring' | 'expired';

export function getContractStatus(contract: Contract, currentDate: string): ContractStatus {
  if (contract.fightsRemaining <= 0 || contract.endDate < currentDate) return 'expired';
  const daysRemaining = differenceInCalendarDays(new Date(contract.endDate), new Date(currentDate));
  return contract.fightsRemaining <= 1 || daysRemaining <= CONTRACT_EXPIRING_DAYS ? 'expiring' : 'active';
}

export function createCounterOffer(basePay: number, winBonus: number, fights: number, interest: number, currentDate: string): ContractCounterOffer {
  return {
    payPerFight: Math.round(basePay * 1.05 / 1000) * 1000,
    winBonus: Math.round(winBonus * 1.05 / 1000) * 1000,
    fights,
    expiresDate: addDays(new Date(currentDate), COUNTER_OFFER_DAYS).toISOString().slice(0, 10),
    interest
  };
}

export interface ContractExpectation {
  basePay: number;
  winBonus: number;
  fights: number;
  interest: number; // 0-100
  interestLabel: string;
}

export function getContractExpectation(fighter: Fighter, promotion: Promotion): ContractExpectation {
  const isStar = fighter.popularity >= 80;
  const prospect = isProspect(fighter);
  const isVeteran = fighter.age > 33;
  
  // Base value based on popularity and record
  const overall = getFighterOverall(fighter);
  const developmentRoom = Math.max(0, fighter.potential - overall);
  let baseValue = (fighter.popularity * 200) + (fighter.record.wins * 200) + Math.max(0, overall - 50) * 75;
  if (prospect) baseValue += developmentRoom * 50;
  if (isStar) baseValue *= 1.5;
  if (prospect) baseValue *= 0.8;
  if (isVeteran) baseValue *= 1.1;

  // Floor
  baseValue = Math.max(2000, baseValue);
  
  // Round to nearest 1000
  const askingPay = Math.round(baseValue / 1000) * 1000;
  const askingBonus = askingPay;
  
  let fights = 3;
  if (prospect) fights = 4;
  if (isVeteran) fights = 2;
  if (isStar) fights = 5;

  // Interest based on promotion reputation vs fighter popularity
  // High pop fighter + low rep promo = low interest
  let interest = 50 + (promotion.reputation - fighter.popularity);
  interest += (fighter.morale - 50) * 0.5;
  interest = Math.max(0, Math.min(100, interest));

  let interestLabel = 'Moderate';
  if (interest > 80) interestLabel = 'Very High';
  else if (interest > 60) interestLabel = 'High';
  else if (interest < 20) interestLabel = 'Very Low';
  else if (interest < 40) interestLabel = 'Low';

  return {
    basePay: askingPay,
    winBonus: askingBonus,
    fights,
    interest,
    interestLabel
  };
}

export type OfferEvaluation = { accepted: true; reason: string } | { accepted: false; reason: string; counterOffer?: ContractCounterOffer };

export function evaluateOffer(fighter: Fighter, promotion: Promotion, offerPay: number, offerBonus: number, offerFights: number, currentDate: string, language: Language = readLanguage()): OfferEvaluation {
  const t = fixedT(language);
  const expectation = getContractExpectation(fighter, promotion);

  if (expectation.interest < 20 && offerPay < expectation.basePay * 2) {
    return { accepted: false, reason: t($ => $.generated.contracts.notInterested) };
  }

  const expectedTotal = expectation.basePay + expectation.winBonus;
  const valueRatio = (offerPay + offerBonus) / expectedTotal;

  if (valueRatio >= 1.0) {
    return { accepted: true, reason: t($ => $.generated.contracts.accepted) };
  }
  if (valueRatio >= 0.8 && expectation.interest > 70) {
    return { accepted: true, reason: t($ => $.generated.contracts.acceptedLow) };
  }

  const credible = valueRatio >= 0.8 || (expectation.interest >= 60 && valueRatio >= 0.7);
  return {
    accepted: false,
    reason: credible ? t($ => $.generated.contracts.counterOffer) : t($ => $.generated.contracts.rejected),
    ...(credible ? { counterOffer: createCounterOffer(expectation.basePay, expectation.winBonus, offerFights, expectation.interest, currentDate) } : {})
  };
}
