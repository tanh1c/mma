# Romanized East Asian Fighter Names Design

## Goal

Generate new Japanese, South Korean, and Chinese fighters with readable Latin-script names while preserving nationality, seeded determinism, the existing fighter schema, and existing saves.

## Scope

- Japan, South Korea, and China use curated Latin-script first-name and last-name pools.
- Display order remains `firstName lastName`, such as `Akira Sato`, `Min-jun Kim`, and `Wei Zhang`.
- All other supported nationalities continue using their existing Faker locale chains.
- Existing saved fighters are not renamed or migrated.
- No UI, save schema, fighter type, or dependency changes are required.

## Naming architecture

`src/lib/names.ts` remains the single naming boundary.

Add country-specific Romanized pools for Japan, South Korea, and China. `getLocalizedFighterName(nationality, seed)` will detect those nationalities before constructing a Faker instance and select one first name and one last name deterministically from the matching pools.

Selection must derive both values from the supplied seed without global mutable Faker state. The same nationality and seed must always produce the same pair. First-name and last-name selection must use separate deterministic indices so a single seed does not unnecessarily correlate equal pool positions.

For other known nationalities, retain the current locale-backed Faker behavior. Unknown nationalities retain the current static-pool fallback.

## Data and compatibility

The function continues returning:

```ts
{ firstName: string; lastName: string }
```

`generateFighter()` remains unchanged and continues storing the returned values in `Fighter.firstName` and `Fighter.lastName`. This keeps every existing page, event, archive, ranking, contract, inbox item, and save format compatible.

Because names are persisted as strings, old saves keep their current names. Only fighters generated after this change receive the Romanized East Asian names.

## Validation

Extend `test_names.ts` with focused assertions:

- Japan, South Korea, and China produce non-empty names containing only Latin letters plus supported separators such as spaces, hyphens, and apostrophes.
- Repeating the same nationality and seed returns the same name.
- Representative seeds produce names from the matching country's curated pools.
- An unaffected nationality remains deterministic through Faker.
- Unknown-nationality fallback behavior remains unchanged.
- `generateFighter()` still produces a valid nationality and non-empty name.

Then run:

```text
npx tsx test_names.ts
npm run lint
npm run build
```

## Explicit exclusions

- No runtime transliteration of Kanji, Hanzi, or Hangul.
- No new transliteration package.
- No native family-name-first display order.
- No migration or automatic rename of existing fighters.
- No changes to nationality probabilities or fighter generation beyond names.
