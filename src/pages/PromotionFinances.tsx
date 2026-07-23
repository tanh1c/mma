import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../store/gameStore';
import { useSettingsStore } from '../store/settingsStore';
import { formatCurrency, formatDate, formatNumber } from '../lib/localization';
import { getBrandInvestmentEffect, getPromotionFinancialSnapshot, type PromotionEconomyReason } from '../lib/game/promotionEconomy';
import { Button, PageHeader, Panel, Stat, StatusBadge } from '../components/ui';
import type { PromotionFinancialMode, PromotionLedgerCategory } from '../types/game';

export default function PromotionFinances() {
  const { t } = useTranslation('translation');
  const state = useGameStore();
  const language = useSettingsStore(item => item.language);
  const [promotionId, setPromotionId] = useState(state.playerPromotionId);
  const [amount, setAmount] = useState(10_000);
  const [message, setMessage] = useState('');
  const promotion = state.promotions[promotionId];
  const economy = state.promotionEconomies[promotionId];
  const snapshot = getPromotionFinancialSnapshot(state, promotionId);
  if (!promotion || !economy || !snapshot) return null;

  const isPlayer = promotionId === state.playerPromotionId;
  const effect = getBrandInvestmentEffect(amount);
  const monthlyIncome = economy.monthlySponsorIncome + economy.monthlyMediaIncome;
  const monthlyExpenses = economy.monthlyOperatingCost + economy.monthlyRosterRetainer + economy.scheduledBrandInvestment;
  const recentEvent = Object.values(state.eventArchive)
    .filter(event => event.scope !== 'international' && (event.promotionId ?? state.playerPromotionId) === promotionId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))[0];
  const legacyRows = isPlayer ? (state.financeLedger ?? [])
    .filter(entry => economy.legacyFinanceLedgerIds.includes(entry.id))
    .map(entry => ({ id: entry.id, date: entry.date, category: null, description: entry.description, amount: entry.amount, balance: null })) : [];
  const rows = [
    ...legacyRows,
    ...economy.ledger.map(entry => ({ id: entry.id, date: entry.date, category: entry.category, description: entry.descriptionKey, amount: entry.amount, balance: entry.balanceAfter }))
  ].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const brandHistory = economy.ledger.filter(entry => entry.category === 'brand_investment').reverse();
  const signedCurrency = (value: number) => `${value >= 0 ? '+' : '-'}${formatCurrency(Math.abs(value), language)}`;
  const modeLabels: Record<PromotionFinancialMode, string> = {
    growth: t($ => $.promotionFinances.modes.growth),
    stable: t($ => $.promotionFinances.modes.stable),
    cautious: t($ => $.promotionFinances.modes.cautious),
    recovery: t($ => $.promotionFinances.modes.recovery)
  };
  const categoryLabels: Record<PromotionLedgerCategory, string> = {
    event_gate: t($ => $.promotionFinances.categories.eventGate),
    event_media: t($ => $.promotionFinances.categories.eventMedia),
    event_sponsor: t($ => $.promotionFinances.categories.eventSponsor),
    fighter_purse: t($ => $.promotionFinances.categories.fighterPurse),
    win_bonus: t($ => $.promotionFinances.categories.winBonus),
    venue: t($ => $.promotionFinances.categories.venue),
    event_marketing: t($ => $.promotionFinances.categories.eventMarketing),
    monthly_sponsor: t($ => $.promotionFinances.categories.monthlySponsor),
    monthly_media: t($ => $.promotionFinances.categories.monthlyMedia),
    operating_cost: t($ => $.promotionFinances.categories.operatingCost),
    roster_retainer: t($ => $.promotionFinances.categories.rosterRetainer),
    liability_payment: t($ => $.promotionFinances.categories.liabilityPayment),
    brand_investment: t($ => $.promotionFinances.categories.brandInvestment),
    transfer_fee: t($ => $.promotionFinances.categories.transferFee),
    objective_reward: t($ => $.promotionFinances.categories.objectiveReward),
    drama: t($ => $.promotionFinances.categories.drama)
  };
  const reasonLabel = (reason: PromotionEconomyReason) => ({
    invalid_amount: t($ => $.promotionFinances.reasons.invalidAmount, { minimum: formatCurrency(1_000, language) }),
    recovery_mode: t($ => $.promotionFinances.reasons.recoveryMode),
    outstanding_liabilities: t($ => $.promotionFinances.reasons.outstandingLiabilities),
    debt_limit: t($ => $.promotionFinances.reasons.debtLimit),
    required_reserve: t($ => $.promotionFinances.reasons.requiredReserve),
    promotion_missing: t($ => $.promotionFinances.reasons.invalidAmount, { minimum: formatCurrency(1_000, language) }),
    economy_missing: t($ => $.promotionFinances.reasons.invalidAmount, { minimum: formatCurrency(1_000, language) }),
    duplicate_transaction: t($ => $.promotionFinances.reasons.invalidAmount, { minimum: formatCurrency(1_000, language) })
  })[reason];
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const reason = state.investInBrand(amount);
    setMessage(reason ? reasonLabel(reason) : t($ => $.promotionFinances.reasons.success));
  };

  return <div className="min-w-0 space-y-6">
    <PageHeader eyebrow={t($ => $.promotionFinances.eyebrow)} title={t($ => $.promotionFinances.title)} description={t($ => $.promotionFinances.description)} />

    <label className="block max-w-md text-sm text-neutral-300">
      <span className="mb-2 block">{t($ => $.promotionFinances.selectPromotion)}</span>
      <select value={promotionId} onChange={event => { setPromotionId(event.target.value); setMessage(''); }} aria-label={t($ => $.promotionFinances.selectPromotion)} className="min-h-11 w-full rounded-lg border border-[#2a2c31] bg-neutral-950 px-3 text-white">
        {Object.values(state.promotions).sort((a, b) => a.name.localeCompare(b.name)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>

    <Panel className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label={t($ => $.promotionFinances.cash)} value={formatCurrency(promotion.money, language)} />
      <Stat label={t($ => $.promotionFinances.debtLimit)} value={formatCurrency(economy.debtLimit, language)} />
      <Stat label={t($ => $.promotionFinances.headroom)} value={formatCurrency(snapshot.debtHeadroom, language)} />
      <Stat label={t($ => $.promotionFinances.liabilities)} value={formatCurrency(economy.outstandingLiabilities, language)} />
      <Stat label={t($ => $.promotionFinances.runway)} value={t($ => $.promotionFinances.months, { count: economy.estimatedRunwayMonths })} />
      <Stat label={t($ => $.promotionFinances.mode)} value={<StatusBadge tone={economy.financialMode === 'recovery' ? 'danger' : economy.financialMode === 'cautious' ? 'warning' : economy.financialMode === 'growth' ? 'success' : 'neutral'}>{modeLabels[economy.financialMode]}</StatusBadge>} />
      <Stat label={t($ => $.promotionFinances.contractBudget)} value={formatCurrency(economy.contractBudget, language)} />
      <Stat label={t($ => $.promotionFinances.recentEvent)} value={recentEvent ? signedCurrency(recentEvent.profit) : '—'} detail={recentEvent?.name} />
    </Panel>

    <Panel>
      <h2 className="text-lg font-medium text-white">{t($ => $.promotionFinances.monthlyIncome)} / {t($ => $.promotionFinances.monthlyExpenses)}</h2>
      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t($ => $.promotionFinances.sponsorIncome)} value={signedCurrency(economy.monthlySponsorIncome)} />
        <Stat label={t($ => $.promotionFinances.mediaIncome)} value={signedCurrency(economy.monthlyMediaIncome)} />
        <Stat label={t($ => $.promotionFinances.operatingCost)} value={signedCurrency(-economy.monthlyOperatingCost)} />
        <Stat label={t($ => $.promotionFinances.rosterRetainer)} value={signedCurrency(-economy.monthlyRosterRetainer)} />
        <Stat label={t($ => $.promotionFinances.brandSpend)} value={signedCurrency(-economy.scheduledBrandInvestment)} />
        <Stat label={t($ => $.promotionFinances.monthlyNet)} value={signedCurrency(monthlyIncome - monthlyExpenses)} />
      </div>
    </Panel>

    {isPlayer ? <Panel>
      <h2 className="text-lg font-medium text-white">{t($ => $.promotionFinances.investTitle)}</h2>
      <form onSubmit={submit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="min-w-0 text-sm text-neutral-300"><span className="mb-2 block">{t($ => $.promotionFinances.investAmount)}</span><input type="number" min={1_000} step={1_000} value={amount} onChange={event => setAmount(Number(event.target.value))} aria-label={t($ => $.promotionFinances.investAmount)} className="min-h-11 w-full min-w-0 rounded-lg border border-[#2a2c31] bg-neutral-950 px-3 text-white" /></label>
        <Button type="submit" variant="primary" className="self-end">{t($ => $.promotionFinances.invest)}</Button>
      </form>
      <p className="mt-3 text-sm text-neutral-400">{t($ => $.promotionFinances.projectedEffect, { fanbase: formatNumber(effect.fanbaseGain, language), reputation: effect.reputationGain })}</p>
      <p className="mt-2 min-h-5 text-sm text-amber-200" aria-live="polite">{message}</p>
    </Panel> : <Panel><p className="text-sm text-neutral-400">{t($ => $.promotionFinances.rivalReadOnly)}</p></Panel>}

    <Panel>
      <h2 className="text-lg font-medium text-white">{t($ => $.promotionFinances.brandHistory)}</h2>
      {brandHistory.length ? <ul className="mt-3 space-y-2">{brandHistory.map(entry => <li key={entry.id} className="flex flex-wrap justify-between gap-2 border-b border-[#2a2c31] py-2 text-sm"><span className="text-neutral-400">{formatDate(entry.date, language)}</span><span className="font-mono text-red-300">{signedCurrency(entry.amount)}</span></li>)}</ul> : <p className="mt-3 text-sm text-neutral-500">{t($ => $.promotionFinances.noEntries)}</p>}
    </Panel>

    <Panel className="min-w-0 overflow-x-auto">
      <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
        <caption className="mb-4 text-left text-lg font-medium text-white">{t($ => $.promotionFinances.ledgerCaption)}</caption>
        <thead><tr className="border-b border-[#2a2c31] text-neutral-500"><th scope="col" className="px-2 py-3">{t($ => $.promotionFinances.date)}</th><th scope="col" className="px-2 py-3">{t($ => $.promotionFinances.category)}</th><th scope="col" className="px-2 py-3">{t($ => $.promotionFinances.transactionDescription)}</th><th scope="col" className="px-2 py-3 text-right">{t($ => $.promotionFinances.amount)}</th><th scope="col" className="px-2 py-3 text-right">{t($ => $.promotionFinances.balance)}</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id} className="border-b border-[#2a2c31]/70"><td className="px-2 py-3 text-neutral-400">{formatDate(row.date, language)}</td><td className="px-2 py-3 text-neutral-300">{row.category ? categoryLabels[row.category] : t($ => $.promotionFinances.categories.legacy)}</td><td className="max-w-md break-words px-2 py-3 text-neutral-400">{row.description}</td><td className={`px-2 py-3 text-right font-mono ${row.amount >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{signedCurrency(row.amount)}</td><td className="px-2 py-3 text-right font-mono text-neutral-300">{row.balance === null ? '—' : formatCurrency(row.balance, language)}</td></tr>)}</tbody>
      </table>
      {!rows.length && <p className="py-6 text-center text-sm text-neutral-500">{t($ => $.promotionFinances.noEntries)}</p>}
    </Panel>
  </div>;
}
