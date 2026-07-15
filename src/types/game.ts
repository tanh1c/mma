export type WeightClass = 'Bantamweight' | 'Featherweight' | 'Lightweight' | 'Welterweight' | 'Middleweight' | 'Heavyweight';

export type FighterStyle = 'Boxer' | 'Wrestler' | 'BJJ' | 'Kickboxer' | 'Muay Thai' | 'Sambo' | 'Balanced';

export interface FighterAttributes {
  striking: number;
  grappling: number;
  wrestling: number;
  submissions: number;
  cardio: number;
  chin: number;
  power: number;
  speed: number;
  defense: number;
  fightIq: number;
  toughness: number;
}

export interface FighterRecord {
  wins: number;
  losses: number;
  draws: number;
  kos: number;
  subs: number;
}

export interface ContractCounterOffer {
  payPerFight: number;
  winBonus: number;
  fights: number;
  expiresDate: string;
  interest: number;
}

export interface Contract {
  fightsRemaining: number;
  payPerFight: number;
  winBonus: number;
  exclusivity: boolean;
  endDate: string;
  lastNegotiationDate?: string;
  counterOffer?: ContractCounterOffer;
}

export type FightCampFocus = 'balanced' | 'striking' | 'wrestling' | 'cardio' | 'recovery';

export interface Injury {
  id: string;
  type: string;
  daysRemaining: number;
}

export interface Storyline {
  id: string;
  type: string; // e.g. 'Rivalry', 'Comeback', 'Title Run'
  fighterIds: string[];
  description: string;
  isActive: boolean;
  intensity?: number;
  createdDate?: string;
  expiresDate?: string;
  resolvedDate?: string;
}

export interface MedicalSuspension {
  id: string;
  fighterId?: string;
  reason: 'knockout' | 'tko' | 'hard_fight' | 'cut' | 'submission_damage' | 'doctor_stoppage' | 'commission_review';
  daysRemaining: number;
  sourceFightId?: string;
  sourceEventId?: string;
  severity: 'minor' | 'moderate' | 'severe';
}

export interface Fighter {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string;
  age: number;
  nationality: string;
  weightClass: WeightClass;
  heightCm: number;
  fightWeightLb: number;
  walkAroundWeightLb: number;
  style: FighterStyle;
  attributes: FighterAttributes;
  record: FighterRecord;
  popularity: number; // 0-100
  marketability: number; // 0-100
  potential: number; // 0-100
  morale: number; // 0-100
  momentum: number; // 0-100
  fatigue: number; // 0-100
  injuryStatus: Injury | null; // null if healthy
  medicalSuspension?: MedicalSuspension | null;
  contract: Contract | null; // null if free agent
  counterOffer?: ContractCounterOffer;
  isChampion: boolean;
  titleDefenses?: number;
  rankingScore?: number; // Elo-like score for stable rankings
  history: string[]; // brief fight history/results strings
  lastFightDate: string | null;
  titleShotPromised?: boolean;
}

export interface Promotion {
  id: string;
  name: string;
  shortName: string;
  money: number;
  reputation: number; // 0-100
  fanbase: number;
}

export interface NewsItem {
  id: string;
  date: string;
  title: string;
  content: string;
  type: 'general' | 'injury' | 'contract' | 'event' | 'fight';
}

export type SocialFeedKind = 'news' | 'article' | 'fighter_post' | 'promotion_post' | 'thread';
export type SocialAuthorType = 'media' | 'fighter' | 'promotion' | 'fan';

export interface SocialReply {
  id: string;
  authorType: SocialAuthorType;
  authorName: string;
  authorFighterId?: string;
  body: string;
}

export interface SocialFeedItem {
  id: string;
  stableKey: string;
  date: string;
  kind: SocialFeedKind;
  headline: string;
  body: string;
  authorType: SocialAuthorType;
  authorName: string;
  authorFighterId?: string;
  fighterIds: string[];
  eventId?: string;
  fightId?: string;
  storylineId?: string;
  engagement: { likes: number; comments: number; shares: number };
  replies?: SocialReply[];
  actionKey?: string;
}

export interface FightMatchup {
  id: string;
  redCornerId: string; // usually higher ranked or champion
  blueCornerId: string;
  weightClass: WeightClass;
  isTitleFight: boolean;
  titleFightType?: 'undisputed' | 'interim' | 'vacant_undisputed' | 'unification';
  rounds: number; // 3 or 5
  result?: FightResult;
  tournamentId?: string;
  tournamentRound?: TournamentRound;
  tournamentFightSlotId?: string;
  campFocus?: FightCampFocus;
  socialHype?: number;
}

export interface FighterRoundStats {
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

  staminaStart: number;
  staminaEnd: number;
}

export interface JudgeRoundScore {
  judgeId: string;
  redScore: 10 | 9 | 8;
  blueScore: 10 | 9 | 8;
  reason:
    | 'damage'
    | 'control'
    | 'knockdown'
    | 'submission-threat'
    | 'activity'
    | 'close-round';
}

export interface RoundStats {
  round: number;

  red: FighterRoundStats;
  blue: FighterRoundStats;

  judges: JudgeRoundScore[];

  redTechnicalScore: number;
  blueTechnicalScore: number;

  summary: string;
  keyMoments: string[];
  dominanceLevel?: 'close' | 'clear' | 'dominant' | 'near_finish';
}

export interface FightResult {
  winnerId: string | null; // null if draw
  loserId: string | null;
  method: 'KO/TKO' | 'Submission' | 'Unanimous Decision' | 'Split Decision' | 'Majority Decision' | 'Draw' | 'Doctor Stoppage' | 'Corner Stoppage';
  round: number;
  time: string; // e.g., "3:42"
  commentary: string[];
  performanceRating: number; // 0-100, hype generated
  scorecards?: string[];
  roundStats?: RoundStats[];
  injuries?: { fighterId: string; type: string; daysRemaining: number }[];
  medicalSuspensions?: MedicalSuspension[];
  popularityDelta?: Record<string, number>;
  moraleDelta?: Record<string, number>;
  momentumDelta?: Record<string, number>;
  titleChangeInfo?: {
    type: 'new_champion' | 'title_defense' | 'vacant_title_won' | 'interim_won' | 'interim_defense' | 'unified' | 'no_change';
    previousChampionId?: string | null;
  };
}

export interface FightArchiveItem {
  id: string;
  date: string;
  eventId: string;
  eventName: string;
  weightClass: WeightClass;
  redFighterId: string;
  blueFighterId: string;
  winnerId: string | null;
  method: string;
  round: number;
  time: string;
  isTitleFight: boolean;
  titleFightType?: 'undisputed' | 'interim' | 'vacant_undisputed' | 'unification';
  tournamentId?: string;
  tournamentRound?: TournamentRound;
  performanceRating: number;
  scorecards?: string[];
  roundStats?: RoundStats[];
  commentary?: string[];
  injuries?: { fighterId: string; type: string; daysRemaining: number }[];
  medicalSuspensions?: MedicalSuspension[];
  titleChangeInfo?: {
    type: 'new_champion' | 'title_defense' | 'vacant_title_won' | 'interim_won' | 'interim_defense' | 'unified' | 'no_change';
    previousChampionId?: string | null;
  };
  redRecordAfter?: string;
  blueRecordAfter?: string;
}

export interface EventArchiveItem {
  id: string;
  name: string;
  date: string;
  attendance: number;
  revenue: number;
  cost: number;
  profit: number;
  fanReaction: number;
  fightIds: string[];
  gateRevenue?: number;
  broadcastRevenue?: number;
  venueCost?: number;
  marketingCost?: number;
  fighterBasePay?: number;
  fighterWinBonuses?: number;
  gpBonusRevenue?: number;
}

export interface TitleHistoryItem {
  id: string;
  weightClass: WeightClass;
  fighterId: string;
  dateWon: string;
  dateLost: string | null;
  defenses: number;
  wonFromFighterId: string | null;
  lostToFighterId?: string | null;
  status: 'active' | 'vacated' | 'lost' | 'unified' | 'cleared';
  beltType?: 'undisputed' | 'interim';
  winEventId?: string;
  lossEventId?: string;
  note?: string;
}

export interface Event {
  id: string;
  name: string;
  date: string; // e.g., YYYY-MM-DD
  venueId: string;
  ticketPrice: number;
  marketingSpend: number;
  fights: FightMatchup[];
  isCompleted: boolean;
  results?: EventResults;
}

export interface EventResults {
  attendance: number;
  gateRevenue: number;
  broadcastRevenue: number;
  fighterBasePay: number;
  fighterWinBonuses: number;
  venueCost: number;
  marketingCost: number;
  totalRevenue: number;
  totalCost: number;
  profit: number;
  fanReaction: number;
  rankingChanges?: Record<string, { oldRank: number; newRank: number }>;
  titleChanges?: { 
    fighterId: string; 
    weightClass: string; 
    type: 'new_champion' | 'title_defense' | 'vacant_title_won' | 'interim_won' | 'interim_defense' | 'unified' | 'no_change';
    previousChampionId?: string | null;
  }[];
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  capacity: number;
  cost: number;
}

export interface RankingItem {
  fighterId: string;
  rank: number; // 0 is champion, 1-15 contenders
  trend: number; // +1, -2, etc.
}

export interface AutopilotSummary {
  daysSimulated: number;
  calendarStartDate: string;
  calendarEndDate: string;
  eventsCreated: number;
  eventsCompleted: number;
  fightsSimulated: number;
  moneyChange: number;
  reputationChange: number;
  newChampions: number;
  titleDefenses: number;
  bookingDelays: number;
  ownerCashInjections: number;
  emergencyModeTriggered: number;
  highlights?: {
    bestFightId?: string;
    biggestUpsetId?: string;
    newUndisputedChampions: number;
    newInterimChampions: number;
    unifications: number;
    majorInjuries: number;
    biggestProfit: number;
    worstLoss: number;
    awardsGenerated: boolean;
  };
}

export interface BeltInfo {
  id: string;
  name: string;
  shortName: string;
  weightClass: WeightClass;
  type: 'undisputed';
  prestige: number;
}

export type BeltStatus =
  | 'active'
  | 'vacant'
  | 'inactive_champion'
  | 'interim_active'
  | 'unification_needed';

export interface WeightClassTitleState {
  weightClass: WeightClass;
  
  undisputedChampionId: string | null;
  undisputedDefenses: number;
  lastUndisputedDefenseDate?: string | null;
  
  interimChampionId?: string | null;
  interimDefenses?: number;
  interimCreatedDate?: string | null;
  lastInterimDefenseDate?: string | null;
  
  status?: BeltStatus;
}

export interface YearlyAwardSet {
  year: number;
  fighterOfTheYearId?: string;
  fightOfTheYearId?: string;
  koOfTheYearFightId?: string;
  submissionOfTheYearFightId?: string;
  upsetOfTheYearFightId?: string;
  prospectOfTheYearId?: string;
  eventOfTheYearId?: string;
}

export interface FinanceLedgerEntry {
  id: string;
  date: string;
  type:
    | 'event_revenue'
    | 'event_cost'
    | 'event_profit'
    | 'sponsor_monthly'
    | 'media_monthly'
    | 'sponsor_event_bonus'
    | 'media_event_bonus'
    | 'owner_injection'
    | 'contract_payment'
    | 'venue_cost'
    | 'marketing_cost'
    | 'other';
  amount: number;
  description: string;
  eventId?: string;
  fighterId?: string;
  dealId?: string;
  isSummary?: boolean;
  affectsCash?: boolean;
}

export interface SponsorDeal {
  id: string;
  name: string;
  tier: 'local' | 'regional' | 'national';
  monthlyIncome: number;
  bonusPerEvent?: number;
  bonusPerTitleFight?: number;
  expiresDate: string;
  reputationRequirement: number;
  isActive: boolean;
}

export interface MediaDeal {
  id: string;
  name: string;
  tier: 'local' | 'regional' | 'national';
  monthlyIncome: number;
  bonusPerEvent?: number;
  bonusForHighRatedEvent?: number;
  expiresDate: string;
  reputationRequirement: number;
  isActive: boolean;
}

export interface GameState {
  currentDate: string; // YYYY-MM-DD
  promotion: Promotion;
  fighters: Record<string, Fighter>;
  events: Record<string, Event>;
  venues: Record<string, Venue>;
  rankings: Record<WeightClass, RankingItem[]>;
  titles: Record<WeightClass, WeightClassTitleState>;
  belts: Record<string, BeltInfo>;
  news: NewsItem[];
  socialFeed: SocialFeedItem[];
  storylines: Storyline[];
  saveVersion: number;
  
  mode: 'manager' | 'observer';
  autopilot: {
    enabled: boolean;
    watchEvents: boolean;
    nextBookingAttemptDate?: string | null;
    targetTournamentWeightClass?: WeightClass | null;
  };
  lastAutopilotSummary?: AutopilotSummary | null;
  fightArchive: Record<string, FightArchiveItem>;
  eventArchive: Record<string, EventArchiveItem>;
  titleHistory: TitleHistoryItem[];
  yearlyAwards?: Record<number, YearlyAwardSet>;
  sponsorDeals?: SponsorDeal[];
  mediaDeals?: MediaDeal[];
  financeLedger?: FinanceLedgerEntry[];
  tournaments: Record<string, GrandPrixTournament>;
  seasonPlans?: Record<number, SeasonPlan>;
}

export type CalendarSlotType =
  | 'regular_event'
  | 'tentpole_event'
  | 'grand_prix_window'
  | 'grand_prix_round'
  | 'title_fight_card'
  | 'recovery_gap';

export type CalendarSlotStatus =
  | 'planned'
  | 'scheduled'
  | 'completed'
  | 'missed'
  | 'cancelled';

export interface SeasonCalendarSlot {
  id: string;
  year: number;
  date: string;
  type: CalendarSlotType;
  status: CalendarSlotStatus;
  targetWeightClass?: WeightClass;
  tournamentId?: string;
  tournamentRound?: TournamentRound;
  eventId?: string;
  priority: number;
  notes?: string[];
}

export interface SeasonPlan {
  year: number;
  createdDate: string;
  slots: SeasonCalendarSlot[];
  targetEvents: number;
  targetTentpoles: number;
  targetGrandPrix: number;
  status: 'active' | 'completed';
}

export type TournamentStatus =
  | 'planned'
  | 'active'
  | 'completed'
  | 'cancelled';

export type TournamentFormat = 'four_man' | 'eight_man';

export type TournamentRound =
  | 'quarterfinal'
  | 'semifinal'
  | 'final';

export interface TournamentParticipant {
  fighterId: string;
  seed: number;
  replacementForFighterId?: string;
}

export interface TournamentFightSlot {
  id: string;
  round: TournamentRound;
  fightId?: string;
  eventId?: string;
  redFighterId?: string;
  blueFighterId?: string;
  winnerId?: string | null;
  loserId?: string | null;
  isCompleted: boolean;
  fightArchiveId?: string;
}

export interface GrandPrixTournament {
  id: string;
  name: string;
  shortName: string;
  weightClass: WeightClass;
  status: TournamentStatus;
  format: TournamentFormat;
  createdDate: string;
  startDate?: string;
  completedDate?: string;
  participants: TournamentParticipant[];
  reserveFighterIds: string[];
  fights: TournamentFightSlot[];
  winnerId?: string | null;
  titleShotPromised?: boolean;
  titleShotUsed?: boolean;
  prestige: number;
  notes?: string[];
  finalDelayReason?: string | null;
  earliestFinalDate?: string | null;
  delayedFighterId?: string | null;
  semifinalCompletedDate?: string | null;
  recommendedFinalDate?: string | null;
  roundDelayReason?: string | null;
  delayedRound?: TournamentRound | null;
  earliestRoundDate?: string | null;
  quarterfinalCompletedDate?: string | null;
  recommendedSemifinalDate?: string | null;
  usedReserveFighterIds?: string[];
}

