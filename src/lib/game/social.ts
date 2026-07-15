import { differenceInCalendarDays } from 'date-fns';
import type { FightMatchup, GameState, NewsItem, SocialFeedItem, SocialFeedKind, Storyline } from '../../types/game';
import { getFighterOverall } from './fighterRatings';
import { getPairKey } from './news';

const FEED_LIMIT = 200;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const fighterName = (state: GameState, id: string) => state.fighters[id] ? `${state.fighters[id].firstName} ${state.fighters[id].lastName}` : 'Unknown fighter';
const hash = (value: string) => [...value].reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 7);

function engagement(stableKey: string, scale = 1) {
  const value = hash(stableKey);
  return { likes: Math.round((20 + value % 480) * scale), comments: Math.round((5 + value % 95) * scale), shares: Math.round((2 + value % 48) * scale) };
}

function item(data: Omit<SocialFeedItem, 'id' | 'engagement'> & { engagementScale?: number }): SocialFeedItem {
  const { engagementScale = 1, ...rest } = data;
  return { ...rest, id: rest.stableKey, engagement: engagement(rest.stableKey, engagementScale) };
}

export function migrateNewsItem(news: NewsItem): SocialFeedItem {
  const authorType = news.type === 'event' || news.type === 'contract' ? 'promotion' : 'media';
  return item({ stableKey: `legacy-news:${news.id}`, date: news.date, kind: 'news', headline: news.title, body: news.content, authorType, authorName: authorType === 'promotion' ? 'Cage Dynasty' : 'Combat Wire', fighterIds: [] });
}

export function addSocialFeedItems(state: GameState, items: SocialFeedItem[]): GameState {
  const byKey = new Map<string, SocialFeedItem>();
  [...items, ...(state.socialFeed ?? [])].forEach(entry => { if (!byKey.has(entry.stableKey)) byKey.set(entry.stableKey, entry); });
  const socialFeed = [...byKey.values()].sort((a, b) => b.date.localeCompare(a.date) || b.stableKey.localeCompare(a.stableKey)).slice(0, FEED_LIMIT);
  return { ...state, socialFeed };
}

export function syncLegacyNewsToSocialFeed(state: GameState): GameState {
  return addSocialFeedItems(state, (state.news ?? []).map(migrateNewsItem));
}

export function getFighterSocialFeed(state: Pick<GameState, 'socialFeed'>, fighterId: string): SocialFeedItem[] {
  return (state.socialFeed ?? []).filter(entry => entry.fighterIds.includes(fighterId) || entry.authorFighterId === fighterId);
}

export function getFighterStorylines(state: Pick<GameState, 'storylines'>, fighterId: string): Storyline[] {
  return state.storylines.filter(storyline => storyline.fighterIds.includes(fighterId)).sort((a, b) => Number(b.isActive) - Number(a.isActive) || (b.resolvedDate ?? b.createdDate ?? '').localeCompare(a.resolvedDate ?? a.createdDate ?? ''));
}

function findRivalry(state: GameState, fight: FightMatchup) {
  const pairKey = getPairKey([fight.redCornerId, fight.blueCornerId]);
  return state.storylines.find(storyline => storyline.isActive && storyline.type === 'Rivalry' && getPairKey(storyline.fighterIds) === pairKey);
}

function fightContext(state: GameState, fight: FightMatchup) {
  const red = state.fighters[fight.redCornerId];
  const blue = state.fighters[fight.blueCornerId];
  const gap = red && blue ? Math.abs(getFighterOverall(red) - getFighterOverall(blue)) : 0;
  const rivalry = findRivalry(state, fight);
  const scale = clamp(((red?.popularity ?? 20) + (blue?.popularity ?? 20)) / 100 + (rivalry?.intensity ?? 0) * 0.25 - (gap >= 15 ? 0.25 : 0), 0.35, 2.5);
  return { red, blue, gap, rivalry, scale };
}

export function generateScheduledFightSocial(state: GameState, currentDate: string): GameState {
  const entries: SocialFeedItem[] = [];
  for (const event of Object.values(state.events)) {
    if (event.isCompleted || event.date < currentDate) continue;
    const daysUntil = differenceInCalendarDays(new Date(event.date), new Date(currentDate));
    for (const fight of event.fights) {
      const { red, blue, gap, rivalry, scale } = fightContext(state, fight);
      if (!red || !blue) continue;
      const fighterIds = [red.id, blue.id];
      const matchup = `${fighterName(state, red.id)} vs ${fighterName(state, blue.id)}`;
      entries.push(item({ stableKey: `fight:${fight.id}:booked`, date: currentDate, kind: 'promotion_post', headline: `${matchup} booked`, body: `${fight.weightClass}${fight.isTitleFight ? ' title fight' : ' bout'} is set for ${event.name} on ${event.date}.`, authorType: 'promotion', authorName: state.promotion.name, fighterIds, eventId: event.id, fightId: fight.id, engagementScale: scale }));
      entries.push(item({ stableKey: `fight:${fight.id}:preview`, date: currentDate, kind: 'article', headline: `Matchup preview: ${red.lastName} vs ${blue.lastName}`, body: `${red.style} meets ${blue.style}${gap >= 15 ? ` in a notable ${gap}-point OVR mismatch` : ' in a competitive matchup'}${rivalry ? ` with rivalry intensity ${rivalry.intensity ?? 1}` : ''}.`, authorType: 'media', authorName: 'Combat Wire', fighterIds, eventId: event.id, fightId: fight.id, storylineId: rivalry?.id, engagementScale: scale }));
      if (rivalry) entries.push(item({ stableKey: `fight:${fight.id}:rivalry-thread`, date: currentDate, kind: 'thread', headline: `${red.lastName} vs ${blue.lastName}: settle the rivalry?`, body: `The rivalry heads into ${event.name}.`, authorType: 'media', authorName: 'Fight Forum', fighterIds, eventId: event.id, fightId: fight.id, storylineId: rivalry.id, replies: [{ id: `${fight.id}:reply:1`, authorType: 'fan', authorName: 'CageFan88', body: 'This is the fight everyone wanted.' }, { id: `${fight.id}:reply:2`, authorType: 'media', authorName: 'Combat Wire', body: `Intensity ${rivalry.intensity ?? 1}/3 makes this must-watch.` }], engagementScale: scale }));
      if (daysUntil >= 21 && daysUntil <= 30) {
        const author = red.morale >= blue.morale ? red : blue;
        const opponent = author.id === red.id ? blue : red;
        const heated = (rivalry?.intensity ?? 0) >= 2;
        entries.push(item({ stableKey: `fight:${fight.id}:prefight`, date: currentDate, kind: 'fighter_post', headline: heated ? `${author.lastName} fires a warning` : `${author.lastName} checks in from camp`, body: heated ? `“${opponent.lastName} knows what is coming. This ends at ${event.name}.”` : `“Camp is going well. I respect ${opponent.lastName}, but I am ready.”`, authorType: 'fighter', authorName: fighterName(state, author.id), authorFighterId: author.id, fighterIds, eventId: event.id, fightId: fight.id, storylineId: rivalry?.id, engagementScale: scale }));
      }
      if (daysUntil >= 1 && daysUntil <= 7) entries.push(item({ stableKey: `fight:${fight.id}:fight-week`, date: currentDate, kind: 'thread', headline: `Fight week: ${red.lastName} vs ${blue.lastName}`, body: rivalry ? 'The final faceoff adds heat to an already bitter rivalry.' : 'Media and fans make their final predictions.', authorType: 'media', authorName: 'Fight Forum', fighterIds, eventId: event.id, fightId: fight.id, storylineId: rivalry?.id, replies: [{ id: `${fight.id}:week:1`, authorType: 'fan', authorName: 'ScorecardSam', body: `${red.lastName} by decision.` }, { id: `${fight.id}:week:2`, authorType: 'fan', authorName: 'FinishHunter', body: `${blue.lastName} finds the finish.` }], engagementScale: scale }));
    }
  }
  return addSocialFeedItems(syncLegacyNewsToSocialFeed(state), entries);
}

export function generatePostFightSocial(state: GameState, eventId: string): GameState {
  const event = state.events[eventId];
  if (!event?.isCompleted) return state;
  const entries: SocialFeedItem[] = [];
  for (const fight of event.fights) {
    if (!fight.result) continue;
    const { red, blue, scale } = fightContext(state, fight);
    if (!red || !blue) continue;
    const winner = fight.result.winnerId ? state.fighters[fight.result.winnerId] : null;
    const loser = fight.result.loserId ? state.fighters[fight.result.loserId] : null;
    const fighterIds = [red.id, blue.id];
    entries.push(item({ stableKey: `fight:${fight.id}:result`, date: event.date, kind: 'news', headline: winner ? `${winner.lastName} defeats ${loser?.lastName ?? 'their opponent'}` : `${red.lastName} and ${blue.lastName} fight to a draw`, body: `${event.name}: ${fight.result.method}, round ${fight.result.round} at ${fight.result.time}.`, authorType: 'media', authorName: 'Combat Wire', fighterIds, eventId, fightId: fight.id, engagementScale: scale }));
    if (fight.result.performanceRating >= 70) entries.push(item({ stableKey: `fight:${fight.id}:recap`, date: event.date, kind: 'article', headline: `Inside the action: ${red.lastName} vs ${blue.lastName}`, body: `A ${fight.result.performanceRating}/100 performance delivered one of ${event.name}'s talking points.`, authorType: 'media', authorName: 'Cage Journal', fighterIds, eventId, fightId: fight.id, engagementScale: scale }));
    if (winner) entries.push(item({ stableKey: `fight:${fight.id}:winner-reaction`, date: event.date, kind: 'fighter_post', headline: `${winner.lastName} reacts`, body: '“The work paid off. Thank you to my team and everyone who supported me.”', authorType: 'fighter', authorName: fighterName(state, winner.id), authorFighterId: winner.id, fighterIds, eventId, fightId: fight.id, engagementScale: scale }));
    if (loser) entries.push(item({ stableKey: `fight:${fight.id}:loser-reaction`, date: event.date, kind: 'fighter_post', headline: `${loser.lastName} responds`, body: '“This one hurts, but I will learn, recover, and come back better.”', authorType: 'fighter', authorName: fighterName(state, loser.id), authorFighterId: loser.id, fighterIds, eventId, fightId: fight.id, engagementScale: scale }));
  }
  return addSocialFeedItems(syncLegacyNewsToSocialFeed(state), entries);
}

export function applyPromotionSocialAction(state: GameState, fightId: string, action: 'announce' | 'hype'): GameState {
  const found = Object.values(state.events).flatMap(event => event.fights.map(fight => ({ event, fight }))).find(item => item.fight.id === fightId && !item.event.isCompleted);
  if (!found) return state;
  const actionKey = `fight:${fightId}:promotion-${action}`;
  if ((state.socialFeed ?? []).some(entry => entry.actionKey === actionKey)) return state;
  const { event, fight } = found;
  const { red, blue, gap, rivalry, scale } = fightContext(state, fight);
  if (!red || !blue) return state;
  const fighterIds = [red.id, blue.id];
  const socialEntry = item({ stableKey: actionKey, actionKey, date: state.currentDate, kind: action === 'announce' ? 'promotion_post' : 'thread', headline: action === 'announce' ? `${red.lastName} vs ${blue.lastName} officially announced` : `Why ${red.lastName} vs ${blue.lastName} matters`, body: action === 'announce' ? `${state.promotion.name} confirms the ${fight.weightClass} matchup for ${event.name}.` : rivalry ? 'History, rankings, and bad blood make this essential viewing.' : gap >= 15 ? 'A dangerous test with a clear favorite and a determined underdog.' : 'A closely matched fight with real divisional stakes.', authorType: 'promotion', authorName: state.promotion.name, fighterIds, eventId: event.id, fightId, storylineId: rivalry?.id, replies: action === 'hype' ? [{ id: `${fightId}:hype:1`, authorType: 'fan', authorName: 'MainEventMike', body: 'This card just got interesting.' }] : undefined, engagementScale: action === 'hype' && gap >= 15 ? scale * 0.5 : scale });
  let nextState = addSocialFeedItems(state, [socialEntry]);
  if (action === 'announce') return nextState;
  const events = { ...nextState.events, [event.id]: { ...event, fights: event.fights.map(candidate => candidate.id === fightId ? { ...candidate, socialHype: clamp((candidate.socialHype ?? 0) + (rivalry ? 4 : gap < 10 ? 3 : 1), 0, 10) } : candidate) } };
  const fighters = { ...nextState.fighters };
  if (rivalry || gap < 10) {
    fighters[red.id] = { ...red, popularity: clamp(red.popularity + 1, 0, 100) };
    fighters[blue.id] = { ...blue, popularity: clamp(blue.popularity + 1, 0, 100) };
  } else if (gap >= 15) {
    const underdog = getFighterOverall(red) < getFighterOverall(blue) ? red : blue;
    fighters[underdog.id] = { ...underdog, morale: clamp(underdog.morale - 1, 0, 100) };
  }
  nextState = { ...nextState, events, fighters };
  return nextState;
}
