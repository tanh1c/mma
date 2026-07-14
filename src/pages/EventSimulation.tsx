import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { formatRankDisplay } from '../lib/game/rankings';
import { summarizeCompletedEvent } from '../lib/game/insights';
import { Button, DataSurface, PageHeader, Panel, Stat, StatusBadge } from '../components/ui';
import FightBattle from './FightBattle';
import { CountryFlag } from '../components/CountryFlag';
import { FighterAvatar } from '../components/FighterAvatar';

export default function EventSimulation() {
  const { selectedEventId, events, fighters, startEventSimulation, goBack, activeEventSimulation } = useGameStore();
  const event = selectedEventId ? events[selectedEventId] : null;
  const recap = event?.isCompleted ? summarizeCompletedEvent({ fighters }, event) : null;
  const [expandedFights, setExpandedFights] = useState<Record<number, boolean>>({});

  if (!event) return <div>Event not found</div>;

  const isSimulating = activeEventSimulation?.eventId === event.id && !event.isCompleted;
  const toggleFight = (idx: number) => setExpandedFights(prev => ({ ...prev, [idx]: !prev[idx] }));

  if (isSimulating) return <FightBattle />;

  if (!event.isCompleted) {
    const hasStarted = event.fights.some(f => f.result);
    return <div className="mx-auto mt-6 max-w-4xl space-y-6 pb-12">
      <PageHeader eyebrow="Event simulation" title={event.name} description={`${event.fights.length} fights · ${event.date}`} />
      <Panel className="mx-auto max-w-2xl space-y-2">
        <h2 className="border-b border-[#2a2c31] pb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">Fight card</h2>
        {event.fights.map((fight, index) => {
          const red = fighters[fight.redCornerId];
          const blue = fighters[fight.blueCornerId];
          const label = index === 0 ? 'Main event' : index === 1 ? 'Co-main event' : `Bout ${event.fights.length - index}`;
          return <div key={index} className={`flex flex-col gap-3 border-l-2 p-3 sm:flex-row sm:items-center ${index === 0 ? 'border-amber-900 bg-white/[0.02]' : 'border-[#2a2c31]'}`}>
            <div className="min-w-28 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500"><p className={index < 2 ? 'text-amber-300' : ''}>{label}</p><p className="mt-1">{fight.weightClass}{fight.isTitleFight && ' · Title'}</p>{fight.result && <p className="mt-1 text-emerald-300">Completed</p>}</div>
            <div className="flex flex-1 items-center justify-between gap-2 text-sm text-white">
              <span className="flex w-[45%] items-center justify-end gap-1 text-right font-medium"><span className="truncate">{red.firstName} {red.lastName}</span><CountryFlag nationality={red.nationality} className="text-xs" /><FighterAvatar id={red.id} name={`${red.firstName} ${red.lastName}`} nationality={red.nationality} className="h-6 w-6" /></span>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-600">vs</span>
              <span className="flex w-[45%] items-center gap-1 font-medium"><FighterAvatar id={blue.id} name={`${blue.firstName} ${blue.lastName}`} nationality={blue.nationality} className="h-6 w-6" /><CountryFlag nationality={blue.nationality} className="text-xs" /><span className="truncate">{blue.firstName} {blue.lastName}</span></span>
            </div>
          </div>;
        })}
      </Panel>
      <div className="text-center"><Button variant="primary" onClick={() => startEventSimulation(event.id)} className="px-8">{hasStarted ? 'Resume event' : 'Start event'}</Button><p className="mt-3 text-xs text-neutral-500">Simulate fights one by one.</p></div>
    </div>;
  }

  return <div className="mx-auto max-w-4xl space-y-6 pb-12">
    <PageHeader eyebrow="Completed event" title={`${event.name} Results`} description={`${event.date} · Simulated`} actions={<Button variant="secondary" onClick={() => goBack('dashboard')}>Back</Button>} />

    <Panel className="grid grid-cols-2 gap-5 md:grid-cols-4">
      <Stat label="Attendance" value={event.results?.attendance.toLocaleString()} />
      <Stat label="Total revenue" value={<span className="text-emerald-300">${event.results?.totalRevenue?.toLocaleString() || event.results?.gateRevenue?.toLocaleString()}</span>} />
      <Stat label="Total cost" value={<span className="text-red-300">${event.results?.totalCost?.toLocaleString() || 'N/A'}</span>} />
      <Stat label="Net profit" value={<span className={event.results && event.results.profit >= 0 ? 'text-emerald-300' : 'text-red-300'}>${event.results?.profit.toLocaleString()}</span>} />
    </Panel>

    {recap && <Panel className="border-blue-900/50"><h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-blue-300">Event recap</h2><div className="mt-4 grid gap-4 text-sm md:grid-cols-2"><div className="space-y-1"><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">Fight of the night</p>{recap.bestFight && <p className="text-white">{recap.bestFight.red.firstName} {recap.bestFight.red.lastName} vs {recap.bestFight.blue.firstName} {recap.bestFight.blue.lastName} <span title="Performance rating" className="text-blue-300">{recap.bestFight.rating}/100</span> · {recap.bestFight.method}</p>}</div>{recap.rankingChanges.length > 0 && <div className="space-y-1"><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">Ranking impact</p>{recap.rankingChanges.slice(0, 3).map(change => <p key={change.fighter.id} title="Ranking movement after this event.">{change.fighter.firstName} {change.fighter.lastName}: {change.oldRank} → {change.newRank}</p>)}</div>}{recap.financial && <div className="space-y-1"><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">Financial result</p><p title="Net event profit after venue, marketing, and fighter costs." className={recap.financial.profit >= 0 ? 'text-emerald-300' : 'text-red-300'}>{recap.financial.profit >= 0 ? '+' : ''}${recap.financial.profit.toLocaleString()} · Fans {Math.round(recap.financial.fanReaction)}/100</p></div>}{recap.medical.length > 0 && <div className="space-y-1"><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">Medical report</p>{recap.medical.slice(0, 3).map(item => <p key={`${item.fighter.id}-${item.detail}`} className="text-amber-300">{item.fighter.firstName} {item.fighter.lastName}: {item.detail}</p>)}</div>}{recap.nextBookingLead && <div className="space-y-1"><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">Next booking lead</p><p className="text-white">{recap.nextBookingLead.firstName} {recap.nextBookingLead.lastName} is ready for another high-value matchup.</p></div>}</div></Panel>}

    {event.results?.titleChanges && event.results.titleChanges.length > 0 && <Panel className="border-amber-900">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-amber-300">Title fights summary</h2>
      <div className="mt-3 space-y-2 text-sm text-white">{event.results.titleChanges.map((change, index) => {
        const fighter = change.fighterId ? fighters[change.fighterId] : null;
        if (change.type === 'no_change') return <p key={index}>🤝 {change.weightClass} Title Unchanged (Draw)</p>;
        if (!fighter) return null;
        if (change.type === 'title_defense') return <p key={index}>🛡️ {fighter.firstName} {fighter.lastName} defended the {change.weightClass} Title!</p>;
        if (change.type === 'new_champion') return <p key={index}>🏆 {fighter.firstName} {fighter.lastName} is the NEW {change.weightClass} Champion!</p>;
        if (change.type === 'vacant_title_won') return <p key={index}>🏆 {fighter.firstName} {fighter.lastName} won the vacant {change.weightClass} Title!</p>;
        return null;
      })}</div>
    </Panel>}

    {event.results?.totalRevenue && <Panel>
      <h2 className="border-b border-[#2a2c31] pb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">Event P&amp;L breakdown</h2>
      <div className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
        <Stat label="Gate revenue" value={<span className="font-mono text-emerald-300">+${event.results.gateRevenue.toLocaleString()}</span>} />
        <Stat label="TV & sponsor" value={<span className="font-mono text-emerald-300">+${event.results.broadcastRevenue.toLocaleString()}</span>} />
        <Stat label="Venue cost" value={<span className="font-mono text-red-300">-${event.results.venueCost.toLocaleString()}</span>} />
        <Stat label="Marketing" value={<span className="font-mono text-red-300">-${event.results.marketingCost.toLocaleString()}</span>} />
        <Stat label="Fighter base pay" value={<span className="font-mono text-red-300">-${event.results.fighterBasePay.toLocaleString()}</span>} />
        <Stat label="Win bonuses" value={<span className="font-mono text-red-300">-${event.results.fighterWinBonuses.toLocaleString()}</span>} />
        <Stat label="Fan reaction" value={`${Math.round(event.results.fanReaction)}/100`} />
        <Stat label="Net profit" value={<span className={`font-mono ${event.results.profit >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{event.results.profit >= 0 ? '+' : ''}${event.results.profit.toLocaleString()}</span>} />
      </div>
    </Panel>}

    <section className="space-y-4"><h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">Fight results</h2>
      {event.fights.map((fight, index) => {
        const red = fighters[fight.redCornerId];
        const blue = fighters[fight.blueCornerId];
        const result = fight.result;
        if (!result) return null;
        const isDraw = result.method === 'Draw';
        const winnerId = result.winnerId;
        const isExpanded = expandedFights[index] || false;
        const isDecision = result.method.includes('Decision');
        return <DataSurface key={index}>
          <button type="button" onClick={() => toggleFight(index)} className="flex w-full flex-col items-center gap-3 border-b border-[#2a2c31] bg-black/10 p-4 text-center transition-colors hover:bg-white/[0.02] sm:flex-row">
            <span className={`flex-1 truncate text-lg font-medium ${winnerId === red.id ? 'text-emerald-300' : isDraw ? 'text-amber-300' : 'text-neutral-500'}`}>{red.firstName} {red.lastName} {winnerId === red.id && '👑'}</span>
            <span className="w-40"><span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">{fight.weightClass} {fight.isTitleFight && '· Title'}</span><span className="mt-1 inline-block text-sm text-white">{result.method}</span><span className="mt-1 block text-xs text-neutral-500">R{result.round} · {result.time}</span></span>
            <span className={`flex-1 truncate text-lg font-medium ${winnerId === blue.id ? 'text-emerald-300' : isDraw ? 'text-amber-300' : 'text-neutral-500'}`}>{winnerId === blue.id && '👑'} {blue.firstName} {blue.lastName}</span>
            {isExpanded ? <ChevronUp size={18} className="text-neutral-500" /> : <ChevronDown size={18} className="text-neutral-500" />}
          </button>
          {isExpanded && <div className="grid gap-6 p-4 text-sm text-neutral-300 md:grid-cols-3">
            <div className="space-y-3 md:col-span-2"><h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">Round-by-round play-by-play</h3><div className="max-h-64 space-y-1.5 overflow-y-auto pr-2 text-xs custom-scrollbar">{result.commentary.map((line, lineIndex) => <p key={lineIndex} className={line.startsWith('---') ? 'mb-2 mt-4 border-b border-[#2a2c31] pb-1 text-sm font-medium text-white' : line.startsWith('End of') ? 'mb-4 mt-2 italic text-neutral-400' : ''}>{line}</p>)}</div></div>
            <div className="space-y-4"><Panel className="p-4"><h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">Fight metrics</h3><p className="mt-3 flex justify-between text-xs"><span>Action rating</span><span className="text-white">{result.performanceRating}/100</span></p>{isDecision && result.scorecards && <div className="mt-4 border-t border-[#2a2c31] pt-3 text-xs"><p className="mb-2 text-neutral-400">Judges' scorecards</p>{result.scorecards.map((score, scoreIndex) => <p key={scoreIndex} className="flex justify-between font-mono"><span>Judge {scoreIndex + 1}</span><span className="text-white">{score}</span></p>)}</div>}{event.results?.rankingChanges && (event.results.rankingChanges[red.id] || event.results.rankingChanges[blue.id]) && <div className="mt-4 border-t border-[#2a2c31] pt-3 text-xs"><p className="mb-2 text-neutral-400">Ranking updates</p>{[red, blue].map(fighter => { const change = event.results?.rankingChanges?.[fighter.id]; if (!change) return null; const movedUp = change.oldRank > change.newRank; const oldIsChamp = change.oldRank === 0 && fighter.isChampion; const newIsChamp = change.newRank === 0 && fighter.isChampion; return <p key={fighter.id} className="flex justify-between"><span>{fighter.lastName}</span><span className={movedUp ? 'text-emerald-300' : 'text-red-300'}>{formatRankDisplay(change.oldRank, oldIsChamp)} → {formatRankDisplay(change.newRank, newIsChamp)}</span></p>; })}</div>}</Panel>
              {result.injuries && result.injuries.length > 0 && <Panel className="border-red-900 p-4"><StatusBadge tone="danger">Injuries sustained</StatusBadge>{result.injuries.map((injury, injuryIndex) => <p key={injuryIndex} className="mt-2 text-xs text-red-300"><span className="font-medium">{injury.fighterId === red.id ? red.lastName : blue.lastName}</span>: {injury.type} ({injury.daysRemaining} days)</p>)}</Panel>}
            </div>
          </div>}
        </DataSurface>;
      })}
    </section>
  </div>;
}
