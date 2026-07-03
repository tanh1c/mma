export const WEIGHT_CLASSES = [
  'Bantamweight',
  'Featherweight',
  'Lightweight',
  'Welterweight',
  'Middleweight',
  'Heavyweight'
] as const;

export const FIGHTER_STYLES = [
  'Boxer',
  'Wrestler',
  'BJJ',
  'Kickboxer',
  'Muay Thai',
  'Sambo',
  'Balanced'
] as const;

export const GAME_CONSTANTS = {
  MAX_ATTRIBUTES: 100,
  MIN_ATTRIBUTES: 10,
  BASE_FIGHT_PAY: 2000,
  BASE_WIN_BONUS: 2000,
  MAX_FATIGUE: 100,
  MAX_MORALE: 100,
  MAX_MOMENTUM: 100,
  MAX_POPULARITY: 100,
  MIN_AGE: 18,
  MAX_AGE: 45
};
