import React from 'react';
import { useGameStore } from '../store/gameStore';
import { ArrowLeft, Award, Activity } from 'lucide-react';
import { RoundStats, FightArchiveItem } from '../types/game';

export const FightDetail: React.FC = () => {
  const { fightArchive, selectedFightArchiveId, setView, fighters, belts } = useGameStore();

  if (!selectedFightArchiveId) return null;

  const archiveItem: FightArchiveItem = fightArchive[selectedFightArchiveId];
  if (!archiveItem) return <div className="text-white p-4">Fight not found</div>;

  const redFighter = fighters[archiveItem.redFighterId];
  const blueFighter = fighters[archiveItem.blueFighterId];
  const beltId = `belt_${archiveItem.weightClass.toLowerCase()}`;
  const belt = belts[beltId];

  // We fall back to redFighterId names if they don't exist in the current store (maybe retired/deleted)
  const redName = redFighter ? `${redFighter.firstName} ${redFighter.lastName}` : 'Red Fighter';
  const blueName = blueFighter ? `${blueFighter.firstName} ${blueFighter.lastName}` : 'Blue Fighter';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center space-x-4 mb-4">
        <button 
          onClick={() => setView('history')}
          className="p-2 hover:bg-neutral-800 rounded-full transition-colors text-neutral-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-black text-white uppercase tracking-tight">Fight Details</h1>
      </div>

      {/* Header Card */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1/2 h-1 bg-red-600"></div>
        <div className="absolute top-0 right-0 w-1/2 h-1 bg-blue-600"></div>

        <div className="flex justify-between items-center text-sm text-neutral-400 mb-6 uppercase tracking-wider font-bold">
          <span>{archiveItem.eventName}</span>
          <span>{archiveItem.date}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-center w-5/12">
            <h2 className="text-2xl md:text-3xl font-black text-white uppercase break-words">{redName}</h2>
            {archiveItem.redRecordAfter && (
              <p className="text-neutral-500 text-sm mt-1">{archiveItem.redRecordAfter}</p>
            )}
            {archiveItem.winnerId === archiveItem.redFighterId && (
              <div className="inline-block mt-2 px-3 py-1 bg-neutral-800 text-neutral-300 text-xs font-bold uppercase tracking-widest rounded-full">
                Winner
              </div>
            )}
          </div>
          
          <div className="text-center w-2/12 flex flex-col items-center">
            <span className="text-xl text-neutral-600 font-bold mb-2">VS</span>
            {archiveItem.isTitleFight && (
               <Award className="w-6 h-6 text-yellow-500 mx-auto" />
            )}
            <span className="text-xs text-neutral-500 uppercase tracking-widest mt-1 block">
              {archiveItem.isTitleFight && belt ? belt.shortName : archiveItem.weightClass}
            </span>
            {archiveItem.tournamentRound && (
              <span className="mt-2 inline-block px-2 py-0.5 bg-purple-900/30 text-purple-400 text-[10px] font-black uppercase tracking-wider rounded border border-purple-800/20">
                {archiveItem.tournamentRound === 'quarterfinal' ? 'GP Quarterfinal' : archiveItem.tournamentRound === 'semifinal' ? 'GP Semifinal' : 'GP Final'}
              </span>
            )}
          </div>

          <div className="text-center w-5/12">
            <h2 className="text-2xl md:text-3xl font-black text-white uppercase break-words">{blueName}</h2>
            {archiveItem.blueRecordAfter && (
              <p className="text-neutral-500 text-sm mt-1">{archiveItem.blueRecordAfter}</p>
            )}
            {archiveItem.winnerId === archiveItem.blueFighterId && (
              <div className="inline-block mt-2 px-3 py-1 bg-neutral-800 text-neutral-300 text-xs font-bold uppercase tracking-widest rounded-full">
                Winner
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Result Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
          <h3 className="text-sm text-neutral-400 uppercase tracking-widest font-bold mb-4 flex items-center">
             <Activity className="w-4 h-4 mr-2" /> Official Result
          </h3>
          <div className="space-y-3">
             <div className="flex justify-between border-b border-neutral-800 pb-2">
               <span className="text-neutral-500">Method</span>
               <span className="text-white font-bold">{archiveItem.method}</span>
             </div>
             <div className="flex justify-between border-b border-neutral-800 pb-2">
               <span className="text-neutral-500">Round</span>
               <span className="text-white font-bold">{archiveItem.round}</span>
             </div>
             <div className="flex justify-between border-b border-neutral-800 pb-2">
               <span className="text-neutral-500">Time</span>
               <span className="text-white font-bold">{archiveItem.time}</span>
             </div>
             <div className="flex justify-between">
               <span className="text-neutral-500">Performance</span>
               <span className="text-yellow-500 font-bold">{archiveItem.performanceRating} / 100</span>
             </div>
          </div>
        </div>

        {archiveItem.scorecards && archiveItem.scorecards.length > 0 && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
            <h3 className="text-sm text-neutral-400 uppercase tracking-widest font-bold mb-4">Scorecards</h3>
            <div className="space-y-2">
               {archiveItem.scorecards.map((score, idx) => (
                 <div key={idx} className="flex justify-between p-2 bg-neutral-800/50 rounded">
                   <span className="text-neutral-400 font-mono">Judge {idx + 1}</span>
                   <span className="text-white font-bold font-mono">{score}</span>
                 </div>
               ))}
            </div>
          </div>
        )}
      </div>

      {/* Injuries / Title Changes */}
      {(archiveItem.injuries?.length || archiveItem.titleChangeInfo) && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
          {archiveItem.titleChangeInfo && (
            <div className="mb-4">
              <h3 className="text-sm text-yellow-500 uppercase tracking-widest font-bold mb-2">Title Status</h3>
              <p className="text-white">
                {archiveItem.titleChangeInfo.type === 'new_champion' && "AND NEW Champion!"}
                {archiveItem.titleChangeInfo.type === 'title_defense' && "AND STILL Champion!"}
                {archiveItem.titleChangeInfo.type === 'vacant_title_won' && "New Champion Crowned!"}
                {archiveItem.titleChangeInfo.type === 'interim_won' && "AND NEW Interim Champion!"}
                {archiveItem.titleChangeInfo.type === 'interim_defense' && "AND STILL Interim Champion!"}
                {archiveItem.titleChangeInfo.type === 'unified' && "UNDISPUTED Champion!"}
              </p>
            </div>
          )}
          {archiveItem.injuries && archiveItem.injuries.length > 0 && (
            <div>
              <h3 className="text-sm text-red-400 uppercase tracking-widest font-bold mb-2">Medical Suspensions</h3>
              <ul className="space-y-1">
                {archiveItem.injuries.map((inj, idx) => {
                   const fName = inj.fighterId === archiveItem.redFighterId ? redName : blueName;
                   return (
                     <li key={idx} className="text-neutral-300 text-sm">
                       <span className="font-bold">{fName}</span> suffered a <span className="text-red-300">{inj.type}</span> (Out {inj.daysRemaining} days)
                     </li>
                   );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Total Fight Summary */}
      {archiveItem.roundStats && archiveItem.roundStats.length > 0 && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
           <h2 className="text-xl font-black text-white uppercase tracking-tight border-b border-neutral-800 pb-4 mb-4">Total Fight Stats</h2>
           
           {(() => {
             const rs = archiveItem.roundStats;
             const redTotal = rs.reduce((acc, r) => {
                acc.sigLanded += r.red.significantStrikesLanded;
                acc.sigAtt += r.red.significantStrikesAttempted;
                acc.totLanded += r.red.totalStrikesLanded;
                acc.totAtt += r.red.totalStrikesAttempted;
                acc.head += r.red.headStrikesLanded;
                acc.body += r.red.bodyStrikesLanded;
                acc.leg += r.red.legStrikesLanded;
                acc.tdLanded += r.red.takedownsLanded;
                acc.tdAtt += r.red.takedownsAttempted;
                acc.ctrl += r.red.controlSeconds;
                acc.sub += r.red.submissionAttempts;
                acc.kd += r.red.knockdowns;
                acc.dmg += r.red.damageGiven;
                return acc;
             }, { sigLanded: 0, sigAtt: 0, totLanded: 0, totAtt: 0, head: 0, body: 0, leg: 0, tdLanded: 0, tdAtt: 0, ctrl: 0, sub: 0, kd: 0, dmg: 0 });
             
             const blueTotal = rs.reduce((acc, r) => {
                acc.sigLanded += r.blue.significantStrikesLanded;
                acc.sigAtt += r.blue.significantStrikesAttempted;
                acc.totLanded += r.blue.totalStrikesLanded;
                acc.totAtt += r.blue.totalStrikesAttempted;
                acc.head += r.blue.headStrikesLanded;
                acc.body += r.blue.bodyStrikesLanded;
                acc.leg += r.blue.legStrikesLanded;
                acc.tdLanded += r.blue.takedownsLanded;
                acc.tdAtt += r.blue.takedownsAttempted;
                acc.ctrl += r.blue.controlSeconds;
                acc.sub += r.blue.submissionAttempts;
                acc.kd += r.blue.knockdowns;
                acc.dmg += r.blue.damageGiven;
                return acc;
             }, { sigLanded: 0, sigAtt: 0, totLanded: 0, totAtt: 0, head: 0, body: 0, leg: 0, tdLanded: 0, tdAtt: 0, ctrl: 0, sub: 0, kd: 0, dmg: 0 });
             
             return (
               <div className="space-y-3">
                  <StatRow label="Significant Strikes" red={`${redTotal.sigLanded} / ${redTotal.sigAtt}`} blue={`${blueTotal.sigLanded} / ${blueTotal.sigAtt}`} />
                  <StatRow label="Total Strikes" red={`${redTotal.totLanded} / ${redTotal.totAtt}`} blue={`${blueTotal.totLanded} / ${blueTotal.totAtt}`} />
                  <StatRow label="Head Strikes" red={redTotal.head} blue={blueTotal.head} />
                  <StatRow label="Body / Leg Strikes" red={`${redTotal.body} / ${redTotal.leg}`} blue={`${blueTotal.body} / ${blueTotal.leg}`} />
                  <StatRow label="Takedowns" red={`${redTotal.tdLanded} / ${redTotal.tdAtt}`} blue={`${blueTotal.tdLanded} / ${blueTotal.tdAtt}`} />
                  <StatRow label="Control Time" red={`${Math.floor(redTotal.ctrl / 60)}:${(redTotal.ctrl % 60).toString().padStart(2, '0')}`} blue={`${Math.floor(blueTotal.ctrl / 60)}:${(blueTotal.ctrl % 60).toString().padStart(2, '0')}`} />
                  <StatRow label="Sub Attempts" red={redTotal.sub} blue={blueTotal.sub} />
                  <StatRow label="Knockdowns" red={redTotal.kd} blue={blueTotal.kd} />
                  <StatRow label="Damage Given" red={Math.floor(redTotal.dmg)} blue={Math.floor(blueTotal.dmg)} />
               </div>
             );
           })()}
        </div>
      )}

      {/* Round Stats */}
      {archiveItem.roundStats && archiveItem.roundStats.length > 0 ? (
        <div className="space-y-6">
          <h2 className="text-xl font-black text-white uppercase tracking-tight border-b border-neutral-800 pb-2">Round by Round</h2>
          
          {archiveItem.roundStats.map((rs, idx) => (
            <div key={idx} className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
              <div className="bg-neutral-800 px-4 py-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-white font-black uppercase">Round {rs.round}</span>
                  {rs.dominanceLevel && (
                    <span className={`text-xs px-2 py-0.5 rounded uppercase font-bold tracking-wider ${
                      rs.dominanceLevel === 'close' ? 'bg-neutral-700 text-neutral-300' :
                      rs.dominanceLevel === 'clear' ? 'bg-blue-900/50 text-blue-300' :
                      rs.dominanceLevel === 'dominant' ? 'bg-purple-900/50 text-purple-300' :
                      'bg-red-900/50 text-red-300'
                    }`}>
                      {rs.dominanceLevel.replace('_', ' ')}
                    </span>
                  )}
                </div>
                <span className="text-neutral-400 text-sm font-medium">{rs.summary}</span>
              </div>
              
              <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Judges */}
                {rs.judges && (
                  <div className="lg:col-span-1 space-y-2">
                    <h4 className="text-xs text-neutral-500 uppercase font-bold tracking-widest mb-3">Judges' Score</h4>
                    {rs.judges.map(j => (
                      <div key={j.judgeId} className="flex justify-between items-center bg-neutral-950 p-2 rounded border border-neutral-800/50">
                        <div className="flex flex-col">
                          <span className="text-neutral-400 text-xs font-bold">{j.judgeId}</span>
                          {j.reason && <span className="text-[10px] text-neutral-600 uppercase mt-0.5">{j.reason.replace('-', ' ')}</span>}
                        </div>
                        <span className="text-white font-mono text-sm">
                          <span className={j.redScore > j.blueScore ? 'text-red-400 font-bold' : (j.redScore < 10 ? 'text-neutral-500' : '')}>{j.redScore}</span>
                          <span className="text-neutral-600 mx-1">-</span>
                          <span className={j.blueScore > j.redScore ? 'text-blue-400 font-bold' : (j.blueScore < 10 ? 'text-neutral-500' : '')}>{j.blueScore}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Stats */}
                <div className="lg:col-span-2">
                  <h4 className="text-xs text-neutral-500 uppercase font-bold tracking-widest mb-3 text-center">Fighter Stats</h4>
                  <div className="space-y-2">
                    <StatRow label="Significant Strikes" red={`${rs.red.significantStrikesLanded} / ${rs.red.significantStrikesAttempted}`} blue={`${rs.blue.significantStrikesLanded} / ${rs.blue.significantStrikesAttempted}`} />
                    <StatRow label="Total Strikes" red={`${rs.red.totalStrikesLanded} / ${rs.red.totalStrikesAttempted}`} blue={`${rs.blue.totalStrikesLanded} / ${rs.blue.totalStrikesAttempted}`} />
                    <StatRow label="Head Strikes" red={rs.red.headStrikesLanded} blue={rs.blue.headStrikesLanded} />
                    <StatRow label="Body / Leg Strikes" red={`${rs.red.bodyStrikesLanded} / ${rs.red.legStrikesLanded}`} blue={`${rs.blue.bodyStrikesLanded} / ${rs.blue.legStrikesLanded}`} />
                    <StatRow label="Takedowns" red={`${rs.red.takedownsLanded} / ${rs.red.takedownsAttempted}`} blue={`${rs.blue.takedownsLanded} / ${rs.blue.takedownsAttempted}`} />
                    <StatRow label="Control Time" red={`${Math.floor(rs.red.controlSeconds / 60)}:${(rs.red.controlSeconds % 60).toString().padStart(2, '0')}`} blue={`${Math.floor(rs.blue.controlSeconds / 60)}:${(rs.blue.controlSeconds % 60).toString().padStart(2, '0')}`} />
                    <StatRow label="Sub Attempts" red={rs.red.submissionAttempts} blue={rs.blue.submissionAttempts} />
                    <StatRow label="Knockdowns" red={rs.red.knockdowns} blue={rs.blue.knockdowns} />
                  </div>
                </div>
              </div>

              {rs.keyMoments && rs.keyMoments.length > 0 && (
                <div className="border-t border-neutral-800 p-4 bg-neutral-950/50">
                  <h4 className="text-xs text-neutral-500 uppercase font-bold tracking-widest mb-2">Key Moments</h4>
                  <ul className="list-disc list-inside text-sm text-neutral-300 space-y-1">
                    {rs.keyMoments.map((km, i) => <li key={i}>{km}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-8 text-center text-neutral-500">
          No detailed round stats available for this archived fight.
        </div>
      )}

      {/* Commentary */}
      {archiveItem.commentary && archiveItem.commentary.length > 0 && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
          <div className="bg-neutral-800 px-4 py-3">
             <h3 className="text-white font-black uppercase tracking-tight">Full Play-by-Play</h3>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto space-y-2">
            {archiveItem.commentary.map((line, idx) => (
              <p key={idx} className={`text-sm ${line.startsWith('---') || line.startsWith('End of') || line.startsWith('We go to') || line.startsWith('The winner') || line.startsWith('BOOM') || line.startsWith('The referee') || line.startsWith('OH!') ? 'font-bold text-white my-3' : 'text-neutral-400'}`}>
                {line}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const StatRow = ({ label, red, blue }: { label: string, red: string | number, blue: string | number }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-neutral-800/50 last:border-0">
    <span className="w-1/3 text-center text-sm font-mono text-red-400 font-bold">{red}</span>
    <span className="w-1/3 text-center text-xs text-neutral-500 uppercase tracking-wider">{label}</span>
    <span className="w-1/3 text-center text-sm font-mono text-blue-400 font-bold">{blue}</span>
  </div>
);
