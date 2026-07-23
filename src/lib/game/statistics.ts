import { differenceInCalendarDays } from 'date-fns';
import type {
  EventArchiveItem,
  Fighter,
  FighterRankingChange,
  FightArchiveItem,
  GameState,
  GrandPrixTournament,
  Promotion,
  PromotionEconomy,
  RoundStats,
  TitleHistoryItem,
  WeightClass
} from '../../types/game';

export type StatisticsPeriod =
  | { kind: 'all-time' }
  | { kind: 'current-season' }
  | { kind: 'year'; year: number };

export type StatisticsScope =
  | { kind: 'world' }
  | { kind: 'promotion'; promotionId: string }
  | { kind: 'international' };

export interface StatisticsFilter {
  period: StatisticsPeriod;
  scope: StatisticsScope;
  weightClass: WeightClass | 'all';
}

export interface FighterTechnicalTotals {
  fightsWithStats: number;
  rounds: number;
  recordedSeconds: number;
  totalStrikesAttempted: number;
  totalStrikesLanded: number;
  significantStrikesAttempted: number;
  significantStrikesLanded: number;
  headStrikesLanded: number;
  bodyStrikesLanded: number;
  legStrikesLanded: number;
  takedownsAttempted: number;
  takedownsLanded: number;
  submissionAttempts: number;
  reversals: number;
  knockdowns: number;
  controlSeconds: number;
  damageGiven: number;
  damageTaken: number;
}

export interface FighterFightStatisticsRow {
  id: string;
  date: string;
  eventId: string;
  eventName: string;
  opponentId: string;
  result: 'win' | 'loss' | 'draw';
  method: string;
  round: number;
  time: string;
  elapsedSeconds: number;
  performanceRating: number;
  payout: number | null;
  totalStrikesLanded: number | null;
  totalStrikesAttempted: number | null;
  significantStrikesLanded: number | null;
  significantStrikesAttempted: number | null;
  takedownsLanded: number | null;
  takedownsAttempted: number | null;
  controlSeconds: number | null;
  knockdowns: number | null;
  weightClass: WeightClass;
  promotionId: string | null;
  scope: 'promotion' | 'international';
  isTitleFight: boolean;
}

export interface FighterStatistics {
  fighterId: string;
  fights: number;
  wins: number;
  losses: number;
  draws: number;
  koWins: number;
  submissionWins: number;
  decisionWins: number;
  currentWinStreak: number;
  longestWinStreak: number;
  titleFights: number;
  titleWins: number;
  titleDefenses: number;
  trackedEarnings: number;
  trackedFightCount: number;
  technical: FighterTechnicalTotals;
  perFight: FighterFightStatisticsRow[];
  rankingHistory: FighterRankingChange[];
}

interface IndexedFightSide {
  totalStrikesAttempted: number;
  totalStrikesLanded: number;
  significantStrikesAttempted: number;
  significantStrikesLanded: number;
  headStrikesLanded: number;
  bodyStrikesLanded: number;
  legStrikesLanded: number;
  takedownsAttempted: number;
  takedownsLanded: number;
  submissionAttempts: number;
  reversals: number;
  knockdowns: number;
  controlSeconds: number;
  damageGiven: number;
  damageTaken: number;
}

export interface IndexedFight {
  id: string;
  date: string;
  eventId: string;
  eventName: string;
  promotionId: string | null;
  scope: 'promotion' | 'international';
  weightClass: WeightClass;
  redFighterId: string;
  blueFighterId: string;
  winnerId: string | null;
  method: string;
  round: number;
  time: string;
  elapsedSeconds: number;
  isTitleFight: boolean;
  titleChangeInfo?: FightArchiveItem['titleChangeInfo'];
  performanceRating: number;
  tournamentId?: string;
  tournamentRound?: FightArchiveItem['tournamentRound'];
  redStats: IndexedFightSide | null;
  blueStats: IndexedFightSide | null;
  statsRounds: number;
  compensation: FightArchiveItem['compensation'];
}

export interface IndexedEvent extends EventArchiveItem {}
export interface IndexedPromotion extends Promotion { economy?: PromotionEconomy }
export interface IndexedTitleReign extends TitleHistoryItem {}
export interface IndexedTournament extends GrandPrixTournament {}

export interface StatisticsIndex {
  fighters: Map<string, FighterStatistics>;
  fights: IndexedFight[];
  events: IndexedEvent[];
  promotions: Map<string, IndexedPromotion>;
  titles: IndexedTitleReign[];
  tournaments: IndexedTournament[];
  years: number[];
}

export interface FighterLeaderRow {
  id: string;
  fighterId: string;
  fighterName: string;
  weightClass: WeightClass;
  value: number;
  numerator?: number;
  denominator?: number;
  sampleSize: number;
}

export type FightRecordCategory = 'rating' | 'fastestFinish' | 'longestFight' | 'knockdowns' | 'significantStrikes' | 'takedowns' | 'controlTime';

export interface FightRecordRow {
  id: string;
  category: FightRecordCategory;
  fightId: string;
  eventId: string;
  eventName: string;
  date: string;
  promotionId: string | null;
  scope: 'promotion' | 'international';
  weightClass: WeightClass;
  redFighterId: string;
  blueFighterId: string;
  winnerId: string | null;
  method: string;
  round: number;
  time: string;
  elapsedSeconds: number;
  value: number;
  sampleSize: number;
}

export interface EventStatisticsRow {
  id: string;
  eventId: string;
  eventName: string;
  date: string;
  promotionId: string | null;
  promotionName: string | null;
  scope: 'promotion' | 'international';
  attendance: number;
  revenue: number | null;
  cost: number | null;
  profit: number | null;
  fanReaction: number;
  fightCount: number;
  finishes: number;
  finishRate: number | null;
  titleFightCount: number;
  fighterBasePay: number;
  fighterWinBonuses: number;
}

export interface PromotionStatisticsRow {
  id: string;
  promotionId: string;
  promotionName: string;
  eventCount: number;
  fightAppearances: number;
  wins: number;
  losses: number;
  draws: number;
  titleWins: number;
  titleDefenses: number;
  eventRevenue: number;
  eventCost: number;
  eventProfit: number;
  sponsorMediaIncome: number;
  fighterPay: number;
  contractSpending: number;
  currentLiabilities: number;
  snapshot: true;
}

export interface TitleStatisticsRow {
  id: string;
  fighterId: string;
  fighterName: string;
  promotionId: string | null;
  promotionName: string | null;
  scope: 'promotion' | 'international';
  weightClass: WeightClass;
  beltType?: 'undisputed' | 'interim';
  dateWon: string;
  dateLost: string | null;
  status: TitleHistoryItem['status'];
  reignDays: number;
  defenses: number;
  titleWins: number;
  value: number;
}

export interface TournamentStatisticsRow {
  id: string;
  tournamentId: string;
  tournamentName: string;
  winnerId: string | null;
  promotionId: string | null;
  promotionName: string | null;
  scope: 'promotion' | 'international';
  type: 'domestic_gp' | 'champions_cup' | 'challenge_cup';
  weightClass: WeightClass;
  appearances: number;
  championships: number;
  fightCount: number;
  finishes: number;
  finishRate: number | null;
  averageRating: number | null;
  value: number | null;
}

export interface StatsBoardData {
  years: number[];
  fighterLeaders: {
    wins: FighterLeaderRow[];
    winPercentage: FighterLeaderRow[];
    koWins: FighterLeaderRow[];
    submissionWins: FighterLeaderRow[];
    currentStreak: FighterLeaderRow[];
    longestStreak: FighterLeaderRow[];
    titleDefenses: FighterLeaderRow[];
    trackedEarnings: FighterLeaderRow[];
    strikingAccuracy: FighterLeaderRow[];
    takedownAccuracy: FighterLeaderRow[];
    knockdowns: FighterLeaderRow[];
    controlTime: FighterLeaderRow[];
  };
  fightRecords: FightRecordRow[];
  events: EventStatisticsRow[];
  promotions: PromotionStatisticsRow[];
  titles: TitleStatisticsRow[];
  tournaments: TournamentStatisticsRow[];
}

export const MIN_WIN_PERCENTAGE_FIGHTS = 3;
export const MIN_ACCURACY_ATTEMPTS = 20;

const ZERO_TECHNICAL: FighterTechnicalTotals = {
  fightsWithStats: 0,
  rounds: 0,
  recordedSeconds: 0,
  totalStrikesAttempted: 0,
  totalStrikesLanded: 0,
  significantStrikesAttempted: 0,
  significantStrikesLanded: 0,
  headStrikesLanded: 0,
  bodyStrikesLanded: 0,
  legStrikesLanded: 0,
  takedownsAttempted: 0,
  takedownsLanded: 0,
  submissionAttempts: 0,
  reversals: 0,
  knockdowns: 0,
  controlSeconds: 0,
  damageGiven: 0,
  damageTaken: 0
};

const numericTechnicalKeys: (keyof Omit<FighterTechnicalTotals, 'fightsWithStats'>)[] = [
  'rounds', 'recordedSeconds', 'totalStrikesAttempted', 'totalStrikesLanded',
  'significantStrikesAttempted', 'significantStrikesLanded', 'headStrikesLanded',
  'bodyStrikesLanded', 'legStrikesLanded', 'takedownsAttempted', 'takedownsLanded',
  'submissionAttempts', 'reversals', 'knockdowns', 'controlSeconds', 'damageGiven', 'damageTaken'
];

export function safeRatio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

export function getFightElapsedSeconds(round: number, time: string): number {
  const [minutes, seconds] = time.split(':').map(Number);
  if (!Number.isFinite(round) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) return 0;
  return Math.max(0, (round - 1) * 300 + minutes * 60 + seconds);
}

function emptyTechnical(): FighterTechnicalTotals {
  return { ...ZERO_TECHNICAL };
}

function sideStats(roundStats: RoundStats[] | undefined, side: 'red' | 'blue'): IndexedFightSide | null {
  if (!roundStats?.length) return null;
  const total: IndexedFightSide = {
    totalStrikesAttempted: 0, totalStrikesLanded: 0,
    significantStrikesAttempted: 0, significantStrikesLanded: 0,
    headStrikesLanded: 0, bodyStrikesLanded: 0, legStrikesLanded: 0,
    takedownsAttempted: 0, takedownsLanded: 0, submissionAttempts: 0,
    reversals: 0, knockdowns: 0, controlSeconds: 0, damageGiven: 0, damageTaken: 0
  };
  for (const row of roundStats) {
    const stats = row[side];
    total.totalStrikesAttempted += stats.totalStrikesAttempted;
    total.totalStrikesLanded += stats.totalStrikesLanded;
    total.significantStrikesAttempted += stats.significantStrikesAttempted;
    total.significantStrikesLanded += stats.significantStrikesLanded;
    total.headStrikesLanded += stats.headStrikesLanded;
    total.bodyStrikesLanded += stats.bodyStrikesLanded;
    total.legStrikesLanded += stats.legStrikesLanded;
    total.takedownsAttempted += stats.takedownsAttempted;
    total.takedownsLanded += stats.takedownsLanded;
    total.submissionAttempts += stats.submissionAttempts;
    total.reversals += stats.reversals;
    total.knockdowns += stats.knockdowns;
    total.controlSeconds += stats.controlSeconds;
    total.damageGiven += stats.damageGiven;
    total.damageTaken += stats.damageTaken;
  }
  return total;
}

function buildIndexedFight(fight: FightArchiveItem): IndexedFight {
  return {
    id: fight.id,
    date: fight.date,
    eventId: fight.eventId,
    eventName: fight.eventName,
    promotionId: fight.promotionId ?? null,
    scope: fight.scope ?? 'promotion',
    weightClass: fight.weightClass,
    redFighterId: fight.redFighterId,
    blueFighterId: fight.blueFighterId,
    winnerId: fight.winnerId,
    method: fight.method,
    round: fight.round,
    time: fight.time,
    elapsedSeconds: getFightElapsedSeconds(fight.round, fight.time),
    isTitleFight: fight.isTitleFight,
    titleChangeInfo: fight.titleChangeInfo,
    performanceRating: fight.performanceRating,
    tournamentId: fight.tournamentId,
    tournamentRound: fight.tournamentRound,
    redStats: sideStats(fight.roundStats, 'red'),
    blueStats: sideStats(fight.roundStats, 'blue'),
    statsRounds: fight.roundStats?.length ?? 0,
    compensation: fight.compensation?.map(item => ({ ...item }))
  };
}

function resultFor(fight: IndexedFight, fighterId: string): 'win' | 'loss' | 'draw' {
  return fight.winnerId === null ? 'draw' : fight.winnerId === fighterId ? 'win' : 'loss';
}

function perFightRow(fight: IndexedFight, fighterId: string): FighterFightStatisticsRow {
  const isRed = fight.redFighterId === fighterId;
  const opponentId = isRed ? fight.blueFighterId : fight.redFighterId;
  const stats = isRed ? fight.redStats : fight.blueStats;
  const payout = fight.compensation?.find(item => item.fighterId === fighterId)?.total ?? null;
  return {
    id: fight.id,
    date: fight.date,
    eventId: fight.eventId,
    eventName: fight.eventName,
    opponentId,
    result: resultFor(fight, fighterId),
    method: fight.method,
    round: fight.round,
    time: fight.time,
    elapsedSeconds: fight.elapsedSeconds,
    performanceRating: fight.performanceRating,
    payout,
    totalStrikesLanded: stats?.totalStrikesLanded ?? null,
    totalStrikesAttempted: stats?.totalStrikesAttempted ?? null,
    significantStrikesLanded: stats?.significantStrikesLanded ?? null,
    significantStrikesAttempted: stats?.significantStrikesAttempted ?? null,
    takedownsLanded: stats?.takedownsLanded ?? null,
    takedownsAttempted: stats?.takedownsAttempted ?? null,
    controlSeconds: stats?.controlSeconds ?? null,
    knockdowns: stats?.knockdowns ?? null,
    weightClass: fight.weightClass,
    promotionId: fight.promotionId,
    scope: fight.scope,
    isTitleFight: fight.isTitleFight
  };
}

function addTechnical(target: FighterTechnicalTotals, source: IndexedFightSide, rounds: number, elapsedSeconds: number): void {
  target.fightsWithStats++;
  target.rounds += rounds;
  target.recordedSeconds += elapsedSeconds;
  target.totalStrikesAttempted += source.totalStrikesAttempted;
  target.totalStrikesLanded += source.totalStrikesLanded;
  target.significantStrikesAttempted += source.significantStrikesAttempted;
  target.significantStrikesLanded += source.significantStrikesLanded;
  target.headStrikesLanded += source.headStrikesLanded;
  target.bodyStrikesLanded += source.bodyStrikesLanded;
  target.legStrikesLanded += source.legStrikesLanded;
  target.takedownsAttempted += source.takedownsAttempted;
  target.takedownsLanded += source.takedownsLanded;
  target.submissionAttempts += source.submissionAttempts;
  target.reversals += source.reversals;
  target.knockdowns += source.knockdowns;
  target.controlSeconds += source.controlSeconds;
  target.damageGiven += source.damageGiven;
  target.damageTaken += source.damageTaken;
}

function emptyFighterStatistics(fighterId: string): FighterStatistics {
  return {
    fighterId, fights: 0, wins: 0, losses: 0, draws: 0,
    koWins: 0, submissionWins: 0, decisionWins: 0,
    currentWinStreak: 0, longestWinStreak: 0,
    titleFights: 0, titleWins: 0, titleDefenses: 0,
    trackedEarnings: 0, trackedFightCount: 0,
    technical: emptyTechnical(), perFight: [], rankingHistory: []
  };
}

function buildFighterStatistics(fighterId: string, fights: IndexedFight[], titles: IndexedTitleReign[], rankingHistory: FighterRankingChange[]): FighterStatistics {
  const result = emptyFighterStatistics(fighterId);
  const rows = fights.filter(fight => fight.redFighterId === fighterId || fight.blueFighterId === fighterId).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  let streak = 0;
  for (const fight of rows) {
    const outcome = resultFor(fight, fighterId);
    result.fights++;
    result[outcome === 'win' ? 'wins' : outcome === 'loss' ? 'losses' : 'draws']++;
    if (outcome === 'win') {
      streak++;
      result.longestWinStreak = Math.max(result.longestWinStreak, streak);
      if (fight.method === 'KO/TKO' || fight.method === 'Doctor Stoppage' || fight.method === 'Corner Stoppage') result.koWins++;
      else if (fight.method === 'Submission') result.submissionWins++;
      else if (fight.method.includes('Decision')) result.decisionWins++;
    } else {
      streak = 0;
    }
    if (fight.isTitleFight) result.titleFights++;
    if (fight.titleChangeInfo && fight.titleChangeInfo.type !== 'title_defense' && fight.titleChangeInfo.type !== 'interim_defense' && fight.titleChangeInfo.type !== 'no_change' && fight.winnerId === fighterId) result.titleWins++;
    const row = perFightRow(fight, fighterId);
    result.perFight.push(row);
    if (row.payout !== null) {
      result.trackedEarnings += row.payout;
      result.trackedFightCount++;
    }
    const stats = fight.redFighterId === fighterId ? fight.redStats : fight.blueStats;
    if (stats) addTechnical(result.technical, stats, fight.statsRounds, fight.elapsedSeconds);
  }
  result.currentWinStreak = streak;
  result.titleDefenses = titles.filter(title => title.fighterId === fighterId).reduce((sum, title) => sum + title.defenses, 0);
  result.rankingHistory = rankingHistory.filter(item => item.fighterId === fighterId).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  result.perFight.reverse();
  return result;
}

interface StatisticsSources {
  fighters: GameState['fighters'];
  promotions: GameState['promotions'];
  fightArchive: GameState['fightArchive'];
  eventArchive: GameState['eventArchive'];
  titleHistory: GameState['titleHistory'];
  tournaments: GameState['tournaments'];
  promotionEconomies: GameState['promotionEconomies'];
  fighterRankingHistory: GameState['fighterRankingHistory'];
}

let cachedSources: StatisticsSources | undefined;
let cachedIndex: StatisticsIndex | undefined;

function sameSources(a: StatisticsSources | undefined, b: StatisticsSources): boolean {
  return !!a && Object.keys(b).every(key => a[key as keyof StatisticsSources] === b[key as keyof StatisticsSources]);
}

export function getStatisticsIndex(state: GameState): StatisticsIndex {
  const sources: StatisticsSources = {
    fighters: state.fighters,
    promotions: state.promotions,
    fightArchive: state.fightArchive,
    eventArchive: state.eventArchive,
    titleHistory: state.titleHistory,
    tournaments: state.tournaments,
    promotionEconomies: state.promotionEconomies,
    fighterRankingHistory: state.fighterRankingHistory
  };
  if (cachedIndex && sameSources(cachedSources, sources)) return cachedIndex;
  const fights = Object.values(state.fightArchive).map(buildIndexedFight).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const fighterStats = new Map<string, FighterStatistics>();
  for (const fighterId of Object.keys(state.fighters)) fighterStats.set(fighterId, buildFighterStatistics(fighterId, fights, state.titleHistory, state.fighterRankingHistory));
  const years = [...new Set(fights.map(fight => Number(fight.date.slice(0, 4))).filter(Number.isFinite))].sort((a, b) => a - b);
  const promotions = new Map(Object.values(state.promotions).map(promotion => [promotion.id, { ...promotion, economy: state.promotionEconomies[promotion.id] }]));
  cachedSources = sources;
  cachedIndex = {
    fighters: fighterStats,
    fights,
    events: Object.values(state.eventArchive).map(event => ({ ...event })),
    promotions,
    titles: state.titleHistory.map(title => ({ ...title })),
    tournaments: Object.values(state.tournaments).map(tournament => ({ ...tournament })),
    years
  };
  return cachedIndex;
}

export function getFighterStatistics(state: GameState, fighterId: string): FighterStatistics {
  return getStatisticsIndex(state).fighters.get(fighterId) ?? emptyFighterStatistics(fighterId);
}

function inPeriod(date: string, period: StatisticsPeriod, currentDate: string): boolean {
  if (date > currentDate) return false;
  if (period.kind === 'all-time') return true;
  const year = period.kind === 'current-season' ? new Date(currentDate).getFullYear() : period.year;
  return date >= `${year}-01-01` && date <= `${year}-12-31`;
}

function promotionAtFight(fight: IndexedFight, fighterId: string): string | null {
  return fight.compensation?.find(item => item.fighterId === fighterId)?.promotionIdAtFight ?? null;
}

function fightMatchesScope(fight: IndexedFight, scope: StatisticsScope, fighterId?: string): boolean {
  if (scope.kind === 'world') return true;
  if (scope.kind === 'international') return fight.scope === 'international';
  if (fight.scope === 'international') return false;
  return fighterId ? promotionAtFight(fight, fighterId) === scope.promotionId : fight.compensation?.some(item => item.promotionIdAtFight === scope.promotionId) === true;
}

function fighterMatchesFight(fight: IndexedFight, fighterId: string, scope: StatisticsScope): boolean {
  return (fight.redFighterId === fighterId || fight.blueFighterId === fighterId) && fightMatchesScope(fight, scope, fighterId);
}

function finish(method: string): boolean {
  return method === 'KO/TKO' || method === 'Submission' || method === 'Doctor Stoppage' || method === 'Corner Stoppage';
}

function fighterName(state: GameState, fighterId: string): string {
  const fighter = state.fighters[fighterId];
  return fighter ? `${fighter.firstName} ${fighter.lastName}` : fighterId;
}

function sortLeaders(rows: FighterLeaderRow[], direction: 'asc' | 'desc' = 'desc'): FighterLeaderRow[] {
  return rows.sort((a, b) => direction === 'asc' ? a.value - b.value : b.value - a.value || b.sampleSize - a.sampleSize || a.fighterName.localeCompare(b.fighterName) || a.id.localeCompare(b.id));
}

function buildFighterLeaders(state: GameState, fights: IndexedFight[], scope: StatisticsScope): StatsBoardData['fighterLeaders'] {
  const buckets: Array<{ fighterId: string; weightClass: WeightClass; stats: FighterStatistics }> = [];
  for (const fighterId of Object.keys(state.fighters)) {
    const byDivision = new Map<WeightClass, IndexedFight[]>();
    for (const fight of fights.filter(item => fighterMatchesFight(item, fighterId, scope))) byDivision.set(fight.weightClass, [...(byDivision.get(fight.weightClass) ?? []), fight]);
    for (const [weightClass, fighterFights] of byDivision) {
      const stats = buildFighterStatistics(fighterId, fighterFights, [], []);
      stats.titleDefenses = fighterFights.filter(fight => fight.winnerId === fighterId && (fight.titleChangeInfo?.type === 'title_defense' || fight.titleChangeInfo?.type === 'interim_defense')).length;
      buckets.push({ fighterId, weightClass, stats });
    }
  }
  const leader = (bucket: typeof buckets[number], suffix: string, value: number): FighterLeaderRow => ({ id: `${bucket.fighterId}-${bucket.weightClass}-${suffix}`, fighterId: bucket.fighterId, fighterName: fighterName(state, bucket.fighterId), weightClass: bucket.weightClass, value, sampleSize: bucket.stats.fights });
  const rows = (suffix: string, metric: (stats: FighterStatistics) => number): FighterLeaderRow[] => sortLeaders(buckets.flatMap(bucket => metric(bucket.stats) > 0 ? [leader(bucket, suffix, metric(bucket.stats))] : []));
  const percentage = (numerator: (stats: FighterStatistics) => number): FighterLeaderRow[] => sortLeaders(buckets.filter(bucket => bucket.stats.fights >= MIN_WIN_PERCENTAGE_FIGHTS).map(bucket => ({ ...leader(bucket, 'win-percentage', safeRatio(numerator(bucket.stats), bucket.stats.fights) ?? 0), numerator: numerator(bucket.stats), denominator: bucket.stats.fights })));
  const accuracy = (kind: 'strikes' | 'takedowns'): FighterLeaderRow[] => sortLeaders(buckets.flatMap(bucket => {
    const numerator = kind === 'strikes' ? bucket.stats.technical.significantStrikesLanded : bucket.stats.technical.takedownsLanded;
    const denominator = kind === 'strikes' ? bucket.stats.technical.significantStrikesAttempted : bucket.stats.technical.takedownsAttempted;
    return denominator < MIN_ACCURACY_ATTEMPTS ? [] : [{ ...leader(bucket, `${kind}-accuracy`, safeRatio(numerator, denominator) ?? 0), numerator, denominator, sampleSize: bucket.stats.technical.fightsWithStats }];
  }));
  return {
    wins: rows('wins', stats => stats.wins),
    winPercentage: percentage(stats => stats.wins),
    koWins: rows('ko-wins', stats => stats.koWins),
    submissionWins: rows('submission-wins', stats => stats.submissionWins),
    currentStreak: rows('current-streak', stats => stats.currentWinStreak),
    longestStreak: rows('longest-streak', stats => stats.longestWinStreak),
    titleDefenses: rows('title-defenses', stats => stats.titleDefenses),
    trackedEarnings: rows('tracked-earnings', stats => stats.trackedEarnings),
    strikingAccuracy: accuracy('strikes'),
    takedownAccuracy: accuracy('takedowns'),
    knockdowns: rows('knockdowns', stats => stats.technical.knockdowns),
    controlTime: rows('control-time', stats => stats.technical.controlSeconds)
  };
}

function buildFightRecords(fights: IndexedFight[]): FightRecordRow[] {
  const records: FightRecordRow[] = [];
  const add = (category: FightRecordCategory, fight: IndexedFight, value: number, sampleSize = 1) => records.push({ id: `${category}-${fight.id}`, category, fightId: fight.id, eventId: fight.eventId, eventName: fight.eventName, date: fight.date, promotionId: fight.promotionId, scope: fight.scope, weightClass: fight.weightClass, redFighterId: fight.redFighterId, blueFighterId: fight.blueFighterId, winnerId: fight.winnerId, method: fight.method, round: fight.round, time: fight.time, elapsedSeconds: fight.elapsedSeconds, value, sampleSize });
  for (const fight of fights) {
    add('rating', fight, fight.performanceRating);
    if (finish(fight.method) && fight.elapsedSeconds > 0) add('fastestFinish', fight, fight.elapsedSeconds);
    if (fight.elapsedSeconds > 0) add('longestFight', fight, fight.elapsedSeconds);
    if (fight.redStats && fight.blueStats) {
      add('knockdowns', fight, fight.redStats.knockdowns + fight.blueStats.knockdowns, fight.statsRounds);
      add('significantStrikes', fight, fight.redStats.significantStrikesLanded + fight.blueStats.significantStrikesLanded, fight.statsRounds);
      add('takedowns', fight, fight.redStats.takedownsLanded + fight.blueStats.takedownsLanded, fight.statsRounds);
      add('controlTime', fight, fight.redStats.controlSeconds + fight.blueStats.controlSeconds, fight.statsRounds);
    }
  }
  return records.sort((a, b) => a.category.localeCompare(b.category) || (a.category === 'fastestFinish' ? a.value - b.value : b.value - a.value) || b.sampleSize - a.sampleSize || a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

function buildEventRows(state: GameState, index: StatisticsIndex, filter: StatisticsFilter, fights: IndexedFight[]): EventStatisticsRow[] {
  const rows: EventStatisticsRow[] = [];
  for (const event of index.events) {
    if (!inPeriod(event.date, filter.period, state.currentDate)) continue;
    if (filter.scope.kind === 'international' && event.scope !== 'international') continue;
    if (filter.scope.kind === 'promotion' && (event.scope === 'international' || event.promotionId !== filter.scope.promotionId)) continue;
    const eventFights = fights.filter(fight => fight.eventId === event.id && (filter.weightClass === 'all' || fight.weightClass === filter.weightClass));
    if (!eventFights.length) continue;
    const finishes = eventFights.filter(fight => finish(fight.method)).length;
    rows.push({ id: event.id, eventId: event.id, eventName: event.name, date: event.date, promotionId: event.promotionId ?? null, promotionName: event.promotionId ? state.promotions[event.promotionId]?.name ?? null : null, scope: event.scope ?? 'promotion', attendance: event.attendance, revenue: event.scope === 'international' && event.revenue === 0 ? null : event.revenue, cost: event.scope === 'international' && event.cost === 0 ? null : event.cost, profit: event.scope === 'international' && event.profit === 0 ? null : event.profit, fanReaction: event.fanReaction, fightCount: eventFights.length, finishes, finishRate: safeRatio(finishes, eventFights.length), titleFightCount: eventFights.filter(fight => fight.isTitleFight).length, fighterBasePay: event.fighterBasePay ?? 0, fighterWinBonuses: event.fighterWinBonuses ?? 0 });
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

function buildPromotionRows(state: GameState, index: StatisticsIndex, filter: StatisticsFilter, fights: IndexedFight[], events: EventStatisticsRow[]): PromotionStatisticsRow[] {
  return Object.values(state.promotions).filter(promotion => filter.scope.kind === 'world' || (filter.scope.kind === 'promotion' && filter.scope.promotionId === promotion.id)).map(promotion => {
    const promotionFights = fights.filter(fight => fight.scope !== 'international' && (promotionAtFight(fight, fight.redFighterId) === promotion.id || promotionAtFight(fight, fight.blueFighterId) === promotion.id));
    const promotionEvents = events.filter(event => event.promotionId === promotion.id);
    const ledger = index.promotions.get(promotion.id)?.economy?.ledger ?? [];
    const flow = (categories: string[]) => ledger.filter(entry => inPeriod(entry.date, filter.period, state.currentDate) && categories.includes(entry.category)).reduce((sum, entry) => sum + entry.amount, 0);
    return { id: promotion.id, promotionId: promotion.id, promotionName: promotion.name, eventCount: promotionEvents.length, fightAppearances: promotionFights.reduce((sum, fight) => sum + Number(promotionAtFight(fight, fight.redFighterId) === promotion.id) + Number(promotionAtFight(fight, fight.blueFighterId) === promotion.id), 0), wins: promotionFights.reduce((sum, fight) => sum + (promotionAtFight(fight, fight.winnerId ?? '') === promotion.id ? 1 : 0), 0), losses: promotionFights.reduce((sum, fight) => sum + (fight.winnerId && promotionAtFight(fight, fight.winnerId === fight.redFighterId ? fight.blueFighterId : fight.redFighterId) === promotion.id ? 1 : 0), 0), draws: promotionFights.filter(fight => fight.winnerId === null && (promotionAtFight(fight, fight.redFighterId) === promotion.id || promotionAtFight(fight, fight.blueFighterId) === promotion.id)).length, titleWins: promotionFights.filter(fight => fight.winnerId && fight.isTitleFight && fight.titleChangeInfo && fight.titleChangeInfo.type !== 'title_defense' && fight.titleChangeInfo.type !== 'interim_defense' && promotionAtFight(fight, fight.winnerId) === promotion.id).length, titleDefenses: promotionFights.filter(fight => fight.isTitleFight && (fight.titleChangeInfo?.type === 'title_defense' || fight.titleChangeInfo?.type === 'interim_defense') && (promotionAtFight(fight, fight.redFighterId) === promotion.id || promotionAtFight(fight, fight.blueFighterId) === promotion.id)).length, eventRevenue: promotionEvents.reduce((sum, event) => sum + (event.revenue ?? 0), 0), eventCost: promotionEvents.reduce((sum, event) => sum + (event.cost ?? 0), 0), eventProfit: promotionEvents.reduce((sum, event) => sum + (event.profit ?? 0), 0), sponsorMediaIncome: flow(['monthly_sponsor', 'monthly_media', 'event_sponsor', 'event_media']), fighterPay: promotionEvents.reduce((sum, event) => sum + event.fighterBasePay + event.fighterWinBonuses, 0), contractSpending: Math.abs(flow(['roster_retainer', 'transfer_fee'])), currentLiabilities: state.promotionEconomies[promotion.id]?.outstandingLiabilities ?? 0, snapshot: true };
  });
}

function buildTitleRows(state: GameState, index: StatisticsIndex, filter: StatisticsFilter): TitleStatisticsRow[] {
  return index.titles.filter(title => inPeriod(title.dateWon, filter.period, state.currentDate) || (title.dateLost ? inPeriod(title.dateLost, filter.period, state.currentDate) : title.dateWon <= state.currentDate)).filter(title => filter.weightClass === 'all' || title.weightClass === filter.weightClass).filter(title => filter.scope.kind === 'world' || (filter.scope.kind === 'international' ? title.scope === 'international' : title.scope !== 'international' && title.promotionId === filter.scope.promotionId)).map(title => {
    const end = title.dateLost && title.dateLost < state.currentDate ? title.dateLost : state.currentDate;
    const days = Math.max(0, differenceInCalendarDays(new Date(end), new Date(title.dateWon)));
    return { id: title.id, fighterId: title.fighterId, fighterName: fighterName(state, title.fighterId), promotionId: title.promotionId ?? null, promotionName: title.promotionId ? state.promotions[title.promotionId]?.name ?? null : null, scope: title.scope ?? 'promotion', weightClass: title.weightClass, beltType: title.beltType, dateWon: title.dateWon, dateLost: title.dateLost, status: title.status, reignDays: days, defenses: title.defenses, titleWins: 1, value: days };
  }).sort((a, b) => b.value - a.value || a.id.localeCompare(b.id));
}

function buildTournamentRows(state: GameState, index: StatisticsIndex, filter: StatisticsFilter, fights: IndexedFight[]): TournamentStatisticsRow[] {
  return index.tournaments.filter(tournament => inPeriod(tournament.completedDate ?? tournament.startDate ?? tournament.createdDate, filter.period, state.currentDate)).filter(tournament => filter.weightClass === 'all' || tournament.weightClass === filter.weightClass).filter(tournament => filter.scope.kind === 'world' || (filter.scope.kind === 'international' ? tournament.scope === 'international' : tournament.scope !== 'international' && tournament.promotionId === filter.scope.promotionId)).map(tournament => {
    const type: TournamentStatisticsRow['type'] = tournament.internationalTier ?? 'domestic_gp';
    const linked = tournament.fights.flatMap(slot => slot.fightArchiveId ? fights.filter(fight => fight.id === slot.fightArchiveId) : []);
    const finishes = linked.filter(fight => finish(fight.method)).length;
    return { id: tournament.id, tournamentId: tournament.id, tournamentName: tournament.name, winnerId: tournament.winnerId ?? null, promotionId: tournament.promotionId ?? null, promotionName: tournament.promotionId ? state.promotions[tournament.promotionId]?.name ?? null : null, scope: tournament.scope ?? 'promotion', type, weightClass: tournament.weightClass, appearances: tournament.participants.length, championships: tournament.winnerId ? 1 : 0, fightCount: linked.length, finishes, finishRate: safeRatio(finishes, linked.length), averageRating: linked.length ? linked.reduce((sum, fight) => sum + fight.performanceRating, 0) / linked.length : null, value: linked.length ? linked.reduce((sum, fight) => sum + fight.performanceRating, 0) / linked.length : null };
  }).sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity) || a.id.localeCompare(b.id));
}

export function getStatsBoard(state: GameState, filter: StatisticsFilter): StatsBoardData {
  const index = getStatisticsIndex(state);
  const filteredFights = index.fights.filter(fight => inPeriod(fight.date, filter.period, state.currentDate) && (filter.weightClass === 'all' || fight.weightClass === filter.weightClass) && fightMatchesScope(fight, filter.scope));
  const events = buildEventRows(state, index, filter, filteredFights);
  return { years: index.years, fighterLeaders: buildFighterLeaders(state, filteredFights, filter.scope), fightRecords: buildFightRecords(filteredFights), events, promotions: buildPromotionRows(state, index, filter, filteredFights, events), titles: buildTitleRows(state, index, filter), tournaments: buildTournamentRows(state, index, filter, filteredFights) };
}
