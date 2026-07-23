import { addDays, differenceInCalendarDays, format } from "date-fns";
import { create } from 'zustand';
import { GameState, Fighter, Event, PromoterIdentity, type MarketContractTerms, type MarketReason } from '../types/game';
import { readLanguage } from '../lib/localization';
import { generateInitialWorld } from '../lib/game/generator';
import { advanceTime, applyFightResult, finalizeEventFinancials } from '../lib/engine';
import { createFightSession, fightSessionToResult, runFightSession, stepFightSession, type FightSession } from '../lib/game/liveFight';
import { createFightPlaybackSnapshot, type FightPlaybackSnapshot } from '../lib/game/fightPlayback';
import { updateRankings } from '../lib/game/rankings';
import { v4 as uuidv4 } from 'uuid';
import { createNewGame, saveGameLocally, loadGameLocally, exportGameToJSON, importGameFromJSON, CURRENT_SAVE_VERSION } from '../lib/game/save';
import { getContractEndDate } from '../lib/game/contracts';
import { getPlayerPromotionId, syncPlayerPromotionSnapshot } from '../lib/game/leagues';
import {
  isContractMarketOpen,
  listFighter,
  respondToIncomingOffer,
  upsertTransferOffer,
  withdrawListing,
  withdrawTransferOffer
} from '../lib/game/contractMarket';
import {
  canPromotionAffordContractCommitment,
  investInPromotionBrand,
  refreshPromotionEconomy,
  type PromotionEconomyReason
} from '../lib/game/promotionEconomy';

import { autoBookEventsAndContracts, maintainDeals, repairEventAvailability, repairFutureEventAvailability, repairPastScheduledEvents, simulateDueEvents } from '../lib/game/autobooker';
import { generateSeasonPlan, syncCalendarSlots } from '../lib/game/season';
import { createGrandPrixTournament, scheduleQuarterfinals, scheduleSemifinals, scheduleFinal, cancelTournament, runAutopilotTournaments, syncTournamentTitleShotFlags, scheduleTournamentRound } from '../lib/game/tournament';
import { WeightClass, TournamentFormat } from '../types/game';
import { applyPromotionSocialAction as applySocialAction, generateScheduledFightSocial } from '../lib/game/social';
import { runObserverDecisions } from '../lib/game/observer';
import { applyFighterEdit, type FighterEditInput, type FighterEditResult } from '../lib/game/career';
import { expireStaleDramaIncidents, generateScheduledDrama, hasPendingIncidentForEvent, resolveDramaIncident as applyDramaResponse } from '../lib/game/drama';

export interface ActiveSimulation {
  eventId: string | null;
  activeFightIndex: number;
  session: FightSession | null;
  status: 'idle' | 'running' | 'paused' | 'between-rounds' | 'finished' | 'completed';
  playbackSpeed: 1 | 2 | 4;
  playbackSnapshot: FightPlaybackSnapshot | null;
  eventElapsedMs: number;
  roundGateToken: number | null;
}

export type GameView = 'dashboard' | 'inbox' | 'roster' | 'free-agents' | 'contract-market' | 'promotion-finances' | 'event-builder' | 'simulation' | 'rankings' | 'news' | 'fighter-detail' | 'debug' | 'history' | 'fight-detail' | 'tournaments' | 'leagues' | 'calendar' | 'mma-guide' | 'settings';

export type AutopilotRun = {
  active: boolean;
  targetDays: number;
  daysCompleted: number;
  batchSize: number;
  stoppedEarly: boolean;
  error: string | null;
};

const AUTOPILOT_BATCH_DAYS = 7;
const yieldToEventLoop = () => new Promise<void>(resolve => setTimeout(resolve, 0));
const idleAutopilotRun = (): AutopilotRun => ({
  active: false,
  targetDays: 0,
  daysCompleted: 0,
  batchSize: AUTOPILOT_BATCH_DAYS,
  stoppedEarly: false,
  error: null
});

type ViewData = {
  fighterId?: string;
  eventId?: string;
  fightArchiveId?: string;
  calendarSlotId?: string;
};

type ViewCheckpoint = {
  view: GameView;
  selectedFighterId: string | null;
  selectedEventId: string | null;
  selectedCalendarSlotId: string | null;
  selectedFightArchiveId: string | null;
};

interface GameStore extends GameState {
  currentView: GameView;
  selectedFighterId: string | null;
  selectedEventId: string | null;
  selectedCalendarSlotId: string | null;
  selectedFightArchiveId: string | null;
  viewHistory: ViewCheckpoint[];
  activeEventSimulation: ActiveSimulation | null;
  autopilotRun: AutopilotRun;

  // Actions
  setView: (view: GameView, data?: ViewData, options?: { replace?: boolean }) => void;
  goBack: (fallback?: GameView) => void;
  setMode: (mode: 'manager' | 'observer') => void;
  setAutopilot: (settings: Partial<GameState['autopilot']>) => void;
  newGame: () => void;
  saveGame: () => void;
  loadGame: () => void;
  advanceDays: (days: number) => void;
  advanceAutopilot: (targetDays: number, simulateEvents: boolean) => Promise<void>;
  signFighter: (fighterId: string, pay: number, winBonus: number, fights: number) => void;
  renewFighter: (fighterId: string, pay: number, winBonus: number, fights: number) => void;
  listMarketFighter: (fighterId: string, minimumFee: number) => MarketReason | null;
  withdrawMarketListing: (listingId: string) => MarketReason | null;
  submitMarketOffer: (fighterId: string, transferFee: number, terms: MarketContractTerms) => MarketReason | null;
  withdrawMarketOffer: (offerId: string) => MarketReason | null;
  respondToMarketOffer: (offerId: string, accepted: boolean) => MarketReason | null;
  setCounterOffer: (fighterId: string, counterOffer: GameState['fighters'][string]['counterOffer']) => void;
  releaseFighter: (fighterId: string) => void;
  editFighter: (fighterId: string, input: FighterEditInput) => FighterEditResult;
  signSponsorDeal: (templateId: string) => void;
  signMediaDeal: (templateId: string) => void;
  renewDeal: (dealId: string, type: 'sponsor'|'media') => void;
  createEvent: (event: Omit<Event, 'id' | 'isCompleted' | 'promotionId' | 'scope'>) => void;
  updateEvent: (eventId: string, event: Partial<Omit<Event, 'id' | 'isCompleted' | 'promotionId' | 'scope'>>) => void;
  startEventSimulation: (eventId: string) => void;
  startLiveFight: () => void;
  advanceLiveFight: () => void;
  checkpointLiveFightPlayback: (sequence: number, elapsedFightMs: number) => void;
  continueLiveFightRound: () => void;
  setLiveFightPlayback: (speed: 1 | 2 | 4) => void;
  toggleLiveFightPause: () => void;
  skipLiveFight: () => void;
  confirmPendingFightAndAdvance: () => void;
  finalizeCurrentEvent: () => void;
  exportGame: () => void;
  importGame: (jsonData: string) => void;
  createTournament: (options: { weightClass: WeightClass, name: string, titleShotPromised: boolean, format?: TournamentFormat, participantIds?: string[], reserveIds?: string[] }) => void;
  scheduleQuarterfinals: (tournamentId: string, eventId: string) => void;
  scheduleSemifinals: (tournamentId: string, eventId: string) => void;
  scheduleFinal: (tournamentId: string, eventId: string) => void;
  cancelTournament: (tournamentId: string) => void;
  generateCurrentYearPlan: () => void;
  cancelCalendarSlot: (slotId: string) => void;
  applyPromotionSocialAction: (fightId: string, action: 'announce' | 'hype') => void;
  resolveDramaIncident: (incidentId: string, responseKey: string) => void;
  investInBrand: (amount: number) => PromotionEconomyReason | null;
  setPromoterIdentity: (identity: PromoterIdentity) => void;
}

const liveFightStatus = (session: FightSession): ActiveSimulation['status'] =>
  session.phase === 'finished'
    ? 'finished'
    : session.phase === 'between-rounds' && session.round < session.matchup.rounds
      ? 'between-rounds'
      : 'running';

export const useGameStore = create<GameStore>((set, get) => ({
  ...createNewGame(),
  currentView: 'dashboard',
  selectedFighterId: null,
  selectedEventId: null,
  selectedCalendarSlotId: null,
  selectedFightArchiveId: null,
  viewHistory: [],
  activeEventSimulation: null,
  autopilotRun: idleAutopilotRun(),

  setView: (view, data, options) => set((state) => {
    const selectedFighterId = data?.fighterId || null;
    const selectedEventId = data?.eventId || null;
    const selectedCalendarSlotId = data?.calendarSlotId || null;
    const selectedFightArchiveId = data?.fightArchiveId || null;
    const isCurrentView = state.currentView === view &&
      state.selectedFighterId === selectedFighterId &&
      state.selectedEventId === selectedEventId &&
      state.selectedCalendarSlotId === selectedCalendarSlotId &&
      state.selectedFightArchiveId === selectedFightArchiveId;

    return {
      currentView: view,
      selectedFighterId,
      selectedEventId,
      selectedCalendarSlotId,
      selectedFightArchiveId,
      viewHistory: options?.replace || isCurrentView
        ? state.viewHistory
        : [...state.viewHistory, {
            view: state.currentView,
            selectedFighterId: state.selectedFighterId,
            selectedEventId: state.selectedEventId,
            selectedCalendarSlotId: state.selectedCalendarSlotId,
            selectedFightArchiveId: state.selectedFightArchiveId
          }].slice(-25)
    };
  }),

  goBack: (fallback = 'dashboard') => set((state) => {
    const checkpoint = state.viewHistory.at(-1);
    if (!checkpoint) {
      return {
        currentView: fallback,
        selectedFighterId: null,
        selectedEventId: null,
        selectedCalendarSlotId: null,
        selectedFightArchiveId: null,
        viewHistory: []
      };
    }

    return {
      currentView: checkpoint.view,
      selectedFighterId: checkpoint.selectedFighterId,
      selectedEventId: checkpoint.selectedEventId,
      selectedCalendarSlotId: checkpoint.selectedCalendarSlotId,
      selectedFightArchiveId: checkpoint.selectedFightArchiveId,
      viewHistory: state.viewHistory.slice(0, -1)
    };
  }),

  setMode: (mode) => set({ mode }),
  
  setAutopilot: (settings) => set(state => ({ 
    autopilot: { ...state.autopilot, ...settings } 
  })),
  
  newGame: () => {
    set({
      ...createNewGame(),
      currentView: 'dashboard',
      selectedFighterId: null,
      selectedEventId: null,
      selectedCalendarSlotId: null,
      selectedFightArchiveId: null,
      viewHistory: [],
      activeEventSimulation: null,
      autopilotRun: idleAutopilotRun()
    });
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
      set({
        ...loadedState,
        currentView: 'dashboard',
        selectedFighterId: null,
        selectedEventId: null,
        selectedCalendarSlotId: null,
        selectedFightArchiveId: null,
        viewHistory: [],
        activeEventSimulation: null,
        autopilotRun: idleAutopilotRun()
      });
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
      set({
        ...importedState,
        currentView: 'dashboard',
        selectedFighterId: null,
        selectedEventId: null,
        selectedCalendarSlotId: null,
        selectedFightArchiveId: null,
        viewHistory: [],
        activeEventSimulation: null,
        autopilotRun: idleAutopilotRun()
      });
      alert('Game imported successfully!');
    } else {
      alert('Failed to import save. Invalid or corrupted data.');
    }
  },

  advanceDays: (days) => {
    set((state) => {
      const language = readLanguage();
      let newState = advanceTime(state, days, language);
      newState = repairFutureEventAvailability(newState, language);
      return updateRankings(newState);
    });
  },

  advanceAutopilot: async (targetDays, simulateEvents) => {
    if (get().autopilotRun.active) return;

    const state = get();
    const language = readLanguage();
    set({
      autopilotRun: {
        active: true,
        targetDays,
        daysCompleted: 0,
        batchSize: AUTOPILOT_BATCH_DAYS,
        stoppedEarly: false,
        error: null
      }
    });

    await yieldToEventLoop();

    try {
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
        let gameState: GameState = { ...newState };
        
        gameState = syncCalendarSlots(gameState);
        gameState = repairPastScheduledEvents(gameState, language);

        let dueResult = simulateDueEvents(gameState, simulateEvents, language);
        gameState = syncCalendarSlots(dueResult.state);
        if (dueResult.stoppedForManualEvent && dueResult.selectedEventId) {
          Object.assign(newState, gameState);
          const recheckedEvent = newState.events[dueResult.selectedEventId];
          if (recheckedEvent) {
            newState.viewHistory = [...newState.viewHistory, {
              view: newState.currentView,
              selectedFighterId: newState.selectedFighterId,
              selectedEventId: newState.selectedEventId,
              selectedCalendarSlotId: newState.selectedCalendarSlotId,
              selectedFightArchiveId: newState.selectedFightArchiveId
            }].slice(-25);
            newState.currentView = 'simulation';
            newState.selectedEventId = recheckedEvent.id;
            let startIndex = recheckedEvent.fights.length - 1;
            while (startIndex >= 0 && recheckedEvent.fights[startIndex].result) startIndex--;
            newState.activeEventSimulation = {
              eventId: recheckedEvent.id,
              activeFightIndex: startIndex,
              session: null,
              status: 'idle',
              playbackSpeed: 1,
              playbackSnapshot: null,
              eventElapsedMs: 0,
              roundGateToken: null
            };
          }
          stoppedEarly = true;
          break;
        }

        gameState = autoBookEventsAndContracts(gameState, language);
        gameState = runAutopilotTournaments(gameState, language);
        gameState = repairFutureEventAvailability(gameState, language);
        gameState = runObserverDecisions(gameState, language);
        gameState = advanceTime(gameState, 1, language);
        gameState = maintainDeals(gameState, language);
        gameState = repairFutureEventAvailability(gameState, language);
        gameState = syncTournamentTitleShotFlags(gameState);
        gameState = repairPastScheduledEvents(gameState, language);

        dueResult = simulateDueEvents(gameState, simulateEvents, language);
        gameState = syncCalendarSlots(dueResult.state);
        daysSimulated++;
        Object.assign(newState, gameState);

        if (dueResult.stoppedForManualEvent && dueResult.selectedEventId) {
          const recheckedEvent = newState.events[dueResult.selectedEventId];
          if (recheckedEvent) {
            newState.viewHistory = [...newState.viewHistory, {
              view: newState.currentView,
              selectedFighterId: newState.selectedFighterId,
              selectedEventId: newState.selectedEventId,
              selectedCalendarSlotId: newState.selectedCalendarSlotId,
              selectedFightArchiveId: newState.selectedFightArchiveId
            }].slice(-25);
            newState.currentView = 'simulation';
            newState.selectedEventId = recheckedEvent.id;
            let startIndex = recheckedEvent.fights.length - 1;
            while (startIndex >= 0 && recheckedEvent.fights[startIndex].result) startIndex--;
            newState.activeEventSimulation = {
              eventId: recheckedEvent.id,
              activeFightIndex: startIndex,
              session: null,
              status: 'idle',
              playbackSpeed: 1,
              playbackSnapshot: null,
              eventElapsedMs: 0,
              roundGateToken: null
            };
          }
          stoppedEarly = true;
          break;
        }

        if (daysSimulated % AUTOPILOT_BATCH_DAYS === 0 && daysSimulated < targetDays) {
          set({ ...newState, autopilotRun: { ...get().autopilotRun, daysCompleted: daysSimulated } });
          await yieldToEventLoop();
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
      
      set({
        ...newState,
        autopilotRun: {
          ...get().autopilotRun,
          daysCompleted: daysSimulated,
          stoppedEarly
        }
      });
    } catch (error) {
      set(state => ({
        autopilotRun: {
          ...state.autopilotRun,
          error: error instanceof Error ? error.message : String(error)
        }
      }));
      throw error;
    } finally {
      set(state => ({ autopilotRun: { ...state.autopilotRun, active: false } }));
    }
  },

  signFighter: (fighterId, pay, winBonus, fights) => {
    set((state) => {
      const f = state.fighters[fighterId];
      const playerPromotionId = getPlayerPromotionId(state);
      const commitment = fights * (pay + winBonus * 0.5);
      if (
        isContractMarketOpen(state) ||
        !f ||
        f.contract?.promotionId && f.contract.promotionId !== playerPromotionId ||
        canPromotionAffordContractCommitment(state, playerPromotionId, commitment)
      ) return state;

      const updated = {
        ...f,
        contract: {
          promotionId: playerPromotionId,
          fightsRemaining: fights,
          payPerFight: pay,
          winBonus,
          exclusivity: true,
          endDate: getContractEndDate(state.currentDate, fights),
          lastNegotiationDate: state.currentDate
        },
        counterOffer: undefined
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
      
      return refreshPromotionEconomy(updateRankings(newState), playerPromotionId);
    });
  },

  renewFighter: (fighterId, pay, winBonus, fights) => {
    set((state) => {
      const f = state.fighters[fighterId];
      const playerPromotionId = getPlayerPromotionId(state);
      const commitment = fights * (pay + winBonus * 0.5);
      if (
        isContractMarketOpen(state) ||
        !f?.contract ||
        f.contract.promotionId !== playerPromotionId ||
        canPromotionAffordContractCommitment(state, playerPromotionId, commitment)
      ) return state;

      const updated = {
        ...f,
        contract: {
          ...f.contract,
          fightsRemaining: fights,
          payPerFight: pay,
          winBonus,
          endDate: getContractEndDate(state.currentDate, fights),
          lastNegotiationDate: state.currentDate,
          counterOffer: undefined
        },
        counterOffer: undefined
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
      
      return refreshPromotionEconomy(syncPlayerPromotionSnapshot(updateRankings(newState)), playerPromotionId);
    });
  },

  listMarketFighter: (fighterId, minimumFee) => {
    const result = listFighter(get(), getPlayerPromotionId(get()), fighterId, minimumFee);
    if (result.ok === false) return result.reason;
    set(result.state);
    return null;
  },

  withdrawMarketListing: (listingId) => {
    const result = withdrawListing(get(), getPlayerPromotionId(get()), listingId);
    if (result.ok === false) return result.reason;
    set(result.state);
    return null;
  },

  submitMarketOffer: (fighterId, transferFee, terms) => {
    const state = get();
    const result = upsertTransferOffer(state, {
      buyerPromotionId: getPlayerPromotionId(state),
      fighterId,
      transferFee,
      terms
    });
    if (result.ok === false) return result.reason;
    set(result.state);
    return null;
  },

  withdrawMarketOffer: (offerId) => {
    const result = withdrawTransferOffer(get(), getPlayerPromotionId(get()), offerId);
    if (result.ok === false) return result.reason;
    set(result.state);
    return null;
  },

  respondToMarketOffer: (offerId, accepted) => {
    const result = respondToIncomingOffer(get(), getPlayerPromotionId(get()), offerId, accepted);
    if (result.ok === false) return result.reason;
    set(result.state);
    return null;
  },

  setCounterOffer: (fighterId, counterOffer) => set((state) => {
    const fighter = state.fighters[fighterId];
    if (!fighter) return state;
    return { ...state, fighters: { ...state.fighters, [fighterId]: { ...fighter, counterOffer } } };
  }),

  editFighter: (fighterId, input) => {
    const result = applyFighterEdit(get(), fighterId, input);
    if (result.ok) set(result.state);
    return result;
  },

  releaseFighter: (fighterId) => {
    set((state) => {
      const f = state.fighters[fighterId];
      const playerPromotionId = getPlayerPromotionId(state);
      if (
        isContractMarketOpen(state) ||
        !f ||
        f.contract?.promotionId !== playerPromotionId
      ) return state;
      
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
          if (th.scope === 'promotion' && th.promotionId === playerPromotionId && th.fighterId === fighterId && th.weightClass === f.weightClass && th.status === 'active') {
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
      
      return refreshPromotionEconomy(syncPlayerPromotionSnapshot(updateRankings(newState)), playerPromotionId);
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

       const nextState = { ...state, sponsorDeals: currentSponsors };
       return refreshPromotionEconomy(nextState, getPlayerPromotionId(nextState));
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

       const nextState = { ...state, mediaDeals: currentMedia };
       return refreshPromotionEconomy(nextState, getPlayerPromotionId(nextState));
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
          const nextState = { ...state, sponsorDeals: updated };
          return refreshPromotionEconomy(nextState, getPlayerPromotionId(nextState));
       }
       if (type === 'media' && state.mediaDeals) {
          const updated = state.mediaDeals.map(d => {
             if (d.id === dealId) return { ...d, expiresDate: nextYear, isActive: true };
             if (d.isActive) return { ...d, isActive: false };
             return d;
          });
          const nextState = { ...state, mediaDeals: updated };
          return refreshPromotionEconomy(nextState, getPlayerPromotionId(nextState));
       }
       return state;
    });
  },

  createEvent: (eventData) => {
    set((state) => {
      const id = uuidv4();
      const newEvt: Event = { ...eventData, id, isCompleted: false, promotionId: getPlayerPromotionId(state), scope: 'promotion' };
      
      let nextState = {
        ...state,
        events: { ...state.events, [id]: newEvt },
        currentView: 'dashboard' as const,
        selectedCalendarSlotId: null,
        news: [{
          id: uuidv4(),
          date: state.currentDate,
          title: `Event Announced: ${newEvt.name}`,
          content: `Tickets are now on sale for ${newEvt.name}.`,
          type: 'event' as const
        }, ...state.news].slice(0, 50)
      };

      if (state.selectedCalendarSlotId && state.seasonPlans) {
        const year = new Date(state.currentDate).getFullYear();
        const plan = state.seasonPlans[year];
        if (plan) {
          const slot = plan.slots.find(s => s.id === state.selectedCalendarSlotId);
          if (slot) {
            const slots = plan.slots.map(s => {
              if (s.id === state.selectedCalendarSlotId) {
                const notes = [...(s.notes || [])];
                const originalDate = s.date;
                const eventDate = newEvt.date;
                if (originalDate !== eventDate) {
                  notes.push(`Rescheduled from ${originalDate} to ${eventDate} to match linked event.`);
                }
                notes.push(`Manually booked event on ${state.currentDate}.`);
                return {
                  ...s,
                  eventId: id,
                  status: 'scheduled' as const,
                  date: eventDate,
                  notes
                };
              }
              return s;
            });
            slots.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            nextState.seasonPlans = {
              ...nextState.seasonPlans,
              [year]: { ...plan, slots }
            };

            if (slot.type === 'grand_prix_round' && slot.tournamentId && slot.tournamentRound) {
              try {
                const gpState = scheduleTournamentRound(nextState, slot.tournamentId, slot.tournamentRound, id);
                gpState.events[id].fights = newEvt.fights.map(f => {
                  const originalGpMatch = gpState.events[id].fights.find(gf => 
                    gf.tournamentFightSlotId && 
                    gf.redCornerId === f.redCornerId && 
                    gf.blueCornerId === f.blueCornerId
                  );
                  if (originalGpMatch) {
                    return { 
                      ...f, 
                      id: originalGpMatch.id, 
                      tournamentId: originalGpMatch.tournamentId, 
                      tournamentRound: originalGpMatch.tournamentRound, 
                      tournamentFightSlotId: originalGpMatch.tournamentFightSlotId 
                    };
                  }
                  return f;
                });
                nextState = {
                  ...nextState,
                  ...gpState
                };
              } catch (e) {
                console.error("Manual GP scheduling integration failed", e);
              }
            }
          }
        }
      }

      return generateScheduledFightSocial(nextState, state.currentDate);
    });
  },

  updateEvent: (eventId, eventData) => {
    set((state) => {
      const existing = state.events[eventId];
      if (!existing || existing.isCompleted) return state;

      const updatedEvt: Event = { ...existing, ...eventData };
      const nextState = expireStaleDramaIncidents(generateScheduledFightSocial({ ...state, events: { ...state.events, [eventId]: updatedEvt } }, state.currentDate));
      return { events: nextState.events, socialFeed: nextState.socialFeed, drama: nextState.drama, currentView: 'dashboard' };
    });
  },

  startEventSimulation: (eventId) => {
    set((state) => {
      const event = state.events[eventId];
      if (!event) return state;

      const language = readLanguage();
      let tempState = expireStaleDramaIncidents(repairEventAvailability(state, eventId, language));
      let updatedEvent = tempState.events[eventId];
      if (!updatedEvent) return tempState;

      if (updatedEvent.date !== event.date) return { ...tempState, currentView: 'dashboard' as const };
      if (tempState.mode === 'manager' && hasPendingIncidentForEvent(tempState, eventId)) {
        return { ...tempState, currentView: 'inbox' as const, selectedEventId: eventId, activeEventSimulation: null };
      }

      for (const daysBefore of [14, 7, 0]) {
        updatedEvent = tempState.events[eventId];
        if (!updatedEvent) return tempState;
        const daysUntil = differenceInCalendarDays(new Date(updatedEvent.date), new Date(tempState.currentDate));
        const daysToAdvance = daysUntil - daysBefore;
        if (daysToAdvance < 0) continue;
        tempState = daysToAdvance === 0
          ? generateScheduledDrama(tempState, tempState.currentDate, language)
          : advanceTime(tempState, daysToAdvance, language);
        tempState = expireStaleDramaIncidents(tempState);
        if (tempState.mode === 'observer') tempState = runObserverDecisions(tempState, language);
        if (tempState.mode === 'manager' && hasPendingIncidentForEvent(tempState, eventId)) {
          return { ...tempState, currentView: 'inbox' as const, selectedEventId: eventId, activeEventSimulation: null };
        }
      }

      updatedEvent = tempState.events[eventId];
      if (!updatedEvent) return tempState;
      let startIndex = updatedEvent.fights.length - 1;
      while (startIndex >= 0 && updatedEvent.fights[startIndex].result) startIndex--;

      const simState: ActiveSimulation = {
        eventId,
        activeFightIndex: startIndex,
        session: null,
        status: 'idle',
        playbackSpeed: 1,
        playbackSnapshot: null,
        eventElapsedMs: 0,
        roundGateToken: null
      };

      return {
        ...tempState,
        currentView: 'simulation' as const,
        selectedEventId: eventId,
        activeEventSimulation: simState
      };
    });
  },

  startLiveFight: () => set((state) => {
    const sim = state.activeEventSimulation;
    if (!sim?.eventId || sim.session || sim.activeFightIndex < 0) return state;
    const event = state.events[sim.eventId];
    const matchup = event?.fights[sim.activeFightIndex];
    if (!event || event.isCompleted || !matchup || matchup.result) return state;
    const red = state.fighters[matchup.redCornerId];
    const blue = state.fighters[matchup.blueCornerId];
    if (!red || !blue) return state;
    const before = createFightSession(matchup, red, blue, undefined, readLanguage());
    const session = stepFightSession(before);
    const latestEvent = session.timeline.at(-1)!;
    return {
      activeEventSimulation: {
        ...sim,
        session,
        status: liveFightStatus(session),
        playbackSnapshot: createFightPlaybackSnapshot(before, latestEvent.sequence),
        eventElapsedMs: 0,
        roundGateToken: session.phase === 'between-rounds' && session.round < session.matchup.rounds ? session.round : null
      }
    };
  }),

  advanceLiveFight: () => set((state) => {
    const sim = state.activeEventSimulation;
    if (!sim?.session || sim.status !== 'running') return state;
    const before = sim.session;
    const session = stepFightSession(before);
    const latestEvent = session.timeline.at(-1)!;
    return {
      activeEventSimulation: {
        ...sim,
        session,
        status: liveFightStatus(session),
        playbackSnapshot: createFightPlaybackSnapshot(before, latestEvent.sequence),
        eventElapsedMs: 0,
        roundGateToken: session.phase === 'between-rounds' && session.round < session.matchup.rounds ? session.round : null
      }
    };
  }),

  checkpointLiveFightPlayback: (sequence, eventElapsedMs) => set((state) => {
    const sim = state.activeEventSimulation;
    if (!sim?.session || !sim.playbackSnapshot || sequence !== sim.playbackSnapshot.sequence || sequence !== sim.session.timeline.at(-1)?.sequence) return state;
    const durationMs = sim.session.timeline.at(-1)?.durationMs ?? 0;
    return { activeEventSimulation: { ...sim, eventElapsedMs: Math.min(durationMs, Math.max(0, eventElapsedMs)) } };
  }),

  continueLiveFightRound: () => set((state) => {
    const sim = state.activeEventSimulation;
    if (!sim?.session || sim.status !== 'between-rounds' || sim.roundGateToken !== sim.session.round) return state;
    const before = sim.session;
    const session = stepFightSession(before);
    const latestEvent = session.timeline.at(-1)!;
    return {
      activeEventSimulation: {
        ...sim,
        session,
        status: 'running',
        playbackSnapshot: createFightPlaybackSnapshot(before, latestEvent.sequence),
        eventElapsedMs: 0,
        roundGateToken: null
      }
    };
  }),

  setLiveFightPlayback: (playbackSpeed) => set((state) => {
    const sim = state.activeEventSimulation;
    return sim ? { activeEventSimulation: { ...sim, playbackSpeed } } : state;
  }),

  toggleLiveFightPause: () => set((state) => {
    const sim = state.activeEventSimulation;
    if (!sim || (sim.status !== 'running' && sim.status !== 'paused')) return state;
    return { activeEventSimulation: { ...sim, status: sim.status === 'running' ? 'paused' : 'running' } };
  }),

  skipLiveFight: () => set((state) => {
    const sim = state.activeEventSimulation;
    if (!sim?.session || sim.status === 'completed') return state;
    return { activeEventSimulation: { ...sim, session: runFightSession(sim.session), status: 'finished', playbackSnapshot: null, eventElapsedMs: 0, roundGateToken: null } };
  }),

  confirmPendingFightAndAdvance: () => {
    set((state) => {
      const sim = state.activeEventSimulation;
      if (!sim?.eventId || !sim.session || sim.status !== 'finished') return state;
      const event = state.events[sim.eventId];
      const matchup = event?.fights[sim.activeFightIndex];
      if (!event || event.isCompleted || !matchup || matchup.result) return state;
      const tempState = applyFightResult(state, sim.eventId, sim.activeFightIndex, fightSessionToResult(sim.session));
      const nextIndex = sim.activeFightIndex - 1;
      return {
        ...tempState,
        activeEventSimulation: {
          ...sim,
          activeFightIndex: nextIndex,
          session: null,
          status: nextIndex < 0 ? 'completed' : 'idle',
          playbackSnapshot: null,
          eventElapsedMs: 0,
          roundGateToken: null
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

  generateCurrentYearPlan: () => {
    set((state) => {
      const year = new Date(state.currentDate).getFullYear();
      const plan = generateSeasonPlan(state, year);
      return {
        seasonPlans: {
          ...state.seasonPlans,
          [year]: plan
        }
      };
    });
  },

  cancelCalendarSlot: (slotId) => {
    set((state) => {
      const year = new Date(state.currentDate).getFullYear();
      const plan = state.seasonPlans?.[year];
      if (!plan) return state;

      const slots = plan.slots.map(s => {
        if (s.id === slotId) {
          return {
            ...s,
            status: 'cancelled' as const,
            notes: [...(s.notes || []), `Manually cancelled on ${state.currentDate}.`]
          };
        }
        return s;
      });

      return {
        seasonPlans: {
          ...state.seasonPlans,
          [year]: { ...plan, slots }
        }
      };
    });
  },

  applyPromotionSocialAction: (fightId, action) => set(state => applySocialAction(state, fightId, action)),

  resolveDramaIncident: (incidentId, responseKey) => set(state => applyDramaResponse(state, incidentId, responseKey, 'manager', undefined, readLanguage())),

  investInBrand: amount => {
    const state = get();
    const result = investInPromotionBrand(state, state.playerPromotionId, amount);
    if (result.ok === false) return result.reason;
    set(result.state);
    return null;
  },

  setPromoterIdentity: (identity) => set(state => ({ drama: { ...state.drama, promoterIdentity: identity } })),

}));
