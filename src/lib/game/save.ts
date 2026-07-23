import { addDays } from 'date-fns';
import { Contract, GameState } from '../../types/game';
import { CONTRACT_DAYS_PER_FIGHT } from './contracts';
import { generateInitialWorld } from './generator';
import { syncChampionFlags } from '../engine';
import { getBeltBranding } from '../branding';
import { getFighterOverall, normalizePhysicalProfile } from './fighterRatings';
import { syncLegacyNewsToSocialFeed } from './social';
import { getLocalizedFighterName, isLatinFighterName } from '../names';
import { ensureCareerMetadata } from './career';
import { ensurePersonalityTraits } from './personality';
import { syncPlayerPromotionSnapshot } from './leagues';
import { ensureRivalPromotions } from './rivalPromotions';
import { initializeInternationalCompetitionState } from './internationalCompetitions';
import { initializeContractMarketState, scheduleContractWindow } from './contractMarket';
import { initializePromotionEconomies } from './promotionEconomy';

const SAVE_KEY = 'cage-dynasty-save';
export const CURRENT_SAVE_VERSION = 16;

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
    playerPromotionId: state.playerPromotionId,
    promotions: state.promotions,
    promotion: state.promotion,
    fighters: state.fighters,
    events: state.events,
    venues: state.venues,
    rankingsByPromotion: state.rankingsByPromotion,
    titlesByPromotion: state.titlesByPromotion,
    beltsByPromotion: state.beltsByPromotion,
    worldRankings: state.worldRankings,
    internationalTitles: state.internationalTitles,
    internationalBelts: state.internationalBelts,
    internationalCompetitionYears: state.internationalCompetitionYears,
    rankings: state.rankings,
    titles: state.titles,
    belts: state.belts,
    news: state.news,
    socialFeed: state.socialFeed,
    storylines: state.storylines,
    saveVersion: state.saveVersion,
    mode: state.mode,
    autopilot: state.autopilot,
    fightArchive: state.fightArchive,
    eventArchive: state.eventArchive,
    titleHistory: state.titleHistory,
    statisticsTrackingStartedAt: state.statisticsTrackingStartedAt,
    fighterRankingHistory: state.fighterRankingHistory,
    yearlyAwards: state.yearlyAwards,
    sponsorDeals: state.sponsorDeals,
    mediaDeals: state.mediaDeals,
    financeLedger: state.financeLedger,
    tournaments: state.tournaments || {},
    contractMarket: state.contractMarket,
    promotionEconomies: state.promotionEconomies,
    seasonPlans: state.seasonPlans || {},
    careerEcosystem: state.careerEcosystem,
    drama: state.drama
  };
}

function normalizeContract(contract: any, currentDate: string, promotionId: string): Contract | null {
  if (!contract || typeof contract !== 'object') return null;
  const fightsRemaining = Math.max(0, Number(contract.fightsRemaining) || 0);
  const endDate = typeof contract.endDate === 'string' && !Number.isNaN(Date.parse(contract.endDate))
    ? contract.endDate
    : addDays(new Date(currentDate), Math.max(90, fightsRemaining * CONTRACT_DAYS_PER_FIGHT)).toISOString().slice(0, 10);
  const counterOffer = contract.counterOffer && typeof contract.counterOffer === 'object' && typeof contract.counterOffer.expiresDate === 'string'
    ? contract.counterOffer
    : undefined;
  const normalizedContract = { ...contract };
  delete normalizedContract.counterOffer;
  return { ...normalizedContract, promotionId: contract.promotionId || promotionId, fightsRemaining, endDate, ...(counterOffer ? { counterOffer } : {}) };
}

export function validateAndMigrateState(parsed: any): GameState | null {
  if (!parsed || !parsed.currentDate || !parsed.promotion || !parsed.fighters) {
    return null;
  }
  
  // Create a shallow copy for migration
  let state = { ...parsed };
  const playerPromotionId = state.playerPromotionId || state.promotion.id;
  state.playerPromotionId = playerPromotionId;
  state.promotion = { ...state.promotion, id: playerPromotionId, control: 'player' };
  state.promotions = {
    ...(state.promotions || {}),
    [playerPromotionId]: state.promotion
  };

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
  
  const currentYear = new Date(state.currentDate).getFullYear();
  for (const id in state.fighters) {
    let f = state.fighters[id];
    if (!isLatinFighterName(f.firstName) || !isLatinFighterName(f.lastName)) {
      const name = getLocalizedFighterName(f.nationality, [...id].reduce((seed, char) => (seed * 31 + char.charCodeAt(0)) | 0, 0));
      f.firstName = name.firstName;
      f.lastName = name.lastName;
    }

    const physicalProfile = normalizePhysicalProfile(f);
    f.heightCm = physicalProfile.heightCm;
    f.fightWeightLb = physicalProfile.fightWeightLb;
    f.walkAroundWeightLb = physicalProfile.walkAroundWeightLb;
    const overall = getFighterOverall(f);
    f.potential = Math.min(95, Math.max(overall, Number(f.potential) || overall));

    // Migrate string injuryStatus to object
    if (typeof f.injuryStatus === 'string') {
      f.injuryStatus = { id: id + '-inj', type: f.injuryStatus, daysRemaining: 14 };
    }
    
    // Add lastFightDate if missing
    if (f.lastFightDate === undefined) {
      f.lastFightDate = null;
    }

    f.contract = normalizeContract(f.contract, state.currentDate, playerPromotionId);
    f.counterOffer = f.counterOffer && typeof f.counterOffer === 'object' && typeof f.counterOffer.expiresDate === 'string' ? f.counterOffer : undefined;
    f = ensurePersonalityTraits(ensureCareerMetadata(f, currentYear));
    state.fighters[id] = f;
  }

  for (const eventId in state.events || {}) {
    const event = state.events[eventId];
    if (event.promotionId === undefined) event.promotionId = playerPromotionId;
    if (event.scope === undefined) event.scope = event.promotionId === null ? 'international' : 'promotion';
    event.fights = (event.fights || []).map((fight: any) => ({
      ...fight,
      campFocus: ['balanced', 'striking', 'wrestling', 'cardio', 'recovery'].includes(fight.campFocus) ? fight.campFocus : 'balanced',
      socialHype: Math.min(10, Math.max(0, Number(fight.socialHype) || 0))
    }));
  }
  if (!Array.isArray(state.socialFeed)) state.socialFeed = [];

  // Migrate observer mode and archives
  if (!state.mode) state.mode = 'manager';
  if (!state.autopilot) state.autopilot = { enabled: false, watchEvents: false, targetTournamentWeightClass: null };
  if (state.autopilot && state.autopilot.targetTournamentWeightClass === undefined) {
    state.autopilot.targetTournamentWeightClass = null;
  }
  if (!state.fightArchive) state.fightArchive = {};
  if (!state.eventArchive) state.eventArchive = {};
  if (!state.titleHistory) state.titleHistory = [];
  if (typeof state.statisticsTrackingStartedAt !== 'string' || Number.isNaN(Date.parse(state.statisticsTrackingStartedAt))) {
    state.statisticsTrackingStartedAt = state.currentDate;
  }
  if (!Array.isArray(state.fighterRankingHistory)) state.fighterRankingHistory = [];
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
        ...getBeltBranding(wc),
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
  
  for (const belt of Object.values(state.belts) as any[]) {
    if (belt.promotionId === undefined) belt.promotionId = playerPromotionId;
  }
  for (const fight of Object.values(state.fightArchive || {}) as any[]) {
    if (fight.promotionId === undefined) fight.promotionId = playerPromotionId;
    if (fight.scope === undefined) fight.scope = fight.promotionId === null ? 'international' : 'promotion';
  }
  for (const event of Object.values(state.eventArchive || {}) as any[]) {
    if (event.promotionId === undefined) event.promotionId = playerPromotionId;
    if (event.scope === undefined) event.scope = event.promotionId === null ? 'international' : 'promotion';
  }
  for (const item of state.titleHistory as any[]) {
    if (item.promotionId === undefined) item.promotionId = playerPromotionId;
    if (item.scope === undefined) item.scope = item.promotionId === null ? 'international' : 'promotion';
  }
  for (const tournament of Object.values(state.tournaments || {}) as any[]) {
    if (tournament.promotionId === undefined) tournament.promotionId = playerPromotionId;
    if (tournament.scope === undefined) tournament.scope = tournament.promotionId === null ? 'international' : 'promotion';
  }
  state.rankingsByPromotion = { ...(state.rankingsByPromotion || {}), [playerPromotionId]: state.rankings };
  state.titlesByPromotion = { ...(state.titlesByPromotion || {}), [playerPromotionId]: state.titles };
  state.beltsByPromotion = { ...(state.beltsByPromotion || {}), [playerPromotionId]: state.belts };
  state.worldRankings ||= state.rankings;
  Object.assign(state, initializeInternationalCompetitionState(state));
  state.contractMarket = initializeContractMarketState(state, state.contractMarket);
  state = scheduleContractWindow(state as GameState, new Date(state.currentDate).getFullYear());

  if (!state.seasonPlans) {
    state.seasonPlans = {};
  }
  if (!state.careerEcosystem) {
    state.careerEcosystem = { rookieClassYears: [], emergencyProspectDates: {} };
  }
  const drama = state.drama && typeof state.drama === 'object' ? state.drama : {};
  state.drama = {
    promoterIdentity: ['meritocracy', 'spectacle', 'prospect_builder', 'conservative'].includes(drama.promoterIdentity) ? drama.promoterIdentity : 'meritocracy',
    incidents: drama.incidents && typeof drama.incidents === 'object' ? { ...drama.incidents } : {},
    triggerKeys: Array.isArray(drama.triggerKeys) ? [...new Set(drama.triggerKeys.filter((key: unknown) => typeof key === 'string'))] : [],
    cooldowns: drama.cooldowns && typeof drama.cooldowns === 'object' ? { ...drama.cooldowns } : {},
    objectives: drama.objectives && typeof drama.objectives === 'object' ? { ...drama.objectives } : {},
    seasonSnapshots: drama.seasonSnapshots && typeof drama.seasonSnapshots === 'object' ? { ...drama.seasonSnapshots } : {},
    seasonReviews: drama.seasonReviews && typeof drama.seasonReviews === 'object' ? { ...drama.seasonReviews } : {}
  };

  state = ensureRivalPromotions(syncLegacyNewsToSocialFeed(state as GameState));
  state = initializePromotionEconomies(state);
  state.saveVersion = CURRENT_SAVE_VERSION;
  return syncPlayerPromotionSnapshot(syncChampionFlags(state));
}
