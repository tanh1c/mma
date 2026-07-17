import { differenceInCalendarDays } from 'date-fns';
import type { Fighter, GameState, RankingItem, WeightClass } from '../../types/game';

const ELO_K_FACTOR = 32;
const INACTIVITY_PENALTY_START = 274;
const INACTIVITY_RANKING_LIMIT = 548;
const MAX_INACTIVITY_PENALTY = 200;

export type RankLabel = 'C' | 'IC' | 'UR' | `#${number}`;
export type RankingActivityStatus = 'active' | 'inactive' | 'unranked-inactive';

type RankingState = Pick<GameState, 'fighters' | 'rankings' | 'titles'>;

export function getFighterRankContext(state: RankingState, fighterId: string): { label: RankLabel; description: string; sortValue: number } | null {
  const fighter = state.fighters[fighterId];
  if (!fighter) return null;
  const title = state.titles[fighter.weightClass];
  if (title?.undisputedChampionId === fighterId) return { label: 'C', description: 'Undisputed Champion', sortValue: 0 };
  if (title?.interimChampionId === fighterId) return { label: 'IC', description: 'Interim Champion', sortValue: 1 };
  const champions = new Set([title?.undisputedChampionId, title?.interimChampionId].filter(Boolean));
  const contenderIndex = (state.rankings[fighter.weightClass] || []).filter(item => !champions.has(item.fighterId)).findIndex(item => item.fighterId === fighterId);
  if (fighter.contract && contenderIndex >= 0 && contenderIndex < 15) {
    const label = `#${contenderIndex + 1}` as RankLabel;
    return { label, description: `${fighter.weightClass} contender ${label}`, sortValue: contenderIndex + 2 };
  }
  return { label: 'UR', description: `Unranked ${fighter.weightClass} fighter`, sortValue: 999 };
}

export function getFighterRankSortValue(state: RankingState, fighterId: string): number {
  return getFighterRankContext(state, fighterId)?.sortValue ?? 1000;
}

export function getFighterInactivityDays(fighter: Fighter, currentDate: string): number {
  return fighter.lastFightDate ? Math.max(0, differenceInCalendarDays(new Date(currentDate), new Date(fighter.lastFightDate))) : 0;
}

export function getRankingActivityStatus(fighter: Fighter, currentDate: string): RankingActivityStatus {
  const days = getFighterInactivityDays(fighter, currentDate);
  return days > INACTIVITY_RANKING_LIMIT ? 'unranked-inactive' : days > INACTIVITY_PENALTY_START ? 'inactive' : 'active';
}

type RecentFightRecord = { wins: number; losses: number };

function buildRecentFightRecords(state: GameState): Map<string, RecentFightRecord> {
  const records = new Map<string, RecentFightRecord>();
  const currentDate = new Date(state.currentDate);
  for (const fight of Object.values(state.fightArchive)) {
    if (differenceInCalendarDays(currentDate, new Date(fight.date)) > 365) continue;
    for (const fighterId of [fight.redFighterId, fight.blueFighterId]) {
      const record = records.get(fighterId) ?? { wins: 0, losses: 0 };
      if (fight.winnerId === fighterId) record.wins++;
      else if (fight.winnerId) record.losses++;
      records.set(fighterId, record);
    }
  }
  return records;
}

function effectiveRankingScore(state: GameState, fighter: Fighter, recent: RecentFightRecord): number {
  const elo = fighter.rankingScore ?? 1000;
  const days = getFighterInactivityDays(fighter, state.currentDate);
  const inactivityPenalty = days <= INACTIVITY_PENALTY_START
    ? 0
    : Math.min(MAX_INACTIVITY_PENALTY, (days - INACTIVITY_PENALTY_START) / (INACTIVITY_RANKING_LIMIT - INACTIVITY_PENALTY_START) * MAX_INACTIVITY_PENALTY);
  return elo + recent.wins * 12 - recent.losses * 8 - inactivityPenalty;
}

export function getEffectiveRankingScore(state: GameState, fighter: Fighter): number {
  return effectiveRankingScore(state, fighter, buildRecentFightRecords(state).get(fighter.id) ?? { wins: 0, losses: 0 });
}

function getMethodMultiplier(method: string): number {
  if (method === 'KO/TKO' || method === 'Submission' || method === 'Corner Stoppage' || method === 'Doctor Stoppage') {
    return 1.2;
  }
  if (method === 'Unanimous Decision') {
    return 1.0;
  }
  if (method === 'Majority Decision') {
    return 0.8;
  }
  if (method === 'Split Decision') {
    return 0.6;
  }
  return 0.5;
}

export function formatRankDisplay(rank: number, isChampion: boolean): string {
  if (rank === 999) return 'UR';
  if (isChampion) return 'C';
  if (rank === 0) return '#1';
  return `#${rank}`;
}

export function initializeRankingScores(state: GameState): GameState {
  const newState = { ...state, fighters: { ...state.fighters } };
  Object.values(newState.fighters).forEach(f => {
    if (f.rankingScore === undefined) {
      let score = 1000 + (f.record.wins * 10) - (f.record.losses * 10) + (f.popularity * 2);
      if (f.isChampion) score += 200;
      newState.fighters[f.id] = { ...f, rankingScore: score };
    }
  });
  return newState;
}

export function buildPromotionRankings(
  state: GameState,
  affectedWeightClasses?: WeightClass[]
): {
  newRankings: Record<WeightClass, RankingItem[]>;
  rankingChanges: Record<string, { oldRank: number; newRank: number }>;
} {
  const newRankings: Record<string, RankingItem[]> = {};
  const rankingChanges: Record<string, { oldRank: number; newRank: number }> = {};
  const recentFightRecords = buildRecentFightRecords(state);
  const effectiveScores = new Map(Object.values(state.fighters).map(fighter => [
    fighter.id,
    effectiveRankingScore(state, fighter, recentFightRecords.get(fighter.id) ?? { wins: 0, losses: 0 })
  ]));

  const weightClasses: WeightClass[] = [
    'Bantamweight', 'Featherweight', 'Lightweight', 
    'Welterweight', 'Middleweight', 'Heavyweight'
  ];

  weightClasses.forEach(wc => {
    // If we passed affected classes and this isn't one, just copy existing
    if (affectedWeightClasses && !affectedWeightClasses.includes(wc)) {
       newRankings[wc] = state.rankings[wc] ? [...state.rankings[wc]] : [];
       return;
    }

    const oldRankingMap = new Map<string, number>();
    if (state.rankings && state.rankings[wc]) {
      state.rankings[wc].forEach(r => {
        oldRankingMap.set(r.fighterId, r.rank);
      });
    }

    const titleState = state.titles[wc];

    const fightersInWc = Object.values(state.fighters)
      .filter(f => {
        if (f.weightClass !== wc || !f.contract || f.careerPhase === 'retired') return false;
        const isChampion = titleState.undisputedChampionId === f.id || titleState.interimChampionId === f.id;
        return isChampion || getRankingActivityStatus(f, state.currentDate) !== 'unranked-inactive';
      })
      .sort((a, b) => {
        const aIsChamp = titleState.undisputedChampionId === a.id || titleState.interimChampionId === a.id;
        const bIsChamp = titleState.undisputedChampionId === b.id || titleState.interimChampionId === b.id;
        if (aIsChamp && !bIsChamp) return -1;
        if (!aIsChamp && bIsChamp) return 1;
        return effectiveScores.get(b.id)! - effectiveScores.get(a.id)! || a.id.localeCompare(b.id);
      });

    const newRank: RankingItem[] = [];
    fightersInWc.slice(0, 16).forEach((f, index) => {
      const oldRank = oldRankingMap.get(f.id);
      let trend = 0;
      if (oldRank !== undefined) {
        trend = oldRank - index;
        if (trend !== 0) {
          rankingChanges[f.id] = { oldRank, newRank: index };
        }
      } else {
        trend = 999;
        rankingChanges[f.id] = { oldRank: 999, newRank: index };
      }

      newRank.push({ fighterId: f.id, rank: index, trend });
    });

    // Capture fighters who dropped out of rankings
    if (state.rankings && state.rankings[wc]) {
      state.rankings[wc].forEach(r => {
        if (!newRank.find(nr => nr.fighterId === r.fighterId)) {
          // They fell out of the top 16 or were released
          rankingChanges[r.fighterId] = { oldRank: r.rank, newRank: 999 };
        }
      });
    }

    newRankings[wc] = newRank;
  });

  return { 
    newRankings: newRankings as Record<WeightClass, RankingItem[]>, 
    rankingChanges 
  };
}

export function updateRankings(state: GameState, eventId?: string): GameState {
  let newState = initializeRankingScores(state);
  const fighters = { ...newState.fighters };
  Object.values(fighters).forEach(fighter => {
    if (fighter.contract) return;
    const previous = getFighterRankContext({ ...newState, fighters: { ...fighters, [fighter.id]: { ...fighter, contract: {} as Fighter['contract'] } } }, fighter.id);
    if (previous && previous.label !== 'UR') fighters[fighter.id] = { ...fighter, lastPromotionRank: previous.label };
  });
  newState = { ...newState, fighters };
  
  let affectedWeightClasses: WeightClass[] | undefined = undefined;

  if (eventId && newState.events[eventId]) {
    const event = newState.events[eventId];
    if (event.isCompleted && event.results) {
      affectedWeightClasses = [];
      
      event.fights.forEach(fight => {
        if (!fight.result) return;
        
        if (!affectedWeightClasses!.includes(fight.weightClass)) {
           affectedWeightClasses!.push(fight.weightClass);
        }
        
        const red = newState.fighters[fight.redCornerId];
        const blue = newState.fighters[fight.blueCornerId];
        
        if (!red || !blue) return;

        const redElo = red.rankingScore || 1000;
        const blueElo = blue.rankingScore || 1000;

        const expectedRed = 1 / (1 + Math.pow(10, (blueElo - redElo) / 400));
        const expectedBlue = 1 / (1 + Math.pow(10, (redElo - blueElo) / 400));

        let redActual = 0.5;
        let blueActual = 0.5;

        if (fight.result.winnerId === red.id) {
          redActual = 1;
          blueActual = 0;
        } else if (fight.result.winnerId === blue.id) {
          redActual = 0;
          blueActual = 1;
        }

        const multiplier = getMethodMultiplier(fight.result.method);
        
        const redDelta = Math.round(ELO_K_FACTOR * multiplier * (redActual - expectedRed));
        const blueDelta = Math.round(ELO_K_FACTOR * multiplier * (blueActual - expectedBlue));

        newState.fighters[red.id] = { ...red, rankingScore: redElo + redDelta };
        newState.fighters[blue.id] = { ...blue, rankingScore: blueElo + blueDelta };
      });
    }
  }

  const { newRankings, rankingChanges } = buildPromotionRankings(newState, affectedWeightClasses);

  newState.rankings = newRankings;
  
  if (eventId && newState.events[eventId] && newState.events[eventId].results) {
    newState.events[eventId] = {
      ...newState.events[eventId],
      results: {
        ...newState.events[eventId].results!,
        rankingChanges
      }
    };
  }
  
  return newState;
}
