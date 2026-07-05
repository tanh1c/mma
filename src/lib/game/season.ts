import { GameState, SeasonPlan, SeasonCalendarSlot, WeightClass, TournamentRound, CalendarSlotType, CalendarSlotStatus } from '../../types/game';
import { v4 as uuidv4 } from 'uuid';

export function generateSeasonPlan(state: GameState, year: number): SeasonPlan {
  const rep = state.promotion.reputation;
  const money = state.promotion.money;

  // Determine target counts based on reputation
  let targetEvents = 9;
  let targetTentpoles = 1;
  let targetGrandPrix = 0;

  if (rep < 30) {
    targetEvents = 8 + Math.floor(Math.random() * 3); // 8-10
    targetTentpoles = Math.random() < 0.5 ? 0 : 1;
    targetGrandPrix = Math.random() < 0.4 ? 0 : 1;
  } else if (rep < 60) {
    targetEvents = 10 + Math.floor(Math.random() * 3); // 10-12
    targetTentpoles = 1 + Math.floor(Math.random() * 2); // 1-2
    targetGrandPrix = 1;
  } else {
    targetEvents = 12 + Math.floor(Math.random() * 3); // 12-14
    targetTentpoles = 2 + Math.floor(Math.random() * 2); // 2-3
    targetGrandPrix = 1 + (Math.random() < 0.3 ? 1 : 0); // 1-2
  }

  // Generate date slots
  const dates: string[] = [];
  const interval = 365 / targetEvents;
  let lastDate: Date | null = null;
  
  for (let i = 0; i < targetEvents; i++) {
    const minDayOfInterval = i * interval;
    const midDay = minDayOfInterval + (interval / 2);
    // Add jitter +/- 4 days
    const dayOfYear = Math.floor(midDay + (Math.random() * 8 - 4));
    
    const dateObj = new Date(year, 0, 1);
    dateObj.setDate(Math.max(1, Math.min(365, dayOfYear)));
    
    if (lastDate) {
      const diffTime = dateObj.getTime() - lastDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < 21) {
        dateObj.setTime(lastDate.getTime() + 21 * 24 * 60 * 60 * 1000);
      }
    }
    
    if (dateObj.getFullYear() === year) {
      dates.push(dateObj.toISOString().split('T')[0]);
      lastDate = dateObj;
    }
  }

  // Assign slot types
  const slotTypes: CalendarSlotType[] = Array(dates.length).fill('regular_event');
  
  // 1. Assign tentpoles
  const tentpoleMonths = [2, 3, 6, 7, 11]; // Mar, Apr, Jul, Aug, Dec (0-indexed)
  let tentpolesAssigned = 0;
  for (let i = 0; i < dates.length; i++) {
    if (tentpolesAssigned >= targetTentpoles) break;
    const d = new Date(dates[i]);
    if (tentpoleMonths.includes(d.getMonth())) {
      slotTypes[i] = 'tentpole_event';
      tentpolesAssigned++;
    }
  }
  // Fallback if needed
  for (let i = 0; i < dates.length; i++) {
    if (tentpolesAssigned >= targetTentpoles) break;
    if (slotTypes[i] === 'regular_event') {
      slotTypes[i] = 'tentpole_event';
      tentpolesAssigned++;
    }
  }

  // 2. Assign title fight cards
  let titleCardsAssigned = 0;
  const targetTitleCards = Math.max(1, Math.floor(targetEvents / 4));
  for (let i = 0; i < dates.length; i++) {
    if (titleCardsAssigned >= targetTitleCards) break;
    if (slotTypes[i] === 'regular_event') {
      slotTypes[i] = 'title_fight_card';
      titleCardsAssigned++;
    }
  }

  // 3. Assign recovery gaps
  // Introduce 1 recovery gap in the second half of the year
  const gapIndex = Math.floor(dates.length * 0.7);
  if (gapIndex > 0 && gapIndex < slotTypes.length) {
    slotTypes[gapIndex] = 'recovery_gap';
  }

  // Define calendar slots list
  const slots: SeasonCalendarSlot[] = dates.map((date, index) => ({
    id: uuidv4(),
    year,
    date,
    type: slotTypes[index],
    status: 'planned',
    priority: slotTypes[index] === 'tentpole_event' ? 3 : (slotTypes[index] === 'title_fight_card' ? 2 : 1),
    notes: []
  }));

  // 4. Assign Grand Prix window slots
  let gpScheduled = 0;
  let currentSlotIdx = 1;
  
  while (gpScheduled < targetGrandPrix && currentSlotIdx < slots.length) {
    const slot = slots[currentSlotIdx];
    if (slot.type === 'regular_event') {
      const slotMonth = new Date(slot.date).getMonth();
      let prefNote = "";
      if (rep >= 75 && (slotMonth === 6 || slotMonth === 11)) {
        prefNote = " (8-Man Preferred)";
      }
      slot.type = 'grand_prix_window';
      slot.notes = [...(slot.notes || []), `Grand Prix Window planned${prefNote}.`];
      gpScheduled++;
      currentSlotIdx += 4; // Space them out
    } else {
      currentSlotIdx++;
    }
  }

  return {
    year,
    createdDate: state.currentDate,
    slots,
    targetEvents: slots.filter(s => s.type !== 'recovery_gap').length,
    targetTentpoles,
    targetGrandPrix,
    status: 'active'
  };
}

export function syncCalendarSlots(state: GameState): GameState {
  const newState = { ...state };
  if (!newState.seasonPlans) {
    newState.seasonPlans = {};
    return newState;
  }
  
  const currentYear = new Date(newState.currentDate).getFullYear();
  const plan = newState.seasonPlans[currentYear];
  if (!plan) return newState;

  const updatedSlots = plan.slots.map(slot => {
    if (slot.status === 'completed' || slot.status === 'cancelled' || slot.status === 'missed') {
      return slot;
    }
    
    if (slot.eventId) {
      const event = newState.events[slot.eventId];
      if (event) {
        if (event.isCompleted) {
          return { ...slot, status: 'completed' as const };
        } else {
          return { ...slot, status: 'scheduled' as const };
        }
      } else {
        return { ...slot, status: 'planned' as const, eventId: undefined };
      }
    }
    
    // Calculate date difference
    const slotTime = new Date(slot.date).getTime();
    const currTime = new Date(newState.currentDate).getTime();
    const diffDays = Math.ceil((currTime - slotTime) / (1000 * 60 * 60 * 24));
    
    if (diffDays > 14 && slot.status === 'planned') {
      return { ...slot, status: 'missed' as const };
    }
    
    return slot;
  });

  newState.seasonPlans[currentYear] = {
    ...plan,
    slots: updatedSlots
  };
  
  return newState;
}

export function validateSeasonCalendarState(state: GameState): string[] {
  const errors: string[] = [];
  if (!state.seasonPlans) return errors;

  for (const yearStr in state.seasonPlans) {
    const plan = state.seasonPlans[Number(yearStr)];
    if (!plan) continue;

    plan.slots.forEach(slot => {
      // 1. no completed/scheduled grand_prix_round without tournamentId
      if (slot.type === 'grand_prix_round' && (slot.status === 'completed' || slot.status === 'scheduled') && !slot.tournamentId) {
        errors.push(`Slot ${slot.id} (${slot.date}): Completed/scheduled grand_prix_round is missing tournamentId.`);
      }

      // 2. no grand_prix_round without tournamentRound
      if (slot.type === 'grand_prix_round' && !slot.tournamentRound) {
        errors.push(`Slot ${slot.id} (${slot.date}): grand_prix_round is missing tournamentRound.`);
      }

      // 3. no linked slot where slot.eventId exists but event is missing from events/eventArchive
      if (slot.eventId) {
        const event = state.events[slot.eventId] || state.eventArchive[slot.eventId];
        if (!event) {
          errors.push(`Slot ${slot.id} (${slot.date}): Linked eventId ${slot.eventId} is missing from events/eventArchive.`);
        }
      }

      // 4. if linked event exists, slot.date === event.date
      if (slot.eventId) {
        const event = state.events[slot.eventId] || state.eventArchive[slot.eventId];
        if (event && slot.date !== event.date) {
          errors.push(`Slot ${slot.id} (${slot.date}): Date mismatch with linked event date (${event.date}).`);
        }
      }

      // 5. completed slot must link to completed event or valid recovery gap
      if (slot.status === 'completed') {
        if (slot.type === 'recovery_gap') {
          // valid
        } else if (!slot.eventId) {
          errors.push(`Slot ${slot.id} (${slot.date}): Completed slot must have a linked eventId or be a recovery gap.`);
        } else {
          const event = state.events[slot.eventId] || state.eventArchive[slot.eventId];
          if (event) {
            const isCompleted = 'isCompleted' in event ? event.isCompleted : true;
            if (!isCompleted) {
              errors.push(`Slot ${slot.id} (${slot.date}): Completed slot is linked to an incomplete event.`);
            }
          }
        }
      }

      // 6. scheduled slot must link to upcoming event
      if (slot.status === 'scheduled') {
        if (!slot.eventId) {
          errors.push(`Slot ${slot.id} (${slot.date}): Scheduled slot must have a linked eventId.`);
        } else {
          const event = state.events[slot.eventId];
          if (!event) {
            errors.push(`Slot ${slot.id} (${slot.date}): Scheduled slot is linked to an event that is missing or completed/archived.`);
          } else if (event.isCompleted) {
            errors.push(`Slot ${slot.id} (${slot.date}): Scheduled slot is linked to a completed event.`);
          }
        }
      }

      // 7. missed slot should not have eventId
      if (slot.status === 'missed' && slot.eventId) {
        errors.push(`Slot ${slot.id} (${slot.date}): Missed slot should not have eventId.`);
      }

      // 8. cancelled slot should not have future eventId
      if (slot.status === 'cancelled' && slot.eventId) {
        const event = state.events[slot.eventId];
        if (event && !event.isCompleted) {
          errors.push(`Slot ${slot.id} (${slot.date}): Cancelled slot is linked to a future/scheduled event.`);
        }
      }

      // 9. tournament round slot must match tournament weightClass and round
      if (slot.type === 'grand_prix_round' && slot.tournamentId) {
        const tourney = state.tournaments[slot.tournamentId];
        if (tourney) {
          if (slot.targetWeightClass !== tourney.weightClass) {
            errors.push(`Slot ${slot.id} (${slot.date}): GP round weightClass (${slot.targetWeightClass}) mismatch with tournament weightClass (${tourney.weightClass}).`);
          }
        }
      }

      // 10. no slot older than 14 days remains planned unless it is intentionally delayed with note
      const slotTime = new Date(slot.date).getTime();
      const currTime = new Date(state.currentDate).getTime();
      const diffDays = Math.ceil((currTime - slotTime) / (1000 * 3600 * 24));
      if (diffDays > 14 && slot.status === 'planned') {
        const isDelayed = (slot.notes || []).some(n => n.toLowerCase().includes('delayed') || n.toLowerCase().includes('rescheduled'));
        if (!isDelayed) {
          errors.push(`Slot ${slot.id} (${slot.date}): Overdue planned slot (older than 14 days) without delay/reschedule note.`);
        }
      }

      // 11. no tournament is linked to completed/missed/cancelled old slots at creation
      if (slot.tournamentId && (slot.status === 'completed' || slot.status === 'missed' || slot.status === 'cancelled')) {
        const tourney = state.tournaments[slot.tournamentId];
        if (tourney && tourney.status === 'planned') {
          errors.push(`Slot ${slot.id} (${slot.date}): Tournament "${tourney.name}" is planned/created but linked to completed/missed/cancelled slot.`);
        }
      }
    });
  }

  return errors;
}

