import { differenceInCalendarDays } from 'date-fns';
import type { Fighter, GameState, WeightClass } from '../../types/game';
import '../../i18n';
import { fixedT, readLanguage, type Language } from '../localization';
import { stableCareerSeed } from './career';
import { WEIGHT_CLASSES } from './constants';
import { getFighterOverall } from './fighterRatings';
import { generateFighter } from './generator';
import { PRNG } from './rng';

const MIN_DIVISION_DEPTH = 6;
const EMERGENCY_COOLDOWN_DAYS = 90;

function usable(fighter: Fighter): boolean {
  return fighter.careerPhase !== 'retired';
}

function buildProspect(purpose: 'rookie' | 'emergency', key: string, weightClass: WeightClass, year: number, index: number): Fighter {
  const id = `${purpose}:${key}:${weightClass}:${index}`;
  const fighter = generateFighter(
    new PRNG(stableCareerSeed(purpose, key, weightClass, index)),
    'Prospect',
    weightClass,
    { fighterId: id, injuryId: `${id}:injury` }
  );
  return {
    ...fighter,
    contract: null,
    counterOffer: undefined,
    isChampion: false,
    titleDefenses: 0,
    titleShotPromised: false,
    careerPhase: 'developing',
    lastLifecycleYear: year
  };
}

export function generateAnnualRookieClass(state: GameState, year: number, language: Language = readLanguage()): GameState {
  if (state.careerEcosystem.rookieClassYears.includes(year)) return state;
  const fighters = { ...state.fighters };
  for (const weightClass of WEIGHT_CLASSES) {
    for (let index = 0; index < 2; index++) {
      const fighter = buildProspect('rookie', String(year), weightClass, year, index);
      fighters[fighter.id] = fighter;
    }
  }
  const t = fixedT(language);
  return {
    ...state,
    fighters,
    careerEcosystem: {
      ...state.careerEcosystem,
      rookieClassYears: [...state.careerEcosystem.rookieClassYears, year].sort((a, b) => a - b)
    },
    news: [{
      id: `career-rookie-class-${year}`,
      date: `${year}-01-01`,
      type: 'general',
      title: t($ => $.generated.career.rookieClassTitle, { year }),
      content: t($ => $.generated.career.rookieClass, { count: WEIGHT_CLASSES.length * 2 })
    }, ...state.news]
  };
}

export function ensureEmergencyProspectPool(state: GameState, date: string = state.currentDate, language: Language = readLanguage()): GameState {
  let nextState = state;
  const year = new Date(date).getFullYear();
  for (const weightClass of WEIGHT_CLASSES) {
    const lastDate = nextState.careerEcosystem.emergencyProspectDates[weightClass];
    if (lastDate && differenceInCalendarDays(new Date(date), new Date(lastDate)) < EMERGENCY_COOLDOWN_DAYS) continue;
    const division = Object.values(nextState.fighters).filter(fighter => fighter.weightClass === weightClass && usable(fighter));
    const signed = division.filter(fighter => fighter.contract).length;
    const unsigned = division.length - signed;
    const missing = signed < MIN_DIVISION_DEPTH ? Math.max(0, MIN_DIVISION_DEPTH - signed - unsigned) : 0;
    if (!missing) continue;
    const fighters = { ...nextState.fighters };
    for (let index = 0; index < missing; index++) {
      const fighter = buildProspect('emergency', date, weightClass, year, index);
      fighters[fighter.id] = fighter;
    }
    const t = fixedT(language);
    nextState = {
      ...nextState,
      fighters,
      careerEcosystem: {
        ...nextState.careerEcosystem,
        emergencyProspectDates: { ...nextState.careerEcosystem.emergencyProspectDates, [weightClass]: date }
      },
      news: [{
        id: `career-emergency-${date}-${weightClass}`,
        date,
        type: 'general',
        title: t($ => $.generated.career.emergencyProspectsTitle),
        content: t($ => $.generated.career.emergencyProspects, { count: missing, weightClass })
      }, ...nextState.news]
    };
  }
  return nextState;
}

export function scoreObserverRosterCandidate(state: GameState, fighter: Fighter): number {
  if (!usable(fighter)) return Number.NEGATIVE_INFINITY;
  const overall = getFighterOverall(fighter);
  const headroom = Math.max(0, fighter.potential - overall);
  const signedDepth = Object.values(state.fighters).filter(candidate => candidate.weightClass === fighter.weightClass && candidate.contract && usable(candidate)).length;
  const inactivityDays = fighter.lastFightDate ? Math.max(0, differenceInCalendarDays(new Date(state.currentDate), new Date(fighter.lastFightDate))) : 365;
  const compensation = fighter.counterOffer
    ? fighter.counterOffer.payPerFight + fighter.counterOffer.winBonus
    : fighter.contract
      ? fighter.contract.payPerFight + fighter.contract.winBonus
      : 10_000 + fighter.popularity * 200;
  const phase = fighter.careerPhase === 'developing' ? 18 : fighter.careerPhase === 'prime' ? 10 : -18;
  return (MIN_DIVISION_DEPTH - signedDepth) * 10
    + overall
    + headroom * 3
    + phase
    + Math.max(-20, 12 - Math.max(0, fighter.age - 25) * 2)
    + fighter.popularity * 0.2
    - Math.max(0, inactivityDays - 274) / 20
    - compensation / 5_000;
}

export function shouldObserverRenewFighter(state: GameState, fighter: Fighter): boolean {
  if (!fighter.contract || !usable(fighter)) return false;
  if (fighter.isChampion || Object.values(state.titles).some(title => title.undisputedChampionId === fighter.id || title.interimChampionId === fighter.id)) return true;
  return scoreObserverRosterCandidate(state, fighter) >= 45;
}
