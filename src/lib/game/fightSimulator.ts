import { Fighter, FightCampFocus, FightMatchup, FightResult, FighterStyle, RoundStats, JudgeRoundScore, FighterRoundStats } from '../../types/game';
import { getFighterOverall, getPhysicalFightModifier, getWeightCutPercent } from './fighterRatings';

interface SimState {
  r1Cardio: number;
  r2Cardio: number;
  r1Damage: number;
  r2Damage: number;
  r1HeadDmg: number;
  r2HeadDmg: number;
  r1BodyDmg: number;
  r2BodyDmg: number;
  r1LegDmg: number;
  r2LegDmg: number;
  r1CutSeverity: number; // 0-100
  r2CutSeverity: number; // 0-100
}

function randomFloat(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getStyleModifier(style1: FighterStyle, style2: FighterStyle): number {
  const advantageMap: Record<FighterStyle, FighterStyle[]> = {
    'Boxer': ['BJJ', 'Sambo'],
    'Wrestler': ['Boxer', 'Kickboxer'],
    'BJJ': ['Wrestler', 'Sambo'],
    'Kickboxer': ['BJJ', 'Boxer'],
    'Muay Thai': ['Kickboxer', 'Wrestler'],
    'Sambo': ['Muay Thai', 'Kickboxer'],
    'Balanced': []
  };
  
  if (advantageMap[style1]?.includes(style2)) return 1.02; // Minor edge, not 10%
  if (advantageMap[style2]?.includes(style1)) return 0.98;
  return 1.0;
}

const campMultipliers: Record<FightCampFocus, Partial<Fighter['attributes']>> = {
  balanced: {},
  striking: { striking: 1.03, power: 1.03 },
  wrestling: { wrestling: 1.03, grappling: 1.03, submissions: 1.03 },
  cardio: { cardio: 1.04 },
  recovery: {}
};

function applyCamp(fighter: Fighter, focus: FightCampFocus = 'balanced'): Fighter {
  const multipliers = campMultipliers[focus];
  const overall = getFighterOverall(fighter);
  if (overall >= fighter.potential) return fighter;
  // ponytail: bracket-only local camp tuning; add camp duration only with explicit preparation gameplay.
  const attributes = { ...fighter.attributes };
  for (const [key, multiplier] of Object.entries(multipliers) as [keyof Fighter['attributes'], number][]) {
    const before = attributes[key];
    attributes[key] = Math.min(95, before * multiplier);
    if (getFighterOverall({ ...fighter, attributes }) > fighter.potential) attributes[key] = before;
  }
  return { ...fighter, attributes };
}

function applyPreFightModifiers(fighter: Fighter) {
  let mod = 1.0;
  
  // Age modifier: mitigated by fight IQ (since attributes already degrade with age, pre-fight penalty should be minor)
  const agePen = 0.015 * (1 - Math.max(0, (fighter.attributes.fightIq - 50) / 100));
  if (fighter.age > 33) mod *= (1 - agePen);
  if (fighter.age > 35) mod *= (1 - agePen);
  if (fighter.age > 37) mod *= (1 - agePen);
  if (fighter.age < 25) mod *= 1.005;
  if (fighter.age < 23) mod *= 1.005;

  // Morale modifier
  if (fighter.morale < 40) mod *= 0.95;
  if (fighter.morale > 80) mod *= 1.05;

  // Momentum
  if (fighter.momentum > 80) mod *= 1.05;
  if (fighter.momentum < 20) mod *= 0.95;

  // Injury
  if (fighter.injuryStatus) mod *= 0.85; // Injured fighters suffer 15% penalty

  return mod;
}

export function simulateFight(matchup: FightMatchup, red: Fighter, blue: Fighter, seed?: number): FightResult {
  const campFocus = matchup.campFocus ?? 'balanced';
  red = applyCamp(red, campFocus);
  blue = applyCamp(blue, campFocus);
  const rounds = matchup.rounds;
  const commentary: string[] = [];
  
  // Optional seeded RNG for deterministic tests
  let currentSeed = seed ?? Math.random();
  const rng = () => {
    if (seed !== undefined) {
      currentSeed = (currentSeed * 9301 + 49297) % 233280;
      return currentSeed / 233280;
    }
    return Math.random();
  };

  const randomFloat = (min: number, max: number) => rng() * (max - min) + min;
  const randomInt = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;

  let r1Mod = applyPreFightModifiers(red) * getPhysicalFightModifier(red, blue);
  let r2Mod = applyPreFightModifiers(blue) * getPhysicalFightModifier(blue, red);
  
  // Gameplan and good night/bad night variance
  r1Mod *= randomFloat(0.95, 1.05);
  r2Mod *= randomFloat(0.95, 1.05);

  const redOverall = getFighterOverall(red);
  const blueOverall = getFighterOverall(blue);
  const overallGap = Math.abs(redOverall - blueOverall);
  const r1IsFavorite = redOverall >= blueOverall;

  // Bad night chance modifier for favorites: overconfidence, low morale, high fatigue
  const calcBadNightShift = (fighter: Fighter, isFav: boolean) => {
    let shift = 0;
    if (!isFav) return shift;
    if (fighter.morale < 50) shift += 5; // bad night 18% -> ~23%
    if (fighter.fatigue > 30) shift += 3;
    if (fighter.momentum > 85) shift += 3; // overconfidence
    return shift;
  };
  const r1BadShift = calcBadNightShift(red, r1IsFavorite);
  const r2BadShift = calcBadNightShift(blue, !r1IsFavorite);

  // Reduced variance night rolls (was 10/10/20/20/40 -> now 8/8/18/18/48)
  const r1Roll = randomFloat(0, 100);
  if (r1Roll < 8) r1Mod *= randomFloat(1.15, 1.30); // Fight of their life
  else if (r1Roll < 16) r1Mod *= randomFloat(0.65, 0.80); // Completely flat
  else if (r1Roll < 34 - r1BadShift) r1Mod *= randomFloat(1.05, 1.15); // Good night
  else if (r1Roll < 52 + r1BadShift) r1Mod *= randomFloat(0.82, 0.95); // Bad night
  
  const r2Roll = randomFloat(0, 100);
  if (r2Roll < 8) r2Mod *= randomFloat(1.15, 1.30);
  else if (r2Roll < 16) r2Mod *= randomFloat(0.65, 0.80);
  else if (r2Roll < 34 - r2BadShift) r2Mod *= randomFloat(1.05, 1.15);
  else if (r2Roll < 52 + r2BadShift) r2Mod *= randomFloat(0.82, 0.95);

  // Upset mechanics for massive mismatches (Top Contender vs Journeyman)
  if (overallGap > 14) {
    const underdogIsRed = redOverall < blueOverall;
    // Rare event (23.5% chance): Underdog zones in, Favorite is completely flat
    if (randomFloat(0, 100) < 23.5) {
      if (underdogIsRed) {
        r1Mod *= randomFloat(1.20, 1.35);
        r2Mod *= randomFloat(0.55, 0.70);
      } else {
        r2Mod *= randomFloat(1.20, 1.35);
        r1Mod *= randomFloat(0.55, 0.70);
      }
    }
  }

  // Journeyman grit: underdog with high toughness/IQ fights above their level
  if (overallGap > 7) {
    const underdogIsRed = redOverall < blueOverall;
    const underdog = underdogIsRed ? red : blue;
    const gritBonus = ((underdog.attributes.toughness - 50) / 350) + ((underdog.attributes.fightIq - 50) / 350);
    if (underdogIsRed) r1Mod += Math.max(0, gritBonus);
    else r2Mod += Math.max(0, gritBonus);
  }
  
  const r1StyleMod = getStyleModifier(red.style, blue.style);
  const r2StyleMod = getStyleModifier(blue.style, red.style);

  const weightCutCardio = (fighter: Fighter) => Math.max(0.9, 1 - Math.max(0, getWeightCutPercent(fighter) - 8) * 0.006);
  let state: SimState = {
    r1Cardio: (50 + (red.attributes.cardio / 2)) * weightCutCardio(red),
    r2Cardio: (50 + (blue.attributes.cardio / 2)) * weightCutCardio(blue),
    r1Damage: 0,
    r2Damage: 0,
    r1HeadDmg: 0,
    r2HeadDmg: 0,
    r1BodyDmg: 0,
    r2BodyDmg: 0,
    r1LegDmg: 0,
    r2LegDmg: 0,
    r1CutSeverity: 0,
    r2CutSeverity: 0,
  };

  // Glass chin survival instinct: fighters with very low chin but high defense/IQ adopt defensive style
  let r1GlassChinDefStyle = false;
  let r2GlassChinDefStyle = false;
  if (red.attributes.chin < 30 && (red.attributes.defense > 70 || red.attributes.fightIq > 70)) {
    r1GlassChinDefStyle = true;
  }
  if (blue.attributes.chin < 30 && (blue.attributes.defense > 70 || blue.attributes.fightIq > 70)) {
    r2GlassChinDefStyle = true;
  }

  let winnerId: string | null = null;
  let loserId: string | null = null;
  let method: FightResult['method'] = 'Unanimous Decision';
  let stopTime = '5:00';
  let stopRound = rounds;
  
  let totalKnockdowns = 0;
  let totalSubAttempts = 0;

  // Scorecards for 3 judges: round by round for red (e.g. 10, 9)
  const scorecards = [
    { red: 0, blue: 0 },
    { red: 0, blue: 0 },
    { red: 0, blue: 0 },
  ];

  const allRoundStats: RoundStats[] = [];

  for (let r = 1; r <= rounds; r++) {
    commentary.push(`--- Round ${r} begins ---`);
    
    let r1RoundControl = 0;
    let r2RoundControl = 0;
    let r1RoundStrikes = 0;
    let r2RoundStrikes = 0;
    let r1Knockdowns = 0;
    let r2Knockdowns = 0;
    let r1SubAttempts = 0;
    let r2SubAttempts = 0;

    const r1Stats: FighterRoundStats = {
      totalStrikesAttempted: 0, totalStrikesLanded: 0,
      significantStrikesAttempted: 0, significantStrikesLanded: 0,
      headStrikesLanded: 0, bodyStrikesLanded: 0, legStrikesLanded: 0,
      takedownsAttempted: 0, takedownsLanded: 0,
      submissionAttempts: 0, reversals: 0, knockdowns: 0, controlSeconds: 0,
      damageGiven: 0, damageTaken: 0, staminaStart: state.r1Cardio, staminaEnd: state.r1Cardio
    };
    
    const r2Stats: FighterRoundStats = {
      totalStrikesAttempted: 0, totalStrikesLanded: 0,
      significantStrikesAttempted: 0, significantStrikesLanded: 0,
      headStrikesLanded: 0, bodyStrikesLanded: 0, legStrikesLanded: 0,
      takedownsAttempted: 0, takedownsLanded: 0,
      submissionAttempts: 0, reversals: 0, knockdowns: 0, controlSeconds: 0,
      damageGiven: 0, damageTaken: 0, staminaStart: state.r2Cardio, staminaEnd: state.r2Cardio
    };

    const roundKeyMoments: string[] = [];

    let isStanding = true;
    let topPosition: string | null = null;
    let roundEndedEarly = false;
    
    let r1Explosion = 1.0;
    let r2Explosion = 1.0;
    
    if (red.attributes.power > 75 && red.attributes.power > red.attributes.cardio + 10) {
      if (r === 1) r1Explosion = red.attributes.power > red.attributes.cardio + 25 ? 1.4 : 1.25;
      else if (r === 2) r1Explosion = red.attributes.power > red.attributes.cardio + 25 ? 1.15 : 1.10;
      else r1Explosion = 0.88; // Slightly softer decay in round 3+
    }
    if (blue.attributes.power > 75 && blue.attributes.power > blue.attributes.cardio + 10) {
      if (r === 1) r2Explosion = blue.attributes.power > blue.attributes.cardio + 25 ? 1.4 : 1.25;
      else if (r === 2) r2Explosion = blue.attributes.power > blue.attributes.cardio + 25 ? 1.15 : 1.10;
      else r2Explosion = 0.88;
    }

    const r1IqMod = 1 + ((red.attributes.fightIq - 50) / 300); // 100 IQ = 1.16
    const r2IqMod = 1 + ((blue.attributes.fightIq - 50) / 300);
    const r1ToughnessMod = 1 + ((red.attributes.toughness - 50) / 300); // 100 Toughness = 1.16
    const r2ToughnessMod = 1 + ((blue.attributes.toughness - 50) / 300);
    
    // Effective speed: fight IQ helps slow but smart fighters anticipate and offset speed deficit
    const getEffectiveSpeed = (speed: number, fightIq: number) => {
      return speed + Math.max(0, (fightIq - speed) * 0.4);
    };
    const r1EffSpeed = getEffectiveSpeed(red.attributes.speed, red.attributes.fightIq);
    const r2EffSpeed = getEffectiveSpeed(blue.attributes.speed, blue.attributes.fightIq);
    const r1SpeedMod = 1 + ((r1EffSpeed - 50) / 200);
    const r2SpeedMod = 1 + ((r2EffSpeed - 50) / 200);

    // Simulate in 1-minute chunks (5 per round)
    for (let minute = 1; minute <= 5; minute++) {
      
      const r1FatiguePen = Math.max(0.3, state.r1Cardio / 100);
      const r2FatiguePen = Math.max(0.3, state.r2Cardio / 100);

      if (isStanding) {
        // Striking exchange
        // Glass chin survival instinct: reduce offense and incoming damage by 10% each
        const r1GlassMod = r1GlassChinDefStyle ? 0.90 : 1.0;
        const r2GlassMod = r2GlassChinDefStyle ? 0.90 : 1.0;
        const r1GlassDefBonus = r1GlassChinDefStyle ? 1.10 : 1.0;
        const r2GlassDefBonus = r2GlassChinDefStyle ? 1.10 : 1.0;
        
        const r1IqDefBonus = 1 + Math.max(0, (red.attributes.fightIq - 50) / 250);
        const r2IqDefBonus = 1 + Math.max(0, (blue.attributes.fightIq - 50) / 250);

        const r1Offense = red.attributes.striking * r1FatiguePen * r1Mod * r1StyleMod * r1IqMod * r1SpeedMod * r1Explosion * r1GlassMod;
        const r2Offense = blue.attributes.striking * r2FatiguePen * r2Mod * r2StyleMod * r2IqMod * r2SpeedMod * r2Explosion * r2GlassMod;
        const r1Defense = red.attributes.defense * r1FatiguePen * r1Mod * r1StyleMod * r1IqMod * r1SpeedMod * r1GlassDefBonus * r1IqDefBonus;
        const r2Defense = blue.attributes.defense * r2FatiguePen * r2Mod * r2StyleMod * r2IqMod * r2SpeedMod * r2GlassDefBonus * r2IqDefBonus;
        
        const r1Roll = r1Offense * randomFloat(0.35, 1.65) - r2Defense * randomFloat(0.45, 1.35);
        const r2Roll = r2Offense * randomFloat(0.35, 1.65) - r1Defense * randomFloat(0.45, 1.35);

        let diff = r1Roll - r2Roll;
        let r1Lucky = false;
        let r2Lucky = false;
        
        // Lucky shot: underdog gets slightly higher ceiling (4.5%), favorite capped lower (3.5%)
        const calcLuckyChance = (atk: Fighter, def: Fighter, atkFatiguePen: number, isUnderdog: boolean) => {
          let chance = 0.5; // Base tiny chance
          chance += (atk.attributes.power - 50) / 15;
          chance += (atk.attributes.striking - 50) / 20;
          chance += (atk.attributes.speed - 50) / 25;
          chance -= (def.attributes.defense - 50) / 10;
          chance -= (def.attributes.chin - 50) / 10;
          chance *= atkFatiguePen; 
          chance += (r * 0.15); // slightly higher in later rounds due to sloppy defense
          const cap = isUnderdog ? 4.5 : 3.5;
          return Math.max(0.1, Math.min(cap, chance));
        };

        const r1IsUnderdog = redOverall < blueOverall;
        const r2IsUnderdog = blueOverall < redOverall;
        
        if (randomFloat(0, 100) < calcLuckyChance(blue, red, r2FatiguePen, r2IsUnderdog)) {
          // For underdog lucky shots: 40% chance it's partial (extra damage + knockdown but not full KO sequence)
          if (r2IsUnderdog && randomFloat(0, 100) < 40) {
            diff = -45; r2Lucky = false; // Partial lucky shot - big damage, not full KO trigger
          } else {
            diff = -65; r2Lucky = true;
          }
        } else if (randomFloat(0, 100) < calcLuckyChance(red, blue, r1FatiguePen, r1IsUnderdog)) {
          if (r1IsUnderdog && randomFloat(0, 100) < 40) {
            diff = 45; r1Lucky = false; // Partial lucky shot - big damage, not full KO trigger
          } else {
            diff = 65; r1Lucky = true;
          }
        }

        if (diff > 20) {
          // Red wins exchange clearly
          let pMult = randomFloat(0.5, 1.25);
          if (r1Lucky) pMult = randomFloat(1.6, 2.5);
          const dmg = Math.max(1, (red.attributes.power * r1Explosion * pMult) - (blue.attributes.toughness * r2ToughnessMod * randomFloat(0.1, 0.3)));
          state.r2Damage += dmg;
          const headDmgPercent = randomFloat(0.4, 0.9);
          state.r2HeadDmg += dmg * headDmgPercent;
          
          const strikes = Math.floor(randomFloat(4, 9));
          r1RoundStrikes += strikes;
          r1Stats.totalStrikesAttempted += strikes + randomInt(2, 6);
          r1Stats.totalStrikesLanded += strikes;
          const sigLanded = Math.floor(strikes * 0.8);
          r1Stats.significantStrikesAttempted += sigLanded + randomInt(1, 3);
          r1Stats.significantStrikesLanded += sigLanded;
          const headLanded = Math.floor(sigLanded * headDmgPercent);
          const bodyLanded = Math.floor((sigLanded - headLanded) / 2);
          const legLanded = sigLanded - headLanded - bodyLanded;
          r1Stats.headStrikesLanded += headLanded;
          r1Stats.bodyStrikesLanded += bodyLanded;
          r1Stats.legStrikesLanded += legLanded;
          r1Stats.damageGiven += dmg;
          r2Stats.damageTaken += dmg;
          
          let knockedDown = false;
          if (dmg > (blue.attributes.chin * r2ToughnessMod) * randomFloat(0.6, 0.85) && randomFloat(0, 100) < (25 + (r1Explosion > 1 ? 15 : 0))) {
            r1Knockdowns++;
            r1Stats.knockdowns++;
            roundKeyMoments.push(`Minute ${minute}: ${red.lastName} knocked down ${blue.lastName}`);
            knockedDown = true;
            commentary.push(`OH! ${red.lastName} drops ${blue.lastName} with a huge shot!`);
            isStanding = false;
            topPosition = red.id;
          } else {
             const lines = [
               `${red.lastName} lands a crisp combination.`,
               `${red.lastName} controls the distance and lands clean strikes.`,
               `Good exchange for ${red.lastName}, tagging ${blue.lastName}.`
             ];
             commentary.push(lines[Math.floor(randomFloat(0, lines.length))]);
          }

          // KO/TKO Check
          if (knockedDown || dmg > (blue.attributes.chin * r2ToughnessMod) * randomFloat(1.1, 1.6) || state.r2HeadDmg > (blue.attributes.chin * r2ToughnessMod) * randomFloat(7.0, 10.0)) {
            let koChance = 8 + (r1Explosion > 1 ? 5 : 0);
            if (r1Lucky) koChance += 25;
            if (blue.attributes.chin < 70 && blue.attributes.chin >= 30) koChance += 10;
            if (blue.attributes.chin < 30) koChance += 10; // Reduced from +15 total for glass chin
            
            // Survival checks
            let survivalMod = 0;
            if (blue.attributes.toughness > 75) survivalMod += 12;
            if (blue.attributes.defense > 75) survivalMod += 12;
            if (blue.attributes.fightIq > 75) survivalMod += 8;
            if (blue.attributes.speed > 75) survivalMod += 5;
            survivalMod *= r2FatiguePen; // Cardio/fatigue helps you survive

            koChance = Math.max(3, koChance - survivalMod);
            
            if (randomFloat(0, 100) < koChance) {
              winnerId = red.id; loserId = blue.id; method = 'KO/TKO';
              stopRound = r; stopTime = `${minute}:00`; roundEndedEarly = true;
              commentary.push(`BOOM! A massive strike from ${red.lastName} ends the fight! The referee steps in!`);
              break;
            } else if (isStanding && !knockedDown) {
              commentary.push(`${blue.lastName} is badly hurt on the feet but survives the sequence!`);
              state.r2Damage += 10;
            }
          } else if (state.r2Damage > (150 * r2ToughnessMod) && blue.morale < 30 && randomFloat(0, 100) < 2) {
             winnerId = red.id; loserId = blue.id; method = 'Corner Stoppage';
             stopRound = r; stopTime = `${minute}:00`; roundEndedEarly = true;
             commentary.push(`${blue.lastName}'s corner throws in the towel! The damage is too much!`);
             break;
          }
        } else if (diff < -20) {
          // Blue wins exchange clearly
          let pMult = randomFloat(0.5, 1.25);
          if (r2Lucky) pMult = randomFloat(1.6, 2.5);
          const dmg = Math.max(1, (blue.attributes.power * r2Explosion * pMult) - (red.attributes.toughness * r1ToughnessMod * randomFloat(0.1, 0.3)));
          state.r1Damage += dmg;
          const headDmgPercent = randomFloat(0.4, 0.9);
          state.r1HeadDmg += dmg * headDmgPercent;
          
          const strikes = Math.floor(randomFloat(4, 9));
          r2RoundStrikes += strikes;
          r2Stats.totalStrikesAttempted += strikes + randomInt(2, 6);
          r2Stats.totalStrikesLanded += strikes;
          const sigLanded = Math.floor(strikes * 0.8);
          r2Stats.significantStrikesAttempted += sigLanded + randomInt(1, 3);
          r2Stats.significantStrikesLanded += sigLanded;
          const headLanded = Math.floor(sigLanded * headDmgPercent);
          const bodyLanded = Math.floor((sigLanded - headLanded) / 2);
          const legLanded = sigLanded - headLanded - bodyLanded;
          r2Stats.headStrikesLanded += headLanded;
          r2Stats.bodyStrikesLanded += bodyLanded;
          r2Stats.legStrikesLanded += legLanded;
          r2Stats.damageGiven += dmg;
          r1Stats.damageTaken += dmg;
          
          let knockedDown = false;
          if (dmg > (red.attributes.chin * r1ToughnessMod) * randomFloat(0.6, 0.85) && randomFloat(0, 100) < (25 + (r2Explosion > 1 ? 15 : 0))) {
            r2Knockdowns++;
            r2Stats.knockdowns++;
            roundKeyMoments.push(`Minute ${minute}: ${blue.lastName} knocked down ${red.lastName}`);
            knockedDown = true;
            commentary.push(`OH! ${blue.lastName} drops ${red.lastName} with a massive counter!`);
            isStanding = false;
            topPosition = blue.id;
          } else {
             const lines = [
               `${blue.lastName} lands heavy shots on the feet.`,
               `${blue.lastName} finds a home for the right hand.`,
               `${blue.lastName} dictates the pace in this exchange.`
             ];
             commentary.push(lines[Math.floor(randomFloat(0, lines.length))]);
          }

          // KO/TKO Check
          if (knockedDown || dmg > (red.attributes.chin * r1ToughnessMod) * randomFloat(0.9, 1.4) || state.r1HeadDmg > (red.attributes.chin * r1ToughnessMod) * randomFloat(6.0, 9.0)) {
            let koChance = 10 + (r2Explosion > 1 ? 8 : 0);
            if (r2Lucky) koChance += 25;
            if (red.attributes.chin < 70 && red.attributes.chin >= 30) koChance += 10;
            if (red.attributes.chin < 30) koChance += 10; // Reduced from +15 total for glass chin
            
            // Survival checks
            let survivalMod = 0;
            if (red.attributes.toughness > 75) survivalMod += 10;
            if (red.attributes.defense > 75) survivalMod += 10;
            if (red.attributes.fightIq > 75) survivalMod += 5;
            if (red.attributes.speed > 75) survivalMod += 5;
            survivalMod *= r1FatiguePen;

            koChance = Math.max(5, koChance - survivalMod);
            
            if (randomFloat(0, 100) < koChance) {
              winnerId = blue.id; loserId = red.id; method = 'KO/TKO';
              stopRound = r; stopTime = `${minute}:00`; roundEndedEarly = true;
              commentary.push(`BOOM! A devastating strike from ${blue.lastName} ends the fight! It is all over!`);
              break;
            } else if (isStanding && !knockedDown) {
              commentary.push(`${red.lastName} is on wobbly legs but somehow stays upright!`);
              state.r1Damage += 10;
            }
          } else if (state.r1Damage > (150 * r1ToughnessMod) && red.morale < 30 && randomFloat(0, 100) < 2) {
             winnerId = blue.id; loserId = red.id; method = 'Corner Stoppage';
             stopRound = r; stopTime = `${minute}:00`; roundEndedEarly = true;
             commentary.push(`${red.lastName}'s corner throws in the towel! The damage is too much!`);
             break;
          }
        } else {
          // Competitive exchange
          const r1Str = Math.floor(randomFloat(2, 6));
          const r2Str = Math.floor(randomFloat(2, 6));
          r1RoundStrikes += r1Str;
          r2RoundStrikes += r2Str;
          
          r1Stats.totalStrikesAttempted += r1Str + randomInt(2, 5);
          r1Stats.totalStrikesLanded += r1Str;
          const r1SigLanded = Math.floor(r1Str * 0.6);
          r1Stats.significantStrikesAttempted += r1SigLanded + randomInt(1, 2);
          r1Stats.significantStrikesLanded += r1SigLanded;
          const r1HeadLanded = Math.floor(r1SigLanded * 0.4);
          const r1BodyLanded = Math.floor((r1SigLanded - r1HeadLanded) / 2);
          const r1LegLanded = r1SigLanded - r1HeadLanded - r1BodyLanded;
          r1Stats.headStrikesLanded += r1HeadLanded;
          r1Stats.bodyStrikesLanded += r1BodyLanded;
          r1Stats.legStrikesLanded += r1LegLanded;
          
          r2Stats.totalStrikesAttempted += r2Str + randomInt(2, 5);
          r2Stats.totalStrikesLanded += r2Str;
          const r2SigLanded = Math.floor(r2Str * 0.6);
          r2Stats.significantStrikesAttempted += r2SigLanded + randomInt(1, 2);
          r2Stats.significantStrikesLanded += r2SigLanded;
          const r2HeadLanded = Math.floor(r2SigLanded * 0.4);
          const r2BodyLanded = Math.floor((r2SigLanded - r2HeadLanded) / 2);
          const r2LegLanded = r2SigLanded - r2HeadLanded - r2BodyLanded;
          r2Stats.headStrikesLanded += r2HeadLanded;
          r2Stats.bodyStrikesLanded += r2BodyLanded;
          r2Stats.legStrikesLanded += r2LegLanded;
          
          const r1Dmg = Math.max(0, (blue.attributes.power * r2Explosion * randomFloat(0.1, 0.25)) - (red.attributes.toughness * r1ToughnessMod * 0.25));
          const r2Dmg = Math.max(0, (red.attributes.power * r1Explosion * randomFloat(0.1, 0.25)) - (blue.attributes.toughness * r2ToughnessMod * 0.25));
          
          state.r1Damage += r1Dmg;
          state.r2Damage += r2Dmg;
          
          r2Stats.damageGiven += r1Dmg;
          r1Stats.damageTaken += r1Dmg;
          r1Stats.damageGiven += r2Dmg;
          r2Stats.damageTaken += r2Dmg;
          
          if (minute === 3) commentary.push(`Both fighters trading strikes in the center. Very close action.`);
        }

        // Takedown attempts if still standing
        if (isStanding) {
          // Increased distance control weight for speed (1.5x) to help strikers maintain range
          const r1DistanceControl = (red.attributes.speed * 1.5 + red.attributes.striking + red.attributes.fightIq) / 350;
          const r2DistanceControl = (blue.attributes.speed * 1.5 + blue.attributes.striking + blue.attributes.fightIq) / 350;

          // High distance control gives a TDD multiplier (strikers maintain range better)
          const r1TddDistBonus = r1DistanceControl > 0.7 ? 1.15 : 1.0;
          const r2TddDistBonus = r2DistanceControl > 0.7 ? 1.15 : 1.0;

          const redWrestlingAdv = red.attributes.wrestling - blue.attributes.wrestling;
          const blueWrestlingAdv = blue.attributes.wrestling - red.attributes.wrestling;

          const blueEffWrestling = redWrestlingAdv > 20 ? blue.attributes.wrestling * 0.75 : blue.attributes.wrestling;
          const redEffWrestling = blueWrestlingAdv > 20 ? red.attributes.wrestling * 0.75 : red.attributes.wrestling;

          const r1Td = (red.attributes.wrestling * r1FatiguePen * r1Mod * r1IqMod * r1SpeedMod) * randomFloat(0.7, 1.25);
          const r2Tdd = (blueEffWrestling * r2FatiguePen * r2Mod * r2IqMod * r2SpeedMod * (1 + (r2DistanceControl * 0.3)) * r2TddDistBonus) * randomFloat(0.85, 1.45);
          
          const r2Td = (blue.attributes.wrestling * r2FatiguePen * r2Mod * r2IqMod * r2SpeedMod) * randomFloat(0.7, 1.25);
          const r1Tdd = (redEffWrestling * r1FatiguePen * r1Mod * r1IqMod * r1SpeedMod * (1 + (r1DistanceControl * 0.3)) * r1TddDistBonus) * randomFloat(0.85, 1.45);

          // When a wrestler is behind on damage, reduce takedown urgency slightly
          const redDmgBehind = state.r1Damage > state.r2Damage + 20;
          const blueDmgBehind = state.r2Damage > state.r1Damage + 20;
          const redWantsTd = red.attributes.wrestling > red.attributes.striking + 5 || (state.r1Damage > state.r2Damage && red.attributes.fightIq > 50);
          const blueWantsTd = blue.attributes.wrestling > blue.attributes.striking + 5 || (state.r2Damage > state.r1Damage && blue.attributes.fightIq > 50);
          const redTdUrgency = redDmgBehind && redWantsTd ? 50 : (redWrestlingAdv > 20 ? 80 : 55);
          const blueTdUrgency = blueDmgBehind && blueWantsTd ? 50 : (blueWrestlingAdv > 20 ? 80 : 55);

          if (redWantsTd && r1Td > r2Tdd * 1.05 && randomFloat(0, 100) < redTdUrgency) {
            isStanding = false;
            topPosition = red.id;
            r1Stats.takedownsAttempted++;
            r1Stats.takedownsLanded++;
            roundKeyMoments.push(`Minute ${minute}: Takedown by ${red.lastName}`);
            commentary.push(`${red.lastName} shoots in and secures a beautiful takedown.`);
          } else if (redWantsTd && r1Td <= r2Tdd * 1.05 && randomFloat(0, 100) < 35) {
            r1Stats.takedownsAttempted++;
            if (minute === 4) commentary.push(`${red.lastName} attempts a takedown but ${blue.lastName} defends well with great distance control.`);
          } else if (blueWantsTd && r2Td > r1Tdd * 1.05 && randomFloat(0, 100) < blueTdUrgency) {
            isStanding = false;
            topPosition = blue.id;
            r2Stats.takedownsAttempted++;
            r2Stats.takedownsLanded++;
            roundKeyMoments.push(`Minute ${minute}: Takedown by ${blue.lastName}`);
            commentary.push(`${blue.lastName} ducks under a strike and takes the fight to the mat.`);
          } else if (blueWantsTd && r2Td <= r1Tdd * 1.05 && randomFloat(0, 100) < 35) {
            r2Stats.takedownsAttempted++;
            if (minute === 4) commentary.push(`${blue.lastName} looks for a takedown, but it is stuffed by ${red.lastName}.`);
          }

          // Explosive fighter flash KO check in round 1
          if (r === 1 && isStanding) {
            const r1FlashKo = red.attributes.power > blue.attributes.cardio + 25 && red.attributes.cardio < 40 && red.attributes.power > 75;
            const r2FlashKo = blue.attributes.power > red.attributes.cardio + 25 && blue.attributes.cardio < 40 && blue.attributes.power > 75;
            if (r1FlashKo && randomFloat(0, 100) < 15) {
              // Flash KO attempt
              if (randomFloat(0, 100) < 8) {
                winnerId = red.id; loserId = blue.id; method = 'KO/TKO';
                stopRound = r; stopTime = `${minute}:00`; roundEndedEarly = true;
                commentary.push(`FLASH KO! ${red.lastName} catches ${blue.lastName} with an explosive shot right out of the gate!`);
                break;
              } else {
                // Near-miss: big damage + potential knockdown
                state.r2Damage += red.attributes.power * 0.4;
                state.r2HeadDmg += red.attributes.power * 0.3;
                commentary.push(`${red.lastName} explodes with power early! ${blue.lastName} is rocked!`);
              }
            }
            if (r2FlashKo && randomFloat(0, 100) < 15) {
              if (randomFloat(0, 100) < 8) {
                winnerId = blue.id; loserId = red.id; method = 'KO/TKO';
                stopRound = r; stopTime = `${minute}:00`; roundEndedEarly = true;
                commentary.push(`FLASH KO! ${blue.lastName} catches ${red.lastName} with an explosive shot right out of the gate!`);
                break;
              } else {
                state.r1Damage += blue.attributes.power * 0.4;
                state.r1HeadDmg += blue.attributes.power * 0.3;
                commentary.push(`${blue.lastName} explodes with power early! ${red.lastName} is rocked!`);
              }
            }
          }
        }

      } else {
        // Ground game
        const topFighter = topPosition === red.id ? red : blue;
        const bottomFighter = topPosition === red.id ? blue : red;
        const topFatigue = topPosition === red.id ? r1FatiguePen : r2FatiguePen;
        const botFatigue = topPosition === red.id ? r2FatiguePen : r1FatiguePen;
        const topMod = topPosition === red.id ? r1Mod : r2Mod;
        const botMod = topPosition === red.id ? r2Mod : r1Mod;
        const topIq = topPosition === red.id ? r1IqMod : r2IqMod;
        const botIq = topPosition === red.id ? r2IqMod : r1IqMod;

        if (topPosition === red.id) {
          r1RoundControl += 60;
          r1Stats.controlSeconds += 60;
        } else {
          r2RoundControl += 60;
          r2Stats.controlSeconds += 60;
        }

        // Submissions
        const topSubOffense = topFighter.attributes.submissions * topFatigue * topMod * topIq;
        // Sub defense survival: even with weak sub defense, high speed or toughness provides escape bonus
        const botSubDefSurvival = Math.max(0, ((bottomFighter.attributes.speed > 70 ? (bottomFighter.attributes.speed - 70) / 750 : 0) + (bottomFighter.attributes.toughness > 70 ? (bottomFighter.attributes.toughness - 70) / 750 : 0)));
        const botSubDefense = (bottomFighter.attributes.grappling * 0.7 + bottomFighter.attributes.fightIq * 0.3) * botFatigue * botMod * botIq * (1 + botSubDefSurvival);
        const topSubRoll = topSubOffense * randomFloat(0.5, 1.4) - botSubDefense * randomFloat(0.4, 1.2);
        
        // Sweep/Standup - fighters with weak sub defense get slightly higher standup chance (desperation)
        const botDesperationBonus = bottomFighter.attributes.grappling < 40 ? 1.15 : 1.0;
        const sweepAtt = (bottomFighter.attributes.grappling * botFatigue * botMod * botIq * botDesperationBonus) * randomFloat(0.7, 1.3);
        const topControl = (topFighter.attributes.grappling * topFatigue * topMod * topIq) * randomFloat(0.7, 1.3);

        // BJJ guys on bottom might also attempt subs
        const bottomSubOffense = bottomFighter.attributes.submissions * botFatigue * botMod * botIq;
        const topSubDefense = (topFighter.attributes.grappling * 0.7 + topFighter.attributes.fightIq * 0.3) * topFatigue * topMod * topIq;
        const botSubRoll = bottomSubOffense * randomFloat(0.5, 1.3) - topSubDefense * randomFloat(0.5, 1.2);

        let subThreatened = false;

        if (topSubRoll > 35 && topFighter.attributes.submissions > 55) {
          subThreatened = true;
          if (topPosition === red.id) {
             r1SubAttempts++;
             r1Stats.submissionAttempts++;
          } else {
             r2SubAttempts++;
             r2Stats.submissionAttempts++;
          }
          roundKeyMoments.push(`Minute ${minute}: Submission attempt by ${topFighter.lastName}`);
          
          // Dynamic sub finish chance based on grappling skill gap
          let topFinishProb = 10;
          const topSubDefGap = topFighter.attributes.submissions - bottomFighter.attributes.grappling;
          if (topSubDefGap > 40) {
            topFinishProb += Math.min(12, (topSubDefGap - 40) / 3);
          }
          if (topSubRoll > 65 && randomFloat(0, 100) < topFinishProb) {
            winnerId = topFighter.id; loserId = bottomFighter.id; method = 'Submission';
            stopRound = r; stopTime = `${minute}:00`; roundEndedEarly = true;
            commentary.push(`${topFighter.lastName} locks in a deep submission! ${bottomFighter.lastName} taps out! It is over!`);
            break;
          } else {
            commentary.push(`${topFighter.lastName} threatens with a submission, but ${bottomFighter.lastName} defends and survives.`);
          }
        } else if (botSubRoll > 40 && bottomFighter.attributes.submissions > 55) {
          subThreatened = true;
          if (topPosition === red.id) {
             r2SubAttempts++;
             r2Stats.submissionAttempts++;
          } else {
             r1SubAttempts++;
             r1Stats.submissionAttempts++;
          }
          roundKeyMoments.push(`Minute ${minute}: Submission attempt by ${bottomFighter.lastName}`);
          
          // Dynamic bottom sub finish chance based on grappling skill gap
          let botFinishProb = 6;
          const botSubDefGap = bottomFighter.attributes.submissions - topFighter.attributes.grappling;
          if (botSubDefGap > 40) {
            botFinishProb += Math.min(8, (botSubDefGap - 40) / 4);
          }
          if (botSubRoll > 70 && randomFloat(0, 100) < botFinishProb) {
            winnerId = bottomFighter.id; loserId = topFighter.id; method = 'Submission';
            stopRound = r; stopTime = `${minute}:00`; roundEndedEarly = true;
            commentary.push(`Unbelievable! ${bottomFighter.lastName} catches a submission from the bottom! ${topFighter.lastName} has to tap!`);
            break;
          } else {
            commentary.push(`${bottomFighter.lastName} throws up a submission attempt, but ${topFighter.lastName} defends well.`);
          }
        } 
        
        if (!subThreatened) {
          if (sweepAtt > topControl * 1.25 && randomFloat(0, 100) < 40) {
            isStanding = true;
            topPosition = null;
            if (bottomFighter.id === red.id) r1Stats.reversals++; else r2Stats.reversals++;
            commentary.push(`${bottomFighter.lastName} manages to scramble back to their feet.`);
          } else {
            // Ground and pound
            const gnp = Math.floor(randomFloat(1, 6));
            if (topPosition === red.id) {
              r1RoundStrikes += gnp;
              r1Stats.totalStrikesAttempted += gnp + 1;
              r1Stats.totalStrikesLanded += gnp;
              r1Stats.significantStrikesAttempted += Math.floor(gnp * 0.8) + 1;
              r1Stats.significantStrikesLanded += Math.floor(gnp * 0.8);
              r1Stats.headStrikesLanded += Math.floor(gnp * 0.8);
              const dmg = gnp * (red.attributes.power / 30);
              state.r2Damage += dmg;
              state.r2HeadDmg += dmg * 0.8;
              r1Stats.damageGiven += dmg;
              r2Stats.damageTaken += dmg;
              if (gnp > 4 && minute % 2 === 0) commentary.push(`${red.lastName} is landing ground and pound!`);
            } else {
              r2RoundStrikes += gnp;
              r2Stats.totalStrikesAttempted += gnp + 1;
              r2Stats.totalStrikesLanded += gnp;
              r2Stats.significantStrikesAttempted += Math.floor(gnp * 0.8) + 1;
              r2Stats.significantStrikesLanded += Math.floor(gnp * 0.8);
              r2Stats.headStrikesLanded += Math.floor(gnp * 0.8);
              const dmg = gnp * (blue.attributes.power / 30);
              state.r1Damage += dmg;
              state.r1HeadDmg += dmg * 0.8;
              r2Stats.damageGiven += dmg;
              r1Stats.damageTaken += dmg;
              if (gnp > 4 && minute % 2 === 0) commentary.push(`${blue.lastName} is landing ground and pound from top position!`);
            }

            // Check Doctor Stoppage / Ref stoppage on ground
            if (topPosition === red.id && state.r2HeadDmg > (blue.attributes.chin * r2ToughnessMod) * randomFloat(3.5, 5.0) && randomFloat(0, 100) < 10) {
               winnerId = red.id; loserId = blue.id; method = 'KO/TKO';
               stopRound = r; stopTime = `${minute}:00`; roundEndedEarly = true;
               commentary.push(`The referee has seen enough! ${red.lastName} wins by TKO via ground and pound!`);
               break;
            } else if (topPosition === blue.id && state.r1HeadDmg > (red.attributes.chin * r1ToughnessMod) * randomFloat(3.5, 5.0) && randomFloat(0, 100) < 10) {
               winnerId = blue.id; loserId = red.id; method = 'KO/TKO';
               stopRound = r; stopTime = `${minute}:00`; roundEndedEarly = true;
               commentary.push(`The referee steps in! ${blue.lastName} finishes it with brutal ground strikes!`);
               break;
            }
          }
        }
      }
      
      // Cardio drain: lower cardio attribute = more drain. FightIQ mitigates age drain.
      const r1IqMitigation = Math.max(0, (red.attributes.fightIq - 50) / 100);
      const r1AgeDrain = Math.max(0.6, 1 + (red.age > 33 ? (red.age - 33) * 0.04 : 0) - r1IqMitigation);
      const r2IqMitigation = Math.max(0, (blue.attributes.fightIq - 50) / 100);
      const r2AgeDrain = Math.max(0.6, 1 + (blue.age > 33 ? (blue.age - 33) * 0.04 : 0) - r2IqMitigation);
      
      const r1BaseDrain = randomFloat(1, 4) * (150 - red.attributes.cardio) / 50;
      const r2BaseDrain = randomFloat(1, 4) * (150 - blue.attributes.cardio) / 50;
      
      // Fight IQ pacing/breathing reduces overall drain
      const r1Drain = r1BaseDrain * r1AgeDrain * (1 - Math.max(0, (red.attributes.fightIq - 50) / 150));
      const r2Drain = r2BaseDrain * r2AgeDrain * (1 - Math.max(0, (blue.attributes.fightIq - 50) / 150));
      
      state.r1Cardio = Math.max(5, state.r1Cardio - r1Drain);
      state.r2Cardio = Math.max(5, state.r2Cardio - r2Drain);
    }

    // Recovery between rounds (calculate beforehand so we can use for staminaEnd if we want, but actually we should just capture staminaEnd before recovery)
    r1Stats.staminaEnd = state.r1Cardio;
    r2Stats.staminaEnd = state.r2Cardio;

    // Score the round for each judge (10-point must system)
    let r1Overall = (r1RoundStrikes * 1.0) + (r1RoundControl * 0.05) + (r1Knockdowns * 20) + (r1SubAttempts * 12) + (red.attributes.fightIq * 0.08) + 10;
    let r2Overall = (r2RoundStrikes * 1.0) + (r2RoundControl * 0.05) + (r2Knockdowns * 20) + (r2SubAttempts * 12) + (blue.attributes.fightIq * 0.08) + 10;

    // Compress scoring differential in mismatches to reduce 10-8 rate
    // In real MMA, even dominant rounds usually have the loser landing some offense
    const scoreDiff = Math.abs(r1Overall - r2Overall);
    if (scoreDiff > 30) {
      const compression = 0.7; // Compress the gap
      const midpoint = (r1Overall + r2Overall) / 2;
      r1Overall = midpoint + (r1Overall - midpoint) * compression;
      r2Overall = midpoint + (r2Overall - midpoint) * compression;
    }

    const judgesRoundScores: JudgeRoundScore[] = [];

    for (let j = 0; j < 3; j++) {
       let j1 = r1Overall * randomFloat(0.85, 1.15);
       let j2 = r2Overall * randomFloat(0.85, 1.15);
       
       let redR = 10, blueR = 10;
       let reason: JudgeRoundScore['reason'] = 'close-round';
       
       // Bad judging in close rounds
       if (Math.abs(j1 - j2) < 3.0) {
          const closeRoll = randomFloat(0, 100);
          if (closeRoll < 70) {
            // 70%: give it to the actual winner (slight favor to more strikes)
            if (r1RoundStrikes >= r2RoundStrikes) j1 += 3.1; else j2 += 3.1;
          } else if (closeRoll < 95) {
            // 25%: bad judging - give it to the other fighter
            if (r1RoundStrikes >= r2RoundStrikes) j2 += 3.1; else j1 += 3.1;
          }
          // 5%: leave as 10-10 (no adjustment, contributes to draws slightly)
       }
       
       // strict 10-8 criteria helper - tightened thresholds
       const is10_8 = (kdFor: number, kdAgainst: number, dmgFor: number, dmgAgainst: number, ctrlFor: number, sigFor: number, sigAgainst: number, subFor: number) => {
          // If opponent had meaningful offense, force 10-9 unless multiple knockdowns
          if (sigAgainst >= 4 && kdFor - kdAgainst < 2) return false;
          if (dmgAgainst >= 25 && kdFor - kdAgainst < 2) return false;
          // If no knockdowns and no near-finish level stats, never 10-8
          if (kdFor === 0 && dmgFor < 250 && subFor < 3) return false;

          // 2+ knockdowns in the current round
          if (kdFor - kdAgainst >= 2) return true;

          // 1 knockdown + huge current-round damage gap + opponent did virtually nothing
          if (kdFor > kdAgainst && dmgFor > dmgAgainst * 7.0 && (dmgFor > 200) && sigAgainst <= 2) return true;

          // huge damage gap + opponent landed almost nothing
          if (dmgFor > dmgAgainst * 12.0 && dmgFor > 400 && sigAgainst <= 2 && dmgAgainst <= 10 && sigFor > 25) return true;

          // extreme control + real damage/submission threat + opponent had very low offense
          if (ctrlFor > 280 && (dmgFor > 250 || subFor >= 4) && sigAgainst <= 1 && dmgAgainst <= 5) return true;

          return false;
       };

       if (j1 > j2) {
          blueR = 9;
          if (is10_8(r1Knockdowns, r2Knockdowns, r1Stats.damageGiven, r2Stats.damageGiven, r1RoundControl, r1Stats.significantStrikesLanded, r2Stats.significantStrikesLanded, r1SubAttempts)) {
             blueR = 8;
          }
          reason = r1Knockdowns > r2Knockdowns ? 'knockdown' : (r1RoundControl > 180 ? 'control' : (r1SubAttempts > 0 ? 'submission-threat' : (j1 > j2 * 1.5 ? 'damage' : 'close-round')));
       } else if (j2 > j1) {
          redR = 9;
          if (is10_8(r2Knockdowns, r1Knockdowns, r2Stats.damageGiven, r1Stats.damageGiven, r2RoundControl, r2Stats.significantStrikesLanded, r1Stats.significantStrikesLanded, r2SubAttempts)) {
             redR = 8;
          }
          reason = r2Knockdowns > r1Knockdowns ? 'knockdown' : (r2RoundControl > 180 ? 'control' : (r2SubAttempts > 0 ? 'submission-threat' : (j2 > j1 * 1.5 ? 'damage' : 'close-round')));
       }
       
       judgesRoundScores.push({ judgeId: `Judge ${j+1}`, redScore: redR as any, blueScore: blueR as any, reason });
       
       scorecards[j].red += redR;
       scorecards[j].blue += blueR;
    }

    let likelyWinner = "Close round";
    let dominanceLevel: 'close' | 'clear' | 'dominant' | 'near_finish' = 'close';
    
    if (r1Knockdowns > 0 || r2Knockdowns > 0) {
      dominanceLevel = 'near_finish';
    } else if (r1Overall > r2Overall * 2.5 || r2Overall > r1Overall * 2.5) {
      dominanceLevel = 'dominant';
    } else if (r1Overall > r2Overall * 1.4 || r2Overall > r1Overall * 1.4) {
      dominanceLevel = 'clear';
    }

    if (r1Overall > r2Overall * 1.4) likelyWinner = `Clear round for ${red.lastName}`;
    else if (r2Overall > r1Overall * 1.4) likelyWinner = `Clear round for ${blue.lastName}`;
    else if (r1Overall > r2Overall) likelyWinner = `Edged by ${red.lastName}`;
    else if (r2Overall > r1Overall) likelyWinner = `Edged by ${blue.lastName}`;

    allRoundStats.push({
      round: r,
      red: r1Stats,
      blue: r2Stats,
      judges: judgesRoundScores,
      redTechnicalScore: Math.floor(r1Overall),
      blueTechnicalScore: Math.floor(r2Overall),
      summary: likelyWinner,
      keyMoments: roundKeyMoments,
      dominanceLevel
    });

    if (!roundEndedEarly) {
      commentary.push(`End of Round ${r}. ${likelyWinner}.`);
    }

    totalKnockdowns += r1Knockdowns + r2Knockdowns;
    totalSubAttempts += r1SubAttempts + r2SubAttempts;

    if (roundEndedEarly) break;

    // Recovery between rounds: flatter scale to help low-cardio fighters pace themselves and survive
    state.r1Cardio = Math.min(100, state.r1Cardio + randomFloat(10, 20) * (0.5 + red.attributes.cardio / 100));
    state.r2Cardio = Math.min(100, state.r2Cardio + randomFloat(10, 20) * (0.5 + blue.attributes.cardio / 100));

    // Cut accumulation mechanic: track severity based on head damage sustained this round
    const r1HeadDmgThisRound = state.r1HeadDmg - (r > 1 ? (allRoundStats.slice(0, -1).reduce((acc, rs) => acc + rs.red.damageTaken * 0.6, 0)) : 0);
    const r2HeadDmgThisRound = state.r2HeadDmg - (r > 1 ? (allRoundStats.slice(0, -1).reduce((acc, rs) => acc + rs.blue.damageTaken * 0.6, 0)) : 0);
    if (r1HeadDmgThisRound > 30) {
      state.r1CutSeverity += (r1HeadDmgThisRound / Math.max(20, red.attributes.chin)) * randomFloat(5, 25);
    }
    if (r2HeadDmgThisRound > 30) {
      state.r2CutSeverity += (r2HeadDmgThisRound / Math.max(20, blue.attributes.chin)) * randomFloat(5, 25);
    }

    // Evaluate injuries (Cuts / Doctor Stoppage) between rounds
    // Cut severity-based doctor stoppage (5-10% when severity is high enough)
    if (state.r1CutSeverity > 60) {
       const cutStopChance = 5 + (state.r1CutSeverity - 60) * 0.125; // 5-10% range
       if (randomFloat(0, 100) < cutStopChance) {
         winnerId = blue.id; loserId = red.id; method = 'Doctor Stoppage';
         stopRound = r; stopTime = '5:00'; roundEndedEarly = true;
         commentary.push(`The doctor is checking a massive cut on ${red.lastName}... and he waves it off! Fight is over!`);
         break;
       }
    }
    if (state.r2CutSeverity > 60) {
       const cutStopChance = 5 + (state.r2CutSeverity - 60) * 0.125;
       if (randomFloat(0, 100) < cutStopChance) {
         winnerId = red.id; loserId = blue.id; method = 'Doctor Stoppage';
         stopRound = r; stopTime = '5:00'; roundEndedEarly = true;
         commentary.push(`The cageside doctor inspects ${blue.lastName}'s eye and stops the fight! What a bloody war.`);
         break;
       }
    }
    // Legacy massive-damage doctor stoppage (kept but extremely rare)
    if (state.r1HeadDmg > 150 && randomFloat(0, 100) < 0.8) {
       winnerId = blue.id; loserId = red.id; method = 'Doctor Stoppage';
       stopRound = r; stopTime = '5:00'; roundEndedEarly = true;
       commentary.push(`The doctor stops the fight due to severe damage to ${red.lastName}!`);
       break;
    }
    if (state.r2HeadDmg > 150 && randomFloat(0, 100) < 0.8) {
       winnerId = red.id; loserId = blue.id; method = 'Doctor Stoppage';
       stopRound = r; stopTime = '5:00'; roundEndedEarly = true;
       commentary.push(`The doctor stops the fight due to severe damage to ${blue.lastName}!`);
       break;
    }
  }

  if (!winnerId) {
    let redWins = 0;
    let blueWins = 0;
    let draws = 0;

    const finalScores: string[] = [];

    scorecards.forEach(card => {
       // Break ties on individual scorecards to reduce draws (keep ~1-3% of them)
       if (card.red === card.blue && randomFloat(0, 100) > 40) {
          if (state.r2Damage > state.r1Damage + 10) card.red += 1; 
          else if (state.r1Damage > state.r2Damage + 10) card.blue += 1;
          else { if (randomFloat(0, 1) > 0.5) card.red += 1; else card.blue += 1; }
       }
       
       finalScores.push(`${card.red}-${card.blue}`);
       if (card.red > card.blue) redWins++;
       else if (card.blue > card.red) blueWins++;
       else draws++;
    });

    if (redWins >= 2) { 
      winnerId = red.id; 
      loserId = blue.id; 
      method = (redWins === 3) ? 'Unanimous Decision' : (draws === 1 ? 'Majority Decision' : 'Split Decision'); 
    }
    else if (blueWins >= 2) { 
      winnerId = blue.id; 
      loserId = red.id; 
      method = (blueWins === 3) ? 'Unanimous Decision' : (draws === 1 ? 'Majority Decision' : 'Split Decision'); 
    }
    else { method = 'Draw'; }

    stopRound = rounds;
    stopTime = '5:00';
    commentary.push(`We go to the judges' scorecards...`);
    commentary.push(`The judges score the contest: ${finalScores.join(', ')}...`);
    if (method === 'Draw') {
      commentary.push(`We have a ${draws === 3 ? 'Unanimous' : draws === 2 ? 'Majority' : 'Split'} Draw!`);
    } else {
      commentary.push(`The winner by ${method} is ${winnerId === red.id ? red.lastName : blue.lastName}!`);
    }
  }

  let excitement = 30; // lower base excitement
  
  // Action based
  const totalDamage = state.r1Damage + state.r2Damage;
  const damageDiff = Math.abs(state.r1Damage - state.r2Damage);
  
  excitement += Math.min(30, totalDamage / 8);
  
  // Penalize slow, one-sided fights
  if (damageDiff > 60 && totalDamage < 120) excitement -= 20;
  if (totalDamage < 60 && totalKnockdowns === 0 && totalSubAttempts === 0) excitement -= 25;
  if (method.includes('Decision') && totalDamage < 100) excitement -= 15;
  if (damageDiff > 80 && totalKnockdowns === 0) excitement -= 25; // Squash match with no real drama
  
  // Penalize grappling control heavy decisions
  if (method.includes('Decision') && totalDamage < 130 && totalKnockdowns === 0 && totalSubAttempts < 3) excitement -= 25;

  // Highlights
  excitement += (totalKnockdowns * 15);
  // Only reward sub attempts heavily if it wasn't a boring decision
  if (!(method.includes('Decision') && totalDamage < 100)) {
     excitement += (totalSubAttempts * 6);
  } else {
     excitement += (totalSubAttempts * 2);
  }

  // Finishes
  if (method === 'KO/TKO') excitement += (stopRound === 1 ? 30 : 20);
  else if (method === 'Submission') excitement += (stopRound === 1 ? 25 : 15);
  
  // Comeback factor
  if (method === 'KO/TKO' || method === 'Submission') {
      const loserDamage = loserId === red.id ? state.r1Damage : state.r2Damage;
      const winnerDamage = winnerId === red.id ? state.r1Damage : state.r2Damage;
      if (winnerDamage > loserDamage + 30) excitement += 25; // Huge comeback
  }

  const performanceRating = Math.max(10, Math.min(100, Math.floor(excitement)));

  // Determine potential injuries resulting from the fight
  const injuries: { fighterId: string; type: string; daysRemaining: number }[] = [];
  const injuryChance = campFocus === 'recovery' ? 25.5 : 30;
  if (state.r1Damage > 60 && randomFloat(0, 100) < injuryChance) {
     injuries.push({ fighterId: red.id, type: 'Laceration', daysRemaining: randomInt(30, 90) });
  } else if (state.r1HeadDmg > 50 && method === 'KO/TKO' && loserId === red.id) {
     injuries.push({ fighterId: red.id, type: 'Concussion', daysRemaining: randomInt(60, 120) });
  }

  if (state.r2Damage > 60 && randomFloat(0, 100) < injuryChance) {
     injuries.push({ fighterId: blue.id, type: 'Laceration', daysRemaining: randomInt(30, 90) });
  } else if (state.r2HeadDmg > 50 && method === 'KO/TKO' && loserId === blue.id) {
     injuries.push({ fighterId: blue.id, type: 'Concussion', daysRemaining: randomInt(60, 120) });
  }

  // Calculate Deltas
  const popularityDelta: Record<string, number> = { [red.id]: 0, [blue.id]: 0 };
  const moraleDelta: Record<string, number> = { [red.id]: 0, [blue.id]: 0 };
  const momentumDelta: Record<string, number> = { [red.id]: 0, [blue.id]: 0 };

  if (winnerId && loserId) {
     // Winner gains
     popularityDelta[winnerId] = Math.floor(randomFloat(1, 4) + (performanceRating / 20));
     moraleDelta[winnerId] = randomInt(10, 20);
     momentumDelta[winnerId] = randomInt(10, 25);
     
     // Loser loses
     popularityDelta[loserId] = -Math.floor(randomFloat(0, 2));
     moraleDelta[loserId] = -randomInt(10, 25);
     momentumDelta[loserId] = -randomInt(20, 40);

     // Upset bonus
     const winnerPop = winnerId === red.id ? red.popularity : blue.popularity;
     const loserPop = loserId === red.id ? red.popularity : blue.popularity;
     if (loserPop - winnerPop > 10) {
        popularityDelta[winnerId] += Math.floor((loserPop - winnerPop) / 5);
     }
  }

  // Validation
  if (allRoundStats.length > 0) {
    const statErrors = validateRoundStats(allRoundStats);
    if (statErrors.length > 0) {
      console.warn('Simulated fight has invalid round stats:', statErrors);
    }
  }
  
  // Medical Suspensions
  const medicalSuspensions: import('../../types/game').MedicalSuspension[] = [];
  const getSuspensionSeverity = (days: number): 'minor' | 'moderate' | 'severe' => {
     if (days > 45) return 'severe';
     if (days >= 21) return 'moderate';
     return 'minor';
  };
  
  const createSuspension = (fighterId: string, days: number, reason: any) => {
     medicalSuspensions.push({
        id: crypto.randomUUID ? crypto.randomUUID() : (Math.random() + '').slice(2),
        fighterId,
        reason,
        daysRemaining: days,
        sourceFightId: matchup.id,
        severity: getSuspensionSeverity(days)
     });
  };

  // Evaluate both fighters
  [red, blue].forEach(fighter => {
     const isWinner = winnerId === fighter.id;
     const isLoser = loserId === fighter.id;
     const dmgTaken = fighter.id === red.id ? state.r1Damage : state.r2Damage;
     const isKO = isLoser && method === 'KO/TKO';
     const isDoc = isLoser && method === 'Doctor Stoppage';
     const isSub = isLoser && method === 'Submission';
     
     if (isKO) {
        createSuspension(fighter.id, randomInt(45, 90), 'knockout');
     } else if (isDoc) {
        createSuspension(fighter.id, randomInt(45, 90), 'doctor_stoppage');
     } else if (dmgTaken > 150 || (matchup.rounds === 5 && dmgTaken > 100)) {
        createSuspension(fighter.id, randomInt(isWinner ? 21 : 30, isWinner ? 45 : 60), 'hard_fight');
     } else if (isSub && dmgTaken > 50) {
        createSuspension(fighter.id, randomInt(14, 28), 'submission_damage');
     } else if (isLoser) {
        createSuspension(fighter.id, randomInt(7, 14), 'commission_review');
     } else if (isWinner && dmgTaken > 50) {
        createSuspension(fighter.id, randomInt(7, 14), 'commission_review');
     }
  });

  return {
    winnerId,
    loserId,
    method,
    round: stopRound,
    time: stopTime,
    commentary,
    performanceRating,
    scorecards: method.includes('Decision') || method === 'Draw' ? scorecards.map(c => `${c.red}-${c.blue}`) : [],
    roundStats: allRoundStats,
    injuries,
    medicalSuspensions,
    popularityDelta,
    moraleDelta,
    momentumDelta
  };
}

export function validateRoundStats(roundStats: RoundStats[]): string[] {
  const errors: string[] = [];
  roundStats.forEach(rs => {
    [rs.red, rs.blue].forEach((stats, idx) => {
      const corner = idx === 0 ? 'Red' : 'Blue';
      if (stats.totalStrikesLanded > stats.totalStrikesAttempted) errors.push(`Round ${rs.round} ${corner}: totalLanded (${stats.totalStrikesLanded}) > totalAttempted (${stats.totalStrikesAttempted})`);
      if (stats.significantStrikesLanded > stats.significantStrikesAttempted) errors.push(`Round ${rs.round} ${corner}: sigLanded (${stats.significantStrikesLanded}) > sigAttempted (${stats.significantStrikesAttempted})`);
      if (stats.headStrikesLanded < 0) errors.push(`Round ${rs.round} ${corner}: headStrikes < 0`);
      if (stats.bodyStrikesLanded < 0) errors.push(`Round ${rs.round} ${corner}: bodyStrikes < 0`);
      if (stats.legStrikesLanded < 0) errors.push(`Round ${rs.round} ${corner}: legStrikes < 0`);
      const sumStrikes = stats.headStrikesLanded + stats.bodyStrikesLanded + stats.legStrikesLanded;
      if (sumStrikes > stats.significantStrikesLanded) errors.push(`Round ${rs.round} ${corner}: Head+Body+Leg (${sumStrikes}) > sigLanded (${stats.significantStrikesLanded})`);
      if (stats.takedownsLanded > stats.takedownsAttempted) errors.push(`Round ${rs.round} ${corner}: tdLanded > tdAttempted`);
      if (stats.controlSeconds < 0 || stats.controlSeconds > 300) errors.push(`Round ${rs.round} ${corner}: controlSeconds out of bounds`);
      if (stats.staminaStart < 0 || stats.staminaStart > 100) errors.push(`Round ${rs.round} ${corner}: staminaStart out of bounds`);
      if (stats.staminaEnd < 0 || stats.staminaEnd > 100) errors.push(`Round ${rs.round} ${corner}: staminaEnd out of bounds`);
    });
    
    if (rs.red.controlSeconds + rs.blue.controlSeconds > 300) {
      errors.push(`Round ${rs.round}: Total control time > 300s`);
    }
  });
  return errors;
}
