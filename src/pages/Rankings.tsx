import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { WeightClass } from '../types/game';
import { Select } from '../components/Select';

export default function Rankings() {
  const { rankings, fighters, setView } = useGameStore();
  const [selectedWC, setSelectedWC] = useState<string>('Lightweight');

  const currentRankings = rankings[selectedWC as WeightClass] || [];
  const beltId = `belt_${selectedWC.toLowerCase()}`;
  const belt = useGameStore(state => state.belts[beltId]);
  const titleInfo = useGameStore(state => state.titles[selectedWC as WeightClass]);

  const wcOptions = [
    { value: 'Heavyweight', label: 'Heavyweight' },
    { value: 'Middleweight', label: 'Middleweight' },
    { value: 'Welterweight', label: 'Welterweight' },
    { value: 'Lightweight', label: 'Lightweight' },
    { value: 'Featherweight', label: 'Featherweight' },
    { value: 'Bantamweight', label: 'Bantamweight' }
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-black text-white uppercase">Promotion Rankings</h1>
        <Select 
          value={selectedWC} 
          onChange={setSelectedWC}
          options={wcOptions}
          className="w-48"
        />
      </div>

      {belt && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-yellow-500 uppercase tracking-tight">{belt.name}</h2>
            <p className="text-sm text-neutral-400 mt-1">Prestige: <span className="text-white font-bold">{Math.floor(belt.prestige)} / 100</span></p>
          </div>
          <div className="md:text-right flex flex-col md:items-end gap-2">
            {titleInfo?.undisputedChampionId ? (() => {
              const champ = fighters[titleInfo.undisputedChampionId];
              
              let statusLabel = 'Active';
              let statusColor = 'text-green-400';
              if (titleInfo.status === 'inactive_champion') {
                statusLabel = 'Inactive Champion';
                statusColor = 'text-red-400';
              } else if (titleInfo.status === 'unification_needed') {
                statusLabel = 'Unification Needed';
                statusColor = 'text-yellow-400';
              } else if (champ?.lastFightDate) {
                 const diffTime = Math.abs(new Date(useGameStore.getState().currentDate).getTime() - new Date(champ.lastFightDate).getTime());
                 const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                 if (diffDays > 120 && diffDays < 180) {
                    statusLabel = 'Pending Defense';
                    statusColor = 'text-yellow-400';
                 }
              }
              
              return (
                <div className="bg-neutral-950 p-4 rounded border border-neutral-800 inline-block w-full md:w-auto">
                  <div className="flex items-center justify-between md:justify-end gap-3 mb-1">
                    <span className="text-yellow-500 font-bold uppercase text-[10px] tracking-widest">Undisputed</span>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${statusColor.replace('text-', 'border-').replace('400', '800/50')} bg-neutral-950 ${statusColor}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <div className="text-lg font-black text-white cursor-pointer hover:text-yellow-500 transition-colors" onClick={() => setView('fighter-detail', { fighterId: titleInfo.undisputedChampionId! })}>
                    {champ?.firstName} {champ?.lastName}
                  </div>
                  <div className="text-xs text-neutral-400 mt-1">
                    Defenses: <span className="font-bold text-white mr-3">{titleInfo.undisputedDefenses}</span>
                    Last Fight: <span className="font-bold text-white">{champ?.lastFightDate || 'None'}</span>
                  </div>
                </div>
              );
            })() : (
              <div className="text-sm text-red-500 font-bold uppercase tracking-widest bg-red-500/10 border border-red-500/20 px-4 py-2 rounded">
                Vacant Title
              </div>
            )}

            {titleInfo?.interimChampionId && (() => {
              const interimChamp = fighters[titleInfo.interimChampionId];
              return (
                <div className="bg-neutral-950 p-4 rounded border border-neutral-800 inline-block w-full md:w-auto mt-2">
                  <div className="flex items-center justify-between md:justify-end gap-3 mb-1">
                    <span className="text-neutral-400 font-bold uppercase text-[10px] tracking-widest">Interim Champion</span>
                  </div>
                  <div className="text-lg font-black text-white cursor-pointer hover:text-neutral-300 transition-colors" onClick={() => setView('fighter-detail', { fighterId: titleInfo.interimChampionId! })}>
                    {interimChamp?.firstName} {interimChamp?.lastName}
                  </div>
                  <div className="text-xs text-neutral-400 mt-1">
                    Defenses: <span className="font-bold text-white mr-3">{titleInfo.interimDefenses}</span>
                    Last Fight: <span className="font-bold text-white">{interimChamp?.lastFightDate || 'None'}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
        {currentRankings.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">No ranked fighters in this division. Sign more fighters!</div>
        ) : (
          <table className="w-full text-left text-sm text-neutral-400">
            <thead className="bg-neutral-950 text-neutral-300 font-medium border-b border-neutral-800 uppercase tracking-wider text-xs">
              <tr>
                <th className="p-4 w-16 text-center">Rank</th>
                <th className="p-4 w-16 text-center">Move</th>
                <th className="p-4">Fighter</th>
                <th className="p-4">Record</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {currentRankings.map((r, idx) => {
                const f = fighters[r.fighterId];
                if (!f) return null;
                const isChamp = f.isChampion;
                const hasChampionInList = currentRankings.some(cr => fighters[cr.fighterId]?.isChampion);
                const displayRank = isChamp ? 'C' : (hasChampionInList ? idx : idx + 1);

                return (
                  <tr 
                    key={f.id} 
                    onClick={() => setView('fighter-detail', { fighterId: f.id })}
                    className={`cursor-pointer transition-colors ${isChamp ? 'bg-yellow-500/5 hover:bg-yellow-500/10' : 'hover:bg-neutral-800/50'}`}
                  >
                    <td className="p-4 text-center font-black text-lg">
                      {isChamp ? <span className="text-yellow-500">C</span> : displayRank}
                    </td>
                    <td className="p-4 text-center text-xs font-bold">
                      {r.trend === 999 ? (
                        <span className="text-yellow-500 uppercase">New</span>
                      ) : r.trend > 0 ? (
                        <span className="text-green-500">▲ {r.trend}</span>
                      ) : r.trend < 0 ? (
                        <span className="text-red-500">▼ {Math.abs(r.trend)}</span>
                      ) : (
                        <span className="text-neutral-600">-</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-white text-base">{f.firstName} {f.lastName}</div>
                      <div className="text-xs text-neutral-500">{f.nickname ? `"${f.nickname}"` : ''} • Age {f.age}</div>
                    </td>
                    <td className="p-4 font-mono text-white">{f.record.wins}-{f.record.losses}-{f.record.draws}</td>
                    <td className="p-4">
                      {f.injuryStatus ? (
                         <span className="inline-block bg-red-900/30 text-red-400 text-[10px] uppercase font-bold px-2 py-1 rounded border border-red-800/50">Injured</span>
                      ) : (
                         <span className="inline-block bg-green-900/30 text-green-400 text-[10px] uppercase font-bold px-2 py-1 rounded border border-green-800/50">Active</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
