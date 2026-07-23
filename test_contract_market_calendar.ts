import assert from 'node:assert/strict';
import { addDays, format } from 'date-fns';
import { generateInitialWorld } from './src/lib/game/generator';
import {
  advanceContractMarketCalendar,
  getCurrentContractWindow,
  getInternationalSeasonCompletionDate
} from './src/lib/game/contractMarket';

const date = (value: string, days: number) =>
  format(addDays(new Date(value), days), 'yyyy-MM-dd');

let state = generateInitialWorld(2102);
const season = 2025;
const windowId = `market-window-${season}`;
state.currentDate = '2025-08-01';
state.internationalCompetitionYears = [season];
state.tournaments = {
  cupA: {
    id: 'cupA',
    promotionId: null,
    scope: 'international',
    name: 'Cup A',
    shortName: 'A',
    weightClass: 'Lightweight',
    status: 'completed',
    format: 'eight_man',
    createdDate: '2025-07-01',
    completedDate: '2025-07-30',
    participants: [],
    reserveFighterIds: [],
    fights: [],
    prestige: 80
  },
  cupB: {
    id: 'cupB',
    promotionId: null,
    scope: 'international',
    name: 'Cup B',
    shortName: 'B',
    weightClass: 'Welterweight',
    status: 'completed',
    format: 'eight_man',
    createdDate: '2025-07-01',
    completedDate: '2025-07-31',
    participants: [],
    reserveFighterIds: [],
    fights: [],
    prestige: 80
  }
};
assert.equal(getInternationalSeasonCompletionDate(state, season), '2025-07-31');
state = advanceContractMarketCalendar(state);
assert.equal(state.contractMarket.windows[windowId].status, 'open');
assert.equal(state.contractMarket.windows[windowId].openDate, '2025-08-01');
assert.equal(state.contractMarket.windows[windowId].closeDate, date('2025-08-01', 30));

state.currentDate = date('2025-08-01', 29);
assert.equal(advanceContractMarketCalendar(state).contractMarket.windows[windowId].status, 'open');
state.currentDate = date('2025-08-01', 30);
assert.equal(advanceContractMarketCalendar(state).contractMarket.windows[windowId].status, 'resolving');

let fallback = generateInitialWorld(2103);
fallback.currentDate = '2025-12-01';
fallback.internationalCompetitionYears = [];
fallback = advanceContractMarketCalendar(fallback);
assert.equal(getCurrentContractWindow(fallback)?.status, 'open');

const closed = structuredClone(fallback);
closed.contractMarket.windows[windowId].status = 'closed';
closed.contractMarket.windows[windowId].resolvedDate = closed.currentDate;
const next = advanceContractMarketCalendar(closed);
assert.ok(next.contractMarket.windows['market-window-2026']);
assert.deepEqual(advanceContractMarketCalendar(next), next);

console.log('Contract market calendar checks passed.');
