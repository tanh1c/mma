import React from 'react';
import { AlertTriangle, ArrowRight, Calendar, Play, RefreshCw, Trash2 } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { diagnoseActiveTournaments } from '../lib/game/tournament';
import { getGrandPrixExplanation } from '../lib/game/insights';
import { Button, DataSurface, PageHeader, Panel, Stat, StatusBadge, type StatusTone } from '../components/ui';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../store/settingsStore';
import { formatCalendarSlotStatus, formatCalendarSlotType, formatDate, formatTournamentStatus, formatWeightClass } from '../lib/localization';

const slotTone = (type: string): StatusTone => {
  if (type === 'title_fight_card') return 'warning';
  if (type === 'tentpole_event' || type === 'grand_prix_round') return 'success';
  return 'neutral';
};

const statusTone = (status: string): StatusTone => {
  if (status === 'completed') return 'success';
  if (status === 'missed') return 'warning';
  if (status === 'cancelled') return 'danger';
  return 'neutral';
};

export default function CalendarPage() {
  const { t } = useTranslation('translation');
  const language = useSettingsStore(state => state.language);
  const gameState = useGameStore();
  const { currentDate, seasonPlans = {}, events = {}, eventArchive = {}, tournaments = {}, generateCurrentYearPlan, cancelCalendarSlot, setView } = gameState;

  const [filter, setFilter] = React.useState<'All' | 'Regular' | 'Tentpole' | 'Title' | 'GP Window' | 'GP Round' | 'Recovery' | 'Missed/Cancelled'>('All');
  const currentYear = new Date(currentDate).getFullYear();
  const plan = seasonPlans[currentYear];
  const slots = plan?.slots || [];
  slots.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const diagnoses = React.useMemo(() => Object.fromEntries(diagnoseActiveTournaments(gameState).map(diagnosis => [diagnosis.tournamentId, diagnosis])), [gameState]);

  const handleRebuild = () => {
    if (window.confirm(t($ => $.calendar.rebuildConfirm))) generateCurrentYearPlan();
  };

  const completedCount = slots.filter(slot => slot.status === 'completed').length;
  const scheduledCount = slots.filter(slot => slot.status === 'scheduled').length;
  const plannedCount = slots.filter(slot => slot.status === 'planned').length;
  const missedCount = slots.filter(slot => slot.status === 'missed').length;
  const cancelledCount = slots.filter(slot => slot.status === 'cancelled').length;
  const filteredSlots = slots.filter(slot => {
    if (filter === 'All') return true;
    if (filter === 'Regular') return slot.type === 'regular_event';
    if (filter === 'Tentpole') return slot.type === 'tentpole_event';
    if (filter === 'Title') return slot.type === 'title_fight_card';
    if (filter === 'GP Window') return slot.type === 'grand_prix_window';
    if (filter === 'GP Round') return slot.type === 'grand_prix_round';
    if (filter === 'Recovery') return slot.type === 'recovery_gap';
    return slot.status === 'missed' || slot.status === 'cancelled';
  });
  const filterLabels = {
    All: t($ => $.calendar.filters.all),
    Regular: t($ => $.calendar.filters.regular),
    Tentpole: t($ => $.calendar.filters.tentpole),
    Title: t($ => $.calendar.filters.title),
    'GP Window': t($ => $.calendar.filters.gpWindow),
    'GP Round': t($ => $.calendar.filters.gpRound),
    Recovery: t($ => $.calendar.filters.recovery),
    'Missed/Cancelled': t($ => $.calendar.filters.missedCancelled)
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <PageHeader
        eyebrow={t($ => $.calendar.seasonYear, { year: currentYear })}
        title={t($ => $.calendar.title)}
        description={t($ => $.calendar.currentDate, { date: formatDate(currentDate, language) })}
        actions={<Button variant="secondary" onClick={handleRebuild} className="inline-flex items-center gap-2"><RefreshCw size={16} /> {t($ => $.calendar.rebuild)}</Button>}
      />

      <Panel className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label={t($ => $.calendar.counts.planned)} value={plannedCount} />
        <Stat label={t($ => $.calendar.counts.scheduled)} value={scheduledCount} />
        <Stat label={t($ => $.calendar.counts.completed)} value={completedCount} />
        <Stat label={t($ => $.calendar.counts.missed)} value={missedCount} />
        <Stat label={t($ => $.calendar.counts.cancelled)} value={cancelledCount} />
      </Panel>

      <Panel className="flex flex-wrap gap-2 p-3">
        {(['All', 'Regular', 'Tentpole', 'Title', 'GP Window', 'GP Round', 'Recovery', 'Missed/Cancelled'] as const).map(value => (
          <Button
            key={value}
            variant={filter === value ? 'primary' : 'quiet'}
            onClick={() => setFilter(value)}
            title={value === 'GP Round' ? t($ => $.calendar.gpRoundHelp) : undefined}
            className="min-h-9 px-3 text-xs"
          >
            {filterLabels[value]}
          </Button>
        ))}
      </Panel>

      {slots.length === 0 ? (
        <Panel className="py-12 text-center">
          <AlertTriangle className="mx-auto text-amber-300" size={32} />
          <p className="mt-4 text-sm text-neutral-400">{t($ => $.calendar.noPlan, { year: currentYear })}</p>
          <Button variant="primary" onClick={generateCurrentYearPlan} className="mt-5">{t($ => $.calendar.generate)}</Button>
        </Panel>
      ) : (
        <DataSurface>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-[#2a2c31] bg-black/10 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-normal">{t($ => $.calendar.columns.date)}</th>
                  <th className="px-4 py-3 font-normal">{t($ => $.calendar.columns.slotType)}</th>
                  <th className="px-4 py-3 font-normal">{t($ => $.calendar.columns.status)}</th>
                  <th className="px-4 py-3 font-normal">{t($ => $.calendar.columns.targetDetails)}</th>
                  <th className="px-4 py-3 font-normal">{t($ => $.calendar.columns.linkedEvent)}</th>
                  <th className="px-4 py-3 font-normal">{t($ => $.calendar.columns.notes)}</th>
                  <th className="px-4 py-3 text-right font-normal">{t($ => $.calendar.columns.actions)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2c31]">
                {filteredSlots.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-neutral-500">{t($ => $.calendar.noMatches)}</td></tr>
                ) : filteredSlots.map(slot => {
                  const event = events[slot.eventId || ''] || eventArchive[slot.eventId || ''];
                  const isPast = slot.date < currentDate;
                  const isApproaching = slot.date >= currentDate && slot.date <= addDaysStr(currentDate, 28);
                  const warnings: string[] = [];
                  if (event && slot.date !== event.date) warnings.push(t($ => $.calendar.warnings.dateMismatch));
                  if (slot.type === 'grand_prix_round' && !slot.tournamentId) warnings.push(t($ => $.calendar.warnings.noTournament));
                  if (isPast && slot.status === 'planned' && !(slot.notes || []).some(note => note.toLowerCase().includes('delayed') || note.toLowerCase().includes('rescheduled'))) warnings.push(t($ => $.calendar.warnings.overdueSlot));
                  if ((slot.notes || []).some(note => note.toLowerCase().includes('delayed') || note.toLowerCase().includes('delay'))) warnings.push(t($ => $.calendar.warnings.delayedRound));
                  const gpExplanation = getGrandPrixExplanation(slot, slot.tournamentId ? diagnoses[slot.tournamentId] : undefined, language);

                  return (
                    <tr key={slot.id} className={isApproaching && slot.status === 'planned' ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'}>
                      <td className="px-4 py-4 font-mono text-xs text-neutral-300">
                        <p>{formatDate(slot.date, language)}</p>
                        {isPast && slot.status === 'planned' && <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-amber-300">{t($ => $.calendar.overdue)}</p>}
                        {isApproaching && slot.status === 'planned' && <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-neutral-400">{t($ => $.calendar.approaching)}</p>}
                      </td>
                      <td className="px-4 py-4"><StatusBadge tone={slotTone(slot.type)}><span title={slot.type === 'grand_prix_round' ? t($ => $.calendar.gpRoundHelp) : undefined}>{formatCalendarSlotType(slot.type, language)}</span></StatusBadge></td>
                      <td className="px-4 py-4"><StatusBadge tone={statusTone(slot.status)}>{formatCalendarSlotStatus(slot.status, language)}</StatusBadge></td>
                      <td className="px-4 py-4 text-xs">
                        {slot.targetWeightClass && <span className="rounded border border-[#2a2c31] px-2 py-1 text-neutral-300">{formatWeightClass(slot.targetWeightClass, language)}</span>}
                        {slot.tournamentRound && <p title={t($ => $.calendar.gpRoundHelp)} className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">{t($ => $.calendar.gpRound, { round: slot.tournamentRound })}</p>}
                        {slot.tournamentId && tournaments[slot.tournamentId] && <button type="button" onClick={() => setView('tournaments')} className="mt-2 block text-left text-xs text-neutral-300 hover:text-white hover:underline">{tournaments[slot.tournamentId].name} ({formatTournamentStatus(tournaments[slot.tournamentId].status, language)})</button>}
                        {!slot.targetWeightClass && !slot.tournamentRound && !slot.tournamentId && <span className="text-neutral-600">—</span>}
                      </td>
                      <td className="px-4 py-4">
                        {event ? <button type="button" onClick={() => setView('isCompleted' in event ? (event.isCompleted ? 'history' : 'event-builder') : 'history', !('isCompleted' in event) || event.isCompleted ? undefined : { eventId: event.id })} className="inline-flex items-center gap-1 text-left text-sm text-neutral-300 hover:text-white hover:underline">{event.name} <ArrowRight size={12} /></button> : <span className="text-neutral-600">—</span>}
                      </td>
                      <td className="max-w-[220px] px-4 py-4 text-xs text-neutral-400" title={slot.notes?.join('\n')}>
                        {warnings.length > 0 && <div className="mb-2 flex flex-wrap gap-1">{warnings.map(warning => <StatusBadge key={warning} tone="danger"><AlertTriangle size={10} /> {warning}</StatusBadge>)}</div>}
                        {gpExplanation && <div className="mb-2 border-l border-purple-700 pl-2 text-[10px] text-purple-200" title={gpExplanation.details.join('\n')}><p className="font-mono uppercase tracking-[0.12em] text-purple-400">{t($ => $.calendar.gpStatus, { status: gpExplanation.status })}</p>{gpExplanation.details.slice(0, 2).map(detail => <p key={detail} className="truncate">{detail}</p>)}{gpExplanation.retryDate && <p className="mt-1 text-neutral-400">{t($ => $.calendar.retry, { date: formatDate(gpExplanation.retryDate, language) })}</p>}</div>}
                        {slot.notes?.length ? <div className="space-y-1">{slot.notes.map((note, index) => <p key={index} className="truncate">{note}</p>)}</div> : !gpExplanation && warnings.length === 0 && <span className="text-neutral-600">{t($ => $.calendar.noNotes)}</span>}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          {slot.status === 'planned' && slot.type !== 'recovery_gap' && <Button variant="primary" onClick={() => setView('event-builder', { calendarSlotId: slot.id })} className="min-h-9 px-3 text-xs"><Play size={12} /> {t($ => $.calendar.bookCard)}</Button>}
                          {slot.status === 'planned' && <Button variant="danger" onClick={() => cancelCalendarSlot(slot.id)} title={t($ => $.calendar.cancelSlot)} className="min-h-9 px-3 text-xs"><Trash2 size={12} /> {t($ => $.calendar.cancel)}</Button>}
                          {slot.status !== 'planned' && <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-600">{t($ => $.calendar.locked)}</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DataSurface>
      )}
    </div>
  );
}

function addDaysStr(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}
