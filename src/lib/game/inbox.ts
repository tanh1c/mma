import { differenceInCalendarDays } from 'date-fns';
import type { GameState } from '../../types/game';
import { getContractStatus } from './contracts';
import { diagnoseActiveTournaments, getPendingTitleShotDebts } from './tournament';
import { WEIGHT_CLASSES } from './constants';
import { isProspect } from './fighterRatings';

export type InboxSeverity = 'critical' | 'urgent' | 'opportunity';
export type InboxTargetView = 'fighter-detail' | 'event-builder' | 'calendar' | 'tournaments' | 'free-agents' | 'roster';

export interface InboxItem {
  id: string;
  severity: InboxSeverity;
  title: string;
  description: string;
  targetView: InboxTargetView;
  priority: number;
  fighterId?: string;
  eventId?: string;
  calendarSlotId?: string;
  date?: string;
}

const severityRank: Record<InboxSeverity, number> = { critical: 0, urgent: 1, opportunity: 2 };

export function getPromotionInbox(state: GameState): InboxItem[] {
  const items: InboxItem[] = [];
  const upcomingEvents = Object.values(state.events).filter(event => !event.isCompleted).sort((a, b) => a.date.localeCompare(b.date));

  upcomingEvents.forEach(event => {
    const hasViableCard = event.fights.length >= 3;
    if (event.date <= state.currentDate || !hasViableCard) {
      items.push({ id: `event-${event.id}`, severity: 'critical', title: event.date <= state.currentDate ? 'Event is due' : 'Event needs fights', description: event.date <= state.currentDate ? `${event.name} is ready to run.` : `${event.name} has ${event.fights.length} of 3 required fights booked.`, targetView: 'event-builder', eventId: event.id, priority: 100, date: event.date });
    }
    event.fights.forEach(fight => {
      [fight.redCornerId, fight.blueCornerId].forEach(fighterId => {
        const fighter = state.fighters[fighterId];
        if (fighter && (fighter.injuryStatus || fighter.medicalSuspension?.daysRemaining)) {
          items.push({ id: `unavailable-${event.id}-${fighterId}`, severity: 'critical', title: 'Booked fighter unavailable', description: `${fighter.firstName} ${fighter.lastName} cannot make ${event.name}.`, targetView: 'event-builder', eventId: event.id, fighterId, priority: 95, date: event.date });
        }
      });
    });
  });

  Object.values(state.fighters).forEach(fighter => {
    const contract = fighter.contract;
    if (!contract) return;
    const status = getContractStatus(contract, state.currentDate);
    if (fighter.isChampion && status === 'expired') {
      items.push({ id: `champion-contract-${fighter.id}`, severity: 'critical', title: 'Champion contract expired', description: `Renew ${fighter.firstName} ${fighter.lastName} before the title situation escalates.`, targetView: 'fighter-detail', fighterId: fighter.id, priority: 90, date: contract.endDate });
    } else if (status === 'expiring') {
      items.push({ id: `contract-${fighter.id}`, severity: 'urgent', title: 'Contract expiring', description: `${fighter.firstName} ${fighter.lastName} has ${contract.fightsRemaining} fight${contract.fightsRemaining === 1 ? '' : 's'} remaining.`, targetView: 'fighter-detail', fighterId: fighter.id, priority: 70, date: contract.endDate });
    }
  });

  Object.values(state.fighters).forEach(fighter => {
    if (fighter.counterOffer && fighter.counterOffer.expiresDate >= state.currentDate) {
      items.push({ id: `counter-${fighter.id}`, severity: 'urgent', title: 'Counter-offer awaiting response', description: `${fighter.firstName} ${fighter.lastName}'s counter-offer expires in ${differenceInCalendarDays(new Date(fighter.counterOffer.expiresDate), new Date(state.currentDate))} days.`, targetView: 'fighter-detail', fighterId: fighter.id, priority: 80, date: fighter.counterOffer.expiresDate });
    }
  });

  diagnoseActiveTournaments(state).filter(diagnosis => diagnosis.roundDelayReason || (!diagnosis.canScheduleNow && !diagnosis.hasUpcomingTournamentFights)).forEach(diagnosis => {
    items.push({ id: `tournament-${diagnosis.tournamentId}`, severity: diagnosis.roundDelayReason ? 'urgent' : 'critical', title: 'Grand Prix round needs attention', description: diagnosis.reasonCannotSchedule || `${diagnosis.name} needs its next round scheduled.`, targetView: 'tournaments', priority: 88, date: diagnosis.earliestRoundDate ?? state.currentDate });
  });

  getPendingTitleShotDebts(state).filter(debt => debt.status !== 'used').forEach(debt => {
    const fighter = state.fighters[debt.fighterId];
    if (!fighter) return;
    items.push({ id: `title-shot-${debt.tournamentId}`, severity: debt.daysPending > 180 ? 'critical' : 'urgent', title: 'Grand Prix title shot owed', description: `${fighter.firstName} ${fighter.lastName} is owed a ${debt.weightClass} title shot.`, targetView: 'event-builder', fighterId: fighter.id, priority: 85 + Math.min(10, Math.floor(debt.daysPending / 30)), date: state.currentDate });
  });

  state.storylines.filter(storyline => storyline.type === 'Rivalry' && storyline.isActive && (storyline.intensity ?? 1) >= 3).forEach(storyline => {
    items.push({ id: `rivalry-${storyline.id}`, severity: 'opportunity', title: 'Peak rivalry ready to book', description: storyline.description, targetView: 'event-builder', priority: 50, date: storyline.expiresDate });
  });

  WEIGHT_CLASSES.forEach(weightClass => {
    const contracted = Object.values(state.fighters).filter(fighter => fighter.weightClass === weightClass && fighter.contract).length;
    const prospect = Object.values(state.fighters).find(fighter => !fighter.contract && fighter.weightClass === weightClass && (fighter.popularity > 60 || isProspect(fighter)));
    if (contracted > 0 && contracted < 6 && prospect) {
      items.push({ id: `depth-${weightClass}`, severity: 'opportunity', title: `${weightClass} needs depth`, description: `${prospect.firstName} ${prospect.lastName} could strengthen a thin division.`, targetView: 'free-agents', fighterId: prospect.id, priority: 45 });
    }
  });

  Object.values(state.fighters).filter(fighter => !fighter.contract && (fighter.popularity > 60 || isProspect(fighter))).slice(0, 1).forEach(fighter => {
    items.push({ id: `free-agent-${fighter.id}`, severity: 'opportunity', title: 'High-value free agent', description: `${fighter.firstName} ${fighter.lastName} is available to sign.`, targetView: 'free-agents', fighterId: fighter.id, priority: 40 });
  });

  return items.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || b.priority - a.priority || (a.date ?? '').localeCompare(b.date ?? '') || a.title.localeCompare(b.title));
}
