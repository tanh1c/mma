import React, { useMemo, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { differenceInDays } from 'date-fns';
import { Trophy, TrendingUp, Users, DollarSign, Calendar, FastForward, Settings, Play } from 'lucide-react';
import { calculateEventProjections } from '../lib/game/economy';
import { getPromotionInbox } from '../lib/game/inbox';
import { Button, Panel, PageHeader, Stat, StatusBadge } from '../components/ui';
import { ChampionshipBelt } from '../components/ChampionshipBelt';
import { FighterRankBadge } from '../components/FighterRankBadge';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../store/settingsStore';
import { formatCurrency, formatDate, formatNumber, formatWeightClass } from '../lib/localization';

export default function Dashboard() {
  const { t } = useTranslation('translation');
  const language = useSettingsStore(state => state.language);
  const gameState = useGameStore();
  const { promotion, currentDate, events, fighters, tournaments = {}, venues, news, storylines, titles, belts, setView, mode, autopilot, setMode, setAutopilot, advanceAutopilot, lastAutopilotSummary, sponsorDeals = [], mediaDeals = [], financeLedger = [], signSponsorDeal, signMediaDeal, renewDeal } = gameState;

  const [isAdvancing, setIsAdvancing] = useState(false);
  const [ledgerFilter, setLedgerFilter] = useState<'All' | 'Event' | 'Deals' | 'Costs' | 'Income'>('All');
  const [isFinanceOpen, setIsFinanceOpen] = useState(true);
  const [isNewsOpen, setIsNewsOpen] = useState(true);

  const activeSponsorIncome = sponsorDeals.filter(d => d.isActive).reduce((sum, d) => sum + d.monthlyIncome, 0);
  const activeMediaIncome = mediaDeals.filter(d => d.isActive).reduce((sum, d) => sum + d.monthlyIncome, 0);
  const totalMonthlyIncome = activeSponsorIncome + activeMediaIncome;

  const filteredLedger = useMemo(() => {
     return financeLedger.filter(entry => {
        if (ledgerFilter === 'Event') return entry.type.startsWith('event') || entry.type === 'contract_payment' || entry.type === 'marketing_cost' || entry.type === 'venue_cost';
        if (ledgerFilter === 'Deals') return entry.type.includes('monthly');
        if (ledgerFilter === 'Costs') return entry.amount < 0;
        if (ledgerFilter === 'Income') return entry.amount > 0;
        return true;
     });
  }, [financeLedger, ledgerFilter]);

  const handleAutoAdvance = async (days: number, simulateEvents: boolean = false) => {
    setIsAdvancing(true);
    // Use setTimeout to allow UI to render the loading state
    setTimeout(() => {
      advanceAutopilot(days, simulateEvents);
      setIsAdvancing(false);
    }, 50);
  };

  const activeEvents = Object.values(events).filter(e => !e.isCompleted);
  const nextEvent = activeEvents.length > 0 ? activeEvents[0] : null;

  const rosterCount = Object.values(fighters).filter(f => f.contract !== null).length;
  
  const champions = Object.values(fighters).filter(f => f.isChampion);

  const nextEventProjections = useMemo(() => {
    if (!nextEvent) return null;
    return calculateEventProjections(
      nextEvent.fights,
      fighters,
      venues[nextEvent.venueId],
      nextEvent.ticketPrice,
      nextEvent.marketingSpend,
      promotion,
      storylines,
      titles,
      tournaments
    );
  }, [nextEvent, fighters, venues, promotion, storylines, titles, tournaments]);

  const inboxPreview = useMemo(() => getPromotionInbox(gameState, language).slice(0, 5), [gameState, language]);
  const inboxTones = { critical: 'danger', urgent: 'warning', opportunity: 'success' } as const;
  const inboxSeverityLabels = {
    critical: t($ => $.inbox.severity.critical),
    urgent: t($ => $.inbox.severity.urgent),
    opportunity: t($ => $.inbox.severity.opportunity)
  };
  const ledgerFilters = [
    { value: 'All', label: t($ => $.dashboard.finance.filters.all) },
    { value: 'Event', label: t($ => $.dashboard.finance.filters.event) },
    { value: 'Deals', label: t($ => $.dashboard.finance.filters.deals) },
    { value: 'Costs', label: t($ => $.dashboard.finance.filters.costs) },
    { value: 'Income', label: t($ => $.dashboard.finance.filters.income) }
  ] as const;
  const newsTypeLabels = {
    injury: t($ => $.dashboard.news.types.injury),
    contract: t($ => $.dashboard.news.types.contract),
    event: t($ => $.dashboard.news.types.event),
    fight: t($ => $.dashboard.news.types.fight),
    general: t($ => $.dashboard.news.types.general)
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={formatDate(currentDate, language)}
        title={promotion.name || t($ => $.dashboard.fallbackPromotion)}
        actions={<div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto"><Button variant={mode === 'manager' ? 'primary' : 'quiet'} onClick={() => { setMode('manager'); setAutopilot({ enabled: false }); }} className="min-h-9 px-3 text-xs">{t($ => $.dashboard.managerMode)}</Button><Button variant={mode === 'observer' ? 'primary' : 'quiet'} onClick={() => { setMode('observer'); setAutopilot({ enabled: true }); }} className="min-h-9 px-3 text-xs">{t($ => $.dashboard.observerMode)}</Button></div>}
      />

      <Panel className="grid grid-cols-2 gap-5 sm:grid-cols-4">
        <Stat label={t($ => $.dashboard.stats.funds)} value={formatCurrency(promotion.money, language)} />
        <Stat label={t($ => $.dashboard.stats.reputation)} value={`${promotion.reputation}/100`} />
        <Stat label={t($ => $.dashboard.stats.fanbase)} value={formatNumber(promotion.fanbase, language)} />
        <Stat label={t($ => $.dashboard.stats.rosterSize)} value={rosterCount} />
      </Panel>

      {mode === 'observer' && (
        <Panel className="border-[#2a2c31]">
          <h2 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-300">
            <Settings size={16} /> {t($ => $.dashboard.observer.title)}
          </h2>
          <p className="mt-3 text-sm text-neutral-400">
            {t($ => $.dashboard.observer.description)}
          </p>
          <div className="mt-6">
            
            <div className="flex flex-wrap gap-3 sm:gap-4 items-center">
              <Button
                variant="secondary"
                onClick={() => handleAutoAdvance(7, autopilot.watchEvents)}
                disabled={isAdvancing}
                className="inline-flex min-h-9 items-center gap-2 px-3 text-xs"
              >
                <FastForward size={16} /> {t($ => $.dashboard.observer.week)}
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleAutoAdvance(28, autopilot.watchEvents)}
                disabled={isAdvancing}
                className="inline-flex min-h-9 items-center gap-2 px-3 text-xs"
              >
                <FastForward size={16} /> {t($ => $.dashboard.observer.month)}
              </Button>
              <Button
                variant="primary"
                onClick={() => handleAutoAdvance(180, autopilot.watchEvents)}
                disabled={isAdvancing}
                className="inline-flex min-h-9 items-center gap-2 px-3 text-xs"
              >
                <FastForward size={16} /> {t($ => $.dashboard.observer.sixMonths)}
              </Button>
              
              <div className="sm:ml-auto flex items-center gap-3 bg-neutral-950 px-4 py-2 rounded border border-purple-900/50">
                <span className="text-sm font-bold text-neutral-300">{t($ => $.dashboard.observer.watchLive)}:</span>
                <button 
                  onClick={() => setAutopilot({ watchEvents: !autopilot.watchEvents })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${autopilot.watchEvents ? 'bg-green-500' : 'bg-neutral-700'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${autopilot.watchEvents ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </div>
            {isAdvancing && (
              <div className="mt-4 text-purple-300 text-sm font-bold animate-pulse flex items-center gap-2">
                <Settings className="animate-spin" size={16} /> {t($ => $.dashboard.observer.simulating)}
              </div>
            )}
            {!isAdvancing && lastAutopilotSummary && (
              <div className="mt-6 bg-purple-950/50 border border-purple-500/20 rounded p-4 text-sm text-purple-200">
                <h3 className="font-bold mb-2 uppercase tracking-wider text-purple-400">{t($ => $.dashboard.observer.summary, { days: lastAutopilotSummary.daysSimulated, start: formatDate(lastAutopilotSummary.calendarStartDate, language), end: formatDate(lastAutopilotSummary.calendarEndDate, language) })}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <span className="block text-purple-400/70 text-xs uppercase">{t($ => $.dashboard.observer.eventsBooked)}</span>
                    <span className="font-bold">{lastAutopilotSummary.eventsCreated}</span>
                  </div>
                  <div>
                    <span className="block text-purple-400/70 text-xs uppercase">{t($ => $.dashboard.observer.eventsRan)}</span>
                    <span className="font-bold">{lastAutopilotSummary.eventsCompleted}</span>
                  </div>
                  <div>
                    <span className="block text-purple-400/70 text-xs uppercase">{t($ => $.dashboard.observer.fightsSimmed)}</span>
                    <span className="font-bold">{lastAutopilotSummary.fightsSimulated}</span>
                  </div>
                  <div>
                    <span className="block text-purple-400/70 text-xs uppercase">{t($ => $.dashboard.observer.newChamps)}</span>
                    <span className="font-bold">{lastAutopilotSummary.newChampions}</span>
                  </div>
                  <div>
                    <span className="block text-purple-400/70 text-xs uppercase">{t($ => $.dashboard.observer.moneyChange)}</span>
                    <span className={`font-bold ${lastAutopilotSummary.moneyChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {lastAutopilotSummary.moneyChange > 0 ? '+' : ''}{formatCurrency(lastAutopilotSummary.moneyChange, language)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-purple-400/70 text-xs uppercase">{t($ => $.dashboard.observer.reputationChange)}</span>
                    <span className={`font-bold ${lastAutopilotSummary.reputationChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {lastAutopilotSummary.reputationChange > 0 ? '+' : ''}{lastAutopilotSummary.reputationChange}
                    </span>
                  </div>
                  {lastAutopilotSummary.bookingDelays > 0 && (
                    <div>
                      <span className="block text-yellow-500/70 text-xs uppercase">{t($ => $.dashboard.observer.bookingDelays)}</span>
                      <span className="font-bold text-yellow-500">{lastAutopilotSummary.bookingDelays}</span>
                    </div>
                  )}
                  {lastAutopilotSummary.emergencyModeTriggered > 0 && (
                    <div>
                      <span className="block text-red-500/70 text-xs uppercase">{t($ => $.dashboard.observer.emergencies)}</span>
                      <span className="font-bold text-red-500">{lastAutopilotSummary.emergencyModeTriggered} ({t($ => $.dashboard.observer.cashInjected, { count: lastAutopilotSummary.ownerCashInjections * 100 })})</span>
                    </div>
                  )}
                </div>
                {lastAutopilotSummary.highlights && (
                  <div className="mt-4 pt-4 border-t border-purple-900/50">
                    <h4 className="text-purple-300 font-bold mb-2 uppercase tracking-wide text-sm">{t($ => $.dashboard.observer.highlights)}</h4>
                    <ul className="text-sm text-purple-200/80 list-disc pl-5 space-y-1">
                      {lastAutopilotSummary.highlights.newUndisputedChampions > 0 && <li>{t($ => $.dashboard.observer.undisputedCrowned, { count: lastAutopilotSummary.highlights.newUndisputedChampions })}</li>}
                      {lastAutopilotSummary.highlights.newInterimChampions > 0 && <li>{t($ => $.dashboard.observer.interimWon, { count: lastAutopilotSummary.highlights.newInterimChampions })}</li>}
                      {lastAutopilotSummary.highlights.unifications > 0 && <li>{t($ => $.dashboard.observer.unifications, { count: lastAutopilotSummary.highlights.unifications })}</li>}
                      {lastAutopilotSummary.highlights.majorInjuries > 0 && <li>{t($ => $.dashboard.observer.injuries, { count: lastAutopilotSummary.highlights.majorInjuries })}</li>}
                      {lastAutopilotSummary.highlights.biggestProfit > 0 && <li>{t($ => $.dashboard.observer.biggestProfit, { amount: formatCurrency(lastAutopilotSummary.highlights.biggestProfit, language) })}</li>}
                      {lastAutopilotSummary.highlights.awardsGenerated && <li><span className="text-yellow-400 font-bold">{t($ => $.dashboard.observer.awards)}</span> ({t($ => $.dashboard.observer.checkHistory)})</li>}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {inboxPreview.length > 0 && (
            <Panel className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-white">{t($ => $.dashboard.actions.title)}</h2>
                <Button variant="quiet" onClick={() => setView('inbox')} className="min-h-9 text-xs">{t($ => $.dashboard.actions.viewAll)}</Button>
              </div>
              {inboxPreview.map(item => <article key={item.id} className="flex flex-col gap-3 rounded border border-[#2a2c31] bg-neutral-950 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <StatusBadge tone={inboxTones[item.severity]}>{inboxSeverityLabels[item.severity]}</StatusBadge>
                  <h3 className="mt-2 text-sm font-semibold text-white">{item.title}</h3>
                  <p className="mt-1 text-sm text-neutral-400">{item.description}</p>
                </div>
                <Button variant="secondary" onClick={() => setView(item.targetView, { fighterId: item.fighterId, eventId: item.eventId, calendarSlotId: item.calendarSlotId })} className="min-h-9 shrink-0 px-3 text-xs">{t($ => $.inbox.review)}</Button>
              </article>)}
            </Panel>
          )}

          {/* Next Event */}
          <div className="bg-[#101114] border border-[#2a2c31] rounded-lg p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Calendar size={20} /> {t($ => $.dashboard.nextEvent.title)}
            </h2>
            {nextEvent ? (
              <div className="bg-neutral-950 p-4 rounded-md border border-neutral-800">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-start sm:justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">{nextEvent.name}</h3>
                    <p className="text-sm text-neutral-400">{formatDate(nextEvent.date, language)}</p>
                  </div>
                  <button 
                    onClick={() => setView('simulation', { eventId: nextEvent.id })}
                    className="bg-white text-black px-4 py-2 rounded font-bold text-sm hover:bg-neutral-200"
                  >
                    {t($ => $.dashboard.nextEvent.simulate)}
                  </button>
                </div>
                
                {nextEventProjections && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                    <div className="bg-neutral-900 p-2 rounded border border-neutral-800">
                      <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mb-0.5">{t($ => $.dashboard.nextEvent.attendance)}</p>
                      <p className="text-sm font-bold text-white">{formatNumber(nextEventProjections.expectedAttendance, language)}</p>
                    </div>
                    <div className="bg-neutral-900 p-2 rounded border border-neutral-800">
                      <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mb-0.5">{t($ => $.dashboard.nextEvent.revenue)}</p>
                      <p className="text-sm font-bold text-green-400">{formatCurrency(nextEventProjections.expectedGate + nextEventProjections.broadcastRevenue, language)}</p>
                    </div>
                    <div className="bg-neutral-900 p-2 rounded border border-neutral-800">
                      <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mb-0.5">{t($ => $.dashboard.nextEvent.cost)}</p>
                      <p className="text-sm font-bold text-red-400">{formatCurrency(nextEventProjections.estimatedCost, language)}</p>
                    </div>
                    <div className="bg-neutral-900 p-2 rounded border border-neutral-800">
                      <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mb-0.5">{t($ => $.dashboard.nextEvent.profit)}</p>
                      <p className={`text-sm font-bold ${nextEventProjections.expectedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(nextEventProjections.expectedProfit, language)}
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {nextEvent.fights.map((fight, idx) => {
                    const red = fighters[fight.redCornerId];
                    const blue = fighters[fight.blueCornerId];
                    return (
                      <div key={idx} className="flex flex-wrap justify-between items-center gap-2 text-sm p-2 bg-neutral-900 rounded">
                        <span className="flex items-center gap-1 font-medium">{red && <FighterRankBadge fighterId={red.id} />}{red?.lastName}</span>
                        <span className="text-neutral-500 text-xs">{t($ => $.dashboard.nextEvent.versus)}</span>
                        <span className="flex items-center gap-1 font-medium">{blue && <FighterRankBadge fighterId={blue.id} />}{blue?.lastName}</span>
                        <span className="text-neutral-500 text-xs ml-4">{formatWeightClass(fight.weightClass, language)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center p-8 border border-dashed border-neutral-700 rounded-md">
                <p className="text-neutral-400 mb-4">{t($ => $.dashboard.nextEvent.empty)}</p>
                <button 
                  onClick={() => setView('event-builder')}
                  className="bg-neutral-800 text-white px-4 py-2 rounded text-sm hover:bg-neutral-700"
                >
                  {t($ => $.dashboard.nextEvent.book)}
                </button>
              </div>
            )}
          </div>

          {/* Past Events */}
          <div className="bg-[#101114] border border-[#2a2c31] rounded-lg p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Calendar size={20} className="text-neutral-500" /> {t($ => $.dashboard.pastEvents.title)}
            </h2>
            <div className="space-y-3">
              {Object.values(events)
                .filter(e => e.isCompleted)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 3)
                .map(event => (
                  <div key={event.id} className="bg-neutral-950 p-3 rounded-md border border-neutral-800 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-bold text-white">{event.name}</h3>
                      <p className="text-xs text-neutral-500">{formatDate(event.date, language)} • {t($ => $.dashboard.pastEvents.fights, { count: event.fights.length })}</p>
                      {event.results && (
                         <p className={`text-xs font-bold mt-1 ${event.results.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                           {event.results.profit >= 0 ? '+' : '-'}{formatCurrency(Math.abs(event.results.profit), language)}
                         </p>
                      )}
                    </div>
                    <button 
                      onClick={() => setView('simulation', { eventId: event.id })}
                      className="text-xs bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-1.5 rounded transition-colors"
                    >
                      {t($ => $.dashboard.pastEvents.viewResults)}
                    </button>
                  </div>
                ))}
              {Object.values(events).filter(e => e.isCompleted).length === 0 && (
                <p className="text-sm text-neutral-500 italic">{t($ => $.dashboard.pastEvents.empty)}</p>
              )}
            </div>
          </div>

          {/* Champions */}
          <div className="bg-[#101114] border border-[#2a2c31] rounded-lg p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Trophy size={20} className="text-yellow-500" /> {t($ => $.dashboard.champions.title)}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {champions.map(champ => {
                const beltId = `belt_${champ.weightClass.toLowerCase()}`;
                const belt = belts[beltId];
                const isInterim = titles[champ.weightClass]?.interimChampionId === champ.id;
                
                return (
                  <button
                    type="button"
                    key={champ.id}
                    onClick={() => setView('fighter-detail', { fighterId: champ.id })}
                    className="flex min-w-0 items-center gap-2 rounded-md border border-neutral-800 bg-neutral-950 p-3 text-left transition-colors hover:border-neutral-600"
                  >
                    <ChampionshipBelt weightClass={champ.weightClass} type={isInterim ? 'interim' : 'undisputed'} size="card" alt="" />
                    <span className="min-w-0 flex-1">
                      <span className={`mb-1 block text-xs ${isInterim ? 'text-neutral-400' : 'text-yellow-500'} uppercase font-bold`}>
                        {isInterim ? `${t($ => $.dashboard.champions.interim)} ` : ''}{belt ? belt.shortName : formatWeightClass(champ.weightClass, language)}
                      </span>
                      <span className="block truncate font-bold text-white">{champ.firstName} {champ.lastName}</span>
                      <span className="block text-xs text-neutral-400">{champ.record.wins}-{champ.record.losses}-{champ.record.draws}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {/* Finance & Deals MVP */}
          <div className="bg-[#101114] border border-[#2a2c31] rounded-lg p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
               <button
                 type="button"
                 onClick={() => setIsFinanceOpen(open => !open)}
                 aria-expanded={isFinanceOpen}
                 className="flex items-center gap-2 text-left text-lg font-bold text-white hover:text-neutral-300"
               >
                 <span className="text-green-500">$</span> {t($ => $.dashboard.finance.title)}
                 <span className="text-[10px] uppercase tracking-wider text-neutral-500">{isFinanceOpen ? t($ => $.dashboard.finance.collapse) : t($ => $.dashboard.finance.expand)}</span>
               </button>
               <div className="flex flex-wrap gap-3 sm:gap-4">
                  <div className="bg-neutral-950 px-3 py-1.5 rounded border border-neutral-800 text-center">
                     <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mb-0.5">{t($ => $.dashboard.finance.sponsorIncome)}</p>
                     <p className="text-sm font-mono text-green-400">{t($ => $.dashboard.finance.perMonth, { amount: `+${formatCurrency(activeSponsorIncome, language)}` })}</p>
                  </div>
                  <div className="bg-neutral-950 px-3 py-1.5 rounded border border-neutral-800 text-center">
                     <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mb-0.5">{t($ => $.dashboard.finance.mediaIncome)}</p>
                     <p className="text-sm font-mono text-green-400">{t($ => $.dashboard.finance.perMonth, { amount: `+${formatCurrency(activeMediaIncome, language)}` })}</p>
                  </div>
               </div>
            </div>
            
            {isFinanceOpen && <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-bold text-neutral-400 mb-2 uppercase tracking-wider">{t($ => $.dashboard.finance.sponsors)}</h3>
                {sponsorDeals.length > 0 ? sponsorDeals.map(deal => {
                   const daysLeft = differenceInDays(new Date(deal.expiresDate), new Date(currentDate));
                   const isExpiringSoon = deal.isActive && daysLeft <= 60;
                   return (
                  <div key={deal.id} className={`p-3 rounded border mb-2 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between ${deal.isActive ? 'bg-neutral-950 border-neutral-800' : 'bg-red-950/20 border-red-900/50'}`}>
                    <div>
                      <p className="font-bold text-white text-sm">
                         {deal.name} 
                         <span className="text-xs text-neutral-500 font-normal ml-1">({deal.tier})</span>
                         {!deal.isActive && <span className="ml-2 text-[10px] bg-red-900/50 text-red-300 px-1.5 py-0.5 rounded font-bold uppercase">{t($ => $.dashboard.finance.expired)}</span>}
                      </p>
                      <p className={`text-xs font-bold ${deal.isActive ? 'text-green-400' : 'text-neutral-500'}`}>{t($ => $.dashboard.finance.perMonth, { amount: `+${formatCurrency(deal.monthlyIncome, language)}` })}</p>
                      {deal.bonusPerEvent && <p className="text-xs text-neutral-400">{t($ => $.dashboard.finance.eventBonus, { amount: formatCurrency(deal.bonusPerEvent, language) })}</p>}
                      {deal.isActive && (
                         <p className={`text-[10px] font-bold mt-1 ${isExpiringSoon ? 'text-orange-400' : 'text-neutral-500'}`}>
                            {t($ => $.dashboard.finance.expires, { count: daysLeft, date: formatDate(deal.expiresDate, language) })}
                         </p>
                      )}
                    </div>
                    {mode === 'manager' && (
                       <button onClick={() => renewDeal(deal.id, 'sponsor')} className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-xs rounded text-white font-bold transition-colors">
                          {t($ => $.dashboard.finance.renew)}
                       </button>
                    )}
                  </div>
                )}) : <p className="text-sm text-neutral-500 italic">{t($ => $.dashboard.finance.noSponsors)}</p>}

                {mode === 'manager' && (
                   <div className="mt-4 space-y-2 border-t border-neutral-800 pt-4">
                      <p className="text-xs text-neutral-400 font-bold uppercase">{t($ => $.dashboard.finance.availableSponsors)}</p>
                      {[
                         { name: 'Combat Athletics Co.', req: 0 },
                         { name: 'IronClad Nutrition', req: 35 },
                         { name: 'Apex Fight Gear', req: 65 }
                      ].map(tmpl => {
                         const hasDeal = sponsorDeals.some(d => d.name === tmpl.name && d.isActive);
                         const isLocked = promotion.reputation < tmpl.req;
                         if (hasDeal) return null;
                         return (
                            <div key={tmpl.name} className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between p-2 bg-[#101114] border border-[#2a2c31] rounded">
                               <div>
                                  <p className="text-sm text-white font-bold">{tmpl.name}</p>
                                  <p className="text-xs text-neutral-500">{t($ => $.dashboard.finance.requiredReputation, { value: tmpl.req })}</p>
                               </div>
                               <button 
                                  onClick={() => signSponsorDeal(tmpl.name)} 
                                  disabled={isLocked}
                                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:bg-neutral-800 text-xs rounded text-white font-bold transition-colors"
                               >
                                  {isLocked ? t($ => $.dashboard.finance.locked) : t($ => $.dashboard.finance.signDeal)}
                               </button>
                            </div>
                         );
                      })}
                   </div>
                )}
              </div>
              
              <div>
                <h3 className="text-sm font-bold text-neutral-400 mb-2 uppercase tracking-wider">{t($ => $.dashboard.finance.mediaDeal)}</h3>
                {mediaDeals.length > 0 ? mediaDeals.map(deal => {
                   const daysLeft = differenceInDays(new Date(deal.expiresDate), new Date(currentDate));
                   const isExpiringSoon = deal.isActive && daysLeft <= 60;
                   return (
                  <div key={deal.id} className={`p-3 rounded border mb-2 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between ${deal.isActive ? 'bg-neutral-950 border-neutral-800' : 'bg-red-950/20 border-red-900/50'}`}>
                    <div>
                      <p className="font-bold text-white text-sm">
                         {deal.name} 
                         <span className="text-xs text-neutral-500 font-normal ml-1">({deal.tier})</span>
                         {!deal.isActive && <span className="ml-2 text-[10px] bg-red-900/50 text-red-300 px-1.5 py-0.5 rounded font-bold uppercase">{t($ => $.dashboard.finance.expired)}</span>}
                      </p>
                      <p className={`text-xs font-bold ${deal.isActive ? 'text-green-400' : 'text-neutral-500'}`}>{t($ => $.dashboard.finance.perMonth, { amount: `+${formatCurrency(deal.monthlyIncome, language)}` })}</p>
                      {deal.bonusPerEvent && <p className="text-xs text-neutral-400">{t($ => $.dashboard.finance.eventBonus, { amount: formatCurrency(deal.bonusPerEvent, language) })}</p>}
                      {deal.isActive && (
                         <p className={`text-[10px] font-bold mt-1 ${isExpiringSoon ? 'text-orange-400' : 'text-neutral-500'}`}>
                            {t($ => $.dashboard.finance.expires, { count: daysLeft, date: formatDate(deal.expiresDate, language) })}
                         </p>
                      )}
                    </div>
                    {mode === 'manager' && (
                       <button onClick={() => renewDeal(deal.id, 'media')} className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-xs rounded text-white font-bold transition-colors">
                          {t($ => $.dashboard.finance.renew)}
                       </button>
                    )}
                  </div>
                )}) : <p className="text-sm text-neutral-500 italic">{t($ => $.dashboard.finance.noMedia)}</p>}

                {mode === 'manager' && (
                   <div className="mt-4 space-y-2 border-t border-neutral-800 pt-4">
                      <p className="text-xs text-neutral-400 font-bold uppercase">{t($ => $.dashboard.finance.availableMedia)}</p>
                      {[
                         { name: 'FightNet Local', req: 0 },
                         { name: 'CageCast Regional', req: 35 },
                         { name: 'Prime Combat Network', req: 65 }
                      ].map(tmpl => {
                         const hasDeal = mediaDeals.some(d => d.name === tmpl.name && d.isActive);
                         const isLocked = promotion.reputation < tmpl.req;
                         if (hasDeal) return null;
                         return (
                            <div key={tmpl.name} className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between p-2 bg-[#101114] border border-[#2a2c31] rounded">
                               <div>
                                  <p className="text-sm text-white font-bold">{tmpl.name}</p>
                                  <p className="text-xs text-neutral-500">{t($ => $.dashboard.finance.requiredReputation, { value: tmpl.req })}</p>
                               </div>
                               <button 
                                  onClick={() => signMediaDeal(tmpl.name)} 
                                  disabled={isLocked}
                                  className="px-3 py-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:bg-neutral-800 text-xs rounded text-white font-bold transition-colors"
                               >
                                  {isLocked ? t($ => $.dashboard.finance.locked) : t($ => $.dashboard.finance.signDeal)}
                               </button>
                            </div>
                         );
                      })}
                   </div>
                )}
              </div>
            </div>
            
            <div className="mt-6 border-t border-neutral-800 pt-4">
               <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-3">
                 <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">{t($ => $.dashboard.finance.ledger)}</h3>
                 <div className="flex flex-wrap gap-2">
                    {ledgerFilters.map(filter => (
                       <button
                         key={filter.value}
                         onClick={() => setLedgerFilter(filter.value)}
                         className={`text-[10px] px-2 py-1 rounded font-bold uppercase transition-colors ${ledgerFilter === filter.value ? 'bg-neutral-700 text-white' : 'bg-neutral-900 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300'}`}
                       >
                          {filter.label}
                       </button>
                    ))}
                 </div>
               </div>
               <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                 {filteredLedger.length > 0 ? filteredLedger.slice(0, 50).map(entry => (
                   <div key={entry.id} className={`flex gap-3 justify-between items-start text-sm py-1.5 border-b border-neutral-800/50 ${entry.isSummary ? 'bg-neutral-950 px-2 py-2 rounded border border-blue-900/30 my-1' : ''}`}>
                     <div>
                       <p className={`text-neutral-300 ${entry.isSummary ? 'text-blue-400 font-semibold' : ''}`}>
                         {entry.isSummary ? '📊 ' : ''}{entry.description}
                       </p>
                       <p className="text-xs text-neutral-500 font-mono">{formatDate(entry.date, language)}</p>
                     </div>
                     <span className={`shrink-0 font-mono font-bold ${entry.isSummary ? 'text-blue-400' : (entry.amount >= 0 ? 'text-green-400' : 'text-red-400')}`}>
                       {entry.amount > 0 ? '+' : ''}{formatCurrency(entry.amount, language)}
                     </span>
                   </div>
                 )) : (
                    <p className="text-sm text-neutral-500 italic py-4 text-center">{t($ => $.dashboard.finance.noLedger)}</p>
                 )}
               </div>
            </div>
            </>}
          </div>
        </div>

        {/* News Feed */}
        <div className={`bg-[#101114] border border-[#2a2c31] rounded-lg p-4 sm:p-6 flex flex-col ${isNewsOpen ? 'h-auto lg:h-[600px] max-h-[70svh] lg:max-h-none' : ''}`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-white">{t($ => $.dashboard.news.title)}</h2>
            <button
              type="button"
              onClick={() => setIsNewsOpen(open => !open)}
              aria-expanded={isNewsOpen}
              className="text-xs font-bold uppercase text-neutral-400 hover:text-white"
            >
              {isNewsOpen ? t($ => $.dashboard.finance.collapse) : t($ => $.dashboard.finance.expand)}
            </button>
          </div>
          {isNewsOpen && <>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {news.slice(0, 10).map(item => {
              const borderColor = 
                item.type === 'injury' ? 'border-red-500' :
                item.type === 'contract' ? 'border-yellow-500' :
                item.type === 'event' ? 'border-green-500' :
                item.type === 'fight' ? 'border-blue-500' :
                'border-neutral-500';
              
              return (
                <div key={item.id} className={`border-l-2 ${borderColor} pl-4 py-1`}>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-neutral-500 font-mono">{formatDate(item.date, language)}</span>
                    <span className="text-[10px] text-neutral-500 uppercase tracking-wider">{newsTypeLabels[item.type]}</span>
                  </div>
                  <p className="text-sm font-medium text-neutral-200 mt-1">{item.title}</p>
                  <p className="text-xs text-neutral-400 mt-1 line-clamp-2">{item.content}</p>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => setView('news')}
            className="w-full mt-4 bg-neutral-950 border border-neutral-800 text-neutral-300 py-2 rounded text-sm font-bold hover:bg-neutral-800 transition-colors"
          >
            {t($ => $.dashboard.news.viewAll)}
          </button>
          </>}
        </div>
      </div>
    </div>
  );
}
