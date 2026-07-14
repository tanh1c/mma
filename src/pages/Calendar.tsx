import React from 'react';
import { AlertTriangle, ArrowRight, Calendar, Play, RefreshCw, Trash2 } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { diagnoseActiveTournaments } from '../lib/game/tournament';
import { getGrandPrixExplanation } from '../lib/game/insights';
import { Button, DataSurface, PageHeader, Panel, Stat, StatusBadge, type StatusTone } from '../components/ui';

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
  const gameState = useGameStore();
  const { currentDate, seasonPlans = {}, events = {}, eventArchive = {}, tournaments = {}, generateCurrentYearPlan, cancelCalendarSlot, setView } = gameState;

  const [filter, setFilter] = React.useState<'All' | 'Regular' | 'Tentpole' | 'Title' | 'GP Window' | 'GP Round' | 'Recovery' | 'Missed/Cancelled'>('All');
  const currentYear = new Date(currentDate).getFullYear();
  const plan = seasonPlans[currentYear];
  const slots = plan?.slots || [];
  slots.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const diagnoses = React.useMemo(() => Object.fromEntries(diagnoseActiveTournaments(gameState).map(diagnosis => [diagnosis.tournamentId, diagnosis])), [gameState]);

  const handleRebuild = () => {
    if (window.confirm('Are you sure you want to rebuild the plan for this year? This will regenerate all planned slots.')) generateCurrentYearPlan();
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

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <PageHeader
        eyebrow={`Season year ${currentYear}`}
        title="Annual Planning Calendar"
        description={`Current date: ${currentDate}`}
        actions={<Button variant="secondary" onClick={handleRebuild} className="inline-flex items-center gap-2"><RefreshCw size={16} /> Rebuild year plan</Button>}
      />

      <Panel className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Planned" value={plannedCount} />
        <Stat label="Scheduled" value={scheduledCount} />
        <Stat label="Completed" value={completedCount} />
        <Stat label="Missed" value={missedCount} />
        <Stat label="Cancelled" value={cancelledCount} />
      </Panel>

      <Panel className="flex flex-wrap gap-2 p-3">
        {(['All', 'Regular', 'Tentpole', 'Title', 'GP Window', 'GP Round', 'Recovery', 'Missed/Cancelled'] as const).map(value => (
          <Button
            key={value}
            variant={filter === value ? 'primary' : 'quiet'}
            onClick={() => setFilter(value)}
            title={value === 'GP Round' ? 'A scheduled Grand Prix bracket stage.' : undefined}
            className="min-h-9 px-3 text-xs"
          >
            {value}
          </Button>
        ))}
      </Panel>

      {slots.length === 0 ? (
        <Panel className="py-12 text-center">
          <AlertTriangle className="mx-auto text-amber-300" size={32} />
          <p className="mt-4 text-sm text-neutral-400">No calendar plan exists for the year {currentYear}.</p>
          <Button variant="primary" onClick={generateCurrentYearPlan} className="mt-5">Generate plan now</Button>
        </Panel>
      ) : (
        <DataSurface>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-[#2a2c31] bg-black/10 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-normal">Date</th>
                  <th className="px-4 py-3 font-normal">Slot type</th>
                  <th className="px-4 py-3 font-normal">Status</th>
                  <th className="px-4 py-3 font-normal">Target details</th>
                  <th className="px-4 py-3 font-normal">Linked event</th>
                  <th className="px-4 py-3 font-normal">Notes / delays</th>
                  <th className="px-4 py-3 text-right font-normal">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2c31]">
                {filteredSlots.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-neutral-500">No slots found matching the selected filter.</td></tr>
                ) : filteredSlots.map(slot => {
                  const event = events[slot.eventId || ''] || eventArchive[slot.eventId || ''];
                  const isPast = slot.date < currentDate;
                  const isApproaching = slot.date >= currentDate && slot.date <= addDaysStr(currentDate, 28);
                  const warnings: string[] = [];
                  if (event && slot.date !== event.date) warnings.push('Date Mismatch');
                  if (slot.type === 'grand_prix_round' && !slot.tournamentId) warnings.push('No Tournament');
                  if (isPast && slot.status === 'planned' && !(slot.notes || []).some(note => note.toLowerCase().includes('delayed') || note.toLowerCase().includes('rescheduled'))) warnings.push('Overdue Slot');
                  if ((slot.notes || []).some(note => note.toLowerCase().includes('delayed') || note.toLowerCase().includes('delay'))) warnings.push('Delayed Round');
                  const gpExplanation = getGrandPrixExplanation(slot, slot.tournamentId ? diagnoses[slot.tournamentId] : undefined);

                  return (
                    <tr key={slot.id} className={isApproaching && slot.status === 'planned' ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'}>
                      <td className="px-4 py-4 font-mono text-xs text-neutral-300">
                        <p>{slot.date}</p>
                        {isPast && slot.status === 'planned' && <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-amber-300">Overdue</p>}
                        {isApproaching && slot.status === 'planned' && <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-neutral-400">Approaching</p>}
                      </td>
                      <td className="px-4 py-4"><StatusBadge tone={slotTone(slot.type)}><span title={slot.type === 'grand_prix_round' ? 'A scheduled Grand Prix bracket stage.' : undefined}>{slot.type.replace('_', ' ')}</span></StatusBadge></td>
                      <td className="px-4 py-4"><StatusBadge tone={statusTone(slot.status)}>{slot.status}</StatusBadge></td>
                      <td className="px-4 py-4 text-xs">
                        {slot.targetWeightClass && <span className="rounded border border-[#2a2c31] px-2 py-1 text-neutral-300">{slot.targetWeightClass}</span>}
                        {slot.tournamentRound && <p title="A scheduled Grand Prix bracket stage." className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">GP {slot.tournamentRound}</p>}
                        {slot.tournamentId && tournaments[slot.tournamentId] && <button type="button" onClick={() => setView('tournaments')} className="mt-2 block text-left text-xs text-neutral-300 hover:text-white hover:underline">{tournaments[slot.tournamentId].name} ({tournaments[slot.tournamentId].status})</button>}
                        {!slot.targetWeightClass && !slot.tournamentRound && !slot.tournamentId && <span className="text-neutral-600">—</span>}
                      </td>
                      <td className="px-4 py-4">
                        {event ? <button type="button" onClick={() => setView('isCompleted' in event ? (event.isCompleted ? 'history' : 'event-builder') : 'history', !('isCompleted' in event) || event.isCompleted ? undefined : { eventId: event.id })} className="inline-flex items-center gap-1 text-left text-sm text-neutral-300 hover:text-white hover:underline">{event.name} <ArrowRight size={12} /></button> : <span className="text-neutral-600">—</span>}
                      </td>
                      <td className="max-w-[220px] px-4 py-4 text-xs text-neutral-400" title={slot.notes?.join('\n')}>
                        {warnings.length > 0 && <div className="mb-2 flex flex-wrap gap-1">{warnings.map(warning => <StatusBadge key={warning} tone="danger"><AlertTriangle size={10} /> {warning}</StatusBadge>)}</div>}
                        {gpExplanation && <div className="mb-2 border-l border-purple-700 pl-2 text-[10px] text-purple-200" title={gpExplanation.details.join('\n')}><p className="font-mono uppercase tracking-[0.12em] text-purple-400">GP status: {gpExplanation.status}</p>{gpExplanation.details.slice(0, 2).map(detail => <p key={detail} className="truncate">{detail}</p>)}{gpExplanation.retryDate && <p className="mt-1 text-neutral-400">Retry: {gpExplanation.retryDate}</p>}</div>}
                        {slot.notes?.length ? <div className="space-y-1">{slot.notes.map((note, index) => <p key={index} className="truncate">{note}</p>)}</div> : !gpExplanation && warnings.length === 0 && <span className="text-neutral-600">No notes</span>}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          {slot.status === 'planned' && slot.type !== 'recovery_gap' && <Button variant="primary" onClick={() => setView('event-builder', { calendarSlotId: slot.id })} className="min-h-9 px-3 text-xs"><Play size={12} /> Book card</Button>}
                          {slot.status === 'planned' && <Button variant="danger" onClick={() => cancelCalendarSlot(slot.id)} title="Cancel Slot" className="min-h-9 px-3 text-xs"><Trash2 size={12} /> Cancel</Button>}
                          {slot.status !== 'planned' && <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-600">Locked</span>}
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
