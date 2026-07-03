import { GameState, Event, FightMatchup, WeightClass, Fighter } from '../../types/game';
import { v4 as uuidv4 } from 'uuid';
import { calculateEventProjections } from './economy';

const EVENT_INTERVAL_DAYS = 28;

function calculateDateDifference(d1: string, d2: string) {
  return Math.abs(new Date(d1).getTime() - new Date(d2).getTime()) / (1000 * 3600 * 24);
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function autoBookEventsAndContracts(state: GameState): GameState {
  let newState = { ...state };

  if (newState.autopilot.nextBookingAttemptDate && new Date(newState.currentDate).getTime() < new Date(newState.autopilot.nextBookingAttemptDate).getTime()) {
    // Also maintain roster even if skipping event booking
    return maintainRoster(newState);
  }

  // Check if we need a new event
  const upcomingEvents = Object.values(newState.events).filter(e => !e.isCompleted);
  
  if (upcomingEvents.length === 0) {
    const lastEvent = Object.values(newState.events).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    let nextDateStr = newState.currentDate;
    
    if (lastEvent) {
      const daysSince = calculateDateDifference(lastEvent.date, newState.currentDate);
      if (daysSince < EVENT_INTERVAL_DAYS) {
        nextDateStr = addDays(lastEvent.date, EVENT_INTERVAL_DAYS);
      }
    } else {
       nextDateStr = addDays(newState.currentDate, EVENT_INTERVAL_DAYS);
    }
    
    // Emergency funding check
    if (newState.promotion.money < -100000) {
      newState.promotion.money += 100000;
      newState.promotion.reputation = Math.max(0, newState.promotion.reputation - 5);
      newState.news = [{
        id: uuidv4(),
        date: newState.currentDate,
        title: `Emergency Funding Injected`,
        content: `The promotion has secured $100,000 in emergency funding to avoid bankruptcy, though reputation has suffered.`,
        type: 'general'
      }, ...newState.news];
      
      if (!newState.financeLedger) newState.financeLedger = [];
      newState.financeLedger.unshift({
         id: uuidv4(),
         date: newState.currentDate,
         type: 'owner_injection',
         amount: 100000,
         description: 'Emergency funding injection',
         affectsCash: true,
         isSummary: false
      });
      
      // Update summary if exists
      if (newState.lastAutopilotSummary) {
        newState.lastAutopilotSummary.ownerCashInjections += 1;
        newState.lastAutopilotSummary.emergencyModeTriggered += 1;
      }
    }
    
    // Create new event
    const newEvent = generateAutoEvent(newState, nextDateStr);
    if (newEvent) {
      newState.events = { ...newState.events, [newEvent.id]: newEvent };
      newState.autopilot.nextBookingAttemptDate = null;
      newState.news = [{
        id: uuidv4(),
        date: newState.currentDate,
        title: `New Event Announced: ${newEvent.name}`,
        content: `Cage Dynasty has announced its next event, scheduled for ${newEvent.date}.`,
        type: 'general'
      }, ...newState.news];
    } else {
      // Delay by 14 days if no safe card could be booked, but do NOT mutate currentDate
      newState.autopilot.nextBookingAttemptDate = addDays(newState.currentDate, 14);
      
      // Only generate the news if we haven't flooded the news with it
      const recentNews = newState.news.slice(0, 3);
      if (!recentNews.some(n => n.title === 'Event Delayed')) {
        newState.news = [{
          id: uuidv4(),
          date: newState.currentDate,
          title: `Event Delayed`,
          content: `Cage Dynasty has delayed their next event to build up finances and find the right venue.`,
          type: 'general'
        }, ...newState.news];
      }
      
      if (newState.lastAutopilotSummary) {
        newState.lastAutopilotSummary.bookingDelays += 1;
      }
    }
  }

  // Handle contracts: renew champions and top contenders, sign if thin, release bloat
  newState = maintainRoster(newState);

  return newState;
}

export function maintainDeals(state: GameState): GameState {
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
    if (!activeSponsor || new Date(newState.currentDate) > new Date(activeSponsor.expiresDate)) {
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
            title: `New Sponsor: ${bestSponsor.name}`,
            content: `The promotion has signed a new ${bestSponsor.tier} sponsorship deal with ${bestSponsor.name}.`
         }, ...newState.news];
      }
    }
  }
  
  if (newState.mediaDeals) {
    let activeMedia = newState.mediaDeals.find(d => d.isActive);
    if (!activeMedia || new Date(newState.currentDate) > new Date(activeMedia.expiresDate)) {
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
            title: `New Broadcast Deal: ${bestMedia.name}`,
            content: `The promotion has signed a new ${bestMedia.tier} broadcast deal with ${bestMedia.name}.`
         }, ...newState.news];
      }
    }
  }
  
  return newState;
}

function generateAutoEvent(state: GameState, dateStr: string): Event | null {
  const eventName = `Cage Dynasty ${Object.keys(state.events).length + 1}`;
  
  const fights: Omit<FightMatchup, 'id' | 'result'>[] = [];
  const bookedFighters = new Set<string>();

  const signedFighters = Object.values(state.fighters).filter(f => f.contract && !f.injuryStatus && !f.medicalSuspension && f.fatigue < 50);

  // Group by wc
  const wcGroups: Record<string, Fighter[]> = {};
  signedFighters.forEach(f => {
    if (!wcGroups[f.weightClass]) wcGroups[f.weightClass] = [];
    wcGroups[f.weightClass].push(f);
  });

  // 1. Prepare weight classes and sorting
  const weightClasses = Object.keys(wcGroups) as WeightClass[];
  
  let fightsTarget = 6;
  if (state.promotion.reputation > 50) fightsTarget = 8;

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

  let titleFightBooked = false;

  // Helper to check if a fighter is available
  const isAvailable = (id: string | null | undefined) => id && !bookedFighters.has(id);

  // Priority 1: Unification Fights
  for (const wc of weightClasses) {
    if (titleFightBooked) break;
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
        newNews.push({ id: uuidv4(), date: dateStr, title: `Unification Title Fight Booked`, content: `${champ.lastName} and ${interimChamp.lastName} will fight to unify the ${wc} championship.`, type: 'general' });
        titleFightBooked = true;
      }
    }
  }

  // Priority 2: Overdue Undisputed Defenses
  if (!titleFightBooked) {
    // find WCs with undisputed champ, active, and overdue (e.g. > 120 days)
    for (const wc of weightClasses) {
      if (titleFightBooked) break;
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
              titleFightBooked = true;
            }
          }
        }
      }
    }
  }

  // Priority 3: Interim Title Fights (for inactive champions)
  if (!titleFightBooked) {
    for (const wc of weightClasses) {
      if (titleFightBooked) break;
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
          newNews.push({ id: uuidv4(), date: dateStr, title: `Interim ${wc} Title Fight Booked`, content: `${contender1.lastName} and ${contender2.lastName} will fight for the interim ${wc} championship.`, type: 'general' });
          titleFightBooked = true;
        }
      }
    }
  }

  // Priority 4: Vacant Undisputed Titles
  if (!titleFightBooked) {
    for (const wc of weightClasses) {
      if (titleFightBooked) break;
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
          newNews.push({ id: uuidv4(), date: dateStr, title: `Vacant ${wc} Title Fight Booked`, content: `${available[0].lastName} and ${available[1].lastName} will fight for the vacant ${wc} championship.`, type: 'general' });
          titleFightBooked = true;
        }
      }
    }
  }

  // Fill rest of card
  for (const wc of weightClasses) {
    if (fights.length >= fightsTarget) break;
    const available = wcGroups[wc].filter(f => !bookedFighters.has(f.id)).sort((a, b) => b.popularity - a.popularity);
    
    for (let i = 0; i < available.length - 1; i += 2) {
      if (fights.length >= fightsTarget) break;
      fights.push({
        redCornerId: available[i].id,
        blueCornerId: available[i+1].id,
        weightClass: wc as WeightClass,
        isTitleFight: false,
        rounds: 3
      });
      bookedFighters.add(available[i].id);
      bookedFighters.add(available[i+1].id);
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

  for (const v of venues) {
    if (!isEmergency && v.cost > state.promotion.money * 0.7) continue;
    if (isEmergency && v.capacity > 3000) continue; // Only small venues in emergency
    
    // adjust marketing based on money
    const marketing = isEmergency ? 500 : Math.min(25000, Math.max(1000, Math.floor(state.promotion.money * 0.1)));
    const tPrice = Math.floor(v.capacity * 0.05) + 20;

    const proj = calculateEventProjections(
      fightsWithIds,
      state.fighters,
      v,
      tPrice,
      marketing,
      state.promotion,
      state.storylines,
      state.titles
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

  if (!bestVenue) return null; // Couldn't find a financially safe venue

  if (newNews.length > 0) {
    state.news = [...newNews, ...state.news];
  }

  return {
    id: uuidv4(),
    name: eventName,
    date: dateStr,
    venueId: bestVenue.id,
    fights: fightsWithIds,
    ticketPrice: bestTicketPrice,
    marketingSpend: bestMarketing,
    isCompleted: false
  };
}

function maintainRoster(state: GameState): GameState {
  const newState = { ...state, fighters: { ...state.fighters }, news: [...state.news] };
  const signedFighters = Object.values(newState.fighters).filter(f => f.contract);
  
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
        .filter(f => !f.isChampion && f.contract && f.contract.fightsRemaining <= 2)
        .sort((a, b) => a.popularity - b.popularity);
      
      if (disposable.length > 0 && newState.promotion.money < 100000) { // only release if we need money
        const toRelease = disposable[0];
        newState.fighters[toRelease.id] = { ...toRelease, contract: null };
        newState.news.unshift({
          id: uuidv4(), date: newState.currentDate, type: 'contract',
          title: `Fighter Released`,
          content: `${toRelease.firstName} ${toRelease.lastName} was released from their contract.`
        });
      }
    }

    // Sign logic if too few
    if (inWc.length < 6 && newState.promotion.money > 50000) {
      const freeAgents = Object.values(newState.fighters)
        .filter(f => !f.contract && f.weightClass === wc)
        .sort((a, b) => b.popularity - a.popularity);
      
      if (freeAgents.length > 0) {
        const toSign = freeAgents[0];
        const pay = 5000 + (toSign.popularity * 100);
        newState.fighters[toSign.id] = { 
          ...toSign, 
          contract: { payPerFight: pay, winBonus: pay, fightsRemaining: 4, exclusivity: true }
        };
        newState.news.unshift({
          id: uuidv4(), date: newState.currentDate, type: 'contract',
          title: `New Signing: ${toSign.lastName}`,
          content: `${toSign.firstName} ${toSign.lastName} has signed a new 4-fight contract.`
        });
      }
    }
  });

  // Auto-renew expiring champions
  signedFighters.forEach(f => {
    if (f.contract && f.contract.fightsRemaining <= 1) {
      if (f.isChampion || f.popularity > 60) {
        const pay = 10000 + (f.popularity * 200);
        newState.fighters[f.id] = {
          ...f,
          contract: { payPerFight: pay, winBonus: pay, fightsRemaining: 4, exclusivity: true }
        };
        newState.news.unshift({
          id: uuidv4(), date: newState.currentDate, type: 'contract',
          title: `Contract Renewed: ${f.lastName}`,
          content: `${f.firstName} ${f.lastName} has signed a new 4-fight extension.`
        });
      }
    }
  });

  return newState;
}
