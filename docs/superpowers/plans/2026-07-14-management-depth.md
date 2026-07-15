# MMA Manager Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add balanced contract management, optional fight camps, evolving rivalries, and a derived Promotion Inbox without changing core event, title, GP, or save workflows.

**Architecture:** Extend existing persisted fighter contracts, booked matchups, and storylines with compatible optional fields. Put pure rules in small game helpers and call them from the existing engine lifecycle, simulator, economics, and UI pages. Generate Inbox items from live `GameState`; never persist read state or add a second notification store.

**Tech Stack:** TypeScript, React 19, Zustand 5, Vite, Tailwind, date-fns, standalone `npx tsx test_*.ts` assertion tests.

---

## File map

| File | Responsibility |
| --- | --- |
| `src/types/game.ts` | Persisted contract, camp, and storyline types. |
| `src/lib/game/contracts.ts` | Contract duration, expiry, negotiation, and counter-offer pure rules. |
| `src/lib/game/save.ts` | Version-7 legacy-save normalization. |
| `src/lib/engine.ts` | Daily contract/rivalry lifecycle, camp fatigue, and fight-result rivalry updates. |
| `src/lib/game/autobooker.ts` | Prevent booking fighters after their end date and create dated auto-contracts. |
| `src/lib/game/fightSimulator.ts` | Transient camp combat/injury modifiers only. |
| `src/lib/game/news.ts` | Pair-aware rivalry creation/escalation. |
| `src/lib/game/economy.ts` | Intensity-bounded rivalry hype and broadcast bonus. |
| `src/lib/game/insights.ts` | Camp labels and intensity-bounded matchmaking recommendations. |
| `src/lib/game/inbox.ts` | New pure, self-clearing Inbox selector. |
| `src/store/gameStore.ts` | Dated sign/renew mutations and `inbox` view support. |
| `src/pages/FighterDetail.tsx` | Counter-offer and contract-expiry actions. |
| `src/pages/EventBuilder.tsx` | Default camp assignment and per-bout camp controls. |
| `src/pages/Inbox.tsx` | New priority-sorted action list. |
| `src/pages/Dashboard.tsx` | Replace duplicated alerts with Inbox preview. |
| `src/App.tsx`, `src/components/AppShell.tsx` | Inbox lazy route and nav entry. |
| `test_management_depth.ts` | Pure lifecycle, camp, rivalry, Inbox, and migration regression coverage. |
| `test_ui_contracts.ts` | Source/UI contract assertions for Inbox/camp controls. |

### Fixed product constants

Use these values throughout; do not introduce configurable sliders:

```ts
export const CONTRACT_DAYS_PER_FIGHT = 180;
export const CONTRACT_MIN_DAYS = 180;
export const CONTRACT_MAX_DAYS = 1080;
export const CONTRACT_EXPIRING_DAYS = 30;
export const COUNTER_OFFER_DAYS = 14;
export const RIVALRY_MAX_INTENSITY = 3;
export const RIVALRY_COOLDOWN_DAYS = 90;
export const RIVALRY_EXPIRY_DAYS = 180;
```

- New/renewed contract end date: `currentDate + clamp(fights * 180, 180, 1080)` days.
- Legacy contract end date: `currentDate + max(90, fightsRemaining * 180)` days.
- Camps: striking/wrestling +3% relevant combat stats and +5 fatigue; cardio +4% cardio and -5 fatigue; recovery no combat bonus, -10 fatigue, injury multiplier 0.85; balanced does nothing.
- Rivalry projection bonus by intensity: `3`, `6`, `9` hype. Broadcast bonus: `2%`, `4%`, `6%` only if the pair fights on the card.
- Dashboard preview: first five derived Inbox items.

---

### Task 1: Persist compatible management metadata

**Files:**
- Modify: `src/types/game.ts:26-45,102-114`
- Test: `test_management_depth.ts`

- [ ] **Step 1: Write the failing model assertions**

Create `test_management_depth.ts` with the shared fixture imports and assertions that will compile only after the types exist:

```ts
import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { getContractEndDate } from './src/lib/game/contracts';

const state = generateInitialWorld();
const fighter = Object.values(state.fighters).find(candidate => candidate.contract)!;
assert.equal(typeof fighter.contract!.endDate, 'string');
assert.equal(getContractEndDate('2026-01-01', 2), '2026-12-27');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx test_management_depth.ts`

Expected: TypeScript failure because `endDate` and `getContractEndDate` do not exist.

- [ ] **Step 3: Add types without changing existing game semantics**

In `src/types/game.ts`, replace the existing contract declaration with these definitions:

```ts
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
```

Add this property to `FightMatchup`:

```ts
campFocus?: FightCampFocus;
```

Extend `Storyline` with compatible optional metadata:

```ts
intensity?: number;
createdDate?: string;
expiresDate?: string;
resolvedDate?: string;
```

- [ ] **Step 4: Add dated initial contracts**

In `src/lib/game/generator.ts`, import `getContractEndDate` and set each initial generated contract with:

```ts
endDate: getContractEndDate('2025-01-01', 4)
```

Use the generator’s actual initial date value if it differs; do not hard-code a different game date.

- [ ] **Step 5: Run the focused test**

Run: `npx tsx test_management_depth.ts`

Expected: PASS for model assertions.

- [ ] **Step 6: Check the focused change**

Run:

```bash
git diff --check
git diff -- src/types/game.ts src/lib/game/generator.ts test_management_depth.ts
```

Expected: no whitespace errors; only the intended model metadata and assertions change.

---

### Task 2: Migrate legacy saves safely

**Files:**
- Modify: `src/lib/game/save.ts:6,85-228`
- Test: `test_management_depth.ts`

- [ ] **Step 1: Add failing legacy-save assertions**

Append to `test_management_depth.ts`:

```ts
import { validateAndMigrateState } from './src/lib/game/save';

const legacy = generateInitialWorld() as any;
legacy.saveVersion = 6;
const legacyFighter = Object.values(legacy.fighters).find((candidate: any) => candidate.contract) as any;
delete legacyFighter.contract.endDate;
legacy.events = Object.fromEntries(Object.entries(legacy.events).map(([id, event]: [string, any]) => [id, {
  ...event,
  fights: event.fights.map((fight: any) => ({ ...fight, campFocus: undefined }))
}]));
const migrated = validateAndMigrateState(legacy)!;
const migratedFighter = Object.values(migrated.fighters).find(candidate => candidate.contract)!;
assert.ok(migratedFighter.contract!.endDate >= migrated.currentDate);
assert.equal(migrated.saveVersion, 7);
```

- [ ] **Step 2: Run to verify failure**

Run: `npx tsx test_management_depth.ts`

Expected: failure because `validateAndMigrateState` does not normalize end dates or save version 7.

- [ ] **Step 3: Implement version-7 normalization**

In `src/lib/game/save.ts`:

1. Change `CURRENT_SAVE_VERSION` from `6` to `7`.
2. Export `validateAndMigrateState` so the standalone test can call it.
3. Add a helper above it:

```ts
function normalizeContract(contract: any, currentDate: string): Contract | null {
  if (!contract || typeof contract !== 'object') return null;
  const fightsRemaining = Math.max(0, Number(contract.fightsRemaining) || 0);
  const endDate = typeof contract.endDate === 'string' && !Number.isNaN(Date.parse(contract.endDate))
    ? contract.endDate
    : addDays(new Date(currentDate), Math.max(90, fightsRemaining * CONTRACT_DAYS_PER_FIGHT)).toISOString().slice(0, 10);
  const counterOffer = contract.counterOffer && typeof contract.counterOffer === 'object' && typeof contract.counterOffer.expiresDate === 'string'
    ? contract.counterOffer
    : undefined;
  return { ...contract, fightsRemaining, endDate, counterOffer };
}
```

Import `addDays`, `Contract`, and `CONTRACT_DAYS_PER_FIGHT`. During the existing fighter repair loop assign `fighter.contract = normalizeContract(fighter.contract, state.currentDate)`.

Normalize each live event fight with:

```ts
campFocus: ['balanced', 'striking', 'wrestling', 'cardio', 'recovery'].includes(fight.campFocus) ? fight.campFocus : 'balanced'
```

Do not add Inbox data to saves. Preserve legacy storylines; only remove malformed optional metadata values.

- [ ] **Step 4: Run migration test**

Run: `npx tsx test_management_depth.ts`

Expected: PASS.

- [ ] **Step 5: Check migration scope**

Run:

```bash
git diff --check
git diff -- src/lib/game/save.ts test_management_depth.ts
```

Expected: the diff only changes save normalization and its coverage.

---

### Task 3: Add contract dates and one-step negotiation

**Files:**
- Modify: `src/lib/game/contracts.ts:1-78`
- Modify: `src/store/gameStore.ts:452-501`
- Modify: `src/lib/game/autobooker.ts:345-356,1016-1053`
- Modify: `src/pages/FighterDetail.tsx:24-80,151-158`
- Test: `test_management_depth.ts`

- [ ] **Step 1: Add failing contract-rule tests**

Append:

```ts
import { createCounterOffer, getContractStatus, getContractEndDate } from './src/lib/game/contracts';

assert.equal(getContractEndDate('2026-01-01', 1), '2026-06-30');
assert.equal(getContractStatus({ fightsRemaining: 2, payPerFight: 1, winBonus: 1, exclusivity: true, endDate: '2026-01-20' }, '2026-01-01'), 'expiring');
assert.equal(getContractStatus({ fightsRemaining: 0, payPerFight: 1, winBonus: 1, exclusivity: true, endDate: '2027-01-01' }, '2026-01-01'), 'expired');
const counter = createCounterOffer(10000, 5000, 3, 75, '2026-01-01');
assert.equal(counter.expiresDate, '2026-01-15');
assert.ok(counter.payPerFight >= 10000);
```

- [ ] **Step 2: Run to verify failure**

Run: `npx tsx test_management_depth.ts`

Expected: failure for missing contract helpers.

- [ ] **Step 3: Implement pure contract helpers**

In `src/lib/game/contracts.ts`, export:

```ts
export type ContractStatus = 'active' | 'expiring' | 'expired';

export function getContractEndDate(currentDate: string, fights: number): string {
  const days = Math.min(CONTRACT_MAX_DAYS, Math.max(CONTRACT_MIN_DAYS, fights * CONTRACT_DAYS_PER_FIGHT));
  return addDays(new Date(currentDate), days).toISOString().slice(0, 10);
}

export function getContractStatus(contract: Contract, currentDate: string): ContractStatus {
  if (contract.fightsRemaining <= 0 || contract.endDate < currentDate) return 'expired';
  const daysRemaining = differenceInCalendarDays(new Date(contract.endDate), new Date(currentDate));
  return contract.fightsRemaining <= 1 || daysRemaining <= CONTRACT_EXPIRING_DAYS ? 'expiring' : 'active';
}

export function createCounterOffer(basePay: number, winBonus: number, fights: number, interest: number, currentDate: string): ContractCounterOffer {
  return {
    payPerFight: Math.round(basePay * 1.05 / 1000) * 1000,
    winBonus: Math.round(winBonus * 1.05 / 1000) * 1000,
    fights,
    expiresDate: addDays(new Date(currentDate), COUNTER_OFFER_DAYS).toISOString().slice(0, 10),
    interest
  };
}
```

Update `evaluateOffer` to return a discriminated result:

```ts
{ accepted: true, reason: string } | { accepted: false, reason: string, counterOffer?: ContractCounterOffer }
```

Only create a counter-offer for credible failed offers: `(offerPay + offerBonus) / (expected.basePay + expected.winBonus) >= 0.8` or `(expectation.interest >= 60 && ratio >= 0.7)`.

- [ ] **Step 4: Write dated contracts through every creation path**

Update `signFighter` and `renewFighter` to take the current state date and assign:

```ts
endDate: getContractEndDate(get().currentDate, fights),
lastNegotiationDate: get().currentDate,
counterOffer: undefined
```

Update every auto-booker contract literal to include `endDate: getContractEndDate(state.currentDate, fights)` with its existing fight count.

- [ ] **Step 5: Add the Fighter Detail counter-offer interaction**

Keep existing local offer fields. In `handleSign`, if a rejected result includes a counter-offer, show it rather than calling sign/renew. Add an “Accept counter-offer” button that calls the existing sign/renew action with the returned pay, bonus, and fights. Clear the displayed counter-offer after acceptance or after its `expiresDate` has passed.

Render the contract end date and expiring state beside existing fights/pay information. Do not add a separate negotiation page.

- [ ] **Step 6: Run focused checks**

Run: `npx tsx test_management_depth.ts && npm run lint`

Expected: PASS.

- [ ] **Step 7: Check contract behavior scope**

Run:

```bash
git diff --check
git diff -- src/lib/game/contracts.ts src/store/gameStore.ts src/lib/game/autobooker.ts src/pages/FighterDetail.tsx test_management_depth.ts
```

Expected: no unrelated booking, store, or UI changes.

---

### Task 4: Enforce expiry, morale pressure, and booking safety

**Files:**
- Modify: `src/lib/engine.ts:202-258,634-656`
- Modify: `src/lib/game/autobooker.ts:615-630,1129-1137,1216-1223`
- Test: `test_management_depth.ts`

- [ ] **Step 1: Add failing lifecycle tests**

Append:

```ts
import { advanceTime } from './src/lib/engine';

const expiryState = generateInitialWorld();
const expiring = Object.values(expiryState.fighters).find(candidate => candidate.contract)!;
expiryState.fighters[expiring.id] = { ...expiring, contract: { ...expiring.contract!, fightsRemaining: 2, endDate: '2025-01-01' } };
const afterExpiry = advanceTime(expiryState, 1);
assert.equal(afterExpiry.fighters[expiring.id].contract, null);

const moraleState = generateInitialWorld();
const idle = Object.values(moraleState.fighters).find(candidate => candidate.contract)!;
moraleState.fighters[idle.id] = { ...idle, morale: 60, contract: { ...idle.contract!, fightsRemaining: 1, endDate: '2025-01-20' } };
const afterPressure = advanceTime(moraleState, 7);
assert.ok(afterPressure.fighters[idle.id].morale < 60);
```

- [ ] **Step 2: Run to verify failure**

Run: `npx tsx test_management_depth.ts`

Expected: expiry date and morale assertions fail.

- [ ] **Step 3: Apply date expiry during time advancement**

In the existing fighter loop in `advanceTime`, use `getContractStatus`.

- If a non-champion contract is expired, set `contract: null` and create one `contract` news item.
- If a champion contract is expired, retain it and add no duplicate news within 30 days.
- If a contract is expiring and the fighter has not fought in 90 days, reduce morale by `1` per seven advanced days, clamped to a minimum of `35`.
- Clear a `counterOffer` if `counterOffer.expiresDate < newState.currentDate`.

Retain existing fight-count expiry logic in `applyFightResult`, but make it call the same status rule after decrementing fights so date and fight expiry cannot diverge.

- [ ] **Step 4: Prevent invalid future bookings**

Add a small helper in `autobooker.ts`:

```ts
function hasContractThrough(fighter: Fighter, eventDate: string): boolean {
  return !!fighter.contract && fighter.contract.fightsRemaining > 0 && fighter.contract.endDate >= eventDate;
}
```

Use it in the normal candidate, replacement, and rebuild-card filters. Do not remove existing health/fatigue checks.

- [ ] **Step 5: Run focused checks**

Run: `npx tsx test_management_depth.ts && npx tsx test_calendar.ts`

Expected: PASS.

- [ ] **Step 6: Check lifecycle scope**

Run:

```bash
git diff --check
git diff -- src/lib/engine.ts src/lib/game/autobooker.ts test_management_depth.ts
```

Expected: expiry and booking-safety behavior only; existing health and calendar safeguards remain intact.

---

### Task 5: Add optional camps with bounded fight effects

**Files:**
- Modify: `src/pages/EventBuilder.tsx:53-67,136-209,234-354,545-654`
- Modify: `src/lib/game/fightSimulator.ts:66-1113`
- Modify: `src/lib/engine.ts:442-443`
- Modify: `src/lib/game/insights.ts:47-84`
- Test: `test_management_depth.ts`

- [ ] **Step 1: Add failing camp tests**

Append deterministic assertions using the existing seeded simulator:

```ts
import { simulateFight } from './src/lib/game/fightSimulator';

const campState = generateInitialWorld();
const [red, blue] = Object.values(campState.fighters).filter(candidate => candidate.contract).slice(0, 2);
const balanced = { id: 'balanced', redCornerId: red.id, blueCornerId: blue.id, weightClass: red.weightClass, isTitleFight: false, rounds: 3, campFocus: 'balanced' as const };
const striking = { ...balanced, id: 'striking', campFocus: 'striking' as const };
assert.deepEqual(red.attributes, JSON.parse(JSON.stringify(red.attributes)));
assert.notDeepEqual(simulateFight(balanced, red, blue, 44).roundStats, simulateFight(striking, red, blue, 44).roundStats);
assert.deepEqual(red.attributes, JSON.parse(JSON.stringify(red.attributes)));
```

Also assert a new Event Builder-created fight gets `campFocus: 'balanced'` through an exported pure helper if one is needed.

- [ ] **Step 2: Run to verify failure**

Run: `npx tsx test_management_depth.ts`

Expected: camp focus has no simulator effect or construction default.

- [ ] **Step 3: Add default camp construction and controls**

Ensure every Event Builder fight creation path includes:

```ts
campFocus: 'balanced'
```

Add one compact select per booked fight:

```tsx
<Select
  value={fight.campFocus ?? 'balanced'}
  onChange={campFocus => updateFight(index, { ...fight, campFocus: campFocus as FightCampFocus })}
  options={campOptions}
/>
```

Use existing state update patterns; do not add a camp store. Show a short label in the card preview using a pure `getCampSummary` helper.

- [ ] **Step 4: Apply transient simulation modifiers**

In `fightSimulator.ts`, create a local cloned effective-stat object before simulation. Apply:

```ts
const CAMP_MULTIPLIERS: Record<FightCampFocus, Partial<FighterAttributes>> = {
  balanced: {},
  striking: { striking: 1.03, power: 1.03 },
  wrestling: { wrestling: 1.03, grappling: 1.03, submissions: 1.03 },
  cardio: { cardio: 1.04 },
  recovery: {}
};
```

Apply those multipliers only to local simulator values. At injury generation, multiply only recovery injury chance by `0.85`. Do not mutate either `Fighter` input.

In `applyFightResult`, add camp fatigue after existing base fatigue:

```ts
const CAMP_FATIGUE: Record<FightCampFocus, number> = { balanced: 0, striking: 5, wrestling: 5, cardio: -5, recovery: -10 };
```

Clamp fatigue to `0..100`.

- [ ] **Step 5: Run camp and existing simulation tests**

Run: `npx tsx test_management_depth.ts && npx tsx test_long_sim.ts`

Expected: PASS and zero tournament/calendar invariant errors.

- [ ] **Step 6: Check camp scope**

Run:

```bash
git diff --check
git diff -- src/pages/EventBuilder.tsx src/lib/game/fightSimulator.ts src/lib/engine.ts src/lib/game/insights.ts test_management_depth.ts
```

Expected: camp-only modifiers are transient and no permanent fighter attributes are written.

---

### Task 6: Make rivalries pair-aware and time-bound

**Files:**
- Modify: `src/lib/game/news.ts:48-181,186-242`
- Modify: `src/lib/engine.ts:202-293,375-672`
- Modify: `src/lib/game/economy.ts:131-150,258-368`
- Modify: `src/lib/game/insights.ts:86-109`
- Test: `test_management_depth.ts`

- [ ] **Step 1: Add failing rivalry tests**

Append:

```ts
import { updateRivalryAfterFight, coolRivalries } from './src/lib/game/news';

const rivalryState = generateInitialWorld();
const [first, second] = Object.values(rivalryState.fighters).slice(0, 2);
const escalated = updateRivalryAfterFight(rivalryState, [first.id, second.id], '2026-01-01', true, false);
assert.equal(escalated.storylines.filter(item => item.type === 'Rivalry' && item.isActive).length, 1);
assert.equal(escalated.storylines.find(item => item.type === 'Rivalry')!.intensity, 1);
const intensified = updateRivalryAfterFight(escalated, [second.id, first.id], '2026-01-15', true, false);
assert.equal(intensified.storylines.find(item => item.type === 'Rivalry')!.intensity, 2);
const resolved = updateRivalryAfterFight(intensified, [first.id, second.id], '2026-02-01', true, true);
assert.equal(resolved.storylines.find(item => item.type === 'Rivalry')!.resolvedDate, '2026-02-01');
assert.equal(coolRivalries(intensified, '2026-07-15').storylines.find(item => item.type === 'Rivalry')!.isActive, false);
```

- [ ] **Step 2: Run to verify failure**

Run: `npx tsx test_management_depth.ts`

Expected: missing pair-aware helpers.

- [ ] **Step 3: Implement pair identity, escalation, resolution, and cooling**

In `news.ts`, export a stable pair key:

```ts
export function getPairKey(fighterIds: string[]): string {
  return [...fighterIds].sort().join(':');
}
```

Export `updateRivalryAfterFight(state, fighterIds, currentDate, qualifies, isRematch)`:

- Ignore `qualifies === false`.
- Find one active rivalry by `getPairKey`.
- Create it at intensity 1 with `createdDate` and `expiresDate = +180 days` if absent.
- Raise an existing non-rematch intensity by one up to three and refresh expiry.
- If `isRematch` is true for a pre-existing rivalry pair, mark it inactive and set `resolvedDate` after recording its escalation/news outcome for that fight.

Export `coolRivalries(state, currentDate)`:

- Every 90 days after `createdDate`, lower intensity by one.
- Mark inactive when intensity reaches zero or `expiresDate < currentDate`.

Call cooling from `advanceTime`. Call escalation/resolution after result application using result quality: high performance, decisive upset, close decision/rematch. Keep existing non-rivalry storyline rules intact.

- [ ] **Step 4: Apply bounded commercial and recommendation bonuses**

Replace fixed rivalry hype with:

```ts
const intensity = Math.min(3, Math.max(1, storyline.intensity ?? 1));
eventHype += intensity * 3;
```

In financials, find the maximum active direct-pair intensity on the card and multiply broadcast revenue by `1 + intensity * 0.02` only once. In recommendations, add `intensity * 5` instead of the fixed rivalry score.

- [ ] **Step 5: Run rivalry and economics checks**

Run: `npx tsx test_management_depth.ts && npx tsx test_insights.ts`

Expected: PASS.

- [ ] **Step 6: Check rivalry scope**

Run:

```bash
git diff --check
git diff -- src/lib/game/news.ts src/lib/engine.ts src/lib/game/economy.ts src/lib/game/insights.ts test_management_depth.ts
```

Expected: only pair-specific, bounded rivalry effects change; title, ranking, record, and GP progression rules remain unchanged.

---

### Task 7: Build the derived Promotion Inbox

**Files:**
- Create: `src/lib/game/inbox.ts`
- Create: `src/pages/Inbox.tsx`
- Modify: `src/types/game.ts`
- Modify: `src/store/gameStore.ts:22-30`
- Modify: `src/App.tsx:9-75`
- Modify: `src/components/AppShell.tsx:21-48`
- Modify: `src/pages/Dashboard.tsx:62-221,357-387`
- Test: `test_management_depth.ts`, `test_ui_contracts.ts`

- [ ] **Step 1: Add failing Inbox selector tests**

Append:

```ts
import { getPromotionInbox } from './src/lib/game/inbox';

const inboxState = generateInitialWorld();
const inboxFighter = Object.values(inboxState.fighters).find(candidate => candidate.contract)!;
inboxState.fighters[inboxFighter.id] = { ...inboxFighter, contract: { ...inboxFighter.contract!, fightsRemaining: 1, endDate: '2026-01-20' } };
const inbox = getPromotionInbox(inboxState);
assert.equal(inbox[0].severity, 'urgent');
assert.equal(inbox[0].fighterId, inboxFighter.id);
const renewed = { ...inboxState, fighters: { ...inboxState.fighters, [inboxFighter.id]: { ...inboxState.fighters[inboxFighter.id], contract: { ...inboxState.fighters[inboxFighter.id].contract!, fightsRemaining: 3, endDate: '2027-01-01' } } } };
assert.equal(getPromotionInbox(renewed).some(item => item.fighterId === inboxFighter.id), false);
```

- [ ] **Step 2: Run to verify failure**

Run: `npx tsx test_management_depth.ts`

Expected: missing Inbox module.

- [ ] **Step 3: Add pure Inbox contracts and selector**

In `src/lib/game/inbox.ts`, define the selector-owned types to avoid importing the Zustand view union into persisted game types:

```ts
export type InboxSeverity = 'critical' | 'urgent' | 'opportunity';
export type InboxTargetView = 'fighter-detail' | 'event-builder' | 'calendar' | 'tournaments' | 'free-agents' | 'roster';
export interface InboxItem {
  id: string;
  severity: InboxSeverity;
  title: string;
  description: string;
  fighterId?: string;
  eventId?: string;
  calendarSlotId?: string;
  targetView: InboxTargetView;
  priority: number;
  date?: string;
}
```

Create `getPromotionInbox(state)` in `src/lib/game/inbox.ts`. Derive only current conditions:

- expired champion contract;
- title-shot debt;
- GP diagnosis block/delay;
- due/empty event;
- expiring contract and counter-offer deadline;
- unavailable booked fighter;
- high-intensity active rivalry;
- thin division/strong free-agent opportunity.

Sort by severity rank (`critical`, `urgent`, `opportunity`), then descending `priority`, then ascending `date`, then title. Never mutate `state`, add news, or persist an item.

- [ ] **Step 4: Wire the Inbox navigation and page**

Add `inbox` to `GameView`, App lazy import/switch, and the Promotion group in `AppShell`.

`Inbox.tsx` should render current items with existing `PageHeader`, `Panel`, `StatusBadge`, and `Button`. Its action must use existing navigation only:

```tsx
<Button onClick={() => setView(item.targetView, { fighterId: item.fighterId, eventId: item.eventId, calendarSlotId: item.calendarSlotId })}>
  Review
</Button>
```

Pass only defined data values, matching the current `setView` pattern. Include `goBack('dashboard')` in page header actions.

- [ ] **Step 5: Replace Dashboard duplicate alerts with preview**

Remove the local alert construction. Use:

```ts
const inboxItems = useMemo(() => getPromotionInbox(gameState), [gameState]);
const inboxPreview = inboxItems.slice(0, 5);
```

Render preview cards using the same action route and a “View all decisions” button to `setView('inbox')`. Keep unrelated finance, calendar, and news panels unchanged.

- [ ] **Step 6: Add source-contract coverage**

In `test_ui_contracts.ts`, read `App.tsx`, `AppShell.tsx`, `Dashboard.tsx`, and `EventBuilder.tsx`; assert strings `case 'inbox'`, `view: 'inbox'`, `getPromotionInbox`, and `campFocus` are present.

- [ ] **Step 7: Run Inbox/UI tests**

Run: `npx tsx test_management_depth.ts && npx tsx test_ui_contracts.ts && npm run lint`

Expected: PASS.

- [ ] **Step 8: Check Inbox scope**

Run:

```bash
git diff --check
git diff -- src/types/game.ts src/lib/game/inbox.ts src/pages/Inbox.tsx src/store/gameStore.ts src/App.tsx src/components/AppShell.tsx src/pages/Dashboard.tsx test_management_depth.ts test_ui_contracts.ts
```

Expected: Inbox remains a derived selector with navigation-only actions; no persisted read or dismissal state exists.

---

### Task 8: Full integration verification and manual UI pass

**Files:**
- Modify only if a failing test reveals a direct defect in the implemented scope.
- Test: all affected root tests.

- [ ] **Step 1: Run focused regression suite**

Run:

```bash
npx tsx test_management_depth.ts
npx tsx test_insights.ts
npx tsx test_calendar.ts
npx tsx test_tournament.ts
npx tsx test_long_sim.ts
npx tsx test_ui_contracts.ts
npm run lint
npm run build
```

Expected: every command exits 0; long simulation reports zero calendar integrity errors, zero tournament invariant errors, zero title-shot debt errors, and zero crashes.

- [ ] **Step 2: Perform manual browser validation**

Start the existing local app and verify:

1. Sign a free agent; confirm end date is shown and export/import retains it.
2. Make a credible low offer; confirm one counter-offer appears, can be accepted, and expires after time advancement.
3. Advance past a non-champion end date; confirm the fighter becomes a free agent. Repeat with a champion; confirm they remain a critical renewal decision.
4. Book a fight; confirm both camps default to Balanced, change one camp, and see its label in the card preview.
5. Simulate the event; confirm no fighter attribute is permanently altered and fatigue reflects camp choice.
6. Create or use a rivalry/rematch; confirm increased recommendation/projection effect and resolution after direct rematch.
7. Open Inbox; confirm critical items are first, actions navigate to correct pages, and a renewed/repaired condition vanishes from the list.
8. Verify mobile width: Inbox is reachable in compact navigation and action cards remain readable.

- [ ] **Step 3: Review diff scope**

Run:

```bash
git diff --check
git diff --stat
git status --short
```

Expected: no whitespace errors and only scoped management-depth files changed. Do not commit, push, or discard any changes unless the user explicitly asks.
