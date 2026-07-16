import React, { useMemo, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { format, differenceInDays } from 'date-fns';
import { Trophy, TrendingUp, Users, DollarSign, Calendar, FastForward, Settings, Play } from 'lucide-react';
import { calculateEventProjections } from '../lib/game/economy';
import { getPromotionInbox } from '../lib/game/inbox';
import { Button, Panel, PageHeader, Stat, StatusBadge } from '../components/ui';
import { ChampionshipBelt } from '../components/ChampionshipBelt';
import { FighterRankBadge } from '../components/FighterRankBadge';

export default function Dashboard() {
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

  const inboxPreview = useMemo(() => getPromotionInbox(gameState).slice(0, 5), [gameState]);
  const inboxTones = { critical: 'danger', urgent: 'warning', opportunity: 'success' } as const;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={format(new Date(currentDate), 'MMM d, yyyy')}
        title={promotion.name || 'Your Promotion'}
        actions={<div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto"><Button variant={mode === 'manager' ? 'primary' : 'quiet'} onClick={() => { setMode('manager'); setAutopilot({ enabled: false }); }} className="min-h-9 px-3 text-xs">Manager mode</Button><Button variant={mode === 'observer' ? 'primary' : 'quiet'} onClick={() => { setMode('observer'); setAutopilot({ enabled: true }); }} className="min-h-9 px-3 text-xs">Observer mode</Button></div>}
      />

      <Panel className="grid grid-cols-2 gap-5 sm:grid-cols-4">
        <Stat label="Funds" value={`$${promotion.money.toLocaleString()}`} />
        <Stat label="Reputation" value={`${promotion.reputation}/100`} />
        <Stat label="Fanbase" value={promotion.fanbase.toLocaleString()} />
        <Stat label="Roster size" value={rosterCount} />
      </Panel>

      {mode === 'observer' && (
        <Panel className="border-[#2a2c31]">
          <h2 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-300">
            <Settings size={16} /> Autopilot / Observer Mode
          </h2>
          <p className="mt-3 text-sm text-neutral-400">
            The AI will automatically book events, sign free agents, renew contracts, and release fighters.
            Sit back and watch the MMA world evolve, or take control anytime.
          </p>
          <div className="mt-6">
            
            <div className="flex flex-wrap gap-3 sm:gap-4 items-center">
              <Button
                variant="secondary"
                onClick={() => handleAutoAdvance(7, autopilot.watchEvents)}
                disabled={isAdvancing}
                className="inline-flex min-h-9 items-center gap-2 px-3 text-xs"
              >
                <FastForward size={16} /> Advance 1 Week
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleAutoAdvance(28, autopilot.watchEvents)}
                disabled={isAdvancing}
                className="inline-flex min-h-9 items-center gap-2 px-3 text-xs"
              >
                <FastForward size={16} /> Advance 1 Month
              </Button>
              <Button
                variant="primary"
                onClick={() => handleAutoAdvance(180, autopilot.watchEvents)}
                disabled={isAdvancing}
                className="inline-flex min-h-9 items-center gap-2 px-3 text-xs"
              >
                <FastForward size={16} /> Quick Sim 6 Months
              </Button>
              
              <div className="sm:ml-auto flex items-center gap-3 bg-neutral-950 px-4 py-2 rounded border border-purple-900/50">
                <span className="text-sm font-bold text-neutral-300">Watch Events Live:</span>
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
                <Settings className="animate-spin" size={16} /> Simulating world...
              </div>
            )}
            {!isAdvancing && lastAutopilotSummary && (
              <div className="mt-6 bg-purple-950/50 border border-purple-500/20 rounded p-4 text-sm text-purple-200">
                <h3 className="font-bold mb-2 uppercase tracking-wider text-purple-400">Simulation Summary ({lastAutopilotSummary.daysSimulated} days: {lastAutopilotSummary.calendarStartDate} to {lastAutopilotSummary.calendarEndDate})</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <span className="block text-purple-400/70 text-xs uppercase">Events Booked</span>
                    <span className="font-bold">{lastAutopilotSummary.eventsCreated}</span>
                  </div>
                  <div>
                    <span className="block text-purple-400/70 text-xs uppercase">Events Ran</span>
                    <span className="font-bold">{lastAutopilotSummary.eventsCompleted}</span>
                  </div>
                  <div>
                    <span className="block text-purple-400/70 text-xs uppercase">Fights Simmed</span>
                    <span className="font-bold">{lastAutopilotSummary.fightsSimulated}</span>
                  </div>
                  <div>
                    <span className="block text-purple-400/70 text-xs uppercase">New Champs</span>
                    <span className="font-bold">{lastAutopilotSummary.newChampions}</span>
                  </div>
                  <div>
                    <span className="block text-purple-400/70 text-xs uppercase">Money Change</span>
                    <span className={`font-bold ${lastAutopilotSummary.moneyChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {lastAutopilotSummary.moneyChange > 0 ? '+' : ''}${lastAutopilotSummary.moneyChange.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="block text-purple-400/70 text-xs uppercase">Rep Change</span>
                    <span className={`font-bold ${lastAutopilotSummary.reputationChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {lastAutopilotSummary.reputationChange > 0 ? '+' : ''}{lastAutopilotSummary.reputationChange}
                    </span>
                  </div>
                  {lastAutopilotSummary.bookingDelays > 0 && (
                    <div>
                      <span className="block text-yellow-500/70 text-xs uppercase">Booking Delays</span>
                      <span className="font-bold text-yellow-500">{lastAutopilotSummary.bookingDelays}</span>
                    </div>
                  )}
                  {lastAutopilotSummary.emergencyModeTriggered > 0 && (
                    <div>
                      <span className="block text-red-500/70 text-xs uppercase">Emergencies</span>
                      <span className="font-bold text-red-500">{lastAutopilotSummary.emergencyModeTriggered} (${lastAutopilotSummary.ownerCashInjections * 100}k injected)</span>
                    </div>
                  )}
                </div>
                {lastAutopilotSummary.highlights && (
                  <div className="mt-4 pt-4 border-t border-purple-900/50">
                    <h4 className="text-purple-300 font-bold mb-2 uppercase tracking-wide text-sm">Notable Highlights</h4>
                    <ul className="text-sm text-purple-200/80 list-disc pl-5 space-y-1">
                      {lastAutopilotSummary.highlights.newUndisputedChampions > 0 && <li>{lastAutopilotSummary.highlights.newUndisputedChampions} New Undisputed Champions Crowned</li>}
                      {lastAutopilotSummary.highlights.newInterimChampions > 0 && <li>{lastAutopilotSummary.highlights.newInterimChampions} Interim Titles Won</li>}
                      {lastAutopilotSummary.highlights.unifications > 0 && <li>{lastAutopilotSummary.highlights.unifications} Unification Fights Occurred</li>}
                      {lastAutopilotSummary.highlights.majorInjuries > 0 && <li>{lastAutopilotSummary.highlights.majorInjuries} Major Injuries</li>}
                      {lastAutopilotSummary.highlights.biggestProfit > 0 && <li>Biggest Event Profit: ${lastAutopilotSummary.highlights.biggestProfit.toLocaleString()}</li>}
                      {lastAutopilotSummary.highlights.awardsGenerated && <li><span className="text-yellow-400 font-bold">Yearly Awards were generated</span> (Check History)</li>}
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
                <h2 className="text-lg font-semibold text-white">Action items</h2>
                <Button variant="quiet" onClick={() => setView('inbox')} className="min-h-9 text-xs">View all</Button>
              </div>
              {inboxPreview.map(item => <article key={item.id} className="flex flex-col gap-3 rounded border border-[#2a2c31] bg-neutral-950 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <StatusBadge tone={inboxTones[item.severity]}>{item.severity}</StatusBadge>
                  <h3 className="mt-2 text-sm font-semibold text-white">{item.title}</h3>
                  <p className="mt-1 text-sm text-neutral-400">{item.description}</p>
                </div>
                <Button variant="secondary" onClick={() => setView(item.targetView, { fighterId: item.fighterId, eventId: item.eventId, calendarSlotId: item.calendarSlotId })} className="min-h-9 shrink-0 px-3 text-xs">Review</Button>
              </article>)}
            </Panel>
          )}

          {/* Next Event */}
          <div className="bg-[#101114] border border-[#2a2c31] rounded-lg p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Calendar size={20} /> Next Event
            </h2>
            {nextEvent ? (
              <div className="bg-neutral-950 p-4 rounded-md border border-neutral-800">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-start sm:justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">{nextEvent.name}</h3>
                    <p className="text-sm text-neutral-400">{nextEvent.date}</p>
                  </div>
                  <button 
                    onClick={() => setView('simulation', { eventId: nextEvent.id })}
                    className="bg-white text-black px-4 py-2 rounded font-bold text-sm hover:bg-neutral-200"
                  >
                    Simulate
                  </button>
                </div>
                
                {nextEventProjections && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                    <div className="bg-neutral-900 p-2 rounded border border-neutral-800">
                      <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mb-0.5">Est. Attendance</p>
                      <p className="text-sm font-bold text-white">{nextEventProjections.expectedAttendance.toLocaleString()}</p>
                    </div>
                    <div className="bg-neutral-900 p-2 rounded border border-neutral-800">
                      <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mb-0.5">Est. Revenue</p>
                      <p className="text-sm font-bold text-green-400">${(nextEventProjections.expectedGate + nextEventProjections.broadcastRevenue).toLocaleString()}</p>
                    </div>
                    <div className="bg-neutral-900 p-2 rounded border border-neutral-800">
                      <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mb-0.5">Est. Cost</p>
                      <p className="text-sm font-bold text-red-400">${nextEventProjections.estimatedCost.toLocaleString()}</p>
                    </div>
                    <div className="bg-neutral-900 p-2 rounded border border-neutral-800">
                      <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mb-0.5">Est. Profit</p>
                      <p className={`text-sm font-bold ${nextEventProjections.expectedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ${nextEventProjections.expectedProfit.toLocaleString()}
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
                        <span className="text-neutral-500 text-xs">vs</span>
                        <span className="flex items-center gap-1 font-medium">{blue && <FighterRankBadge fighterId={blue.id} />}{blue?.lastName}</span>
                        <span className="text-neutral-500 text-xs ml-4">{fight.weightClass}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center p-8 border border-dashed border-neutral-700 rounded-md">
                <p className="text-neutral-400 mb-4">No events booked.</p>
                <button 
                  onClick={() => setView('event-builder')}
                  className="bg-neutral-800 text-white px-4 py-2 rounded text-sm hover:bg-neutral-700"
                >
                  Book Event
                </button>
              </div>
            )}
          </div>

          {/* Past Events */}
          <div className="bg-[#101114] border border-[#2a2c31] rounded-lg p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Calendar size={20} className="text-neutral-500" /> Past Events
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
                      <p className="text-xs text-neutral-500">{event.date} • {event.fights.length} Fights</p>
                      {event.results && (
                         <p className={`text-xs font-bold mt-1 ${event.results.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                           {event.results.profit >= 0 ? '+' : '-'}${Math.abs(event.results.profit).toLocaleString()}
                         </p>
                      )}
                    </div>
                    <button 
                      onClick={() => setView('simulation', { eventId: event.id })}
                      className="text-xs bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-1.5 rounded transition-colors"
                    >
                      View Results
                    </button>
                  </div>
                ))}
              {Object.values(events).filter(e => e.isCompleted).length === 0 && (
                <p className="text-sm text-neutral-500 italic">No past events yet.</p>
              )}
            </div>
          </div>

          {/* Champions */}
          <div className="bg-[#101114] border border-[#2a2c31] rounded-lg p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Trophy size={20} className="text-yellow-500" /> Current Champions
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
                        {isInterim ? 'Interim ' : ''}{belt ? belt.shortName : champ.weightClass}
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
                 <span className="text-green-500">$</span> Finance & Deals
                 <span className="text-[10px] uppercase tracking-wider text-neutral-500">{isFinanceOpen ? 'Collapse' : 'Expand'}</span>
               </button>
               <div className="flex flex-wrap gap-3 sm:gap-4">
                  <div className="bg-neutral-950 px-3 py-1.5 rounded border border-neutral-800 text-center">
                     <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mb-0.5">Sponsor Income</p>
                     <p className="text-sm font-mono text-green-400">+${activeSponsorIncome.toLocaleString()}/mo</p>
                  </div>
                  <div className="bg-neutral-950 px-3 py-1.5 rounded border border-neutral-800 text-center">
                     <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mb-0.5">Media Income</p>
                     <p className="text-sm font-mono text-green-400">+${activeMediaIncome.toLocaleString()}/mo</p>
                  </div>
               </div>
            </div>
            
            {isFinanceOpen && <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-bold text-neutral-400 mb-2 uppercase tracking-wider">Sponsors</h3>
                {sponsorDeals.length > 0 ? sponsorDeals.map(deal => {
                   const daysLeft = differenceInDays(new Date(deal.expiresDate), new Date(currentDate));
                   const isExpiringSoon = deal.isActive && daysLeft <= 60;
                   return (
                  <div key={deal.id} className={`p-3 rounded border mb-2 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between ${deal.isActive ? 'bg-neutral-950 border-neutral-800' : 'bg-red-950/20 border-red-900/50'}`}>
                    <div>
                      <p className="font-bold text-white text-sm">
                         {deal.name} 
                         <span className="text-xs text-neutral-500 font-normal ml-1">({deal.tier})</span>
                         {!deal.isActive && <span className="ml-2 text-[10px] bg-red-900/50 text-red-300 px-1.5 py-0.5 rounded font-bold uppercase">Expired</span>}
                      </p>
                      <p className={`text-xs font-bold ${deal.isActive ? 'text-green-400' : 'text-neutral-500'}`}>+${deal.monthlyIncome.toLocaleString()}/mo</p>
                      {deal.bonusPerEvent && <p className="text-xs text-neutral-400">Event Bonus: ${deal.bonusPerEvent.toLocaleString()}</p>}
                      {deal.isActive && (
                         <p className={`text-[10px] font-bold mt-1 ${isExpiringSoon ? 'text-orange-400' : 'text-neutral-500'}`}>
                            Expires in {daysLeft} days ({deal.expiresDate})
                         </p>
                      )}
                    </div>
                    {mode === 'manager' && (
                       <button onClick={() => renewDeal(deal.id, 'sponsor')} className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-xs rounded text-white font-bold transition-colors">
                          Renew
                       </button>
                    )}
                  </div>
                )}) : <p className="text-sm text-neutral-500 italic">No active sponsor deals.</p>}

                {mode === 'manager' && (
                   <div className="mt-4 space-y-2 border-t border-neutral-800 pt-4">
                      <p className="text-xs text-neutral-400 font-bold uppercase">Available Sponsors</p>
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
                                  <p className="text-xs text-neutral-500">Req Rep: {tmpl.req}</p>
                               </div>
                               <button 
                                  onClick={() => signSponsorDeal(tmpl.name)} 
                                  disabled={isLocked}
                                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:bg-neutral-800 text-xs rounded text-white font-bold transition-colors"
                               >
                                  {isLocked ? 'Locked' : 'Sign Deal'}
                               </button>
                            </div>
                         );
                      })}
                   </div>
                )}
              </div>
              
              <div>
                <h3 className="text-sm font-bold text-neutral-400 mb-2 uppercase tracking-wider">Media Deal</h3>
                {mediaDeals.length > 0 ? mediaDeals.map(deal => {
                   const daysLeft = differenceInDays(new Date(deal.expiresDate), new Date(currentDate));
                   const isExpiringSoon = deal.isActive && daysLeft <= 60;
                   return (
                  <div key={deal.id} className={`p-3 rounded border mb-2 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between ${deal.isActive ? 'bg-neutral-950 border-neutral-800' : 'bg-red-950/20 border-red-900/50'}`}>
                    <div>
                      <p className="font-bold text-white text-sm">
                         {deal.name} 
                         <span className="text-xs text-neutral-500 font-normal ml-1">({deal.tier})</span>
                         {!deal.isActive && <span className="ml-2 text-[10px] bg-red-900/50 text-red-300 px-1.5 py-0.5 rounded font-bold uppercase">Expired</span>}
                      </p>
                      <p className={`text-xs font-bold ${deal.isActive ? 'text-green-400' : 'text-neutral-500'}`}>+${deal.monthlyIncome.toLocaleString()}/mo</p>
                      {deal.bonusPerEvent && <p className="text-xs text-neutral-400">Event Bonus: ${deal.bonusPerEvent.toLocaleString()}</p>}
                      {deal.isActive && (
                         <p className={`text-[10px] font-bold mt-1 ${isExpiringSoon ? 'text-orange-400' : 'text-neutral-500'}`}>
                            Expires in {daysLeft} days ({deal.expiresDate})
                         </p>
                      )}
                    </div>
                    {mode === 'manager' && (
                       <button onClick={() => renewDeal(deal.id, 'media')} className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-xs rounded text-white font-bold transition-colors">
                          Renew
                       </button>
                    )}
                  </div>
                )}) : <p className="text-sm text-neutral-500 italic">No active media deals.</p>}

                {mode === 'manager' && (
                   <div className="mt-4 space-y-2 border-t border-neutral-800 pt-4">
                      <p className="text-xs text-neutral-400 font-bold uppercase">Available Media Deals</p>
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
                                  <p className="text-xs text-neutral-500">Req Rep: {tmpl.req}</p>
                               </div>
                               <button 
                                  onClick={() => signMediaDeal(tmpl.name)} 
                                  disabled={isLocked}
                                  className="px-3 py-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:bg-neutral-800 text-xs rounded text-white font-bold transition-colors"
                               >
                                  {isLocked ? 'Locked' : 'Sign Deal'}
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
                 <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Recent Ledger</h3>
                 <div className="flex flex-wrap gap-2">
                    {['All', 'Event', 'Deals', 'Costs', 'Income'].map(filter => (
                       <button 
                         key={filter}
                         onClick={() => setLedgerFilter(filter as any)}
                         className={`text-[10px] px-2 py-1 rounded font-bold uppercase transition-colors ${ledgerFilter === filter ? 'bg-neutral-700 text-white' : 'bg-neutral-900 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300'}`}
                       >
                          {filter}
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
                       <p className="text-xs text-neutral-500 font-mono">{entry.date}</p>
                     </div>
                     <span className={`shrink-0 font-mono font-bold ${entry.isSummary ? 'text-blue-400' : (entry.amount >= 0 ? 'text-green-400' : 'text-red-400')}`}>
                       {entry.amount > 0 ? '+' : ''}{entry.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                     </span>
                   </div>
                 )) : (
                    <p className="text-sm text-neutral-500 italic py-4 text-center">No ledger entries match this filter.</p>
                 )}
               </div>
            </div>
            </>}
          </div>
        </div>

        {/* News Feed */}
        <div className={`bg-[#101114] border border-[#2a2c31] rounded-lg p-4 sm:p-6 flex flex-col ${isNewsOpen ? 'h-auto lg:h-[600px] max-h-[70svh] lg:max-h-none' : ''}`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-white">Latest News</h2>
            <button
              type="button"
              onClick={() => setIsNewsOpen(open => !open)}
              aria-expanded={isNewsOpen}
              className="text-xs font-bold uppercase text-neutral-400 hover:text-white"
            >
              {isNewsOpen ? 'Collapse' : 'Expand'}
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
                    <span className="text-xs text-neutral-500 font-mono">{item.date}</span>
                    <span className="text-[10px] text-neutral-500 uppercase tracking-wider">{item.type}</span>
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
            View All News
          </button>
          </>}
        </div>
      </div>
    </div>
  );
}
