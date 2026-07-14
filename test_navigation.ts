import assert from 'node:assert/strict';
import { useGameStore } from './src/store/gameStore';

const store = useGameStore;

store.getState().setView('roster', undefined, { replace: true });
store.getState().setView('fighter-detail', { fighterId: 'fighter-1' });
store.getState().setView('fight-detail', { fightArchiveId: 'fight-1' });
store.getState().goBack('history');

let state = store.getState();
assert.equal(state.currentView, 'fighter-detail');
assert.equal(state.selectedFighterId, 'fighter-1');
assert.equal(state.selectedFightArchiveId, null);

state.goBack('history');
state = store.getState();
assert.equal(state.currentView, 'roster');
assert.equal(state.selectedFighterId, null);

state.setView('rankings', undefined, { replace: true });
state.setView('fighter-detail', { fighterId: 'fighter-2' });
state.goBack('history');
assert.equal(store.getState().currentView, 'rankings');

store.getState().goBack('history');
assert.equal(store.getState().currentView, 'history');

console.log('Navigation checkpoint checks passed.');
