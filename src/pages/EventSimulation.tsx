import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatRankDisplay } from '../lib/game/rankings';
import FightBattle from './FightBattle';

export default function EventSimulation() {
  const { selectedEventId, events, fighters, startEventSimulation, setView, activeEventSimulation } = useGameStore();
  const event = selectedEventId ? events[selectedEventId] : null;
  const [expandedFights, setExpandedFights] = useState<Record<number, boolean>>({});

  if (!event) return <div>Event not found</div>;

  const isSimulating = activeEventSimulation?.eventId === event.id && !event.isCompleted;

  const toggleFight = (idx: number) => {
    setExpandedFights(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  if (isSimulating) {
    return <FightBattle />;
  }

  if (!event.isCompleted) {
    const hasStarted = event.fights.some(f => f.result);
    return (
      <div className="max-w-4xl mx-auto space-y-8 mt-10">
        <div className="text-center">
          <h1 className="text-4xl font-black text-white uppercase">{event.name}</h1>
          <p className="text-neutral-400 mt-2">{event.fights.length} Fights • {event.date}</p>
        </div>
        
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 max-w-2xl mx-auto space-y-3 shadow-lg">
          <h3 className="text-white font-bold mb-4 uppercase tracking-wider text-sm border-b border-neutral-800 pb-2">Fight Card</h3>
          {event.fights.map((f, i) => {
            const red = fighters[f.redCornerId];
            const blue = fighters[f.blueCornerId];
            const isMain = i === 0;
            const isCoMain = i === 1;
            
            let label = `Bout ${event.fights.length - i}`;
            if (isMain) label = 'Main Event';
            else if (isCoMain) label = 'Co-Main Event';
            
            return (
              <div key={i} className={`p-4 flex flex-col sm:flex-row justify-between items-center rounded border ${isMain ? 'bg-neutral-800 border-neutral-600' : 'bg-neutral-950 border-neutral-800'}`}>
                <div className="w-full sm:w-auto text-center sm:text-left text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 sm:mb-0 min-w-[100px]">
                  <div className={isMain || isCoMain ? 'text-yellow-500' : ''}>{label}</div>
                  <div className="mt-1">{f.weightClass} {f.isTitleFight && '🏆'}</div>
                  {f.result && <div className="mt-1 text-green-500">✓ Completed</div>}
                </div>
                
                <div className="flex-1 flex justify-between items-center w-full">
                  <span className="font-bold text-white w-[45%] text-right truncate text-sm sm:text-base">{red.firstName} {red.lastName}</span>
                  <span className="text-xs text-neutral-600 italic px-2">vs</span>
                  <span className="font-bold text-white w-[45%] text-left truncate text-sm sm:text-base">{blue.firstName} {blue.lastName}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center pt-6">
          <button 
            onClick={() => {
              startEventSimulation(event.id);
            }}
            className="bg-blue-600 text-white px-10 py-5 rounded-md font-black uppercase tracking-widest text-lg hover:bg-blue-500 transition-colors shadow-xl shadow-blue-900/20"
          >
            {hasStarted ? 'Resume Event' : 'Start Event'}
          </button>
          <p className="text-xs text-neutral-500 mt-4">Simulate fights one by one.</p>
        </div>
      </div>
    );
  }

  // Completed Event View
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-neutral-800 pb-4">
        <div>
          <h1 className="text-3xl font-black text-white uppercase">{event.name} Results</h1>
          <p className="text-neutral-400 mt-1">{event.date} • Simulated</p>
        </div>
        <button onClick={() => setView('dashboard')} className="bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded text-sm font-bold transition-colors">
          Return to Dashboard
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-neutral-900 p-4 rounded-lg border border-neutral-800 shadow-sm">
          <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold mb-1">Attendance</p>
          <p className="text-xl font-bold text-white">{event.results?.attendance.toLocaleString()}</p>
        </div>
        <div className="bg-neutral-900 p-4 rounded-lg border border-neutral-800 shadow-sm">
          <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold mb-1">Total Revenue</p>
          <p className="text-xl font-bold text-green-400">${event.results?.totalRevenue?.toLocaleString() || event.results?.gateRevenue?.toLocaleString()}</p>
        </div>
        <div className="bg-neutral-900 p-4 rounded-lg border border-neutral-800 shadow-sm">
          <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold mb-1">Total Cost</p>
          <p className="text-xl font-bold text-red-400">${event.results?.totalCost?.toLocaleString() || 'N/A'}</p>
        </div>
        <div className="bg-neutral-900 p-4 rounded-lg border border-neutral-800 shadow-sm">
          <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold mb-1">Net Profit</p>
          <p className={`text-xl font-bold ${event.results && event.results.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${event.results?.profit.toLocaleString()}
          </p>
        </div>
      </div>

      {event.results?.titleChanges && event.results.titleChanges.length > 0 && (
        <div className="bg-yellow-900/20 p-4 rounded-lg border border-yellow-700/50">
          <h3 className="text-yellow-500 font-black uppercase tracking-wider mb-2">Title Fights Summary</h3>
          {event.results.titleChanges.map((tc, idx) => {
            const fighter = tc.fighterId ? fighters[tc.fighterId] : null;
            
            if (tc.type === 'no_change') {
               return <p key={idx} className="text-white text-sm font-bold">🤝 {tc.weightClass} Title Unchanged (Draw)</p>;
            }
            if (!fighter) return null;

            if (tc.type === 'title_defense') {
               return <p key={idx} className="text-white text-sm font-bold">🛡️ {fighter.firstName} {fighter.lastName} defended the {tc.weightClass} Title!</p>;
            }
            if (tc.type === 'new_champion') {
               return <p key={idx} className="text-white text-sm font-bold">🏆 {fighter.firstName} {fighter.lastName} is the NEW {tc.weightClass} Champion!</p>;
            }
            if (tc.type === 'vacant_title_won') {
               return <p key={idx} className="text-white text-sm font-bold">🏆 {fighter.firstName} {fighter.lastName} won the vacant {tc.weightClass} Title!</p>;
            }
            return null;
          })}
        </div>
      )}
      
      {event.results?.totalRevenue && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-4">
           <h3 className="text-white font-bold uppercase tracking-wider text-sm border-b border-neutral-800 pb-2">Event P&L Breakdown</h3>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
             <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
                <p className="text-xs text-neutral-500 mb-1">Gate Revenue</p>
                <p className="text-green-400 font-mono">+${event.results.gateRevenue.toLocaleString()}</p>
             </div>
             <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
                <p className="text-xs text-neutral-500 mb-1">TV & Sponsor Revenue</p>
                <p className="text-green-400 font-mono">+${event.results.broadcastRevenue.toLocaleString()}</p>
             </div>
             <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
                <p className="text-xs text-neutral-500 mb-1">Venue Cost</p>
                <p className="text-red-400 font-mono">-${event.results.venueCost.toLocaleString()}</p>
             </div>
             <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
                <p className="text-xs text-neutral-500 mb-1">Marketing Cost</p>
                <p className="text-red-400 font-mono">-${event.results.marketingCost.toLocaleString()}</p>
             </div>
             <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
                <p className="text-xs text-neutral-500 mb-1">Fighter Base Pay</p>
                <p className="text-red-400 font-mono">-${event.results.fighterBasePay.toLocaleString()}</p>
             </div>
             <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
                <p className="text-xs text-neutral-500 mb-1">Win Bonuses</p>
                <p className="text-red-400 font-mono">-${event.results.fighterWinBonuses.toLocaleString()}</p>
             </div>
             <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
                <p className="text-xs text-neutral-500 mb-1">Fan Reaction</p>
                <p className="text-white font-mono">{Math.round(event.results.fanReaction)}/100</p>
             </div>
             <div className="bg-neutral-950 p-3 rounded border border-neutral-800 flex flex-col justify-center items-center">
                <p className="text-xs text-neutral-500 mb-1">Net Profit</p>
                <p className={`font-mono font-bold ${event.results.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                   {event.results.profit >= 0 ? '+' : ''}${event.results.profit.toLocaleString()}
                </p>
             </div>
           </div>
        </div>
      )}

      <div className="space-y-4 pt-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 border-b border-neutral-800 pb-2">
          Fight Results
        </h2>
        
        {event.fights.map((fight, idx) => {
          const red = fighters[fight.redCornerId];
          const blue = fighters[fight.blueCornerId];
          const res = fight.result;
          
          if (!res) return null;

          const isDraw = res.method === 'Draw';
          const winnerId = res.winnerId;
          const isExpanded = expandedFights[idx] || false;
          
          const isDecision = res.method.includes('Decision');

          return (
            <div key={idx} className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden shadow-sm transition-all relative">
              <div 
                className="bg-neutral-950 p-4 border-b border-neutral-800 flex flex-col sm:flex-row justify-between items-center cursor-pointer hover:bg-neutral-800/50 transition-colors relative"
                onClick={() => toggleFight(idx)}
              >
                <div className={`flex-1 w-full text-center sm:text-right font-black text-lg sm:text-xl truncate ${winnerId === red.id ? 'text-green-400' : isDraw ? 'text-yellow-400' : 'text-neutral-500'}`}>
                  {red.firstName} {red.lastName} {winnerId === red.id && '👑'}
                </div>
                
                <div className="w-full sm:w-40 text-center text-xs text-neutral-500 px-2 py-3 sm:py-0">
                  <div className="text-[10px] uppercase tracking-wider font-bold mb-1">{fight.weightClass} {fight.isTitleFight && '🏆 TITLE'}</div>
                  <div className="font-black text-white text-sm bg-neutral-900 inline-block px-2 py-1 rounded">{res.method}</div>
                  <div className="mt-1">R{res.round} • {res.time}</div>
                </div>
                
                <div className={`flex-1 w-full text-center sm:text-left font-black text-lg sm:text-xl truncate ${winnerId === blue.id ? 'text-green-400' : isDraw ? 'text-yellow-400' : 'text-neutral-500'}`}>
                  {winnerId === blue.id && '👑'} {blue.firstName} {blue.lastName}
                </div>

                <div className="absolute right-4 hidden sm:block text-neutral-600">
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </div>
              
              {isExpanded && (
                <div className="p-4 bg-neutral-900 text-sm text-neutral-300">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-2">
                      <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Round-by-Round Play-by-Play</h4>
                      <div className="max-h-64 overflow-y-auto pr-2 space-y-1.5 custom-scrollbar text-xs">
                        {res.commentary.map((line, i) => {
                          const isHeading = line.startsWith('---');
                          const isEnd = line.startsWith('End of');
                          return (
                            <p key={i} className={`
                              ${isHeading ? 'text-white font-bold mt-4 mb-2 text-sm border-b border-neutral-800 pb-1' : ''}
                              ${isEnd ? 'text-blue-400 italic mt-2 mb-4' : ''}
                            `}>
                              {line}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="bg-neutral-950 p-4 rounded border border-neutral-800">
                         <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Fight Metrics</h4>
                         <div className="flex justify-between text-xs mb-1">
                           <span className="text-neutral-400">Action Rating:</span>
                           <span className="text-white font-bold">{res.performanceRating}/100</span>
                         </div>
                         
                         {isDecision && res.scorecards && (
                           <div className="mt-4 pt-4 border-t border-neutral-800">
                             <span className="text-xs text-neutral-400 block mb-2">Judges' Scorecards:</span>
                             {res.scorecards.map((score, idx) => (
                               <div key={idx} className="flex justify-between text-xs font-mono mb-1">
                                 <span>Judge {idx+1}:</span>
                                 <span className="text-white">{score}</span>
                               </div>
                             ))}
                           </div>
                         )}

                         {event.results?.rankingChanges && (event.results.rankingChanges[red.id] || event.results.rankingChanges[blue.id]) && (
                           <div className="mt-4 pt-4 border-t border-neutral-800">
                             <span className="text-xs text-neutral-400 block mb-2">Ranking Updates:</span>
                             {[red, blue].map(f => {
                               const change = event.results?.rankingChanges?.[f.id];
                               if (!change) return null;
                               const movedUp = change.oldRank > change.newRank;
                               const oldIsChamp = change.oldRank === 0 && f.isChampion; // heuristic, as we might not know previous status perfectly, but works for UI
                               const newIsChamp = change.newRank === 0 && f.isChampion;
                               return (
                                 <div key={f.id} className="flex justify-between text-xs mb-1">
                                   <span>{f.lastName}:</span>
                                   <span className={movedUp ? 'text-green-400' : 'text-red-400'}>
                                     {formatRankDisplay(change.oldRank, oldIsChamp)} → {formatRankDisplay(change.newRank, newIsChamp)}
                                   </span>
                                 </div>
                               );
                             })}
                           </div>
                         )}
                      </div>

                      {res.injuries && res.injuries.length > 0 && (
                        <div className="bg-red-950/20 p-4 rounded border border-red-900/30">
                          <h4 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2">Injuries Sustained</h4>
                          {res.injuries.map((inj, i) => {
                            const injuredFighter = inj.fighterId === red.id ? red : blue;
                            return (
                              <div key={i} className="text-xs text-red-400 mb-1">
                                <span className="font-bold">{injuredFighter.lastName}</span>: {inj.type} ({inj.daysRemaining} days)
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
