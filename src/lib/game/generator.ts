import { v4 as uuidv4 } from 'uuid';
import {
  Fighter, FighterAttributes, FighterStyle, WeightClass, GameState, Venue, Promotion, RankingItem
} from '../../types/game';
import { firstNames, lastNames, nicknames, nationalities } from '../names';
import { WEIGHT_CLASSES, FIGHTER_STYLES, GAME_CONSTANTS } from './constants';
import { PRNG } from './rng';
import { initializeRankingScores, buildPromotionRankings } from './rankings';
import { getBeltBranding } from '../branding';

type FighterArchetype = 'Champion' | 'Contender' | 'Prospect' | 'Veteran' | 'Journeyman' | 'Can';

function generateAttributes(rng: PRNG, style: FighterStyle, age: number, baseLevel: number): FighterAttributes {
  const variance = () => rng.randomInt(-8, 8);
  const clamp = (val: number) => Math.max(GAME_CONSTANTS.MIN_ATTRIBUTES, Math.min(GAME_CONSTANTS.MAX_ATTRIBUTES, val));

  let attrs: FighterAttributes = {
    striking: clamp(baseLevel + variance()),
    grappling: clamp(baseLevel + variance()),
    wrestling: clamp(baseLevel + variance()),
    submissions: clamp(baseLevel + variance()),
    cardio: clamp(baseLevel + variance() - (age > 33 ? (age - 33) * 2 : 0)),
    chin: clamp(baseLevel + variance() - (age > 35 ? (age - 35) * 3 : 0)),
    power: clamp(baseLevel + variance() + (age > 35 ? 2 : 0)), // Old man strength
    speed: clamp(baseLevel + variance() - (age > 32 ? (age - 32) * 2 : 0)),
    defense: clamp(baseLevel + variance()),
    fightIq: clamp(baseLevel + variance() + (age > 28 ? (age - 28) * 1.5 : 0)),
    toughness: clamp(baseLevel + variance()),
  };

  switch (style) {
    case 'Boxer':
      attrs.striking += 15;
      attrs.power += 5;
      attrs.grappling -= 10;
      attrs.submissions -= 10;
      break;
    case 'Wrestler':
      attrs.wrestling += 15;
      attrs.cardio += 5;
      attrs.striking -= 10;
      attrs.submissions -= 5;
      break;
    case 'BJJ':
      attrs.submissions += 20;
      attrs.grappling += 10;
      attrs.striking -= 15;
      attrs.wrestling -= 5;
      break;
    case 'Kickboxer':
      attrs.striking += 15;
      attrs.speed += 5;
      attrs.grappling -= 10;
      attrs.wrestling -= 10;
      break;
    case 'Muay Thai':
      attrs.striking += 10;
      attrs.power += 10;
      attrs.wrestling -= 10;
      attrs.submissions -= 10;
      break;
    case 'Sambo':
      attrs.grappling += 10;
      attrs.wrestling += 10;
      attrs.submissions += 5;
      attrs.striking -= 5;
      break;
    case 'Balanced':
      break;
  }

  for (const key in attrs) {
    attrs[key as keyof FighterAttributes] = clamp(attrs[key as keyof FighterAttributes]);
  }

  return attrs;
}

export function generateFighter(rng: PRNG, archetype: FighterArchetype, weightClass: WeightClass): Fighter {
  const clamp = (val: number, min = 0, max = 100) => Math.max(min, Math.min(max, val));
  
  let age = 25;
  let baseLevel = 50;
  let winRate = 0.5;
  let totalFights = 0;
  let popularity = 10;
  let potential = 50;
  
  switch(archetype) {
    case 'Champion':
      age = rng.randomInt(26, 34);
      baseLevel = rng.randomInt(85, 95);
      winRate = rng.randomFloat(0.85, 0.98);
      totalFights = rng.randomInt(15, 30);
      popularity = rng.randomInt(70, 100);
      potential = rng.randomInt(85, 100);
      break;
    case 'Contender':
      age = rng.randomInt(25, 35);
      baseLevel = rng.randomInt(75, 88);
      winRate = rng.randomFloat(0.75, 0.90);
      totalFights = rng.randomInt(12, 25);
      popularity = rng.randomInt(50, 80);
      potential = rng.randomInt(80, 95);
      break;
    case 'Prospect':
      age = rng.randomInt(19, 24);
      baseLevel = rng.randomInt(55, 70);
      winRate = rng.randomFloat(0.80, 1.0);
      totalFights = rng.randomInt(3, 10);
      popularity = rng.randomInt(20, 50);
      potential = rng.randomInt(85, 100);
      break;
    case 'Veteran':
      age = rng.randomInt(34, 42);
      baseLevel = rng.randomInt(65, 80);
      winRate = rng.randomFloat(0.55, 0.70);
      totalFights = rng.randomInt(30, 50);
      popularity = rng.randomInt(60, 90);
      potential = baseLevel; // Peaked
      break;
    case 'Journeyman':
      age = rng.randomInt(26, 35);
      baseLevel = rng.randomInt(50, 65);
      winRate = rng.randomFloat(0.40, 0.60);
      totalFights = rng.randomInt(15, 40);
      popularity = rng.randomInt(10, 40);
      potential = rng.randomInt(50, 70);
      break;
    case 'Can':
      age = rng.randomInt(22, 38);
      baseLevel = rng.randomInt(30, 45);
      winRate = rng.randomFloat(0.10, 0.35);
      totalFights = rng.randomInt(5, 20);
      popularity = rng.randomInt(0, 10);
      potential = rng.randomInt(30, 55);
      break;
  }

  const wins = Math.floor(totalFights * winRate);
  const losses = totalFights - wins;
  const kos = Math.floor(wins * rng.randomFloat(0.1, 0.7));
  const subs = Math.floor((wins - kos) * rng.randomFloat(0.1, 0.9));

  const hasNickname = popularity > 50 || rng.chance(0.3);
  const style = rng.randomItem([...FIGHTER_STYLES]);

  return {
    id: uuidv4(),
    firstName: rng.randomItem(firstNames),
    lastName: rng.randomItem(lastNames),
    nickname: hasNickname ? rng.randomItem(nicknames) : '',
    age,
    nationality: rng.randomItem(nationalities),
    weightClass,
    style,
    attributes: generateAttributes(rng, style, age, baseLevel),
    record: {
      wins,
      losses,
      draws: 0,
      kos,
      subs
    },
    popularity,
    marketability: clamp(popularity + rng.randomInt(-15, 15)),
    potential,
    morale: rng.randomInt(60, 100),
    momentum: clamp(50 + (wins - losses) * 2 + rng.randomInt(-10, 10)),
    fatigue: rng.randomInt(0, 10),
    injuryStatus: rng.chance(0.05) ? { id: uuidv4(), type: 'Minor Injury', daysRemaining: rng.randomInt(7, 30) } : null,
    contract: null,
    isChampion: false,
    history: [],
    lastFightDate: null
  };
}

const initialVenues: Venue[] = [
  { id: uuidv4(), name: 'Local Gym', city: 'Las Vegas', capacity: 500, cost: 5000 },
  { id: uuidv4(), name: 'Downtown Arena', city: 'Chicago', capacity: 3000, cost: 25000 },
  { id: uuidv4(), name: 'City Center', city: 'New York', capacity: 10000, cost: 100000 },
  { id: uuidv4(), name: 'Grand Stadium', city: 'Tokyo', capacity: 35000, cost: 500000 },
];

export function generateInitialWorld(seed?: number): GameState {
  const rng = new PRNG(seed || Math.floor(Math.random() * 1000000));
  
  const currentDate = '2025-01-01';
  const fighters: Record<string, Fighter> = {};
  const rankings: Record<WeightClass, RankingItem[]> = {
    'Bantamweight': [],
    'Featherweight': [],
    'Lightweight': [],
    'Welterweight': [],
    'Middleweight': [],
    'Heavyweight': [],
  };

  const titles: Record<WeightClass, import('../../types/game').WeightClassTitleState> = {
    'Bantamweight': { weightClass: 'Bantamweight', undisputedChampionId: null, undisputedDefenses: 0, status: 'vacant' },
    'Featherweight': { weightClass: 'Featherweight', undisputedChampionId: null, undisputedDefenses: 0, status: 'vacant' },
    'Lightweight': { weightClass: 'Lightweight', undisputedChampionId: null, undisputedDefenses: 0, status: 'vacant' },
    'Welterweight': { weightClass: 'Welterweight', undisputedChampionId: null, undisputedDefenses: 0, status: 'vacant' },
    'Middleweight': { weightClass: 'Middleweight', undisputedChampionId: null, undisputedDefenses: 0, status: 'vacant' },
    'Heavyweight': { weightClass: 'Heavyweight', undisputedChampionId: null, undisputedDefenses: 0, status: 'vacant' },
  };

  const belts: Record<string, import('../../types/game').BeltInfo> = {};
  WEIGHT_CLASSES.forEach(wc => {
    const beltId = `belt_${wc.toLowerCase()}`;
    const branding = getBeltBranding(wc as WeightClass);
    belts[beltId] = {
      id: beltId,
      ...branding,
      weightClass: wc as WeightClass,
      type: 'undisputed',
      prestige: rng.randomInt(60, 75)
    };
  });

  const titleHistory: import('../../types/game').TitleHistoryItem[] = [];

  const initialChampionsCount = rng.randomInt(1, 2);
  const wcWithChamps = new Set<string>();
  const shuffledWc = [...WEIGHT_CLASSES].sort(() => rng.randomFloat(0, 1) - 0.5);
  for (let i = 0; i < initialChampionsCount; i++) {
    wcWithChamps.add(shuffledWc[i]);
  }

  WEIGHT_CLASSES.forEach(wc => {
    let wcFighters: Fighter[] = [];
    
    // Generate archetype mix for each weight class (40 fighters total per WC = 240 total)
    // 1 Champ, 6 Contenders, 8 Prospects, 6 Veterans, 12 Journeymen, 7 Cans
    const archetypes: FighterArchetype[] = [
      'Champion',
      'Contender', 'Contender', 'Contender', 'Contender', 'Contender', 'Contender',
      'Prospect', 'Prospect', 'Prospect', 'Prospect', 'Prospect', 'Prospect', 'Prospect', 'Prospect',
      'Veteran', 'Veteran', 'Veteran', 'Veteran', 'Veteran', 'Veteran',
      'Journeyman', 'Journeyman', 'Journeyman', 'Journeyman', 'Journeyman', 'Journeyman', 'Journeyman', 'Journeyman', 'Journeyman', 'Journeyman', 'Journeyman', 'Journeyman',
      'Can', 'Can', 'Can', 'Can', 'Can', 'Can', 'Can'
    ];

    archetypes.forEach(arch => {
      const f = generateFighter(rng, arch, wc as WeightClass);
      fighters[f.id] = f;
      wcFighters.push(f);
    });
    
    // Sort by a proxy of 'overall' to set initial rankings
    wcFighters.sort((a, b) => {
      const aOvr = Object.values(a.attributes).reduce((sum, val) => sum + val, 0);
      const bOvr = Object.values(b.attributes).reduce((sum, val) => sum + val, 0);
      return bOvr - aOvr;
    });

    // We want to sign 6-8 fighters per weight class.
    let signedCount = 0;
    const targetToSign = rng.randomInt(6, 8);

    const signedFightersInWc: Fighter[] = [];

    wcFighters.forEach((f, index) => {
      let shouldSign = false;
      // Guarantee champion if this weight class was selected
      if (index === 0 && wcWithChamps.has(wc)) {
        fighters[f.id].isChampion = true;
        fighters[f.id].titleDefenses = 0;
        titles[wc as WeightClass].undisputedChampionId = f.id;
        titles[wc as WeightClass].status = 'active';
        shouldSign = true;
        titleHistory.push({
          id: `th_${f.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          weightClass: wc as WeightClass,
          fighterId: f.id,
          dateWon: currentDate,
          dateLost: null,
          defenses: 0,
          wonFromFighterId: null,
          status: 'active',
          beltType: 'undisputed'
        });
      } else if (signedCount < targetToSign && index !== 0) {
        // Higher chance to sign lower-ranked guys or prospects
        const signChance = index < 10 ? 0.2 : (index < 20 ? 0.4 : 0.6);
        if (rng.chance(signChance)) {
          shouldSign = true;
        }
      }

      // Force sign if we are running out of fighters and haven't met target
      if (signedCount < targetToSign && (40 - index) <= (targetToSign - signedCount)) {
        shouldSign = true;
      }

      if (shouldSign) {
        signedCount++;
        const basePay = GAME_CONSTANTS.BASE_FIGHT_PAY;
        const popMultiplier = 1 + (f.popularity / 10);
        
        fighters[f.id].contract = {
          fightsRemaining: rng.randomInt(2, 5),
          payPerFight: Math.floor(basePay * popMultiplier),
          winBonus: Math.floor(basePay * popMultiplier),
          exclusivity: true
        };
        signedFightersInWc.push(fighters[f.id]);
      }
    });
  });

  const venues: Record<string, Venue> = {};
  initialVenues.forEach(v => venues[v.id] = v);

  const promotion: Promotion = {
    id: uuidv4(),
    name: 'Cage Dynasty',
    shortName: 'CD',
    money: 250000,
    reputation: 20,
    fanbase: 1000
  };

  let initialState: GameState = {
    currentDate,
    promotion,
    fighters,
    events: {},
    venues,
    rankings,
    titles,
    belts,
    news: [{
      id: uuidv4(),
      date: '2025-01-01',
      title: 'Cage Dynasty Founded',
      content: 'A new MMA promotion has entered the scene. Let the games begin.',
      type: 'general'
    }],
    storylines: [],
    saveVersion: 1,
    mode: 'manager',
    autopilot: {
      enabled: false,
      watchEvents: false,
    },
    fightArchive: {},
    eventArchive: {},
    titleHistory,
    sponsorDeals: [
      {
        id: uuidv4(),
        name: 'Combat Athletics Co.',
        tier: 'local',
        monthlyIncome: 15000,
        bonusPerEvent: 5000,
        bonusPerTitleFight: 2500,
        expiresDate: '2026-01-01',
        reputationRequirement: 0,
        isActive: true
      }
    ],
    mediaDeals: [
      {
        id: uuidv4(),
        name: 'FightNet Local',
        tier: 'local',
        monthlyIncome: 20000,
        bonusPerEvent: 10000,
        bonusForHighRatedEvent: 5000,
        expiresDate: '2026-01-01',
        reputationRequirement: 0,
        isActive: true
      }
    ],
    financeLedger: [],
    tournaments: {},
    seasonPlans: {}
  };

  initialState = initializeRankingScores(initialState);
  const { newRankings } = buildPromotionRankings(initialState);
  
  // Set all initial trends to 0 instead of 999
  for (const wc in newRankings) {
    newRankings[wc as WeightClass] = newRankings[wc as WeightClass].map(r => ({ ...r, trend: 0 }));
  }
  
  initialState.rankings = newRankings;

  return initialState;
}
