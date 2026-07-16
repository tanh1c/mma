import type { Fighter, FightCampFocus, FighterRoundStats, FighterStyle, FightMatchup, FightResult, JudgeRoundScore, MedicalSuspension, RoundStats } from '../../types/game';
import { getFighterOverall, getPhysicalFightModifier, getWeightCutPercent } from './fighterRatings';

export type FightCorner = 'red' | 'blue';
export type FightPosition = 'distance' | 'clinch' | 'ground';
export type FightPhase = 'fighting' | 'between-rounds' | 'finished';

type FightEventType =
  | 'round-start'
  | 'strike'
  | 'takedown'
  | 'clinch'
  | 'position-change'
  | 'submission-attempt'
  | 'knockdown'
  | 'recovery'
  | 'round-end'
  | 'finish';

type FightMethod = FightResult['method'];

export interface FightTimelineEvent {
  sequence: number;
  round: number;
  clock: number;
  type: FightEventType;
  actor?: FightCorner;
  target?: FightCorner;
  positionBefore: FightPosition;
  positionAfter: FightPosition;
  redConditionDelta: number;
  blueConditionDelta: number;
  redStaminaDelta: number;
  blueStaminaDelta: number;
  headline: string;
  commentary: string;
  intensity: number;
}

export interface FightCombatantState {
  fighter: Fighter;
  condition: number;
  stamina: number;
  damage: number;
  headDamage: number;
  bodyDamage: number;
  legDamage: number;
  cutSeverity: number;
  knockdowns: number;
  submissionAttempts: number;
  accumulatedControlSeconds: number;
  modifier: number;
}

export interface FightSession {
  matchup: FightMatchup;
  red: FightCombatantState;
  blue: FightCombatantState;
  phase: FightPhase;
  round: number;
  clock: number;
  position: FightPosition;
  rngState: number;
  timeline: FightTimelineEvent[];
  roundStats: RoundStats[];
  currentRoundStats: { red: FighterRoundStats; blue: FighterRoundStats; keyMoments: string[] };
  judgeTotals: Array<{ judgeId: string; red: number; blue: number }>;
  scorecards: string[];
  commentary: string[];
  winnerId: string | null;
  loserId: string | null;
  method: FightMethod | null;
  finishRound: number | null;
  finishTime: string | null;
}

const ROUND_SECONDS = 300;
const MAX_ROUNDS = 5;
const MIN_ROUNDS = 1;
const RNG_MOD = 4294967296;

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;
const round0 = (value: number) => Math.round(value);
const otherCorner = (corner: FightCorner): FightCorner => corner === 'red' ? 'blue' : 'red';
const clockTime = (clock: number) => `${Math.floor(clock / 60)}:${String(clock % 60).padStart(2, '0')}`;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function nextSeed(seed: number): number {
  return (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
}

function random(session: FightSession): [number, number] {
  const state = nextSeed(session.rngState);
  return [state / RNG_MOD, state];
}

function rand(session: FightSession, min: number, max: number): [number, number] {
  const [value, state] = random(session);
  return [min + value * (max - min), state];
}

function randInt(session: FightSession, min: number, max: number): [number, number] {
  const [value, state] = random(session);
  return [Math.floor(value * (max - min + 1)) + min, state];
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function emptyFighterRoundStats(stamina: number): FighterRoundStats {
  return {
    totalStrikesAttempted: 0,
    totalStrikesLanded: 0,
    significantStrikesAttempted: 0,
    significantStrikesLanded: 0,
    headStrikesLanded: 0,
    bodyStrikesLanded: 0,
    legStrikesLanded: 0,
    takedownsAttempted: 0,
    takedownsLanded: 0,
    submissionAttempts: 0,
    reversals: 0,
    knockdowns: 0,
    controlSeconds: 0,
    damageGiven: 0,
    damageTaken: 0,
    staminaStart: round1(stamina),
    staminaEnd: round1(stamina)
  };
}

function baseStamina(fighter: Fighter): number {
  const cutPenalty = Math.max(0, getWeightCutPercent(fighter) - 8) * 1.25;
  const campBonus = fighter.contract ? 2 : 0;
  return round1(clamp(64 + fighter.attributes.cardio * 0.33 - fighter.fatigue * 0.22 - cutPenalty + campBonus, 35, 100));
}

function applyCamp(fighter: Fighter, focus?: FightCampFocus): Fighter {
  const prepared = clone(fighter);
  if (focus === 'striking') {
    prepared.attributes.striking = Math.min(95, prepared.attributes.striking * 1.03);
    prepared.attributes.power = Math.min(95, prepared.attributes.power * 1.03);
  } else if (focus === 'wrestling') {
    prepared.attributes.wrestling = Math.min(95, prepared.attributes.wrestling * 1.03);
    prepared.attributes.grappling = Math.min(95, prepared.attributes.grappling * 1.03);
    prepared.attributes.submissions = Math.min(95, prepared.attributes.submissions * 1.03);
  } else if (focus === 'cardio') {
    prepared.attributes.cardio = Math.min(95, prepared.attributes.cardio * 1.04);
  }
  return prepared;
}

function preFightModifier(fighter: Fighter): number {
  let modifier = 1;
  if (fighter.age > 33) modifier *= 1 - Math.min(0.06, (fighter.age - 33) * 0.01 * (1 - Math.max(0, fighter.attributes.fightIq - 50) / 100));
  if (fighter.age < 25) modifier *= 1.01;
  if (fighter.morale < 40) modifier *= 0.95;
  else if (fighter.morale > 80) modifier *= 1.05;
  if (fighter.momentum < 20) modifier *= 0.95;
  else if (fighter.momentum > 80) modifier *= 1.05;
  if (fighter.injuryStatus) modifier *= 0.85;
  return modifier;
}

function makeCombatant(fighter: Fighter, opponent: Fighter, nightModifier: number, campFocus?: FightCampFocus): FightCombatantState {
  const prepared = applyCamp(fighter, campFocus);
  return {
    fighter: prepared,
    condition: 100,
    stamina: baseStamina(prepared),
    damage: 0,
    headDamage: 0,
    bodyDamage: 0,
    legDamage: 0,
    cutSeverity: 0,
    knockdowns: 0,
    submissionAttempts: 0,
    accumulatedControlSeconds: 0,
    modifier: getPhysicalFightModifier(prepared, opponent) * preFightModifier(prepared) * nightModifier * (0.95 + getFighterOverall(prepared) / 1000)
  };
}

function combatant(session: FightSession, corner: FightCorner): FightCombatantState {
  return corner === 'red' ? session.red : session.blue;
}

function currentStats(session: FightSession, corner: FightCorner): FighterRoundStats {
  return corner === 'red' ? session.currentRoundStats.red : session.currentRoundStats.blue;
}

function addEvent(
  session: FightSession,
  event: Omit<FightTimelineEvent, 'sequence' | 'round' | 'clock'>
): FightSession {
  const full: FightTimelineEvent = {
    sequence: session.timeline.length + 1,
    round: session.round,
    clock: session.clock,
    ...event,
    redConditionDelta: round1(event.redConditionDelta),
    blueConditionDelta: round1(event.blueConditionDelta),
    redStaminaDelta: round1(event.redStaminaDelta),
    blueStaminaDelta: round1(event.blueStaminaDelta),
    intensity: round0(clamp(event.intensity))
  };
  return {
    ...session,
    timeline: [...session.timeline, full],
    commentary: [...session.commentary, full.commentary]
  };
}

function spendStamina(state: FightCombatantState, amount: number): FightCombatantState {
  return { ...state, stamina: round1(clamp(state.stamina - amount)) };
}

function damageState(state: FightCombatantState, damage: number, headLanded: number, bodyLanded: number, legLanded: number): FightCombatantState {
  const adjusted = Math.max(0, damage * (1 - state.fighter.attributes.toughness / 420));
  const landed = Math.max(1, headLanded + bodyLanded + legLanded);
  const headDamage = adjusted * headLanded / landed;
  const bodyDamage = adjusted * bodyLanded / landed;
  const legDamage = adjusted * legLanded / landed;
  return {
    ...state,
    condition: round1(clamp(state.condition - adjusted)),
    damage: round1(state.damage + adjusted),
    headDamage: round1(state.headDamage + headDamage),
    bodyDamage: round1(state.bodyDamage + bodyDamage),
    legDamage: round1(state.legDamage + legDamage),
    cutSeverity: round1(clamp(state.cutSeverity + Math.max(0, headDamage - 2) / Math.max(8, state.fighter.attributes.chin) * 5, 0, 100))
  };
}

function finishSession(session: FightSession, winner: FightCorner | null, method: FightMethod, commentary: string, eventType: FightEventType = 'finish'): FightSession {
  const loser = winner ? otherCorner(winner) : null;
  const finished = addEvent({ ...session, phase: 'finished' }, {
    type: eventType,
    actor: winner ?? undefined,
    target: loser ?? undefined,
    positionBefore: session.position,
    positionAfter: session.position,
    redConditionDelta: 0,
    blueConditionDelta: 0,
    redStaminaDelta: 0,
    blueStaminaDelta: 0,
    headline: method,
    commentary,
    intensity: method === 'Draw' ? 55 : 95
  });
  return {
    ...finished,
    phase: 'finished',
    winnerId: winner ? combatant(session, winner).fighter.id : null,
    loserId: loser ? combatant(session, loser).fighter.id : null,
    method,
    finishRound: session.round,
    finishTime: clockTime(ROUND_SECONDS - session.clock)
  };
}

function withUpdatedCombatants(session: FightSession, red: FightCombatantState, blue: FightCombatantState): FightSession {
  return { ...session, red, blue };
}

function styleBias(style: FighterStyle, target: 'strike' | 'grapple' | 'submission'): number {
  const striker = style === 'Boxer' || style === 'Kickboxer' || style === 'Muay Thai';
  const wrestler = style === 'Wrestler' || style === 'Sambo';
  if (striker && target === 'strike') return 1.15;
  if (striker && target === 'grapple') return 0.9;
  if (wrestler && target === 'grapple') return 1.15;
  if (wrestler && target === 'strike') return 0.95;
  if (style === 'BJJ' && target === 'submission') return 1.15;
  if (style === 'BJJ' && target === 'grapple') return 1.08;
  if (style === 'BJJ' && target === 'strike') return 0.95;
  return 1;
}

function actionScore(state: FightCombatantState, position: FightPosition): number {
  const attrs = state.fighter.attributes;
  const stamina = 0.35 + state.stamina / 140;
  const base = position === 'ground'
    ? attrs.grappling * 0.45 + attrs.submissions * 0.3 + attrs.wrestling * 0.25
    : attrs.striking * 0.45 + attrs.speed * 0.22 + attrs.fightIq * 0.18 + attrs.wrestling * 0.15;
  const bias = position === 'ground'
    ? Math.max(styleBias(state.fighter.style, 'grapple'), styleBias(state.fighter.style, 'submission'))
    : styleBias(state.fighter.style, 'strike');
  return base * stamina * state.modifier * bias;
}

function chooseActor(session: FightSession): [FightCorner, number] {
  let rngState = session.rngState;
  const redScore = actionScore(session.red, session.position);
  const blueScore = actionScore(session.blue, session.position);
  const [roll, state] = rand(session, 0, redScore + blueScore);
  rngState = state;
  return [roll <= redScore ? 'red' : 'blue', rngState];
}

function applyStrike(session: FightSession, actor: FightCorner, seconds: number): FightSession {
  const target = otherCorner(actor);
  const attacker = combatant(session, actor);
  const defender = combatant(session, target);
  const beforeRed = session.red;
  const beforeBlue = session.blue;
  const positionBefore = session.position;
  let rngState = session.rngState;
  const [accuracyRoll, s1] = rand(session, 0.65, 1.35); rngState = s1;
  const [powerRoll, s2] = rand({ ...session, rngState }, 0.65, 1.45); rngState = s2;
  const offense = (attacker.fighter.attributes.striking * 0.55 + attacker.fighter.attributes.speed * 0.2 + attacker.fighter.attributes.fightIq * 0.25) * (0.45 + attacker.stamina / 120) * attacker.modifier * accuracyRoll;
  const defense = (defender.fighter.attributes.defense * 0.6 + defender.fighter.attributes.chin * 0.2 + defender.fighter.attributes.speed * 0.2) * (0.45 + defender.stamina / 130) * defender.modifier;
  const landed = offense > defense * (session.position === 'ground' ? 0.75 : 0.9);
  const attempted = landed ? 2 + Math.floor(powerRoll * 3) : 1 + Math.floor(powerRoll * 2);
  const significant = landed ? Math.max(1, Math.floor(attempted * (session.position === 'distance' ? 0.65 : 0.45))) : 0;
  const rawDamage = landed ? Math.max(1, significant * (attacker.fighter.attributes.power / 32) * powerRoll) : 0;
  const headShare = session.position === 'ground' ? 0.75 : 0.55;
  let red = spendStamina(session.red, actor === 'red' ? 1.4 + attempted * 0.28 : 0.45);
  let blue = spendStamina(session.blue, actor === 'blue' ? 1.4 + attempted * 0.28 : 0.45);
  const actorStats = currentStats(session, actor);
  const targetStats = currentStats(session, target);
  actorStats.totalStrikesAttempted += attempted;
  actorStats.significantStrikesAttempted += significant + (landed ? 1 : 0);
  if (landed) {
    const headLanded = Math.floor(significant * headShare);
    const bodyLanded = Math.floor((significant - headLanded) / 2);
    const legLanded = significant - headLanded - bodyLanded;
    actorStats.totalStrikesLanded += attempted;
    actorStats.significantStrikesLanded += significant;
    actorStats.headStrikesLanded += headLanded;
    actorStats.bodyStrikesLanded += bodyLanded;
    actorStats.legStrikesLanded += legLanded;
    actorStats.damageGiven = round1(actorStats.damageGiven + rawDamage);
    targetStats.damageTaken = round1(targetStats.damageTaken + rawDamage);
    if (target === 'red') red = damageState(red, rawDamage, headLanded, bodyLanded, legLanded); else blue = damageState(blue, rawDamage, headLanded, bodyLanded, legLanded);
  }
  let nextPosition = session.position;
  let type: FightEventType = 'strike';
  let headline = landed ? `${attacker.fighter.lastName} lands clean` : `${attacker.fighter.lastName} misses`;
  let commentary = landed
    ? `${attacker.fighter.lastName} scores with ${session.position === 'ground' ? 'ground strikes' : 'a sharp combination'}.`
    : `${defender.fighter.lastName} reads the attack and avoids most of it.`;
  let intensity = landed ? 35 + rawDamage * 2 : 18;
  const kdThreshold = Math.max(7, defender.fighter.attributes.chin * (0.55 + defender.stamina / 220));
  const [kdRoll, s3] = rand({ ...session, rngState }, 0, 100); rngState = s3;
  if (landed && rawDamage > kdThreshold && kdRoll < 20 + attacker.fighter.attributes.power / 5) {
    type = 'knockdown';
    nextPosition = 'ground';
    headline = `${attacker.fighter.lastName} scores a knockdown`;
    commentary = `${attacker.fighter.lastName} hurts ${defender.fighter.lastName} badly and puts them down.`;
    intensity = 88;
    currentStats(session, actor).knockdowns += 1;
    if (actor === 'red') red = { ...red, knockdowns: red.knockdowns + 1 }; else blue = { ...blue, knockdowns: blue.knockdowns + 1 };
    session.currentRoundStats.keyMoments.push(`Round ${session.round}: ${attacker.fighter.lastName} knockdown`);
  }
  let next = withUpdatedCombatants({ ...session, position: nextPosition, rngState }, red, blue);
  next = addEvent(next, {
    type,
    actor,
    target,
    positionBefore,
    positionAfter: nextPosition,
    redConditionDelta: next.red.condition - beforeRed.condition,
    blueConditionDelta: next.blue.condition - beforeBlue.condition,
    redStaminaDelta: next.red.stamina - beforeRed.stamina,
    blueStaminaDelta: next.blue.stamina - beforeBlue.stamina,
    headline,
    commentary,
    intensity
  });
  return checkImmediateFinish(next, actor, target);
}

function applyTakedown(session: FightSession, actor: FightCorner, seconds: number): FightSession {
  const target = otherCorner(actor);
  const attacker = combatant(session, actor);
  const defender = combatant(session, target);
  const beforeRed = session.red;
  const beforeBlue = session.blue;
  let rngState = session.rngState;
  const [roll, s1] = rand(session, 0.75, 1.25); rngState = s1;
  const attack = (attacker.fighter.attributes.wrestling * 0.65 + attacker.fighter.attributes.grappling * 0.2 + attacker.fighter.attributes.fightIq * 0.15) * (0.4 + attacker.stamina / 120) * roll;
  const defense = (defender.fighter.attributes.wrestling * 0.45 + defender.fighter.attributes.defense * 0.35 + defender.fighter.attributes.speed * 0.2) * (0.4 + defender.stamina / 125);
  const landed = attack > defense;
  let red = spendStamina(session.red, actor === 'red' ? 2.8 : 1.1);
  let blue = spendStamina(session.blue, actor === 'blue' ? 2.8 : 1.1);
  const stats = currentStats(session, actor);
  stats.takedownsAttempted += 1;
  if (landed) {
    stats.takedownsLanded += 1;
    stats.controlSeconds = Math.min(300, stats.controlSeconds + seconds);
    if (actor === 'red') red = { ...red, accumulatedControlSeconds: red.accumulatedControlSeconds + seconds }; else blue = { ...blue, accumulatedControlSeconds: blue.accumulatedControlSeconds + seconds };
    session.currentRoundStats.keyMoments.push(`Round ${session.round}: ${attacker.fighter.lastName} takedown`);
  }
  const nextPosition: FightPosition = landed ? 'ground' : 'clinch';
  const next = addEvent(withUpdatedCombatants({ ...session, position: nextPosition, rngState }, red, blue), {
    type: landed ? 'takedown' : 'clinch',
    actor,
    target,
    positionBefore: session.position,
    positionAfter: nextPosition,
    redConditionDelta: red.condition - beforeRed.condition,
    blueConditionDelta: blue.condition - beforeBlue.condition,
    redStaminaDelta: red.stamina - beforeRed.stamina,
    blueStaminaDelta: blue.stamina - beforeBlue.stamina,
    headline: landed ? `${attacker.fighter.lastName} lands a takedown` : `${attacker.fighter.lastName} forces a clinch`,
    commentary: landed ? `${attacker.fighter.lastName} changes levels and gets top control.` : `${defender.fighter.lastName} defends the shot but is tied up on the fence.`,
    intensity: landed ? 55 : 32
  });
  return next;
}

function applySubmission(session: FightSession, actor: FightCorner, seconds: number): FightSession {
  const target = otherCorner(actor);
  const attacker = combatant(session, actor);
  const defender = combatant(session, target);
  const beforeRed = session.red;
  const beforeBlue = session.blue;
  let rngState = session.rngState;
  const [roll, s1] = rand(session, 0.65, 1.45); rngState = s1;
  const attack = (attacker.fighter.attributes.submissions * 0.6 + attacker.fighter.attributes.grappling * 0.25 + attacker.fighter.attributes.fightIq * 0.15) * (0.35 + attacker.stamina / 125) * roll;
  const defense = (defender.fighter.attributes.grappling * 0.55 + defender.fighter.attributes.fightIq * 0.25 + defender.fighter.attributes.toughness * 0.2) * (0.35 + defender.stamina / 130);
  const close = attack > defense * 0.92;
  let red = spendStamina(session.red, actor === 'red' ? 2.5 : 1.6);
  let blue = spendStamina(session.blue, actor === 'blue' ? 2.5 : 1.6);
  currentStats(session, actor).submissionAttempts += 1;
  if (actor === 'red') red = { ...red, submissionAttempts: red.submissionAttempts + 1 }; else blue = { ...blue, submissionAttempts: blue.submissionAttempts + 1 };
  session.currentRoundStats.keyMoments.push(`Round ${session.round}: ${attacker.fighter.lastName} submission attempt`);
  const [finishRoll, s2] = rand({ ...session, rngState }, 0, 100); rngState = s2;
  const next = addEvent(withUpdatedCombatants({ ...session, rngState }, red, blue), {
    type: 'submission-attempt',
    actor,
    target,
    positionBefore: session.position,
    positionAfter: session.position,
    redConditionDelta: red.condition - beforeRed.condition,
    blueConditionDelta: blue.condition - beforeBlue.condition,
    redStaminaDelta: red.stamina - beforeRed.stamina,
    blueStaminaDelta: blue.stamina - beforeBlue.stamina,
    headline: `${attacker.fighter.lastName} attacks a submission`,
    commentary: close ? `${attacker.fighter.lastName} has a dangerous submission locked in.` : `${defender.fighter.lastName} stays calm and peels the grip away.`,
    intensity: close ? 78 : 42
  });
  const finishChance = close ? clamp(5 + (attack - defense) / 5 + (100 - defender.stamina) / 12, 4, 35) : 1;
  return finishRoll < finishChance
    ? finishSession(next, actor, 'Submission', `${attacker.fighter.lastName} tightens the hold and ${defender.fighter.lastName} taps.`)
    : next;
}

function applyPositionChange(session: FightSession, actor: FightCorner): FightSession {
  const target = otherCorner(actor);
  const beforeRed = session.red;
  const beforeBlue = session.blue;
  const before = session.position;
  let rngState = session.rngState;
  const [roll, s1] = rand(session, 0, 100); rngState = s1;
  const nextPosition: FightPosition = before === 'ground' ? (roll < 55 ? 'distance' : 'clinch') : before === 'clinch' ? (roll < 60 ? 'distance' : 'ground') : 'clinch';
  let red = spendStamina(session.red, actor === 'red' ? 1.2 : 0.8);
  let blue = spendStamina(session.blue, actor === 'blue' ? 1.2 : 0.8);
  if (before === 'ground' && nextPosition !== 'ground') currentStats(session, actor).reversals += 1;
  return addEvent(withUpdatedCombatants({ ...session, position: nextPosition, rngState }, red, blue), {
    type: 'position-change',
    actor,
    target,
    positionBefore: before,
    positionAfter: nextPosition,
    redConditionDelta: red.condition - beforeRed.condition,
    blueConditionDelta: blue.condition - beforeBlue.condition,
    redStaminaDelta: red.stamina - beforeRed.stamina,
    blueStaminaDelta: blue.stamina - beforeBlue.stamina,
    headline: `${combatant(session, actor).fighter.lastName} changes the position`,
    commentary: `${combatant(session, actor).fighter.lastName} works the fight from ${before} to ${nextPosition}.`,
    intensity: 28
  });
}

function checkImmediateFinish(session: FightSession, actor: FightCorner, target: FightCorner): FightSession {
  const defender = combatant(session, target);
  if (defender.condition <= 0) {
    return finishSession(session, actor, 'KO/TKO', `${combatant(session, actor).fighter.lastName} forces the referee to stop the fight.`);
  }
  if (defender.cutSeverity >= 92) {
    return finishSession(session, actor, 'Doctor Stoppage', `The doctor stops the fight because of damage to ${defender.fighter.lastName}.`);
  }
  return session;
}

function finishPreExistingZeroCondition(session: FightSession): FightSession {
  if (session.red.condition > 0 && session.blue.condition > 0) return session;
  const winner: FightCorner = session.red.condition <= 0 && session.blue.condition <= 0
    ? (session.red.damage < session.blue.damage ? 'red' : session.blue.damage < session.red.damage ? 'blue' : 'red')
    : session.red.condition <= 0 ? 'blue' : 'red';
  return finishSession(session, winner, 'KO/TKO', `${combatant(session, winner).fighter.lastName} wins after the referee waves off a compromised opponent.`);
}

function scoreRound(session: FightSession): RoundStats {
  const redStats = session.currentRoundStats.red;
  const blueStats = session.currentRoundStats.blue;
  redStats.staminaEnd = round1(session.red.stamina);
  blueStats.staminaEnd = round1(session.blue.stamina);
  const redTechnical = redStats.damageGiven * 2 + redStats.significantStrikesLanded + redStats.takedownsLanded * 7 + redStats.submissionAttempts * 9 + redStats.knockdowns * 20 + redStats.controlSeconds * 0.04;
  const blueTechnical = blueStats.damageGiven * 2 + blueStats.significantStrikesLanded + blueStats.takedownsLanded * 7 + blueStats.submissionAttempts * 9 + blueStats.knockdowns * 20 + blueStats.controlSeconds * 0.04;
  const judges: JudgeRoundScore[] = [0, 1, 2].map(index => {
    const sway = index - 1;
    const redScore = redTechnical + sway * 1.5;
    const blueScore = blueTechnical - sway * 1.5;
    let redRound: 10 | 9 | 8 = 10;
    let blueRound: 10 | 9 | 8 = 10;
    let reason: JudgeRoundScore['reason'] = 'close-round';
    const diff = Math.abs(redScore - blueScore);
    if (redScore > blueScore) {
      blueRound = diff > 35 || redStats.knockdowns >= 2 ? 8 : 9;
      reason = redStats.knockdowns > blueStats.knockdowns ? 'knockdown' : redStats.submissionAttempts > blueStats.submissionAttempts ? 'submission-threat' : redStats.controlSeconds > blueStats.controlSeconds + 60 ? 'control' : diff > 14 ? 'damage' : 'close-round';
    } else if (blueScore > redScore) {
      redRound = diff > 35 || blueStats.knockdowns >= 2 ? 8 : 9;
      reason = blueStats.knockdowns > redStats.knockdowns ? 'knockdown' : blueStats.submissionAttempts > redStats.submissionAttempts ? 'submission-threat' : blueStats.controlSeconds > redStats.controlSeconds + 60 ? 'control' : diff > 14 ? 'damage' : 'close-round';
    }
    return { judgeId: `Judge ${index + 1}`, redScore: redRound, blueScore: blueRound, reason };
  });
  const gap = Math.abs(redTechnical - blueTechnical);
  return {
    round: session.round,
    red: { ...redStats },
    blue: { ...blueStats },
    judges,
    redTechnicalScore: round0(redTechnical),
    blueTechnicalScore: round0(blueTechnical),
    summary: redTechnical === blueTechnical ? 'Close round' : `${redTechnical > blueTechnical ? session.red.fighter.lastName : session.blue.fighter.lastName} edged the round`,
    keyMoments: [...session.currentRoundStats.keyMoments],
    dominanceLevel: gap > 55 ? 'near_finish' : gap > 35 ? 'dominant' : gap > 15 ? 'clear' : 'close'
  };
}

function endRound(session: FightSession): FightSession {
  const roundStats = scoreRound(session);
  const judgeTotals = session.judgeTotals.map((judge, index) => ({
    judgeId: judge.judgeId,
    red: judge.red + roundStats.judges[index].redScore,
    blue: judge.blue + roundStats.judges[index].blueScore
  }));
  const ended = addEvent({ ...session, clock: 0, phase: session.round >= session.matchup.rounds ? 'finished' : 'between-rounds' }, {
    type: 'round-end',
    positionBefore: session.position,
    positionAfter: session.position,
    redConditionDelta: 0,
    blueConditionDelta: 0,
    redStaminaDelta: 0,
    blueStaminaDelta: 0,
    headline: `Round ${session.round} ends`,
    commentary: `End of round ${session.round}. ${roundStats.summary}.`,
    intensity: roundStats.dominanceLevel === 'near_finish' ? 75 : 42
  });
  const next = { ...ended, roundStats: [...session.roundStats, roundStats], judgeTotals };
  return session.round >= session.matchup.rounds ? finishDecision(next) : next;
}

function recoverBetweenRounds(session: FightSession): FightSession {
  let rngState = session.rngState;
  const [redRecovery, s1] = rand(session, 7, 13); rngState = s1;
  const [blueRecovery, s2] = rand({ ...session, rngState }, 7, 13); rngState = s2;
  const red = { ...session.red, stamina: round1(clamp(session.red.stamina + redRecovery + session.red.fighter.attributes.cardio / 18)) };
  const blue = { ...session.blue, stamina: round1(clamp(session.blue.stamina + blueRecovery + session.blue.fighter.attributes.cardio / 18)) };
  const recovered = addEvent(withUpdatedCombatants({ ...session, rngState }, red, blue), {
    type: 'recovery',
    positionBefore: session.position,
    positionAfter: 'distance',
    redConditionDelta: 0,
    blueConditionDelta: 0,
    redStaminaDelta: red.stamina - session.red.stamina,
    blueStaminaDelta: blue.stamina - session.blue.stamina,
    headline: 'Between-round recovery',
    commentary: 'Both corners give instructions and send their fighters back out.',
    intensity: 12
  });
  return {
    ...recovered,
    phase: 'fighting',
    round: session.round + 1,
    clock: ROUND_SECONDS,
    position: 'distance',
    currentRoundStats: { red: emptyFighterRoundStats(red.stamina), blue: emptyFighterRoundStats(blue.stamina), keyMoments: [] }
  };
}

function finishDecision(session: FightSession): FightSession {
  const redCards = session.judgeTotals.filter(card => card.red > card.blue).length;
  const blueCards = session.judgeTotals.filter(card => card.blue > card.red).length;
  const draws = session.judgeTotals.length - redCards - blueCards;
  const scorecards = session.judgeTotals.map(card => `${card.red}-${card.blue}`);
  if (redCards >= 2) {
    return { ...finishSession({ ...session, scorecards }, 'red', redCards === 3 ? 'Unanimous Decision' : draws === 1 ? 'Majority Decision' : 'Split Decision', `The judges score it ${scorecards.join(', ')} for ${session.red.fighter.lastName}.`), scorecards };
  }
  if (blueCards >= 2) {
    return { ...finishSession({ ...session, scorecards }, 'blue', blueCards === 3 ? 'Unanimous Decision' : draws === 1 ? 'Majority Decision' : 'Split Decision', `The judges score it ${scorecards.join(', ')} for ${session.blue.fighter.lastName}.`), scorecards };
  }
  return { ...finishSession({ ...session, scorecards }, null, 'Draw', `The judges score it ${scorecards.join(', ')} for a draw.`), scorecards };
}

function shouldGrapple(state: FightCombatantState, opponent: FightCombatantState): number {
  const attrs = state.fighter.attributes;
  const gap = attrs.wrestling + attrs.grappling - opponent.fighter.attributes.wrestling - opponent.fighter.attributes.grappling;
  return clamp((16 + gap / 4 + (attrs.wrestling > attrs.striking ? 14 : 0) + (100 - state.stamina) / 8) * styleBias(state.fighter.style, 'grapple'), 5, 55);
}

function shouldSubmit(state: FightCombatantState, opponent: FightCombatantState): number {
  return clamp((18 + state.fighter.attributes.submissions / 4 - opponent.fighter.attributes.grappling / 5) * styleBias(state.fighter.style, 'submission'), 8, 50);
}

function fightTick(session: FightSession): FightSession {
  let rngState = session.rngState;
  const [seconds, s1] = randInt(session, 5, 10); rngState = s1;
  const elapsed = Math.min(seconds, session.clock);
  const advanced = { ...session, rngState, clock: session.clock - elapsed };
  let [actor, s2] = chooseActor(advanced);
  rngState = s2;
  const acting = { ...advanced, rngState };
  const attacker = combatant(acting, actor);
  const defender = combatant(acting, otherCorner(actor));
  let roll: number;
  [roll, rngState] = rand(acting, 0, 100);
  const rolled = { ...acting, rngState };
  if (rolled.position === 'ground') {
    const next = roll < shouldSubmit(attacker, defender) ? applySubmission(rolled, actor, elapsed) : roll > 82 ? applyPositionChange(rolled, otherCorner(actor)) : applyStrike(rolled, actor, elapsed);
    return next.phase === 'finished' || next.clock > 0 ? next : endRound(next);
  }
  if (rolled.position === 'clinch') {
    const next = roll < shouldGrapple(attacker, defender) ? applyTakedown(rolled, actor, elapsed) : roll > 76 ? applyPositionChange(rolled, actor) : applyStrike(rolled, actor, elapsed);
    return next.phase === 'finished' || next.clock > 0 ? next : endRound(next);
  }
  const next = roll < shouldGrapple(attacker, defender) ? applyTakedown(rolled, actor, elapsed) : applyStrike(rolled, actor, elapsed);
  return next.phase === 'finished' || next.clock > 0 ? next : endRound(next);
}

export function createFightSession(matchup: FightMatchup, red: Fighter, blue: Fighter, seed?: number): FightSession {
  const rounds = clamp(Math.trunc(matchup.rounds || 3), MIN_ROUNDS, MAX_ROUNDS);
  const normalizedMatchup = clone({ ...matchup, rounds });
  let rngState = (seed ?? hashSeed(`${matchup.id}:${red.id}:${blue.id}:${rounds}`)) >>> 0;
  rngState = nextSeed(rngState);
  const redNight = 0.95 + rngState / RNG_MOD * 0.1;
  rngState = nextSeed(rngState);
  const blueNight = 0.95 + rngState / RNG_MOD * 0.1;
  const redState = makeCombatant(red, blue, redNight, matchup.campFocus);
  const blueState = makeCombatant(blue, red, blueNight, matchup.campFocus);
  const session: FightSession = {
    matchup: normalizedMatchup,
    red: redState,
    blue: blueState,
    phase: 'fighting',
    round: 1,
    clock: ROUND_SECONDS,
    position: 'distance',
    rngState,
    timeline: [],
    roundStats: [],
    currentRoundStats: { red: emptyFighterRoundStats(redState.stamina), blue: emptyFighterRoundStats(blueState.stamina), keyMoments: [] },
    judgeTotals: [1, 2, 3].map(index => ({ judgeId: `Judge ${index}`, red: 0, blue: 0 })),
    scorecards: [],
    commentary: [],
    winnerId: null,
    loserId: null,
    method: null,
    finishRound: null,
    finishTime: null
  };
  return addEvent(session, {
    type: 'round-start',
    positionBefore: 'distance',
    positionAfter: 'distance',
    redConditionDelta: 0,
    blueConditionDelta: 0,
    redStaminaDelta: 0,
    blueStaminaDelta: 0,
    headline: 'Round 1 begins',
    commentary: `Round 1 begins between ${red.lastName} and ${blue.lastName}.`,
    intensity: 20
  });
}

export function stepFightSession(session: FightSession): FightSession {
  if (session.phase === 'finished') return session;
  const snapshot = clone(session);
  const stopped = finishPreExistingZeroCondition(snapshot);
  if (stopped.phase === 'finished') return stopped;
  if (snapshot.phase === 'between-rounds') return recoverBetweenRounds(snapshot);
  return fightTick(snapshot);
}

export function runFightSession(session: FightSession): FightSession {
  let next = session;
  for (let tick = 0; tick < session.matchup.rounds * 80 && next.phase !== 'finished'; tick++) {
    next = stepFightSession(next);
  }
  if (next.phase !== 'finished') throw new Error(`Fight session did not finish within ${session.matchup.rounds * 80} ticks`);
  return next;
}

function resultRandom(state: { value: number }, min: number, max: number): number {
  state.value = nextSeed(state.value);
  return min + state.value / RNG_MOD * (max - min);
}

export function fightSessionToResult(session: FightSession): FightResult {
  if (session.phase !== 'finished' || !session.method || !session.finishRound || !session.finishTime) {
    throw new Error('Fight session must be finished before converting to a result');
  }
  const rng = { value: session.rngState };
  const roundStats = session.roundStats.length < session.finishRound
    ? [...session.roundStats, scoreRound(clone(session))]
    : session.roundStats;
  const totalDamage = session.red.damage + session.blue.damage;
  const totalKnockdowns = session.red.knockdowns + session.blue.knockdowns;
  const totalSubmissions = session.red.submissionAttempts + session.blue.submissionAttempts;
  const competitiveness = 20 - Math.min(20, Math.abs(session.red.damage - session.blue.damage) / 4);
  const finishBonus = session.method === 'KO/TKO' ? 22 : session.method === 'Submission' ? 18 : session.method === 'Doctor Stoppage' ? 14 : 0;
  const performanceRating = round0(clamp(18 + totalDamage / 3 + totalKnockdowns * 12 + totalSubmissions * 4 + competitiveness + finishBonus, 10, 100));
  const popularityDelta: Record<string, number> = { [session.red.fighter.id]: 0, [session.blue.fighter.id]: 0 };
  const moraleDelta: Record<string, number> = { [session.red.fighter.id]: 0, [session.blue.fighter.id]: 0 };
  const momentumDelta: Record<string, number> = { [session.red.fighter.id]: 0, [session.blue.fighter.id]: 0 };
  if (session.winnerId && session.loserId) {
    popularityDelta[session.winnerId] = Math.floor(resultRandom(rng, 1, 4) + performanceRating / 20);
    popularityDelta[session.loserId] = -Math.floor(resultRandom(rng, 0, 2));
    moraleDelta[session.winnerId] = Math.floor(resultRandom(rng, 10, 21));
    moraleDelta[session.loserId] = -Math.floor(resultRandom(rng, 10, 26));
    momentumDelta[session.winnerId] = Math.floor(resultRandom(rng, 10, 26));
    momentumDelta[session.loserId] = -Math.floor(resultRandom(rng, 20, 41));
    const winner = session.winnerId === session.red.fighter.id ? session.red.fighter : session.blue.fighter;
    const loser = session.loserId === session.red.fighter.id ? session.red.fighter : session.blue.fighter;
    if (loser.popularity - winner.popularity > 10) popularityDelta[session.winnerId] += Math.floor((loser.popularity - winner.popularity) / 5);
  }
  const injuries: NonNullable<FightResult['injuries']> = [];
  ([session.red, session.blue] as const).forEach(state => {
    const isKnockoutLoser = session.loserId === state.fighter.id && session.method === 'KO/TKO';
    if (isKnockoutLoser && state.headDamage > 18) {
      injuries.push({ fighterId: state.fighter.id, type: 'Concussion', daysRemaining: Math.floor(resultRandom(rng, 60, 121)) });
    } else if (state.damage > 45 && resultRandom(rng, 0, 100) < 30) {
      injuries.push({ fighterId: state.fighter.id, type: 'Laceration', daysRemaining: Math.floor(resultRandom(rng, 30, 91)) });
    }
  });
  const medicalSuspensions: MedicalSuspension[] = [];
  ([session.red, session.blue] as const).forEach(state => {
    const isWinner = session.winnerId === state.fighter.id;
    const isLoser = session.loserId === state.fighter.id;
    let reason: MedicalSuspension['reason'] | null = null;
    let days = 0;
    if (isLoser && session.method === 'KO/TKO') { reason = 'knockout'; days = Math.floor(resultRandom(rng, 45, 91)); }
    else if (isLoser && session.method === 'Doctor Stoppage') { reason = 'doctor_stoppage'; days = Math.floor(resultRandom(rng, 45, 91)); }
    else if (state.damage > 55) { reason = 'hard_fight'; days = Math.floor(resultRandom(rng, isWinner ? 21 : 30, isWinner ? 46 : 61)); }
    else if (isLoser && session.method === 'Submission' && state.damage > 20) { reason = 'submission_damage'; days = Math.floor(resultRandom(rng, 14, 29)); }
    else if (isLoser || (isWinner && state.damage > 20)) { reason = 'commission_review'; days = Math.floor(resultRandom(rng, 7, 15)); }
    if (reason) {
      medicalSuspensions.push({
        id: `${session.matchup.id}-${state.fighter.id}-suspension`,
        fighterId: state.fighter.id,
        reason,
        daysRemaining: days,
        sourceFightId: session.matchup.id,
        severity: days > 45 ? 'severe' : days >= 21 ? 'moderate' : 'minor'
      });
    }
  });
  return {
    winnerId: session.winnerId,
    loserId: session.loserId,
    method: session.method,
    round: session.finishRound,
    time: session.finishTime,
    commentary: [...session.commentary],
    performanceRating,
    scorecards: [...session.scorecards],
    roundStats: clone(roundStats),
    injuries,
    medicalSuspensions,
    popularityDelta,
    moraleDelta,
    momentumDelta
  };
}

export function validateFightSession(session: FightSession): string[] {
  const errors: string[] = [];
  const validateStats = (stats: FighterRoundStats, label: string) => {
    if (!Object.values(stats).every(value => Number.isFinite(value) && value >= 0)) errors.push(`${label} statistics must be finite and non-negative`);
  };
  if (!['fighting', 'between-rounds', 'finished'].includes(session.phase)) errors.push('Invalid phase');
  if (!['distance', 'clinch', 'ground'].includes(session.position)) errors.push('Invalid position');
  if (!Number.isInteger(session.rngState) || session.rngState < 0 || session.rngState > 0xffffffff) errors.push('Invalid rngState');
  if (session.round < 1 || session.round > session.matchup.rounds) errors.push('Round out of bounds');
  if (session.clock < 0 || session.clock > ROUND_SECONDS) errors.push('Clock out of bounds');
  ([['red', session.red], ['blue', session.blue]] as const).forEach(([corner, state]) => {
    if (!Number.isFinite(state.condition) || state.condition < 0 || state.condition > 100) errors.push(`${corner} condition out of bounds`);
    if (session.phase !== 'finished' && state.condition <= 0) errors.push(`${corner} active condition must be positive`);
    if (!Number.isFinite(state.stamina) || state.stamina < 0 || state.stamina > 100) errors.push(`${corner} stamina out of bounds`);
    if (![state.damage, state.headDamage, state.bodyDamage, state.legDamage, state.cutSeverity].every(Number.isFinite) || state.damage < 0 || state.headDamage < 0 || state.bodyDamage < 0 || state.legDamage < 0 || state.cutSeverity < 0 || state.cutSeverity > 100) errors.push(`${corner} damage out of bounds`);
  });
  session.timeline.forEach((event, index) => {
    if (event.sequence !== index + 1) errors.push(`Timeline sequence ${index + 1} is unstable`);
    if (event.round < 1 || event.round > session.matchup.rounds) errors.push(`Timeline event ${event.sequence} round out of bounds`);
    if (event.clock < 0 || event.clock > ROUND_SECONDS) errors.push(`Timeline event ${event.sequence} clock out of bounds`);
    if (event.intensity < 0 || event.intensity > 100) errors.push(`Timeline event ${event.sequence} intensity out of bounds`);
  });
  validateStats(session.currentRoundStats.red, `Round ${session.round} red`);
  validateStats(session.currentRoundStats.blue, `Round ${session.round} blue`);
  session.roundStats.forEach(round => {
    validateStats(round.red, `Round ${round.round} red`);
    validateStats(round.blue, `Round ${round.round} blue`);
    if (round.red.totalStrikesLanded > round.red.totalStrikesAttempted) errors.push(`Round ${round.round} red landed exceeds attempted`);
    if (round.blue.totalStrikesLanded > round.blue.totalStrikesAttempted) errors.push(`Round ${round.round} blue landed exceeds attempted`);
    if (round.red.significantStrikesLanded > round.red.significantStrikesAttempted) errors.push(`Round ${round.round} red significant landed exceeds attempted`);
    if (round.blue.significantStrikesLanded > round.blue.significantStrikesAttempted) errors.push(`Round ${round.round} blue significant landed exceeds attempted`);
    if (round.red.takedownsLanded > round.red.takedownsAttempted) errors.push(`Round ${round.round} red takedowns invalid`);
    if (round.blue.takedownsLanded > round.blue.takedownsAttempted) errors.push(`Round ${round.round} blue takedowns invalid`);
    if (round.red.controlSeconds + round.blue.controlSeconds > ROUND_SECONDS) errors.push(`Round ${round.round} control seconds exceed round`);
    round.judges.forEach(judge => {
      if (![8, 9, 10].includes(judge.redScore) || ![8, 9, 10].includes(judge.blueScore)) errors.push(`Round ${round.round} invalid judge score`);
    });
  });
  if (session.phase === 'finished') {
    if (!session.method || !session.finishRound || !session.finishTime) errors.push('Finished session missing finish metadata');
    if (session.method !== 'Draw' && (!session.winnerId || !session.loserId)) errors.push('Finished non-draw missing winner or loser');
  }
  return errors;
}
