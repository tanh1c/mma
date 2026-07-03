import React, { useState, useMemo, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { WeightClass, FightMatchup } from '../types/game';
import { v4 as uuidv4 } from 'uuid';
import { addDays, format } from 'date-fns';
import { calculateEventProjections } from '../lib/game/economy';
import { ArrowUp, ArrowDown, Trash2, AlertTriangle, Info } from 'lucide-react';
import { Select } from '../components/Select';

export default function EventBuilder() {
  const { fighters, venues, promotion, currentDate, storylines, titles, belts, createEvent, updateEvent, setView, selectedEventId, events, tournaments = {} } = useGameStore();
  
  const isEditing = Boolean(selectedEventId && events[selectedEventId] && !events[selectedEventId].isCompleted);
  const editingEvent = isEditing ? events[selectedEventId!] : null;

  const [eventName, setEventName] = useState(editingEvent ? editingEvent.name : `Cage Dynasty ${Object.keys(events).length + 1}`);
  const [eventDate, setEventDate] = useState(editingEvent ? editingEvent.date : format(addDays(new Date(currentDate), 28), 'yyyy-MM-dd'));
  const [venueId, setVenueId] = useState(editingEvent ? editingEvent.venueId : Object.keys(venues)[0]);
  const [ticketPrice, setTicketPrice] = useState(editingEvent ? editingEvent.ticketPrice : 50);
  const [marketingSpend, setMarketingSpend] = useState(editingEvent ? editingEvent.marketingSpend : 10000);
  
  const [fights, setFights] = useState<Omit<FightMatchup, 'id' | 'result'>[]>(editingEvent ? [...editingEvent.fights] : []);

  useEffect(() => {
    if (editingEvent) {
      setEventName(editingEvent.name);
      setEventDate(editingEvent.date);
      setVenueId(editingEvent.venueId);
      setTicketPrice(editingEvent.ticketPrice);
      setMarketingSpend(editingEvent.marketingSpend);
      setFights([...editingEvent.fights]);
    }
  }, [editingEvent]);

  const [selectedWC, setSelectedWC] = useState<string>('Lightweight');
  const [redFighter, setRedFighter] = useState('');
  const [blueFighter, setBlueFighter] = useState('');
  const [isTitleFight, setIsTitleFight] = useState(false);
  const [rounds, setRounds] = useState('3');

  const contractedRoster = Object.values(fighters).filter(f => f.contract !== null);
  const wcFighters = contractedRoster.filter(f => f.weightClass === selectedWC);
  
  // Filter out fighters already booked
  const bookedFighterIds = fights.flatMap(f => [f.redCornerId, f.blueCornerId]);
  const availableWcFighters = wcFighters.filter(f => !bookedFighterIds.includes(f.id));

  const projections = useMemo(() => {
    return calculateEventProjections(
      fights,
      fighters,
      venues[venueId],
      ticketPrice,
      marketingSpend,
      promotion,
      storylines,
      titles,
      tournaments
    );
  }, [fights, fighters, venues, venueId, ticketPrice, marketingSpend, promotion, storylines, titles, tournaments]);

  if (selectedEventId && events[selectedEventId] && events[selectedEventId].isCompleted) {
    return (
      <div className="text-center p-10 text-neutral-400">
        <h2 className="text-xl mb-4">Event is already completed and cannot be edited.</h2>
        <button onClick={() => setView('dashboard')} className="bg-neutral-800 text-white px-4 py-2 rounded">Return to Dashboard</button>
      </div>
    );
  }

  const addFight = () => {
    if (!redFighter || !blueFighter) return alert('Select both fighters');
    if (redFighter === blueFighter) return alert('Fighter cannot fight themselves');
    
    const rFighter = fighters[redFighter];
    const bFighter = fighters[blueFighter];

    if (rFighter?.medicalSuspension) return alert(`${rFighter.firstName} ${rFighter.lastName} is medically suspended and cannot be booked.`);
    if (bFighter?.medicalSuspension) return alert(`${bFighter.firstName} ${bFighter.lastName} is medically suspended and cannot be booked.`);
    
    if (isTitleFight) {
      if (titles && titles[selectedWC as WeightClass]) {
        const titleState = titles[selectedWC as WeightClass];
        const beltId = `belt_${selectedWC.toLowerCase()}`;
        const belt = belts[beltId];
        const beltName = belt ? belt.name : `the ${selectedWC} Title`;
        
        let titleFightType: 'undisputed' | 'interim' | 'vacant_undisputed' | 'unification' = 'undisputed';
        
        const hasUndisputed = !!titleState.undisputedChampionId;
        const hasInterim = !!titleState.interimChampionId;
        
        if (titleState.status === 'unification_needed') {
           titleFightType = 'unification';
           if (redFighter !== titleState.undisputedChampionId && redFighter !== titleState.interimChampionId) {
              return alert(`Unification fight must involve both champions.`);
           }
           if (blueFighter !== titleState.undisputedChampionId && blueFighter !== titleState.interimChampionId) {
              return alert(`Unification fight must involve both champions.`);
           }
        } else if (hasUndisputed && titleState.status === 'active') {
           titleFightType = 'undisputed';
           if (redFighter !== titleState.undisputedChampionId && blueFighter !== titleState.undisputedChampionId) {
              return alert(`Cannot book a title fight without the active champion. Include the champion, or uncheck "Title Fight" for ${beltName}.`);
           }
        } else if (hasUndisputed && titleState.status === 'inactive_champion' && !hasInterim) {
           titleFightType = 'interim';
           if (redFighter === titleState.undisputedChampionId || blueFighter === titleState.undisputedChampionId) {
              return alert(`Undisputed champion cannot fight for an interim title. Uncheck "Title Fight" or wait for unification.`);
           }
        } else if (hasInterim && !hasUndisputed) {
           titleFightType = 'interim';
           if (redFighter !== titleState.interimChampionId && blueFighter !== titleState.interimChampionId) {
              return alert(`Cannot book an interim title fight without the active interim champion.`);
           }
        } else if (!hasUndisputed && !hasInterim) {
           titleFightType = 'vacant_undisputed';
        }

        setFights([...fights, {
          redCornerId: redFighter,
          blueCornerId: blueFighter,
          weightClass: selectedWC as WeightClass,
          isTitleFight,
          titleFightType,
          rounds: Number(rounds)
        }]);
        setRedFighter('');
        setBlueFighter('');
        return;
      }
    }

    setFights([...fights, {
      redCornerId: redFighter,
      blueCornerId: blueFighter,
      weightClass: selectedWC as WeightClass,
      isTitleFight,
      rounds: Number(rounds)
    }]);
    
    setRedFighter('');
    setBlueFighter('');
  };

  const removeFight = (index: number) => {
    const fight = fights[index];
    if (fight && ('tournamentId' in fight) && (fight as any).tournamentId) {
      alert("This is a tournament fight. You cannot remove or modify tournament fights directly. Cancel the tournament on the Tournaments page instead.");
      return;
    }
    setFights(fights.filter((_, i) => i !== index));
  };

  const moveFight = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === fights.length - 1) return;
    
    const newFights = [...fights];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    const temp = newFights[index];
    newFights[index] = newFights[targetIndex];
    newFights[targetIndex] = temp;
    
    setFights(newFights);
  };

  const handleAutoFill = () => {
    const newFights: Omit<FightMatchup, 'id' | 'result'>[] = [...fights];
    const availableFighters = contractedRoster.filter(f => f.injuryStatus === null && !f.medicalSuspension && f.fatigue < 80);
    
    // Group by weight class
    const wcGroups: Record<WeightClass, typeof availableFighters> = {
      Heavyweight: [],
      Middleweight: [],
      Welterweight: [],
      Lightweight: [],
      Featherweight: [],
      Bantamweight: []
    };

    // Remove already booked fighters
    const bookedSet = new Set(newFights.flatMap(f => [f.redCornerId, f.blueCornerId]));
    availableFighters.forEach(f => {
      if (!bookedSet.has(f.id) && f.weightClass in wcGroups) {
        wcGroups[f.weightClass as WeightClass].push(f);
      }
    });

    // Try to book up to 5 more fights across random weight classes
    const wcs = Object.keys(wcGroups) as WeightClass[];
    wcs.sort(() => Math.random() - 0.5);

    let fightsAdded = 0;
    
    for (const wc of wcs) {
      if (fightsAdded >= 5) break;
      const fightersInWc = wcGroups[wc];
      
      // Sort by popularity as a simple matchmaking metric
      fightersInWc.sort((a, b) => b.popularity - a.popularity);

      // check if champ is available
      const titleState = titles && titles[wc];
      const champId = titleState ? (titleState.undisputedChampionId || titleState.interimChampionId) : null;
      const champ = champId ? fightersInWc.find(f => f.id === champId) : null;
      
      if (champ) {
        const topContender = fightersInWc.find(f => f.id !== champ.id);
        if (topContender) {
          newFights.push({
            redCornerId: champ.id,
            blueCornerId: topContender.id,
            weightClass: wc,
            isTitleFight: true,
            rounds: 5
          });
          fightsAdded++;
          bookedSet.add(champ.id);
          bookedSet.add(topContender.id);
          // remove them from group
          wcGroups[wc] = fightersInWc.filter(f => f.id !== champ.id && f.id !== topContender.id);
        }
      }

      // try to book a regular fight
      const remaining = wcGroups[wc];
      if (remaining.length >= 2) {
        newFights.push({
          redCornerId: remaining[0].id,
          blueCornerId: remaining[1].id,
          weightClass: wc,
          isTitleFight: false,
          rounds: 3
        });
        fightsAdded++;
        bookedSet.add(remaining[0].id);
        bookedSet.add(remaining[1].id);
      }
    }

    if (fightsAdded === 0) {
      alert('Không thể tự động thêm trận đấu. Có thể do võ sĩ đang bị chấn thương, kiệt sức, hoặc chưa được ký hợp đồng.');
    } else {
      setFights(newFights);
    }
  };

  const handleBook = () => {
    if (fights.length === 0) return alert('Must have at least 1 fight');
    if (!eventName) return alert('Need an event name');
    
    if (promotion.money < projections.estimatedCost) {
      if (!window.confirm(`Estimated cost is $${projections.estimatedCost.toLocaleString()} but you only have $${promotion.money.toLocaleString()}. You may go into debt. Proceed?`)) {
        return;
      }
    }

    if (projections.warnings.length > 0) {
      if (!window.confirm(`You have ${projections.warnings.length} active warnings. Are you sure you want to book this event?`)) {
        return;
      }
    }

    const bookedFights = fights.map(f => ({ ...f, id: 'id' in f ? f.id : uuidv4() })) as FightMatchup[];

    if (isEditing && selectedEventId) {
      updateEvent(selectedEventId, {
        name: eventName,
        date: eventDate,
        venueId,
        ticketPrice,
        marketingSpend,
        fights: bookedFights
      });
    } else {
      createEvent({
        name: eventName,
        date: eventDate,
        venueId,
        ticketPrice,
        marketingSpend,
        fights: bookedFights
      });
    }

    setView('dashboard');
  };

  const venueOptions = Object.values(venues).map(v => ({
    value: v.id,
    label: `${v.name}, ${v.city} (${v.capacity} cap)`
  }));

  const wcOptions = [
    { value: 'Heavyweight', label: 'Heavyweight' },
    { value: 'Middleweight', label: 'Middleweight' },
    { value: 'Welterweight', label: 'Welterweight' },
    { value: 'Lightweight', label: 'Lightweight' },
    { value: 'Featherweight', label: 'Featherweight' },
    { value: 'Bantamweight', label: 'Bantamweight' }
  ];

  const fighterOptions = availableWcFighters.map(f => {
    let status = '';
    if (f.injuryStatus) status = ' [INJURED]';
    else if (f.medicalSuspension) status = ` [SUSPENDED: ${f.medicalSuspension.daysRemaining}d]`;
    else if (f.fatigue > 50) status = ' [TIRED]';
    
    const isDisabled = f.injuryStatus !== null || !!f.medicalSuspension || f.fatigue >= 80;
    return {
      value: f.id,
      label: `${f.firstName} ${f.lastName} (${f.record.wins}-${f.record.losses}) ${f.isChampion ? '👑' : ''}${status}`,
      disabled: isDisabled
    };
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <h1 className="text-2xl font-black text-white uppercase">{isEditing ? 'Edit Event' : 'Book Event'}</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column - Details & Booking */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 space-y-4 shadow-sm">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-neutral-800 flex items-center justify-center text-xs">1</span>
              Event Details
            </h2>
            
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Event Name</label>
              <input type="text" value={eventName} onChange={e => setEventName(e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Date</label>
                <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} min={currentDate} className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-white text-sm focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Venue</label>
                <Select value={venueId} onChange={setVenueId} options={venueOptions} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Ticket Price ($)</label>
                <input type="number" min="10" value={ticketPrice} onChange={e => setTicketPrice(Number(e.target.value))} className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-white text-sm focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Marketing Spend ($)</label>
                <input type="number" min="0" step="1000" value={marketingSpend} onChange={e => setMarketingSpend(Number(e.target.value))} className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-white text-sm focus:border-blue-500 outline-none" />
              </div>
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 space-y-4 shadow-sm">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-neutral-800 flex items-center justify-center text-xs">2</span>
                Matchmaking
              </h2>
              <button 
                onClick={handleAutoFill}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors"
              >
                Auto Fill
              </button>
            </div>
            
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Weight Class</label>
              <Select 
                value={selectedWC} 
                onChange={val => { setSelectedWC(val); setRedFighter(''); setBlueFighter(''); }} 
                options={wcOptions} 
              />
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Red Corner (Higher Rank)</label>
                <Select 
                  value={redFighter} 
                  onChange={setRedFighter} 
                  options={fighterOptions}
                  placeholder="Select Fighter"
                />
              </div>
              <div className="flex justify-center -my-2 relative z-10">
                <span className="bg-neutral-800 text-xs font-bold px-2 py-0.5 rounded text-neutral-400">VS</span>
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Blue Corner</label>
                <Select 
                  value={blueFighter} 
                  onChange={setBlueFighter} 
                  options={fighterOptions}
                  placeholder="Select Fighter"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 bg-neutral-950 p-3 rounded border border-neutral-800">
              <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
                <input type="checkbox" checked={isTitleFight} onChange={e => setIsTitleFight(e.target.checked)} className="bg-neutral-900 border-neutral-700 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-neutral-950" />
                Title Fight
              </label>
              <div className="h-4 w-px bg-neutral-800"></div>
              <label className="flex items-center gap-2 text-sm text-neutral-300">
                Rounds:
                <Select 
                  value={rounds} 
                  onChange={setRounds} 
                  options={[{ value: '3', label: '3' }, { value: '5', label: '5' }]} 
                  className="w-20 inline-block text-xs ml-2"
                />
              </label>
            </div>

            <button onClick={addFight} className="w-full bg-neutral-100 hover:bg-white text-black font-bold py-2.5 rounded text-sm transition-colors mt-2">
              Add Fight to Card
            </button>
          </div>
        </div>

        {/* Middle/Right Column - Projections & Card */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Projections Panel */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 shadow-sm">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-neutral-800 flex items-center justify-center text-xs">3</span>
              Event Projections
            </h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
                <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mb-1">Event Hype</div>
                <div className="text-xl font-bold text-white flex items-end gap-1">
                  {Math.round(projections.eventHype)}
                  <span className="text-xs text-neutral-500 mb-1">/100</span>
                </div>
              </div>
              <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
                <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mb-1">Est. Attendance</div>
                <div className="text-xl font-bold text-white flex items-end gap-1">
                  {projections.expectedAttendance.toLocaleString()}
                  <span className="text-xs text-neutral-500 mb-1">/ {venues[venueId].capacity}</span>
                </div>
              </div>
              <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
                <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mb-1">Est. Revenue</div>
                <div className="text-xl font-bold text-green-400">
                  ${(projections.expectedGate + (projections.broadcastRevenue || 0)).toLocaleString()}
                </div>
              </div>
              <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
                <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mb-1">Est. Profit</div>
                <div className={`text-xl font-bold ${projections.expectedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${Math.round(projections.expectedProfit).toLocaleString()}
                </div>
              </div>
            </div>

            {projections.warnings.length > 0 && (
              <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-red-400 font-bold text-sm mb-2">
                  <AlertTriangle size={16} /> Warnings ({projections.warnings.length})
                </div>
                <ul className="text-xs text-red-300 space-y-1 list-disc pl-5">
                  {projections.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
            
            {projections.warnings.length === 0 && fights.length > 0 && (
              <div className="bg-green-950/30 border border-green-900/50 rounded-lg p-3 flex items-center gap-2 text-green-400 text-sm">
                <Info size={16} /> Card looks good!
              </div>
            )}
          </div>

          {/* Fight Card */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 flex-1 flex flex-col min-h-[400px]">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-neutral-800 flex items-center justify-center text-xs">4</span>
              Fight Card ({fights.length})
            </h2>
            
            <div className="flex-1 space-y-2 overflow-y-auto pr-2">
              {fights.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-neutral-500">
                  <p className="text-sm">No fights added yet.</p>
                  <p className="text-xs mt-1">Use the matchmaking panel to add bouts.</p>
                </div>
              ) : (
                fights.map((fight, idx) => {
                  const red = fighters[fight.redCornerId];
                  const blue = fighters[fight.blueCornerId];
                  const isMainEvent = idx === 0;
                  const isCoMain = idx === 1;
                  
                  let slotLabel = `Bout ${fights.length - idx}`;
                  if (isMainEvent) slotLabel = 'Main Event';
                  else if (isCoMain) slotLabel = 'Co-Main Event';
                  else if (idx < 5) slotLabel = 'Main Card';
                  else slotLabel = 'Prelims';

                  return (
                    <div key={idx} className={`p-3 rounded border flex items-center gap-3 transition-colors ${isMainEvent ? 'bg-neutral-800 border-neutral-600' : 'bg-neutral-950 border-neutral-800'}`}>
                      {/* Order Controls */}
                      <div className="flex flex-col gap-1">
                        <button onClick={() => moveFight(idx, 'up')} disabled={idx === 0} className="text-neutral-500 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-500 transition-colors">
                          <ArrowUp size={14} />
                        </button>
                        <button onClick={() => moveFight(idx, 'down')} disabled={idx === fights.length - 1} className="text-neutral-500 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-500 transition-colors">
                          <ArrowDown size={14} />
                        </button>
                      </div>

                      <div className="flex-1">
                        <div className="text-[10px] text-neutral-400 mb-1 font-bold uppercase flex justify-between tracking-wider">
                          <span className={isMainEvent || isCoMain ? 'text-yellow-500/80' : ''}>{slotLabel}</span>
                          <span className="flex items-center gap-2">
                            {fight.rounds} RND
                            <span className="w-1 h-1 rounded-full bg-neutral-600"></span>
                            {fight.weightClass} 
                            {fight.isTitleFight && (
                              <span className="text-yellow-500 ml-1">
                                🏆 {fight.titleFightType === 'interim' ? 'INTERIM ' : fight.titleFightType === 'unification' ? 'UNIFICATION ' : ''}
                                {belts['belt_' + fight.weightClass.toLowerCase()]?.shortName || 'TITLE'}
                              </span>
                            )}
                            {(() => {
                              const redF = fighters[fight.redCornerId];
                              const blueF = fighters[fight.blueCornerId];
                              if (!redF || !blueF) return false;
                              const titleState = titles[fight.weightClass];
                              if (!titleState || !titleState.undisputedChampionId) return false;
                              
                              const isRedChamp = titleState.undisputedChampionId === redF.id;
                              const isBlueChamp = titleState.undisputedChampionId === blueF.id;
                              
                              const isRedGPWinner = redF.titleShotPromised;
                              const isBlueGPWinner = blueF.titleShotPromised;
                              
                              const isGpTitleShotMatch = (isRedChamp && isBlueGPWinner) || (isBlueChamp && isRedGPWinner);
                              
                              return isGpTitleShotMatch && (
                                <span className="text-purple-400 ml-1 font-bold">
                                  🛡 GP Title Shot
                                </span>
                              );
                            })()}
                            {(fight as any).tournamentId && (
                              <span className="text-purple-400 ml-1 font-bold text-xs uppercase">
                                🛡 {((fight as any).tournamentRound === 'quarterfinal') ? 'GP Quarterfinal' : ((fight as any).tournamentRound === 'semifinal') ? 'GP Semifinal' : 'GP Final'}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-bold text-white bg-neutral-900/50 p-2 rounded">
                          <div className="w-[45%] text-right flex items-center justify-end gap-2 truncate">
                            <span className="truncate">{red.firstName} <span className="text-neutral-400">{red.lastName}</span></span>
                            <span className="text-[10px] font-normal text-neutral-500 min-w-[30px]">({red.popularity})</span>
                          </div>
                          <span className="w-[10%] text-center text-neutral-600 text-xs italic">vs</span>
                          <div className="w-[45%] text-left flex items-center gap-2 truncate">
                            <span className="text-[10px] font-normal text-neutral-500 min-w-[30px]">({blue.popularity})</span>
                            <span className="truncate">{blue.firstName} <span className="text-neutral-400">{blue.lastName}</span></span>
                          </div>
                        </div>
                      </div>
                      <button onClick={() => removeFight(idx)} className="ml-2 text-red-500/50 hover:text-red-400 transition-colors p-2 rounded hover:bg-red-500/10">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-neutral-800">
              <button 
                onClick={handleBook}
                disabled={fights.length === 0}
                className={`w-full py-4 rounded font-black uppercase tracking-wider transition-all ${fights.length > 0 ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20' : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'}`}
              >
                {isEditing ? 'Update Event' : 'Confirm & Book Event'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
