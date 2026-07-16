import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { WeightClass } from '../types/game';
import { Select } from '../components/Select';
import { CountryFlag } from '../components/CountryFlag';
import { FighterAvatar } from '../components/FighterAvatar';
import { ChampionshipBelt, type BeltType } from '../components/ChampionshipBelt';
import { DataSurface, PageHeader, Panel, StatusBadge, type StatusTone } from '../components/ui';

export default function Rankings() {
  const { rankings, fighters, setView } = useGameStore();
  const [selectedWC, setSelectedWC] = useState('Lightweight');
  const currentRankings = rankings[selectedWC as WeightClass] || [];
  const belt = useGameStore(state => state.belts[`belt_${selectedWC.toLowerCase()}`]);
  const titleInfo = useGameStore(state => state.titles[selectedWC as WeightClass]);
  const wcOptions = ['Heavyweight', 'Middleweight', 'Welterweight', 'Lightweight', 'Featherweight', 'Bantamweight'].map(value => ({ value, label: value }));

  const getChampionStatus = () => {
    const champion = titleInfo?.undisputedChampionId ? fighters[titleInfo.undisputedChampionId] : undefined;
    if (!champion || !titleInfo) return { label: 'Active', tone: 'success' as StatusTone, tooltip: 'Champion is available and the title state is normal.' };
    if (titleInfo.status === 'inactive_champion') return { label: 'Inactive Champion', tone: 'danger' as StatusTone, tooltip: 'Champion is inactive; an interim title fight may be needed.' };
    if (titleInfo.status === 'unification_needed') return { label: 'Unification Needed', tone: 'warning' as StatusTone, tooltip: 'Undisputed and interim champions must fight to unify the title.' };
    if (champion.lastFightDate) {
      const days = Math.ceil(Math.abs(new Date(useGameStore.getState().currentDate).getTime() - new Date(champion.lastFightDate).getTime()) / 86400000);
      if (days > 120 && days < 180) return { label: 'Pending Defense', tone: 'warning' as StatusTone, tooltip: 'Champion is approaching the expected title defense window.' };
    }
    return { label: 'Active', tone: 'success' as StatusTone, tooltip: 'Champion is available and the title state is normal.' };
  };

  const championStatus = getChampionStatus();
  const statusTooltip = championStatus.tooltip;
  const undisputedChampion = titleInfo?.undisputedChampionId ? fighters[titleInfo.undisputedChampionId] : undefined;
  const interimChampion = titleInfo?.interimChampionId ? fighters[titleInfo.interimChampionId] : undefined;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <PageHeader eyebrow="Competition" title="Promotion Rankings" actions={<Select value={selectedWC} onChange={setSelectedWC} options={wcOptions} className="w-full sm:w-48" />} />

      {belt && <Panel className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
          <ChampionshipBelt weightClass={selectedWC as WeightClass} type="undisputed" size="hero" alt={`${belt.name} undisputed championship belt`} />
          <div className="min-w-0"><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">Current division belt</p><h2 className="mt-2 text-2xl font-normal tracking-[-0.03em] text-white">{belt.name}</h2><p className="mt-2 text-sm text-neutral-400">Prestige <span className="font-mono text-white">{Math.floor(belt.prestige)} / 100</span></p></div>
        </div>
        <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-80">
          {undisputedChampion ? <ChampionCard label="Undisputed" fighter={undisputedChampion} defenses={titleInfo?.undisputedDefenses ?? 0} status={{ ...championStatus, tooltip: statusTooltip }} onOpen={() => setView('fighter-detail', { fighterId: undisputedChampion.id })} /> : <div className="py-2"><StatusBadge tone="danger">Vacant title</StatusBadge></div>}
          {interimChampion && <ChampionCard label="Interim champion" fighter={interimChampion} defenses={titleInfo?.interimDefenses ?? 0} weightClass={selectedWC as WeightClass} type="interim" onOpen={() => setView('fighter-detail', { fighterId: interimChampion.id })} />}
        </div>
      </Panel>}

      <DataSurface>
        {currentRankings.length === 0 ? <div className="p-8 text-center text-neutral-500">No ranked fighters in this division. Sign more fighters!</div> : <div className="overflow-x-auto custom-scrollbar"><table className="min-w-[560px] w-full text-left text-sm text-neutral-400">
          <thead className="border-b border-[#2a2c31] bg-black/10 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500"><tr><th className="w-16 p-4 text-center font-normal">Rank</th><th className="w-16 p-4 text-center font-normal">Move</th><th className="p-4 font-normal">Fighter</th><th className="p-4 font-normal">Record</th><th className="p-4 font-normal">Status</th></tr></thead>
          <tbody className="divide-y divide-[#2a2c31]">{currentRankings.map((ranking, index) => {
            const fighter = fighters[ranking.fighterId];
            if (!fighter) return null;
            const isChampion = fighter.isChampion;
            const hasChampion = currentRankings.some(entry => fighters[entry.fighterId]?.isChampion);
            const displayRank = isChampion ? 'C' : hasChampion ? index : index + 1;
            return <tr key={fighter.id} onClick={() => setView('fighter-detail', { fighterId: fighter.id })} className="cursor-pointer transition-colors hover:bg-white/[0.02]">
              <td className="p-4 text-center font-mono text-lg text-white">{displayRank}</td>
              <td className="p-4 text-center font-mono text-xs">{ranking.trend === 999 ? <span className="text-amber-300">New</span> : ranking.trend > 0 ? <span className="text-emerald-300">▲ {ranking.trend}</span> : ranking.trend < 0 ? <span className="text-red-300">▼ {Math.abs(ranking.trend)}</span> : <span className="text-neutral-600">—</span>}</td>
              <td className="p-4"><div className="flex items-center gap-2"><FighterAvatar id={fighter.id} name={`${fighter.firstName} ${fighter.lastName}`} nationality={fighter.nationality} className="h-8 w-8" /><div><p className="font-medium text-white">{fighter.firstName} {fighter.lastName} <CountryFlag nationality={fighter.nationality} className="text-sm" /></p><p className="mt-1 text-xs text-neutral-500">{fighter.nickname ? `"${fighter.nickname}" • ` : ''}Age {fighter.age}</p></div></div></td>
              <td className="p-4 font-mono text-white">{fighter.record.wins}-{fighter.record.losses}-{fighter.record.draws}</td>
              <td className="p-4">{fighter.injuryStatus ? <StatusBadge tone="danger">Injured</StatusBadge> : <StatusBadge tone="success">Active</StatusBadge>}</td>
            </tr>;
          })}</tbody>
        </table></div>}
      </DataSurface>
    </div>
  );
}

function ChampionCard({ label, fighter, defenses, status, weightClass, type, onOpen }: { label: string; fighter: { id: string; firstName: string; lastName: string; nationality: string; lastFightDate?: string }; defenses: number; status?: { label: string; tone: StatusTone; tooltip: string }; weightClass?: WeightClass; type?: BeltType; onOpen: () => void }) {
  return <div className="flex min-w-0 items-center gap-3 border-l border-[#2a2c31] pl-4">{weightClass && type && <ChampionshipBelt weightClass={weightClass} type={type} size="card" alt="" />}<div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap items-center justify-between gap-3"><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">{label}</p>{status && <span title={status.tooltip} className="cursor-help"><StatusBadge tone={status.tone}>{status.label}</StatusBadge></span>}</div><button type="button" onClick={onOpen} className="flex min-w-0 items-center gap-2 text-left text-white hover:text-neutral-300"><FighterAvatar id={fighter.id} name={`${fighter.firstName} ${fighter.lastName}`} nationality={fighter.nationality} className="h-9 w-9" /><span className="truncate text-lg font-normal tracking-[-0.02em]">{fighter.firstName} {fighter.lastName} <CountryFlag nationality={fighter.nationality} className="text-sm" /></span></button><p className="mt-2 text-xs text-neutral-500">Defenses <span className="text-neutral-200">{defenses}</span> <span className="px-1">·</span> Last fight <span className="text-neutral-200">{fighter.lastFightDate || 'None'}</span></p></div></div>;
}
