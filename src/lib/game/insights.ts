import type { Event, Fighter, GameState, SeasonCalendarSlot, WeightClass } from '../../types/game';
import type { TournamentDiagnosis } from './tournament';

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

export function getFighterReadiness(fighter: Fighter): FighterReadiness {
  if (!fighter.contract) return { status: 'unsigned', label: 'Unsigned', detail: 'Needs a contract before booking.', score: 0, eligible: false };
  if (fighter.injuryStatus) return { status: 'injured', label: 'Injured', detail: `${fighter.injuryStatus.type}: ${fighter.injuryStatus.daysRemaining} days remaining.`, score: 0, eligible: false };
  if (fighter.medicalSuspension?.daysRemaining && fighter.medicalSuspension.daysRemaining > 0) return { status: 'suspended', label: 'Suspended', detail: `${fighter.medicalSuspension.daysRemaining} days remaining.`, score: 0, eligible: false };
  if (fighter.fatigue >= 80) return { status: 'fatigued', label: 'Exhausted', detail: `Fatigue ${fighter.fatigue}/100; rest before booking.`, score: 20, eligible: false };
  if (fighter.fatigue > 50) return { status: 'fatigued', label: 'Tired', detail: `Fatigue ${fighter.fatigue}/100; booking carries a readiness risk.`, score: 100 - fighter.fatigue, eligible: true };
  return { status: 'ready', label: 'Ready', detail: `Fatigue ${fighter.fatigue}/100.`, score: 100 - fighter.fatigue, eligible: true };
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

export function compareFighters(red: Fighter, blue: Fighter): FighterComparison {
  const redReadiness = getFighterReadiness(red);
  const blueReadiness = getFighterReadiness(blue);
  const attribute = (fighter: Fighter) => Object.values(fighter.attributes).reduce((sum, value) => sum + value, 0) / Object.keys(fighter.attributes).length;
  const redScore = (red.rankingScore ?? 1000) / 20 + attribute(red) / 4 + red.popularity / 12 + red.momentum / 10 + red.morale / 12 + redReadiness.score / 8 + styleEdge(red.style, blue.style);
  const blueScore = (blue.rankingScore ?? 1000) / 20 + attribute(blue) / 4 + blue.popularity / 12 + blue.momentum / 10 + blue.morale / 12 + blueReadiness.score / 8 + styleEdge(blue.style, red.style);
  const redChance = Math.round(clamp(50 + (redScore - blueScore) / 2, 10, 90));
  const styleNote = styleEdge(red.style, blue.style) > 0
    ? `${red.style} has a small stylistic edge over ${blue.style}.`
    : styleEdge(red.style, blue.style) < 0
      ? `${blue.style} has a small stylistic edge over ${red.style}.`
      : 'No clear stylistic edge.';

  return { red, blue, redChance, blueChance: 100 - redChance, styleNote, readiness: { red: redReadiness, blue: blueReadiness } };
}

export function recommendMatchups(state: GameState, weightClass: WeightClass, excludedFighterIds: Iterable<string> = []): MatchRecommendation[] {
  const excluded = new Set(excludedFighterIds);
  const candidates = Object.values(state.fighters).filter(fighter => fighter.weightClass === weightClass && !excluded.has(fighter.id) && getFighterReadiness(fighter).eligible);
  const recommendations: MatchRecommendation[] = [];

  for (let redIndex = 0; redIndex < candidates.length; redIndex++) {
    for (let blueIndex = redIndex + 1; blueIndex < candidates.length; blueIndex++) {
      const [first, second] = [candidates[redIndex], candidates[blueIndex]];
      const [red, blue] = (second.rankingScore ?? 0) > (first.rankingScore ?? 0) ? [second, first] : [first, second];
      const rankingGap = Math.abs((red.rankingScore ?? 1000) - (blue.rankingScore ?? 1000));
      const storyline = state.storylines.find(item => item.isActive && item.fighterIds.includes(red.id) && item.fighterIds.includes(blue.id));
      const reasons = [
        rankingGap <= 75 ? 'Close ranking level' : 'Clear ranked matchup',
        `Combined popularity ${red.popularity + blue.popularity}`,
        ...(storyline ? [storyline.type === 'Rivalry' ? 'Active rivalry' : storyline.type] : []),
        ...(getFighterReadiness(red).status === 'fatigued' || getFighterReadiness(blue).status === 'fatigued' ? ['One fighter is tired'] : ['Both fighters ready'])
      ];
      const score = Math.round(clamp(100 - rankingGap / 5 + (red.popularity + blue.popularity) / 4 + (storyline?.type === 'Rivalry' ? 15 : 0) + getFighterReadiness(red).score / 10 + getFighterReadiness(blue).score / 10, 0, 100));
      recommendations.push({ red, blue, score, reasons });
    }
  }

  return recommendations.sort((a, b) => b.score - a.score).slice(0, 6);
}

export function getGrandPrixExplanation(slot: SeasonCalendarSlot, diagnosis?: TournamentDiagnosis): GrandPrixExplanation | null {
  if (slot.type !== 'grand_prix_window' && slot.type !== 'grand_prix_round') return null;
  const notes = slot.notes ?? [];
  const retryNote = notes.find(note => note.includes('Rescheduled Grand Prix Window'));
  const details = [
    ...(diagnosis?.currentRoundNeeded && diagnosis.currentRoundNeeded !== 'none' ? [`Needed round: ${diagnosis.currentRoundNeeded}`] : []),
    ...(diagnosis?.scheduledRound && diagnosis.scheduledRound !== 'none' ? [`Scheduled round: ${diagnosis.scheduledRound}`] : []),
    ...(diagnosis?.missingWinners ? [`Waiting on ${diagnosis.missingWinners} result${diagnosis.missingWinners === 1 ? '' : 's'}`] : []),
    ...(diagnosis?.reasonCannotSchedule ? [diagnosis.reasonCannotSchedule] : []),
    ...(diagnosis?.roundDelayReason ? [diagnosis.roundDelayReason] : []),
    ...notes.filter(note => /delayed|rescheduled|grand prix/i.test(note))
  ];
  const retryDate = diagnosis?.earliestRoundDate ?? (retryNote ? slot.date : null);
  const status = diagnosis?.canScheduleNow ? 'Ready to schedule' : diagnosis?.hasUpcomingTournamentFights ? 'Round already booked' : retryDate ? 'Waiting to retry' : details.length ? 'Grand Prix delayed' : 'Grand Prix planned';
  return { status, details: [...new Set(details)], retryDate };
}

export function summarizeCompletedEvent(state: Pick<GameState, 'fighters'>, event: Event): CompletedEventRecap {
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
    ...(fight.result?.injuries ?? []).flatMap(injury => state.fighters[injury.fighterId] ? [{ fighter: state.fighters[injury.fighterId], detail: `${injury.type} (${injury.daysRemaining} days)` }] : []),
    ...(fight.result?.medicalSuspensions ?? []).flatMap(suspension => suspension.fighterId && state.fighters[suspension.fighterId] ? [{ fighter: state.fighters[suspension.fighterId], detail: `Medical suspension (${suspension.daysRemaining} days)` }] : [])
  ]);
  const nextBookingLead = completedFights.map(fight => fight.result?.winnerId ? state.fighters[fight.result.winnerId] : null).find((fighter): fighter is Fighter => Boolean(fighter && getFighterReadiness(fighter).eligible)) ?? null;
  return {
    bestFight,
    rankingChanges,
    financial: event.results ? { profit: event.results.profit, fanReaction: event.results.fanReaction } : null,
    medical,
    nextBookingLead
  };
}
