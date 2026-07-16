import { GameState, WeightClass, RankingItem, FightResult, Fighter } from '../../types/game';

const ELO_K_FACTOR = 32;

export type RankLabel = 'C' | 'IC' | 'UR' | `#${number}`;

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
      .filter(f => f.weightClass === wc && f.contract !== null)
      .sort((a, b) => {
        const aIsChamp = titleState.undisputedChampionId === a.id || titleState.interimChampionId === a.id;
        const bIsChamp = titleState.undisputedChampionId === b.id || titleState.interimChampionId === b.id;
        if (aIsChamp && !bIsChamp) return -1;
        if (!aIsChamp && bIsChamp) return 1;
        
        const scoreA = a.rankingScore || 1000;
        const scoreB = b.rankingScore || 1000;
        return scoreB - scoreA;
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
