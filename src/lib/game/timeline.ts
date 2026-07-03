import { GameState } from '../../types/game';

export interface CareerTimelineItem {
  date: string;
  type: 'fight_win' | 'fight_loss' | 'fight_draw' | 'title_win' | 'title_loss' | 'title_draw' | 'title_defense' | 'unification' | 'interim_title_win' | 'injury' | 'contract' | 'signing' | 'contract_renewal' | 'release' | 'award';
  title: string;
  description: string;
  fightId?: string;
}

export function deriveFighterTimeline(state: GameState, fighterId: string): CareerTimelineItem[] {
  const timeline: CareerTimelineItem[] = [];
  const f = state.fighters[fighterId];
  if (!f) return timeline;

  // 1. Fights
  const fighterFights = Object.values(state.fightArchive)
    .filter(a => a.redFighterId === fighterId || a.blueFighterId === fighterId);

  fighterFights.forEach(a => {
    const isWin = a.winnerId === fighterId;
    const isDraw = a.winnerId === null;
    const opponentId = a.redFighterId === fighterId ? a.blueFighterId : a.redFighterId;
    const opponent = state.fighters[opponentId];
    const oppName = opponent ? `${opponent.firstName} ${opponent.lastName}` : 'Unknown';

    let type: CareerTimelineItem['type'] = isDraw ? 'fight_draw' : (isWin ? 'fight_win' : 'fight_loss');
    let title = isDraw ? `Drew with ${oppName}` : (isWin ? `Defeated ${oppName}` : `Lost to ${oppName}`);
    let desc = `${a.method} - Round ${a.round} (${a.time})`;

    if (a.isTitleFight) {
      type = isDraw ? 'title_draw' : (isWin ? 'title_win' : 'title_loss');
      if (a.titleChangeInfo?.type === 'title_defense' && isWin) {
        type = 'title_defense';
        title = `Defended Title against ${oppName}`;
      } else if (a.titleChangeInfo?.type === 'unified' && isWin) {
        type = 'unification';
        title = `Unified Title against ${oppName}`;
      } else if (isWin && a.titleFightType === 'interim') {
        type = 'interim_title_win';
        title = `Won Interim Title against ${oppName}`;
      } else if (isWin) {
        title = `Won Title against ${oppName}`;
      }
    }
    timeline.push({ date: a.date, type, title, description: desc, fightId: a.id });
    
    // Add medical suspension if any
    if (a.medicalSuspensions) {
      const susp = a.medicalSuspensions.find(s => s.fighterId === fighterId);
      if (susp) {
        let suspDesc = '';
        if (susp.reason === 'knockout') suspDesc = 'after KO loss';
        else if (susp.reason === 'tko') suspDesc = 'after TKO loss';
        else if (susp.reason === 'doctor_stoppage') suspDesc = 'after Doctor Stoppage';
        else if (susp.reason === 'hard_fight') suspDesc = 'after a hard fight';
        else if (susp.reason === 'submission_damage') suspDesc = 'after submission damage';
        else suspDesc = 'for review';
        timeline.push({ date: a.date, type: 'injury', title: 'Medical Suspension', description: `Medical suspension: ${susp.daysRemaining} days ${suspDesc}.`, fightId: a.id });
      }
    }
  });

  // 2. News (Injuries, Contracts)
  state.news.forEach(n => {
    if (n.content.includes(`${f.firstName} ${f.lastName}`) || n.title.includes(`${f.firstName} ${f.lastName}`)) {
      if (n.type === 'injury' || n.title.includes('Injured') || n.title.includes('Injury')) {
        timeline.push({ date: n.date, type: 'injury', title: 'Injury', description: n.title });
      } else if (n.type === 'contract' || n.title.includes('Signed') || n.title.includes('Renewed') || n.title.includes('Released')) {
        let tType: CareerTimelineItem['type'] = 'contract';
        if (n.title.includes('Signed')) tType = 'signing';
        if (n.title.includes('Renewed')) tType = 'contract_renewal';
        if (n.title.includes('Released')) tType = 'release';
        timeline.push({ date: n.date, type: tType, title: n.title, description: n.content });
      }
    }
  });

  // 3. Yearly Awards
  if (state.yearlyAwards) {
    Object.values(state.yearlyAwards).forEach(award => {
      if (award.fighterOfTheYearId === fighterId) {
         timeline.push({ date: `${award.year}-12-31`, type: 'award', title: 'Fighter of the Year', description: `Won Fighter of the Year for ${award.year}` });
      }
      if (award.prospectOfTheYearId === fighterId) {
         timeline.push({ date: `${award.year}-12-31`, type: 'award', title: 'Prospect of the Year', description: `Won Prospect of the Year for ${award.year}` });
      }
    });
  }

  // Sort descending
  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return timeline;
}
