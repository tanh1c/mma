import { GameState, Storyline } from '../../types/game';
import { addDays, differenceInCalendarDays } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import '../../i18n';
import { fixedT, formatCurrency, readLanguage, type Language } from '../localization';

export const RIVALRY_MAX_INTENSITY = 3;
export const RIVALRY_COOLDOWN_DAYS = 90;
export const RIVALRY_EXPIRY_DAYS = 180;

export function getPairKey(fighterIds: string[]): string {
  return [...fighterIds].sort().join(':');
}

function isActiveRivalry(storyline: Storyline, currentDate: string): boolean {
  return storyline.type === 'Rivalry' && storyline.isActive && (storyline.intensity ?? 1) > 0 && (!storyline.expiresDate || storyline.expiresDate >= currentDate);
}

export function updateRivalryAfterFight(state: GameState, fighterIds: [string, string], currentDate: string, qualifies: boolean, isRematch: boolean, language: Language = readLanguage()): GameState {
  const t = fixedT(language);
  const pairKey = getPairKey(fighterIds);
  const existingIndex = state.storylines.findIndex(storyline => storyline.type === 'Rivalry' && getPairKey(storyline.fighterIds) === pairKey);
  if (!qualifies && existingIndex < 0) return state;

  const storylines = [...state.storylines];
  const existing = existingIndex >= 0 ? storylines[existingIndex] : undefined;
  if (existing && isActiveRivalry(existing, currentDate) && qualifies && isRematch) {
    storylines[existingIndex] = { ...existing, isActive: false, intensity: 0, resolvedDate: currentDate };
    return { ...state, storylines };
  }
  if (!qualifies) return state;

  const intensity = Math.min(RIVALRY_MAX_INTENSITY, (existing?.intensity ?? 0) + 1);
  const names = fighterIds.map(id => state.fighters[id]?.lastName).filter(Boolean).join(' vs ');
  const rivalry: Storyline = {
    id: existing?.id ?? uuidv4(),
    type: 'Rivalry',
    fighterIds: [...fighterIds].sort(),
    description: t($ => $.generated.news.rivalryDescription, { names }),
    isActive: true,
    intensity,
    createdDate: existing?.createdDate ?? currentDate,
    expiresDate: addDays(new Date(currentDate), RIVALRY_EXPIRY_DAYS).toISOString().slice(0, 10),
    resolvedDate: undefined
  };
  if (existingIndex >= 0) storylines[existingIndex] = rivalry;
  else storylines.push(rivalry);
  return { ...state, storylines };
}

export function coolRivalries(state: GameState, currentDate: string): GameState {
  const storylines = state.storylines.map(storyline => {
    if (storyline.type !== 'Rivalry' || !storyline.isActive) return storyline;
    if (storyline.expiresDate && storyline.expiresDate < currentDate) return { ...storyline, isActive: false, intensity: 0 };
    if (!isActiveRivalry(storyline, currentDate)) return storyline;
    if (differenceInCalendarDays(new Date(currentDate), new Date(storyline.createdDate ?? currentDate)) < RIVALRY_COOLDOWN_DAYS) return storyline;
    const intensity = Math.max(0, (storyline.intensity ?? 1) - 1);
    return { ...storyline, intensity, isActive: intensity > 0, createdDate: currentDate };
  });
  return { ...state, storylines };
}

export function generateEventNewsAndStorylines(state: GameState, eventId: string, language: Language = readLanguage()): GameState {
  const t = fixedT(language);
  const event = state.events[eventId];
  if (!event || !event.isCompleted || !event.results) return state;

  const newState = { ...state, news: [...state.news], storylines: [...state.storylines], fighters: { ...state.fighters } };
  const date = state.currentDate;

  // Event success or failure
  if (event.results.profit > event.results.totalCost * 0.5) {
    newState.news.unshift({
      id: uuidv4(),
      date,
      title: t($ => $.generated.news.massiveSuccessTitle),
      content: t($ => $.generated.news.massiveSuccess, { event: event.name, profit: formatCurrency(event.results.profit, language) }),
      type: 'event'
    });
  } else if (event.results.profit < 0) {
    newState.news.unshift({
      id: uuidv4(),
      date,
      title: t($ => $.generated.news.financialDisappointmentTitle),
      content: t($ => $.generated.news.financialDisappointment, { event: event.name, loss: formatCurrency(Math.abs(event.results.profit), language) }),
      type: 'event'
    });
  }

  if (event.results.fanReaction < 30) {
    newState.news.unshift({
      id: uuidv4(),
      date,
      title: t($ => $.generated.news.fansDisappointedTitle),
      content: t($ => $.generated.news.fansDisappointed, { event: event.name }),
      type: 'general'
    });
    // Fan backlash storyline
    newState.storylines.push({
      id: uuidv4(),
      type: 'Fan Backlash',
      fighterIds: [],
      description: t($ => $.generated.news.fanBacklash, { event: event.name }),
      isActive: true
    });
  }

  // Fight specific news
  for (const fight of event.fights) {
    if (!fight.result) continue;
    const res = fight.result;
    
    const r = newState.fighters[fight.redCornerId];
    const b = newState.fighters[fight.blueCornerId];
    
    if (!r || !b) continue;

    const winnerId = res.winnerId;
    const loserId = res.loserId;
    const winner = winnerId === r.id ? r : winnerId === b.id ? b : null;
    const loser = loserId === r.id ? r : loserId === b.id ? b : null;

    if (winner && loser) {
      // Upset check (assuming red is usually favorite, or based on ranking)
      // Actually we can check rankingScore
      const wScore = winner.rankingScore || 1000;
      const lScore = loser.rankingScore || 1000;

      if (lScore - wScore > 100) {
        newState.news.unshift({
          id: uuidv4(),
          date,
          title: t($ => $.generated.news.hugeUpsetTitle),
          content: t($ => $.generated.news.hugeUpset, { winner: `${winner.firstName} ${winner.lastName}`, loser: `${loser.firstName} ${loser.lastName}` }),
          type: 'fight'
        });
        
        if (!newState.storylines.some(s => s.type === 'Upset Run' && s.fighterIds.includes(winner.id))) {
          newState.storylines.push({
            id: uuidv4(),
            type: 'Upset Run',
            fighterIds: [winner.id],
            description: t($ => $.generated.news.upsetRun, { name: winner.lastName }),
            isActive: true
          });
        }
      }

      // Controversial decision
      if (res.method === 'Split Decision' && res.performanceRating > 70) {
        newState.news.unshift({
          id: uuidv4(),
          date,
          title: t($ => $.generated.news.controversialDecisionTitle, { winner: winner.lastName, loser: loser.lastName }),
          content: t($ => $.generated.news.controversialDecision, { winner: winner.lastName, loser: loser.lastName }),
          type: 'fight'
        });

        // Rematch demand
        newState.storylines.push({
          id: uuidv4(),
          type: 'Rematch Demand',
          fighterIds: [winner.id, loser.id],
          description: t($ => $.generated.news.rematchDemand, { winner: winner.lastName, loser: loser.lastName }),
          isActive: true
        });
      }

      // Prospect hype
      if (winner.age <= 25 && winner.record.wins > 3 && winner.record.losses === 0) {
         if (!newState.storylines.some(s => s.type === 'Prospect Hype' && s.fighterIds.includes(winner.id))) {
           newState.news.unshift({
             id: uuidv4(),
             date,
             title: t($ => $.generated.news.prospectWatchTitle, { name: winner.lastName }),
             content: t($ => $.generated.news.prospectWatch, { name: `${winner.firstName} ${winner.lastName}` }),
             type: 'general'
           });
           newState.storylines.push({
             id: uuidv4(),
             type: 'Prospect Hype',
             fighterIds: [winner.id],
             description: t($ => $.generated.news.prospectHype, { name: winner.lastName }),
             isActive: true
           });
           winner.popularity = Math.min(100, winner.popularity + 5);
           winner.marketability = Math.min(100, winner.marketability + 5);
         }
      }

      // Champion dominance
      if (fight.isTitleFight && winner.isChampion && res.method !== 'Split Decision' && res.method !== 'Majority Decision' && res.method !== 'Draw') {
        const titleWins = winner.record.wins; // Need a better tracker for title defenses later, for now just use wins
        if (!newState.storylines.some(s => s.type === 'Champion Dominance' && s.fighterIds.includes(winner.id))) {
          newState.news.unshift({
            id: uuidv4(),
            date,
            title: t($ => $.generated.news.dominantChampionTitle),
            content: t($ => $.generated.news.dominantChampion, { name: `${winner.firstName} ${winner.lastName}` }),
            type: 'general'
          });
          newState.storylines.push({
            id: uuidv4(),
            type: 'Champion Dominance',
            fighterIds: [winner.id],
            description: t($ => $.generated.news.championDominance, { name: winner.lastName }),
            isActive: true
          });
          winner.popularity = Math.min(100, winner.popularity + 8);
        }
      }

      const pairKey = getPairKey([winner.id, loser.id]);
      const activeRivalry = newState.storylines.find(storyline => storyline.type === 'Rivalry' && storyline.isActive && getPairKey(storyline.fighterIds) === pairKey);
      const qualifiesForRivalry = res.performanceRating > 85 && (res.method === 'KO/TKO' || res.method.includes('Decision'));
      const isRematch = Object.values(newState.fightArchive).some(archived => archived.eventId !== eventId && getPairKey([archived.redFighterId, archived.blueFighterId]) === pairKey);
      const nextState = updateRivalryAfterFight(newState, [winner.id, loser.id], date, qualifiesForRivalry, isRematch, language);
      if (nextState !== newState && !activeRivalry && qualifiesForRivalry) {
        nextState.news.unshift({
          id: uuidv4(),
          date,
          title: t($ => $.generated.news.fierceRivalryTitle, { winner: winner.lastName, loser: loser.lastName }),
          content: t($ => $.generated.news.fierceRivalry, { winner: winner.lastName, loser: loser.lastName }),
          type: 'general'
        });
      }
      newState.storylines = nextState.storylines;
      newState.news = nextState.news;
    }
  }

  // Cleanup old storylines
  if (newState.storylines.length > 15) {
    newState.storylines = newState.storylines.slice(newState.storylines.length - 15);
  }
  
  newState.news = newState.news.slice(0, 50);

  return newState;
}

export function generateWeeklyNewsAndStorylines(state: GameState, days: number, language: Language = readLanguage()): GameState {
  const t = fixedT(language);
  const newState = { ...state, news: [...state.news], storylines: [...state.storylines], fighters: { ...state.fighters } };
  const date = state.currentDate;

  // Check for contract disputes, inactivity, injuries
  Object.values(newState.fighters).forEach(fighter => {
    if (fighter.contract) {
      let f = { ...fighter };
      let changed = false;

      // Contract dispute
      if (f.morale < 30 && Math.random() < (0.005 * days)) {
        if (!newState.storylines.some(s => s.type === 'Contract Dispute' && s.fighterIds.includes(f.id))) {
          newState.news.unshift({
            id: uuidv4(),
            date,
            title: t($ => $.generated.news.contractDisputeTitle, { name: f.lastName }),
            content: t($ => $.generated.news.contractDispute, { name: `${f.firstName} ${f.lastName}` }),
            type: 'contract'
          });
          newState.storylines.push({
            id: uuidv4(),
            type: 'Contract Dispute',
            fighterIds: [f.id],
            description: t($ => $.generated.news.contractDisputeDescription, { name: f.lastName }),
            isActive: true
          });
          f.morale -= 10;
          changed = true;
        }
      }

      // Inactivity complaints
      if (f.lastFightDate) {
        const daysSinceFight = Math.floor((new Date(date).getTime() - new Date(f.lastFightDate).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceFight > 180 && !f.injuryStatus && Math.random() < (0.01 * days)) {
          newState.news.unshift({
            id: uuidv4(),
            date,
            title: t($ => $.generated.news.inactivityTitle, { name: f.lastName }),
            content: t($ => $.generated.news.inactivity, { name: `${f.firstName} ${f.lastName}` }),
            type: 'general'
          });
          f.morale -= 5;
          changed = true;
        }
      }
      
      if (changed) {
        newState.fighters[f.id] = f;
      }
    }
  });

  newState.news = newState.news.slice(0, 50);
  return newState;
}
