# Task 28 — Statistical ports: `ta.median`, `ta.adr`, `ta.ulcerIndex`

> **Status: TODO**

## Goal

Port the three §9.2 statistical primitives that don't need
external data: rolling Median, Average Daily Range, Ulcer Index.
(`correlationCoeff` defers to Phase 5 — needs secondary-symbol
OHLCV.)

## Prerequisites

- Task 5 (cross-functional primitives — `ta.highest` / `ta.lowest`
  for ADR; warmup conventions for Median).

## Current Behavior

`ta.median`, `ta.adr`, `ta.ulcerIndex` absent.

## Desired Behavior

- `TaNamespace` extends with three new methods.
- `TA_REGISTRY` cardinality 87 → 90.

## Requirements

### 1. Provenance

Standard 4-line header (`078f41fe2569d659d5aba726da8bcb5d3e2ced02`).

### 2. Signatures

```ts
ta.median(source: Series<number>, length: number, opts?: MedianOpts): Series<number>;
ta.adr(opts?: AdrOpts): Series<number>;
ta.ulcerIndex(source: Series<number>, length: number, opts?: UlcerIndexOpts): Series<number>;
```

Each opts: `Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>` (ADR adds `length?: number`, default 14).

### 3. Math + warmup

| Primitive | Source | Warmup |
|---|---|---|
| `ta.median` | `indicators/median.ts` | `length - 1` |
| `ta.adr` | `indicators/adr.ts` | `length` daily bars |
| `ta.ulcerIndex` | `indicators/ulcer-index.ts` | `length - 1` |

- Median: rolling median over `length` window. Implementation
  uses a small `Float64RingBuffer` + sort-on-read (acceptable for
  typical `length < 200`; faster heap-based skip-list optional
  for perf, but the simple impl matches invinite).
- ADR: average of (highest(high, N) − lowest(low, N)) over the
  last N **daily** bars. Phase 2 keys "daily" on the calendar-day
  UTC boundary (same convention as VWAP — Task 21).
- Ulcer Index: `sqrt(mean(drawdown_pct^2, length))` where
  `drawdown_pct[t] = 100 · (src[t] − highest(src, length)[t]) / highest(src, length)[t]`.

### 4. Slot value shapes

- `ta.median`: `{ outBuffer, series, window: Float64RingBuffer of size length, sortedBuffer: Float64Array (reused for sort) }`.
- `ta.adr`: `{ outBuffer, series, dailyHigh, dailyLow, currentDayKey, completedRanges: Float64RingBuffer of size length, sumRanges }`.
- `ta.ulcerIndex`: `{ outBuffer, series, highestSub, drawdownSqWindow: Float64RingBuffer of size length, sumDrawdownSq }`.

### 5. Range invariants

- Ulcer Index ≥ 0 — property test.
- Median ∈ [min(source[..length]), max(source[..length])] for
  each bar — property test.

### 6. NaN handling

- Median: NaN slot ignored (window length effectively shrinks).
  If all `length` slots are NaN, output is NaN.
- ADR: NaN bars skipped from the daily aggregation.
- Ulcer Index: NaN source → NaN output.

### 7. §22.10 set + scenarios

| File | Script |
|---|---|
| `taMedian.scenario.ts` | `plot(ta.median(bar.close, 21))`. |
| `taAdr.scenario.ts` | `plot(ta.adr({ length: 14 }))`. |
| `taUlcerIndex.scenario.ts` | `plot(ta.ulcerIndex(bar.close, 14))`. |

### 8. JSDoc

`@formula`, `@warmup`, `@since 0.2`, `@experimental`, `@example`.
ADR JSDoc explicitly notes the Phase-2 calendar-day boundary
(same as VWAP) + the Phase-4 `syminfo.session` lift.

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `packages/core/src/ta/ta.ts` | Modify | TaNamespace + opts. |
| `packages/core/src/ta/ta.test.ts` | Modify | Stub coverage. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Three entries. |
| `packages/core/src/statefulPrimitives.test.ts` | Modify | Cardinality. |
| `packages/runtime/src/ta/{median,adr,ulcerIndex}.ts` | Create | Impls. |
| `packages/runtime/src/ta/<id>.{test,property.test,golden.test,bench,bench.test}.ts` | Create (×3 × 5) | §22.10. |
| `packages/runtime/src/ta/registry.ts` | Modify | Cardinality 90. |
| `packages/runtime/src/ta/registry.test.ts` | Modify | Cardinality. |
| `packages/conformance/src/scenarios/<id>.scenario.ts` | Create (×3) | Scenarios. |
| `packages/conformance/src/scenarios/index.ts` | Modify | Re-export. |
| `packages/conformance/src/scenarios/scenarios.test.ts` | Modify | Add. |
| `docs/primitives/ta/<id>.md` | Generate (×3) | Pages. |

## Gates

`pnpm typecheck`, `pnpm lint`, `pnpm test` (100% coverage),
`pnpm bench:ci`, `pnpm docs:check`, `pnpm docs:gate`,
`pnpm readme:check`, `pnpm conformance`.

## Changeset

`.changeset/phase-2-stat-median-adr-ulcerindex.md` — `minor` for
core / runtime / conformance.

## Acceptance Criteria

- Three primitives exported + registered (cardinality 90).
- Median range invariant pinned.
- Ulcer Index ≥ 0 pinned.
- ADR calendar-day boundary documented.
- §22.10 set complete; 100% coverage.
- Changeset committed.
