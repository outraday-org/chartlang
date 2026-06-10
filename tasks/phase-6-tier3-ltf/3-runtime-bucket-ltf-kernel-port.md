# Runtime: `bucketLtfBarsByMainContainment` kernel + cache

> **Status: TODO**

## Goal

Ship the pure two-pointer kernel that powers `request.lowerTf` —
`bucketLtfBarsByMainContainment(mainBars, ltfBars)` returns a
`ReadonlyArray<ReadonlyArray<Bar>>` of length `mainBars.length` where
each entry enumerates the LTF bars whose `time` falls within the
corresponding main bar's `[time, nextMainTime)` half-open window.
Pair with `bucketLtfBarsCache.getOrBucket(mainBars, ltfBars)` mirroring
Phase 5's HTF cache pattern.

## Prerequisites

- Task 1 completed (foundational `intervalToSeconds` available).
- Task 2 completed (time subpath shipped — not strictly required by
  this task but lands before runtime work).

## Current Behavior

`packages/runtime/src/request/` ships Phase 5's
`alignHtfSeriesToLtf.ts` + `alignHtfSeriesCache.ts`. Those kernels
implement the **HTF direction** (one HTF value per LTF bar via
"most-recent value at or before LTF time" policy). No LTF-direction
kernel exists. Adapters that want LTF data must inline the bucketing
themselves.

## Desired Behavior

A net-new kernel `bucketLtfBarsByMainContainment` ships alongside the
existing HTF kernel:

- Pure function, no side effects, no state.
- Two-pointer walk over `(mainBars, ltfBars)` in ascending time order.
- For each main bar `m[i]`, collects every LTF bar whose
  `bar.time >= m[i].time && bar.time < m[i + 1].time`. For the last
  main bar (no successor), collects every LTF bar with
  `bar.time >= m[i].time` (the in-progress half-bucket).
- Returns `ReadonlyArray<ReadonlyArray<Bar>>` of length
  `mainBars.length`. Empty buckets are `[]` (not `null`).
- Time complexity `O(mainBars.length + ltfBars.length)`.
- LTF bars whose `time < m[0].time` (pre-history) are silently
  discarded — they don't belong to any main bar.
- Assumes both inputs are strictly ascending by `time`. The kernel
  does **not** validate this — callers (the cache wrapper) trust the
  runtime's stream-state invariant. Per the runtime CLAUDE.md, stream
  bars are monotonic by construction.

Paired with `bucketLtfBarsCache.getOrBucket(mainBars, ltfBars)`:

- Two-level `WeakMap<ReadonlyArray<Bar>, WeakMap<ReadonlyArray<Bar>, ReadonlyArray<ReadonlyArray<Bar>>>>`.
- Cache hit returns the stored array iff stored entry's
  `mainBars.length` and `ltfBars.length` match the live inputs
  (defense-in-depth — array identity should be stable, but length
  check guards against silent buffer reuse).
- Cache miss runs the kernel, stores the result, returns it.

## Requirements

### 1. Kernel file `packages/runtime/src/request/bucketLtfBarsByMainContainment.ts`

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Net-new kernel — no invinite parallel. Pairs with the Phase-5
// alignHtfSeriesToLtf kernel as the LTF-direction policy.
// See packages/runtime/src/request/CLAUDE.md for the alignment-
// kernel convention.

import type { Bar } from "@invinite-org/chartlang-core";

/**
 * Bucket lower-timeframe bars by main-bar containment.
 *
 * For each main bar `m[i]`, collects every LTF bar `b` such that
 * `b.time >= m[i].time && b.time < m[i + 1].time`. The last main
 * bar (`i == mainBars.length - 1`) has no successor and absorbs
 * every LTF bar with `b.time >= m[i].time` (the in-progress half-
 * bucket).
 *
 * Inputs MUST be strictly ascending by `time`. The kernel does not
 * validate ordering — the runtime stream state guarantees it.
 *
 * LTF bars with `b.time < m[0].time` are silently discarded.
 *
 * Time complexity O(mainBars.length + ltfBars.length).
 *
 * @formula
 *   for i in [0, mainBars.length):
 *     hi = i + 1 < mainBars.length ? mainBars[i + 1].time : +Infinity
 *     buckets[i] = ltfBars.filter(b => mainBars[i].time <= b.time && b.time < hi)
 *
 * @warmup
 *   No warmup. Output for an empty main-bar input is `[]`.
 *   Output for an empty LTF input is `[[], [], …]` of length
 *   `mainBars.length`.
 *
 * @example
 *   const main = [{ time: 0 }, { time: 60_000 }, { time: 120_000 }];
 *   const ltf = [
 *     { time: 0 }, { time: 30_000 },
 *     { time: 60_000 }, { time: 90_000 },
 *     { time: 120_000 },
 *   ];
 *   bucketLtfBarsByMainContainment(main, ltf);
 *   // → [
 *   //     [{time: 0}, {time: 30_000}],
 *   //     [{time: 60_000}, {time: 90_000}],
 *   //     [{time: 120_000}],
 *   //   ]
 *
 * @since 0.6
 * @stable
 */
export function bucketLtfBarsByMainContainment(
  mainBars: ReadonlyArray<Bar>,
  ltfBars: ReadonlyArray<Bar>,
): ReadonlyArray<ReadonlyArray<Bar>> {
  const n = mainBars.length;
  if (n === 0) return [];
  const buckets: Bar[][] = new Array(n);
  for (let i = 0; i < n; i++) buckets[i] = [];

  // Two-pointer walk: i = main index, j = ltf index.
  let i = 0;
  let j = 0;
  // Skip LTF pre-history.
  while (j < ltfBars.length && ltfBars[j]!.time < mainBars[0]!.time) j++;

  while (j < ltfBars.length) {
    const t = ltfBars[j]!.time;
    // Advance i so that mainBars[i].time <= t and (i+1 == n || t < mainBars[i+1].time).
    while (i + 1 < n && mainBars[i + 1]!.time <= t) i++;
    buckets[i]!.push(ltfBars[j]!);
    j++;
  }

  return buckets;
}
```

### 2. Cache file `packages/runtime/src/request/bucketLtfBarsCache.ts`

```ts
import type { Bar } from "@invinite-org/chartlang-core";
import { bucketLtfBarsByMainContainment } from "./bucketLtfBarsByMainContainment.js";

type Bucketed = ReadonlyArray<ReadonlyArray<Bar>>;
type Entry = { readonly mainLen: number; readonly ltfLen: number; readonly buckets: Bucketed };

const cache = new WeakMap<ReadonlyArray<Bar>, WeakMap<ReadonlyArray<Bar>, Entry>>();

/**
 * Identity-keyed cache around `bucketLtfBarsByMainContainment`.
 *
 * Cache hit invalidates if either array's `length` changed since the
 * stored entry — defends against silent buffer reuse during snapshot
 * restore. Identity should normally be stable thanks to the runtime
 * stream state's ring-buffer view contract.
 *
 * @since 0.6
 * @stable
 */
export function getOrBucket(mainBars: ReadonlyArray<Bar>, ltfBars: ReadonlyArray<Bar>): Bucketed {
  let inner = cache.get(mainBars);
  if (inner === undefined) {
    inner = new WeakMap();
    cache.set(mainBars, inner);
  }
  const cached = inner.get(ltfBars);
  if (cached !== undefined && cached.mainLen === mainBars.length && cached.ltfLen === ltfBars.length) {
    return cached.buckets;
  }
  const buckets = bucketLtfBarsByMainContainment(mainBars, ltfBars);
  inner.set(ltfBars, { mainLen: mainBars.length, ltfLen: ltfBars.length, buckets });
  return buckets;
}
```

### 3. Tests — `bucketLtfBarsByMainContainment.test.ts`

Unit cases:

- Empty main → `[]`.
- Empty LTF → `[[], [], [], …]` of length `mainBars.length`.
- Single main bar, two LTF bars both in window → one bucket of size 2.
- Three main bars, five LTF bars (the docstring example) → three
  buckets of sizes 2, 2, 1.
- LTF bar exactly at `mainBars[i + 1].time` → falls into bucket `i+1`
  (half-open interval).
- LTF bars before `mainBars[0].time` → discarded.
- LTF bars after the last main bar → all collected in the final bucket
  (in-progress half-bucket).
- LTF bars all in pre-history → every bucket empty.

### 4. Tests — `bucketLtfBarsByMainContainment.property.test.ts`

fast-check + pinned seed (e.g. `42`). For an arbitrary monotonic
`mainBars` (length 0–50) and monotonic `ltfBars` (length 0–500):

- Sum of `buckets[i].length` equals `ltfBars.filter(b => b.time >= mainBars[0]?.time).length`.
- Concatenating all `buckets` in order yields the same ordered list
  of LTF bars (minus pre-history).
- Every bar in `buckets[i]` satisfies `mainBars[i].time <= b.time` and
  (when `i + 1 < n`) `b.time < mainBars[i + 1].time`.

### 5. Tests — `bucketLtfBarsByMainContainment.golden.test.ts`

Pin three captured scenarios:

- 1m main, 15s LTF, 60 minutes of data — verify exact bucket sizes.
- 5m main, 1m LTF, with a 12-bar gap in the LTF stream (simulates
  outage) — verify gap-aware bucketing.
- 1H main, 5m LTF crossing the in-progress edge — verify the final
  bucket grows as new LTF bars arrive.

Goldens stored as captured arrays in the test file (not large enough
to warrant a separate `__goldens__` dir).

### 6. Tests — `bucketLtfBarsCache.test.ts`

- Same inputs → same returned reference.
- Different LTF identity → cache miss → new computation.
- Same identity but different `length` → cache miss → new computation
  (the silent-buffer-reuse defense).
- Empty inputs → `[]`.

### 7. Bench — `bucketLtfBarsByMainContainment.bench.ts` + `.bench.test.ts`

Mirrors the Phase-5 bench pattern:

- `bucketLtfBarsByMainContainment.bench.ts` — vitest `bench()`
  measuring 1m main × 1500 bars + 15s LTF × 6000 bars,
  `bucketLtfBarsByMainContainment` vs a naive `filter`-per-main-bar
  baseline. Reports both. The two-pointer kernel should be ≥10× faster
  than the baseline.
- `bucketLtfBarsByMainContainment.bench.test.ts` — runs the kernel
  once in test mode, asserts wall-clock ≤ `THRESHOLD_MS = 5` (one full
  pass over the same inputs). Threshold tuned against current CI
  hardware.

### 8. JSDoc + docs gate

`@formula` + `@warmup` + `@example` on the kernel; `@since 0.6` +
`@stable` on both files' exports. `pnpm docs:check` auto-generates
`docs/primitives/request/bucketLtfBarsByMainContainment.md`.

### 9. README + CLAUDE.md

`packages/runtime/README.md` adds one line documenting the new kernel
in the "alignment kernels" surface. ≤ 100 lines.
`packages/runtime/src/request/CLAUDE.md` does not exist today (the
alignment-kernel convention currently sits in
`packages/runtime/src/ta/CLAUDE.md`). Create
`packages/runtime/src/request/CLAUDE.md` and document both the HTF
(Phase 5) and LTF (this task) alignment policies, the pure-kernel
invariant, and the WeakMap cache identity contract.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/request/bucketLtfBarsByMainContainment.ts` | Create | Pure two-pointer bucketing kernel. |
| `packages/runtime/src/request/bucketLtfBarsCache.ts` | Create | Identity-keyed cache wrapper. |
| `packages/runtime/src/request/bucketLtfBarsByMainContainment.test.ts` | Create | Unit cases. |
| `packages/runtime/src/request/bucketLtfBarsByMainContainment.property.test.ts` | Create | Property tests (fast-check, pinned seed). |
| `packages/runtime/src/request/bucketLtfBarsByMainContainment.golden.test.ts` | Create | Three captured-input golden scenarios. |
| `packages/runtime/src/request/bucketLtfBarsCache.test.ts` | Create | Cache-hit + invalidation tests. |
| `packages/runtime/src/request/bucketLtfBarsByMainContainment.bench.ts` | Create | Vitest bench mode. |
| `packages/runtime/src/request/bucketLtfBarsByMainContainment.bench.test.ts` | Create | THRESHOLD_MS guard. |
| `packages/runtime/src/request/CLAUDE.md` | Create | Document HTF (Phase 5) + LTF (this task) alignment policies + WeakMap cache identity contract. |
| `packages/runtime/README.md` | Modify | One-line surface entry. |
| `.changeset/phase6-bucket-ltf-kernel.md` | Create | Minor bump on `@invinite-org/chartlang-runtime`. |

## Gates

- `pnpm typecheck`.
- `pnpm lint`.
- `pnpm test` — 100% coverage on the two new files.
- `pnpm docs:check`.
- `pnpm readme:check`.
- `pnpm bench:ci` — the new bench-pair runs in CI; THRESHOLD_MS guard
  passes.

## Changeset

`.changeset/phase6-bucket-ltf-kernel.md`:

```md
---
"@invinite-org/chartlang-runtime": minor
---

Add `bucketLtfBarsByMainContainment` kernel + identity-keyed cache
for lower-timeframe bar bucketing. Foundational for
`request.lowerTf` (Phase 6). Pure function, two-pointer walk,
O(n + m).
```

## Acceptance Criteria

- [ ] `bucketLtfBarsByMainContainment.ts` ships with `@formula`,
      `@warmup`, `@example`, `@since 0.6`, `@stable` JSDoc.
- [ ] `bucketLtfBarsCache.ts` ships with cache-hit + length-guard
      invalidation logic.
- [ ] Unit, property (fast-check + pinned seed), and golden tests
      pass.
- [ ] 100% coverage on both files.
- [ ] Bench pair (`.bench.ts` + `.bench.test.ts`) lands and runs under
      `THRESHOLD_MS = 5`.
- [ ] `packages/runtime/src/request/CLAUDE.md` is created and
      documents both the HTF policy (Phase 5) and the LTF policy
      (this task).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm docs:check`,
      `pnpm readme:check`, `pnpm bench:ci` all green.
- [ ] Auto-generated `docs/primitives/request/bucketLtfBarsByMainContainment.md`
      exists.
- [ ] Changeset committed.
