# English and Vietnamese i18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add immediate English/Vietnamese switching across every reachable UI and make newly generated game prose use the selected locale without changing save data or simulation outcomes.

**Architecture:** One bundled i18next instance serves React through `react-i18next` and pure game modules through fixed translators. Language is an app-wide localStorage setting; stable game enums remain English and are translated only at presentation boundaries. Generated prose captures one locale per operation and remains a plain persisted string.

**Tech Stack:** React 19, TypeScript 5.8, Zustand 5, Vite 6, i18next 26.3.6, react-i18next 17.0.10, native `Intl`, Node assert scripts, Playwright browser audit.

## Global Constraints

- Support exactly `en` and `vi`; fall back to `en`.
- Detect Vietnamese from browser preferences only when no stored preference exists.
- Keep language app-wide in localStorage; do not modify `GameState`, save version, export, or import.
- Keep USD values and proper nouns unchanged.
- Translate MMA terminology as fully as practical while retaining standard abbreviations such as KO/TKO.
- Existing persisted prose keeps its original language; newly generated prose uses one captured locale per operation.
- Translation must not consume RNG or affect game branches, results, rankings, finances, or scheduling.
- Ignore untracked `.superpowers/` and `belt/` directories.
- Do not commit implementation unless the user explicitly requests another commit.

---

## File Structure

**Create:**

- `src/i18n/index.ts` — initializes and exports the shared i18next instance.
- `src/i18n/resources/en.ts` — canonical typed English resources.
- `src/i18n/resources/vi.ts` — Vietnamese resources constrained to the English key tree.
- `src/i18n/types.d.ts` — react-i18next/i18next TypeScript resource augmentation.
- `src/lib/localization.ts` — language detection/persistence, locale-aware formatters, stable domain display maps, and fixed translator helpers.
- `test_i18n.ts` — runnable translation, persistence, fallback, formatting, domain mapping, and determinism contracts.

**Modify:**

- `package.json`, `package-lock.json` — add only `i18next` and `react-i18next`.
- `src/main.tsx` — import i18n initialization before rendering.
- `src/store/settingsStore.ts`, `src/pages/Settings.tsx` — app-wide language preference and controls.
- `src/App.tsx`, `src/components/AppShell.tsx`, `src/components/Select.tsx`, `src/components/ChampionshipBelt.tsx`, `src/components/FighterRankBadge.tsx` — global chrome and accessibility text.
- Every file in `src/pages/*.tsx` — reachable page text and localized formatting.
- `src/lib/engine.ts`, `src/lib/game/liveFight.ts`, `src/lib/game/news.ts`, `src/lib/game/social.ts`, `src/lib/game/inbox.ts`, `src/lib/game/economy.ts`, `src/lib/game/contracts.ts`, `src/lib/game/tournament.ts`, `src/lib/game/observer.ts`, `src/lib/game/autobooker.ts`, `src/lib/game/insights.ts`, `src/lib/game/fighterAchievements.ts` — newly generated prose.
- Relevant `test_*.ts` source contracts — use translation keys/translated output instead of requiring hard-coded English at call sites.

---

### Task 1: Shared i18n Core and Language Persistence

**Files:**
- Create: `src/i18n/index.ts`
- Create: `src/i18n/resources/en.ts`
- Create: `src/i18n/resources/vi.ts`
- Create: `src/i18n/types.d.ts`
- Create: `src/lib/localization.ts`
- Create: `test_i18n.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/main.tsx`
- Modify: `src/store/settingsStore.ts`
- Modify: `src/pages/Settings.tsx`

**Interfaces:**
- Produces: `Language = 'en' | 'vi'`.
- Produces: `detectLanguage(languages?: readonly string[]): Language`.
- Produces: `readLanguage(storage?, languages?): Language` and `writeLanguage(language, storage?): void`.
- Produces: `localeFor(language): 'en-US' | 'vi-VN'`.
- Produces: `formatDate`, `formatNumber`, `formatCurrency`.
- Produces: `fixedT(language)` returning an i18next fixed translator.
- Produces: `useSettingsStore().language` and `setLanguage(language)`.

- [ ] **Step 1: Install only the approved dependencies**

Run:

```bash
npm install i18next@26.3.6 react-i18next@17.0.10
```

Expected: `package.json` and `package-lock.json` contain both runtime dependencies and no detector/backend package.

- [ ] **Step 2: Write failing core contracts**

Create `test_i18n.ts` with assertions equivalent to:

```ts
assert.equal(detectLanguage(['vi-VN', 'en-US']), 'vi');
assert.equal(detectLanguage(['fr-FR', 'en-US']), 'en');
assert.equal(readLanguage({ getItem: () => 'vi' }, ['en-US']), 'vi');
assert.equal(readLanguage({ getItem: () => 'invalid' }, ['vi-VN']), 'vi');
assert.equal(fixedT('en')('common.save'), 'Save');
assert.equal(fixedT('vi')('common.save'), 'Lưu');
assert.notEqual(fixedT('en')('fight.method.submission'), fixedT('vi')('fight.method.submission'));
assert.deepEqual(flattenKeys(en), flattenKeys(vi));
assert.match(formatCurrency(1250000, 'vi'), /1[.\s]250[.\s]000/);
```

Also assert a blocked storage implementation does not throw and that an unsupported locale falls back to English.

- [ ] **Step 3: Run the test and verify RED**

Run:

```bash
npx tsx test_i18n.ts
```

Expected: FAIL because the i18n modules do not exist.

- [ ] **Step 4: Implement minimal initialization and persistence**

Initialize bundled resources synchronously:

```ts
i18n.use(initReactI18next).init({
  lng: readLanguage(),
  fallbackLng: 'en',
  supportedLngs: ['en', 'vi'],
  load: 'languageOnly',
  resources: { en: { translation: en }, vi: { translation: vi } },
  interpolation: { escapeValue: false },
  react: { useSuspense: false }
});
```

Use English as the canonical resource type and constrain Vietnamese to the same recursive shape. Implement safe localStorage access and `Intl` formatters. Import `src/i18n/index.ts` once from `src/main.tsx`.

Extend settings store:

```ts
type SettingsStore = {
  unitSystem: UnitSystem;
  language: Language;
  setUnitSystem(unitSystem: UnitSystem): void;
  setLanguage(language: Language): void;
};
```

`setLanguage` writes storage, calls `i18n.changeLanguage(language)`, updates `<html lang>`, and updates Zustand. Add English/Tiếng Việt radio controls to Settings.

- [ ] **Step 5: Verify core GREEN**

Run:

```bash
npx tsx test_i18n.ts
npm run lint
```

Expected: translation contracts pass and TypeScript exits zero.

---

### Task 2: Shared Chrome, Domain Labels, and Formatting

**Files:**
- Modify: `src/i18n/resources/en.ts`
- Modify: `src/i18n/resources/vi.ts`
- Modify: `src/lib/localization.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/AppShell.tsx`
- Modify: `src/components/Select.tsx`
- Modify: `src/components/ChampionshipBelt.tsx`
- Modify: `src/components/FighterRankBadge.tsx`
- Modify: `src/pages/Settings.tsx`
- Modify: `test_i18n.ts`
- Modify: `test_ui_contracts.ts`

**Interfaces:**
- Consumes: shared i18next instance and settings language from Task 1.
- Produces: stable domain display helpers `formatWeightClass`, `formatFighterStyle`, `formatFightMethod`, `formatTournamentStatus`, `formatTitleFightType`, and `formatReadiness`.

- [ ] **Step 1: Add failing domain and shell contracts**

Assert representative stable values remain unchanged while display strings differ:

```ts
const method = 'Unanimous Decision';
assert.equal(method, 'Unanimous Decision');
assert.equal(formatFightMethod(method, 'vi'), 'Quyết định đồng thuận');
assert.equal(formatWeightClass('Lightweight', 'vi'), 'Hạng nhẹ');
```

Update UI source contracts to require `useTranslation`, translated navigation labels, translated accessible labels, and no hard-coded user-facing Vietnamese ternaries.

- [ ] **Step 2: Run RED**

Run:

```bash
npx tsx test_i18n.ts
npx tsx test_ui_contracts.ts
```

Expected: FAIL on absent domain helpers and untranslated shell contracts.

- [ ] **Step 3: Translate shared chrome and domain maps**

Use `useTranslation()` in App/AppShell/Settings and pass translated strings to dumb UI components. Keep navigation identity stable by separating `labelKey` from `view`. Move quick-search placeholder, utility actions, confirmations, drawer labels, and status/accessibility text into resources.

Implement domain maps against stable enum/string inputs; never return translated strings to game logic.

- [ ] **Step 4: Run GREEN**

Run:

```bash
npx tsx test_i18n.ts
npx tsx test_ui_contracts.ts
npx tsx test_navigation.ts
npm run lint
```

Expected: all commands pass.

---

### Task 3: Management Pages

**Files:**
- Modify: `src/i18n/resources/en.ts`
- Modify: `src/i18n/resources/vi.ts`
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/pages/Inbox.tsx`
- Modify: `src/pages/Calendar.tsx`
- Modify: `src/pages/EventBuilder.tsx`
- Modify: `src/pages/Roster.tsx`
- Modify: `src/pages/Rankings.tsx`
- Modify: `src/pages/Tournaments.tsx`
- Modify: `src/pages/FreeAgents.tsx`
- Modify: `src/pages/MmaGuide.tsx`
- Modify: relevant `test_*.ts` contracts

**Interfaces:**
- Consumes: `useTranslation`, locale formatters, and domain display helpers.
- Produces: fully bilingual primary management flow without changing stored values or booking behavior.

- [ ] **Step 1: Add failing management-page contracts**

Extend `test_i18n.ts` and relevant source-contract tests with representative keys from every page, interpolation/plural checks, and an assertion that event form values still use stable weight-class values.

- [ ] **Step 2: Run RED**

Run:

```bash
npx tsx test_i18n.ts
npx tsx test_ui_contracts.ts
npx tsx test_ux_guidance.ts
```

Expected: FAIL for missing page resources/usages.

- [ ] **Step 3: Translate the primary management pages**

Replace user-visible literals with `t` calls. Use `count` for pluralized fight/fighter/event labels. Localize money, counts, and dates with shared formatters. Translate select option labels while retaining their stable underlying values. Translate validation/alert text and all icon-only accessible names.

- [ ] **Step 4: Verify management behavior**

Run:

```bash
npx tsx test_i18n.ts
npx tsx test_ui_contracts.ts
npx tsx test_ux_guidance.ts
npx tsx test_calendar.ts
npx tsx test_management_depth.ts
npx tsx test_tournament.ts
npm run lint
```

Expected: all commands pass and no game-state assertions change.

---

### Task 4: Detail, Fight, History, Social, and Debug Pages

**Files:**
- Modify: `src/i18n/resources/en.ts`
- Modify: `src/i18n/resources/vi.ts`
- Modify: `src/pages/FighterDetail.tsx`
- Modify: `src/pages/EventSimulation.tsx`
- Modify: `src/pages/FightBattle.tsx`
- Modify: `src/pages/FightDetail.tsx`
- Modify: `src/pages/HistoryStats.tsx`
- Modify: `src/pages/News.tsx`
- Modify: `src/pages/DebugSim.tsx`
- Modify: relevant `test_*.ts` contracts

**Interfaces:**
- Consumes: core translation and domain helpers.
- Produces: bilingual secondary/detail flows, including live regions and meter labels.

- [ ] **Step 1: Add failing detail-page contracts**

Require representative English/Vietnamese keys for every detail page and source-level `useTranslation` usage. Cover meter labels, live status, fight methods, title status, scorecards, round stats, social filters, and Debug Sim controls.

- [ ] **Step 2: Run RED**

Run:

```bash
npx tsx test_i18n.ts
npx tsx test_ui_contracts.ts
```

Expected: FAIL for missing detail translations.

- [ ] **Step 3: Translate all detail and observer surfaces**

Translate only chrome around persisted prose. Existing commentary/news/social bodies render unchanged. Translate current live-fight controls and fixed headings immediately; generated commentary language remains owned by Task 5.

- [ ] **Step 4: Run GREEN**

Run:

```bash
npx tsx test_i18n.ts
npx tsx test_ui_contracts.ts
npx tsx test_live_fight.ts
npx tsx test_social_hub.ts
npx tsx test_ranking_context.ts
npm run lint
```

Expected: all commands pass.

---

### Task 5: Generated Game Prose Without Determinism Drift

**Files:**
- Modify: `src/i18n/resources/en.ts`
- Modify: `src/i18n/resources/vi.ts`
- Modify: `src/lib/engine.ts`
- Modify: `src/lib/game/liveFight.ts`
- Modify: `src/lib/game/news.ts`
- Modify: `src/lib/game/social.ts`
- Modify: `src/lib/game/inbox.ts`
- Modify: `src/lib/game/economy.ts`
- Modify: `src/lib/game/contracts.ts`
- Modify: `src/lib/game/tournament.ts`
- Modify: `src/lib/game/observer.ts`
- Modify: `src/lib/game/autobooker.ts`
- Modify: `src/lib/game/insights.ts`
- Modify: `src/lib/game/fighterAchievements.ts`
- Modify: `test_i18n.ts`
- Modify: affected deterministic regression scripts

**Interfaces:**
- Consumes: `fixedT(language)` and current resolved language.
- Produces: locale-captured generated prose while preserving all structured results.

- [ ] **Step 1: Write failing determinism and persistence contracts**

Generate representative English and Vietnamese fight sessions/news/social items with identical seeds/state. Strip only prose fields and assert deep equality:

```ts
assert.deepEqual(stripProse(englishResult), stripProse(vietnameseResult));
assert.notDeepEqual(englishResult.commentary, vietnameseResult.commentary);
assert.deepEqual(runEnglishAgain, englishResult);
```

Assert a fight created in Vietnamese keeps Vietnamese prose after the global language changes, and that pre-existing English archive strings are not rewritten.

- [ ] **Step 2: Run RED**

Run:

```bash
npx tsx test_i18n.ts
npx tsx test_live_fight.ts
npx tsx test_social_hub.ts
```

Expected: FAIL because generated prose is still English or reads mutable global language mid-operation.

- [ ] **Step 3: Translate generation boundaries**

Capture `resolvedLanguage` once at each generation boundary and pass a fixed translator through helper calls. Add a non-persisted locale field only to transient live-fight sessions if necessary; do not add it to save extraction. Convert prose templates to `generated` keys without moving RNG calls or altering branch order.

Keep stable fields such as `FightResult.method`, injury types, statuses, IDs, and enums in English. Translate only commentary, summaries, headlines, descriptions, and display messages.

- [ ] **Step 4: Verify deterministic game behavior**

Run:

```bash
npx tsx test_i18n.ts
npx tsx test_live_fight.ts
npx tsx test_balance.ts
npx tsx test_long_sim.ts
npx tsx test_social_hub.ts
npx tsx test_management_depth.ts
npx tsx test_tournament.ts
npm run lint
```

Expected: all structured simulation checks pass in both locales.

---

### Task 6: Full Browser and Regression Verification

**Files:**
- Modify only files required by defects reproduced during this verification.
- Use a temporary Playwright script outside the repository.

**Interfaces:**
- Consumes: completed bilingual application.
- Produces: verified desktop/mobile English/Vietnamese experience with no untranslated reachable chrome.

- [ ] **Step 1: Run the complete automated suite**

Run all repository `test_*.ts` scripts relevant to navigation, UI, management, simulation, save/load, rankings, tournaments, social content, and long simulations, followed by:

```bash
npm run lint
npm run build
git diff --check
```

Expected: zero failures; only the existing Vite large-chunk warning may remain.

- [ ] **Step 2: Audit English and Vietnamese in the real browser**

At 1280×800, 390×844, 740×390, and 844×390:

1. clear language storage and verify browser-language detection;
2. switch language in Settings without reload;
3. verify `<html lang>` and reload persistence;
4. visit every navigation destination and representative fighter/event/fight details;
5. exercise Event Builder selects/validation, Social Hub filters, live-fight Begin/Pause/Speed/Skip/Confirm, Past Event fight detail, and Back navigation;
6. generate new news/social/fight content after selecting Vietnamese and verify Vietnamese prose;
7. confirm old English persisted prose remains unchanged;
8. check document overflow and browser console/page errors.

Expected: all controls usable, no page-level horizontal overflow, and no errors.

- [ ] **Step 3: Fix only reproduced defects and rerun their smallest checks**

For each defect, add or tighten one assert-based contract before the smallest production fix. Rerun the focused test and affected browser path.

- [ ] **Step 4: Final verification**

Run:

```bash
npx tsx test_i18n.ts
npx tsx test_ui_contracts.ts
npx tsx test_navigation.ts
npx tsx test_live_fight.ts
npx tsx test_social_hub.ts
npx tsx test_management_depth.ts
npx tsx test_tournament.ts
npx tsx test_ranking_context.ts
npx tsx test_balance.ts
npx tsx test_long_sim.ts
npm run lint
npm run build
git diff --check
git status --short
```

Expected: all pass, no temporary audit artifacts in the repository, and only pre-existing untracked `.superpowers/` and `belt/` remain outside implementation changes.
