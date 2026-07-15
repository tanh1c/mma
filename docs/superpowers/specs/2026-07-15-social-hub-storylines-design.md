# Social Hub and Fighter Storylines Design

**Goal:** Make rivalries and drama visible on fighter profiles and replace the existing News page with a living Social Hub containing news, articles, fighter posts, promotion posts, and discussion threads.

## Current Behavior

Storylines already affect the game but are difficult to discover:

- The News page shows active storylines and the current news list.
- Rivalries are created after qualifying high-rated fights and can reach intensity 1–3.
- Event Builder and matchup recommendations use active rivalry intensity.
- Peak rivalries appear in the Promotion Inbox as booking opportunities.
- Active storylines include Rivalry, Fan Backlash, Rematch Demand, Prospect Hype, Champion Dominance, Contract Dispute, and Upset Run.
- Fighter Detail does not currently expose a fighter's storylines or related news.

## Scope

- Add a Storylines tab to Fighter Detail.
- Replace the sidebar's News destination with Social Hub.
- Migrate legacy news into one normalized, persisted social feed.
- Generate scheduled pre-fight, fight-week, and post-fight content automatically.
- Allow the player to announce and hype upcoming fights from Social Hub.
- Apply small, capped gameplay effects and prevent repeated actions.
- Preserve existing rivalry, storyline, economy, observer-mode, save, and tournament behavior.

## Data Model

`Storyline` remains the authoritative gameplay state. It stores the narrative type, related fighters, active state, intensity, lifecycle dates, and description.

Add a persisted `SocialFeedItem`:

```ts
type SocialFeedKind = 'news' | 'article' | 'fighter_post' | 'promotion_post' | 'thread';
type SocialAuthorType = 'media' | 'fighter' | 'promotion' | 'fan';

interface SocialReply {
  id: string;
  authorType: SocialAuthorType;
  authorName: string;
  authorFighterId?: string;
  body: string;
}

interface SocialFeedItem {
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
```

Add `socialFeed: SocialFeedItem[]` to `GameState`. Items are stored newest first, deduplicated by `stableKey`, and capped at 200. Stable keys are derived from their source and stage, such as `fightId:booked`, `fightId:prefight`, `fightId:fight-week`, and `fightId:result`.

Add optional `socialHype?: number` to an upcoming `FightMatchup`. It is clamped to 0–10 and represents the small fan-anticipation effect created by the one-time Hype Fight action. The existing economy calculation may consume it as a small bounded demand modifier; it must never outweigh fighter popularity, rivalry, card quality, venue, or marketing.

## Save Migration

Increase the save version by one.

For saves without `socialFeed`:

1. Convert each legacy `NewsItem` into a `SocialFeedItem` with kind `news`, media or promotion authorship according to its type, copied title/content/date, empty links where unavailable, deterministic engagement, and stable key `legacy-news:<news-id>`.
2. Preserve the 200 newest migrated items.
3. Initialize missing `FightMatchup.socialHype` to 0 when fights are normalized.

After migration, `socialFeed` is the sole runtime content feed. The legacy `news` field may be read only during migration and is no longer written by game systems or rendered by UI. Import, export, local save, new game, manager mode, and observer mode all persist the normalized feed.

## Feed Helpers

A focused social module owns pure or state-transforming helpers:

- `addSocialFeedItems(state, items)` deduplicates, sorts newest first, and caps at 200.
- `migrateNewsItem(item)` converts legacy news deterministically.
- `getFighterSocialFeed(state, fighterId)` filters newest-first items involving that fighter.
- `getFighterStorylines(state, fighterId)` returns active storylines first, then resolved items by lifecycle date.
- `generateScheduledFightSocial(state, currentDate)` scans upcoming fights and adds only missing milestone content.
- `generatePostFightSocial(state, eventId)` creates result content after a completed event.
- `applyPromotionSocialAction(state, fightId, action)` applies one idempotent player action.

Existing contract, signing, injury, event, fight, tournament, financial, and storyline events write normalized feed items through the shared append helper rather than directly mutating a second news list.

## Automatic Content Lifecycle

Content is generated from actual game state rather than free-form random text.

### On booking

For each newly scheduled fight:

- A promotion announcement identifies the matchup, weight class, event, and title/tournament status.
- A media preview describes the OVR matchup, styles, popularity, and active storyline context.
- An active rivalry also creates a discussion thread with deterministic media/fan replies.

### Pre-fight, 21–30 days before the event

- Generate one fighter confidence, respectful challenge, frustration, or callout post.
- Tone is chosen deterministically from rivalry intensity, morale, popularity, champion status, and matchup balance.
- The post may adjust the author's morale or popularity by at most 1 point, clamped to 0–100.

### Fight week, 1–7 days before the event

- Generate one media thread or quote/staredown post.
- Rivalries produce a more heated thread; ordinary fights produce analysis or prediction discussion.
- Generation is idempotent when time advances repeatedly or observer mode runs many days.

### Post-fight

- Generate a result news item, a recap article for notable fights, and winner/loser reactions.
- Existing events such as upset, controversial decision, injury, contract dispute, inactivity complaint, prospect hype, champion dominance, rivalry creation, and rematch demand map to appropriate normalized feed kinds.
- Rivalry intensity changes only for existing qualifying gameplay causes. Posting or repeatedly pressing a promotion action cannot manufacture rivalry intensity.

## Promotion Actions

Social Hub lists upcoming fights that still have available actions.

### Announce Matchup

- Creates one promotion post per fight.
- Produces engagement based on combined popularity, title/tournament status, and rivalry intensity.
- Does not change fighter stats or financial outcomes.

### Hype Fight

- Creates one promotion thread per fight and sets an action key so it cannot be repeated.
- Increases `socialHype` by a small amount derived from matchup quality and rivalry, clamped to 10.
- May increase each fighter's popularity by at most 1 when the matchup is competitive or has a rivalry.
- A severe OVR mismatch receives lower engagement and may lower the underdog's morale by at most 1.
- All stats remain clamped to 0–100.

Players cannot impersonate fighters or enter arbitrary post text in this version. Fighter posts remain simulation-generated.

## Social Hub UI

Rename the sidebar item **News** to **Social Hub** and render it through the existing `news` view identifier to minimize navigation and save-state churn.

The page contains:

- Filter controls: All, News, Articles, Fighter Posts, Threads.
- A primary newest-first feed.
- Cards with author/avatar, date, content type, headline/body, fighter/event tags, engagement totals, and thread replies when present.
- Clickable fighter tags opening Fighter Detail.
- Clickable event tags opening Event Builder for upcoming events; completed fight links open Fight Detail when an archive target exists.
- A desktop side column for Trending Storylines; on mobile it appears below the filters and before the feed.
- Upcoming-fight action cards for Announce Matchup and Hype Fight, hiding or disabling actions already used.
- A useful empty state explaining that content appears after booking fights, advancing time, and simulating events.

## Fighter Detail

Add a **Storylines** tab.

The tab contains:

1. Active storyline cards with type, description, intensity 1–3 where applicable, created/expiry dates, and all related fighters.
2. Clickable related fighters that navigate to their profiles.
3. A newest-first fighter activity feed filtered from `socialFeed`.
4. Resolved storyline history represented in the fighter's activity feed or career timeline; only active storylines appear in the prominent card section.

A fighter with no storylines receives a clear empty state but may still have feed activity.

## Gameplay and Economy Boundaries

- The social system reflects real bookings, outcomes, stats, and storylines; it does not invent fights or change winners.
- Automatic posts change morale/popularity by at most 1 per milestone.
- Promotion actions are idempotent and have small capped effects.
- `socialHype` contributes only a small bounded modifier to projected attendance/revenue and is cleared naturally when the fight is archived with its event.
- Rivalry remains the stronger narrative/economic signal and keeps its existing intensity, cooldown, expiry, and rematch behavior.
- Missing linked fighters/events/fights never crash the feed; cards omit invalid links and retain readable historical text.

## Testing and Verification

Use TDD with deterministic checks:

1. Migration converts legacy news, initializes new fields, preserves dates/content, deduplicates, and caps at 200.
2. Feed append and selectors sort, filter, tolerate deleted linked entities, and prefer active storylines.
3. Scheduled generation creates booking, pre-fight, fight-week, and post-fight content exactly once per stable key.
4. Content tone and engagement are deterministic for fixed state/date inputs.
5. Announce and Hype actions are idempotent; social hype and fighter stats remain clamped.
6. Economy tests prove social hype has a bounded effect and zero hype preserves previous calculations.
7. Existing rivalry creation, cooling, resolution, matchup recommendation, inbox, and tournament/calendar invariants remain valid.
8. UI contracts cover Social Hub navigation, filters, feed cards, clickable targets, promotion actions, and Fighter Detail's Storylines tab.
9. Old/new save, import/export, manager mode, and observer mode retain the feed.
10. Runtime verification on the existing Vite app at port 3000 covers desktop and mobile: Social Hub filters, active storylines, Fighter Detail tab, navigation targets, one-time promotion action, advance-time generation, and duplicate prevention.

## Exclusions

- No free-form user-authored text.
- No impersonating fighters.
- No follower graph, account management, direct messages, moderation, sponsorship posting, or sentiment-analysis subsystem.
- No external APIs, AI text-generation dependency, or new package.
- No unbounded feed history.
- No commit or push.
