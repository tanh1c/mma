import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChampionshipBelt } from '../components/ChampionshipBelt';
import { FighterRankBadge } from '../components/FighterRankBadge';
import { Select } from '../components/Select';
import { buttonVariantClasses, dataSurfaceClasses, PageHeader, Panel, Stat } from '../components/ui';
import { getInternationalQualifiers } from '../lib/game/internationalCompetitions';
import { WEIGHT_CLASSES } from '../lib/game/constants';
import { formatWeightClass } from '../lib/localization';
import { useGameStore } from '../store/gameStore';
import { useSettingsStore } from '../store/settingsStore';
import type { InternationalCompetitionTier, WeightClass } from '../types/game';

export default function Leagues() {
  const { t } = useTranslation('translation');
  const language = useSettingsStore(state => state.language);
  const state = useGameStore();
  const [promotionId, setPromotionId] = useState(state.playerPromotionId);
  const [weightClass, setWeightClass] = useState<WeightClass>('Lightweight');
  const promotion = state.promotions[promotionId] || state.promotions[state.playerPromotionId];
  const rankingsByPromotion = state.rankingsByPromotion[promotion.id]?.[weightClass] || [];
  const titlesByPromotion = state.titlesByPromotion[promotion.id]?.[weightClass];
  const internationalTitles = state.internationalTitles;
  const domesticChampion = titlesByPromotion?.undisputedChampionId ? state.fighters[titlesByPromotion.undisputedChampionId] : null;
  const interimChampion = titlesByPromotion?.interimChampionId ? state.fighters[titlesByPromotion.interimChampionId] : null;
  const qualifiers = (tier: InternationalCompetitionTier) => {
    try {
      return getInternationalQualifiers(state, weightClass, tier).participantIds;
    } catch {
      return [];
    }
  };
  const championsCup = qualifiers('champions_cup');
  const challengeCup = qualifiers('challenge_cup');
  const weightOptions = WEIGHT_CLASSES.map(value => ({ value, label: formatWeightClass(value, language) }));
  const openFighter = (fighterId: string) => state.setView('fighter-detail', { fighterId });
  const fighterName = (fighterId: string | null | undefined) => {
    const fighter = fighterId ? state.fighters[fighterId] : null;
    return fighter ? `${fighter.firstName} ${fighter.lastName}` : t($ => $.leagues.noChampion);
  };

  return <div className="mx-auto max-w-6xl space-y-6 pb-12">
    <PageHeader
      eyebrow={t($ => $.navigation.competition)}
      title={t($ => $.leagues.title)}
      actions={<Select value={weightClass} onChange={value => setWeightClass(value as WeightClass)} options={weightOptions} className="w-full sm:w-48" />}
    />

    <div className="flex flex-wrap gap-2">
      {Object.values(state.promotions).map(item => <button
        key={item.id}
        type="button"
        onClick={() => setPromotionId(item.id)}
        className={buttonVariantClasses(item.id === promotion.id ? 'primary' : 'secondary')}
      >
        {item.shortName}
      </button>)}
    </div>

    <Panel className="grid grid-cols-1 gap-5 sm:grid-cols-3">
      <div className="min-w-0 sm:col-span-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">{promotion.control === 'player' ? t($ => $.leagues.playerControlled) : t($ => $.leagues.aiControlled)}</p>
        <h2 className="mt-2 break-words text-2xl tracking-[-0.03em] text-white">{promotion.name}</h2>
      </div>
      <Stat label={t($ => $.dashboard.stats.reputation)} value={promotion.reputation} />
      <Stat label={t($ => $.dashboard.stats.fanbase)} value={promotion.fanbase.toLocaleString()} />
      <Stat label={t($ => $.dashboard.stats.rosterSize)} value={Object.values(state.fighters).filter(fighter => fighter.contract?.promotionId === promotion.id).length} />
    </Panel>

    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Panel className="min-w-0 space-y-5">
        <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-neutral-400">{t($ => $.leagues.domesticChampion)}</h2>
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
          <ChampionshipBelt weightClass={weightClass} type="undisputed" size="card" alt="" />
          <div className="min-w-0 space-y-3">
            {domesticChampion ? <FighterButton fighterId={domesticChampion.id} name={fighterName(domesticChampion.id)} onOpen={openFighter} /> : <p className="text-neutral-500">{t($ => $.leagues.noChampion)}</p>}
            {interimChampion && <FighterButton fighterId={interimChampion.id} name={fighterName(interimChampion.id)} onOpen={openFighter} />}
          </div>
        </div>
      </Panel>

      <Panel className="min-w-0 space-y-4">
        <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-neutral-400">{t($ => $.leagues.internationalChampions)}</h2>
        {(['champions_cup', 'challenge_cup'] as const).map(tier => {
          const championId = internationalTitles[tier][weightClass].undisputedChampionId;
          return <div key={tier} className="flex min-w-0 items-center justify-between gap-3 border-b border-[#2a2c31] py-2 last:border-0">
            <span className="text-xs text-neutral-500">{tier === 'champions_cup' ? 'Champions Cup' : 'Challenge Cup'}</span>
            {championId ? <FighterButton fighterId={championId} name={fighterName(championId)} onOpen={openFighter} /> : <span className="text-sm text-neutral-500">{t($ => $.leagues.noChampion)}</span>}
          </div>;
        })}
      </Panel>
    </div>

    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Panel className="min-w-0 lg:col-span-2">
        <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-neutral-400">{t($ => $.leagues.domesticRankings)}</h2>
        <div className={`${dataSurfaceClasses} mt-4 divide-y divide-[#2a2c31]`}>
          {rankingsByPromotion.slice(0, 15).map(item => <div key={item.fighterId}><FighterRow fighterId={item.fighterId} rank={item.rank} state={state} onOpen={openFighter} /></div>)}
        </div>
      </Panel>

      <div className="min-w-0 space-y-6">
        <QualificationPanel title={t($ => $.leagues.championsCupQualification)} fighterIds={championsCup} state={state} onOpen={openFighter} />
        <QualificationPanel title={t($ => $.leagues.challengeCupQualification)} fighterIds={challengeCup} state={state} onOpen={openFighter} />
      </div>
    </div>
  </div>;
}

function FighterButton({ fighterId, name, onOpen }: { fighterId: string; name: string; onOpen: (fighterId: string) => void }) {
  return <button type="button" onClick={() => onOpen(fighterId)} className="flex min-h-11 min-w-0 items-center gap-2 text-left text-sm text-white hover:text-neutral-300">
    <FighterRankBadge fighterId={fighterId} />
    <span className="min-w-0 break-words">{name}</span>
  </button>;
}

function FighterRow({ fighterId, rank, state, onOpen }: { fighterId: string; rank: number; state: ReturnType<typeof useGameStore.getState>; onOpen: (fighterId: string) => void }) {
  const fighter = state.fighters[fighterId];
  if (!fighter) return null;
  return <button type="button" onClick={() => onOpen(fighterId)} className="flex min-h-11 w-full min-w-0 items-center gap-3 px-4 py-2 text-left hover:bg-white/[0.03]">
    <span className="w-7 shrink-0 text-center font-mono text-sm text-neutral-500">{rank}</span>
    <FighterRankBadge fighterId={fighterId} />
    <span className="min-w-0 flex-1 break-words text-sm text-white">{fighter.firstName} {fighter.lastName}</span>
    <span className="shrink-0 font-mono text-xs text-neutral-400">{fighter.record.wins}-{fighter.record.losses}-{fighter.record.draws}</span>
  </button>;
}

function QualificationPanel({ title, fighterIds, state, onOpen }: { title: string; fighterIds: string[]; state: ReturnType<typeof useGameStore.getState>; onOpen: (fighterId: string) => void }) {
  return <Panel className="min-w-0">
    <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-neutral-400">{title}</h2>
    <div className="mt-3 divide-y divide-[#2a2c31]">
      {fighterIds.map(fighterId => {
        const fighter = state.fighters[fighterId];
        if (!fighter) return null;
        const owner = fighter.contract?.promotionId ? state.promotions[fighter.contract.promotionId] : null;
        return <button key={fighterId} type="button" onClick={() => onOpen(fighterId)} className="flex min-h-11 w-full min-w-0 items-center justify-between gap-2 py-2 text-left hover:text-neutral-300">
          <span className="min-w-0 break-words text-sm text-white">{fighter.firstName} {fighter.lastName}</span>
          <span className="shrink-0 font-mono text-[10px] text-neutral-500">{owner?.shortName}</span>
        </button>;
      })}
    </div>
  </Panel>;
}
