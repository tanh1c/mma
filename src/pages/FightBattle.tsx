import React, { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { Button, DataSurface, PageHeader, Panel, StatusBadge } from '../components/ui';
import { CountryFlag } from '../components/CountryFlag';
import { FighterAvatar } from '../components/FighterAvatar';

export default function FightBattle() {
  const { selectedEventId, events, fighters, belts, activeEventSimulation, simulateNextFightPreview, updateActiveSimulation, confirmPendingFightAndAdvance, finalizeCurrentEvent } = useGameStore();
  const [autoPlay, setAutoPlay] = useState(false);
  const event = selectedEventId ? events[selectedEventId] : null;
  const isAllFightsDone = activeEventSimulation ? activeEventSimulation.activeFightIndex < 0 : true;

  useEffect(() => {
    if (isAllFightsDone && event && !event.isCompleted) finalizeCurrentEvent();
  }, [isAllFightsDone, event, finalizeCurrentEvent]);

  const activeFightIndex = activeEventSimulation?.activeFightIndex ?? -1;
  const matchup = event?.fights[activeFightIndex];
  const result = activeEventSimulation?.pendingResult;
  const isSimulated = activeEventSimulation?.status !== 'idle' && activeEventSimulation?.status !== undefined;
  const totalLines = result ? result.commentary.length : 0;
  const revealedLines = activeEventSimulation?.revealedLines ?? 0;
  const isFinished = isSimulated && revealedLines >= totalLines;
  const revealedRounds = result ? (isFinished ? (result.roundStats?.length || 0) : result.commentary.slice(0, revealedLines).filter(line => line.startsWith('End of Round')).length) : 0;

  useEffect(() => {
    if (autoPlay && isSimulated && !isFinished) {
      const timer = setTimeout(() => updateActiveSimulation({ revealedLines: revealedLines + 1 }), 800);
      return () => clearTimeout(timer);
    }
    if (isFinished && autoPlay) setAutoPlay(false);
  }, [autoPlay, isSimulated, isFinished, revealedLines, updateActiveSimulation]);

  useEffect(() => { setAutoPlay(false); }, [activeFightIndex]);

  if (!event || isAllFightsDone || !activeEventSimulation || !matchup) return null;
  const red = fighters[matchup.redCornerId];
  const blue = fighters[matchup.blueCornerId];
  if (!red || !blue) return null;

  const label = activeFightIndex === 0 ? 'Main event' : activeFightIndex === 1 ? 'Co-main event' : `Bout ${event.fights.length - activeFightIndex}`;
  const handleRevealNext = () => updateActiveSimulation({ revealedLines: Math.min(revealedLines + 1, totalLines) });
  const handleRevealAll = () => updateActiveSimulation({ revealedLines: totalLines });

  return <div className="mx-auto mb-12 mt-6 max-w-4xl space-y-6">
    <PageHeader eyebrow={label} title={event.name} description={`${matchup.weightClass}${matchup.isTitleFight ? ` · ${matchup.titleFightType === 'interim' ? 'Interim ' : matchup.titleFightType === 'unification' ? 'Unification ' : ''}${belts[`belt_${matchup.weightClass.toLowerCase()}`]?.shortName || 'Title fight'}` : ''}`} />

    <div className="grid gap-4 md:grid-cols-2">
      <CornerCard tone="red" fighter={red} />
      <CornerCard tone="blue" fighter={blue} />
    </div>

    {!isSimulated ? <Panel className="text-center"><Button variant="primary" onClick={() => simulateNextFightPreview()} className="px-8">Begin fight</Button></Panel> : <div className="grid gap-6 lg:grid-cols-3">
      <DataSurface className="flex h-[500px] flex-col lg:col-span-2">
        <div className="flex shrink-0 flex-wrap justify-center gap-2 border-b border-[#2a2c31] bg-black/10 p-3">
          {!isFinished && <><Button variant="secondary" onClick={handleRevealNext} className="min-h-9 px-3 text-xs">Next line</Button><Button variant={autoPlay ? 'primary' : 'secondary'} onClick={() => setAutoPlay(!autoPlay)} className="min-h-9 px-3 text-xs">{autoPlay ? 'Stop auto' : 'Auto play'}</Button><Button variant="quiet" onClick={handleRevealAll} className="min-h-9 px-3 text-xs">Skip to result</Button></>}
          {isFinished && <Button variant="primary" onClick={() => confirmPendingFightAndAdvance()} className="px-6">{activeFightIndex === 0 ? 'Confirm & finish event' : 'Confirm result & next fight'}</Button>}
        </div>
        <div className="flex flex-1 flex-col-reverse overflow-y-auto p-6 custom-scrollbar"><div className="space-y-2">
          {result?.commentary.slice(0, revealedLines).map((line, index) => <p key={index} className={`text-sm ${line.startsWith('---') ? 'mb-2 mt-6 border-b border-[#2a2c31] pb-1 text-base font-medium text-white' : line.startsWith('End of') ? 'mb-4 mt-2 italic text-neutral-400' : 'text-neutral-300'}`}>{line}</p>)}
          {isFinished && result && <div className="mt-8 border-t border-[#2a2c31] pt-6"><h2 className="text-center text-3xl font-normal tracking-[-0.04em] text-white">{result.winnerId ? `${fighters[result.winnerId].lastName} wins!` : 'Draw!'}</h2><p className="mt-2 text-center font-mono text-sm text-neutral-400">via {result.method} (R{result.round} · {result.time})</p>{result.method.includes('Decision') && result.scorecards && <div className="mt-6 flex flex-wrap justify-center gap-2">{result.scorecards.map((score, index) => <StatusBadge key={index}>Judge {index + 1}: {score}</StatusBadge>)}</div>}</div>}
        </div></div>
      </DataSurface>
      <section className="space-y-4"><h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">Round stats</h2>
        {result?.roundStats?.slice(0, revealedRounds).map((round, index) => <Panel key={index} className="p-4"><div className="mb-3 flex items-center justify-between gap-2"><span className="text-sm text-white">Round {round.round}</span><span className="text-xs text-neutral-500">{round.summary}</span></div><div className="space-y-2 text-xs"><RoundStat red={`${round.red.significantStrikesLanded}/${round.red.significantStrikesAttempted}`} label="Sig. str." blue={`${round.blue.significantStrikesLanded}/${round.blue.significantStrikesAttempted}`} /><RoundStat red={`${round.red.totalStrikesLanded}/${round.red.totalStrikesAttempted}`} label="Total str." blue={`${round.blue.totalStrikesLanded}/${round.blue.totalStrikesAttempted}`} /><RoundStat red={`${round.red.takedownsLanded}/${round.red.takedownsAttempted}`} label="Takedowns" blue={`${round.blue.takedownsLanded}/${round.blue.takedownsAttempted}`} /><RoundStat red={`${Math.floor(round.red.controlSeconds / 60)}:${(round.red.controlSeconds % 60).toString().padStart(2, '0')}`} label="Control" blue={`${Math.floor(round.blue.controlSeconds / 60)}:${(round.blue.controlSeconds % 60).toString().padStart(2, '0')}`} /></div></Panel>)}
        {revealedRounds === 0 && <p className="pt-8 text-center text-sm text-neutral-600">Stats will appear after a round ends.</p>}
      </section>
    </div>}
  </div>;
}

function CornerCard({ fighter, tone }: { fighter: { id: string; firstName: string; lastName: string; nationality: string; style: string; record: { wins: number; losses: number; draws: number }; isChampion: boolean }; tone: 'red' | 'blue' }) {
  const color = tone === 'red' ? 'border-red-900' : 'border-blue-900';
  const text = tone === 'red' ? 'text-red-300' : 'text-blue-300';
  return <Panel className={`border-l-2 ${color} text-center`}><FighterAvatar id={fighter.id} name={`${fighter.firstName} ${fighter.lastName}`} nationality={fighter.nationality} className={`mx-auto h-20 w-20 border ${color}`} /><h2 className="mt-3 text-2xl font-normal tracking-[-0.03em] text-white">{fighter.firstName} {fighter.lastName}</h2><p className="mt-1 font-mono text-sm text-neutral-400"><CountryFlag nationality={fighter.nationality} className="mr-1 text-sm" />{fighter.record.wins}-{fighter.record.losses}-{fighter.record.draws}</p><StatusBadge>{fighter.style}</StatusBadge>{fighter.isChampion && <p className={`mt-3 font-mono text-[10px] uppercase tracking-[0.14em] ${text}`}>Champion</p>}</Panel>;
}

function RoundStat({ red, label, blue }: { red: string; label: string; blue: string }) {
  return <div className="flex border-b border-[#2a2c31] pb-1 last:border-0"><span className="w-1/3 font-mono text-red-300">{red}</span><span className="w-1/3 text-center text-neutral-500">{label}</span><span className="w-1/3 text-right font-mono text-blue-300">{blue}</span></div>;
}
