import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { validateAndMigrateState, CURRENT_SAVE_VERSION } from './src/lib/game/save';
import { assignPersonalityTraits } from './src/lib/game/personality';
import { chooseObserverDramaResponse, generateScheduledDrama, hasPendingIncidentForEvent, resolveDramaIncident, resolveObserverDrama } from './src/lib/game/drama';
import { advanceTime } from './src/lib/engine';
import { simulateDueEvents } from './src/lib/game/autobooker';
import { validateTitleShotDebtState } from './src/lib/game/tournament';
import { useGameStore } from './src/store/gameStore';
import type { Event } from './src/types/game';

const first = generateInitialWorld(701);

assert.equal(CURRENT_SAVE_VERSION, 15);

for (const fighter of Object.values(first.fighters)) {
  assert.ok(fighter.personalityTraits.length >= 1 && fighter.personalityTraits.length <= 2);
  assert.equal(new Set(fighter.personalityTraits).size, fighter.personalityTraits.length);
  assert.equal(fighter.personalityTraits.includes('loyal') && fighter.personalityTraits.includes('mercenary'), false);
  assert.equal(fighter.personalityTraits.includes('professional') && fighter.personalityTraits.includes('hot_head'), false);
  assert.deepEqual(assignPersonalityTraits(fighter), fighter.personalityTraits);
}

const legacy = structuredClone(first) as any;
delete legacy.drama;
legacy.saveVersion = 11;
for (const fighter of Object.values(legacy.fighters) as any[]) delete fighter.personalityTraits;
const migrated = validateAndMigrateState(legacy)!;
const migratedAgain = validateAndMigrateState(structuredClone(migrated))!;

assert.deepEqual(migratedAgain, migrated);
assert.equal(migrated.saveVersion, 15);
assert.equal(migrated.drama.promoterIdentity, 'meritocracy');
assert.deepEqual(migrated.drama.incidents, {});
assert.deepEqual(migrated.drama.triggerKeys, []);
assert.ok(Object.values(migrated.fighters).every(fighter => fighter.personalityTraits.length >= 1 && fighter.personalityTraits.length <= 2));

const dramaBase = generateInitialWorld(702);
const [red, blue] = Object.values(dramaBase.fighters).filter(fighter => fighter.weightClass === 'Lightweight').slice(0, 2);
const event: Event = {
  id: 'drama-event',
  name: 'Drama Night',
  date: '2025-01-08',
  venueId: Object.keys(dramaBase.venues)[0],
  ticketPrice: 40,
  marketingSpend: 10_000,
  isCompleted: false,
  fights: [{ id: 'drama-fight', redCornerId: red.id, blueCornerId: blue.id, weightClass: 'Lightweight', isTitleFight: false, rounds: 3, campFocus: 'balanced', socialHype: 0 }]
};
const contract = { fightsRemaining: 4, payPerFight: 10_000, winBonus: 10_000, exclusivity: true, endDate: '2026-01-01' };
const dramaFixture = {
  ...dramaBase,
  currentDate: '2025-01-01',
  events: { [event.id]: event },
  fighters: {
    ...dramaBase.fighters,
    [red.id]: { ...red, personalityTraits: ['hot_head' as const], contract, injuryStatus: null, medicalSuspension: null, popularity: 90 },
    [blue.id]: { ...blue, personalityTraits: ['trash_talker' as const], contract, injuryStatus: null, medicalSuspension: null, popularity: 85 }
  },
  drama: { ...dramaBase.drama, triggerKeys: [], incidents: {}, cooldowns: {} }
};
const generated = generateScheduledDrama(dramaFixture, dramaFixture.currentDate, 'en');
const repeated = generateScheduledDrama(generated, dramaFixture.currentDate, 'en');
assert.deepEqual(repeated, generated);
assert.equal(Object.values(generated.drama.incidents).length, 1);
const incident = Object.values(generated.drama.incidents)[0];
assert.equal(incident.status, 'pending');
assert.equal(hasPendingIncidentForEvent(generated, event.id), true);
for (const identity of ['meritocracy', 'spectacle', 'prospect_builder', 'conservative'] as const) {
  const policyState = { ...generated, drama: { ...generated.drama, promoterIdentity: identity } };
  const choice = chooseObserverDramaResponse(policyState, incident);
  assert.ok(choice);
  assert.ok(incident.responseKeys.includes(choice.responseKey));
  assert.ok(choice.rationaleKey.startsWith(`generated.drama.rationale.${identity}`));
}
const observerFixture = { ...generated, mode: 'observer' as const, autopilot: { ...generated.autopilot, enabled: true } };
const autoResolved = resolveObserverDrama(observerFixture, 'en');
assert.equal(autoResolved.drama.incidents[incident.id].status, 'resolved');
assert.equal(autoResolved.drama.incidents[incident.id].resolverMode, 'observer');
assert.deepEqual(resolveObserverDrama(autoResolved, 'en'), autoResolved);

const resolved = resolveDramaIncident(generated, incident.id, incident.responseKeys[0], 'manager', undefined, 'en');
assert.equal(resolved.drama.incidents[incident.id].status, 'resolved');
assert.equal(resolved.drama.incidents[incident.id].resolverMode, 'manager');
assert.equal(hasPendingIncidentForEvent(resolved, event.id), false);
assert.deepEqual(resolveDramaIncident(resolved, incident.id, incident.responseKeys[0], 'manager', undefined, 'en'), resolved);
assert.ok(Object.values(resolved.fighters).every(fighter => fighter.morale >= 0 && fighter.morale <= 100 && fighter.popularity >= 0 && fighter.popularity <= 100));
assert.ok(resolved.promotion.money >= 0 && resolved.promotion.reputation >= 0 && resolved.promotion.reputation <= 100 && resolved.promotion.fanbase >= 0);
const titleComplaintId = 'title-picture-complaint';
const titleComplaint = {
  ...generated,
  fighters: { ...generated.fighters, [red.id]: { ...generated.fighters[red.id], titleShotPromised: false } },
  drama: {
    ...generated.drama,
    incidents: {
      ...generated.drama.incidents,
      [titleComplaintId]: {
        id: titleComplaintId,
        type: 'title_picture_complaint' as const,
        severity: 'major' as const,
        status: 'pending' as const,
        createdDate: generated.currentDate,
        fighterIds: [red.id, blue.id] as [string, string],
        eventId: event.id,
        fightId: event.fights[0].id,
        responseKeys: ['promise_eliminator', 'reject_demand']
      }
    }
  }
};
const promisedEliminator = resolveDramaIncident(titleComplaint, titleComplaintId, 'promise_eliminator', 'manager', undefined, 'en');
assert.equal(promisedEliminator.fighters[red.id].titleShotPromised, false);
assert.deepEqual(validateTitleShotDebtState(promisedEliminator), []);
const completed = generateScheduledDrama({ ...dramaFixture, events: { [event.id]: { ...event, isCompleted: true } } }, dramaFixture.currentDate, 'en');
assert.equal(Object.keys(completed.drama.incidents).length, 0);

const advanced = advanceTime({ ...dramaFixture, currentDate: '2024-12-25' }, 7, 'en');
assert.equal(Object.keys(advanced.drama.incidents).length, 1);

useGameStore.setState(generated);
useGameStore.getState().setPromoterIdentity('spectacle');
assert.equal(useGameStore.getState().drama.promoterIdentity, 'spectacle');
useGameStore.getState().resolveDramaIncident(incident.id, incident.responseKeys[0]);
assert.equal(useGameStore.getState().drama.incidents[incident.id].status, 'resolved');

const lightweight = Object.values(dramaBase.fighters).filter(fighter => fighter.weightClass === 'Lightweight').slice(0, 6);
const welterweight = Object.values(dramaBase.fighters).filter(fighter => fighter.weightClass === 'Welterweight').slice(0, 6);
const makeFights = (prefix: string, fighters: typeof lightweight, weightClass: 'Lightweight' | 'Welterweight') => [0, 1, 2].map(index => ({
  id: `${prefix}-${index}`,
  redCornerId: fighters[index * 2].id,
  blueCornerId: fighters[index * 2 + 1].id,
  weightClass,
  isTitleFight: false,
  rounds: 3 as const,
  campFocus: 'balanced' as const,
  socialHype: 0
}));
const blockedEvent: Event = { ...event, id: 'blocked-event', date: '2025-01-08', fights: makeFights('blocked-fight', lightweight, 'Lightweight') };
const clearEvent: Event = { ...event, id: 'clear-event', date: '2025-01-08', fights: makeFights('clear-fight', welterweight, 'Welterweight') };
const dueFixture = {
  ...dramaBase,
  currentDate: '2025-01-08',
  mode: 'manager' as const,
  fighters: Object.fromEntries(Object.values(dramaBase.fighters).map(fighter => [fighter.id, [...lightweight, ...welterweight].some(item => item.id === fighter.id)
    ? { ...fighter, contract, injuryStatus: null, medicalSuspension: null }
    : fighter])),
  events: { [blockedEvent.id]: blockedEvent, [clearEvent.id]: clearEvent },
  drama: {
    ...dramaBase.drama,
    incidents: {
      [incident.id]: {
        ...incident,
        eventId: blockedEvent.id,
        fightId: blockedEvent.fights[0].id,
        fighterIds: [blockedEvent.fights[0].redCornerId, blockedEvent.fights[0].blueCornerId]
      }
    }
  }
};
const dueResult = simulateDueEvents(dueFixture, false, 'en').state;
assert.equal(dueResult.events[blockedEvent.id].isCompleted, false);
assert.equal(dueResult.events[clearEvent.id].isCompleted, true);

useGameStore.setState({ ...dueFixture, currentView: 'dashboard', selectedEventId: null, activeEventSimulation: null });
useGameStore.getState().startEventSimulation(blockedEvent.id);
assert.equal(useGameStore.getState().currentView, 'inbox');
assert.equal(useGameStore.getState().activeEventSimulation, null);

useGameStore.setState({ ...dramaFixture, currentDate: '2024-12-25', currentView: 'dashboard', selectedEventId: null, activeEventSimulation: null });
useGameStore.getState().startEventSimulation(event.id);
const futureStart = useGameStore.getState();
assert.ok(futureStart.currentDate < event.date);
assert.equal(futureStart.currentView, 'inbox');
assert.equal(futureStart.activeEventSimulation, null);
assert.equal(hasPendingIncidentForEvent(futureStart, event.id), true);

useGameStore.setState({ ...generated, currentView: 'event-builder' });
useGameStore.getState().updateEvent(event.id, { ...event, fights: [] });
const staleUpdated = useGameStore.getState();
assert.equal(staleUpdated.drama.incidents[incident.id].status, 'expired');
assert.equal(hasPendingIncidentForEvent(staleUpdated, event.id), false);

const resolvedVi = resolveDramaIncident(generated, incident.id, incident.responseKeys[0], 'manager', undefined, 'vi');
assert.equal(resolvedVi.news[0].content.includes(incident.responseKeys[0]), false);

console.log('Personality and drama persistence tests passed.');
