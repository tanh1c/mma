import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { compareFighters, getFighterReadiness, getGrandPrixExplanation, recommendMatchups, summarizeCompletedEvent } from './src/lib/game/insights';

const state = generateInitialWorld();
const fighters = Object.values(state.fighters).filter(fighter => fighter.contract && fighter.weightClass === 'Lightweight').slice(0, 4);
assert.ok(fighters.length >= 4, 'Expected Lightweight contract fighters.');

const [red, blue, injured, suspended] = fighters;
state.fighters[injured.id] = { ...injured, injuryStatus: { id: 'injury', type: 'Broken Hand', daysRemaining: 30 } };
state.fighters[suspended.id] = { ...suspended, injuryStatus: null, medicalSuspension: { id: 'suspension', reason: 'hard_fight', daysRemaining: 14, severity: 'minor' } };

assert.equal(getFighterReadiness(red).status, 'ready');
assert.equal(getFighterReadiness(state.fighters[injured.id]).status, 'injured');
assert.equal(getFighterReadiness(state.fighters[suspended.id]).status, 'suspended');
assert.equal(getFighterReadiness(red, 'vi').status, getFighterReadiness(red, 'en').status);
assert.notEqual(getFighterReadiness(red, 'vi').label, getFighterReadiness(red, 'en').label);

const comparison = compareFighters(red, blue);
assert.deepEqual(comparison, compareFighters(red, blue));
const vietnameseComparison = compareFighters(red, blue, 'vi');
assert.deepEqual({ ...comparison, styleNote: '', mismatchWarning: undefined, readiness: { red: { ...comparison.readiness.red, label: '', detail: '' }, blue: { ...comparison.readiness.blue, label: '', detail: '' } } }, { ...vietnameseComparison, styleNote: '', mismatchWarning: undefined, readiness: { red: { ...vietnameseComparison.readiness.red, label: '', detail: '' }, blue: { ...vietnameseComparison.readiness.blue, label: '', detail: '' } } });
assert.notEqual(comparison.styleNote, vietnameseComparison.styleNote);
assert.ok(comparison.redChance >= 10 && comparison.redChance <= 90);
assert.ok(comparison.blueChance >= 10 && comparison.blueChance <= 90);

const recommendations = recommendMatchups(state, 'Lightweight', [red.id]);
assert.ok(recommendations.every(item => item.red.id !== red.id && item.blue.id !== red.id));
assert.ok(recommendations.every(item => item.red.id !== injured.id && item.blue.id !== injured.id && item.red.id !== suspended.id && item.blue.id !== suspended.id));

const explanation = getGrandPrixExplanation({ id: 'gp', year: 2026, date: '2026-06-01', type: 'grand_prix_round', status: 'planned', priority: 1, tournamentId: 'gp' }, {
  tournamentId: 'gp', name: 'Test GP', status: 'active', format: 'four_man', ageDays: 10, currentRoundNeeded: 'final', scheduledRound: 'none', completedSlots: 2, missingWinners: 0, roundDelayReason: 'Finalists need recovery', earliestRoundDate: '2026-06-20', hasUpcomingTournamentFights: false, canScheduleNow: false, reasonCannotSchedule: 'Delayed until 2026-06-20'
});
assert.equal(explanation?.retryDate, '2026-06-20');
assert.ok(explanation?.details.some(detail => detail.includes('Delayed until')));

const event = {
  id: 'event', name: 'Test Event', date: '2026-06-01', venueId: Object.keys(state.venues)[0], ticketPrice: 50, marketingSpend: 1000, isCompleted: true,
  fights: [
    { id: 'fight-1', redCornerId: red.id, blueCornerId: blue.id, weightClass: 'Lightweight' as const, isTitleFight: false, rounds: 3, result: { winnerId: red.id, loserId: blue.id, method: 'KO/TKO' as const, round: 2, time: '1:00', commentary: [], performanceRating: 72 } },
    { id: 'fight-2', redCornerId: blue.id, blueCornerId: red.id, weightClass: 'Lightweight' as const, isTitleFight: false, rounds: 3, result: { winnerId: blue.id, loserId: red.id, method: 'Submission' as const, round: 1, time: '2:00', commentary: [], performanceRating: 91, injuries: [{ fighterId: red.id, type: 'Cut', daysRemaining: 7 }] } }
  ],
  results: { attendance: 1000, gateRevenue: 50000, broadcastRevenue: 10000, fighterBasePay: 10000, fighterWinBonuses: 5000, venueCost: 5000, marketingCost: 1000, totalRevenue: 60000, totalCost: 21000, profit: 39000, fanReaction: 82 }
};
const recap = summarizeCompletedEvent(state, event);
assert.equal(recap.bestFight?.rating, 91);
assert.ok(recap.medical.some(item => item.fighter.id === red.id));

console.log('Insight helper checks passed.');
