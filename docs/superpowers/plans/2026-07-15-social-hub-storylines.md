# Social Hub and Fighter Storylines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface fighter drama/rivalries on profiles and replace News with a normalized Social Hub that generates articles, posts, threads, and bounded promotion actions.

**Architecture:** Keep `storylines` authoritative for gameplay and add `socialFeed` as the rendered/persisted content history. A focused social module normalizes existing news producers into the feed at state boundaries, generates deterministic fight milestones, exposes selectors, and applies idempotent promotion actions; this avoids rewriting dozens of stable news call sites in one risky sweep while making Social Hub the sole UI feed.

**Tech Stack:** TypeScript 5.8, React 19, Zustand 5, date-fns 4, Tailwind CSS 4, Vite 6, Node assert checks.

## Global Constraints

- Feed is newest-first, deduplicated by stable key, and capped at exactly 200 items.
- Existing storyline/rivalry lifecycle and game outcomes remain authoritative.
- Automatic stat effects are at most 1 point per milestone and clamped 0–100.
- Announce/Hype actions are one-time per fight; social hype is clamped 0–10.
- No free-form posts, fighter impersonation, external API, AI generation package, or new dependency.
- Work directly in the authorized dirty `main` working tree; do not commit or push.

---

### Task 1: Social feed model, normalization, migration, and selectors

**Files:**
- Modify: `src/types/game.ts`
- Create: `src/lib/game/social.ts`
- Modify: `src/lib/game/generator.ts`
- Modify: `src/lib/game/save.ts`
- Create: `test_social_hub.ts`

**Interfaces:**
- Produces `SocialFeedKind`, `SocialAuthorType`, `SocialReply`, `SocialFeedItem` and `GameState.socialFeed`.
- Produces `addSocialFeedItems`, `syncLegacyNewsToSocialFeed`, `getFighterSocialFeed`, and `getFighterStorylines`.

- [ ] Write failing assertions in `test_social_hub.ts` for converting generated-world news, stable-key dedupe, newest-first order, cap 200, fighter filtering, and active-storyline-first filtering.
- [ ] Run `npx tsx test_social_hub.ts`; confirm RED because social interfaces/module do not exist.
- [ ] Add the exact social types from the approved spec, optional `FightMatchup.socialHype?: number`, and `GameState.socialFeed`.
- [ ] Implement deterministic engagement from stable-key character codes (no `Math.random`), `legacy-news:<id>` conversion, immutable append/dedupe/cap, and selectors tolerant of missing linked entities.
- [ ] Initialize `socialFeed` in generated worlds by converting initial news.
- [ ] Raise `CURRENT_SAVE_VERSION` from 8 to 9; persist `socialFeed`; migrate absent feeds from legacy news; normalize missing `socialHype` to 0.
- [ ] Run `npx tsx test_social_hub.ts`; confirm GREEN.

---

### Task 2: Scheduled content and promotion actions

**Files:**
- Modify: `src/lib/game/social.ts`
- Modify: `test_social_hub.ts`

**Interfaces:**
- Produces `generateScheduledFightSocial(state, currentDate): GameState`.
- Produces `generatePostFightSocial(state, eventId): GameState`.
- Produces `applyPromotionSocialAction(state, fightId, action: 'announce' | 'hype'): GameState`.

- [ ] Add RED assertions using a fixed generated state/event: booking adds announcement/preview, 21-day date adds one fighter post, 7-day date adds one thread, repeated calls add nothing, and completed fight adds result/recap/reactions.
- [ ] Add RED assertions that Announce and Hype are idempotent, Hype clamps `socialHype <= 10`, popularity/morale remain 0–100, and mismatch engagement is lower than a balanced rivalry matchup.
- [ ] Run the check and confirm the missing exports fail.
- [ ] Implement fixed milestone windows and stable keys (`fight:<id>:booked|prefight|fight-week|result|winner-reaction|loser-reaction`). Derive post tone from rivalry, morale, champion state, popularity, and OVR gap with fixed template arrays selected from stable-key hashes.
- [ ] Implement one-time promotion keys (`fight:<id>:promotion-announce|promotion-hype`); Announce changes no stats, Hype changes social hype and at most 1 popularity/morale point.
- [ ] Run `npx tsx test_social_hub.ts`; confirm GREEN.

---

### Task 3: Integrate feed generation with time, booking, post-fight, store, and projections

**Files:**
- Modify: `src/lib/engine.ts`
- Modify: `src/store/gameStore.ts`
- Modify: `src/lib/game/economy.ts`
- Modify: `test_social_hub.ts`
- Modify: `test_management_depth.ts`

**Interfaces:**
- Consumes all Task 2 helpers.
- Produces store action `applyPromotionSocialAction(fightId, action)`.
- Makes normalized social content observable after normal manager/observer operations.

- [ ] Add RED integration checks: `advanceTime` syncs legacy news and scheduled milestones; finalizing an event creates post-fight social items; zero hype preserves baseline projected hype; hype changes projection by no more than 10 points.
- [ ] Run the social and management checks; confirm RED.
- [ ] At the end of `advanceTime`, run existing weekly storyline/news logic, then `syncLegacyNewsToSocialFeed`, then `generateScheduledFightSocial` for the resulting date.
- [ ] After event finalization/news/storyline generation, sync legacy news and generate post-fight social items.
- [ ] After manual create/update event store actions, generate booking content; add the promotion action wrapper to the Zustand store.
- [ ] Add `sum(min(10, max(0, fight.socialHype ?? 0)))`, capped to +10 event hype, before the existing final 0–100 event-hype clamp. Keep zero-hype output identical.
- [ ] Run `npx tsx test_social_hub.ts` and `npx tsx test_management_depth.ts`; confirm GREEN.

---

### Task 4: Replace News UI with Social Hub

**Files:**
- Replace: `src/pages/News.tsx`
- Modify: `src/components/AppShell.tsx`
- Modify: `test_ui_contracts.ts`

**Interfaces:**
- Consumes `socialFeed`, storylines, events, fighters, navigation, and promotion action from the store.
- Keeps the existing `news` GameView route to avoid navigation/history migration.

- [ ] Add RED UI contracts requiring sidebar label `Social Hub`, filters `All/News/Articles/Fighter Posts/Threads`, `socialFeed`, `applyPromotionSocialAction`, `Trending Storylines`, engagement, thread replies, and fighter/event navigation.
- [ ] Run `npx tsx test_ui_contracts.ts`; confirm RED on missing Social Hub.
- [ ] Change only the navigation label from News to Social Hub.
- [ ] Replace the page with a responsive two-column layout: filter buttons and feed left; trending storylines and available upcoming-fight promotion actions right (`lg:grid-cols-[minmax(0,1fr)_20rem]`), stacking naturally on mobile.
- [ ] Render author, date, kind badge, headline/body, fighter/event buttons, engagement counts, and optional replies. Omit broken links while retaining text.
- [ ] Render empty states and hide actions whose stable keys already exist.
- [ ] Run the UI contract; confirm GREEN.

---

### Task 5: Fighter Detail Storylines tab

**Files:**
- Modify: `src/pages/FighterDetail.tsx`
- Modify: `test_ui_contracts.ts`

**Interfaces:**
- Consumes `getFighterStorylines` and `getFighterSocialFeed`.
- Produces a keyboard-accessible Storylines tab with related-fighter navigation and activity history.

- [ ] Add RED UI assertions for tab label `Storylines`, selectors, intensity, expiry, related-fighter navigation, and social activity.
- [ ] Run UI contract; confirm RED.
- [ ] Add the tab to the existing keyboard-managed tab array.
- [ ] Render active storyline cards with type, description, intensity, dates, and buttons for related fighters other than the current fighter.
- [ ] Render the fighter's newest-first social activity and a clear no-storyline/no-activity state.
- [ ] Run UI contract; confirm GREEN.

---

### Task 6: Full regression and runtime verification

**Files:**
- No source changes expected unless verification identifies a defect.

**Interfaces:**
- Verifies the complete feature through deterministic checks and the running app.

- [ ] Run `npx tsx test_social_hub.ts`, `npx tsx test_management_depth.ts`, `npx tsx test_ui_contracts.ts`, `npx tsx test_calendar.ts`, and `npx tsx test_tournament.ts`.
- [ ] Run `npm run lint` and `npm run build`.
- [ ] Reuse `http://127.0.0.1:3000`; do not start another server.
- [ ] Desktop: confirm Social Hub filters, cards, engagement, trending storylines, promotion action idempotency, profile click-through, and Fighter Detail Storylines tab.
- [ ] Mobile: confirm filter/action/storyline/feed stacking, navigation drawer, fighter click-through, and no horizontal page overflow.
- [ ] Advance time through a fixed upcoming-fight milestone and confirm feed content appears exactly once after repeated navigation/refresh.
- [ ] Run `git status --short`; report exact observations and keep the dirty `main` working tree without commit/push.
