import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { addSocialFeedItems, applyPromotionSocialAction, generatePostFightSocial, generateScheduledFightSocial, getFighterSocialFeed, getFighterStorylines, syncLegacyNewsToSocialFeed } from './src/lib/game/social';
import { validateAndMigrateState, CURRENT_SAVE_VERSION } from './src/lib/game/save';
import { advanceTime, finalizeEventFinancials } from './src/lib/engine';
import { calculateEventProjections } from './src/lib/game/economy';

const state = generateInitialWorld(31);
const synced = syncLegacyNewsToSocialFeed({ ...state, socialFeed: [] });
assert.ok(synced.socialFeed.length >= state.news.length);
assert.ok(synced.socialFeed.every(item => item.stableKey));

const sample = synced.socialFeed[0];
const many = Array.from({ length: 205 }, (_, index) => ({ ...sample, id: `social-${index}`, stableKey: `social-${index}`, date: `2026-01-${String((index % 28) + 1).padStart(2, '0')}` }));
const capped = addSocialFeedItems({ ...synced, socialFeed: [] }, [...many, many[0]]);
assert.equal(capped.socialFeed.length, 200);
assert.equal(new Set(capped.socialFeed.map(item => item.stableKey)).size, 200);
assert.ok(capped.socialFeed.every((item, index, items) => index === 0 || items[index - 1].date >= item.date));

const fighter = Object.values(state.fighters)[0];
const linked = { ...sample, id: 'linked', stableKey: 'linked', fighterIds: [fighter.id] };
const selected = addSocialFeedItems({ ...synced, socialFeed: [] }, [linked]);
assert.equal(getFighterSocialFeed(selected, fighter.id).length, 1);
const storylineState = { ...selected, storylines: [{ id: 'old', type: 'Rivalry', fighterIds: [fighter.id], description: 'Resolved', isActive: false, resolvedDate: '2026-02-01' }, { id: 'active', type: 'Rivalry', fighterIds: [fighter.id], description: 'Active', isActive: true, createdDate: '2026-01-01' }] };
assert.equal(getFighterStorylines(storylineState, fighter.id)[0].id, 'active');

const legacy: any = structuredClone(state);
legacy.saveVersion = 8;
delete legacy.socialFeed;
const migrated = validateAndMigrateState(legacy)!;
assert.equal(CURRENT_SAVE_VERSION, 10);
assert.ok(Array.isArray(migrated.socialFeed));
assert.ok(Object.values(migrated.events).flatMap(event => event.fights).every(fight => fight.socialHype === 0));

const [red, blue] = Object.values(state.fighters).filter(candidate => candidate.weightClass === 'Lightweight').slice(0, 2);
const event: import('./src/types/game').Event = { id: 'social-event', name: 'Cage Dynasty Social Test', date: '2025-02-01', venueId: Object.keys(state.venues)[0], ticketPrice: 40, marketingSpend: 5000, isCompleted: false, fights: [{ id: 'social-fight', redCornerId: red.id, blueCornerId: blue.id, weightClass: 'Lightweight', isTitleFight: false, rounds: 3, socialHype: 0 }] };
const scheduledBase = { ...state, events: { ...state.events, [event.id]: event }, currentDate: event.date, socialFeed: [] };
const booked = generateScheduledFightSocial(scheduledBase, event.date);
assert.ok(booked.socialFeed.some(item => item.stableKey.endsWith(':booked')));
assert.equal(generateScheduledFightSocial(booked, event.date).socialFeed.length, booked.socialFeed.length);
const prefight = generateScheduledFightSocial({ ...scheduledBase, currentDate: '2025-01-10' }, '2025-01-10');
assert.ok(prefight.socialFeed.some(item => item.stableKey.endsWith(':prefight')));
assert.equal(generateScheduledFightSocial(prefight, '2025-01-10').socialFeed.length, prefight.socialFeed.length);
const fightWeek = generateScheduledFightSocial({ ...scheduledBase, currentDate: '2025-01-28' }, '2025-01-28');
assert.ok(fightWeek.socialFeed.some(item => item.stableKey.endsWith(':fight-week')));
assert.equal(generateScheduledFightSocial(fightWeek, '2025-01-28').socialFeed.length, fightWeek.socialFeed.length);

const fight = event.fights[0];
const announced = applyPromotionSocialAction(scheduledBase, fight.id, 'announce');
assert.ok(announced.socialFeed.some(item => item.actionKey === `fight:${fight.id}:promotion-announce`));
assert.equal(applyPromotionSocialAction(announced, fight.id, 'announce').socialFeed.length, announced.socialFeed.length);
const hyped = applyPromotionSocialAction(scheduledBase, fight.id, 'hype');
const hypedFight = Object.values(hyped.events).flatMap(item => item.fights).find(item => item.id === fight.id)!;
assert.ok((hypedFight.socialHype ?? 0) > 0 && (hypedFight.socialHype ?? 0) <= 10);
assert.ok(Object.values(hyped.fighters).every(item => item.popularity >= 0 && item.popularity <= 100 && item.morale >= 0 && item.morale <= 100));

const completedState = structuredClone(scheduledBase);
completedState.events[event.id].isCompleted = true;
completedState.events[event.id].fights[0].result = { winnerId: fight.redCornerId, loserId: fight.blueCornerId, method: 'KO/TKO', round: 1, time: '1:00', commentary: [], performanceRating: 90 };
const postFight = generatePostFightSocial(completedState, event.id);
assert.ok(postFight.socialFeed.some(item => item.stableKey.endsWith(':result')));
assert.equal(generatePostFightSocial(postFight, event.id).socialFeed.length, postFight.socialFeed.length);

const advanceBase = { ...scheduledBase, currentDate: '2025-01-09', news: [{ id: 'integration-news', date: '2025-01-09', title: 'Integration news', content: 'Synced by advance time.', type: 'general' as const }] };
const advanced = advanceTime(advanceBase, 1);
assert.ok(advanced.socialFeed.some(item => item.stableKey === 'legacy-news:integration-news'));
assert.ok(advanced.socialFeed.some(item => item.stableKey.endsWith(':prefight')));

const venue = state.venues[event.venueId];
const projectionFighters = { ...state.fighters, [red.id]: { ...red, contract: red.contract ?? { fightsRemaining: 3, payPerFight: 1000, winBonus: 1000, exclusivity: true, endDate: '2026-01-01' } }, [blue.id]: { ...blue, contract: blue.contract ?? { fightsRemaining: 3, payPerFight: 1000, winBonus: 1000, exclusivity: true, endDate: '2026-01-01' } } };
const zeroProjection = calculateEventProjections([{ ...fight, socialHype: 0 }], projectionFighters, venue, event.ticketPrice, event.marketingSpend, state.promotion, state.storylines, state.titles, state.tournaments);
const hypeProjection = calculateEventProjections([{ ...fight, socialHype: 10 }], projectionFighters, venue, event.ticketPrice, event.marketingSpend, state.promotion, state.storylines, state.titles, state.tournaments);
assert.ok(hypeProjection.eventHype > zeroProjection.eventHype);
assert.ok(hypeProjection.eventHype - zeroProjection.eventHype <= 10);

const maxReputationState = structuredClone(state);
const [fanRed, fanBlue] = Object.values(maxReputationState.fighters).filter(candidate => candidate.weightClass === 'Lightweight').slice(0, 2);
const fanVenue = Object.values(maxReputationState.venues).find(candidate => candidate.capacity <= 1000)!;
maxReputationState.promotion = { ...maxReputationState.promotion, reputation: 100, fanbase: 1000 };
fanRed.popularity = 100;
fanBlue.popularity = 100;
maxReputationState.events = {
  fanbaseEvent: {
    id: 'fanbaseEvent',
    name: 'Fanbase Growth Test',
    date: maxReputationState.currentDate,
    venueId: fanVenue.id,
    ticketPrice: 20,
    marketingSpend: 0,
    isCompleted: false,
    fights: [{ id: 'fanbase-fight', redCornerId: fanRed.id, blueCornerId: fanBlue.id, weightClass: 'Lightweight', isTitleFight: false, rounds: 3, result: { winnerId: fanRed.id, loserId: fanBlue.id, method: 'Unanimous Decision', round: 3, time: '5:00', commentary: [], performanceRating: 70 } }]
  }
};
const maxReputationFanbase = finalizeEventFinancials(maxReputationState, 'fanbaseEvent');
assert.equal(maxReputationFanbase.promotion.reputation, 100);
assert.ok(maxReputationFanbase.events.fanbaseEvent.results!.attendance > 0);
assert.ok(maxReputationFanbase.promotion.fanbase > maxReputationState.promotion.fanbase);

console.log('Social Hub tests passed.');
