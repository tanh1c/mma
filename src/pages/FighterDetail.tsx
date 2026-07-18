import React, { useEffect, useState } from 'react';
import { ArrowLeft, Flame, Medal, Trophy, UserCheck, UserMinus } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import type { ContractCounterOffer, Fighter, FighterAttributes, FighterStyle, WeightClass } from '../types/game';
import type { FighterEditError, FighterEditInput } from '../lib/game/career';
import { FIGHTER_STYLES, WEIGHT_CLASSES } from '../lib/game/constants';
import { getContractExpectation, getContractStatus, evaluateOffer } from '../lib/game/contracts';
import { deriveFighterAchievements, type FighterAchievement } from '../lib/game/fighterAchievements';
import { deriveFighterTimeline } from '../lib/game/timeline';
import { CountryFlag } from '../components/CountryFlag';
import { FighterAvatar } from '../components/FighterAvatar';
import { Button, PageHeader, Panel } from '../components/ui';
import { getFighterOverall, getWeightCutPercent } from '../lib/game/fighterRatings';
import { formatHeight, formatWeight } from '../lib/displayUnits';
import { useSettingsStore } from '../store/settingsStore';
import { getFighterSocialFeed, getFighterStorylines } from '../lib/game/social';
import { ChampionshipBelt, type BeltType } from '../components/ChampionshipBelt';
import { FighterRankBadge } from '../components/FighterRankBadge';
import { Select } from '../components/Select';
import { useTranslation } from 'react-i18next';
import { formatContractInterest, formatCurrency, formatDate, formatFightMethod, formatFighterStyle, formatReadiness, formatWeightClass } from '../lib/localization';

const tabs = [
  { id: 'overview' },
  { id: 'achievements' },
  { id: 'storylines' },
  { id: 'contract' },
  { id: 'fights' },
  { id: 'timeline' }
] as const;

type FighterTab = typeof tabs[number]['id'];
type AttributeKey = keyof FighterAttributes;

const attributeKeys: AttributeKey[] = ['striking', 'grappling', 'wrestling', 'submissions', 'cardio', 'chin', 'power', 'speed', 'defense', 'fightIq', 'toughness'];

function createFighterDraft(fighter: Fighter): FighterEditInput {
  return {
    firstName: fighter.firstName,
    lastName: fighter.lastName,
    nickname: fighter.nickname,
    age: fighter.age,
    nationality: fighter.nationality,
    weightClass: fighter.weightClass,
    heightCm: fighter.heightCm,
    fightWeightLb: fighter.fightWeightLb,
    walkAroundWeightLb: fighter.walkAroundWeightLb,
    style: fighter.style,
    attributes: { ...fighter.attributes },
    potential: fighter.potential,
    popularity: fighter.popularity,
    morale: fighter.morale,
    momentum: fighter.momentum,
    fatigue: fighter.fatigue
  };
}

export default function FighterDetail() {
  const { t } = useTranslation('translation');
  const state = useGameStore();
  const { unitSystem, language } = useSettingsStore();
  const { selectedFighterId, fighters, setView, goBack, signFighter, renewFighter, setCounterOffer: saveCounterOffer, releaseFighter, editFighter, promotion, fightArchive } = state;
  const f = selectedFighterId ? fighters[selectedFighterId] : null;
  const [activeTab, setActiveTab] = useState<FighterTab>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<FighterEditInput | null>(null);
  const [editError, setEditError] = useState<FighterEditError | null>(null);
  const [offerPay, setOfferPay] = useState(10000);
  const [offerBonus, setOfferBonus] = useState(10000);
  const [offerFights, setOfferFights] = useState(3);
  const [negotiationResult, setNegotiationResult] = useState<{ accepted: boolean; reason: string } | null>(null);
  const [counterOffer, setCounterOffer] = useState<ContractCounterOffer | null>(null);

  useEffect(() => {
    if (!f) return;
    const expectation = getContractExpectation(f, promotion);
    setOfferPay(expectation.basePay);
    setOfferBonus(expectation.winBonus);
    setOfferFights(expectation.fights);
    setNegotiationResult(null);
    setCounterOffer(f.counterOffer && f.counterOffer.expiresDate >= state.currentDate ? f.counterOffer : null);
    setActiveTab(f.contract ? 'overview' : 'contract');
    setIsEditing(false);
    setDraft(createFighterDraft(f));
    setEditError(null);
  }, [f?.id]);

  if (!f) return <div>{t($ => $.fighterDetail.notFound)}</div>;

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
  const achievements = deriveFighterAchievements(state, f.id, language);
  const fighterStorylines = getFighterStorylines(state, f.id);
  const activeStorylines = fighterStorylines.filter(storyline => storyline.isActive);
  const socialActivity = getFighterSocialFeed(state, f.id);
  const overall = getFighterOverall(f);
  const weightCut = getWeightCutPercent(f);
  const titleState = state.titles[f.weightClass];
  const currentBeltType: BeltType | null = titleState?.undisputedChampionId === f.id ? 'undisputed' : titleState?.interimChampionId === f.id ? 'interim' : null;
  const tabLabels = {
    overview: t($ => $.fighterDetail.tabs.overview),
    achievements: t($ => $.fighterDetail.tabs.achievements),
    storylines: t($ => $.fighterDetail.tabs.storylines),
    contract: t($ => $.fighterDetail.tabs.contract),
    fights: t($ => $.fighterDetail.tabs.fights),
    timeline: t($ => $.fighterDetail.tabs.timeline)
  };
  const statusLabel = f.careerPhase === 'retired' ? t($ => $.fighterDetail.career.retired) : f.injuryStatus ? formatReadiness('injured', language) : f.medicalSuspension ? formatReadiness('suspended', language) : f.fatigue > 50 ? formatReadiness('fatigued', language) : formatReadiness('ready', language);
  const achievementCategoryLabels = {
    Titles: t($ => $.fighterDetail.achievementCategory.titles),
    'Grand Prix': t($ => $.fighterDetail.achievementCategory.grandPrix),
    Awards: t($ => $.fighterDetail.achievementCategory.awards),
    Milestones: t($ => $.fighterDetail.achievementCategory.milestones)
  };
  const socialKindLabels = {
    news: t($ => $.socialHub.kind.news),
    article: t($ => $.socialHub.kind.article),
    fighter_post: t($ => $.socialHub.kind.fighterPost),
    promotion_post: t($ => $.socialHub.kind.promotionPost),
    thread: t($ => $.socialHub.kind.thread)
  };
  const personalityLabels = {
    professional: t($ => $.personality.traits.professional),
    trash_talker: t($ => $.personality.traits.trashTalker),
    diva: t($ => $.personality.traits.diva),
    loyal: t($ => $.personality.traits.loyal),
    mercenary: t($ => $.personality.traits.mercenary),
    risk_taker: t($ => $.personality.traits.riskTaker),
    hot_head: t($ => $.personality.traits.hotHead),
    company_fighter: t($ => $.personality.traits.companyFighter)
  };
  const contractExpectation = getContractExpectation(f, promotion);
  const retirementAge = f.retiredDate ? f.age : null;
  const retirementReasonLabels = {
    age: t($ => $.fighterDetail.career.reasons.age),
    injuries: t($ => $.fighterDetail.career.reasons.injuries),
    decline: t($ => $.fighterDetail.career.reasons.decline),
    inactivity: t($ => $.fighterDetail.career.reasons.inactivity)
  };
  const editErrorMessages: Record<FighterEditError, string> = {
    'fighter-not-found': t($ => $.fighterDetail.editor.errors.fighterNotFound),
    'invalid-name': t($ => $.fighterDetail.editor.errors.invalidName),
    'invalid-nationality': t($ => $.fighterDetail.editor.errors.invalidNationality),
    'invalid-age': t($ => $.fighterDetail.editor.errors.invalidAge),
    'invalid-weight-class': t($ => $.fighterDetail.editor.errors.invalidWeightClass),
    'invalid-style': t($ => $.fighterDetail.editor.errors.invalidStyle),
    'invalid-attributes': t($ => $.fighterDetail.editor.errors.invalidAttributes),
    'invalid-potential': t($ => $.fighterDetail.editor.errors.invalidPotential),
    'invalid-popularity': t($ => $.fighterDetail.editor.errors.invalidPopularity),
    'invalid-morale': t($ => $.fighterDetail.editor.errors.invalidMorale),
    'invalid-momentum': t($ => $.fighterDetail.editor.errors.invalidMomentum),
    'invalid-fatigue': t($ => $.fighterDetail.editor.errors.invalidFatigue),
    'invalid-physical-profile': t($ => $.fighterDetail.editor.errors.invalidPhysicalProfile),
    'weight-class-title': t($ => $.fighterDetail.editor.errors.weightClassTitle),
    'weight-class-booked': t($ => $.fighterDetail.editor.errors.weightClassBooked),
    'weight-class-tournament': t($ => $.fighterDetail.editor.errors.weightClassTournament),
    'weight-class-title-shot': t($ => $.fighterDetail.editor.errors.weightClassTitleShot)
  };

  const updateDraft = <K extends keyof FighterEditInput>(key: K, value: FighterEditInput[K]) => {
    setDraft(current => current ? { ...current, [key]: value } : current);
  };
  const updateAttribute = (key: AttributeKey, value: number) => {
    setDraft(current => current ? { ...current, attributes: { ...current.attributes, [key]: value } } : current);
  };
  const beginEditing = () => {
    setDraft(createFighterDraft(f));
    setEditError(null);
    setIsEditing(true);
  };
  const cancelEditing = () => {
    setDraft(createFighterDraft(f));
    setEditError(null);
    setIsEditing(false);
  };
  const saveEdit = () => {
    if (!draft) return;
    const result = editFighter(f.id, draft);
    if ('error' in result) {
      setEditError(result.error);
      return;
    }
    setDraft(createFighterDraft(result.fighter));
    setEditError(null);
    setIsEditing(false);
  };

  const completeSigning = (pay: number, bonus: number, fights: number) => {
    if (f.contract) renewFighter(f.id, pay, bonus, fights);
    else signFighter(f.id, pay, bonus, fights);
    setCounterOffer(null);
  };

  const handleSign = () => {
    setNegotiationResult(null);
    if (f.counterOffer && f.counterOffer.expiresDate >= state.currentDate) {
      setNegotiationResult({ accepted: false, reason: t($ => $.fighterDetail.respondCounter) });
      return;
    }
    const result = evaluateOffer(f, promotion, offerPay, offerBonus, offerFights, state.currentDate);
    setNegotiationResult(result);
    if (result.accepted) completeSigning(offerPay, offerBonus, offerFights);
    else if ('counterOffer' in result && result.counterOffer) {
      setCounterOffer(result.counterOffer);
      saveCounterOffer(f.id, result.counterOffer);
    }
  };

  const handleRelease = () => {
    if (window.confirm(t($ => $.fighterDetail.releaseConfirm, { name: f.lastName }))) {
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
    <PageHeader eyebrow={formatWeightClass(f.weightClass, language)} title={`${f.firstName} ${f.lastName}`} actions={<Button variant="quiet" onClick={() => goBack(f.contract ? 'roster' : 'free-agents')} className="inline-flex items-center gap-2"><ArrowLeft size={16} /> {t($ => $.common.back)}</Button>} />

    <Panel>
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <FighterAvatar id={f.id} name={`${f.firstName} ${f.lastName}`} nationality={f.nationality} className="h-20 w-20 border border-neutral-700" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><FighterRankBadge fighterId={f.id} former={!f.contract ? f.lastPromotionRank : undefined} /><h2 className="text-2xl font-normal tracking-[-0.03em] text-white sm:text-3xl">{f.firstName} {f.lastName}</h2></div>
            <div className="mt-1 flex items-center gap-2 text-sm text-neutral-400"><CountryFlag nationality={f.nationality} className="text-base" /><span>{f.nationality} · {t($ => $.fighterDetail.years, { count: f.age })}</span></div>
            {f.nickname && <p className="mt-1 text-sm italic text-neutral-400">“{f.nickname}”</p>}
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {currentBeltType && <div className="flex flex-col items-center"><ChampionshipBelt weightClass={f.weightClass} type={currentBeltType} size="champion" alt={t($ => $.fighterDetail.beltAlt, { weightClass: formatWeightClass(f.weightClass, language), type: currentBeltType === 'interim' ? t($ => $.fighterDetail.interimChampion) : t($ => $.fighterDetail.undisputedChampion), name: `${f.firstName} ${f.lastName}` })} /><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-amber-300">{currentBeltType === 'interim' ? t($ => $.fighterDetail.interimChampion) : t($ => $.fighterDetail.undisputedChampion)}</p></div>}
          <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-5 md:min-w-[30rem]">
            <ProfileStat label="OVR" value={String(overall)} tone={overall >= 80 ? 'success' : overall >= 65 ? 'warning' : 'neutral'} />
            <ProfileStat label="POT" value={String(f.potential)} />
            <ProfileStat label={t($ => $.fighterDetail.record)} value={`${f.record.wins}-${f.record.losses}-${f.record.draws}`} detail={`${f.record.kos} KO · ${f.record.subs} SUB`} />
            <ProfileStat label={t($ => $.fighterDetail.style)} value={formatFighterStyle(f.style, language)} />
            <ProfileStat label={t($ => $.fighterDetail.status)} value={statusLabel} tone={f.injuryStatus ? 'danger' : f.medicalSuspension || f.fatigue > 50 ? 'warning' : 'success'} />
          </div>
        </div>
      </div>
    </Panel>

    <div role="tablist" aria-label={t($ => $.fighterDetail.sectionsLabel)} className="flex flex-wrap border-b border-[#2a2c31]">
      {tabs.map((tab, index) => <button key={tab.id} id={`fighter-tab-${tab.id}`} type="button" role="tab" aria-selected={activeTab === tab.id} aria-controls={`fighter-panel-${tab.id}`} tabIndex={activeTab === tab.id ? 0 : -1} onClick={() => selectTab(tab.id)} onKeyDown={event => handleTabKeyDown(event, index)} className={`shrink-0 border-b-2 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white ${activeTab === tab.id ? 'border-white text-white' : 'border-transparent text-neutral-500 hover:text-neutral-200'}`}>{tabLabels[tab.id]}</button>)}
    </div>

    <section id={`fighter-panel-${activeTab}`} role="tabpanel" aria-labelledby={`fighter-tab-${activeTab}`} tabIndex={0}>
      {activeTab === 'overview' && <div className="space-y-6">
        {f.careerPhase === 'retired' && f.retiredDate && <Panel className="border-amber-900/70">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-amber-300">{t($ => $.fighterDetail.career.retired)}</p><p className="mt-2 text-sm text-neutral-300">{t($ => $.fighterDetail.career.retiredOn, { date: formatDate(f.retiredDate, language) })}</p>{retirementAge !== null && <p className="mt-1 text-sm text-neutral-400">{t($ => $.fighterDetail.career.retirementAge, { age: retirementAge })}</p>}{f.retirementReason && <p className="mt-1 text-sm text-neutral-400">{t($ => $.fighterDetail.career.reason, { reason: retirementReasonLabels[f.retirementReason] })}</p>}</div>
            {f.hallOfFame && <p className="rounded-full border border-amber-800 px-3 py-1.5 text-sm text-amber-200">{t($ => $.fighterDetail.career.hallOfFame, { year: f.hallOfFame.inductedYear, score: f.hallOfFame.legacyScore })}</p>}
          </div>
        </Panel>}
        <Panel>
          <h2 className="mb-4 text-lg font-medium tracking-tight text-white">{t($ => $.fighterDetail.physicalProfile)}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><CareerStat label={t($ => $.fighterDetail.height)} value={formatHeight(f.heightCm, unitSystem)} /><CareerStat label={t($ => $.fighterDetail.fightWeight)} value={formatWeight(f.fightWeightLb, unitSystem)} /><CareerStat label={t($ => $.fighterDetail.walkAroundWeight)} value={formatWeight(f.walkAroundWeightLb, unitSystem)} /><CareerStat label={t($ => $.fighterDetail.weightCut)} value={`${weightCut.toFixed(1)}%`} tone={weightCut > 12 ? 'warning' : 'neutral'} /></div>
        </Panel>
        <Panel>
          <h2 className="mb-4 text-lg font-medium tracking-tight text-white">{t($ => $.fighterDetail.attributes)}</h2>
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2"><AttrBar label={t($ => $.fighterDetail.attribute.striking)} value={f.attributes.striking} /><AttrBar label={t($ => $.fighterDetail.attribute.grappling)} value={f.attributes.grappling} /><AttrBar label={t($ => $.fighterDetail.attribute.wrestling)} value={f.attributes.wrestling} /><AttrBar label={t($ => $.fighterDetail.attribute.submissions)} value={f.attributes.submissions} /><AttrBar label={t($ => $.fighterDetail.attribute.cardio)} value={f.attributes.cardio} /><AttrBar label={t($ => $.fighterDetail.attribute.chin)} value={f.attributes.chin} /><AttrBar label={t($ => $.fighterDetail.attribute.power)} value={f.attributes.power} /><AttrBar label={t($ => $.fighterDetail.attribute.speed)} value={f.attributes.speed} /><AttrBar label={t($ => $.fighterDetail.attribute.defense)} value={f.attributes.defense} /><AttrBar label={t($ => $.fighterDetail.attribute.fightIq)} value={f.attributes.fightIq} /><AttrBar label={t($ => $.fighterDetail.attribute.toughness)} value={f.attributes.toughness} /></div>
          <div className="mt-5 border-t border-[#2a2c31] pt-5">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">{t($ => $.personality.title)}</h3>
            <div className="mt-3 flex flex-wrap gap-2">{f.personalityTraits.slice(0, 2).map(trait => <span key={trait} className="rounded-full border border-purple-900 px-3 py-1 text-sm text-purple-200">{personalityLabels[trait]}</span>)}</div>
            <details className="mt-3 rounded border border-[#2a2c31] bg-neutral-950 px-3">
              <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{t($ => $.personality.explain)}</summary>
              <p className="pb-3 text-sm leading-6 text-neutral-400">{t($ => $.personality.description)}</p>
            </details>
          </div>
        </Panel>
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-medium tracking-tight text-white">{t($ => $.fighterDetail.editor.title)}</h2>
            {isEditing
              ? <div className="flex flex-wrap gap-2"><Button variant="quiet" onClick={cancelEditing}>{t($ => $.fighterDetail.editor.cancel)}</Button><Button variant="primary" onClick={saveEdit}>{t($ => $.fighterDetail.editor.save)}</Button></div>
              : <Button variant="secondary" onClick={beginEditing}>{t($ => $.fighterDetail.editor.edit)}</Button>}
          </div>
          {isEditing && draft && <div className="mt-5 space-y-6">
            {editError && <p role="alert" className="rounded-lg border border-red-900 bg-red-950/20 p-3 text-sm text-red-300">{t($ => $.fighterDetail.editor.error, { reason: editErrorMessages[editError] })}</p>}
            <EditorSection title={t($ => $.fighterDetail.editor.profile)}>
              <EditorInput label={t($ => $.fighterDetail.editor.firstName)} value={draft.firstName} onChange={value => updateDraft('firstName', value)} />
              <EditorInput label={t($ => $.fighterDetail.editor.lastName)} value={draft.lastName} onChange={value => updateDraft('lastName', value)} />
              <EditorInput label={t($ => $.fighterDetail.editor.nickname)} value={draft.nickname} onChange={value => updateDraft('nickname', value)} />
              <EditorNumberInput label={t($ => $.fighterDetail.editor.age)} value={draft.age} onChange={value => updateDraft('age', value)} min={18} max={45} />
              <EditorInput label={t($ => $.fighterDetail.editor.nationality)} value={draft.nationality} onChange={value => updateDraft('nationality', value)} />
              <EditorSelect label={t($ => $.fighterDetail.editor.weightClass)} value={draft.weightClass} onChange={value => updateDraft('weightClass', value as WeightClass)} options={WEIGHT_CLASSES.map(value => ({ value, label: formatWeightClass(value, language) }))} />
              <EditorSelect label={t($ => $.fighterDetail.editor.style)} value={draft.style} onChange={value => updateDraft('style', value as FighterStyle)} options={FIGHTER_STYLES.map(value => ({ value, label: formatFighterStyle(value, language) }))} />
            </EditorSection>
            <EditorSection title={t($ => $.fighterDetail.editor.physical)}>
              <EditorNumberInput label={t($ => $.fighterDetail.height)} value={draft.heightCm} onChange={value => updateDraft('heightCm', value)} min={1} max={300} />
              <EditorNumberInput label={t($ => $.fighterDetail.fightWeight)} value={draft.fightWeightLb} onChange={value => updateDraft('fightWeightLb', value)} min={1} max={500} />
              <EditorNumberInput label={t($ => $.fighterDetail.walkAroundWeight)} value={draft.walkAroundWeightLb} onChange={value => updateDraft('walkAroundWeightLb', value)} min={1} max={500} />
            </EditorSection>
            <EditorSection title={t($ => $.fighterDetail.attributes)}>
              {attributeKeys.map(key => <EditorNumberInput key={key} label={{ striking: t($ => $.fighterDetail.attribute.striking), grappling: t($ => $.fighterDetail.attribute.grappling), wrestling: t($ => $.fighterDetail.attribute.wrestling), submissions: t($ => $.fighterDetail.attribute.submissions), cardio: t($ => $.fighterDetail.attribute.cardio), chin: t($ => $.fighterDetail.attribute.chin), power: t($ => $.fighterDetail.attribute.power), speed: t($ => $.fighterDetail.attribute.speed), defense: t($ => $.fighterDetail.attribute.defense), fightIq: t($ => $.fighterDetail.attribute.fightIq), toughness: t($ => $.fighterDetail.attribute.toughness) }[key]} value={draft.attributes[key]} onChange={value => updateAttribute(key, value)} min={10} max={100} step={0.5} />)}
            </EditorSection>
            <EditorSection title={t($ => $.fighterDetail.editor.management)}>
              <EditorNumberInput label={t($ => $.fighterDetail.editor.potential)} value={draft.potential} onChange={value => updateDraft('potential', value)} min={0} max={100} />
              <EditorNumberInput label={t($ => $.fighterDetail.editor.popularity)} value={draft.popularity} onChange={value => updateDraft('popularity', value)} min={0} max={100} />
              <EditorNumberInput label={t($ => $.fighterDetail.editor.morale)} value={draft.morale} onChange={value => updateDraft('morale', value)} min={0} max={100} />
              <EditorNumberInput label={t($ => $.fighterDetail.editor.momentum)} value={draft.momentum} onChange={value => updateDraft('momentum', value)} min={0} max={100} />
              <EditorNumberInput label={t($ => $.fighterDetail.editor.fatigue)} value={draft.fatigue} onChange={value => updateDraft('fatigue', value)} min={0} max={100} />
            </EditorSection>
          </div>}
        </Panel>
        <Panel>
          <h2 className="mb-4 text-lg font-medium tracking-tight text-white">{t($ => $.fighterDetail.careerSummary)}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><CareerStat label={t($ => $.fighterDetail.titleFights)} value={titleFights} tone="warning" /><CareerStat label={t($ => $.fighterDetail.currentStreak)} value={currentStreak > 0 ? `${currentStreak} W` : '—'} /><CareerStat label={t($ => $.fighterDetail.bestStreak)} value={longestStreak} /><CareerStat label={t($ => $.fighterDetail.averagePerformance)} value={averagePerformance} /></div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"><CareerStat label={t($ => $.fighterDetail.koWins)} value={kos} tone="danger" /><CareerStat label={t($ => $.fighterDetail.submissionWins)} value={subs} tone="warning" /><CareerStat label={t($ => $.fighterDetail.decisionWins)} value={decWins} /><CareerStat label={t($ => $.fighterDetail.decisionLosses)} value={decLosses} /></div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5"><CareerStat label={t($ => $.fighterDetail.fourManGp)} value={gpWins4Man} tone="warning" /><CareerStat label={t($ => $.fighterDetail.eightManGp)} value={gpWins8Man} tone="warning" /><CareerStat label={t($ => $.fighterDetail.gpFinals)} value={gpFinals} /><CareerStat label={t($ => $.fighterDetail.gpRecord)} value={`${gpRecord.wins}-${gpRecord.losses}`} /><CareerStat label={t($ => $.fighterDetail.titleShot)} value={f.titleShotPromised ? t($ => $.fighterDetail.pending) : '—'} tone={f.titleShotPromised ? 'success' : 'neutral'} /></div>
        </Panel>
      </div>}

      {activeTab === 'achievements' && <Panel>
        <h2 className="text-lg font-medium tracking-tight text-white">{t($ => $.fighterDetail.achievements)}</h2>
        <p className="mt-1 text-sm text-neutral-500">{t($ => $.fighterDetail.achievementsDescription)}</p>
        {achievements.length === 0 ? <p className="py-10 text-center text-sm text-neutral-500">{t($ => $.fighterDetail.noAchievements)}</p> : <div className="mt-5 space-y-6">{(['Titles', 'Grand Prix', 'Awards', 'Milestones'] as const).map(category => {
          const items = achievements.filter(item => item.category === category);
          if (!items.length) return null;
          return <section key={category}><h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">{achievementCategoryLabels[category]}</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{items.map((item, index) => {
            const className = `rounded-lg border bg-neutral-950 p-4 text-left ${item.tone === 'success' ? 'border-emerald-900' : item.tone === 'warning' ? 'border-amber-900' : item.tone === 'danger' ? 'border-red-900' : 'border-[#2a2c31]'}`;
            const content = <div className="flex min-w-0 items-start gap-4"><AchievementVisual achievement={item} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><h4 className="font-medium text-white">{item.title}</h4><span className="shrink-0 font-mono text-[10px] text-neutral-500">{formatDate(item.date, language)}</span></div><p className="mt-2 text-sm leading-6 text-neutral-400">{item.description}</p></div></div>;
            return item.fightArchiveId ? <button key={`${item.title}-${index}`} type="button" onClick={() => openFight(item.fightArchiveId!)} className={`${className} transition-colors hover:bg-[#1b1c20] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}>{content}</button> : <div key={`${item.title}-${index}`} className={className}>{content}</div>;
          })}</div></section>;
        })}</div>}
      </Panel>}

      {activeTab === 'storylines' && <div className="space-y-6">
        <Panel>
          <h2 className="text-lg font-medium tracking-tight text-white">{t($ => $.fighterDetail.activeStorylines)}</h2>
          <p className="mt-1 text-sm text-neutral-500">{t($ => $.fighterDetail.storylinesDescription)}</p>
          {activeStorylines.length === 0 ? <p className="py-8 text-center text-sm text-neutral-500">{t($ => $.fighterDetail.noStorylines)}</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{activeStorylines.map(storyline => <div key={storyline.id} className="rounded-lg border border-[#2a2c31] bg-neutral-950 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium text-white">{storyline.type}</h3>{storyline.intensity && <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-amber-300">{t($ => $.fighterDetail.intensity, { value: storyline.intensity })}</span>}</div><p className="mt-2 text-sm leading-6 text-neutral-400">{storyline.description}</p><div className="mt-3 flex flex-wrap gap-2">{storyline.fighterIds.filter(id => id !== f.id).flatMap(id => fighters[id] ? [<button key={id} type="button" onClick={() => setView('fighter-detail', { fighterId: id })} className="rounded-full border border-neutral-800 px-2.5 py-1 text-xs text-neutral-300 hover:border-neutral-600 hover:text-white">{fighters[id].firstName} {fighters[id].lastName}</button>] : [])}</div><p className="mt-3 font-mono text-[10px] text-neutral-600">{storyline.createdDate ? t($ => $.fighterDetail.started, { date: formatDate(storyline.createdDate, language) }) : t($ => $.fighterDetail.active)}{storyline.expiresDate ? ` · ${t($ => $.fighterDetail.expires, { date: formatDate(storyline.expiresDate, language) })}` : ''}</p></div>)}</div>}
        </Panel>
        <Panel>
          <h2 className="text-lg font-medium tracking-tight text-white">{t($ => $.fighterDetail.socialActivity)}</h2>
          <p className="mt-1 text-sm text-neutral-500">{t($ => $.fighterDetail.socialDescription, { name: f.lastName })}</p>
          {socialActivity.length === 0 ? <p className="py-8 text-center text-sm text-neutral-500">{t($ => $.fighterDetail.noSocialActivity)}</p> : <div className="mt-4 divide-y divide-[#2a2c31]">{socialActivity.map(entry => <article key={entry.id} className="py-4 first:pt-0 last:pb-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-500">{socialKindLabels[entry.kind]}</span><time className="font-mono text-[10px] text-neutral-600">{formatDate(entry.date, language)}</time></div><h3 className="mt-2 font-medium text-white">{entry.headline}</h3><p className="mt-1 text-sm leading-6 text-neutral-400">{entry.body}</p></article>)}</div>}
        </Panel>
      </div>}

      {activeTab === 'contract' && <Panel>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-medium tracking-tight text-white">{f.contract ? t($ => $.fighterDetail.contractExtension) : t($ => $.fighterDetail.negotiateContract)}</h2>{f.contract && <Button variant="danger" onClick={handleRelease} className="inline-flex items-center gap-2"><UserMinus size={16} /> {t($ => $.fighterDetail.release)}</Button>}</div>
        {f.contract && <div className="mb-6 flex flex-col justify-between gap-3 rounded-lg border border-[#2a2c31] bg-neutral-950 p-4 sm:flex-row sm:items-center"><div><p className="text-sm text-neutral-400">{t($ => $.fighterDetail.currentDeal, { pay: formatCurrency(f.contract!.payPerFight, language), bonus: formatCurrency(f.contract!.winBonus, language) })}</p><p className={`mt-1 text-sm ${getContractStatus(f.contract, state.currentDate) !== 'active' ? 'text-red-300' : 'text-neutral-400'}`}>{t($ => $.fighterDetail.fightsRemaining, { count: f.contract.fightsRemaining, date: formatDate(f.contract.endDate, language) })}</p></div>{f.isChampion && getContractStatus(f.contract, state.currentDate) === 'expired' && <p className="text-sm text-red-300">{t($ => $.fighterDetail.championExpired)}</p>}</div>}
        {negotiationResult && <div className={`mb-4 rounded-lg border p-4 ${negotiationResult.accepted ? 'border-emerald-900 text-emerald-300' : 'border-red-900 text-red-300'}`}><p className="font-medium">{negotiationResult.accepted ? t($ => $.fighterDetail.offerAccepted) : t($ => $.fighterDetail.offerRejected)}</p><p className="mt-1 text-sm">{negotiationResult.reason}</p></div>}
        {counterOffer && <div className="mb-4 rounded-lg border border-amber-900 bg-amber-950/20 p-4 text-amber-100"><p className="font-medium">{t($ => $.fighterDetail.counterOffer)}</p><p className="mt-1 text-sm">{t($ => $.fighterDetail.counterOfferTerms, { pay: formatCurrency(counterOffer.payPerFight, language), bonus: formatCurrency(counterOffer.winBonus, language), count: counterOffer.fights, date: formatDate(counterOffer.expiresDate, language) })}</p><Button variant="primary" onClick={() => completeSigning(counterOffer.payPerFight, counterOffer.winBonus, counterOffer.fights)} className="mt-3">{t($ => $.fighterDetail.acceptCounter)}</Button></div>}
        <p className="mb-4 text-sm text-neutral-400">{t($ => $.fighterDetail.expected, { pay: formatCurrency(contractExpectation.basePay, language), bonus: formatCurrency(contractExpectation.winBonus, language), interest: formatContractInterest(contractExpectation.interestLabel, language) })}</p>
        <div className="grid gap-4 md:grid-cols-3"><ContractInput label={t($ => $.fighterDetail.payPerFight)} value={offerPay} onChange={setOfferPay} step={1000} /><ContractInput label={t($ => $.fighterDetail.winBonus)} value={offerBonus} onChange={setOfferBonus} step={1000} /><ContractInput label={t($ => $.fighterDetail.fights)} value={offerFights} onChange={setOfferFights} min={1} max={8} /></div>
        {!negotiationResult?.accepted && <Button variant="primary" onClick={handleSign} className="mt-5 inline-flex items-center gap-2"><UserCheck size={16} /> {f.contract ? t($ => $.fighterDetail.offerExtension) : t($ => $.fighterDetail.offerContract)}</Button>}
      </Panel>}

      {activeTab === 'fights' && <Panel>
        <h2 className="mb-4 text-lg font-medium tracking-tight text-white">{t($ => $.fighterDetail.fightLog)}</h2>
        {fighterFights.length ? <div className="overflow-x-auto custom-scrollbar"><table className="min-w-[640px] w-full text-left text-sm"><thead className="border-b border-[#2a2c31] font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500"><tr><th className="pb-3 font-normal">{t($ => $.fighterDetail.date)}</th><th className="pb-3 font-normal">{t($ => $.fighterDetail.event)}</th><th className="pb-3 font-normal">{t($ => $.fighterDetail.opponent)}</th><th className="pb-3 font-normal">{t($ => $.fighterDetail.result)}</th><th className="pb-3 font-normal">{t($ => $.fighterDetail.method)}</th><th className="pb-3 font-normal">{t($ => $.fighterDetail.round)}</th></tr></thead><tbody className="divide-y divide-[#2a2c31]">{fighterFights.map(fight => {
          const opponentId = fight.redFighterId === f.id ? fight.blueFighterId : fight.redFighterId;
          const opponent = fighters[opponentId];
          const opponentName = opponent ? `${opponent.firstName} ${opponent.lastName}` : t($ => $.fighterDetail.unknown);
          const result = fight.winnerId === null ? 'draw' : fight.winnerId === f.id ? 'win' : 'loss';
          const resultLabel = result === 'win' ? t($ => $.fighterDetail.win) : result === 'loss' ? t($ => $.fighterDetail.loss) : t($ => $.fighterDetail.draw);
          return <tr key={fight.id} tabIndex={0} role="button" aria-label={t($ => $.fighterDetail.viewFight, { opponent: opponentName, date: formatDate(fight.date, language) })} onClick={() => openFight(fight.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openFight(fight.id); } }} className="cursor-pointer transition-colors hover:bg-white/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white"><td className="py-3 font-mono text-xs text-neutral-500">{formatDate(fight.date, language)}</td><td className="py-3 text-neutral-300">{fight.eventName}</td><td className="py-3 text-white">{t($ => $.fighterDetail.versus, { name: opponentName })}{fight.isTitleFight && <span className="ml-2 text-amber-300">{t($ => $.fight.common.title)}</span>}</td><td className={`py-3 font-medium ${result === 'win' ? 'text-emerald-300' : result === 'loss' ? 'text-red-300' : 'text-neutral-400'}`}>{resultLabel}</td><td className="py-3 text-neutral-400">{formatFightMethod(fight.method, language)}</td><td className="py-3 font-mono text-xs text-neutral-400">{fight.round} ({fight.time})</td></tr>;
        })}</tbody></table></div> : <div className="space-y-3 text-center"><p className="py-6 text-sm text-neutral-500">{t($ => $.fighterDetail.noFights)}</p>{f.history.length > 0 && <div className="text-left"><h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">{t($ => $.fighterDetail.legacyHistory)}</h3>{f.history.map((entry, index) => <p key={index} className="border-t border-[#2a2c31] py-2 text-sm text-neutral-300">{entry}</p>)}</div>}</div>}
      </Panel>}

      {activeTab === 'timeline' && <Panel>
        <h2 className="mb-4 text-lg font-medium tracking-tight text-white">{t($ => $.fighterDetail.careerTimeline)}</h2>
        {timeline.length ? <div className="space-y-4 border-l border-[#2a2c31] pl-5">{timeline.map((item, index) => <div key={`${item.date}-${index}`} className="relative"><span className={`absolute -left-[1.62rem] top-1.5 h-2.5 w-2.5 rounded-full ${item.type.includes('win') || item.type === 'title_defense' || item.type === 'unification' ? 'bg-emerald-400' : item.type.includes('loss') ? 'bg-red-400' : item.type === 'injury' ? 'bg-amber-300' : 'bg-neutral-500'}`} />{item.fightId ? <button type="button" onClick={() => openFight(item.fightId!)} className="text-left text-sm font-medium text-white hover:text-neutral-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{item.title}</button> : <p className="text-sm font-medium text-white">{item.title}</p>}<p className="mt-1 font-mono text-[10px] text-neutral-500">{formatDate(item.date, language)}</p><p className="mt-1 text-sm text-neutral-400">{item.description}</p></div>)}</div> : <p className="py-8 text-center text-sm text-neutral-500">{t($ => $.fighterDetail.noTimeline)}</p>}
      </Panel>}
    </section>
  </div>;
}

function AchievementVisual({ achievement }: { achievement: FighterAchievement }) {
  if (achievement.visual === 'belt' && achievement.weightClass && achievement.beltType) {
    return <div className="flex h-16 w-20 shrink-0 items-center justify-center rounded-lg bg-amber-950/20"><ChampionshipBelt weightClass={achievement.weightClass} type={achievement.beltType} size="marker" /></div>;
  }
  const Icon = achievement.visual === 'trophy' ? Trophy : achievement.visual === 'award' ? Medal : Flame;
  const color = achievement.visual === 'trophy' ? 'text-amber-300' : achievement.visual === 'award' ? 'text-sky-300' : 'text-orange-300';
  return <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-current/20 bg-white/[0.03] ${color}`}><Icon size={26} aria-hidden="true" /></div>;
}

function ProfileStat({ label, value, detail, tone = 'neutral' }: { label: string; value: string; detail?: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const toneClass = tone === 'success' ? 'text-emerald-300' : tone === 'warning' ? 'text-amber-300' : tone === 'danger' ? 'text-red-300' : 'text-white';
  return <div className="min-w-0 border-l border-[#2a2c31] pl-3 text-left"><p className="font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-500">{label}</p><p className={`mt-1 truncate text-sm font-medium ${toneClass}`}>{value}</p>{detail && <p className="mt-1 text-[10px] text-neutral-500">{detail}</p>}</div>;
}

function CareerStat({ label, value, tone = 'neutral' }: { label: string; value: string | number; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const toneClass = tone === 'success' ? 'text-emerald-300' : tone === 'warning' ? 'text-amber-300' : tone === 'danger' ? 'text-red-300' : 'text-white';
  return <div className="rounded-lg border border-[#2a2c31] bg-neutral-950 p-3"><p className="font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-500">{label}</p><p className={`mt-2 text-xl font-normal tracking-[-0.03em] ${toneClass}`}>{value}</p></div>;
}

function EditorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">{title}</h3><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div></section>;
}

function EditorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1 block text-xs text-neutral-400">{label}</span><input value={value} onChange={event => onChange(event.target.value)} className="min-h-11 w-full rounded-lg border border-[#2a2c31] bg-neutral-950 px-3 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" /></label>;
}

function EditorNumberInput({ label, value, onChange, min, max, step = 1 }: { key?: React.Key; label: string; value: number; onChange: (value: number) => void; min: number; max: number; step?: number }) {
  return <label className="block"><span className="mb-1 block text-xs text-neutral-400">{label}</span><input type="number" value={value} min={min} max={max} step={step} onChange={event => onChange(Number(event.target.value))} className="min-h-11 w-full rounded-lg border border-[#2a2c31] bg-neutral-950 px-3 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" /></label>;
}

function EditorSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <div><span className="mb-1 block text-xs text-neutral-400">{label}</span><Select value={value} onChange={onChange} options={options} /></div>;
}

function ContractInput({ label, value, onChange, min, max, step }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number }) {
  return <label className="block"><span className="mb-1 block text-xs text-neutral-400">{label}</span><input type="number" value={value} min={min} max={max} step={step} onChange={event => onChange(Number(event.target.value))} className="w-full rounded-lg border border-[#2a2c31] bg-neutral-950 px-3 py-2 text-white focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500" /></label>;
}

function AttrBar({ label, value }: { label: string; value: number }) {
  const color = value > 80 ? 'bg-emerald-400' : value > 60 ? 'bg-amber-300' : 'bg-red-400';
  return <div className="flex items-center text-xs"><span className="w-24 text-neutral-400">{label}</span><div className="mx-2 h-2 flex-1 overflow-hidden rounded-full bg-neutral-900"><div className={`h-full ${color}`} style={{ width: `${value}%` }} /></div><span className="w-6 text-right font-mono text-white">{value}</span></div>;
}
