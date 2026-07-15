import React, { useState, useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { WeightClass, FighterStyle, Fighter } from '../types/game';
import { Select } from '../components/Select';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CountryFlag } from '../components/CountryFlag';
import { FighterAvatar } from '../components/FighterAvatar';
import { DataSurface, PageHeader, Panel, StatusBadge } from '../components/ui';
import { getFighterOverall, isProspect } from '../lib/game/fighterRatings';
import { formatHeight, formatWeight } from '../lib/displayUnits';
import { useSettingsStore } from '../store/settingsStore';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

type SortKey = 'name' | 'age' | 'weight' | 'record' | 'style' | 'overall' | 'potential' | 'popularity' | 'status' | 'contract';

export default function Roster() {
  const { fighters, setView } = useGameStore();
  const unitSystem = useSettingsStore(settings => settings.unitSystem);
  const [search, setSearch] = useState('');
  const [filterWeight, setFilterWeight] = useState<string>('All');
  const [filterStyle, setFilterStyle] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterArchetype, setFilterArchetype] = useState<string>('All');
  const [filterContract, setFilterContract] = useState<string>('All');

  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'popularity', direction: 'desc' });

  const handleSort = (key: SortKey) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ sortKey }: { sortKey: SortKey }) => {
    if (sortConfig.key !== sortKey) return <ArrowUpDown size={14} className="text-neutral-600 inline-block ml-1" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={14} className="text-blue-400 inline-block ml-1" />
      : <ArrowDown size={14} className="text-blue-400 inline-block ml-1" />;
  };

  const roster = useMemo(() => {
    let result = Object.values(fighters)
      .filter(f => f.contract !== null)
      .filter(f => !search.trim() || `${f.firstName} ${f.lastName} ${f.nickname}`.toLowerCase().includes(search.trim().toLowerCase()))
      .filter(f => filterContract === 'All' || (filterContract === 'Expiring' && (f.contract?.fightsRemaining ?? 0) <= 1))
      .filter(f => filterWeight === 'All' || f.weightClass === filterWeight)
      .filter(f => filterStyle === 'All' || f.style === filterStyle)
      .filter(f => {
        if (filterStatus === 'All') return true;
        if (filterStatus === 'Injured') return f.injuryStatus !== null;
        if (filterStatus === 'Suspended') return f.medicalSuspension !== null && f.medicalSuspension !== undefined;
        if (filterStatus === 'Fatigued') return f.fatigue > 50;
        if (filterStatus === 'Ready') return f.injuryStatus === null && !f.medicalSuspension && f.fatigue <= 50;
        return true;
      })
      .filter(f => {
        if (filterArchetype === 'All') return true;
        if (filterArchetype === 'Star') return f.popularity >= 80;
        if (filterArchetype === 'Prospect') return isProspect(f);
        if (filterArchetype === 'Veteran') return f.age > 33;
        return true;
      });

    result.sort((a, b) => {
      let aValue: any, bValue: any;
      switch (sortConfig.key) {
        case 'name':
          aValue = `${a.firstName} ${a.lastName}`;
          bValue = `${b.firstName} ${b.lastName}`;
          break;
        case 'age':
          aValue = a.age;
          bValue = b.age;
          break;
        case 'weight':
          // Simplified sort by assuming weight class order or just alphabetical
          aValue = a.weightClass;
          bValue = b.weightClass;
          break;
        case 'record':
          // Sort by win percentage, then wins
          aValue = a.record.wins / (a.record.wins + a.record.losses + a.record.draws + 0.001);
          bValue = b.record.wins / (b.record.wins + b.record.losses + b.record.draws + 0.001);
          break;
        case 'style':
          aValue = a.style;
          bValue = b.style;
          break;
        case 'overall':
          aValue = getFighterOverall(a);
          bValue = getFighterOverall(b);
          break;
        case 'potential':
          aValue = a.potential;
          bValue = b.potential;
          break;
        case 'popularity':
          aValue = a.popularity;
          bValue = b.popularity;
          break;
        case 'status':
          aValue = a.injuryStatus ? 0 : (a.fatigue > 50 ? 1 : 2);
          bValue = b.injuryStatus ? 0 : (b.fatigue > 50 ? 1 : 2);
          break;
        case 'contract':
          aValue = a.contract?.fightsRemaining || 0;
          bValue = b.contract?.fightsRemaining || 0;
          break;
        default:
          aValue = 0; bValue = 0;
      }
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [fighters, search, filterWeight, filterStyle, filterStatus, filterArchetype, filterContract, sortConfig]);

  const weightOptions = [
    { value: 'All', label: 'All Weights' },
    { value: 'Heavyweight', label: 'Heavyweight' },
    { value: 'Middleweight', label: 'Middleweight' },
    { value: 'Welterweight', label: 'Welterweight' },
    { value: 'Lightweight', label: 'Lightweight' },
    { value: 'Featherweight', label: 'Featherweight' },
    { value: 'Bantamweight', label: 'Bantamweight' }
  ];

  const styleOptions = [
    { value: 'All', label: 'All Styles' },
    { value: 'Boxer', label: 'Boxer' },
    { value: 'Wrestler', label: 'Wrestler' },
    { value: 'BJJ', label: 'BJJ' },
    { value: 'Kickboxer', label: 'Kickboxer' },
    { value: 'Muay Thai', label: 'Muay Thai' },
    { value: 'Sambo', label: 'Sambo' },
    { value: 'Balanced', label: 'Balanced' }
  ];

  const archetypeOptions = [
    { value: 'All', label: 'Any Archetype' },
    { value: 'Star', label: 'Star' },
    { value: 'Prospect', label: 'Prospect' },
    { value: 'Veteran', label: 'Veteran' }
  ];

  const statusOptions = [
    { value: 'All', label: 'Any Status' },
    { value: 'Ready', label: 'Ready to Fight' },
    { value: 'Injured', label: 'Injured' },
    { value: 'Suspended', label: 'Medically Suspended' },
    { value: 'Fatigued', label: 'Fatigued' }
  ];
  const contractOptions = [{ value: 'All', label: 'Any Contract' }, { value: 'Expiring', label: 'Expiring Soon' }];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Competition" title="Promotion Roster" description={`${roster.length} contracted fighters`} />

      <Panel className="flex flex-wrap gap-3 p-4">
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search fighter" aria-label="Search roster" className="h-10 w-44 rounded border border-neutral-800 bg-neutral-950 px-3 text-sm text-white outline-none focus:border-neutral-500" />
        <Select value={filterWeight} onChange={setFilterWeight} options={weightOptions} className="w-40" />
        <Select value={filterStyle} onChange={setFilterStyle} options={styleOptions} className="w-40" />
        <Select value={filterArchetype} onChange={setFilterArchetype} options={archetypeOptions} className="w-40" />
        <Select value={filterStatus} onChange={setFilterStatus} options={statusOptions} className="w-40" />
        <Select value={filterContract} onChange={setFilterContract} options={contractOptions} className="w-40" />
      </Panel>

      <DataSurface>
        <div className="overflow-x-auto custom-scrollbar">
        <table className="min-w-[800px] w-full text-left text-sm text-neutral-400">
          <thead className="border-b border-[#2a2c31] bg-black/10 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
            <tr>
              <th className="p-4 cursor-pointer hover:bg-neutral-900 transition-colors group" onClick={() => handleSort('name')}>
                Fighter <SortIcon sortKey="name" />
              </th>
              <th className="p-4 cursor-pointer hover:bg-neutral-900 transition-colors group" onClick={() => handleSort('age')}>
                Age <SortIcon sortKey="age" />
              </th>
              <th className="p-4 cursor-pointer hover:bg-neutral-900 transition-colors group" onClick={() => handleSort('weight')}>
                Weight <SortIcon sortKey="weight" />
              </th>
              <th className="p-4 cursor-pointer hover:bg-neutral-900 transition-colors group" onClick={() => handleSort('record')}>
                Record <SortIcon sortKey="record" />
              </th>
              <th className="p-4 cursor-pointer hover:bg-neutral-900 transition-colors group" onClick={() => handleSort('style')}>
                Style <SortIcon sortKey="style" />
              </th>
              <th className="p-4 cursor-pointer hover:bg-neutral-900 transition-colors group" onClick={() => handleSort('overall')}>
                OVR <SortIcon sortKey="overall" />
              </th>
              <th className="p-4 cursor-pointer hover:bg-neutral-900 transition-colors group" onClick={() => handleSort('potential')}>
                POT <SortIcon sortKey="potential" />
              </th>
              <th className="p-4 text-center cursor-pointer hover:bg-neutral-900 transition-colors group" onClick={() => handleSort('popularity')}>
                Pop / Mor / Mom <SortIcon sortKey="popularity" />
              </th>
              <th className="p-4 text-center cursor-pointer hover:bg-neutral-900 transition-colors group" onClick={() => handleSort('status')}>
                Status <SortIcon sortKey="status" />
              </th>
              <th className="p-4 text-right cursor-pointer hover:bg-neutral-900 transition-colors group" onClick={() => handleSort('contract')}>
                Contract <SortIcon sortKey="contract" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2c31]">
            {roster.map(f => {
              // Badges
              const prospect = isProspect(f);
              const isVeteran = f.age > 33;
              const isStar = f.popularity >= 80;

              return (
                <tr 
                  key={f.id} 
                  onClick={() => setView('fighter-detail', { fighterId: f.id })}
                  className="cursor-pointer transition-colors hover:bg-white/[0.02]"
                >
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <FighterAvatar id={f.id} name={`${f.firstName} ${f.lastName}`} nationality={f.nationality} className="h-8 w-8" />
                        <div className="font-bold text-white">{f.firstName} {f.lastName}</div>
                        <CountryFlag nationality={f.nationality} className="text-sm" />
                        {f.isChampion && <span className="text-yellow-500 text-xs font-bold" title="Champion">👑</span>}
                      </div>
                      {f.nickname && <div className="text-xs text-neutral-400">"{f.nickname}"</div>}
                      <div className="text-[10px] text-neutral-500">{formatHeight(f.heightCm, unitSystem)} · {formatWeight(f.fightWeightLb, unitSystem)}/{formatWeight(f.walkAroundWeightLb, unitSystem)}</div>
                      
                      <div className="mt-1 flex gap-1">
                        {isStar && <StatusBadge tone="warning">Star</StatusBadge>}
                        {prospect && <StatusBadge>Prospect</StatusBadge>}
                        {isVeteran && <StatusBadge>Veteran</StatusBadge>}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">{f.age}</td>
                  <td className="p-4">{f.weightClass}</td>
                  <td className="p-4">{f.record.wins}-{f.record.losses}-{f.record.draws}</td>
                  <td className="p-4">{f.style}</td>
                  <td className="p-4 font-mono text-white">{getFighterOverall(f)}</td>
                  <td className="p-4 font-mono text-white">{f.potential}</td>
                  <td className="p-4 text-center font-mono text-xs">
                    <div className="flex justify-center gap-2">
                      <span className="text-white" title="Popularity">{f.popularity}</span>
                      <span className="text-neutral-600">/</span>
                      <span className={f.morale > 60 ? 'text-green-400' : 'text-red-400'} title="Morale">{f.morale}</span>
                      <span className="text-neutral-600">/</span>
                      <span className={f.momentum > 60 ? 'text-green-400' : 'text-red-400'} title="Momentum">{f.momentum}</span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    {f.injuryStatus ? (
                      <span title={`${f.injuryStatus.daysRemaining} days`}><StatusBadge tone="danger">{f.injuryStatus.type}</StatusBadge></span>
                    ) : f.medicalSuspension ? (
                      <span title={`${f.medicalSuspension.daysRemaining} days`}><StatusBadge tone="warning">Suspended</StatusBadge></span>
                    ) : f.fatigue > 50 ? (
                      <StatusBadge tone="warning">Fatigued</StatusBadge>
                    ) : (
                      <StatusBadge tone="success">Ready</StatusBadge>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="font-mono text-white">{f.contract?.fightsRemaining} <span className="text-neutral-500 text-xs">left</span></div>
                    <div className="text-xs text-neutral-400">${(f.contract?.payPerFight || 0).toLocaleString()}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {roster.length === 0 && (
          <div className="p-8 text-center text-neutral-500">
            No fighters found. Go to Free Agents to sign fighters.
          </div>
        )}
        </div>
      </DataSurface>
    </div>
  );
}
