import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { Button, DataSurface, PageHeader, Panel, StatusBadge } from '../components/ui';
import { CountryFlag } from '../components/CountryFlag';
import { FighterAvatar } from '../components/FighterAvatar';
import { FightSpriteStage } from '../components/FightSpriteStage';
import { FighterRankBadge } from '../components/FighterRankBadge';
import type { FightCorner, FightPosition, FightSession, FightTimelineEvent } from '../lib/game/liveFight';
import { advanceFightPlayback, fightPlaybackProgress, interpolateFightDisplay } from '../lib/game/fightPlayback';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../store/settingsStore';
import { formatFightMethod, formatTitleFightType, formatWeightClass } from '../lib/localization';

export default function FightBattle() {
  const { t } = useTranslation('translation');
  const [spriteReady, setSpriteReady] = useState(false);
  const [spriteFailed, setSpriteFailed] = useState(false);
  const markSpriteReady = useCallback(() => setSpriteReady(true), []);
  const markSpriteFailed = useCallback(() => setSpriteFailed(true), []);
  const language = useSettingsStore(state => state.language);
  const {
    selectedEventId,
    events,
    fighters,
    belts,
    activeEventSimulation,
    startLiveFight,
    advanceLiveFight,
    checkpointLiveFightPlayback,
    continueLiveFightRound,
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
  const playbackSnapshot = activeEventSimulation?.playbackSnapshot;
  const eventElapsedMs = activeEventSimulation?.eventElapsedMs ?? 0;
  const latestEvent = session?.timeline.at(-1);
  const [localElapsedMs, setLocalElapsedMs] = useState(eventElapsedMs);
  const elapsedRef = useRef(eventElapsedMs);
  const frameRef = useRef<number | null>(null);
  const lastWallRef = useRef<number | null>(null);
  const overflowFightMsRef = useRef(0);
  const completedSequenceRef = useRef<number | null>(null);

  useEffect(() => {
    const elapsed = eventElapsedMs + overflowFightMsRef.current;
    overflowFightMsRef.current = 0;
    elapsedRef.current = elapsed;
    setLocalElapsedMs(elapsed);
    completedSequenceRef.current = null;
  }, [latestEvent?.sequence, eventElapsedMs]);

  const checkpointAtWallTime = useCallback((wallTime: number) => {
    if (!session || !latestEvent || status !== 'running') return;
    const previous = lastWallRef.current ?? wallTime;
    const { elapsedFightMs, overflowFightMs } = advanceFightPlayback(elapsedRef.current, wallTime - previous, playbackSpeed, latestEvent.durationMs);
    lastWallRef.current = wallTime;
    overflowFightMsRef.current = overflowFightMs;
    elapsedRef.current = elapsedFightMs;
    setLocalElapsedMs(elapsedFightMs);
    checkpointLiveFightPlayback(latestEvent.sequence, elapsedFightMs);
  }, [session, latestEvent, status, playbackSpeed, checkpointLiveFightPlayback]);

  const handleTogglePause = useCallback(() => {
    checkpointAtWallTime(performance.now());
    toggleLiveFightPause();
  }, [checkpointAtWallTime, toggleLiveFightPause]);

  const handleSetPlayback = useCallback((speed: 1 | 2 | 4) => {
    checkpointAtWallTime(performance.now());
    setLiveFightPlayback(speed);
  }, [checkpointAtWallTime, setLiveFightPlayback]);

  useEffect(() => {
    if (status !== 'running') lastWallRef.current = null;
  }, [status]);

  useEffect(() => {
    const durationMs = latestEvent?.durationMs ?? 0;
    if (status !== 'running' || !session || !latestEvent) return;
    if (durationMs === 0) {
      overflowFightMsRef.current = elapsedRef.current;
      if (completedSequenceRef.current !== latestEvent.sequence) {
        completedSequenceRef.current = latestEvent.sequence;
        advanceLiveFight();
      }
      return;
    }
    const sequence = latestEvent.sequence;
    const frame = (now: number) => {
      const previous = lastWallRef.current ?? now;
      lastWallRef.current = now;
      const { elapsedFightMs, overflowFightMs } = advanceFightPlayback(elapsedRef.current, now - previous, playbackSpeed, durationMs);
      elapsedRef.current = elapsedFightMs;
      setLocalElapsedMs(elapsedFightMs);
      if (elapsedFightMs >= durationMs) {
        overflowFightMsRef.current = overflowFightMs;
        if (completedSequenceRef.current !== latestEvent.sequence) {
          completedSequenceRef.current = latestEvent.sequence;
          advanceLiveFight();
        }
        return;
      }
      frameRef.current = requestAnimationFrame(frame);
    };
    frameRef.current = requestAnimationFrame(frame);
    return () => {
      checkpointLiveFightPlayback(sequence, elapsedRef.current);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [status, playbackSpeed, latestEvent?.sequence, latestEvent?.durationMs, session, advanceLiveFight, checkpointLiveFightPlayback]);

  useEffect(() => {
    if (isAllFightsDone && event && !event.isCompleted) finalizeCurrentEvent();
  }, [isAllFightsDone, event, finalizeCurrentEvent]);

  if (!event || isAllFightsDone || !activeEventSimulation || !matchup) return null;
  const red = fighters[matchup.redCornerId];
  const blue = fighters[matchup.blueCornerId];
  if (!red || !blue) return null;

  const label = activeFightIndex === 0 ? t($ => $.fight.common.mainEvent) : activeFightIndex === 1 ? t($ => $.fight.common.coMainEvent) : t($ => $.fight.common.bout, { number: event.fights.length - activeFightIndex });
  const eventProgress = fightPlaybackProgress(localElapsedMs, latestEvent?.durationMs ?? 0);
  const display = session && latestEvent && playbackSnapshot?.sequence === latestEvent.sequence
    ? interpolateFightDisplay(playbackSnapshot, latestEvent, eventProgress)
    : session
      ? { clockMs: session.clockMs, redCondition: session.red.condition, blueCondition: session.blue.condition, redStamina: session.red.stamina, blueStamina: session.blue.stamina }
      : { clockMs: 300_000, redCondition: 100, blueCondition: 100, redStamina: 100, blueStamina: 100 };
  const displayClockSeconds = Math.ceil(display.clockMs / 1_000);
  const clock = `${Math.floor(displayClockSeconds / 60)}:${String(displayClockSeconds % 60).padStart(2, '0')}`;
  const currentRoundStats = session && playbackSnapshot ? eventProgress < 1 ? playbackSnapshot.currentRoundStats : session.currentRoundStats : session?.currentRoundStats;
  const highlightEvents = session ? session.timeline.filter(event => event.importance !== 'routine') : [];
  const liveHeadline = highlightEvents.slice().reverse().find(event => event.headline)?.headline ?? t($ => $.fight.battle.ready);
  const completedRound = session?.roundStats.at(-1);
  const finished = status === 'finished' && session?.phase === 'finished';
  const positionLabels: Record<FightPosition, string> = {
    distance: t($ => $.fight.position.distance),
    clinch: t($ => $.fight.position.clinch),
    ground: t($ => $.fight.position.ground)
  };
  const titleDescription = matchup.isTitleFight
    ? belts[`belt_${matchup.weightClass.toLowerCase()}`]?.shortName || formatTitleFightType(matchup.titleFightType || 'undisputed', language)
    : '';

  return <div className="mx-auto mb-12 mt-6 max-w-6xl space-y-6 min-w-0">
    <PageHeader eyebrow={label} title={event.name} description={`${formatWeightClass(matchup.weightClass, language)}${titleDescription ? ` · ${titleDescription}` : ''}`} />

    {!session ? <Panel className="text-center">
      <p className="mb-4 text-sm text-neutral-400">{t($ => $.fight.battle.description)}</p>
      <Button variant="primary" onClick={startLiveFight} className="px-8">{t($ => $.fight.battle.begin)}</Button>
    </Panel> : <>
      <DataSurface className="relative min-w-0 overflow-hidden">
        <div className="border-b border-[#2a2c31] px-4 py-3 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">{t($ => $.fight.common.round, { number: session.round })} · {positionLabels[session.position]}</p>
          <p className="mt-1 font-mono text-3xl tabular-nums text-white">{clock}</p>
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-3 px-3 pt-5 sm:gap-8 sm:px-8">
          <Combatant corner="red" session={session} latestEvent={latestEvent} condition={display.redCondition} stamina={display.redStamina} showAvatar={!spriteReady || spriteFailed} />
          <Combatant corner="blue" session={session} latestEvent={latestEvent} condition={display.blueCondition} stamina={display.blueStamina} showAvatar={!spriteReady || spriteFailed} />
        </div>

        <div className="min-w-0 px-3 pb-6 pt-4 sm:px-8">
          {!spriteFailed && <FightSpriteStage session={session} latestEvent={latestEvent} eventElapsedMs={localElapsedMs} onReady={markSpriteReady} onAssetError={markSpriteFailed} />}
          <div className="mx-auto mt-3 min-w-0 max-w-xl text-center">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-600">{t($ => $.fight.common.versus)}</span>
            <p className="mt-1 text-xs font-medium text-white sm:text-sm" aria-live="polite">{liveHeadline}</p>
          </div>
        </div>

        <div className="border-t border-[#2a2c31] px-3 py-4">
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="secondary" onClick={handleTogglePause} disabled={finished || status === 'between-rounds'}>{status === 'paused' ? t($ => $.fight.battle.resume) : t($ => $.fight.battle.pause)}</Button>
            {([1, 2, 4] as const).map(speed => <Button key={speed} variant={playbackSpeed === speed ? 'primary' : 'secondary'} onClick={() => handleSetPlayback(speed)} disabled={finished}>x{speed}</Button>)}
            <Button variant="quiet" onClick={skipLiveFight} disabled={finished}>{t($ => $.fight.battle.skip)}</Button>
          </div>
        </div>

        {status === 'between-rounds' && session.round < session.matchup.rounds && <div className="absolute inset-0 flex items-center justify-center bg-black/85 p-4">
          <Panel className="max-w-md text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">{t($ => $.fight.battle.betweenRounds, { round: session.round })}</p>
            {completedRound && <>
              <p className="mt-3 text-sm text-neutral-300">{completedRound.summary}</p>
              <div className="mt-4 text-left"><RoundStatsView red={completedRound.red} blue={completedRound.blue} /></div>
            </>}
            <Button variant="primary" onClick={continueLiveFightRound} className="mt-6 px-8">
              {t($ => $.fight.battle.continueRound, { round: session.round + 1 })}
            </Button>
          </Panel>
        </div>}

        {finished && <div className="absolute inset-0 flex items-center justify-center bg-black/85 p-4">
          <Panel className="max-w-md text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">{t($ => $.fight.common.officialResult)}</p>
            <h2 className="mt-3 text-3xl tracking-[-0.04em] text-white">{session.winnerId ? t($ => $.fight.battle.wins, { name: fighters[session.winnerId].lastName }) : t($ => $.fight.common.draw)}</h2>
            <p className="mt-2 font-mono text-sm text-neutral-300">{formatFightMethod(session.method || '', language)} · {t($ => $.fight.common.round, { number: session.finishRound })} · {session.finishTime}</p>
            {session.scorecards.length > 0 && <div className="mt-4 flex flex-wrap justify-center gap-2">{session.scorecards.map((score, index) => <StatusBadge key={index}>{t($ => $.fight.common.judge, { number: index + 1 })}: {score}</StatusBadge>)}</div>}
            <Button variant="primary" onClick={confirmPendingFightAndAdvance} className="mt-6 px-6">{activeFightIndex === 0 ? t($ => $.fight.battle.confirmFinish) : t($ => $.fight.battle.confirmNext)}</Button>
          </Panel>
        </div>}
      </DataSurface>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.6fr)]">
        <DataSurface className="min-w-0 p-5">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">{t($ => $.fight.battle.commentary)}</h2>
          <div className="mt-4 max-h-72 space-y-2 overflow-y-auto custom-scrollbar">
            {highlightEvents.slice(-12).reverse().map(item => <div key={item.sequence} className="border-b border-[#2a2c31] pb-2 last:border-0">
              <p className="text-sm text-neutral-200">{item.commentary}</p>
              <p className="mt-1 font-mono text-[10px] text-neutral-600">R{item.round} · {formatFightClockMs(item.clockAfterMs)} · {item.positionAfter}</p>
            </div>)}
          </div>
        </DataSurface>

        <section className="min-w-0 space-y-4">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">{t($ => $.fight.battle.roundStatistics)}</h2>
          {currentRoundStats && <Panel className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2"><span className="text-sm text-white">{t($ => $.fight.common.round, { number: session.round })}</span><span className="text-xs text-neutral-500">{t($ => $.fight.common.live)}</span></div>
            <RoundStatsView red={currentRoundStats.red} blue={currentRoundStats.blue} />
          </Panel>}
          {session.roundStats.slice(-2).reverse().map(round => <Panel key={round.round} className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2"><span className="text-sm text-white">{t($ => $.fight.common.round, { number: round.round })}</span><span className="text-right text-xs text-neutral-500">{round.summary}</span></div>
            <RoundStatsView red={round.red} blue={round.blue} />
          </Panel>)}
        </section>
      </div>
    </>}
  </div>;
}

function Combatant({ corner, session, latestEvent, condition, stamina, showAvatar }: { corner: FightCorner; session: FightSession; latestEvent?: FightTimelineEvent; condition: number; stamina: number; showAvatar: boolean }) {
  const { t } = useTranslation('translation');
  const state = corner === 'red' ? session.red : session.blue;
  const fighter = state.fighter;
  const label = corner === 'red' ? t($ => $.fight.battle.redCorner) : t($ => $.fight.battle.blueCorner);
  const color = corner === 'red' ? 'border-red-800' : 'border-blue-800';
  const align = corner === 'red' ? 'items-start text-left' : 'items-end text-right';
  const animation = eventAnimation(latestEvent, corner);
  return <div className={`flex min-w-0 flex-col ${align}`}>
    {showAvatar && <div className={`relative ${animation}`}>
      <FighterAvatar id={fighter.id} name={`${fighter.firstName} ${fighter.lastName}`} nationality={fighter.nationality} className={`h-20 w-20 border-2 ${color} sm:h-32 sm:w-32 ${corner === 'blue' ? '-scale-x-100' : ''}`} />
    </div>}
    <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.15em] text-neutral-500">{label}</p>
    <div className={`mt-1 flex max-w-full flex-wrap gap-1 ${corner === 'blue' ? 'justify-end' : ''}`}><FighterRankBadge fighterId={fighter.id} /><span className="truncate text-sm font-medium text-white sm:text-lg">{fighter.lastName}</span></div>
    <p className="mt-1 truncate font-mono text-[10px] text-neutral-500"><CountryFlag nationality={fighter.nationality} className="mr-1" />{fighter.record.wins}-{fighter.record.losses}-{fighter.record.draws}</p>
    <div className="mt-3 w-full max-w-56 space-y-2">
      <ResourceMeter label={t($ => $.fight.battle.meterLabel, { corner: label, resource: t($ => $.fight.battle.condition) })} shortLabel={t($ => $.fight.battle.condition)} value={condition} tone={corner === 'red' ? 'red' : 'blue'} />
      <ResourceMeter label={t($ => $.fight.battle.meterLabel, { corner: label, resource: t($ => $.fight.battle.stamina) })} shortLabel={t($ => $.fight.battle.stamina)} value={stamina} tone="stamina" />
    </div>
  </div>;
}

function ResourceMeter({ label, shortLabel, value, tone }: { label: string; shortLabel: string; value: number; tone: 'red' | 'blue' | 'stamina' }) {
  const color = tone === 'red' ? 'bg-red-500' : tone === 'blue' ? 'bg-blue-500' : 'bg-amber-400';
  return <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} className="min-w-0">
    <div className="mb-1 flex justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-500"><span>{shortLabel}</span><span>{Math.round(value)}</span></div>
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
  const { t } = useTranslation('translation');
  return <div className="space-y-2 text-xs">
    <RoundStat red={`${red.significantStrikesLanded}/${red.significantStrikesAttempted}`} label={t($ => $.fight.stats.significantStrikes)} blue={`${blue.significantStrikesLanded}/${blue.significantStrikesAttempted}`} />
    <RoundStat red={`${red.totalStrikesLanded}/${red.totalStrikesAttempted}`} label={t($ => $.fight.stats.totalStrikes)} blue={`${blue.totalStrikesLanded}/${blue.totalStrikesAttempted}`} />
    <RoundStat red={`${red.takedownsLanded}/${red.takedownsAttempted}`} label={t($ => $.fight.stats.takedowns)} blue={`${blue.takedownsLanded}/${blue.takedownsAttempted}`} />
    <RoundStat red={`${red.submissionAttempts}`} label={t($ => $.fight.stats.submissionAttempts)} blue={`${blue.submissionAttempts}`} />
    <RoundStat red={formatClock(red.controlSeconds)} label={t($ => $.fight.stats.controlTime)} blue={formatClock(blue.controlSeconds)} />
  </div>;
}

function RoundStat({ red, label, blue }: { red: string; label: string; blue: string }) {
  return <div className="flex border-b border-[#2a2c31] pb-1 last:border-0"><span className="w-1/3 font-mono text-red-300">{red}</span><span className="w-1/3 text-center text-neutral-500">{label}</span><span className="w-1/3 text-right font-mono text-blue-300">{blue}</span></div>;
}

function formatFightClockMs(clockMs: number) {
  return formatClock(Math.ceil(clockMs / 1_000));
}

function formatClock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
