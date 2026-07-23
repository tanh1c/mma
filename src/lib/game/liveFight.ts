import '../../i18n';
import type { Fighter, FightCampFocus, FighterRoundStats, FighterStyle, FightMatchup, FightResult, JudgeRoundScore, MedicalSuspension, RoundStats } from '../../types/game';
import { fixedT, formatFightMethod, type Language } from '../localization';
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
export type FightEventImportance = 'routine' | 'notable' | 'key';

type PendingFightFinish = {
  winner: FightCorner | null;
  method: FightMethod;
  commentary: string;
};

export type FightStrikeVisual = 'jab' | 'cross' | 'hook' | 'body-hook' | 'low-kick' | 'body-kick' | 'high-kick' | 'knee' | 'elbow';
export type FightVisualAction = 'idle' | 'movement' | 'strike' | 'defense' | 'clinch' | 'takedown' | 'takedown-defense' | 'sprawl' | 'ground-pound' | 'submission' | 'knockdown' | 'recovery' | 'finish';

export interface FightVisualCue {
  action: FightVisualAction;
  strike?: FightStrikeVisual;
  outcome?: 'landed' | 'missed' | 'blocked' | 'dodged' | 'failed' | 'escaped' | 'finished';
  targetZone?: 'head' | 'body' | 'leg';
  intensity: 'light' | 'heavy';
  finish?: 'ko' | 'tko' | 'doctor' | 'submission' | 'decision' | 'draw';
  transition?: 'close-distance' | 'disengage' | 'ground-to-distance' | 'ground-to-clinch';
}

export interface FightTimelineEvent {
  sequence: number;
  round: number;
  clockBeforeMs: number;
  clockAfterMs: number;
  durationMs: number;
  importance: FightEventImportance;
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
  visual: FightVisualCue;
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
  language: Language;
  matchup: FightMatchup;
  red: FightCombatantState;
  blue: FightCombatantState;
  phase: FightPhase;
  round: number;
  clockMs: number;
  position: FightPosition;
  pressure: FightCorner | null;
  controller: FightCorner | null;
  pendingRoundEnd: boolean;
  pendingFinish: PendingFightFinish | null;
  rngState: number;
  timeline: FightTimelineEvent[];
  roundStats: RoundStats[];
  currentRoundStats: { red: FighterRoundStats; blue: FighterRoundStats; keyMoments: string[] };
  judgeTotals: Array<{ judgeId: string; red: number; blue: number }>;
  scorecards: string[];
  winnerId: string | null;
  loserId: string | null;
  method: FightMethod | null;
  finishRound: number | null;
  finishTime: string | null;
}

const ROUND_MS = 300_000;
const ROUND_SECONDS = ROUND_MS / 1_000;
const MAX_EVENTS_PER_ROUND = 1_000;
const MAX_ROUNDS = 5;
const MIN_ROUNDS = 1;
const RNG_MOD = 4294967296;

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;
const round0 = (value: number) => Math.round(value);
const otherCorner = (corner: FightCorner): FightCorner => corner === 'red' ? 'blue' : 'red';
const clockTime = (elapsedMs: number) => {
  const elapsedSeconds = Math.floor(elapsedMs / 1_000);
  return `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')}`;
};
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const cloneFightSessionForStep = (session: FightSession): FightSession => ({
  ...session,
  red: { ...session.red },
  blue: { ...session.blue },
  pendingFinish: session.pendingFinish ? { ...session.pendingFinish } : null,
  roundStats: session.roundStats.map(round => ({
    ...round,
    red: { ...round.red },
    blue: { ...round.blue },
    judges: round.judges.map(judge => ({ ...judge })),
    keyMoments: [...round.keyMoments]
  })),
  currentRoundStats: {
    red: { ...session.currentRoundStats.red },
    blue: { ...session.currentRoundStats.blue },
    keyMoments: [...session.currentRoundStats.keyMoments]
  },
  judgeTotals: session.judgeTotals.map(judge => ({ ...judge })),
  scorecards: [...session.scorecards]
});
const fightT = (session: FightSession) => fixedT(session.language);
const positionLabel = (position: FightPosition, language: Language) => {
  const t = fixedT(language);
  return position === 'distance' ? t($ => $.fight.position.distance) : position === 'clinch' ? t($ => $.fight.position.clinch) : t($ => $.fight.position.ground);
};

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

function stableVisualIndex(parts: Array<string | number>, size: number): number {
  return hashSeed(parts.join(':')) % size;
}

function selectStrikeVisual(session: FightSession, actor: FightCorner, targetZone: FightVisualCue['targetZone']): FightStrikeVisual {
  const style = combatant(session, actor).fighter.style;
  const options: FightStrikeVisual[] = session.position === 'clinch'
    ? targetZone === 'body' ? ['body-hook', 'knee'] : ['hook', 'knee', 'elbow']
    : targetZone === 'leg'
      ? ['low-kick']
      : targetZone === 'body'
        ? ['body-hook', 'body-kick', 'jab', 'cross']
        : style === 'Boxer'
          ? ['jab', 'cross', 'hook']
          : style === 'Kickboxer' || style === 'Muay Thai'
            ? ['jab', 'cross', 'hook', 'high-kick']
            : ['jab', 'cross', 'hook', 'high-kick'];
  return options[stableVisualIndex([session.matchup.id, session.timeline.length, actor, session.round, session.clockMs, session.position], options.length)];
}

function visualIntensity(intensity: number): FightVisualCue['intensity'] {
  return intensity >= 60 ? 'heavy' : 'light';
}

function finishVisual(session: FightSession, method: FightMethod): NonNullable<FightVisualCue['finish']> {
  if (method === 'Submission') return 'submission';
  if (method === 'Doctor Stoppage') return 'doctor';
  if (method === 'Draw') return 'draw';
  if (method.includes('Decision')) return 'decision';
  return session.timeline.at(-1)?.visual.action === 'knockdown' ? 'ko' : 'tko';
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
  event: Omit<FightTimelineEvent, 'sequence' | 'round' | 'clockBeforeMs' | 'clockAfterMs'>
): FightSession {
  const full: FightTimelineEvent = {
    sequence: session.timeline.length + 1,
    round: session.round,
    clockBeforeMs: session.clockMs + event.durationMs,
    clockAfterMs: session.clockMs,
    ...event,
    redConditionDelta: round1(event.redConditionDelta),
    blueConditionDelta: round1(event.blueConditionDelta),
    redStaminaDelta: round1(event.redStaminaDelta),
    blueStaminaDelta: round1(event.blueStaminaDelta),
    intensity: round0(clamp(event.intensity))
  };
  return { ...session, timeline: [...session.timeline, full] };
}

type MicroActionFamily = 'movement' | 'strike' | 'clinch' | 'takedown' | 'ground-control' | 'ground-pound' | 'submission' | 'recovery';

const ACTION_DURATION_MS: Record<MicroActionFamily, readonly [number, number]> = {
  movement: [800, 1_500],
  strike: [800, 900],
  clinch: [800, 1_400],
  takedown: [900, 1_800],
  'ground-control': [1_000, 2_500],
  'ground-pound': [800, 1_200],
  submission: [1_000, 2_500],
  recovery: [1_200, 2_500]
};

const FAMILY_VISUAL: Record<MicroActionFamily, FightVisualAction> = {
  movement: 'movement',
  strike: 'strike',
  clinch: 'clinch',
  takedown: 'takedown',
  'ground-control': 'idle',
  'ground-pound': 'ground-pound',
  submission: 'submission',
  recovery: 'recovery'
};

function consumeFightTime(session: FightSession, requestedMs: number): [FightSession, number] {
  const durationMs = Math.min(Math.max(1, Math.trunc(requestedMs)), session.clockMs);
  return [{ ...session, clockMs: session.clockMs - durationMs }, durationMs];
}

function consumeActionTime(session: FightSession, family: MicroActionFamily): [FightSession, number] {
  const [min, max] = ACTION_DURATION_MS[family];
  const [requested, rngState] = randInt(session, min, max);
  return consumeFightTime({ ...session, rngState }, requested);
}

function repetitionPenalty(session: FightSession, family: MicroActionFamily): number {
  const action = FAMILY_VISUAL[family];
  const matches = session.timeline.slice(-5).filter(event => event.visual.action === action).length;
  return 1 / (1 + matches * 2);
}

function queueFinish(session: FightSession, winner: FightCorner | null, method: FightMethod, commentary: string): FightSession {
  return { ...session, pendingFinish: { winner, method, commentary }, pendingRoundEnd: false };
}

function completeActionStep(session: FightSession): FightSession {
  return session.clockMs === 0 && !session.pendingFinish
    ? { ...session, pendingRoundEnd: true }
    : session;
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
    durationMs: 0,
    importance: 'key',
    type: eventType,
    actor: winner ?? undefined,
    target: loser ?? undefined,
    positionBefore: session.position,
    positionAfter: session.position,
    redConditionDelta: 0,
    blueConditionDelta: 0,
    redStaminaDelta: 0,
    blueStaminaDelta: 0,
    headline: formatFightMethod(method, session.language),
    commentary,
    intensity: method === 'Draw' ? 55 : 95,
    visual: { action: 'finish', outcome: 'finished', intensity: method === 'Draw' ? 'light' : 'heavy', finish: finishVisual(session, method) }
  });
  return {
    ...finished,
    phase: 'finished',
    winnerId: winner ? combatant(session, winner).fighter.id : null,
    loserId: loser ? combatant(session, loser).fighter.id : null,
    method,
    finishRound: session.round,
    finishTime: clockTime(ROUND_MS - session.clockMs)
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
  const context = (corner: FightCorner) => (session.controller === corner ? 1.45 : 1) * (session.pressure === corner ? 1.12 : 1);
  const redScore = actionScore(session.red, session.position) * context('red');
  const blueScore = actionScore(session.blue, session.position) * context('blue');
  const [roll, rngState] = rand(session, 0, redScore + blueScore);
  return [roll <= redScore ? 'red' : 'blue', rngState];
}

function addControl(stats: FighterRoundStats, other: FighterRoundStats, seconds: number): number {
  const added = Math.max(0, Math.min(seconds, ROUND_SECONDS - stats.controlSeconds - other.controlSeconds));
  stats.controlSeconds = round1(stats.controlSeconds + added);
  return added;
}

function applyStrike(session: FightSession, actor: FightCorner, family: 'strike' | 'ground-pound' = 'strike'): FightSession {
  const [timed, durationMs] = consumeActionTime(session, family);
  const t = fightT(timed);
  const target = otherCorner(actor);
  const attacker = combatant(timed, actor);
  const defender = combatant(timed, target);
  const beforeRed = timed.red;
  const beforeBlue = timed.blue;
  const positionBefore = timed.position;
  let rngState = timed.rngState;
  const targetZone = timed.position === 'ground'
    ? 'head'
    : timed.position === 'clinch'
      ? ['head', 'body'][stableVisualIndex([timed.matchup.id, timed.timeline.length, actor, timed.round, timed.clockMs, 'zone'], 2)] as NonNullable<FightVisualCue['targetZone']>
      : ['head', 'body', 'leg'][stableVisualIndex([timed.matchup.id, timed.timeline.length, actor, timed.round, timed.clockMs, 'zone'], 3)] as NonNullable<FightVisualCue['targetZone']>;
  const strike = timed.position === 'ground' ? undefined : selectStrikeVisual(timed, actor, targetZone);
  const [accuracyRoll, s1] = rand(timed, 0.55, 1.45); rngState = s1;
  const [powerRoll, s2] = rand({ ...timed, rngState }, 0.65, 1.45); rngState = s2;
  const offense = (attacker.fighter.attributes.striking * 0.55 + attacker.fighter.attributes.speed * 0.2 + attacker.fighter.attributes.fightIq * 0.25) * (0.45 + attacker.stamina / 120) * attacker.modifier * accuracyRoll;
  const defense = (defender.fighter.attributes.defense * 0.6 + defender.fighter.attributes.chin * 0.2 + defender.fighter.attributes.speed * 0.2) * (0.45 + defender.stamina / 130) * defender.modifier;
  const landed = offense > defense * (timed.position === 'ground' ? 0.72 : 0.92);
  const attempted = 1;
  const significant = 1;
  const baseDamage = strike === 'jab' ? 0.55 : strike === 'cross' || strike === 'body-hook' ? 0.9 : strike?.includes('kick') ? 1.1 : 0.95;
  const rawDamage = landed ? baseDamage * (0.35 + attacker.fighter.attributes.power / 190) * powerRoll : 0;
  const attackCost = strike === 'jab' ? 0.08 : strike?.includes('kick') ? 0.18 : 0.12;
  const missOutcome: FightVisualCue['outcome'] = stableVisualIndex([timed.matchup.id, timed.timeline.length, actor, timed.round, timed.clockMs, 'miss'], 2) ? 'blocked' : 'dodged';
  const outcome: FightVisualCue['outcome'] = landed ? 'landed' : missOutcome;
  const defenseCost = outcome === 'blocked' || outcome === 'dodged' ? 0.06 : 0.03;
  let red = spendStamina(timed.red, actor === 'red' ? attackCost : defenseCost);
  let blue = spendStamina(timed.blue, actor === 'blue' ? attackCost : defenseCost);
  const actorStats = currentStats(timed, actor);
  const targetStats = currentStats(timed, target);
  actorStats.totalStrikesAttempted += attempted;
  actorStats.significantStrikesAttempted += significant;
  const headLanded = landed && targetZone === 'head' ? 1 : 0;
  const bodyLanded = landed && targetZone === 'body' ? 1 : 0;
  const legLanded = landed && targetZone === 'leg' ? 1 : 0;
  if (landed) {
    actorStats.totalStrikesLanded += 1;
    actorStats.significantStrikesLanded += significant;
    actorStats.headStrikesLanded += headLanded;
    actorStats.bodyStrikesLanded += bodyLanded;
    actorStats.legStrikesLanded += legLanded;
    actorStats.damageGiven = round1(actorStats.damageGiven + rawDamage);
    targetStats.damageTaken = round1(targetStats.damageTaken + rawDamage);
    if (target === 'red') red = damageState(red, rawDamage, headLanded, bodyLanded, legLanded); else blue = damageState(blue, rawDamage, headLanded, bodyLanded, legLanded);
  }
  let nextPosition = timed.position;
  let type: FightEventType = 'strike';
  let headline: string = landed ? t($ => $.fight.prose.strikeLands, { name: attacker.fighter.lastName }) : t($ => $.fight.prose.strikeMisses, { name: attacker.fighter.lastName });
  let commentary: string = landed
    ? timed.position === 'ground'
      ? t($ => $.fight.prose.groundStrikes, { name: attacker.fighter.lastName })
      : t($ => $.fight.prose.sharpCombination, { name: attacker.fighter.lastName })
    : t($ => $.fight.prose.avoidsAttack, { name: defender.fighter.lastName });
  let intensity = landed ? 35 + rawDamage * 10 : 18;
  const kdThreshold = Math.max(0.85, defender.fighter.attributes.chin / 110 + defender.stamina / 180);
  const [kdRoll, s3] = rand({ ...timed, rngState }, 0, 100); rngState = s3;
  if (timed.position !== 'ground' && landed && targetZone === 'head' && rawDamage > kdThreshold && kdRoll < 7 + attacker.fighter.attributes.power / 11) {
    type = 'knockdown';
    nextPosition = 'ground';
    headline = t($ => $.fight.prose.knockdownHeadline, { name: attacker.fighter.lastName });
    commentary = t($ => $.fight.prose.knockdown, { attacker: attacker.fighter.lastName, defender: defender.fighter.lastName });
    intensity = 88;
    currentStats(timed, actor).knockdowns += 1;
    if (actor === 'red') red = { ...red, knockdowns: red.knockdowns + 1 }; else blue = { ...blue, knockdowns: blue.knockdowns + 1 };
    timed.currentRoundStats.keyMoments.push(t($ => $.fight.prose.knockdownMoment, { round: timed.round, name: attacker.fighter.lastName }));
  }
  const visual: FightVisualCue = timed.position === 'ground'
    ? { action: 'ground-pound', outcome, targetZone, intensity: visualIntensity(intensity) }
    : { action: type === 'knockdown' ? 'knockdown' : 'strike', strike, outcome, targetZone, intensity: visualIntensity(intensity) };
  const next = addEvent(withUpdatedCombatants({ ...timed, position: nextPosition, controller: nextPosition === 'ground' ? actor : timed.controller, pressure: actor, rngState }, red, blue), {
    durationMs,
    importance: type === 'knockdown' ? 'key' : landed && significant ? 'notable' : 'routine',
    type,
    actor,
    target,
    positionBefore,
    positionAfter: nextPosition,
    redConditionDelta: red.condition - beforeRed.condition,
    blueConditionDelta: blue.condition - beforeBlue.condition,
    redStaminaDelta: red.stamina - beforeRed.stamina,
    blueStaminaDelta: blue.stamina - beforeBlue.stamina,
    headline,
    commentary,
    intensity,
    visual
  });
  const checked = checkImmediateFinish(next, actor, target);
  return completeActionStep(checked.pendingFinish || type !== 'knockdown' || kdRoll >= 18
    ? checked
    : queueFinish(checked, actor, 'KO/TKO', t($ => $.fight.prose.refereeStoppage, { name: attacker.fighter.lastName })));
}
function applyTakedown(session: FightSession, actor: FightCorner): FightSession {
  const [timed, durationMs] = consumeActionTime(session, 'takedown');
  const t = fightT(timed);
  const target = otherCorner(actor);
  const attacker = combatant(timed, actor);
  const defender = combatant(timed, target);
  const beforeRed = timed.red;
  const beforeBlue = timed.blue;
  let rngState = timed.rngState;
  const [roll, s1] = rand(timed, 0.75, 1.25); rngState = s1;
  const attack = (attacker.fighter.attributes.wrestling * 0.65 + attacker.fighter.attributes.grappling * 0.2 + attacker.fighter.attributes.fightIq * 0.15) * (0.45 + attacker.stamina / 125) * attacker.modifier * roll;
  const defense = (defender.fighter.attributes.wrestling * 0.45 + defender.fighter.attributes.defense * 0.35 + defender.fighter.attributes.speed * 0.2) * (0.45 + defender.stamina / 130) * defender.modifier;
  const landed = attack > defense * (timed.position === 'clinch' ? 0.92 : 1.08);
  let red = spendStamina(timed.red, actor === 'red' ? 0.22 : 0.1);
  let blue = spendStamina(timed.blue, actor === 'blue' ? 0.22 : 0.1);
  const stats = currentStats(timed, actor);
  stats.takedownsAttempted += 1;
  if (landed) {
    stats.takedownsLanded += 1;
    const controlSeconds = addControl(stats, currentStats(timed, target), durationMs / 1_000);
    if (actor === 'red') red = { ...red, accumulatedControlSeconds: round1(red.accumulatedControlSeconds + controlSeconds) }; else blue = { ...blue, accumulatedControlSeconds: round1(blue.accumulatedControlSeconds + controlSeconds) };
    timed.currentRoundStats.keyMoments.push(t($ => $.fight.prose.takedownMoment, { round: timed.round, name: attacker.fighter.lastName }));
  }
  const nextPosition: FightPosition = landed ? 'ground' : timed.position;
  const next = addEvent(withUpdatedCombatants({ ...timed, position: nextPosition, controller: landed ? actor : null, pressure: actor, rngState }, red, blue), {
    durationMs,
    importance: landed ? 'notable' : 'routine',
    type: landed ? 'takedown' : 'clinch',
    actor,
    target,
    positionBefore: timed.position,
    positionAfter: nextPosition,
    redConditionDelta: red.condition - beforeRed.condition,
    blueConditionDelta: blue.condition - beforeBlue.condition,
    redStaminaDelta: red.stamina - beforeRed.stamina,
    blueStaminaDelta: blue.stamina - beforeBlue.stamina,
    headline: landed ? t($ => $.fight.prose.takedownHeadline, { name: attacker.fighter.lastName }) : t($ => $.fight.prose.clinchHeadline, { name: attacker.fighter.lastName }),
    commentary: landed ? t($ => $.fight.prose.takedown, { name: attacker.fighter.lastName }) : t($ => $.fight.prose.clinch, { name: defender.fighter.lastName }),
    intensity: landed ? 55 : 32,
    visual: landed
      ? { action: 'takedown', outcome: 'landed', intensity: 'light', transition: timed.position === 'clinch' ? 'ground-to-clinch' : undefined }
      : { action: stableVisualIndex([timed.matchup.id, timed.timeline.length, actor, timed.round, timed.clockMs, 'takedown-defense'], 2) ? 'sprawl' : 'takedown-defense', outcome: 'failed', intensity: 'light' }
  });
  return completeActionStep(next);
}

function applySubmission(session: FightSession, actor: FightCorner): FightSession {
  const [timed, durationMs] = consumeActionTime(session, 'submission');
  const t = fightT(timed);
  const target = otherCorner(actor);
  const attacker = combatant(timed, actor);
  const defender = combatant(timed, target);
  const beforeRed = timed.red;
  const beforeBlue = timed.blue;
  let rngState = timed.rngState;
  const [roll, s1] = rand(timed, 0.65, 1.45); rngState = s1;
  const attack = (attacker.fighter.attributes.submissions * 0.6 + attacker.fighter.attributes.grappling * 0.25 + attacker.fighter.attributes.fightIq * 0.15) * (0.35 + attacker.stamina / 125) * attacker.modifier * roll;
  const defense = (defender.fighter.attributes.grappling * 0.55 + defender.fighter.attributes.fightIq * 0.25 + defender.fighter.attributes.toughness * 0.2) * (0.35 + defender.stamina / 130) * defender.modifier;
  const close = attack > defense * 0.92;
  let red = spendStamina(timed.red, actor === 'red' ? 0.2 : 0.1);
  let blue = spendStamina(timed.blue, actor === 'blue' ? 0.2 : 0.1);
  currentStats(timed, actor).submissionAttempts += 1;
  if (actor === 'red') red = { ...red, submissionAttempts: red.submissionAttempts + 1 }; else blue = { ...blue, submissionAttempts: blue.submissionAttempts + 1 };
  if (close) timed.currentRoundStats.keyMoments.push(t($ => $.fight.prose.submissionMoment, { round: timed.round, name: attacker.fighter.lastName }));
  const [finishRoll, s2] = rand({ ...timed, rngState }, 0, 100); rngState = s2;
  const finishChance = close ? clamp(0.7 + (attack - defense) / 16 + (100 - defender.stamina) / 36, 0.4, 8) : 0.04;
  const finished = finishRoll < finishChance;
  const next = addEvent(withUpdatedCombatants({ ...timed, controller: actor, rngState }, red, blue), {
    durationMs,
    importance: close ? 'notable' : 'routine',
    type: 'submission-attempt',
    actor,
    target,
    positionBefore: timed.position,
    positionAfter: timed.position,
    redConditionDelta: red.condition - beforeRed.condition,
    blueConditionDelta: blue.condition - beforeBlue.condition,
    redStaminaDelta: red.stamina - beforeRed.stamina,
    blueStaminaDelta: blue.stamina - beforeBlue.stamina,
    headline: t($ => $.fight.prose.submissionHeadline, { name: attacker.fighter.lastName }),
    commentary: close ? t($ => $.fight.prose.submissionDanger, { name: attacker.fighter.lastName }) : t($ => $.fight.prose.submissionEscape, { name: defender.fighter.lastName }),
    intensity: close ? 78 : 42,
    visual: { action: 'submission', outcome: finished ? 'finished' : close ? 'landed' : 'escaped', intensity: close ? 'heavy' : 'light' }
  });
  return finished
    ? queueFinish(next, actor, 'Submission', t($ => $.fight.prose.submissionFinish, { attacker: attacker.fighter.lastName, defender: defender.fighter.lastName }))
    : completeActionStep(next);
}

function applyMovement(session: FightSession, actor: FightCorner): FightSession {
  const [timed, durationMs] = consumeActionTime(session, 'movement');
  const target = otherCorner(actor);
  const retreating = timed.pressure === target;
  const red = spendStamina(timed.red, actor === 'red' ? 0.05 : 0.03);
  const blue = spendStamina(timed.blue, actor === 'blue' ? 0.05 : 0.03);
  const contextual = { ...withUpdatedCombatants(timed, red, blue), pressure: retreating ? null : actor };
  return completeActionStep(addEvent(contextual, {
    durationMs,
    importance: 'routine',
    type: 'position-change',
    actor,
    target,
    positionBefore: timed.position,
    positionAfter: timed.position,
    redConditionDelta: 0,
    blueConditionDelta: 0,
    redStaminaDelta: red.stamina - timed.red.stamina,
    blueStaminaDelta: blue.stamina - timed.blue.stamina,
    headline: '',
    commentary: '',
    intensity: 10,
    visual: { action: 'movement', outcome: 'landed', intensity: 'light', transition: retreating ? 'disengage' : 'close-distance' }
  }));
}

function applyGroundControl(session: FightSession, actor: FightCorner): FightSession {
  const [timed, durationMs] = consumeActionTime(session, 'ground-control');
  const stats = currentStats(timed, actor);
  const added = addControl(stats, currentStats(timed, otherCorner(actor)), durationMs / 1_000);
  const state = combatant(timed, actor);
  const updated = { ...state, accumulatedControlSeconds: round1(state.accumulatedControlSeconds + added) };
  const next = actor === 'red' ? { ...timed, red: updated, controller: actor } : { ...timed, blue: updated, controller: actor };
  return completeActionStep(addEvent(next, {
    durationMs,
    importance: 'routine',
    type: 'position-change',
    actor,
    target: otherCorner(actor),
    positionBefore: 'ground',
    positionAfter: 'ground',
    redConditionDelta: 0,
    blueConditionDelta: 0,
    redStaminaDelta: 0,
    blueStaminaDelta: 0,
    headline: '',
    commentary: '',
    intensity: 12,
    visual: { action: 'idle', outcome: 'landed', intensity: 'light' }
  }));
}

function applyPositionChange(session: FightSession, actor: FightCorner): FightSession {
  const [timed, durationMs] = consumeActionTime(session, session.position === 'ground' ? 'recovery' : session.position === 'clinch' ? 'clinch' : 'movement');
  const t = fightT(timed);
  const target = otherCorner(actor);
  const beforeRed = timed.red;
  const beforeBlue = timed.blue;
  const before = timed.position;
  let rngState = timed.rngState;
  const [roll, s1] = rand(timed, 0, 100); rngState = s1;
  const nextPosition: FightPosition = before === 'ground' ? (roll < 72 ? 'distance' : 'clinch') : before === 'clinch' ? 'distance' : 'clinch';
  let red = spendStamina(timed.red, actor === 'red' ? 0.1 : 0.05);
  let blue = spendStamina(timed.blue, actor === 'blue' ? 0.1 : 0.05);
  if (before === 'ground') currentStats(timed, actor).reversals += 1;
  return completeActionStep(addEvent(withUpdatedCombatants({ ...timed, position: nextPosition, controller: null, pressure: nextPosition === 'distance' ? null : actor, rngState }, red, blue), {
    durationMs,
    importance: 'notable',
    type: 'position-change',
    actor,
    target,
    positionBefore: before,
    positionAfter: nextPosition,
    redConditionDelta: red.condition - beforeRed.condition,
    blueConditionDelta: blue.condition - beforeBlue.condition,
    redStaminaDelta: red.stamina - beforeRed.stamina,
    blueStaminaDelta: blue.stamina - beforeBlue.stamina,
    headline: t($ => $.fight.prose.positionHeadline, { name: combatant(timed, actor).fighter.lastName }),
    commentary: t($ => $.fight.prose.positionChange, { name: combatant(timed, actor).fighter.lastName, before: positionLabel(before, timed.language), after: positionLabel(nextPosition, timed.language) }),
    intensity: 28,
    visual: {
      action: before === 'ground' && nextPosition === 'distance' ? 'recovery' : nextPosition === 'clinch' ? 'clinch' : 'movement',
      outcome: 'landed',
      intensity: 'light',
      transition: before === 'ground' && nextPosition === 'distance' ? 'ground-to-distance' : before === 'ground' ? 'ground-to-clinch' : nextPosition === 'distance' ? 'disengage' : 'close-distance'
    }
  }));
}

function checkImmediateFinish(session: FightSession, actor: FightCorner, target: FightCorner): FightSession {
  const t = fightT(session);
  const defender = combatant(session, target);
  if (defender.condition <= 0) {
    return queueFinish(session, actor, 'KO/TKO', t($ => $.fight.prose.refereeStoppage, { name: combatant(session, actor).fighter.lastName }));
  }
  if (defender.cutSeverity >= 92) {
    return queueFinish(session, actor, 'Doctor Stoppage', t($ => $.fight.prose.doctorStoppage, { name: defender.fighter.lastName }));
  }
  return session;
}

function finishPreExistingZeroCondition(session: FightSession): FightSession {
  if (session.red.condition > 0 && session.blue.condition > 0) return session;
  const winner: FightCorner = session.red.condition <= 0 && session.blue.condition <= 0
    ? (session.red.damage < session.blue.damage ? 'red' : session.blue.damage < session.red.damage ? 'blue' : 'red')
    : session.red.condition <= 0 ? 'blue' : 'red';
  return finishSession(session, winner, 'KO/TKO', fightT(session)($ => $.fight.prose.compromisedStoppage, { name: combatant(session, winner).fighter.lastName }));
}

function scoreRound(session: FightSession): RoundStats {
  const t = fightT(session);
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
    summary: redTechnical === blueTechnical ? t($ => $.fight.prose.closeRound) : t($ => $.fight.prose.edgedRound, { name: redTechnical > blueTechnical ? session.red.fighter.lastName : session.blue.fighter.lastName }),
    keyMoments: [...session.currentRoundStats.keyMoments],
    dominanceLevel: gap > 55 ? 'near_finish' : gap > 35 ? 'dominant' : gap > 15 ? 'clear' : 'close'
  };
}

function endRound(session: FightSession): FightSession {
  const t = fightT(session);
  const roundStats = scoreRound(session);
  const judgeTotals = session.judgeTotals.map((judge, index) => ({
    judgeId: judge.judgeId,
    red: judge.red + roundStats.judges[index].redScore,
    blue: judge.blue + roundStats.judges[index].blueScore
  }));
  const ended = addEvent({ ...session, clockMs: 0, phase: 'between-rounds' }, {
    durationMs: 0,
    importance: 'key',
    type: 'round-end',
    positionBefore: session.position,
    positionAfter: session.position,
    redConditionDelta: 0,
    blueConditionDelta: 0,
    redStaminaDelta: 0,
    blueStaminaDelta: 0,
    headline: t($ => $.fight.prose.roundEndsHeadline, { round: session.round }),
    commentary: t($ => $.fight.prose.roundEnds, { round: session.round, summary: roundStats.summary }),
    intensity: roundStats.dominanceLevel === 'near_finish' ? 75 : 42,
    visual: { action: 'idle', intensity: roundStats.dominanceLevel === 'near_finish' ? 'heavy' : 'light' }
  });
  return { ...ended, roundStats: [...session.roundStats, roundStats], judgeTotals };
}

function recoverBetweenRounds(session: FightSession): FightSession {
  const t = fightT(session);
  let rngState = session.rngState;
  const [redRecovery, s1] = rand(session, 7, 13); rngState = s1;
  const [blueRecovery, s2] = rand({ ...session, rngState }, 7, 13); rngState = s2;
  const red = { ...session.red, stamina: round1(clamp(session.red.stamina + redRecovery + session.red.fighter.attributes.cardio / 18)) };
  const blue = { ...session.blue, stamina: round1(clamp(session.blue.stamina + blueRecovery + session.blue.fighter.attributes.cardio / 18)) };
  const recoveringCorner = session.position === 'ground' && session.controller ? otherCorner(session.controller) : undefined;
  const recovered = addEvent(withUpdatedCombatants({ ...session, rngState }, red, blue), {
    durationMs: 0,
    importance: 'key',
    type: 'recovery',
    actor: recoveringCorner,
    target: recoveringCorner ? otherCorner(recoveringCorner) : undefined,
    positionBefore: session.position,
    positionAfter: 'distance',
    redConditionDelta: 0,
    blueConditionDelta: 0,
    redStaminaDelta: red.stamina - session.red.stamina,
    blueStaminaDelta: blue.stamina - session.blue.stamina,
    headline: t($ => $.fight.prose.recoveryHeadline),
    commentary: t($ => $.fight.prose.recovery),
    intensity: 12,
    visual: { action: 'recovery', intensity: 'light', transition: session.position === 'ground' ? 'ground-to-distance' : 'disengage' }
  });
  return {
    ...recovered,
    phase: 'fighting',
    round: session.round + 1,
    clockMs: ROUND_MS,
    position: 'distance',
    pressure: null,
    controller: null,
    currentRoundStats: { red: emptyFighterRoundStats(red.stamina), blue: emptyFighterRoundStats(blue.stamina), keyMoments: [] }
  };
}

function finishDecision(session: FightSession): FightSession {
  const t = fightT(session);
  const redCards = session.judgeTotals.filter(card => card.red > card.blue).length;
  const blueCards = session.judgeTotals.filter(card => card.blue > card.red).length;
  const draws = session.judgeTotals.length - redCards - blueCards;
  const scorecards = session.judgeTotals.map(card => `${card.red}-${card.blue}`);
  if (redCards >= 2) {
    return { ...finishSession({ ...session, scorecards }, 'red', redCards === 3 ? 'Unanimous Decision' : draws === 1 ? 'Majority Decision' : 'Split Decision', t($ => $.fight.prose.decisionWinner, { scorecards: scorecards.join(', '), name: session.red.fighter.lastName })), scorecards };
  }
  if (blueCards >= 2) {
    return { ...finishSession({ ...session, scorecards }, 'blue', blueCards === 3 ? 'Unanimous Decision' : draws === 1 ? 'Majority Decision' : 'Split Decision', t($ => $.fight.prose.decisionWinner, { scorecards: scorecards.join(', '), name: session.blue.fighter.lastName })), scorecards };
  }
  return { ...finishSession({ ...session, scorecards }, null, 'Draw', t($ => $.fight.prose.decisionDraw, { scorecards: scorecards.join(', ') })), scorecards };
}

function shouldGrapple(state: FightCombatantState, opponent: FightCombatantState): number {
  const attrs = state.fighter.attributes;
  const gap = attrs.wrestling + attrs.grappling - opponent.fighter.attributes.wrestling - opponent.fighter.attributes.grappling;
  return clamp((16 + gap / 4 + (attrs.wrestling > attrs.striking ? 14 : 0) + (100 - state.stamina) / 8) * styleBias(state.fighter.style, 'grapple'), 5, 55);
}

function shouldSubmit(state: FightCombatantState, opponent: FightCombatantState): number {
  return clamp((18 + state.fighter.attributes.submissions / 4 - opponent.fighter.attributes.grappling / 5) * styleBias(state.fighter.style, 'submission'), 8, 50);
}

function weightedFamily(session: FightSession, attacker: FightCombatantState, defender: FightCombatantState): [MicroActionFamily, number] {
  const stamina = 0.55 + attacker.stamina / 180;
  const choices: Array<{ action: MicroActionFamily; weight: number }> = session.position === 'ground'
    ? [
        { action: 'ground-control', weight: 24 },
        { action: 'ground-pound', weight: 42 * styleBias(attacker.fighter.style, 'strike') },
        { action: 'submission', weight: shouldSubmit(attacker, defender) },
        { action: 'recovery', weight: 18 }
      ]
    : session.position === 'clinch'
      ? [
          { action: 'strike', weight: 44 * styleBias(attacker.fighter.style, 'strike') },
          { action: 'takedown', weight: shouldGrapple(attacker, defender) },
          { action: 'movement', weight: 18 }
        ]
      : [
          { action: 'movement', weight: 28 },
          { action: 'strike', weight: 62 * styleBias(attacker.fighter.style, 'strike') },
          { action: 'takedown', weight: shouldGrapple(attacker, defender) * 0.55 }
        ];
  const weighted = choices.map(choice => ({ ...choice, weight: Math.max(0.1, choice.weight * stamina * repetitionPenalty(session, choice.action)) }));
  const total = weighted.reduce((sum, choice) => sum + choice.weight, 0);
  const [roll, rngState] = rand(session, 0, total);
  let cursor = 0;
  for (const choice of weighted) {
    cursor += choice.weight;
    if (roll <= cursor) return [choice.action, rngState];
  }
  return [weighted.at(-1)!.action, rngState];
}

function fightTick(session: FightSession): FightSession {
  const [actor, actorState] = chooseActor(session);
  const acting = { ...session, rngState: actorState };
  const attacker = combatant(acting, actor);
  const defender = combatant(acting, otherCorner(actor));
  const [family, rngState] = weightedFamily(acting, attacker, defender);
  const selected = { ...acting, rngState };
  if (family === 'movement') return selected.position === 'distance' ? applyMovement(selected, actor) : applyPositionChange(selected, actor);
  if (family === 'takedown') return applyTakedown(selected, actor);
  if (family === 'submission') return applySubmission(selected, actor);
  if (family === 'ground-control') return applyGroundControl(selected, selected.controller ?? actor);
  if (family === 'ground-pound') return applyStrike(selected, selected.controller ?? actor, 'ground-pound');
  if (family === 'recovery') return applyPositionChange(selected, otherCorner(selected.controller ?? actor));
  return applyStrike(selected, actor);
}

export function createFightSession(matchup: FightMatchup, red: Fighter, blue: Fighter, seed?: number, language: Language = 'en'): FightSession {
  const t = fixedT(language);
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
    language,
    matchup: normalizedMatchup,
    red: redState,
    blue: blueState,
    phase: 'fighting',
    round: 1,
    clockMs: ROUND_MS,
    position: 'distance',
    pressure: null,
    controller: null,
    pendingRoundEnd: false,
    pendingFinish: null,
    rngState,
    timeline: [],
    roundStats: [],
    currentRoundStats: { red: emptyFighterRoundStats(redState.stamina), blue: emptyFighterRoundStats(blueState.stamina), keyMoments: [] },
    judgeTotals: [1, 2, 3].map(index => ({ judgeId: `Judge ${index}`, red: 0, blue: 0 })),
    scorecards: [],
    winnerId: null,
    loserId: null,
    method: null,
    finishRound: null,
    finishTime: null
  };
  return addEvent(session, {
    durationMs: 0,
    importance: 'key',
    type: 'round-start',
    positionBefore: 'distance',
    positionAfter: 'distance',
    redConditionDelta: 0,
    blueConditionDelta: 0,
    redStaminaDelta: 0,
    blueStaminaDelta: 0,
    headline: t($ => $.fight.prose.roundBeginsHeadline, { round: 1 }),
    commentary: t($ => $.fight.prose.roundBegins, { round: 1, red: red.lastName, blue: blue.lastName }),
    intensity: 20,
    visual: { action: 'idle', intensity: 'light' }
  });
}

export function stepFightSession(session: FightSession): FightSession {
  if (session.phase === 'finished') return session;
  const snapshot = cloneFightSessionForStep(session);
  if (snapshot.pendingFinish) {
    const { winner, method, commentary } = snapshot.pendingFinish;
    return finishSession({ ...snapshot, pendingFinish: null }, winner, method, commentary);
  }
  const stopped = finishPreExistingZeroCondition(snapshot);
  if (stopped.phase === 'finished') return stopped;
  if (snapshot.pendingRoundEnd) return endRound({ ...snapshot, pendingRoundEnd: false });
  if (snapshot.phase === 'between-rounds') {
    return snapshot.round >= snapshot.matchup.rounds ? finishDecision(snapshot) : recoverBetweenRounds(snapshot);
  }
  return fightTick(snapshot);
}

export function runFightSession(session: FightSession): FightSession {
  let next = session;
  const maxSteps = session.matchup.rounds * MAX_EVENTS_PER_ROUND;
  for (let step = 0; step < maxSteps && next.phase !== 'finished'; step++) next = stepFightSession(next);
  if (next.phase !== 'finished') throw new Error(`Fight session did not finish within ${maxSteps} steps`);
  return next;
}

function resultRandom(state: { value: number }, min: number, max: number): number {
  state.value = nextSeed(state.value);
  return min + state.value / RNG_MOD * (max - min);
}

function resultHighlights(session: FightSession): string[] {
  return Array.from({ length: session.matchup.rounds }, (_, index) => index + 1).flatMap(round => {
    const events = session.timeline.filter(event => event.round === round && event.importance !== 'routine');
    const selected = [...events.filter(event => event.importance === 'key'), ...events.filter(event => event.importance === 'notable')]
      .filter((event, index, all) => all.findIndex(candidate => candidate.sequence === event.sequence) === index)
      .slice(0, 12)
      .sort((a, b) => a.sequence - b.sequence);
    return selected.map(event => event.commentary).filter(Boolean);
  });
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
    commentary: resultHighlights(session),
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
  if (!Number.isInteger(session.clockMs) || session.clockMs < 0 || session.clockMs > ROUND_MS) errors.push('Clock out of bounds');
  ([['red', session.red], ['blue', session.blue]] as const).forEach(([corner, state]) => {
    if (!Number.isFinite(state.condition) || state.condition < 0 || state.condition > 100) errors.push(`${corner} condition out of bounds`);
    if (session.phase !== 'finished' && !session.pendingFinish && state.condition <= 0) errors.push(`${corner} active condition must be positive`);
    if (!Number.isFinite(state.stamina) || state.stamina < 0 || state.stamina > 100) errors.push(`${corner} stamina out of bounds`);
    if (![state.damage, state.headDamage, state.bodyDamage, state.legDamage, state.cutSeverity].every(Number.isFinite) || state.damage < 0 || state.headDamage < 0 || state.bodyDamage < 0 || state.legDamage < 0 || state.cutSeverity < 0 || state.cutSeverity > 100) errors.push(`${corner} damage out of bounds`);
  });
  session.timeline.forEach((event, index) => {
    if (event.sequence !== index + 1) errors.push(`Timeline sequence ${index + 1} is unstable`);
    if (event.round < 1 || event.round > session.matchup.rounds) errors.push(`Timeline event ${event.sequence} round out of bounds`);
    if (!Number.isInteger(event.durationMs) || event.durationMs < 0) errors.push(`Timeline event ${event.sequence} duration invalid`);
    if (event.clockBeforeMs < event.clockAfterMs || event.clockBeforeMs > ROUND_MS || event.clockAfterMs < 0) errors.push(`Timeline event ${event.sequence} clock out of bounds`);
    if (event.clockBeforeMs - event.clockAfterMs !== event.durationMs) errors.push(`Timeline event ${event.sequence} timing mismatch`);
    const marker = ['round-start', 'round-end', 'recovery', 'finish'].includes(event.type);
    if (marker !== (event.durationMs === 0)) errors.push(`Timeline event ${event.sequence} marker duration invalid`);
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
