import assert from 'node:assert/strict';
import { addDays, format } from 'date-fns';
import { generateInitialWorld } from './src/lib/game/generator';
import { useGameStore } from './src/store/gameStore';
import type { Event } from './src/types/game';

const resetStore = () => {
  const world = generateInitialWorld(9001);
  useGameStore.setState({
    ...world,
    currentView: 'dashboard',
    selectedFighterId: null,
    selectedEventId: null,
    selectedCalendarSlotId: null,
    selectedFightArchiveId: null,
    viewHistory: [],
    activeEventSimulation: null,
    autopilotRun: {
      active: false,
      targetDays: 0,
      daysCompleted: 0,
      batchSize: 7,
      stoppedEarly: false,
      error: null
    }
  });
  return world;
};

const start = resetStore();
const action = useGameStore.getState().advanceAutopilot(8, false);
assert.ok(action instanceof Promise, 'advanceAutopilot must yield a Promise');
assert.deepEqual(useGameStore.getState().autopilotRun, {
  active: true,
  targetDays: 8,
  daysCompleted: 0,
  batchSize: 7,
  stoppedEarly: false,
  error: null
}, 'autopilot progress must be published before the first batch runs');

const duplicate = useGameStore.getState().advanceAutopilot(180, false);
await new Promise<void>(resolve => setTimeout(resolve, 0));
assert.deepEqual(
  { targetDays: useGameStore.getState().autopilotRun.targetDays, daysCompleted: useGameStore.getState().autopilotRun.daysCompleted },
  { targetDays: 8, daysCompleted: 7 },
  'the first yielded checkpoint must expose one complete seven-day batch and ignore duplicate runs'
);
await Promise.all([action, duplicate]);
const completed = useGameStore.getState();
assert.deepEqual(completed.autopilotRun, {
  active: false,
  targetDays: 8,
  daysCompleted: 8,
  batchSize: 7,
  stoppedEarly: false,
  error: null
});
assert.equal(completed.currentDate, format(addDays(new Date(start.currentDate), 8), 'yyyy-MM-dd'));
assert.equal(completed.lastAutopilotSummary?.daysSimulated, 8);

const watchWorld = resetStore();
const candidates = Object.values(watchWorld.fighters).filter(fighter => fighter.weightClass === 'Lightweight').slice(0, 6);
const playerPromotionId = watchWorld.playerPromotionId;
const contract = {
  promotionId: playerPromotionId,
  fightsRemaining: 4,
  payPerFight: 5_000,
  winBonus: 5_000,
  exclusivity: true,
  endDate: '2026-12-31'
};
const watchEvent: Event = {
  id: 'async-watch-event',
  promotionId: playerPromotionId,
  scope: 'promotion',
  name: 'Async Watch Event',
  date: watchWorld.currentDate,
  venueId: Object.keys(watchWorld.venues)[0],
  ticketPrice: 20,
  marketingSpend: 0,
  isCompleted: false,
  fights: [0, 1, 2].map(index => ({
    id: `async-watch-fight-${index}`,
    redCornerId: candidates[index * 2].id,
    blueCornerId: candidates[index * 2 + 1].id,
    weightClass: 'Lightweight',
    isTitleFight: false,
    rounds: 3
  }))
};
useGameStore.setState({
  fighters: {
    ...watchWorld.fighters,
    ...Object.fromEntries(candidates.map(fighter => [fighter.id, {
      ...fighter,
      contract,
      injuryStatus: null,
      medicalSuspension: null,
      fatigue: 0
    }]))
  },
  events: { [watchEvent.id]: watchEvent },
  mode: 'observer'
});
await useGameStore.getState().advanceAutopilot(7, true);
const stopped = useGameStore.getState();
assert.equal(stopped.currentView, 'simulation');
assert.equal(stopped.selectedEventId, watchEvent.id);
assert.equal(stopped.activeEventSimulation?.eventId, watchEvent.id);
assert.equal(stopped.activeEventSimulation?.status, 'idle');
assert.equal(stopped.lastAutopilotSummary?.daysSimulated, 0);
assert.deepEqual(stopped.autopilotRun, {
  active: false,
  targetDays: 7,
  daysCompleted: 0,
  batchSize: 7,
  stoppedEarly: true,
  error: null
});

console.log('Async autopilot tests passed.');
