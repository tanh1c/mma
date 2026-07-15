import { Fighter, FighterAttributes, FighterStyle, WeightClass } from '../../types/game';

export type FighterPhysicalProfile = Pick<Fighter, 'heightCm' | 'fightWeightLb' | 'walkAroundWeightLb'>;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const physicalRanges: Record<WeightClass, { height: [number, number]; fightWeight: [number, number]; cutPercent: [number, number] }> = {
  Bantamweight: { height: [160, 175], fightWeight: [130, 135], cutPercent: [7, 15] },
  Featherweight: { height: [165, 180], fightWeight: [140, 145], cutPercent: [7, 15] },
  Lightweight: { height: [168, 183], fightWeight: [150, 155], cutPercent: [7, 15] },
  Welterweight: { height: [173, 188], fightWeight: [165, 170], cutPercent: [7, 15] },
  Middleweight: { height: [178, 193], fightWeight: [180, 185], cutPercent: [6, 14] },
  Heavyweight: { height: [183, 205], fightWeight: [225, 265], cutPercent: [3, 10] }
};

const styleWeights: Record<FighterStyle, Partial<Record<keyof FighterAttributes, number>>> = {
  Boxer: { striking: 0.4, power: 0.2, defense: 0.1 },
  Wrestler: { wrestling: 0.4, grappling: 0.2, cardio: 0.1 },
  BJJ: { submissions: 0.4, grappling: 0.3 },
  Kickboxer: { striking: 0.4, speed: 0.2, defense: 0.1 },
  'Muay Thai': { striking: 0.3, power: 0.3, cardio: 0.1 },
  Sambo: { wrestling: 0.25, grappling: 0.25, submissions: 0.2 },
  Balanced: {}
};

const baseWeights: Record<keyof FighterAttributes, number> = {
  striking: 1,
  grappling: 1,
  wrestling: 1,
  submissions: 0.9,
  cardio: 1,
  chin: 0.8,
  power: 0.8,
  speed: 0.8,
  defense: 1,
  fightIq: 1,
  toughness: 0.8
};

export function getFighterOverall(fighter: Pick<Fighter, 'attributes' | 'style'>): number {
  const specialty = styleWeights[fighter.style];
  let total = 0;
  let weightTotal = 0;
  (Object.keys(baseWeights) as Array<keyof FighterAttributes>).forEach(key => {
    const weight = baseWeights[key] + (specialty[key] ?? 0);
    total += fighter.attributes[key] * weight;
    weightTotal += weight;
  });
  return Math.round(clamp(total / weightTotal, 10, 95));
}

export function getWeightCutPercent(fighter: Pick<Fighter, 'fightWeightLb' | 'walkAroundWeightLb'>): number {
  if (fighter.walkAroundWeightLb <= 0) return 0;
  return Math.max(0, (fighter.walkAroundWeightLb - fighter.fightWeightLb) / fighter.walkAroundWeightLb * 100);
}

export function getPhysicalProfile(weightClass: WeightClass, randomInt: (min: number, max: number) => number): FighterPhysicalProfile {
  const range = physicalRanges[weightClass];
  const heightCm = randomInt(...range.height);
  const fightWeightLb = randomInt(...range.fightWeight);
  const cutPercent = randomInt(...range.cutPercent) / 100;
  return {
    heightCm,
    fightWeightLb,
    walkAroundWeightLb: Math.max(fightWeightLb + 1, Math.round(fightWeightLb / (1 - cutPercent)))
  };
}

function hashIdentity(identity: string): number {
  let hash = 2166136261;
  for (let index = 0; index < identity.length; index++) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getDeterministicPhysicalProfile(weightClass: WeightClass, identity: string): FighterPhysicalProfile {
  let value = hashIdentity(`${weightClass}:${identity}`);
  const randomInt = (min: number, max: number) => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return min + value % (max - min + 1);
  };
  return getPhysicalProfile(weightClass, randomInt);
}

export function normalizePhysicalProfile(fighter: Pick<Fighter, 'id' | 'firstName' | 'lastName' | 'weightClass'> & Partial<FighterPhysicalProfile>): FighterPhysicalProfile {
  const fallback = getDeterministicPhysicalProfile(fighter.weightClass, fighter.id || `${fighter.firstName}-${fighter.lastName}`);
  const range = physicalRanges[fighter.weightClass];
  const heightCm = clamp(Math.round(Number(fighter.heightCm) || fallback.heightCm), ...range.height);
  const fightWeightLb = clamp(Math.round(Number(fighter.fightWeightLb) || fallback.fightWeightLb), ...range.fightWeight);
  const maxWalkAround = Math.round(fightWeightLb / (1 - range.cutPercent[1] / 100));
  const walkAroundWeightLb = clamp(Math.round(Number(fighter.walkAroundWeightLb) || fallback.walkAroundWeightLb), fightWeightLb + 1, maxWalkAround);
  return { heightCm, fightWeightLb, walkAroundWeightLb };
}

export function getPhysicalFightModifier(fighter: Fighter, opponent: Fighter): number {
  const heightEdge = clamp((fighter.heightCm - opponent.heightCm) * 0.001, -0.015, 0.015);
  const massEdge = clamp((fighter.walkAroundWeightLb - opponent.walkAroundWeightLb) / Math.max(1, opponent.walkAroundWeightLb) * 0.08, -0.02, 0.02);
  const cutBurden = clamp((getWeightCutPercent(fighter) - 8) * 0.0015, -0.006, 0.012);
  return clamp(1 + heightEdge + massEdge - cutBurden, 0.95, 1.05);
}

export function isProspect(fighter: Fighter): boolean {
  const overall = getFighterOverall(fighter);
  return fighter.age <= 25 && fighter.potential >= 72 && fighter.potential - overall >= 8;
}

const growthPriorities: Record<FighterStyle, Array<keyof FighterAttributes>> = {
  Boxer: ['striking', 'defense', 'power', 'speed', 'fightIq', 'cardio'],
  Wrestler: ['wrestling', 'grappling', 'cardio', 'toughness', 'fightIq', 'defense'],
  BJJ: ['submissions', 'grappling', 'wrestling', 'fightIq', 'cardio', 'defense'],
  Kickboxer: ['striking', 'speed', 'defense', 'cardio', 'power', 'fightIq'],
  'Muay Thai': ['striking', 'power', 'cardio', 'toughness', 'defense', 'fightIq'],
  Sambo: ['wrestling', 'grappling', 'submissions', 'power', 'cardio', 'fightIq'],
  Balanced: ['fightIq', 'cardio', 'defense', 'striking', 'wrestling', 'grappling']
};

export function improveFighterTowardPotential(
  fighter: Fighter,
  randomInt: (min: number, max: number) => number,
  random: () => number
): Fighter {
  const currentOverall = getFighterOverall(fighter);
  const headroom = fighter.potential - currentOverall;
  if (headroom <= 0) return fighter;

  const attributes = { ...fighter.attributes };
  const priorities = growthPriorities[fighter.style];
  const attempts = headroom >= 12 ? 3 : headroom >= 5 ? 2 : 1;
  const chance = clamp(0.2 + headroom / 40, 0.25, 0.7);

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (random() > chance) continue;
    const key = priorities[randomInt(0, priorities.length - 1)];
    const before = attributes[key];
    attributes[key] = Math.min(95, before + randomInt(1, headroom >= 10 ? 2 : 1));
    if (getFighterOverall({ ...fighter, attributes }) > fighter.potential) attributes[key] = before;
  }

  return { ...fighter, attributes };
}
