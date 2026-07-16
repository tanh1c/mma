# English and Vietnamese i18n Design

## Goal

Add complete English and Vietnamese support to the application. Changing the language must update the interface immediately without reloading, preserve game and save compatibility, and make newly generated prose use the selected language. Existing persisted prose remains in the language in which it was generated.

## Decisions

- Use `i18next` and `react-i18next`.
- Bundle English and Vietnamese resources with the application. Do not load translations from a network backend.
- Detect the initial language from the browser when no preference exists: use Vietnamese when the browser's preferred languages include `vi`; otherwise use English.
- Store language as an application-wide localStorage preference beside the unit-system setting.
- Do not add language to `GameState`, exports, imports, or the save schema. Do not increment the save version.
- Translate newly generated news, social content, storylines, finance descriptions, and fight commentary according to the active language at generation time.
- Keep existing persisted prose unchanged when the user switches language.
- Translate MMA terminology as fully as practical while retaining standard abbreviations such as KO/TKO.
- Keep fighter, promotion, event, tournament, and belt names as proper nouns.
- Keep the game economy in USD and localize only its presentation.

## Architecture

### Shared i18next instance

Create one application i18next instance initialized with `initReactI18next`. It is the single translation source for both React and non-React modules.

Configuration:

- `supportedLngs: ['en', 'vi']`
- `fallbackLng: 'en'`
- `load: 'languageOnly'`
- locally bundled resources
- interpolation escaping disabled because React escapes rendered values
- no backend, browser detector plugin, or Suspense-based loading

React components use `useTranslation`. Pure TypeScript game modules import the initialized instance and obtain a fixed translator for the locale selected at the beginning of an operation.

### Resource organization and typing

Organize translations by functional namespaces:

- `common`: shared buttons, statuses, accessibility labels, dates, counts, and confirmations
- `navigation`: shell sections and destinations
- `dashboard`: promotion overview and event summaries
- `fighters`: roster, free agents, fighter details, contracts, health, and rankings
- `events`: calendar, event builder, completed events, and event finances
- `fight`: live fight, archived fight details, statistics, methods, and title-fight labels
- `tournaments`: Grand Prix management and status
- `social`: Inbox and Social Hub interface
- `history`: History & Stats interface
- `settings`: preferences and language controls
- `debug`: Debug Sim interface
- `generated`: news, social posts and replies, storylines, finance descriptions, medical messages, round summaries, and fight commentary

English resources define the canonical key structure. TypeScript module augmentation uses that resource type so missing or invalid keys fail during type checking. Vietnamese resources must match the same key tree. Translation keys describe meaning rather than English wording.

### Language preference

Extend the existing settings store with:

- `Language = 'en' | 'vi'`
- `language`
- `setLanguage(language)`

Language read/write helpers mirror the safe localStorage behavior used for display units. If storage is unavailable, the application continues with the detected language.

`setLanguage` performs three synchronized updates:

1. update the settings store;
2. persist the preference;
3. call `i18n.changeLanguage` and set `document.documentElement.lang`.

The preference applies to all game saves. Importing or loading a save does not change it.

## Translation Boundaries

### Interface text

All user-visible application chrome changes immediately with the active language:

- navigation, quick search, save/load/import/export, and new-game controls;
- page headings and descriptions;
- buttons, form labels, placeholders, filters, tabs, and table headings;
- statuses, badges, validation errors, alerts, and confirmations;
- empty states and explanatory text;
- accessible names, meter labels, and live-region text;
- date, number, count, currency, height, and weight presentation.

Reusable visual components remain translation-agnostic. Callers pass translated strings to `PageHeader`, `Stat`, `StatusBadge`, `Select`, and similar components.

### Domain values

Persisted/internal values remain stable. Display mapping translates:

- weight classes and fighter styles;
- fight methods and judging results;
- fighter readiness, injury, suspension, and contract statuses;
- ranking labels where they contain prose;
- event, title-fight, belt, tournament, and tournament-round types;
- social, news, storyline, and finance categories.

Code must not replace internal enum values with Vietnamese strings or branch game logic on translated output.

### Proper nouns

The following remain unchanged in every locale:

- fighter names;
- promotion names;
- generated and user-entered event names;
- tournament names;
- belt names;
- venue names;
- nationalities when they are part of generated names or stored identity data.

Labels around those names are translated.

### Formatting

Use `Intl` with `en-US` or `vi-VN` for presentation:

- `Intl.DateTimeFormat` for display dates;
- `Intl.NumberFormat` for counts and percentages;
- `Intl.NumberFormat` with `{ style: 'currency', currency: 'USD' }` for money.

The unit-system preference remains independent. Height and weight helpers keep their current measurement conversions while using localized separators and translated unit-facing labels where applicable.

## Generated and Persisted Prose

### Generation language

At the start of an operation that generates persisted prose, capture the active resolved language and obtain a fixed translator. The whole operation uses that translator.

Examples:

- one news item, social post, or storyline;
- one financial transaction description;
- one event finalization report;
- one fight session and all its round summaries and commentary.

A live fight captures its locale when the session is created. Changing the application language during the fight updates interface controls immediately but does not change that fight's commentary language. The next fight uses the new language.

### Persistence behavior

Generated text continues to be saved as complete strings in the existing fields. No message keys or translation parameters are added to saves.

Consequences:

- existing English saves load without migration;
- old content remains English inside a Vietnamese interface;
- new content uses the current language;
- changing language does not rewrite history;
- export/import stays backward compatible.

This deliberate boundary avoids a large schema migration while providing fully localized future gameplay.

### Determinism

Translation must not affect simulation decisions or RNG consumption. For the same seed and game state:

- winners, methods, round timing, statistics, injuries, deltas, and finances remain identical across locales;
- only user-facing prose and formatting differ;
- translation lookup never consumes random values or changes branch conditions.

Game logic must compare stable enums and IDs, never translated strings.

## Vietnamese Terminology

Vietnamese mode translates MMA terminology as fully as practical. Examples include:

- `Main Event` → `Trận chính`
- `Co-main Event` → `Trận đồng chính`
- `Title Fight` → `Trận tranh đai`
- `Round` → `Hiệp`
- `Submission` → `Khóa siết`
- `Takedown` → `Quật ngã`
- `Unanimous Decision` → `Quyết định đồng thuận`
- `Split Decision` → `Quyết định không đồng thuận`
- `Draw` → `Hòa`

Standard abbreviations such as KO/TKO remain recognizable. Internal values remain English regardless of display language.

## Error and Fallback Behavior

- Missing Vietnamese keys fall back to English.
- Invalid persisted language values are ignored and replaced by browser detection or English fallback.
- localStorage failures do not block startup or language changes for the active session.
- Translation initialization uses bundled resources and cannot fail because of network access.
- Development checks reject missing or extra Vietnamese keys before completion.
- User-provided and generated names are interpolated as text, never rendered as HTML.

## Implementation Scope

Implement in vertical slices:

1. Install and initialize i18next/react-i18next, add typed resources, language persistence, and locale formatters.
2. Translate App, AppShell, Settings, shared statuses, domain display mappings, accessibility labels, and confirmations.
3. Translate Dashboard, Inbox, Calendar, Event Builder, Roster, Rankings, Tournaments, and Free Agents.
4. Translate Fighter Detail, Event Simulation, Fight Battle, Fight Detail, History & Stats, Social Hub, and Debug Sim.
5. Translate generated content in engine, news, social, storylines, finance, medical reporting, and live-fight commentary.
6. Audit every reachable desktop and mobile view for untranslated application text and layout regressions.

## Testing

### Translation contracts

Add runnable assertions that:

- English and Vietnamese resources have identical key trees;
- representative interpolation and plural keys render without exposing raw keys;
- domain values render correctly in each language while internal values stay unchanged;
- unsupported or missing languages fall back to English;
- browser detection selects Vietnamese only for a Vietnamese preference;
- the language preference persists independently of game saves.

### Generated content

For representative deterministic operations:

- the same seed and locale produce identical output;
- English and Vietnamese produce identical structured game results;
- only prose fields differ;
- a captured fixed translator keeps one generated object or fight session in one language;
- old English persisted strings are not rewritten after changing language.

### UI verification

Browser-driven verification covers English and Vietnamese at desktop and mobile viewports:

- switch language from Settings without reload;
- verify navigation and current page update immediately;
- verify `<html lang>` and persistence after reload;
- visit every navigation destination and representative detail views;
- exercise forms, validation, confirmations, live-fight controls, archived fight details, filters, tabs, and tables;
- verify newly generated news/social/fight commentary is Vietnamese after switching;
- verify no document-level horizontal overflow from longer Vietnamese labels;
- verify no console or page errors.

Run the full regression suite, TypeScript lint, production build, and diff whitespace checks.

## Explicitly Excluded

- Translating existing persisted history when the language changes.
- Changing save format or save version for language support.
- Converting USD values to VND.
- Translating proper names.
- Remote translation loading, translation-management services, or automatic machine translation.
- Adding languages beyond English and Vietnamese in this implementation.
