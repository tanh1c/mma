import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { Button, DataSurface, PageHeader, Panel, StatusBadge } from '../components/ui';
import { CountryFlag } from '../components/CountryFlag';
import { FighterAvatar } from '../components/FighterAvatar';
import { FighterRankBadge } from '../components/FighterRankBadge';
import type { FightCorner, FightSession, FightTimelineEvent } from '../lib/game/liveFight';

export default function FightBattle() {
  const {
    selectedEventId,
    events,
    fighters,
    belts,
    activeEventSimulation,
    startLiveFight,
    advanceLiveFight,
    setLiveFightPlayback,
    toggleLiveFightPause,
    skipLiveFight,
    confirmPendingFightAndAdvance,
    finalizeCurrentEvent
  } = useGameStore();
  const event = selectedEventId ? events[selectedEventId] : null;
  const activeFightIndex = activeEventSimulation?.activeFightIndex ?? -1;
  const isAllFightsDone = activeFightIndex < 0;
  const matchup = event?.fights[activeFightIndex];
  const session = activeEventSimulation?.session;
  const status = activeEventSimulation?.status;
  const playbackSpeed = activeEventSimulation?.playbackSpeed ?? 1;

  useEffect(() => {
    if (status !== 'running') return;
    const timer = setTimeout(advanceLiveFight, 1400 / playbackSpeed);
    return () => clearTimeout(timer);
  }, [status, playbackSpeed, session?.timeline.length, advanceLiveFight]);

  useEffect(() => {
    if (isAllFightsDone && event && !event.isCompleted) finalizeCurrentEvent();
  }, [isAllFightsDone, event, finalizeCurrentEvent]);

  if (!event || isAllFightsDone || !activeEventSimulation || !matchup) return null;
  const red = fighters[matchup.redCornerId];
  const blue = fighters[matchup.blueCornerId];
  if (!red || !blue) return null;

  const label = activeFightIndex === 0 ? 'Main event' : activeFightIndex === 1 ? 'Co-main event' : `Bout ${event.fights.length - activeFightIndex}`;
  const latestEvent = session?.timeline.at(-1);
  const clock = session ? `${Math.floor(session.clock / 60)}:${String(session.clock % 60).padStart(2, '0')}` : '5:00';
  const finished = status === 'finished' && session?.phase === 'finished';

  return <div className="mx-auto mb-12 mt-6 max-w-6xl space-y-6 min-w-0">
    <PageHeader eyebrow={label} title={event.name} description={`${matchup.weightClass}${matchup.isTitleFight ? ` · ${matchup.titleFightType === 'interim' ? 'Interim ' : matchup.titleFightType === 'unification' ? 'Unification ' : ''}${belts[`belt_${matchup.weightClass.toLowerCase()}`]?.shortName || 'Title fight'}` : ''}`} />

    {!session ? <Panel className="text-center">
      <p className="mb-4 text-sm text-neutral-400">The fight advances action by action from one deterministic simulation.</p>
      <Button variant="primary" onClick={startLiveFight} className="px-8">Begin fight</Button>
    </Panel> : <>
      <DataSurface className="relative min-w-0 overflow-hidden">
        <div className="border-b border-[#2a2c31] px-4 py-3 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">Round {session.round} · {session.position.toUpperCase()}</p>
          <p className="mt-1 font-mono text-3xl tabular-nums text-white">{clock}</p>
        </div>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-7 sm:gap-6 sm:px-8">
          <Combatant corner="red" session={session} latestEvent={latestEvent} />
          <div className="min-w-12 text-center sm:min-w-28">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-600">versus</span>
            <p className="mt-2 max-w-28 text-xs font-medium text-white sm:text-sm" aria-live="polite">{latestEvent?.headline ?? 'Ready'}</p>
          </div>
          <Combatant corner="blue" session={session} latestEvent={latestEvent} />
        </div>

        <div className="border-t border-[#2a2c31] px-3 py-4">
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="secondary" onClick={toggleLiveFightPause} disabled={finished}>{status === 'paused' ? 'Resume' : 'Pause'}</Button>
            {([1, 2, 4] as const).map(speed => <Button key={speed} variant={playbackSpeed === speed ? 'primary' : 'secondary'} onClick={() => setLiveFightPlayback(speed)} disabled={finished}>x{speed}</Button>)}
            <Button variant="quiet" onClick={skipLiveFight} disabled={finished}>Skip to result</Button>
          </div>
        </div>

        {finished && <div className="absolute inset-0 flex items-center justify-center bg-black/85 p-4">
          <Panel className="max-w-md text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">Official result</p>
            <h2 className="mt-3 text-3xl tracking-[-0.04em] text-white">{session.winnerId ? `${fighters[session.winnerId].lastName} wins` : 'Draw'}</h2>
            <p className="mt-2 font-mono text-sm text-neutral-300">{session.method} · Round {session.finishRound} · {session.finishTime}</p>
            {session.scorecards.length > 0 && <div className="mt-4 flex flex-wrap justify-center gap-2">{session.scorecards.map((score, index) => <StatusBadge key={index}>Judge {index + 1}: {score}</StatusBadge>)}</div>}
            <Button variant="primary" onClick={confirmPendingFightAndAdvance} className="mt-6 px-6">{activeFightIndex === 0 ? 'Confirm & finish event' : 'Confirm result & next fight'}</Button>
          </Panel>
        </div>}
      </DataSurface>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.6fr)]">
        <DataSurface className="min-w-0 p-5">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">Live commentary</h2>
          <div className="mt-4 max-h-72 space-y-2 overflow-y-auto custom-scrollbar">
            {session.timeline.slice(-12).reverse().map(item => <div key={item.sequence} className="border-b border-[#2a2c31] pb-2 last:border-0">
              <p className="text-sm text-neutral-200">{item.commentary}</p>
              <p className="mt-1 font-mono text-[10px] text-neutral-600">R{item.round} · {formatClock(item.clock)} · {item.positionAfter}</p>
            </div>)}
          </div>
        </DataSurface>

        <section className="min-w-0 space-y-4">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">Round statistics</h2>
          <Panel className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2"><span className="text-sm text-white">Round {session.round}</span><span className="text-xs text-neutral-500">Live</span></div>
            <RoundStatsView red={session.currentRoundStats.red} blue={session.currentRoundStats.blue} />
          </Panel>
          {session.roundStats.slice(-2).reverse().map(round => <Panel key={round.round} className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2"><span className="text-sm text-white">Round {round.round}</span><span className="text-right text-xs text-neutral-500">{round.summary}</span></div>
            <RoundStatsView red={round.red} blue={round.blue} />
          </Panel>)}
        </section>
      </div>
    </>}
  </div>;
}

function Combatant({ corner, session, latestEvent }: { corner: FightCorner; session: FightSession; latestEvent?: FightTimelineEvent }) {
  const state = corner === 'red' ? session.red : session.blue;
  const fighter = state.fighter;
  const label = corner === 'red' ? 'Red corner' : 'Blue corner';
  const color = corner === 'red' ? 'border-red-800' : 'border-blue-800';
  const align = corner === 'red' ? 'items-start text-left' : 'items-end text-right';
  const animation = eventAnimation(latestEvent, corner);
  return <div className={`flex min-w-0 flex-col ${align}`}>
    <div className={`relative ${animation}`}>
      <FighterAvatar id={fighter.id} name={`${fighter.firstName} ${fighter.lastName}`} nationality={fighter.nationality} className={`h-20 w-20 border-2 ${color} sm:h-32 sm:w-32 ${corner === 'blue' ? '-scale-x-100' : ''}`} />
    </div>
    <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.15em] text-neutral-500">{label}</p>
    <div className={`mt-1 flex max-w-full flex-wrap gap-1 ${corner === 'blue' ? 'justify-end' : ''}`}><FighterRankBadge fighterId={fighter.id} /><span className="truncate text-sm font-medium text-white sm:text-lg">{fighter.lastName}</span></div>
    <p className="mt-1 truncate font-mono text-[10px] text-neutral-500"><CountryFlag nationality={fighter.nationality} className="mr-1" />{fighter.record.wins}-{fighter.record.losses}-{fighter.record.draws}</p>
    <div className="mt-3 w-full max-w-56 space-y-2">
      <ResourceMeter label={`${label} Condition`} value={state.condition} tone={corner === 'red' ? 'red' : 'blue'} />
      <ResourceMeter label={`${label} Stamina`} value={state.stamina} tone="stamina" />
    </div>
  </div>;
}

function ResourceMeter({ label, value, tone }: { label: string; value: number; tone: 'red' | 'blue' | 'stamina' }) {
  const color = tone === 'red' ? 'bg-red-500' : tone === 'blue' ? 'bg-blue-500' : 'bg-amber-400';
  return <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} className="min-w-0">
    <div className="mb-1 flex justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-500"><span>{label.split(' ').at(-1)}</span><span>{Math.round(value)}</span></div>
    <div className="h-2 overflow-hidden rounded-full bg-neutral-800"><div className={`h-full rounded-full transition-[width] duration-300 ${color}`} style={{ width: `${value}%` }} /></div>
  </div>;
}

function eventAnimation(event: FightTimelineEvent | undefined, corner: FightCorner): string {
  if (!event) return '';
  if (event.type === 'finish') return event.actor === corner ? 'fight-finish' : 'fight-knockdown';
  if (event.type === 'recovery' || event.type === 'round-start' || event.type === 'round-end') return 'fight-recovery';
  if (event.target === corner && (event.type === 'strike' || event.type === 'knockdown')) return 'fight-knockdown';
  if (event.actor !== corner) return event.positionAfter === 'ground' ? 'fight-ground' : '';
  if (event.type === 'strike') return 'fight-strike';
  if (event.type === 'takedown') return 'fight-takedown';
  if (event.type === 'clinch') return 'fight-clinch';
  if (event.type === 'submission-attempt') return 'fight-submission';
  if (event.positionAfter === 'ground') return 'fight-ground';
  return '';
}

function RoundStatsView({ red, blue }: { red: FightSession['currentRoundStats']['red']; blue: FightSession['currentRoundStats']['blue'] }) {
  return <div className="space-y-2 text-xs">
    <RoundStat red={`${red.significantStrikesLanded}/${red.significantStrikesAttempted}`} label="Sig. str." blue={`${blue.significantStrikesLanded}/${blue.significantStrikesAttempted}`} />
    <RoundStat red={`${red.totalStrikesLanded}/${red.totalStrikesAttempted}`} label="Total str." blue={`${blue.totalStrikesLanded}/${blue.totalStrikesAttempted}`} />
    <RoundStat red={`${red.takedownsLanded}/${red.takedownsAttempted}`} label="Takedowns" blue={`${blue.takedownsLanded}/${blue.takedownsAttempted}`} />
    <RoundStat red={`${red.submissionAttempts}`} label="Sub attempts" blue={`${blue.submissionAttempts}`} />
    <RoundStat red={formatClock(red.controlSeconds)} label="Control" blue={formatClock(blue.controlSeconds)} />
  </div>;
}

function RoundStat({ red, label, blue }: { red: string; label: string; blue: string }) {
  return <div className="flex border-b border-[#2a2c31] pb-1 last:border-0"><span className="w-1/3 font-mono text-red-300">{red}</span><span className="w-1/3 text-center text-neutral-500">{label}</span><span className="w-1/3 text-right font-mono text-blue-300">{blue}</span></div>;
}

function formatClock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
