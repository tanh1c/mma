import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { WeightClass } from '../types/game';
import { WEIGHT_CLASSES } from '../lib/game/constants';
import { Award, Plus, Calendar, AlertTriangle, X, Check, ArrowRight } from 'lucide-react';
import { getTournamentBranding } from '../lib/branding';
import { diagnoseActiveTournaments } from '../lib/game/tournament';
import { getGrandPrixExplanation } from '../lib/game/insights';
import { CountryFlag } from '../components/CountryFlag';
import { FighterAvatar } from '../components/FighterAvatar';
import { FighterRankBadge } from '../components/FighterRankBadge';
import { Button, Panel, PageHeader } from '../components/ui';
import { getFighterOverall } from '../lib/game/fighterRatings';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../store/settingsStore';
import { formatDate, formatTournamentStatus, formatWeightClass } from '../lib/localization';

export default function Tournaments() {
  const { t: translate } = useTranslation('translation');
  const language = useSettingsStore(state => state.language);
  const gameState = useGameStore();
  const {
    tournaments = {},
    fighters, 
    events, 
    currentDate,
    createTournament, 
    scheduleQuarterfinals,
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
  const [format, setFormat] = useState<'four_man' | 'eight_man'>('four_man');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [selectedReserves, setSelectedReserves] = useState<string[]>([]);

  // Scheduling State
  const [schedulingSlot, setSchedulingSlot] = useState<{ tourneyId: string, round: 'quarterfinal' | 'semifinal' | 'final' } | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>('');

  const statusFilters = [
    { value: 'All', label: translate($ => $.tournaments.filters.all) },
    { value: 'Active', label: translate($ => $.tournaments.filters.active) },
    { value: 'Completed', label: translate($ => $.tournaments.filters.completed) },
    { value: 'Cancelled', label: translate($ => $.tournaments.filters.cancelled) }
  ] as const;
  const roundLabels = {
    quarterfinal: translate($ => $.tournaments.round.quarterfinal),
    semifinal: translate($ => $.tournaments.round.semifinal),
    final: translate($ => $.tournaments.round.final)
  };

  const activeTourneyList = Object.values(tournaments).filter(t => {
    if (statusFilter === 'All') return true;
    if (statusFilter === 'Active') return t.status === 'planned' || t.status === 'active';
    if (statusFilter === 'Completed') return t.status === 'completed';
    if (statusFilter === 'Cancelled') return t.status === 'cancelled';
    return true;
  });
  const selectedTourney = selectedTourneyId ? tournaments[selectedTourneyId] : null;
  const selectedDiagnosis = selectedTourney ? diagnoseActiveTournaments(gameState).find(diagnosis => diagnosis.tournamentId === selectedTourney.id) : undefined;
  const selectedExplanation = selectedTourney ? getGrandPrixExplanation({ id: selectedTourney.id, year: new Date(currentDate).getFullYear(), date: currentDate, type: 'grand_prix_round', status: 'planned', priority: 1, tournamentId: selectedTourney.id }, selectedDiagnosis, language) : null;

  // Filter signed, healthy, same-class, unbooked fighters for the GP creation form
  const eligibleFighters = Object.values(fighters).filter(f => 
    f.contract !== null &&
    f.careerPhase !== 'retired' &&
    f.weightClass === weightClass &&
    !f.injuryStatus && 
    (!f.medicalSuspension || f.medicalSuspension.daysRemaining <= 0) &&
    !Object.values(events).some(e => !e.isCompleted && e.fights.some(fight => fight.redCornerId === f.id || fight.blueCornerId === f.id))
  ).sort((a, b) => (b.rankingScore || 0) - (a.rankingScore || 0));

  const handleToggleParticipant = (id: string) => {
    const limit = format === 'eight_man' ? 8 : 4;
    if (selectedParticipants.includes(id)) {
      setSelectedParticipants(selectedParticipants.filter(pId => pId !== id));
    } else {
      if (selectedParticipants.length < limit) {
        setSelectedParticipants([...selectedParticipants, id]);
        setSelectedReserves(selectedReserves.filter(rId => rId !== id)); // cannot be both
      }
    }
  };

  const handleToggleReserve = (id: string) => {
    const limit = format === 'eight_man' ? 3 : 2;
    if (selectedReserves.includes(id)) {
      setSelectedReserves(selectedReserves.filter(rId => rId !== id));
    } else {
      if (selectedReserves.length < limit) {
        setSelectedReserves([...selectedReserves, id]);
        setSelectedParticipants(selectedParticipants.filter(pId => pId !== id)); // cannot be both
      }
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const required = format === 'eight_man' ? 8 : 4;
    if (selectedParticipants.length !== required) {
      alert(translate($ => $.tournaments.exactParticipants, { count: required }));
      return;
    }
    
    const gpName = name.trim() || getTournamentBranding(weightClass, format).name;
    createTournament({
      weightClass,
      name: gpName,
      titleShotPromised,
      format,
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
    
    if (schedulingSlot.round === 'quarterfinal') {
      scheduleQuarterfinals(schedulingSlot.tourneyId, selectedEventId);
    } else if (schedulingSlot.round === 'semifinal') {
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
    <div className="space-y-6 pb-12">
      <PageHeader
        eyebrow={translate($ => $.tournaments.eyebrow)}
        title={translate($ => $.tournaments.title)}
        description={translate($ => $.tournaments.description)}
        actions={!isCreating ? <Button variant="primary" onClick={() => { setIsCreating(true); setSelectedTourneyId(null); }} className="inline-flex items-center gap-1"><Plus size={16} /> {translate($ => $.tournaments.create)}</Button> : undefined}
      />

      {isCreating ? (
        <Panel className="max-w-4xl">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-medium tracking-tight text-white">{translate($ => $.tournaments.newTitle)}</h2>
            <Button variant="quiet" onClick={() => setIsCreating(false)} aria-label={translate($ => $.tournaments.close)}>
              <X size={20} />
            </Button>
          </div>

          <form onSubmit={handleCreate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-1">
                <label className="text-xs text-neutral-400 uppercase font-bold">{translate($ => $.tournaments.name)}</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={getTournamentBranding(weightClass, format).name}
                  className="w-full bg-black/10 border border-[#2a2c31] rounded p-2 text-white text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-neutral-400 uppercase font-bold">{translate($ => $.tournaments.weightClass)}</label>
                <select 
                  value={weightClass}
                  onChange={e => {
                    setWeightClass(e.target.value as WeightClass);
                    setSelectedParticipants([]);
                    setSelectedReserves([]);
                  }}
                  className="w-full bg-black/10 border border-[#2a2c31] rounded p-2 text-white text-sm"
                >
                  {WEIGHT_CLASSES.map(wc => (
                    <option key={wc} value={wc}>{formatWeightClass(wc, language)}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-neutral-400 uppercase font-bold">{translate($ => $.tournaments.format)}</label>
                <select 
                  value={format}
                  onChange={e => {
                    setFormat(e.target.value as 'four_man' | 'eight_man');
                    setSelectedParticipants([]);
                    setSelectedReserves([]);
                  }}
                  className="w-full bg-black/10 border border-[#2a2c31] rounded p-2 text-white text-sm font-semibold text-purple-400"
                >
                  <option value="four_man">{translate($ => $.tournaments.fourMan)}</option>
                  <option value="eight_man">{translate($ => $.tournaments.eightMan)}</option>
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
                <label htmlFor="titleShot" title={translate($ => $.tournaments.titleShotHelp)} className="text-sm font-semibold text-neutral-300">
                  {translate($ => $.tournaments.titleShot)}
                </label>
              </div>
            </div>

            <div className="border-t border-neutral-800 pt-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">{translate($ => $.tournaments.selectParticipants, { count: format === 'eight_man' ? 8 : 4 })}</h3>
                <span className="text-xs font-semibold text-purple-400 bg-purple-900/30 px-2 py-0.5 rounded animate-pulse">
                  {translate($ => $.tournaments.selected, { selected: selectedParticipants.length, count: format === 'eight_man' ? 8 : 4 })}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mb-4">{translate($ => $.tournaments.eligibility)}</p>
              
              {eligibleFighters.length === 0 ? (
                <div className="bg-black/10 border border-[#2a2c31] p-6 rounded text-center">
                  <p className="text-sm text-neutral-400 italic">{translate($ => $.tournaments.noEligible, { weightClass: formatWeightClass(weightClass, language) })}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-2">
                  {eligibleFighters.map(f => {
                    const isPart = selectedParticipants.includes(f.id);
                    const isRes = selectedReserves.includes(f.id);
                    const partLimit = format === 'eight_man' ? 8 : 4;
                    const resLimit = format === 'eight_man' ? 3 : 2;
                    return (
                      <div 
                        key={f.id} 
                        className={`p-3 rounded border flex justify-between items-center transition-colors ${
                          isPart ? 'bg-purple-900/10 border-purple-600 text-white' : 
                          isRes ? 'bg-yellow-900/10 border-yellow-600 text-white' :
                          'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <FighterAvatar id={f.id} name={`${f.firstName} ${f.lastName}`} nationality={f.nationality} className="h-8 w-8" />
                          <div>
                            <p className="flex flex-wrap items-center gap-1 font-bold text-sm"><FighterRankBadge fighterId={f.id} />{f.firstName} {f.lastName} <CountryFlag nationality={f.nationality} className="text-xs" /></p>
                            <p className="text-xs text-neutral-500 font-mono">Elo: {Math.floor(f.rankingScore || 1000)} • OVR: {getFighterOverall(f)} • POT: {f.potential}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            type="button"
                            onClick={() => handleToggleParticipant(f.id)}
                            disabled={!isPart && selectedParticipants.length >= partLimit}
                            className={`px-2 py-1 rounded text-xs font-bold ${
                              isPart ? 'bg-purple-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white disabled:opacity-50'
                            }`}
                          >
                            {translate($ => $.tournaments.participant)}
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleToggleReserve(f.id)}
                            disabled={!isRes && selectedReserves.length >= resLimit}
                            className={`px-2 py-1 rounded text-xs font-bold ${
                              isRes ? 'bg-yellow-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white disabled:opacity-50'
                            }`}
                          >
                            {translate($ => $.tournaments.reserve, { selected: selectedReserves.length, count: resLimit })}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-neutral-800 pt-4">
              <Button variant="secondary" type="button" onClick={() => setIsCreating(false)}>{translate($ => $.tournaments.cancel)}</Button>
              <Button variant="primary" type="submit" disabled={selectedParticipants.length !== (format === 'eight_man' ? 8 : 4)}>{translate($ => $.tournaments.createTournament)}</Button>
            </div>
          </form>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tournament List */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">{translate($ => $.tournaments.list)}</h2>

            <div className="flex gap-1 rounded-lg border border-[#2a2c31] bg-black/10 p-1">
              {statusFilters.map(filter => (
                <button
                  key={filter.value}
                  onClick={() => setStatusFilter(filter.value)}
                  className={`flex-1 rounded px-1 py-1 text-[10px] font-bold uppercase transition-colors ${
                    statusFilter === filter.value ? 'bg-white text-black' : 'text-neutral-300 hover:bg-[#1b1c20] hover:text-white'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {activeTourneyList.length === 0 ? (
              <div className="bg-[#101114] border border-[#2a2c31] p-6 rounded-lg text-center">
                <p className="text-sm text-neutral-400 italic">{translate($ => $.tournaments.noMatches)}</p>
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
                          {formatTournamentStatus(t.status, language)}
                        </span>
                        <span className="text-xs text-neutral-500 font-semibold">{formatWeightClass(t.weightClass, language)}</span>
                      </div>
                      <h3 className="font-bold text-white mt-2">{t.name}</h3>
                      
                      {winner ? (
                        <p className="text-xs text-green-400 font-bold mt-2">{translate($ => $.tournaments.winner, { name: `${winner.firstName} ${winner.lastName}` })}</p>
                      ) : (
                        <p className="text-xs text-neutral-400 mt-2">{translate($ => $.tournaments.created, { date: formatDate(t.createdDate, language) })}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tournament Details / Bracket */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">{translate($ => $.tournaments.bracket)}</h2>
            {selectedTourney ? (
              <Panel className="space-y-6">
                <div className="flex justify-between items-start border-b border-neutral-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-white">{selectedTourney.name}</h2>
                      <span className="text-[10px] bg-purple-900/40 text-purple-400 font-bold px-2 py-0.5 rounded">
                        {selectedTourney.format === 'eight_man' ? translate($ => $.tournaments.eightMan) : translate($ => $.tournaments.fourMan)}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 font-mono mt-1">
                      {translate($ => $.tournaments.statusDivision, { status: formatTournamentStatus(selectedTourney.status, language), division: formatWeightClass(selectedTourney.weightClass, language) })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {selectedTourney.status === 'planned' && (
                      selectedTourney.format === 'eight_man' ? (
                        <Button
                          variant="primary"
                          className="min-h-9 px-3 text-xs"
                          onClick={() => setSchedulingSlot({ tourneyId: selectedTourney.id, round: 'quarterfinal' })}
                        >
                          {translate($ => $.tournaments.scheduleQuarterfinals)}
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          className="min-h-9 px-3 text-xs"
                          onClick={() => setSchedulingSlot({ tourneyId: selectedTourney.id, round: 'semifinal' })}
                        >
                          {translate($ => $.tournaments.scheduleSemifinals)}
                        </Button>
                      )
                    )}
                    {selectedTourney.status === 'active' && 
                      selectedTourney.format === 'eight_man' && 
                      selectedTourney.fights.filter(f => f.round === 'quarterfinal').every(q => q.isCompleted) && 
                      !selectedTourney.fights.find(f => f.round === 'semifinal')?.eventId && (
                        <Button
                          variant="primary"
                          className="min-h-9 px-3 text-xs"
                          onClick={() => setSchedulingSlot({ tourneyId: selectedTourney.id, round: 'semifinal' })}
                        >
                          {translate($ => $.tournaments.scheduleSemifinals)}
                        </Button>
                    )}
                    {selectedTourney.status === 'active' && 
                      selectedTourney.fights.filter(f => f.round === 'semifinal').every(s => s.isCompleted) && 
                      !selectedTourney.fights.find(f => f.round === 'final')?.eventId && (
                        <Button
                          variant="primary"
                          className="min-h-9 px-3 text-xs"
                          onClick={() => setSchedulingSlot({ tourneyId: selectedTourney.id, round: 'final' })}
                        >
                          {translate($ => $.tournaments.scheduleFinal)}
                        </Button>
                    )}
                    {!selectedTourney.fights.some(f => f.isCompleted) && selectedTourney.status !== 'cancelled' && (
                      <Button
                        variant="danger"
                        className="min-h-9 px-3 text-xs"
                        onClick={() => {
                          if (window.confirm(translate($ => $.tournaments.cancelConfirm))) {
                            cancelTournament(selectedTourney.id);
                            setSelectedTourneyId(null);
                          }
                        }}
                      >
                        {translate($ => $.tournaments.cancelGp)}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Bracket Graphical Representation */}
                {(() => {
                  const renderFightStatsLink = (slot: any) => {
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
                          {translate($ => $.tournaments.viewStats)}
                        </button>
                      );
                    }
                    return (
                      <p className="text-[10px] text-neutral-500 italic mt-1 font-sans">
                        {translate($ => $.tournaments.statsAfterEvent)}
                      </p>
                    );
                  };

                  const isEight = selectedTourney.format === 'eight_man';

                  return (
                    <div className={`grid grid-cols-1 ${isEight ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-8 items-center bg-neutral-950/50 p-6 rounded-lg border border-neutral-800`}>
                      {/* Quarterfinals (8-Man only) */}
                      {isEight && (
                        <div className="space-y-6">
                          <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest border-b border-neutral-800 pb-1">{translate($ => $.tournaments.quarterfinals)}</h3>
                          {selectedTourney.fights.filter(f => f.round === 'quarterfinal').map((slot, idx) => {
                            const redF = slot.redFighterId ? fighters[slot.redFighterId] : null;
                            const blueF = slot.blueFighterId ? fighters[slot.blueFighterId] : null;
                            const redSeed = selectedTourney.participants.find(p => p.fighterId === slot.redFighterId)?.seed;
                            const blueSeed = selectedTourney.participants.find(p => p.fighterId === slot.blueFighterId)?.seed;
                            
                            return (
                              <div key={slot.id} className="bg-[#101114] border border-[#2a2c31] rounded p-3 space-y-2 text-left">
                                <p className="text-[10px] text-neutral-500 uppercase font-mono flex justify-between">
                                  <span>{translate($ => $.tournaments.quarterfinal, { number: idx + 1 })}</span>
                                  {slot.eventId && (
                                    <span 
                                      className="text-purple-400 cursor-pointer hover:underline" 
                                      onClick={() => setView('event-builder', { eventId: slot.eventId })}
                                    >
                                      {translate($ => $.tournaments.linkedEvent)}
                                    </span>
                                  )}
                                </p>
                                <div className="space-y-1">
                                  <div className={`flex justify-between items-center text-sm p-1 rounded ${slot.winnerId === slot.redFighterId ? 'bg-green-500/10 font-bold text-green-400' : ''}`}>
                                    <span className="flex items-center gap-1">({redSeed}) {redF && <><FighterRankBadge fighterId={redF.id} /><FighterAvatar id={redF.id} name={`${redF.firstName} ${redF.lastName}`} nationality={redF.nationality} className="h-5 w-5" /><CountryFlag nationality={redF.nationality} className="text-xs" /></>}{redF ? `${redF.firstName} ${redF.lastName}` : translate($ => $.tournaments.pending)}</span>
                                    {slot.winnerId === slot.redFighterId && <Check size={14} />}
                                  </div>
                                  <div className={`flex justify-between items-center text-sm p-1 rounded ${slot.winnerId === slot.blueFighterId ? 'bg-green-500/10 font-bold text-green-400' : ''}`}>
                                    <span className="flex items-center gap-1">({blueSeed}) {blueF && <><FighterRankBadge fighterId={blueF.id} /><FighterAvatar id={blueF.id} name={`${blueF.firstName} ${blueF.lastName}`} nationality={blueF.nationality} className="h-5 w-5" /><CountryFlag nationality={blueF.nationality} className="text-xs" /></>}{blueF ? `${blueF.firstName} ${blueF.lastName}` : translate($ => $.tournaments.pending)}</span>
                                    {slot.winnerId === slot.blueFighterId && <Check size={14} />}
                                  </div>
                                </div>
                                {renderFightStatsLink(slot)}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Semifinals */}
                      <div className="space-y-6">
                        <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest border-b border-neutral-800 pb-1">{translate($ => $.tournaments.semifinals)}</h3>
                        
                        {selectedTourney.fights.filter(f => f.round === 'semifinal').map((slot, idx) => {
                          const redF = slot.redFighterId ? fighters[slot.redFighterId] : null;
                          const blueF = slot.blueFighterId ? fighters[slot.blueFighterId] : null;
                          const redSeed = selectedTourney.participants.find(p => p.fighterId === slot.redFighterId)?.seed;
                          const blueSeed = selectedTourney.participants.find(p => p.fighterId === slot.blueFighterId)?.seed;
                          
                          return (
                            <div key={slot.id} className="bg-[#101114] border border-[#2a2c31] rounded p-3 space-y-2 text-left">
                              <p className="text-[10px] text-neutral-500 uppercase font-mono flex justify-between">
                                <span>{translate($ => $.tournaments.semifinal, { number: idx + 1 })}</span>
                                {slot.eventId && (
                                  <span 
                                    className="text-purple-400 cursor-pointer hover:underline" 
                                    onClick={() => setView('event-builder', { eventId: slot.eventId })}
                                  >
                                    {translate($ => $.tournaments.linkedEvent)}
                                  </span>
                                )}
                              </p>
                              <div className="space-y-1">
                                <div className={`flex justify-between items-center text-sm p-1 rounded ${slot.winnerId === slot.redFighterId ? 'bg-green-500/10 font-bold text-green-400' : ''}`}>
                                  <span className="flex items-center gap-1">{redSeed ? `(${redSeed}) ` : ''}{redF && <FighterRankBadge fighterId={redF.id} />}{redF ? `${redF.firstName} ${redF.lastName}` : translate($ => $.tournaments.pending)}</span>
                                  {slot.winnerId === slot.redFighterId && <Check size={14} />}
                                </div>
                                <div className={`flex justify-between items-center text-sm p-1 rounded ${slot.winnerId === slot.blueFighterId ? 'bg-green-500/10 font-bold text-green-400' : ''}`}>
                                  <span className="flex items-center gap-1">{blueSeed ? `(${blueSeed}) ` : ''}{blueF && <FighterRankBadge fighterId={blueF.id} />}{blueF ? `${blueF.firstName} ${blueF.lastName}` : translate($ => $.tournaments.pending)}</span>
                                  {slot.winnerId === slot.blueFighterId && <Check size={14} />}
                                </div>
                              </div>
                              {renderFightStatsLink(slot)}
                            </div>
                          );
                        })}
                      </div>

                      {/* Final */}
                      <div className="space-y-6">
                        <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest border-b border-neutral-800 pb-1">{translate($ => $.tournaments.final)}</h3>
                        
                        {(() => {
                          const slot = selectedTourney.fights.find(f => f.round === 'final');
                          if (!slot) return null;
                          const redF = slot.redFighterId ? fighters[slot.redFighterId] : null;
                          const blueF = slot.blueFighterId ? fighters[slot.blueFighterId] : null;
                          
                          const part1 = selectedTourney.participants.find(p => p.fighterId === slot.redFighterId);
                          const part2 = selectedTourney.participants.find(p => p.fighterId === slot.blueFighterId);
                          
                          return (
                            <div className="bg-neutral-900 border border-purple-900/30 rounded p-4 space-y-3 relative overflow-hidden text-left">
                              <div className="absolute top-0 right-0 bg-purple-900/20 text-purple-400 text-[8px] font-black uppercase tracking-widest px-2 py-0.5">{translate($ => $.tournaments.grandPrixFinal)}</div>
                              
                              <p className="text-[10px] text-neutral-500 uppercase font-mono flex justify-between">
                                <span>{translate($ => $.tournaments.championshipFinal)}</span>
                                {slot.eventId && (
                                  <span 
                                    className="text-purple-400 cursor-pointer hover:underline" 
                                    onClick={() => setView('event-builder', { eventId: slot.eventId })}
                                  >
                                    {translate($ => $.tournaments.linkedEvent)}
                                  </span>
                                )}
                              </p>
                              <div className="space-y-1">
                                <div className={`flex justify-between items-center text-sm p-1 rounded ${slot.winnerId === slot.redFighterId ? 'bg-green-500/10 font-bold text-green-400' : ''}`}>
                                  <span>
                                    {redF ? `${redF.firstName} ${redF.lastName}` : translate($ => $.tournaments.pending)}
                                    {part1?.replacementForFighterId && <span className="text-[9px] text-yellow-500 ml-1 font-mono">({translate($ => $.tournaments.replacementReserve)})</span>}
                                  </span>
                                  {slot.winnerId === slot.redFighterId && <Check size={14} />}
                                </div>
                                <div className={`flex justify-between items-center text-sm p-1 rounded ${slot.winnerId === slot.blueFighterId ? 'bg-green-500/10 font-bold text-green-400' : ''}`}>
                                  <span>
                                    {blueF ? `${blueF.firstName} ${blueF.lastName}` : translate($ => $.tournaments.pending)}
                                    {part2?.replacementForFighterId && <span className="text-[9px] text-yellow-500 ml-1 font-mono">({translate($ => $.tournaments.replacementReserve)})</span>}
                                  </span>
                                  {slot.winnerId === slot.blueFighterId && <Check size={14} />}
                                </div>
                              </div>
                              
                              {selectedExplanation && selectedExplanation.details.length > 0 && (
                                <div className="mt-2 space-y-1.5 rounded border border-purple-900/50 bg-purple-950/20 p-3 text-left text-xs text-purple-100" title={selectedExplanation.details.join('\n')}>
                                  <p className="flex items-center gap-1 font-bold text-purple-300"><AlertTriangle size={14} /> {translate($ => $.tournaments.gpStatus, { status: selectedExplanation.status })}</p>
                                  {selectedExplanation.details.map(detail => <p key={detail}>{detail}</p>)}
                                  {selectedExplanation.retryDate && <p className="font-mono text-[10px] text-neutral-400">{translate($ => $.tournaments.earliestRetry, { date: formatDate(selectedExplanation.retryDate, language) })}</p>}
                                  {selectedDiagnosis?.canScheduleNow && selectedDiagnosis.currentRoundNeeded !== 'none' && <button onClick={() => setSchedulingSlot({ tourneyId: selectedTourney.id, round: selectedDiagnosis.currentRoundNeeded })} className="mt-2 rounded bg-purple-600 px-2.5 py-1 text-[10px] font-bold uppercase text-white transition-colors hover:bg-purple-500">{translate($ => $.tournaments.scheduleRound, { round: selectedDiagnosis.currentRoundNeeded })}</button>}
                                </div>
                              )}
                              
                              {renderFightStatsLink(slot)}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })()}

                {/* Additional Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-left">
                  <div className="space-y-2">
                    <h3 className="font-bold text-white uppercase tracking-wider text-xs">{translate($ => $.tournaments.reserves)}</h3>
                    {selectedTourney.reserveFighterIds.length === 0 ? (
                      <p className="text-neutral-500 italic text-xs">{translate($ => $.tournaments.noReserves)}</p>
                    ) : (
                      <div className="space-y-1">
                        {selectedTourney.reserveFighterIds.map(id => {
                          const f = fighters[id];
                          if (!f) return null;
                          return (
                            <div key={id} className="flex justify-between text-neutral-300 bg-neutral-950 p-2 rounded border border-neutral-800">
                              <span>{f.firstName} {f.lastName}</span>
                              <span className="text-xs text-yellow-500 font-mono">{translate($ => $.tournaments.ready)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {selectedTourney.titleShotPromised && (
                      <div className="bg-purple-950/20 border border-purple-800/40 p-3 rounded mt-4">
                        <p title={translate($ => $.tournaments.titleShotHelp)} className="text-xs font-bold text-purple-300 flex items-center gap-1">
                          🛡 {translate($ => $.tournaments.titleShotPromised)}
                        </p>
                        <p className="text-[10px] text-purple-200 mt-1">{translate($ => $.tournaments.titleShotDescription)}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-bold text-white uppercase tracking-wider text-xs">{translate($ => $.tournaments.history)}</h3>
                    <div className="bg-black/10 border border-[#2a2c31] rounded p-3 h-40 overflow-y-auto font-mono text-xs text-neutral-400 space-y-1">
                      {selectedTourney.notes?.map((log, idx) => (
                        <p key={idx}>• {log}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </Panel>
            ) : (
              <div className="bg-[#101114] border border-[#2a2c31] p-8 rounded-lg text-center h-64 flex flex-col justify-center items-center">
                <Award size={48} className="text-neutral-600 mb-2" />
                <p className="text-neutral-400">{translate($ => $.tournaments.selectPrompt)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scheduling Modal */}
      {schedulingSlot && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-[#101114] border border-[#2a2c31] rounded-lg p-6 max-w-md w-full">
            <h2 className="text-lg font-bold text-white mb-4">
              {translate($ => $.tournaments.scheduleTitle, { round: roundLabels[schedulingSlot.round] })}
            </h2>
            <p className="text-sm text-neutral-400 mb-4">
              {translate($ => $.tournaments.scheduleDescription)}
            </p>
            
            {upcomingEvents.length === 0 ? (
              <div className="bg-red-950/20 border border-red-900/50 p-4 rounded text-center mb-6">
                <AlertTriangle className="text-red-400 mx-auto mb-1" size={20} />
                <p className="text-xs text-red-400 font-bold">{translate($ => $.tournaments.noEvents)}</p>
                <p className="text-[10px] text-neutral-500 mt-1">{translate($ => $.tournaments.noEventsHint)}</p>
              </div>
            ) : (
              <div className="space-y-4 mb-6">
                <label className="text-xs text-neutral-400 uppercase font-bold">{translate($ => $.tournaments.chooseEvent)}</label>
                <select
                  value={selectedEventId}
                  onChange={e => setSelectedEventId(e.target.value)}
                  className="w-full bg-black/10 border border-[#2a2c31] rounded p-2 text-white text-sm"
                >
                  <option value="">{translate($ => $.tournaments.selectEvent)}</option>
                  {upcomingEvents.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({formatDate(e.date, language)})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-neutral-800 pt-4">
              <Button variant="secondary" onClick={() => setSchedulingSlot(null)}>{translate($ => $.tournaments.cancel)}</Button>
              <Button variant="primary" onClick={handleScheduleSubmit} disabled={!selectedEventId}>{translate($ => $.tournaments.confirmScheduling)}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
