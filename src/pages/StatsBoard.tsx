import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '../components/Select';
import { StatisticsTable, type StatisticsColumn } from '../components/StatisticsTable';
import { PageHeader, Panel } from '../components/ui';
import { WEIGHT_CLASSES } from '../lib/game/constants';
import { getStatsBoard, type FighterLeaderRow, type FightRecordRow, type StatisticsPeriod, type StatisticsScope, type StatsBoardData } from '../lib/game/statistics';
import { formatCurrency, formatDate, formatNumber, formatWeightClass } from '../lib/localization';
import { useGameStore } from '../store/gameStore';
import { useSettingsStore } from '../store/settingsStore';
import type { WeightClass } from '../types/game';

const tabs = ['fighters', 'fights', 'events', 'promotions', 'titles', 'tournaments'] as const;
type StatsTab = typeof tabs[number];
type FighterCategory = keyof StatsBoardData['fighterLeaders'];
type FighterRow = FighterLeaderRow & { category: FighterCategory; order: number };
type FightRow = FightRecordRow & { order: number };

const emDash = '—';
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export default function StatsBoard() {
  const { t } = useTranslation('translation');
  const state = useGameStore();
  const language = useSettingsStore(store => store.language);
  const [activeTab, setActiveTab] = useState<StatsTab>('fighters');
  const [periodValue, setPeriodValue] = useState('all-time');
  const [scopeValue, setScopeValue] = useState('world');
  const [weightClass, setWeightClass] = useState<WeightClass | 'all'>('all');
  const period: StatisticsPeriod = periodValue === 'all-time' ? { kind: 'all-time' } : periodValue === 'current-season' ? { kind: 'current-season' } : { kind: 'year', year: Number(periodValue.slice(5)) };
  const scope: StatisticsScope = scopeValue === 'world' ? { kind: 'world' } : scopeValue === 'international' ? { kind: 'international' } : { kind: 'promotion', promotionId: scopeValue.slice(10) };
  const data = useMemo(() => getStatsBoard(state, { period, scope, weightClass }), [state, periodValue, scopeValue, weightClass]);
  const fighterRows: FighterRow[] = (Object.entries(data.fighterLeaders) as [FighterCategory, FighterLeaderRow[]][]).flatMap(([category, rows], categoryIndex) => rows.map((row, rank) => ({ ...row, id: `${category}-${row.id}`, category, order: categoryIndex * 1_000_000 + rank })));
  const fightRows: FightRow[] = data.fightRecords.map((row, order) => ({ ...row, order }));
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const nextIndex = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
    if (nextIndex === null) return;
    event.preventDefault();
    setActiveTab(tabs[nextIndex]);
    document.getElementById(`stats-tab-${tabs[nextIndex]}`)?.focus();
  };
  const fighterName = (fighterId: string) => state.fighters[fighterId] ? `${state.fighters[fighterId].firstName} ${state.fighters[fighterId].lastName}` : t($ => $.fighterDetail.unknown);
  const promotionName = (promotionId: string | null) => promotionId ? state.promotions[promotionId]?.name ?? t($ => $.fighterDetail.unknown) : t($ => $.statsBoard.international);
  const showMoreLabel = t($ => $.statsBoard.showMore);
  const emptyLabel = t($ => $.statsBoard.empty);
  const percent = (value: number | null) => value === null ? emDash : `${formatNumber(value * 100, language, { maximumFractionDigits: 1 })}%`;
  const fighterMetric = (row: FighterRow) => row.category === 'trackedEarnings' ? formatCurrency(row.value, language) : row.category === 'controlTime' ? clock(row.value) : row.category === 'winPercentage' || row.category === 'strikingAccuracy' || row.category === 'takedownAccuracy' ? percent(row.value) : formatNumber(row.value, language, { maximumFractionDigits: 1 });
  const fighterColumns: StatisticsColumn<FighterRow>[] = [
    { id: 'category', label: t($ => $.statsBoard.columns.record), sortValue: row => row.order, render: row => t($ => $.statsBoard.metrics[row.category]) },
    { id: 'fighter', label: t($ => $.statsBoard.columns.fighter), sortValue: row => row.fighterName, render: row => <button type="button" onClick={() => state.setView('fighter-detail', { fighterId: row.fighterId })} className="min-h-11 text-left text-white underline decoration-neutral-700 underline-offset-4 hover:decoration-white">{row.fighterName}</button> },
    { id: 'division', label: t($ => $.statsBoard.columns.division), sortValue: row => row.weightClass, render: row => formatWeightClass(row.weightClass, language) },
    { id: 'value', label: t($ => $.statsBoard.columns.value), sortValue: row => row.value, render: fighterMetric, numeric: true },
    { id: 'sample', label: t($ => $.statsBoard.columns.sample), sortValue: row => row.sampleSize, render: row => row.sampleSize, numeric: true }
  ];
  const fightColumns: StatisticsColumn<FightRow>[] = [
    { id: 'category', label: t($ => $.statsBoard.columns.record), sortValue: row => row.order, render: row => t($ => $.statsBoard.fightMetrics[row.category]) },
    { id: 'fight', label: t($ => $.statsBoard.columns.fight), sortValue: row => row.eventName, render: row => <button type="button" onClick={() => state.setView('fight-detail', { fightArchiveId: row.fightId })} className="min-h-11 text-left text-white underline decoration-neutral-700 underline-offset-4 hover:decoration-white">{fighterName(row.redFighterId)} vs. {fighterName(row.blueFighterId)}</button> },
    { id: 'event', label: t($ => $.statsBoard.columns.event), sortValue: row => row.eventName, render: row => row.eventName },
    { id: 'date', label: t($ => $.statsBoard.columns.date), sortValue: row => row.date, render: row => formatDate(row.date, language) },
    { id: 'value', label: t($ => $.statsBoard.columns.value), sortValue: row => row.value, render: row => row.category === 'fastestFinish' || row.category === 'longestFight' || row.category === 'controlTime' ? clock(row.value) : formatNumber(row.value, language), numeric: true }
  ];
  const eventColumns: StatisticsColumn<typeof data.events[number]>[] = [
    { id: 'date', label: t($ => $.statsBoard.columns.date), sortValue: row => row.date, render: row => formatDate(row.date, language) },
    { id: 'event', label: t($ => $.statsBoard.columns.event), sortValue: row => row.eventName, render: row => row.eventName },
    { id: 'promotion', label: t($ => $.statsBoard.columns.promotion), sortValue: row => promotionName(row.promotionId), render: row => promotionName(row.promotionId) },
    { id: 'fights', label: t($ => $.statsBoard.columns.fights), sortValue: row => row.fightCount, render: row => row.fightCount, numeric: true },
    { id: 'finishRate', label: t($ => $.statsBoard.columns.finishRate), sortValue: row => row.finishRate, render: row => percent(row.finishRate), numeric: true },
    { id: 'attendance', label: t($ => $.statsBoard.columns.attendance), sortValue: row => row.attendance, render: row => formatNumber(row.attendance, language), numeric: true },
    { id: 'profit', label: t($ => $.statsBoard.columns.profit), sortValue: row => row.profit, render: row => row.profit === null ? emDash : formatCurrency(row.profit, language), numeric: true }
  ];
  const promotionColumns: StatisticsColumn<typeof data.promotions[number]>[] = [
    { id: 'promotion', label: t($ => $.statsBoard.columns.promotion), sortValue: row => row.promotionName, render: row => row.promotionName },
    { id: 'events', label: t($ => $.statsBoard.columns.events), sortValue: row => row.eventCount, render: row => row.eventCount, numeric: true },
    { id: 'appearances', label: t($ => $.statsBoard.columns.appearances), sortValue: row => row.fightAppearances, render: row => row.fightAppearances, numeric: true },
    { id: 'wins', label: t($ => $.statsBoard.columns.wins), sortValue: row => row.wins, render: row => row.wins, numeric: true },
    { id: 'profit', label: t($ => $.statsBoard.columns.profit), sortValue: row => row.eventProfit, render: row => formatCurrency(row.eventProfit, language), numeric: true },
    { id: 'pay', label: t($ => $.statsBoard.columns.fighterPay), sortValue: row => row.fighterPay, render: row => formatCurrency(row.fighterPay, language), numeric: true },
    { id: 'liabilities', label: t($ => $.statsBoard.columns.liabilities), sortValue: row => row.currentLiabilities, render: row => formatCurrency(row.currentLiabilities, language), numeric: true }
  ];
  const titleColumns: StatisticsColumn<typeof data.titles[number]>[] = [
    { id: 'fighter', label: t($ => $.statsBoard.columns.fighter), sortValue: row => row.fighterName, render: row => <button type="button" onClick={() => state.setView('fighter-detail', { fighterId: row.fighterId })} className="min-h-11 text-left text-white underline decoration-neutral-700 underline-offset-4 hover:decoration-white">{row.fighterName}</button> },
    { id: 'promotion', label: t($ => $.statsBoard.columns.promotion), sortValue: row => promotionName(row.promotionId), render: row => promotionName(row.promotionId) },
    { id: 'division', label: t($ => $.statsBoard.columns.division), sortValue: row => row.weightClass, render: row => formatWeightClass(row.weightClass, language) },
    { id: 'won', label: t($ => $.statsBoard.columns.dateWon), sortValue: row => row.dateWon, render: row => formatDate(row.dateWon, language) },
    { id: 'days', label: t($ => $.statsBoard.columns.reignDays), sortValue: row => row.reignDays, render: row => row.reignDays, numeric: true },
    { id: 'defenses', label: t($ => $.statsBoard.columns.defenses), sortValue: row => row.defenses, render: row => row.defenses, numeric: true }
  ];
  const tournamentColumns: StatisticsColumn<typeof data.tournaments[number]>[] = [
    { id: 'name', label: t($ => $.statsBoard.columns.tournament), sortValue: row => row.tournamentName, render: row => row.tournamentName },
    { id: 'type', label: t($ => $.statsBoard.columns.type), sortValue: row => row.type, render: row => t($ => $.statsBoard.tournamentTypes[row.type]) },
    { id: 'division', label: t($ => $.statsBoard.columns.division), sortValue: row => row.weightClass, render: row => formatWeightClass(row.weightClass, language) },
    { id: 'winner', label: t($ => $.statsBoard.columns.winner), sortValue: row => row.winnerId ? fighterName(row.winnerId) : null, render: row => row.winnerId ? <button type="button" onClick={() => state.setView('fighter-detail', { fighterId: row.winnerId! })} className="min-h-11 text-left text-white underline decoration-neutral-700 underline-offset-4 hover:decoration-white">{fighterName(row.winnerId)}</button> : emDash },
    { id: 'fights', label: t($ => $.statsBoard.columns.fights), sortValue: row => row.fightCount, render: row => row.fightCount, numeric: true },
    { id: 'finishRate', label: t($ => $.statsBoard.columns.finishRate), sortValue: row => row.finishRate, render: row => percent(row.finishRate), numeric: true },
    { id: 'rating', label: t($ => $.statsBoard.columns.rating), sortValue: row => row.averageRating, render: row => row.averageRating === null ? emDash : formatNumber(row.averageRating, language, { maximumFractionDigits: 1 }), numeric: true }
  ];
  const table = activeTab === 'fighters' ? <StatisticsTable caption={t($ => $.statsBoard.tabs.fighters)} rows={fighterRows} columns={fighterColumns} initialSort={{ columnId: 'category', direction: 'asc' }} emptyLabel={emptyLabel} showMoreLabel={showMoreLabel} />
    : activeTab === 'fights' ? <StatisticsTable caption={t($ => $.statsBoard.tabs.fights)} rows={fightRows} columns={fightColumns} initialSort={{ columnId: 'category', direction: 'asc' }} emptyLabel={emptyLabel} showMoreLabel={showMoreLabel} />
    : activeTab === 'events' ? <StatisticsTable caption={t($ => $.statsBoard.tabs.events)} rows={data.events} columns={eventColumns} initialSort={{ columnId: 'date', direction: 'desc' }} emptyLabel={emptyLabel} showMoreLabel={showMoreLabel} />
    : activeTab === 'promotions' ? <StatisticsTable caption={t($ => $.statsBoard.tabs.promotions)} rows={data.promotions} columns={promotionColumns} initialSort={{ columnId: 'events', direction: 'desc' }} emptyLabel={emptyLabel} showMoreLabel={showMoreLabel} />
    : activeTab === 'titles' ? <StatisticsTable caption={t($ => $.statsBoard.tabs.titles)} rows={data.titles} columns={titleColumns} initialSort={{ columnId: 'days', direction: 'desc' }} emptyLabel={emptyLabel} showMoreLabel={showMoreLabel} />
    : <StatisticsTable caption={t($ => $.statsBoard.tabs.tournaments)} rows={data.tournaments} columns={tournamentColumns} initialSort={{ columnId: 'rating', direction: 'desc' }} emptyLabel={emptyLabel} showMoreLabel={showMoreLabel} />;
  return <div className="mx-auto max-w-7xl space-y-6 pb-12">
    <PageHeader eyebrow={t($ => $.statsBoard.eyebrow)} title={t($ => $.statsBoard.title)} description={t($ => $.statsBoard.description)} />
    <Panel><div className="grid gap-3 sm:grid-cols-3">
      <Filter label={t($ => $.statsBoard.filters.period)}><Select value={periodValue} onChange={setPeriodValue} options={[{ value: 'all-time', label: t($ => $.statsBoard.filters.allTime) }, { value: 'current-season', label: t($ => $.statsBoard.filters.currentSeason) }, ...data.years.map(year => ({ value: `year-${year}`, label: String(year) }))]} /></Filter>
      <Filter label={t($ => $.statsBoard.filters.scope)}><Select value={scopeValue} onChange={setScopeValue} options={[{ value: 'world', label: t($ => $.statsBoard.filters.world) }, ...Object.values(state.promotions).map(promotion => ({ value: `promotion-${promotion.id}`, label: promotion.name })), { value: 'international', label: t($ => $.statsBoard.filters.international) }]} /></Filter>
      <Filter label={t($ => $.statsBoard.filters.division)}><Select value={weightClass} onChange={value => setWeightClass(value as WeightClass | 'all')} options={[{ value: 'all', label: t($ => $.statsBoard.filters.allDivisions) }, ...WEIGHT_CLASSES.map(value => ({ value, label: formatWeightClass(value, language) }))]} /></Filter>
    </div></Panel>
    <div role="tablist" aria-label={t($ => $.statsBoard.sectionsLabel)} className="flex flex-wrap border-b border-[#2a2c31]">{tabs.map((tab, index) => <button key={tab} id={`stats-tab-${tab}`} type="button" role="tab" aria-selected={activeTab === tab} aria-controls={`stats-panel-${tab}`} tabIndex={activeTab === tab ? 0 : -1} onClick={() => setActiveTab(tab)} onKeyDown={event => handleTabKeyDown(event, index)} className={`min-h-11 border-b-2 px-4 font-mono text-[11px] uppercase tracking-[0.12em] ${activeTab === tab ? 'border-white text-white' : 'border-transparent text-neutral-500 hover:text-white'}`}>{t($ => $.statsBoard.tabs[tab])}</button>)}</div>
    <section key={activeTab} id={`stats-panel-${activeTab}`} role="tabpanel" aria-labelledby={`stats-tab-${activeTab}`} tabIndex={0}>{table}</section>
  </div>;
}

function Filter({ label, children }: { label: string; children: ReactNode }) {
  return <div><span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">{label}</span>{children}</div>;
}
