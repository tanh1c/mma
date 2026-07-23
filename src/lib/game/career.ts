import { differenceInCalendarDays } from 'date-fns';
import type { CareerPhase, Fighter, FighterAttributes, FighterStyle, GameState, RetirementReason, WeightClass, WeightClassTitleState } from '../../types/game';
import '../../i18n';
import { fixedT, readLanguage, type Language } from '../localization';
import { FIGHTER_STYLES, GAME_CONSTANTS, WEIGHT_CLASSES } from './constants';
import { getFighterOverall, growthPriorities, normalizePhysicalProfile } from './fighterRatings';
import { buildPromotionRankings } from './rankings';
import { cancelTournament, getPendingTitleShotDebts, isFighterBookedUpcoming, repairScheduledTournamentRound } from './tournament';

export function stableCareerSeed(...parts: Array<string | number>): number {
  let hash = 2166136261;
  for (const character of parts.join(':')) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function derivePrimeEndAge(fighter: Pick<Fighter, 'id' | 'style' | 'attributes' | 'injuryStatus'>): number {
  const { cardio, toughness, fightIq } = fighter.attributes;
  const durableStyle = ['Wrestler', 'BJJ', 'Sambo', 'Balanced'].includes(fighter.style) ? 1 : 0;
  const traits = (cardio + toughness + fightIq) / 3;
  const traitBonus = traits >= 80 ? 2 : traits >= 68 ? 1 : traits < 52 ? -1 : 0;
  const injuryPenalty = fighter.injuryStatus ? 1 : 0;
  const identityVariation = stableCareerSeed(fighter.id, 'prime-end') % 3 - 1;
  return Math.max(30, Math.min(34, 32 + durableStyle + traitBonus + identityVariation - injuryPenalty));
}

export function deriveCareerPhase(age: number, primeEndAge: number, retiredDate?: string): CareerPhase {
  if (retiredDate) return 'retired';
  if (age < primeEndAge - 3) return 'developing';
  if (age <= primeEndAge) return 'prime';
  return 'declining';
}

export function ensureCareerMetadata(fighter: Fighter, currentYear: number): Fighter {
  const primeEndAge = Number.isInteger(fighter.primeEndAge) && fighter.primeEndAge >= 30 && fighter.primeEndAge <= 34
    ? fighter.primeEndAge
    : derivePrimeEndAge(fighter);
  const retiredDate = typeof fighter.retiredDate === 'string' ? fighter.retiredDate : undefined;
  const careerPhase = deriveCareerPhase(fighter.age, primeEndAge, retiredDate);
  return {
    ...fighter,
    potential: careerPhase === 'declining' || careerPhase === 'retired' ? getFighterOverall(fighter) : fighter.potential,
    primeEndAge,
    careerPhase,
    lastLifecycleYear: Number.isInteger(fighter.lastLifecycleYear) ? fighter.lastLifecycleYear : currentYear,
    retiredDate,
    retirementReason: retiredDate ? fighter.retirementReason : undefined,
    hallOfFame: fighter.hallOfFame
  };
}

export interface FighterEditInput {
  firstName: string;
  lastName: string;
  nickname: string;
  age: number;
  nationality: string;
  weightClass: WeightClass;
  heightCm: number;
  fightWeightLb: number;
  walkAroundWeightLb: number;
  style: FighterStyle;
  attributes: FighterAttributes;
  potential: number;
  popularity: number;
  morale: number;
  momentum: number;
  fatigue: number;
}

export type FighterEditError =
  | 'fighter-not-found'
  | 'invalid-name'
  | 'invalid-nationality'
  | 'invalid-age'
  | 'invalid-weight-class'
  | 'invalid-style'
  | 'invalid-attributes'
  | 'invalid-potential'
  | 'invalid-popularity'
  | 'invalid-morale'
  | 'invalid-momentum'
  | 'invalid-fatigue'
  | 'invalid-physical-profile'
  | 'weight-class-title'
  | 'weight-class-booked'
  | 'weight-class-tournament'
  | 'weight-class-title-shot';

export type FighterEditResult =
  | { ok: true; state: GameState; fighter: Fighter }
  | { ok: false; state: GameState; error: FighterEditError };

function integerInRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

export function applyFighterEdit(state: GameState, fighterId: string, input: FighterEditInput): FighterEditResult {
  const fighter = state.fighters[fighterId];
  if (!fighter) return { ok: false, state, error: 'fighter-not-found' };
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const nickname = input.nickname.trim();
  const nationality = input.nationality.trim();
  if (!firstName || !lastName || firstName.length > 50 || lastName.length > 50 || nickname.length > 50) return { ok: false, state, error: 'invalid-name' };
  if (!nationality || nationality.length > 50) return { ok: false, state, error: 'invalid-nationality' };
  if (!integerInRange(input.age, GAME_CONSTANTS.MIN_AGE, GAME_CONSTANTS.MAX_AGE)) return { ok: false, state, error: 'invalid-age' };
  if (!WEIGHT_CLASSES.includes(input.weightClass)) return { ok: false, state, error: 'invalid-weight-class' };
  if (!FIGHTER_STYLES.includes(input.style)) return { ok: false, state, error: 'invalid-style' };
  const attributeKeys = Object.keys(fighter.attributes) as Array<keyof FighterAttributes>;
  if (attributeKeys.some(key => !Number.isFinite(input.attributes[key]) || input.attributes[key] < GAME_CONSTANTS.MIN_ATTRIBUTES || input.attributes[key] > GAME_CONSTANTS.MAX_ATTRIBUTES)) return { ok: false, state, error: 'invalid-attributes' };
  for (const [value, error] of [
    [input.potential, 'invalid-potential'],
    [input.popularity, 'invalid-popularity'],
    [input.morale, 'invalid-morale'],
    [input.momentum, 'invalid-momentum'],
    [input.fatigue, 'invalid-fatigue']
  ] as const) {
    if (!integerInRange(value, 0, 100)) return { ok: false, state, error };
  }
  if (input.weightClass !== fighter.weightClass) {
    if (Object.values(state.titles).some(title => title.undisputedChampionId === fighterId || title.interimChampionId === fighterId)) return { ok: false, state, error: 'weight-class-title' };
    if (isFighterBookedUpcoming(state, fighterId)) return { ok: false, state, error: 'weight-class-booked' };
    if (Object.values(state.tournaments).some(tournament => (tournament.status === 'planned' || tournament.status === 'active') && (tournament.participants.some(participant => participant.fighterId === fighterId) || tournament.reserveFighterIds.includes(fighterId) || tournament.fights.some(fight => fight.redFighterId === fighterId || fight.blueFighterId === fighterId)))) return { ok: false, state, error: 'weight-class-tournament' };
    if (getPendingTitleShotDebts(state).some(debt => debt.fighterId === fighterId)) return { ok: false, state, error: 'weight-class-title-shot' };
  }
  const physical = { heightCm: input.heightCm, fightWeightLb: input.fightWeightLb, walkAroundWeightLb: input.walkAroundWeightLb };
  const normalizedPhysical = normalizePhysicalProfile({ ...fighter, ...physical, weightClass: input.weightClass });
  if (!integerInRange(input.heightCm, 1, 300) || !integerInRange(input.fightWeightLb, 1, 500) || !integerInRange(input.walkAroundWeightLb, 1, 500) || Object.keys(physical).some(key => physical[key as keyof typeof physical] !== normalizedPhysical[key as keyof typeof normalizedPhysical])) {
    return { ok: false, state, error: 'invalid-physical-profile' };
  }
  const attributes = { ...input.attributes };
  const phase = deriveCareerPhase(input.age, fighter.primeEndAge, fighter.retiredDate);
  const draft = {
    ...fighter,
    firstName,
    lastName,
    nickname,
    age: input.age,
    nationality,
    weightClass: input.weightClass,
    ...physical,
    style: input.style,
    attributes,
    popularity: input.popularity,
    morale: input.morale,
    momentum: input.momentum,
    fatigue: input.fatigue,
    careerPhase: phase
  };
  const overall = getFighterOverall(draft);
  const edited = { ...draft, potential: phase === 'declining' || phase === 'retired' ? overall : Math.max(overall, input.potential) };
  const editedState = { ...state, fighters: { ...state.fighters, [fighterId]: edited } };
  const { newRankings } = buildPromotionRankings(editedState);
  const nextState = { ...editedState, rankings: newRankings };
  return { ok: true, state: nextState, fighter: nextState.fighters[fighterId] };
}

export interface AnnualCareerOutcome {
  fighter: Fighter;
  shouldRetire: boolean;
  retirementReason?: RetirementReason;
}

export interface RecentCareerForm {
  fights: number;
  wins: number;
  losses: number;
  performance: number;
  inactivityDays: number;
  losingStreak: number;
}

export function getRecentCareerForm(state: GameState, fighterId: string, year: number): RecentCareerForm {
  const fighter = state.fighters[fighterId];
  const periodEnd = new Date(`${year}-01-01`);
  const periodStart = new Date(`${year - 1}-01-01`);
  const fights = Object.values(state.fightArchive)
    .filter(fight => {
      const date = new Date(fight.date);
      return date >= periodStart && date < periodEnd && (fight.redFighterId === fighterId || fight.blueFighterId === fighterId);
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const wins = fights.filter(fight => fight.winnerId === fighterId).length;
  const losses = fights.filter(fight => fight.winnerId && fight.winnerId !== fighterId).length;
  let losingStreak = 0;
  for (let index = fights.length - 1; index >= 0; index--) {
    if (!fights[index].winnerId || fights[index].winnerId === fighterId) break;
    losingStreak++;
  }
  return {
    fights: fights.length,
    wins,
    losses,
    performance: fights.length ? fights.reduce((total, fight) => total + fight.performanceRating, 0) / fights.length : 0,
    inactivityDays: fighter?.lastFightDate ? Math.max(0, differenceInCalendarDays(periodEnd, new Date(fighter.lastFightDate))) : 730,
    losingStreak
  };
}

function applyDevelopment(fighter: Fighter, form: RecentCareerForm, year: number): Fighter {
  const overall = getFighterOverall(fighter);
  const headroom = fighter.potential - overall;
  if (headroom <= 0) return fighter;
  const active = form.fights >= 2 ? 1 : form.fights === 1 ? 0 : -1;
  const results = form.wins >= 2 || form.performance >= 80 ? 1 : 0;
  const inactivity = form.inactivityDays > 548 ? 2 : form.inactivityDays > 274 ? 1 : 0;
  const injury = fighter.injuryStatus ? 1 : 0;
  const phaseCap = fighter.careerPhase === 'prime' ? 1 : 3;
  const budget = Math.max(0, Math.min(phaseCap, 1 + active + results - inactivity - injury, Math.ceil(headroom / 3)));
  const attributes = { ...fighter.attributes };
  const priorities = growthPriorities[fighter.style];
  for (let index = 0; index < budget; index++) {
    const priorityIndex = stableCareerSeed(fighter.id, year, 'development', index) % priorities.length;
    const key = priorities[priorityIndex];
    const before = attributes[key];
    attributes[key] = Math.min(95, before + 1);
    if (getFighterOverall({ ...fighter, attributes }) > fighter.potential) attributes[key] = before;
  }
  const developed = { ...fighter, attributes };
  if (fighter.careerPhase !== 'prime') return developed;
  return { ...developed, potential: Math.max(getFighterOverall(developed), fighter.potential - 1) };
}

const earlyDecline: Array<keyof FighterAttributes> = ['speed', 'cardio', 'chin'];
const technicalDecline: Array<keyof FighterAttributes> = ['striking', 'wrestling', 'grappling', 'submissions', 'defense'];
const preservedDecline: Array<keyof FighterAttributes> = ['power', 'toughness', 'fightIq'];

function lowerAttributes(attributes: FighterAttributes, keys: Array<keyof FighterAttributes>, amount: number): void {
  for (const key of keys) attributes[key] = Math.max(GAME_CONSTANTS.MIN_ATTRIBUTES, attributes[key] - amount);
}

function applyDecline(fighter: Fighter, form: RecentCareerForm): Fighter {
  const attributes = { ...fighter.attributes };
  const yearsPostPrime = Math.max(1, fighter.age - fighter.primeEndAge);
  const severity = 1
    + Math.floor(yearsPostPrime / 3)
    + (fighter.injuryStatus ? 1 : 0)
    + (form.inactivityDays > 548 ? 1 : 0)
    + (form.losingStreak >= 3 ? 1 : 0);
  lowerAttributes(attributes, earlyDecline, severity);
  if (fighter.age >= fighter.primeEndAge + 2) lowerAttributes(attributes, technicalDecline, Math.max(1, severity - 1));
  if (fighter.age >= 40 || severity >= 5) lowerAttributes(attributes, preservedDecline, 1);
  const declined = { ...fighter, attributes };
  return { ...declined, potential: getFighterOverall(declined) };
}

function getRetirementDecision(fighter: Fighter, form: RecentCareerForm, year: number): Pick<AnnualCareerOutcome, 'shouldRetire' | 'retirementReason'> {
  if (fighter.age >= 45) return { shouldRetire: true, retirementReason: 'age' };
  if (fighter.age < 37) return { shouldRetire: false };
  const ageScore = (fighter.age - 36) * 0.055;
  const injuryScore = fighter.injuryStatus ? 0.12 : 0;
  const declineScore = Math.max(0, fighter.age - fighter.primeEndAge) * 0.025;
  const inactivityScore = form.inactivityDays > 548 ? 0.14 : form.inactivityDays > 274 ? 0.06 : 0;
  const lossScore = Math.min(0.15, form.losingStreak * 0.05);
  const probability = Math.min(0.9, ageScore + injuryScore + declineScore + inactivityScore + lossScore);
  const roll = stableCareerSeed(fighter.id, year, 'retirement') / 0x100000000;
  if (roll >= probability) return { shouldRetire: false };
  const reasons: Array<[RetirementReason, number]> = [
    ['age', ageScore + declineScore / 2],
    ['injuries', injuryScore],
    ['decline', declineScore + lossScore],
    ['inactivity', inactivityScore]
  ];
  reasons.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return { shouldRetire: true, retirementReason: reasons[0][0] };
}

export function processFighterCareerYear(state: GameState, fighter: Fighter, year: number): AnnualCareerOutcome {
  if (fighter.careerPhase === 'retired') return { fighter, shouldRetire: false };
  const form = getRecentCareerForm(state, fighter.id, year);
  const phase = deriveCareerPhase(fighter.age, fighter.primeEndAge);
  const phasedFighter = { ...fighter, careerPhase: phase };
  const processed = phase === 'declining'
    ? applyDecline(phasedFighter, form)
    : applyDevelopment(phasedFighter, form, year);
  return { fighter: processed, ...getRetirementDecision(processed, form, year) };
}

function vacateRetiredChampion(title: WeightClassTitleState, fighterId: string): WeightClassTitleState {
  const undisputed = title.undisputedChampionId === fighterId;
  const interim = title.interimChampionId === fighterId;
  if (!undisputed && !interim) return title;
  const updated = {
    ...title,
    undisputedChampionId: undisputed ? null : title.undisputedChampionId,
    undisputedDefenses: undisputed ? 0 : title.undisputedDefenses,
    interimChampionId: interim ? null : title.interimChampionId,
    interimDefenses: interim ? 0 : title.interimDefenses
  };
  return {
    ...updated,
    status: updated.undisputedChampionId && updated.interimChampionId
      ? 'unification_needed'
      : updated.interimChampionId
        ? 'interim_active'
        : updated.undisputedChampionId
          ? 'active'
          : 'vacant'
  };
}

export function retireFighter(
  state: GameState,
  fighterId: string,
  reason: RetirementReason,
  date: string,
  language: Language = readLanguage()
): GameState {
  const fighter = state.fighters[fighterId];
  if (!fighter || fighter.careerPhase === 'retired') return state;
  const t = fixedT(language);
  const newsId = `career-${fighterId}-${date}`;
  let nextState: GameState = {
    ...state,
    fighters: {
      ...state.fighters,
      [fighterId]: {
        ...fighter,
        careerPhase: 'retired',
        retiredDate: date,
        retirementReason: reason,
        contract: null,
        counterOffer: undefined,
        isChampion: false,
        titleDefenses: 0,
        titleShotPromised: false
      }
    },
    events: Object.fromEntries(Object.entries(state.events).map(([id, event]) => [id, event.isCompleted ? event : {
      ...event,
      fights: event.fights.filter(fight => fight.tournamentId || (fight.redCornerId !== fighterId && fight.blueCornerId !== fighterId))
    }])),
    rankings: Object.fromEntries(Object.entries(state.rankings).map(([weightClass, items]) => [
      weightClass,
      items.filter(item => item.fighterId !== fighterId).map((item, index) => ({ ...item, rank: index + 1 }))
    ])) as GameState['rankings'],
    titles: Object.fromEntries(Object.entries(state.titles).map(([weightClass, title]) => [
      weightClass,
      vacateRetiredChampion(title, fighterId)
    ])) as GameState['titles'],
    titlesByPromotion: Object.fromEntries(Object.entries(state.titlesByPromotion).map(([promotionId, titles]) => [
      promotionId,
      Object.fromEntries(Object.entries(titles).map(([weightClass, title]) => [weightClass, vacateRetiredChampion(title, fighterId)]))
    ])) as GameState['titlesByPromotion'],
    titleHistory: state.titleHistory.map(item => item.fighterId === fighterId && item.status === 'active'
      ? { ...item, dateLost: date, lostToFighterId: null, status: 'vacated' as const }
      : item),
    tournaments: Object.fromEntries(Object.entries(state.tournaments).map(([id, tournament]) => [id,
      tournament.status === 'completed' && tournament.winnerId === fighterId && tournament.titleShotPromised
        ? { ...tournament, titleShotUsed: true }
        : tournament
    ])),
    news: state.news.some(item => item.id === newsId) ? state.news : [{
      id: newsId,
      date,
      title: t($ => $.generated.career.retirementTitle, { name: `${fighter.firstName} ${fighter.lastName}` }),
      content: t($ => $.generated.career.retirement, { name: `${fighter.firstName} ${fighter.lastName}` }),
      type: 'general'
    }, ...state.news]
  };
  const scheduledRounds = new Map<string, { tournamentId: string; round: 'quarterfinal' | 'semifinal' | 'final'; eventId: string }>();
  for (const event of Object.values(state.events)) {
    if (event.isCompleted) continue;
    for (const fight of event.fights) {
      if (!fight.tournamentId || !fight.tournamentRound || (fight.redCornerId !== fighterId && fight.blueCornerId !== fighterId)) continue;
      scheduledRounds.set(`${fight.tournamentId}:${fight.tournamentRound}:${event.id}`, { tournamentId: fight.tournamentId, round: fight.tournamentRound, eventId: event.id });
    }
  }
  for (const scheduled of scheduledRounds.values()) {
    const tournament = nextState.tournaments[scheduled.tournamentId];
    if (!tournament) continue;
    const tournamentFighterIds = new Set([
      ...tournament.participants.map(participant => participant.fighterId),
      ...(tournament.usedReserveFighterIds ?? []),
      ...tournament.fights.flatMap(fight => [fight.redFighterId, fight.blueFighterId].filter((id): id is string => Boolean(id)))
    ]);
    const hasAvailableReserve = tournament.reserveFighterIds.some(id => {
      const candidate = nextState.fighters[id];
      return candidate?.contract
        && candidate.careerPhase !== 'retired'
        && !candidate.injuryStatus
        && (!candidate.medicalSuspension || candidate.medicalSuspension.daysRemaining <= 0)
        && candidate.fatigue <= 75
        && !tournament.participants.some(participant => participant.fighterId === id)
        && !tournament.fights.some(fight => fight.redFighterId === id || fight.blueFighterId === id)
        && !(tournament.usedReserveFighterIds ?? []).includes(id)
        && !isFighterBookedUpcoming(nextState, id);
    });
    if (!hasAvailableReserve) {
      const replacement = Object.values(nextState.fighters)
        .filter(candidate => candidate.weightClass === tournament.weightClass
          && candidate.contract
          && candidate.careerPhase !== 'retired'
          && !candidate.isChampion
          && !candidate.injuryStatus
          && (!candidate.medicalSuspension || candidate.medicalSuspension.daysRemaining <= 0)
          && candidate.fatigue <= 75
          && !tournamentFighterIds.has(candidate.id)
          && !isFighterBookedUpcoming(nextState, candidate.id))
        .sort((a, b) => (b.rankingScore ?? 0) - (a.rankingScore ?? 0) || getFighterOverall(b) - getFighterOverall(a) || a.id.localeCompare(b.id))[0];
      if (!replacement) {
        nextState = {
          ...nextState,
          tournaments: {
            ...nextState.tournaments,
            [tournament.id]: {
              ...tournament,
              participants: tournament.participants.filter(participant => participant.fighterId !== fighterId),
              fights: tournament.fights.map(fight => fight.isCompleted ? fight : {
                ...fight,
                redFighterId: fight.redFighterId === fighterId ? undefined : fight.redFighterId,
                blueFighterId: fight.blueFighterId === fighterId ? undefined : fight.blueFighterId
              })
            }
          }
        };
        nextState = cancelTournament(nextState, tournament.id, language, true);
        continue;
      }
      nextState = {
        ...nextState,
        tournaments: {
          ...nextState.tournaments,
          [tournament.id]: { ...tournament, reserveFighterIds: [...tournament.reserveFighterIds, replacement.id] }
        }
      };
    }
    nextState = repairScheduledTournamentRound(nextState, scheduled.tournamentId, scheduled.round, scheduled.eventId, language);
  }
  return nextState;
}

export function calculateHallOfFameScore(state: GameState, fighterId: string): number {
  const fighter = state.fighters[fighterId];
  if (!fighter) return 0;
  const fights = Object.values(state.fightArchive)
    .filter(fight => fight.redFighterId === fighterId || fight.blueFighterId === fighterId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  let streak = 0;
  let bestStreak = 0;
  let performance = 0;
  let unifications = 0;
  for (const fight of fights) {
    if (fight.winnerId === fighterId) {
      streak++;
      bestStreak = Math.max(bestStreak, streak);
      if (fight.titleChangeInfo?.type === 'unified') unifications++;
    } else if (fight.winnerId) {
      streak = 0;
    }
    performance += fight.performanceRating;
  }
  const titleScore = state.titleHistory
    .filter(item => item.fighterId === fighterId)
    .reduce((score, item) => score + (item.beltType === 'interim' ? 5 : 10) + item.defenses * 5, 0);
  const tournamentScore = Object.values(state.tournaments).reduce((score, tournament) => {
    if (tournament.status !== 'completed') return score;
    if (tournament.winnerId === fighterId) return score + (tournament.format === 'eight_man' ? 75 : 50);
    const final = tournament.fights.find(fight => fight.round === 'final');
    return final && (final.redFighterId === fighterId || final.blueFighterId === fighterId) ? score + (tournament.format === 'eight_man' ? 30 : 20) : score;
  }, 0);
  const awardScore = Object.values(state.yearlyAwards ?? {}).reduce((score, award) => score
    + (award.fighterOfTheYearId === fighterId ? 15 : 0)
    + (award.prospectOfTheYearId === fighterId ? 5 : 0), 0);
  return fighter.record.wins
    + fighter.record.kos
    + fighter.record.subs
    + titleScore
    + tournamentScore
    + awardScore
    + unifications * 8
    + Math.max(0, bestStreak - 3) * 2
    + (fights.length ? Math.floor(performance / fights.length / 10) : 0)
    + Math.floor(fighter.popularity / 20);
}

export function updateHallOfFame(state: GameState, year: number, language: Language = readLanguage()): GameState {
  const t = fixedT(language);
  let nextState = state;
  for (const fighterId of Object.keys(state.fighters).sort()) {
    const fighter = nextState.fighters[fighterId];
    if (!fighter || fighter.careerPhase !== 'retired' || !fighter.retiredDate || fighter.hallOfFame || new Date(fighter.retiredDate).getFullYear() >= year) continue;
    const legacyScore = calculateHallOfFameScore(nextState, fighterId);
    if (legacyScore < 100) continue;
    const newsId = `hall-of-fame:${fighterId}:${year}`;
    nextState = {
      ...nextState,
      fighters: { ...nextState.fighters, [fighterId]: { ...fighter, hallOfFame: { inductedYear: year, legacyScore } } },
      news: nextState.news.some(item => item.id === newsId) ? nextState.news : [{
        id: newsId,
        date: `${year}-01-01`,
        type: 'general',
        title: t($ => $.generated.career.hallOfFameTitle, { name: `${fighter.firstName} ${fighter.lastName}` }),
        content: t($ => $.generated.career.hallOfFame, { name: `${fighter.firstName} ${fighter.lastName}`, score: legacyScore })
      }, ...nextState.news]
    };
  }
  return nextState;
}

export function processAnnualCareerLifecycle(
  state: GameState,
  year: number,
  language: Language = readLanguage()
): GameState {
  let nextState = state;
  for (const fighterId of Object.keys(state.fighters).sort()) {
    const fighter = nextState.fighters[fighterId];
    if (!fighter || fighter.careerPhase === 'retired' || fighter.lastLifecycleYear >= year) continue;
    const aged = { ...fighter, age: fighter.age + 1 };
    const outcome = processFighterCareerYear(nextState, aged, year);
    nextState = {
      ...nextState,
      fighters: {
        ...nextState.fighters,
        [fighterId]: { ...outcome.fighter, lastLifecycleYear: year }
      }
    };
    const activeInternationalParticipant = Object.values(nextState.tournaments).some(tournament =>
      tournament.scope === 'international' &&
      (tournament.status === 'planned' || tournament.status === 'active') &&
      tournament.participants.some(participant => participant.fighterId === fighterId)
    );
    if (outcome.shouldRetire && outcome.retirementReason && !activeInternationalParticipant) {
      nextState = retireFighter(nextState, fighterId, outcome.retirementReason, `${year}-01-01`, language);
    }
  }
  return updateHallOfFame(nextState, year, language);
}
