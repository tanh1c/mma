import { GameState, GrandPrixTournament, TournamentParticipant, TournamentFightSlot, WeightClass, Fighter, FightMatchup, FightResult, TournamentFormat, TournamentRound, TournamentStatus, SeasonCalendarSlot, CompetitionScope, InternationalCompetitionTier } from '../../types/game';
import { v4 as uuidv4 } from 'uuid';
import { addDays } from 'date-fns';
import { getTournamentBranding } from '../branding';
import { generateSeasonPlan } from './season';
import { getContractEndDate, isContractMarketOpen } from './contracts';
import { getPlayerPromotionId, isFighterInPromotion } from './leagues';
import { getFighterOverall } from './fighterRatings';
import '../../i18n';
import { fixedT, formatWeightClass, readLanguage, type Language } from '../localization';

function formatRound(round: TournamentRound, language: Language): string {
  const t = fixedT(language);
  return round === 'quarterfinal'
    ? t($ => $.generated.tournament.quarterfinal)
    : round === 'semifinal'
      ? t($ => $.generated.tournament.semifinal)
      : t($ => $.generated.tournament.final);
}

export function isFighterBookedUpcoming(state: GameState, fighterId: string, excludeEventId?: string): boolean {
  return Object.values(state.events || {}).some(e => 
    !e.isCompleted && e.id !== excludeEventId && e.fights.some(f => f.redCornerId === fighterId || f.blueCornerId === fighterId)
  );
}

export function createGrandPrixTournament(
  state: GameState,
  options: {
    weightClass: WeightClass;
    name: string;
    titleShotPromised: boolean;
    format?: TournamentFormat;
    participantIds?: string[];
    reserveIds?: string[];
    scope?: CompetitionScope;
    promotionId?: string | null;
    internationalTier?: InternationalCompetitionTier;
    winnerBeltId?: string;
    qualifyingPromotionIds?: string[];
  },
  language: Language = readLanguage()
): GameState {
  const t = fixedT(language);
  const { weightClass, name, titleShotPromised, format = 'four_man', participantIds = [], reserveIds = [], scope = 'promotion', promotionId = getPlayerPromotionId(state) } = options;

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
    if (fighter.careerPhase === 'retired' || (scope === 'promotion' && fighter.contract?.promotionId !== promotionId) || (scope === 'international' && !fighter.contract?.promotionId)) {
      throw new Error(`${role} fighter ${fighter.lastName} is not active in the promotion.`);
    }
    if (fighter.injuryStatus) {
      throw new Error(`${role} fighter ${fighter.lastName} is currently injured.`);
    }
    if (fighter.medicalSuspension && fighter.medicalSuspension.daysRemaining > 0) {
      throw new Error(`${role} fighter ${fighter.lastName} is medically suspended.`);
    }
    
    if (isFighterBookedUpcoming(state, id)) {
      throw new Error(`${role} fighter ${fighter.lastName} is already booked in an upcoming fight.`);
    }
  };
  
  participantIds.forEach(id => validateFighter(id, "Participant"));
  reserveIds.forEach(id => validateFighter(id, "Reserve"));
  
  const sortedParticipants = [...participantIds].map(id => state.fighters[id]).sort((a, b) => {
    const scoreA = a.rankingScore || 0;
    const scoreB = b.rankingScore || 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    
    const overallA = getFighterOverall(a);
    const overallB = getFighterOverall(b);
    if (overallB !== overallA) return overallB - overallA;

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
    promotionId,
    scope,
    name,
    shortName: getTournamentBranding(weightClass, format).shortName,
    weightClass,
    status: 'planned',
    format,
    createdDate: state.currentDate,
    participants,
    reserveFighterIds: reserveIds,
    usedReserveFighterIds: [],
    fights,
    titleShotPromised: scope === 'international' ? false : titleShotPromised,
    internationalTier: options.internationalTier,
    winnerBeltId: options.winnerBeltId,
    qualifyingPromotionIds: options.qualifyingPromotionIds,
    prestige: format === 'eight_man' ? 85 : 70,
    notes: [t($ => $.generated.tournament.plannedNote, {
      date: state.currentDate,
      format: format === 'eight_man' ? t($ => $.generated.tournament.eightMan) : t($ => $.generated.tournament.fourMan),
      seeds: sortedParticipants.map((f, idx) => `${idx + 1}. ${f.lastName}`).join(', ')
    })]
  };
  
  const formatLabel = format === 'eight_man' ? t($ => $.generated.tournament.eightMan) : t($ => $.generated.tournament.fourMan);
  const participantCount = format === 'eight_man' ? 8 : 4;
  const titleShotText = titleShotPromised ? t($ => $.generated.tournament.titleShotPromise) : "";

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
        title: t($ => $.generated.tournament.announcedTitle, { name }),
        content: t($ => $.generated.tournament.announced, {
          format: formatLabel,
          weightClass: formatWeightClass(weightClass, language),
          count: participantCount,
          titleShot: titleShotText,
          participants: sortedParticipants.map(f => `${f.firstName} ${f.lastName}`).join(', ')
        })
      },
      ...state.news
    ]
  };
  
  return scope === 'international' ? newState : bindTournamentToCalendarSlots(newState, newTourney.id, language);
}

export function scheduleTournamentRound(
  state: GameState,
  tournamentId: string,
  round: 'quarterfinal' | 'semifinal' | 'final',
  eventId: string,
  language: Language = readLanguage()
): GameState {
  const t = fixedT(language);
  const roundLabel = formatRound(round, language);
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
      const retryingUnfinishedRound = tourney.status === 'active' && tourney.fights.filter(f => f.round === 'semifinal').every(f => !f.isCompleted && !f.eventId);
      if (tourney.status !== 'planned' && !retryingUnfinishedRound) {
        throw new Error("Semifinals can only be scheduled for a planned tournament or retried before any semifinal completes.");
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

  let newState = { 
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
    
    const isInactive = !fighter.contract || fighter.careerPhase === 'retired';
    const isInjured = fighter.injuryStatus !== null;
    const isSuspendedLong = fighter.medicalSuspension && fighter.medicalSuspension.daysRemaining > 35;
    const isSuspendedShort = fighter.medicalSuspension && fighter.medicalSuspension.daysRemaining <= 35 && fighter.medicalSuspension.daysRemaining > 0;
    const isFatigued = fighter.fatigue > 75;
    
    const isBookedElsewhere = Object.values(newState.events).some(e => 
      !e.isCompleted && e.id !== eventId && e.fights.some(f => f.redCornerId === fighterId || f.blueCornerId === fighterId)
    );
    
    if (isSuspendedShort || isBookedElsewhere) {
      delayReason = isSuspendedShort
        ? t($ => $.generated.tournament.suspendedDelay, { fighter: fighter.lastName, count: fighter.medicalSuspension?.daysRemaining })
        : t($ => $.generated.tournament.bookedDelay, { fighter: fighter.lastName });
      delayFighterId = fighter.id;
      const delayDays = isSuspendedShort ? fighter.medicalSuspension!.daysRemaining : 28;
      delayEarliestDate = addDaysStr(newState.currentDate, delayDays);
      return fighterId;
    }
    
    if (isInactive || isInjured || isSuspendedLong || isFatigued) {
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
        updatedTourney.notes = [...(updatedTourney.notes || []), t($ => $.generated.tournament.replacementNote, {
          replacement: newF.lastName,
          original: origF.lastName,
          date: state.currentDate,
          round: roundLabel
        })];
        
        newState.news = [
          {
            id: uuidv4(),
            date: state.currentDate,
            type: 'general' as const,
            title: t($ => $.generated.tournament.replacementTitle, { replacement: newF.lastName, round: roundLabel }),
            content: t($ => $.generated.tournament.replacement, {
              original: `${origF.firstName} ${origF.lastName}`,
              replacement: `${newF.firstName} ${newF.lastName}`,
              round: roundLabel
            })
          },
          ...newState.news
        ];
        
        return unusedReserveId;
      } else {
        delayReason = t($ => $.generated.tournament.unavailableDelay, { fighter: fighter.lastName });
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
    
    updatedTourney.notes = [...(updatedTourney.notes || []), t($ => $.generated.tournament.delayedNote, { round: roundLabel, reason: delayReason })];
    
    const isNewDelay = tourney.roundDelayReason !== delayReason || tourney.earliestRoundDate !== delayEarliestDate;
    if (isNewDelay) {
      newState = handleDelayedRoundCalendarSlot(newState, tournamentId, round, delayEarliestDate, delayReason, language);
      newState.news = [
        {
          id: uuidv4(),
          date: state.currentDate,
          type: 'general' as const,
          title: t($ => $.generated.tournament.delayedTitle, { name: updatedTourney.name, round: roundLabel }),
          content: t($ => $.generated.tournament.delayed, {
            name: updatedTourney.name,
            round: roundLabel,
            reason: delayReason,
            date: delayEarliestDate
          })
        },
        ...newState.news
      ];
    }
    updatedTourney.fights = updatedTourney.fights.map(f => {
      if (f.round === round) {
        return {
          ...f,
          eventId: undefined,
          fightId: undefined
        };
      }
      return f;
    });

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

  updatedTourney.notes = [...(updatedTourney.notes || []), t($ => $.generated.tournament.scheduledNote, { round: roundLabel, event: updatedEvent.name, date: state.currentDate })];
  
  newState.tournaments[tournamentId] = updatedTourney;
  newState.events[eventId] = updatedEvent;
  
  const f1Fighter = newState.fighters[updatedSlots[0].redFighterId!];
  const f2Fighter = newState.fighters[updatedSlots[0].blueFighterId!];
  
  newState.news = [
    {
      id: uuidv4(),
      date: state.currentDate,
      type: 'event' as const,
      title: t($ => $.generated.tournament.scheduledTitle, { name: updatedTourney.name, round: roundLabel }),
      content: t($ => $.generated.tournament.scheduled, { round: roundLabel, event: updatedEvent.name, date: updatedEvent.date })
    },
    ...newState.news
  ];

  newState = linkScheduledRoundToSlot(newState, tournamentId, round, eventId, language);
  return newState;
}

export function scheduleQuarterfinals(state: GameState, tournamentId: string, eventId: string, language: Language = readLanguage()): GameState {
  return scheduleTournamentRound(state, tournamentId, 'quarterfinal', eventId, language);
}

export function scheduleSemifinals(state: GameState, tournamentId: string, eventId: string, language: Language = readLanguage()): GameState {
  return scheduleTournamentRound(state, tournamentId, 'semifinal', eventId, language);
}

export function scheduleFinal(state: GameState, tournamentId: string, eventId: string, language: Language = readLanguage()): GameState {
  return scheduleTournamentRound(state, tournamentId, 'final', eventId, language);
}

export function cancelTournament(state: GameState, tournamentId: string, language: Language = readLanguage(), allowStarted = false): GameState {
  const t = fixedT(language);
  const tourney = state.tournaments[tournamentId];
  if (!tourney) throw new Error("Tournament not found");

  const hasCompletedFights = tourney.fights.some(f => f.isCompleted);
  if (hasCompletedFights && !allowStarted) {
    throw new Error("Cannot cancel a tournament after fights have started.");
  }
  
  const newState = {
    ...state,
    tournaments: { ...state.tournaments },
    events: { ...state.events },
    seasonPlans: state.seasonPlans ? { ...state.seasonPlans } : state.seasonPlans
  };
  
  tourney.fights.forEach(slot => {
    if (!slot.isCompleted && slot.eventId && slot.fightId) {
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
    fights: tourney.fights.map(slot => slot.isCompleted ? slot : {
      ...slot,
      eventId: undefined,
      fightId: undefined
    }),
    notes: [...(tourney.notes || []), t($ => $.generated.tournament.cancelledNote, { date: state.currentDate })]
  };

  if (newState.seasonPlans) {
    for (const yearStr in newState.seasonPlans) {
      const plan = newState.seasonPlans[Number(yearStr)];
      if (!plan) continue;
      const updatedSlots = plan.slots.map(s => {
        if (s.tournamentId === tournamentId) {
          return {
            ...s,
            status: 'cancelled' as const,
            eventId: undefined,
            notes: [...(s.notes || []), t($ => $.generated.tournament.cancelledNote, { date: state.currentDate })]
          };
        }
        return s;
      });
      newState.seasonPlans[Number(yearStr)] = { ...plan, slots: updatedSlots };
    }
  }
  
  return newState;
}

export function maintainTournamentRosterDepth(state: GameState, weightClass: WeightClass, language: Language = readLanguage()): GameState {
  const t = fixedT(language);
  const promotionId = getPlayerPromotionId(state);
  const eligible = Object.values(state.fighters).filter(f =>
    f.weightClass === weightClass &&
    isFighterInPromotion(f, promotionId) &&
    f.careerPhase !== 'retired' &&
    !f.injuryStatus &&
    (!f.medicalSuspension || f.medicalSuspension.daysRemaining <= 0) &&
    !f.isChampion
  );
  
  let newState = { ...state, fighters: { ...state.fighters }, news: [...state.news] };
  let currentEligibleCount = eligible.length;
  let signedCount = Object.values(state.fighters).filter(f => f.weightClass === weightClass && isFighterInPromotion(f, promotionId)).length;
  
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
  
  if (!isContractMarketOpen(newState) && currentEligibleCount < targetCount && newState.promotion.money > minMoneyForSigning) {
    const freeAgents = Object.values(newState.fighters)
      .filter(f => !f.contract && f.careerPhase !== 'retired' && f.weightClass === weightClass)
      .sort((a, b) => b.popularity - a.popularity || b.potential - a.potential);
      
    const needed = Math.max(0, Math.min(targetCount - currentEligibleCount, 12 - signedCount, maxSignPerTick));
    const toSignList = freeAgents.slice(0, needed);
    
    toSignList.forEach(toSign => {
      const pay = 5000 + (toSign.popularity * 100);
      if (newState.promotion.money > pay * 4) {
        newState.fighters[toSign.id] = {
          ...toSign,
          contract: { promotionId: getPlayerPromotionId(newState), payPerFight: pay, winBonus: pay, fightsRemaining: 4, exclusivity: true, endDate: getContractEndDate(newState.currentDate, 4) }
        };
        newState.news.unshift({
          id: uuidv4(),
          date: newState.currentDate,
          type: 'contract' as const,
          title: t($ => $.generated.tournament.signingTitle, { fighter: toSign.lastName }),
          content: t($ => $.generated.tournament.signing, {
            fighter: `${toSign.firstName} ${toSign.lastName}`,
            weightClass: formatWeightClass(weightClass, language)
          })
        });
        currentEligibleCount++;
        signedCount++;
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
  loserId: string | null,
  language: Language = readLanguage()
): GameState {
  const t = fixedT(language);
  const tourney = state.tournaments[tournamentId];
  if (!tourney) return state;
  
  const slotIdx = tourney.fights.findIndex(f => f.id === slotId);
  if (slotIdx === -1) return state;
  const slot = tourney.fights[slotIdx];
  // ponytail: tournament draws advance by bracket order; upgrade to overtime/rematch if draw-specific gameplay is added.
  const advancementWinnerId = winnerId ?? slot.redFighterId ?? null;
  const advancementLoserId = loserId ?? (advancementWinnerId === slot.redFighterId ? slot.blueFighterId : slot.redFighterId) ?? null;
  const usedDrawTiebreaker = winnerId === null && advancementWinnerId !== null;
  const unknown = t($ => $.generated.tournament.unknown);

  if (slot.isCompleted && slot.winnerId === advancementWinnerId) {
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
    winnerId: advancementWinnerId,
    loserId: advancementLoserId,
    isCompleted: true
  };

  if (usedDrawTiebreaker) {
    const fighter = newState.fighters[advancementWinnerId!];
    updatedTourney.notes = [...(updatedTourney.notes || []), t($ => $.generated.tournament.drawTiebreaker, {
      fighter: fighter ? `${fighter.firstName} ${fighter.lastName}` : unknown,
      round: formatRound(slot.round, language)
    })];
  }
  
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
      
      updatedTourney.notes = [...(updatedTourney.notes || []), t($ => $.generated.tournament.quarterfinalsCompleteNote)];
      
      newState.news = [
        {
          id: uuidv4(),
          date: state.currentDate,
          type: 'general' as const,
          title: t($ => $.generated.tournament.semifinalistsTitle, { name: updatedTourney.name }),
          content: t($ => $.generated.tournament.semifinalists, { name: updatedTourney.name })
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
      const names = (f1 ? f1.lastName : unknown) + ' vs ' + (f2 ? f2.lastName : unknown);

      updatedTourney.notes = [...(updatedTourney.notes || []), t($ => $.generated.tournament.semifinalsCompleteNote, { fighters: names })];
      
      newState.news = [
        {
          id: uuidv4(),
          date: state.currentDate,
          type: 'general' as const,
          title: t($ => $.generated.tournament.finalistsTitle, { name: updatedTourney.name }),
          content: t($ => $.generated.tournament.finalists, {
            red: f1 ? `${f1.firstName} ${f1.lastName}` : unknown,
            blue: f2 ? `${f2.firstName} ${f2.lastName}` : unknown
          })
        },
        ...newState.news
      ];
    }
  } else if (slot.round === 'final') {
    updatedTourney.status = 'completed';
    updatedTourney.winnerId = advancementWinnerId;
    updatedTourney.completedDate = state.currentDate;

    const champ = advancementWinnerId ? newState.fighters[advancementWinnerId] : null;
    const champName = champ ? `${champ.firstName} ${champ.lastName}` : unknown;

    updatedTourney.notes = [...(updatedTourney.notes || []), t($ => $.generated.tournament.winnerNote, { fighter: champName, date: state.currentDate })];
    
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
      updatedChamp.history = [t($ => $.generated.tournament.winnerHistory, {
        opponent: advancementLoserId ? newState.fighters[advancementLoserId]?.lastName || unknown : unknown
      }), ...updatedChamp.history].slice(0, 5);
      
      newState.fighters[champ.id] = updatedChamp;
    }
    
    if (advancementLoserId) {
      const runnerUp = newState.fighters[advancementLoserId];
      if (runnerUp) {
        const updatedRunner = { ...runnerUp };
        updatedRunner.rankingScore = (updatedRunner.rankingScore || 1000) + runnerBonus;
        updatedRunner.popularity = Math.min(100, updatedRunner.popularity + runnerPop);
        newState.fighters[advancementLoserId] = updatedRunner;
      }
    }

    if (updatedTourney.scope === 'international' && updatedTourney.internationalTier && updatedTourney.winnerBeltId && advancementWinnerId) {
      const tier = updatedTourney.internationalTier;
      const previous = newState.internationalTitles[tier][updatedTourney.weightClass];
      const isDefense = previous.undisputedChampionId === advancementWinnerId;
      newState.internationalTitles = {
        ...newState.internationalTitles,
        [tier]: {
          ...newState.internationalTitles[tier],
          [updatedTourney.weightClass]: {
            ...previous,
            undisputedChampionId: advancementWinnerId,
            undisputedDefenses: isDefense ? previous.undisputedDefenses + 1 : 0,
            lastUndisputedDefenseDate: isDefense ? state.currentDate : null,
            status: 'active'
          }
        }
      };
      newState.titleHistory = isDefense
        ? newState.titleHistory.map(item => item.scope === 'international' && item.promotionId === null && item.beltId === updatedTourney.winnerBeltId && item.fighterId === advancementWinnerId && item.status === 'active' ? { ...item, defenses: item.defenses + 1 } : item)
        : [
            ...newState.titleHistory.map(item => item.scope === 'international' && item.promotionId === null && item.beltId === updatedTourney.winnerBeltId && item.status === 'active' ? { ...item, status: 'lost' as const, dateLost: state.currentDate, lostToFighterId: advancementWinnerId } : item),
            { id: uuidv4(), promotionId: null, scope: 'international' as const, beltId: updatedTourney.winnerBeltId, weightClass: updatedTourney.weightClass, fighterId: advancementWinnerId, dateWon: state.currentDate, dateLost: null, defenses: 0, wonFromFighterId: previous.undisputedChampionId, status: 'active' as const, beltType: 'undisputed' as const }
          ];
      newState.fighters[advancementWinnerId] = { ...newState.fighters[advancementWinnerId], isChampion: true };
    }

    newState.news = [
      {
        id: uuidv4(),
        date: state.currentDate,
        type: 'general' as const,
        title: t($ => $.generated.tournament.winnerTitle, { fighter: champName, name: updatedTourney.name }),
        content: t($ => $.generated.tournament.winner, {
          fighter: champName,
          opponent: advancementLoserId ? newState.fighters[advancementLoserId]?.lastName || unknown : unknown,
          titleShot: updatedTourney.titleShotPromised ? t($ => $.generated.tournament.titleShotGuaranteed) : ''
        })
      },
      ...newState.news
    ];
  }
  
  newState.tournaments[tournamentId] = updatedTourney;
  return newState;
}

export function runAutopilotTournaments(state: GameState, language: Language = readLanguage()): GameState {
  const t = fixedT(language);
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
      const delayTitles: string[] = [
        fixedT('en')($ => $.generated.tournament.autopilotDelayedTitle, { name: activeTourney.name }),
        fixedT('vi')($ => $.generated.tournament.autopilotDelayedTitle, { name: activeTourney.name })
      ];
      const lastDelayNews = newState.news.find(n => delayTitles.includes(n.title) && n.content?.includes(activeTourney.name));
      const lastDelayNewsDate = lastDelayNews ? lastDelayNews.date : null;
      const daysSinceLastNews = lastDelayNewsDate 
        ? getDaysDiff(newState.currentDate, lastDelayNewsDate)
        : 999;
        
      if (daysSinceLastNews >= 90) {
        newState.news.unshift({
          id: uuidv4(),
          date: newState.currentDate,
          title: t($ => $.generated.tournament.autopilotDelayedTitle, { name: activeTourney.name }),
          content: t($ => $.generated.tournament.autopilotDelayed, { name: activeTourney.name, count: ageDays }),
          type: 'general'
        });
      }
      
      // 2. Cancellation recovery if planned and impossible
      if (activeTourney.status === 'planned') {
        const signedCount = Object.values(newState.fighters).filter(
          f => f.weightClass === activeTourney.weightClass && f.contract && f.careerPhase !== 'retired' && !f.injuryStatus
        ).length;
        const totalFA = Object.values(newState.fighters).filter(f => !f.contract && f.careerPhase !== 'retired' && f.weightClass === activeTourney.weightClass).length;
        const required = activeTourney.format === 'eight_man' ? 11 : 6;
        
        // If we don't have enough fighters and cannot sign (broke or no FA available)
        if (signedCount + totalFA < required || (newState.promotion.money < 50000 && signedCount < required)) {
          try {
            newState = cancelTournament(newState, activeTourney.id, language);
            // Clear target class
            newState.autopilot.targetTournamentWeightClass = null;
            newState.news.unshift({
              id: uuidv4(),
              date: newState.currentDate,
              title: t($ => $.generated.tournament.autopilotCancelledTitle, { name: activeTourney.name }),
              content: t($ => $.generated.tournament.autopilotCancelled, { name: activeTourney.name }),
              type: 'general'
            });
            return newState;
          } catch (err) {
            // Ignore
          }
        }
      }
      
      // 3. Reserve emergency signing recovery if active and out of reserves
      if (!isContractMarketOpen(newState) && activeTourney.status === 'active' && (!activeTourney.reserveFighterIds || activeTourney.reserveFighterIds.length === 0)) {
        const tournamentFighterIds = new Set([
          ...activeTourney.participants.map(participant => participant.fighterId),
          ...(activeTourney.usedReserveFighterIds || []),
          ...activeTourney.fights.flatMap(fight => [fight.redFighterId, fight.blueFighterId].filter((id): id is string => Boolean(id)))
        ]);
        const freeAgents = Object.values(newState.fighters)
          .filter(f => !f.contract && f.careerPhase !== 'retired' && f.weightClass === activeTourney.weightClass && !f.injuryStatus && !tournamentFighterIds.has(f.id))
          .sort((a, b) => b.popularity - a.popularity || b.potential - a.potential);
          
        if (freeAgents.length > 0 && newState.promotion.money > 30000) {
          const candidate = freeAgents[0];
          const pay = 5000 + (candidate.popularity * 100);
          newState.fighters[candidate.id] = {
            ...candidate,
            contract: { promotionId: getPlayerPromotionId(newState), payPerFight: pay, winBonus: pay, fightsRemaining: 4, exclusivity: true, endDate: getContractEndDate(newState.currentDate, 4) }
          };
          
          const updated = { ...newState.tournaments[activeTourney.id] };
          updated.reserveFighterIds = [...(updated.reserveFighterIds || []), candidate.id];
          updated.notes = [...(updated.notes || []), t($ => $.generated.tournament.emergencyReserveNote, { fighter: candidate.lastName, date: newState.currentDate })];
          newState.tournaments[activeTourney.id] = updated;
          
          newState.news.unshift({
            id: uuidv4(),
            date: newState.currentDate,
            title: t($ => $.generated.tournament.emergencySigningTitle, { fighter: candidate.lastName }),
            content: t($ => $.generated.tournament.emergencySigning, {
              fighter: `${candidate.firstName} ${candidate.lastName}`,
              name: activeTourney.name
            }),
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
             newState = scheduleQuarterfinals(newState, activeTourney.id, upcomingEvent.id, language);
           } else {
             newState = scheduleSemifinals(newState, activeTourney.id, upcomingEvent.id, language);
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
      const fourManSemifinals = activeTourney.fights.filter(f => f.round === 'semifinal');
      const retryFourManSemifinals = !isEightMan && fourManSemifinals.every(f => !f.isCompleted && !f.eventId);
      if (retryFourManSemifinals) {
        const upcomingEvent = Object.values(newState.events).find(e => !e.isCompleted && e.date >= state.currentDate);
        if (upcomingEvent) {
          try {
            newState = scheduleSemifinals(newState, activeTourney.id, upcomingEvent.id, language);
          } catch (e) {
            // Retry on the next eligible event.
          }
        }
        return newState;
      }

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
                newState = scheduleSemifinals(newState, activeTourney.id, upcomingEvent.id, language);
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
              newState = scheduleFinal(newState, activeTourney.id, upcomingEvent.id, language);
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
        const freeAgentsCount = Object.values(newState.fighters).filter(f => !f.contract && f.careerPhase !== 'retired' && f.weightClass === wc).length;
        const wcFighters = Object.values(newState.fighters).filter(f => 
          f.weightClass === wc &&
          f.contract &&
          f.careerPhase !== 'retired' &&
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
              score += 30;
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
  if (targetWc) {
    newState = maintainTournamentRosterDepth(newState, targetWc, language);
  }

  return newState;
}

export function evaluateAndCreateTournament(
  state: GameState,
  preferredFormat?: TournamentFormat,
  language: Language = readLanguage()
): { state: GameState; created: boolean; tournamentId?: string; errorReason?: string } {
  let newState = { ...state };

  if (newState.promotion.money < 150000) {
    return { state: newState, created: false, errorReason: "Insufficient promotion funds." };
  }

  const debts = getPendingTitleShotDebts(newState);
  const urgentDebts = debts.filter(d => d.status === 'pending');
  if (urgentDebts.length > 0) {
    return { state: newState, created: false, errorReason: "Urgent title shot debts are pending." };
  }
  
  const completedTourneys = Object.values(newState.tournaments).filter(t => t.status === 'completed');
  if (completedTourneys.length > 0) {
    const lastCompleted = completedTourneys.sort((a, b) => new Date(b.completedDate || '').getTime() - new Date(a.completedDate || '').getTime())[0];
    if (lastCompleted && lastCompleted.completedDate) {
      const diffDays = Math.abs(new Date(newState.currentDate).getTime() - new Date(lastCompleted.completedDate).getTime()) / (1000 * 60 * 60 * 24);
      const requiredCooldown = lastCompleted.format === 'eight_man' ? 540 : 270;
      if (diffDays < requiredCooldown) {
        return { state: newState, created: false, errorReason: `Grand Prix cooldown active (${Math.round(requiredCooldown - diffDays)} days remaining).` };
      }
    }
  }

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
        const freeAgentsCount = Object.values(newState.fighters).filter(f => !f.contract && f.careerPhase !== 'retired' && f.weightClass === wc).length;
        const wcFighters = Object.values(newState.fighters).filter(f => 
          f.weightClass === wc &&
          f.contract &&
          f.careerPhase !== 'retired' &&
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
              score += 30;
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
  }

  if (!targetWc) {
    return { state: newState, created: false, errorReason: "No suitable division found for tournament." };
  }

  // Ensure depth is built
  newState = maintainTournamentRosterDepth(newState, targetWc, language);

  const canRunEightMan = newState.promotion.reputation >= 60 && newState.promotion.money >= 200000;
  let format: TournamentFormat = 'four_man';
  if (canRunEightMan) {
    const everCompleted8man = Object.values(newState.tournaments).some(t => t.format === 'eight_man' && t.status === 'completed');
    let eightManChance = 0.25;
    if (newState.promotion.reputation >= 75 && newState.promotion.money >= 500000) {
      eightManChance = 0.60;
      if (!everCompleted8man) {
        eightManChance = 0.90;
      }
    }
    if (preferredFormat === 'eight_man') {
      eightManChance = 1.0;
    }
    format = Math.random() < eightManChance ? 'eight_man' : 'four_man';
  }

  const promotionId = getPlayerPromotionId(newState);
  const wcFighters = Object.values(newState.fighters).filter(f =>
    f.weightClass === targetWc &&
    isFighterInPromotion(f, promotionId) &&
    !f.injuryStatus &&
    (!f.medicalSuspension || f.medicalSuspension.daysRemaining <= 0) &&
    !f.isChampion &&
    !isFighterBookedUpcoming(newState, f.id)
  );

  if (format === 'eight_man' && wcFighters.length < 11) {
    format = 'four_man';
  }

  const finalRequiredCount = format === 'eight_man' ? 11 : 6;
  if (wcFighters.length < finalRequiredCount) {
    return { state: newState, created: false, errorReason: `Insufficient healthy/available fighters in ${targetWc} (have ${wcFighters.length}, need ${finalRequiredCount}).` };
  }

  const sortedFighters = wcFighters.sort((a, b) => (b.rankingScore || 0) - (a.rankingScore || 0));
  const slicedFighters = sortedFighters.slice(0, finalRequiredCount);
  
  const participantCount = format === 'eight_man' ? 8 : 4;
  const participantIds = slicedFighters.slice(0, participantCount).map(f => f.id);
  const reserveIds = slicedFighters.slice(participantCount).map(f => f.id);
  
  const name = getTournamentBranding(targetWc, format).name;
  
  try {
    newState = createGrandPrixTournament(newState, {
      weightClass: targetWc,
      name,
      titleShotPromised: true,
      format,
      participantIds,
      reserveIds
    }, language);
    
    const newT = Object.values(newState.tournaments).find(t => t.weightClass === targetWc && t.status === 'planned');
    
    newState.autopilot.targetTournamentWeightClass = null;
    return { state: newState, created: true, tournamentId: newT?.id, errorReason: undefined };
  } catch (e: any) {
    return { state: newState, created: false, errorReason: `Tournament creation failed: ${e?.message}` };
  }
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
      const scheduledFights = t.fights.filter(f => f.eventId && !f.isCompleted);
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

    // 12. titleShotUsed tournament winner should not still have fighter.titleShotPromised unless another promise remains
    if (t.titleShotUsed && t.winnerId) {
      const winner = state.fighters[t.winnerId];
      const otherUnused = Object.values(state.tournaments || {}).some(other => other.id !== t.id && other.status === 'completed' && other.titleShotPromised && !other.titleShotUsed && other.winnerId === t.winnerId);
      if (winner && winner.titleShotPromised && !otherUnused) {
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

export function bindTournamentToCalendarSlots(state: GameState, tournamentId: string, language: Language = readLanguage()): GameState {
  const t = fixedT(language);
  const newState = { ...state };
  const tournament = newState.tournaments[tournamentId];
  if (!tournament) return newState;

  const year = new Date(newState.currentDate).getFullYear();
  if (!newState.seasonPlans) newState.seasonPlans = {};
  if (!newState.seasonPlans[year]) {
    newState.seasonPlans[year] = generateSeasonPlan(newState, year);
  }

  const plan = newState.seasonPlans[year];
  const slots = [...plan.slots];

  const neededRounds: TournamentRound[] = tournament.format === 'eight_man' 
    ? ['quarterfinal', 'semifinal', 'final'] 
    : ['semifinal', 'final'];

  const getAvailableFutureSlots = () => {
    return slots.filter(s => 
      s.status === 'planned' &&
      s.date >= state.currentDate &&
      !s.eventId &&
      (!s.tournamentId || s.tournamentId === tournament.id)
    );
  };

  let matchingSlots = getAvailableFutureSlots().filter(s => 
    s.type === 'grand_prix_round' && 
    s.targetWeightClass === tournament.weightClass
  );

  if (matchingSlots.length < neededRounds.length) {
    const convertableSlots = getAvailableFutureSlots().filter(s => 
      s.type === 'regular_event' || s.type === 'title_fight_card' || s.type === 'grand_prix_window'
    );
    
    const neededToConvert = neededRounds.length - matchingSlots.length;
    for (let i = 0; i < Math.min(neededToConvert, convertableSlots.length); i++) {
      const slot = convertableSlots[i];
      const idx = slots.findIndex(s => s.id === slot.id);
      if (idx !== -1) {
        slots[idx] = {
          ...slots[idx],
          type: 'grand_prix_round',
          targetWeightClass: tournament.weightClass,
        };
      }
    }
    
    matchingSlots = slots.filter(s => 
      s.status === 'planned' &&
      s.date >= state.currentDate &&
      !s.eventId &&
      s.type === 'grand_prix_round' && 
      s.targetWeightClass === tournament.weightClass &&
      (!s.tournamentId || s.tournamentId === tournament.id)
    );
  }

  matchingSlots.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (matchingSlots.length >= neededRounds.length) {
    neededRounds.forEach((round, i) => {
      const slotIdx = slots.findIndex(s => s.id === matchingSlots[i].id);
      if (slotIdx !== -1) {
        slots[slotIdx] = {
          ...slots[slotIdx],
          tournamentId: tournament.id,
          tournamentRound: round,
          notes: [...(slots[slotIdx].notes || []), t($ => $.generated.tournament.calendarLinked, { name: tournament.name })]
        };
      }
    });
  } else {
    let baseDate = new Date(state.currentDate);
    neededRounds.forEach((round, i) => {
      const alreadyBound = slots.some(s => s.tournamentId === tournament.id && s.tournamentRound === round);
      if (alreadyBound) return;

      let offsetDays = 28;
      if (round === 'semifinal' && tournament.format === 'eight_man') {
        offsetDays = 42;
      } else if (round === 'final') {
        offsetDays = 42;
      }

      baseDate.setDate(baseDate.getDate() + offsetDays);
      const slotDateStr = baseDate.toISOString().split('T')[0];

      const newSlot: SeasonCalendarSlot = {
        id: uuidv4(),
        year: baseDate.getFullYear(),
        date: slotDateStr,
        type: 'grand_prix_round',
        status: 'planned',
        targetWeightClass: tournament.weightClass,
        tournamentId: tournament.id,
        tournamentRound: round,
        priority: 1,
        notes: [t($ => $.generated.tournament.calendarCreated, { name: tournament.name })]
      };
      slots.push(newSlot);
    });
  }

  slots.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  newState.seasonPlans[year] = {
    ...plan,
    slots
  };

  return newState;
}

export function linkScheduledRoundToSlot(state: GameState, tournamentId: string, round: TournamentRound, eventId: string, language: Language = readLanguage()): GameState {
  const t = fixedT(language);
  const newState = { ...state };
  if (!newState.seasonPlans) return newState;
  const event = newState.events[eventId];
  if (!event) return newState;
  
  for (const yearStr in newState.seasonPlans) {
    const plan = newState.seasonPlans[Number(yearStr)];
    if (!plan) continue;
    const slotIndex = plan.slots.findIndex(s => s.tournamentId === tournamentId && s.tournamentRound === round);
    if (slotIndex !== -1) {
      const slots = [...plan.slots];
      const slot = slots[slotIndex];
      const originalDate = slot.date;
      const eventDate = event.date;
      const notes = [...(slot.notes || [])];
      if (originalDate !== eventDate) {
        notes.push(t($ => $.generated.tournament.calendarRescheduled, { from: originalDate, to: eventDate }));
      }
      notes.push(t($ => $.generated.tournament.calendarScheduled, { event: eventId, date: eventDate }));
      
      slots[slotIndex] = {
        ...slot,
        eventId,
        status: 'scheduled' as const,
        date: eventDate,
        notes
      };
      slots.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      newState.seasonPlans[Number(yearStr)] = { ...plan, slots };
      break;
    }
  }
  return newState;
}

export function handleDelayedRoundCalendarSlot(state: GameState, tournamentId: string, round: TournamentRound, earliestDate: string, reason: string, language: Language = readLanguage()): GameState {
  const t = fixedT(language);
  const newState = { ...state };
  if (!newState.seasonPlans) return newState;

  for (const yearStr in newState.seasonPlans) {
    const plan = newState.seasonPlans[Number(yearStr)];
    if (!plan) continue;
    const slotIdx = plan.slots.findIndex(s => s.tournamentId === tournamentId && s.tournamentRound === round);
    if (slotIdx !== -1) {
      const slots = [...plan.slots];
      const slot = slots[slotIdx];
      
      const newNote = t($ => $.generated.tournament.calendarDelayed, { reason, date: earliestDate });
      const notes = [...(slot.notes || [])];
      if (!notes.includes(newNote)) {
        notes.push(newNote);
      }
      
      let newDate = slot.date;
      if (earliestDate > slot.date) {
        newDate = earliestDate;
      }
      
      slots[slotIdx] = {
        ...slot,
        date: newDate,
        eventId: undefined,
        status: 'planned' as const,
        notes
      };
      
      newState.seasonPlans[Number(yearStr)] = { ...plan, slots };
      break;
    }
  }
  return newState;
}

export function repairScheduledTournamentRound(
  state: GameState,
  tournamentId: string,
  round: 'quarterfinal' | 'semifinal' | 'final',
  eventId: string,
  language: Language = readLanguage()
): GameState {
  const t = fixedT(language);
  const roundLabel = formatRound(round, language);
  const tourney = state.tournaments[tournamentId];
  if (!tourney) throw new Error("Tournament not found");

  const event = state.events[eventId];
  if (!event || event.isCompleted) {
    throw new Error("Invalid or completed event selected.");
  }

  const slots = tourney.fights.filter(f => f.round === round && !f.isCompleted);
  if (slots.length === 0) return state;
  const slotIds = new Set(slots.map(slot => slot.id));

  let newState = {
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
    
    const isInactive = !fighter.contract || fighter.careerPhase === 'retired';
    const isInjured = fighter.injuryStatus !== null;
    const isSuspendedLong = fighter.medicalSuspension && fighter.medicalSuspension.daysRemaining > 35;
    const isSuspendedShort = fighter.medicalSuspension && fighter.medicalSuspension.daysRemaining <= 35 && fighter.medicalSuspension.daysRemaining > 0;
    const isFatigued = fighter.fatigue > 75;
    
    const isBookedElsewhere = Object.values(newState.events).some(e => 
      !e.isCompleted && e.id !== eventId && e.fights.some(f => f.redCornerId === fighterId || f.blueCornerId === fighterId)
    );
    
    if (isSuspendedShort || isBookedElsewhere) {
      delayReason = isSuspendedShort
        ? t($ => $.generated.tournament.suspendedDelay, { fighter: fighter.lastName, count: fighter.medicalSuspension?.daysRemaining })
        : t($ => $.generated.tournament.bookedDelay, { fighter: fighter.lastName });
      delayFighterId = fighter.id;
      const delayDays = isSuspendedShort ? fighter.medicalSuspension!.daysRemaining : 28;
      delayEarliestDate = addDaysStr(newState.currentDate, delayDays);
      return fighterId;
    }
    
    if (isInactive || isInjured || isSuspendedLong || isFatigued) {
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
        
        const isCurrentParticipant = updatedTourney.participants.some(p => p.fighterId === resId);
        const inAnySlot = updatedTourney.fights.some(s => s.redFighterId === resId || s.blueFighterId === resId);
        const alreadyUsed = updatedTourney.usedReserveFighterIds?.includes(resId) || false;
        
        return !reserveUnavailable && !isCurrentParticipant && !inAnySlot && !alreadyUsed;
      });
      
      if (unusedReserveId) {
        if (!updatedTourney.usedReserveFighterIds) {
          updatedTourney.usedReserveFighterIds = [];
        }
        updatedTourney.usedReserveFighterIds.push(unusedReserveId);
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
        updatedTourney.notes = [...(updatedTourney.notes || []), t($ => $.generated.tournament.replacementNote, {
          replacement: newF.lastName,
          original: origF.lastName,
          date: state.currentDate,
          round: roundLabel
        })];
        
        newState.news = [
          {
            id: uuidv4(),
            date: state.currentDate,
            type: 'general' as const,
            title: t($ => $.generated.tournament.replacementTitle, { replacement: newF.lastName, round: roundLabel }),
            content: t($ => $.generated.tournament.replacement, {
              original: `${origF.firstName} ${origF.lastName}`,
              replacement: `${newF.firstName} ${newF.lastName}`,
              round: roundLabel
            })
          },
          ...newState.news
        ];
        
        return unusedReserveId;
      } else {
        delayReason = t($ => $.generated.tournament.unavailableDelay, { fighter: fighter.lastName });
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

  // Remove existing unfinished tournament fights for this round from the event
  updatedEvent.fights = updatedEvent.fights.filter(f => !slotIds.has(f.tournamentFightSlotId ?? ''));

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
    
    updatedTourney.notes = [...(updatedTourney.notes || []), t($ => $.generated.tournament.delayedNote, { round: roundLabel, reason: delayReason })];
    
    const isNewDelay = tourney.roundDelayReason !== delayReason || tourney.earliestRoundDate !== delayEarliestDate;
    if (isNewDelay) {
      newState = handleDelayedRoundCalendarSlot(newState, tournamentId, round, delayEarliestDate, delayReason, language);
      newState.news = [
        {
          id: uuidv4(),
          date: state.currentDate,
          type: 'general' as const,
          title: t($ => $.generated.tournament.delayedTitle, { name: updatedTourney.name, round: roundLabel }),
          content: t($ => $.generated.tournament.delayed, {
            name: updatedTourney.name,
            round: roundLabel,
            reason: delayReason,
            date: delayEarliestDate
          })
        },
        ...newState.news
      ];
    }
    
    // Clear eventId/fightId from the slot since it's delayed (unscheduled)
    updatedTourney.fights = updatedTourney.fights.map(f => {
      if (slotIds.has(f.id)) {
        return {
          ...f,
          eventId: undefined,
          fightId: undefined
        };
      }
      return f;
    });

    newState.tournaments[tournamentId] = updatedTourney;
    newState.events[eventId] = {
      ...updatedEvent,
      name: updatedEvent.name.replace(/CD GP (Quarterfinal|Semifinal|Final)/, 'Cage Dynasty')
    };
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
    if (slotIds.has(f.id)) {
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
  updatedTourney.notes = [...(updatedTourney.notes || []), t($ => $.generated.tournament.repairedNote, { round: roundLabel, event: updatedEvent.name, date: state.currentDate })];
  
  newState.tournaments[tournamentId] = updatedTourney;
  newState.events[eventId] = updatedEvent;
  
  return newState;
}
