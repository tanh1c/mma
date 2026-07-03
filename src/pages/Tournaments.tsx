import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { WeightClass } from '../types/game';
import { WEIGHT_CLASSES } from '../lib/game/constants';
import { Award, Plus, Calendar, AlertTriangle, X, Check, ArrowRight } from 'lucide-react';

export default function Tournaments() {
  const { 
    tournaments = {}, 
    fighters, 
    events, 
    currentDate,
    createTournament, 
    scheduleSemifinals, 
    scheduleFinal, 
    cancelTournament, 
    setView,
    fightArchive = {}
  } = useGameStore();

  const [isCreating, setIsCreating] = useState(false);
  const [selectedTourneyId, setSelectedTourneyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Completed' | 'Cancelled'>('All');

  // Form State
  const [name, setName] = useState('');
  const [weightClass, setWeightClass] = useState<WeightClass>('Lightweight');
  const [titleShotPromised, setTitleShotPromised] = useState(true);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [selectedReserves, setSelectedReserves] = useState<string[]>([]);

  // Scheduling State
  const [schedulingSlot, setSchedulingSlot] = useState<{ tourneyId: string, round: 'semifinal' | 'final' } | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>('');

  const activeTourneyList = Object.values(tournaments).filter(t => {
    if (statusFilter === 'All') return true;
    if (statusFilter === 'Active') return t.status === 'planned' || t.status === 'active';
    if (statusFilter === 'Completed') return t.status === 'completed';
    if (statusFilter === 'Cancelled') return t.status === 'cancelled';
    return true;
  });
  const selectedTourney = selectedTourneyId ? tournaments[selectedTourneyId] : null;

  // Filter signed, healthy, same-class, unbooked fighters for the GP creation form
  const eligibleFighters = Object.values(fighters).filter(f => 
    f.contract !== null && 
    f.weightClass === weightClass && 
    !f.injuryStatus && 
    (!f.medicalSuspension || f.medicalSuspension.daysRemaining <= 0) &&
    !Object.values(events).some(e => !e.isCompleted && e.fights.some(fight => fight.redCornerId === f.id || fight.blueCornerId === f.id))
  ).sort((a, b) => (b.rankingScore || 0) - (a.rankingScore || 0));

  const handleToggleParticipant = (id: string) => {
    if (selectedParticipants.includes(id)) {
      setSelectedParticipants(selectedParticipants.filter(pId => pId !== id));
    } else {
      if (selectedParticipants.length < 4) {
        setSelectedParticipants([...selectedParticipants, id]);
        setSelectedReserves(selectedReserves.filter(rId => rId !== id)); // cannot be both
      }
    }
  };

  const handleToggleReserve = (id: string) => {
    if (selectedReserves.includes(id)) {
      setSelectedReserves(selectedReserves.filter(rId => rId !== id));
    } else {
      if (selectedReserves.length < 2) {
        setSelectedReserves([...selectedReserves, id]);
        setSelectedParticipants(selectedParticipants.filter(pId => pId !== id)); // cannot be both
      }
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedParticipants.length !== 4) {
      alert("Please select exactly 4 participants.");
      return;
    }
    
    const gpName = name.trim() || `${weightClass} Grand Prix`;
    createTournament({
      weightClass,
      name: gpName,
      titleShotPromised,
      participantIds: selectedParticipants,
      reserveIds: selectedReserves
    });
    
    // reset form
    setIsCreating(false);
    setName('');
    setSelectedParticipants([]);
    setSelectedReserves([]);
  };

  const handleScheduleSubmit = () => {
    if (!selectedEventId || !schedulingSlot) return;
    
    if (schedulingSlot.round === 'semifinal') {
      scheduleSemifinals(schedulingSlot.tourneyId, selectedEventId);
    } else {
      scheduleFinal(schedulingSlot.tourneyId, selectedEventId);
    }
    
    setSchedulingSlot(null);
    setSelectedEventId('');
  };

  // Get upcoming uncompleted events
  const upcomingEvents = Object.values(events).filter(e => !e.isCompleted && e.date >= currentDate);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Award className="text-purple-400" /> GRAND PRIX TOURNAMENTS
          </h1>
          <p className="text-neutral-400 text-sm">Organize 4-man elimination brackets to determine number one contenders.</p>
        </div>
        {!isCreating && (
          <button 
            onClick={() => {
              setIsCreating(true);
              setSelectedTourneyId(null);
            }} 
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded flex items-center gap-1 transition-colors"
          >
            <Plus size={16} /> Create Grand Prix
          </button>
        )}
      </div>

      {isCreating ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 max-w-4xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-white">New Grand Prix Tournament</h2>
            <button 
              onClick={() => setIsCreating(false)} 
              className="text-neutral-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleCreate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <label className="text-xs text-neutral-400 uppercase font-bold">Tournament Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Lightweight Road to Gold" 
                  className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-white text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-neutral-400 uppercase font-bold">Weight Class</label>
                <select 
                  value={weightClass}
                  onChange={e => {
                    setWeightClass(e.target.value as WeightClass);
                    setSelectedParticipants([]);
                    setSelectedReserves([]);
                  }}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-white text-sm"
                >
                  {WEIGHT_CLASSES.map(wc => (
                    <option key={wc} value={wc}>{wc}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input 
                  type="checkbox" 
                  id="titleShot" 
                  checked={titleShotPromised}
                  onChange={e => setTitleShotPromised(e.target.checked)}
                  className="w-4 h-4 accent-purple-600 rounded bg-neutral-950 border-neutral-800"
                />
                <label htmlFor="titleShot" className="text-sm font-semibold text-neutral-300">
                  Promise Undisputed Title Shot to Winner
                </label>
              </div>
            </div>

            <div className="border-t border-neutral-800 pt-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Select 4 Participants</h3>
                <span className="text-xs font-semibold text-purple-400 bg-purple-900/30 px-2 py-0.5 rounded">
                  {selectedParticipants.length} / 4 Selected
                </span>
              </div>
              <p className="text-xs text-neutral-500 mb-4">Only signed, healthy, unbooked fighters in this division are eligible. Seeded by ELO ranking score.</p>
              
              {eligibleFighters.length === 0 ? (
                <div className="bg-neutral-950 border border-neutral-800 p-6 rounded text-center">
                  <p className="text-sm text-neutral-400 italic">No eligible fighters in the {weightClass} division. Sign new fighters or free up booked ones.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-2">
                  {eligibleFighters.map(f => {
                    const isPart = selectedParticipants.includes(f.id);
                    const isRes = selectedReserves.includes(f.id);
                    return (
                      <div 
                        key={f.id} 
                        className={`p-3 rounded border flex justify-between items-center transition-colors ${
                          isPart ? 'bg-purple-900/10 border-purple-600 text-white' : 
                          isRes ? 'bg-yellow-900/10 border-yellow-600 text-white' :
                          'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                        }`}
                      >
                        <div>
                          <p className="font-bold text-sm">{f.firstName} {f.lastName}</p>
                          <p className="text-xs text-neutral-500 font-mono">Elo: {Math.floor(f.rankingScore || 1000)} • Pop: {f.popularity}</p>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            type="button"
                            onClick={() => handleToggleParticipant(f.id)}
                            disabled={!isPart && selectedParticipants.length >= 4}
                            className={`px-2 py-1 rounded text-xs font-bold ${
                              isPart ? 'bg-purple-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white disabled:opacity-50'
                            }`}
                          >
                            Participant
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleToggleReserve(f.id)}
                            disabled={!isRes && selectedReserves.length >= 2}
                            className={`px-2 py-1 rounded text-xs font-bold ${
                              isRes ? 'bg-yellow-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white disabled:opacity-50'
                            }`}
                          >
                            Reserve
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-neutral-800 pt-4">
              <button 
                type="button"
                onClick={() => setIsCreating(false)} 
                className="bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded text-sm font-bold"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={selectedParticipants.length !== 4}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-bold"
              >
                Create Tournament
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tournament List */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Tournament List</h2>
            
            <div className="flex gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
              {(['All', 'Active', 'Completed', 'Cancelled'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`flex-1 text-[10px] uppercase font-bold py-1 px-1 rounded transition-all ${
                    statusFilter === f ? 'bg-purple-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {activeTourneyList.length === 0 ? (
              <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-lg text-center">
                <p className="text-sm text-neutral-400 italic">No tournaments found matching filter.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeTourneyList.map(t => {
                  const isSel = selectedTourneyId === t.id;
                  const winner = t.winnerId ? fighters[t.winnerId] : null;
                  return (
                    <div 
                      key={t.id} 
                      onClick={() => setSelectedTourneyId(t.id)}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors text-left ${
                        isSel ? 'bg-neutral-800 border-purple-500' :
                        t.status === 'cancelled' ? 'bg-neutral-900/40 border-neutral-900/60 opacity-60 hover:opacity-85' :
                        'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded ${
                          t.status === 'completed' ? 'bg-green-900/30 text-green-400' :
                          t.status === 'active' ? 'bg-purple-900/30 text-purple-400' :
                          t.status === 'cancelled' ? 'bg-red-900/30 text-red-400' : 'bg-blue-900/30 text-blue-400'
                        }`}>
                          {t.status}
                        </span>
                        <span className="text-xs text-neutral-500 font-semibold">{t.weightClass}</span>
                      </div>
                      <h3 className="font-bold text-white mt-2">{t.name}</h3>
                      
                      {winner ? (
                        <p className="text-xs text-green-400 font-bold mt-2"> Winner: {winner.firstName} {winner.lastName}</p>
                      ) : (
                        <p className="text-xs text-neutral-400 mt-2">Created: {t.createdDate}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tournament Details / Bracket */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Bracket & Details</h2>
            
            {selectedTourney ? (
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 space-y-6">
                <div className="flex justify-between items-start border-b border-neutral-800 pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">{selectedTourney.name}</h2>
                    <p className="text-xs text-neutral-400 font-mono mt-1">
                      Status: <span className="text-white uppercase font-bold">{selectedTourney.status}</span> • Division: <span className="text-white font-semibold">{selectedTourney.weightClass}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {selectedTourney.status === 'planned' && (
                      <button 
                        onClick={() => setSchedulingSlot({ tourneyId: selectedTourney.id, round: 'semifinal' })}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-1.5 px-3 rounded text-xs transition-colors"
                      >
                        Schedule Semifinals
                      </button>
                    )}
                    {selectedTourney.status === 'active' && !selectedTourney.fights.find(f => f.round === 'final')?.eventId && (
                      <button 
                        disabled={selectedTourney.fights.filter(f => f.round === 'semifinal').some(s => !s.isCompleted)}
                        onClick={() => setSchedulingSlot({ tourneyId: selectedTourney.id, round: 'final' })}
                        className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-1.5 px-3 rounded text-xs transition-colors"
                      >
                        Schedule Final
                      </button>
                    )}
                    {!selectedTourney.fights.some(f => f.isCompleted) && selectedTourney.status !== 'cancelled' && (
                      <button 
                        onClick={() => {
                          if (window.confirm("Cancel this tournament? Scheduled fights will be removed.")) {
                            cancelTournament(selectedTourney.id);
                            setSelectedTourneyId(null);
                          }
                        }}
                        className="bg-red-950 text-red-400 border border-red-900 hover:bg-red-900/20 py-1.5 px-3 rounded text-xs transition-colors"
                      >
                        Cancel GP
                      </button>
                    )}
                  </div>
                </div>

                {/* Bracket Graphical Representation */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-neutral-950/50 p-6 rounded-lg border border-neutral-800">
                  {/* Semifinals */}
                  <div className="space-y-6">
                    <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest border-b border-neutral-800 pb-1">Semifinals</h3>
                    
                    {selectedTourney.fights.filter(f => f.round === 'semifinal').map((slot, idx) => {
                      const redF = slot.redFighterId ? fighters[slot.redFighterId] : null;
                      const blueF = slot.blueFighterId ? fighters[slot.blueFighterId] : null;
                      const redSeed = selectedTourney.participants.find(p => p.fighterId === slot.redFighterId)?.seed;
                      const blueSeed = selectedTourney.participants.find(p => p.fighterId === slot.blueFighterId)?.seed;
                      
                      return (
                        <div key={slot.id} className="bg-neutral-900 border border-neutral-800 rounded p-3 space-y-2">
                          <p className="text-[10px] text-neutral-500 uppercase font-mono flex justify-between">
                            <span>Semifinal Match {idx + 1}</span>
                            {slot.eventId && <span className="text-purple-400 cursor-pointer" onClick={() => setView('event-builder', { eventId: slot.eventId })}>Linked Event</span>}
                          </p>
                          <div className="space-y-1">
                            <div className={`flex justify-between items-center text-sm p-1 rounded ${slot.winnerId === slot.redFighterId ? 'bg-green-500/10 font-bold text-green-400' : ''}`}>
                              <span>({redSeed}) {redF ? `${redF.firstName} ${redF.lastName}` : 'TBD'}</span>
                              {slot.winnerId === slot.redFighterId && <Check size={14} />}
                            </div>
                            <div className={`flex justify-between items-center text-sm p-1 rounded ${slot.winnerId === slot.blueFighterId ? 'bg-green-500/10 font-bold text-green-400' : ''}`}>
                              <span>({blueSeed}) {blueF ? `${blueF.firstName} ${blueF.lastName}` : 'TBD'}</span>
                              {slot.winnerId === slot.blueFighterId && <Check size={14} />}
                            </div>
                          </div>
                          {(() => {
                            if (!slot.isCompleted) return null;
                            const manualId = `archive_${slot.eventId}_${slot.redFighterId}_${slot.blueFighterId}`;
                            const archiveId = slot.fightArchiveId || manualId;
                            const isAvailable = fightArchive[archiveId] !== undefined || fightArchive[manualId] !== undefined;
                            if (isAvailable) {
                              const finalId = fightArchive[archiveId] ? archiveId : manualId;
                              return (
                                <button 
                                  onClick={() => setView('fight-detail', { fightArchiveId: finalId })}
                                  className="text-[10px] text-purple-400 underline hover:text-purple-300 block mt-1 font-bold text-left"
                                >
                                  View Fight Stats →
                                </button>
                              );
                            }
                            return (
                              <p className="text-[10px] text-neutral-500 italic mt-1">
                                Fight stats available after event finalization.
                              </p>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>

                  {/* Final */}
                  <div className="space-y-6">
                    <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest border-b border-neutral-800 pb-1">Final</h3>
                    
                    {(() => {
                      const slot = selectedTourney.fights.find(f => f.round === 'final');
                      if (!slot) return null;
                      const redF = slot.redFighterId ? fighters[slot.redFighterId] : null;
                      const blueF = slot.blueFighterId ? fighters[slot.blueFighterId] : null;
                      
                      const part1 = selectedTourney.participants.find(p => p.fighterId === slot.redFighterId);
                      const part2 = selectedTourney.participants.find(p => p.fighterId === slot.blueFighterId);
                      
                      return (
                        <div className="bg-neutral-900 border border-purple-900/30 rounded p-4 space-y-3 relative overflow-hidden">
                          <div className="absolute top-0 right-0 bg-purple-900/20 text-purple-400 text-[8px] font-black uppercase tracking-widest px-2 py-0.5">Grand Prix Final</div>
                          
                          <p className="text-[10px] text-neutral-500 uppercase font-mono flex justify-between">
                            <span>Championship Final</span>
                            {slot.eventId && <span className="text-purple-400 cursor-pointer" onClick={() => setView('event-builder', { eventId: slot.eventId })}>Linked Event</span>}
                          </p>
                          <div className="space-y-1">
                            <div className={`flex justify-between items-center text-sm p-1 rounded ${slot.winnerId === slot.redFighterId ? 'bg-green-500/10 font-bold text-green-400' : ''}`}>
                              <span>
                                {redF ? `${redF.firstName} ${redF.lastName}` : 'TBD'}
                                {part1?.replacementForFighterId && <span className="text-[9px] text-yellow-500 ml-1 font-mono">(Reserve)</span>}
                              </span>
                              {slot.winnerId === slot.redFighterId && <Check size={14} />}
                            </div>
                            <div className={`flex justify-between items-center text-sm p-1 rounded ${slot.winnerId === slot.blueFighterId ? 'bg-green-500/10 font-bold text-green-400' : ''}`}>
                              <span>
                                {blueF ? `${blueF.firstName} ${blueF.lastName}` : 'TBD'}
                                {part2?.replacementForFighterId && <span className="text-[9px] text-yellow-500 ml-1 font-mono">(Reserve)</span>}
                              </span>
                              {slot.winnerId === slot.blueFighterId && <Check size={14} />}
                            </div>
                          </div>
                          {(() => {
                            if (!slot.isCompleted) return null;
                            const manualId = `archive_${slot.eventId}_${slot.redFighterId}_${slot.blueFighterId}`;
                            const archiveId = slot.fightArchiveId || manualId;
                            const isAvailable = fightArchive[archiveId] !== undefined || fightArchive[manualId] !== undefined;
                            if (isAvailable) {
                              const finalId = fightArchive[archiveId] ? archiveId : manualId;
                              return (
                                <button 
                                  onClick={() => setView('fight-detail', { fightArchiveId: finalId })}
                                  className="text-[10px] text-purple-400 underline hover:text-purple-300 block mt-1 font-bold text-left"
                                >
                                  View Final Stats →
                                </button>
                              );
                            }
                            return (
                              <p className="text-[10px] text-neutral-500 italic mt-1">
                                Fight stats available after event finalization.
                              </p>
                            );
                          })()}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Additional Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  <div className="space-y-2">
                    <h3 className="font-bold text-white uppercase tracking-wider text-xs">Reserve Fighters</h3>
                    {selectedTourney.reserveFighterIds.length === 0 ? (
                      <p className="text-neutral-500 italic text-xs">No reserves designated.</p>
                    ) : (
                      <div className="space-y-1">
                        {selectedTourney.reserveFighterIds.map(id => {
                          const f = fighters[id];
                          if (!f) return null;
                          return (
                            <div key={id} className="flex justify-between text-neutral-300 bg-neutral-950 p-2 rounded border border-neutral-800">
                              <span>{f.firstName} {f.lastName}</span>
                              <span className="text-xs text-yellow-500 font-mono">Ready</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {selectedTourney.titleShotPromised && (
                      <div className="bg-purple-950/20 border border-purple-800/40 p-3 rounded mt-4">
                        <p className="text-xs font-bold text-purple-400 flex items-center gap-1">
                          🛡 Title Shot Promised
                        </p>
                        <p className="text-[10px] text-neutral-400 mt-1">Winner earns guaranteed undisputed title shot against the division champion.</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-bold text-white uppercase tracking-wider text-xs">Tournament History & Logs</h3>
                    <div className="bg-neutral-950 border border-neutral-800 rounded p-3 h-40 overflow-y-auto font-mono text-xs text-neutral-400 space-y-1">
                      {selectedTourney.notes?.map((log, idx) => (
                        <p key={idx}>• {log}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-lg text-center h-64 flex flex-col justify-center items-center">
                <Award size={48} className="text-neutral-600 mb-2" />
                <p className="text-neutral-400">Select a tournament from the list or create a new one to view brackets and details.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scheduling Modal */}
      {schedulingSlot && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-lg font-bold text-white mb-4">
              Schedule {schedulingSlot.round === 'semifinal' ? 'Semifinal Matches' : 'Grand Prix Final'}
            </h2>
            <p className="text-sm text-neutral-400 mb-4">
              Select an upcoming event to host these tournament fights. They will be appended to the event matchups.
            </p>
            
            {upcomingEvents.length === 0 ? (
              <div className="bg-red-950/20 border border-red-900/50 p-4 rounded text-center mb-6">
                <AlertTriangle className="text-red-400 mx-auto mb-1" size={20} />
                <p className="text-xs text-red-400 font-bold">No upcoming events booked!</p>
                <p className="text-[10px] text-neutral-500 mt-1">Create an event using "Book Event" menu first.</p>
              </div>
            ) : (
              <div className="space-y-4 mb-6">
                <label className="text-xs text-neutral-400 uppercase font-bold">Choose Event</label>
                <select 
                  value={selectedEventId}
                  onChange={e => setSelectedEventId(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-white text-sm"
                >
                  <option value="">-- Select Event --</option>
                  {upcomingEvents.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.date})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-neutral-800 pt-4">
              <button 
                onClick={() => setSchedulingSlot(null)} 
                className="bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded text-sm font-bold"
              >
                Cancel
              </button>
              <button 
                onClick={handleScheduleSubmit}
                disabled={!selectedEventId}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-bold"
              >
                Confirm Scheduling
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
