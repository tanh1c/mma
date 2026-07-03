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

  // 4. Tournaments
  Object.values(state.tournaments || {}).forEach(t => {
     const participant = t.participants.find(p => p.fighterId === fighterId);
     if (participant) {
        const entryTitle = participant.replacementForFighterId 
          ? `Entered ${t.name} (Reserve Replacement)` 
          : `Entered ${t.name} (Seed #${participant.seed})`;
        
        timeline.push({
          date: t.startDate || t.createdDate,
          type: 'contract',
          title: `Grand Prix Entry`,
          description: entryTitle
        });
        
        if (participant.replacementForFighterId) {
          const origFighter = state.fighters[participant.replacementForFighterId];
          const origName = origFighter ? `${origFighter.firstName} ${origFighter.lastName}` : 'Unknown';
          timeline.push({
            date: t.startDate || t.createdDate,
            type: 'contract',
            title: 'Grand Prix Reserve Entry',
            description: `Entered final as reserve replacement for ${origName}.`
          });
        }
        
        // Semifinal result
        const semiFight = t.fights.find(fight => fight.round === 'semifinal' && fight.isCompleted && (fight.redFighterId === fighterId || fight.blueFighterId === fighterId));
        if (semiFight) {
           const isWin = semiFight.winnerId === fighterId;
           const opponentId = semiFight.redFighterId === fighterId ? semiFight.blueFighterId : semiFight.redFighterId;
           const oppName = opponentId ? (state.fighters[opponentId] ? state.fighters[opponentId].lastName : 'Unknown') : 'Unknown';
           
           const fightDate = Object.values(state.fightArchive).find(a => a.id === semiFight.fightArchiveId)?.date || t.semifinalCompletedDate || t.startDate || t.createdDate;
           
           timeline.push({
             date: fightDate,
             type: isWin ? 'fight_win' : 'fight_loss',
             title: `Grand Prix Semifinal: ${isWin ? 'Victory' : 'Defeat'}`,
             description: isWin ? `Won semifinal vs ${oppName} to advance to final` : `Lost semifinal vs ${oppName}`
           });
        }
        
        // Final result
        const finalFight = t.fights.find(fight => fight.round === 'final' && fight.isCompleted && (fight.redFighterId === fighterId || fight.blueFighterId === fighterId));
        if (finalFight) {
           const isWin = finalFight.winnerId === fighterId;
           const opponentId = finalFight.redFighterId === fighterId ? finalFight.blueFighterId : finalFight.redFighterId;
           const oppName = opponentId ? (state.fighters[opponentId] ? state.fighters[opponentId].lastName : 'Unknown') : 'Unknown';
           
           const fightDate = Object.values(state.fightArchive).find(a => a.id === finalFight.fightArchiveId)?.date || t.completedDate || t.startDate || t.createdDate;
           
           timeline.push({
             date: fightDate,
             type: isWin ? 'fight_win' : 'fight_loss',
             title: `Grand Prix Final: ${isWin ? 'Victory' : 'Defeat'}`,
             description: isWin ? `Won final vs ${oppName} to win the tournament!` : `Lost final vs ${oppName}`
           });
        }
        
        // Final delayed
        if (t.finalDelayReason && t.delayedFighterId === fighterId && t.earliestFinalDate) {
           timeline.push({
             date: t.earliestFinalDate,
             type: 'injury',
             title: 'Grand Prix Final Delayed',
             description: `Final delayed: ${t.finalDelayReason}`
           });
        }
        
        if (t.winnerId === fighterId && t.completedDate) {
          timeline.push({
            date: t.completedDate,
            type: 'award',
            title: `Grand Prix Champion`,
            description: `Won the ${t.name}! Earned prestigious trophy${t.titleShotPromised ? ' and a promised Undisputed title shot' : ''}.`
          });
          
          if (t.titleShotPromised) {
             if (t.titleShotUsed) {
                const titleFight = Object.values(state.fightArchive)
                   .filter(a => (a.redFighterId === fighterId || a.blueFighterId === fighterId) && a.isTitleFight && a.date >= t.completedDate!)
                   .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
                
                let oppName = "Champion";
                if (titleFight) {
                   const oppId = titleFight.redFighterId === fighterId ? titleFight.blueFighterId : titleFight.redFighterId;
                   oppName = state.fighters[oppId] ? `${state.fighters[oppId].firstName} ${state.fighters[oppId].lastName}` : "Champion";
                }
                
                timeline.push({
                   date: titleFight ? titleFight.date : t.completedDate,
                   type: 'award',
                   title: 'Grand Prix Title Shot Used',
                   description: titleFight ? `Used Grand Prix title shot vs ${oppName} at ${titleFight.eventName}` : `Used Grand Prix title shot`
                });
             } else {
                timeline.push({
                   date: state.currentDate,
                   type: 'award',
                   title: 'Grand Prix Title Shot Pending',
                   description: `Undisputed title shot still pending`
                });
             }
          }
        }
     }
  });

  // Sort descending
  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return timeline;
}
