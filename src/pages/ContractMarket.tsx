import { useMemo, useState, type ReactNode } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../store/gameStore';
import {
  getCurrentContractWindow,
  getMarketCompetition,
  getVisibleMarketOffers
} from '../lib/game/contractMarket';
import { getPromotionFinancialSnapshot } from '../lib/game/promotionEconomy';
import { getContractExpectation } from '../lib/game/contracts';
import { useSettingsStore } from '../store/settingsStore';
import { formatCurrency, formatDate, formatWeightClass } from '../lib/localization';
import { Button, PageHeader, Panel, Stat, StatusBadge } from '../components/ui';
import type { MarketReason } from '../types/game';

type MarketTab = 'available' | 'listings' | 'incoming' | 'offers' | 'history';

const tabs: MarketTab[] = ['available', 'listings', 'incoming', 'offers', 'history'];

export default function ContractMarket() {
  const { t } = useTranslation('translation');
  const state = useGameStore();
  const language = useSettingsStore(item => item.language);
  const [activeTab, setActiveTab] = useState<MarketTab>('available');
  const [selectedFighterId, setSelectedFighterId] = useState<string | null>(null);
  const [transferFee, setTransferFee] = useState(0);
  const [payPerFight, setPayPerFight] = useState(10_000);
  const [winBonus, setWinBonus] = useState(10_000);
  const [fights, setFights] = useState(4);
  const [minimumFee, setMinimumFee] = useState(50_000);
  const [message, setMessage] = useState('');
  const window = getCurrentContractWindow(state);
  const visibleOffers = getVisibleMarketOffers(state, state.playerPromotionId);
  const listings = Object.values(state.contractMarket.listings)
    .filter(listing => listing.windowId === window?.id && listing.status === 'active');
  const listedByFighter = new Map(listings.map(listing => [listing.fighterId, listing]));
  const available = useMemo(() => Object.values(state.fighters)
    .filter(fighter => fighter.careerPhase !== 'retired')
    .filter(fighter => {
      const listing = listedByFighter.get(fighter.id);
      const expiresInWindow = Boolean(window && fighter.contract?.endDate <= window.closeDate);
      return Boolean(listing || !fighter.contract || expiresInWindow);
    })
    .filter(fighter => {
      const retainedByPlayer = fighter.contract?.promotionId === state.playerPromotionId &&
        Boolean(window && fighter.contract.endDate > window.closeDate);
      return !retainedByPlayer;
    })
    .sort((a, b) => b.popularity - a.popularity || a.id.localeCompare(b.id)),
  [state.fighters, state.playerPromotionId, window?.closeDate, listings]);
  const playerListings = listings.filter(listing => listing.sellerPromotionId === state.playerPromotionId);
  const listable = Object.values(state.fighters).filter(fighter =>
    fighter.contract?.promotionId === state.playerPromotionId &&
    Boolean(window && fighter.contract.endDate > window.closeDate) &&
    !listedByFighter.has(fighter.id)
  );
  const incoming = visibleOffers.filter(offer => offer.direction === 'incoming');
  const myOffers = visibleOffers.filter(offer => offer.direction === 'mine');
  const selected = selectedFighterId ? state.fighters[selectedFighterId] : null;
  const open = window?.status === 'open';
  const finances = getPromotionFinancialSnapshot(state, state.playerPromotionId);
  const daysRemaining = window
    ? Math.max(0, differenceInCalendarDays(new Date(window.closeDate), new Date(state.currentDate)))
    : 0;

  const fighterName = (id: string) => {
    const fighter = state.fighters[id];
    return fighter ? `${fighter.firstName} ${fighter.lastName}` : t($ => $.contractMarket.unknownFighter);
  };
  const promotionName = (id: string | null) => id
    ? state.promotions[id]?.shortName ?? state.promotions[id]?.name ?? t($ => $.contractMarket.freeAgent)
    : t($ => $.contractMarket.freeAgent);
  const report = (reason: MarketReason | null, success: string) => setMessage(
    reason ? reasonLabel(reason, t) : success
  );
  const chooseTarget = (fighterId: string) => {
    const fighter = state.fighters[fighterId];
    if (!fighter) return;
    const expectation = getContractExpectation(fighter, state.promotion);
    setSelectedFighterId(fighterId);
    setTransferFee(listedByFighter.get(fighterId)?.minimumFee ?? 0);
    setPayPerFight(expectation.basePay);
    setWinBonus(expectation.winBonus);
    setFights(expectation.fights);
  };
  const submitOffer = () => {
    if (!selected) return;
    report(
      state.submitMarketOffer(selected.id, transferFee, { fights, payPerFight, winBonus }),
      t($ => $.contractMarket.offerSubmitted)
    );
  };

  const tabLabels: Record<MarketTab, string> = {
    available: t($ => $.contractMarket.tabs.available),
    listings: t($ => $.contractMarket.tabs.listings),
    incoming: t($ => $.contractMarket.tabs.incoming),
    offers: t($ => $.contractMarket.tabs.offers),
    history: t($ => $.contractMarket.tabs.history)
  };

  return <div className="space-y-6">
    <PageHeader
      eyebrow={t($ => $.contractMarket.eyebrow)}
      title={t($ => $.contractMarket.title)}
      description={t($ => $.contractMarket.description)}
    />

    <Panel>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label={t($ => $.contractMarket.windowStatus)} value={window ? t($ => $.contractMarket.status[window.status]) : '—'} />
        <Stat label={t($ => $.contractMarket.opens)} value={window ? formatDate(window.openDate, language) : '—'} />
        <Stat label={t($ => $.contractMarket.closes)} value={window ? formatDate(window.closeDate, language) : '—'} detail={window ? t($ => $.contractMarket.daysRemaining, { count: daysRemaining }) : undefined} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className={`text-sm ${open ? 'text-emerald-300' : 'text-neutral-500'}`}>{open ? t($ => $.contractMarket.openHelp) : t($ => $.contractMarket.closedHelp)}</p>
        {finances && <p className="text-sm text-neutral-300">{t($ => $.contractMarket.budget)}: <span className="font-mono text-white">{formatCurrency(finances.contractBudget, language)}</span> · {t($ => $.contractMarket.mode)}: {finances.financialMode}</p>}
        <Button type="button" variant="quiet" onClick={() => state.setView('promotion-finances')} className="px-0 text-xs">{t($ => $.contractMarket.viewFinances)}</Button>
      </div>
      <p className="mt-2 min-h-5 text-sm text-amber-200" aria-live="polite">{message}</p>
    </Panel>

    <div className="flex flex-wrap border-b border-[#2a2c31]" role="tablist" aria-label={t($ => $.contractMarket.sectionsLabel)}>
      {tabs.map(tab => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)} className={`min-h-11 border-b-2 px-4 font-mono text-[10px] uppercase tracking-[0.12em] ${activeTab === tab ? 'border-white text-white' : 'border-transparent text-neutral-500 hover:text-neutral-200'}`}>{tabLabels[tab]}</button>)}
    </div>

    {activeTab === 'available' && <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
      <div className="space-y-3 min-w-0">
        {available.map(fighter => {
          const competition = getMarketCompetition(state, fighter.id);
          const listing = listedByFighter.get(fighter.id);
          const owner = fighter.contract?.promotionId ?? null;
          return <button key={fighter.id} type="button" onClick={() => chooseTarget(fighter.id)} className={`min-h-11 w-full rounded-lg border p-4 text-left transition-colors ${selectedFighterId === fighter.id ? 'border-white bg-white/5' : 'border-[#2a2c31] bg-[#101114] hover:border-neutral-600'}`}>
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="min-w-0"><p className="font-medium text-white">{fighterName(fighter.id)}</p><p className="mt-1 text-sm text-neutral-500">{formatWeightClass(fighter.weightClass, language)} · {promotionName(owner)}</p></div>
              <StatusBadge tone={competition.level === 'high' ? 'danger' : competition.level === 'medium' ? 'warning' : competition.level === 'low' ? 'success' : 'neutral'}>{t($ => $.contractMarket.competition, { level: competition.level })}</StatusBadge>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-400"><span>{t($ => $.contractMarket.interested, { count: competition.interestedPromotions })}</span><span>{listing ? t($ => $.contractMarket.minimumFee, { amount: formatCurrency(listing.minimumFee, language) }) : fighter.contract ? t($ => $.contractMarket.expiring, { date: formatDate(fighter.contract.endDate, language) }) : t($ => $.contractMarket.freeAgent)}</span></div>
          </button>;
        })}
        {!available.length && <EmptyState text={t($ => $.contractMarket.noItems)} />}
      </div>
      <Panel className="min-w-0 self-start lg:sticky lg:top-0">
        <h2 className="text-lg font-medium text-white">{selected ? fighterName(selected.id) : t($ => $.contractMarket.selectFighter)}</h2>
        {selected && <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <NumberField label={t($ => $.contractMarket.transferFee)} value={transferFee} onChange={setTransferFee} min={0} step={1000} />
          <NumberField label={t($ => $.contractMarket.payPerFight)} value={payPerFight} onChange={setPayPerFight} min={1} step={1000} />
          <NumberField label={t($ => $.contractMarket.winBonus)} value={winBonus} onChange={setWinBonus} min={0} step={1000} />
          <NumberField label={t($ => $.contractMarket.fights)} value={fights} onChange={setFights} min={1} max={8} />
          <p className={`text-sm ${transferFee <= state.promotion.money ? 'text-emerald-300' : 'text-red-300'}`}>{transferFee <= state.promotion.money ? t($ => $.contractMarket.affordable) : t($ => $.contractMarket.unaffordable)}</p>
          <Button variant="primary" disabled={!open} onClick={submitOffer}>{myOffers.some(offer => offer.fighterId === selected.id && offer.status === 'active') ? t($ => $.contractMarket.revise) : t($ => $.contractMarket.submit)}</Button>
        </div>}
      </Panel>
    </div>}

    {activeTab === 'listings' && <div className="space-y-4">
      <Panel>
        <h2 className="text-lg font-medium text-white">{t($ => $.contractMarket.listFighter)}</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
          <select value={selectedFighterId ?? ''} onChange={event => setSelectedFighterId(event.target.value || null)} aria-label={t($ => $.contractMarket.selectFighter)} className="min-h-11 min-w-0 rounded-lg border border-[#2a2c31] bg-neutral-950 px-3 text-white">
            <option value="">{t($ => $.contractMarket.selectFighter)}</option>
            {listable.map(fighter => <option key={fighter.id} value={fighter.id}>{fighterName(fighter.id)}</option>)}
          </select>
          <NumberField label={t($ => $.contractMarket.minimumFeeLabel)} value={minimumFee} onChange={setMinimumFee} min={0} step={1000} compact />
          <Button variant="primary" disabled={!open || !selectedFighterId} onClick={() => selectedFighterId && report(state.listMarketFighter(selectedFighterId, minimumFee), t($ => $.contractMarket.listed))}>{t($ => $.contractMarket.list)}</Button>
        </div>
      </Panel>
      <RecordGrid>{playerListings.map(listing => <MarketCard key={listing.id} title={fighterName(listing.fighterId)} detail={t($ => $.contractMarket.minimumFee, { amount: formatCurrency(listing.minimumFee, language) })}><Button variant="secondary" onClick={() => report(state.withdrawMarketListing(listing.id), t($ => $.contractMarket.withdrawn))}>{t($ => $.contractMarket.withdraw)}</Button></MarketCard>)}</RecordGrid>
      {!playerListings.length && <EmptyState text={t($ => $.contractMarket.noItems)} />}
    </div>}

    {activeTab === 'incoming' && <div className="space-y-3">
      <RecordGrid>{incoming.map(offer => <MarketCard key={offer.id} title={fighterName(offer.fighterId)} detail={`${promotionName(offer.buyerPromotionId)} · ${formatCurrency(offer.transferFee, language)}`}><Button variant="primary" disabled={!open || offer.sellerDecision !== 'pending'} onClick={() => report(state.respondToMarketOffer(offer.id, true), t($ => $.contractMarket.accepted))}>{t($ => $.contractMarket.accept)}</Button><Button variant="danger" disabled={!open || offer.sellerDecision !== 'pending'} onClick={() => report(state.respondToMarketOffer(offer.id, false), t($ => $.contractMarket.rejected))}>{t($ => $.contractMarket.reject)}</Button></MarketCard>)}</RecordGrid>
      {!incoming.length && <EmptyState text={t($ => $.contractMarket.noItems)} />}
    </div>}

    {activeTab === 'offers' && <div className="space-y-3">
      <RecordGrid>{myOffers.map(offer => <MarketCard key={offer.id} title={fighterName(offer.fighterId)} detail={`${formatCurrency(offer.transferFee, language)} · ${formatCurrency(offer.terms?.payPerFight ?? 0, language)} / ${formatCurrency(offer.terms?.winBonus ?? 0, language)} · ${offer.terms?.fights ?? 0}`}><StatusBadge>{offer.status}</StatusBadge><Button variant="secondary" disabled={!open || offer.status !== 'active'} onClick={() => { chooseTarget(offer.fighterId); setActiveTab('available'); }}>{t($ => $.contractMarket.revise)}</Button><Button variant="danger" disabled={!open || offer.status !== 'active'} onClick={() => report(state.withdrawMarketOffer(offer.id), t($ => $.contractMarket.withdrawn))}>{t($ => $.contractMarket.withdraw)}</Button></MarketCard>)}</RecordGrid>
      {!myOffers.length && <EmptyState text={t($ => $.contractMarket.noItems)} />}
    </div>}

    {activeTab === 'history' && <div className="space-y-3">
      <RecordGrid>{[...state.contractMarket.history].reverse().map(item => <MarketCard key={item.id} title={fighterName(item.fighterId)} detail={`${promotionName(item.sellerPromotionId)} → ${promotionName(item.buyerPromotionId)} · ${formatCurrency(item.transferFee, language)}`}><StatusBadge tone={item.outcome === 'transferred' || item.outcome === 'signed' || item.outcome === 'renewed' ? 'success' : item.outcome === 'invalid' ? 'danger' : 'neutral'}>{item.outcome}</StatusBadge><p className="text-xs text-neutral-500">{reasonLabel(item.reason, t)}</p></MarketCard>)}</RecordGrid>
      {!state.contractMarket.history.length && <EmptyState text={t($ => $.contractMarket.noItems)} />}
    </div>}
  </div>;
}

function NumberField({ label, value, onChange, min, max, step = 1, compact = false }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; compact?: boolean }) {
  return <label className={compact ? 'min-w-0' : 'block'}><span className="mb-1 block text-xs text-neutral-400">{label}</span><input type="number" value={value} min={min} max={max} step={step} onChange={event => onChange(Number(event.target.value))} className="min-h-11 w-full min-w-0 rounded-lg border border-[#2a2c31] bg-neutral-950 px-3 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" /></label>;
}

function RecordGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{children}</div>;
}

function MarketCard({ title, detail, children }: { title: string; detail: string; children: ReactNode; key?: string }) {
  return <Panel className="min-w-0"><h2 className="font-medium text-white">{title}</h2><p className="mt-1 break-words text-sm text-neutral-400">{detail}</p><div className="mt-4 flex flex-wrap items-center gap-2">{children}</div></Panel>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-[#2a2c31] p-8 text-center text-sm text-neutral-500">{text}</div>;
}

function reasonLabel(reason: MarketReason, t: ReturnType<typeof useTranslation>['t']) {
  const labels: Record<MarketReason, string> = {
    submitted: t($ => $.contractMarket.reasons.submitted),
    withdrawn: t($ => $.contractMarket.withdrawn),
    seller_accepted: t($ => $.contractMarket.reasons.sellerAccepted),
    seller_rejected: t($ => $.contractMarket.reasons.sellerRejected),
    seller_no_response: t($ => $.contractMarket.reasons.sellerNoResponse),
    seller_fee_too_low: t($ => $.contractMarket.reasons.sellerFeeTooLow),
    better_expected_pay: t($ => $.contractMarket.reasons.betterExpectedPay),
    better_prestige: t($ => $.contractMarket.reasons.betterPrestige),
    better_title_opportunity: t($ => $.contractMarket.reasons.betterTitleOpportunity),
    loyalty: t($ => $.contractMarket.reasons.loyalty),
    outbid: t($ => $.contractMarket.reasons.outbid),
    fighter_missing: t($ => $.contractMarket.reasons.invalid),
    promotion_missing: t($ => $.contractMarket.reasons.invalid),
    ownership_changed: t($ => $.contractMarket.reasons.ownershipChanged),
    window_not_open: t($ => $.contractMarket.reasons.windowNotOpen),
    offer_missing: t($ => $.contractMarket.reasons.invalid),
    insufficient_cash: t($ => $.contractMarket.reasons.insufficientCash),
    international_competition_active: t($ => $.contractMarket.reasons.internationalCompetitionActive),
    invalid_terms: t($ => $.contractMarket.reasons.invalidTerms),
    no_eligible_offer: t($ => $.contractMarket.reasons.noEligibleOffer)
  };
  return labels[reason];
}
