import React, { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

export default function FightBattle() {
  const { 
    selectedEventId, 
    events, 
    fighters, 
    belts,
    activeEventSimulation,
    simulateNextFightPreview,
    updateActiveSimulation,
    confirmPendingFightAndAdvance,
    finalizeCurrentEvent 
  } = useGameStore();
  
  const [autoPlay, setAutoPlay] = useState(false);

  const event = selectedEventId ? events[selectedEventId] : null;
  const isAllFightsDone = activeEventSimulation ? activeEventSimulation.activeFightIndex < 0 : true;

  useEffect(() => {
    if (isAllFightsDone && event && !event.isCompleted) {
      finalizeCurrentEvent();
    }
  }, [isAllFightsDone, event, finalizeCurrentEvent]);

  const activeFightIndex = activeEventSimulation?.activeFightIndex ?? -1;
  const matchup = event?.fights[activeFightIndex];
  
  const result = activeEventSimulation?.pendingResult;
  const isSimulated = activeEventSimulation?.status !== 'idle' && activeEventSimulation?.status !== undefined;
  const totalLines = result ? result.commentary.length : 0;
  const revealedLines = activeEventSimulation?.revealedLines ?? 0;
  const isFinished = isSimulated && revealedLines >= totalLines;

  const revealedRounds = result ? (isFinished ? (result.roundStats?.length || 0) : result.commentary.slice(0, revealedLines).filter(line => line.startsWith('End of Round')).length) : 0;

  // Auto-play logic
  useEffect(() => {
    if (autoPlay && isSimulated && !isFinished) {
      const timer = setTimeout(() => {
        updateActiveSimulation({ revealedLines: revealedLines + 1 });
      }, 800); // 800ms per line
      return () => clearTimeout(timer);
    }
    if (isFinished && autoPlay) {
      setAutoPlay(false);
    }
  }, [autoPlay, isSimulated, isFinished, revealedLines, updateActiveSimulation]);

  // Reset auto-play when fight changes
  useEffect(() => {
    setAutoPlay(false);
  }, [activeFightIndex]);

  if (!event || isAllFightsDone || !activeEventSimulation) {
    return null;
  }

  if (!matchup) return null;

  const red = fighters[matchup.redCornerId];
  const blue = fighters[matchup.blueCornerId];
  if (!red || !blue) return null;

  const handleRevealNext = () => updateActiveSimulation({ revealedLines: Math.min(revealedLines + 1, totalLines) });
  const handleRevealAll = () => updateActiveSimulation({ revealedLines: totalLines });

  const handleFinishFight = () => {
    confirmPendingFightAndAdvance();
  };

  let label = `Bout ${event.fights.length - activeFightIndex}`;
  if (activeFightIndex === 0) label = 'Main Event';
  else if (activeFightIndex === 1) label = 'Co-Main Event';

  return (
    <div className="max-w-4xl mx-auto space-y-6 mt-6 mb-12">
      <div className="text-center">
        <h1 className="text-3xl font-black text-white uppercase">{event.name}</h1>
        <p className="text-yellow-500 font-bold uppercase tracking-widest mt-1">{label}</p>
        <p className="text-neutral-400 text-sm mt-1">
          {matchup.weightClass} 
          {matchup.isTitleFight && (
            <span className="text-yellow-500 ml-1">
              🏆 {matchup.titleFightType === 'interim' ? 'INTERIM ' : matchup.titleFightType === 'unification' ? 'UNIFICATION ' : ''}
              {belts['belt_' + matchup.weightClass.toLowerCase()]?.shortName || 'TITLE FIGHT'}
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Red Corner */}
        <div className="bg-neutral-900 border-2 border-red-900/50 rounded-lg p-6 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-red-600"></div>
          <h2 className="text-2xl font-black text-white uppercase">{red.firstName} {red.lastName}</h2>
          <p className="text-neutral-400 font-mono text-sm mt-1">({red.record.wins}-{red.record.losses}-{red.record.draws})</p>
          <div className="mt-4 inline-block bg-neutral-950 px-3 py-1 rounded text-xs font-bold text-neutral-300 uppercase tracking-wider">
            {red.style}
          </div>
          {red.isChampion && <div className="mt-2 text-yellow-500 font-bold text-sm">👑 CHAMPION</div>}
        </div>

        {/* Blue Corner */}
        <div className="bg-neutral-900 border-2 border-blue-900/50 rounded-lg p-6 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-600"></div>
          <h2 className="text-2xl font-black text-white uppercase">{blue.firstName} {blue.lastName}</h2>
          <p className="text-neutral-400 font-mono text-sm mt-1">({blue.record.wins}-{blue.record.losses}-{blue.record.draws})</p>
          <div className="mt-4 inline-block bg-neutral-950 px-3 py-1 rounded text-xs font-bold text-neutral-300 uppercase tracking-wider">
            {blue.style}
          </div>
          {blue.isChampion && <div className="mt-2 text-yellow-500 font-bold text-sm">👑 CHAMPION</div>}
        </div>
      </div>

      {!isSimulated ? (
        <div className="text-center py-12 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl">
          <button 
            onClick={() => simulateNextFightPreview()}
            className="bg-red-600 hover:bg-red-500 text-white px-8 py-4 rounded font-black uppercase tracking-widest text-lg transition-colors shadow-lg shadow-red-900/20"
          >
            Begin Fight
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden shadow-xl flex flex-col h-[500px]">
            <div className="bg-neutral-950 p-4 border-b border-neutral-800 flex flex-wrap gap-2 justify-center shrink-0">
              {!isFinished && (
                <>
                  <button onClick={handleRevealNext} className="bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded text-sm font-bold transition-colors">
                    Next Line
                  </button>
                  <button onClick={() => setAutoPlay(!autoPlay)} className={`px-4 py-2 rounded text-sm font-bold transition-colors ${autoPlay ? 'bg-blue-600 text-white' : 'bg-neutral-800 hover:bg-neutral-700 text-white'}`}>
                    {autoPlay ? 'Stop Auto' : 'Auto Play'}
                  </button>
                  <button onClick={handleRevealAll} className="bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white px-4 py-2 rounded text-sm transition-colors">
                    Skip to Result
                  </button>
                </>
              )}
              {isFinished && (
                <button onClick={handleFinishFight} className="bg-green-600 hover:bg-green-500 text-white px-8 py-2 rounded font-black uppercase tracking-widest text-sm transition-colors shadow-lg shadow-green-900/20">
                  {activeFightIndex === 0 ? 'Confirm & Finish Event' : 'Confirm Result & Next Fight'}
                </button>
              )}
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col-reverse">
              <div className="space-y-2">
                {result?.commentary.slice(0, revealedLines).map((line, i) => {
                  const isHeading = line.startsWith('---');
                  const isEnd = line.startsWith('End of');
                  return (
                    <p key={i} className={`text-sm ${isHeading ? 'text-white font-bold mt-6 mb-2 text-base border-b border-neutral-800 pb-1' : isEnd ? 'text-blue-400 italic mt-2 mb-4' : 'text-neutral-300'}`}>
                      {line}
                    </p>
                  );
                })}
                
                {isFinished && result && (
                  <div className="mt-8 pt-6 border-t border-neutral-800 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h3 className="text-center text-3xl font-black text-white uppercase tracking-wider mb-2">
                      {result.winnerId ? `${fighters[result.winnerId].lastName} wins!` : 'DRAW!'}
                    </h3>
                    <p className="text-center text-neutral-400 font-mono">
                      via {result.method} (R{result.round} - {result.time})
                    </p>
                    
                    {result.method.includes('Decision') && result.scorecards && (
                      <div className="mt-6 flex justify-center gap-4 text-xs font-mono text-neutral-500">
                        {result.scorecards.map((s, i) => <span key={i} className="bg-neutral-950 px-2 py-1 rounded">Judge {i+1}: {s}</span>)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-1 space-y-4">
             <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-widest border-b border-neutral-800 pb-2">Round Stats</h3>
             
             {result?.roundStats && result.roundStats.slice(0, revealedRounds).map((rs, idx) => (
                <div key={idx} className="bg-neutral-900 border border-neutral-800 rounded p-4 animate-in fade-in slide-in-from-right-4 duration-300">
                   <div className="flex justify-between items-center mb-3">
                      <span className="text-white font-bold text-sm uppercase">Round {rs.round}</span>
                      <span className="text-xs text-neutral-500">{rs.summary}</span>
                   </div>
                   
                   <div className="space-y-2 text-xs">
                      <div className="flex justify-between border-b border-neutral-800/50 pb-1">
                         <span className="w-1/3 text-left font-mono text-red-400 font-bold">{rs.red.significantStrikesLanded}/{rs.red.significantStrikesAttempted}</span>
                         <span className="w-1/3 text-center text-neutral-500">Sig. Str.</span>
                         <span className="w-1/3 text-right font-mono text-blue-400 font-bold">{rs.blue.significantStrikesLanded}/{rs.blue.significantStrikesAttempted}</span>
                      </div>
                      <div className="flex justify-between border-b border-neutral-800/50 pb-1">
                         <span className="w-1/3 text-left font-mono text-red-400 font-bold">{rs.red.totalStrikesLanded}/{rs.red.totalStrikesAttempted}</span>
                         <span className="w-1/3 text-center text-neutral-500">Total Str.</span>
                         <span className="w-1/3 text-right font-mono text-blue-400 font-bold">{rs.blue.totalStrikesLanded}/{rs.blue.totalStrikesAttempted}</span>
                      </div>
                      <div className="flex justify-between border-b border-neutral-800/50 pb-1">
                         <span className="w-1/3 text-left font-mono text-red-400 font-bold">{rs.red.takedownsLanded}/{rs.red.takedownsAttempted}</span>
                         <span className="w-1/3 text-center text-neutral-500">Takedowns</span>
                         <span className="w-1/3 text-right font-mono text-blue-400 font-bold">{rs.blue.takedownsLanded}/{rs.blue.takedownsAttempted}</span>
                      </div>
                      <div className="flex justify-between">
                         <span className="w-1/3 text-left font-mono text-red-400 font-bold">{Math.floor(rs.red.controlSeconds/60)}:{(rs.red.controlSeconds%60).toString().padStart(2,'0')}</span>
                         <span className="w-1/3 text-center text-neutral-500">Control</span>
                         <span className="w-1/3 text-right font-mono text-blue-400 font-bold">{Math.floor(rs.blue.controlSeconds/60)}:{(rs.blue.controlSeconds%60).toString().padStart(2,'0')}</span>
                      </div>
                   </div>
                </div>
             ))}
             
             {revealedRounds === 0 && (
               <div className="text-center text-neutral-600 text-sm mt-10">
                 Stats will appear after round ends
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
}
