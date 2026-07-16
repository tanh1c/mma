import type { GameState } from '../../types/game';
import '../../i18n';
import { fixedT, formatWeightClass, readLanguage, type Language } from '../localization';

export type FighterAchievementCategory = 'Titles' | 'Grand Prix' | 'Awards' | 'Milestones';
export type FighterAchievementTone = 'neutral' | 'success' | 'warning' | 'danger';

export type FighterAchievement = {
  category: FighterAchievementCategory;
  title: string;
  description: string;
  date: string;
  tone: FighterAchievementTone;
  fightArchiveId?: string;
};

const categoryOrder: FighterAchievementCategory[] = ['Titles', 'Grand Prix', 'Awards', 'Milestones'];

export function deriveFighterAchievements(state: GameState, fighterId: string, language: Language = readLanguage()): FighterAchievement[] {
  const t = fixedT(language);
  const fighter = state.fighters[fighterId];
  if (!fighter) return [];

  const fights = Object.values(state.fightArchive).filter(fight => fight.redFighterId === fighterId || fight.blueFighterId === fighterId);
  const achievements: FighterAchievement[] = [];

  if (fighter.isChampion) {
    achievements.push({ category: 'Titles', title: t($ => $.generated.achievements.currentChampionTitle), description: t($ => $.generated.achievements.currentChampion, { weightClass: formatWeightClass(fighter.weightClass, language) }), date: state.currentDate, tone: 'warning' });
  }

  for (const reign of state.titleHistory.filter(item => item.fighterId === fighterId)) {
    const belt = reign.beltType === 'interim' ? t($ => $.generated.achievements.interimChampion) : t($ => $.generated.achievements.undisputedChampion);
    const status = reign.dateLost ? t($ => $.generated.achievements.heldUntil, { date: reign.dateLost }) : t($ => $.generated.achievements.currentReign);
    achievements.push({
      category: 'Titles',
      title: belt,
      description: t($ => $.generated.achievements.titleWon, { weightClass: formatWeightClass(reign.weightClass, language), date: reign.dateWon, status }),
      date: reign.dateWon,
      tone: 'warning'
    });
    if (reign.defenses > 0) {
      achievements.push({
        category: 'Titles',
        title: t($ => $.generated.achievements.defenseTitle),
        description: t($ => $.generated.achievements.defenses, { count: reign.defenses, weightClass: formatWeightClass(reign.weightClass, language) }),
        date: reign.dateLost || state.currentDate,
        tone: 'success'
      });
    }
  }

  for (const fight of fights.filter(fight => fight.winnerId === fighterId && fight.titleChangeInfo?.type === 'unified')) {
    achievements.push({ category: 'Titles', title: t($ => $.generated.achievements.unificationTitle), description: t($ => $.generated.achievements.unification, { event: fight.eventName }), date: fight.date, tone: 'warning', fightArchiveId: fight.id });
  }

  for (const tournament of Object.values(state.tournaments || {})) {
    const participant = tournament.participants.find(item => item.fighterId === fighterId);
    if (!participant) continue;
    const date = tournament.completedDate || tournament.startDate || tournament.createdDate;
    if (tournament.status === 'completed' && tournament.winnerId === fighterId) {
      const format = tournament.format === 'four_man' ? '4-Man' : '8-Man';
      const titleShot = tournament.titleShotPromised ? tournament.titleShotUsed ? t($ => $.generated.achievements.titleShotUsed) : t($ => $.generated.achievements.titleShotPending) : '';
      achievements.push({ category: 'Grand Prix', title: t($ => $.generated.achievements.gpChampionTitle), description: t($ => $.generated.achievements.gpChampion, { format, tournament: tournament.name, titleShot }), date, tone: 'warning' });
    } else if (tournament.status === 'completed' && tournament.fights.some(fight => fight.round === 'final' && (fight.redFighterId === fighterId || fight.blueFighterId === fighterId))) {
      achievements.push({ category: 'Grand Prix', title: t($ => $.generated.achievements.gpFinalistTitle), description: t($ => $.generated.achievements.gpFinalist, { tournament: tournament.name }), date, tone: 'neutral' });
    }
    if (participant.replacementForFighterId) {
      achievements.push({ category: 'Grand Prix', title: t($ => $.generated.achievements.gpReserveTitle), description: t($ => $.generated.achievements.gpReserve, { tournament: tournament.name }), date: tournament.startDate || tournament.createdDate, tone: 'neutral' });
    }
  }

  for (const award of Object.values(state.yearlyAwards || {})) {
    const date = `${award.year}-12-31`;
    if (award.fighterOfTheYearId === fighterId) achievements.push({ category: 'Awards', title: t($ => $.generated.achievements.fighterOfYear), description: t($ => $.generated.achievements.awardedFor, { year: award.year }), date, tone: 'warning' });
    if (award.prospectOfTheYearId === fighterId) achievements.push({ category: 'Awards', title: t($ => $.generated.achievements.prospectOfYear), description: t($ => $.generated.achievements.awardedFor, { year: award.year }), date, tone: 'success' });
    for (const [title, fightArchiveId] of [
      [t($ => $.generated.achievements.fightOfYear), award.fightOfTheYearId],
      [t($ => $.generated.achievements.koOfYear), award.koOfTheYearFightId],
      [t($ => $.generated.achievements.submissionOfYear), award.submissionOfTheYearFightId],
      [t($ => $.generated.achievements.upsetOfYear), award.upsetOfTheYearFightId]
    ] as const) {
      const fight = fightArchiveId ? state.fightArchive[fightArchiveId] : undefined;
      if (fight && (fight.redFighterId === fighterId || fight.blueFighterId === fighterId)) {
        achievements.push({ category: 'Awards', title, description: t($ => $.generated.achievements.awardAt, { year: award.year, event: fight.eventName }), date: fight.date, tone: 'warning', fightArchiveId });
      }
    }
  }

  const finishWins = fights.filter(fight => fight.winnerId === fighterId && !fight.method.includes('Decision')).length;
  const titleFights = fights.filter(fight => fight.isTitleFight).length;
  let longestStreak = 0;
  let streak = 0;
  for (const fight of [...fights].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())) {
    if (fight.winnerId === fighterId) streak += 1;
    else {
      longestStreak = Math.max(longestStreak, streak);
      streak = 0;
    }
  }
  longestStreak = Math.max(longestStreak, streak);
  if (longestStreak >= 3) achievements.push({ category: 'Milestones', title: t($ => $.generated.achievements.streakTitle), description: t($ => $.generated.achievements.streak, { count: longestStreak }), date: state.currentDate, tone: 'success' });
  if (finishWins >= 3) achievements.push({ category: 'Milestones', title: t($ => $.generated.achievements.finisherTitle), description: t($ => $.generated.achievements.finisher, { count: finishWins }), date: state.currentDate, tone: 'danger' });
  if (titleFights >= 3) achievements.push({ category: 'Milestones', title: t($ => $.generated.achievements.titleVeteranTitle), description: t($ => $.generated.achievements.titleVeteran, { count: titleFights }), date: state.currentDate, tone: 'warning' });

  return achievements.sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category) || new Date(b.date).getTime() - new Date(a.date).getTime());
}
