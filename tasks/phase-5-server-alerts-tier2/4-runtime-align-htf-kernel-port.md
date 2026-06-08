# Task 4 — Runtime: `align-htf-series-to-ltf` + cache port

> **Status: TODO**

## Goal

Port the §6.8 HTF→LTF time-alignment kernel from
`../invinite/src/components/trading-chart/indicators/lib/` into
`@invinite-org/chartlang-runtime`. Two files: the pure two-pointer
walk (`align-htf-series-to-ltf.ts`, 49 LOC) and the `WeakMap`-keyed
cache layer (`align-htf-series-cache.ts`, 126 LOC). Tests retarget at
the `Series<T>` shape; provenance headers carry the invinite commit
SHA.

## Prerequisites

- Task 3: `idbStateStore` shipped (so the runtime can be tested with
  full snapshot persistence + MTF together in Task 5).

## Current Behavior

- `packages/runtime/src/request/` runs `request.security` as a NaN
  fallback. No alignment kernel exists.
- `packages/runtime/src/streamState.ts` carries the main-stream
  ring-buffer machinery but has no concept of "align series from
  HTF to LTF time".

## Desired Behavior

- `packages/runtime/src/request/alignHtfSeriesToLtf.ts` is a 1:1 port
  of the invinite kernel, retargeted at `Series<T>` (no `Float64Array`
  directly — internal arrays only).
- `packages/runtime/src/request/alignHtfSeriesCache.ts` ports the
  `WeakMap`-keyed cache layer; cache keys are
  `(htfStream, ltfStream)` pairs, values are the aligned series.
- Both files carry the 4-line provenance header naming the source
  path + commit SHA + "translated, not transcribed".
- Property tests pin the no-look-ahead invariant: every aligned
  value at LTF time `T` is derived from HTF bars closed at or before
  `T`.
- Golden tests compare bar-by-bar against captured invinite
  reference output for three (HTF, LTF, source-series) triples.
- Bench pair lands under a `THRESHOLD_MS` budget (5,000 LTF bars
  aligned against 1,000 HTF bars in ≤ 5 ms).

## Requirements

### 1. Provenance headers

Both new files start with:

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/lib/<name>.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — Series<T> shape, JSDoc, runtime context.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.
```

### 2. `packages/runtime/src/request/alignHtfSeriesToLtf.ts` (new)

Mirror the invinite signature, adapted to `Series<T>`:

```ts
import type { Bar } from "@invinite-org/chartlang-core";

/**
 * Align an HTF series to the LTF time grid (PLAN.md §6.8). Returns
 * a new `ReadonlyArray<number>` with one entry per LTF bar where
 * `out[i]` is the most recent HTF series value at or before
 * `ltf[i].time`. No look-ahead — `out[i]` never observes an HTF bar
 * with `time > ltf[i].time`.
 *
 * Two-pointer walk: O(ltf.length + htf.length).
 *
 * @since 0.5
 * @example
 *     const aligned = alignHtfSeriesToLtf(htfBars, htfCloses, ltfBars);
 *     void aligned;
 */
export function alignHtfSeriesToLtf(
    htf: ReadonlyArray<Bar>,
    htfSeries: ReadonlyArray<number>,
    ltf: ReadonlyArray<Bar>,
): ReadonlyArray<number> {
    // … two-pointer walk identical to invinite
}
```

Faithful port of the math, with these translation points:

- `Float64Array` inputs in invinite become `ReadonlyArray<number>`
  here (the runtime's series surface is `Series<number>`, which
  exposes `.toArray(): ReadonlyArray<number>` — see Phase-4
  `seriesView.ts`).
- Time comparison uses the `Bar.time` field; no separate time array.
- NaN-handling matches the source — NaN HTF values propagate
  to the corresponding LTF index without short-circuiting the walk.

### 3. `packages/runtime/src/request/alignHtfSeriesCache.ts` (new)

Port the cache layer. Key design:

- Module-private `WeakMap<ReadonlyArray<Bar>, WeakMap<ReadonlyArray<Bar>, CacheEntry>>`
  keyed first by HTF bars, then by LTF bars.
- `CacheEntry` carries `{ htfLength, ltfLength, aligned }` — the cache
  hit is valid only when both lengths match the live arrays (a new
  bar appended invalidates).
- Public surface: `getOrAlign(htfBars, htfSeries, ltfBars): ReadonlyArray<number>`
  — hits return the cached array; misses run the kernel + store.
- The cache survives across `compute()` calls but evicts naturally
  when either array is garbage-collected (`WeakMap` semantics).
- Eviction-by-length invariant: any state change must trigger a
  miss; tests pin this.

### 4. `packages/runtime/src/request/alignHtfSeriesToLtf.test.ts`

Unit tests:

- Empty HTF → all-NaN output of length `ltf.length`.
- Empty LTF → empty output.
- HTF time strictly increasing; LTF time strictly increasing — the
  pre-condition the kernel relies on. Document with JSDoc on the
  function.
- Single HTF bar at `t=100`, three LTF bars at `t=50/100/150` → output
  `[NaN, 100, 100]` (assuming source-series value `100` at the HTF
  bar).
- NaN HTF values propagate.
- Bar boundary semantics: HTF bar `[t=100, close=10]` with LTF bar
  `t=100` reads `10` (close at or before, inclusive).

### 5. `packages/runtime/src/request/alignHtfSeriesToLtf.property.test.ts`

Property tests (vitest + fast-check, pinned seed per
`packages/runtime/CLAUDE.md`):

- **No look-ahead**: for randomly-generated `(htf, htfSeries, ltf)`
  triples, every `out[i]` equals the value of `htfSeries[j]` where
  `j = max { k : htf[k].time <= ltf[i].time }` or NaN if no such `k`.
- **Length matches LTF**: `out.length === ltf.length` always.
- **Determinism**: same inputs → identical outputs across repeated
  calls.

### 6. `packages/runtime/src/request/alignHtfSeriesToLtf.golden.test.ts`

Golden tests. Three captured invinite reference outputs:

- 1m LTF / 1h HTF / `close` source — 240 LTF bars / 4 HTF bars.
- 1m LTF / 1D HTF / `volume` source — 1,440 LTF bars / 1 HTF bar.
- 5m LTF / 4h HTF / `close` source with NaN HTF middle bar — 96 LTF
  / 12 HTF bars.

Goldens land under `packages/runtime/src/request/__fixtures__/`.
Capture procedure: run the invinite kernel directly against the
fixture inputs in a one-shot script and persist the output JSON.
Document the capture script in the test file's leading comment.

### 7. `packages/runtime/src/request/alignHtfSeriesCache.test.ts`

- Two consecutive calls with the same arrays + lengths → cache hit
  (kernel invoked once; assert via a spy on the kernel function).
- Appending a bar to HTF (mutating the array length) on the next call
  → cache miss, kernel re-invoked.
- Distinct HTF arrays (deep-equal but reference-distinct) → cache
  miss — `WeakMap` keys on identity.
- LTF replacement → cache miss.

### 8. `packages/runtime/src/request/alignHtfSeriesToLtf.bench.ts` (+ pair)

Bench-pair:

- `alignHtfSeriesToLtf.bench.ts`: vitest `bench()` aligning 5,000 LTF
  bars against 1,000 HTF bars, single run.
- `alignHtfSeriesToLtf.bench.test.ts`: `THRESHOLD_MS = 5` for the
  vitest run-mode companion (the chartlang `pnpm test` gate).

### 9. JSDoc

- `alignHtfSeriesToLtf` — `@since 0.5`, `@formula` (two-pointer walk
  reference), `@warmup` (none — pure function), `@example`.
- Cache layer — `@since 0.5`, `@internal` (consumers reach for
  `getOrAlign`, not the WeakMap).

### 10. Package barrel

`packages/runtime/src/index.ts` does **not** re-export the alignment
kernel — it's internal infrastructure used by `request.security`
(Task 5). Keep it package-private.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/request/alignHtfSeriesToLtf.ts` | Create | Two-pointer kernel port |
| `packages/runtime/src/request/alignHtfSeriesCache.ts` | Create | WeakMap-keyed cache layer |
| `packages/runtime/src/request/alignHtfSeriesToLtf.test.ts` | Create | Unit tests |
| `packages/runtime/src/request/alignHtfSeriesToLtf.property.test.ts` | Create | Property tests |
| `packages/runtime/src/request/alignHtfSeriesToLtf.golden.test.ts` | Create | Golden tests |
| `packages/runtime/src/request/__fixtures__/*.json` | Create | Captured invinite reference outputs (3) |
| `packages/runtime/src/request/alignHtfSeriesCache.test.ts` | Create | Cache hit / miss tests |
| `packages/runtime/src/request/alignHtfSeriesToLtf.bench.ts` | Create | Bench (vitest bench mode) |
| `packages/runtime/src/request/alignHtfSeriesToLtf.bench.test.ts` | Create | `THRESHOLD_MS` gate |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm -F @invinite-org/chartlang-runtime test --coverage` (100% on
  the new files)
- `pnpm docs:check`
- `pnpm bench:ci`

## Changeset

`.changeset/phase5-runtime-align-htf-kernel.md` — `minor` bump for
`@invinite-org/chartlang-runtime`. Body cites PLAN §6.8 + invinite
commit SHA.

## Acceptance Criteria

- [ ] Both files ship the 4-line provenance header.
- [ ] Unit + property + golden + bench all green; bench under 5 ms.
- [ ] Cache invariants tested (length-change → miss; identity-change
      → miss).
- [ ] No look-ahead invariant pinned by property test.
- [ ] 100% coverage on touched files.
- [ ] No public export from the package barrel — the kernel stays
      internal.
- [ ] Changeset committed.
