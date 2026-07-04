import { GameState } from '../../types/game';
import { generateInitialWorld } from './generator';
import { syncChampionFlags } from '../engine';

const SAVE_KEY = 'cage-dynasty-save';
export const CURRENT_SAVE_VERSION = 5;

export function createNewGame(): GameState {
  const state = generateInitialWorld();
  state.saveVersion = CURRENT_SAVE_VERSION;
  return syncChampionFlags(state);
}

export function saveGameLocally(state: GameState): boolean {
  try {
    const saveState = extractSaveState(state);
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveState));
    return true;
  } catch (e) {
    console.error('Failed to save game locally:', e);
    return false;
  }
}

export function loadGameLocally(): GameState | null {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    return validateAndMigrateState(parsed);
  } catch (e) {
    console.error('Failed to load game locally:', e);
    return null;
  }
}

export function exportGameToJSON(state: GameState): void {
  const saveState = extractSaveState(state);
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(saveState));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", `cage-dynasty-save-${state.currentDate}.json`);
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

export function importGameFromJSON(jsonString: string): GameState | null {
  try {
    const parsed = JSON.parse(jsonString);
    return validateAndMigrateState(parsed);
  } catch (e) {
    console.error('Failed to import save file:', e);
    return null;
  }
}

function extractSaveState(state: GameState): Partial<GameState> {
  return {
    currentDate: state.currentDate,
    promotion: state.promotion,
    fighters: state.fighters,
    events: state.events,
    venues: state.venues,
    rankings: state.rankings,
    titles: state.titles,
    belts: state.belts,
    news: state.news,
    storylines: state.storylines,
    saveVersion: state.saveVersion,
    mode: state.mode,
    autopilot: state.autopilot,
    fightArchive: state.fightArchive,
    eventArchive: state.eventArchive,
    titleHistory: state.titleHistory,
    yearlyAwards: state.yearlyAwards,
    sponsorDeals: state.sponsorDeals,
    mediaDeals: state.mediaDeals,
    financeLedger: state.financeLedger,
    tournaments: state.tournaments || {}
  };
}

function validateAndMigrateState(parsed: any): GameState | null {
  if (!parsed || !parsed.currentDate || !parsed.promotion || !parsed.fighters) {
    return null;
  }
  
  // Create a shallow copy for migration
  let state = { ...parsed };

  // Check for missing properties from earlier versions
  if (state.storylines === undefined) {
    state.storylines = [];
  }
  
  if (state.titles === undefined) {
    state.titles = {
      'Bantamweight': { championId: null, defenses: 0 },
      'Featherweight': { championId: null, defenses: 0 },
      'Lightweight': { championId: null, defenses: 0 },
      'Welterweight': { championId: null, defenses: 0 },
      'Middleweight': { championId: null, defenses: 0 },
      'Heavyweight': { championId: null, defenses: 0 },
    };
    
    // Attempt to recover champions from fighters list
    for (const id in state.fighters) {
       const f = state.fighters[id];
       if (f.isChampion && state.titles[f.weightClass].championId === null) {
          state.titles[f.weightClass].championId = id;
          state.titles[f.weightClass].defenses = f.titleDefenses || 0;
       } else if (f.isChampion) {
          // conflict resolution: only one champ per WC
          f.isChampion = false; 
       }
    }
  }
  
  for (const id in state.fighters) {
    const f = state.fighters[id];
    
    // Add potential if missing
    if (f.potential === undefined) {
      f.potential = 50;
    }
    
    // Migrate string injuryStatus to object
    if (typeof f.injuryStatus === 'string') {
      f.injuryStatus = { id: id + '-inj', type: f.injuryStatus, daysRemaining: 14 };
    }
    
    // Add lastFightDate if missing
    if (f.lastFightDate === undefined) {
      f.lastFightDate = null;
    }
  }

  // Migrate observer mode and archives
  if (!state.mode) state.mode = 'manager';
  if (!state.autopilot) state.autopilot = { enabled: false, watchEvents: false };
  if (!state.fightArchive) state.fightArchive = {};
  if (!state.eventArchive) state.eventArchive = {};
  if (!state.titleHistory) state.titleHistory = [];
  if (!state.yearlyAwards) state.yearlyAwards = {};
  if (!state.sponsorDeals) state.sponsorDeals = [];
  if (!state.mediaDeals) state.mediaDeals = [];
  if (!state.financeLedger) state.financeLedger = [];
  if (!state.tournaments) {
    state.tournaments = {};
  } else {
    for (const id in state.tournaments) {
      if (!state.tournaments[id].format) {
        state.tournaments[id].format = 'four_man';
      }
      if (!state.tournaments[id].usedReserveFighterIds) {
        state.tournaments[id].usedReserveFighterIds = [];
      }
    }
  }
  
  // Migrate ledger entries missing isSummary/affectsCash
  if (state.financeLedger.length > 0) {
    state.financeLedger = state.financeLedger.map((entry: any) => {
      if (entry.isSummary === undefined || entry.affectsCash === undefined) {
        const isSummaryType = entry.type === 'event_profit' || entry.type === 'event_cost';
        return {
          ...entry,
          isSummary: isSummaryType,
          affectsCash: !isSummaryType
        };
      }
      return entry;
    });
  }
  
  if (!state.belts) {
    state.belts = {};
    const WEIGHT_CLASSES = ['Bantamweight', 'Featherweight', 'Lightweight', 'Welterweight', 'Middleweight', 'Heavyweight'] as const;
    WEIGHT_CLASSES.forEach(wc => {
      const beltId = `belt_${wc.toLowerCase()}`;
      state.belts[beltId] = {
        id: beltId,
        name: `Cage Dynasty ${wc} Championship`,
        shortName: `CD ${wc} Title`,
        weightClass: wc,
        type: 'undisputed',
        prestige: 60
      };
    });
  }

  // Migrate titles to support interim titles
  for (const wc in state.titles) {
    const t = state.titles[wc];
    if (t.undisputedChampionId === undefined) {
      t.undisputedChampionId = t.championId || null;
      t.undisputedDefenses = t.defenses || 0;
      t.interimChampionId = null;
      t.interimDefenses = 0;
      delete t.championId;
      delete t.defenses;
    }
    
    // Fallback default status
    if (!t.status) {
      if (t.undisputedChampionId && t.interimChampionId) {
        t.status = 'unification_needed';
      } else if (t.interimChampionId) {
        t.status = 'interim_active';
      } else if (t.undisputedChampionId) {
        t.status = 'active';
      } else {
        t.status = 'vacant';
      }
    }
  }
  
  state.saveVersion = CURRENT_SAVE_VERSION;
  return syncChampionFlags(state as GameState);
}
