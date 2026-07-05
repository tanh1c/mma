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

  // 4. Assign Grand Prix round slots
  // We'll replace slot types of some planned slots with grand_prix_round
  let gpScheduled = 0;
  let currentSlotIdx = 1;
  const weightClasses: WeightClass[] = ['Bantamweight', 'Featherweight', 'Lightweight', 'Welterweight', 'Middleweight', 'Heavyweight'];
  
  while (gpScheduled < targetGrandPrix && currentSlotIdx + 4 < slots.length) {
    const isEightMan = rep >= 60 && money >= 200000;
    const targetWc = weightClasses[Math.floor(Math.random() * weightClasses.length)];
    
    if (isEightMan) {
      // 8-man needs 3 rounds (QF, SF, F). We'll use slotIdx, slotIdx+2, slotIdx+4
      const qfSlot = slots[currentSlotIdx];
      const sfSlot = slots[currentSlotIdx + 2];
      const fSlot = slots[currentSlotIdx + 4];
      
      qfSlot.type = 'grand_prix_round';
      qfSlot.targetWeightClass = targetWc;
      qfSlot.tournamentRound = 'quarterfinal';
      qfSlot.notes = [...(qfSlot.notes || []), `Planned ${targetWc} QF`];
      
      sfSlot.type = 'grand_prix_round';
      sfSlot.targetWeightClass = targetWc;
      sfSlot.tournamentRound = 'semifinal';
      sfSlot.notes = [...(sfSlot.notes || []), `Planned ${targetWc} SF`];
      
      fSlot.type = 'grand_prix_round';
      fSlot.targetWeightClass = targetWc;
      fSlot.tournamentRound = 'final';
      fSlot.notes = [...(fSlot.notes || []), `Planned ${targetWc} Final`];
      
      gpScheduled++;
      currentSlotIdx += 5;
    } else {
      // 4-man needs 2 rounds (SF, F). We'll use slotIdx, slotIdx+2
      const sfSlot = slots[currentSlotIdx];
      const fSlot = slots[currentSlotIdx + 2];
      
      sfSlot.type = 'grand_prix_round';
      sfSlot.targetWeightClass = targetWc;
      sfSlot.tournamentRound = 'semifinal';
      sfSlot.notes = [...(sfSlot.notes || []), `Planned ${targetWc} SF`];
      
      fSlot.type = 'grand_prix_round';
      fSlot.targetWeightClass = targetWc;
      fSlot.tournamentRound = 'final';
      fSlot.notes = [...(fSlot.notes || []), `Planned ${targetWc} Final`];
      
      gpScheduled++;
      currentSlotIdx += 3;
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

