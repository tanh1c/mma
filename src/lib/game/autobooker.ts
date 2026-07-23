import '../../i18n';
import { GameState, Event, FightMatchup, WeightClass, Fighter, CalendarSlotType, CalendarSlotStatus, SeasonCalendarSlot, SeasonPlan, TournamentRound } from '../../types/game';
import { v4 as uuidv4 } from 'uuid';
import { fixedT, formatCurrency, formatWeightClass, readLanguage, type Language } from '../localization';
import { calculateEventProjections } from './economy';
import { generateSeasonPlan, syncCalendarSlots } from './season';
import { scheduleTournamentRound, getPendingTitleShotDebts, isFighterBookedUpcoming, evaluateAndCreateTournament, bindTournamentToCalendarSlots, repairScheduledTournamentRound } from './tournament';
import { quickSimulateEvent } from '../engine';
import { getEventName } from '../branding';
import { getContractEndDate, isContractMarketOpen } from './contracts';
import { getPlayerPromotionId } from './leagues';
import { ensureEmergencyProspectPool, scoreObserverRosterCandidate, shouldObserverRenewFighter } from './careerEcosystem';
import { getFighterOverall } from './fighterRatings';
import { buildPromotionRankings } from './rankings';
import { hasPendingIncidentForEvent } from './drama';
import { refreshPromotionEconomy } from './promotionEconomy';

const EVENT_INTERVAL_DAYS = 28;
const OBSERVER_DIVISION_ROSTER_SIZE = 12;

function calculateDateDifference(d1: string, d2: string) {
  return Math.abs(new Date(d1).getTime() - new Date(d2).getTime()) / (1000 * 3600 * 24);
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function hasContractThrough(fighter: Fighter, eventDate: string): boolean {
  return !!fighter.contract && fighter.contract.fightsRemaining > 0 && fighter.contract.endDate >= eventDate;
}

function hasTournamentFights(event: Event): boolean {
  return event.fights.some(f => Boolean(f.tournamentId && f.tournamentRound));
}

function rescheduleGrandPrixWindow(
  state: GameState,
  sourceSlot: SeasonCalendarSlot,
  reason: string,
  language: Language
) {
  const t = fixedT(language);
  const hasFutureWindow = Object.values(state.seasonPlans || {}).some(plan =>
    plan.slots.some(slot =>
      slot.id !== sourceSlot.id &&
      slot.type === 'grand_prix_window' &&
      slot.status === 'planned' &&
      slot.date > state.currentDate
    )
  );
  if (hasFutureWindow) return;

  let date = addDays(state.currentDate, EVENT_INTERVAL_DAYS * 2);
  const occupiedDates = new Set(Object.values(state.seasonPlans || {}).flatMap(plan => plan.slots.map(slot => slot.date)));
  while (occupiedDates.has(date)) date = addDays(date, 7);

  const year = new Date(date).getFullYear();
  if (!state.seasonPlans[year]) {
    state.seasonPlans[year] = generateSeasonPlan(state, year);
  }
  if (state.seasonPlans[year].slots.some(slot => slot.type === 'grand_prix_window' && slot.status === 'planned' && slot.date > state.currentDate)) {
    return;
  }

  state.seasonPlans[year].slots.push({
    id: uuidv4(),
    year,
    date,
    type: 'grand_prix_window',
    status: 'planned',
    priority: sourceSlot.priority,
    notes: [t($ => $.generated.autobooker.gpWindowRescheduled, { date: sourceSlot.date, reason })]
  });
  state.seasonPlans[year].slots.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function cancelFailedGrandPrixEvent(
  state: GameState,
  eventId: string,
  tournamentId: string,
  round: TournamentRound,
  reason: string,
  language: Language
): GameState {
  const t = fixedT(language);
  let newState = {
    ...state,
    events: { ...state.events },
    tournaments: { ...state.tournaments },
    news: [...state.news]
  };

  const event = newState.events[eventId];
  delete newState.events[eventId];

  const tourney = newState.tournaments[tournamentId];
  if (tourney) {
    newState.tournaments[tournamentId] = {
      ...tourney,
      fights: tourney.fights.map(slot => slot.eventId === eventId ? { ...slot, eventId: undefined, fightId: undefined } : slot),
      roundDelayReason: reason,
      delayedRound: round,
      earliestRoundDate: addDays(newState.currentDate, 14),
      notes: [...(tourney.notes || []), t($ => $.generated.autobooker.roundDelayed, { round, reason })]
    };
  }

  if (newState.seasonPlans) {
    for (const yearStr in newState.seasonPlans) {
      const year = Number(yearStr);
      const plan = newState.seasonPlans[year];
      if (!plan) continue;

      const slots = plan.slots.map(slot => {
        if (slot.eventId !== eventId) return slot;
        return {
          ...slot,
          eventId: undefined,
          status: 'planned' as const,
          date: addDays(newState.currentDate, 14),
          notes: [...(slot.notes || []), t($ => $.generated.autobooker.gpRoundDelayed, { reason })]
        };
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      newState.seasonPlans[year] = { ...plan, slots };
    }
  }

  if (event) {
    newState.news.unshift({
      id: uuidv4(),
      date: newState.currentDate,
      title: t($ => $.generated.autobooker.gpRoundDelayedTitle),
      content: t($ => $.generated.autobooker.gpRoundRemoved, { event: event.name, reason }),
      type: 'general' as const
    });
  }

  return newState;
}

export function autoBookEventsAndContracts(state: GameState, language: Language = readLanguage()): GameState {
  const t = fixedT(language);
  let newState = { ...state };

  // 1. Initialize & sync season plan for current year
  const currentYear = new Date(newState.currentDate).getFullYear();
  if (!newState.seasonPlans) {
    newState.seasonPlans = {};
  }
  if (!newState.seasonPlans[currentYear]) {
    newState.seasonPlans[currentYear] = generateSeasonPlan(newState, currentYear);
  }
  
  // Sync slot completions/misses
  newState = syncCalendarSlots(newState);
  const plan = newState.seasonPlans[currentYear];

  // 1.5. Plan title-shot debts into calendar slots
  const debts = getPendingTitleShotDebts(newState);
  debts.forEach(d => {
    const winner = newState.fighters[d.fighterId];
    if (!winner) return;

    const alreadyPlanned = plan.slots.some(s => 
      s.targetWeightClass === d.weightClass && 
      (s.type === 'title_fight_card' || s.type === 'tentpole_event') && 
      (s.status === 'planned' || s.status === 'scheduled')
    );

    if (!alreadyPlanned) {
      const nextSlot = plan.slots.find(s => 
        (s.type === 'title_fight_card' || s.type === 'tentpole_event') && 
        s.status === 'planned' && 
        !s.targetWeightClass
      );

      if (nextSlot) {
        nextSlot.targetWeightClass = d.weightClass;
        nextSlot.notes = [...(nextSlot.notes || []), t($ => $.generated.autobooker.reservedTitleShot, { fighter: winner.lastName })];
      } else if (d.daysPending > 180) {
        const insertDate = addDays(newState.currentDate, 28);
        const newSlot: SeasonCalendarSlot = {
          id: uuidv4(),
          year: currentYear,
          date: insertDate,
          type: 'title_fight_card',
          status: 'planned',
          targetWeightClass: d.weightClass,
          priority: 4,
          notes: [t($ => $.generated.autobooker.emergencyTitleSlot, { fighter: winner.lastName, count: d.daysPending })]
        };
        
        plan.slots.push(newSlot);
        plan.slots.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      }
    }
    
    const title = newState.titles[d.weightClass];
    if (title && title.undisputedChampionId) {
      const champ = newState.fighters[title.undisputedChampionId];
      if (champ && (champ.injuryStatus || (champ.medicalSuspension && champ.medicalSuspension.daysRemaining > 0))) {
        const reservedSlot = plan.slots.find(s => 
          s.targetWeightClass === d.weightClass && 
          (s.status === 'planned' || s.status === 'scheduled')
        );
        if (reservedSlot) {
          const delayReason = champ.injuryStatus
            ? t($ => $.generated.autobooker.championInjured, { fighter: champ.lastName, injury: champ.injuryStatus.type })
            : t($ => $.generated.autobooker.championSuspended, { fighter: champ.lastName, count: champ.medicalSuspension?.daysRemaining ?? 0 });
          const noteText = t($ => $.generated.autobooker.championUnavailable, { reason: delayReason });
          if (!reservedSlot.notes) reservedSlot.notes = [];
          if (!reservedSlot.notes.includes(noteText)) {
            reservedSlot.notes.push(noteText);
          }
        }
      }
    }
  });

  // March safeguard: If current date is March or later and no completed events this year, force a planned slot now
  const currMonth = new Date(newState.currentDate).getMonth();
  if (currMonth >= 2) {
    const completedThisYear = plan.slots.filter(s => s.status === 'completed').length;
    if (completedThisYear === 0) {
      const firstPlanned = plan.slots.find(s => s.status === 'planned');
      if (firstPlanned) {
        firstPlanned.date = newState.currentDate;
        firstPlanned.type = 'regular_event';
        if (!firstPlanned.notes) firstPlanned.notes = [];
        const safeguardNote = t($ => $.generated.autobooker.marchSafeguard);
        if (!firstPlanned.notes.includes(safeguardNote)) {
          firstPlanned.notes.push(safeguardNote);
        }
      }
    }
  }

  // Pre-generate next year's plan in December so we don't have gaps
  if (currMonth === 11) {
    const nextYear = currentYear + 1;
    if (!newState.seasonPlans[nextYear]) {
      newState.seasonPlans[nextYear] = generateSeasonPlan(newState, nextYear);
    }
  }

  // Check if we need to wait for a scheduled next booking attempt date
  if (newState.autopilot.nextBookingAttemptDate && new Date(newState.currentDate).getTime() < new Date(newState.autopilot.nextBookingAttemptDate).getTime()) {
    // Cadence stall safeguard: if 90+ days without a completed event, force-clear delay
    const completedEvents = Object.values(newState.events).filter(e => e.isCompleted);
    const lastCompleted = completedEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    const daysSinceCompleted = lastCompleted 
      ? calculateDateDifference(newState.currentDate, lastCompleted.date)
      : 999;
    
    if (daysSinceCompleted >= 90) {
      newState.autopilot = { ...newState.autopilot, nextBookingAttemptDate: null };
    } else {
      return maintainRoster(newState, language);
    }
  }

  // Track last completed event date to check for recovery mode
  const completedEvents = Object.values(newState.events).filter(e => e.isCompleted);
  const lastCompleted = completedEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  const daysSinceCompleted = lastCompleted 
    ? calculateDateDifference(newState.currentDate, lastCompleted.date)
    : 999;
  
  const isRecovery = daysSinceCompleted >= 90;

  // Find approaching planned slots (within 28 days or overdue)
  const plannedSlots = plan.slots.filter(s => s.status === 'planned');
  plannedSlots.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const approachingSlot = plannedSlots.find(s => s.date <= addDays(newState.currentDate, 28));

  if (approachingSlot) {
    if (approachingSlot.type === 'grand_prix_window') {
      const activeOrPlannedGP = Object.values(newState.tournaments || {}).find(t => t.status === 'active' || t.status === 'planned');
      if (activeOrPlannedGP) {
        const reason = t($ => $.generated.autobooker.gpAlreadyActive, { name: activeOrPlannedGP.name });
        approachingSlot.type = 'regular_event';
        approachingSlot.notes = [...(approachingSlot.notes || []), t($ => $.generated.autobooker.gpWindowConverted, { reason })];
        rescheduleGrandPrixWindow(newState, approachingSlot, reason, language);
      } else {
        const isEightManPreferred = (approachingSlot.notes || []).some(n => n.includes("8-Man Preferred"));
        const prefFormat = isEightManPreferred ? 'eight_man' : undefined;
        
        const { state: updatedState, created, tournamentId, errorReason } = evaluateAndCreateTournament(newState, prefFormat, language);
        newState = updatedState;
        
        if (created && tournamentId) {
          const tournament = newState.tournaments[tournamentId];
          const firstRound: TournamentRound = tournament.format === 'eight_man' ? 'quarterfinal' : 'semifinal';
          
          approachingSlot.type = 'grand_prix_round';
          approachingSlot.targetWeightClass = tournament.weightClass;
          approachingSlot.tournamentRound = firstRound;
          approachingSlot.tournamentId = tournamentId;
          approachingSlot.notes = [...(approachingSlot.notes || []), t($ => $.generated.autobooker.gpCreatedLinked, { name: tournament.name })];

          newState = bindTournamentToCalendarSlots(newState, tournamentId, language);
        } else {
          const reason = errorReason || 'Evaluation failed';
          approachingSlot.type = 'regular_event';
          approachingSlot.notes = [...(approachingSlot.notes || []), t($ => $.generated.autobooker.gpWindowConversionFailed, { reason })];
          rescheduleGrandPrixWindow(newState, approachingSlot, reason, language);
        }
      }
    }

    if (approachingSlot.type === 'recovery_gap') {
      // Just mark it completed once the date is reached/passed
      if (newState.currentDate >= approachingSlot.date) {
        approachingSlot.status = 'completed';
        approachingSlot.notes = [...(approachingSlot.notes || []), t($ => $.generated.autobooker.restCompleted, { date: newState.currentDate })];
      }
      return maintainRoster(newState, language);
    }

    // Check if an event is already scheduled on this slot's date
    const existingEvent = Object.values(newState.events).find(e => e.date === approachingSlot.date && !e.isCompleted);
    if (existingEvent) {
      approachingSlot.eventId = existingEvent.id;
      approachingSlot.status = 'scheduled';
      if (approachingSlot.type === 'grand_prix_round' && approachingSlot.tournamentId && approachingSlot.tournamentRound && !hasTournamentFights(existingEvent)) {
        try {
          newState = scheduleTournamentRound(newState, approachingSlot.tournamentId, approachingSlot.tournamentRound, existingEvent.id, language);
        } catch (error) {
          newState = cancelFailedGrandPrixEvent(newState, existingEvent.id, approachingSlot.tournamentId, approachingSlot.tournamentRound, (error as Error).message, language);
        }
      }
      return maintainRoster(newState, language);
    }

    // Otherwise, let's schedule a new event!

    // Emergency roster signing under recovery mode
    if (isRecovery && !isContractMarketOpen(newState)) {
      const healthySigned = Object.values(newState.fighters).filter(f => f.contract && !f.injuryStatus && (!f.medicalSuspension || f.medicalSuspension.daysRemaining <= 0) && f.fatigue < 50);
      if (healthySigned.length < 6) {
        const freeAgents = Object.values(newState.fighters)
          .filter(f => !f.contract && f.careerPhase !== 'retired')
          .sort((a, b) => a.popularity - b.popularity);
        const neededCount = 6 - healthySigned.length;
        const toSign = freeAgents.slice(0, neededCount);
        toSign.forEach(fa => {
          const pay = 5000;
          newState.fighters[fa.id] = {
            ...fa,
            contract: { promotionId: getPlayerPromotionId(newState), payPerFight: pay, winBonus: pay, fightsRemaining: 4, exclusivity: true, endDate: getContractEndDate(newState.currentDate, 4) }
          };
          newState.news.unshift({
            id: uuidv4(),
            date: newState.currentDate,
            title: t($ => $.generated.autobooker.emergencySigningTitle, { fighter: fa.lastName }),
            content: t($ => $.generated.autobooker.emergencySigning, { fighter: `${fa.firstName} ${fa.lastName}` }),
            type: 'contract'
          });
        });
      }
    }

    // Create the event for this slot
    const newEvent = generateAutoEvent(
      newState,
      approachingSlot.date,
      isRecovery,
      approachingSlot.type,
      approachingSlot.targetWeightClass,
      approachingSlot.tournamentId,
      approachingSlot.tournamentRound,
      language
    );

    if (newEvent) {
      newState.events = { ...newState.events, [newEvent.id]: newEvent };
      newState.autopilot.nextBookingAttemptDate = null;
      
      // Update slot status
      const originalDate = approachingSlot.date;
      const eventDate = newEvent.date;
      const notes = [...(approachingSlot.notes || [])];
      if (originalDate !== eventDate) {
        notes.push(t($ => $.generated.autobooker.eventRescheduled, { from: originalDate, to: eventDate }));
      }
      approachingSlot.date = eventDate;
      approachingSlot.notes = notes;
      approachingSlot.eventId = newEvent.id;
      approachingSlot.status = 'scheduled';
      
      plan.slots.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      newState.news = [{
        id: uuidv4(),
        date: newState.currentDate,
        title: t($ => $.generated.autobooker.newEventTitle, { event: newEvent.name }),
        content: t($ => $.generated.autobooker.newEvent, { date: newEvent.date }),
        type: 'general'
      }, ...newState.news];

      // If it is a GP round, execute scheduleTournamentRound to add matchups
      if (approachingSlot.type === 'grand_prix_round' && approachingSlot.tournamentId && approachingSlot.tournamentRound) {
        try {
          newState = scheduleTournamentRound(
            newState,
            approachingSlot.tournamentId,
            approachingSlot.tournamentRound,
            newEvent.id,
            language
          );

          const scheduledEvent = newState.events[newEvent.id];
          if (!scheduledEvent || !hasTournamentFights(scheduledEvent)) {
            newState = cancelFailedGrandPrixEvent(
              newState,
              newEvent.id,
              approachingSlot.tournamentId,
              approachingSlot.tournamentRound,
              'Tournament round produced no valid tournament fights.',
              language
            );
          }
        } catch (e) {
          newState = cancelFailedGrandPrixEvent(
            newState,
            newEvent.id,
            approachingSlot.tournamentId,
            approachingSlot.tournamentRound,
            (e as Error).message,
            language
          );
        }
      }

      newState = checkAndCleanEmptyEvent(newState, newEvent.id, language);
      if (!newState.events[newEvent.id]) {
        newState.autopilot.nextBookingAttemptDate = addDays(newState.currentDate, 14);
      }
    } else {
      // Delay by 14 days and record reason
      newState.autopilot.nextBookingAttemptDate = addDays(newState.currentDate, 14);
      approachingSlot.notes = [...(approachingSlot.notes || []), t($ => $.generated.autobooker.bookingFailed, { date: newState.currentDate })];
      
      if (isRecovery) {
        const stallTitles: string[] = [fixedT('en')($ => $.generated.autobooker.cadenceStalledTitle), fixedT('vi')($ => $.generated.autobooker.cadenceStalledTitle)];
        const lastStallNews = newState.news.find(n => stallTitles.includes(n.title));
        if (!lastStallNews || calculateDateDifference(newState.currentDate, lastStallNews.date) >= 30) {
          newState.news.unshift({
            id: uuidv4(),
            date: newState.currentDate,
            title: t($ => $.generated.autobooker.cadenceStalledTitle),
            content: t($ => $.generated.autobooker.cadenceStalled),
            type: 'general'
          });
        }
      }
    }
  }

  // Record autobook delay notes for GP winners if champion is unavailable
  Object.values(newState.fighters).forEach(f => {
    if (f.contract && f.titleShotPromised) {
      const titleState = newState.titles[f.weightClass];
      if (titleState && titleState.undisputedChampionId) {
        const champ = newState.fighters[titleState.undisputedChampionId];
        let reason = '';
        if (!champ) reason = t($ => $.generated.autobooker.championMissing);
        else if (champ.injuryStatus) reason = t($ => $.generated.autobooker.championInjuredPending, { fighter: champ.lastName });
        else if (champ.medicalSuspension && champ.medicalSuspension.daysRemaining > 0) reason = t($ => $.generated.autobooker.championSuspendedPending, { fighter: champ.lastName });
        else if (champ.fatigue >= 50) reason = t($ => $.generated.autobooker.championFatiguedPending, { fighter: champ.lastName });

        if (reason) {
          const gp = Object.values(newState.tournaments || {}).find(t => t.weightClass === f.weightClass && t.winnerId === f.id && t.status === 'completed' && !t.titleShotUsed);
          if (gp) {
            const noteMsg = t($ => $.generated.autobooker.titleShotPending, { reason });
            const pendingPrefixes: string[] = [fixedT('en')($ => $.generated.autobooker.titleShotPending, { reason: '' }), fixedT('vi')($ => $.generated.autobooker.titleShotPending, { reason: '' })].map(value => value.trim());
            const exists = (gp.notes || []).some(n => pendingPrefixes.some(prefix => n.startsWith(prefix)));
            if (!exists || (gp.notes && gp.notes[gp.notes.length - 1] !== noteMsg)) {
              newState.tournaments[gp.id] = {
                ...gp,
                notes: [...(gp.notes || []), noteMsg]
              };
            }
          }
        }
      }
    }
  });

  // Handle contracts: renew champions and top contenders, sign if thin, release bloat
  newState = maintainRoster(newState, language);

  return newState;
}

export function maintainDeals(state: GameState, language: Language = readLanguage()): GameState {
  const t = fixedT(language);
  let newState = { ...state };
  
  // Deals system
  const availableSponsors = [
    { name: 'Combat Athletics Co.', tier: 'local' as const, req: 0, monthly: 15000, event: 5000, title: 2500 },
    { name: 'IronClad Nutrition', tier: 'regional' as const, req: 35, monthly: 45000, event: 15000, title: 7500 },
    { name: 'Apex Fight Gear', tier: 'national' as const, req: 65, monthly: 120000, event: 35000, title: 20000 }
  ];
  
  const availableMedia = [
    { name: 'FightNet Local', tier: 'local' as const, req: 0, monthly: 20000, event: 10000, highRating: 5000 },
    { name: 'CageCast Regional', tier: 'regional' as const, req: 35, monthly: 60000, event: 25000, highRating: 15000 },
    { name: 'Prime Combat Network', tier: 'national' as const, req: 65, monthly: 200000, event: 50000, highRating: 40000 }
  ];
  
  const rep = newState.promotion.reputation;
  
  // Clean up expired ones or replace them
  if (newState.sponsorDeals) {
    let activeSponsor = newState.sponsorDeals.find(d => d.isActive);
    if (!activeSponsor || new Date(newState.currentDate) >= new Date(activeSponsor.expiresDate)) {
      if (activeSponsor) activeSponsor.isActive = false; // Mark old as inactive
      
      const bestSponsor = [...availableSponsors].reverse().find(s => rep >= s.req);
      if (bestSponsor) {
         newState.sponsorDeals = [...newState.sponsorDeals, {
           id: uuidv4(),
           name: bestSponsor.name,
           tier: bestSponsor.tier,
           monthlyIncome: bestSponsor.monthly,
           bonusPerEvent: bestSponsor.event,
           bonusPerTitleFight: bestSponsor.title,
           expiresDate: addDays(newState.currentDate, 365),
           reputationRequirement: bestSponsor.req,
           isActive: true
         }];
         newState.news = [{
            id: uuidv4(), date: newState.currentDate, type: 'general',
            title: t($ => $.generated.autobooker.newSponsorTitle, { name: bestSponsor.name }),
            content: t($ => $.generated.autobooker.newSponsor, { tier: t($ => $.generated.autobooker[bestSponsor.tier === 'local' ? 'tierLocal' : bestSponsor.tier === 'regional' ? 'tierRegional' : 'tierNational']), name: bestSponsor.name })
         }, ...newState.news];
      }
    }
  }
  
  if (newState.mediaDeals) {
    let activeMedia = newState.mediaDeals.find(d => d.isActive);
    if (!activeMedia || new Date(newState.currentDate) >= new Date(activeMedia.expiresDate)) {
      if (activeMedia) activeMedia.isActive = false;
      
      const bestMedia = [...availableMedia].reverse().find(s => rep >= s.req);
      if (bestMedia) {
         newState.mediaDeals = [...newState.mediaDeals, {
           id: uuidv4(),
           name: bestMedia.name,
           tier: bestMedia.tier,
           monthlyIncome: bestMedia.monthly,
           bonusPerEvent: bestMedia.event,
           bonusForHighRatedEvent: bestMedia.highRating,
           expiresDate: addDays(newState.currentDate, 365),
           reputationRequirement: bestMedia.req,
           isActive: true
         }];
         newState.news = [{
            id: uuidv4(), date: newState.currentDate, type: 'general',
            title: t($ => $.generated.autobooker.newBroadcastTitle, { name: bestMedia.name }),
            content: t($ => $.generated.autobooker.newBroadcast, { tier: t($ => $.generated.autobooker[bestMedia.tier === 'local' ? 'tierLocal' : bestMedia.tier === 'regional' ? 'tierRegional' : 'tierNational']), name: bestMedia.name })
         }, ...newState.news];
      }
    }
  }
  
  // Ensure no duplicate active deals
  if (newState.sponsorDeals) {
    let foundActive = false;
    newState.sponsorDeals = newState.sponsorDeals.map(d => {
      if (d.isActive) {
        if (foundActive) return { ...d, isActive: false };
        foundActive = true;
      }
      return d;
    });
  }
  if (newState.mediaDeals) {
    let foundActive = false;
    newState.mediaDeals = newState.mediaDeals.map(d => {
      if (d.isActive) {
        if (foundActive) return { ...d, isActive: false };
        foundActive = true;
      }
      return d;
    });
  }
  
  return refreshPromotionEconomy(newState, getPlayerPromotionId(newState));
}

function generateAutoEvent(
  state: GameState,
  dateStr: string,
  isRecovery: boolean | undefined,
  slotType: CalendarSlotType | undefined,
  targetWeightClass: WeightClass | undefined,
  tournamentId: string | undefined,
  tournamentRound: TournamentRound | undefined,
  language: Language
): Event | null {
  const t = fixedT(language);
  const eventIndex = Object.keys(state.events).length + 1;
  const eventName = slotType === 'tentpole_event'
    ? getEventName('tentpole', eventIndex)
    : slotType === 'title_fight_card'
      ? getEventName('title', eventIndex)
      : slotType === 'grand_prix_round' && tournamentId
        ? getEventName('grand_prix', eventIndex, tournamentRound)
        : getEventName('regular', eventIndex);

  const fights: Omit<FightMatchup, 'id' | 'result'>[] = [];
  const bookedFighters = new Set<string>();

  const signedFighters = Object.values(state.fighters).filter(f => {
    const isTargetWc = state.autopilot?.targetTournamentWeightClass === f.weightClass;
    const hasGPActive = Object.values(state.tournaments || {}).some(t => t.weightClass === f.weightClass && (t.status === 'active' || t.status === 'planned'));
    if (isTargetWc && !hasGPActive) {
      // Allow if champion (so we can book title fights), but block normal contenders
      const title = state.titles[f.weightClass];
      const isChamp = title?.undisputedChampionId === f.id || title?.interimChampionId === f.id;
      if (!isChamp) {
        return false;
      }
    }
    // Prevent double-booking across future events (Priority 6)
    if (isFighterBookedUpcoming(state, f.id)) {
      return false;
    }
    return hasContractThrough(f, dateStr) && !f.injuryStatus && !f.medicalSuspension && f.fatigue < 50;
  });

  // Group by wc
  const wcGroups: Record<string, Fighter[]> = {};
  signedFighters.forEach(f => {
    if (!wcGroups[f.weightClass]) wcGroups[f.weightClass] = [];
    wcGroups[f.weightClass].push(f);
  });

  // 1. Prepare weight classes and sorting
  const weightClasses = Object.keys(wcGroups) as WeightClass[];
  
  let fightsTarget = 6;
  if (isRecovery) fightsTarget = 3;
  else if (slotType === 'tentpole_event') fightsTarget = 8;
  else if (state.promotion.reputation > 50) fightsTarget = 8;

  // If this is a GP round, adjust targets and book GP fighters
  let gpFightsCount = 0;
  if (slotType === 'grand_prix_round' && tournamentId) {
    const tourney = state.tournaments[tournamentId];
    if (tourney) {
      tourney.participants.forEach(p => bookedFighters.add(p.fighterId));
      tourney.reserveFighterIds.forEach(id => bookedFighters.add(id));
      
      if (tournamentRound === 'quarterfinal') gpFightsCount = 4;
      else if (tournamentRound === 'semifinal') gpFightsCount = 2;
      else if (tournamentRound === 'final') gpFightsCount = 1;
      
      fightsTarget = Math.max(3, fightsTarget - gpFightsCount);
    }
  }

  let newNews: any[] = [];
  
  // We keep wcGroups sorted by rank/popularity
  for (const wc of weightClasses) {
    wcGroups[wc].sort((a, b) => {
       const rankA = state.rankings[wc as WeightClass]?.find(r => r.fighterId === a.id)?.rank ?? 99;
       const rankB = state.rankings[wc as WeightClass]?.find(r => r.fighterId === b.id)?.rank ?? 99;
       if (rankA !== rankB) return rankA - rankB;
       return b.popularity - a.popularity;
    });
  }

  const maxTitleFights = slotType === 'title_fight_card' ? 3 : 1;
  let titleFightsBookedCount = 0;

  // Helper to check if a fighter is available (Priority 6 - title check)
  const isAvailable = (id: string | null | undefined) => id && !bookedFighters.has(id) && !isFighterBookedUpcoming(state, id);

  // Priority 1: Unification Fights
  for (const wc of weightClasses) {
    if (titleFightsBookedCount >= maxTitleFights) break;
    const titleState = state.titles[wc as WeightClass];
    if (titleState?.status === 'unification_needed' && titleState.undisputedChampionId && titleState.interimChampionId) {
      const champ = wcGroups[wc].find(f => f.id === titleState.undisputedChampionId);
      const interimChamp = wcGroups[wc].find(f => f.id === titleState.interimChampionId);
      
      if (champ && interimChamp && isAvailable(champ.id) && isAvailable(interimChamp.id)) {
        fights.push({
          redCornerId: champ.id,
          blueCornerId: interimChamp.id,
          weightClass: wc as WeightClass,
          isTitleFight: true,
          titleFightType: 'unification',
          rounds: 5
        });
        bookedFighters.add(champ.id);
        bookedFighters.add(interimChamp.id);
        newNews.push({ id: uuidv4(), date: dateStr, title: t($ => $.generated.autobooker.unificationTitle), content: t($ => $.generated.autobooker.unification, { red: champ.lastName, blue: interimChamp.lastName, weightClass: formatWeightClass(wc, language) }), type: 'general' });
        titleFightsBookedCount++;
      }
    }
  }

  // Priority 1.5: Grand Prix Winner Promised Title Shot
  if (titleFightsBookedCount < maxTitleFights) {
    for (const wc of weightClasses) {
      if (titleFightsBookedCount >= maxTitleFights) break;
      const gpWinner = (wcGroups[wc] || []).find(f => f.titleShotPromised && isAvailable(f.id));
      if (gpWinner) {
        const titleState = state.titles[wc as WeightClass];
        if (titleState && titleState.undisputedChampionId) {
          const champ = (wcGroups[wc] || []).find(f => f.id === titleState.undisputedChampionId);
          if (champ && isAvailable(champ.id)) {
            fights.push({
              redCornerId: champ.id,
              blueCornerId: gpWinner.id,
              weightClass: wc as WeightClass,
              isTitleFight: true,
              titleFightType: titleState.status === 'inactive_champion' ? 'interim' : 'undisputed',
              rounds: 5
            });
            bookedFighters.add(champ.id);
            bookedFighters.add(gpWinner.id);
            newNews.push({ 
              id: uuidv4(), 
              date: dateStr, 
              title: t($ => $.generated.autobooker.gpTitleShotTitle),
              content: t($ => $.generated.autobooker.gpTitleShot, { winner: gpWinner.lastName, champion: champ.lastName, weightClass: formatWeightClass(wc, language) }),
              type: 'general' 
            });
            titleFightsBookedCount++;
          }
        } else if (titleState && titleState.status === 'vacant') {
          const contender = (wcGroups[wc] || []).find(f => f.id !== gpWinner.id && isAvailable(f.id));
          if (contender) {
            fights.push({
              redCornerId: gpWinner.id,
              blueCornerId: contender.id,
              weightClass: wc as WeightClass,
              isTitleFight: true,
              titleFightType: 'vacant_undisputed',
              rounds: 5
            });
            bookedFighters.add(gpWinner.id);
            bookedFighters.add(contender.id);
            newNews.push({ 
              id: uuidv4(), 
              date: dateStr, 
              title: t($ => $.generated.autobooker.gpTitleShotTitle),
              content: t($ => $.generated.autobooker.gpVacantTitleShot, { winner: gpWinner.lastName, weightClass: formatWeightClass(wc, language) }),
              type: 'general' 
            });
            titleFightsBookedCount++;
          }
        }
      }
    }
  }

  // Priority 2: Overdue Undisputed Defenses
  if (titleFightsBookedCount < maxTitleFights) {
    // find WCs with undisputed champ, active, and overdue (e.g. > 120 days)
    for (const wc of weightClasses) {
      if (titleFightsBookedCount >= maxTitleFights) break;
      const titleState = state.titles[wc as WeightClass];
      if (titleState?.status === 'active' && titleState.undisputedChampionId) {
        const lastDefense = titleState.lastUndisputedDefenseDate;
        let diffDays = 120; // default force it if no date
        if (lastDefense) {
          const diffTime = Math.abs(new Date(state.currentDate).getTime() - new Date(lastDefense).getTime());
          diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
        
        if (diffDays >= 120) {
          const champ = wcGroups[wc].find(f => f.id === titleState.undisputedChampionId);
          if (champ && isAvailable(champ.id)) {
            const contender = wcGroups[wc].find(f => f.id !== champ.id && isAvailable(f.id));
            if (contender) {
              fights.push({
                redCornerId: champ.id,
                blueCornerId: contender.id,
                weightClass: wc as WeightClass,
                isTitleFight: true,
                titleFightType: 'undisputed',
                rounds: 5
              });
              bookedFighters.add(champ.id);
              bookedFighters.add(contender.id);
              titleFightsBookedCount++;
            }
          }
        }
      }
    }
  }

  // Priority 3: Interim Title Fights (for inactive champions)
  if (titleFightsBookedCount < maxTitleFights) {
    for (const wc of weightClasses) {
      if (titleFightsBookedCount >= maxTitleFights) break;
      const titleState = state.titles[wc as WeightClass];
      if (titleState?.status === 'inactive_champion' && !titleState.interimChampionId) {
        const contender1 = wcGroups[wc].find(f => f.id !== titleState.undisputedChampionId && isAvailable(f.id));
        const contender2 = wcGroups[wc].find(f => f.id !== titleState.undisputedChampionId && f.id !== contender1?.id && isAvailable(f.id));
        if (contender1 && contender2) {
          fights.push({
            redCornerId: contender1.id,
            blueCornerId: contender2.id,
            weightClass: wc as WeightClass,
            isTitleFight: true,
            titleFightType: 'interim',
            rounds: 5
          });
          bookedFighters.add(contender1.id);
          bookedFighters.add(contender2.id);
          newNews.push({ id: uuidv4(), date: dateStr, title: t($ => $.generated.autobooker.interimTitle, { weightClass: formatWeightClass(wc, language) }), content: t($ => $.generated.autobooker.interim, { red: contender1.lastName, blue: contender2.lastName, weightClass: formatWeightClass(wc, language) }), type: 'general' });
          titleFightsBookedCount++;
        }
      }
    }
  }

  // Priority 4: Vacant Undisputed Titles
  if (titleFightsBookedCount < maxTitleFights) {
    for (const wc of weightClasses) {
      if (titleFightsBookedCount >= maxTitleFights) break;
      const titleState = state.titles[wc as WeightClass];
      if (titleState?.status === 'vacant') {
        const available = wcGroups[wc].filter(f => isAvailable(f.id));
        if (available.length >= 2) {
          fights.push({
            redCornerId: available[0].id,
            blueCornerId: available[1].id,
            weightClass: wc as WeightClass,
            isTitleFight: true,
            titleFightType: 'vacant_undisputed',
            rounds: 5
          });
          bookedFighters.add(available[0].id);
          bookedFighters.add(available[1].id);
          newNews.push({ id: uuidv4(), date: dateStr, title: t($ => $.generated.autobooker.vacantTitle, { weightClass: formatWeightClass(wc, language) }), content: t($ => $.generated.autobooker.vacant, { red: available[0].lastName, blue: available[1].lastName, weightClass: formatWeightClass(wc, language) }), type: 'general' });
          titleFightsBookedCount++;
        }
      }
    }
  }

  // Fill rest of card
  const tournamentFighters = new Set(Object.values(state.tournaments || {})
    .filter(tournament => tournament.status === 'active' || tournament.status === 'planned')
    .flatMap(tournament => [...tournament.participants.map(participant => participant.fighterId), ...tournament.reserveFighterIds]));
  for (const wc of weightClasses) {
    if (fights.length >= fightsTarget) break;
    const available = wcGroups[wc].filter(f => !bookedFighters.has(f.id)).sort((a, b) => b.popularity - a.popularity);
    const rivalry = state.storylines
      .filter(storyline => storyline.type === 'Rivalry' && storyline.isActive && (storyline.intensity ?? 1) >= 3)
      .sort((a, b) => a.id.localeCompare(b.id))
      .find(storyline => storyline.fighterIds.length === 2 && storyline.fighterIds.every(id => available.some(fighter => fighter.id === id) && !tournamentFighters.has(id)));
    if (rivalry && fights.length < fightsTarget) {
      const [redId, blueId] = rivalry.fighterIds;
      fights.push({ redCornerId: redId, blueCornerId: blueId, weightClass: wc as WeightClass, isTitleFight: false, rounds: 3 });
      bookedFighters.add(redId);
      bookedFighters.add(blueId);
      available.splice(0, available.length, ...available.filter(fighter => fighter.id !== redId && fighter.id !== blueId));
    }

    while (available.length >= 2 && fights.length < fightsTarget) {
      const red = available.shift()!;
      const opponentIndex = available.reduce((bestIndex, fighter, index) => {
        const best = available[bestIndex];
        const score = Math.abs(getFighterOverall(red) - getFighterOverall(fighter)) + Math.abs(red.popularity - fighter.popularity) / 10;
        const bestScore = Math.abs(getFighterOverall(red) - getFighterOverall(best)) + Math.abs(red.popularity - best.popularity) / 10;
        return score < bestScore ? index : bestIndex;
      }, 0);
      const blue = available.splice(opponentIndex, 1)[0];
      fights.push({ redCornerId: red.id, blueCornerId: blue.id, weightClass: wc as WeightClass, isTitleFight: false, rounds: 3 });
      bookedFighters.add(red.id);
      bookedFighters.add(blue.id);
    }
  }

  if (fights.length < 3) return null; // Too few fights to make an event

  const fightsWithIds: FightMatchup[] = fights.map(f => ({ ...f, id: uuidv4() }));

  const venues = Object.values(state.venues).sort((a, b) => b.capacity - a.capacity);
  let bestVenue = null;
  let bestProj = null;
  let bestMarketing = 10000;
  let bestTicketPrice = 20;
  
  const isEmergency = state.promotion.money <= 0;

  if (isRecovery) {
    // Pick the cheapest venue with reputation requirement = 0 or lowest cost
    const cheapestVenue = Object.values(state.venues).sort((a, b) => a.cost - b.cost)[0];
    if (cheapestVenue) {
      bestVenue = cheapestVenue;
      bestProj = calculateEventProjections(
        fightsWithIds,
        state.fighters,
        cheapestVenue,
        15, // Cheap ticket price
        500, // Cheap marketing
        state.promotion,
        state.storylines,
        state.titles,
        state.tournaments
      );
      bestMarketing = 500;
      bestTicketPrice = 15;
    }
  } else {
    const isTentpole = slotType === 'tentpole_event';
    for (const v of venues) {
      if (!isEmergency && v.cost > state.promotion.money * 0.7) continue;
      if (isEmergency && v.capacity > 3000) continue;
      
      // Tentpole events prefer larger venues
      if (isTentpole && v.capacity < 5000 && venues.some(x => x.capacity >= 5000 && x.cost <= state.promotion.money * 0.7)) {
        continue;
      }
      
      // adjust marketing based on money and event importance
      const marketing = isEmergency ? 500 : (isTentpole ? Math.min(50000, Math.max(20000, Math.floor(state.promotion.money * 0.2))) : Math.min(25000, Math.max(1000, Math.floor(state.promotion.money * 0.1))));
      const tPrice = Math.floor(v.capacity * 0.05) + 20;

      const proj = calculateEventProjections(
        fightsWithIds,
        state.fighters,
        v,
        tPrice,
        marketing,
        state.promotion,
        state.storylines,
        state.titles,
        state.tournaments
      );

      // Evaluate financial safety
      if (proj.expectedAttendance < v.capacity * 0.4) {
         // Only accept sub 40% if no other option
         if (!bestVenue && venues.length > 0) {
           bestVenue = v;
           bestProj = proj;
           bestMarketing = marketing;
           bestTicketPrice = tPrice;
         }
         continue;
      }

      if (proj.expectedProfit < 0 && !isEmergency) {
        const maxLoss = Math.max(5000, state.promotion.money * 0.35);
        if (Math.abs(proj.expectedProfit) > maxLoss) {
          continue; // Too risky
        }
      }

      // Prefer higher profit
      if (!bestProj || proj.expectedProfit > bestProj.expectedProfit) {
        bestVenue = v;
        bestProj = proj;
        bestMarketing = marketing;
        bestTicketPrice = tPrice;
      }
    }
  }

  if (!bestVenue) return null; // Couldn't find a financially safe venue

  if (newNews.length > 0) {
    state.news = [...newNews, ...state.news];
  }

  return {
    id: uuidv4(),
    promotionId: getPlayerPromotionId(state),
    scope: 'promotion',
    name: eventName,
    date: dateStr,
    venueId: bestVenue.id,
    fights: fightsWithIds,
    ticketPrice: bestTicketPrice,
    marketingSpend: bestMarketing,
    isCompleted: false
  };
}

function maintainRoster(state: GameState, language: Language): GameState {
  if (isContractMarketOpen(state)) return state;
  const t = fixedT(language);
  const suppliedState = ensureEmergencyProspectPool(state, state.currentDate, language);
  const newState = { ...suppliedState, fighters: { ...suppliedState.fighters }, news: [...suppliedState.news] };
  const playerPromotionId = getPlayerPromotionId(newState);
  const tournamentFighterIds = new Set(Object.values(newState.tournaments)
    .filter(tournament => tournament.status === 'planned' || tournament.status === 'active')
    .flatMap(tournament => tournament.participants.map(participant => participant.fighterId)));
  const signedFighters = Object.values(newState.fighters).filter(f =>
    f.contract?.promotionId === playerPromotionId && f.careerPhase !== 'retired'
  );

  // Group by wc
  const wcGroups: Record<string, Fighter[]> = {};
  signedFighters.forEach(f => {
    if (!wcGroups[f.weightClass]) wcGroups[f.weightClass] = [];
    wcGroups[f.weightClass].push(f);
  });

  const weightClasses = Object.keys(newState.rankings) as WeightClass[];

  weightClasses.forEach(wc => {
    const inWc = wcGroups[wc] || [];
    
    // Release logic if too many
    if (inWc.length > 10) {
      // Find lowest popularity/rating with few fights left
      const disposable = inWc
        .filter(f => !f.isChampion && f.contract && f.contract.fightsRemaining <= 2 && !tournamentFighterIds.has(f.id))
        .sort((a, b) => a.popularity - b.popularity);
      
      if (disposable.length > 0 && newState.promotion.money < 100000) { // only release if we need money
        const toRelease = disposable[0];
        newState.fighters[toRelease.id] = { ...toRelease, contract: null };
        newState.news.unshift({
          id: uuidv4(), date: newState.currentDate, type: 'contract',
          title: t($ => $.generated.autobooker.fighterReleasedTitle),
          content: t($ => $.generated.autobooker.fighterReleased, { fighter: `${toRelease.firstName} ${toRelease.lastName}` })
        });
      }
    }

    if (inWc.length < OBSERVER_DIVISION_ROSTER_SIZE && newState.promotion.money > 50000) {
      const freeAgents = Object.values(newState.fighters)
        .filter(f => !f.contract && f.weightClass === wc && (f.careerPhase === 'developing' || f.careerPhase === 'prime'))
        .map(fighter => ({ fighter, score: scoreObserverRosterCandidate(newState, fighter) }))
        .filter(candidate => candidate.score >= 45)
        .sort((a, b) => b.score - a.score || a.fighter.id.localeCompare(b.fighter.id))
        .slice(0, OBSERVER_DIVISION_ROSTER_SIZE - inWc.length)
        .map(candidate => candidate.fighter);

      for (const toSign of freeAgents) {
        const pay = 5000 + (toSign.popularity * 100);
        newState.fighters[toSign.id] = {
          ...toSign,
          contract: { promotionId: getPlayerPromotionId(newState), payPerFight: pay, winBonus: pay, fightsRemaining: 4, exclusivity: true, endDate: getContractEndDate(newState.currentDate, 4) }
        };
        newState.news.unshift({
          id: uuidv4(), date: newState.currentDate, type: 'contract',
          title: t($ => $.generated.autobooker.newSigningTitle, { fighter: toSign.lastName }),
          content: t($ => $.generated.autobooker.newSigning, { fighter: `${toSign.firstName} ${toSign.lastName}` })
        });
      }
    }
  });

  // Auto-renew or sign back champions with expired/expiring contracts
  Object.values(newState.fighters).forEach(f => {
    if (f.contract?.promotionId !== getPlayerPromotionId(newState)) return;
    const isChamp = f.isChampion || Object.values(newState.titles || {}).some(t => t.undisputedChampionId === f.id || t.interimChampionId === f.id);
    if (isChamp && f.careerPhase !== 'retired') {
      if (!f.contract || f.contract.fightsRemaining <= 1) {
        const pay = 10000 + (f.popularity * 200);
        newState.fighters[f.id] = {
          ...f,
          contract: { promotionId: getPlayerPromotionId(newState), payPerFight: pay, winBonus: pay, fightsRemaining: 4, exclusivity: true, endDate: getContractEndDate(newState.currentDate, 4) }
        };
        newState.news.unshift({
          id: uuidv4(), date: newState.currentDate, type: 'contract',
          title: t($ => $.generated.autobooker.championExtensionTitle, { fighter: f.lastName }),
          content: t($ => $.generated.autobooker.championExtension, { fighter: `${f.firstName} ${f.lastName}` })
        });
      }
    } else if (f.contract && f.contract.fightsRemaining <= 1 && shouldObserverRenewFighter(newState, f)) {
      // Renew other popular fighters
      const pay = 10000 + (f.popularity * 200);
      newState.fighters[f.id] = {
        ...f,
        contract: { promotionId: getPlayerPromotionId(newState), payPerFight: pay, winBonus: pay, fightsRemaining: 4, exclusivity: true, endDate: getContractEndDate(newState.currentDate, 4) }
      };
      newState.news.unshift({
        id: uuidv4(), date: newState.currentDate, type: 'contract',
        title: t($ => $.generated.autobooker.contractRenewedTitle, { fighter: f.lastName }),
        content: t($ => $.generated.autobooker.contractRenewed, { fighter: `${f.firstName} ${f.lastName}` })
      });
    }
  });

  return refreshPromotionEconomy(
    { ...newState, rankings: buildPromotionRankings(newState).newRankings },
    getPlayerPromotionId(newState)
  );
}

export function repairEventAvailability(state: GameState, eventId: string, language: Language = readLanguage()): GameState {
  const t = fixedT(language);
  let newState = {
    ...state,
    events: { ...state.events },
    tournaments: { ...state.tournaments },
    fighters: { ...state.fighters },
    news: [...state.news]
  };

  const event = newState.events[eventId];
  if (!event || event.isCompleted) return newState;

  let eventFights = [...event.fights].filter(f => f && f.redCornerId && f.blueCornerId);
  let changed = false;

  for (let i = eventFights.length - 1; i >= 0; i--) {
    const fight = eventFights[i];
    const red = newState.fighters[fight.redCornerId];
    const blue = newState.fighters[fight.blueCornerId];

    const ownsFighter = (fighter: Fighter | undefined) =>
      Boolean(fighter?.contract) &&
      (event.scope === 'international' || fighter!.contract!.promotionId === (event.promotionId ?? getPlayerPromotionId(newState)));
    const redUnavailable = !ownsFighter(red) || red!.injuryStatus !== null || (red!.medicalSuspension && red!.medicalSuspension.daysRemaining > 0);
    const blueUnavailable = !ownsFighter(blue) || blue!.injuryStatus !== null || (blue!.medicalSuspension && blue!.medicalSuspension.daysRemaining > 0);

    if (redUnavailable || blueUnavailable) {
      changed = true;
      const unavailableFighter = redUnavailable ? red : blue;
      const unavailableName = unavailableFighter ? `${unavailableFighter.firstName} ${unavailableFighter.lastName}` : t($ => $.generated.autobooker.unknownFighter);

      if (fight.tournamentId && fight.tournamentRound) {
        const tId = fight.tournamentId;
        const round = fight.tournamentRound;
        const tourney = newState.tournaments[tId];
        if (tourney) {
          try {
            newState = repairScheduledTournamentRound(newState, tId, round, eventId, language);
            return checkAndCleanEmptyEvent(newState, eventId, language);
          } catch (err) {
            console.error("Failed to repair tournament fight", err);
          }
        }
      } else if (fight.isTitleFight) {
        eventFights.splice(i, 1);
        const redName = red ? `${red.firstName} ${red.lastName}` : t($ => $.generated.autobooker.champion);
        const blueName = blue ? `${blue.firstName} ${blue.lastName}` : t($ => $.generated.autobooker.challenger);
        
        newState.news = [{
          id: uuidv4(),
          date: newState.currentDate,
          title: t($ => $.generated.autobooker.titlePostponedTitle),
          content: t($ => $.generated.autobooker.titlePostponed, { weightClass: formatWeightClass(fight.weightClass, language), red: redName, blue: blueName, fighter: unavailableName }),
          type: 'general' as const
        }, ...newState.news];
      } else {
        const weightClass = fight.weightClass;
        
        const currentlyBooked = new Set<string>();
        eventFights.forEach(f => {
          if (f.id !== fight.id) {
            currentlyBooked.add(f.redCornerId);
            currentlyBooked.add(f.blueCornerId);
          }
        });
        currentlyBooked.add(redUnavailable ? fight.blueCornerId : fight.redCornerId);

        const replacementCandidates = Object.values(newState.fighters).filter(f =>
          f.weightClass === weightClass &&
          ownsFighter(f) &&
          hasContractThrough(f, event.date) &&
          f.injuryStatus === null &&
          (!f.medicalSuspension || f.medicalSuspension.daysRemaining <= 0) &&
          !currentlyBooked.has(f.id) &&
          !isFighterBookedUpcoming(newState, f.id, eventId) &&
          !f.isChampion
        );

        if (replacementCandidates.length > 0) {
          replacementCandidates.sort((a, b) => {
            const rankA = newState.rankings[weightClass]?.find(r => r.fighterId === a.id)?.rank ?? 99;
            const rankB = newState.rankings[weightClass]?.find(r => r.fighterId === b.id)?.rank ?? 99;
            if (rankA !== rankB) return rankA - rankB;
            return b.popularity - a.popularity;
          });

          const repFighter = replacementCandidates[0];
          const replacedFighter = redUnavailable ? red : blue;
          const replacedName = replacedFighter ? `${replacedFighter.firstName} ${replacedFighter.lastName}` : t($ => $.generated.autobooker.unknown);

          if (redUnavailable) {
            fight.redCornerId = repFighter.id;
          } else {
            fight.blueCornerId = repFighter.id;
          }

          newState.news = [{
            id: uuidv4(),
            date: newState.currentDate,
            title: t($ => $.generated.autobooker.matchupUpdatedTitle),
            content: t($ => $.generated.autobooker.matchupUpdated, { replacement: `${repFighter.firstName} ${repFighter.lastName}`, opponent: (redUnavailable ? blue?.lastName : red?.lastName) ?? t($ => $.generated.autobooker.unknown), event: event.name, replaced: replacedName }),
            type: 'general' as const
          }, ...newState.news];
        } else {
          eventFights.splice(i, 1);
          newState.news = [{
            id: uuidv4(),
            date: newState.currentDate,
            title: t($ => $.generated.autobooker.fightRemovedTitle),
            content: t($ => $.generated.autobooker.fightRemoved, { red: red?.lastName ?? t($ => $.generated.autobooker.unknown), blue: blue?.lastName ?? t($ => $.generated.autobooker.unknown), event: event.name, fighter: unavailableName }),
            type: 'general' as const
          }, ...newState.news];
        }
      }
    }
  }

  if (changed) {
    newState.events[eventId] = {
      ...event,
      fights: eventFights
    };
  }

  return checkAndCleanEmptyEvent(newState, eventId, language);
}

export function rebuildCard(state: GameState, eventId: string): GameState {
  let newState = {
    ...state,
    events: { ...state.events },
    fighters: { ...state.fighters },
    news: [...state.news]
  };

  const event = newState.events[eventId];
  if (!event || event.isCompleted) return newState;

  let eventFights = [...event.fights];
  
  // Clean up any invalid/undefined fights first
  eventFights = eventFights.filter(f => f && f.redCornerId && f.blueCornerId);

  if (eventFights.length >= 3) {
    newState.events[eventId] = { ...event, fights: eventFights };
    return newState;
  }

  // We need to add fights to reach at least 3 fights
  const currentlyBooked = new Set<string>();
  eventFights.forEach(f => {
    currentlyBooked.add(f.redCornerId);
    currentlyBooked.add(f.blueCornerId);
  });

  const availableFighters = Object.values(newState.fighters).filter(f =>
    hasContractThrough(f, event.date) &&
    (event.scope === 'international' || f.contract!.promotionId === (event.promotionId ?? getPlayerPromotionId(newState))) &&
    f.injuryStatus === null &&
    (!f.medicalSuspension || f.medicalSuspension.daysRemaining <= 0) &&
    f.fatigue < 50 &&
    !currentlyBooked.has(f.id) &&
    !isFighterBookedUpcoming(newState, f.id, eventId)
  );

  // Group by weightClass
  const groups: Record<string, Fighter[]> = {};
  availableFighters.forEach(f => {
    if (!groups[f.weightClass]) groups[f.weightClass] = [];
    groups[f.weightClass].push(f);
  });

  // Try to create matchups in each weight class
  for (const wc of Object.keys(groups)) {
    if (eventFights.length >= 3) break;
    const fightersInWc = groups[wc];
    
    fightersInWc.sort((a, b) => {
      const rankA = newState.rankings[wc as WeightClass]?.find(r => r.fighterId === a.id)?.rank ?? 99;
      const rankB = newState.rankings[wc as WeightClass]?.find(r => r.fighterId === b.id)?.rank ?? 99;
      if (rankA !== rankB) return rankA - rankB;
      return b.popularity - a.popularity;
    });

    for (let i = 0; i < fightersInWc.length - 1; i += 2) {
      if (eventFights.length >= 3) break;
      const f1 = fightersInWc[i];
      const f2 = fightersInWc[i+1];
      
      eventFights.push({
        id: uuidv4(),
        redCornerId: f1.id,
        blueCornerId: f2.id,
        weightClass: wc as WeightClass,
        isTitleFight: false,
        rounds: 3
      });
      currentlyBooked.add(f1.id);
      currentlyBooked.add(f2.id);
    }
  }

  newState.events[eventId] = {
    ...event,
    fights: eventFights
  };

  return newState;
}

export function checkAndCleanEmptyEvent(state: GameState, eventId: string, language: Language = readLanguage()): GameState {
  const t = fixedT(language);
  let newState = {
    ...state,
    events: { ...state.events },
    tournaments: { ...state.tournaments },
    news: [...state.news]
  };

  const event = newState.events[eventId];
  if (!event || event.isCompleted) return newState;

  newState = rebuildCard(newState, eventId);
  const updatedEvent = newState.events[eventId];

  if (updatedEvent && updatedEvent.fights.length >= 3) {
    return newState;
  }

  // Rebuild failed! We must remove/cancel the event
  console.log(`Event ${event.name} has ${updatedEvent ? updatedEvent.fights.length : 0} fights, which is below minimum 3. Cancelling/Removing.`);
  
  let slotYear: number | null = null;
  let slotIdx: number = -1;
  if (newState.seasonPlans) {
    for (const yStr in newState.seasonPlans) {
      const plan = newState.seasonPlans[Number(yStr)];
      const idx = plan?.slots.findIndex(s => s.eventId === eventId) ?? -1;
      if (idx !== -1) {
        slotYear = Number(yStr);
        slotIdx = idx;
        break;
      }
    }
  }

  delete newState.events[eventId];

  newState.news.unshift({
    id: uuidv4(),
    date: newState.currentDate,
    title: t($ => $.generated.autobooker.eventCancelledTitle, { event: event.name }),
    content: t($ => $.generated.autobooker.eventCancelled, { event: event.name }),
    type: 'general' as const
  });

  if (slotYear !== null && slotIdx !== -1 && newState.seasonPlans) {
    const plan = newState.seasonPlans[slotYear];
    const slots = [...plan.slots];
    const slot = slots[slotIdx];
    
    slots[slotIdx] = {
      ...slot,
      status: 'cancelled' as const,
      eventId: undefined,
      notes: [...(slot.notes || []), t($ => $.generated.autobooker.calendarCancelled, { date: newState.currentDate })]
    };

    newState.seasonPlans[slotYear] = {
      ...plan,
      slots
    };
  }

  Object.keys(newState.tournaments).forEach(tId => {
    const tournament = newState.tournaments[tId];
    const hasFightsLinked = tournament.fights.some(f => f.eventId === eventId);
    if (hasFightsLinked) {
      const updatedFights = tournament.fights.map(f => {
        if (f.eventId === eventId) {
          return {
            ...f,
            eventId: undefined,
            fightId: undefined
          };
        }
        return f;
      });

      const round = tournament.fights.find(f => f.eventId === eventId)?.round;
      newState.tournaments[tId] = {
        ...tournament,
        fights: updatedFights,
        roundDelayReason: t($ => $.generated.autobooker.tournamentEventCancelled, { event: event.name }),
        delayedRound: round || null,
        earliestRoundDate: addDays(newState.currentDate, 14),
        notes: [...(tournament.notes || []), t($ => $.generated.autobooker.tournamentRoundCancelled, { event: event.name })]
      };
    }
  });

  return newState;
}

export function simulateDueEvents(
  state: GameState,
  simulateEvents: boolean,
  language: Language = readLanguage()
): { state: GameState; stoppedForManualEvent: boolean; selectedEventId?: string } {
  let newState = { ...state };

  while (true) {
    const dueEvent = Object.values(newState.events)
      .filter(e => !e.isCompleted && e.date <= newState.currentDate && (newState.mode === 'observer' || !hasPendingIncidentForEvent(newState, e.id)))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

    if (!dueEvent) return { state: newState, stoppedForManualEvent: false };

    newState = repairEventAvailability(newState, dueEvent.id, language);
    newState = checkAndCleanEmptyEvent(newState, dueEvent.id, language);

    const repairedEvent = newState.events[dueEvent.id];
    if (!repairedEvent || repairedEvent.isCompleted || repairedEvent.fights.length < 3) continue;

    if (simulateEvents) {
      return { state: newState, stoppedForManualEvent: true, selectedEventId: repairedEvent.id };
    }

    newState = quickSimulateEvent(newState, repairedEvent.id, language);
  }
}

export function repairPastScheduledEvents(state: GameState, language: Language = readLanguage()): GameState {
  const t = fixedT(language);
  let newState = { ...state };
  const pastEvents = Object.values(newState.events)
    .filter(e => !e.isCompleted && e.date < newState.currentDate)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  pastEvents.forEach(event => {
    const currentEvent = newState.events[event.id];
    if (!currentEvent || currentEvent.isCompleted) return;

    if (currentEvent.fights.length < 3) {
      newState = checkAndCleanEmptyEvent(newState, currentEvent.id, language);
      return;
    }

    if (!newState.seasonPlans) return;
    for (const yearStr in newState.seasonPlans) {
      const year = Number(yearStr);
      const plan = newState.seasonPlans[year];
      if (!plan) continue;

      const slots = plan.slots.map(slot => {
        if (slot.eventId !== currentEvent.id) return slot;
        return {
          ...slot,
          date: currentEvent.date,
          status: 'scheduled' as const,
          notes: [...(slot.notes || []), t($ => $.generated.autobooker.pastDueQueued, { date: newState.currentDate })]
        };
      });
      newState.seasonPlans[year] = { ...plan, slots };
    }
  });

  return newState;
}

export function repairFutureEventAvailability(state: GameState, language: Language = readLanguage()): GameState {
  let newState = { ...state };
  const cutoffDate = addDays(newState.currentDate, 30);

  const upcomingEvents = Object.values(newState.events).filter(e =>
    !e.isCompleted &&
    e.date <= cutoffDate
  );

  upcomingEvents.forEach(e => {
    newState = repairEventAvailability(newState, e.id, language);
  });

  return newState;
}
