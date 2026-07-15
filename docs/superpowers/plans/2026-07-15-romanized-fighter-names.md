# Romanized East Asian Fighter Names Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate new Japanese, South Korean, and Chinese fighters with deterministic Latin-script names.

**Architecture:** Keep `getLocalizedFighterName()` as the sole naming boundary. Use small curated Romanized pools for the three affected nationalities and retain Faker locale generation and unknown-nationality fallback for every other path.

**Tech Stack:** TypeScript, `@faker-js/faker`, Node strict assertions, `tsx`.

## Global Constraints

- Keep display order `firstName lastName`.
- Do not change `Fighter`, save data, UI, or existing saved names.
- Do not add a dependency or runtime transliteration.
- Preserve deterministic output for identical nationality and seed.
- Do not commit or push.

---

### Task 1: Add deterministic Romanized East Asian names

**Files:**
- Modify: `test_names.ts`
- Modify: `src/lib/names.ts`

**Interfaces:**
- Consumes: `getLocalizedFighterName(nationality: string, seed: number)`
- Produces: the same `{ firstName: string; lastName: string }` return shape, with Latin-script names for Japan, South Korea, and China.

- [ ] **Step 1: Write the failing regression**

Add assertions that multiple seeds for each affected nationality are deterministic and match this allowed Latin-script pattern:

```ts
const latinName = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;

(['Japan', 'South Korea', 'China'] as const).forEach(nationality => {
  for (let seed = 0; seed < 25; seed++) {
    const name = getLocalizedFighterName(nationality, seed);
    assert.match(name.firstName, latinName);
    assert.match(name.lastName, latinName);
    assert.deepEqual(name, getLocalizedFighterName(nationality, seed));
  }
});
```

Keep the existing fallback and generated-fighter assertions.

- [ ] **Step 2: Confirm the regression fails**

Run: `npx tsx test_names.ts`

Expected: FAIL because Faker's Japanese, Korean, or Chinese locale returns native-script characters.

- [ ] **Step 3: Implement the minimum country pools**

In `src/lib/names.ts`, add one map containing first and last name arrays for Japan, South Korea, and China. Before Faker construction, select from the matching pools with deterministic indices:

```ts
const romanizedNamePools = {
  Japan: { firstNames: [...], lastNames: [...] },
  'South Korea': { firstNames: [...], lastNames: [...] },
  China: { firstNames: [...], lastNames: [...] }
} as const;

const romanized = romanizedNamePools[nationality as keyof typeof romanizedNamePools];
if (romanized) {
  const index = Math.abs(seed);
  return {
    firstName: romanized.firstNames[index % romanized.firstNames.length],
    lastName: romanized.lastNames[Math.floor(index / romanized.firstNames.length) % romanized.lastNames.length]
  };
}
```

Retain Faker for other known nationalities and the existing static fallback for unknown nationalities.

- [ ] **Step 4: Run focused and project verification**

Run:

```text
npx tsx test_names.ts
npm run lint
npm run build
```

Expected: all commands pass. The existing Vite chunk-size warning is acceptable.

- [ ] **Step 5: Inspect the production flow**

Generate representative Japanese, South Korean, and Chinese names through `getLocalizedFighterName()` and confirm the output is Latin-script and ordered `firstName lastName`. No commit or push.
