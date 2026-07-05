import React from 'react';
import { useGameStore } from '../store/gameStore';
import { Calendar, AlertTriangle, RefreshCw, Trash2, ArrowRight, Play } from 'lucide-react';
import { SeasonCalendarSlot } from '../types/game';

export default function CalendarPage() {
  const { 
    currentDate, 
    seasonPlans = {}, 
    events = {}, 
    eventArchive = {}, 
    generateCurrentYearPlan, 
    cancelCalendarSlot, 
    setView 
  } = useGameStore();

  const currentYear = new Date(currentDate).getFullYear();
  const plan = seasonPlans[currentYear];

  const handleRebuild = () => {
    if (window.confirm("Are you sure you want to rebuild the plan for this year? This will regenerate all planned slots.")) {
      generateCurrentYearPlan();
    }
  };

  const slots = plan?.slots || [];
  slots.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Count stats
  const completedCount = slots.filter(s => s.status === 'completed').length;
  const scheduledCount = slots.filter(s => s.status === 'scheduled').length;
  const plannedCount = slots.filter(s => s.status === 'planned').length;
  const missedCount = slots.filter(s => s.status === 'missed').length;
  const cancelledCount = slots.filter(s => s.status === 'cancelled').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-neutral-900 p-6 rounded-lg border border-neutral-800 gap-4">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Calendar className="text-blue-500 w-8 h-8" /> Annual Planning Calendar
          </h1>
          <p className="text-neutral-400 mt-1">
            Current Date: <span className="font-mono text-white font-bold">{currentDate}</span> | Season Year: <span className="text-white font-bold">{currentYear}</span>
          </p>
        </div>
        <button
          onClick={handleRebuild}
          className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white font-bold px-4 py-2 rounded border border-neutral-700 transition-colors text-sm"
        >
          <RefreshCw size={16} /> Rebuild Year Plan
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 text-center">
          <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold">Planned</p>
          <p className="text-2xl font-black text-blue-400 mt-1">{plannedCount}</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 text-center">
          <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold">Scheduled</p>
          <p className="text-2xl font-black text-purple-400 mt-1">{scheduledCount}</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 text-center">
          <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold">Completed</p>
          <p className="text-2xl font-black text-green-500 mt-1">{completedCount}</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 text-center">
          <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold">Missed</p>
          <p className="text-2xl font-black text-orange-500 mt-1">{missedCount}</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 text-center">
          <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold">Cancelled</p>
          <p className="text-2xl font-black text-red-500 mt-1">{cancelledCount}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
        {slots.length === 0 ? (
          <div className="text-center py-12 text-neutral-500 space-y-4">
            <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto" />
            <p>No calendar plan exists for the year {currentYear}.</p>
            <button
              onClick={() => generateCurrentYearPlan()}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded transition-colors text-sm"
            >
              Generate Plan Now
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 text-[10px] text-neutral-400 uppercase tracking-wider font-bold">
                  <th className="py-3">Date</th>
                  <th className="py-3">Slot Type</th>
                  <th className="py-3">Status</th>
                  <th className="py-3">Target Details</th>
                  <th className="py-3">Linked Event</th>
                  <th className="py-3">Notes / Delays</th>
                  <th className="py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/40 text-sm">
                {slots.map(s => {
                  const eventObj = events[s.eventId || ''] || eventArchive[s.eventId || ''];
                  const isPast = s.date < currentDate;
                  const isApproaching = s.date >= currentDate && s.date <= addDaysStr(currentDate, 28);

                  return (
                    <tr 
                      key={s.id} 
                      className={`hover:bg-neutral-800/20 transition-colors ${
                        isApproaching && s.status === 'planned' ? 'bg-blue-950/10 border-l-2 border-blue-500' : ''
                      }`}
                    >
                      {/* Date */}
                      <td className="py-4 font-mono text-xs text-neutral-300">
                        <div className="font-bold">{s.date}</div>
                        {isPast && s.status === 'planned' && (
                          <div className="text-[10px] text-orange-500 uppercase font-black mt-0.5">Overdue</div>
                        )}
                        {isApproaching && s.status === 'planned' && (
                          <div className="text-[10px] text-blue-400 uppercase font-black mt-0.5">Approaching</div>
                        )}
                      </td>

                      {/* Slot Type */}
                      <td className="py-4">
                        <span className={`px-2 py-0.5 rounded font-black uppercase text-[10px] tracking-wide ${
                          s.type === 'tentpole_event' ? 'bg-purple-900/40 text-purple-400' :
                          s.type === 'title_fight_card' ? 'bg-yellow-900/40 text-yellow-400' :
                          s.type === 'grand_prix_round' ? 'bg-blue-900/40 text-blue-400' :
                          s.type === 'recovery_gap' ? 'bg-neutral-850 text-neutral-500 border border-neutral-800' :
                          'bg-neutral-950 text-neutral-400'
                        }`}>
                          {s.type.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4">
                        <span className={`px-2 py-0.5 rounded font-black uppercase text-[10px] tracking-wide ${
                          s.status === 'completed' ? 'bg-green-950 text-green-400 border border-green-900/50' :
                          s.status === 'scheduled' ? 'bg-blue-950 text-blue-400 border border-blue-900/50' :
                          s.status === 'missed' ? 'bg-orange-950 text-orange-400 border border-orange-900/50' :
                          s.status === 'cancelled' ? 'bg-red-950 text-red-400 border border-red-900/50' :
                          'bg-neutral-900 text-neutral-500'
                        }`}>
                          {s.status}
                        </span>
                      </td>

                      {/* Target Details */}
                      <td className="py-4 text-xs">
                        {s.targetWeightClass && (
                          <span className="text-white font-semibold bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-800">
                            {s.targetWeightClass}
                          </span>
                        )}
                        {s.tournamentRound && (
                          <div className="text-[10px] text-purple-400 uppercase font-black mt-1">
                            GP {s.tournamentRound}
                          </div>
                        )}
                        {!s.targetWeightClass && !s.tournamentRound && (
                          <span className="text-neutral-500">—</span>
                        )}
                      </td>

                      {/* Linked Event */}
                      <td className="py-4">
                        {eventObj ? (
                          <span 
                            onClick={() => {
                              if ('isCompleted' in eventObj ? eventObj.isCompleted : true) {
                                setView('history'); // view summary
                              } else {
                                setView('event-builder', { eventId: eventObj.id });
                              }
                            }}
                            className="text-blue-400 hover:underline font-bold cursor-pointer flex items-center gap-1"
                          >
                            {eventObj.name} <ArrowRight size={12} />
                          </span>
                        ) : (
                          <span className="text-neutral-500">—</span>
                        )}
                      </td>

                      {/* Notes / Delays */}
                      <td className="py-4 text-xs text-neutral-400 max-w-[200px] truncate" title={s.notes?.join('\n')}>
                        {s.notes && s.notes.length > 0 ? (
                          <div className="space-y-0.5">
                            {s.notes.map((n, idx) => (
                              <div key={idx} className="text-neutral-400 text-[11px]">
                                {n}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-neutral-600 italic">No notes</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {s.status === 'planned' && s.type !== 'recovery_gap' && (
                            <button
                              onClick={() => setView('event-builder', { calendarSlotId: s.id })}
                              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white font-bold px-2.5 py-1 rounded text-xs transition"
                            >
                              <Play size={12} /> Book Card
                            </button>
                          )}
                          {s.status === 'planned' && (
                            <button
                              onClick={() => cancelCalendarSlot(s.id)}
                              className="flex items-center gap-1 bg-neutral-850 hover:bg-red-950 text-neutral-400 hover:text-red-400 px-2 py-1 rounded text-xs transition border border-neutral-800 hover:border-red-900"
                              title="Cancel Slot"
                            >
                              <Trash2 size={12} /> Cancel
                            </button>
                          )}
                          {s.status !== 'planned' && (
                            <span className="text-neutral-600 font-medium text-xs">Locked</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
