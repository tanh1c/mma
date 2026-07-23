import { differenceInCalendarDays } from 'date-fns';
import type { Fighter, GameState, RankingItem, WeightClass } from '../../types/game';
import { getPlayerPromotionId, getScopedRankings, getScopedTitles, isFighterInPromotion, syncPlayerPromotionSnapshot } from './leagues';

const ELO_K_FACTOR = 32;
const INACTIVITY_PENALTY_START = 274;
const INACTIVITY_RANKING_LIMIT = 548;
const MAX_INACTIVITY_PENALTY = 200;
const WEIGHT_CLASSES: WeightClass[] = ['Bantamweight', 'Featherweight', 'Lightweight', 'Welterweight', 'Middleweight', 'Heavyweight'];

export type RankLabel = 'C' | 'IC' | 'UR' | `#${number}`;
export type RankingActivityStatus = 'active' | 'inactive' | 'unranked-inactive';

type RankingState = Pick<GameState, 'fighters' | 'playerPromotionId' | 'promotion' | 'rankings' | 'rankingsByPromotion' | 'titles' | 'titlesByPromotion'>;

export function getFighterRankContext(state: RankingState, fighterId: string, promotionId?: string): { label: RankLabel; description: string; sortValue: number } | null {
  const fighter = state.fighters[fighterId];
  if (!fighter) return null;
  const selectedPromotionId = promotionId ?? getPlayerPromotionId(state);
  const title = getScopedTitles(state, selectedPromotionId)[fighter.weightClass];
  if (title?.undisputedChampionId === fighterId) return { label: 'C', description: 'Undisputed Champion', sortValue: 0 };
  if (title?.interimChampionId === fighterId) return { label: 'IC', description: 'Interim Champion', sortValue: 1 };
  const champions = new Set([title?.undisputedChampionId, title?.interimChampionId].filter(Boolean));
  const contenderIndex = (getScopedRankings(state, selectedPromotionId)[fighter.weightClass] || []).filter(item => !champions.has(item.fighterId)).findIndex(item => item.fighterId === fighterId);
  if (isFighterInPromotion(fighter, selectedPromotionId) && contenderIndex >= 0 && contenderIndex < 15) {
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
  promotionId?: string,
  affectedWeightClasses?: WeightClass[]
): {
  newRankings: Record<WeightClass, RankingItem[]>;
  rankingChanges: Record<string, { oldRank: number; newRank: number }>;
} {
  const selectedPromotionId = promotionId ?? getPlayerPromotionId(state);
  const currentRankings = getScopedRankings(state, selectedPromotionId);
  const currentTitles = getScopedTitles(state, selectedPromotionId);
  const newRankings: Record<string, RankingItem[]> = {};
  const rankingChanges: Record<string, { oldRank: number; newRank: number }> = {};
  const recentFightRecords = buildRecentFightRecords(state);
  const effectiveScores = new Map(Object.values(state.fighters).map(fighter => [
    fighter.id,
    effectiveRankingScore(state, fighter, recentFightRecords.get(fighter.id) ?? { wins: 0, losses: 0 })
  ]));

  WEIGHT_CLASSES.forEach(wc => {
    if (affectedWeightClasses && !affectedWeightClasses.includes(wc)) {
      newRankings[wc] = currentRankings[wc] ? [...currentRankings[wc]] : [];
      return;
    }

    const oldRankingMap = new Map<string, number>();
    if (currentRankings[wc]) {
      currentRankings[wc].forEach(r => oldRankingMap.set(r.fighterId, r.rank));
    }

    const titleState = currentTitles[wc];
    const fightersInWc = Object.values(state.fighters)
      .filter(f => {
        if (f.weightClass !== wc || !isFighterInPromotion(f, selectedPromotionId)) return false;
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
    fightersInWc.slice(0, 16).forEach((fighter, index) => {
      const oldRank = oldRankingMap.get(fighter.id);
      const trend = oldRank === undefined ? 999 : oldRank - index;
      if (oldRank === undefined || trend !== 0) rankingChanges[fighter.id] = { oldRank: oldRank ?? 999, newRank: index };
      newRank.push({ fighterId: fighter.id, rank: index, trend });
    });

    for (const ranking of currentRankings[wc] || []) {
      if (!newRank.some(item => item.fighterId === ranking.fighterId)) rankingChanges[ranking.fighterId] = { oldRank: ranking.rank, newRank: 999 };
    }
    newRankings[wc] = newRank;
  });

  return { newRankings: newRankings as Record<WeightClass, RankingItem[]>, rankingChanges };
}

export function buildWorldRankings(state: GameState): Record<WeightClass, RankingItem[]> {
  return Object.fromEntries(WEIGHT_CLASSES.map(weightClass => [
    weightClass,
    Object.values(state.fighters)
      .filter(fighter => fighter.weightClass === weightClass && fighter.contract && fighter.careerPhase !== 'retired' && getRankingActivityStatus(fighter, state.currentDate) !== 'unranked-inactive')
      .sort((a, b) => getEffectiveRankingScore(state, b) - getEffectiveRankingScore(state, a) || a.id.localeCompare(b.id))
      .slice(0, 50)
      .map((fighter, rank) => ({ fighterId: fighter.id, rank, trend: 0 }))
  ])) as Record<WeightClass, RankingItem[]>;
}

export function updateRankings(state: GameState, eventId?: string, promotionId?: string): GameState {
  let newState = initializeRankingScores(state);
  const selectedPromotionId = promotionId ?? (eventId ? newState.events[eventId]?.promotionId ?? undefined : undefined) ?? getPlayerPromotionId(newState);
  const fighters = { ...newState.fighters };
  Object.values(fighters).forEach(fighter => {
    if (fighter.contract) return;
    const rankedFighter = { ...fighter, contract: { promotionId: selectedPromotionId } as Fighter['contract'] };
    const previous = getFighterRankContext({ ...newState, fighters: { ...fighters, [fighter.id]: rankedFighter } }, fighter.id, selectedPromotionId);
    if (previous && previous.label !== 'UR') fighters[fighter.id] = { ...fighter, lastPromotionRank: previous.label };
  });
  newState = { ...newState, fighters };

  let affectedWeightClasses: WeightClass[] | undefined;
  if (eventId && newState.events[eventId]) {
    const event = newState.events[eventId];
    if (event.isCompleted && event.results) {
      affectedWeightClasses = [];
      event.fights.forEach(fight => {
        if (!fight.result) return;
        if (!affectedWeightClasses!.includes(fight.weightClass)) affectedWeightClasses!.push(fight.weightClass);
        const red = newState.fighters[fight.redCornerId];
        const blue = newState.fighters[fight.blueCornerId];
        if (!red || !blue) return;

        const redElo = red.rankingScore || 1000;
        const blueElo = blue.rankingScore || 1000;
        const expectedRed = 1 / (1 + Math.pow(10, (blueElo - redElo) / 400));
        const expectedBlue = 1 / (1 + Math.pow(10, (redElo - blueElo) / 400));
        const redActual = fight.result.winnerId === red.id ? 1 : fight.result.winnerId === blue.id ? 0 : 0.5;
        const blueActual = 1 - redActual;
        const multiplier = getMethodMultiplier(fight.result.method);
        newState.fighters[red.id] = { ...red, rankingScore: redElo + Math.round(ELO_K_FACTOR * multiplier * (redActual - expectedRed)) };
        newState.fighters[blue.id] = { ...blue, rankingScore: blueElo + Math.round(ELO_K_FACTOR * multiplier * (blueActual - expectedBlue)) };
      });
    }
  }

  const { newRankings, rankingChanges } = buildPromotionRankings(newState, selectedPromotionId, affectedWeightClasses);
  if (selectedPromotionId === getPlayerPromotionId(newState)) {
    newState.rankings = newRankings;
  } else {
    newState.rankingsByPromotion = { ...newState.rankingsByPromotion, [selectedPromotionId]: newRankings };
  }
  newState.worldRankings = buildWorldRankings(newState);

  if (eventId && newState.events[eventId]?.results) {
    newState.events[eventId] = {
      ...newState.events[eventId],
      results: { ...newState.events[eventId].results!, rankingChanges }
    };
  }

  return syncPlayerPromotionSnapshot(newState);
}
