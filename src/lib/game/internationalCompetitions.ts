import type {
  BeltInfo,
  GameState,
  InternationalCompetitionTier,
  InternationalTitles,
  WeightClass,
  WeightClassTitleState
} from '../../types/game';
import { getBeltBranding } from '../branding';
import type { Language } from '../localization';
import { WEIGHT_CLASSES } from './constants';
import { createGrandPrixTournament, isFighterBookedUpcoming } from './tournament';

const TIERS: InternationalCompetitionTier[] = ['champions_cup', 'challenge_cup'];

type InternationalCompetitionState = Pick<GameState, 'internationalTitles' | 'internationalBelts' | 'internationalCompetitionYears'>;

export interface InternationalTournamentOptions {
  weightClass: WeightClass;
  tier: InternationalCompetitionTier;
  name: string;
  participantIds: string[];
  reserveIds: string[];
}

export function internationalBeltId(tier: InternationalCompetitionTier, weightClass: WeightClass): string {
  return `belt_international_${tier}_${weightClass.toLowerCase()}`;
}

export function initializeInternationalCompetitionState(existing?: Partial<InternationalCompetitionState>): InternationalCompetitionState {
  const internationalTitles = {} as InternationalTitles;
  const internationalBelts = {} as GameState['internationalBelts'];

  for (const tier of TIERS) {
    internationalTitles[tier] = {} as Record<WeightClass, WeightClassTitleState>;
    internationalBelts[tier] = { ...(existing?.internationalBelts?.[tier] || {}) };
    for (const weightClass of WEIGHT_CLASSES) {
      internationalTitles[tier][weightClass] = existing?.internationalTitles?.[tier]?.[weightClass] || {
        weightClass,
        undisputedChampionId: null,
        undisputedDefenses: 0,
        status: 'vacant'
      };
      const id = internationalBeltId(tier, weightClass);
      if (!internationalBelts[tier][id]) {
        const branding = getBeltBranding(weightClass);
        const tierName = tier === 'champions_cup' ? 'World Champions Cup' : 'World Challenge Cup';
        internationalBelts[tier][id] = {
          id,
          promotionId: null,
          name: `${weightClass} ${tierName}`,
          shortName: `${branding.shortName} ${tier === 'champions_cup' ? 'WCC' : 'WChC'}`,
          weightClass,
          type: 'international',
          prestige: tier === 'champions_cup' ? 95 : 80
        } satisfies BeltInfo;
      }
    }
  }

  return {
    internationalTitles,
    internationalBelts,
    internationalCompetitionYears: [...new Set(existing?.internationalCompetitionYears || [])].sort((a, b) => a - b)
  };
}

function isEligible(state: GameState, fighterId: string, weightClass: WeightClass): boolean {
  const fighter = state.fighters[fighterId];
  return Boolean(
    fighter &&
    fighter.weightClass === weightClass &&
    fighter.contract?.promotionId &&
    state.promotions[fighter.contract.promotionId] &&
    fighter.careerPhase !== 'retired' &&
    !fighter.injuryStatus &&
    (!fighter.medicalSuspension || fighter.medicalSuspension.daysRemaining <= 0) &&
    !isFighterBookedUpcoming(state, fighter.id)
  );
}

function promotionCandidates(state: GameState, promotionId: string, weightClass: WeightClass): string[] {
  const title = state.titlesByPromotion[promotionId]?.[weightClass];
  const ranked = state.rankingsByPromotion[promotionId]?.[weightClass]?.map(item => item.fighterId) || [];
  const remaining = Object.values(state.fighters)
    .filter(fighter => fighter.contract?.promotionId === promotionId && fighter.weightClass === weightClass)
    .sort((a, b) => (b.rankingScore || 0) - (a.rankingScore || 0) || a.id.localeCompare(b.id))
    .map(fighter => fighter.id);
  return [...new Set([title?.undisputedChampionId, ...ranked, ...remaining].filter((id): id is string => Boolean(id)))]
    .filter(id => isEligible(state, id, weightClass));
}

function takeRoundRobin(candidateLists: string[][], excluded: Set<string>, limit: number): string[] {
  const selected: string[] = [];
  for (let index = 0; selected.length < limit && candidateLists.some(list => index < list.length); index++) {
    for (const list of candidateLists) {
      const candidate = list[index];
      if (candidate && !excluded.has(candidate)) {
        selected.push(candidate);
        excluded.add(candidate);
        if (selected.length === limit) break;
      }
    }
  }
  return selected;
}

export function getInternationalQualifiers(
  state: GameState,
  weightClass: WeightClass,
  tier: InternationalCompetitionTier
): { participantIds: string[]; reserveIds: string[]; qualifyingPromotionIds: string[] } {
  const promotionIds = Object.keys(state.promotions).sort();
  const candidates = promotionIds.map(promotionId => promotionCandidates(state, promotionId, weightClass));
  const championsCupIds = tier === 'challenge_cup'
    ? new Set(getInternationalQualifiers(state, weightClass, 'champions_cup').participantIds)
    : new Set<string>();
  const tierCandidates = tier === 'challenge_cup' ? candidates.map(list => list.slice(2)) : candidates;
  const participantIds = takeRoundRobin(tierCandidates, championsCupIds, 8);
  const selected = new Set([...championsCupIds, ...participantIds]);
  const worldEligible = (state.worldRankings[weightClass] || [])
    .map(item => item.fighterId)
    .filter(id => isEligible(state, id, weightClass));

  for (const id of worldEligible) {
    if (participantIds.length === 8) break;
    if (!selected.has(id)) {
      participantIds.push(id);
      selected.add(id);
    }
  }

  const qualifyingPromotionIds = [...new Set(participantIds.map(id => state.fighters[id].contract!.promotionId!))];
  if (qualifyingPromotionIds.length < 2) {
    throw new Error('International competition requires fighters from at least two promotions.');
  }

  const reserveIds = worldEligible.filter(id => !selected.has(id)).slice(0, 3);
  return { participantIds, reserveIds, qualifyingPromotionIds };
}

export function createInternationalGrandPrixTournament(
  state: GameState,
  options: InternationalTournamentOptions,
  language: Language = 'en'
): GameState {
  const qualifyingPromotionIds = [...new Set(options.participantIds.map(id => state.fighters[id]?.contract?.promotionId).filter((id): id is string => Boolean(id)))];
  return createGrandPrixTournament(state, {
    weightClass: options.weightClass,
    name: options.name,
    titleShotPromised: false,
    format: 'eight_man',
    participantIds: options.participantIds,
    reserveIds: options.reserveIds,
    scope: 'international',
    promotionId: null,
    internationalTier: options.tier,
    winnerBeltId: internationalBeltId(options.tier, options.weightClass),
    qualifyingPromotionIds
  }, language);
}

export function ensureAnnualInternationalCompetitions(
  state: GameState,
  year: number,
  language: Language = 'en'
): GameState {
  if (state.internationalCompetitionYears.includes(year)) return state;
  let nextState = state;

  for (const weightClass of WEIGHT_CLASSES) {
    for (const tier of TIERS) {
      try {
        const qualifiers = getInternationalQualifiers(nextState, weightClass, tier);
        if (qualifiers.participantIds.length !== 8) continue;
        const tierName = tier === 'champions_cup' ? 'World Champions Cup' : 'World Challenge Cup';
        nextState = createInternationalGrandPrixTournament(nextState, {
          weightClass,
          tier,
          name: `${year} ${weightClass} ${tierName}`,
          participantIds: qualifiers.participantIds,
          reserveIds: qualifiers.reserveIds
        }, language);
      } catch {
        // A division can qualify in a later season after its domestic rosters deepen.
      }
    }
  }

  return {
    ...nextState,
    internationalCompetitionYears: [...nextState.internationalCompetitionYears, year]
  };
}
