import type { Event, Fighter, GameState, SeasonCalendarSlot, WeightClass } from '../../types/game';
import { getPairKey } from './news';
import type { TournamentDiagnosis } from './tournament';
import { getFighterOverall } from './fighterRatings';
import '../../i18n';
import { fixedT, formatFighterStyle, readLanguage, type Language } from '../localization';

export type FighterReadiness = {
  status: 'ready' | 'fatigued' | 'injured' | 'suspended' | 'unsigned';
  label: string;
  detail: string;
  score: number;
  eligible: boolean;
};

export type FighterComparison = {
  red: Fighter;
  blue: Fighter;
  redChance: number;
  blueChance: number;
  redOverall: number;
  blueOverall: number;
  mismatchWarning?: string;
  styleNote: string;
  readiness: { red: FighterReadiness; blue: FighterReadiness };
};

export type MatchRecommendation = {
  red: Fighter;
  blue: Fighter;
  score: number;
  reasons: string[];
};

export type GrandPrixExplanation = {
  status: string;
  details: string[];
  retryDate: string | null;
};

export type CompletedEventRecap = {
  bestFight: { red: Fighter; blue: Fighter; rating: number; method: string } | null;
  rankingChanges: Array<{ fighter: Fighter; oldRank: number; newRank: number }>;
  financial: { profit: number; fanReaction: number } | null;
  medical: Array<{ fighter: Fighter; detail: string }>;
  nextBookingLead: Fighter | null;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function fighterName(fighter: Fighter) {
  return `${fighter.firstName} ${fighter.lastName}`;
}

export function getFighterReadiness(fighter: Fighter, language: Language = readLanguage()): FighterReadiness {
  const t = fixedT(language);
  if (!fighter.contract) return { status: 'unsigned', label: t($ => $.generated.insights.unsigned), detail: t($ => $.generated.insights.unsignedDetail), score: 0, eligible: false };
  if (fighter.injuryStatus) return { status: 'injured', label: t($ => $.generated.insights.injured), detail: t($ => $.generated.insights.injuryDetail, { type: fighter.injuryStatus.type, count: fighter.injuryStatus.daysRemaining }), score: 0, eligible: false };
  if (fighter.medicalSuspension?.daysRemaining && fighter.medicalSuspension.daysRemaining > 0) return { status: 'suspended', label: t($ => $.generated.insights.suspended), detail: t($ => $.generated.insights.daysRemaining, { count: fighter.medicalSuspension.daysRemaining }), score: 0, eligible: false };
  if (fighter.fatigue >= 80) return { status: 'fatigued', label: t($ => $.generated.insights.exhausted), detail: t($ => $.generated.insights.exhaustedDetail, { value: fighter.fatigue }), score: 20, eligible: false };
  if (fighter.fatigue > 50) return { status: 'fatigued', label: t($ => $.generated.insights.tired), detail: t($ => $.generated.insights.tiredDetail, { value: fighter.fatigue }), score: 100 - fighter.fatigue, eligible: true };
  return { status: 'ready', label: t($ => $.generated.insights.ready), detail: t($ => $.generated.insights.readyDetail, { value: fighter.fatigue }), score: 100 - fighter.fatigue, eligible: true };
}

function styleEdge(red: Fighter['style'], blue: Fighter['style']) {
  const edges: Partial<Record<Fighter['style'], Fighter['style']>> = {
    Wrestler: 'Boxer',
    BJJ: 'Wrestler',
    Boxer: 'BJJ',
    Kickboxer: 'Wrestler',
    'Muay Thai': 'Boxer',
    Sambo: 'BJJ'
  };
  if (edges[red] === blue) return 3;
  if (edges[blue] === red) return -3;
  return 0;
}

export function compareFighters(red: Fighter, blue: Fighter, language: Language = readLanguage()): FighterComparison {
  const t = fixedT(language);
  const redReadiness = getFighterReadiness(red, language);
  const blueReadiness = getFighterReadiness(blue, language);
  const redOverall = getFighterOverall(red);
  const blueOverall = getFighterOverall(blue);
  const redScore = (red.rankingScore ?? 1000) / 20 + redOverall / 4 + red.popularity / 12 + red.momentum / 10 + red.morale / 12 + redReadiness.score / 8 + styleEdge(red.style, blue.style);
  const blueScore = (blue.rankingScore ?? 1000) / 20 + blueOverall / 4 + blue.popularity / 12 + blue.momentum / 10 + blue.morale / 12 + blueReadiness.score / 8 + styleEdge(blue.style, red.style);
  const redChance = Math.round(clamp(50 + (redScore - blueScore) / 2, 10, 90));
  const styleNote = styleEdge(red.style, blue.style) > 0
    ? t($ => $.generated.insights.styleEdge, { winner: formatFighterStyle(red.style, language), loser: formatFighterStyle(blue.style, language) })
    : styleEdge(red.style, blue.style) < 0
      ? t($ => $.generated.insights.styleEdge, { winner: formatFighterStyle(blue.style, language), loser: formatFighterStyle(red.style, language) })
      : t($ => $.generated.insights.noStyleEdge);

  const overallGap = Math.abs(redOverall - blueOverall);
  return {
    red,
    blue,
    redChance,
    blueChance: 100 - redChance,
    redOverall,
    blueOverall,
    ...(overallGap >= 15 ? { mismatchWarning: t($ => $.generated.insights.mismatch, { value: overallGap }) } : {}),
    styleNote,
    readiness: { red: redReadiness, blue: blueReadiness }
  };
}

export function recommendMatchups(state: GameState, weightClass: WeightClass, excludedFighterIds: Iterable<string> = [], language: Language = readLanguage()): MatchRecommendation[] {
  const t = fixedT(language);
  const excluded = new Set(excludedFighterIds);
  const candidates = Object.values(state.fighters).filter(fighter => fighter.weightClass === weightClass && !excluded.has(fighter.id) && getFighterReadiness(fighter, language).eligible);
  const recommendations: MatchRecommendation[] = [];

  for (let redIndex = 0; redIndex < candidates.length; redIndex++) {
    for (let blueIndex = redIndex + 1; blueIndex < candidates.length; blueIndex++) {
      const [first, second] = [candidates[redIndex], candidates[blueIndex]];
      const [red, blue] = (second.rankingScore ?? 0) > (first.rankingScore ?? 0) ? [second, first] : [first, second];
      const rankingGap = Math.abs((red.rankingScore ?? 1000) - (blue.rankingScore ?? 1000));
      const overallGap = Math.abs(getFighterOverall(red) - getFighterOverall(blue));
      const pairKey = getPairKey([red.id, blue.id]);
      const storyline = state.storylines.find(item => item.isActive && item.type === 'Rivalry' && item.fighterIds.length === 2 && getPairKey(item.fighterIds) === pairKey);
      const rivalryScore = Math.min(3, Math.max(1, storyline?.intensity ?? 1)) * 5;
      const redReadiness = getFighterReadiness(red, language);
      const blueReadiness = getFighterReadiness(blue, language);
      const reasons = [
        rankingGap <= 75 ? t($ => $.generated.insights.closeRanking) : t($ => $.generated.insights.rankedMatchup),
        t($ => $.generated.insights.overallGap, { value: overallGap }),
        t($ => $.generated.insights.combinedPopularity, { value: red.popularity + blue.popularity }),
        ...(storyline ? [t($ => $.generated.insights.rivalryIntensity, { value: storyline.intensity ?? 1 })] : []),
        ...(redReadiness.status === 'fatigued' || blueReadiness.status === 'fatigued' ? [t($ => $.generated.insights.oneTired)] : [t($ => $.generated.insights.bothReady)])
      ];
      const score = Math.round(clamp(100 - rankingGap / 5 - overallGap * 1.5 + (red.popularity + blue.popularity) / 4 + (storyline ? rivalryScore : 0) + redReadiness.score / 10 + blueReadiness.score / 10, 0, 100));
      recommendations.push({ red, blue, score, reasons });
    }
  }

  return recommendations.sort((a, b) => b.score - a.score).slice(0, 6);
}

export function getGrandPrixExplanation(slot: SeasonCalendarSlot, diagnosis?: TournamentDiagnosis, language: Language = readLanguage()): GrandPrixExplanation | null {
  const t = fixedT(language);
  if (slot.type !== 'grand_prix_window' && slot.type !== 'grand_prix_round') return null;
  const notes = slot.notes ?? [];
  const retryNote = notes.find(note => note.includes('Rescheduled Grand Prix Window'));
  const details = [
    ...(diagnosis?.currentRoundNeeded && diagnosis.currentRoundNeeded !== 'none' ? [t($ => $.generated.insights.neededRound, { round: diagnosis.currentRoundNeeded })] : []),
    ...(diagnosis?.scheduledRound && diagnosis.scheduledRound !== 'none' ? [t($ => $.generated.insights.scheduledRound, { round: diagnosis.scheduledRound })] : []),
    ...(diagnosis?.missingWinners ? [t($ => $.generated.insights.waitingResults, { count: diagnosis.missingWinners })] : []),
    ...(diagnosis?.reasonCannotSchedule ? [diagnosis.reasonCannotSchedule] : []),
    ...(diagnosis?.roundDelayReason ? [diagnosis.roundDelayReason] : []),
    ...notes.filter(note => /delayed|rescheduled|grand prix/i.test(note))
  ];
  const retryDate = diagnosis?.earliestRoundDate ?? (retryNote ? slot.date : null);
  const status = diagnosis?.canScheduleNow ? t($ => $.generated.insights.readySchedule) : diagnosis?.hasUpcomingTournamentFights ? t($ => $.generated.insights.roundBooked) : retryDate ? t($ => $.generated.insights.waitingRetry) : details.length ? t($ => $.generated.insights.gpDelayed) : t($ => $.generated.insights.gpPlanned);
  return { status, details: [...new Set(details)], retryDate };
}

export function summarizeCompletedEvent(state: Pick<GameState, 'fighters'>, event: Event, language: Language = readLanguage()): CompletedEventRecap {
  const t = fixedT(language);
  const completedFights = event.fights.filter(fight => fight.result);
  const bestFightMatchup = completedFights.reduce<typeof completedFights[number] | null>((best, fight) => !best || (fight.result?.performanceRating ?? 0) > (best.result?.performanceRating ?? 0) ? fight : best, null);
  const bestFight = bestFightMatchup && bestFightMatchup.result && state.fighters[bestFightMatchup.redCornerId] && state.fighters[bestFightMatchup.blueCornerId]
    ? { red: state.fighters[bestFightMatchup.redCornerId], blue: state.fighters[bestFightMatchup.blueCornerId], rating: bestFightMatchup.result.performanceRating, method: bestFightMatchup.result.method }
    : null;
  const rankingChanges = Object.entries(event.results?.rankingChanges ?? {}).flatMap(([fighterId, change]) => {
    const fighter = state.fighters[fighterId];
    return fighter ? [{ fighter, ...change }] : [];
  }).sort((a, b) => Math.abs(b.oldRank - b.newRank) - Math.abs(a.oldRank - a.newRank));
  const medical = completedFights.flatMap(fight => [
    ...(fight.result?.injuries ?? []).flatMap(injury => state.fighters[injury.fighterId] ? [{ fighter: state.fighters[injury.fighterId], detail: t($ => $.generated.insights.injuryRecap, { type: injury.type, count: injury.daysRemaining }) }] : []),
    ...(fight.result?.medicalSuspensions ?? []).flatMap(suspension => suspension.fighterId && state.fighters[suspension.fighterId] ? [{ fighter: state.fighters[suspension.fighterId], detail: t($ => $.generated.insights.suspensionRecap, { count: suspension.daysRemaining }) }] : [])
  ]);
  const nextBookingLead = completedFights.map(fight => fight.result?.winnerId ? state.fighters[fight.result.winnerId] : null).find((fighter): fighter is Fighter => Boolean(fighter && getFighterReadiness(fighter, language).eligible)) ?? null;
  return {
    bestFight,
    rankingChanges,
    financial: event.results ? { profit: event.results.profit, fanReaction: event.results.fanReaction } : null,
    medical,
    nextBookingLead
  };
}
