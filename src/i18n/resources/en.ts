const en = {
  common: {
    save: 'Save',
    load: 'Load',
    export: 'Export',
    import: 'Import',
    back: 'Back',
    select: 'Select...',
    loading: 'Loading view...',
    newGame: 'New Game',
    newGameConfirm: 'Start new game? Unsaved progress will be lost.',
    language: 'Language',
    english: 'English',
    vietnamese: 'Vietnamese'
  },
  navigation: {
    promotion: 'Promotion',
    competition: 'Competition',
    records: 'Records',
    dashboard: 'Dashboard',
    inbox: 'Inbox',
    calendar: 'Calendar',
    bookEvent: 'Book Event',
    roster: 'Roster',
    freeAgents: 'Sign Fighters',
    rankings: 'Rankings',
    tournaments: 'Tournaments',
    socialHub: 'Social Hub',
    historyStats: 'History & Stats',
    mmaGuide: 'MMA Guide',
    debugSim: 'Debug Sim',
    settings: 'Settings'
  },
  shell: {
    gameNavigation: 'Game navigation',
    promotionControl: 'Promotion control',
    reputation: 'Reputation {{value}}',
    closeNavigation: 'Close navigation',
    openNavigation: 'Open navigation',
    advanceWeek: 'Advance week',
    advance: 'Advance'
  },
  search: {
    placeholder: 'Find fighter or event',
    label: 'Quick search',
    fighter: 'Fighter',
    event: 'Event'
  },
  settings: {
    eyebrow: 'Preferences',
    title: 'Settings',
    description: 'Display preferences apply across all saved games.',
    units: 'Units',
    unitsDescription: 'Choose how fighter height and weight are displayed.',
    metric: 'Metric',
    metricDescription: 'Centimetres and kilograms',
    imperial: 'US / Imperial',
    imperialDescription: 'Feet, inches, and pounds',
    languageDescription: 'Choose the language used throughout the application.',
    englishDescription: 'Use English interface and new game content.',
    vietnameseDescription: 'Use Vietnamese interface and new game content.'
  },
  dashboard: {
    fallbackPromotion: 'Your Promotion',
    managerMode: 'Manager mode', observerMode: 'Observer mode',
    stats: { funds: 'Funds', reputation: 'Reputation', fanbase: 'Fanbase', rosterSize: 'Roster size' },
    observer: {
      title: 'Autopilot / Observer Mode', description: 'The AI will automatically book events, sign free agents, renew contracts, and release fighters. Sit back and watch the MMA world evolve, or take control anytime.',
      week: 'Advance 1 Week', month: 'Advance 1 Month', sixMonths: 'Quick Sim 6 Months', watchLive: 'Watch Events Live', simulating: 'Simulating world...',
      summary: 'Simulation Summary ({{days}} days: {{start}} to {{end}})', eventsBooked: 'Events Booked', eventsRan: 'Events Ran', fightsSimmed: 'Fights Simmed', newChamps: 'New Champs', moneyChange: 'Money Change', reputationChange: 'Rep Change', bookingDelays: 'Booking Delays', emergencies: 'Emergencies', cashInjected: '{{count}}k injected', highlights: 'Notable Highlights', undisputedCrowned: '{{count}} New Undisputed Champions Crowned', interimWon: '{{count}} Interim Titles Won', unifications: '{{count}} Unification Fights Occurred', injuries: '{{count}} Major Injuries', biggestProfit: 'Biggest Event Profit: {{amount}}', awards: 'Yearly Awards were generated', checkHistory: 'Check History'
    },
    actions: { title: 'Action items', viewAll: 'View all' },
    nextEvent: { title: 'Next Event', simulate: 'Simulate', attendance: 'Est. Attendance', revenue: 'Est. Revenue', cost: 'Est. Cost', profit: 'Est. Profit', versus: 'vs', empty: 'No events booked.', book: 'Book Event' },
    pastEvents: { title: 'Past Events', fights: '{{count}} Fights', viewResults: 'View Results', empty: 'No past events yet.' },
    champions: { title: 'Current Champions', interim: 'Interim' },
    finance: {
      title: 'Finance & Deals', collapse: 'Collapse', expand: 'Expand', sponsorIncome: 'Sponsor Income', mediaIncome: 'Media Income', perMonth: '{{amount}}/mo', sponsors: 'Sponsors', mediaDeal: 'Media Deal', expired: 'Expired', eventBonus: 'Event Bonus: {{amount}}', expires: 'Expires in {{count}} days ({{date}})', renew: 'Renew', noSponsors: 'No active sponsor deals.', noMedia: 'No active media deals.', availableSponsors: 'Available Sponsors', availableMedia: 'Available Media Deals', requiredReputation: 'Req Rep: {{value}}', locked: 'Locked', signDeal: 'Sign Deal', ledger: 'Recent Ledger', noLedger: 'No ledger entries match this filter.', filters: { all: 'All', event: 'Event', deals: 'Deals', costs: 'Costs', income: 'Income' }
    },
    news: { title: 'Latest News', viewAll: 'View All News', types: { injury: 'Injury', contract: 'Contract', event: 'Event', fight: 'Fight', general: 'General' } }
  },
  eventBuilder: {
    eyebrow: 'Promotion operations', editTitle: 'Edit Event', bookTitle: 'Book Event', editDescription: 'Review the existing card, projections and logistics.', bookDescription: 'Build a card, review projections, then confirm the event.', completed: 'Event is already completed and cannot be edited.', back: 'Back',
    validation: { selectBoth: 'Select both fighters.', sameFighter: 'A fighter cannot fight themselves.', suspended: '{{name}} is medically suspended and cannot be booked.', contract: 'Both fighters need an active contract through the event date.', unification: 'A unification fight must involve both champions.', activeChampion: 'Cannot book a title fight without the active champion. Include the champion, or turn off Title Fight for {{belt}}.', interimChampion: 'The undisputed champion cannot fight for an interim title. Turn off Title Fight or wait for unification.', activeInterim: 'Cannot book an interim title fight without the active interim champion.', tournamentFight: 'This is a tournament fight. Cancel the tournament from the Tournaments page instead.', autoFill: 'No fights could be added automatically. Fighters may be injured, exhausted, unsigned, or unavailable.', oneFight: 'Add at least one fight.', eventName: 'Enter an event name.', everyContract: 'Every booked fighter needs an active contract through the event date.', cost: 'Estimated cost is {{cost}}, but you only have {{money}}. You may go into debt. Proceed?', warnings: 'You have {{count}} active warnings. Book this event anyway?' },
    details: { title: 'Event Details', eventName: 'Event Name', date: 'Date', venue: 'Venue', ticketPrice: 'Ticket Price (USD)', marketingSpend: 'Marketing Spend (USD)', capacity: '{{count}} capacity' },
    matchmaking: { title: 'Matchmaking', autoFill: 'Auto Fill', weightClass: 'Weight Class', search: 'Search fighter', searchLabel: 'Search fighters', allReadiness: 'All readiness', ready: 'Ready', tired: 'Tired', redCorner: 'Red Corner (Higher Rank)', blueCorner: 'Blue Corner', selectFighter: 'Select Fighter', versus: 'VS', comparison: 'Matchup comparison', advisory: 'Advisory estimate only. The actual fight simulation remains unpredictable.', recommended: 'Recommended matchups', quality: 'Match quality estimate based on ranking, popularity, rivalry, and readiness.', use: 'Use', titleFight: 'Title Fight', rounds: 'Rounds', addFight: 'Add fight to card' },
    camp: { balanced: 'Balanced', striking: 'Striking +3% · fatigue +5', wrestling: 'Wrestling +3% · fatigue +5', cardio: 'Cardio +4% · fatigue -5', recovery: 'Recovery · fatigue -10', label: 'Camp: {{value}}' },
    projections: { title: 'Event Projections', hype: 'Event Hype', attendance: 'Est. Attendance', revenue: 'Est. Revenue', profit: 'Est. Profit', warnings: 'Warnings ({{count}})', good: 'Card looks good!' },
    card: { heading: 'Fight Card ({{count}})', empty: 'No fights added yet.', emptyHint: 'Use the matchmaking panel to add bouts.', bout: 'Bout {{number}}', mainEvent: 'Main Event', coMain: 'Co-Main Event', mainCard: 'Main Card', prelims: 'Prelims', moveUp: 'Move {{slot}} up', moveDown: 'Move {{slot}} down', remove: 'Remove {{slot}}', rounds: '{{count}} RND', interim: 'INTERIM', unification: 'UNIFICATION', vacant: 'VACANT', title: 'TITLE', gpTitleShot: 'GP Title Shot', gpTitleShotHelp: 'Grand Prix winner is owed an undisputed title fight.', gpRoundHelp: 'A scheduled Grand Prix bracket stage.', gpQuarterfinal: 'GP Quarterfinal', gpSemifinal: 'GP Semifinal', gpFinal: 'GP Final', update: 'Update event', confirm: 'Confirm & book event' }
  },
  tournaments: {
    eyebrow: 'Competition format', title: 'Grand Prix Tournaments', description: 'Organize 4-man and 8-man elimination brackets to determine number one contenders.', create: 'Create Grand Prix', newTitle: 'New Grand Prix Tournament', close: 'Close tournament form', name: 'Tournament Name', weightClass: 'Weight Class', format: 'Format', fourMan: '4-Man Grand Prix', eightMan: '8-Man Grand Prix', titleShot: 'Promise Undisputed Title Shot', titleShotHelp: 'Grand Prix winner is owed an undisputed title fight.', selectParticipants: 'Select {{count}} Participants', selected: '{{selected}} / {{count}} Selected', eligibility: 'Only signed, healthy, unbooked fighters in this division are eligible. Seeded by ELO ranking score; OVR breaks ranking ties.', noEligible: 'No eligible fighters in the {{weightClass}} division. Sign new fighters or free up booked ones.', participant: 'Participant', reserve: 'Reserve ({{selected}}/{{count}})', cancel: 'Cancel', createTournament: 'Create Tournament', exactParticipants: 'Please select exactly {{count}} participants.', list: 'Tournament List', filters: { all: 'All', active: 'Active', completed: 'Completed', cancelled: 'Cancelled' }, noMatches: 'No tournaments found matching filter.', winner: 'Winner: {{name}}', created: 'Created: {{date}}', bracket: 'Bracket & Details', statusDivision: 'Status: {{status}} · Division: {{division}}', scheduleQuarterfinals: 'Schedule Quarterfinals', scheduleSemifinals: 'Schedule Semifinals', scheduleFinal: 'Schedule Final', cancelConfirm: 'Cancel this tournament? Scheduled fights will be removed.', cancelGp: 'Cancel GP', viewStats: 'View Fight Stats →', statsAfterEvent: 'Stats available after event.', quarterfinals: 'Quarterfinals', quarterfinal: 'Quarterfinal {{number}}', semifinals: 'Semifinals', semifinal: 'Semifinal Match {{number}}', final: 'Final', grandPrixFinal: 'Grand Prix Final', championshipFinal: 'Championship Final', linkedEvent: 'Linked Event', pending: 'TBD', replacementReserve: 'Reserve', gpStatus: 'GP status: {{status}}', earliestRetry: 'Earliest retry: {{date}}', scheduleRound: 'Schedule {{round}}', reserves: 'Reserve Fighters', noReserves: 'No reserves designated.', ready: 'Ready', titleShotPromised: 'Title Shot Promised', titleShotDescription: 'Winner earns a guaranteed undisputed title shot against the division champion.', history: 'Tournament History & Logs', selectPrompt: 'Select a tournament from the list or create a new one to view brackets and details.', scheduleTitle: 'Schedule {{round}}', scheduleDescription: 'Select an upcoming event to host these tournament fights. They will be appended to the event matchups.', noEvents: 'No upcoming events booked!', noEventsHint: 'Create an event using the Book Event menu first.', chooseEvent: 'Choose Event', selectEvent: '-- Select Event --', confirmScheduling: 'Confirm Scheduling', round: { quarterfinal: 'Quarterfinal Matches', semifinal: 'Semifinal Matches', final: 'Grand Prix Final' }
  },
  fighterDetail: {
    notFound: 'Fighter not found.', tabs: { overview: 'Overview', achievements: 'Achievements', storylines: 'Storylines', contract: 'Contract', fights: 'Fight Log', timeline: 'Timeline' }, sectionsLabel: 'Fighter detail sections', years: '{{count}} years', beltAlt: '{{weightClass}} {{type}} championship belt held by {{name}}', interimChampion: 'Interim Champion', undisputedChampion: 'Undisputed Champion', record: 'Record', style: 'Style', status: 'Status', physicalProfile: 'Physical Profile', height: 'Height', fightWeight: 'Fight Weight', walkAroundWeight: 'Walk-around Weight', weightCut: 'Weight Cut', attributes: 'Attributes', attribute: { striking: 'Striking', grappling: 'Grappling', wrestling: 'Wrestling', submissions: 'Submissions', cardio: 'Cardio', chin: 'Chin', power: 'Power', speed: 'Speed', defense: 'Defense', fightIq: 'Fight IQ', toughness: 'Toughness' }, careerSummary: 'Career Summary', titleFights: 'Title Fights', currentStreak: 'Current Streak', bestStreak: 'Best Streak', averagePerformance: 'Avg. Performance', koWins: 'KO/TKO Wins', submissionWins: 'Submission Wins', decisionWins: 'Decision Wins', decisionLosses: 'Decision Losses', fourManGp: '4-Man GP', eightManGp: '8-Man GP', gpFinals: 'GP Finals', gpRecord: 'GP Record', titleShot: 'Title Shot', pending: 'Pending', achievements: 'Achievements', achievementsDescription: 'Titles, Grand Prix results, annual awards, and promotion milestones.', noAchievements: 'No achievements yet. Win title fights, Grand Prix tournaments, or yearly awards to fill this section.', achievementCategory: { titles: 'Titles', grandPrix: 'Grand Prix', awards: 'Awards', milestones: 'Milestones' }, activeStorylines: 'Active Storylines', storylinesDescription: 'Rivalries, title narratives, disputes, and other live drama involving this fighter.', noStorylines: 'No active storylines.', intensity: 'Intensity {{value}}/3', started: 'Started {{date}}', active: 'Active', expires: 'Expires {{date}}', socialActivity: 'Social activity', socialDescription: 'News, articles, posts, and threads involving {{name}}.', noSocialActivity: 'No social activity yet.', contractExtension: 'Contract & Extension', negotiateContract: 'Negotiate Contract', release: 'Release Fighter', releaseConfirm: 'Are you sure you want to release {{name}}?', currentDeal: 'Current deal: {{pay}} to show, {{bonus}} to win', fightsRemaining: 'Fights remaining: {{count}} · Ends {{date}}', championExpired: 'Champion contract expired. Renew immediately or vacate the title.', offerAccepted: 'Offer Accepted', offerRejected: 'Offer Rejected', counterOffer: 'Counter-offer', counterOfferTerms: '{{pay}} to show · {{bonus}} to win · {{count}} fights · expires {{date}}', acceptCounter: 'Accept counter-offer', expected: 'Expected: {{pay}} to show · {{bonus}} to win · {{interest}}', payPerFight: 'Pay per Fight (USD)', winBonus: 'Win Bonus (USD)', fights: 'Fights', offerExtension: 'Offer Extension', offerContract: 'Offer Contract', respondCounter: 'Respond to the current counter-offer before making another offer.', fightLog: 'Fight Log', date: 'Date', event: 'Event', opponent: 'Opponent', result: 'Result', method: 'Method', round: 'Round', unknown: 'Unknown', draw: 'Draw', win: 'Win', loss: 'Loss', viewFight: 'View fight details against {{opponent}} on {{date}}', versus: 'vs. {{name}}', noFights: 'No archived fights yet.', legacyHistory: 'Legacy history', careerTimeline: 'Career Timeline', noTimeline: 'No career timeline entries yet.'
  },
  socialHub: {
    eyebrow: 'The fight world', title: 'Social Hub', description: 'News, articles, fighter posts, fan threads, and the stories shaping your promotion.', filtersLabel: 'Social Hub filters', filters: { all: 'All', news: 'News', articles: 'Articles', fighterPosts: 'Fighter Posts', threads: 'Threads' }, feedLabel: 'Social feed', empty: 'No posts match this filter. Book fights, advance time, or simulate an event to create activity.', trending: 'Trending Storylines', noDrama: 'No active drama yet.', intensity: 'Intensity {{value}}/3', expires: 'Expires {{date}}', promote: 'Promote upcoming fights', announced: 'Announced', announce: 'Announce matchup', hyped: 'Hyped', hype: 'Hype fight', kind: { news: 'News', article: 'Article', fighterPost: 'Fighter post', promotionPost: 'Promotion post', thread: 'Thread' }
  },
  roster: {
    eyebrow: 'Competition',
    title: 'Promotion Roster',
    fighterCount: '{{count}} contracted fighters',
    searchPlaceholder: 'Search fighter',
    searchLabel: 'Search roster',
    filters: {
      allWeights: 'All Weights',
      allStyles: 'All Styles',
      anyArchetype: 'Any Archetype',
      anyStatus: 'Any Status',
      anyContract: 'Any Contract',
      expiringSoon: 'Expiring Soon',
      star: 'Star',
      prospect: 'Prospect',
      veteran: 'Veteran',
      readyToFight: 'Ready to Fight',
      medicallySuspended: 'Medically Suspended',
      fatigued: 'Fatigued'
    },
    columns: {
      fighter: 'Fighter',
      rank: 'Rank',
      age: 'Age',
      weight: 'Weight',
      record: 'Record',
      style: 'Style',
      overall: 'OVR',
      potential: 'POT',
      popularityMoraleMomentum: 'Pop / Mor / Mom',
      status: 'Status',
      contract: 'Contract'
    },
    champion: 'Champion',
    popularity: 'Popularity',
    morale: 'Morale',
    momentum: 'Momentum',
    suspended: 'Suspended',
    ready: 'Ready',
    days: '{{count}} days',
    fightsLeft: '{{count}} left',
    empty: 'No fighters found. Go to Free Agents to sign fighters.'
  },
  freeAgents: {
    eyebrow: 'Recruitment',
    title: 'Free Agents',
    fighterCount: '{{count}} fighters match the current search',
    searchLabel: 'Search free agents',
    anyPopularity: 'Any Popularity',
    popularityAtLeast: 'Pop {{value}}+',
    columns: {
      fighter: 'Fighter',
      age: 'Age',
      weight: 'Weight',
      record: 'Record',
      style: 'Style',
      overall: 'OVR',
      popularity: 'Pop',
      potential: 'POT',
      ask: 'Ask Pay/Bonus',
      interest: 'Interest'
    },
    fights: 'for {{count}} fights',
    interest: {
      veryHigh: 'Very High',
      high: 'High',
      moderate: 'Moderate',
      low: 'Low',
      veryLow: 'Very Low'
    },
    empty: 'No free agents match your filters.'
  },
  inbox: {
    eyebrow: 'Promotion operations',
    title: 'Inbox',
    description: 'Current decisions are generated from live promotion conditions.',
    empty: 'No decisions need attention right now.',
    review: 'Review',
    severity: {
      critical: 'Critical',
      urgent: 'Urgent',
      opportunity: 'Opportunity'
    }
  },
  calendar: {
    seasonYear: 'Season year {{year}}',
    title: 'Annual Planning Calendar',
    currentDate: 'Current date: {{date}}',
    rebuild: 'Rebuild year plan',
    rebuildConfirm: 'Are you sure you want to rebuild the plan for this year? This will regenerate all planned slots.',
    counts: {
      planned: 'Planned',
      scheduled: 'Scheduled',
      completed: 'Completed',
      missed: 'Missed',
      cancelled: 'Cancelled'
    },
    filters: {
      all: 'All',
      regular: 'Regular',
      tentpole: 'Tentpole',
      title: 'Title',
      gpWindow: 'GP Window',
      gpRound: 'GP Round',
      recovery: 'Recovery',
      missedCancelled: 'Missed/Cancelled'
    },
    gpRoundHelp: 'A scheduled Grand Prix bracket stage.',
    noPlan: 'No calendar plan exists for {{year}}.',
    generate: 'Generate plan now',
    columns: {
      date: 'Date',
      slotType: 'Slot type',
      status: 'Status',
      targetDetails: 'Target details',
      linkedEvent: 'Linked event',
      notes: 'Notes / delays',
      actions: 'Actions'
    },
    noMatches: 'No slots found matching the selected filter.',
    overdue: 'Overdue',
    approaching: 'Approaching',
    gpRound: 'GP {{round}}',
    warnings: {
      dateMismatch: 'Date mismatch',
      noTournament: 'No tournament',
      overdueSlot: 'Overdue slot',
      delayedRound: 'Delayed round'
    },
    gpStatus: 'GP status: {{status}}',
    retry: 'Retry: {{date}}',
    noNotes: 'No notes',
    bookCard: 'Book card',
    cancelSlot: 'Cancel slot',
    cancel: 'Cancel',
    locked: 'Locked'
  },
  rankings: {
    eyebrow: 'Competition',
    title: 'Promotion Rankings',
    active: 'Active',
    activeTooltip: 'Champion is available and the title state is normal.',
    inactiveChampion: 'Inactive Champion',
    inactiveChampionTooltip: 'Champion is inactive; an interim title fight may be needed.',
    unificationNeeded: 'Unification Needed',
    unificationNeededTooltip: 'Undisputed and interim champions must fight to unify the title.',
    pendingDefense: 'Pending Defense',
    pendingDefenseTooltip: 'Champion is approaching the expected title defense window.',
    beltAlt: '{{name}} undisputed championship belt',
    currentDivisionBelt: 'Current division belt',
    prestige: 'Prestige',
    undisputed: 'Undisputed',
    interimChampion: 'Interim champion',
    vacantTitle: 'Vacant title',
    empty: 'No ranked fighters in this division. Sign more fighters!',
    columns: {
      rank: 'Rank',
      move: 'Move',
      fighter: 'Fighter',
      record: 'Record',
      status: 'Status'
    },
    new: 'New',
    age: 'Age {{age}}',
    injured: 'Injured',
    defenses: 'Defenses',
    lastFight: 'Last fight',
    none: 'None'
  },
  mmaGuide: {
    eyebrow: 'Cage Dynasty field manual',
    title: 'MMA Guide',
    description: 'A quick explanation of the terms and tournament systems used in the game. Use this page when you need to understand a title shot, Grand Prix, or fight result.',
    sections: {
      grandPrix: {
        title: 'Grand Prix & Brackets',
        eyebrow: 'Tournament format',
        entries: {
          grandPrix: { term: 'Grand Prix', description: 'A single-elimination tournament in one weight class. Losers are eliminated and winners advance to the final.' },
          fourMan: { term: '4-Man Grand Prix', description: 'Four fighters compete in two semifinals and a final. This is a quick way to determine the top contender.' },
          eightMan: { term: '8-Man Grand Prix', description: 'Eight fighters compete across four quarterfinals, two semifinals, and a final. It takes longer, carries more prestige, and requires roster depth.' },
          seed: { term: 'Seed', description: 'A tournament placement based on ranking score. Higher seeds usually receive more favorable first-round matchups.' },
          reserve: { term: 'Reserve Fighter', description: 'A reserve can replace a fighter who is injured or unavailable before a tournament round.' },
          rounds: { term: 'Quarterfinal / Semifinal / Final', description: 'The three bracket stages. A 4-man Grand Prix begins with semifinals; an 8-man Grand Prix begins with quarterfinals.' }
        }
      },
      belts: {
        title: 'Belts & Contenders',
        eyebrow: 'Title picture',
        entries: {
          undisputed: { term: 'Undisputed Champion', description: 'The official champion of a weight class. This belt is defended in title fights.' },
          interim: { term: 'Interim Champion', description: 'A temporary champion, usually created when the undisputed champion cannot compete for an extended period.' },
          unification: { term: 'Unification', description: 'A fight between the undisputed and interim champions that restores one champion.' },
          vacant: { term: 'Vacant Title', description: 'A championship with no current holder. Book two suitable contenders to fight for it.' },
          titleShot: { term: 'Title Shot', description: 'An opportunity to fight the undisputed champion. A Grand Prix winner can be promised a title shot.' },
          defense: { term: 'Title Defense', description: 'A successful defense by the champion. Defenses increase a fighter’s legacy and prestige.' }
        }
      },
      fightResults: {
        title: 'Fight Results',
        eyebrow: 'How a fight ends',
        entries: {
          koTko: { term: 'KO/TKO', description: 'A knockout or technical knockout: the referee stops the fight when a fighter cannot defend themselves or continue safely.' },
          submission: { term: 'Submission', description: 'A win by a hold that makes the opponent tap out, or forces the referee to stop the fight for safety.' },
          decision: { term: 'Decision', description: 'The fight reaches the scheduled distance and the judges score it. Decisions can be unanimous, split, or majority.' },
          draw: { term: 'Draw', description: 'The judges score the fight even. A championship usually remains with the current champion unless the rules state otherwise.' },
          rating: { term: 'Performance Rating', description: 'The in-game quality score for a fight. Higher ratings make fights stand out in promotion history.' },
          suspension: { term: 'Medical Suspension', description: 'Mandatory recovery time after a demanding fight. A fighter cannot be booked during this period.' }
        }
      },
      promotion: {
        title: 'Running a Promotion',
        eyebrow: 'Manager basics',
        entries: {
          card: { term: 'Fight Card', description: 'Every fight booked for an event. A card needs enough bouts and fighters who are healthy and under contract.' },
          mainEvent: { term: 'Main Event', description: 'The most important fight on a card. Title fights and Grand Prix bouts can increase event appeal.' },
          ranking: { term: 'Ranking Score', description: 'A score based on strength and results, used for rankings and Grand Prix seeding.' },
          reputation: { term: 'Reputation', description: 'The promotion’s standing. Higher reputation unlocks stronger financial opportunities and supports growth.' },
          fanbase: { term: 'Fanbase', description: 'The size of the audience. Fanbase and reputation affect potential attendance and event revenue.' },
          contract: { term: 'Contract', description: 'A fighter needs an active contract to compete. Track remaining fights before they become a free agent.' }
        }
      }
    }
  },
  historyStats: {
    eyebrow: 'Promotion record', title: 'Promotion History & Stats', description: 'Review your legacy and historical records.', totalEvents: 'Total events', lifetimeProfit: 'Lifetime profit', legacyTitle: 'All-Time Legacy Rankings (Top 10)', rank: 'Rank', fighter: 'Fighter', weightClass: 'Weight Class', record: 'Record', legacyScore: 'Legacy Score', majorAchievements: 'Major Achievements', undisputedCount: '{{count}}x Undisputed', interimCount: '{{count}}x Interim', defensesCount: '{{count}} Defenses', unifiedCount: '({{count}} Unified)', noLegacy: 'No legacy data yet. Simulate more fights.', gpHistory: 'Grand Prix History', filters: { all: 'All', active: 'Active', completed: 'Completed', cancelled: 'Cancelled', fourMan: '4-Man', eightMan: '8-Man' }, date: 'Date', tournament: 'Tournament', prestige: 'Prestige', reservesUsed: 'Reserves Used', winner: 'Winner', runnerUp: 'Runner-Up', titleShotStatus: 'Title Shot Status', titleShotHelp: 'Grand Prix winner is owed an undisputed title fight.', fights: 'Fights', actions: 'Actions', noGp: 'No Grand Prix tournaments match this filter.', notes: 'Notes ({{count}})', yes: 'Yes', no: 'No', used: 'Used', pending: 'Pending', pendingShort: 'TBD', titleShotUsedHelp: 'The promised title shot has been completed.', titleShotPendingHelp: 'Grand Prix winner is owed an undisputed title fight.', titleShotTbdHelp: 'A winner must be decided before the promised title shot can be tracked.', bracket: 'Bracket', yearlyAwards: 'Yearly Awards', fighterOfYear: 'Fighter of the Year', fightOfYear: 'Fight of the Year', koOfYear: 'KO of the Year', submissionOfYear: 'Submission of the Year', upsetOfYear: 'Upset of the Year', prospectOfYear: 'Prospect of the Year', seasonSummary: 'Season Summary & Calendar Archive', season: '{{year}} Season', completedEvents: 'Completed Events', tentpoleEvents: 'Tentpole Events', completedTournaments: 'Completed Tournaments', financialNet: 'Financial Net', biggestEvent: 'Biggest Event', attendance: '{{value}} Attendance', noneRecorded: 'None recorded', bestFight: 'Best Fight', ratingEvent: 'Rating: {{rating}}% ({{event}})', biggestUpset: 'Biggest Upset', defeated: '{{winner}} def. {{loser}}', upsetMargin: 'Upset margin: +{{value}}%', calendarArchive: 'Calendar Slot Archive ({{year}})', slotType: 'Slot Type', status: 'Status', linkedEvent: 'Linked Event', notesColumn: 'Notes', none: 'None', recordBook: 'All-Time Record Book', mostFights: 'Most Fights', fightCount: '{{count}} Fights', mostWins: 'Most Wins', winCount: '{{count}} Wins', mostKos: 'Most KO/TKOs', koCount: '{{count}} KOs', mostSubmissions: 'Most Submissions', submissionCount: '{{count}} Subs', mostDefenses: 'Most Title Defenses', defenseDivision: '{{count}} Defenses ({{weightClass}})', fastestKo: 'Fastest KO/TKO', roundTime: 'R{{round}} {{time}}', highestAttendance: 'Highest Attendance', fanCount: '{{value}} Fans', mostProfitable: 'Most Profitable', biggestLoss: 'Biggest Loss', noneYet: 'None yet', unknown: 'Unknown', pastEvents: 'Past Events Archive', noEvents: 'No events completed yet.', eventSummary: '{{date}} · {{value}} Fans', revenue: 'Revenue', gateRevenue: 'Gate Revenue', broadcastDeal: 'Broadcast/Deal', gpFinalBoost: 'GP Final Boost', costs: 'Costs', venue: 'Venue', marketing: 'Marketing', fighterPay: 'Fighter Pay', winBonuses: 'Win Bonuses', netProfitLoss: 'Net P/L', ledgerEntries: 'Ledger Entries', highestRated: 'Highest Rated Fights', noRecordedFights: 'No fights recorded yet.', rating: '{{value}}/100 Rating', versus: 'vs', wonBy: '{{winner}} won by {{method}} (R{{round}})', titleLineage: 'Title Lineage', noTitleHistory: 'No title history.', present: 'Present', interim: 'Interim', successfulDefense: '{{count}} successful defense', successfulDefenses: '{{count}} successful defenses'
  },
  debugSim: {
    eyebrow: 'Diagnostics', title: 'Simulation Debugger', description: 'Run deterministic scenario checks and long-term promotion simulations.', addCash: '+$1M Cash', printState: 'Print State', testInvariants: 'Test Invariants', runAll: 'Run All 200x', run200: 'Run 200x', results: 'Results ({{count}} fights)', redWins: 'Red Wins', blueWins: 'Blue Wins', draws: 'Draws', rates: 'Rates', averages: 'Averages', extras: 'Extras', finishShort: 'Fin', decisionShort: 'Dec', doctorShort: 'Doc', submissionShort: 'Sub', roundShort: 'Rnd', performanceShort: 'Perf', medicalShort: 'Med Susp', roundStatsShort: 'RS Errors', upsets: 'Upsets', methods: 'Methods', sampleCommentary: 'Sample Commentary (1 fight)', autopilotTesting: 'Autopilot Testing', runDays: 'Run {{count}} Days', runGpWorkflow: 'Run GP Test Workflow', workflowOutput: 'Test Workflow Output', simulationReport: 'Simulation Report', tenEightScores: '10-8 Judge Scores', totalScores: '{{count}} total scores', awardsGenerated: 'Awards Generated', eventsCompleted: 'Events Completed', fightsCount: '{{count}} fights', medicalSuspensions: 'Medical Suspensions', totalGiven: 'Total given in sim', titleStatusCounts: 'Title Status Counts', finishMethods: 'Finish Methods', submission: 'Submission', decision: 'Decision', draw: 'Draw', dealsLedger: 'Deals & Ledger', activeSponsors: 'Active Sponsors', expiredSponsors: 'Expired Sponsors', activeMedia: 'Active Media', expiredMedia: 'Expired Media', ledgerEntries: 'Ledger Entries', summaryRows: 'Summary Rows', cashAffecting: 'Cash-Affecting', ledgerByType: 'Ledger Entries by Type', tournamentStats: 'Detailed Tournament Stats', planned: 'Planned', active: 'Active', completedFormats: 'Completed 4-Man / 8-Man', cancelled: 'Cancelled', stuckTournaments: 'Stuck Tournaments', gpShotsPending: 'GP Shots Pending', gpShotsUsed: 'GP Shots Used', reserveReplacements: 'Reserve Replacements', missingArchiveIds: 'Missing FightArchiveIds', cadenceStatus: 'Event Cadence Status:', stalled: 'STALLED', healthy: 'HEALTHY', lastCompletedEvent: 'Last Completed Event', daysAgo: '{{count}} days ago', stallNewsPosted: 'Stall News Posted', calendarMetrics: 'Annual Calendar & Season Planning Metrics', totalSlots: 'Total Slots', scheduled: 'Scheduled', completed: 'Completed', missedCancelled: 'Missed/Cancelled', gpSlots: 'GP Slots', titleDefenses: 'Title Defenses', tentpoles: 'Tentpoles', stuckDetails: 'Stuck/Delayed Tournaments Detail:', age: 'Age', needed: 'Needed', status: 'Status', waitingToSchedule: 'Waiting to schedule', generalInvariants: 'General Codebase Invariants', duplicateChampions: 'Duplicate Champions', completedWithoutResult: 'Completed Events w/o Result', suspendedBooked: 'Suspended Fighter Booked', ledgerInconsistencies: 'Ledger Inconsistencies', pastScheduledEvents: 'Past Scheduled Events', scheduledNoFights: 'Scheduled w/ 0 Fights', unavailableFighters: 'Upcoming Unavailable Fighters', dateMismatch: 'Slot/Event Date Mismatch', fakeGpEvents: 'Fake GP Events', fakeGpSlots: 'Fake GP Slots', staleSlots: 'Stale Planned Slots', gpWinners: 'Grand Prix Winners', tournamentErrors: 'Tournament Invariant Errors', titleShotErrors: 'Title Shot Debt Invariant Errors', roundStatsErrors: '{{count}} roundStats validation errors detected (rounds with missing/empty judges)', titleErrors: 'Title Invariant Errors', calendarErrors: 'Calendar Integrity Errors', statePrinted: 'GameState printed to console.', cashAdded: 'Added $1,000,000', invariantsPassed: 'Title Invariants Passed! Check console for details.', invariantFailures: 'INVARIANT FAILURES DETECTED:', testFailed: 'Test Failed: {{message}}'
  },
  generated: {
    contracts: { notInterested: "I'm not interested in fighting for a promotion of your caliber right now.", accepted: "Offer accepted. Let's make some money.", acceptedLow: "It's a bit low, but I want to fight here. Accepted.", counterOffer: 'The financial terms are close. Here is my counter-offer.', rejected: 'The financial terms are not acceptable to me right now.' },
    social: { unknownFighter: 'Unknown fighter', bookedHeadline: '{{matchup}} booked', bookedBody: '{{weightClass}}{{title}} bout is set for {{event}} on {{date}}.', titleMarker: ' title fight', previewHeadline: 'Matchup preview: {{red}} vs {{blue}}', previewBody: '{{redStyle}} meets {{blueStyle}}{{matchup}}{{rivalry}}.', mismatch: ' in a notable {{value}}-point OVR mismatch', competitive: ' in a competitive matchup', rivalryIntensity: ' with rivalry intensity {{value}}', rivalryHeadline: '{{red}} vs {{blue}}: settle the rivalry?', rivalryBody: 'The rivalry heads into {{event}}.', wantedReply: 'This is the fight everyone wanted.', mustWatchReply: 'Intensity {{value}}/3 makes this must-watch.', warningHeadline: '{{name}} fires a warning', campHeadline: '{{name}} checks in from camp', warningBody: '“{{opponent}} knows what is coming. This ends at {{event}}.”', campBody: '“Camp is going well. I respect {{opponent}}, but I am ready.”', fightWeekHeadline: 'Fight week: {{red}} vs {{blue}}', fightWeekRivalry: 'The final faceoff adds heat to an already bitter rivalry.', fightWeekNormal: 'Media and fans make their final predictions.', decisionReply: '{{name}} by decision.', finishReply: '{{name}} finds the finish.', resultWinHeadline: '{{winner}} defeats {{loser}}', opponent: 'their opponent', resultDrawHeadline: '{{red}} and {{blue}} fight to a draw', resultBody: '{{event}}: {{method}}, round {{round}} at {{time}}.', recapHeadline: 'Inside the action: {{red}} vs {{blue}}', recapBody: 'A {{value}}/100 performance delivered one of {{event}}\'s talking points.', winnerReaction: '{{name}} reacts', winnerReactionBody: '“The work paid off. Thank you to my team and everyone who supported me.”', loserReaction: '{{name}} responds', loserReactionBody: '“This one hurts, but I will learn, recover, and come back better.”', announcedHeadline: '{{red}} vs {{blue}} officially announced', hypeHeadline: 'Why {{red}} vs {{blue}} matters', announcedBody: '{{promotion}} confirms the {{weightClass}} matchup for {{event}}.', rivalryHype: 'History, rankings, and bad blood make this essential viewing.', underdogHype: 'A dangerous test with a clear favorite and a determined underdog.', closeHype: 'A closely matched fight with real divisional stakes.', interestingReply: 'This card just got interesting.' },
    news: { rivalryDescription: 'A bitter rivalry exists between {{names}}.', massiveSuccessTitle: 'Massive Success!', massiveSuccess: '{{event}} was a huge financial success, bringing in {{profit}} in profit.', financialDisappointmentTitle: 'Financial Disappointment', financialDisappointment: '{{event}} failed to turn a profit, losing {{loss}}.', fansDisappointedTitle: 'Fans Disappointed with Card', fansDisappointed: 'Fans heavily criticized {{event}} for lackluster fights.', fanBacklash: 'The promotion is facing fan backlash after the disappointing {{event}}.', hugeUpsetTitle: 'Huge Upset!', hugeUpset: '{{winner}} shocked the world by defeating the highly favored {{loser}}.', upsetRun: '{{name}} is on a Cinderella run after a massive upset.', controversialDecisionTitle: 'Controversial Decision in {{winner}} vs {{loser}}', controversialDecision: 'Fans are debating the split decision victory for {{winner}}. Many felt {{loser}} won.', rematchDemand: 'Fans are demanding a rematch between {{winner}} and {{loser}} after their controversial bout.', prospectWatchTitle: 'Prospect Watch: {{name}}', prospectWatch: 'Undefeated prospect {{name}} continues to impress and build momentum.', prospectHype: '{{name}} is one of the hottest prospects in the sport right now.', dominantChampionTitle: 'Dominant Champion', dominantChampion: '{{name}} looked untouchable in their latest title defense.', championDominance: '{{name}} is looking unbeatable as champion.', fierceRivalryTitle: 'Fierce Rivalry: {{winner}} vs {{loser}}', fierceRivalry: 'The war between {{winner}} and {{loser}} has sparked a rivalry.', contractDisputeTitle: 'Contract Dispute: {{name}}', contractDispute: '{{name}} is unhappy with their current contract and demanding better pay.', contractDisputeDescription: '{{name}} is in a contract dispute with the promotion.', inactivityTitle: '{{name}} Frustrated by Inactivity', inactivity: '{{name}} has publicly complained about not getting a fight booked.' },
    inbox: { eventDueTitle: 'Event is due', eventNeedsFightsTitle: 'Event needs fights', eventDue: '{{event}} is ready to run.', eventNeedsFights: '{{event}} has {{count}} of 3 required fights booked.', unavailableTitle: 'Booked fighter unavailable', unavailable: '{{fighter}} cannot make {{event}}.', championContractExpiredTitle: 'Champion contract expired', championContractExpired: 'Renew {{fighter}} before the title situation escalates.', contractExpiringTitle: 'Contract expiring', contractExpiring: '{{fighter}} has {{count}} fights remaining.', counterOfferTitle: 'Counter-offer awaiting response', counterOffer: '{{fighter}}\'s counter-offer expires in {{count}} days.', tournamentTitle: 'Grand Prix round needs attention', tournamentNeedsRound: '{{name}} needs its next round scheduled.', titleShotTitle: 'Grand Prix title shot owed', titleShot: '{{fighter}} is owed a {{weightClass}} title shot.', rivalryTitle: 'Peak rivalry ready to book', depthTitle: '{{weightClass}} needs depth', depth: '{{fighter}} could strengthen a thin division.', freeAgentTitle: 'High-value free agent', freeAgent: '{{fighter}} is available to sign.' },
    insights: { unsigned: 'Unsigned', unsignedDetail: 'Needs a contract before booking.', injured: 'Injured', injuryDetail: '{{type}}: {{count}} days remaining.', suspended: 'Suspended', daysRemaining: '{{count}} days remaining.', exhausted: 'Exhausted', exhaustedDetail: 'Fatigue {{value}}/100; rest before booking.', tired: 'Tired', tiredDetail: 'Fatigue {{value}}/100; booking carries a readiness risk.', ready: 'Ready', readyDetail: 'Fatigue {{value}}/100.', styleEdge: '{{winner}} has a small stylistic edge over {{loser}}.', noStyleEdge: 'No clear stylistic edge.', mismatch: 'Severe OVR mismatch ({{value}} points).', closeRanking: 'Close ranking level', rankedMatchup: 'Clear ranked matchup', overallGap: 'OVR gap {{value}}', combinedPopularity: 'Combined popularity {{value}}', rivalryIntensity: 'Rivalry intensity {{value}}', oneTired: 'One fighter is tired', bothReady: 'Both fighters ready', neededRound: 'Needed round: {{round}}', scheduledRound: 'Scheduled round: {{round}}', waitingResults: 'Waiting on {{count}} results', readySchedule: 'Ready to schedule', roundBooked: 'Round already booked', waitingRetry: 'Waiting to retry', gpDelayed: 'Grand Prix delayed', gpPlanned: 'Grand Prix planned', injuryRecap: '{{type}} ({{count}} days)', suspensionRecap: 'Medical suspension ({{count}} days)' },
    achievements: { currentChampionTitle: 'Current Champion', currentChampion: 'Current {{weightClass}} champion.', interimChampion: 'Interim Champion', undisputedChampion: 'Undisputed Champion', heldUntil: 'Held until {{date}}', currentReign: 'Current or most recent reign', titleWon: '{{weightClass}} title won {{date}}. {{status}}.', defenseTitle: 'Successful Title Defense', defenses: '{{count}} successful defenses during this {{weightClass}} reign.', unificationTitle: 'Undisputed Unification', unification: 'Unified the title at {{event}}.', gpChampionTitle: 'Grand Prix Champion', gpChampion: 'Won the {{format}} {{tournament}}.{{titleShot}}', titleShotUsed: ' Title shot used.', titleShotPending: ' Title shot pending.', gpFinalistTitle: 'Grand Prix Finalist', gpFinalist: 'Reached the final of {{tournament}}.', gpReserveTitle: 'Grand Prix Reserve', gpReserve: 'Entered {{tournament}} as a reserve replacement.', fighterOfYear: 'Fighter of the Year', prospectOfYear: 'Prospect of the Year', fightOfYear: 'Fight of the Year', koOfYear: 'KO of the Year', submissionOfYear: 'Submission of the Year', upsetOfYear: 'Upset of the Year', awardedFor: 'Awarded for {{year}}.', awardAt: '{{year}} award at {{event}}.', streakTitle: 'Win Streak', streak: 'Longest promotion win streak: {{count}}.', finisherTitle: 'Finisher', finisher: '{{count}} promotion wins by finish.', titleVeteranTitle: 'Title Fight Veteran', titleVeteran: '{{count}} promotion title fights.' },
    engine: { monthlySponsorIncome: 'Monthly sponsor income: {{name}}', monthlyMediaIncome: 'Monthly media income: {{name}}', yearlyAwardsTitle: '{{year}} Yearly Awards Announced', yearlyAwards: 'The {{year}} awards have been finalized. Check History to see the winners.', championContractExpiredTitle: 'Champion Contract Expired!', championContractExpired: '{{name}}\'s contract has expired. Renew immediately or vacate the title.', contractExpiredTitle: 'Contract Expired: {{name}}', freeAgent: '{{name}} is now a free agent.', titleStalledTitle: '{{weightClass}} Title Stalled', titleStalled: 'The {{weightClass}} undisputed champion {{name}} has not defended the title in over 9 months.', titleFightCancelledTitle: 'Title Fight Cancelled', titleFightCancelled: 'A title fight scheduled between {{red}} and {{blue}} was invalid and downgraded to a non-title fight. Reason: {{reason}}', invalidWeightClass: 'Invalid weight class for title.', unificationRequiresChampions: 'Unification fight requires both undisputed and interim champions.', unificationRequiresMatchup: 'Unification fight must be between undisputed and interim champions.', interimRequiresChampion: 'Active interim title fight must include the current interim champion.', interimRequiresUndisputed: 'Cannot create an interim title if there is no undisputed champion.', undisputedCannotFightInterim: 'Undisputed champion cannot fight for an interim title.', activeTitleRequiresChampion: 'Active title fight must include the current undisputed champion.', historyWin: 'Won via {{method}} vs {{opponent}} (R{{round}})', historyLoss: 'Lost via {{method}} vs {{opponent}} (R{{round}})', historyDraw: 'Draw vs {{opponent}}', unifiedDefenseTitle: 'TITLE UNIFIED: {{winner}} Defeats Interim Champ!', unifiedDefense: '{{winner}} successfully unified the {{weightClass}} belts against {{loser}}.', newUndisputedTitle: 'NEW UNDISPUTED CHAMPION: {{winner}}!', newUndisputed: '{{winner}} unified the {{weightClass}} belts by defeating {{loser}}.', newInterimTitle: 'NEW INTERIM CHAMPION: {{winner}}!', newInterim: '{{winner}} won the interim {{weightClass}} title!', newChampionTitle: 'NEW CHAMPION: {{winner}}!', newChampion: '{{winner}} defeated {{loser}} to become the new {{weightClass}} Champion!', gateBroadcast: 'Gate & Broadcast: {{event}}', dealBonusesBoost: 'Deal bonuses (incl. 8-Man GP Final Sponsor Boost) from {{event}}', dealBonuses: 'Deal bonuses from {{event}}', eightManCommercialBonus: '8-Man Grand Prix Final Commercial Bonus ({{event}} - high rating)', fourManCommercialBonus: '4-Man Grand Prix Final Commercial Bonus ({{event}} - high rating)', venueRental: 'Venue rental: {{venue}}', marketing: 'Marketing: {{event}}', fighterPurses: 'Fighter purses & bonuses: {{event}}', netEvent: 'Net Event P&L: {{event}}', eventCompletedTitle: '{{event}} Completed', eventCompleted: 'The event drew {{attendance}} fans and generated {{revenue}} in total revenue. Fan reaction was {{reaction}}/100.', clearedByUnification: 'Cleared by unification fight.', unifiedIntoUndisputed: 'Unified into undisputed title.' },
    tournament: { unknown: 'Unknown', quarterfinal: 'quarterfinal', semifinal: 'semifinal', final: 'final', fourMan: '4-man', eightMan: '8-man', plannedNote: 'Planned on {{date}} with format: {{format}}. Seeds: {{seeds}}', titleShotPromise: ' The winner will earn a guaranteed title shot.', announcedTitle: 'Tournament Announced: {{name}}', announced: 'A new {{format}} Grand Prix has been announced in the {{weightClass}} division, featuring {{count}} elite fighters.{{titleShot}} Participants: {{participants}}.', replacementNote: 'Replacement: {{replacement}} replaced unavailable fighter {{original}} on {{date}} for round {{round}}.', replacementTitle: 'Grand Prix Replacement: {{replacement}} enters {{round}}!', replacement: 'Due to long-term injury, suspension, or fatigue, {{original}} is unable to compete. Reserve fighter {{replacement}} steps in for the {{round}} round.', suspendedDelay: '{{fighter}} is medically suspended for {{count}} days.', bookedDelay: '{{fighter}} is already booked in another event.', unavailableDelay: '{{fighter}} is unavailable and no reserve is available.', delayedNote: 'Round {{round}} delayed: {{reason}}', delayedTitle: '{{name}} {{round}} Delayed', delayed: 'The {{round}} of {{name}} has been delayed. Reason: {{reason}}. Earliest expected reschedule: {{date}}.', scheduledNote: 'Round {{round}} scheduled on event {{event}} on {{date}}.', scheduledTitle: '{{name}} {{round}} Scheduled!', scheduled: 'The {{round}} matches have been scheduled for {{event}} on {{date}}!', cancelledNote: 'Tournament cancelled on {{date}}.', signingTitle: 'Tournament Signing: {{fighter}}', signing: '{{fighter}} has signed a 4-fight contract to bolster the {{weightClass}} Grand Prix roster.', drawTiebreaker: 'Draw tiebreaker: {{fighter}} advanced from {{round}} by bracket order.', quarterfinalsCompleteNote: 'Quarterfinals completed. Semifinalists set.', semifinalistsTitle: '{{name}} Semifinalists Decided!', semifinalists: 'The quarterfinal round of {{name}} is complete. Semifinal matches are set!', semifinalsCompleteNote: 'Semifinals completed. Finalists: {{fighters}}', finalistsTitle: '{{name}} Finalists Decided!', finalists: 'The bracket is set. {{red}} will face {{blue}} in the Grand Prix Final.', winnerNote: 'Grand Prix Winner: {{fighter}} on {{date}}', winnerHistory: 'Won Grand Prix vs {{opponent}}', winnerTitle: '{{fighter}} Wins {{name}}!', winner: '{{fighter}} defeated {{opponent}} in the Grand Prix final to claim the crown!{{titleShot}}', titleShotGuaranteed: ' A future title shot is guaranteed.', autopilotDelayedTitle: 'Grand Prix Delayed: {{name}}', autopilotDelayed: '{{name}} has been delayed for {{count}} days. Promotion officials are working on emergency options.', autopilotCancelledTitle: 'Grand Prix Cancelled: {{name}}', autopilotCancelled: '{{name}} has been cancelled due to permanent participant roster depletion and financial constraints.', emergencyReserveNote: 'Emergency reserve signing: signed {{fighter}} on {{date}}.', emergencySigningTitle: 'Emergency Tournament Signing: {{fighter}}', emergencySigning: 'Cage Dynasty has signed free agent {{fighter}} as an emergency reserve for the stalled {{name}}.', calendarLinked: 'Linked to {{name}}', calendarCreated: 'Created and linked to {{name}}', calendarRescheduled: 'Rescheduled from {{from}} to {{to}} to match linked event.', calendarScheduled: 'Scheduled on event {{event}} (Date: {{date}})', calendarDelayed: 'Delayed: {{reason}}. Earliest date: {{date}}', repairedNote: 'Round {{round}} repaired/rescheduled on event {{event}} on {{date}}.' },
    autobooker: { gpWindowRescheduled: 'Rescheduled Grand Prix window from {{date}}. Reason: {{reason}}', roundDelayed: 'Round {{round}} delayed: {{reason}}', gpRoundDelayed: 'GP round delayed: {{reason}}', gpRoundDelayedTitle: 'Grand Prix Round Delayed', gpRoundRemoved: '{{event}} was removed because tournament scheduling failed: {{reason}}', reservedTitleShot: 'Reserved for {{fighter}} title shot', emergencyTitleSlot: 'Emergency high-priority title fight slot created for {{fighter}} (Pending: {{count}} days)', championInjured: 'Champion {{fighter}} injured: {{injury}}', championSuspended: 'Champion {{fighter}} suspended: {{count}} days', championUnavailable: 'Champion unavailable: {{reason}}', marchSafeguard: 'Forced March safeguard event.', gpAlreadyActive: 'GP “{{name}}” is already active/planned.', gpWindowConverted: 'Converted GP window to regular event because {{reason}}', gpCreatedLinked: 'Created and linked {{name}} to this slot.', gpWindowConversionFailed: 'Converted GP window to regular event. Reason: {{reason}}', restCompleted: 'Rest month completed on {{date}}.', emergencyFundingTitle: 'Emergency Funding Injected', emergencyFunding: 'The promotion has secured {{amount}} in emergency funding to avoid bankruptcy, though reputation has suffered.', emergencyFundingLedger: 'Emergency funding injection', emergencySigningTitle: 'Emergency Signing: {{fighter}}', emergencySigning: '{{fighter}} has signed a short-term contract to resolve roster depletion.', eventRescheduled: 'Rescheduled from {{from}} to {{to}} to match linked event.', newEventTitle: 'New Event Announced: {{event}}', newEvent: 'Cage Dynasty has announced its next event, scheduled for {{date}}.', bookingFailed: 'Booking attempt failed on {{date}} due to roster/finance limitations.', cadenceStalledTitle: 'Event Cadence Stalled', cadenceStalled: 'Cage Dynasty has temporarily stalled due to extreme roster depletion or financial distress.', championMissing: 'Champion not found.', championInjuredPending: 'Champion {{fighter}} is injured.', championSuspendedPending: 'Champion {{fighter}} is medically suspended.', championFatiguedPending: 'Champion {{fighter}} is fatigued.', titleShotPending: 'Autobook title shot pending: {{reason}}', newSponsorTitle: 'New Sponsor: {{name}}', newSponsor: 'The promotion has signed a new {{tier}} sponsorship deal with {{name}}.', newBroadcastTitle: 'New Broadcast Deal: {{name}}', newBroadcast: 'The promotion has signed a new {{tier}} broadcast deal with {{name}}.', tierLocal: 'local', tierRegional: 'regional', tierNational: 'national', unificationTitle: 'Unification Title Fight Booked', unification: '{{red}} and {{blue}} will fight to unify the {{weightClass}} championship.', gpTitleShotTitle: 'Grand Prix Title Shot Booked', gpTitleShot: 'Grand Prix winner {{winner}} will challenge champion {{champion}} for the undisputed {{weightClass}} championship.', gpVacantTitleShot: '{{winner}} will fight for the vacant {{weightClass}} championship.', interimTitle: 'Interim {{weightClass}} Title Fight Booked', interim: '{{red}} and {{blue}} will fight for the interim {{weightClass}} championship.', vacantTitle: 'Vacant {{weightClass}} Title Fight Booked', vacant: '{{red}} and {{blue}} will fight for the vacant {{weightClass}} championship.', fighterReleasedTitle: 'Fighter Released', fighterReleased: '{{fighter}} was released from their contract.', newSigningTitle: 'New Signing: {{fighter}}', newSigning: '{{fighter}} has signed a new 4-fight contract.', championExtensionTitle: 'Champion extension: {{fighter}}', championExtension: '{{fighter}} has secured a new 4-fight contract to defend their title.', contractRenewedTitle: 'Contract Renewed: {{fighter}}', contractRenewed: '{{fighter}} has signed a new 4-fight extension.', unknownFighter: 'Unknown Fighter', champion: 'Champion', challenger: 'Challenger', unknown: 'Unknown', titlePostponedTitle: 'Title Fight Postponed', titlePostponed: 'The {{weightClass}} title fight between {{red}} and {{blue}} has been postponed due to injury/suspension of {{fighter}}.', matchupUpdatedTitle: 'Fight Matchup Updated', matchupUpdated: '{{replacement}} has stepped in to face {{opponent}} on {{event}}, replacing the injured/suspended {{replaced}}.', fightRemovedTitle: 'Fight Removed', fightRemoved: 'The bout between {{red}} and {{blue}} has been removed from {{event}} due to medical suspension/injury of {{fighter}}.', eventCancelledTitle: 'Event Cancelled: {{event}}', eventCancelled: 'Due to insufficient matchups and fighter unavailability, {{event}} has been cancelled.', calendarCancelled: 'Cancelled on {{date}} due to insufficient fights (fewer than 3).', tournamentEventCancelled: 'Event {{event}} cancelled due to roster depletion.', tournamentRoundCancelled: 'Round delayed due to cancellation of event {{event}}', pastDueQueued: 'Past due event queued for simulation on {{date}}.' },
    observer: { counterAcceptedTitle: 'Counter-offer accepted: {{name}}', counterAccepted: '{{name}} agreed to a {{count}}-fight contract.' }
  },
  fight: {
    method: {
      koTko: 'KO/TKO',
      submission: 'Submission',
      unanimousDecision: 'Unanimous Decision',
      splitDecision: 'Split Decision',
      majorityDecision: 'Majority Decision',
      doctorStoppage: 'Doctor Stoppage',
      cornerStoppage: 'Corner Stoppage',
      draw: 'Draw'
    },
    common: { mainEvent: 'Main event', coMainEvent: 'Co-main event', bout: 'Bout {{number}}', round: 'Round {{number}}', versus: 'versus', title: 'Title', completed: 'Completed', officialResult: 'Official result', judge: 'Judge {{number}}', winner: 'Winner', draw: 'Draw', live: 'Live', current: 'Current', atFight: 'At fight' },
    position: { distance: 'Distance', clinch: 'Clinch', ground: 'Ground' },
    stats: { title: 'Fight statistics', significantStrikes: 'Significant strikes', totalStrikes: 'Total strikes', headStrikes: 'Head strikes', bodyLegStrikes: 'Body / leg strikes', takedowns: 'Takedowns', controlTime: 'Control time', submissionAttempts: 'Sub attempts', knockdowns: 'Knockdowns', damageGiven: 'Damage given', fighterStats: 'Fighter stats' },
    battle: { description: 'The fight advances action by action from one deterministic simulation.', begin: 'Begin fight', ready: 'Ready', pause: 'Pause', resume: 'Resume', skip: 'Skip to result', wins: '{{name}} wins', confirmFinish: 'Confirm & finish event', confirmNext: 'Confirm result & next fight', commentary: 'Live commentary', roundStatistics: 'Round statistics', redCorner: 'Red corner', blueCorner: 'Blue corner', condition: 'Condition', stamina: 'Stamina', meterLabel: '{{corner}} {{resource}}' },
    prose: { roundBeginsHeadline: 'Round {{round}} begins', roundBegins: 'Round {{round}} begins between {{red}} and {{blue}}.', strikeLands: '{{name}} lands clean', strikeMisses: '{{name}} misses', groundStrikes: '{{name}} scores with ground strikes.', sharpCombination: '{{name}} scores with a sharp combination.', avoidsAttack: '{{name}} reads the attack and avoids most of it.', knockdownHeadline: '{{name}} scores a knockdown', knockdown: '{{attacker}} hurts {{defender}} badly and puts them down.', knockdownMoment: 'Round {{round}}: {{name}} knockdown', takedownMoment: 'Round {{round}}: {{name}} takedown', takedownHeadline: '{{name}} lands a takedown', clinchHeadline: '{{name}} forces a clinch', takedown: '{{name}} changes levels and gets top control.', clinch: '{{name}} defends the shot but is tied up on the fence.', submissionMoment: 'Round {{round}}: {{name}} submission attempt', submissionHeadline: '{{name}} attacks a submission', submissionDanger: '{{name}} has a dangerous submission locked in.', submissionEscape: '{{name}} stays calm and peels the grip away.', submissionFinish: '{{attacker}} tightens the hold and {{defender}} taps.', positionHeadline: '{{name}} changes the position', positionChange: '{{name}} works the fight from {{before}} to {{after}}.', refereeStoppage: '{{name}} forces the referee to stop the fight.', doctorStoppage: 'The doctor stops the fight because of damage to {{name}}.', compromisedStoppage: '{{name}} wins after the referee waves off a compromised opponent.', closeRound: 'Close round', edgedRound: '{{name}} edged the round', roundEndsHeadline: 'Round {{round}} ends', roundEnds: 'End of round {{round}}. {{summary}}.', recoveryHeadline: 'Between-round recovery', recovery: 'Both corners give instructions and send their fighters back out.', decisionWinner: 'The judges score it {{scorecards}} for {{name}}.', decisionDraw: 'The judges score it {{scorecards}} for a draw.' },
    event: { notFound: 'Event not found', simulation: 'Event simulation', fightCount: '{{count}} fights · {{date}}', fightCard: 'Fight card', resume: 'Resume event', start: 'Start event', simulateOneByOne: 'Simulate fights one by one.', completed: 'Completed event', results: '{{name}} Results', simulatedDate: '{{date}} · Simulated', attendance: 'Attendance', totalRevenue: 'Total revenue', totalCost: 'Total cost', netProfit: 'Net profit', recap: 'Event recap', fightOfNight: 'Fight of the night', performanceRating: 'Performance rating', rankingImpact: 'Ranking impact', rankingMovement: 'Ranking movement after this event.', financialResult: 'Financial result', financialHelp: 'Net event profit after venue, marketing, and fighter costs.', fans: 'Fans', medicalReport: 'Medical report', nextBookingLead: 'Next booking lead', nextBookingText: '{{name}} is ready for another high-value matchup.', titleSummary: 'Title fights summary', titleUnchanged: '{{weightClass}} Title Unchanged (Draw)', titleDefended: '{{name}} defended the {{weightClass}} Title!', newChampion: '{{name}} is the NEW {{weightClass}} Champion!', vacantWon: '{{name}} won the vacant {{weightClass}} Title!', interimWon: '{{name}} won the Interim {{weightClass}} Title!', interimDefended: '{{name}} defended the Interim {{weightClass}} Title!', unified: '{{name}} unified the {{weightClass}} Title!', pnl: 'Event P&L breakdown', gateRevenue: 'Gate revenue', tvSponsor: 'TV & sponsor', venueCost: 'Venue cost', marketing: 'Marketing', fighterBasePay: 'Fighter base pay', winBonuses: 'Win bonuses', fanReaction: 'Fan reaction', fightResults: 'Fight results', viewDetailsLabel: 'View fight details: {{red}} vs {{blue}}', viewDetails: 'View details', unavailable: 'N/A' },
    archive: { notFound: 'Fight not found', redFighter: 'Red Fighter', blueFighter: 'Blue Fighter', eyebrow: 'Archived fight', title: 'Fight details', method: 'Method', round: 'Round', time: 'Time', performance: 'Performance', scorecards: 'Scorecards', titleStatus: 'Title status', medicalSuspensions: 'Medical suspensions', injury: '{{name}} suffered a {{type}} (Out {{count}} days)', totalStats: 'Total fight stats', roundByRound: 'Round by round', judgesScore: "Judges' score", keyMoments: 'Key moments', noRoundStats: 'No detailed round stats available for this archived fight.', playByPlay: 'Full play-by-play', dominance: { close: 'Close', clear: 'Clear', dominant: 'Dominant', nearFinish: 'Near finish' }, titleChange: { newChampion: 'AND NEW Champion!', titleDefense: 'AND STILL Champion!', vacantWon: 'New Champion Crowned!', interimWon: 'AND NEW Interim Champion!', interimDefense: 'AND STILL Interim Champion!', unified: 'UNDISPUTED Champion!' } },
    tournamentRound: { quarterfinal: 'GP Quarterfinal', semifinal: 'GP Semifinal', final: 'GP Final' }
  },
  domain: {
    weightClass: {
      bantamweight: 'Bantamweight',
      featherweight: 'Featherweight',
      lightweight: 'Lightweight',
      welterweight: 'Welterweight',
      middleweight: 'Middleweight',
      heavyweight: 'Heavyweight'
    },
    fighterStyle: {
      boxer: 'Boxer',
      wrestler: 'Wrestler',
      bjj: 'BJJ',
      kickboxer: 'Kickboxer',
      muayThai: 'Muay Thai',
      sambo: 'Sambo',
      balanced: 'Balanced'
    },
    tournamentStatus: {
      planned: 'Planned',
      active: 'Active',
      completed: 'Completed',
      cancelled: 'Cancelled'
    },
    titleFightType: {
      undisputed: 'Undisputed title fight',
      interim: 'Interim title fight',
      vacantUndisputed: 'Vacant undisputed title fight',
      unification: 'Title unification fight'
    },
    calendarSlotType: {
      regularEvent: 'Regular event',
      tentpoleEvent: 'Tentpole event',
      grandPrixWindow: 'Grand Prix window',
      grandPrixRound: 'Grand Prix round',
      titleFightCard: 'Title fight card',
      recoveryGap: 'Recovery gap'
    },
    calendarSlotStatus: {
      planned: 'Planned',
      scheduled: 'Scheduled',
      completed: 'Completed',
      missed: 'Missed',
      cancelled: 'Cancelled'
    },
    readiness: {
      ready: 'Ready',
      fatigued: 'Tired',
      injured: 'Injured',
      suspended: 'Suspended',
      booked: 'Booked'
    },
    rank: {
      former: 'Former {{rank}} · {{current}}',
      formerDescription: 'Former promotion rank {{rank}}; currently {{current}}',
      prefixedDescription: '{{prefix}}: {{rank}}'
    }
  }
} as const;

export type TranslationShape<T> = {
  [K in keyof T]: T[K] extends string ? string : TranslationShape<T[K]>
};

export default en;
