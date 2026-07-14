import type { GameState } from '../../types/game';

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

export function deriveFighterAchievements(state: GameState, fighterId: string): FighterAchievement[] {
  const fighter = state.fighters[fighterId];
  if (!fighter) return [];

  const fights = Object.values(state.fightArchive).filter(fight => fight.redFighterId === fighterId || fight.blueFighterId === fighterId);
  const achievements: FighterAchievement[] = [];

  if (fighter.isChampion) {
    achievements.push({ category: 'Titles', title: 'Current Champion', description: `Current ${fighter.weightClass} champion.`, date: state.currentDate, tone: 'warning' });
  }

  for (const reign of state.titleHistory.filter(item => item.fighterId === fighterId)) {
    const belt = reign.beltType === 'interim' ? 'Interim Champion' : 'Undisputed Champion';
    const status = reign.dateLost ? `Held until ${reign.dateLost}` : 'Current or most recent reign';
    achievements.push({
      category: 'Titles',
      title: belt,
      description: `${reign.weightClass} title won ${reign.dateWon}. ${status}.`,
      date: reign.dateWon,
      tone: 'warning'
    });
    if (reign.defenses > 0) {
      achievements.push({
        category: 'Titles',
        title: 'Successful Title Defense',
        description: `${reign.defenses} successful defense${reign.defenses === 1 ? '' : 's'} during this ${reign.weightClass} reign.`,
        date: reign.dateLost || state.currentDate,
        tone: 'success'
      });
    }
  }

  for (const fight of fights.filter(fight => fight.winnerId === fighterId && fight.titleChangeInfo?.type === 'unified')) {
    achievements.push({ category: 'Titles', title: 'Undisputed Unification', description: `Unified the title at ${fight.eventName}.`, date: fight.date, tone: 'warning', fightArchiveId: fight.id });
  }

  for (const tournament of Object.values(state.tournaments || {})) {
    const participant = tournament.participants.find(item => item.fighterId === fighterId);
    if (!participant) continue;
    const date = tournament.completedDate || tournament.startDate || tournament.createdDate;
    if (tournament.status === 'completed' && tournament.winnerId === fighterId) {
      const format = tournament.format === 'four_man' ? '4-Man' : '8-Man';
      const titleShot = tournament.titleShotPromised ? ` Title shot ${tournament.titleShotUsed ? 'used' : 'pending'}.` : '';
      achievements.push({ category: 'Grand Prix', title: 'Grand Prix Champion', description: `Won the ${format} ${tournament.name}.${titleShot}`, date, tone: 'warning' });
    } else if (tournament.status === 'completed' && tournament.fights.some(fight => fight.round === 'final' && (fight.redFighterId === fighterId || fight.blueFighterId === fighterId))) {
      achievements.push({ category: 'Grand Prix', title: 'Grand Prix Finalist', description: `Reached the final of ${tournament.name}.`, date, tone: 'neutral' });
    }
    if (participant.replacementForFighterId) {
      achievements.push({ category: 'Grand Prix', title: 'Grand Prix Reserve', description: `Entered ${tournament.name} as a reserve replacement.`, date: tournament.startDate || tournament.createdDate, tone: 'neutral' });
    }
  }

  for (const award of Object.values(state.yearlyAwards || {})) {
    const date = `${award.year}-12-31`;
    if (award.fighterOfTheYearId === fighterId) achievements.push({ category: 'Awards', title: 'Fighter of the Year', description: `Awarded for ${award.year}.`, date, tone: 'warning' });
    if (award.prospectOfTheYearId === fighterId) achievements.push({ category: 'Awards', title: 'Prospect of the Year', description: `Awarded for ${award.year}.`, date, tone: 'success' });
    for (const [title, fightArchiveId] of [
      ['Fight of the Year', award.fightOfTheYearId],
      ['KO of the Year', award.koOfTheYearFightId],
      ['Submission of the Year', award.submissionOfTheYearFightId],
      ['Upset of the Year', award.upsetOfTheYearFightId]
    ] as const) {
      const fight = fightArchiveId ? state.fightArchive[fightArchiveId] : undefined;
      if (fight && (fight.redFighterId === fighterId || fight.blueFighterId === fighterId)) {
        achievements.push({ category: 'Awards', title, description: `${award.year} award at ${fight.eventName}.`, date: fight.date, tone: 'warning', fightArchiveId });
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
  if (longestStreak >= 3) achievements.push({ category: 'Milestones', title: 'Win Streak', description: `Longest promotion win streak: ${longestStreak}.`, date: state.currentDate, tone: 'success' });
  if (finishWins >= 3) achievements.push({ category: 'Milestones', title: 'Finisher', description: `${finishWins} promotion wins by finish.`, date: state.currentDate, tone: 'danger' });
  if (titleFights >= 3) achievements.push({ category: 'Milestones', title: 'Title Fight Veteran', description: `${titleFights} promotion title fights.`, date: state.currentDate, tone: 'warning' });

  return achievements.sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category) || new Date(b.date).getTime() - new Date(a.date).getTime());
}
