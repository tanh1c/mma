import type { Fighter, FighterPersonalityTrait } from '../../types/game';
import { stableCareerSeed } from './career';

const TRAITS: FighterPersonalityTrait[] = [
  'professional',
  'trash_talker',
  'diva',
  'loyal',
  'mercenary',
  'risk_taker',
  'hot_head',
  'company_fighter'
];

const conflicts = new Set(['loyal:mercenary', 'hot_head:professional']);

export function assignPersonalityTraits(fighter: Pick<Fighter, 'id'>): FighterPersonalityTrait[] {
  const first = TRAITS[stableCareerSeed(fighter.id, 'personality', 0) % TRAITS.length];
  if (stableCareerSeed(fighter.id, 'personality', 'count') % 3 === 0) return [first];
  for (let offset = 0; offset < TRAITS.length; offset++) {
    const second = TRAITS[(stableCareerSeed(fighter.id, 'personality', 1) + offset) % TRAITS.length];
    const pair = [first, second].sort().join(':');
    if (second !== first && !conflicts.has(pair)) return [first, second];
  }
  return [first];
}

export function ensurePersonalityTraits(fighter: Fighter): Fighter {
  const valid = Array.isArray(fighter.personalityTraits)
    && fighter.personalityTraits.length >= 1
    && fighter.personalityTraits.length <= 2
    && fighter.personalityTraits.every(trait => TRAITS.includes(trait));
  return valid ? fighter : { ...fighter, personalityTraits: assignPersonalityTraits(fighter) };
}

export function hasPersonalityTrait(fighter: Fighter, trait: FighterPersonalityTrait): boolean {
  return fighter.personalityTraits.includes(trait);
}
