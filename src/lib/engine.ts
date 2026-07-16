import { GameState, FightMatchup, FightResult, Event, WeightClass, YearlyAwardSet, FightArchiveItem, Fighter } from '../types/game';
import { simulateFight } from './game/fightSimulator';
import { calculateEventFinancials } from './game/economy';
import { coolRivalries, generateEventNewsAndStorylines, generateWeeklyNewsAndStorylines } from './game/news';
import { applyTournamentProgression } from './game/tournament';
import { getContractStatus } from './game/contracts';
import { improveFighterTowardPotential } from './game/fighterRatings';
import { getFighterRankContext } from './game/rankings';
import { generatePostFightSocial, generateScheduledFightSocial, syncLegacyNewsToSocialFeed } from './game/social';
import { v4 as uuidv4 } from 'uuid';
import { format, addDays } from 'date-fns';
import '../i18n';
import { fixedT, formatCurrency, formatFightMethod, formatNumber, formatWeightClass, readLanguage, type Language } from './localization';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateYearlyAwardsForYear(state: GameState, year: number): YearlyAwardSet {
  const yearFights = Object.values(state.fightArchive)
    .filter(f => f.date.startsWith(year.toString()));
    
  const yearEvents = Object.values(state.eventArchive)
    .filter(e => e.date.startsWith(year.toString()));

  const awards: YearlyAwardSet = { year };
  
  if (yearFights.length === 0) return awards;

  // Best Fight
  const sortedByPerf = [...yearFights].sort((a, b) => b.performanceRating - a.performanceRating);
  awards.fightOfTheYearId = sortedByPerf[0]?.id;

  // Best KO
  const kos = yearFights.filter(f => f.method === 'KO/TKO').sort((a, b) => b.performanceRating - a.performanceRating);
  awards.koOfTheYearFightId = kos[0]?.id;

  // Best Sub
  const subs = yearFights.filter(f => f.method === 'Submission').sort((a, b) => b.performanceRating - a.performanceRating);
  awards.submissionOfTheYearFightId = subs[0]?.id;
  
  // Upset
  const upsets = yearFights.filter(f => f.winnerId && f.method !== 'Draw').sort((a, b) => {
    const winnerPop = state.fighters[a.winnerId!]?.popularity || 50;
    const loserPop = state.fighters[a.winnerId === a.redFighterId ? a.blueFighterId : a.redFighterId]?.popularity || 50;
    const aUpset = loserPop - winnerPop;
    
    const bWinnerPop = state.fighters[b.winnerId!]?.popularity || 50;
    const bLoserPop = state.fighters[b.winnerId === b.redFighterId ? b.blueFighterId : b.redFighterId]?.popularity || 50;
    const bUpset = bLoserPop - bWinnerPop;
    return bUpset - aUpset;
  });
  awards.upsetOfTheYearFightId = upsets[0]?.id;

  // Event
  if (yearEvents.length > 0) {
    const bestEvents = [...yearEvents].sort((a, b) => b.profit - a.profit + (b.fanReaction * 1000) - (a.fanReaction * 1000));
    awards.eventOfTheYearId = bestEvents[0]?.id;
  }
  
  // Fighter of the year
  const fighterWins: Record<string, number> = {};
  yearFights.forEach(f => {
    if (f.winnerId) {
      let weight = 1.0;
      
      // Title fight boost
      if (f.isTitleFight) {
        weight += 2.0;
      }
      
      // GP round boost
      if (f.tournamentRound) {
        if (f.tournamentRound === 'quarterfinal') {
          weight += 0.5;
        } else if (f.tournamentRound === 'semifinal') {
          weight += 1.0;
        } else if (f.tournamentRound === 'final') {
          const tourney = f.tournamentId ? state.tournaments?.[f.tournamentId] : null;
          const isEight = tourney ? tourney.format === 'eight_man' : false;
          // GP final wins slightly boosted (4.0 for 8-man, 2.5 for 4-man)
          weight += isEight ? 4.0 : 2.5;
        }
      }
      
      // Tentpole win boost
      const eventObj = state.events[f.eventId || ''] || state.eventArchive[f.eventId || ''];
      const isTentpole = eventObj && (eventObj.name.includes("Mega Showdown") || ('marketingSpend' in eventObj ? eventObj.marketingSpend : (eventObj as any).marketingCost || 0) >= 20000);
      if (isTentpole) {
        weight += 0.5;
      }
      
      // High performance (Fight of the Night) boost
      if (f.performanceRating && f.performanceRating > 80) {
        weight += 0.5;
      }
      
      fighterWins[f.winnerId] = (fighterWins[f.winnerId] || 0) + weight;
    }
  });
  const bestFighters = Object.keys(fighterWins).sort((a, b) => fighterWins[b] - fighterWins[a]);
  awards.fighterOfTheYearId = bestFighters[0];

  // Prospect
  const prospects = Object.values(state.fighters)
    .filter(f => f.age <= 26 && fighterWins[f.id] > 0)
    .sort((a, b) => (fighterWins[b.id] || 0) - (fighterWins[a.id] || 0));
  if (prospects.length > 0) awards.prospectOfTheYearId = prospects[0].id;

  return awards;
}

export function advanceTime(state: GameState, days: number = 7, language: Language = readLanguage()): GameState {
  const t = fixedT(language);
  const nextDate = format(addDays(new Date(state.currentDate), days), 'yyyy-MM-dd');
  const newState = { ...state, currentDate: nextDate };
  
  const oldYear = new Date(state.currentDate).getFullYear();
  const newYear = new Date(newState.currentDate).getFullYear();
  
  const oldMonth = new Date(state.currentDate).getMonth();
  const newMonth = new Date(newState.currentDate).getMonth();
  
  if (newMonth !== oldMonth) {
    // Process monthly income from deals
    let monthlyIncome = 0;
    
    if (newState.sponsorDeals) {
      newState.sponsorDeals = newState.sponsorDeals.map(deal => {
        let isNowActive = deal.isActive;
        if (isNowActive && new Date(newState.currentDate) >= new Date(deal.expiresDate)) {
            isNowActive = false;
        }
        
        if (isNowActive) {
          monthlyIncome += deal.monthlyIncome;
          if (!newState.financeLedger) newState.financeLedger = [];
          newState.financeLedger.unshift({
            id: uuidv4(),
            date: newState.currentDate,
            type: 'sponsor_monthly',
            amount: deal.monthlyIncome,
            description: t($ => $.generated.engine.monthlySponsorIncome, { name: deal.name }),
            dealId: deal.id,
            affectsCash: true,
            isSummary: false
          });
        }
        return { ...deal, isActive: isNowActive };
      });
    }
    
    if (newState.mediaDeals) {
      newState.mediaDeals = newState.mediaDeals.map(deal => {
        let isNowActive = deal.isActive;
        if (isNowActive && new Date(newState.currentDate) >= new Date(deal.expiresDate)) {
            isNowActive = false;
        }

        if (isNowActive) {
          monthlyIncome += deal.monthlyIncome;
          if (!newState.financeLedger) newState.financeLedger = [];
          newState.financeLedger.unshift({
            id: uuidv4(),
            date: newState.currentDate,
            type: 'media_monthly',
            amount: deal.monthlyIncome,
            description: t($ => $.generated.engine.monthlyMediaIncome, { name: deal.name }),
            dealId: deal.id,
            affectsCash: true,
            isSummary: false
          });
        }
        return { ...deal, isActive: isNowActive };
      });
    }
    
    if (monthlyIncome > 0) {
      newState.promotion = {
        ...newState.promotion,
        money: newState.promotion.money + monthlyIncome
      };
      // Don't flood news, just silently add money, or maybe one combined news item?
      // actually, just silently add to avoid news spam
    }
    
    // Keep ledger bounded
    if (newState.financeLedger && newState.financeLedger.length > 500) {
      newState.financeLedger = newState.financeLedger.slice(0, 500);
    }
  }

  if (newYear > oldYear) {
    if (!newState.yearlyAwards) newState.yearlyAwards = {};
    if (!newState.yearlyAwards[oldYear]) {
      newState.yearlyAwards[oldYear] = generateYearlyAwardsForYear(state, oldYear);
      newState.news.push({
        id: uuidv4(),
        date: newState.currentDate,
        title: t($ => $.generated.engine.yearlyAwardsTitle, { year: oldYear }),
        content: t($ => $.generated.engine.yearlyAwards, { year: oldYear }),
        type: 'general'
      });
      if (newState.lastAutopilotSummary && newState.lastAutopilotSummary.highlights) {
         newState.lastAutopilotSummary.highlights.awardsGenerated = true;
      }
    }
  }
  
  const newFighters = { ...state.fighters };

  // Progression, aging, healing
  Object.values(newFighters).forEach(fighter => {
    const f = { 
      ...fighter, 
      attributes: { ...fighter.attributes },
      injuryStatus: fighter.injuryStatus ? { ...fighter.injuryStatus } : null
    };

    // reduce fatigue slowly
    if (f.fatigue > 0) f.fatigue = Math.max(0, f.fatigue - Math.floor(days * 1.5));
    // update injury status
    if (f.injuryStatus) {
      f.injuryStatus.daysRemaining -= days;
      if (f.injuryStatus.daysRemaining <= 0) f.injuryStatus = null;
    } else if (f.contract && Math.random() < (0.01 * days)) {
      // Random training injury for contracted fighters
      const injuries = ['Sprained Ankle', 'Torn ACL', 'Broken Hand', 'Cut Eye', 'Concussion', 'Shoulder Injury'];
      f.injuryStatus = { id: uuidv4(), type: injuries[Math.floor(Math.random() * injuries.length)], daysRemaining: randomInt(7, 45) };
      f.morale = Math.max(0, f.morale - 15);
    }
    
    // update medical suspension
    if (f.medicalSuspension) {
      f.medicalSuspension.daysRemaining -= days;
      if (f.medicalSuspension.daysRemaining <= 0) f.medicalSuspension = null;
    }
    
    // Morale normalization over time
    if (f.morale < 50) f.morale += 1;
    if (f.morale > 50) f.morale -= 1;

    if (f.counterOffer && f.counterOffer.expiresDate < nextDate) f.counterOffer = undefined;

    if (f.contract) {
      const contractStatus = getContractStatus(f.contract, nextDate);
      if (contractStatus === 'expired') {
        if (f.isChampion) {
          const alreadyNotified = newState.news.some(item => item.type === 'contract' && item.content.includes(f.lastName) && item.date >= format(addDays(new Date(nextDate), -30), 'yyyy-MM-dd'));
          if (!alreadyNotified) {
            newState.news.unshift({
              id: uuidv4(),
              date: nextDate,
              title: t($ => $.generated.engine.championContractExpiredTitle),
              content: t($ => $.generated.engine.championContractExpired, { name: f.lastName }),
              type: 'contract'
            });
          }
        } else {
          f.contract = null;
          newState.news.unshift({
            id: uuidv4(),
            date: nextDate,
            title: t($ => $.generated.engine.contractExpiredTitle, { name: f.lastName }),
            content: t($ => $.generated.engine.freeAgent, { name: `${f.firstName} ${f.lastName}` }),
            type: 'contract'
          });
        }
      } else {
        const lastFightDays = f.lastFightDate ? Math.floor((new Date(nextDate).getTime() - new Date(f.lastFightDate).getTime()) / 86_400_000) : 90;
        if (getContractStatus(f.contract, nextDate) === 'expiring' && lastFightDays >= 90) {
          f.morale = Math.max(35, f.morale - Math.max(1, Math.floor(days / 7)));
        }
      }
    }

    // Aging mechanic
    if (Math.random() < (days / 365)) {
      f.age += 1;
      
      // Stat decline for older fighters
      if (f.age > 33) {
        f.attributes.cardio = Math.max(10, f.attributes.cardio - randomInt(1, 3));
        f.attributes.speed = Math.max(10, f.attributes.speed - randomInt(1, 3));
      }
      if (f.age > 35) {
        f.attributes.chin = Math.max(10, f.attributes.chin - randomInt(1, 3));
      }
      
      if (f.age < 28 && Math.random() > 0.3) {
        const improved = improveFighterTowardPotential(f, randomInt, Math.random);
        f.attributes = improved.attributes;
      }
    }
    
    newFighters[f.id] = f;
  });

  newState.fighters = newFighters;
  
  // Track Champion Inactivity
  const newTitles = { ...newState.titles };
  for (const wc in newTitles) {
    const prevStatus = newTitles[wc as WeightClass].status;
    newTitles[wc as WeightClass].status = deriveTitleStatus(newTitles[wc as WeightClass], newState.currentDate);
    
    // Check if inactive for > 270 days (90 days after becoming inactive)
    const titleState = newTitles[wc as WeightClass];
    if (titleState.status === 'inactive_champion' && titleState.undisputedChampionId) {
       const lastDefense = titleState.lastUndisputedDefenseDate;
       if (lastDefense) {
         const diffTime = Math.abs(new Date(newState.currentDate).getTime() - new Date(lastDefense).getTime());
         const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
         if (diffDays === 270 || (diffDays > 270 && Math.random() < 0.05)) {
           const champ = newState.fighters[titleState.undisputedChampionId];
           if (champ) {
              newState.news.push({
                id: uuidv4(),
                date: newState.currentDate,
                title: t($ => $.generated.engine.titleStalledTitle, { weightClass: formatWeightClass(wc, language) }),
                content: t($ => $.generated.engine.titleStalled, { weightClass: formatWeightClass(wc, language), name: `${champ.firstName} ${champ.lastName}` }),
                type: 'general'
              });
           }
         }
       }
    }
  }
  newState.titles = newTitles;

  return generateScheduledFightSocial(syncLegacyNewsToSocialFeed(generateWeeklyNewsAndStorylines(coolRivalries(newState, nextDate), days, language)), nextDate, language);
}

export function validateTitleFight(
  matchup: FightMatchup,
  titles: Record<string, import('../types/game').WeightClassTitleState>
): { valid: boolean; reason?: string; isVacantTitleFight?: boolean } {
  if (!matchup.isTitleFight) return { valid: true };
  
  const titleState = titles[matchup.weightClass];
  if (!titleState) return { valid: false, reason: "Invalid weight class for title." };
  
  const fightType = matchup.titleFightType || 'undisputed';
  
  if (fightType === 'unification') {
    if (!titleState.undisputedChampionId || !titleState.interimChampionId) {
      return { valid: false, reason: "Unification fight requires both undisputed and interim champions." };
    }
    const hasUndisputed = matchup.redCornerId === titleState.undisputedChampionId || matchup.blueCornerId === titleState.undisputedChampionId;
    const hasInterim = matchup.redCornerId === titleState.interimChampionId || matchup.blueCornerId === titleState.interimChampionId;
    if (!hasUndisputed || !hasInterim) {
      return { valid: false, reason: "Unification fight must be between undisputed and interim champions." };
    }
    return { valid: true };
  } else if (fightType === 'interim') {
    if (titleState.interimChampionId) {
      if (matchup.redCornerId !== titleState.interimChampionId && matchup.blueCornerId !== titleState.interimChampionId) {
         return { valid: false, reason: "Active interim title fight must include the current interim champion." };
      }
    } else {
      if (!titleState.undisputedChampionId) {
         return { valid: false, reason: "Cannot create an interim title if there is no undisputed champion." };
      }
    }
    if (matchup.redCornerId === titleState.undisputedChampionId || matchup.blueCornerId === titleState.undisputedChampionId) {
       return { valid: false, reason: "Undisputed champion cannot fight for an interim title." };
    }
    return { valid: true };
  } else {
    // Undisputed or Vacant Undisputed
    if (titleState.undisputedChampionId) {
      if (matchup.redCornerId !== titleState.undisputedChampionId && matchup.blueCornerId !== titleState.undisputedChampionId) {
         return { valid: false, reason: "Active title fight must include the current undisputed champion." };
      }
      return { valid: true, isVacantTitleFight: false };
    } else {
      return { valid: true, isVacantTitleFight: true };
    }
  }
}

export function deriveTitleStatus(
  titleState: import('../types/game').WeightClassTitleState,
  currentDate: string
): import('../types/game').BeltStatus {
  const hasUndisputed = !!titleState.undisputedChampionId;
  const hasInterim = !!titleState.interimChampionId;
  
  if (!hasUndisputed && !hasInterim) return 'vacant';
  if (hasUndisputed && hasInterim) return 'unification_needed';
  if (!hasUndisputed && hasInterim) return 'interim_active';
  
  const CHAMPION_INACTIVITY_DAYS = 180;
  const lastDefenseDate = titleState.lastUndisputedDefenseDate;
  if (lastDefenseDate) {
    const diffTime = Math.abs(new Date(currentDate).getTime() - new Date(lastDefenseDate).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays >= CHAMPION_INACTIVITY_DAYS) return 'inactive_champion';
  }
  return 'active';
}

export function simulateSingleFightPreview(state: GameState, eventId: string, fightIndex: number): FightResult | null {
  const event = state.events[eventId];
  if (!event || event.isCompleted) return null;
  const matchup = event.fights[fightIndex];
  if (!matchup || matchup.result) return null;
  const red = state.fighters[matchup.redCornerId];
  const blue = state.fighters[matchup.blueCornerId];
  if (!red || !blue) return null;
  return simulateFight(matchup, red, blue);
}

export function applyFightResult(state: GameState, eventId: string, fightIndex: number, result: FightResult, language: Language = readLanguage()): GameState {
  const t = fixedT(language);
  const event = state.events[eventId];
  if (!event || event.isCompleted) return state;
  
  const matchup = event.fights[fightIndex];
  if (!matchup || matchup.result) return state; // Already simulated

  const newState = { 
    ...state, 
    events: { ...state.events },
    fighters: { ...state.fighters },
    news: [...state.news],
    titles: { ...state.titles }
  };
  
  // Deep clone titles
  for (const wc in newState.titles) {
    newState.titles[wc as WeightClass] = { ...newState.titles[wc as WeightClass] };
  }

  const newEvent = { ...event, fights: [...event.fights] };
  const updatedMatchup = { ...matchup };
  
  const red = newState.fighters[updatedMatchup.redCornerId];
  const blue = newState.fighters[updatedMatchup.blueCornerId];
  
  if (!red || !blue) return state;

  const titleValidation = validateTitleFight(updatedMatchup, newState.titles);
  if (!titleValidation.valid) {
      const titleReason = titleValidation.reason === 'Invalid weight class for title.' ? t($ => $.generated.engine.invalidWeightClass)
        : titleValidation.reason === 'Unification fight requires both undisputed and interim champions.' ? t($ => $.generated.engine.unificationRequiresChampions)
          : titleValidation.reason === 'Unification fight must be between undisputed and interim champions.' ? t($ => $.generated.engine.unificationRequiresMatchup)
            : titleValidation.reason === 'Active interim title fight must include the current interim champion.' ? t($ => $.generated.engine.interimRequiresChampion)
              : titleValidation.reason === 'Cannot create an interim title if there is no undisputed champion.' ? t($ => $.generated.engine.interimRequiresUndisputed)
                : titleValidation.reason === 'Undisputed champion cannot fight for an interim title.' ? t($ => $.generated.engine.undisputedCannotFightInterim)
                  : t($ => $.generated.engine.activeTitleRequiresChampion);
      updatedMatchup.isTitleFight = false;
      newState.news.unshift({
          id: uuidv4(),
          date: newState.currentDate,
          title: t($ => $.generated.engine.titleFightCancelledTitle),
          content: t($ => $.generated.engine.titleFightCancelled, { red: red.lastName, blue: blue.lastName, reason: titleReason }),
          type: 'general'
      });
  }

  let redTitleShotPromised = red.titleShotPromised;
  let blueTitleShotPromised = blue.titleShotPromised;
  if (updatedMatchup.isTitleFight) {
     if (!newState.tournaments) newState.tournaments = {};

     const checkAndClearShot = (f: Fighter, fId: string) => {
        if (f.titleShotPromised) {
            const wcTourneys = Object.values(newState.tournaments)
              .filter(t => t.weightClass === f.weightClass && t.winnerId === fId && t.status === 'completed' && t.titleShotPromised && !t.titleShotUsed)
              .sort((a, b) => new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime());
            if (wcTourneys.length > 0) {
               const targetGp = wcTourneys[0];
               newState.tournaments[targetGp.id] = { ...targetGp, titleShotUsed: true };
            }
            if (fId === red.id) redTitleShotPromised = false;
            if (fId === blue.id) blueTitleShotPromised = false;
        }
     };

     checkAndClearShot(red, updatedMatchup.redCornerId);
     checkAndClearShot(blue, updatedMatchup.blueCornerId);
  }

  // Apply result to fighters
  const newRed = { ...red, titleShotPromised: redTitleShotPromised, record: { ...red.record } };
  const newBlue = { ...blue, titleShotPromised: blueTitleShotPromised, record: { ...blue.record } };

  const campFatigue = { balanced: 0, striking: 5, wrestling: 5, cardio: -5, recovery: -10 }[updatedMatchup.campFocus ?? 'balanced'];
  newRed.fatigue = Math.max(0, Math.min(100, newRed.fatigue + 50 + campFatigue));
  newBlue.fatigue = Math.max(0, Math.min(100, newBlue.fatigue + 50 + campFatigue));
  
  // contract
  if (newRed.contract) {
    newRed.contract = { ...newRed.contract, fightsRemaining: newRed.contract.fightsRemaining - 1 };
  }
  if (newBlue.contract) {
    newBlue.contract = { ...newBlue.contract, fightsRemaining: newBlue.contract.fightsRemaining - 1 };
  }
  
  if (result.winnerId === red.id) {
    newRed.record.wins++;
    newBlue.record.losses++;
    if (result.method === 'KO/TKO') newRed.record.kos++;
    if (result.method === 'Submission') newRed.record.subs++;
    
    newRed.history = [t($ => $.generated.engine.historyWin, { method: formatFightMethod(result.method, language), opponent: newBlue.lastName, round: result.round }), ...newRed.history].slice(0, 5);
    newBlue.history = [t($ => $.generated.engine.historyLoss, { method: formatFightMethod(result.method, language), opponent: newRed.lastName, round: result.round }), ...newBlue.history].slice(0, 5);
  } else if (result.winnerId === blue.id) {
    newBlue.record.wins++;
    newRed.record.losses++;
    if (result.method === 'KO/TKO') newBlue.record.kos++;
    if (result.method === 'Submission') newBlue.record.subs++;

    newBlue.history = [t($ => $.generated.engine.historyWin, { method: formatFightMethod(result.method, language), opponent: newRed.lastName, round: result.round }), ...newBlue.history].slice(0, 5);
    newRed.history = [t($ => $.generated.engine.historyLoss, { method: formatFightMethod(result.method, language), opponent: newBlue.lastName, round: result.round }), ...newRed.history].slice(0, 5);
  } else {
    newRed.record.draws++;
    newBlue.record.draws++;
    newRed.history = [t($ => $.generated.engine.historyDraw, { opponent: newBlue.lastName }), ...newRed.history].slice(0, 5);
    newBlue.history = [t($ => $.generated.engine.historyDraw, { opponent: newRed.lastName }), ...newBlue.history].slice(0, 5);
  }

  // Apply Deltas from simulation
  if (result.popularityDelta) {
    newRed.popularity = Math.max(0, Math.min(100, newRed.popularity + (result.popularityDelta[red.id] || 0)));
    newBlue.popularity = Math.max(0, Math.min(100, newBlue.popularity + (result.popularityDelta[blue.id] || 0)));
  } else {
      if (result.winnerId === red.id) { newRed.popularity += 5; newBlue.popularity -= 2; }
      else if (result.winnerId === blue.id) { newBlue.popularity += 5; newRed.popularity -= 2; }
      newRed.popularity = Math.max(0, Math.min(100, newRed.popularity));
      newBlue.popularity = Math.max(0, Math.min(100, newBlue.popularity));
  }

  if (result.moraleDelta) {
    newRed.morale = Math.max(0, Math.min(100, newRed.morale + (result.moraleDelta[red.id] || 0)));
    newBlue.morale = Math.max(0, Math.min(100, newBlue.morale + (result.moraleDelta[blue.id] || 0)));
  }

  if (result.momentumDelta) {
    newRed.momentum = Math.max(0, Math.min(100, newRed.momentum + (result.momentumDelta[red.id] || 0)));
    newBlue.momentum = Math.max(0, Math.min(100, newBlue.momentum + (result.momentumDelta[blue.id] || 0)));
  }

  if (result.injuries) {
      result.injuries.forEach(inj => {
        if (inj.fighterId === red.id) newRed.injuryStatus = { id: uuidv4(), type: inj.type, daysRemaining: inj.daysRemaining };
        if (inj.fighterId === blue.id) newBlue.injuryStatus = { id: uuidv4(), type: inj.type, daysRemaining: inj.daysRemaining };
      });
  }

  if (result.medicalSuspensions) {
      result.medicalSuspensions.forEach(susp => {
          if (susp.daysRemaining > 0 && susp.fighterId) {
             const fObj = { id: susp.id, reason: susp.reason, daysRemaining: susp.daysRemaining, sourceFightId: matchup.id || susp.sourceFightId, sourceEventId: eventId, severity: susp.severity };
             if (susp.fighterId === red.id) newRed.medicalSuspension = fObj;
             if (susp.fighterId === blue.id) newBlue.medicalSuspension = fObj;
          }
      });
  }

  if (updatedMatchup.isTitleFight && result.winnerId) {
    const winner = result.winnerId === red.id ? newRed : newBlue;
    const loser = result.winnerId === red.id ? newBlue : newRed;
    
    const titleState = newState.titles[updatedMatchup.weightClass];
    const previousChampionId = titleState.undisputedChampionId;
    const previousInterimId = titleState.interimChampionId;
    const fightType = updatedMatchup.titleFightType || (titleState.interimChampionId && titleState.undisputedChampionId ? 'unification' : 'undisputed');

    if (fightType === 'unification') {
      if (winner.id === previousChampionId) {
        // Undisputed champion unifies and defends
        titleState.undisputedDefenses++;
        titleState.lastUndisputedDefenseDate = newState.currentDate;
        titleState.interimChampionId = null;
        titleState.interimDefenses = 0;
        winner.titleDefenses = titleState.undisputedDefenses;
        loser.isChampion = false; // Former interim is no longer champion
        
        result.titleChangeInfo = { type: 'unified', previousChampionId: previousInterimId };
        
        newState.news.unshift({
          id: uuidv4(), date: newState.currentDate, type: 'fight',
          title: t($ => $.generated.engine.unifiedDefenseTitle, { winner: winner.lastName }),
          content: t($ => $.generated.engine.unifiedDefense, { winner: `${winner.firstName} ${winner.lastName}`, weightClass: formatWeightClass(updatedMatchup.weightClass, language), loser: `${loser.firstName} ${loser.lastName}` })
        });
      } else if (winner.id === previousInterimId) {
        // Interim champion unifies and becomes undisputed
        titleState.undisputedChampionId = winner.id;
        titleState.undisputedDefenses = 0;
        titleState.lastUndisputedDefenseDate = newState.currentDate;
        titleState.interimChampionId = null;
        titleState.interimDefenses = 0;
        winner.titleDefenses = 0;
        loser.isChampion = false;
        
        result.titleChangeInfo = { type: 'unified', previousChampionId };
        
        newState.news.unshift({
          id: uuidv4(), date: newState.currentDate, type: 'fight',
          title: t($ => $.generated.engine.newUndisputedTitle, { winner: winner.lastName }),
          content: t($ => $.generated.engine.newUndisputed, { winner: `${winner.firstName} ${winner.lastName}`, weightClass: formatWeightClass(updatedMatchup.weightClass, language), loser: `${loser.firstName} ${loser.lastName}` })
        });
      }
    } else if (fightType === 'interim') {
      if (winner.id === previousInterimId) {
        // Interim defense
        titleState.interimDefenses = (titleState.interimDefenses || 0) + 1;
        titleState.lastInterimDefenseDate = newState.currentDate;
        winner.titleDefenses = titleState.interimDefenses;
        result.titleChangeInfo = { type: 'interim_defense', previousChampionId: previousInterimId };
      } else {
        // New interim champion
        titleState.interimChampionId = winner.id;
        titleState.interimDefenses = 0;
        titleState.interimCreatedDate = newState.currentDate;
        titleState.lastInterimDefenseDate = newState.currentDate;
        winner.isChampion = true;
        winner.titleDefenses = 0;
        if (loser.id === previousInterimId) loser.isChampion = false;
        
        result.titleChangeInfo = { type: 'interim_won', previousChampionId: previousInterimId };
        
        newState.news.unshift({
          id: uuidv4(), date: newState.currentDate, type: 'fight',
          title: t($ => $.generated.engine.newInterimTitle, { winner: winner.lastName }),
          content: t($ => $.generated.engine.newInterim, { winner: `${winner.firstName} ${winner.lastName}`, weightClass: formatWeightClass(updatedMatchup.weightClass, language) })
        });
      }
    } else {
      // undisputed or vacant_undisputed
      if (titleState.undisputedChampionId !== winner.id) {
          result.titleChangeInfo = {
            type: previousChampionId ? 'new_champion' : 'vacant_title_won',
            previousChampionId
          };
          
          titleState.undisputedChampionId = winner.id;
          titleState.undisputedDefenses = 0;
          titleState.lastUndisputedDefenseDate = newState.currentDate;
          winner.isChampion = true;
          winner.titleDefenses = 0;
          if (loser.id === previousChampionId) loser.isChampion = false;

          newState.news.unshift({
            id: uuidv4(), date: newState.currentDate, type: 'fight',
            title: t($ => $.generated.engine.newChampionTitle, { winner: `${winner.firstName} ${winner.lastName}` }),
            content: t($ => $.generated.engine.newChampion, { winner: `${winner.firstName}${winner.nickname ? ` "${winner.nickname}"` : ''} ${winner.lastName}`, loser: `${loser.firstName} ${loser.lastName}`, weightClass: formatWeightClass(updatedMatchup.weightClass, language) })
          });
      } else {
          result.titleChangeInfo = {
            type: 'title_defense',
            previousChampionId
          };
          titleState.undisputedDefenses++;
          titleState.lastUndisputedDefenseDate = newState.currentDate;
          winner.titleDefenses = titleState.undisputedDefenses;
      }
    }
    
    // Update active status
    titleState.status = deriveTitleStatus(titleState, newState.currentDate);
  } else if (updatedMatchup.isTitleFight && !result.winnerId) {
     // Draw in a title fight
     const titleState = newState.titles[updatedMatchup.weightClass];
     const fightType = updatedMatchup.titleFightType || (titleState.interimChampionId && titleState.undisputedChampionId ? 'unification' : 'undisputed');
     
     result.titleChangeInfo = {
       type: 'no_change',
       previousChampionId: fightType === 'interim' ? titleState.interimChampionId : titleState.undisputedChampionId
     };
  }

  newRed.lastFightDate = newState.currentDate;
  newBlue.lastFightDate = newState.currentDate;
  
  const titleState = newState.titles[updatedMatchup.weightClass];
  const isRedChamp = newRed.isChampion || newRed.id === titleState?.undisputedChampionId || newRed.id === titleState?.interimChampionId;
  const isBlueChamp = newBlue.isChampion || newBlue.id === titleState?.undisputedChampionId || newBlue.id === titleState?.interimChampionId;

  if (newRed.contract && getContractStatus(newRed.contract, newState.currentDate) === 'expired') {
      if (isRedChamp) {
        newState.news.unshift({
            id: uuidv4(), date: newState.currentDate, type: 'contract',
            title: t($ => $.generated.engine.championContractExpiredTitle),
            content: t($ => $.generated.engine.championContractExpired, { name: newRed.lastName })
        });
      } else {
        newRed.contract = null;
      }
  }

  if (newBlue.contract && getContractStatus(newBlue.contract, newState.currentDate) === 'expired') {
      if (isBlueChamp) {
        newState.news.unshift({
            id: uuidv4(), date: newState.currentDate, type: 'contract',
            title: t($ => $.generated.engine.championContractExpiredTitle),
            content: t($ => $.generated.engine.championContractExpired, { name: newBlue.lastName })
        });
      } else {
        newBlue.contract = null;
      }
  }

  newState.fighters[red.id] = newRed;
  newState.fighters[blue.id] = newBlue;

  updatedMatchup.result = result;
  newEvent.fights[fightIndex] = updatedMatchup;
  newState.events[eventId] = newEvent;

  let finalState = syncChampionFlags(newState);
  if (updatedMatchup.tournamentId && updatedMatchup.tournamentFightSlotId) {
    const loserId = result.winnerId ? (result.winnerId === red.id ? blue.id : red.id) : null;
    finalState = applyTournamentProgression(finalState, updatedMatchup.tournamentId, updatedMatchup.tournamentFightSlotId, result.winnerId, loserId, language);
  }

  return finalState;
}

export function finalizeEventFinancials(state: GameState, eventId: string, language: Language = readLanguage()): GameState {
  const t = fixedT(language);
  const event = state.events[eventId];
  if (!event || event.isCompleted) return state;

  // Guard: Ensure all fights have results
  if (event.fights.some(f => !f.result)) {
    console.warn(`Cannot finalize event ${eventId}: Not all fights have results.`);
    return state;
  }

  const newState = { 
    ...state, 
    events: { ...state.events },
    promotion: { ...state.promotion },
    news: [...state.news]
  };

  const newEvent = { ...event };
  const venue = newState.venues[newEvent.venueId];
  
  let titleChanges: { 
    fighterId: string; 
    weightClass: WeightClass;
    type: 'new_champion' | 'title_defense' | 'vacant_title_won' | 'interim_won' | 'interim_defense' | 'unified' | 'no_change';
    previousChampionId?: string | null;
  }[] = [];
  
  newEvent.fights.forEach(f => {
    if (f.isTitleFight && f.result && f.result.titleChangeInfo) {
       titleChanges.push({ 
         fighterId: f.result.winnerId || '', 
         weightClass: f.weightClass,
         type: f.result.titleChangeInfo.type,
         previousChampionId: f.result.titleChangeInfo.previousChampionId
       });
    }
  });

  const { results, reputationChange } = calculateEventFinancials(
    newEvent.fights,
    newState.fighters,
    venue,
    newEvent.ticketPrice,
    newEvent.marketingSpend,
    newState.promotion,
    newState.storylines,
    newState.titles,
    newState.tournaments
  );

  let gpFinalBonus = 0;
  const gpFinalMatch = newEvent.fights.find(f => (f as any).tournamentId && (f as any).tournamentRound === 'final');
  const hasEightManFinal = gpFinalMatch ? (newState.tournaments?.[(gpFinalMatch as any).tournamentId]?.format === 'eight_man') : false;

  if (gpFinalMatch && results.fanReaction > 75) {
    gpFinalBonus = hasEightManFinal ? 50000 : 25000;
  }

  results.broadcastRevenue += gpFinalBonus;
  results.totalRevenue += gpFinalBonus;
  results.profit += gpFinalBonus;

  // Calculate deal bonuses
  let dealBonusRevenue = 0;
  const numTitleFights = newEvent.fights.filter(f => f.isTitleFight).length;
  
  if (newState.sponsorDeals) {
    newState.sponsorDeals.forEach(deal => {
      if (deal.isActive) {
        if (deal.bonusPerEvent) dealBonusRevenue += deal.bonusPerEvent;
        if (deal.bonusPerTitleFight && numTitleFights > 0) {
          dealBonusRevenue += (deal.bonusPerTitleFight * numTitleFights);
        }
      }
    });
  }
  
  if (newState.mediaDeals) {
    newState.mediaDeals.forEach(deal => {
      if (deal.isActive) {
        if (deal.bonusPerEvent) dealBonusRevenue += deal.bonusPerEvent;
        if (deal.bonusForHighRatedEvent && results.fanReaction > 75) {
          dealBonusRevenue += deal.bonusForHighRatedEvent;
        }
      }
    });
  }

  let extraCommercialBonus = 0;
  if (hasEightManFinal) {
    extraCommercialBonus = 15000;
  }
  dealBonusRevenue += extraCommercialBonus;

  // Inject deal bonuses into results
  results.broadcastRevenue += dealBonusRevenue;
  results.totalRevenue += dealBonusRevenue;
  results.profit += dealBonusRevenue;
  
  if (!newState.financeLedger) newState.financeLedger = [];
  
  newState.financeLedger.unshift({
     id: uuidv4(),
     date: newState.currentDate,
     type: 'event_revenue',
     amount: results.gateRevenue + results.broadcastRevenue - dealBonusRevenue - gpFinalBonus,
     description: t($ => $.generated.engine.gateBroadcast, { event: newEvent.name }),
     eventId: newEvent.id,
     affectsCash: true,
     isSummary: false
  });

  if (dealBonusRevenue > 0) {
     const desc = extraCommercialBonus > 0
       ? t($ => $.generated.engine.dealBonusesBoost, { event: newEvent.name })
       : t($ => $.generated.engine.dealBonuses, { event: newEvent.name });
     newState.financeLedger.unshift({
        id: uuidv4(),
        date: newState.currentDate,
        type: 'sponsor_event_bonus', // generic label for this
        amount: dealBonusRevenue,
        description: desc,
        eventId: newEvent.id,
        affectsCash: true,
        isSummary: false
     });
  }

  if (gpFinalBonus > 0) {
     newState.financeLedger.unshift({
        id: uuidv4(),
        date: newState.currentDate,
        type: 'sponsor_event_bonus',
        amount: gpFinalBonus,
        description: hasEightManFinal
          ? t($ => $.generated.engine.eightManCommercialBonus, { event: newEvent.name })
          : t($ => $.generated.engine.fourManCommercialBonus, { event: newEvent.name }),
        eventId: newEvent.id,
        affectsCash: true,
        isSummary: false
     });
  }
  
  newState.financeLedger.unshift({
     id: uuidv4(),
     date: newState.currentDate,
     type: 'venue_cost',
     amount: -results.venueCost,
     description: t($ => $.generated.engine.venueRental, { venue: venue.name }),
     eventId: newEvent.id,
     affectsCash: true,
     isSummary: false
  });
  
  newState.financeLedger.unshift({
     id: uuidv4(),
     date: newState.currentDate,
     type: 'marketing_cost',
     amount: -results.marketingCost,
     description: t($ => $.generated.engine.marketing, { event: newEvent.name }),
     eventId: newEvent.id,
     affectsCash: true,
     isSummary: false
  });
  
  newState.financeLedger.unshift({
     id: uuidv4(),
     date: newState.currentDate,
     type: 'contract_payment',
     amount: -(results.fighterBasePay + results.fighterWinBonuses),
     description: t($ => $.generated.engine.fighterPurses, { event: newEvent.name }),
     eventId: newEvent.id,
     affectsCash: true,
     isSummary: false
  });

  newState.financeLedger.unshift({
     id: uuidv4(),
     date: newState.currentDate,
     type: results.profit >= 0 ? 'event_profit' : 'event_cost',
     amount: results.profit,
     description: t($ => $.generated.engine.netEvent, { event: newEvent.name }),
     eventId: newEvent.id,
     affectsCash: false,
     isSummary: true
  });

  newEvent.results = { ...results, titleChanges };
  newEvent.isCompleted = true;
  newState.events[eventId] = newEvent;
  
  let fanbaseChange = 0;
  if (results.fanReaction >= 60) fanbaseChange = Math.floor(results.attendance * 0.05);
  else if (results.fanReaction < 40) fanbaseChange = -Math.floor(newState.promotion.fanbase * 0.02);

  newState.promotion = {
    ...newState.promotion,
    money: newState.promotion.money + results.profit,
    reputation: Math.max(0, Math.min(100, newState.promotion.reputation + reputationChange)),
    fanbase: Math.max(1000, newState.promotion.fanbase + fanbaseChange)
  };
  
  newState.news.unshift({
    id: uuidv4(),
    date: newState.currentDate,
    title: t($ => $.generated.engine.eventCompletedTitle, { event: newEvent.name }),
    content: t($ => $.generated.engine.eventCompleted, { attendance: formatNumber(results.attendance, language), revenue: formatCurrency(results.totalRevenue, language), reaction: Math.round(results.fanReaction) }),
    type: 'event'
  });

  // Archive event
  const eventArchiveItem: import('../types/game').EventArchiveItem = {
    id: newEvent.id,
    name: newEvent.name,
    date: newEvent.date,
    attendance: results.attendance,
    revenue: results.totalRevenue,
    cost: results.totalCost,
    profit: results.profit,
    fanReaction: results.fanReaction,
    fightIds: newEvent.fights.map(f => `archive_${newEvent.id}_${f.redCornerId}_${f.blueCornerId}`),
    gateRevenue: results.gateRevenue,
    broadcastRevenue: results.broadcastRevenue,
    venueCost: results.venueCost,
    marketingCost: results.marketingCost,
    fighterBasePay: results.fighterBasePay,
    fighterWinBonuses: results.fighterWinBonuses,
    gpBonusRevenue: gpFinalBonus
  };
  
  newState.eventArchive = { ...newState.eventArchive, [eventArchiveItem.id]: eventArchiveItem };
  newState.fightArchive = { ...newState.fightArchive };
  newState.titleHistory = [...(newState.titleHistory || [])];

  // Archive fights and titles
  newEvent.fights.forEach(f => {
    const fightArchiveId = `archive_${newEvent.id}_${f.redCornerId}_${f.blueCornerId}`;
    if (f.result) {
      newState.fightArchive[fightArchiveId] = {
        id: fightArchiveId,
        date: newEvent.date,
        eventId: newEvent.id,
        eventName: newEvent.name,
        weightClass: f.weightClass,
        redFighterId: f.redCornerId,
        blueFighterId: f.blueCornerId,
        winnerId: f.result.winnerId,
        method: f.result.method,
        round: f.result.round,
        time: f.result.time,
        isTitleFight: f.isTitleFight,
        titleFightType: f.titleFightType,
        tournamentId: f.tournamentId,
        tournamentRound: f.tournamentRound,
        performanceRating: f.result.performanceRating || 50,
        scorecards: f.result.scorecards,
        roundStats: f.result.roundStats,
        commentary: f.result.commentary,
        injuries: f.result.injuries,
        medicalSuspensions: f.result.medicalSuspensions,
        titleChangeInfo: f.result.titleChangeInfo,
        redRecordAfter: `${newState.fighters[f.redCornerId]?.record.wins || 0}-${newState.fighters[f.redCornerId]?.record.losses || 0}-${newState.fighters[f.redCornerId]?.record.draws || 0}`,
        blueRecordAfter: `${newState.fighters[f.blueCornerId]?.record.wins || 0}-${newState.fighters[f.blueCornerId]?.record.losses || 0}-${newState.fighters[f.blueCornerId]?.record.draws || 0}`,
        redRankAtFight: getFighterRankContext(state, f.redCornerId)?.label,
        blueRankAtFight: getFighterRankContext(state, f.blueCornerId)?.label
      };

      if (f.tournamentId && f.tournamentFightSlotId && newState.tournaments?.[f.tournamentId]) {
        const tourney = newState.tournaments[f.tournamentId];
        const updatedFights = tourney.fights.map(slot => {
          if (slot.id === f.tournamentFightSlotId) {
            return { ...slot, fightArchiveId };
          }
          return slot;
        });
        newState.tournaments[f.tournamentId] = {
          ...tourney,
          fights: updatedFights
        };
      }

      if (f.isTitleFight && f.result.titleChangeInfo) {
        const tci = f.result.titleChangeInfo;
        
        if (tci.type === 'new_champion' || tci.type === 'vacant_title_won' || tci.type === 'interim_won' || tci.type === 'unified') {
          // Update previous champion's dateLost immutably
          if (tci.previousChampionId) {
            newState.titleHistory = newState.titleHistory.map(th => {
              if (th.weightClass === f.weightClass && 
                  th.fighterId === tci.previousChampionId &&
                  th.status === 'active') {
                
                const isCleared = tci.type === 'unified' && th.beltType === 'interim';
                return {
                  ...th,
                  status: isCleared ? 'cleared' : 'lost',
                  dateLost: newEvent.date,
                  lostToFighterId: f.result?.winnerId || null,
                  lossEventId: newEvent.id,
                  note: isCleared ? t($ => $.generated.engine.clearedByUnification) : th.note
                };
              }
              return th;
            });
          }
          
          if (f.result.winnerId && tci.type !== 'unified') {
            const isInterim = tci.type === 'interim_won';
            newState.titleHistory = [...newState.titleHistory, {
              id: uuidv4(),
              weightClass: f.weightClass,
              fighterId: f.result.winnerId,
              dateWon: newEvent.date,
              dateLost: null,
              defenses: 0,
              wonFromFighterId: tci.previousChampionId || null,
              status: 'active',
              beltType: isInterim ? 'interim' : 'undisputed',
              winEventId: newEvent.id
            }];
          } else if (f.result.winnerId && tci.type === 'unified') {
            const hasUndisputedReign = newState.titleHistory.some(th => th.weightClass === f.weightClass && th.fighterId === f.result!.winnerId && th.status === 'active' && th.beltType !== 'interim');
            
            if (!hasUndisputedReign) {
              // Case B: Interim beats Undisputed
              newState.titleHistory = newState.titleHistory.map(th => {
                if (th.weightClass === f.weightClass && th.fighterId === f.result!.winnerId && th.status === 'active' && th.beltType === 'interim') {
                  return { ...th, status: 'unified', dateLost: newEvent.date, note: t($ => $.generated.engine.unifiedIntoUndisputed) };
                }
                return th;
              });
              
              newState.titleHistory = [...newState.titleHistory, {
                id: uuidv4(),
                weightClass: f.weightClass,
                fighterId: f.result.winnerId,
                dateWon: newEvent.date,
                dateLost: null,
                defenses: 0,
                wonFromFighterId: tci.previousChampionId || null,
                status: 'active',
                beltType: 'undisputed',
                winEventId: newEvent.id
              }];
            } else {
              // Case A: Undisputed beats Interim (defense)
              newState.titleHistory = newState.titleHistory.map(th => {
                if (th.weightClass === f.weightClass && th.fighterId === f.result!.winnerId && th.status === 'active' && th.beltType !== 'interim') {
                  return { ...th, defenses: th.defenses + 1 };
                }
                return th;
              });
            }
          }
        } else if ((tci.type === 'title_defense' || tci.type === 'interim_defense') && f.result.winnerId) {
          newState.titleHistory = newState.titleHistory.map(th => {
            if (th.weightClass === f.weightClass && 
                th.fighterId === f.result?.winnerId &&
                th.status === 'active') {
              return { ...th, defenses: th.defenses + 1 };
            }
            return th;
          });
        }
      }
    }
  });

  return generatePostFightSocial(syncLegacyNewsToSocialFeed(generateEventNewsAndStorylines(newState, eventId, language)), eventId, language);
}

export function quickSimulateEvent(state: GameState, eventId: string, language: Language = readLanguage()): GameState {
  let tempState = { ...state };
  const event = tempState.events[eventId];
  if (!event || event.isCompleted) return tempState;

  for (let i = event.fights.length - 1; i >= 0; i--) {
    const preview = simulateSingleFightPreview(tempState, eventId, i);
    if (preview) {
      tempState = applyFightResult(tempState, eventId, i, preview, language);
    }
  }

  return finalizeEventFinancials(tempState, eventId, language);
}

export function syncChampionFlags(state: GameState): GameState {
  const newFighters = { ...state.fighters };
  const newTitles = { ...state.titles };
  let newTitleHistory = [...(state.titleHistory || [])];
  
  // Clear all flags first
  Object.values(newFighters).forEach(f => {
    if (f.isChampion) {
       newFighters[f.id] = { ...f, isChampion: false, titleDefenses: 0 };
    }
  });

  // Re-apply flags based on truth state
  for (const wc in newTitles) {
    let titleState = newTitles[wc as WeightClass];
    let vacatedSomething = false;
    
    if (titleState && titleState.undisputedChampionId) {
      const champId = titleState.undisputedChampionId;
      const champ = newFighters[champId];
      // If champion is missing or not signed to promotion, vacate title
      if (!champ || !champ.contract) {
        titleState = { ...titleState, undisputedChampionId: null, undisputedDefenses: 0 };
        vacatedSomething = true;
        // Update history
        newTitleHistory = newTitleHistory.map(th => {
          if (th.fighterId === champId && th.weightClass === wc && th.status === 'active' && th.beltType !== 'interim') {
             return { ...th, status: 'vacated', dateLost: state.currentDate, lostToFighterId: null };
          }
          return th;
        });
      } else {
        newFighters[champId] = { 
          ...champ, 
          isChampion: true, 
          titleDefenses: titleState.undisputedDefenses 
        };
      }
    }
    
    if (titleState && titleState.interimChampionId) {
      const champId = titleState.interimChampionId;
      const champ = newFighters[champId];
      if (!champ || !champ.contract) {
        titleState = { ...titleState, interimChampionId: null, interimDefenses: 0 };
        vacatedSomething = true;
        // Update history
        newTitleHistory = newTitleHistory.map(th => {
          if (th.fighterId === champId && th.weightClass === wc && th.status === 'active' && th.beltType === 'interim') {
             return { ...th, status: 'vacated', dateLost: state.currentDate, lostToFighterId: null };
          }
          return th;
        });
      } else {
        newFighters[champId] = { 
          ...champ, 
          isChampion: true,
          titleDefenses: titleState.interimDefenses || 0
        };
      }
    }
    
    if (vacatedSomething) {
      titleState.status = deriveTitleStatus(titleState, state.currentDate);
    }
    newTitles[wc as WeightClass] = titleState;
  }
  
  return { ...state, fighters: newFighters, titles: newTitles, titleHistory: newTitleHistory };
}
