import React, { useState, useMemo, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { WeightClass, FightCampFocus, FightMatchup } from '../types/game';
import { v4 as uuidv4 } from 'uuid';
import { addDays, format as formatDateInput } from 'date-fns';
import { calculateEventProjections } from '../lib/game/economy';
import { compareFighters, getFighterReadiness, recommendMatchups } from '../lib/game/insights';
import { getFighterOverall } from '../lib/game/fighterRatings';
import { ArrowUp, ArrowDown, Trash2, AlertTriangle, Info } from 'lucide-react';
import { Select } from '../components/Select';
import { getEventName } from '../lib/branding';
import { CountryFlag } from '../components/CountryFlag';
import { FighterAvatar } from '../components/FighterAvatar';
import { ChampionshipBelt } from '../components/ChampionshipBelt';
import { FighterRankBadge } from '../components/FighterRankBadge';
import { getFighterRankContext } from '../lib/game/rankings';
import { Button, Panel, PageHeader } from '../components/ui';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../store/settingsStore';
import { formatCurrency, formatNumber, formatReadiness, formatWeightClass } from '../lib/localization';

export default function EventBuilder() {
  const { t } = useTranslation('translation');
  const language = useSettingsStore(state => state.language);
  const gameState = useGameStore();
  const { fighters, venues, promotion, currentDate, storylines, titles, belts, createEvent, updateEvent, setView, goBack, selectedEventId, selectedCalendarSlotId, seasonPlans = {}, events, tournaments = {} } = gameState;
  
  const isEditing = Boolean(selectedEventId && events[selectedEventId] && !events[selectedEventId].isCompleted);
  const editingEvent = isEditing ? events[selectedEventId!] : null;

  const [eventName, setEventName] = useState(editingEvent ? editingEvent.name : getEventName('regular', Object.keys(events).length + 1));
  const [eventDate, setEventDate] = useState(editingEvent ? editingEvent.date : formatDateInput(addDays(new Date(currentDate), 28), 'yyyy-MM-dd'));
  const [venueId, setVenueId] = useState(editingEvent ? editingEvent.venueId : Object.keys(venues)[0]);
  const [ticketPrice, setTicketPrice] = useState(editingEvent ? editingEvent.ticketPrice : 50);
  const [marketingSpend, setMarketingSpend] = useState(editingEvent ? editingEvent.marketingSpend : 10000);
  
  const [fights, setFights] = useState<Omit<FightMatchup, 'id' | 'result'>[]>(editingEvent ? [...editingEvent.fights] : []);
  const [selectedWC, setSelectedWC] = useState<string>('Lightweight');

  useEffect(() => {
    if (!editingEvent && selectedCalendarSlotId && seasonPlans) {
      const currentYear = new Date(currentDate).getFullYear();
      const plan = seasonPlans[currentYear];
      const slot = plan?.slots.find(s => s.id === selectedCalendarSlotId);
      if (slot) {
        setEventDate(slot.date);
        
        const eventIndex = Object.keys(events).length + 1;
        const initialName = slot.type === 'tentpole_event'
          ? getEventName('tentpole', eventIndex)
          : slot.type === 'title_fight_card'
            ? getEventName('title', eventIndex)
            : slot.type === 'grand_prix_round'
              ? getEventName('grand_prix', eventIndex, slot.tournamentRound)
              : getEventName('regular', eventIndex);
        if (slot.type === 'tentpole_event') {
          setMarketingSpend(25000);
          const largeVenue = Object.values(venues).sort((a, b) => b.capacity - a.capacity)[0];
          if (largeVenue) setVenueId(largeVenue.id);
        }
        setEventName(initialName);

        if (slot.type === 'grand_prix_round' && slot.tournamentId && slot.tournamentRound) {
          const tourney = tournaments[slot.tournamentId];
          if (tourney) {
            const roundFights = tourney.fights.filter(f => f.round === slot.tournamentRound);
            const gpFights = roundFights.map(f => ({
              redCornerId: f.redFighterId!,
              blueCornerId: f.blueFighterId!,
              weightClass: tourney.weightClass,
              isTitleFight: false,
              rounds: slot.tournamentRound === 'final' ? 5 : 3,
              tournamentId: tourney.id,
              tournamentRound: slot.tournamentRound!,
              tournamentFightSlotId: f.id,
              campFocus: 'balanced'
            }));
            setFights(gpFights);
            setSelectedWC(tourney.weightClass);
          }
        } else if (slot.targetWeightClass) {
          setSelectedWC(slot.targetWeightClass);
        }
      }
    }
  }, [editingEvent, selectedCalendarSlotId, seasonPlans, currentDate, tournaments, venues, events]);

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

  const [redFighter, setRedFighter] = useState('');
  const [blueFighter, setBlueFighter] = useState('');
  const [fighterSearch, setFighterSearch] = useState('');
  const [readinessFilter, setReadinessFilter] = useState<'All' | 'Ready' | 'Risky'>('All');
  const [isTitleFight, setIsTitleFight] = useState(false);
  const [rounds, setRounds] = useState('3');

  const hasContractThroughEvent = (fighterId: string) => {
    const fighter = fighters[fighterId];
    return !!fighter?.contract && fighter.contract.fightsRemaining > 0 && fighter.contract.endDate >= eventDate;
  };
  const contractedRoster = Object.values(fighters).filter(f => hasContractThroughEvent(f.id));
  const wcFighters = contractedRoster.filter(f => f.weightClass === selectedWC);
  
  // Filter out fighters already booked
  const bookedFighterIds = fights.flatMap(f => [f.redCornerId, f.blueCornerId]);
  const availableWcFighters = wcFighters.filter(f => !bookedFighterIds.includes(f.id));
  const fighterOptions = availableWcFighters.filter(fighter => {
    const query = fighterSearch.trim().toLowerCase();
    const matchesSearch = !query || `${fighter.firstName} ${fighter.lastName} ${fighter.nickname}`.toLowerCase().includes(query);
    const readiness = getFighterReadiness(fighter, language);
    return matchesSearch && (readinessFilter === 'All' || (readinessFilter === 'Ready' ? readiness.status === 'ready' : readiness.status === 'fatigued'));
  }).map(fighter => {
    const readiness = getFighterReadiness(fighter, language);
    return { value: fighter.id, label: `${getFighterRankContext(gameState, fighter.id)?.label ?? 'UR'} · ${fighter.firstName} ${fighter.lastName} · OVR ${getFighterOverall(fighter)} (${fighter.record.wins}-${fighter.record.losses}) ${readiness.status === 'ready' ? '' : ` [${formatReadiness(readiness.status, language).toUpperCase()}]`}`, disabled: !readiness.eligible };
  });
  const recommendations = useMemo(() => recommendMatchups(gameState, selectedWC as WeightClass, bookedFighterIds, language).filter(recommendation => hasContractThroughEvent(recommendation.red.id) && hasContractThroughEvent(recommendation.blue.id)), [gameState, selectedWC, fights, eventDate, language]);
  const comparison = redFighter && blueFighter && fighters[redFighter] && fighters[blueFighter] ? compareFighters(fighters[redFighter], fighters[blueFighter], language) : null;

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
        <h2 className="text-xl mb-4">{t($ => $.eventBuilder.completed)}</h2>
        <Button variant="secondary" onClick={() => goBack('dashboard')}>{t($ => $.eventBuilder.back)}</Button>
      </div>
    );
  }

  const addFight = () => {
    if (!redFighter || !blueFighter) return alert(t($ => $.eventBuilder.validation.selectBoth));
    if (redFighter === blueFighter) return alert(t($ => $.eventBuilder.validation.sameFighter));
    
    const rFighter = fighters[redFighter];
    const bFighter = fighters[blueFighter];

    if (rFighter?.medicalSuspension) return alert(t($ => $.eventBuilder.validation.suspended, { name: `${rFighter.firstName} ${rFighter.lastName}` }));
    if (bFighter?.medicalSuspension) return alert(t($ => $.eventBuilder.validation.suspended, { name: `${bFighter.firstName} ${bFighter.lastName}` }));
    if (!hasContractThroughEvent(redFighter) || !hasContractThroughEvent(blueFighter)) return alert(t($ => $.eventBuilder.validation.contract));

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
              return alert(t($ => $.eventBuilder.validation.unification));
           }
           if (blueFighter !== titleState.undisputedChampionId && blueFighter !== titleState.interimChampionId) {
              return alert(t($ => $.eventBuilder.validation.unification));
           }
        } else if (hasUndisputed && titleState.status === 'active') {
           titleFightType = 'undisputed';
           if (redFighter !== titleState.undisputedChampionId && blueFighter !== titleState.undisputedChampionId) {
              return alert(t($ => $.eventBuilder.validation.activeChampion, { belt: beltName }));
           }
        } else if (hasUndisputed && titleState.status === 'inactive_champion' && !hasInterim) {
           titleFightType = 'interim';
           if (redFighter === titleState.undisputedChampionId || blueFighter === titleState.undisputedChampionId) {
              return alert(t($ => $.eventBuilder.validation.interimChampion));
           }
        } else if (hasInterim && !hasUndisputed) {
           titleFightType = 'interim';
           if (redFighter !== titleState.interimChampionId && blueFighter !== titleState.interimChampionId) {
              return alert(t($ => $.eventBuilder.validation.activeInterim));
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
          rounds: Number(rounds),
          campFocus: 'balanced'
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
      rounds: Number(rounds),
      campFocus: 'balanced'
    }]);
    
    setRedFighter('');
    setBlueFighter('');
  };

  const removeFight = (index: number) => {
    const fight = fights[index];
    if (fight && ('tournamentId' in fight) && (fight as any).tournamentId) {
      alert(t($ => $.eventBuilder.validation.tournamentFight));
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
            rounds: 5,
            campFocus: 'balanced'
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
          rounds: 3,
          campFocus: 'balanced'
        });
        fightsAdded++;
        bookedSet.add(remaining[0].id);
        bookedSet.add(remaining[1].id);
      }
    }

    if (fightsAdded === 0) {
      alert(t($ => $.eventBuilder.validation.autoFill));
    } else {
      setFights(newFights);
    }
  };

  const handleBook = () => {
    if (fights.length === 0) return alert(t($ => $.eventBuilder.validation.oneFight));
    if (!eventName) return alert(t($ => $.eventBuilder.validation.eventName));
    if (fights.some(fight => !hasContractThroughEvent(fight.redCornerId) || !hasContractThroughEvent(fight.blueCornerId))) return alert(t($ => $.eventBuilder.validation.everyContract));

    if (promotion.money < projections.estimatedCost) {
      if (!window.confirm(t($ => $.eventBuilder.validation.cost, { cost: formatCurrency(projections.estimatedCost, language), money: formatCurrency(promotion.money, language) }))) {
        return;
      }
    }

    if (projections.warnings.length > 0) {
      if (!window.confirm(t($ => $.eventBuilder.validation.warnings, { count: projections.warnings.length }))) {
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

    setView('dashboard', undefined, { replace: true });
  };

  const venueOptions = Object.values(venues).map(v => ({
    value: v.id,
    label: `${v.name}, ${v.city} (${t($ => $.eventBuilder.details.capacity, { count: v.capacity })})`
  }));

  const campOptions = [
    { value: 'balanced', label: t($ => $.eventBuilder.camp.balanced) },
    { value: 'striking', label: t($ => $.eventBuilder.camp.striking) },
    { value: 'wrestling', label: t($ => $.eventBuilder.camp.wrestling) },
    { value: 'cardio', label: t($ => $.eventBuilder.camp.cardio) },
    { value: 'recovery', label: t($ => $.eventBuilder.camp.recovery) }
  ];
  const campSummary = (focus: FightCampFocus = 'balanced') => campOptions.find(option => option.value === focus)?.label ?? t($ => $.eventBuilder.camp.balanced);

  const wcOptions = ['Heavyweight', 'Middleweight', 'Welterweight', 'Lightweight', 'Featherweight', 'Bantamweight'].map(value => ({ value, label: formatWeightClass(value, language) }));

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <PageHeader eyebrow={t($ => $.eventBuilder.eyebrow)} title={isEditing ? t($ => $.eventBuilder.editTitle) : t($ => $.eventBuilder.bookTitle)} description={isEditing ? t($ => $.eventBuilder.editDescription) : t($ => $.eventBuilder.bookDescription)} />
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column - Details & Booking */}
        <div className="lg:col-span-5 space-y-6">
          <Panel className="space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-neutral-800 flex items-center justify-center text-xs">1</span>
              {t($ => $.eventBuilder.details.title)}
            </h2>
            
            <div>
              <label className="block text-xs text-neutral-400 mb-1">{t($ => $.eventBuilder.details.eventName)}</label>
              <input type="text" value={eventName} onChange={e => setEventName(e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-white text-sm focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 outline-none transition-colors" />
            </div>
            
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">{t($ => $.eventBuilder.details.date)}</label>
                <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} min={currentDate} className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-white text-sm focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">{t($ => $.eventBuilder.details.venue)}</label>
                <Select value={venueId} onChange={setVenueId} options={venueOptions} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">{t($ => $.eventBuilder.details.ticketPrice)}</label>
                <input type="number" min="10" value={ticketPrice} onChange={e => setTicketPrice(Number(e.target.value))} className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-white text-sm focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">{t($ => $.eventBuilder.details.marketingSpend)}</label>
                <input type="number" min="0" step="1000" value={marketingSpend} onChange={e => setMarketingSpend(Number(e.target.value))} className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-white text-sm focus:border-blue-500 outline-none" />
              </div>
            </div>
          </Panel>

          <Panel className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-neutral-800 flex items-center justify-center text-xs">2</span>
                {t($ => $.eventBuilder.matchmaking.title)}
              </h2>
              <Button variant="secondary" className="min-h-9 px-3 text-xs" onClick={handleAutoFill}>
                {t($ => $.eventBuilder.matchmaking.autoFill)}
              </Button>
            </div>
            
            <div>
              <label className="block text-xs text-neutral-400 mb-1">{t($ => $.eventBuilder.matchmaking.weightClass)}</label>
              <Select 
                value={selectedWC} 
                onChange={val => { setSelectedWC(val); setRedFighter(''); setBlueFighter(''); }} 
                options={wcOptions} 
              />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
              <input value={fighterSearch} onChange={event => setFighterSearch(event.target.value)} placeholder={t($ => $.eventBuilder.matchmaking.search)} aria-label={t($ => $.eventBuilder.matchmaking.searchLabel)} className="min-w-0 rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-neutral-500" />
              <Select value={readinessFilter} onChange={value => setReadinessFilter(value as typeof readinessFilter)} options={[{ value: 'All', label: t($ => $.eventBuilder.matchmaking.allReadiness) }, { value: 'Ready', label: t($ => $.eventBuilder.matchmaking.ready) }, { value: 'Risky', label: t($ => $.eventBuilder.matchmaking.tired) }]} className="sm:w-32" />
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">{t($ => $.eventBuilder.matchmaking.redCorner)}</label>
                <Select 
                  value={redFighter} 
                  onChange={setRedFighter} 
                  options={fighterOptions}
                  placeholder={t($ => $.eventBuilder.matchmaking.selectFighter)}
                />
              </div>
              <div className="flex justify-center -my-2 relative z-10">
                <span className="bg-neutral-800 text-xs font-bold px-2 py-0.5 rounded text-neutral-400">{t($ => $.eventBuilder.matchmaking.versus)}</span>
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">{t($ => $.eventBuilder.matchmaking.blueCorner)}</label>
                <Select 
                  value={blueFighter} 
                  onChange={setBlueFighter} 
                  options={fighterOptions}
                  placeholder={t($ => $.eventBuilder.matchmaking.selectFighter)}
                />
              </div>
            </div>

            {comparison && <div className="rounded border border-blue-900/50 bg-blue-950/20 p-3 text-xs text-neutral-300" title={t($ => $.eventBuilder.matchmaking.advisory)}><div className="flex items-center justify-between gap-3"><p className="font-mono uppercase tracking-[0.12em] text-blue-300">{t($ => $.eventBuilder.matchmaking.comparison)}</p><p><span className="font-semibold text-white">{comparison.red.firstName} {comparison.red.lastName} {comparison.redChance}%</span> · <span className="font-semibold text-white">{comparison.blueChance}% {comparison.blue.firstName} {comparison.blue.lastName}</span></p></div><p className="mt-2">OVR {comparison.redOverall} vs {comparison.blueOverall} · {comparison.red.style} vs {comparison.blue.style} · {comparison.red.record.wins}-{comparison.red.record.losses} vs {comparison.blue.record.wins}-{comparison.blue.record.losses}</p>{comparison.mismatchWarning && <p className="mt-2 text-amber-300">{comparison.mismatchWarning}</p>}<p className="mt-1 text-neutral-400">{comparison.styleNote} {comparison.readiness.red.label} / {comparison.readiness.blue.label}.</p></div>}

            {recommendations.length > 0 && <div className="rounded border border-neutral-800 bg-neutral-950 p-3"><p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">{t($ => $.eventBuilder.matchmaking.recommended)}</p><div className="space-y-2">{recommendations.slice(0, 3).map(recommendation => <div key={`${recommendation.red.id}-${recommendation.blue.id}`} className="flex items-center justify-between gap-2 text-xs"><div className="min-w-0"><p className="truncate text-neutral-200">{recommendation.red.firstName} {recommendation.red.lastName} vs {recommendation.blue.firstName} {recommendation.blue.lastName} <span title={t($ => $.eventBuilder.matchmaking.quality)} className="text-blue-300">{recommendation.score}</span></p><p className="truncate text-neutral-500">{recommendation.reasons.slice(0, 2).join(' · ')}</p></div><Button variant="quiet" onClick={() => { setRedFighter(recommendation.red.id); setBlueFighter(recommendation.blue.id); }} className="min-h-8 px-2 text-[10px]">{t($ => $.eventBuilder.matchmaking.use)}</Button></div>)}</div></div>}

            <div className="flex items-center gap-4 bg-neutral-950 p-3 rounded border border-neutral-800">
              <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
                <input type="checkbox" checked={isTitleFight} onChange={e => setIsTitleFight(e.target.checked)} className="bg-neutral-900 border-neutral-700 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-neutral-950" />
                {t($ => $.eventBuilder.matchmaking.titleFight)}
              </label>
              <div className="h-4 w-px bg-neutral-800"></div>
              <label className="flex items-center gap-2 text-sm text-neutral-300">
                {t($ => $.eventBuilder.matchmaking.rounds)}:
                <Select 
                  value={rounds} 
                  onChange={setRounds} 
                  options={[{ value: '3', label: '3' }, { value: '5', label: '5' }]} 
                  className="w-20 inline-block text-xs ml-2"
                />
              </label>
            </div>

            <Button variant="primary" onClick={addFight} className="mt-2 w-full">
              {t($ => $.eventBuilder.matchmaking.addFight)}
            </Button>
          </Panel>
        </div>

        {/* Middle/Right Column - Projections & Card */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Projections Panel */}
          <Panel>
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-neutral-800 flex items-center justify-center text-xs">3</span>
              {t($ => $.eventBuilder.projections.title)}
            </h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
                <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mb-1">{t($ => $.eventBuilder.projections.hype)}</div>
                <div className="text-xl font-bold text-white flex items-end gap-1">
                  {Math.round(projections.eventHype)}
                  <span className="text-xs text-neutral-500 mb-1">/100</span>
                </div>
              </div>
              <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
                <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mb-1">{t($ => $.eventBuilder.projections.attendance)}</div>
                <div className="text-xl font-bold text-white flex items-end gap-1">
                  {formatNumber(projections.expectedAttendance, language)}
                  <span className="text-xs text-neutral-500 mb-1">/ {formatNumber(venues[venueId].capacity, language)}</span>
                </div>
              </div>
              <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
                <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mb-1">{t($ => $.eventBuilder.projections.revenue)}</div>
                <div className="text-xl font-bold text-green-400">
                  {formatCurrency(projections.expectedGate + (projections.broadcastRevenue || 0), language)}
                </div>
              </div>
              <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
                <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mb-1">{t($ => $.eventBuilder.projections.profit)}</div>
                <div className={`text-xl font-bold ${projections.expectedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(Math.round(projections.expectedProfit), language)}
                </div>
              </div>
            </div>

            {projections.warnings.length > 0 && (
              <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-red-400 font-bold text-sm mb-2">
                  <AlertTriangle size={16} /> {t($ => $.eventBuilder.projections.warnings, { count: projections.warnings.length })}
                </div>
                <ul className="text-xs text-red-300 space-y-1 list-disc pl-5">
                  {projections.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
            
            {projections.warnings.length === 0 && fights.length > 0 && (
              <div className="bg-green-950/30 border border-green-900/50 rounded-lg p-3 flex items-center gap-2 text-green-400 text-sm">
                <Info size={16} /> {t($ => $.eventBuilder.projections.good)}
              </div>
            )}
          </Panel>

          {/* Fight Card */}
          <Panel className="flex min-h-[400px] flex-1 flex-col">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-neutral-800 flex items-center justify-center text-xs">4</span>
              {t($ => $.eventBuilder.card.heading, { count: fights.length })}
            </h2>
            
            <div className="flex-1 space-y-2 overflow-y-auto pr-2">
              {fights.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-neutral-500">
                  <p className="text-sm">{t($ => $.eventBuilder.card.empty)}</p>
                  <p className="text-xs mt-1">{t($ => $.eventBuilder.card.emptyHint)}</p>
                </div>
              ) : (
                fights.map((fight, idx) => {
                  const red = fighters[fight.redCornerId];
                  const blue = fighters[fight.blueCornerId];
                  const isMainEvent = idx === 0;
                  const isCoMain = idx === 1;
                  
                  let slotLabel: string = t($ => $.eventBuilder.card.bout, { number: fights.length - idx });
                  if (isMainEvent) slotLabel = t($ => $.eventBuilder.card.mainEvent);
                  else if (isCoMain) slotLabel = t($ => $.eventBuilder.card.coMain);
                  else if (idx < 5) slotLabel = t($ => $.eventBuilder.card.mainCard);
                  else slotLabel = t($ => $.eventBuilder.card.prelims);

                  return (
                    <div key={idx} className={`flex flex-wrap items-start gap-3 rounded border p-3 transition-colors sm:flex-nowrap sm:items-center ${isMainEvent ? 'bg-neutral-800 border-neutral-600' : 'bg-neutral-950 border-neutral-800'}`}>
                      {/* Order Controls */}
                      <div className="flex flex-col gap-1">
                        <button type="button" aria-label={t($ => $.eventBuilder.card.moveUp, { slot: slotLabel })} onClick={() => moveFight(idx, 'up')} disabled={idx === 0} className="text-neutral-500 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-500 transition-colors">
                          <ArrowUp size={14} />
                        </button>
                        <button type="button" aria-label={t($ => $.eventBuilder.card.moveDown, { slot: slotLabel })} onClick={() => moveFight(idx, 'down')} disabled={idx === fights.length - 1} className="text-neutral-500 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-500 transition-colors">
                          <ArrowDown size={14} />
                        </button>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap justify-between gap-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                          <span className={isMainEvent || isCoMain ? 'text-yellow-500/80' : ''}>{slotLabel}</span>
                          <span className="flex flex-wrap items-center justify-end gap-2">
                            {t($ => $.eventBuilder.card.rounds, { count: fight.rounds })}
                            <span className="w-1 h-1 rounded-full bg-neutral-600"></span>
                            {formatWeightClass(fight.weightClass, language)}
                            {fight.isTitleFight && <ChampionshipBelt weightClass={fight.weightClass} type={fight.titleFightType === 'interim' ? 'interim' : 'undisputed'} size="marker" alt="" />}
                            {fight.isTitleFight && (
                              <span className="ml-1 text-yellow-500">
                                {fight.titleFightType === 'interim' ? `${t($ => $.eventBuilder.card.interim)} ` : fight.titleFightType === 'unification' ? `${t($ => $.eventBuilder.card.unification)} ` : fight.titleFightType === 'vacant_undisputed' ? `${t($ => $.eventBuilder.card.vacant)} ` : ''}
                                {belts['belt_' + fight.weightClass.toLowerCase()]?.shortName || t($ => $.eventBuilder.card.title)}
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
                                <span title={t($ => $.eventBuilder.card.gpTitleShotHelp)} className="text-purple-400 ml-1 font-bold">
                                  🛡 {t($ => $.eventBuilder.card.gpTitleShot)}
                                </span>
                              );
                            })()}
                            {(fight as any).tournamentId && (
                              <span title={t($ => $.eventBuilder.card.gpRoundHelp)} className="text-purple-400 ml-1 font-bold text-xs uppercase">
                                🛡 {((fight as any).tournamentRound === 'quarterfinal') ? t($ => $.eventBuilder.card.gpQuarterfinal) : ((fight as any).tournamentRound === 'semifinal') ? t($ => $.eventBuilder.card.gpSemifinal) : t($ => $.eventBuilder.card.gpFinal)}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex flex-col gap-2 rounded bg-neutral-900/50 p-2 text-sm font-bold text-white sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 w-full items-center gap-2 sm:w-[45%] sm:justify-end sm:text-right">
                            <FighterRankBadge fighterId={red.id} /><span className="truncate">{red.firstName} <span className="text-neutral-400">{red.lastName}</span></span>
                            <CountryFlag nationality={red.nationality} className="text-xs" />
                            <FighterAvatar id={red.id} name={`${red.firstName} ${red.lastName}`} nationality={red.nationality} className="h-6 w-6" />
                            <span className="text-[10px] font-normal text-neutral-500 min-w-[42px]">OVR {getFighterOverall(red)}</span>
                          </div>
                          <span className="w-full text-center text-xs italic text-neutral-600 sm:w-[10%]">vs</span>
                          <div className="flex min-w-0 w-full items-center gap-2 sm:w-[45%]">
                            <span className="text-[10px] font-normal text-neutral-500 min-w-[42px]">OVR {getFighterOverall(blue)}</span>
                            <FighterAvatar id={blue.id} name={`${blue.firstName} ${blue.lastName}`} nationality={blue.nationality} className="h-6 w-6" />
                            <CountryFlag nationality={blue.nationality} className="text-xs" />
                            <FighterRankBadge fighterId={blue.id} /><span className="truncate">{blue.firstName} <span className="text-neutral-400">{blue.lastName}</span></span>
                          </div>
                        </div>
                      </div>
                      <div className="order-last w-full sm:order-none sm:w-40">
                        <p className="mb-1 truncate text-[10px] text-neutral-500" title={campSummary(fight.campFocus)}>{t($ => $.eventBuilder.camp.label, { value: campSummary(fight.campFocus) })}</p>
                        <Select
                          value={fight.campFocus ?? 'balanced'}
                          onChange={value => setFights(fights.map((item, index) => index === idx ? { ...item, campFocus: value as FightCampFocus } : item))}
                          options={campOptions}
                          className="text-xs"
                        />
                      </div>
                      <button type="button" aria-label={t($ => $.eventBuilder.card.remove, { slot: slotLabel })} onClick={() => removeFight(idx)} className="rounded p-2 text-red-500/50 transition-colors hover:bg-red-500/10 hover:text-red-400 sm:ml-2">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-neutral-800">
              <Button variant="primary" onClick={handleBook} disabled={fights.length === 0} className="w-full">
                {isEditing ? t($ => $.eventBuilder.card.update) : t($ => $.eventBuilder.card.confirm)}
              </Button>
            </div>
          </Panel>

        </div>
      </div>
    </div>
  );
}
