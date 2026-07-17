import { differenceInCalendarDays } from 'date-fns';
import '../../i18n';
import type { FightCampFocus, Fighter, FightMatchup, GameState } from '../../types/game';
import { fixedT, readLanguage, type Language } from '../localization';
import { getContractEndDate } from './contracts';
import { scoreObserverRosterCandidate } from './careerEcosystem';
import { getFighterOverall } from './fighterRatings';
import { getPairKey } from './news';
import { applyPromotionSocialAction } from './social';

export function chooseObserverCampFocus(fight: FightMatchup, red: Fighter, blue: Fighter, eventDate: string, currentDate: string): FightCampFocus {
  if (red.fatigue >= 35 || blue.fatigue >= 35 || differenceInCalendarDays(new Date(eventDate), new Date(currentDate)) < 14) return 'recovery';
  if (fight.isTitleFight || fight.rounds === 5) return 'cardio';
  const striking = (red.attributes.striking + red.attributes.power + blue.attributes.striking + blue.attributes.power) / 4;
  const wrestling = (red.attributes.wrestling + red.attributes.grappling + red.attributes.submissions + blue.attributes.wrestling + blue.attributes.grappling + blue.attributes.submissions) / 6;
  if (wrestling >= striking + 5) return 'wrestling';
  if (striking >= wrestling + 5) return 'striking';
  return 'balanced';
}

function resolveCounterOffers(state: GameState, language: Language): GameState {
  const t = fixedT(language);
  const fighters = { ...state.fighters };
  const news = [...state.news];
  const divisionDepth = Object.values(fighters).reduce<Record<string, number>>((counts, fighter) => {
    if (fighter.contract) counts[fighter.weightClass] = (counts[fighter.weightClass] ?? 0) + 1;
    return counts;
  }, {});

  Object.values(fighters).forEach(fighter => {
    const offer = fighter.counterOffer;
    if (!offer || offer.expiresDate < state.currentDate) return;
    const important = fighter.isChampion || scoreObserverRosterCandidate(state, fighter) >= 45 || (divisionDepth[fighter.weightClass] ?? 0) < 6;
    const valid = fighter.careerPhase !== 'retired' && offer.fights > 0 && offer.payPerFight >= 0 && offer.winBonus >= 0;
    const accepted = important && valid && state.promotion.money - offer.payPerFight - offer.winBonus >= 50000;
    fighters[fighter.id] = accepted ? {
      ...fighter,
      contract: { fightsRemaining: offer.fights, payPerFight: offer.payPerFight, winBonus: offer.winBonus, exclusivity: true, endDate: getContractEndDate(state.currentDate, offer.fights), lastNegotiationDate: state.currentDate },
      counterOffer: undefined
    } : { ...fighter, counterOffer: undefined };
    const newsId = `observer-counter-${fighter.id}-${state.currentDate}`;
    if (accepted && !news.some(item => item.id === newsId)) news.unshift({ id: newsId, date: state.currentDate, type: 'contract', title: t($ => $.generated.observer.counterAcceptedTitle, { name: fighter.lastName }), content: t($ => $.generated.observer.counterAccepted, { name: `${fighter.firstName} ${fighter.lastName}`, count: offer.fights }) });
  });

  return { ...state, fighters, news };
}

export function runObserverDecisions(state: GameState, language: Language = readLanguage()): GameState {
  if (state.mode !== 'observer' || !state.autopilot.enabled) return state;
  let nextState = resolveCounterOffers(state, language);
  const events = Object.fromEntries(Object.entries(nextState.events).map(([id, event]) => [id, event.isCompleted || event.date < nextState.currentDate ? event : {
    ...event,
    fights: event.fights.map(fight => {
      const red = nextState.fighters[fight.redCornerId];
      const blue = nextState.fighters[fight.blueCornerId];
      return red && blue ? { ...fight, campFocus: chooseObserverCampFocus(fight, red, blue, event.date, nextState.currentDate) } : fight;
    })
  }]));
  nextState = { ...nextState, events };

  for (const event of Object.values(nextState.events).filter(event => !event.isCompleted && event.date >= nextState.currentDate)) {
    const daysUntil = differenceInCalendarDays(new Date(event.date), new Date(nextState.currentDate));
    for (const fight of event.fights) {
      nextState = applyPromotionSocialAction(nextState, fight.id, 'announce', language);
      const red = nextState.fighters[fight.redCornerId];
      const blue = nextState.fighters[fight.blueCornerId];
      if (!red || !blue || daysUntil < 1 || daysUntil > 14) continue;
      const rivalry = nextState.storylines.some(storyline => storyline.isActive && storyline.type === 'Rivalry' && getPairKey(storyline.fighterIds) === getPairKey([red.id, blue.id]));
      const promote = fight.isTitleFight || Boolean(fight.tournamentId) || rivalry || Math.abs(getFighterOverall(red) - getFighterOverall(blue)) < 10 || red.popularity + blue.popularity >= 120;
      if (promote) nextState = applyPromotionSocialAction(nextState, fight.id, 'hype', language);
    }
  }
  return nextState;
}
