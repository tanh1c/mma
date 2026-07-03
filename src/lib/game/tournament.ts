import { GameState, GrandPrixTournament, TournamentParticipant, TournamentFightSlot, WeightClass, Fighter, FightMatchup, FightResult, TournamentFormat, TournamentRound } from '../../types/game';
import { v4 as uuidv4 } from 'uuid';
import { addDays } from 'date-fns';

export function createGrandPrixTournament(
  state: GameState,
  options: {
    weightClass: WeightClass;
    name: string;
    titleShotPromised: boolean;
    format?: TournamentFormat;
    participantIds?: string[];
    reserveIds?: string[];
  }
): GameState {
  const { weightClass, name, titleShotPromised, format = 'four_man', participantIds = [], reserveIds = [] } = options;
  
  if (format === 'four_man') {
    if (participantIds.length !== 4) {
      throw new Error("A 4-Man Grand Prix must have exactly 4 participants.");
    }
    if (reserveIds.length > 2) {
      throw new Error("A 4-Man Grand Prix cannot have more than 2 reserves.");
    }
  } else {
    if (participantIds.length !== 8) {
      throw new Error("An 8-Man Grand Prix must have exactly 8 participants.");
    }
    if (reserveIds.length > 3) {
      throw new Error("An 8-Man Grand Prix cannot have more than 3 reserves.");
    }
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
    
    const popA = a.popularity || 0;
    const popB = b.popularity || 0;
    if (popB !== popA) return popB - popA;
    
    const potA = a.potential || 0;
    const potB = b.potential || 0;
    return potB - potA;
  });
  
  const participants: TournamentParticipant[] = sortedParticipants.map((f, index) => ({
    fighterId: f.id,
    seed: index + 1
  }));
  
  let fights: TournamentFightSlot[] = [];
  if (format === 'four_man') {
    const semifinal1Slot: TournamentFightSlot = {
      id: uuidv4(),
      round: 'semifinal',
      redFighterId: participants[0].fighterId,
      blueFighterId: participants[3].fighterId,
      isCompleted: false
    };
    const semifinal2Slot: TournamentFightSlot = {
      id: uuidv4(),
      round: 'semifinal',
      redFighterId: participants[1].fighterId,
      blueFighterId: participants[2].fighterId,
      isCompleted: false
    };
    const finalSlot: TournamentFightSlot = {
      id: uuidv4(),
      round: 'final',
      isCompleted: false
    };
    fights = [semifinal1Slot, semifinal2Slot, finalSlot];
  } else {
    const qf1Slot: TournamentFightSlot = {
      id: uuidv4(),
      round: 'quarterfinal',
      redFighterId: participants[0].fighterId,
      blueFighterId: participants[7].fighterId,
      isCompleted: false
    };
    const qf2Slot: TournamentFightSlot = {
      id: uuidv4(),
      round: 'quarterfinal',
      redFighterId: participants[3].fighterId,
      blueFighterId: participants[4].fighterId,
      isCompleted: false
    };
    const qf3Slot: TournamentFightSlot = {
      id: uuidv4(),
      round: 'quarterfinal',
      redFighterId: participants[1].fighterId,
      blueFighterId: participants[6].fighterId,
      isCompleted: false
    };
    const qf4Slot: TournamentFightSlot = {
      id: uuidv4(),
      round: 'quarterfinal',
      redFighterId: participants[2].fighterId,
      blueFighterId: participants[5].fighterId,
      isCompleted: false
    };
    const semifinal1Slot: TournamentFightSlot = {
      id: uuidv4(),
      round: 'semifinal',
      isCompleted: false
    };
    const semifinal2Slot: TournamentFightSlot = {
      id: uuidv4(),
      round: 'semifinal',
      isCompleted: false
    };
    const finalSlot: TournamentFightSlot = {
      id: uuidv4(),
      round: 'final',
      isCompleted: false
    };
    fights = [qf1Slot, qf2Slot, qf3Slot, qf4Slot, semifinal1Slot, semifinal2Slot, finalSlot];
  }
  
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
    format,
    createdDate: state.currentDate,
    participants,
    reserveFighterIds: reserveIds,
    fights,
    titleShotPromised,
    prestige: format === 'eight_man' ? 85 : 70,
    notes: [`Planned on ${state.currentDate} with format: ${format}. Seeds: ${sortedParticipants.map((f, idx) => `${idx + 1}. ${f.lastName}`).join(', ')}`]
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

export function scheduleTournamentRound(
  state: GameState,
  tournamentId: string,
  round: 'quarterfinal' | 'semifinal' | 'final',
  eventId: string
): GameState {
  const tourney = state.tournaments[tournamentId];
  if (!tourney) throw new Error("Tournament not found");
  
  const event = state.events[eventId];
  if (!event || event.isCompleted) {
    throw new Error("Invalid or completed event selected.");
  }

  // Spacing and validation checks
  if (round === 'quarterfinal') {
    if (tourney.status !== 'planned') {
      throw new Error("Quarterfinals can only be scheduled for a planned tournament.");
    }
  } else if (round === 'semifinal') {
    if (tourney.format === 'eight_man') {
      const qfSlots = tourney.fights.filter(f => f.round === 'quarterfinal');
      if (qfSlots.some(s => !s.isCompleted)) {
        throw new Error("Quarterfinals must be completed to schedule semifinals.");
      }
    } else {
      if (tourney.status !== 'planned') {
        throw new Error("Semifinals can only be scheduled for a planned tournament.");
      }
    }
  } else if (round === 'final') {
    if (tourney.status !== 'active') {
      throw new Error("Tournament must be active to schedule the final.");
    }
    const sfSlots = tourney.fights.filter(f => f.round === 'semifinal');
    if (sfSlots.some(s => !s.isCompleted)) {
      throw new Error("Semifinals must be completed to schedule the final.");
    }
  }

  const slots = tourney.fights.filter(f => f.round === round);
  const alreadyScheduled = slots.some(s => s.eventId || s.isCompleted);
  if (alreadyScheduled) {
    throw new Error(`Round ${round} is already scheduled or completed.`);
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
    
    const isBookedElsewhere = Object.values(newState.events).some(e => 
      !e.isCompleted && e.id !== eventId && e.fights.some(f => f.redCornerId === fighterId || f.blueCornerId === fighterId)
    );
    
    if (isSuspendedShort || isBookedElsewhere) {
      delayReason = isSuspendedShort 
        ? `${fighter.lastName} is medically suspended for ${fighter.medicalSuspension?.daysRemaining} days.`
        : `${fighter.lastName} is already booked in another event.`;
      delayFighterId = fighter.id;
      const delayDays = isSuspendedShort ? fighter.medicalSuspension!.daysRemaining : 28;
      delayEarliestDate = addDaysStr(newState.currentDate, delayDays);
      return fighterId;
    }
    
    if (isInjured || isSuspendedLong || isFatigued) {
      const unusedReserveId = updatedTourney.reserveFighterIds.find(resId => {
        const reserveFighter = newState.fighters[resId];
        const hasNoContract = !reserveFighter || !reserveFighter.contract;
        const resInjured = reserveFighter?.injuryStatus;
        const resSuspended = reserveFighter?.medicalSuspension && reserveFighter.medicalSuspension.daysRemaining > 0;
        const resFatigued = reserveFighter?.fatigue > 75;
        const resBooked = Object.values(newState.events).some(e => !e.isCompleted && e.fights.some(f => f.redCornerId === resId || f.blueCornerId === resId));
        
        const reserveUnavailable = hasNoContract || resInjured || resSuspended || resFatigued || resBooked;
        const inActiveSlots = slots.some(s => s.redFighterId === resId || s.blueFighterId === resId);
        return !reserveUnavailable && !inActiveSlots;
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
        updatedTourney.notes = [...(updatedTourney.notes || []), `Replacement: ${newF.lastName} replaced unavailable fighter ${origF.lastName} on ${state.currentDate} for round ${round}.`];
        
        newState.news = [
          {
            id: uuidv4(),
            date: state.currentDate,
            type: 'general' as const,
            title: `Grand Prix Replacement: ${newF.lastName} enters ${round}!`,
            content: `Due to long-term injury/suspension/fatigue, ${origF.firstName} ${origF.lastName} is unable to compete. Reserve fighter ${newF.firstName} ${newF.lastName} steps in for the ${round} round.`
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

  const updatedSlots = [...slots];
  for (let i = 0; i < updatedSlots.length; i++) {
    const slot = updatedSlots[i];
    if (!slot.redFighterId || !slot.blueFighterId) {
      throw new Error(`Round ${round} slot is missing participants.`);
    }
    const f1 = checkReplacement(slot.redFighterId, slot.redFighterId);
    if (delayReason) break;
    const f2 = checkReplacement(slot.blueFighterId, slot.blueFighterId);
    if (delayReason) break;
    
    updatedSlots[i] = {
      ...slot,
      redFighterId: f1,
      blueFighterId: f2
    };
  }

  if (delayReason) {
    updatedTourney.roundDelayReason = delayReason;
    updatedTourney.delayedRound = round;
    updatedTourney.earliestRoundDate = delayEarliestDate;
    updatedTourney.delayedFighterId = delayFighterId;
    
    if (round === 'final') {
      updatedTourney.finalDelayReason = delayReason;
      updatedTourney.earliestFinalDate = delayEarliestDate;
      updatedTourney.delayedFighterId = delayFighterId;
    }
    
    updatedTourney.notes = [...(updatedTourney.notes || []), `Round ${round} delayed: ${delayReason}`];
    
    const isNewDelay = tourney.roundDelayReason !== delayReason || tourney.earliestRoundDate !== delayEarliestDate;
    if (isNewDelay) {
      newState.news = [
        {
          id: uuidv4(),
          date: state.currentDate,
          type: 'general' as const,
          title: `${updatedTourney.name} ${round} Delayed`,
          content: `The ${round} of the ${updatedTourney.name} has been delayed. Reason: ${delayReason}. Earliest expected reschedule: ${delayEarliestDate}.`
        },
        ...newState.news
      ];
    }
    newState.tournaments[tournamentId] = updatedTourney;
    return newState;
  }

  updatedTourney.roundDelayReason = null;
  updatedTourney.delayedRound = null;
  updatedTourney.earliestRoundDate = null;
  updatedTourney.delayedFighterId = null;
  if (round === 'final') {
    updatedTourney.finalDelayReason = null;
    updatedTourney.earliestFinalDate = null;
    updatedTourney.delayedFighterId = null;
  }

  const updatedFightsInTourney = updatedTourney.fights.map(f => {
    if (f.round === round) {
      const matchingSlot = updatedSlots.find(s => s.id === f.id)!;
      const fightId = uuidv4();
      const matchup: FightMatchup = {
        id: fightId,
        redCornerId: matchingSlot.redFighterId!,
        blueCornerId: matchingSlot.blueFighterId!,
        weightClass: updatedTourney.weightClass,
        isTitleFight: false,
        rounds: round === 'final' ? 5 : 3,
        tournamentId: updatedTourney.id,
        tournamentRound: round,
        tournamentFightSlotId: f.id
      };
      updatedEvent.fights.push(matchup);
      return {
        ...matchingSlot,
        eventId: updatedEvent.id,
        fightId: fightId
      };
    }
    return f;
  });

  updatedTourney.fights = updatedFightsInTourney;
  
  if (round === 'quarterfinal' || (round === 'semifinal' && updatedTourney.format === 'four_man')) {
    updatedTourney.status = 'active';
    updatedTourney.startDate = updatedEvent.date;
  }

  updatedTourney.notes = [...(updatedTourney.notes || []), `Round ${round} scheduled on Event: ${updatedEvent.name} on ${state.currentDate}`];
  
  newState.tournaments[tournamentId] = updatedTourney;
  newState.events[eventId] = updatedEvent;
  
  const f1Fighter = newState.fighters[updatedSlots[0].redFighterId!];
  const f2Fighter = newState.fighters[updatedSlots[0].blueFighterId!];
  
  newState.news = [
    {
      id: uuidv4(),
      date: state.currentDate,
      type: 'event' as const,
      title: `${updatedTourney.name} ${round} Scheduled!`,
      content: `The ${round} matches have been scheduled for ${updatedEvent.name} on ${updatedEvent.date}!`
    },
    ...newState.news
  ];

  return newState;
}

export function scheduleQuarterfinals(state: GameState, tournamentId: string, eventId: string): GameState {
  return scheduleTournamentRound(state, tournamentId, 'quarterfinal', eventId);
}

export function scheduleSemifinals(state: GameState, tournamentId: string, eventId: string): GameState {
  return scheduleTournamentRound(state, tournamentId, 'semifinal', eventId);
}

export function scheduleFinal(state: GameState, tournamentId: string, eventId: string): GameState {
  return scheduleTournamentRound(state, tournamentId, 'final', eventId);
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
  
  const targetCount = state.promotion.reputation >= 55 ? 11 : 6;
  if (currentEligibleCount < targetCount && newState.promotion.money > 150000) {
    const freeAgents = Object.values(newState.fighters)
      .filter(f => !f.contract && f.weightClass === weightClass)
      .sort((a, b) => b.popularity - a.popularity || b.potential - a.potential);
      
    const needed = targetCount - currentEligibleCount;
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
  
  if (slot.round === 'quarterfinal') {
    const qfSlots = updatedTourney.fights.filter(f => f.round === 'quarterfinal');
    const allQfsDone = qfSlots.every(s => s.isCompleted);
    
    if (allQfsDone) {
      const w1 = qfSlots[0].winnerId;
      const w2 = qfSlots[1].winnerId;
      const w3 = qfSlots[2].winnerId;
      const w4 = qfSlots[3].winnerId;
      
      const sfSlots = updatedTourney.fights.filter(f => f.round === 'semifinal');
      if (sfSlots.length >= 2) {
        const sf1Idx = updatedTourney.fights.findIndex(f => f.id === sfSlots[0].id);
        const sf2Idx = updatedTourney.fights.findIndex(f => f.id === sfSlots[1].id);
        
        updatedTourney.fights[sf1Idx] = {
          ...sfSlots[0],
          redFighterId: w1 || undefined,
          blueFighterId: w2 || undefined
        };
        updatedTourney.fights[sf2Idx] = {
          ...sfSlots[1],
          redFighterId: w3 || undefined,
          blueFighterId: w4 || undefined
        };
      }
      
      updatedTourney.quarterfinalCompletedDate = state.currentDate;
      const d = addDays(new Date(state.currentDate), 28);
      updatedTourney.recommendedSemifinalDate = d.toISOString().split('T')[0];
      
      updatedTourney.notes = [...(updatedTourney.notes || []), `Quarterfinals completed. Semifinalists set.`];
      
      newState.news = [
        {
          id: uuidv4(),
          date: state.currentDate,
          type: 'general' as const,
          title: `${updatedTourney.name} Semifinalists Decided!`,
          content: `The quarterfinal round of the ${updatedTourney.name} is complete. Semifinal matches are set!`
        },
        ...newState.news
      ];
    }
  } else if (slot.round === 'semifinal') {
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
    
    const isEightMan = updatedTourney.format === 'eight_man';
    const winBonus = isEightMan ? 120 : 80;
    const winPop = isEightMan ? 20 : 15;
    const winMom = isEightMan ? 30 : 25;
    const runnerBonus = isEightMan ? 50 : 30;
    const runnerPop = isEightMan ? 10 : 5;
    
    if (champ) {
      const updatedChamp = { ...champ };
      if (updatedTourney.titleShotPromised) {
        updatedChamp.titleShotPromised = true;
      }
      
      updatedChamp.rankingScore = (updatedChamp.rankingScore || 1000) + winBonus;
      updatedChamp.popularity = Math.min(100, updatedChamp.popularity + winPop);
      updatedChamp.momentum = Math.min(100, updatedChamp.momentum + winMom);
      updatedChamp.history = [`Won Grand Prix vs ${loserId ? newState.fighters[loserId]?.lastName : 'Unknown'}`, ...updatedChamp.history].slice(0, 5);
      
      newState.fighters[champ.id] = updatedChamp;
    }
    
    if (loserId) {
      const runnerUp = newState.fighters[loserId];
      if (runnerUp) {
        const updatedRunner = { ...runnerUp };
        updatedRunner.rankingScore = (updatedRunner.rankingScore || 1000) + runnerBonus;
        updatedRunner.popularity = Math.min(100, updatedRunner.popularity + runnerPop);
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
      if (activeTourney.earliestRoundDate && newState.currentDate < activeTourney.earliestRoundDate) {
         return newState;
      }
      const upcomingEvent = Object.values(newState.events).find(e => !e.isCompleted && e.date >= state.currentDate);
      if (upcomingEvent) {
         try {
           if (activeTourney.format === 'eight_man') {
             newState = scheduleQuarterfinals(newState, activeTourney.id, upcomingEvent.id);
           } else {
             newState = scheduleSemifinals(newState, activeTourney.id, upcomingEvent.id);
           }
         } catch (e) {
           // Skip if scheduling fails
         }
      }
    } else if (activeTourney.status === 'active') {
      if (activeTourney.earliestRoundDate && newState.currentDate < activeTourney.earliestRoundDate) {
         return newState;
      }
      
      const isEightMan = activeTourney.format === 'eight_man';
      
      // Schedule Semifinals if 8-man and quarterfinals are done
      if (isEightMan) {
        const quarterfinalsDone = activeTourney.fights.filter(f => f.round === 'quarterfinal').every(q => q.isCompleted);
        const semifinalSlots = activeTourney.fights.filter(f => f.round === 'semifinal');
        const semifinalsScheduled = semifinalSlots.some(s => s.eventId);
        
        if (quarterfinalsDone && !semifinalsScheduled) {
           const minDate = activeTourney.quarterfinalCompletedDate 
             ? addDays(new Date(activeTourney.quarterfinalCompletedDate), 21).toISOString().split('T')[0]
             : state.currentDate;

           const upcomingEvent = Object.values(newState.events).find(e => 
              !e.isCompleted && 
              e.date >= state.currentDate &&
              e.date >= minDate
           );
           
           if (upcomingEvent) {
              try {
                newState = scheduleSemifinals(newState, activeTourney.id, upcomingEvent.id);
              } catch (e) {
                // Ignore
              }
           }
        }
      }
      
      // Schedule final
      const semifinalsDone = activeTourney.fights.filter(f => f.round === 'semifinal').every(s => s.isCompleted);
      const finalSlot = activeTourney.fights.find(f => f.round === 'final');
      if (semifinalsDone && finalSlot && !finalSlot.eventId) {
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

  // Avoid creating new GP if there are urgent title shot debts pending
  const debts = getPendingTitleShotDebts(newState);
  const urgentDebts = debts.filter(d => d.status === 'pending' || d.daysPending > 120);
  if (urgentDebts.length > 0) {
    return newState;
  }
  
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

  const canRunEightMan = newState.promotion.reputation >= 55 && newState.promotion.money >= 250000;
  let format: TournamentFormat = 'four_man';
  if (canRunEightMan) {
    format = Math.random() < 0.25 ? 'eight_man' : 'four_man';
  }
  
  const targetRequiredFighters = format === 'eight_man' ? 11 : 6;

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
  
  // Settle on format based on actual candidate count
  if (format === 'eight_man' && bestCandidate.fighters.length < 11) {
    format = 'four_man';
  }
  
  const finalRequiredCount = format === 'eight_man' ? 11 : 6;
  const sortedFighters = bestCandidate.fighters.sort((a, b) => (b.rankingScore || 0) - (a.rankingScore || 0));
  const slicedFighters = sortedFighters.slice(0, finalRequiredCount);
  
  const participantCount = format === 'eight_man' ? 8 : 4;
  const participantIds = slicedFighters.slice(0, participantCount).map(f => f.id);
  const reserveIds = slicedFighters.slice(participantCount).map(f => f.id);
  
  const name = `${wc} ${format === 'eight_man' ? '8-Man' : '4-Man'} Grand Prix`;
  
  try {
    newState = createGrandPrixTournament(newState, {
      weightClass: wc,
      name,
      titleShotPromised: true,
      format,
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
