# Ranking Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display consistent current, former, and rank-at-fight context across fighter and matchup UI.

**Architecture:** Add one pure rank resolver and one compact badge that read the existing ranking/title sources. Persist only optional semantic snapshots (`C`, `IC`, `#N`, `UR`) for former fighters and archived fights; pages consume the shared unit instead of recalculating rank.

**Tech Stack:** React 19, TypeScript, Zustand, Vite, Tailwind CSS, Node `assert` runnable regressions.

## Global Constraints

- Current rank labels are `C`, `IC`, `#1`–`#15`, and `UR`.
- Free agents show `Former <rank> · UR` when a former rank exists.
- Historical fight UI shows rank-at-fight and current rank without fabricating old-save snapshots.
- Do not change Elo, ranking order, title logic, matchmaking, simulation, tournament seeding, or Observer behavior.
- Add no dependency or broad page refactor.
- Preserve mobile usability and local table scrolling.
- Work directly on the dirty `main` branch as authorized; do not commit or push.

---

### Task 1: Shared rank context and badge

**Files:**
- Create: `src/components/FighterRankBadge.tsx`
- Create: `test_ranking_context.ts`
- Modify: `src/lib/game/rankings.ts`

**Interfaces:**
- Produces `RankLabel`, `getFighterRankContext(state, fighterId)`, `getFighterRankSortValue(state, fighterId)`, and `FighterRankBadge`.

- [ ] Write `test_ranking_context.ts` assertions for undisputed `C`, interim `IC`, contender numbering excluding champions, and `UR`.
- [ ] Run `npx tsx test_ranking_context.ts`; expect failure because the shared resolver does not exist.
- [ ] Implement a pure resolver that checks title state first, then derives contender position from the division ranking list excluding both champions.
- [ ] Implement `FighterRankBadge`, reading the store only at the component boundary and supporting optional `snapshot`, `former`, and `prefix` props.
- [ ] Run the focused test; expect `Ranking context contracts passed.`

Core contract:

```ts
export type RankLabel = 'C' | 'IC' | 'UR' | `#${number}`;
export function getFighterRankContext(state: Pick<GameState, 'fighters' | 'rankings' | 'titles'>, fighterId: string): { label: RankLabel; description: string; sortValue: number } | null;
export function getFighterRankSortValue(state: Pick<GameState, 'fighters' | 'rankings' | 'titles'>, fighterId: string): number;
```

---

### Task 2: Persist former and historical rank context

**Files:**
- Modify: `src/types/game.ts`
- Modify: `src/lib/game/rankings.ts`
- Modify: `src/lib/engine.ts`
- Modify: `src/lib/game/save.ts`
- Modify: `test_ranking_context.ts`
- Modify: `test_management_depth.ts`

**Interfaces:**
- Adds optional `Fighter.lastPromotionRank?: RankLabel`-compatible string.
- Adds optional `FightArchiveItem.redRankAtFight?: string` and `blueRankAtFight?: string`.

- [ ] Add failing assertions that `updateRankings` captures the previous semantic rank when a ranked fighter becomes unsigned and that event finalization snapshots both corners before later ranking movement.
- [ ] Add a failing old-save migration assertion: missing optional fields remain absent and loading succeeds.
- [ ] Run focused tests and verify failures are specifically missing former/snapshot behavior.
- [ ] Before rebuilding rankings, preserve the previous semantic label for ranked fighters that are now unsigned.
- [ ] During fight archive creation, resolve and store both pre-update rank labels.
- [ ] Increase `CURRENT_SAVE_VERSION` by one; keep migration additive and do not fabricate missing snapshots.
- [ ] Run focused tests and verify green.

---

### Task 3: Add rank context to fight and booking UI

**Files:**
- Modify: `src/pages/EventBuilder.tsx`
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/pages/EventSimulation.tsx`
- Modify: `src/pages/FightBattle.tsx`
- Modify: `src/pages/Tournaments.tsx`
- Modify: `test_ui_contracts.ts`

**Interfaces:**
- Consumes `FighterRankBadge`; tournament seed remains separate from promotion rank.

- [ ] Add failing source contracts requiring `FighterRankBadge` in all five pages and explicit rank text in tournament/fight surfaces.
- [ ] Run `npx tsx test_ui_contracts.ts`; expect failure on missing integrations.
- [ ] Add inline badges to Event Builder selectors/recommendations/comparison/card, Dashboard Next Event, Event Simulation pre/post rows, Fight Battle corners, and Tournament picker/bracket.
- [ ] Preserve names, records, OVR, title markers, seed labels, controls, and mobile wrapping.
- [ ] Run UI contracts and rank-context tests; expect green.

---

### Task 4: Add rank context to management, social, and history UI

**Files:**
- Modify: `src/pages/Roster.tsx`
- Modify: `src/pages/FreeAgents.tsx`
- Modify: `src/pages/FighterDetail.tsx`
- Modify: `src/pages/News.tsx`
- Modify: `src/pages/FightDetail.tsx`
- Modify: `src/pages/HistoryStats.tsx`
- Modify: `test_ui_contracts.ts`

**Interfaces:**
- Roster sorting uses `getFighterRankSortValue`.
- Free Agents consume `fighter.lastPromotionRank` and current `UR`.
- Fight Detail consumes archive snapshots plus current resolver output.

- [ ] Add failing source contracts for all six surfaces, Roster `rank` sort, `Former` free-agent context, and `At fight`/`Current` history labels.
- [ ] Run UI contracts and verify RED.
- [ ] Add badges beside fighter identity in Roster, Free Agents, Fighter Detail, structured Social Hub author/reference/storyline/fight controls, and History summaries.
- [ ] Add `rank` to Roster sort without adding a new wide table column.
- [ ] In Fight Detail show `At fight: —` for missing snapshots and a separate current badge.
- [ ] Do not infer rank from prose or present current rank as historical rank.
- [ ] Run focused contracts and verify GREEN.

---

### Task 5: Regression and runtime verification

**Files:**
- Modify production only if runtime evidence exposes a ranking-context defect, with a failing regression first.

- [ ] Run `npx tsx test_ranking_context.ts`, `npx tsx test_management_depth.ts`, `npx tsx test_ui_contracts.ts`, `npx tsx test_navigation.ts`, `npx tsx test_tournament.ts`, and `npx tsx test_calendar.ts`.
- [ ] Run `npm run lint` and `npm run build`.
- [ ] Drive port 3000 on desktop and `390×844`: Roster rank sort, Free Agents former/UR, Fighter Detail, Event Builder, Dashboard Next Event, Fight Battle/Event Simulation, Tournament bracket, Social Hub, and archived Fight Detail.
- [ ] Confirm no page-level horizontal overflow and that historical/current labels remain distinct.
- [ ] Report exact results and leave the dirty working tree uncommitted.
