import React, { useState, useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { WeightClass, FighterStyle } from '../types/game';
import { getContractExpectation } from '../lib/game/contracts';
import { Select } from '../components/Select';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

type SortKey = 'name' | 'age' | 'weight' | 'record' | 'style' | 'popularity' | 'potential' | 'ask' | 'interest';

export default function FreeAgents() {
  const { fighters, promotion, setView } = useGameStore();
  const [filterWeight, setFilterWeight] = useState<string>('All');
  const [filterStyle, setFilterStyle] = useState<string>('All');
  const [filterArchetype, setFilterArchetype] = useState<string>('All');
  const [filterMinPop, setFilterMinPop] = useState<string>('0');

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

  const agents = useMemo(() => {
    let result = Object.values(fighters)
      .filter(f => f.contract === null)
      .filter(f => filterWeight === 'All' || f.weightClass === filterWeight)
      .filter(f => filterStyle === 'All' || f.style === filterStyle)
      .filter(f => {
        if (filterArchetype === 'All') return true;
        if (filterArchetype === 'Star') return f.popularity >= 80;
        if (filterArchetype === 'Prospect') return f.potential > 80 && f.popularity < 50;
        if (filterArchetype === 'Veteran') return f.age > 33;
        return true;
      })
      .filter(f => f.popularity >= Number(filterMinPop));

    result.sort((a, b) => {
      let aValue: any, bValue: any;
      const expA = getContractExpectation(a, promotion);
      const expB = getContractExpectation(b, promotion);

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
          aValue = a.weightClass;
          bValue = b.weightClass;
          break;
        case 'record':
          aValue = a.record.wins / (a.record.wins + a.record.losses + a.record.draws + 0.001);
          bValue = b.record.wins / (b.record.wins + b.record.losses + b.record.draws + 0.001);
          break;
        case 'style':
          aValue = a.style;
          bValue = b.style;
          break;
        case 'popularity':
          aValue = a.popularity;
          bValue = b.popularity;
          break;
        case 'potential':
          aValue = a.potential;
          bValue = b.potential;
          break;
        case 'ask':
          aValue = expA.basePay;
          bValue = expB.basePay;
          break;
        case 'interest':
          aValue = expA.interest;
          bValue = expB.interest;
          break;
        default:
          aValue = 0; bValue = 0;
      }
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [fighters, filterWeight, filterStyle, filterArchetype, filterMinPop, sortConfig, promotion]);

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

  const minPopOptions = [
    { value: '0', label: 'Any Popularity' },
    { value: '25', label: 'Pop 25+' },
    { value: '50', label: 'Pop 50+' },
    { value: '75', label: 'Pop 75+' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 mb-4">
        <h1 className="text-2xl font-black text-white uppercase">Free Agents</h1>
        <div className="flex flex-wrap gap-4">
          <Select 
            value={filterWeight} 
            onChange={setFilterWeight}
            options={weightOptions}
            className="w-40"
          />
          <Select 
            value={filterStyle} 
            onChange={setFilterStyle}
            options={styleOptions}
            className="w-40"
          />
          <Select 
            value={filterArchetype} 
            onChange={setFilterArchetype}
            options={archetypeOptions}
            className="w-40"
          />
          <Select 
            value={filterMinPop} 
            onChange={setFilterMinPop}
            options={minPopOptions}
            className="w-40"
          />
        </div>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-x-auto">
        <table className="w-full text-left text-sm text-neutral-400 min-w-[800px]">
          <thead className="bg-neutral-950 text-neutral-300 font-medium border-b border-neutral-800">
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
              <th className="p-4 cursor-pointer hover:bg-neutral-900 transition-colors group" onClick={() => handleSort('popularity')}>
                Pop <SortIcon sortKey="popularity" />
              </th>
              <th className="p-4 cursor-pointer hover:bg-neutral-900 transition-colors group" onClick={() => handleSort('potential')}>
                Pot <SortIcon sortKey="potential" />
              </th>
              <th className="p-4 cursor-pointer hover:bg-neutral-900 transition-colors group" onClick={() => handleSort('ask')}>
                Ask Pay/Bonus <SortIcon sortKey="ask" />
              </th>
              <th className="p-4 cursor-pointer hover:bg-neutral-900 transition-colors group" onClick={() => handleSort('interest')}>
                Interest <SortIcon sortKey="interest" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {agents.map(f => {
              const expectation = getContractExpectation(f, promotion);
              return (
                <tr 
                  key={f.id} 
                  onClick={() => setView('fighter-detail', { fighterId: f.id })}
                  className="hover:bg-neutral-800/50 cursor-pointer transition-colors"
                >
                  <td className="p-4">
                    <div>
                      <div className="font-bold text-white">{f.firstName} {f.lastName}</div>
                      {f.nickname && <div className="text-xs">"{f.nickname}"</div>}
                    </div>
                  </td>
                  <td className="p-4">{f.age}</td>
                  <td className="p-4">{f.weightClass}</td>
                  <td className="p-4">{f.record.wins}-{f.record.losses}-{f.record.draws}</td>
                  <td className="p-4">{f.style}</td>
                  <td className="p-4">{f.popularity}</td>
                  <td className="p-4">{f.potential}</td>
                  <td className="p-4">
                    <div className="text-green-400 font-mono text-xs">${expectation.basePay.toLocaleString()} / ${expectation.winBonus.toLocaleString()}</div>
                    <div className="text-xs text-neutral-500">for {expectation.fights} fights</div>
                  </td>
                  <td className="p-4">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      expectation.interest > 70 ? 'bg-green-500/10 text-green-400' :
                      expectation.interest > 40 ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {expectation.interestLabel}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {agents.length === 0 && (
          <div className="p-8 text-center text-neutral-500">
            No free agents match your filters.
          </div>
        )}
      </div>
    </div>
  );
}
