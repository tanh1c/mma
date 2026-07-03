import React from 'react';
import { useGameStore } from '../store/gameStore';
import { WEIGHT_CLASSES } from '../lib/game/constants';
import { Trophy, Calendar, Star, TrendingUp } from 'lucide-react';

export default function HistoryStats() {
  const { eventArchive, fightArchive, titleHistory, fighters, setView, belts, yearlyAwards = {} } = useGameStore();

  const events = Object.values(eventArchive).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const fights = Object.values(fightArchive).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Legacy Calculation
  const legacyScores = Object.values(fighters).map(f => {
    let score = 0;
    let titleWins = 0;
    let interimTitleWins = 0;
    let titleDefenses = 0;
    let unificationWins = 0;
    
    // Core record
    score += f.record.wins * 1;
    score += (f.record.kos + f.record.subs) * 1;
    
    // Fight archive stats (performance, streaks, specific title fight types)
    const fFights = fights.filter(a => a.redFighterId === f.id || a.blueFighterId === f.id).reverse(); // oldest to newest
    let currentStreak = 0;
    let maxStreak = 0;
    let totalPerf = 0;
    let perfCount = 0;

    fFights.forEach(a => {
       if (a.winnerId === f.id) {
          currentStreak++;
          maxStreak = Math.max(maxStreak, currentStreak);
          
          if (a.isTitleFight && a.titleChangeInfo) {
             if (a.titleChangeInfo.type === 'unified') {
                unificationWins++;
                score += 8;
             }
          }
       } else {
          currentStreak = 0;
       }
       if (a.performanceRating) {
          totalPerf += a.performanceRating;
          perfCount++;
       }
    });

    if (maxStreak > 3) {
       score += (maxStreak - 3) * 2;
    }
    if (perfCount > 0) {
       score += Math.floor((totalPerf / perfCount) / 10);
    }
    
    // Title History
    const fHistory = titleHistory.filter(th => th.fighterId === f.id);
    fHistory.forEach(th => {
      if (th.beltType === 'interim') {
        interimTitleWins++;
        score += 5;
      } else {
        titleWins++;
        score += 10;
        score += (th.defenses * 5);
        titleDefenses += th.defenses;
      }
    });

    // Awards
    Object.values(yearlyAwards).forEach(award => {
      if (award.fighterOfTheYearId === f.id) score += 15;
      if (award.prospectOfTheYearId === f.id) score += 5;
    });

    return {
      fighter: f,
      score,
      titleWins,
      interimTitleWins,
      titleDefenses,
      unificationWins
    };
  }).filter(l => l.score > 0).sort((a, b) => b.score - a.score).slice(0, 10);
  
  const [selectedAwardYear, setSelectedAwardYear] = React.useState<number | null>(
    Object.keys(yearlyAwards).length > 0 ? Math.max(...Object.keys(yearlyAwards).map(Number)) : null
  );

  // Derive stats
  const totalEvents = events.length;
  const totalRevenue = events.reduce((sum, e) => sum + e.revenue, 0);
  const totalProfit = events.reduce((sum, e) => sum + e.profit, 0);
  
  const biggestEvent = events.length > 0 ? events.reduce((max, e) => e.attendance > max.attendance ? e : max, events[0]) : null;

  const topFights = [...fights].sort((a, b) => b.performanceRating - a.performanceRating).slice(0, 5);

  // Record Book Calculations
  const allFighters = Object.values(fighters);
  const mostWins = [...allFighters].sort((a, b) => b.record.wins - a.record.wins)[0];
  const mostKOs = [...allFighters].sort((a, b) => b.record.kos - a.record.kos)[0];
  const mostSubs = [...allFighters].sort((a, b) => b.record.subs - a.record.subs)[0];
  const mostFights = [...allFighters].sort((a, b) => (b.record.wins + b.record.losses + b.record.draws) - (a.record.wins + a.record.losses + a.record.draws))[0];
  
  const mostDefenses = [...titleHistory].sort((a, b) => b.defenses - a.defenses)[0];
  
  const mostProfitableEvent = [...events].sort((a, b) => b.profit - a.profit)[0];
  const biggestLossEvent = [...events].sort((a, b) => a.profit - b.profit)[0];
  
  const parseTime = (timeStr: string) => {
    const parts = timeStr.split(':');
    if (parts.length !== 2) return 999;
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  };
  
  const koFights = fights.filter(f => f.method.includes('KO'));
  const fastestKO = koFights.length > 0 ? [...koFights].sort((a, b) => {
    if (a.round !== b.round) return a.round - b.round;
    return parseTime(a.time) - parseTime(b.time);
  })[0] : null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto pb-12">
      <div className="flex justify-between items-center bg-neutral-900 p-6 rounded-lg border border-neutral-800">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-wider">Promotion History & Stats</h1>
          <p className="text-neutral-400 mt-1">Review your legacy and historical records.</p>
        </div>
        <div className="flex gap-4">
           <div className="text-right">
             <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold">Total Events</p>
             <p className="text-2xl font-bold text-white">{totalEvents}</p>
           </div>
           <div className="text-right pl-4 border-l border-neutral-800">
             <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold">Lifetime Profit</p>
             <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
               ${totalProfit.toLocaleString()}
             </p>
           </div>
        </div>
      </div>

      {/* Legacy Rankings */}
      <div className="bg-neutral-900 p-6 rounded-lg border border-neutral-800">
        <div className="flex items-center gap-2 mb-6">
          <Star className="w-5 h-5 text-yellow-500" />
          <h2 className="text-xl font-bold text-white uppercase tracking-tight">All-Time Legacy Rankings (Top 10)</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-500 uppercase tracking-wider text-xs">
                <th className="pb-2 font-bold w-12 text-center">Rank</th>
                <th className="pb-2 font-bold">Fighter</th>
                <th className="pb-2 font-bold">Weight Class</th>
                <th className="pb-2 font-bold">Record</th>
                <th className="pb-2 font-bold">Legacy Score</th>
                <th className="pb-2 font-bold text-right">Major Achievements</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {legacyScores.map((l, idx) => (
                <tr 
                  key={l.fighter.id} 
                  className="hover:bg-neutral-800/50 cursor-pointer transition-colors"
                  onClick={() => setView('fighter-detail', { fighterId: l.fighter.id })}
                >
                  <td className="py-3 text-center text-neutral-500 font-bold">#{idx + 1}</td>
                  <td className="py-3 text-white font-bold">{l.fighter.firstName} {l.fighter.lastName}</td>
                  <td className="py-3 text-neutral-400">{l.fighter.weightClass}</td>
                  <td className="py-3 text-neutral-300 font-mono text-xs">{l.fighter.record.wins}-{l.fighter.record.losses}-{l.fighter.record.draws}</td>
                  <td className="py-3 font-mono text-blue-400 font-bold text-lg">{l.score}</td>
                  <td className="py-3 text-right text-xs text-neutral-500">
                    {l.titleWins > 0 && <span className="text-yellow-500 mr-2">{l.titleWins}x Undisputed</span>}
                    {l.interimTitleWins > 0 && <span className="text-purple-400 mr-2">{l.interimTitleWins}x Interim</span>}
                    {l.titleDefenses > 0 && <span className="text-neutral-400 mr-2">{l.titleDefenses} Defenses</span>}
                    {l.unificationWins > 0 && <span className="text-blue-400">({l.unificationWins} Unified)</span>}
                  </td>
                </tr>
              ))}
              {legacyScores.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-neutral-500">No legacy data yet. Simulate more fights.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Yearly Awards */}
      {Object.keys(yearlyAwards).length > 0 && (
        <div className="bg-neutral-900 p-6 rounded-lg border border-neutral-800">
          <div className="flex justify-between items-center mb-6 border-b border-neutral-800 pb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <h2 className="text-xl font-bold text-white uppercase tracking-tight">Yearly Awards</h2>
            </div>
            
            <select 
              value={selectedAwardYear || ''}
              onChange={(e) => setSelectedAwardYear(Number(e.target.value))}
              className="bg-neutral-950 border border-neutral-700 text-white p-2 rounded focus:outline-none focus:border-neutral-500"
            >
              {Object.keys(yearlyAwards).sort((a,b) => Number(b) - Number(a)).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          
          {selectedAwardYear && yearlyAwards[selectedAwardYear] && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {/* Fighter of the Year */}
               {yearlyAwards[selectedAwardYear].fighterOfTheYearId && (
                 <div 
                   className="bg-neutral-950 p-4 rounded border border-yellow-900/50 cursor-pointer hover:bg-neutral-800 transition"
                   onClick={() => setView('fighter-detail', { fighterId: yearlyAwards[selectedAwardYear].fighterOfTheYearId })}
                 >
                    <div className="text-xs text-yellow-500 uppercase tracking-widest font-bold mb-1">Fighter of the Year</div>
                    <div className="text-lg text-white font-bold">
                       {fighters[yearlyAwards[selectedAwardYear].fighterOfTheYearId!]?.firstName} {fighters[yearlyAwards[selectedAwardYear].fighterOfTheYearId!]?.lastName}
                    </div>
                 </div>
               )}
               {/* Fight of the Year */}
               {yearlyAwards[selectedAwardYear].fightOfTheYearId && (
                 <div 
                   className="bg-neutral-950 p-4 rounded border border-blue-900/50 cursor-pointer hover:bg-neutral-800 transition"
                   onClick={() => setView('fight-detail', { fightArchiveId: yearlyAwards[selectedAwardYear].fightOfTheYearId })}
                 >
                    <div className="text-xs text-blue-500 uppercase tracking-widest font-bold mb-1">Fight of the Year</div>
                    <div className="text-sm text-white">
                       {fightArchive[yearlyAwards[selectedAwardYear].fightOfTheYearId!]?.eventName}
                    </div>
                 </div>
               )}
               {/* KO of the Year */}
               {yearlyAwards[selectedAwardYear].koOfTheYearFightId && (
                 <div 
                   className="bg-neutral-950 p-4 rounded border border-red-900/50 cursor-pointer hover:bg-neutral-800 transition"
                   onClick={() => setView('fight-detail', { fightArchiveId: yearlyAwards[selectedAwardYear].koOfTheYearFightId })}
                 >
                    <div className="text-xs text-red-500 uppercase tracking-widest font-bold mb-1">KO of the Year</div>
                    <div className="text-sm text-white">
                       {fightArchive[yearlyAwards[selectedAwardYear].koOfTheYearFightId!]?.eventName}
                    </div>
                 </div>
               )}
               {/* Sub of the Year */}
               {yearlyAwards[selectedAwardYear].submissionOfTheYearFightId && (
                 <div 
                   className="bg-neutral-950 p-4 rounded border border-purple-900/50 cursor-pointer hover:bg-neutral-800 transition"
                   onClick={() => setView('fight-detail', { fightArchiveId: yearlyAwards[selectedAwardYear].submissionOfTheYearFightId })}
                 >
                    <div className="text-xs text-purple-500 uppercase tracking-widest font-bold mb-1">Submission of the Year</div>
                    <div className="text-sm text-white">
                       {fightArchive[yearlyAwards[selectedAwardYear].submissionOfTheYearFightId!]?.eventName}
                    </div>
                 </div>
               )}
               {/* Upset of the Year */}
               {yearlyAwards[selectedAwardYear].upsetOfTheYearFightId && (
                 <div 
                   className="bg-neutral-950 p-4 rounded border border-green-900/50 cursor-pointer hover:bg-neutral-800 transition"
                   onClick={() => setView('fight-detail', { fightArchiveId: yearlyAwards[selectedAwardYear].upsetOfTheYearFightId })}
                 >
                    <div className="text-xs text-green-500 uppercase tracking-widest font-bold mb-1">Upset of the Year</div>
                    <div className="text-sm text-white">
                       {fightArchive[yearlyAwards[selectedAwardYear].upsetOfTheYearFightId!]?.eventName}
                    </div>
                 </div>
               )}
               {/* Prospect of the Year */}
               {yearlyAwards[selectedAwardYear].prospectOfTheYearId && (
                 <div 
                   className="bg-neutral-950 p-4 rounded border border-orange-900/50 cursor-pointer hover:bg-neutral-800 transition"
                   onClick={() => setView('fighter-detail', { fighterId: yearlyAwards[selectedAwardYear].prospectOfTheYearId })}
                 >
                    <div className="text-xs text-orange-500 uppercase tracking-widest font-bold mb-1">Prospect of the Year</div>
                    <div className="text-lg text-white font-bold">
                       {fighters[yearlyAwards[selectedAwardYear].prospectOfTheYearId!]?.firstName} {fighters[yearlyAwards[selectedAwardYear].prospectOfTheYearId!]?.lastName}
                    </div>
                 </div>
               )}
            </div>
          )}
        </div>
      )}

      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <TrendingUp className="text-blue-500" /> All-Time Record Book
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-neutral-950 border border-neutral-800 rounded p-4">
             <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold mb-1">Most Fights</p>
             {mostFights && (mostFights.record.wins + mostFights.record.losses + mostFights.record.draws) > 0 ? (
               <>
                 <p className="text-lg font-black text-white uppercase">{mostFights.lastName}</p>
                 <p className="text-sm text-neutral-400">{mostFights.record.wins + mostFights.record.losses + mostFights.record.draws} Fights</p>
               </>
             ) : <p className="text-sm text-neutral-600 italic">None yet</p>}
          </div>
          <div className="bg-neutral-950 border border-neutral-800 rounded p-4">
             <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold mb-1">Most Wins</p>
             {mostWins && mostWins.record.wins > 0 ? (
               <>
                 <p className="text-lg font-black text-white uppercase">{mostWins.lastName}</p>
                 <p className="text-sm text-neutral-400">{mostWins.record.wins} Wins</p>
               </>
             ) : <p className="text-sm text-neutral-600 italic">None yet</p>}
          </div>
          <div className="bg-neutral-950 border border-neutral-800 rounded p-4">
             <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold mb-1">Most KO/TKOs</p>
             {mostKOs && mostKOs.record.kos > 0 ? (
               <>
                 <p className="text-lg font-black text-white uppercase">{mostKOs.lastName}</p>
                 <p className="text-sm text-neutral-400">{mostKOs.record.kos} KOs</p>
               </>
             ) : <p className="text-sm text-neutral-600 italic">None yet</p>}
          </div>
          <div className="bg-neutral-950 border border-neutral-800 rounded p-4">
             <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold mb-1">Most Submissions</p>
             {mostSubs && mostSubs.record.subs > 0 ? (
               <>
                 <p className="text-lg font-black text-white uppercase">{mostSubs.lastName}</p>
                 <p className="text-sm text-neutral-400">{mostSubs.record.subs} Subs</p>
               </>
             ) : <p className="text-sm text-neutral-600 italic">None yet</p>}
          </div>
          <div className="bg-neutral-950 border border-neutral-800 rounded p-4">
             <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold mb-1">Most Title Defenses</p>
             {mostDefenses && mostDefenses.defenses > 0 ? (
               <>
                 <p className="text-lg font-black text-white uppercase">{fighters[mostDefenses.fighterId]?.lastName || 'Unknown'}</p>
                 <p className="text-sm text-neutral-400">{mostDefenses.defenses} Defenses ({mostDefenses.weightClass})</p>
               </>
             ) : <p className="text-sm text-neutral-600 italic">None yet</p>}
          </div>
          
          <div className="bg-neutral-950 border border-neutral-800 rounded p-4">
             <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold mb-1">Fastest KO/TKO</p>
             {fastestKO ? (
               <>
                 <p className="text-lg font-black text-white uppercase">{fighters[fastestKO.winnerId || '']?.lastName || 'Unknown'}</p>
                 <p className="text-sm text-neutral-400">R{fastestKO.round} {fastestKO.time}</p>
               </>
             ) : <p className="text-sm text-neutral-600 italic">None yet</p>}
          </div>
          <div className="bg-neutral-950 border border-neutral-800 rounded p-4">
             <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold mb-1">Highest Attendance</p>
             {biggestEvent && biggestEvent.attendance > 0 ? (
               <>
                 <p className="text-lg font-black text-white uppercase">{biggestEvent.name}</p>
                 <p className="text-sm text-neutral-400">{biggestEvent.attendance.toLocaleString()} Fans</p>
               </>
             ) : <p className="text-sm text-neutral-600 italic">None yet</p>}
          </div>
          <div className="bg-neutral-950 border border-neutral-800 rounded p-4">
             <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold mb-1">Most Profitable</p>
             {mostProfitableEvent && mostProfitableEvent.profit > 0 ? (
               <>
                 <p className="text-lg font-black text-white uppercase">{mostProfitableEvent.name}</p>
                 <p className="text-sm text-green-500">+${mostProfitableEvent.profit.toLocaleString()}</p>
               </>
             ) : <p className="text-sm text-neutral-600 italic">None yet</p>}
          </div>
          <div className="bg-neutral-950 border border-neutral-800 rounded p-4">
             <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold mb-1">Biggest Loss</p>
             {biggestLossEvent && biggestLossEvent.profit < 0 ? (
               <>
                 <p className="text-lg font-black text-white uppercase">{biggestLossEvent.name}</p>
                 <p className="text-sm text-red-500">-${Math.abs(biggestLossEvent.profit).toLocaleString()}</p>
               </>
             ) : <p className="text-sm text-neutral-600 italic">None yet</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Calendar className="text-blue-500" /> Past Events Archive
          </h2>
          {events.length === 0 ? (
            <p className="text-neutral-500 italic">No events completed yet.</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {events.map(e => (
                <div key={e.id} className="bg-neutral-950 p-3 rounded border border-neutral-800 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-white">{e.name}</h3>
                    <p className="text-xs text-neutral-500">{e.date} • {e.attendance.toLocaleString()} Fans</p>
                  </div>
                  <div className="text-right">
                     <p className={`text-sm font-bold ${e.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                       {e.profit >= 0 ? '+' : '-'}${Math.abs(e.profit).toLocaleString()}
                     </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Star className="text-yellow-500" /> Highest Rated Fights
          </h2>
          {topFights.length === 0 ? (
            <p className="text-neutral-500 italic">No fights recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {topFights.map(f => {
                const red = fighters[f.redFighterId];
                const blue = fighters[f.blueFighterId];
                return (
                  <div 
                    key={f.id} 
                    className="bg-neutral-950 p-3 rounded border border-neutral-800 cursor-pointer hover:bg-neutral-800 transition-colors"
                    onClick={() => setView('fight-detail', { fightArchiveId: f.id })}
                  >
                    <div className="flex justify-between items-start mb-2">
                       <span className="text-xs text-yellow-500 font-bold uppercase">{f.performanceRating}/100 Rating</span>
                       <span className="text-xs text-neutral-500">{f.date}</span>
                    </div>
                    <p className="font-bold text-white text-sm">
                      {red ? `${red.firstName} ${red.lastName}` : 'Unknown'} 
                      <span className="text-neutral-500 mx-2">vs</span> 
                      {blue ? `${blue.firstName} ${blue.lastName}` : 'Unknown'}
                    </p>
                    <p className="text-xs text-neutral-400 mt-1">
                      {f.winnerId === red?.id ? red?.lastName : blue?.lastName} won by {f.method} (R{f.round})
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Trophy className="text-yellow-500" /> Title Lineage
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {WEIGHT_CLASSES.map(wc => {
            const history = titleHistory.filter(th => th.weightClass === wc).sort((a, b) => new Date(b.dateWon).getTime() - new Date(a.dateWon).getTime());
            const beltId = `belt_${wc.toLowerCase()}`;
            const belt = belts[beltId];
            
            return (
              <div key={wc} className="bg-neutral-950 border border-neutral-800 rounded-lg p-4">
                <h3 className="font-bold text-yellow-500 uppercase tracking-wider border-b border-neutral-800 pb-2 mb-4">
                  {belt ? belt.shortName : wc}
                </h3>
                {history.length === 0 ? (
                  <p className="text-sm text-neutral-500 italic">No title history.</p>
                ) : (
                  <div className="space-y-4">
                    {history.map((th, idx) => {
                      const fighter = fighters[th.fighterId];
                      const isCurrent = th.status === 'active';
                      return (
                        <div key={th.id} className={`pl-4 border-l-2 ${isCurrent ? 'border-yellow-500' : th.status === 'cleared' ? 'border-neutral-800' : 'border-neutral-700'} relative`}>
                          <p className="text-[10px] text-neutral-500 font-mono mb-1">
                            {th.dateWon} - {th.dateLost || 'Present'}
                          </p>
                          <div className="flex items-center gap-2">
                            <p className={`font-bold ${isCurrent ? 'text-yellow-500' : th.status === 'cleared' ? 'text-neutral-500 line-through' : 'text-white'}`}>
                              {fighter ? `${fighter.firstName} ${fighter.lastName}` : 'Unknown'}
                            </p>
                            {th.beltType === 'interim' && (
                              <span className="text-[9px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded border border-neutral-700">INTERIM</span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-400 mt-0.5">
                            {th.defenses} successful {th.defenses === 1 ? 'defense' : 'defenses'}
                            {th.note && ` • ${th.note}`}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

    </div>
  );
}
