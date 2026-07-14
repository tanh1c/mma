import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { getContractExpectation } from '../lib/game/contracts';
import { Select } from '../components/Select';
import { CountryFlag } from '../components/CountryFlag';
import { FighterAvatar } from '../components/FighterAvatar';
import { DataSurface, PageHeader, Panel, StatusBadge } from '../components/ui';

type SortKey = 'name' | 'age' | 'weight' | 'record' | 'style' | 'popularity' | 'potential' | 'ask' | 'interest';

export default function FreeAgents() {
  const { fighters, promotion, setView } = useGameStore();
  const [search, setSearch] = useState('');
  const [filterWeight, setFilterWeight] = useState('All');
  const [filterStyle, setFilterStyle] = useState('All');
  const [filterArchetype, setFilterArchetype] = useState('All');
  const [filterMinPop, setFilterMinPop] = useState('0');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'popularity', direction: 'desc' });

  const handleSort = (key: SortKey) => setSortConfig(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
  const SortIcon = ({ sortKey }: { sortKey: SortKey }) => sortConfig.key !== sortKey
    ? <ArrowUpDown size={14} className="ml-1 inline-block text-neutral-600" />
    : sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 inline-block text-neutral-300" /> : <ArrowDown size={14} className="ml-1 inline-block text-neutral-300" />;

  const agents = useMemo(() => {
    const result = Object.values(fighters)
      .filter(fighter => fighter.contract === null)
      .filter(fighter => !search.trim() || `${fighter.firstName} ${fighter.lastName} ${fighter.nickname}`.toLowerCase().includes(search.trim().toLowerCase()))
      .filter(fighter => filterWeight === 'All' || fighter.weightClass === filterWeight)
      .filter(fighter => filterStyle === 'All' || fighter.style === filterStyle)
      .filter(fighter => filterArchetype === 'All' || (filterArchetype === 'Star' && fighter.popularity >= 80) || (filterArchetype === 'Prospect' && fighter.potential > 80 && fighter.popularity < 50) || (filterArchetype === 'Veteran' && fighter.age > 33))
      .filter(fighter => fighter.popularity >= Number(filterMinPop));
    result.sort((a, b) => {
      const expectations = [getContractExpectation(a, promotion), getContractExpectation(b, promotion)];
      const value = (fighter: typeof a, expectation: typeof expectations[number]) => ({
        name: `${fighter.firstName} ${fighter.lastName}`, age: fighter.age, weight: fighter.weightClass,
        record: fighter.record.wins / (fighter.record.wins + fighter.record.losses + fighter.record.draws + 0.001),
        style: fighter.style, popularity: fighter.popularity, potential: fighter.potential, ask: expectation.basePay, interest: expectation.interest
      }[sortConfig.key]);
      const [aValue, bValue] = [value(a, expectations[0]), value(b, expectations[1])];
      return aValue < bValue ? (sortConfig.direction === 'asc' ? -1 : 1) : aValue > bValue ? (sortConfig.direction === 'asc' ? 1 : -1) : 0;
    });
    return result;
  }, [fighters, search, filterWeight, filterStyle, filterArchetype, filterMinPop, sortConfig, promotion]);

  const weightOptions = ['All', 'Heavyweight', 'Middleweight', 'Welterweight', 'Lightweight', 'Featherweight', 'Bantamweight'].map(value => ({ value, label: value === 'All' ? 'All Weights' : value }));
  const styleOptions = ['All', 'Boxer', 'Wrestler', 'BJJ', 'Kickboxer', 'Muay Thai', 'Sambo', 'Balanced'].map(value => ({ value, label: value === 'All' ? 'All Styles' : value }));
  const archetypeOptions = ['All', 'Star', 'Prospect', 'Veteran'].map(value => ({ value, label: value === 'All' ? 'Any Archetype' : value }));
  const minPopOptions = [{ value: '0', label: 'Any Popularity' }, { value: '25', label: 'Pop 25+' }, { value: '50', label: 'Pop 50+' }, { value: '75', label: 'Pop 75+' }];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Recruitment" title="Free Agents" description={`${agents.length} fighters match the current search`} />
      <Panel className="flex flex-wrap gap-3 p-4">
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search fighter" aria-label="Search free agents" className="h-10 w-44 rounded border border-neutral-800 bg-neutral-950 px-3 text-sm text-white outline-none focus:border-neutral-500" />
        <Select value={filterWeight} onChange={setFilterWeight} options={weightOptions} className="w-40" />
        <Select value={filterStyle} onChange={setFilterStyle} options={styleOptions} className="w-40" />
        <Select value={filterArchetype} onChange={setFilterArchetype} options={archetypeOptions} className="w-40" />
        <Select value={filterMinPop} onChange={setFilterMinPop} options={minPopOptions} className="w-40" />
      </Panel>
      <DataSurface>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="min-w-[800px] w-full text-left text-sm text-neutral-400">
            <thead className="border-b border-[#2a2c31] bg-black/10 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500"><tr>
              {([['Fighter', 'name'], ['Age', 'age'], ['Weight', 'weight'], ['Record', 'record'], ['Style', 'style'], ['Pop', 'popularity'], ['Pot', 'potential'], ['Ask Pay/Bonus', 'ask'], ['Interest', 'interest']] as Array<[string, SortKey]>).map(([label, key]) => <th key={key} className="cursor-pointer p-4 font-normal hover:bg-white/[0.03]" onClick={() => handleSort(key)}>{label}<SortIcon sortKey={key} /></th>)}
            </tr></thead>
            <tbody className="divide-y divide-[#2a2c31]">
              {agents.map(fighter => {
                const expectation = getContractExpectation(fighter, promotion);
                const interestTone = expectation.interest > 70 ? 'success' : expectation.interest > 40 ? 'warning' : 'danger';
                return <tr key={fighter.id} onClick={() => setView('fighter-detail', { fighterId: fighter.id })} className="cursor-pointer transition-colors hover:bg-white/[0.02]">
                  <td className="p-4"><div className="flex items-center gap-2"><FighterAvatar id={fighter.id} name={`${fighter.firstName} ${fighter.lastName}`} nationality={fighter.nationality} className="h-8 w-8" /><div><div className="flex items-center gap-2 font-medium text-white"><span>{fighter.firstName} {fighter.lastName}</span><CountryFlag nationality={fighter.nationality} className="text-sm" /></div>{fighter.nickname && <div className="text-xs text-neutral-500">&quot;{fighter.nickname}&quot;</div>}</div></div></td>
                  <td className="p-4">{fighter.age}</td><td className="p-4">{fighter.weightClass}</td><td className="p-4">{fighter.record.wins}-{fighter.record.losses}-{fighter.record.draws}</td><td className="p-4">{fighter.style}</td><td className="p-4">{fighter.popularity}</td><td className="p-4">{fighter.potential}</td>
                  <td className="p-4"><p className="font-mono text-xs text-neutral-200">${expectation.basePay.toLocaleString()} / ${expectation.winBonus.toLocaleString()}</p><p className="mt-1 text-xs text-neutral-500">for {expectation.fights} fights</p></td>
                  <td className="p-4"><StatusBadge tone={interestTone}>{expectation.interestLabel}</StatusBadge></td>
                </tr>;
              })}
            </tbody>
          </table>
          {agents.length === 0 && <div className="p-8 text-center text-neutral-500">No free agents match your filters.</div>}
        </div>
      </DataSurface>
    </div>
  );
}
