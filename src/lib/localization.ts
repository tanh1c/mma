import i18n, { type TFunction } from 'i18next';

export type Language = 'en' | 'vi';

type ReadStorage = Pick<Storage, 'getItem'>;
type WriteStorage = Pick<Storage, 'setItem'>;

const LANGUAGE_KEY = 'cage-dynasty-language';
const supportedLanguages: readonly Language[] = ['en', 'vi'];

const browserStorage = () => typeof localStorage === 'undefined' ? undefined : localStorage;
const browserLanguages = () => typeof navigator === 'undefined' ? undefined : navigator.languages;

export function detectLanguage(languages: readonly string[] | undefined = browserLanguages()): Language {
  return languages?.some(language => language.toLowerCase().split('-')[0] === 'vi') ? 'vi' : 'en';
}

export function readLanguage(storage: ReadStorage | undefined = browserStorage(), languages?: readonly string[]): Language {
  try {
    const language = storage?.getItem(LANGUAGE_KEY);
    if (supportedLanguages.includes(language as Language)) return language as Language;
  } catch {
    // Storage can be blocked while browser language detection still works.
  }
  return detectLanguage(languages);
}

export function writeLanguage(language: Language, storage: WriteStorage | undefined = browserStorage()): void {
  try {
    storage?.setItem(LANGUAGE_KEY, language);
  } catch {
    // The active session still changes language when persistence is blocked.
  }
}

export function localeFor(language: Language): 'en-US' | 'vi-VN' {
  return language === 'vi' ? 'vi-VN' : 'en-US';
}

export function fixedT(language: Language): TFunction<'translation'> {
  return i18n.getFixedT(supportedLanguages.includes(language) ? language : 'en', 'translation');
}

export function formatDate(value: Date | string | number, language: Language, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(localeFor(language), options).format(typeof value === 'string' ? new Date(value) : value);
}

export function formatNumber(value: number, language: Language, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(localeFor(language), options).format(value);
}

export function formatCurrency(value: number, language: Language): string {
  return new Intl.NumberFormat(localeFor(language), { style: 'currency', currency: 'USD' }).format(value);
}

export const formatFightMethod = (value: string, language: Language) => {
  const t = fixedT(language);
  const labels: Record<string, string> = {
    'KO/TKO': t($ => $.fight.method.koTko),
    Submission: t($ => $.fight.method.submission),
    'Unanimous Decision': t($ => $.fight.method.unanimousDecision),
    'Split Decision': t($ => $.fight.method.splitDecision),
    'Majority Decision': t($ => $.fight.method.majorityDecision),
    'Doctor Stoppage': t($ => $.fight.method.doctorStoppage),
    'Corner Stoppage': t($ => $.fight.method.cornerStoppage),
    Draw: t($ => $.fight.method.draw)
  };
  return labels[value] ?? value;
};

export const formatWeightClass = (value: string, language: Language) => {
  const t = fixedT(language);
  const labels: Record<string, string> = {
    Bantamweight: t($ => $.domain.weightClass.bantamweight),
    Featherweight: t($ => $.domain.weightClass.featherweight),
    Lightweight: t($ => $.domain.weightClass.lightweight),
    Welterweight: t($ => $.domain.weightClass.welterweight),
    Middleweight: t($ => $.domain.weightClass.middleweight),
    Heavyweight: t($ => $.domain.weightClass.heavyweight)
  };
  return labels[value] ?? value;
};

export const formatFighterStyle = (value: string, language: Language) => {
  const t = fixedT(language);
  const labels: Record<string, string> = {
    Boxer: t($ => $.domain.fighterStyle.boxer),
    Wrestler: t($ => $.domain.fighterStyle.wrestler),
    BJJ: t($ => $.domain.fighterStyle.bjj),
    Kickboxer: t($ => $.domain.fighterStyle.kickboxer),
    'Muay Thai': t($ => $.domain.fighterStyle.muayThai),
    Sambo: t($ => $.domain.fighterStyle.sambo),
    Balanced: t($ => $.domain.fighterStyle.balanced)
  };
  return labels[value] ?? value;
};

export const formatTournamentStatus = (value: string, language: Language) => {
  const t = fixedT(language);
  const labels: Record<string, string> = {
    planned: t($ => $.domain.tournamentStatus.planned),
    active: t($ => $.domain.tournamentStatus.active),
    completed: t($ => $.domain.tournamentStatus.completed),
    cancelled: t($ => $.domain.tournamentStatus.cancelled)
  };
  return labels[value] ?? value;
};

export const formatTitleFightType = (value: string, language: Language) => {
  const t = fixedT(language);
  const labels: Record<string, string> = {
    undisputed: t($ => $.domain.titleFightType.undisputed),
    interim: t($ => $.domain.titleFightType.interim),
    vacant_undisputed: t($ => $.domain.titleFightType.vacantUndisputed),
    unification: t($ => $.domain.titleFightType.unification)
  };
  return labels[value] ?? value;
};

export const formatContractInterest = (value: string, language: Language) => {
  const t = fixedT(language);
  const labels: Record<string, string> = {
    'Very High': t($ => $.freeAgents.interest.veryHigh),
    High: t($ => $.freeAgents.interest.high),
    Moderate: t($ => $.freeAgents.interest.moderate),
    Low: t($ => $.freeAgents.interest.low),
    'Very Low': t($ => $.freeAgents.interest.veryLow)
  };
  return labels[value] ?? value;
};

export const formatCalendarSlotType = (value: string, language: Language) => {
  const t = fixedT(language);
  const labels: Record<string, string> = {
    regular_event: t($ => $.domain.calendarSlotType.regularEvent),
    tentpole_event: t($ => $.domain.calendarSlotType.tentpoleEvent),
    grand_prix_window: t($ => $.domain.calendarSlotType.grandPrixWindow),
    grand_prix_round: t($ => $.domain.calendarSlotType.grandPrixRound),
    title_fight_card: t($ => $.domain.calendarSlotType.titleFightCard),
    recovery_gap: t($ => $.domain.calendarSlotType.recoveryGap)
  };
  return labels[value] ?? value;
};

export const formatCalendarSlotStatus = (value: string, language: Language) => {
  const t = fixedT(language);
  const labels: Record<string, string> = {
    planned: t($ => $.domain.calendarSlotStatus.planned),
    scheduled: t($ => $.domain.calendarSlotStatus.scheduled),
    completed: t($ => $.domain.calendarSlotStatus.completed),
    missed: t($ => $.domain.calendarSlotStatus.missed),
    cancelled: t($ => $.domain.calendarSlotStatus.cancelled)
  };
  return labels[value] ?? value;
};

export const formatReadiness = (value: string, language: Language) => {
  const t = fixedT(language);
  const labels: Record<string, string> = {
    ready: t($ => $.domain.readiness.ready),
    fatigued: t($ => $.domain.readiness.fatigued),
    injured: t($ => $.domain.readiness.injured),
    suspended: t($ => $.domain.readiness.suspended),
    booked: t($ => $.domain.readiness.booked)
  };
  return labels[value] ?? value;
};
