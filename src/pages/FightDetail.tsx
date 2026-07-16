import React from 'react';
import { Activity, ArrowLeft, Award } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import type { FightArchiveItem } from '../types/game';
import { Button, DataSurface, PageHeader, Panel, StatusBadge } from '../components/ui';
import { FighterRankBadge } from '../components/FighterRankBadge';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../store/settingsStore';
import { formatDate, formatFightMethod, formatWeightClass } from '../lib/localization';

export const FightDetail: React.FC = () => {
  const { t } = useTranslation('translation');
  const language = useSettingsStore(state => state.language);
  const { fightArchive, selectedFightArchiveId, goBack, fighters, belts } = useGameStore();
  if (!selectedFightArchiveId) return null;
  const archiveItem: FightArchiveItem = fightArchive[selectedFightArchiveId];
  if (!archiveItem) return <div className="p-4 text-white">{t($ => $.fight.archive.notFound)}</div>;

  const redFighter = fighters[archiveItem.redFighterId];
  const blueFighter = fighters[archiveItem.blueFighterId];
  const belt = belts[`belt_${archiveItem.weightClass.toLowerCase()}`];
  const redName = redFighter ? `${redFighter.firstName} ${redFighter.lastName}` : t($ => $.fight.archive.redFighter);
  const blueName = blueFighter ? `${blueFighter.firstName} ${blueFighter.lastName}` : t($ => $.fight.archive.blueFighter);

  const tournamentRoundLabels = {
    quarterfinal: t($ => $.fight.tournamentRound.quarterfinal),
    semifinal: t($ => $.fight.tournamentRound.semifinal),
    final: t($ => $.fight.tournamentRound.final)
  };
  const titleChangeLabels = {
    new_champion: t($ => $.fight.archive.titleChange.newChampion),
    title_defense: t($ => $.fight.archive.titleChange.titleDefense),
    vacant_title_won: t($ => $.fight.archive.titleChange.vacantWon),
    interim_won: t($ => $.fight.archive.titleChange.interimWon),
    interim_defense: t($ => $.fight.archive.titleChange.interimDefense),
    unified: t($ => $.fight.archive.titleChange.unified),
    no_change: ''
  };
  const dominanceLabels = {
    close: t($ => $.fight.archive.dominance.close),
    clear: t($ => $.fight.archive.dominance.clear),
    dominant: t($ => $.fight.archive.dominance.dominant),
    near_finish: t($ => $.fight.archive.dominance.nearFinish)
  };

  return <div className="space-y-6 pb-12">
    <PageHeader eyebrow={t($ => $.fight.archive.eyebrow)} title={t($ => $.fight.archive.title)} actions={<Button variant="quiet" onClick={() => goBack('history')} className="inline-flex items-center gap-2"><ArrowLeft size={16} /> {t($ => $.common.back)}</Button>} />
    <Panel className="border-t-2 border-t-[#2a2c31]">
      <div className="mb-6 flex flex-col justify-between gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500 sm:flex-row"><span>{archiveItem.eventName}</span><span>{formatDate(archiveItem.date, language)}</span></div>
      <div className="flex items-center justify-between gap-3">
        <FighterResult name={redName} record={archiveItem.redRecordAfter} winner={archiveItem.winnerId === archiveItem.redFighterId} tone="red" winnerLabel={t($ => $.fight.common.winner)} rank={<><span>{t($ => $.fight.common.atFight)}: {archiveItem.redRankAtFight ?? '—'}</span><span className="inline-flex items-center gap-1">{t($ => $.fight.common.current)}: <FighterRankBadge fighterId={archiveItem.redFighterId} /></span></>} />
        <div className="flex w-28 shrink-0 flex-col items-center text-center"><span className="font-mono text-sm text-neutral-600">VS</span>{archiveItem.isTitleFight && <Award className="mt-2 h-5 w-5 text-amber-300" />}<span className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">{archiveItem.isTitleFight && belt ? belt.shortName : formatWeightClass(archiveItem.weightClass, language)}</span>{archiveItem.tournamentRound && <span className="mt-2"><StatusBadge tone="warning">{tournamentRoundLabels[archiveItem.tournamentRound]}</StatusBadge></span>}</div>
        <FighterResult name={blueName} record={archiveItem.blueRecordAfter} winner={archiveItem.winnerId === archiveItem.blueFighterId} tone="blue" winnerLabel={t($ => $.fight.common.winner)} rank={<><span>{t($ => $.fight.common.atFight)}: {archiveItem.blueRankAtFight ?? '—'}</span><span className="inline-flex items-center gap-1">{t($ => $.fight.common.current)}: <FighterRankBadge fighterId={archiveItem.blueFighterId} /></span></>} />
      </div>
    </Panel>

    <div className="grid gap-4 md:grid-cols-2"><Panel><h2 className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500"><Activity size={14} /> {t($ => $.fight.common.officialResult)}</h2><div className="space-y-3"><ResultItem label={t($ => $.fight.archive.method)} value={formatFightMethod(archiveItem.method, language)} /><ResultItem label={t($ => $.fight.archive.round)} value={archiveItem.round} /><ResultItem label={t($ => $.fight.archive.time)} value={archiveItem.time} /><ResultItem label={t($ => $.fight.archive.performance)} value={<span className="text-amber-300">{archiveItem.performanceRating} / 100</span>} last /></div></Panel>
      {archiveItem.scorecards && archiveItem.scorecards.length > 0 && <Panel><h2 className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">{t($ => $.fight.archive.scorecards)}</h2><div className="space-y-2">{archiveItem.scorecards.map((score, index) => <div key={index} className="flex justify-between border-b border-[#2a2c31] pb-2 font-mono text-sm last:border-0"><span className="text-neutral-400">{t($ => $.fight.common.judge, { number: index + 1 })}</span><span className="text-white">{score}</span></div>)}</div></Panel>}
    </div>

    {(archiveItem.injuries?.length || archiveItem.titleChangeInfo) && <Panel className={archiveItem.injuries?.length ? 'border-red-900' : 'border-amber-900'}>{archiveItem.titleChangeInfo && <div className="mb-4"><StatusBadge tone="warning">{t($ => $.fight.archive.titleStatus)}</StatusBadge><p className="mt-2 text-white">{titleChangeLabels[archiveItem.titleChangeInfo.type]}</p></div>}{archiveItem.injuries && archiveItem.injuries.length > 0 && <div><StatusBadge tone="danger">{t($ => $.fight.archive.medicalSuspensions)}</StatusBadge><ul className="mt-3 space-y-1 text-sm text-neutral-300">{archiveItem.injuries.map((injury, index) => <li key={index}>{t($ => $.fight.archive.injury, { name: injury.fighterId === archiveItem.redFighterId ? redName : blueName, type: injury.type, count: injury.daysRemaining })}</li>)}</ul></div>}</Panel>}

    {archiveItem.roundStats && archiveItem.roundStats.length > 0 && <Panel><h2 className="mb-4 border-b border-[#2a2c31] pb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">{t($ => $.fight.archive.totalStats)}</h2><TotalStats rounds={archiveItem.roundStats} /></Panel>}

    {archiveItem.roundStats && archiveItem.roundStats.length > 0 ? <section className="space-y-4"><h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">{t($ => $.fight.archive.roundByRound)}</h2>{archiveItem.roundStats.map((round, index) => <DataSurface key={index}><div className="flex flex-col justify-between gap-2 border-b border-[#2a2c31] bg-black/10 px-4 py-3 sm:flex-row sm:items-center"><div className="flex items-center gap-3"><span className="text-white">{t($ => $.fight.common.round, { number: round.round })}</span>{round.dominanceLevel && <StatusBadge tone={round.dominanceLevel === 'close' ? 'neutral' : round.dominanceLevel === 'clear' ? 'success' : 'warning'}>{dominanceLabels[round.dominanceLevel]}</StatusBadge>}</div><span className="text-sm text-neutral-400">{round.summary}</span></div><div className="grid gap-6 p-4 lg:grid-cols-3">{round.judges && <div className="space-y-2"><h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">{t($ => $.fight.archive.judgesScore)}</h3>{round.judges.map(judge => <div key={judge.judgeId} className="flex justify-between border-b border-[#2a2c31] pb-2 text-sm"><span><span className="block text-neutral-400">{judge.judgeId}</span>{judge.reason && <span className="font-mono text-[10px] uppercase text-neutral-600">{judge.reason.replace('-', ' ')}</span>}</span><span className="font-mono"><span className={judge.redScore > judge.blueScore ? 'font-medium text-red-300' : 'text-neutral-500'}>{judge.redScore}</span><span className="px-1 text-neutral-600">-</span><span className={judge.blueScore > judge.redScore ? 'font-medium text-blue-300' : 'text-neutral-500'}>{judge.blueScore}</span></span></div>)}</div>}<div className="lg:col-span-2"><h3 className="mb-3 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">{t($ => $.fight.stats.fighterStats)}</h3><div className="space-y-2"><StatRow label={t($ => $.fight.stats.significantStrikes)} red={`${round.red.significantStrikesLanded} / ${round.red.significantStrikesAttempted}`} blue={`${round.blue.significantStrikesLanded} / ${round.blue.significantStrikesAttempted}`} /><StatRow label={t($ => $.fight.stats.totalStrikes)} red={`${round.red.totalStrikesLanded} / ${round.red.totalStrikesAttempted}`} blue={`${round.blue.totalStrikesLanded} / ${round.blue.totalStrikesAttempted}`} /><StatRow label={t($ => $.fight.stats.headStrikes)} red={round.red.headStrikesLanded} blue={round.blue.headStrikesLanded} /><StatRow label={t($ => $.fight.stats.bodyLegStrikes)} red={`${round.red.bodyStrikesLanded} / ${round.red.legStrikesLanded}`} blue={`${round.blue.bodyStrikesLanded} / ${round.blue.legStrikesLanded}`} /><StatRow label={t($ => $.fight.stats.takedowns)} red={`${round.red.takedownsLanded} / ${round.red.takedownsAttempted}`} blue={`${round.blue.takedownsLanded} / ${round.blue.takedownsAttempted}`} /><StatRow label={t($ => $.fight.stats.controlTime)} red={`${Math.floor(round.red.controlSeconds / 60)}:${(round.red.controlSeconds % 60).toString().padStart(2, '0')}`} blue={`${Math.floor(round.blue.controlSeconds / 60)}:${(round.blue.controlSeconds % 60).toString().padStart(2, '0')}`} /><StatRow label={t($ => $.fight.stats.submissionAttempts)} red={round.red.submissionAttempts} blue={round.blue.submissionAttempts} /><StatRow label={t($ => $.fight.stats.knockdowns)} red={round.red.knockdowns} blue={round.blue.knockdowns} /></div></div></div>{round.keyMoments && round.keyMoments.length > 0 && <div className="border-t border-[#2a2c31] p-4"><h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">{t($ => $.fight.archive.keyMoments)}</h3><ul className="mt-2 list-inside list-disc space-y-1 text-sm text-neutral-300">{round.keyMoments.map((moment, momentIndex) => <li key={momentIndex}>{moment}</li>)}</ul></div>}</DataSurface>)}</section> : <Panel className="text-center text-neutral-500">{t($ => $.fight.archive.noRoundStats)}</Panel>}

    {archiveItem.commentary && archiveItem.commentary.length > 0 && <DataSurface><h2 className="border-b border-[#2a2c31] bg-black/10 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">{t($ => $.fight.archive.playByPlay)}</h2><div className="max-h-96 space-y-2 overflow-y-auto p-4 custom-scrollbar">{archiveItem.commentary.map((line, index) => <p key={index} className={`text-sm ${line.startsWith('---') || line.startsWith('End of') || line.startsWith('We go to') || line.startsWith('The winner') || line.startsWith('BOOM') || line.startsWith('The referee') || line.startsWith('OH!') ? 'my-3 font-medium text-white' : 'text-neutral-400'}`}>{line}</p>)}</div></DataSurface>}
  </div>;
};

function FighterResult({ name, record, winner, tone, rank, winnerLabel }: { name: string; record?: string; winner: boolean; tone: 'red' | 'blue'; rank: React.ReactNode; winnerLabel: string }) {
  return <div className={`w-5/12 border-b pb-3 text-center ${tone === 'red' ? 'border-red-900' : 'border-blue-900'}`}><h2 className="text-xl font-normal tracking-[-0.03em] text-white md:text-3xl">{name}</h2><div className="mt-2 flex flex-wrap justify-center gap-2 font-mono text-[10px] text-neutral-500">{rank}</div>{record && <p className="mt-1 text-sm text-neutral-500">{record}</p>}{winner && <span className="mt-2 inline-block"><StatusBadge tone="success">{winnerLabel}</StatusBadge></span>}</div>;
}

function ResultItem({ label, value, last = false }: { label: string; value: React.ReactNode; last?: boolean }) {
  return <div className={`flex justify-between ${last ? '' : 'border-b border-[#2a2c31] pb-2'}`}><span className="text-neutral-500">{label}</span><span className="font-medium text-white">{value}</span></div>;
}

function TotalStats({ rounds }: { rounds: NonNullable<FightArchiveItem['roundStats']> }) {
  const { t } = useTranslation('translation');
  const total = (corner: 'red' | 'blue') => rounds.reduce((acc, round) => ({ sigLanded: acc.sigLanded + round[corner].significantStrikesLanded, sigAtt: acc.sigAtt + round[corner].significantStrikesAttempted, totLanded: acc.totLanded + round[corner].totalStrikesLanded, totAtt: acc.totAtt + round[corner].totalStrikesAttempted, head: acc.head + round[corner].headStrikesLanded, body: acc.body + round[corner].bodyStrikesLanded, leg: acc.leg + round[corner].legStrikesLanded, tdLanded: acc.tdLanded + round[corner].takedownsLanded, tdAtt: acc.tdAtt + round[corner].takedownsAttempted, ctrl: acc.ctrl + round[corner].controlSeconds, sub: acc.sub + round[corner].submissionAttempts, kd: acc.kd + round[corner].knockdowns, dmg: acc.dmg + round[corner].damageGiven }), { sigLanded: 0, sigAtt: 0, totLanded: 0, totAtt: 0, head: 0, body: 0, leg: 0, tdLanded: 0, tdAtt: 0, ctrl: 0, sub: 0, kd: 0, dmg: 0 });
  const red = total('red');
  const blue = total('blue');
  return <div className="space-y-2"><StatRow label={t($ => $.fight.stats.significantStrikes)} red={`${red.sigLanded} / ${red.sigAtt}`} blue={`${blue.sigLanded} / ${blue.sigAtt}`} /><StatRow label={t($ => $.fight.stats.totalStrikes)} red={`${red.totLanded} / ${red.totAtt}`} blue={`${blue.totLanded} / ${blue.totAtt}`} /><StatRow label={t($ => $.fight.stats.headStrikes)} red={red.head} blue={blue.head} /><StatRow label={t($ => $.fight.stats.bodyLegStrikes)} red={`${red.body} / ${red.leg}`} blue={`${blue.body} / ${blue.leg}`} /><StatRow label={t($ => $.fight.stats.takedowns)} red={`${red.tdLanded} / ${red.tdAtt}`} blue={`${blue.tdLanded} / ${blue.tdAtt}`} /><StatRow label={t($ => $.fight.stats.controlTime)} red={`${Math.floor(red.ctrl / 60)}:${(red.ctrl % 60).toString().padStart(2, '0')}`} blue={`${Math.floor(blue.ctrl / 60)}:${(blue.ctrl % 60).toString().padStart(2, '0')}`} /><StatRow label={t($ => $.fight.stats.submissionAttempts)} red={red.sub} blue={blue.sub} /><StatRow label={t($ => $.fight.stats.knockdowns)} red={red.kd} blue={blue.kd} /><StatRow label={t($ => $.fight.stats.damageGiven)} red={Math.floor(red.dmg)} blue={Math.floor(blue.dmg)} /></div>;
}

function StatRow({ label, red, blue }: { label: string; red: string | number; blue: string | number }) {
  return <div className="flex items-center justify-between border-b border-[#2a2c31] py-1.5 last:border-0"><span className="w-1/3 text-center font-mono text-sm text-red-300">{red}</span><span className="w-1/3 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">{label}</span><span className="w-1/3 text-center font-mono text-sm text-blue-300">{blue}</span></div>;
}
