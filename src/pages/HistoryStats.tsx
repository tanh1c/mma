import React from 'react';
import { useGameStore } from '../store/gameStore';
import { FighterRankBadge } from '../components/FighterRankBadge';
import { WEIGHT_CLASSES } from '../lib/game/constants';
import { Trophy, Calendar, Star, TrendingUp, Award } from 'lucide-react';
import { PageHeader, Panel, Stat } from '../components/ui';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../store/settingsStore';
import { formatCalendarSlotStatus, formatCalendarSlotType, formatCurrency, formatDate, formatFightMethod, formatNumber, formatTournamentStatus, formatWeightClass } from '../lib/localization';
import { calculateHallOfFameScore } from '../lib/game/career';

export default function HistoryStats() {
  const { t: translate } = useTranslation('translation');
  const language = useSettingsStore(state => state.language);
  const { eventArchive, fightArchive, titleHistory, fighters, events: scheduledEvents, setView, belts, yearlyAwards = {}, financeLedger, tournaments = {}, seasonPlans = {}, drama } = useGameStore();

  const [expandedEventId, setExpandedEventId] = React.useState<string | null>(null);
  const [incidentSeverityFilter, setIncidentSeverityFilter] = React.useState('all');
  const [incidentTypeFilter, setIncidentTypeFilter] = React.useState('all');
  const [incidentEventFilter, setIncidentEventFilter] = React.useState('all');
  const [incidentFighterFilter, setIncidentFighterFilter] = React.useState('all');
  const [gpFilter, setGpFilter] = React.useState<'all' | 'active' | 'completed' | 'cancelled' | 'fourMan' | 'eightMan'>('all');
  const gpFilterLabels = {
    all: translate($ => $.historyStats.filters.all),
    active: translate($ => $.historyStats.filters.active),
    completed: translate($ => $.historyStats.filters.completed),
    cancelled: translate($ => $.historyStats.filters.cancelled),
    fourMan: translate($ => $.historyStats.filters.fourMan),
    eightMan: translate($ => $.historyStats.filters.eightMan)
  };

  const planYears = Object.keys(seasonPlans || {}).map(Number);
  const archiveYears = Object.values(eventArchive).map(e => new Date(e.date).getFullYear());
  const allYears = Array.from(new Set([...planYears, ...archiveYears])).sort((a, b) => b - a);
  const [selectedSummaryYear, setSelectedSummaryYear] = React.useState<number>(
    allYears.length > 0 ? allYears[0] : new Date().getFullYear()
  );

  const events = Object.values(eventArchive).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const fights = Object.values(fightArchive).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Derive selected year summary statistics
  const yearEvents = Object.values(eventArchive).filter(e => new Date(e.date).getFullYear() === selectedSummaryYear);
  const yearFights = Object.values(fightArchive).filter(f => new Date(f.date).getFullYear() === selectedSummaryYear);
  
  const yearCompletedEvents = yearEvents.length;
  const yearPlan = seasonPlans?.[selectedSummaryYear];
  const yearTentpoles = yearPlan 
    ? yearPlan.slots.filter(s => s.type === 'tentpole_event' && s.status === 'completed').length 
    : yearEvents.filter(e => e.name.includes("Mega Showdown") || (e.marketingCost && e.marketingCost >= 20000)).length;
    
  const yearGPs = Object.values(tournaments).filter(t => t.status === 'completed' && t.completedDate && new Date(t.completedDate).getFullYear() === selectedSummaryYear).length;
  
  const yearBiggestEvent = yearEvents.length > 0 ? yearEvents.reduce((max, e) => e.attendance > max.attendance ? e : max, yearEvents[0]) : null;
  const yearBestFight = yearFights.length > 0 ? yearFights.reduce((max, f) => f.performanceRating > max.performanceRating ? f : max, yearFights[0]) : null;
  
  let yearBiggestUpset: any = null;
  let maxUpsetDiff = 0;
  yearFights.forEach(f => {
    const winner = fighters[f.winnerId || ''];
    const loserId = f.winnerId === f.redFighterId ? f.blueFighterId : f.redFighterId;
    const loser = fighters[loserId || ''];
    if (winner && loser && loser.popularity > winner.popularity) {
      const diff = loser.popularity - winner.popularity;
      if (diff > maxUpsetDiff) {
        maxUpsetDiff = diff;
        yearBiggestUpset = f;
      }
    }
  });

  const yearProfit = yearEvents.reduce((sum, e) => sum + e.profit, 0);
  const yearRevenue = yearEvents.reduce((sum, e) => sum + e.revenue, 0);
  const yearSlots = yearPlan?.slots || [];

  const gameState = useGameStore.getState();
  const legacyScores = Object.values(fighters).map(fighter => {
    const fighterTitleHistory = titleHistory.filter(item => item.fighterId === fighter.id);
    return {
      fighter,
      score: calculateHallOfFameScore(gameState, fighter.id),
      titleWins: fighterTitleHistory.filter(item => item.beltType === 'undisputed').length,
      interimTitleWins: fighterTitleHistory.filter(item => item.beltType === 'interim').length,
      titleDefenses: fighterTitleHistory.reduce((total, item) => total + item.defenses, 0),
      unificationWins: fights.filter(fight => fight.winnerId === fighter.id && fight.titleChangeInfo?.type === 'unified').length
    };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.fighter.id.localeCompare(b.fighter.id)).slice(0, 10);
  const hallOfFame = Object.values(fighters)
    .filter(fighter => fighter.hallOfFame)
    .sort((a, b) => b.hallOfFame!.inductedYear - a.hallOfFame!.inductedYear || b.hallOfFame!.legacyScore - a.hallOfFame!.legacyScore || a.id.localeCompare(b.id));
  
  const [selectedAwardYear, setSelectedAwardYear] = React.useState<number | null>(
    Object.keys(yearlyAwards).length > 0 ? Math.max(...Object.keys(yearlyAwards).map(Number)) : null
  );

  // Derive stats
  const totalEvents = events.length;
  const totalRevenue = events.reduce((sum, e) => sum + e.revenue, 0);
  const totalProfit = events.reduce((sum, e) => sum + e.profit, 0);
  
  const biggestEvent = events.length > 0 ? events.reduce((max, e) => e.attendance > max.attendance ? e : max, events[0]) : null;

  const topFights = [...fights].sort((a, b) => b.performanceRating - a.performanceRating).slice(0, 5);

  // Record Book Calculations
  const allFighters = Object.values(fighters);
  const mostWins = [...allFighters].sort((a, b) => b.record.wins - a.record.wins)[0];
  const mostKOs = [...allFighters].sort((a, b) => b.record.kos - a.record.kos)[0];
  const mostSubs = [...allFighters].sort((a, b) => b.record.subs - a.record.subs)[0];
  const mostFights = [...allFighters].sort((a, b) => (b.record.wins + b.record.losses + b.record.draws) - (a.record.wins + a.record.losses + a.record.draws))[0];
  
  const mostDefenses = [...titleHistory].sort((a, b) => b.defenses - a.defenses)[0];
  
  const mostProfitableEvent = [...events].sort((a, b) => b.profit - a.profit)[0];
  const biggestLossEvent = [...events].sort((a, b) => a.profit - b.profit)[0];
  
  const parseTime = (timeStr: string) => {
    const parts = timeStr.split(':');
    if (parts.length !== 2) return 999;
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  };
  
  const koFights = fights.filter(f => f.method.includes('KO'));
  const fastestKO = koFights.length > 0 ? [...koFights].sort((a, b) => {
    if (a.round !== b.round) return a.round - b.round;
    return parseTime(a.time) - parseTime(b.time);
  })[0] : null;
  const seasonReviews = Object.values(drama.seasonReviews).sort((a, b) => b.year - a.year);
  const resolvedIncidents = Object.values(drama.incidents).filter(incident => incident.status === 'resolved');
  const incidentEvents = Array.from(new Set(resolvedIncidents.flatMap(incident => incident.eventId ? [incident.eventId] : [])));
  const incidentFighters = Array.from(new Set(resolvedIncidents.flatMap(incident => incident.fighterIds)));
  const filteredIncidents = resolvedIncidents.filter(incident =>
    (incidentSeverityFilter === 'all' || incident.severity === incidentSeverityFilter) &&
    (incidentTypeFilter === 'all' || incident.type === incidentTypeFilter) &&
    (incidentEventFilter === 'all' || incident.eventId === incidentEventFilter) &&
    (incidentFighterFilter === 'all' || incident.fighterIds.includes(incidentFighterFilter))
  ).sort((a, b) => (b.resolvedDate ?? b.createdDate).localeCompare(a.resolvedDate ?? a.createdDate) || a.id.localeCompare(b.id));
  const incidentLabels = {
    weight_cut: translate($ => $.inbox.drama.incident.weightCut), camp_injury: translate($ => $.inbox.drama.incident.campInjury), trash_talk: translate($ => $.inbox.drama.incident.trashTalk), press_altercation: translate($ => $.inbox.drama.incident.pressAltercation), pay_demand: translate($ => $.inbox.drama.incident.payDemand), short_notice_refusal: translate($ => $.inbox.drama.incident.shortNoticeRefusal), title_picture_complaint: translate($ => $.inbox.drama.incident.titlePictureComplaint)
  };
  const responseLabels: Record<string, string> = {
    accept_catchweight: translate($ => $.inbox.drama.response.acceptCatchweight), fine_fighter: translate($ => $.inbox.drama.response.fineFighter), replace_or_cancel: translate($ => $.inbox.drama.response.replaceOrCancel), rest_and_continue: translate($ => $.inbox.drama.response.restAndContinue), amplify: translate($ => $.inbox.drama.response.amplify), deescalate: translate($ => $.inbox.drama.response.deescalate), fine_both: translate($ => $.inbox.drama.response.fineBoth), use_for_hype: translate($ => $.inbox.drama.response.useForHype), improve_terms: translate($ => $.inbox.drama.response.improveTerms), hold_line: translate($ => $.inbox.drama.response.holdLine), respect_refusal: translate($ => $.inbox.drama.response.respectRefusal), apply_pressure: translate($ => $.inbox.drama.response.applyPressure), promise_eliminator: translate($ => $.inbox.drama.response.promiseEliminator), reject_demand: translate($ => $.inbox.drama.response.rejectDemand)
  };
  const rationaleLabels: Record<string, string> = {
    identity: translate($ => $.dramaTimeline.rationaleFactors.identity), booking: translate($ => $.dramaTimeline.rationaleFactors.booking), cash_safety: translate($ => $.dramaTimeline.rationaleFactors.cashSafety), event_importance: translate($ => $.dramaTimeline.rationaleFactors.eventImportance), fighter_development: translate($ => $.dramaTimeline.rationaleFactors.fighterDevelopment)
  };
  const consequenceLabels = {
    money: translate($ => $.dramaTimeline.consequences.money), reputation: translate($ => $.dramaTimeline.consequences.reputation), fanbase: translate($ => $.dramaTimeline.consequences.fanbase), morale: translate($ => $.dramaTimeline.consequences.morale), popularity: translate($ => $.dramaTimeline.consequences.popularity), fatigue: translate($ => $.dramaTimeline.consequences.fatigue), social_hype: translate($ => $.dramaTimeline.consequences.socialHype), rivalry: translate($ => $.dramaTimeline.consequences.rivalry), injury: translate($ => $.dramaTimeline.consequences.injury), booking: translate($ => $.dramaTimeline.consequences.booking)
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto pb-12">
      <PageHeader
        eyebrow={translate($ => $.historyStats.eyebrow)}
        title={translate($ => $.historyStats.title)}
        description={translate($ => $.historyStats.description)}
        actions={<div className="flex gap-5"><Stat label={translate($ => $.historyStats.totalEvents)} value={formatNumber(totalEvents, language)} /><Stat label={translate($ => $.historyStats.lifetimeProfit)} value={<span className={totalProfit >= 0 ? 'text-emerald-300' : 'text-red-300'}>{formatCurrency(totalProfit, language)}</span>} /></div>}
      />

      <Panel>

      {(seasonReviews.length > 0 || resolvedIncidents.length > 0) && <div className="space-y-6 rounded-lg border border-neutral-800 bg-neutral-900 p-4 sm:p-6">
        {seasonReviews.length > 0 && <section><h2 className="text-xl font-bold uppercase tracking-tight text-white">{translate($ => $.seasonReview.title)}</h2><p className="mt-1 text-sm text-neutral-500">{translate($ => $.seasonReview.description)}</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{seasonReviews.map(review => {
          const topIncident = review.topIncidentId ? drama.incidents[review.topIncidentId] : undefined;
          return <article key={review.year} className="min-w-0 rounded border border-neutral-800 bg-neutral-950 p-4"><div className="flex items-start justify-between gap-3"><h3 className="font-semibold text-white">{translate($ => $.seasonReview.year, { year: review.year })}</h3><span className="font-mono text-2xl text-purple-300">{review.grade}</span></div><p className="mt-3 text-sm text-neutral-400">{translate($ => $.seasonReview.completed, { completed: review.completedObjectives, total: review.objectiveIds.length })}</p><p className="mt-2 text-sm text-neutral-400">{translate($ => $.seasonReview.finalFunds, { amount: formatCurrency(review.snapshot.money, language) })}</p>{topIncident && <p className="mt-2 text-sm text-neutral-500">{translate($ => $.seasonReview.topIncident, { type: incidentLabels[topIncident.type] })}</p>}</article>;
        })}</div></section>}
        {resolvedIncidents.length > 0 && <section><h2 className="text-xl font-bold uppercase tracking-tight text-white">{translate($ => $.dramaTimeline.title)}</h2><p className="mt-1 text-sm text-neutral-500">{translate($ => $.dramaTimeline.description)}</p><div className="mt-4 flex flex-wrap gap-2">
          <select aria-label={translate($ => $.dramaTimeline.severity)} value={incidentSeverityFilter} onChange={event => setIncidentSeverityFilter(event.target.value)} className="min-h-11 rounded border border-neutral-700 bg-neutral-950 px-3 text-sm text-white"><option value="all">{translate($ => $.dramaTimeline.allSeverities)}</option>{['minor', 'major', 'critical'].map(value => <option key={value} value={value}>{value}</option>)}</select>
          <select aria-label={translate($ => $.dramaTimeline.type)} value={incidentTypeFilter} onChange={event => setIncidentTypeFilter(event.target.value)} className="min-h-11 rounded border border-neutral-700 bg-neutral-950 px-3 text-sm text-white"><option value="all">{translate($ => $.dramaTimeline.allTypes)}</option>{Array.from(new Set(resolvedIncidents.map(incident => incident.type))).map(value => <option key={value} value={value}>{incidentLabels[value]}</option>)}</select>
          <select aria-label={translate($ => $.dramaTimeline.event)} value={incidentEventFilter} onChange={event => setIncidentEventFilter(event.target.value)} className="min-h-11 max-w-full rounded border border-neutral-700 bg-neutral-950 px-3 text-sm text-white"><option value="all">{translate($ => $.dramaTimeline.allEvents)}</option>{incidentEvents.map(id => <option key={id} value={id}>{scheduledEvents[id]?.name ?? eventArchive[id]?.name ?? translate($ => $.historyStats.unknown)}</option>)}</select>
          <select aria-label={translate($ => $.dramaTimeline.fighter)} value={incidentFighterFilter} onChange={event => setIncidentFighterFilter(event.target.value)} className="min-h-11 max-w-full rounded border border-neutral-700 bg-neutral-950 px-3 text-sm text-white"><option value="all">{translate($ => $.dramaTimeline.allFighters)}</option>{incidentFighters.map(id => <option key={id} value={id}>{fighters[id] ? `${fighters[id].firstName} ${fighters[id].lastName}` : translate($ => $.historyStats.unknown)}</option>)}</select>
        </div><div className="mt-4 grid gap-3 sm:grid-cols-2">{filteredIncidents.map(incident => <article key={incident.id} className="min-w-0 rounded border border-neutral-800 bg-neutral-950 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-white">{incidentLabels[incident.type]}</h3><span className="font-mono text-[10px] uppercase text-neutral-500">{incident.severity}</span></div><p className="mt-2 text-sm text-neutral-400">{translate($ => $.dramaTimeline.response, { response: incident.selectedResponseKey ? responseLabels[incident.selectedResponseKey] ?? translate($ => $.historyStats.unknown) : translate($ => $.historyStats.unknown) })}</p>{incident.rationaleKey && <p className="mt-1 text-sm text-neutral-500">{translate($ => $.dramaTimeline.rationale, { rationale: rationaleLabels[incident.rationaleKey.split('.').at(-1) ?? ''] ?? translate($ => $.historyStats.unknown) })}</p>}<ul className="mt-3 flex min-w-0 flex-wrap gap-2">{(incident.consequences ?? []).map((consequence, index) => <li key={`${consequence.kind}-${index}`} className="max-w-full rounded bg-white/5 px-2 py-1 text-xs text-neutral-300 [overflow-wrap:anywhere]">{consequenceLabels[consequence.kind]}: {consequence.value > 0 ? '+' : ''}{consequence.value}</li>)}</ul><p className="mt-3 font-mono text-[10px] text-neutral-600">{formatDate(incident.resolvedDate ?? incident.createdDate, language)}</p></article>)}</div></section>}
      </div>}

      <div className="bg-neutral-900 p-6 rounded-lg border border-neutral-800">
        <div className="flex items-center gap-2 mb-6">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h2 className="text-xl font-bold text-white uppercase tracking-tight">{translate($ => $.historyStats.hallOfFameTitle)}</h2>
        </div>
        {hallOfFame.length === 0 ? (
          <p className="text-sm text-neutral-500">{translate($ => $.historyStats.noHallOfFame)}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {hallOfFame.map(fighter => {
              const hallOfFame = fighter.hallOfFame!;
              return (
                <button key={fighter.id} type="button" onClick={() => setView('fighter-detail', { fighterId: fighter.id })} className="rounded-lg border border-neutral-800 bg-neutral-950 p-4 text-left transition-colors hover:border-neutral-700 hover:bg-neutral-900">
                  <p className="text-base font-bold text-white">{fighter.firstName} {fighter.lastName}</p>
                  <p className="mt-1 text-xs text-neutral-500">{formatWeightClass(fighter.weightClass, language)} · {fighter.record.wins}-{fighter.record.losses}-{fighter.record.draws}</p>
                  <div className="mt-4 flex items-end justify-between gap-4">
                    <span className="text-xs text-neutral-400">{translate($ => $.historyStats.inductedYear, { year: hallOfFame.inductedYear })}</span>
                    <span className="font-mono text-lg font-bold text-yellow-400">{hallOfFame.legacyScore}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Legacy Rankings */}
      <div className="bg-neutral-900 p-6 rounded-lg border border-neutral-800">
        <div className="flex items-center gap-2 mb-6">
          <Star className="w-5 h-5 text-yellow-500" />
          <h2 className="text-xl font-bold text-white uppercase tracking-tight">{translate($ => $.historyStats.legacyTitle)}</h2>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[720px] text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-500 uppercase tracking-wider text-xs">
                <th className="pb-2 font-bold w-12 text-center">{translate($ => $.historyStats.rank)}</th>
                <th className="pb-2 font-bold">{translate($ => $.historyStats.fighter)}</th>
                <th className="pb-2 font-bold">{translate($ => $.historyStats.weightClass)}</th>
                <th className="pb-2 font-bold">{translate($ => $.historyStats.record)}</th>
                <th className="pb-2 font-bold">{translate($ => $.historyStats.legacyScore)}</th>
                <th className="pb-2 font-bold text-right">{translate($ => $.historyStats.majorAchievements)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {legacyScores.map((l, idx) => (
                <tr
                  key={l.fighter.id}
                  className="hover:bg-neutral-800/50 cursor-pointer transition-colors"
                  onClick={() => setView('fighter-detail', { fighterId: l.fighter.id })}
                >
                  <td className="py-3 text-center text-neutral-500 font-bold">#{idx + 1}</td>
                  <td className="py-3 text-white font-bold">{l.fighter.firstName} {l.fighter.lastName}</td>
                  <td className="py-3 text-neutral-400">{formatWeightClass(l.fighter.weightClass, language)}</td>
                  <td className="py-3 text-neutral-300 font-mono text-xs">{l.fighter.record.wins}-{l.fighter.record.losses}-{l.fighter.record.draws}</td>
                  <td className="py-3 font-mono text-blue-400 font-bold text-lg">{l.score}</td>
                  <td className="py-3 text-right text-xs text-neutral-500">
                    {l.titleWins > 0 && <span className="text-yellow-500 mr-2">{translate($ => $.historyStats.undisputedCount, { count: l.titleWins })}</span>}
                    {l.interimTitleWins > 0 && <span className="text-purple-400 mr-2">{translate($ => $.historyStats.interimCount, { count: l.interimTitleWins })}</span>}
                    {l.titleDefenses > 0 && <span className="text-neutral-400 mr-2">{translate($ => $.historyStats.defensesCount, { count: l.titleDefenses })}</span>}
                    {l.unificationWins > 0 && <span className="text-blue-400">{translate($ => $.historyStats.unifiedCount, { count: l.unificationWins })}</span>}
                  </td>
                </tr>
              ))}
              {legacyScores.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-neutral-500">{translate($ => $.historyStats.noLegacy)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grand Prix Tournaments Archive */}
      {Object.keys(tournaments).length > 0 && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Award className="text-purple-400" /> {translate($ => $.historyStats.gpHistory)}
            </h2>
            
            <div className="flex gap-1 bg-neutral-950 p-1 rounded border border-neutral-800">
              {(['all', 'active', 'completed', 'cancelled', 'fourMan', 'eightMan'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setGpFilter(f)}
                  className={`text-[10px] uppercase font-bold py-1 px-2.5 rounded transition-all ${
                    gpFilter === f ? 'bg-white text-black' : 'text-neutral-300 hover:bg-[#1b1c20] hover:text-white'
                  }`}
                >
                  {gpFilterLabels[f]}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[900px] text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 text-[10px] text-neutral-400 uppercase tracking-wider font-bold">
                  <th className="py-2.5">{translate($ => $.historyStats.date)}</th>
                  <th className="py-2.5">{translate($ => $.historyStats.tournament)}</th>
                  <th className="py-2.5">{translate($ => $.historyStats.weightClass)}</th>
                  <th className="py-2.5">{translate($ => $.historyStats.prestige)}</th>
                  <th className="py-2.5">{translate($ => $.historyStats.reservesUsed)}</th>
                  <th className="py-2.5">{translate($ => $.historyStats.winner)}</th>
                  <th className="py-2.5">{translate($ => $.historyStats.runnerUp)}</th>
                  <th title={translate($ => $.historyStats.titleShotHelp)} className="py-2.5">{translate($ => $.historyStats.titleShotStatus)}</th>
                  <th className="py-2.5">{translate($ => $.historyStats.fights)}</th>
                  <th className="py-2.5 text-right">{translate($ => $.historyStats.actions)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/40 text-sm">
                {(() => {
                  const filteredGps = Object.values(tournaments).filter(t => {
                    if (gpFilter === 'all') return true;
                    if (gpFilter === 'active') return t.status === 'planned' || t.status === 'active';
                    if (gpFilter === 'completed') return t.status === 'completed';
                    if (gpFilter === 'cancelled') return t.status === 'cancelled';
                    if (gpFilter === 'fourMan') return t.format === 'four_man';
                    if (gpFilter === 'eightMan') return t.format === 'eight_man';
                    return true;
                  });

                  if (filteredGps.length === 0) {
                    return (
                      <tr>
                        <td colSpan={10} className="py-6 text-center text-neutral-500 italic">{translate($ => $.historyStats.noGp)}</td>
                      </tr>
                    );
                  }

                  return filteredGps.map(t => {
                    const winner = t.winnerId ? fighters[t.winnerId] : null;
                    const finalSlot = t.fights.find(f => f.round === 'final');
                    const runnerUpId = finalSlot ? (finalSlot.winnerId === finalSlot.redFighterId ? finalSlot.blueFighterId : finalSlot.redFighterId) : null;
                    const runnerUp = runnerUpId ? fighters[runnerUpId] : null;
                    
                    const reserveUsed = t.participants.some(p => p.replacementForFighterId !== undefined && p.replacementForFighterId !== null);
                    const usedReservesNames = (t.usedReserveFighterIds || [])
                      .map(id => fighters[id])
                      .filter(Boolean)
                      .map(f => `${f.firstName[0]}. ${f.lastName}`)
                      .join(', ');
                    
                    let titleShotStatus = 'N/A';
                    if (t.titleShotPromised) {
                      if (t.titleShotUsed) {
                        titleShotStatus = 'Used';
                      } else {
                        titleShotStatus = winner ? 'Pending' : 'TBD';
                      }
                    }

                    const qfFights = t.fights.filter(f => f.round === 'quarterfinal');
                    const q1Archive = qfFights[0]?.fightArchiveId;
                    const q2Archive = qfFights[1]?.fightArchiveId;
                    const q3Archive = qfFights[2]?.fightArchiveId;
                    const q4Archive = qfFights[3]?.fightArchiveId;

                    const semiFights = t.fights.filter(f => f.round === 'semifinal');
                    const s1Archive = semiFights[0]?.fightArchiveId;
                    const s2Archive = semiFights[1]?.fightArchiveId;
                    const finalArchive = finalSlot?.fightArchiveId;
                    
                    return (
                      <tr key={t.id} className="hover:bg-neutral-800/30">
                        <td className="py-3 text-neutral-400 font-mono text-xs">{formatDate(t.completedDate || t.createdDate, language)}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-bold">{t.name}</span>
                            {t.status === 'cancelled' && (
                              <span className="text-[8px] bg-red-900/60 text-red-400 font-black uppercase px-1 rounded">{formatTournamentStatus(t.status, language)}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              t.format === 'eight_man' ? 'bg-purple-900/40 text-purple-400' : 'bg-blue-900/40 text-blue-400'
                            }`}>
                              {t.format === 'eight_man' ? gpFilterLabels.eightMan : gpFilterLabels.fourMan}
                            </span>
                            {t.notes && t.notes.length > 0 && (
                              <span 
                                className="text-[9px] text-yellow-500 font-medium cursor-help" 
                                title={t.notes.join('\n')}
                              >
                                {translate($ => $.historyStats.notes, { count: t.notes.length })}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 text-neutral-400">{formatWeightClass(t.weightClass, language)}</td>
                        <td className="py-3 text-neutral-300 font-mono">{t.prestige ?? 0}%</td>
                        <td className="py-3 text-neutral-400 font-mono text-xs">
                          {reserveUsed ? (
                            <div className="space-y-0.5">
                              <span className="text-yellow-500 font-bold bg-yellow-950/20 px-1 py-0.5 rounded text-[10px]">{translate($ => $.historyStats.yes)}</span>
                              {usedReservesNames && (
                                <div className="text-[9px] text-neutral-500 truncate max-w-[120px]" title={usedReservesNames}>
                                  {usedReservesNames}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-neutral-500">{translate($ => $.historyStats.no)}</span>
                          )}
                        </td>
                        <td className="py-3">
                          {winner ? (
                            <span 
                              className="text-purple-400 font-bold hover:underline cursor-pointer"
                              onClick={() => setView('fighter-detail', { fighterId: winner.id })}
                            >
                              {winner.firstName} {winner.lastName}
                            </span>
                          ) : (
                            <span className="text-neutral-500">—</span>
                          )}
                        </td>
                        <td className="py-3">
                          {runnerUp ? (
                            <span 
                              className="text-neutral-300 hover:underline cursor-pointer"
                              onClick={() => setView('fighter-detail', { fighterId: runnerUp.id })}
                            >
                              {runnerUp.firstName} {runnerUp.lastName}
                            </span>
                          ) : (
                            <span className="text-neutral-500">—</span>
                          )}
                        </td>
                        <td className="py-3">
                          {titleShotStatus === 'Used' && <span title={translate($ => $.historyStats.titleShotUsedHelp)} className="text-green-400 font-bold text-xs bg-green-950/40 px-1.5 py-0.5 rounded font-sans">{translate($ => $.historyStats.used)}</span>}
                          {titleShotStatus === 'Pending' && <span title={translate($ => $.historyStats.titleShotPendingHelp)} className="text-yellow-400 font-bold text-xs bg-yellow-950/40 px-1.5 py-0.5 rounded font-sans">{translate($ => $.historyStats.pending)}</span>}
                          {titleShotStatus === 'TBD' && <span title={translate($ => $.historyStats.titleShotTbdHelp)} className="text-blue-400 text-xs bg-blue-950/40 px-1.5 py-0.5 rounded font-sans">{translate($ => $.historyStats.pendingShort)}</span>}
                          {titleShotStatus === 'N/A' && <span className="text-neutral-500 text-xs">—</span>}
                        </td>
                        <td className="py-3">
                          <div className="flex flex-col gap-1 text-[10px] font-bold font-mono">
                            {t.format === 'eight_man' && (
                              <div className="flex gap-1 text-[9px] text-neutral-500">
                                {q1Archive ? <button onClick={() => setView('fight-detail', { fightArchiveId: q1Archive })} className="text-purple-400 hover:underline">Q1</button> : <span className="text-neutral-600">Q1</span>}
                                <span>•</span>
                                {q2Archive ? <button onClick={() => setView('fight-detail', { fightArchiveId: q2Archive })} className="text-purple-400 hover:underline">Q2</button> : <span className="text-neutral-600">Q2</span>}
                                <span>•</span>
                                {q3Archive ? <button onClick={() => setView('fight-detail', { fightArchiveId: q3Archive })} className="text-purple-400 hover:underline">Q3</button> : <span className="text-neutral-600">Q3</span>}
                                <span>•</span>
                                {q4Archive ? <button onClick={() => setView('fight-detail', { fightArchiveId: q4Archive })} className="text-purple-400 hover:underline">Q4</button> : <span className="text-neutral-600">Q4</span>}
                              </div>
                            )}
                            <div className="flex gap-1.5">
                              {s1Archive ? (
                                <button onClick={() => setView('fight-detail', { fightArchiveId: s1Archive })} className="text-purple-400 hover:underline">SF1</button>
                              ) : <span className="text-neutral-600">SF1</span>}
                              <span className="text-neutral-700">|</span>
                              {s2Archive ? (
                                <button onClick={() => setView('fight-detail', { fightArchiveId: s2Archive })} className="text-purple-400 hover:underline">SF2</button>
                              ) : <span className="text-neutral-600">SF2</span>}
                              <span className="text-neutral-700">|</span>
                              {finalArchive ? (
                                <button onClick={() => setView('fight-detail', { fightArchiveId: finalArchive })} className="text-purple-400 hover:underline font-bold">FNL</button>
                              ) : <span className="text-neutral-600">FNL</span>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => setView('tournaments')}
                            className="text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-white py-1 px-2.5 rounded transition-colors"
                          >
                            {translate($ => $.historyStats.bracket)}
                          </button>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Yearly Awards */}
      {Object.keys(yearlyAwards).length > 0 && (
        <div className="bg-neutral-900 p-6 rounded-lg border border-neutral-800">
          <div className="flex justify-between items-center mb-6 border-b border-neutral-800 pb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <h2 className="text-xl font-bold text-white uppercase tracking-tight">{translate($ => $.historyStats.yearlyAwards)}</h2>
            </div>
            
            <select 
              value={selectedAwardYear || ''}
              onChange={(e) => setSelectedAwardYear(Number(e.target.value))}
              className="bg-neutral-950 border border-neutral-700 text-white p-2 rounded focus:outline-none focus:border-neutral-500"
            >
              {Object.keys(yearlyAwards).sort((a,b) => Number(b) - Number(a)).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          
          {selectedAwardYear && yearlyAwards[selectedAwardYear] && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {/* Fighter of the Year */}
               {yearlyAwards[selectedAwardYear].fighterOfTheYearId && (
                 <div 
                   className="bg-neutral-950 p-4 rounded border border-yellow-900/50 cursor-pointer hover:bg-neutral-800 transition"
                   onClick={() => setView('fighter-detail', { fighterId: yearlyAwards[selectedAwardYear].fighterOfTheYearId })}
                 >
                    <div className="text-xs text-yellow-500 uppercase tracking-widest font-bold mb-1">{translate($ => $.historyStats.fighterOfYear)}</div>
                    <div className="text-lg text-white font-bold">
                       {fighters[yearlyAwards[selectedAwardYear].fighterOfTheYearId!]?.firstName} {fighters[yearlyAwards[selectedAwardYear].fighterOfTheYearId!]?.lastName}
                    </div>
                 </div>
               )}
               {/* Fight of the Year */}
               {yearlyAwards[selectedAwardYear].fightOfTheYearId && (
                 <div 
                   className="bg-neutral-950 p-4 rounded border border-blue-900/50 cursor-pointer hover:bg-neutral-800 transition"
                   onClick={() => setView('fight-detail', { fightArchiveId: yearlyAwards[selectedAwardYear].fightOfTheYearId })}
                 >
                    <div className="text-xs text-blue-500 uppercase tracking-widest font-bold mb-1">{translate($ => $.historyStats.fightOfYear)}</div>
                    <div className="text-sm text-white">
                       {fightArchive[yearlyAwards[selectedAwardYear].fightOfTheYearId!]?.eventName}
                    </div>
                 </div>
               )}
               {/* KO of the Year */}
               {yearlyAwards[selectedAwardYear].koOfTheYearFightId && (
                 <div 
                   className="bg-neutral-950 p-4 rounded border border-red-900/50 cursor-pointer hover:bg-neutral-800 transition"
                   onClick={() => setView('fight-detail', { fightArchiveId: yearlyAwards[selectedAwardYear].koOfTheYearFightId })}
                 >
                    <div className="text-xs text-red-500 uppercase tracking-widest font-bold mb-1">{translate($ => $.historyStats.koOfYear)}</div>
                    <div className="text-sm text-white">
                       {fightArchive[yearlyAwards[selectedAwardYear].koOfTheYearFightId!]?.eventName}
                    </div>
                 </div>
               )}
               {/* Sub of the Year */}
               {yearlyAwards[selectedAwardYear].submissionOfTheYearFightId && (
                 <div 
                   className="bg-neutral-950 p-4 rounded border border-purple-900/50 cursor-pointer hover:bg-neutral-800 transition"
                   onClick={() => setView('fight-detail', { fightArchiveId: yearlyAwards[selectedAwardYear].submissionOfTheYearFightId })}
                 >
                    <div className="text-xs text-purple-500 uppercase tracking-widest font-bold mb-1">{translate($ => $.historyStats.submissionOfYear)}</div>
                    <div className="text-sm text-white">
                       {fightArchive[yearlyAwards[selectedAwardYear].submissionOfTheYearFightId!]?.eventName}
                    </div>
                 </div>
               )}
               {/* Upset of the Year */}
               {yearlyAwards[selectedAwardYear].upsetOfTheYearFightId && (
                 <div 
                   className="bg-neutral-950 p-4 rounded border border-green-900/50 cursor-pointer hover:bg-neutral-800 transition"
                   onClick={() => setView('fight-detail', { fightArchiveId: yearlyAwards[selectedAwardYear].upsetOfTheYearFightId })}
                 >
                    <div className="text-xs text-green-500 uppercase tracking-widest font-bold mb-1">{translate($ => $.historyStats.upsetOfYear)}</div>
                    <div className="text-sm text-white">
                       {fightArchive[yearlyAwards[selectedAwardYear].upsetOfTheYearFightId!]?.eventName}
                    </div>
                 </div>
               )}
               {/* Prospect of the Year */}
               {yearlyAwards[selectedAwardYear].prospectOfTheYearId && (
                 <div 
                   className="bg-neutral-950 p-4 rounded border border-orange-900/50 cursor-pointer hover:bg-neutral-800 transition"
                   onClick={() => setView('fighter-detail', { fighterId: yearlyAwards[selectedAwardYear].prospectOfTheYearId })}
                 >
                    <div className="text-xs text-orange-500 uppercase tracking-widest font-bold mb-1">{translate($ => $.historyStats.prospectOfYear)}</div>
                    <div className="text-lg text-white font-bold">
                       {fighters[yearlyAwards[selectedAwardYear].prospectOfTheYearId!]?.firstName} {fighters[yearlyAwards[selectedAwardYear].prospectOfTheYearId!]?.lastName}
                    </div>
                 </div>
               )}
            </div>
          )}
        </div>
      )}

      {/* Season Summary & Calendar Slot Archive */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 space-y-6">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">{translate($ => $.historyStats.seasonSummary)}</h2>
          </div>
          
          <select 
            value={selectedSummaryYear}
            onChange={(e) => setSelectedSummaryYear(Number(e.target.value))}
            className="bg-neutral-950 border border-neutral-700 text-white p-2 rounded focus:outline-none focus:border-neutral-500"
          >
            {allYears.length > 0 ? (
              allYears.map(y => (
                <option key={y} value={y}>{translate($ => $.historyStats.season, { year: y })}</option>
              ))
            ) : (
              <option value={new Date().getFullYear()}>{translate($ => $.historyStats.season, { year: new Date().getFullYear() })}</option>
            )}
          </select>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-neutral-950 p-4 rounded border border-neutral-800">
            <p className="text-xs text-neutral-500 uppercase font-bold tracking-wider">{translate($ => $.historyStats.completedEvents)}</p>
            <p className="text-2xl font-black text-white mt-1">{yearCompletedEvents}</p>
          </div>
          <div className="bg-neutral-950 p-4 rounded border border-neutral-800">
            <p className="text-xs text-neutral-500 uppercase font-bold tracking-wider">{translate($ => $.historyStats.tentpoleEvents)}</p>
            <p className="text-2xl font-black text-amber-300 mt-1">{yearTentpoles}</p>
          </div>
          <div className="bg-neutral-950 p-4 rounded border border-neutral-800">
            <p className="text-xs text-neutral-500 uppercase font-bold tracking-wider">{translate($ => $.historyStats.completedTournaments)}</p>
            <p className="text-2xl font-black text-yellow-500 mt-1">{yearGPs}</p>
          </div>
          <div className="bg-neutral-950 p-4 rounded border border-neutral-800">
            <p className="text-xs text-neutral-500 uppercase font-bold tracking-wider">{translate($ => $.historyStats.financialNet)}</p>
            <p className={`text-2xl font-black mt-1 ${yearProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatCurrency(yearProfit, language)}
            </p>
          </div>
        </div>

        {/* Best Performance Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-neutral-950 p-4 rounded border border-neutral-800/60">
            <p className="text-xs text-neutral-500 uppercase font-bold tracking-wider mb-2">{translate($ => $.historyStats.biggestEvent)}</p>
            {yearBiggestEvent ? (
              <div>
                <p className="text-sm font-bold text-white">{yearBiggestEvent.name}</p>
                <p className="text-xs text-neutral-400 mt-0.5">{translate($ => $.historyStats.attendance, { value: formatNumber(yearBiggestEvent.attendance, language) })}</p>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">{translate($ => $.historyStats.noneRecorded)}</p>
            )}
          </div>
          <div className="bg-neutral-950 p-4 rounded border border-neutral-800/60">
            <p className="text-xs text-neutral-500 uppercase font-bold tracking-wider mb-2">{translate($ => $.historyStats.bestFight)}</p>
            {yearBestFight ? (
              <div 
                className="cursor-pointer hover:underline"
                onClick={() => setView('fight-detail', { fightArchiveId: yearBestFight.id })}
              >
                <p className="text-sm font-bold text-white">
                  <FighterRankBadge fighterId={yearBestFight.redFighterId} /> {fighters[yearBestFight.redFighterId]?.lastName} vs <FighterRankBadge fighterId={yearBestFight.blueFighterId} /> {fighters[yearBestFight.blueFighterId]?.lastName}
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">{translate($ => $.historyStats.ratingEvent, { rating: yearBestFight.performanceRating, event: yearBestFight.eventName })}</p>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">{translate($ => $.historyStats.noneRecorded)}</p>
            )}
          </div>
          <div className="bg-neutral-950 p-4 rounded border border-neutral-800/60">
            <p className="text-xs text-neutral-500 uppercase font-bold tracking-wider mb-2">{translate($ => $.historyStats.biggestUpset)}</p>
            {yearBiggestUpset ? (
              <div 
                className="cursor-pointer hover:underline"
                onClick={() => setView('fight-detail', { fightArchiveId: yearBiggestUpset.id })}
              >
                <p className="text-sm font-bold text-white">
                  <FighterRankBadge fighterId={yearBiggestUpset.winnerId ?? undefined} /> {translate($ => $.historyStats.defeated, { winner: fighters[yearBiggestUpset.winnerId]?.lastName, loser: fighters[yearBiggestUpset.winnerId === yearBiggestUpset.redFighterId ? yearBiggestUpset.blueFighterId : yearBiggestUpset.redFighterId]?.lastName })}
                </p>
                <p className="text-xs text-green-500 mt-0.5">{translate($ => $.historyStats.upsetMargin, { value: maxUpsetDiff })}</p>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">{translate($ => $.historyStats.noneRecorded)}</p>
            )}
          </div>
        </div>

        {/* Calendar Slots Archive list */}
        {yearSlots.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-neutral-300 uppercase tracking-wider">{translate($ => $.historyStats.calendarArchive, { year: selectedSummaryYear })}</h3>
            <div className="overflow-x-auto custom-scrollbar border border-neutral-800 rounded">
              <table className="w-full min-w-[640px] text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-950 text-neutral-400 font-bold uppercase border-b border-neutral-800">
                    <th className="p-3">{translate($ => $.historyStats.date)}</th>
                    <th className="p-3">{translate($ => $.historyStats.slotType)}</th>
                    <th className="p-3">{translate($ => $.historyStats.status)}</th>
                    <th className="p-3">{translate($ => $.historyStats.linkedEvent)}</th>
                    <th className="p-3">{translate($ => $.historyStats.notesColumn)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/50">
                  {yearSlots.map(s => {
                    const linkedEvent = Object.values(eventArchive).find(e => e.id === s.eventId);
                    return (
                      <tr key={s.id} className="hover:bg-neutral-950/40">
                        <td className="p-3 font-mono text-neutral-400">{formatDate(s.date, language)}</td>
                        <td className="p-3">
                          <span className={`px-1.5 py-0.5 rounded font-black uppercase text-[9px] ${
                            s.type === 'tentpole_event' ? 'bg-purple-900/40 text-purple-400' :
                            s.type === 'title_fight_card' ? 'bg-yellow-900/40 text-yellow-400' :
                            s.type === 'grand_prix_round' ? 'bg-blue-900/40 text-blue-400' :
                            s.type === 'recovery_gap' ? 'bg-neutral-800 text-neutral-400' :
                            'bg-neutral-950 text-neutral-400'
                          }`}>
                            {formatCalendarSlotType(s.type, language)}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-1.5 py-0.5 rounded font-black uppercase text-[9px] ${
                            s.status === 'completed' ? 'bg-green-900/40 text-green-400' :
                            s.status === 'scheduled' ? 'bg-blue-900/40 text-blue-400' :
                            s.status === 'missed' ? 'bg-orange-900/40 text-orange-400' :
                            s.status === 'cancelled' ? 'bg-red-900/40 text-red-400' :
                            'bg-neutral-800 text-neutral-500'
                          }`}>
                            {formatCalendarSlotStatus(s.status, language)}
                          </span>
                        </td>
                        <td className="p-3">
                          {linkedEvent ? (
                            <span 
                              className="text-blue-400 hover:underline cursor-pointer font-bold"
                              onClick={() => setView('simulation', { eventId: linkedEvent.id })}
                            >
                              {linkedEvent.name}
                            </span>
                          ) : (
                            <span className="text-neutral-500">—</span>
                          )}
                        </td>
                        <td className="p-3 text-neutral-400 max-w-[200px] truncate" title={s.notes?.join(', ')}>
                          {s.notes && s.notes.length > 0 ? s.notes.join(', ') : <span className="text-neutral-600">{translate($ => $.historyStats.none)}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <TrendingUp className="text-blue-500" /> {translate($ => $.historyStats.recordBook)}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-neutral-950 border border-neutral-800 rounded p-4">
             <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold mb-1">{translate($ => $.historyStats.mostFights)}</p>
             {mostFights && (mostFights.record.wins + mostFights.record.losses + mostFights.record.draws) > 0 ? (
               <>
                 <p className="text-lg font-black text-white uppercase">{mostFights.lastName}</p>
                 <p className="text-sm text-neutral-400">{translate($ => $.historyStats.fightCount, { count: mostFights.record.wins + mostFights.record.losses + mostFights.record.draws })}</p>
               </>
             ) : <p className="text-sm text-neutral-600 italic">{translate($ => $.historyStats.noneYet)}</p>}
          </div>
          <div className="bg-neutral-950 border border-neutral-800 rounded p-4">
             <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold mb-1">{translate($ => $.historyStats.mostWins)}</p>
             {mostWins && mostWins.record.wins > 0 ? (
               <>
                 <p className="text-lg font-black text-white uppercase">{mostWins.lastName}</p>
                 <p className="text-sm text-neutral-400">{translate($ => $.historyStats.winCount, { count: mostWins.record.wins })}</p>
               </>
             ) : <p className="text-sm text-neutral-600 italic">{translate($ => $.historyStats.noneYet)}</p>}
          </div>
          <div className="bg-neutral-950 border border-neutral-800 rounded p-4">
             <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold mb-1">{translate($ => $.historyStats.mostKos)}</p>
             {mostKOs && mostKOs.record.kos > 0 ? (
               <>
                 <p className="text-lg font-black text-white uppercase">{mostKOs.lastName}</p>
                 <p className="text-sm text-neutral-400">{translate($ => $.historyStats.koCount, { count: mostKOs.record.kos })}</p>
               </>
             ) : <p className="text-sm text-neutral-600 italic">{translate($ => $.historyStats.noneYet)}</p>}
          </div>
          <div className="bg-neutral-950 border border-neutral-800 rounded p-4">
             <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold mb-1">{translate($ => $.historyStats.mostSubmissions)}</p>
             {mostSubs && mostSubs.record.subs > 0 ? (
               <>
                 <p className="text-lg font-black text-white uppercase">{mostSubs.lastName}</p>
                 <p className="text-sm text-neutral-400">{translate($ => $.historyStats.submissionCount, { count: mostSubs.record.subs })}</p>
               </>
             ) : <p className="text-sm text-neutral-600 italic">{translate($ => $.historyStats.noneYet)}</p>}
          </div>
          <div className="bg-neutral-950 border border-neutral-800 rounded p-4">
             <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold mb-1">{translate($ => $.historyStats.mostDefenses)}</p>
             {mostDefenses && mostDefenses.defenses > 0 ? (
               <>
                 <p className="text-lg font-black text-white uppercase">{fighters[mostDefenses.fighterId]?.lastName || translate($ => $.historyStats.unknown)}</p>
                 <p className="text-sm text-neutral-400">{translate($ => $.historyStats.defenseDivision, { count: mostDefenses.defenses, weightClass: formatWeightClass(mostDefenses.weightClass, language) })}</p>
               </>
             ) : <p className="text-sm text-neutral-600 italic">{translate($ => $.historyStats.noneYet)}</p>}
          </div>
          
          <div className="bg-neutral-950 border border-neutral-800 rounded p-4">
             <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold mb-1">{translate($ => $.historyStats.fastestKo)}</p>
             {fastestKO ? (
               <>
                 <p className="text-lg font-black text-white uppercase">{fighters[fastestKO.winnerId || '']?.lastName || translate($ => $.historyStats.unknown)}</p>
                 <p className="text-sm text-neutral-400">{translate($ => $.historyStats.roundTime, { round: fastestKO.round, time: fastestKO.time })}</p>
               </>
             ) : <p className="text-sm text-neutral-600 italic">{translate($ => $.historyStats.noneYet)}</p>}
          </div>
          <div className="bg-neutral-950 border border-neutral-800 rounded p-4">
             <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold mb-1">{translate($ => $.historyStats.highestAttendance)}</p>
             {biggestEvent && biggestEvent.attendance > 0 ? (
               <>
                 <p className="text-lg font-black text-white uppercase">{biggestEvent.name}</p>
                 <p className="text-sm text-neutral-400">{translate($ => $.historyStats.fanCount, { value: formatNumber(biggestEvent.attendance, language) })}</p>
               </>
             ) : <p className="text-sm text-neutral-600 italic">{translate($ => $.historyStats.noneYet)}</p>}
          </div>
          <div className="bg-neutral-950 border border-neutral-800 rounded p-4">
             <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold mb-1">{translate($ => $.historyStats.mostProfitable)}</p>
             {mostProfitableEvent && mostProfitableEvent.profit > 0 ? (
               <>
                 <p className="text-lg font-black text-white uppercase">{mostProfitableEvent.name}</p>
                 <p className="text-sm text-green-500">{formatCurrency(mostProfitableEvent.profit, language)}</p>
               </>
             ) : <p className="text-sm text-neutral-600 italic">{translate($ => $.historyStats.noneYet)}</p>}
          </div>
          <div className="bg-neutral-950 border border-neutral-800 rounded p-4">
             <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold mb-1">{translate($ => $.historyStats.biggestLoss)}</p>
             {biggestLossEvent && biggestLossEvent.profit < 0 ? (
               <>
                 <p className="text-lg font-black text-white uppercase">{biggestLossEvent.name}</p>
                 <p className="text-sm text-red-500">{formatCurrency(biggestLossEvent.profit, language)}</p>
               </>
             ) : <p className="text-sm text-neutral-600 italic">{translate($ => $.historyStats.noneYet)}</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Calendar className="text-blue-500" /> {translate($ => $.historyStats.pastEvents)}
          </h2>
          {events.length === 0 ? (
            <p className="text-neutral-500 italic">{translate($ => $.historyStats.noEvents)}</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
              {events.map(e => {
                const isExpanded = expandedEventId === e.id;
                const eventLedger = (financeLedger || []).filter(l => l.eventId === e.id);
                return (
                  <div key={e.id} className="bg-neutral-950 rounded border border-neutral-800">
                    <div
                      className="p-3 flex justify-between items-center cursor-pointer hover:bg-neutral-800/50 transition-colors"
                      onClick={() => setExpandedEventId(isExpanded ? null : e.id)}
                    >
                      <div>
                        <h3 className="font-bold text-white">{e.name}</h3>
                        <p className="text-xs text-neutral-500">
                          {translate($ => $.historyStats.eventSummary, {
                            date: formatDate(e.date, language),
                            value: formatNumber(e.attendance, language)
                          })}
                        </p>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <p className={`text-sm font-bold ${e.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {e.profit >= 0 ? '+' : ''}{formatCurrency(e.profit, language)}
                        </p>
                        <span className="text-neutral-600 text-xs">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-neutral-800 p-3 space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="space-y-1">
                            <p className="text-xs text-neutral-500 uppercase font-bold tracking-wider">{translate($ => $.historyStats.revenue)}</p>
                            <p className="text-neutral-300 flex justify-between"><span>{translate($ => $.historyStats.gateRevenue)}</span><span className="text-green-400 font-mono">{formatCurrency(e.gateRevenue ?? 0, language)}</span></p>
                            <p className="text-neutral-300 flex justify-between"><span>{translate($ => $.historyStats.broadcastDeal)}</span><span className="text-green-400 font-mono">{formatCurrency((e.broadcastRevenue ?? 0) - (e.gpBonusRevenue ?? 0), language)}</span></p>
                            {e.gpBonusRevenue ? (
                              <p className="text-purple-400 flex justify-between"><span>{translate($ => $.historyStats.gpFinalBoost)}</span><span className="text-green-400 font-mono">+{formatCurrency(e.gpBonusRevenue, language)}</span></p>
                            ) : null}
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-neutral-500 uppercase font-bold tracking-wider">{translate($ => $.historyStats.costs)}</p>
                            <p className="text-neutral-300 flex justify-between"><span>{translate($ => $.historyStats.venue)}</span><span className="text-red-400 font-mono">{formatCurrency(-(e.venueCost ?? 0), language)}</span></p>
                            <p className="text-neutral-300 flex justify-between"><span>{translate($ => $.historyStats.marketing)}</span><span className="text-red-400 font-mono">{formatCurrency(-(e.marketingCost ?? 0), language)}</span></p>
                            <p className="text-neutral-300 flex justify-between"><span>{translate($ => $.historyStats.fighterPay)}</span><span className="text-red-400 font-mono">{formatCurrency(-(e.fighterBasePay ?? 0), language)}</span></p>
                            <p className="text-neutral-300 flex justify-between"><span>{translate($ => $.historyStats.winBonuses)}</span><span className="text-red-400 font-mono">{formatCurrency(-(e.fighterWinBonuses ?? 0), language)}</span></p>
                          </div>
                        </div>
                        <div className="border-t border-neutral-800 pt-2 flex justify-between items-center">
                          <span className="text-sm font-bold text-white">{translate($ => $.historyStats.netProfitLoss)}</span>
                          <span className={`text-sm font-bold font-mono ${e.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {e.profit >= 0 ? '+' : ''}{formatCurrency(e.profit, language)}
                          </span>
                        </div>
                        {eventLedger.length > 0 && (
                          <div className="border-t border-neutral-800 pt-2">
                            <p className="text-xs text-neutral-500 uppercase font-bold tracking-wider mb-1">{translate($ => $.historyStats.ledgerEntries)}</p>
                            <div className="space-y-0.5 max-h-32 overflow-y-auto">
                              {eventLedger.map(l => (
                                <div key={l.id} className="flex justify-between text-xs">
                                  <span className={`${l.isSummary ? 'text-blue-400 italic' : 'text-neutral-400'}`}>{l.description}</span>
                                  <span className={`font-mono ${l.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {l.amount >= 0 ? '+' : ''}{formatCurrency(l.amount, language)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Star className="text-yellow-500" /> {translate($ => $.historyStats.highestRated)}
          </h2>
          {topFights.length === 0 ? (
            <p className="text-neutral-500 italic">{translate($ => $.historyStats.noRecordedFights)}</p>
          ) : (
            <div className="space-y-3">
              {topFights.map(f => {
                const red = fighters[f.redFighterId];
                const blue = fighters[f.blueFighterId];
                const winner = f.winnerId === red?.id ? red : blue;
                return (
                  <div
                    key={f.id}
                    className="bg-neutral-950 p-3 rounded border border-neutral-800 cursor-pointer hover:bg-neutral-800 transition-colors"
                    onClick={() => setView('fight-detail', { fightArchiveId: f.id })}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs text-yellow-500 font-bold uppercase">{translate($ => $.historyStats.rating, { value: f.performanceRating })}</span>
                      <span className="text-xs text-neutral-500">{formatDate(f.date, language)}</span>
                    </div>
                    <p className="font-bold text-white text-sm">
                      {red && <FighterRankBadge fighterId={red.id} />} {red ? `${red.firstName} ${red.lastName}` : translate($ => $.historyStats.unknown)}
                      <span className="text-neutral-500 mx-2">{translate($ => $.historyStats.versus)}</span>
                      {blue && <FighterRankBadge fighterId={blue.id} />} {blue ? `${blue.firstName} ${blue.lastName}` : translate($ => $.historyStats.unknown)}
                    </p>
                    <p className="text-xs text-neutral-400 mt-1">
                      {translate($ => $.historyStats.wonBy, {
                        winner: winner?.lastName ?? translate($ => $.historyStats.unknown),
                        method: formatFightMethod(f.method, language),
                        round: f.round
                      })}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Trophy className="text-yellow-500" /> {translate($ => $.historyStats.titleLineage)}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {WEIGHT_CLASSES.map(wc => {
            const history = titleHistory.filter(th => th.weightClass === wc).sort((a, b) => new Date(b.dateWon).getTime() - new Date(a.dateWon).getTime());
            const beltId = `belt_${wc.toLowerCase()}`;
            const belt = belts[beltId];

            return (
              <div key={wc} className="bg-neutral-950 border border-neutral-800 rounded-lg p-4">
                <h3 className="font-bold text-yellow-500 uppercase tracking-wider border-b border-neutral-800 pb-2 mb-4">
                  {belt ? belt.shortName : formatWeightClass(wc, language)}
                </h3>
                {history.length === 0 ? (
                  <p className="text-sm text-neutral-500 italic">{translate($ => $.historyStats.noTitleHistory)}</p>
                ) : (
                  <div className="space-y-4">
                    {history.map(th => {
                      const fighter = fighters[th.fighterId];
                      const isCurrent = th.status === 'active';
                      return (
                        <div key={th.id} className={`pl-4 border-l-2 ${isCurrent ? 'border-yellow-500' : th.status === 'cleared' ? 'border-neutral-800' : 'border-neutral-700'} relative`}>
                          <p className="text-[10px] text-neutral-500 font-mono mb-1">
                            {formatDate(th.dateWon, language)} - {th.dateLost ? formatDate(th.dateLost, language) : translate($ => $.historyStats.present)}
                          </p>
                          <div className="flex items-center gap-2">
                            {fighter && <FighterRankBadge fighterId={fighter.id} />}
                            <p className={`font-bold ${isCurrent ? 'text-yellow-500' : th.status === 'cleared' ? 'text-neutral-500 line-through' : 'text-white'}`}>
                              {fighter ? `${fighter.firstName} ${fighter.lastName}` : translate($ => $.historyStats.unknown)}
                            </p>
                            {th.beltType === 'interim' && (
                              <span className="text-[9px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded border border-neutral-700">{translate($ => $.historyStats.interim)}</span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-400 mt-0.5">
                            {translate(
                              th.defenses === 1
                                ? $ => $.historyStats.successfulDefense
                                : $ => $.historyStats.successfulDefenses,
                              { count: th.defenses }
                            )}
                            {th.note && ` • ${th.note}`}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      </Panel>
    </div>
  );
}
