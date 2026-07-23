import { addDays, format } from 'date-fns';
import type { Event, FightMatchup, GameState, WeightClass } from '../../types/game';
import { applyFightResult, finalizeEventFinancials } from '../engine';
import { readLanguage, type Language } from '../localization';
import { seedRivalPromotions } from './generator';
import { simulateFight } from './fightSimulator';
import { RIVAL_PROMOTION_TEMPLATES } from './leagues';
import { planAiPromotionEvent } from './promotionEconomy';
import { updateRankings } from './rankings';
import { WEIGHT_CLASSES } from './constants';

export function ensureRivalPromotions(state: GameState): GameState {
  return RIVAL_PROMOTION_TEMPLATES.every(template => state.promotions[template.id]) ? state : seedRivalPromotions(state);
}

function eligibleFighters(state: GameState, promotionId: string, weightClass: WeightClass) {
  const rank = new Map((state.rankingsByPromotion[promotionId]?.[weightClass] || []).map(item => [item.fighterId, item.rank]));
  return Object.values(state.fighters)
    .filter(fighter => fighter.weightClass === weightClass && fighter.contract?.promotionId === promotionId && fighter.careerPhase !== 'retired' && !fighter.injuryStatus && !(fighter.medicalSuspension && fighter.medicalSuspension.daysRemaining > 0) && fighter.fatigue < 75)
    .sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999) || a.id.localeCompare(b.id));
}

export function simulateRivalPromotionEvent(state: GameState, promotionId: string, language: Language = readLanguage()): GameState {
  const promotion = state.promotions[promotionId];
  if (!promotion || promotion.control !== 'ai') return state;
  const fights: FightMatchup[] = [];
  for (const weightClass of WEIGHT_CLASSES) {
    const eligible = eligibleFighters(state, promotionId, weightClass);
    if (eligible.length < 2) continue;
    const championId = state.titlesByPromotion[promotionId]?.[weightClass]?.undisputedChampionId;
    const red = eligible.find(fighter => fighter.id === championId) ?? eligible[0];
    const blue = eligible.find(fighter => fighter.id !== red.id)!;
    fights.push({ id: `rival-fight-${promotionId}-${state.currentDate}-${weightClass}`, redCornerId: red.id, blueCornerId: blue.id, weightClass, isTitleFight: red.id === championId, titleFightType: red.id === championId ? 'undisputed' : undefined, rounds: red.id === championId ? 5 : 3, campFocus: 'balanced', socialHype: 0 });
    if (fights.length === 4) break;
  }

  const plan = fights.length ? planAiPromotionEvent(state, promotionId) : null;
  const nextAiEventDate = format(addDays(new Date(state.currentDate), plan ? 42 : 14), 'yyyy-MM-dd');
  if (!plan) return { ...state, promotions: { ...state.promotions, [promotionId]: { ...promotion, nextAiEventDate } } };

  const eventId = `rival-event-${promotionId}-${state.currentDate}`;
  const event: Event = { id: eventId, promotionId, scope: 'promotion', name: `${promotion.shortName} Fight Night`, date: state.currentDate, venueId: plan.venueId, ticketPrice: plan.ticketPrice, marketingSpend: plan.marketingSpend, fights, isCompleted: false };
  const playerNews = state.news;
  const playerSocialFeed = state.socialFeed;
  const playerStorylines = state.storylines;
  let nextState: GameState = { ...state, events: { ...state.events, [eventId]: event } };
  for (let index = 0; index < fights.length; index++) {
    const matchup = nextState.events[eventId].fights[index];
    nextState = applyFightResult(nextState, eventId, index, simulateFight(matchup, nextState.fighters[matchup.redCornerId], nextState.fighters[matchup.blueCornerId]), language);
  }
  nextState = updateRankings(finalizeEventFinancials(nextState, eventId, language), eventId, promotionId);
  return {
    ...nextState,
    news: playerNews,
    socialFeed: playerSocialFeed,
    storylines: playerStorylines,
    promotions: { ...nextState.promotions, [promotionId]: { ...nextState.promotions[promotionId], nextAiEventDate } }
  };
}

export function advanceRivalPromotions(state: GameState, language: Language = readLanguage()): GameState {
  let nextState = ensureRivalPromotions(state);
  for (const promotion of Object.values(nextState.promotions).filter(item => item.control === 'ai')) {
    if (promotion.nextAiEventDate && promotion.nextAiEventDate <= nextState.currentDate) nextState = simulateRivalPromotionEvent(nextState, promotion.id, language);
  }
  return nextState;
}
