import { GameState, Event, FightMatchup, FightResult, Fighter, NewsItem, Storyline } from '../../types/game';
import { v4 as uuidv4 } from 'uuid';

export function generateEventNewsAndStorylines(state: GameState, eventId: string): GameState {
  const event = state.events[eventId];
  if (!event || !event.isCompleted || !event.results) return state;

  const newState = { ...state, news: [...state.news], storylines: [...state.storylines], fighters: { ...state.fighters } };
  const date = state.currentDate;

  // Event success or failure
  if (event.results.profit > event.results.totalCost * 0.5) {
    newState.news.unshift({
      id: uuidv4(),
      date,
      title: 'Massive Success!',
      content: `${event.name} was a huge financial success, bringing in $${event.results.profit.toLocaleString()} in profit.`,
      type: 'event'
    });
  } else if (event.results.profit < 0) {
    newState.news.unshift({
      id: uuidv4(),
      date,
      title: 'Financial Disappointment',
      content: `${event.name} failed to turn a profit, losing $${Math.abs(event.results.profit).toLocaleString()}.`,
      type: 'event'
    });
  }

  if (event.results.fanReaction < 30) {
    newState.news.unshift({
      id: uuidv4(),
      date,
      title: 'Fans Disappointed with Card',
      content: `Fans heavily criticized ${event.name} for lackluster fights.`,
      type: 'general'
    });
    // Fan backlash storyline
    newState.storylines.push({
      id: uuidv4(),
      type: 'Fan Backlash',
      fighterIds: [],
      description: `The promotion is facing fan backlash after the disappointing ${event.name}.`,
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
          title: `Huge Upset!`,
          content: `${winner.firstName} ${winner.lastName} shocked the world by defeating the highly favored ${loser.firstName} ${loser.lastName}.`,
          type: 'fight'
        });
        
        if (!newState.storylines.some(s => s.type === 'Upset Run' && s.fighterIds.includes(winner.id))) {
          newState.storylines.push({
            id: uuidv4(),
            type: 'Upset Run',
            fighterIds: [winner.id],
            description: `${winner.lastName} is on a Cinderella run after a massive upset.`,
            isActive: true
          });
        }
      }

      // Controversial decision
      if (res.method === 'Split Decision' && res.performanceRating > 70) {
        newState.news.unshift({
          id: uuidv4(),
          date,
          title: `Controversial Decision in ${winner.lastName} vs ${loser.lastName}`,
          content: `Fans are debating the split decision victory for ${winner.lastName}. Many felt ${loser.lastName} won.`,
          type: 'fight'
        });

        // Rematch demand
        newState.storylines.push({
          id: uuidv4(),
          type: 'Rematch Demand',
          fighterIds: [winner.id, loser.id],
          description: `Fans are demanding a rematch between ${winner.lastName} and ${loser.lastName} after their controversial bout.`,
          isActive: true
        });
      }

      // Prospect hype
      if (winner.age <= 25 && winner.record.wins > 3 && winner.record.losses === 0) {
         if (!newState.storylines.some(s => s.type === 'Prospect Hype' && s.fighterIds.includes(winner.id))) {
           newState.news.unshift({
             id: uuidv4(),
             date,
             title: `Prospect Watch: ${winner.lastName}`,
             content: `Undefeated prospect ${winner.firstName} ${winner.lastName} continues to impress and build momentum.`,
             type: 'general'
           });
           newState.storylines.push({
             id: uuidv4(),
             type: 'Prospect Hype',
             fighterIds: [winner.id],
             description: `${winner.lastName} is one of the hottest prospects in the sport right now.`,
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
            title: `Dominant Champion`,
            content: `${winner.firstName} ${winner.lastName} looked untouchable in their latest title defense.`,
            type: 'general'
          });
          newState.storylines.push({
            id: uuidv4(),
            type: 'Champion Dominance',
            fighterIds: [winner.id],
            description: `${winner.lastName} is looking unbeatable as champion.`,
            isActive: true
          });
          winner.popularity = Math.min(100, winner.popularity + 8);
        }
      }

      // Rivalry intensified
      if (res.performanceRating > 85 && (res.method === 'KO/TKO' || res.method.includes('Decision'))) {
        if (Math.random() < 0.3) {
          if (!newState.storylines.some(s => s.type === 'Rivalry' && s.fighterIds.includes(winner.id) && s.fighterIds.includes(loser.id))) {
             newState.news.unshift({
               id: uuidv4(),
               date,
               title: `Fierce Rivalry: ${winner.lastName} vs ${loser.lastName}`,
               content: `The war between ${winner.lastName} and ${loser.lastName} has sparked a massive rivalry.`,
               type: 'general'
             });
             newState.storylines.push({
               id: uuidv4(),
               type: 'Rivalry',
               fighterIds: [winner.id, loser.id],
               description: `A bitter rivalry exists between ${winner.lastName} and ${loser.lastName}.`,
               isActive: true
             });
          }
        }
      }
    }
  }

  // Cleanup old storylines
  if (newState.storylines.length > 15) {
    newState.storylines = newState.storylines.slice(newState.storylines.length - 15);
  }
  
  newState.news = newState.news.slice(0, 50);

  return newState;
}

export function generateWeeklyNewsAndStorylines(state: GameState, days: number): GameState {
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
            title: `Contract Dispute: ${f.lastName}`,
            content: `${f.firstName} ${f.lastName} is unhappy with their current contract and demanding better pay.`,
            type: 'contract'
          });
          newState.storylines.push({
            id: uuidv4(),
            type: 'Contract Dispute',
            fighterIds: [f.id],
            description: `${f.lastName} is in a contract dispute with the promotion.`,
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
            title: `${f.lastName} Frustrated by Inactivity`,
            content: `${f.firstName} ${f.lastName} has publicly complained about not getting a fight booked.`,
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
