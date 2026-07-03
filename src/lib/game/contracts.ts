import { Fighter, Promotion } from '../../types/game';

export interface ContractExpectation {
  basePay: number;
  winBonus: number;
  fights: number;
  interest: number; // 0-100
  interestLabel: string;
}

export function getContractExpectation(fighter: Fighter, promotion: Promotion): ContractExpectation {
  const isStar = fighter.popularity >= 80;
  const isProspect = fighter.potential > 80 && fighter.popularity < 50;
  const isVeteran = fighter.age > 33;
  
  // Base value based on popularity and record
  let baseValue = (fighter.popularity * 200) + (fighter.record.wins * 200);
  if (isStar) baseValue *= 1.5;
  if (isProspect) baseValue *= 0.8;
  if (isVeteran) baseValue *= 1.1;

  // Floor
  baseValue = Math.max(2000, baseValue);
  
  // Round to nearest 1000
  const askingPay = Math.round(baseValue / 1000) * 1000;
  const askingBonus = askingPay;
  
  let fights = 3;
  if (isProspect) fights = 4;
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

export function evaluateOffer(fighter: Fighter, promotion: Promotion, offerPay: number, offerBonus: number, offerFights: number): { accepted: boolean; reason: string } {
  const expectation = getContractExpectation(fighter, promotion);
  
  // If interest is very low, they might reject regardless unless overpaid massively
  if (expectation.interest < 20) {
    if (offerPay < expectation.basePay * 2) {
      return { accepted: false, reason: "I'm not interested in fighting for a promotion of your caliber right now." };
    }
  }

  // Calculate total offer value compared to expected value
  const expectedTotal = expectation.basePay + expectation.winBonus;
  const offerTotal = offerPay + offerBonus;
  
  const valueRatio = offerTotal / expectedTotal;
  
  if (valueRatio >= 1.0) {
    return { accepted: true, reason: 'Offer accepted. Let\'s make some money.' };
  } else if (valueRatio >= 0.8 && expectation.interest > 70) {
    return { accepted: true, reason: 'It\'s a bit low, but I want to fight here. Accepted.' };
  } else {
    return { accepted: false, reason: 'The financial terms are not acceptable to me right now.' };
  }
}
