import assert from 'node:assert/strict';
import type { GameState } from './src/types/game';
import { deriveFighterAchievements } from './src/lib/game/fighterAchievements';

const fighter = {
  id: 'fighter-1',
  firstName: 'Alex',
  lastName: 'Stone',
  nickname: '',
  age: 28,
  nationality: 'USA',
  weightClass: 'Lightweight' as const,
  style: 'Boxer' as const,
  attributes: { striking: 80, grappling: 70, wrestling: 70, submissions: 60, cardio: 80, chin: 75, power: 80, speed: 75, defense: 70, fightIq: 75, toughness: 75 },
  record: { wins: 5, losses: 1, draws: 0, kos: 3, subs: 0 },
  popularity: 50,
  marketability: 50,
  potential: 50,
  morale: 50,
  momentum: 50,
  fatigue: 0,
  injuryStatus: null,
  contract: null,
  isChampion: true,
  history: [],
  lastFightDate: null
};

const state = {
  fighters: { [fighter.id]: fighter },
  fightArchive: {
    'fight-1': {
      id: 'fight-1', date: '2026-02-01', eventId: 'event-1', eventName: 'Cage Dynasty 1', weightClass: 'Lightweight',
      redFighterId: fighter.id, blueFighterId: 'fighter-2', winnerId: fighter.id, method: 'KO/TKO', round: 2, time: '2:15', isTitleFight: true, performanceRating: 90,
      titleChangeInfo: { type: 'unified' }
    }
  },
  titleHistory: [{
    id: 'title-1', weightClass: 'Lightweight', fighterId: fighter.id, dateWon: '2026-01-01', dateLost: null, defenses: 2, wonFromFighterId: null, status: 'active', beltType: 'undisputed'
  }],
  yearlyAwards: {
    2026: { year: 2026, fighterOfTheYearId: fighter.id, fightOfTheYearId: 'fight-1' }
  },
  tournaments: {
    'gp-1': {
      id: 'gp-1', name: 'Lightweight Crown GP', shortName: 'LW GP', weightClass: 'Lightweight', status: 'completed', format: 'four_man', createdDate: '2026-01-01', completedDate: '2026-03-01',
      participants: [{ fighterId: fighter.id, seed: 1 }], reserveFighterIds: [], fights: [], winnerId: fighter.id, titleShotPromised: true, prestige: 80
    }
  }
} as unknown as GameState;

const achievements = deriveFighterAchievements(state, fighter.id);
assert.ok(achievements.some(item => item.title === 'Undisputed Champion'));
assert.ok(achievements.some(item => item.title === 'Successful Title Defense' && item.description.includes('2')));
assert.ok(achievements.some(item => item.title === 'Grand Prix Champion' && item.description.includes('4-Man')));
assert.ok(achievements.some(item => item.title === 'Fighter of the Year'));
assert.ok(achievements.some(item => item.title === 'Fight of the Year' && item.fightArchiveId === 'fight-1'));
const vietnameseAchievements = deriveFighterAchievements(state, fighter.id, 'vi');
assert.deepEqual(achievements.map(({ title: _title, description: _description, ...item }) => item), vietnameseAchievements.map(({ title: _title, description: _description, ...item }) => item));
assert.notEqual(achievements[0].title, vietnameseAchievements[0].title);
assert.ok(!deriveFighterAchievements(state, 'fighter-2').length);

console.log('Fighter achievement checks passed.');
