import React, { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { ArrowLeft, UserCheck, UserMinus } from 'lucide-react';
import { getContractExpectation, evaluateOffer } from '../lib/game/contracts';
import { deriveFighterTimeline } from '../lib/game/timeline';

export default function FighterDetail() {
  const state = useGameStore();
  const { selectedFighterId, fighters, setView, signFighter, renewFighter, releaseFighter, promotion, fightArchive, titleHistory, news } = state;
  const f = selectedFighterId ? fighters[selectedFighterId] : null;

  const [offerPay, setOfferPay] = useState(10000);
  const [offerBonus, setOfferBonus] = useState(10000);
  const [offerFights, setOfferFights] = useState(3);
  const [negotiationResult, setNegotiationResult] = useState<{ accepted: boolean; reason: string } | null>(null);

  useEffect(() => {
    if (f) {
      const exp = getContractExpectation(f, promotion);
      setOfferPay(exp.basePay);
      setOfferBonus(exp.winBonus);
      setOfferFights(exp.fights);
    }
  }, [f?.id, promotion]);

  if (!f) {
    return <div>Fighter not found.</div>;
  }

  const handleSign = () => {
    setNegotiationResult(null);
    const result = evaluateOffer(f, promotion, offerPay, offerBonus, offerFights);
    setNegotiationResult(result);
    
    if (result.accepted) {
      if (f.contract) {
        renewFighter(f.id, offerPay, offerBonus, offerFights);
      } else {
        signFighter(f.id, offerPay, offerBonus, offerFights);
      }
    }
  };

  const handleRelease = () => {
    if (window.confirm(`Are you sure you want to release ${f.lastName}?`)) {
      releaseFighter(f.id);
      setView('roster');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button onClick={() => setView(f.contract ? 'roster' : 'free-agents')} className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 flex flex-col md:flex-row gap-6">
        <div className="flex-1">
          <div className="mb-4">
            <h1 className="text-3xl font-black text-white uppercase">{f.firstName} {f.lastName}</h1>
            {f.nickname && <p className="text-xl text-neutral-400 font-medium italic">"{f.nickname}"</p>}
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <p className="text-neutral-500">Weight Class</p>
              <p className="text-white font-bold">{f.weightClass}</p>
            </div>
            <div>
              <p className="text-neutral-500">Record</p>
              <p className="text-white font-bold">{f.record.wins}-{f.record.losses}-{f.record.draws} ({f.record.kos} KO, {f.record.subs} SUB)</p>
            </div>
            <div>
              <p className="text-neutral-500">Age / Nationality</p>
              <p className="text-white font-bold">{f.age} / {f.nationality}</p>
            </div>
            <div>
              <p className="text-neutral-500">Style</p>
              <p className="text-white font-bold">{f.style}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center mb-6">
            <div className="bg-neutral-950 p-2 rounded">
              <p className="text-xs text-neutral-500">Popularity</p>
              <p className="text-lg font-bold text-white">{f.popularity}</p>
            </div>
            <div className="bg-neutral-950 p-2 rounded">
              <p className="text-xs text-neutral-500">Momentum</p>
              <p className="text-lg font-bold text-white">{f.momentum}</p>
            </div>
            <div className="bg-neutral-950 p-2 rounded">
              <p className="text-xs text-neutral-500">Status</p>
              <div className="text-sm font-bold mt-1">
                {f.injuryStatus ? (
                  <span className="text-red-400">{f.injuryStatus.type} (Out {f.injuryStatus.daysRemaining} days)</span>
                ) : f.medicalSuspension ? (
                  <div className="text-purple-400">
                    <p>Suspended ({f.medicalSuspension.daysRemaining} days)</p>
                    <p className="text-[10px] font-normal mt-0.5 uppercase tracking-wide opacity-80">
                      Reason: {f.medicalSuspension.reason.replace('_', ' ')}
                      {f.medicalSuspension.sourceEventId ? ` • Event: ${state.events[f.medicalSuspension.sourceEventId]?.name || state.eventArchive?.[f.medicalSuspension.sourceEventId]?.name || 'Unknown Event'}` : ''}
                    </p>
                  </div>
                ) : f.fatigue > 50 ? (
                  <span className="text-orange-400">Fatigued</span>
                ) : (
                  <span className="text-green-400">Ready</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 bg-neutral-950 p-4 rounded border border-neutral-800">
          <h2 className="text-lg font-bold text-white mb-4">Attributes</h2>
          <div className="space-y-2">
            <AttrBar label="Striking" value={f.attributes.striking} />
            <AttrBar label="Grappling" value={f.attributes.grappling} />
            <AttrBar label="Wrestling" value={f.attributes.wrestling} />
            <AttrBar label="Submissions" value={f.attributes.submissions} />
            <AttrBar label="Cardio" value={f.attributes.cardio} />
            <AttrBar label="Chin" value={f.attributes.chin} />
            <AttrBar label="Power" value={f.attributes.power} />
            <AttrBar label="Speed" value={f.attributes.speed} />
            <AttrBar label="Defense" value={f.attributes.defense} />
            <AttrBar label="Fight IQ" value={f.attributes.fightIq} />
          </div>
        </div>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">
            {f.contract ? 'Contract & Extension' : 'Negotiate Contract'}
          </h2>
          {f.contract && (
            <button onClick={handleRelease} className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition-colors">
              <UserMinus size={16} /> Release Fighter
            </button>
          )}
        </div>
        
        {f.contract && (
          <div className="mb-6 bg-neutral-950 p-4 rounded border border-neutral-800 flex justify-between items-center">
            <div>
              <p className="text-sm text-neutral-400">Current Deal: <span className="text-white font-bold">${f.contract.payPerFight.toLocaleString()}</span> to show, <span className="text-white font-bold">${f.contract.winBonus.toLocaleString()}</span> to win</p>
              <p className={`text-sm font-bold mt-1 ${f.contract.fightsRemaining <= 1 ? 'text-red-400' : 'text-neutral-400'}`}>
                Fights Remaining: {f.contract.fightsRemaining}
              </p>
            </div>
            {f.isChampion && f.contract.fightsRemaining === 0 && (
              <div className="text-red-400 text-sm font-bold animate-pulse text-right">
                Champion contract expired!<br/>Renew immediately or vacate title.
              </div>
            )}
          </div>
        )}

        {negotiationResult && (
          <div className={`p-4 mb-4 rounded border ${negotiationResult.accepted ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
            <p className="font-bold">{negotiationResult.accepted ? 'Offer Accepted!' : 'Offer Rejected'}</p>
            <p className="text-sm mt-1">{negotiationResult.reason}</p>
          </div>
        )}

        <div className="mb-4">
          <p className="text-sm text-neutral-400">
            Expected Base: <span className="text-white">${getContractExpectation(f, promotion).basePay.toLocaleString()}</span> | 
            Expected Bonus: <span className="text-white">${getContractExpectation(f, promotion).winBonus.toLocaleString()}</span> | 
            Interest: <span className="text-white">{getContractExpectation(f, promotion).interestLabel}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Pay per Fight ($)</label>
            <input type="number" step="1000" value={offerPay} onChange={e => setOfferPay(Number(e.target.value))} className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-white" />
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Win Bonus ($)</label>
            <input type="number" step="1000" value={offerBonus} onChange={e => setOfferBonus(Number(e.target.value))} className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-white" />
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Fights</label>
            <input type="number" min="1" max="8" value={offerFights} onChange={e => setOfferFights(Number(e.target.value))} className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-white" />
          </div>
        </div>
        
        {!negotiationResult?.accepted && (
          <button onClick={handleSign} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition-colors">
            <UserCheck size={16} /> {f.contract ? 'Offer Extension' : 'Offer Contract'}
          </button>
        )}
      </div>

      {(() => {
        const fighterFights = Object.values(fightArchive)
          .filter(a => a.redFighterId === f.id || a.blueFighterId === f.id)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          
        if (fighterFights.length > 0) {
          const finishes = fighterFights.filter(a => a.winnerId === f.id && !a.method.includes('Decision')).length;
          const kos = fighterFights.filter(a => a.winnerId === f.id && a.method.includes('KO')).length;
          const subs = fighterFights.filter(a => a.winnerId === f.id && a.method.includes('Submission')).length;
          const decWins = fighterFights.filter(a => a.winnerId === f.id && a.method.includes('Decision')).length;
          const decLosses = fighterFights.filter(a => a.winnerId !== f.id && a.winnerId !== null && a.method.includes('Decision')).length;
          const titleFights = fighterFights.filter(a => a.isTitleFight).length;
          const avgPerf = Math.floor(fighterFights.reduce((acc, a) => acc + (a.performanceRating || 0), 0) / fighterFights.length);
          
          // Grand Prix Stats
          const tournamentsList = Object.values(state.tournaments || {});
          const gpWins = tournamentsList.filter(t => t.winnerId === f.id && t.status === 'completed').length;
          const gpFinals = tournamentsList.filter(t => t.status === 'completed' && t.fights.some(fight => fight.round === 'final' && (fight.redFighterId === f.id || fight.blueFighterId === f.id))).length;
          let gpRecordWins = 0;
          let gpRecordLosses = 0;
          tournamentsList.forEach(t => {
            t.fights.forEach(fight => {
              if (fight.isCompleted) {
                if (fight.redFighterId === f.id || fight.blueFighterId === f.id) {
                  if (fight.winnerId === f.id) gpRecordWins++;
                  else if (fight.winnerId) gpRecordLosses++;
                }
              }
            });
          });
          
          let currentStreak = 0;
          for (const a of fighterFights) {
             if (a.winnerId === f.id) currentStreak++;
             else break;
          }
          
          let maxStreak = 0;
          let tempStreak = 0;
          for (let i = fighterFights.length - 1; i >= 0; i--) {
             if (fighterFights[i].winnerId === f.id) tempStreak++;
             else { maxStreak = Math.max(maxStreak, tempStreak); tempStreak = 0; }
          }
          maxStreak = Math.max(maxStreak, tempStreak);
          
          return (
            <div className="space-y-6">
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
                <h2 className="text-lg font-bold text-white mb-4">Career Summary (In-Game)</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                   <div className="bg-neutral-950 p-3 rounded border border-neutral-800 text-center">
                      <div className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Title Fights</div>
                      <div className="text-xl font-bold text-yellow-500">{titleFights}</div>
                   </div>
                   <div className="bg-neutral-950 p-3 rounded border border-neutral-800 text-center">
                      <div className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Current Streak</div>
                      <div className="text-xl font-bold text-white">{currentStreak} {currentStreak > 0 ? 'W' : ''}</div>
                   </div>
                   <div className="bg-neutral-950 p-3 rounded border border-neutral-800 text-center">
                      <div className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Longest Win Streak</div>
                      <div className="text-xl font-bold text-white">{maxStreak}</div>
                   </div>
                   <div className="bg-neutral-950 p-3 rounded border border-neutral-800 text-center">
                      <div className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Avg Performance</div>
                      <div className="text-xl font-bold text-blue-400">{avgPerf}</div>
                   </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                   <div className="bg-neutral-950 p-3 rounded border border-neutral-800 text-center">
                      <div className="text-xs text-neutral-500 uppercase tracking-widest mb-1">KO/TKO Wins</div>
                      <div className="text-xl font-bold text-red-400">{kos}</div>
                   </div>
                   <div className="bg-neutral-950 p-3 rounded border border-neutral-800 text-center">
                      <div className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Sub Wins</div>
                      <div className="text-xl font-bold text-purple-400">{subs}</div>
                   </div>
                   <div className="bg-neutral-950 p-3 rounded border border-neutral-800 text-center">
                      <div className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Dec Wins</div>
                      <div className="text-xl font-bold text-neutral-300">{decWins}</div>
                   </div>
                   <div className="bg-neutral-950 p-3 rounded border border-neutral-800 text-center">
                      <div className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Dec Losses</div>
                      <div className="text-xl font-bold text-neutral-500">{decLosses}</div>
                   </div>
                </div>
                 
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div className="bg-neutral-950 p-3 rounded border border-neutral-800 text-center">
                       <div className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Grand Prix Wins</div>
                       <div className="text-xl font-bold text-purple-400">{gpWins}</div>
                    </div>
                    <div className="bg-neutral-950 p-3 rounded border border-neutral-800 text-center">
                       <div className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Grand Prix Finals</div>
                       <div className="text-xl font-bold text-blue-400">{gpFinals}</div>
                    </div>
                    <div className="bg-neutral-950 p-3 rounded border border-neutral-800 text-center">
                       <div className="text-xs text-neutral-500 uppercase tracking-widest mb-1">GP Record</div>
                       <div className="text-xl font-bold text-white">{gpRecordWins} - {gpRecordLosses}</div>
                    </div>
                    <div className="bg-neutral-950 p-3 rounded border border-neutral-800 text-center">
                       <div className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Promised Title Shot</div>
                       <div className={`text-xl font-bold ${f.titleShotPromised ? 'text-green-400' : 'text-neutral-500'}`}>
                         {f.titleShotPromised ? 'YES' : 'NO'}
                       </div>
                    </div>
                 </div>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
                <h2 className="text-lg font-bold text-white mb-4">Fight Log</h2>
                <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-neutral-800 text-neutral-500 uppercase tracking-wider text-xs">
                      <th className="pb-2 font-bold">Date</th>
                      <th className="pb-2 font-bold">Event</th>
                      <th className="pb-2 font-bold">Opponent</th>
                      <th className="pb-2 font-bold">Result</th>
                      <th className="pb-2 font-bold">Method</th>
                      <th className="pb-2 font-bold">Round</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/50">
                    {fighterFights.map(a => {
                      const isRed = a.redFighterId === f.id;
                      const opponentId = isRed ? a.blueFighterId : a.redFighterId;
                      const opponent = fighters[opponentId];
                      const opponentName = opponent ? `${opponent.firstName} ${opponent.lastName}` : 'Unknown';
                      const isWinner = a.winnerId === f.id;
                      const isDraw = a.winnerId === null;
                      
                      return (
                        <tr 
                          key={a.id} 
                          className="hover:bg-neutral-800/50 cursor-pointer transition-colors"
                          onClick={() => setView('fight-detail', { fightArchiveId: a.id })}
                        >
                          <td className="py-3 text-neutral-400 font-mono text-xs">{a.date}</td>
                          <td className="py-3 text-neutral-300 truncate max-w-[150px]">{a.eventName}</td>
                          <td className="py-3 text-white">vs. {opponentName} {a.isTitleFight && <span className="text-yellow-500 text-xs ml-1 font-bold">★</span>}</td>
                          <td className="py-3">
                             {isDraw ? <span className="text-neutral-400 font-bold">DRAW</span> : isWinner ? <span className="text-green-500 font-bold">WIN</span> : <span className="text-red-500 font-bold">LOSS</span>}
                          </td>
                          <td className="py-3 text-neutral-400">{a.method}</td>
                          <td className="py-3 text-neutral-400 font-mono text-xs">{a.round} ({a.time})</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
              <h2 className="text-lg font-bold text-white mb-4">Career Timeline</h2>
              <div className="relative border-l border-neutral-800 ml-3 space-y-6">
                {(() => {
                  const timeline = deriveFighterTimeline(state, f.id);

                  return timeline.map((item, idx) => (
                    <div key={idx} className="relative pl-6">
                      <div className={`absolute -left-1.5 top-1.5 w-3 h-3 rounded-full ${
                        item.type.includes('win') || item.type === 'title_defense' || item.type === 'unification' ? 'bg-green-500' :
                        item.type.includes('loss') ? 'bg-red-500' :
                        item.type.includes('draw') ? 'bg-neutral-500' :
                        item.type === 'injury' ? 'bg-orange-500' :
                        'bg-blue-500'
                      }`} />
                      <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-1 mb-1">
                        <span 
                          className={`font-bold text-sm ${item.fightId ? 'cursor-pointer hover:underline text-white' : 'text-white'}`}
                          onClick={() => item.fightId && setView('fight-detail', { fightArchiveId: item.fightId })}
                        >
                          {item.title}
                          {item.type.includes('title') || item.type === 'unification' ? <span className="text-yellow-500 ml-1">★</span> : null}
                        </span>
                        <span className="text-xs text-neutral-500 font-mono">{item.date}</span>
                      </div>
                      <p className="text-xs text-neutral-400">{item.description}</p>
                    </div>
                  ));
                })()}
              </div>
            </div>

            </div>
          );
        }
        
        return f.history.length > 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
            <h2 className="text-lg font-bold text-white mb-4">Recent Fights (Legacy)</h2>
            <div className="space-y-2">
              {f.history.map((h, i) => (
                <div key={i} className="text-sm bg-neutral-950 p-2 rounded border border-neutral-800 text-neutral-300">
                  {h}
                </div>
              ))}
            </div>
          </div>
        ) : null;
      })()}
    </div>
  );
}

function AttrBar({ label, value }: { label: string, value: number }) {
  const colorClass = value > 80 ? 'bg-green-500' : value > 60 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="w-24 text-neutral-400">{label}</span>
      <div className="flex-1 bg-neutral-900 rounded-full h-2 mx-2 overflow-hidden">
        <div className={`${colorClass} h-full`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-6 text-right font-mono text-white">{value}</span>
    </div>
  );
}
