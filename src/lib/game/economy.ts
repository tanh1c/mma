import { Fighter, FightMatchup, Venue, Promotion, EventResults, FightResult, Storyline } from '../../types/game';

export interface EventProjections {
  eventHype: number;
  mainEventStrength: number;
  coMainStrength: number;
  cardDepth: number;
  expectedAttendance: number;
  expectedGate: number;
  broadcastRevenue: number;
  estimatedCost: number;
  expectedProfit: number;
  fanExpectation: number;
  warnings: string[];
}

export function calculateEventProjections(
  fights: Omit<FightMatchup, 'id' | 'result'>[],
  fighters: Record<string, Fighter>,
  venue: Venue,
  ticketPrice: number,
  marketingSpend: number,
  promotion: Promotion,
  storylines: Storyline[] = [],
  titles?: Record<string, import('../../types/game').WeightClassTitleState>
): EventProjections {
  const warnings: string[] = [];
  
  if (fights.length === 0) {
    return {
      eventHype: 0,
      mainEventStrength: 0,
      coMainStrength: 0,
      cardDepth: 0,
      expectedAttendance: 0,
      expectedGate: 0,
      broadcastRevenue: 0,
      estimatedCost: venue.cost + marketingSpend,
      expectedProfit: -(venue.cost + marketingSpend),
      fanExpectation: 0,
      warnings: ["No fights booked on the card."]
    };
  }

  // Calculate base costs and expected win bonuses
  let totalFighterPay = 0;
  let expectedWinBonuses = 0;
  fights.forEach(f => {
    const r = fighters[f.redCornerId];
    const b = fighters[f.blueCornerId];
    totalFighterPay += (r?.contract?.payPerFight || 0) + (b?.contract?.payPerFight || 0);
    expectedWinBonuses += ((r?.contract?.winBonus || 0) + (b?.contract?.winBonus || 0)) / 2;
  });
  
  const estimatedCost = venue.cost + marketingSpend + totalFighterPay + expectedWinBonuses;

  // Strength calculations
  const mainEvent = fights[0];
  const rMain = fighters[mainEvent.redCornerId];
  const bMain = fighters[mainEvent.blueCornerId];
  
  const mainEventStrength = rMain && bMain ? ((rMain.popularity + bMain.popularity) / 2) : 0;
  
  let coMainStrength = 0;
  if (fights.length > 1) {
    const coMain = fights[1];
    const rCo = fighters[coMain.redCornerId];
    const bCo = fighters[coMain.blueCornerId];
    if (rCo && bCo) {
      coMainStrength = ((rCo.popularity + bCo.popularity) / 2);
    }
  }

  // Calculate Depth
  let cardDepthSum = 0;
  if (fights.length > 2) {
    for (let i = 2; i < fights.length; i++) {
      const f = fights[i];
      const r = fighters[f.redCornerId];
      const b = fighters[f.blueCornerId];
      if (r && b) {
        cardDepthSum += ((r.popularity + b.popularity) / 2);
      }
    }
  }
  
  const cardDepth = fights.length > 2 ? cardDepthSum / (fights.length - 2) : 0;

  // Hype calculation
  let eventHype = (mainEventStrength * 0.6) + (coMainStrength * 0.25) + (cardDepth * 0.15);
  
  // Marketing boost
  const marketingBoost = Math.min(20, marketingSpend / 5000); // Max +20 hype for 100k spend
  eventHype += marketingBoost;
  
  if (mainEvent.isTitleFight) eventHype += 5;
  if (fights.length > 1 && fights[1].isTitleFight) eventHype += 2;
  // Tournament GP Hype Boosts
  let hasSemis = false;
  let hasFinal = false;
  fights.forEach(f => {
    if ('tournamentId' in f && (f as any).tournamentId) {
      if ((f as any).tournamentRound === 'semifinal') {
        eventHype += 4;
        hasSemis = true;
      } else if ((f as any).tournamentRound === 'final') {
        eventHype += 12;
        hasFinal = true;
      }
    }
  });

  if (hasFinal) {
    warnings.push("Grand Prix final boosted fan interest");
  } else if (hasSemis) {
    warnings.push("Grand Prix semifinal card");
  }
  // Storyline effects
  fights.forEach(f => {
    const relevantStorylines = storylines.filter(s => 
      s.isActive && (s.fighterIds.includes(f.redCornerId) || s.fighterIds.includes(f.blueCornerId))
    );
    relevantStorylines.forEach(s => {
      if (s.type === 'Rivalry' && s.fighterIds.includes(f.redCornerId) && s.fighterIds.includes(f.blueCornerId)) {
        eventHype += 8; // big boost for direct rivalry
      } else if (s.type === 'Rematch Demand' && s.fighterIds.includes(f.redCornerId) && s.fighterIds.includes(f.blueCornerId)) {
        eventHype += 5;
      } else if (s.type === 'Prospect Hype' || s.type === 'Upset Run' || s.type === 'Champion Dominance') {
        eventHype += 2;
      }
    });
  });

  if (storylines.some(s => s.isActive && s.type === 'Fan Backlash')) {
     eventHype -= 10;
     warnings.push("Fan backlash from a previous event is hurting current hype.");
  }

  eventHype = Math.min(100, Math.max(0, eventHype));

  // Fan Expectation
  const fanExpectation = Math.min(100, (promotion.reputation + ticketPrice / 2));

  // Projected Attendance
  const baseDraw = (eventHype / 100) * promotion.fanbase * 10; 
  // Add some local draw based on venue size and hype
  const localDraw = (eventHype / 100) * venue.capacity * 0.8;
  
  // Price sensitivity
  const priceSensitivity = Math.max(0, 1 - (ticketPrice / 200)); 
  
  let expectedAttendance = Math.floor((baseDraw + localDraw) * priceSensitivity);
  expectedAttendance = Math.min(expectedAttendance, venue.capacity);

  const expectedGate = expectedAttendance * ticketPrice;

  // Broadcast / Media revenue projection
  let baseBroadcast = (promotion.reputation * 150) + (eventHype * 250);
  const repMultiplier = 1 + (Math.max(0, promotion.reputation - 40) / 20); // up to ~4.0
  const venueMultiplier = Math.max(0.5, venue.capacity / 5000);
  
  const broadcastRevenue = Math.floor(baseBroadcast * repMultiplier * venueMultiplier);

  const expectedProfit = expectedGate + broadcastRevenue - estimatedCost;

  // Warnings
  if (fights.length < 3) warnings.push("Card is very short. Fans expect more fights.");
  if (mainEventStrength < 50) warnings.push("Weak main event. Consider booking bigger stars.");
  if (fights.length > 1 && coMainStrength < 40) warnings.push("Weak co-main event.");
  if (estimatedCost > promotion.money) warnings.push("Event cost exceeds current funds! Risk of debt.");
  if (expectedAttendance < venue.capacity * 0.3) warnings.push("Venue might be too large for this card. Consider a smaller venue.");
  if (ticketPrice > 150 && eventHype < 70) warnings.push("Ticket price is very high for the current card hype.");
  if (marketingSpend > expectedGate * 0.5 && expectedGate > 0) warnings.push("Marketing spend is excessively high compared to expected revenue.");

  fights.forEach(f => {
    const r = fighters[f.redCornerId];
    const b = fighters[f.blueCornerId];
    if (r && b) {
      if (f.isTitleFight) {
         if (titles && titles[f.weightClass]) {
            const currentChampId = titles[f.weightClass].undisputedChampionId || titles[f.weightClass].interimChampionId;
            if (currentChampId) {
               if (r.id !== titles[f.weightClass].undisputedChampionId && b.id !== titles[f.weightClass].undisputedChampionId && r.id !== titles[f.weightClass].interimChampionId && b.id !== titles[f.weightClass].interimChampionId) {
                  warnings.push(`Warning: ${f.weightClass} has an active champion, but this title fight does not involve them. This fight will be treated as non-title unless fixed.`);
               }
            } else {
               warnings.push(`Vacant title fight for the ${f.weightClass} Championship.`);
            }
         } else if (!r.isChampion && !b.isChampion) {
            warnings.push(`Title fight booked in ${f.weightClass} but neither fighter is the reigning champion. (Vacant title fight)`);
         }
      }
      if (f.isTitleFight && (r.isChampion || b.isChampion)) {
         const champ = r.isChampion ? r : b;
         if (champ.weightClass !== f.weightClass) {
            warnings.push(`Champion ${champ.lastName} is fighting for a title outside their normal weight class.`);
         }
      }
      if (r.injuryStatus || b.injuryStatus) {
         const injName = r.injuryStatus ? r.lastName : b.lastName;
         warnings.push(`${injName} is currently injured. Booking them risks poor performance and worse injuries.`);
      }
      if (r.fatigue > 40 || b.fatigue > 40) {
         const tiredName = r.fatigue > 40 ? r.lastName : b.lastName;
         warnings.push(`${tiredName} has high fatigue from a recent fight. Performance will suffer.`);
      }
    }
  });

  // Check for GP Promised Title Shot not being honored
  fights.forEach(fight => {
    const checkFighter = (fId: string) => {
      const f = fighters[fId];
      if (f && f.titleShotPromised && !fight.isTitleFight) {
         const titleState = titles?.[f.weightClass];
         if (titleState && titleState.undisputedChampionId) {
            const champ = fighters[titleState.undisputedChampionId];
            if (champ && !champ.injuryStatus && (!champ.medicalSuspension || champ.medicalSuspension.daysRemaining <= 0)) {
               const isChampBooked = fights.some(otherFight => otherFight.redCornerId === champ.id || otherFight.blueCornerId === champ.id);
               if (!isChampBooked) {
                  warnings.push(`Promised title shot not being honored for ${f.lastName}.`);
               }
            }
         }
      }
    };
    checkFighter(fight.redCornerId);
    checkFighter(fight.blueCornerId);
  });

  return {
    eventHype,
    mainEventStrength,
    coMainStrength,
    cardDepth,
    expectedAttendance,
    expectedGate,
    broadcastRevenue,
    estimatedCost,
    expectedProfit,
    fanExpectation,
    warnings
  };
}

export function calculateEventFinancials(
  fights: FightMatchup[],
  fighters: Record<string, Fighter>,
  venue: Venue,
  ticketPrice: number,
  marketingSpend: number,
  promotion: Promotion,
  storylines: Storyline[] = [],
  titles?: Record<string, import('../../types/game').WeightClassTitleState>
): { results: EventResults, reputationChange: number } {
  // First, get the projections as a baseline
  const proj = calculateEventProjections(
    fights,
    fighters,
    venue,
    ticketPrice,
    marketingSpend,
    promotion,
    storylines,
    titles
  );

  // Random variance for actual attendance
  const variance = 0.9 + (Math.random() * 0.2); // 0.9x to 1.1x
  let actualAttendance = Math.floor(proj.expectedAttendance * variance);
  actualAttendance = Math.min(actualAttendance, venue.capacity);
  
  const gateRevenue = actualAttendance * ticketPrice;
  const broadcastRevenue = Math.floor(proj.broadcastRevenue * (0.95 + Math.random() * 0.1));

  let fighterBasePay = 0;
  let fighterWinBonuses = 0;
  let totalAction = 0;

  fights.forEach(m => {
    const r = fighters[m.redCornerId];
    const b = fighters[m.blueCornerId];
    if (r?.contract) {
      fighterBasePay += r.contract.payPerFight;
      if (m.result?.winnerId === r.id) fighterWinBonuses += r.contract.winBonus;
    }
    if (b?.contract) {
      fighterBasePay += b.contract.payPerFight;
      if (m.result?.winnerId === b.id) fighterWinBonuses += b.contract.winBonus;
    }
    
    if (m.result) {
       totalAction += m.result.performanceRating;
    }
  });

  const avgAction = fights.length > 0 ? totalAction / fights.length : 0;
  
  const totalRevenue = gateRevenue + broadcastRevenue;
  const totalCost = venue.cost + marketingSpend + fighterBasePay + fighterWinBonuses;
  const profit = totalRevenue - totalCost;

  // Fan Reaction depends on event hype vs actual action
  let fanReaction = avgAction;
  if (avgAction > proj.fanExpectation) fanReaction += 10;
  else if (avgAction < proj.fanExpectation) fanReaction -= 10;
  fanReaction = Math.max(0, Math.min(100, fanReaction));

  // Reputation change
  let reputationChange = 0;
  if (fanReaction > 80) reputationChange += 2;
  else if (fanReaction > 60) reputationChange += 1;
  else if (fanReaction < 40) reputationChange -= 1;
  else if (fanReaction < 20) reputationChange -= 2;

  // If we had a great attendance, small boost, but apply conditions
  if (actualAttendance > venue.capacity * 0.9) {
    if (venue.capacity > 1000) {
      reputationChange += 1;
    } else {
      // Sold-out local venue only adds reputation if fan reaction and hype are good
      if (fanReaction > 70 && proj.eventHype > 50) {
        reputationChange += 1;
      }
    }
  }
  
  // Caps for small cards or weak local events
  if (reputationChange > 0) {
    if (fights.length < 4) {
      reputationChange = Math.min(reputationChange, 1);
    }
    if (venue.capacity <= 1000 && proj.eventHype < 70) {
      reputationChange = Math.min(reputationChange, 1);
    }
  }

  return {
    results: {
      attendance: actualAttendance,
      gateRevenue,
      broadcastRevenue,
      fighterBasePay,
      fighterWinBonuses,
      venueCost: venue.cost,
      marketingCost: marketingSpend,
      totalRevenue,
      totalCost,
      profit,
      fanReaction
    },
    reputationChange
  };
}
