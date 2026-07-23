import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { advanceTime, finalizeEventFinancials } from './src/lib/engine';

const state = generateInitialWorld(1805);
const rival = Object.values(state.promotions).find(promotion => promotion.control === 'ai')!;
state.sponsorDeals = [];
state.mediaDeals = [];
for (const objectives of Object.values(state.drama.objectives)) {
  for (const objective of objectives) objective.rewardGranted = true;
}
const rivalRecordsBefore = Object.fromEntries(Object.values(state.fighters).filter(fighter => fighter.contract?.promotionId === rival.id).map(fighter => [fighter.id, { ...fighter.record }]));
const advanced = advanceTime(state, 60, 'en');
const rivalEvents = Object.values(advanced.eventArchive).filter(event => event.promotionId === rival.id);

assert.ok(rivalEvents.length >= 1);
assert.ok(advanced.promotionEconomies[state.playerPromotionId].ledger.every(entry => !rivalEvents.some(event => event.id === entry.sourceId)));
assert.ok(Object.entries(rivalRecordsBefore).some(([id, record]) => JSON.stringify(advanced.fighters[id].record) !== JSON.stringify(record)));
assert.ok(Object.values(advanced.fightArchive).filter(fight => fight.promotionId === rival.id).every(fight => fight.scope === 'promotion'));
assert.ok((advanced.financeLedger ?? []).every(entry => !rivalEvents.some(event => event.id === entry.eventId)));
assert.ok(new Date(advanced.promotions[rival.id].nextAiEventDate!).getTime() > new Date(advanced.currentDate).getTime());
for (const fight of Object.values(advanced.fightArchive).filter(fight => fight.promotionId === rival.id && fight.isTitleFight && fight.winnerId)) {
  assert.ok(advanced.titleHistory.some(reign => reign.promotionId === rival.id && reign.scope === 'promotion' && reign.weightClass === fight.weightClass && reign.fighterId === fight.winnerId && reign.status === 'active'));
}

const incompleteState = structuredClone(state);
const incompleteEventId = 'incomplete-rival-event';
incompleteState.events[incompleteEventId] = {
  id: incompleteEventId,
  promotionId: rival.id,
  scope: 'promotion',
  name: 'Incomplete Rival Event',
  date: incompleteState.currentDate,
  venueId: Object.keys(incompleteState.venues)[0],
  ticketPrice: 0,
  marketingSpend: 0,
  fights: [{
    id: 'incomplete-rival-fight',
    redCornerId: incompleteState.rankingsByPromotion[rival.id].Bantamweight[0].fighterId,
    blueCornerId: incompleteState.rankingsByPromotion[rival.id].Bantamweight[1].fighterId,
    weightClass: 'Bantamweight',
    isTitleFight: false,
    rounds: 3,
    campFocus: 'balanced',
    socialHype: 0
  }],
  isCompleted: false
};
const rejected = finalizeEventFinancials(incompleteState, incompleteEventId, 'en');
assert.equal(rejected.events[incompleteEventId].isCompleted, false);
assert.equal(rejected.eventArchive[incompleteEventId], undefined);

console.log('Rival promotion simulation checks passed.');
