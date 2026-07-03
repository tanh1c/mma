import { GameState, GrandPrixTournament, TournamentParticipant, TournamentFightSlot, WeightClass, Fighter, FightMatchup, FightResult } from '../../types/game';
import { v4 as uuidv4 } from 'uuid';
import { addDays } from 'date-fns';

export function createGrandPrixTournament(
  state: GameState,
  options: {
    weightClass: WeightClass;
    name: string;
    titleShotPromised: boolean;
    participantIds?: string[];
    reserveIds?: string[];
  }
): GameState {
  const { weightClass, name, titleShotPromised, participantIds = [], reserveIds = [] } = options;
  
  if (participantIds.length !== 4) {
    throw new Error("A Grand Prix must have exactly 4 participants.");
  }
  
  const allIds = [...participantIds, ...reserveIds];
  if (new Set(allIds).size !== allIds.length) {
    throw new Error("Duplicate fighter IDs are not allowed in the tournament.");
  }
  
  const validateFighter = (id: string, role: string) => {
    const fighter = state.fighters[id];
    if (!fighter) throw new Error(`${role} fighter not found.`);
    if (fighter.weightClass !== weightClass) {
      throw new Error(`${role} fighter ${fighter.lastName} is not in the correct weight class (${weightClass}).`);
    }
    if (!fighter.contract) {
      throw new Error(`${role} fighter ${fighter.lastName} is not signed to the promotion.`);
    }
    if (fighter.injuryStatus) {
      throw new Error(`${role} fighter ${fighter.lastName} is currently injured.`);
    }
    if (fighter.medicalSuspension && fighter.medicalSuspension.daysRemaining > 0) {
      throw new Error(`${role} fighter ${fighter.lastName} is medically suspended.`);
    }
    
    const isBooked = Object.values(state.events).some(e => 
      !e.isCompleted && e.fights.some(f => f.redCornerId === id || f.blueCornerId === id)
    );
    if (isBooked) {
      throw new Error(`${role} fighter ${fighter.lastName} is already booked in an upcoming fight.`);
    }
  };
  
  participantIds.forEach(id => validateFighter(id, "Participant"));
  reserveIds.forEach(id => validateFighter(id, "Reserve"));
  
  const sortedParticipants = [...participantIds].map(id => state.fighters[id]).sort((a, b) => {
    const scoreA = a.rankingScore || 0;
    const scoreB = b.rankingScore || 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return b.popularity - a.popularity;
  });
  
  const participants: TournamentParticipant[] = sortedParticipants.map((f, index) => ({
    fighterId: f.id,
    seed: index + 1
  }));
  
  const p1 = participants[0].fighterId;
  const p2 = participants[1].fighterId;
  const p3 = participants[2].fighterId;
  const p4 = participants[3].fighterId;
  
  const semifinal1Slot: TournamentFightSlot = {
    id: uuidv4(),
    round: 'semifinal',
    redFighterId: p1,
    blueFighterId: p4,
    isCompleted: false
  };
  
  const semifinal2Slot: TournamentFightSlot = {
    id: uuidv4(),
    round: 'semifinal',
    redFighterId: p2,
    blueFighterId: p3,
    isCompleted: false
  };
  
  const finalSlot: TournamentFightSlot = {
    id: uuidv4(),
    round: 'final',
    isCompleted: false
  };
  
  const newTourney: GrandPrixTournament = {
    id: uuidv4(),
    name,
    shortName: name.includes("Lightweight") ? "Lightweight GP" :
               name.includes("Featherweight") ? "Featherweight GP" :
               name.includes("Bantamweight") ? "Bantamweight GP" :
               name.includes("Welterweight") ? "Welterweight GP" :
               name.includes("Middleweight") ? "Middleweight GP" :
               name.includes("Heavyweight") ? "Heavyweight GP" : "Grand Prix",
    weightClass,
    status: 'planned',
    createdDate: state.currentDate,
    participants,
    reserveFighterIds: reserveIds,
    fights: [semifinal1Slot, semifinal2Slot, finalSlot],
    titleShotPromised,
    prestige: 70,
    notes: [`Planned on ${state.currentDate} with seeds: 1. ${sortedParticipants[0].lastName}, 2. ${sortedParticipants[1].lastName}, 3. ${sortedParticipants[2].lastName}, 4. ${sortedParticipants[3].lastName}`]
  };
  
  const newState = {
    ...state,
    tournaments: {
      ...state.tournaments,
      [newTourney.id]: newTourney
    },
    news: [
      {
        id: uuidv4(),
        date: state.currentDate,
        type: 'general' as const,
        title: `Tournament Announced: ${name}`,
        content: `A new 4-man Grand Prix has been announced in the ${weightClass} division. Participants: ${sortedParticipants.map(f => `${f.firstName} ${f.lastName}`).join(', ')}.`
      },
      ...state.news
    ]
  };
  
  return newState;
}

export function scheduleSemifinals(state: GameState, tournamentId: string, eventId: string): GameState {
  const tourney = state.tournaments[tournamentId];
  if (!tourney) throw new Error("Tournament not found");
  if (tourney.status !== 'planned') {
    throw new Error("Semifinals can only be scheduled for a planned tournament.");
  }
  
  const event = state.events[eventId];
  if (!event || event.isCompleted) {
    throw new Error("Invalid or completed event selected.");
  }
  
  const newState = { ...state, tournaments: { ...state.tournaments }, events: { ...state.events } };
  const updatedTourney = { ...tourney, fights: [...tourney.fights], status: 'active' as const, startDate: state.currentDate };
  const updatedEvent = { ...event, fights: [...event.fights] };
  
  const semifinalSlots = updatedTourney.fights.filter(f => f.round === 'semifinal');
  
  semifinalSlots.forEach(slot => {
    if (!slot.redFighterId || !slot.blueFighterId) {
      throw new Error("Semifinal slots are missing participants.");
    }
    
    const fightId = uuidv4();
    const matchup: FightMatchup = {
      id: fightId,
      redCornerId: slot.redFighterId,
      blueCornerId: slot.blueFighterId,
      weightClass: updatedTourney.weightClass,
      isTitleFight: false,
      rounds: 3,
      tournamentId: updatedTourney.id,
      tournamentRound: 'semifinal',
      tournamentFightSlotId: slot.id
    };
    
    updatedEvent.fights.push(matchup);
    
    const slotIdx = updatedTourney.fights.findIndex(f => f.id === slot.id);
    updatedTourney.fights[slotIdx] = {
      ...slot,
      eventId: event.id,
      fightId: fightId
    };
  });
  
  updatedTourney.notes = [...(updatedTourney.notes || []), `Semifinals scheduled on Event: ${event.name} on ${state.currentDate}`];
  
  newState.tournaments[tournamentId] = updatedTourney;
  newState.events[eventId] = updatedEvent;
  
  newState.news = [
    {
      id: uuidv4(),
      date: state.currentDate,
      type: 'event' as const,
      title: `${updatedTourney.name} Semifinals Scheduled!`,
      content: `The semifinals of the ${updatedTourney.name} have been scheduled for ${event.name} on ${event.date}.`
    },
    ...newState.news
  ];
  
  return newState;
}

export function scheduleFinal(state: GameState, tournamentId: string, eventId: string): GameState {
  const tourney = state.tournaments[tournamentId];
  if (!tourney) throw new Error("Tournament not found");
  
  if (tourney.status !== 'active') {
    throw new Error("Tournament must be active to schedule the final.");
  }
  
  const semifinalSlots = tourney.fights.filter(f => f.round === 'semifinal');
  if (semifinalSlots.some(s => !s.isCompleted)) {
    throw new Error("Semifinals are not completed yet.");
  }
  
  const finalSlotIdx = tourney.fights.findIndex(f => f.round === 'final');
  const finalSlot = tourney.fights[finalSlotIdx];
  if (finalSlot.isCompleted || finalSlot.eventId) {
    throw new Error("Final is already scheduled or completed.");
  }
  
  const w1 = semifinalSlots[0].winnerId;
  const w2 = semifinalSlots[1].winnerId;
  
  if (!w1 || !w2) {
    throw new Error("Semifinal winners are missing.");
  }
  
  const event = state.events[eventId];
  if (!event || event.isCompleted) {
    throw new Error("Invalid or completed event selected.");
  }
  
  const newState = { 
    ...state, 
    tournaments: { ...state.tournaments }, 
    events: { ...state.events },
    fighters: { ...state.fighters },
    news: [...state.news]
  };
  
  const updatedTourney = { ...tourney, fights: [...tourney.fights] };
  const updatedEvent = { ...event, fights: [...event.fights] };
  
  let finalist1 = w1;
  let finalist2 = w2;
  
  let delayReason: string | null = null;
  let delayFighterId: string | null = null;
  let delayEarliestDate: string | null = null;

  const addDaysStr = (dateStr: string, days: number): string => {
    const d = addDays(new Date(dateStr), days);
    return d.toISOString().split('T')[0];
  };

  const checkReplacement = (fighterId: string, originalFighterId: string): string => {
    const fighter = newState.fighters[fighterId];
    if (!fighter) throw new Error("Fighter not found");
    
    const isInjured = fighter.injuryStatus !== null;
    const isSuspendedLong = fighter.medicalSuspension && fighter.medicalSuspension.daysRemaining > 35;
    const isSuspendedShort = fighter.medicalSuspension && fighter.medicalSuspension.daysRemaining <= 35 && fighter.medicalSuspension.daysRemaining > 0;
    const isFatigued = fighter.fatigue > 75;
    
    if (isSuspendedShort) {
      delayReason = `${fighter.lastName} is medically suspended for ${fighter.medicalSuspension?.daysRemaining} days.`;
      delayFighterId = fighter.id;
      delayEarliestDate = addDaysStr(newState.currentDate, fighter.medicalSuspension!.daysRemaining);
      return fighterId;
    }
    
    if (isInjured || isSuspendedLong || isFatigued) {
      const unusedReserveId = updatedTourney.reserveFighterIds.find(resId => {
        const reserveFighter = newState.fighters[resId];
        const hasNoContract = !reserveFighter || !reserveFighter.contract;
        const isInjured = reserveFighter?.injuryStatus;
        const isSuspended = reserveFighter?.medicalSuspension && reserveFighter.medicalSuspension.daysRemaining > 0;
        const isFatigued = reserveFighter?.fatigue > 75;
        const isBooked = Object.values(newState.events).some(e => !e.isCompleted && e.fights.some(f => f.redCornerId === resId || f.blueCornerId === resId));
        
        const reserveUnavailable = hasNoContract || isInjured || isSuspended || isFatigued || isBooked;
        return !reserveUnavailable && resId !== finalist1 && resId !== finalist2;
      });
      
      if (unusedReserveId) {
        const participantIdx = updatedTourney.participants.findIndex(p => p.fighterId === originalFighterId);
        if (participantIdx !== -1) {
          updatedTourney.participants[participantIdx] = {
            ...updatedTourney.participants[participantIdx],
            fighterId: unusedReserveId,
            replacementForFighterId: originalFighterId
          };
        }
        
        const origF = newState.fighters[originalFighterId];
        const newF = newState.fighters[unusedReserveId];
        updatedTourney.notes = [...(updatedTourney.notes || []), `Replacement: ${newF.lastName} replaced unavailable finalist ${origF.lastName} on ${state.currentDate}.`];
        
        newState.news = [
          {
            id: uuidv4(),
            date: state.currentDate,
            type: 'general' as const,
            title: `Grand Prix Replacement: ${newF.lastName} enters final!`,
            content: `Due to long-term injury/suspension, ${origF.firstName} ${origF.lastName} is unable to compete. Reserve fighter ${newF.firstName} ${newF.lastName} steps in to face the other finalist.`
          },
          ...newState.news
        ];
        
        return unusedReserveId;
      } else {
        delayReason = `${fighter.lastName} is unavailable and no reserve is available.`;
        delayFighterId = fighter.id;
        if (fighter.medicalSuspension && fighter.medicalSuspension.daysRemaining > 0) {
          delayEarliestDate = addDaysStr(newState.currentDate, fighter.medicalSuspension.daysRemaining);
        } else {
          delayEarliestDate = addDaysStr(newState.currentDate, 30);
        }
        return fighterId;
      }
    }
    return fighterId;
  };
  
  finalist1 = checkReplacement(w1, w1);
  if (!delayReason) {
    finalist2 = checkReplacement(w2, w2);
  }
  
  if (delayReason) {
    updatedTourney.finalDelayReason = delayReason;
    updatedTourney.earliestFinalDate = delayEarliestDate;
    updatedTourney.delayedFighterId = delayFighterId;
    updatedTourney.notes = [...(updatedTourney.notes || []), `Final delayed: ${delayReason}`];
    
    const isNewDelay = tourney.finalDelayReason !== delayReason || tourney.earliestFinalDate !== delayEarliestDate;
    if (isNewDelay) {
      newState.news = [
        {
          id: uuidv4(),
          date: state.currentDate,
          type: 'general' as const,
          title: `Grand Prix Final Delayed`,
          content: `The final of the ${updatedTourney.name} has been delayed. Reason: ${delayReason}. Earliest expected reschedule: ${delayEarliestDate}.`
        },
        ...newState.news
      ];
    }
    
    newState.tournaments[tournamentId] = updatedTourney;
    return newState;
  }
  
  updatedTourney.finalDelayReason = null;
  updatedTourney.earliestFinalDate = null;
  updatedTourney.delayedFighterId = null;
  
  const fightId = uuidv4();
  const matchup: FightMatchup = {
    id: fightId,
    redCornerId: finalist1,
    blueCornerId: finalist2,
    weightClass: updatedTourney.weightClass,
    isTitleFight: false,
    rounds: 5,
    tournamentId: updatedTourney.id,
    tournamentRound: 'final',
    tournamentFightSlotId: finalSlot.id
  };
  
  updatedEvent.fights.push(matchup);
  
  updatedTourney.fights[finalSlotIdx] = {
    ...finalSlot,
    redFighterId: finalist1,
    blueFighterId: finalist2,
    eventId: event.id,
    fightId: fightId
  };
  
  updatedTourney.notes = [...(updatedTourney.notes || []), `Final scheduled on Event: ${event.name} on ${state.currentDate}`];
  
  newState.tournaments[tournamentId] = updatedTourney;
  newState.events[eventId] = updatedEvent;
  
  const f1Fighter = newState.fighters[finalist1];
  const f2Fighter = newState.fighters[finalist2];
  
  newState.news = [
    {
      id: uuidv4(),
      date: state.currentDate,
      type: 'event' as const,
      title: `${updatedTourney.name} Final Match Scheduled!`,
      content: `The Grand Prix Final has been scheduled. ${f1Fighter.firstName} ${f1Fighter.lastName} will face ${f2Fighter.firstName} ${f2Fighter.lastName} at ${event.name} on ${event.date}!`
    },
    ...newState.news
  ];
  
  return newState;
}

export function cancelTournament(state: GameState, tournamentId: string): GameState {
  const tourney = state.tournaments[tournamentId];
  if (!tourney) throw new Error("Tournament not found");
  
  const hasCompletedFights = tourney.fights.some(f => f.isCompleted);
  if (hasCompletedFights) {
    throw new Error("Cannot cancel a tournament after fights have started.");
  }
  
  const newState = { ...state, tournaments: { ...state.tournaments }, events: { ...state.events } };
  
  tourney.fights.forEach(slot => {
    if (slot.eventId && slot.fightId) {
      const event = newState.events[slot.eventId];
      if (event && !event.isCompleted) {
        newState.events[slot.eventId] = {
          ...event,
          fights: event.fights.filter(f => f.id !== slot.fightId)
        };
      }
    }
  });
  
  newState.tournaments[tournamentId] = {
    ...tourney,
    status: 'cancelled',
    notes: [...(tourney.notes || []), `Tournament cancelled on ${state.currentDate}.`]
  };
  
  return newState;
}

export function maintainTournamentRosterDepth(state: GameState, weightClass: WeightClass): GameState {
  const eligible = Object.values(state.fighters).filter(f => 
    f.weightClass === weightClass &&
    f.contract &&
    !f.injuryStatus &&
    (!f.medicalSuspension || f.medicalSuspension.daysRemaining <= 0) &&
    !f.isChampion
  );
  
  let newState = { ...state, fighters: { ...state.fighters }, news: [...state.news] };
  let currentEligibleCount = eligible.length;
  
  if (currentEligibleCount < 6 && newState.promotion.money > 150000) {
    const freeAgents = Object.values(newState.fighters)
      .filter(f => !f.contract && f.weightClass === weightClass)
      .sort((a, b) => b.popularity - a.popularity || b.potential - a.potential);
      
    const needed = 6 - currentEligibleCount;
    const toSignList = freeAgents.slice(0, needed);
    
    toSignList.forEach(toSign => {
      const pay = 5000 + (toSign.popularity * 100);
      if (newState.promotion.money > pay * 4) {
        newState.fighters[toSign.id] = {
          ...toSign,
          contract: { payPerFight: pay, winBonus: pay, fightsRemaining: 4, exclusivity: true }
        };
        newState.news.unshift({
          id: uuidv4(),
          date: newState.currentDate,
          type: 'contract' as const,
          title: `Tournament Signing: ${toSign.lastName}`,
          content: `${toSign.firstName} ${toSign.lastName} has signed a 4-fight contract to bolster the ${weightClass} Grand Prix roster.`
        });
        currentEligibleCount++;
      }
    });
  }
  
  return newState;
}

export function applyTournamentProgression(
  state: GameState,
  tournamentId: string,
  slotId: string,
  winnerId: string | null,
  loserId: string | null
): GameState {
  const tourney = state.tournaments[tournamentId];
  if (!tourney) return state;
  
  const slotIdx = tourney.fights.findIndex(f => f.id === slotId);
  if (slotIdx === -1) return state;
  const slot = tourney.fights[slotIdx];
  
  if (slot.isCompleted && slot.winnerId === winnerId) {
    return state;
  }
  
  const newState = { 
    ...state, 
    tournaments: { ...state.tournaments }, 
    fighters: { ...state.fighters } 
  };
  const updatedTourney = { ...tourney, fights: [...tourney.fights] };
  
  updatedTourney.fights[slotIdx] = {
    ...slot,
    winnerId,
    loserId,
    isCompleted: true
  };
  
  if (slot.round === 'semifinal') {
    const semifinalSlots = updatedTourney.fights.filter(f => f.round === 'semifinal');
    const allSemisDone = semifinalSlots.every(s => s.isCompleted);
    
    if (allSemisDone) {
      const w1 = semifinalSlots[0].winnerId;
      const w2 = semifinalSlots[1].winnerId;
      
      const finalSlotIdx = updatedTourney.fights.findIndex(f => f.round === 'final');
      const finalSlot = updatedTourney.fights[finalSlotIdx];
      
      updatedTourney.fights[finalSlotIdx] = {
        ...finalSlot,
        redFighterId: w1 || undefined,
        blueFighterId: w2 || undefined
      };
      
      updatedTourney.semifinalCompletedDate = state.currentDate;
      const d = addDays(new Date(state.currentDate), 28);
      updatedTourney.recommendedFinalDate = d.toISOString().split('T')[0];
      
      const f1 = w1 ? newState.fighters[w1] : null;
      const f2 = w2 ? newState.fighters[w2] : null;
      const names = (f1 ? f1.lastName : 'Unknown') + ' vs ' + (f2 ? f2.lastName : 'Unknown');
      
      updatedTourney.notes = [...(updatedTourney.notes || []), `Semifinals completed. Finalists: ${names}`];
      
      newState.news = [
        {
          id: uuidv4(),
          date: state.currentDate,
          type: 'general' as const,
          title: `${updatedTourney.name} Finalists Decided!`,
          content: `The bracket is set. ${f1 ? f1.firstName + ' ' + f1.lastName : 'Unknown'} will face ${f2 ? f2.firstName + ' ' + f2.lastName : 'Unknown'} in the Grand Prix Final.`
        },
        ...newState.news
      ];
    }
  } else if (slot.round === 'final') {
    updatedTourney.status = 'completed';
    updatedTourney.winnerId = winnerId;
    updatedTourney.completedDate = state.currentDate;
    
    const champ = winnerId ? newState.fighters[winnerId] : null;
    const champName = champ ? `${champ.firstName} ${champ.lastName}` : 'Unknown';
    
    updatedTourney.notes = [...(updatedTourney.notes || []), `Grand Prix Winner: ${champName} on ${state.currentDate}`];
    
    if (champ) {
      const updatedChamp = { ...champ };
      if (updatedTourney.titleShotPromised) {
        updatedChamp.titleShotPromised = true;
      }
      
      updatedChamp.rankingScore = (updatedChamp.rankingScore || 1000) + 80;
      updatedChamp.popularity = Math.min(100, updatedChamp.popularity + 15);
      updatedChamp.momentum = Math.min(100, updatedChamp.momentum + 25);
      updatedChamp.history = [`Won Grand Prix vs ${loserId ? newState.fighters[loserId]?.lastName : 'Unknown'}`, ...updatedChamp.history].slice(0, 5);
      
      newState.fighters[champ.id] = updatedChamp;
    }
    
    if (loserId) {
      const runnerUp = newState.fighters[loserId];
      if (runnerUp) {
        const updatedRunner = { ...runnerUp };
        updatedRunner.rankingScore = (updatedRunner.rankingScore || 1000) + 30;
        updatedRunner.popularity = Math.min(100, updatedRunner.popularity + 5);
        newState.fighters[loserId] = updatedRunner;
      }
    }
    
    newState.news = [
      {
        id: uuidv4(),
        date: state.currentDate,
        type: 'general' as const,
        title: `${champName} Wins the ${updatedTourney.name}!`,
        content: `${champName} defeated ${loserId ? newState.fighters[loserId]?.lastName : 'Unknown'} in the Grand Prix final to claim the crown!${updatedTourney.titleShotPromised ? ' A future title shot is guaranteed.' : ''}`
      },
      ...newState.news
    ];
  }
  
  newState.tournaments[tournamentId] = updatedTourney;
  return newState;
}

export function runAutopilotTournaments(state: GameState): GameState {
  let newState = { ...state, tournaments: { ...state.tournaments }, events: { ...state.events }, fighters: { ...state.fighters }, news: [...state.news] };
  
  const activeTourney = Object.values(newState.tournaments).find(t => t.status === 'planned' || t.status === 'active');
  
  if (activeTourney) {
    if (activeTourney.status === 'planned') {
      const upcomingEvent = Object.values(newState.events).find(e => !e.isCompleted && e.date >= state.currentDate);
      if (upcomingEvent) {
         try {
           newState = scheduleSemifinals(newState, activeTourney.id, upcomingEvent.id);
         } catch (e) {
           // Skip if scheduling fails
         }
      }
    } else if (activeTourney.status === 'active') {
      const semifinalsDone = activeTourney.fights.filter(f => f.round === 'semifinal').every(s => s.isCompleted);
      const finalSlot = activeTourney.fights.find(f => f.round === 'final');
      if (semifinalsDone && finalSlot && !finalSlot.eventId) {
         if (activeTourney.earliestFinalDate && newState.currentDate < activeTourney.earliestFinalDate) {
            return newState;
         }
         
         const minDate = activeTourney.semifinalCompletedDate 
           ? addDays(new Date(activeTourney.semifinalCompletedDate), 21).toISOString().split('T')[0]
           : state.currentDate;

         const upcomingEvent = Object.values(newState.events).find(e => 
            !e.isCompleted && 
            e.date >= state.currentDate &&
            e.date >= minDate
         );
         
         if (upcomingEvent) {
            try {
              newState = scheduleFinal(newState, activeTourney.id, upcomingEvent.id);
            } catch (e) {
              // Delay or handle reserve replacement
            }
         }
      }
    }
    return newState;
  }
  
  if (state.promotion.reputation < 30 || state.promotion.money < 150000) {
    return newState;
  }

  const weightClasses: WeightClass[] = ['Bantamweight', 'Featherweight', 'Lightweight', 'Welterweight', 'Middleweight', 'Heavyweight'];

  // Maintain roster depth for tournament potential across all weight classes
  const signedWcsInThisTick = new Set<WeightClass>();
  weightClasses.forEach(wc => {
    const prevSignedCount = Object.values(state.fighters).filter(f => f.weightClass === wc && f.contract).length;
    newState = maintainTournamentRosterDepth(newState, wc);
    const currSignedCount = Object.values(newState.fighters).filter(f => f.weightClass === wc && f.contract).length;
    if (currSignedCount > prevSignedCount) {
      signedWcsInThisTick.add(wc);
    }
  });
  
  const completedTourneys = Object.values(newState.tournaments).filter(t => t.status === 'completed');
  if (completedTourneys.length > 0) {
    const lastCompleted = completedTourneys.sort((a, b) => new Date(b.completedDate || '').getTime() - new Date(a.completedDate || '').getTime())[0];
    if (lastCompleted && lastCompleted.completedDate) {
      const diffDays = Math.abs(new Date(newState.currentDate).getTime() - new Date(lastCompleted.completedDate).getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays < 270) {
        return newState;
      }
    }
  }
  
  if (Math.random() > 0.05) { 
    return newState;
  }
  
  const candidates = weightClasses.map(wc => {
    const title = newState.titles[wc];
    const wcFighters = Object.values(newState.fighters).filter(f => 
      f.weightClass === wc && 
      f.contract && 
      !f.injuryStatus && 
      (!f.medicalSuspension || f.medicalSuspension.daysRemaining <= 0) &&
      !f.isChampion
    );
    
    const isVacant = title ? title.status === 'vacant' : true;
    const isInactive = title ? title.status === 'inactive_champion' : false;
    
    let score = 0;
    if (isVacant) score += 50;
    if (isInactive) score += 30;
    score += wcFighters.length;
    
    return { wc, fighters: wcFighters, score };
  }).filter(c => c.fighters.length >= 6 && !signedWcsInThisTick.has(c.wc));
  
  if (candidates.length === 0) return newState;
  
  const bestCandidate = candidates.sort((a, b) => b.score - a.score)[0];
  if (!bestCandidate) return newState;
  
  const wc = bestCandidate.wc;
  const sortedFighters = bestCandidate.fighters.sort((a, b) => (b.rankingScore || 0) - (a.rankingScore || 0));
  
  const participantIds = sortedFighters.slice(0, 4).map(f => f.id);
  const reserveIds = sortedFighters.slice(4, 6).map(f => f.id);
  
  const name = `${wc} Grand Prix`;
  
  try {
    newState = createGrandPrixTournament(newState, {
      weightClass: wc,
      name,
      titleShotPromised: true,
      participantIds,
      reserveIds
    });
  } catch (e) {
    // Ignore errors
  }
  
  return newState;
}

export interface TitleShotDebt {
  fighterId: string;
  tournamentId: string;
  weightClass: WeightClass;
  dateEarned: string;
  daysPending: number;
  championId: string | null;
  status: 'pending' | 'champion_unavailable' | 'fighter_unavailable' | 'scheduled' | 'used' | 'blocked_by_unification' | 'blocked_by_interim';
}

export function getPendingTitleShotDebts(state: GameState): TitleShotDebt[] {
  const debts: TitleShotDebt[] = [];
  
  Object.values(state.tournaments || {}).forEach(t => {
    if (t.status === 'completed' && t.titleShotPromised && t.winnerId) {
      const fighter = state.fighters[t.winnerId];
      if (!fighter) return;
      
      const dateEarned = t.completedDate || t.createdDate;
      const daysPending = Math.floor(Math.abs(new Date(state.currentDate).getTime() - new Date(dateEarned).getTime()) / (1000 * 3600 * 24));
      
      const titleState = state.titles[t.weightClass];
      const championId = titleState?.undisputedChampionId || null;
      
      let status: TitleShotDebt['status'] = 'pending';
      
      if (t.titleShotUsed) {
        status = 'used';
      } else {
        // Check if scheduled
        const isScheduled = Object.values(state.events).some(e => 
          !e.isCompleted && 
          e.fights.some(f => 
            f.isTitleFight && 
            (f.redCornerId === t.winnerId || f.blueCornerId === t.winnerId)
          )
        );
        
        if (isScheduled) {
          status = 'scheduled';
        } else if (fighter.injuryStatus || (fighter.medicalSuspension && fighter.medicalSuspension.daysRemaining > 0)) {
          status = 'fighter_unavailable';
        } else if (titleState?.status === 'unification_needed') {
          status = 'blocked_by_unification';
        } else if (titleState?.status === 'inactive_champion' && titleState.interimChampionId) {
          status = 'blocked_by_interim';
        } else if (championId) {
          const champ = state.fighters[championId];
          if (champ && (champ.injuryStatus || (champ.medicalSuspension && champ.medicalSuspension.daysRemaining > 0))) {
            status = 'champion_unavailable';
          }
        }
      }
      
      debts.push({
        fighterId: t.winnerId,
        tournamentId: t.id,
        weightClass: t.weightClass,
        dateEarned,
        daysPending,
        championId,
        status
      });
    }
  });
  
  return debts;
}
