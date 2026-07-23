import type { BeltInfo, Fighter, GameState, RankingItem, WeightClass, WeightClassTitleState } from '../../types/game';

export const RIVAL_PROMOTION_TEMPLATES = [
  { id: 'promotion-apex-combat', name: 'Apex Combat League', shortName: 'ACL', reputation: 55, fanbase: 85000 },
  { id: 'promotion-global-fight', name: 'Global Fight Alliance', shortName: 'GFA', reputation: 48, fanbase: 65000 }
] as const;

export function getPlayerPromotionId(state: Pick<GameState, 'playerPromotionId' | 'promotion'>): string {
  return state.playerPromotionId || state.promotion.id;
}

export function getFighterPromotionId(fighter: Fighter): string | null {
  return fighter.contract?.promotionId ?? null;
}

export function isFighterInPromotion(fighter: Fighter, promotionId: string): boolean {
  return fighter.careerPhase !== 'retired' && fighter.contract?.promotionId === promotionId;
}

export function getScopedRankings(
  state: Pick<GameState, 'playerPromotionId' | 'promotion' | 'rankings' | 'rankingsByPromotion'>,
  promotionId: string
): Record<WeightClass, RankingItem[]> {
  return promotionId === getPlayerPromotionId(state) ? state.rankings : state.rankingsByPromotion[promotionId];
}

export function getScopedTitles(
  state: Pick<GameState, 'playerPromotionId' | 'promotion' | 'titles' | 'titlesByPromotion'>,
  promotionId: string
): Record<WeightClass, WeightClassTitleState> {
  return promotionId === getPlayerPromotionId(state) ? state.titles : state.titlesByPromotion[promotionId];
}

export function getScopedBelts(
  state: Pick<GameState, 'playerPromotionId' | 'promotion' | 'belts' | 'beltsByPromotion'>,
  promotionId: string
): Record<string, BeltInfo> {
  return promotionId === getPlayerPromotionId(state) ? state.belts : state.beltsByPromotion[promotionId];
}

export function syncPlayerPromotionSnapshot(state: GameState): GameState {
  const promotionId = getPlayerPromotionId(state);
  return {
    ...state,
    promotions: { ...state.promotions, [promotionId]: state.promotion },
    rankingsByPromotion: { ...state.rankingsByPromotion, [promotionId]: state.rankings },
    titlesByPromotion: { ...state.titlesByPromotion, [promotionId]: state.titles },
    beltsByPromotion: { ...state.beltsByPromotion, [promotionId]: state.belts }
  };
}
