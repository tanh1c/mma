import React, { useEffect, useState } from 'react';
import { ArrowLeft, UserCheck, UserMinus } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { getContractExpectation, evaluateOffer } from '../lib/game/contracts';
import { deriveFighterAchievements } from '../lib/game/fighterAchievements';
import { deriveFighterTimeline } from '../lib/game/timeline';
import { CountryFlag } from '../components/CountryFlag';
import { FighterAvatar } from '../components/FighterAvatar';
import { Button, PageHeader, Panel } from '../components/ui';

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'achievements', label: 'Achievements' },
  { id: 'contract', label: 'Contract' },
  { id: 'fights', label: 'Fight Log' },
  { id: 'timeline', label: 'Timeline' }
] as const;

type FighterTab = typeof tabs[number]['id'];

export default function FighterDetail() {
  const state = useGameStore();
  const { selectedFighterId, fighters, setView, goBack, signFighter, renewFighter, releaseFighter, promotion, fightArchive } = state;
  const f = selectedFighterId ? fighters[selectedFighterId] : null;
  const [activeTab, setActiveTab] = useState<FighterTab>('overview');
  const [offerPay, setOfferPay] = useState(10000);
  const [offerBonus, setOfferBonus] = useState(10000);
  const [offerFights, setOfferFights] = useState(3);
  const [negotiationResult, setNegotiationResult] = useState<{ accepted: boolean; reason: string } | null>(null);

  useEffect(() => {
    if (!f) return;
    const expectation = getContractExpectation(f, promotion);
    setOfferPay(expectation.basePay);
    setOfferBonus(expectation.winBonus);
    setOfferFights(expectation.fights);
    setNegotiationResult(null);
    setActiveTab(f.contract ? 'overview' : 'contract');
  }, [f?.id]);

  if (!f) return <div>Fighter not found.</div>;

  const fighterFights = Object.values(fightArchive)
    .filter(fight => fight.redFighterId === f.id || fight.blueFighterId === f.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const titleFights = fighterFights.filter(fight => fight.isTitleFight).length;
  const kos = fighterFights.filter(fight => fight.winnerId === f.id && fight.method.includes('KO')).length;
  const subs = fighterFights.filter(fight => fight.winnerId === f.id && fight.method.includes('Submission')).length;
  const decWins = fighterFights.filter(fight => fight.winnerId === f.id && fight.method.includes('Decision')).length;
  const decLosses = fighterFights.filter(fight => fight.winnerId !== f.id && fight.winnerId !== null && fight.method.includes('Decision')).length;
  const averagePerformance = fighterFights.length ? Math.floor(fighterFights.reduce((total, fight) => total + (fight.performanceRating || 0), 0) / fighterFights.length) : 0;
  const tournaments = Object.values(state.tournaments || {});
  const gpWins4Man = tournaments.filter(tournament => tournament.winnerId === f.id && tournament.status === 'completed' && tournament.format === 'four_man').length;
  const gpWins8Man = tournaments.filter(tournament => tournament.winnerId === f.id && tournament.status === 'completed' && tournament.format === 'eight_man').length;
  const gpFinals = tournaments.filter(tournament => tournament.status === 'completed' && tournament.fights.some(fight => fight.round === 'final' && (fight.redFighterId === f.id || fight.blueFighterId === f.id))).length;
  const gpRecord = tournaments.reduce((record, tournament) => tournament.fights.reduce((total, fight) => {
    if (!fight.isCompleted || (fight.redFighterId !== f.id && fight.blueFighterId !== f.id)) return total;
    if (fight.winnerId === f.id) total.wins += 1;
    else if (fight.winnerId) total.losses += 1;
    return total;
  }, record), { wins: 0, losses: 0 });
  const reverseFights = [...fighterFights].reverse();
  const longestStreak = reverseFights.reduce((result, fight) => {
    result.current = fight.winnerId === f.id ? result.current + 1 : 0;
    result.longest = Math.max(result.longest, result.current);
    return result;
  }, { current: 0, longest: 0 }).longest;
  const currentStreak = fighterFights.reduce((streak, fight) => streak === -1 ? -1 : fight.winnerId === f.id ? streak + 1 : -1, 0);
  const timeline = deriveFighterTimeline(state, f.id);
  const achievements = deriveFighterAchievements(state, f.id);

  const handleSign = () => {
    setNegotiationResult(null);
    const result = evaluateOffer(f, promotion, offerPay, offerBonus, offerFights);
    setNegotiationResult(result);
    if (result.accepted) {
      if (f.contract) renewFighter(f.id, offerPay, offerBonus, offerFights);
      else signFighter(f.id, offerPay, offerBonus, offerFights);
    }
  };

  const handleRelease = () => {
    if (window.confirm(`Are you sure you want to release ${f.lastName}?`)) {
      releaseFighter(f.id);
      setView('roster', undefined, { replace: true });
    }
  };

  const selectTab = (tab: FighterTab) => setActiveTab(tab);
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const nextIndex = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
    if (nextIndex === null) return;
    event.preventDefault();
    selectTab(tabs[nextIndex].id);
    document.getElementById(`fighter-tab-${tabs[nextIndex].id}`)?.focus();
  };
  const openFight = (fightArchiveId: string) => setView('fight-detail', { fightArchiveId });

  return <div className="mx-auto max-w-4xl space-y-6 pb-12">
    <PageHeader eyebrow={f.weightClass} title={`${f.firstName} ${f.lastName}`} actions={<Button variant="quiet" onClick={() => goBack(f.contract ? 'roster' : 'free-agents')} className="inline-flex items-center gap-2"><ArrowLeft size={16} /> Back</Button>} />

    <Panel>
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <FighterAvatar id={f.id} name={`${f.firstName} ${f.lastName}`} nationality={f.nationality} className="h-20 w-20 border border-neutral-700" />
          <div className="min-w-0">
            <h2 className="text-2xl font-normal tracking-[-0.03em] text-white sm:text-3xl">{f.firstName} {f.lastName}</h2>
            <div className="mt-1 flex items-center gap-2 text-sm text-neutral-400"><CountryFlag nationality={f.nationality} className="text-base" /><span>{f.nationality} · {f.age} years</span></div>
            {f.nickname && <p className="mt-1 text-sm italic text-neutral-400">“{f.nickname}”</p>}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center md:min-w-72">
          <ProfileStat label="Record" value={`${f.record.wins}-${f.record.losses}-${f.record.draws}`} detail={`${f.record.kos} KO · ${f.record.subs} SUB`} />
          <ProfileStat label="Style" value={f.style} />
          <ProfileStat label="Status" value={f.injuryStatus ? 'Injured' : f.medicalSuspension ? 'Suspended' : f.fatigue > 50 ? 'Fatigued' : 'Ready'} tone={f.injuryStatus ? 'danger' : f.medicalSuspension || f.fatigue > 50 ? 'warning' : 'success'} />
        </div>
      </div>
    </Panel>

    <div role="tablist" aria-label="Fighter detail sections" className="custom-scrollbar flex overflow-x-auto border-b border-[#2a2c31]">
      {tabs.map((tab, index) => <button key={tab.id} id={`fighter-tab-${tab.id}`} type="button" role="tab" aria-selected={activeTab === tab.id} aria-controls={`fighter-panel-${tab.id}`} tabIndex={activeTab === tab.id ? 0 : -1} onClick={() => selectTab(tab.id)} onKeyDown={event => handleTabKeyDown(event, index)} className={`shrink-0 border-b-2 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white ${activeTab === tab.id ? 'border-white text-white' : 'border-transparent text-neutral-500 hover:text-neutral-200'}`}>{tab.label}</button>)}
    </div>

    <section id={`fighter-panel-${activeTab}`} role="tabpanel" aria-labelledby={`fighter-tab-${activeTab}`} tabIndex={0}>
      {activeTab === 'overview' && <div className="space-y-6">
        <Panel>
          <h2 className="mb-4 text-lg font-medium tracking-tight text-white">Attributes</h2>
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2"><AttrBar label="Striking" value={f.attributes.striking} /><AttrBar label="Grappling" value={f.attributes.grappling} /><AttrBar label="Wrestling" value={f.attributes.wrestling} /><AttrBar label="Submissions" value={f.attributes.submissions} /><AttrBar label="Cardio" value={f.attributes.cardio} /><AttrBar label="Chin" value={f.attributes.chin} /><AttrBar label="Power" value={f.attributes.power} /><AttrBar label="Speed" value={f.attributes.speed} /><AttrBar label="Defense" value={f.attributes.defense} /><AttrBar label="Fight IQ" value={f.attributes.fightIq} /></div>
        </Panel>
        <Panel>
          <h2 className="mb-4 text-lg font-medium tracking-tight text-white">Career Summary</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><CareerStat label="Title Fights" value={titleFights} tone="warning" /><CareerStat label="Current Streak" value={currentStreak > 0 ? `${currentStreak} W` : '—'} /><CareerStat label="Best Streak" value={longestStreak} /><CareerStat label="Avg. Performance" value={averagePerformance} /></div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"><CareerStat label="KO/TKO Wins" value={kos} tone="danger" /><CareerStat label="Submission Wins" value={subs} tone="warning" /><CareerStat label="Decision Wins" value={decWins} /><CareerStat label="Decision Losses" value={decLosses} /></div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5"><CareerStat label="4-Man GP" value={gpWins4Man} tone="warning" /><CareerStat label="8-Man GP" value={gpWins8Man} tone="warning" /><CareerStat label="GP Finals" value={gpFinals} /><CareerStat label="GP Record" value={`${gpRecord.wins}-${gpRecord.losses}`} /><CareerStat label="Title Shot" value={f.titleShotPromised ? 'Pending' : '—'} tone={f.titleShotPromised ? 'success' : 'neutral'} /></div>
        </Panel>
      </div>}

      {activeTab === 'achievements' && <Panel>
        <h2 className="text-lg font-medium tracking-tight text-white">Achievements</h2>
        <p className="mt-1 text-sm text-neutral-500">Titles, Grand Prix results, annual awards, and promotion milestones.</p>
        {achievements.length === 0 ? <p className="py-10 text-center text-sm text-neutral-500">No achievements yet. Win title fights, Grand Prix tournaments, or yearly awards to fill this section.</p> : <div className="mt-5 space-y-6">{['Titles', 'Grand Prix', 'Awards', 'Milestones'].map(category => {
          const items = achievements.filter(item => item.category === category);
          if (!items.length) return null;
          return <section key={category}><h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">{category}</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{items.map((item, index) => {
            const className = `rounded-lg border bg-neutral-950 p-4 text-left ${item.tone === 'success' ? 'border-emerald-900' : item.tone === 'warning' ? 'border-amber-900' : item.tone === 'danger' ? 'border-red-900' : 'border-[#2a2c31]'}`;
            const content = <><div className="flex items-start justify-between gap-3"><h4 className="font-medium text-white">{item.title}</h4><span className="shrink-0 font-mono text-[10px] text-neutral-500">{item.date}</span></div><p className="mt-2 text-sm text-neutral-400">{item.description}</p></>;
            return item.fightArchiveId ? <button key={`${item.title}-${index}`} type="button" onClick={() => openFight(item.fightArchiveId!)} className={`${className} transition-colors hover:bg-[#1b1c20] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}>{content}</button> : <div key={`${item.title}-${index}`} className={className}>{content}</div>;
          })}</div></section>;
        })}</div>}
      </Panel>}

      {activeTab === 'contract' && <Panel>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-medium tracking-tight text-white">{f.contract ? 'Contract & Extension' : 'Negotiate Contract'}</h2>{f.contract && <Button variant="danger" onClick={handleRelease} className="inline-flex items-center gap-2"><UserMinus size={16} /> Release Fighter</Button>}</div>
        {f.contract && <div className="mb-6 flex flex-col justify-between gap-3 rounded-lg border border-[#2a2c31] bg-neutral-950 p-4 sm:flex-row sm:items-center"><div><p className="text-sm text-neutral-400">Current deal: <span className="text-white">${f.contract.payPerFight.toLocaleString()}</span> to show, <span className="text-white">${f.contract.winBonus.toLocaleString()}</span> to win</p><p className={`mt-1 text-sm ${f.contract.fightsRemaining <= 1 ? 'text-red-300' : 'text-neutral-400'}`}>Fights remaining: {f.contract.fightsRemaining}</p></div>{f.isChampion && f.contract.fightsRemaining === 0 && <p className="text-sm text-red-300">Champion contract expired. Renew immediately or vacate the title.</p>}</div>}
        {negotiationResult && <div className={`mb-4 rounded-lg border p-4 ${negotiationResult.accepted ? 'border-emerald-900 text-emerald-300' : 'border-red-900 text-red-300'}`}><p className="font-medium">{negotiationResult.accepted ? 'Offer Accepted' : 'Offer Rejected'}</p><p className="mt-1 text-sm">{negotiationResult.reason}</p></div>}
        <p className="mb-4 text-sm text-neutral-400">Expected: <span className="text-white">${getContractExpectation(f, promotion).basePay.toLocaleString()}</span> to show · <span className="text-white">${getContractExpectation(f, promotion).winBonus.toLocaleString()}</span> to win · <span className="text-white">{getContractExpectation(f, promotion).interestLabel}</span></p>
        <div className="grid gap-4 md:grid-cols-3"><ContractInput label="Pay per Fight ($)" value={offerPay} onChange={setOfferPay} step={1000} /><ContractInput label="Win Bonus ($)" value={offerBonus} onChange={setOfferBonus} step={1000} /><ContractInput label="Fights" value={offerFights} onChange={setOfferFights} min={1} max={8} /></div>
        {!negotiationResult?.accepted && <Button variant="primary" onClick={handleSign} className="mt-5 inline-flex items-center gap-2"><UserCheck size={16} /> {f.contract ? 'Offer Extension' : 'Offer Contract'}</Button>}
      </Panel>}

      {activeTab === 'fights' && <Panel>
        <h2 className="mb-4 text-lg font-medium tracking-tight text-white">Fight Log</h2>
        {fighterFights.length ? <div className="overflow-x-auto custom-scrollbar"><table className="min-w-[640px] w-full text-left text-sm"><thead className="border-b border-[#2a2c31] font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500"><tr><th className="pb-3 font-normal">Date</th><th className="pb-3 font-normal">Event</th><th className="pb-3 font-normal">Opponent</th><th className="pb-3 font-normal">Result</th><th className="pb-3 font-normal">Method</th><th className="pb-3 font-normal">Round</th></tr></thead><tbody className="divide-y divide-[#2a2c31]">{fighterFights.map(fight => {
          const opponentId = fight.redFighterId === f.id ? fight.blueFighterId : fight.redFighterId;
          const opponent = fighters[opponentId];
          const opponentName = opponent ? `${opponent.firstName} ${opponent.lastName}` : 'Unknown';
          const result = fight.winnerId === null ? 'Draw' : fight.winnerId === f.id ? 'Win' : 'Loss';
          return <tr key={fight.id} tabIndex={0} role="button" aria-label={`View fight details against ${opponentName} on ${fight.date}`} onClick={() => openFight(fight.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openFight(fight.id); } }} className="cursor-pointer transition-colors hover:bg-white/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white"><td className="py-3 font-mono text-xs text-neutral-500">{fight.date}</td><td className="py-3 text-neutral-300">{fight.eventName}</td><td className="py-3 text-white">vs. {opponentName}{fight.isTitleFight && <span className="ml-2 text-amber-300">Title</span>}</td><td className={`py-3 font-medium ${result === 'Win' ? 'text-emerald-300' : result === 'Loss' ? 'text-red-300' : 'text-neutral-400'}`}>{result}</td><td className="py-3 text-neutral-400">{fight.method}</td><td className="py-3 font-mono text-xs text-neutral-400">{fight.round} ({fight.time})</td></tr>;
        })}</tbody></table></div> : <div className="space-y-3 text-center"><p className="py-6 text-sm text-neutral-500">No archived fights yet.</p>{f.history.length > 0 && <div className="text-left"><h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">Legacy history</h3>{f.history.map((entry, index) => <p key={index} className="border-t border-[#2a2c31] py-2 text-sm text-neutral-300">{entry}</p>)}</div>}</div>}
      </Panel>}

      {activeTab === 'timeline' && <Panel>
        <h2 className="mb-4 text-lg font-medium tracking-tight text-white">Career Timeline</h2>
        {timeline.length ? <div className="space-y-4 border-l border-[#2a2c31] pl-5">{timeline.map((item, index) => <div key={`${item.date}-${index}`} className="relative"><span className={`absolute -left-[1.62rem] top-1.5 h-2.5 w-2.5 rounded-full ${item.type.includes('win') || item.type === 'title_defense' || item.type === 'unification' ? 'bg-emerald-400' : item.type.includes('loss') ? 'bg-red-400' : item.type === 'injury' ? 'bg-amber-300' : 'bg-neutral-500'}`} />{item.fightId ? <button type="button" onClick={() => openFight(item.fightId!)} className="text-left text-sm font-medium text-white hover:text-neutral-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{item.title}</button> : <p className="text-sm font-medium text-white">{item.title}</p>}<p className="mt-1 font-mono text-[10px] text-neutral-500">{item.date}</p><p className="mt-1 text-sm text-neutral-400">{item.description}</p></div>)}</div> : <p className="py-8 text-center text-sm text-neutral-500">No career timeline entries yet.</p>}
      </Panel>}
    </section>
  </div>;
}

function ProfileStat({ label, value, detail, tone = 'neutral' }: { label: string; value: string; detail?: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const toneClass = tone === 'success' ? 'text-emerald-300' : tone === 'warning' ? 'text-amber-300' : tone === 'danger' ? 'text-red-300' : 'text-white';
  return <div className="min-w-0 border-l border-[#2a2c31] pl-3 text-left"><p className="font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-500">{label}</p><p className={`mt-1 truncate text-sm font-medium ${toneClass}`}>{value}</p>{detail && <p className="mt-1 text-[10px] text-neutral-500">{detail}</p>}</div>;
}

function CareerStat({ label, value, tone = 'neutral' }: { label: string; value: string | number; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const toneClass = tone === 'success' ? 'text-emerald-300' : tone === 'warning' ? 'text-amber-300' : tone === 'danger' ? 'text-red-300' : 'text-white';
  return <div className="rounded-lg border border-[#2a2c31] bg-neutral-950 p-3"><p className="font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-500">{label}</p><p className={`mt-2 text-xl font-normal tracking-[-0.03em] ${toneClass}`}>{value}</p></div>;
}

function ContractInput({ label, value, onChange, min, max, step }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number }) {
  return <label className="block"><span className="mb-1 block text-xs text-neutral-400">{label}</span><input type="number" value={value} min={min} max={max} step={step} onChange={event => onChange(Number(event.target.value))} className="w-full rounded-lg border border-[#2a2c31] bg-neutral-950 px-3 py-2 text-white focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500" /></label>;
}

function AttrBar({ label, value }: { label: string; value: number }) {
  const color = value > 80 ? 'bg-emerald-400' : value > 60 ? 'bg-amber-300' : 'bg-red-400';
  return <div className="flex items-center text-xs"><span className="w-24 text-neutral-400">{label}</span><div className="mx-2 h-2 flex-1 overflow-hidden rounded-full bg-neutral-900"><div className={`h-full ${color}`} style={{ width: `${value}%` }} /></div><span className="w-6 text-right font-mono text-white">{value}</span></div>;
}
