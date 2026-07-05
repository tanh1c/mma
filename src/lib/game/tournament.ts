import { GameState, GrandPrixTournament, TournamentParticipant, TournamentFightSlot, WeightClass, Fighter, FightMatchup, FightResult, TournamentFormat, TournamentRound, TournamentStatus } from '../../types/game';
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
    usedReserveFighterIds: [],
    fights,
    titleShotPromised,
    prestige: format === 'eight_man' ? 85 : 70,
    notes: [`Planned on ${state.currentDate} with format: ${format}. Seeds: ${sortedParticipants.map((f, idx) => `${idx + 1}. ${f.lastName}`).join(', ')}`]
  };
  
  const formatLabel = format === 'eight_man' ? '8-man' : '4-man';
  const participantCount = format === 'eight_man' ? 8 : 4;
  const titleShotText = titleShotPromised ? " The winner will earn a guaranteed title shot." : "";

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
        content: `A new ${formatLabel} Grand Prix has been announced in the ${weightClass} division, featuring ${participantCount} elite fighters.${titleShotText} Participants: ${sortedParticipants.map(f => `${f.firstName} ${f.lastName}`).join(', ')}.`
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
        const resBooked = Object.values(newState.events).some(e => 
          !e.isCompleted && e.fights.some(f => f.redCornerId === resId || f.blueCornerId === resId)
        );
        
        const reserveUnavailable = hasNoContract || resInjured || resSuspended || resFatigued || resBooked;
        
        // Reject if already in participants (current or replaced)
        const isCurrentParticipant = updatedTourney.participants.some(p => p.fighterId === resId);
        
        // Reject if in any slot of the tournament (planned, active, completed)
        const inAnySlot = updatedTourney.fights.some(s => s.redFighterId === resId || s.blueFighterId === resId);
        
        // Reject if already used as a replacement
        const alreadyUsed = updatedTourney.usedReserveFighterIds?.includes(resId) || false;
        
        return !reserveUnavailable && !isCurrentParticipant && !inAnySlot && !alreadyUsed;
      });
      
      if (unusedReserveId) {
        if (!updatedTourney.usedReserveFighterIds) {
          updatedTourney.usedReserveFighterIds = [];
        }
        updatedTourney.usedReserveFighterIds.push(unusedReserveId);
        
        // Remove from available reserve list
        updatedTourney.reserveFighterIds = updatedTourney.reserveFighterIds.filter(id => id !== unusedReserveId);

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
  
  // Scale target based on reputation level
  let targetCount = 6; // Base for 4-man
  if (state.promotion.reputation >= 60) {
    targetCount = 11; // Enough for 8-man
  } else if (state.promotion.reputation >= 40) {
    targetCount = 8; // Comfortable for 4-man + reserves
  }
  
  // Only sign if we have enough money and are under target
  const minMoneyForSigning = 100000;
  const maxSignPerTick = 2; // Don't sign too many at once
  
  if (currentEligibleCount < targetCount && newState.promotion.money > minMoneyForSigning) {
    const freeAgents = Object.values(newState.fighters)
      .filter(f => !f.contract && f.weightClass === weightClass)
      .sort((a, b) => b.popularity - a.popularity || b.potential - a.potential);
      
    const needed = Math.min(targetCount - currentEligibleCount, maxSignPerTick);
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
    const getDaysDiff = (d1: string, d2: string): number => {
      return Math.round((new Date(d1).getTime() - new Date(d2).getTime()) / (1000 * 60 * 60 * 24));
    };
    
    const ageDays = getDaysDiff(newState.currentDate, activeTourney.createdDate);
    const isPlannedStuck = activeTourney.status === 'planned' && ageDays > 180;
    const isActiveStuck = activeTourney.status === 'active' && ageDays > 365;
    
    // Recovery / stuck tournament mitigation
    if (isPlannedStuck || isActiveStuck) {
      // 1. Post non-spam warning news once every 90 days of delay
      const lastDelayNews = newState.news.find(n => n.title?.includes("Grand Prix Delayed") && n.content?.includes(activeTourney.name));
      const lastDelayNewsDate = lastDelayNews ? lastDelayNews.date : null;
      const daysSinceLastNews = lastDelayNewsDate 
        ? getDaysDiff(newState.currentDate, lastDelayNewsDate)
        : 999;
        
      if (daysSinceLastNews >= 90) {
        newState.news.unshift({
          id: uuidv4(),
          date: newState.currentDate,
          title: `Grand Prix Delayed: ${activeTourney.name}`,
          content: `The ${activeTourney.name} has been delayed for ${ageDays} days. Promotion officials are working on emergency options.`,
          type: 'general'
        });
      }
      
      // 2. Cancellation recovery if planned and impossible
      if (activeTourney.status === 'planned') {
        const signedCount = Object.values(newState.fighters).filter(
          f => f.weightClass === activeTourney.weightClass && f.contract && !f.injuryStatus
        ).length;
        const totalFA = Object.values(newState.fighters).filter(f => !f.contract && f.weightClass === activeTourney.weightClass).length;
        const required = activeTourney.format === 'eight_man' ? 11 : 6;
        
        // If we don't have enough fighters and cannot sign (broke or no FA available)
        if (signedCount + totalFA < required || (newState.promotion.money < 50000 && signedCount < required)) {
          try {
            newState = cancelTournament(newState, activeTourney.id);
            // Clear target class
            newState.autopilot.targetTournamentWeightClass = null;
            newState.news.unshift({
              id: uuidv4(),
              date: newState.currentDate,
              title: `Grand Prix Cancelled: ${activeTourney.name}`,
              content: `The ${activeTourney.name} has been cancelled due to permanent participant roster depletion and financial constraints.`,
              type: 'general'
            });
            return newState;
          } catch (err) {
            // Ignore
          }
        }
      }
      
      // 3. Reserve emergency signing recovery if active and out of reserves
      if (activeTourney.status === 'active' && (!activeTourney.reserveFighterIds || activeTourney.reserveFighterIds.length === 0)) {
        const freeAgents = Object.values(newState.fighters)
          .filter(f => !f.contract && f.weightClass === activeTourney.weightClass && !f.injuryStatus)
          .sort((a, b) => b.popularity - a.popularity || b.potential - a.potential);
          
        if (freeAgents.length > 0 && newState.promotion.money > 30000) {
          const candidate = freeAgents[0];
          const pay = 5000 + (candidate.popularity * 100);
          newState.fighters[candidate.id] = {
            ...candidate,
            contract: { payPerFight: pay, winBonus: pay, fightsRemaining: 4, exclusivity: true }
          };
          
          const updated = { ...newState.tournaments[activeTourney.id] };
          updated.reserveFighterIds = [...(updated.reserveFighterIds || []), candidate.id];
          updated.notes = [...(updated.notes || []), `Emergency Reserve Signing: Signed ${candidate.lastName} on ${newState.currentDate}.`];
          newState.tournaments[activeTourney.id] = updated;
          
          newState.news.unshift({
            id: uuidv4(),
            date: newState.currentDate,
            title: `Emergency Tournament Signing: ${candidate.lastName}`,
            content: `Cage Dynasty has signed free agent ${candidate.firstName} ${candidate.lastName} as an emergency reserve for the stalled ${activeTourney.name}.`,
            type: 'contract'
          });
        }
      }
    }

    // Normal tournament round progression scheduling
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
  const urgentDebts = debts.filter(d => d.status === 'pending');
  if (urgentDebts.length > 0) {
    return newState;
  }
  
  const completedTourneys = Object.values(newState.tournaments).filter(t => t.status === 'completed');
  if (completedTourneys.length > 0) {
    const lastCompleted = completedTourneys.sort((a, b) => new Date(b.completedDate || '').getTime() - new Date(a.completedDate || '').getTime())[0];
    if (lastCompleted && lastCompleted.completedDate) {
      const diffDays = Math.abs(new Date(newState.currentDate).getTime() - new Date(lastCompleted.completedDate).getTime()) / (1000 * 60 * 60 * 24);
      const requiredCooldown = lastCompleted.format === 'eight_man' ? 540 : 270;
      if (diffDays < requiredCooldown) {
        return newState;
      }
    }
  }

  // 1. Dynamically target a single division and maintain depth
  let targetWc = newState.autopilot.targetTournamentWeightClass;
  if (targetWc) {
    const hasActiveOrPlanned = Object.values(newState.tournaments).some(
      t => t.weightClass === targetWc && (t.status === 'active' || t.status === 'planned')
    );
    const title = newState.titles[targetWc];
    const hasCrisis = title && title.status === 'unification_needed';
    if (hasActiveOrPlanned || hasCrisis) {
      targetWc = null;
    }
  }
  
  const weightClasses: WeightClass[] = ['Bantamweight', 'Featherweight', 'Lightweight', 'Welterweight', 'Middleweight', 'Heavyweight'];
  if (!targetWc) {
    // Pick the best target class that does not have active/planned GP and is not in crisis
    const availableWcs = weightClasses.filter(wc => {
      const hasActiveOrPlanned = Object.values(newState.tournaments).some(t => t.weightClass === wc && (t.status === 'active' || t.status === 'planned'));
      if (hasActiveOrPlanned) return false;
      
      const title = newState.titles[wc];
      if (title && title.status === 'unification_needed') return false;
      
      return true;
    });
    
    if (availableWcs.length > 0) {
      const scoredWcs = availableWcs.map(wc => {
        const title = newState.titles[wc];
        const freeAgentsCount = Object.values(newState.fighters).filter(f => !f.contract && f.weightClass === wc).length;
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
        if (isVacant) score += 100;
        if (isInactive) score += 50;
        
        score += freeAgentsCount * 10;
        score += wcFighters.length * 5;
        
        if (title && title.undisputedChampionId) {
          const champ = newState.fighters[title.undisputedChampionId];
          if (champ && champ.lastFightDate) {
            const daysSinceFight = Math.floor(Math.abs(new Date(newState.currentDate).getTime() - new Date(champ.lastFightDate).getTime()) / (1000 * 3600 * 24));
            if (daysSinceFight > 180) {
              score += 30; // Stale title picture
            }
          }
        }
        
        return { wc, score };
      });
      
      const best = scoredWcs.sort((a, b) => b.score - a.score)[0];
      if (best) {
        targetWc = best.wc;
      }
    }
    newState.autopilot = { ...newState.autopilot, targetTournamentWeightClass: targetWc };
  }

  // 2. Concentrate depth building ONLY in the target division
  const signedWcsInThisTick = new Set<WeightClass>();
  if (targetWc) {
    const prevSignedCount = Object.values(newState.fighters).filter(f => f.weightClass === targetWc && f.contract).length;
    newState = maintainTournamentRosterDepth(newState, targetWc);
    const currSignedCount = Object.values(newState.fighters).filter(f => f.weightClass === targetWc && f.contract).length;
    if (currSignedCount > prevSignedCount) {
      signedWcsInThisTick.add(targetWc);
    }
  }

  // Cooldown / rare check to actually trigger the creation
  if (Math.random() > 0.05) { 
    return newState;
  }

  if (!targetWc) return newState;
  
  // Decide format for target division
  const canRunEightMan = newState.promotion.reputation >= 60 && newState.promotion.money >= 200000;
  let format: TournamentFormat = 'four_man';
  if (canRunEightMan) {
    const everCompleted8man = Object.values(newState.tournaments).some(t => t.format === 'eight_man' && t.status === 'completed');
    const highRepBonus = newState.promotion.reputation >= 75 ? 0.20 : 0.0;
    const neverHad8manBonus = !everCompleted8man && newState.promotion.reputation >= 75 && newState.promotion.money >= 500000 ? 0.30 : 0.0;
    const moneyBonus = newState.promotion.money >= 500000 ? 0.10 : 0.0;
    const eightManChance = 0.25 + highRepBonus + neverHad8manBonus + moneyBonus;
    format = Math.random() < eightManChance ? 'eight_man' : 'four_man';
  }

  const wcFighters = Object.values(newState.fighters).filter(f => 
    f.weightClass === targetWc && 
    f.contract && 
    !f.injuryStatus && 
    (!f.medicalSuspension || f.medicalSuspension.daysRemaining <= 0) &&
    !f.isChampion
  );
  
  if (format === 'eight_man' && wcFighters.length < 11) {
    format = 'four_man';
  }
  
  const finalRequiredCount = format === 'eight_man' ? 11 : 6;
  if (wcFighters.length < finalRequiredCount) {
    return newState; // Not enough depth yet, keep building
  }

  const sortedFighters = wcFighters.sort((a, b) => (b.rankingScore || 0) - (a.rankingScore || 0));
  const slicedFighters = sortedFighters.slice(0, finalRequiredCount);
  
  const participantCount = format === 'eight_man' ? 8 : 4;
  const participantIds = slicedFighters.slice(0, participantCount).map(f => f.id);
  const reserveIds = slicedFighters.slice(participantCount).map(f => f.id);
  
  const name = `${targetWc} ${format === 'eight_man' ? '8-Man' : '4-Man'} Grand Prix`;
  
  try {
    newState = createGrandPrixTournament(newState, {
      weightClass: targetWc,
      name,
      titleShotPromised: true,
      format,
      participantIds,
      reserveIds
    });
    // Clear target so next tournament targets a different division
    newState.autopilot.targetTournamentWeightClass = null;
  } catch (e: any) {
    console.log(`Tournament creation failed: ${e?.message}`);
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

export function getTitleShotDebts(state: GameState): TitleShotDebt[] {
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

export function getPendingTitleShotDebts(state: GameState): TitleShotDebt[] {
  return getTitleShotDebts(state).filter(d => d.status !== 'used');
}

export function validateTitleShotDebtState(state: GameState): string[] {
  const errors: string[] = [];
  const debts = getTitleShotDebts(state);
  const pendingDebts = getPendingTitleShotDebts(state);

  // 1. used title shot debts should not be returned by getPendingTitleShotDebts
  const usedInPending = pendingDebts.some(d => d.status === 'used');
  if (usedInPending) {
    errors.push("Invariant Error: getPendingTitleShotDebts returned a debt with status 'used'");
  }

  // Track unused completed tournaments for each fighter
  const unusedGpPromisesByFighter: Record<string, number> = {};
  Object.values(state.tournaments || {}).forEach(t => {
    if (t.status === 'completed' && t.titleShotPromised && !t.titleShotUsed && t.winnerId) {
      unusedGpPromisesByFighter[t.winnerId] = (unusedGpPromisesByFighter[t.winnerId] || 0) + 1;
    }
  });

  // Check each fighter's titleShotPromised flag
  Object.values(state.fighters).forEach(f => {
    const unusedCount = unusedGpPromisesByFighter[f.id] || 0;
    
    // 2. pending title shot debts should correspond to fighter.titleShotPromised === true
    const hasPendingDebt = pendingDebts.some(d => d.fighterId === f.id);
    if (hasPendingDebt && !f.titleShotPromised) {
      errors.push(`Invariant Error: Fighter ${f.firstName} ${f.lastName} has a pending title shot debt but titleShotPromised is false`);
    }

    // 3. no fighter should have titleShotPromised true without at least one unused completed GP promise
    if (f.titleShotPromised && unusedCount === 0) {
      errors.push(`Invariant Error: Fighter ${f.firstName} ${f.lastName} has titleShotPromised === true but 0 unused completed GP promises`);
    }
  });

  // Check each tournament's titleShotUsed flag
  Object.values(state.tournaments || {}).forEach(t => {
    if (t.status === 'completed' && t.titleShotPromised && t.winnerId) {
      const winner = state.fighters[t.winnerId];
      if (winner) {
        // 4. if tournament.titleShotUsed === true, winner fighter should not have titleShotPromised, unless another unused tournament promise exists for the same fighter
        if (t.titleShotUsed) {
          const unusedCount = unusedGpPromisesByFighter[t.winnerId] || 0;
          if (winner.titleShotPromised && unusedCount === 0) {
            errors.push(`Invariant Error: Tournament ${t.name} titleShotUsed is true, but winner ${winner.firstName} ${winner.lastName} has titleShotPromised === true with no other unused GP promises`);
          }
        }
      }
    }
  });

  // 5. if a title shot is scheduled, debt status should be scheduled
  debts.forEach(d => {
    const isScheduled = Object.values(state.events).some(e => 
      !e.isCompleted && 
      e.fights.some(f => 
        f.isTitleFight && 
        (f.redCornerId === d.fighterId || f.blueCornerId === d.fighterId)
      )
    );
    if (isScheduled && d.status !== 'scheduled' && d.status !== 'used') {
      errors.push(`Invariant Error: Title shot for fighterId ${d.fighterId} is scheduled in an event, but debt status is ${d.status} instead of 'scheduled'`);
    }
  });

  return errors;
}

export function validateTournamentState(state: GameState): string[] {
  const errors: string[] = [];

  const getDaysDiff = (d1: string, d2: string): number => {
    return Math.round((new Date(d1).getTime() - new Date(d2).getTime()) / (1000 * 60 * 60 * 24));
  };

  Object.values(state.tournaments || {}).forEach(t => {
    // 1. no duplicate participant fighter IDs
    const participantIds = t.participants.map(p => p.fighterId);
    const uniqueParticipantIds = new Set(participantIds);
    if (uniqueParticipantIds.size !== participantIds.length) {
      errors.push(`Tournament "${t.name}" (${t.id}) has duplicate participant fighter IDs: ${participantIds}`);
    }

    // 2. no duplicate reserve IDs
    const reserveIds = t.reserveFighterIds;
    const uniqueReserveIds = new Set(reserveIds);
    if (uniqueReserveIds.size !== reserveIds.length) {
      errors.push(`Tournament "${t.name}" (${t.id}) has duplicate reserve fighter IDs: ${reserveIds}`);
    }

    // 3. no overlap between participants and unused reserves unless reserve has officially replaced someone
    const overlap = participantIds.filter(id => reserveIds.includes(id));
    if (overlap.length > 0) {
      errors.push(`Tournament "${t.name}" (${t.id}) has overlap between active participants and unused reserves: ${overlap.join(', ')}`);
    }

    // 4. no fighter appears twice in same scheduled round
    const roundsToCheck: TournamentRound[] = ['quarterfinal', 'semifinal', 'final'];
    roundsToCheck.forEach(round => {
      const roundSlots = t.fights.filter(f => f.round === round);
      const fightersInRound: string[] = [];
      roundSlots.forEach(s => {
        if (s.redFighterId) fightersInRound.push(s.redFighterId);
        if (s.blueFighterId) fightersInRound.push(s.blueFighterId);
      });
      const uniqueFighters = new Set(fightersInRound);
      if (uniqueFighters.size !== fightersInRound.length) {
        errors.push(`Tournament "${t.name}" (${t.id}) has a fighter appearing twice in round "${round}".`);
      }
    });

    // 5. no completed slot missing winner
    t.fights.forEach(slot => {
      if (slot.isCompleted && !slot.winnerId) {
        errors.push(`Tournament "${t.name}" (${t.id}) has completed slot ${slot.id} in round "${slot.round}" but is missing winnerId.`);
      }
      
      // 6. no completed slot missing fightArchiveId after event finalization
      if (slot.isCompleted && slot.eventId) {
        const event = state.events[slot.eventId];
        if (event && event.isCompleted && !slot.fightArchiveId) {
          errors.push(`Tournament "${t.name}" (${t.id}) slot ${slot.id} is completed on finalized event ${event.name} but missing fightArchiveId.`);
        }
      }

      // 11. no injured/suspended fighter in upcoming tournament fight
      if (slot.eventId && !slot.isCompleted) {
        const event = state.events[slot.eventId];
        if (event && !event.isCompleted) {
          const daysUntilEvent = getDaysDiff(event.date, state.currentDate);
          
          const checkFighter = (fighterId?: string) => {
            if (!fighterId) return;
            const fighter = state.fighters[fighterId];
            if (!fighter) return;
            
            if (fighter.injuryStatus) {
              const injuryDays = fighter.injuryStatus.daysRemaining;
              if (injuryDays > daysUntilEvent) {
                errors.push(`Fighter ${fighter.firstName} ${fighter.lastName} is injured (${fighter.injuryStatus.type}, ${injuryDays}d left) but scheduled in upcoming fight on ${event.date} (${daysUntilEvent}d away) for tournament "${t.name}".`);
              }
            }
            if (fighter.medicalSuspension && fighter.medicalSuspension.daysRemaining > 0) {
              const msDays = fighter.medicalSuspension.daysRemaining;
              if (msDays > daysUntilEvent) {
                errors.push(`Fighter ${fighter.firstName} ${fighter.lastName} is suspended (${msDays}d left) but scheduled in upcoming fight on ${event.date} (${daysUntilEvent}d away) for tournament "${t.name}".`);
              }
            }
          };
          checkFighter(slot.redFighterId);
          checkFighter(slot.blueFighterId);
        }
      }
    });

    // 7. 4-man cannot have quarterfinal slots
    if (t.format === 'four_man') {
      const qfSlots = t.fights.filter(f => f.round === 'quarterfinal');
      if (qfSlots.length > 0) {
        errors.push(`4-Man Tournament "${t.name}" (${t.id}) contains quarterfinal slots.`);
      }
    }

    // 8. 8-man must have exactly 4 quarterfinals, 2 semifinals, 1 final
    if (t.format === 'eight_man') {
      const qfSlots = t.fights.filter(f => f.round === 'quarterfinal');
      const sfSlots = t.fights.filter(f => f.round === 'semifinal');
      const finalSlots = t.fights.filter(f => f.round === 'final');
      if (qfSlots.length !== 4) {
        errors.push(`8-Man Tournament "${t.name}" (${t.id}) does not have exactly 4 quarterfinals (found ${qfSlots.length}).`);
      }
      if (sfSlots.length !== 2) {
        errors.push(`8-Man Tournament "${t.name}" (${t.id}) does not have exactly 2 semifinals (found ${sfSlots.length}).`);
      }
      if (finalSlots.length !== 1) {
        errors.push(`8-Man Tournament "${t.name}" (${t.id}) does not have exactly 1 final (found ${finalSlots.length}).`);
      }
    }

    // 9. completed tournament must have winnerId
    if (t.status === 'completed' && !t.winnerId) {
      errors.push(`Completed Tournament "${t.name}" (${t.id}) is missing winnerId.`);
    }

    // 10. cancelled tournament must not have future scheduled fights
    if (t.status === 'cancelled') {
      const scheduledFights = t.fights.filter(f => f.eventId);
      scheduledFights.forEach(f => {
        const event = state.events[f.eventId!];
        if (event && !event.isCompleted) {
          errors.push(`Cancelled Tournament "${t.name}" (${t.id}) still has a scheduled fight in future event "${event.name}" (${event.id}).`);
        }
      });
    }

    // 11. active/planned tournament should not have invalid scheduled fights
    if (t.status === 'planned' || t.status === 'active') {
      t.fights.forEach(f => {
        if (f.eventId) {
          const event = state.events[f.eventId];
          if (!event) {
            errors.push(`Tournament "${t.name}" (${t.id}) references non-existent eventId "${f.eventId}" in slot ${f.id}.`);
          } else {
            const hasMatch = event.fights.some(ef => ef.id === f.fightId);
            if (!hasMatch && !f.isCompleted) {
              errors.push(`Tournament "${t.name}" (${t.id}) references fightId "${f.fightId}" on event "${event.name}" but it is missing from event fights.`);
            }
          }
        }
      });
    }

    // 12. titleShotUsed tournament winner should not still have fighter.titleShotPromised
    if (t.titleShotUsed && t.winnerId) {
      const winner = state.fighters[t.winnerId];
      if (winner && winner.titleShotPromised) {
        errors.push(`Tournament "${t.name}" winner ${winner.firstName} ${winner.lastName} still has titleShotPromised: true after titleShotUsed is true.`);
      }
    }
  });

  errors.push(...validateTitleShotDebtState(state));
  return errors;
}

export function syncTournamentTitleShotFlags(state: GameState): GameState {
  let newState = { ...state, tournaments: { ...state.tournaments }, fighters: { ...state.fighters } };

  Object.values(newState.tournaments).forEach(t => {
    if (t.status !== 'completed' || !t.titleShotPromised || !t.winnerId) return;

    const winner = newState.fighters[t.winnerId];
    if (!winner) return;

    if (t.titleShotUsed) {
      // If tournament has used the title shot, winner must NOT have titleShotPromised
      if (winner.titleShotPromised) {
        // Check if the fighter has any OTHER unused GP title shot promises
        const otherUnused = Object.values(newState.tournaments).some(
          ot => ot.id !== t.id && ot.status === 'completed' && ot.titleShotPromised && !ot.titleShotUsed && ot.winnerId === t.winnerId
        );
        if (!otherUnused) {
          newState.fighters[t.winnerId] = { ...winner, titleShotPromised: false };
        }
      }
    } else {
      // If tournament has NOT used the title shot, winner SHOULD have titleShotPromised
      if (!winner.titleShotPromised) {
        newState.fighters[t.winnerId] = { ...newState.fighters[t.winnerId], titleShotPromised: true };
      }
    }
  });

  return newState;
}

export interface TournamentDiagnosis {
  tournamentId: string;
  name: string;
  status: TournamentStatus;
  format: TournamentFormat;
  ageDays: number;
  currentRoundNeeded: 'quarterfinal' | 'semifinal' | 'final' | 'none';
  scheduledRound: 'quarterfinal' | 'semifinal' | 'final' | 'none';
  completedSlots: number;
  missingWinners: number;
  roundDelayReason: string | null;
  earliestRoundDate: string | null;
  hasUpcomingTournamentFights: boolean;
  canScheduleNow: boolean;
  reasonCannotSchedule: string | null;
}

export function diagnoseActiveTournaments(state: GameState): TournamentDiagnosis[] {
  const diagnostics: TournamentDiagnosis[] = [];

  const getDaysDiff = (d1: string, d2: string): number => {
    return Math.round((new Date(d1).getTime() - new Date(d2).getTime()) / (1000 * 60 * 60 * 24));
  };

  Object.values(state.tournaments || {}).forEach(t => {
    if (t.status === 'planned' || t.status === 'active') {
      const ageDays = getDaysDiff(state.currentDate, t.createdDate);
      const completedSlots = t.fights.filter(f => f.isCompleted).length;
      const missingWinners = t.fights.filter(f => f.isCompleted && !f.winnerId).length;

      let currentRoundNeeded: TournamentDiagnosis['currentRoundNeeded'] = 'none';
      if (t.format === 'eight_man') {
        if (t.fights.filter(f => f.round === 'quarterfinal').some(f => !f.isCompleted)) {
          currentRoundNeeded = 'quarterfinal';
        } else if (t.fights.filter(f => f.round === 'semifinal').some(f => !f.isCompleted)) {
          currentRoundNeeded = 'semifinal';
        } else if (t.fights.filter(f => f.round === 'final').some(f => !f.isCompleted)) {
          currentRoundNeeded = 'final';
        }
      } else {
        if (t.fights.filter(f => f.round === 'semifinal').some(f => !f.isCompleted)) {
          currentRoundNeeded = 'semifinal';
        } else if (t.fights.filter(f => f.round === 'final').some(f => !f.isCompleted)) {
          currentRoundNeeded = 'final';
        }
      }

      let scheduledRound: TournamentDiagnosis['scheduledRound'] = 'none';
      if (t.fights.some(f => f.round === 'final' && f.eventId)) {
        scheduledRound = 'final';
      } else if (t.fights.some(f => f.round === 'semifinal' && f.eventId)) {
        scheduledRound = 'semifinal';
      } else if (t.fights.some(f => f.round === 'quarterfinal' && f.eventId)) {
        scheduledRound = 'quarterfinal';
      }

      const hasUpcomingTournamentFights = t.fights.some(f => {
        if (!f.eventId || f.isCompleted) return false;
        const event = state.events[f.eventId];
        return event && !event.isCompleted && event.date >= state.currentDate;
      });

      const roundDelayReason = t.roundDelayReason || t.finalDelayReason || null;
      const earliestRoundDate = t.earliestRoundDate || t.earliestFinalDate || null;

      let canScheduleNow = true;
      let reasonCannotSchedule: string | null = null;

      if (hasUpcomingTournamentFights) {
        canScheduleNow = false;
        reasonCannotSchedule = "Fights already scheduled for upcoming event";
      } else if (earliestRoundDate && state.currentDate < earliestRoundDate) {
        canScheduleNow = false;
        reasonCannotSchedule = `Delayed until ${earliestRoundDate} (Reason: ${roundDelayReason || 'Fighter unavailable'})`;
      } else {
        // Check if previous round not completed
        if (currentRoundNeeded === 'semifinal' && t.format === 'eight_man') {
          const qfsDone = t.fights.filter(f => f.round === 'quarterfinal').every(f => f.isCompleted);
          if (!qfsDone) {
            canScheduleNow = false;
            reasonCannotSchedule = "Quarterfinals not completed";
          }
        } else if (currentRoundNeeded === 'final') {
          const sfsDone = t.fights.filter(f => f.round === 'semifinal').every(f => f.isCompleted);
          if (!sfsDone) {
            canScheduleNow = false;
            reasonCannotSchedule = "Semifinals not completed";
          }
        }
      }

      diagnostics.push({
        tournamentId: t.id,
        name: t.name,
        status: t.status,
        format: t.format,
        ageDays,
        currentRoundNeeded,
        scheduledRound,
        completedSlots,
        missingWinners,
        roundDelayReason,
        earliestRoundDate,
        hasUpcomingTournamentFights,
        canScheduleNow,
        reasonCannotSchedule
      });
    }
  });

  return diagnostics;
}
