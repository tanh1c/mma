import { addDays, format } from "date-fns";
import { create } from 'zustand';
import { GameState, Fighter, Event, FightResult } from '../types/game';
import { generateInitialWorld } from '../lib/game/generator';
import { advanceTime, simulateSingleFightPreview, applyFightResult, finalizeEventFinancials } from '../lib/engine';
import { updateRankings } from '../lib/game/rankings';
import { v4 as uuidv4 } from 'uuid';
import { createNewGame, saveGameLocally, loadGameLocally, exportGameToJSON, importGameFromJSON, CURRENT_SAVE_VERSION } from '../lib/game/save';

import { autoBookEventsAndContracts, maintainDeals } from '../lib/game/autobooker';
import { quickSimulateEvent } from '../lib/engine';
import { createGrandPrixTournament, scheduleQuarterfinals, scheduleSemifinals, scheduleFinal, cancelTournament, runAutopilotTournaments, syncTournamentTitleShotFlags } from '../lib/game/tournament';
import { WeightClass, TournamentFormat } from '../types/game';

export interface ActiveSimulation {
  eventId: string | null;
  activeFightIndex: number;
  pendingResult: FightResult | null;
  revealedLines: number;
  status: 'idle' | 'replaying' | 'result-ready' | 'completed';
}

interface GameStore extends GameState {
  currentView: 'dashboard' | 'roster' | 'free-agents' | 'event-builder' | 'simulation' | 'rankings' | 'news' | 'fighter-detail' | 'debug' | 'history' | 'fight-detail' | 'tournaments';
  selectedFighterId: string | null;
  selectedEventId: string | null;
  selectedFightArchiveId: string | null;
  activeEventSimulation: ActiveSimulation | null;
  
  // Actions
  setView: (view: GameStore['currentView'], data?: { fighterId?: string, eventId?: string, fightArchiveId?: string }) => void;
  setMode: (mode: 'manager' | 'observer') => void;
  setAutopilot: (settings: Partial<GameState['autopilot']>) => void;
  newGame: () => void;
  saveGame: () => void;
  loadGame: () => void;
  advanceDays: (days: number) => void;
  advanceAutopilot: (targetDays: number, simulateEvents: boolean) => void;
  signFighter: (fighterId: string, pay: number, winBonus: number, fights: number) => void;
  renewFighter: (fighterId: string, pay: number, winBonus: number, fights: number) => void;
  releaseFighter: (fighterId: string) => void;
  signSponsorDeal: (templateId: string) => void;
  signMediaDeal: (templateId: string) => void;
  renewDeal: (dealId: string, type: 'sponsor'|'media') => void;
  createEvent: (event: Omit<Event, 'id' | 'isCompleted'>) => void;
  updateEvent: (eventId: string, event: Omit<Event, 'id' | 'isCompleted'>) => void;
  startEventSimulation: (eventId: string) => void;
  updateActiveSimulation: (data: Partial<ActiveSimulation>) => void;
  simulateNextFightPreview: () => void;
  confirmPendingFightAndAdvance: () => void;
  finalizeCurrentEvent: () => void;
  exportGame: () => void;
  importGame: (jsonData: string) => void;
  createTournament: (options: { weightClass: WeightClass, name: string, titleShotPromised: boolean, format?: TournamentFormat, participantIds?: string[], reserveIds?: string[] }) => void;
  scheduleQuarterfinals: (tournamentId: string, eventId: string) => void;
  scheduleSemifinals: (tournamentId: string, eventId: string) => void;
  scheduleFinal: (tournamentId: string, eventId: string) => void;
  cancelTournament: (tournamentId: string) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...createNewGame(),
  currentView: 'dashboard',
  selectedFighterId: null,
  selectedEventId: null,
  selectedFightArchiveId: null,
  activeEventSimulation: null,

  setView: (view, data) => set({ 
    currentView: view, 
    selectedFighterId: data?.fighterId || null,
    selectedEventId: data?.eventId || null,
    selectedFightArchiveId: data?.fightArchiveId || null
  }),

  setMode: (mode) => set({ mode }),
  
  setAutopilot: (settings) => set(state => ({ 
    autopilot: { ...state.autopilot, ...settings } 
  })),
  
  newGame: () => {
    set({ ...createNewGame(), currentView: 'dashboard', selectedFighterId: null, selectedEventId: null });
  },

  saveGame: () => {
    const state = get();
    if (saveGameLocally(state)) {
      alert('Game saved!');
    } else {
      alert('Failed to save game');
    }
  },

  loadGame: () => {
    const loadedState = loadGameLocally();
    if (loadedState) {
      set({ ...loadedState });
      alert('Game loaded!');
    } else {
      alert('Failed to load save or no save found');
    }
  },

  exportGame: () => {
    exportGameToJSON(get());
  },

  importGame: (jsonData) => {
    const importedState = importGameFromJSON(jsonData);
    if (importedState) {
      set({ ...importedState, currentView: 'dashboard' });
      alert('Game imported successfully!');
    } else {
      alert('Failed to import save. Invalid or corrupted data.');
    }
  },

  advanceDays: (days) => {
    set((state) => {
      let newState = advanceTime(state, days);
      newState = updateRankings(newState); // simple rank update on advance
      return newState;
    });
  },

  advanceAutopilot: (targetDays, simulateEvents) => {
    set((state) => {
      let newState = { ...state };
      
      const startMoney = state.promotion.money;
      const startRep = state.promotion.reputation;
      const startEventsCount = Object.values(state.events).length;
      const startCompletedCount = Object.values(state.events).filter(e => e.isCompleted).length;
      const startFightsSimulated = Object.values(state.fightArchive).length;
      const startTitleDefenses = state.titleHistory.reduce((sum, th) => sum + th.defenses, 0);
      const startChampions = state.titleHistory.length;
      
      let stoppedEarly = false;
      let daysSimulated = 0;
      
      const calendarStartDate = state.currentDate;
      
      // Initialize accumulator object for the simulation run
      newState.lastAutopilotSummary = {
        daysSimulated: 0,
        calendarStartDate,
        calendarEndDate: state.currentDate,
        eventsCreated: 0,
        eventsCompleted: 0,
        fightsSimulated: 0,
        moneyChange: 0,
        reputationChange: 0,
        newChampions: 0,
        titleDefenses: 0,
        bookingDelays: 0,
        ownerCashInjections: 0,
        emergencyModeTriggered: 0
      };
      
      for (let i = 0; i < targetDays; i++) {
        let gameState: GameState = {
          currentDate: newState.currentDate,
          promotion: newState.promotion,
          fighters: newState.fighters,
          events: newState.events,
          venues: newState.venues,
          rankings: newState.rankings,
          titles: newState.titles,
          belts: newState.belts,
          news: newState.news,
          storylines: newState.storylines,
          saveVersion: newState.saveVersion,
          mode: newState.mode,
          autopilot: newState.autopilot,
          lastAutopilotSummary: newState.lastAutopilotSummary,
          fightArchive: newState.fightArchive,
          eventArchive: newState.eventArchive,
          titleHistory: newState.titleHistory,
          yearlyAwards: newState.yearlyAwards,
          sponsorDeals: newState.sponsorDeals,
          mediaDeals: newState.mediaDeals,
          financeLedger: newState.financeLedger,
          tournaments: newState.tournaments || {}
        };
        
        // Auto-book events and contracts
        gameState = autoBookEventsAndContracts(gameState);
        gameState = runAutopilotTournaments(gameState);

        // Advance 1 day
        gameState = advanceTime(gameState, 1);
        gameState = maintainDeals(gameState);
        gameState = syncTournamentTitleShotFlags(gameState);
        daysSimulated++;
        
        Object.assign(newState, gameState);
        
        // If there's an event today, simulate it
        const todayEvents = Object.values(newState.events).filter(e => e.date === newState.currentDate && !e.isCompleted);
        
        if (todayEvents.length > 0) {
          const event = todayEvents[0];
          if (simulateEvents) {
            // Stop to watch event
            newState.currentView = 'simulation';
            newState.selectedEventId = event.id;
            
            // Setup active simulation
            let startIndex = event.fights.length - 1;
            while (startIndex >= 0 && event.fights[startIndex].result) {
              startIndex--;
            }

            newState.activeEventSimulation = {
              eventId: event.id,
              activeFightIndex: startIndex,
              pendingResult: null,
              revealedLines: 0,
              status: 'idle'
            };
            
            stoppedEarly = true;
            break; // Break out of the loop
          } else {
            // Quick simulate the entire event
            const simResult = quickSimulateEvent(newState, event.id);
            Object.assign(newState, simResult);
            // Optionally, add a news item or delay
          }
        }
      }
      
      const rankUpdate = updateRankings(newState);
      Object.assign(newState, rankUpdate);
      
      // Update summary
      if (newState.lastAutopilotSummary) {
        
        let bestFightId: string | undefined;
        let bestFightRating = 0;
        let biggestUpsetId: string | undefined;
        let biggestUpsetDiff = 0; // Negative popularity diff won by underdog
        let majorInjuries = 0;
        let biggestProfit = 0;
        let worstLoss = 0;
        let newUndisputedChampions = 0;
        let newInterimChampions = 0;
        let unifications = 0;
        
        // Find new events
        const newEvents = Object.values(newState.eventArchive).filter(e => e.date > calendarStartDate && e.date <= newState.currentDate);
        for (const e of newEvents) {
           if (e.profit > biggestProfit) biggestProfit = e.profit;
           if (e.profit < worstLoss) worstLoss = e.profit;
        }

        // Find new fights
        const newFights = Object.values(newState.fightArchive).filter(f => f.date > calendarStartDate && f.date <= newState.currentDate);
        for (const f of newFights) {
           if (f.performanceRating > bestFightRating) {
              bestFightRating = f.performanceRating;
              bestFightId = f.id;
           }
           
           if (f.winnerId && f.redFighterId && f.blueFighterId) {
              const rFighter = newState.fighters[f.redFighterId];
              const bFighter = newState.fighters[f.blueFighterId];
              if (rFighter && bFighter) {
                 if (f.winnerId === f.redFighterId && bFighter.popularity > rFighter.popularity + 10) {
                    if (bFighter.popularity - rFighter.popularity > biggestUpsetDiff) {
                       biggestUpsetDiff = bFighter.popularity - rFighter.popularity;
                       biggestUpsetId = f.id;
                    }
                 } else if (f.winnerId === f.blueFighterId && rFighter.popularity > bFighter.popularity + 10) {
                    if (rFighter.popularity - bFighter.popularity > biggestUpsetDiff) {
                       biggestUpsetDiff = rFighter.popularity - bFighter.popularity;
                       biggestUpsetId = f.id;
                    }
                 }
              }
           }
           
           if (f.titleChangeInfo) {
              if (f.titleChangeInfo.type === 'new_champion') newUndisputedChampions++;
              if (f.titleChangeInfo.type === 'interim_won') newInterimChampions++;
              if (f.titleChangeInfo.type === 'unified') unifications++;
           }
           if (f.injuries && f.injuries.length > 0) {
              for (const inj of f.injuries) {
                 if (inj.daysRemaining >= 90) majorInjuries++;
              }
           }
        }
        
        let awardsGenerated = false;
        if (newState.yearlyAwards && Object.keys(newState.yearlyAwards).some(y => Number(y) >= new Date(calendarStartDate).getFullYear())) {
           awardsGenerated = true;
        }
        
        newState.lastAutopilotSummary = {
          ...newState.lastAutopilotSummary,
          daysSimulated,
          calendarEndDate: newState.currentDate,
          eventsCreated: Object.values(newState.events).length - startEventsCount,
          eventsCompleted: Object.values(newState.events).filter(e => e.isCompleted).length - startCompletedCount,
          fightsSimulated: Object.values(newState.fightArchive).length - startFightsSimulated,
          moneyChange: newState.promotion.money - startMoney,
          reputationChange: newState.promotion.reputation - startRep,
          newChampions: Math.max(0, newState.titleHistory.length - startChampions),
          titleDefenses: newState.titleHistory.reduce((sum, th) => sum + th.defenses, 0) - startTitleDefenses,
          highlights: {
             bestFightId,
             biggestUpsetId,
             newUndisputedChampions,
             newInterimChampions,
             unifications,
             majorInjuries,
             biggestProfit,
             worstLoss,
             awardsGenerated
          }
        };
      }
      
      return newState;
    });
  },

  signFighter: (fighterId, pay, winBonus, fights) => {
    set((state) => {
      const f = state.fighters[fighterId];
      if (!f) return state;
      
      const updated = {
        ...f,
        contract: { fightsRemaining: fights, payPerFight: pay, winBonus, exclusivity: true }
      };
      
      const newState = {
        ...state,
        fighters: { ...state.fighters, [fighterId]: updated },
        news: [{
          id: uuidv4(),
          date: state.currentDate,
          title: `Signed ${f.firstName} ${f.lastName}`,
          content: `${f.firstName} has signed a ${fights}-fight deal with ${state.promotion.shortName}.`,
          type: 'contract' as const
        }, ...state.news].slice(0, 50)
      };
      
      return updateRankings(newState);
    });
  },
  
  renewFighter: (fighterId, pay, winBonus, fights) => {
    set((state) => {
      const f = state.fighters[fighterId];
      if (!f || !f.contract) return state;
      
      const updated = {
        ...f,
        contract: { ...f.contract, fightsRemaining: fights, payPerFight: pay, winBonus }
      };
      
      const newState = {
        ...state,
        fighters: { ...state.fighters, [fighterId]: updated },
        news: [{
          id: uuidv4(),
          date: state.currentDate,
          title: `Contract Renewed: ${f.firstName} ${f.lastName}`,
          content: `${f.firstName} has signed a ${fights}-fight contract extension with ${state.promotion.shortName}.`,
          type: 'contract' as const
        }, ...state.news].slice(0, 50)
      };
      
      return newState;
    });
  },
  
  releaseFighter: (fighterId) => {
    set((state) => {
      const f = state.fighters[fighterId];
      if (!f) return state;
      
      const updated = { ...f, contract: null, isChampion: false };
      
      const newTitles = { ...state.titles };
      let newTitleHistory = state.titleHistory;
      
      if (newTitles[f.weightClass].undisputedChampionId === fighterId || newTitles[f.weightClass].interimChampionId === fighterId) {
        if (newTitles[f.weightClass].undisputedChampionId === fighterId) {
          newTitles[f.weightClass] = { ...newTitles[f.weightClass], undisputedChampionId: null, undisputedDefenses: 0 };
        }
        if (newTitles[f.weightClass].interimChampionId === fighterId) {
          newTitles[f.weightClass] = { ...newTitles[f.weightClass], interimChampionId: null, interimDefenses: 0 };
        }
        
        // Update status appropriately. If undisputed left, and interim remains, they might get elevated, but for now we just say vacated.
        if (!newTitles[f.weightClass].undisputedChampionId && !newTitles[f.weightClass].interimChampionId) {
           newTitles[f.weightClass].status = 'vacant';
        } else if (!newTitles[f.weightClass].undisputedChampionId) {
           newTitles[f.weightClass].status = 'vacant';
        } else if (!newTitles[f.weightClass].interimChampionId) {
           newTitles[f.weightClass].status = 'active'; // Or whatever it was before
        }
        
        // Fix title history on vacate/release
        newTitleHistory = state.titleHistory.map(th => {
          if (th.fighterId === fighterId && th.weightClass === f.weightClass && th.status === 'active') {
            return { ...th, status: 'vacated', dateLost: state.currentDate, lostToFighterId: null };
          }
          return th;
        });
      }
      
      const newState = {
        ...state,
        fighters: { ...state.fighters, [fighterId]: updated },
        titles: newTitles,
        titleHistory: newTitleHistory,
        news: [{
          id: uuidv4(),
          date: state.currentDate,
          title: `Released ${f.firstName} ${f.lastName}`,
          content: `${state.promotion.shortName} has parted ways with ${f.firstName}.`,
          type: 'contract' as const
        }, ...state.news].slice(0, 50)
      };
      
      return updateRankings(newState);
    });
  },

  signSponsorDeal: (templateId) => {
    set(state => {
       const availableSponsors = [
          { name: 'Combat Athletics Co.', tier: 'local' as const, req: 0, monthly: 15000, event: 5000, title: 2500 },
          { name: 'IronClad Nutrition', tier: 'regional' as const, req: 35, monthly: 45000, event: 15000, title: 7500 },
          { name: 'Apex Fight Gear', tier: 'national' as const, req: 65, monthly: 120000, event: 35000, title: 20000 }
       ];
       const tmpl = availableSponsors.find(s => s.name === templateId);
       if (!tmpl || state.promotion.reputation < tmpl.req) return state;

       const currentSponsors = [...(state.sponsorDeals || [])].map(d => ({ ...d, isActive: false }));
       
       const nextYear = format(addDays(new Date(state.currentDate), 365), 'yyyy-MM-dd');
       
       currentSponsors.push({
           id: uuidv4(),
           name: tmpl.name,
           tier: tmpl.tier,
           monthlyIncome: tmpl.monthly,
           bonusPerEvent: tmpl.event,
           bonusPerTitleFight: tmpl.title,
           expiresDate: nextYear,
           reputationRequirement: tmpl.req,
           isActive: true
       });

       return { ...state, sponsorDeals: currentSponsors };
    });
  },

  signMediaDeal: (templateId) => {
    set(state => {
       const availableMedia = [
          { name: 'FightNet Local', tier: 'local' as const, req: 0, monthly: 20000, event: 10000, highRating: 5000 },
          { name: 'CageCast Regional', tier: 'regional' as const, req: 35, monthly: 60000, event: 25000, highRating: 15000 },
          { name: 'Prime Combat Network', tier: 'national' as const, req: 65, monthly: 200000, event: 50000, highRating: 40000 }
       ];
       const tmpl = availableMedia.find(s => s.name === templateId);
       if (!tmpl || state.promotion.reputation < tmpl.req) return state;

       const currentMedia = [...(state.mediaDeals || [])].map(d => ({ ...d, isActive: false }));
       
       const nextYear = format(addDays(new Date(state.currentDate), 365), 'yyyy-MM-dd');
       
       currentMedia.push({
           id: uuidv4(),
           name: tmpl.name,
           tier: tmpl.tier,
           monthlyIncome: tmpl.monthly,
           bonusPerEvent: tmpl.event,
           bonusForHighRatedEvent: tmpl.highRating,
           expiresDate: nextYear,
           reputationRequirement: tmpl.req,
           isActive: true
       });

       return { ...state, mediaDeals: currentMedia };
    });
  },

  renewDeal: (dealId, type) => {
    set(state => {
       
       const nextYear = format(addDays(new Date(state.currentDate), 365), 'yyyy-MM-dd');
       if (type === 'sponsor' && state.sponsorDeals) {
          const updated = state.sponsorDeals.map(d => {
             if (d.id === dealId) return { ...d, expiresDate: nextYear, isActive: true };
             if (d.isActive) return { ...d, isActive: false };
             return d;
          });
          return { ...state, sponsorDeals: updated };
       }
       if (type === 'media' && state.mediaDeals) {
          const updated = state.mediaDeals.map(d => {
             if (d.id === dealId) return { ...d, expiresDate: nextYear, isActive: true };
             if (d.isActive) return { ...d, isActive: false };
             return d;
          });
          return { ...state, mediaDeals: updated };
       }
       return state;
    });
  },

  createEvent: (eventData) => {
    set((state) => {
      const id = uuidv4();
      const newEvt: Event = { ...eventData, id, isCompleted: false };
      
      return {
        events: { ...state.events, [id]: newEvt },
        currentView: 'dashboard',
        news: [{
          id: uuidv4(),
          date: state.currentDate,
          title: `Event Announced: ${newEvt.name}`,
          content: `Tickets are now on sale for ${newEvt.name}.`,
          type: 'event' as const
        }, ...state.news].slice(0, 50)
      };
    });
  },

  updateEvent: (eventId, eventData) => {
    set((state) => {
      const existing = state.events[eventId];
      if (!existing || existing.isCompleted) return state;
      
      const updatedEvt: Event = { ...existing, ...eventData };
      
      return {
        events: { ...state.events, [eventId]: updatedEvt },
        currentView: 'dashboard'
      };
    });
  },

  startEventSimulation: (eventId) => {
    set((state) => {
      const event = state.events[eventId];
      if (!event) return state;
      
      let tempState: GameState = { ...state };
      
      if (new Date(event.date) > new Date(tempState.currentDate)) {
         tempState.currentDate = event.date;
      }

      // Find first unsimulated fight from the bottom of the card
      let startIndex = event.fights.length - 1;
      while (startIndex >= 0 && event.fights[startIndex].result) {
        startIndex--;
      }

      const simState: ActiveSimulation = {
        eventId,
        activeFightIndex: startIndex,
        pendingResult: null,
        revealedLines: 0,
        status: 'idle'
      };

      return {
        ...tempState,
        currentView: 'simulation',
        selectedEventId: eventId,
        activeEventSimulation: simState
      };
    });
  },

  updateActiveSimulation: (data) => {
    set((state) => {
      if (!state.activeEventSimulation) return state;
      return {
        activeEventSimulation: {
          ...state.activeEventSimulation,
          ...data
        }
      };
    });
  },

  simulateNextFightPreview: () => {
    set((state) => {
      const sim = state.activeEventSimulation;
      if (!sim || !sim.eventId) return state;
      
      const event = state.events[sim.eventId];
      if (!event || event.isCompleted) return state;

      if (sim.activeFightIndex < 0) {
        return state;
      }

      const pendingResult = simulateSingleFightPreview(state, sim.eventId, sim.activeFightIndex);
      
      if (!pendingResult) return state;

      return {
        activeEventSimulation: {
          ...sim,
          pendingResult,
          revealedLines: 0,
          status: 'replaying'
        }
      };
    });
  },

  confirmPendingFightAndAdvance: () => {
    set((state) => {
      const sim = state.activeEventSimulation;
      if (!sim || !sim.eventId || !sim.pendingResult) return state;
      
      const event = state.events[sim.eventId];
      if (!event || event.isCompleted) return state;

      const matchup = event.fights[sim.activeFightIndex];
      // Check if this fight already has a result (idempotency against double-clicks)
      if (!matchup || matchup.result) return state;
      
      const tempState = applyFightResult(state, sim.eventId, sim.activeFightIndex, sim.pendingResult);
      
      const nextIndex = sim.activeFightIndex - 1;
      
      return {
        ...tempState,
        activeEventSimulation: {
          ...sim,
          activeFightIndex: nextIndex,
          pendingResult: null,
          revealedLines: 0,
          status: nextIndex < 0 ? 'completed' : 'idle'
        }
      };
    });
  },

  finalizeCurrentEvent: () => {
    set((state) => {
      const eventId = state.selectedEventId;
      if (!eventId) return state;

      let tempState = finalizeEventFinancials(state, eventId);
      tempState = updateRankings(tempState, eventId);

      return {
        ...tempState
      };
    });
  },

  createTournament: (options) => {
    set((state) => {
      try {
        const nextState = createGrandPrixTournament(state, options);
        return nextState;
      } catch (err: any) {
        alert(err.message);
        return state;
      }
    });
  },
  
  scheduleQuarterfinals: (tournamentId, eventId) => {
    set((state) => {
      try {
        const nextState = scheduleQuarterfinals(state, tournamentId, eventId);
        alert("Quarterfinals scheduled successfully!");
        return nextState;
      } catch (err: any) {
        alert(err.message);
        return state;
      }
    });
  },
  
  scheduleSemifinals: (tournamentId, eventId) => {
    set((state) => {
      try {
        const nextState = scheduleSemifinals(state, tournamentId, eventId);
        alert("Semifinals scheduled successfully!");
        return nextState;
      } catch (err: any) {
        alert(err.message);
        return state;
      }
    });
  },
  
  scheduleFinal: (tournamentId, eventId) => {
    set((state) => {
      try {
        const nextState = scheduleFinal(state, tournamentId, eventId);
        const tourney = nextState.tournaments[tournamentId];
        if (tourney && tourney.finalDelayReason) {
          alert(`Grand Prix Final Delayed: ${tourney.finalDelayReason}\nReschedule expected after: ${tourney.earliestFinalDate}`);
        } else {
          alert("Final scheduled successfully!");
        }
        return nextState;
      } catch (err: any) {
        alert(err.message);
        return state;
      }
    });
  },
  
  cancelTournament: (tournamentId) => {
    set((state) => {
      try {
        const nextState = cancelTournament(state, tournamentId);
        alert("Tournament cancelled.");
        return nextState;
      } catch (err: any) {
        alert(err.message);
        return state;
      }
    });
  },

}));
