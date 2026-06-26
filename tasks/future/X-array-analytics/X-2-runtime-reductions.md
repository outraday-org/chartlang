# Task 2 — Runtime: reduction implementations on the `state.array` store

> **Status: TODO**

## Goal

Implement the analytic reduction methods (`sum`/`avg`/`min`/`max`/`range`/
`variance`/`stdev`/`median`/`percentile`/`indexOf`/`includes`/`sort`) on the
runtime `state.array` handle so they walk the backing store once (O(size)),
honour the skip-NaN policy, and land unit + property + golden tests.

## Prerequisites

- Task 1 (method signatures + `array` namespace) complete.
- `../state-array/` task 2 runtime store landed.

## Current Behavior

- The `state.array` runtime handle (`packages/runtime/src/`, from state-array
  task 2) implements `push`/`get`/`last`/`clear`/`size`/`capacity` over a
  bounded ring (committed/tentative snapshot semantics). It has no reductions.

## Desired Behavior

Each method reads the ring's currently-filled region and returns the documented
statistic; the ring's order/eviction is never disturbed (`sort` copies). NaN
elements are skipped; an empty or all-NaN window returns `NaN` (except
`indexOf` → `-1`, `includes` → `false`, `sort` → `[]`).

## Requirements

### 1. Reduction helpers (`packages/runtime/src/state/arrayReductions.ts`, new)

Pure functions over a `(buffer: ReadonlyArray<number> | Float64Array, size: number, headIndex: number)`
view — or whatever the store's internal shape is; read it directly, do not go
through the public `get(n)` proxy. Implement:

- `reduceSum`, `reduceAvg`, `reduceMin`, `reduceMax` — single pass, skipping
  `Number.isNaN`. Track a `count` of finite elements; `count === 0 → NaN`.
- `reduceVariance(view, biased)` — **Welford** single-pass (numerically
  stable; do not use `Σx² − (Σx)²/n`). `biased` (default true) divides by
  `count`; sample divides by `count − 1` (→ `NaN` when `count < 2`).
- `reduceStdev` = `Math.sqrt(reduceVariance(...))`.
- `reduceMedian` / `reducePercentile(p)` — copy finite elements into a scratch
  array, sort ascending, linear-interpolate. Reuse the `ta.median` helper's
  interpolation if one exists (`packages/runtime/src/ta/**`); otherwise share
  one `quantile(sorted, q)` routine between median (`q = 0.5`) and percentile
  (`q = p/100`). Guard `p` to `[0, 100]` (clamp, document).
- `indexOf(view, value)` (0 = newest, matching `get(n)` orientation),
  `includes`, `sort(order)` (copy → `Array.prototype.sort` numeric comparator;
  `"desc"` reverses).

Reuse the population-stdev / median formula already proven by `ta.stdev` /
`ta.median` — cite the import path in code comments; do not re-derive.

### 2. Wire methods onto the runtime handle (`packages/runtime/src/...`)

Add the methods to the handle object the `state.array` slot returns, each
delegating to the helper with the store view. Keep allocation off the hot path
where possible (median/percentile/sort necessarily allocate a scratch copy —
that is acceptable and documented; sum/avg/min/max/variance/stdev allocate
nothing).

### 3. Tests (co-located)

- **Unit** (`packages/runtime/src/state/arrayReductions.test.ts`): each
  reduction on hand-built windows incl. edge cases — empty, single element,
  all-NaN, mixed NaN, `percentile(0)`/`percentile(100)`, `percentile(50)` ==
  `median`, sample vs population variance with `count < 2`, `sort` does not
  mutate the ring (assert `get(0)` unchanged after `sort`), `indexOf`
  orientation (0 = newest), capacity-eviction then reduce.
- **Property** (`packages/runtime/src/state/arrayReductions.property.test.ts`):
  for random finite windows — `min ≤ avg ≤ max`; `median` ∈ `[min, max]`;
  `stdev² ≈ variance` within `1e-9`; `percentile` monotonic non-decreasing in
  `p`; Welford `avg` matches a naive `Σ/n` within `1e-9`.
- **Golden** (`packages/runtime/src/state/arrayReductions.golden.test.ts` or
  the package golden convention): a fixed OHLC bar series pushed into a
  `state.array(14)`, asserting the emitted rolling `stdev` / `median` series
  bar-by-bar against committed goldens (the behavioral contract; document the
  tolerance, e.g. exact for the deterministic formatter, `1e-12` if any).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/state/arrayReductions.ts` | Create | Welford + quantile reduction helpers. |
| `packages/runtime/src/<state-array handle file>.ts` | Modify | Attach reduction methods to the handle. |
| `packages/runtime/src/state/arrayReductions.test.ts` | Create | Unit. |
| `packages/runtime/src/state/arrayReductions.property.test.ts` | Create | Property. |
| `packages/runtime/src/state/arrayReductions.golden.test.ts` | Create | Golden rolling-stat series. |
| `.changeset/array-analytics-runtime.md` | Create | minor (runtime). |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (coverage 100% on runtime)
- `pnpm bench:ci` (sum/avg/min/max must stay allocation-free on the hot path —
  add or extend a bench if the package convention requires one for new store
  methods)

## Changeset

`.changeset/array-analytics-runtime.md` — **minor** (runtime).

## Acceptance Criteria

- All reductions implemented over the store in one pass (median/percentile/sort
  the documented exception); skip-NaN + empty→NaN honoured.
- `sort()` never mutates the ring (asserted).
- Unit + property + golden layers landed; 100% coverage on runtime changes.
- Variance is Welford (no catastrophic-cancellation formula).
- Changeset committed.
