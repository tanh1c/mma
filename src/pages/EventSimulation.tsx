import React from 'react';
import { useGameStore } from '../store/gameStore';
import { summarizeCompletedEvent } from '../lib/game/insights';
import { Button, DataSurface, PageHeader, Panel, Stat } from '../components/ui';
import FightBattle from './FightBattle';
import { CountryFlag } from '../components/CountryFlag';
import { FighterAvatar } from '../components/FighterAvatar';
import { ChampionshipBelt } from '../components/ChampionshipBelt';
import { FighterRankBadge } from '../components/FighterRankBadge';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../store/settingsStore';
import { formatCurrency, formatDate, formatFightMethod, formatNumber, formatTitleFightType, formatWeightClass } from '../lib/localization';

export default function EventSimulation() {
  const { t } = useTranslation('translation');
  const language = useSettingsStore(state => state.language);
  const { selectedEventId, events, fighters, startEventSimulation, goBack, setView, activeEventSimulation } = useGameStore();
  const event = selectedEventId ? events[selectedEventId] : null;
  const recap = event?.isCompleted ? summarizeCompletedEvent({ fighters }, event, language) : null;

  if (!event) return <div>{t($ => $.fight.event.notFound)}</div>;

  const isSimulating = activeEventSimulation?.eventId === event.id && !event.isCompleted;

  if (isSimulating) return <FightBattle />;

  if (!event.isCompleted) {
    const hasStarted = event.fights.some(f => f.result);
    return <div className="mx-auto mt-6 max-w-4xl space-y-6 pb-12">
      <PageHeader eyebrow={t($ => $.fight.event.simulation)} title={event.name} description={t($ => $.fight.event.fightCount, { count: event.fights.length, date: formatDate(event.date, language) })} />
      <Panel className="mx-auto max-w-2xl space-y-2">
        <h2 className="border-b border-[#2a2c31] pb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">{t($ => $.fight.event.fightCard)}</h2>
        {event.fights.map((fight, index) => {
          const red = fighters[fight.redCornerId];
          const blue = fighters[fight.blueCornerId];
          const label = index === 0 ? t($ => $.fight.common.mainEvent) : index === 1 ? t($ => $.fight.common.coMainEvent) : t($ => $.fight.common.bout, { number: event.fights.length - index });
          return <div key={index} className={`flex flex-col gap-3 border-l-2 p-3 sm:flex-row sm:items-center ${index === 0 ? 'border-amber-900 bg-white/[0.02]' : 'border-[#2a2c31]'}`}>
            <div className="flex min-w-28 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">{fight.isTitleFight && <ChampionshipBelt weightClass={fight.weightClass} type={fight.titleFightType === 'interim' ? 'interim' : 'undisputed'} size="marker" alt="" />}<div><p className={index < 2 ? 'text-amber-300' : ''}>{label}</p><p className="mt-1">{formatWeightClass(fight.weightClass, language)}{fight.isTitleFight && ` · ${formatTitleFightType(fight.titleFightType || 'undisputed', language)}`}</p>{fight.result && <p className="mt-1 text-emerald-300">{t($ => $.fight.common.completed)}</p>}</div></div>
            <div className="flex flex-1 items-center justify-between gap-2 text-sm text-white">
              <span className="flex w-[45%] items-center justify-end gap-1 text-right font-medium"><FighterRankBadge fighterId={red.id} /><span className="truncate">{red.firstName} {red.lastName}</span><CountryFlag nationality={red.nationality} className="text-xs" /><FighterAvatar id={red.id} name={`${red.firstName} ${red.lastName}`} nationality={red.nationality} className="h-6 w-6" /></span>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-600">vs</span>
              <span className="flex w-[45%] items-center gap-1 font-medium"><FighterAvatar id={blue.id} name={`${blue.firstName} ${blue.lastName}`} nationality={blue.nationality} className="h-6 w-6" /><CountryFlag nationality={blue.nationality} className="text-xs" /><FighterRankBadge fighterId={blue.id} /><span className="truncate">{blue.firstName} {blue.lastName}</span></span>
            </div>
          </div>;
        })}
      </Panel>
      <div className="text-center"><Button variant="primary" onClick={() => startEventSimulation(event.id)} className="px-8">{hasStarted ? t($ => $.fight.event.resume) : t($ => $.fight.event.start)}</Button><p className="mt-3 text-xs text-neutral-500">{t($ => $.fight.event.simulateOneByOne)}</p></div>
    </div>;
  }

  return <div className="mx-auto max-w-4xl space-y-6 pb-12">
    <PageHeader eyebrow={t($ => $.fight.event.completed)} title={t($ => $.fight.event.results, { name: event.name })} description={t($ => $.fight.event.simulatedDate, { date: formatDate(event.date, language) })} actions={<Button variant="secondary" onClick={() => goBack('dashboard')}>{t($ => $.common.back)}</Button>} />

    <Panel className="grid grid-cols-2 gap-5 md:grid-cols-4">
      <Stat label={t($ => $.fight.event.attendance)} value={event.results ? formatNumber(event.results.attendance, language) : undefined} />
      <Stat label={t($ => $.fight.event.totalRevenue)} value={<span className="text-emerald-300">{formatCurrency(event.results?.totalRevenue || event.results?.gateRevenue || 0, language)}</span>} />
      <Stat label={t($ => $.fight.event.totalCost)} value={<span className="text-red-300">{event.results?.totalCost === undefined ? t($ => $.fight.event.unavailable) : formatCurrency(event.results.totalCost, language)}</span>} />
      <Stat label={t($ => $.fight.event.netProfit)} value={<span className={event.results && event.results.profit >= 0 ? 'text-emerald-300' : 'text-red-300'}>{formatCurrency(event.results?.profit || 0, language)}</span>} />
    </Panel>

    {recap && <Panel className="border-blue-900/50"><h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-blue-300">{t($ => $.fight.event.recap)}</h2><div className="mt-4 grid gap-4 text-sm md:grid-cols-2"><div className="space-y-1"><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">{t($ => $.fight.event.fightOfNight)}</p>{recap.bestFight && <p className="text-white">{recap.bestFight.red.firstName} {recap.bestFight.red.lastName} vs {recap.bestFight.blue.firstName} {recap.bestFight.blue.lastName} <span title={t($ => $.fight.event.performanceRating)} className="text-blue-300">{recap.bestFight.rating}/100</span> · {formatFightMethod(recap.bestFight.method, language)}</p>}</div>{recap.rankingChanges.length > 0 && <div className="space-y-1"><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">{t($ => $.fight.event.rankingImpact)}</p>{recap.rankingChanges.slice(0, 3).map(change => <p key={change.fighter.id} title={t($ => $.fight.event.rankingMovement)}>{change.fighter.firstName} {change.fighter.lastName}: {change.oldRank} → {change.newRank}</p>)}</div>}{recap.financial && <div className="space-y-1"><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">{t($ => $.fight.event.financialResult)}</p><p title={t($ => $.fight.event.financialHelp)} className={recap.financial.profit >= 0 ? 'text-emerald-300' : 'text-red-300'}>{formatCurrency(recap.financial.profit, language)} · {t($ => $.fight.event.fans)} {Math.round(recap.financial.fanReaction)}/100</p></div>}{recap.medical.length > 0 && <div className="space-y-1"><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">{t($ => $.fight.event.medicalReport)}</p>{recap.medical.slice(0, 3).map(item => <p key={`${item.fighter.id}-${item.detail}`} className="text-amber-300">{item.fighter.firstName} {item.fighter.lastName}: {item.detail}</p>)}</div>}{recap.nextBookingLead && <div className="space-y-1"><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">{t($ => $.fight.event.nextBookingLead)}</p><p className="text-white">{t($ => $.fight.event.nextBookingText, { name: `${recap.nextBookingLead.firstName} ${recap.nextBookingLead.lastName}` })}</p></div>}</div></Panel>}

    {event.results?.titleChanges && event.results.titleChanges.length > 0 && <Panel className="border-amber-900">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-amber-300">{t($ => $.fight.event.titleSummary)}</h2>
      <div className="mt-3 space-y-2 text-sm text-white">{event.results.titleChanges.map((change, index) => {
        const fighter = change.fighterId ? fighters[change.fighterId] : null;
        const beltType = change.type === 'interim_won' || change.type === 'interim_defense' ? 'interim' : 'undisputed';
        const fighterName = fighter ? `${fighter.firstName} ${fighter.lastName}` : '';
        const localizedWeightClass = formatWeightClass(change.weightClass, language);
        const message = change.type === 'no_change' ? t($ => $.fight.event.titleUnchanged, { weightClass: localizedWeightClass })
          : !fighter ? null
          : change.type === 'title_defense' ? t($ => $.fight.event.titleDefended, { name: fighterName, weightClass: localizedWeightClass })
          : change.type === 'new_champion' ? t($ => $.fight.event.newChampion, { name: fighterName, weightClass: localizedWeightClass })
          : change.type === 'vacant_title_won' ? t($ => $.fight.event.vacantWon, { name: fighterName, weightClass: localizedWeightClass })
          : change.type === 'interim_won' ? t($ => $.fight.event.interimWon, { name: fighterName, weightClass: localizedWeightClass })
          : change.type === 'interim_defense' ? t($ => $.fight.event.interimDefended, { name: fighterName, weightClass: localizedWeightClass })
          : change.type === 'unified' ? t($ => $.fight.event.unified, { name: fighterName, weightClass: localizedWeightClass })
          : null;
        return message && <div key={index} className="flex items-center gap-2"><ChampionshipBelt weightClass={change.weightClass} type={beltType} size="marker" alt="" /><p>{message}</p></div>;
      })}</div>
    </Panel>}

    {event.results?.totalRevenue && <Panel>
      <h2 className="border-b border-[#2a2c31] pb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">{t($ => $.fight.event.pnl)}</h2>
      <div className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
        <Stat label={t($ => $.fight.event.gateRevenue)} value={<span className="font-mono text-emerald-300">+{formatCurrency(event.results.gateRevenue, language)}</span>} />
        <Stat label={t($ => $.fight.event.tvSponsor)} value={<span className="font-mono text-emerald-300">+{formatCurrency(event.results.broadcastRevenue, language)}</span>} />
        <Stat label={t($ => $.fight.event.venueCost)} value={<span className="font-mono text-red-300">-{formatCurrency(event.results.venueCost, language)}</span>} />
        <Stat label={t($ => $.fight.event.marketing)} value={<span className="font-mono text-red-300">-{formatCurrency(event.results.marketingCost, language)}</span>} />
        <Stat label={t($ => $.fight.event.fighterBasePay)} value={<span className="font-mono text-red-300">-{formatCurrency(event.results.fighterBasePay, language)}</span>} />
        <Stat label={t($ => $.fight.event.winBonuses)} value={<span className="font-mono text-red-300">-{formatCurrency(event.results.fighterWinBonuses, language)}</span>} />
        <Stat label={t($ => $.fight.event.fanReaction)} value={`${Math.round(event.results.fanReaction)}/100`} />
        <Stat label={t($ => $.fight.event.netProfit)} value={<span className={`font-mono ${event.results.profit >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{formatCurrency(event.results.profit, language)}</span>} />
      </div>
    </Panel>}

    <section className="space-y-4"><h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">{t($ => $.fight.event.fightResults)}</h2>
      {event.fights.map((fight, index) => {
        const red = fighters[fight.redCornerId];
        const blue = fighters[fight.blueCornerId];
        const result = fight.result;
        if (!result) return null;
        const isDraw = result.method === 'Draw';
        const winnerId = result.winnerId;
        const fightArchiveId = `archive_${event.id}_${fight.redCornerId}_${fight.blueCornerId}`;
        return <DataSurface key={index}>
          <button type="button" aria-label={t($ => $.fight.event.viewDetailsLabel, { red: `${red.firstName} ${red.lastName}`, blue: `${blue.firstName} ${blue.lastName}` })} onClick={() => setView('fight-detail', { fightArchiveId })} className="flex w-full flex-col items-center gap-3 bg-black/10 p-4 text-center transition-colors hover:bg-white/[0.02] sm:flex-row">
            <span className={`flex-1 truncate text-lg font-medium ${winnerId === red.id ? 'text-emerald-300' : isDraw ? 'text-amber-300' : 'text-neutral-500'}`}><FighterRankBadge fighterId={red.id} /> {red.firstName} {red.lastName} {winnerId === red.id && '👑'}</span>
            <span className="flex w-40 items-center justify-center gap-1">{fight.isTitleFight && <ChampionshipBelt weightClass={fight.weightClass} type={fight.titleFightType === 'interim' ? 'interim' : 'undisputed'} size="marker" alt="" />}<span><span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">{formatWeightClass(fight.weightClass, language)} {fight.isTitleFight && `· ${t($ => $.fight.common.title)}`}</span><span className="mt-1 inline-block text-sm text-white">{formatFightMethod(result.method, language)}</span><span className="mt-1 block text-xs text-neutral-500">R{result.round} · {result.time}</span><span className="mt-2 block font-mono text-[10px] uppercase tracking-[0.12em] text-blue-300">{t($ => $.fight.event.viewDetails)}</span></span></span>
            <span className={`flex-1 truncate text-lg font-medium ${winnerId === blue.id ? 'text-emerald-300' : isDraw ? 'text-amber-300' : 'text-neutral-500'}`}><FighterRankBadge fighterId={blue.id} /> {winnerId === blue.id && '👑'} {blue.firstName} {blue.lastName}</span>
          </button>
        </DataSurface>;
      })}
    </section>
  </div>;
}
