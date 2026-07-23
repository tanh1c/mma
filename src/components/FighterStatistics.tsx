import { useMemo, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { getFighterStatistics, safeRatio } from '../lib/game/statistics';
import { formatCurrency, formatDate, formatFightMethod, formatNumber, formatWeightClass } from '../lib/localization';
import { useGameStore } from '../store/gameStore';
import { useSettingsStore } from '../store/settingsStore';
import { StatisticsTable, type StatisticsColumn } from './StatisticsTable';
import { Panel, Stat } from './ui';

const emDash = '—';
const percent = (value: number | null) => value === null ? emDash : `${(value * 100).toFixed(1)}%`;
const perFight = (value: number, fights: number) => fights ? value / fights : null;
const per15Minutes = (value: number, seconds: number) => seconds ? value * 900 / seconds : null;
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
type MetricRow = { id: string; label: string; value: string | number; perFight: string; per15: string; accuracy: string };

export function FighterStatistics({ fighterId }: { fighterId: string }): ReactElement {
  const state = useGameStore();
  const { language } = useSettingsStore();
  const { t } = useTranslation('translation');
  const stats = useMemo(() => getFighterStatistics(state, fighterId), [state, fighterId]);
  const fighter = state.fighters[fighterId];
  const fighterName = fighter ? `${fighter.firstName} ${fighter.lastName}` : t($ => $.fighterDetail.unknown);
  const technicalFights = stats.technical.fightsWithStats;
  const technicalSeconds = stats.technical.recordedSeconds;
  const number = (value: number | null) => value === null ? emDash : formatNumber(value, language, { maximumFractionDigits: 1 });
  const statColumns: StatisticsColumn<typeof stats.perFight[number]>[] = [
    { id: 'date', label: t($ => $.fighterDetail.statistics.perFight.date), sortValue: row => row.date, render: row => formatDate(row.date, language) },
    { id: 'event', label: t($ => $.fighterDetail.statistics.perFight.event), sortValue: row => row.eventName, render: row => <button type="button" onClick={() => state.setView('fight-detail', { fightArchiveId: row.id })} className="min-h-11 text-left text-white underline decoration-neutral-700 underline-offset-4 hover:decoration-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{row.eventName}</button> },
    { id: 'opponent', label: t($ => $.fighterDetail.statistics.perFight.opponent), sortValue: row => state.fighters[row.opponentId] ? `${state.fighters[row.opponentId].firstName} ${state.fighters[row.opponentId].lastName}` : row.opponentId, render: row => state.fighters[row.opponentId] ? `${state.fighters[row.opponentId].firstName} ${state.fighters[row.opponentId].lastName}` : t($ => $.fighterDetail.unknown) },
    { id: 'result', label: t($ => $.fighterDetail.statistics.perFight.result), sortValue: row => row.result, render: row => <span className={row.result === 'win' ? 'text-emerald-300' : row.result === 'loss' ? 'text-red-300' : 'text-neutral-400'}>{t($ => $.fighterDetail[row.result])}</span> },
    { id: 'method', label: t($ => $.fighterDetail.statistics.perFight.method), sortValue: row => row.method, render: row => formatFightMethod(row.method, language) },
    { id: 'round', label: t($ => $.fighterDetail.statistics.perFight.round), sortValue: row => row.round, render: row => `${row.round} (${row.time})`, numeric: true },
    { id: 'rating', label: t($ => $.fighterDetail.statistics.perFight.rating), sortValue: row => row.performanceRating, render: row => row.performanceRating, numeric: true },
    { id: 'payout', label: t($ => $.fighterDetail.statistics.perFight.payout), sortValue: row => row.payout, render: row => row.payout === null ? emDash : formatCurrency(row.payout, language), numeric: true }
  ];
  const rankingColumns: StatisticsColumn<typeof stats.rankingHistory[number]>[] = [
    { id: 'date', label: t($ => $.fighterDetail.statistics.rankingHistory.date), sortValue: row => row.date, render: row => formatDate(row.date, language) },
    { id: 'scope', label: t($ => $.fighterDetail.statistics.rankingHistory.scope), sortValue: row => row.scope, render: row => row.scope === 'world' ? t($ => $.fighterDetail.statistics.rankingHistory.world) : t($ => $.fighterDetail.statistics.rankingHistory.promotionScope) },
    { id: 'promotion', label: t($ => $.fighterDetail.statistics.rankingHistory.promotion), sortValue: row => row.promotionId ? state.promotions[row.promotionId]?.name ?? row.promotionId : null, render: row => row.promotionId ? state.promotions[row.promotionId]?.name ?? t($ => $.fighterDetail.unknown) : emDash },
    { id: 'division', label: t($ => $.fighterDetail.statistics.rankingHistory.division), sortValue: row => row.weightClass, render: row => formatWeightClass(row.weightClass, language) },
    { id: 'previous', label: t($ => $.fighterDetail.statistics.rankingHistory.previous), sortValue: row => row.previousRank ?? null, render: row => row.previousRank === undefined ? t($ => $.fighterDetail.statistics.rankingHistory.unranked) : `#${row.previousRank}`, numeric: true },
    { id: 'current', label: t($ => $.fighterDetail.statistics.rankingHistory.current), sortValue: row => row.rank ?? null, render: row => row.rank === undefined ? t($ => $.fighterDetail.statistics.rankingHistory.unranked) : `#${row.rank}`, numeric: true }
  ];
  const strikingRows: MetricRow[] = [
    { id: 'total', label: t($ => $.fighterDetail.statistics.striking.total), value: `${stats.technical.significantStrikesLanded}/${stats.technical.significantStrikesAttempted}`, perFight: `${number(perFight(stats.technical.significantStrikesLanded, technicalFights))}`, per15: number(per15Minutes(stats.technical.significantStrikesLanded, technicalSeconds)), accuracy: percent(safeRatio(stats.technical.significantStrikesLanded, stats.technical.significantStrikesAttempted)) },
    { id: 'head', label: t($ => $.fighterDetail.statistics.striking.head), value: stats.technical.headStrikesLanded, perFight: number(perFight(stats.technical.headStrikesLanded, technicalFights)), per15: number(per15Minutes(stats.technical.headStrikesLanded, technicalSeconds)), accuracy: emDash },
    { id: 'body', label: t($ => $.fighterDetail.statistics.striking.body), value: stats.technical.bodyStrikesLanded, perFight: number(perFight(stats.technical.bodyStrikesLanded, technicalFights)), per15: number(per15Minutes(stats.technical.bodyStrikesLanded, technicalSeconds)), accuracy: emDash },
    { id: 'leg', label: t($ => $.fighterDetail.statistics.striking.leg), value: stats.technical.legStrikesLanded, perFight: number(perFight(stats.technical.legStrikesLanded, technicalFights)), per15: number(per15Minutes(stats.technical.legStrikesLanded, technicalSeconds)), accuracy: emDash }
  ];
  const grapplingRows: MetricRow[] = [
    { id: 'takedowns', label: t($ => $.fighterDetail.statistics.grappling.takedowns), value: `${stats.technical.takedownsLanded}/${stats.technical.takedownsAttempted}`, perFight: number(perFight(stats.technical.takedownsLanded, technicalFights)), per15: number(per15Minutes(stats.technical.takedownsLanded, technicalSeconds)), accuracy: percent(safeRatio(stats.technical.takedownsLanded, stats.technical.takedownsAttempted)) },
    { id: 'submissions', label: t($ => $.fighterDetail.statistics.grappling.submissionAttempts), value: stats.technical.submissionAttempts, perFight: number(perFight(stats.technical.submissionAttempts, technicalFights)), per15: number(per15Minutes(stats.technical.submissionAttempts, technicalSeconds)), accuracy: emDash },
    { id: 'reversals', label: t($ => $.fighterDetail.statistics.grappling.reversals), value: stats.technical.reversals, perFight: number(perFight(stats.technical.reversals, technicalFights)), per15: number(per15Minutes(stats.technical.reversals, technicalSeconds)), accuracy: emDash },
    { id: 'control', label: t($ => $.fighterDetail.statistics.grappling.control), value: clock(stats.technical.controlSeconds), perFight: number(perFight(stats.technical.controlSeconds, technicalFights)), per15: number(per15Minutes(stats.technical.controlSeconds, technicalSeconds)), accuracy: emDash },
    { id: 'knockdowns', label: t($ => $.fighterDetail.statistics.grappling.knockdowns), value: stats.technical.knockdowns, perFight: number(perFight(stats.technical.knockdowns, technicalFights)), per15: number(per15Minutes(stats.technical.knockdowns, technicalSeconds)), accuracy: emDash }
  ];
  const metricColumns = (section: 'striking' | 'grappling'): StatisticsColumn<MetricRow>[] => [
    { id: 'label', label: section === 'striking' ? t($ => $.fighterDetail.statistics.striking.total) : t($ => $.fighterDetail.statistics.grappling.takedowns), sortValue: row => row.label, render: row => row.label },
    { id: 'value', label: t($ => $.fighterDetail.statistics.striking.landed), sortValue: row => row.value, render: row => row.value, numeric: true },
    { id: 'perFight', label: t($ => $.fighterDetail.statistics.striking.perFight), sortValue: row => row.perFight, render: row => row.perFight, numeric: true },
    { id: 'per15', label: t($ => $.fighterDetail.statistics.striking.per15Min), sortValue: row => row.per15, render: row => row.per15, numeric: true },
    { id: 'accuracy', label: t($ => $.fighterDetail.statistics.striking.accuracy), sortValue: row => row.accuracy, render: row => row.accuracy, numeric: true }
  ];
  return <div className="space-y-6">
    <Panel>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">{t($ => $.fighterDetail.statistics.eyebrow)}</p>
      <h2 className="mt-2 text-xl font-medium text-white">{t($ => $.fighterDetail.statistics.title)}</h2>
      <p className="mt-1 text-sm text-neutral-400">{t($ => $.fighterDetail.statistics.description, { name: fighterName })}</p>
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4"><Stat label={t($ => $.fighterDetail.statistics.career.fights)} value={stats.fights} /><Stat label={t($ => $.fighterDetail.statistics.career.wins)} value={stats.wins} /><Stat label={t($ => $.fighterDetail.statistics.career.losses)} value={stats.losses} /><Stat label={t($ => $.fighterDetail.statistics.career.winRate)} value={percent(safeRatio(stats.wins, stats.fights))} /></div>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4"><Stat label={t($ => $.fighterDetail.statistics.career.currentStreak)} value={stats.currentWinStreak} /><Stat label={t($ => $.fighterDetail.statistics.career.longestStreak)} value={stats.longestWinStreak} /><Stat label={t($ => $.fighterDetail.statistics.career.titleFights)} value={stats.titleFights} /><Stat label={t($ => $.fighterDetail.statistics.career.titleDefenses)} value={stats.titleDefenses} /></div>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4"><Stat label={t($ => $.fighterDetail.statistics.career.koWins)} value={stats.koWins} /><Stat label={t($ => $.fighterDetail.statistics.career.submissionWins)} value={stats.submissionWins} /><Stat label={t($ => $.fighterDetail.statistics.career.decisionWins)} value={stats.decisionWins} /><Stat label={t($ => $.fighterDetail.statistics.career.trackedEarnings)} value={stats.trackedFightCount ? formatCurrency(stats.trackedEarnings, language) : emDash} detail={t($ => $.fighterDetail.statistics.career.trackedCount, { count: stats.trackedFightCount })} /></div>
    </Panel>
    <Panel><h2 className="mb-4 text-lg font-medium text-white">{t($ => $.fighterDetail.statistics.striking.title)}</h2><StatisticsTable caption={t($ => $.fighterDetail.statistics.striking.title)} rows={strikingRows} columns={metricColumns('striking')} initialSort={{ columnId: 'value', direction: 'desc' }} emptyLabel={t($ => $.fighterDetail.statistics.empty)} showMoreLabel={t($ => $.fighterDetail.statistics.showMore)} /></Panel>
    <Panel><h2 className="mb-4 text-lg font-medium text-white">{t($ => $.fighterDetail.statistics.grappling.title)}</h2><StatisticsTable caption={t($ => $.fighterDetail.statistics.grappling.title)} rows={grapplingRows} columns={metricColumns('grappling')} initialSort={{ columnId: 'value', direction: 'desc' }} emptyLabel={t($ => $.fighterDetail.statistics.empty)} showMoreLabel={t($ => $.fighterDetail.statistics.showMore)} /></Panel>
    <Panel><h2 className="mb-4 text-lg font-medium text-white">{t($ => $.fighterDetail.statistics.perFight.title)}</h2><StatisticsTable caption={t($ => $.fighterDetail.statistics.perFight.title)} rows={stats.perFight} columns={statColumns} initialSort={{ columnId: 'date', direction: 'desc' }} emptyLabel={t($ => $.fighterDetail.statistics.empty)} showMoreLabel={t($ => $.fighterDetail.statistics.showMore)} /></Panel>
    <Panel><h2 className="mb-4 text-lg font-medium text-white">{t($ => $.fighterDetail.statistics.rankingHistory.title)}</h2><StatisticsTable caption={t($ => $.fighterDetail.statistics.rankingHistory.title)} rows={stats.rankingHistory} columns={rankingColumns} initialSort={{ columnId: 'date', direction: 'desc' }} emptyLabel={t($ => $.fighterDetail.statistics.empty)} showMoreLabel={t($ => $.fighterDetail.statistics.showMore)} /></Panel>
    <p className="text-xs leading-5 text-neutral-500">{t($ => $.fighterDetail.statistics.trackedSince, { date: formatDate(state.statisticsTrackingStartedAt, language) })} {t($ => $.fighterDetail.statistics.unknown)}</p>
  </div>;
}
