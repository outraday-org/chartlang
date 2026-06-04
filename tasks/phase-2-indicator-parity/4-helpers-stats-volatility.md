# Task 4 — Helpers: stats / volatility / regression / pearson

> **Status: TODO**

## Goal

Port the remaining §9.4 backbone helpers (donchian midpoint,
Wilder directional movement, ADX-from-DI assembly, linear
regression, Pearson correlation) into
`packages/runtime/src/ta/lib/`. These back the trend (Task 16-17),
volatility (Task 18-20), and S/R (Task 25-27) port batches.

## Prerequisites

- Task 2 (`gen-docs.ts`).
- Task 3 is independent — could run in parallel — but the README
  numbers it after 3 to keep "core helpers before stats helpers."

## Current Behavior

No `donchianMid`, `wilderDirectional`, `adxFromDi`,
`linearRegression`, or `pearson` helpers exist. The Phase-1
`wilderSmoothing` helper covers only the scalar α = 1/N smoothing
(used by RSI / ATR). Directional smoothing (`+DM` / `-DM`),
ADX assembly, OLS regression, and Pearson correlation all
require their own helpers — Task 4 ports them.

## Desired Behavior

After this task:

- `lib/donchianMid.ts` — `(highest(high, N) + lowest(low, N)) / 2`.
- `lib/wilderDirectional.ts` — `+DM`, `-DM`, smoothed via Wilder.
- `lib/adxFromDi.ts` — ADX line from `+DI` / `-DI`.
- `lib/linearRegression.ts` — rolling OLS (slope, intercept,
  value at last bar of window).
- `lib/pearson.ts` — Pearson correlation of two equal-length
  windows.

Each helper is Float64Array-in / Float64Array-out, independent of
`RuntimeContext`, with its own `.test.ts` / `.property.test.ts`
covering 100% lines + branches.

## Requirements

### 1. Provenance

Same 4-line header as Task 3, pinned at commit
`078f41fe2569d659d5aba726da8bcb5d3e2ced02`. Sources under
`../invinite/src/components/trading-chart/indicators/lib/`:

| Helper | Source |
|---|---|
| `donchianMid.ts` | `donchian-mid.ts` |
| `wilderDirectional.ts` | `wilder-directional.ts` |
| `adxFromDi.ts` | `adx-from-di.ts` |
| `linearRegression.ts` | `linear-regression.ts` |
| `pearson.ts` | `pearson.ts` |

### 2. `lib/donchianMid.ts`

```ts
export function donchianMid(
    high: Float64Array,
    low: Float64Array,
    length: number,
): Float64Array;
```

`mid[t] = (max(high[t-length+1..t]) + min(low[t-length+1..t])) / 2`.
Warmup: `length - 1`. Used by `ta.donchian` (Task 18) and
`ta.ichimoku` (Task 17).

### 3. `lib/wilderDirectional.ts`

```ts
export type DirectionalMovement = Readonly<{
    plusDm: Float64Array;
    minusDm: Float64Array;
    plusDi: Float64Array;
    minusDi: Float64Array;
}>;

export function wilderDirectional(
    high: Float64Array,
    low: Float64Array,
    close: Float64Array,
    length: number,
): DirectionalMovement;
```

Computes `+DM[t]` / `-DM[t]` per Wilder, smooths with α = 1/N
(reuses Phase-1 `lib/wilderSmoothing`), divides by smoothed True
Range (Phase-1 `lib/trSeries`). Warmup: `length` (one extra to seed
TR). Consumed by `ta.dmi` (Task 16) and `ta.adx` (Task 16).

### 4. `lib/adxFromDi.ts`

```ts
export function adxFromDi(
    plusDi: Float64Array,
    minusDi: Float64Array,
    length: number,
): Float64Array;
```

`DX[t] = 100 * |+DI[t] − −DI[t]| / (+DI[t] + −DI[t])` then Wilder
smooth `DX` with α = 1/N. Warmup: `2 * length - 1`. Consumed by
`ta.adx` (Task 16).

### 5. `lib/linearRegression.ts`

```ts
export type LinearRegressionFrame = Readonly<{
    slope: Float64Array;
    intercept: Float64Array;
    value: Float64Array;       // value of the regression line at the last bar of the window
}>;

export function linearRegression(
    source: Float64Array,
    length: number,
): LinearRegressionFrame;
```

Rolling OLS over the trailing `length` window. Warmup: `length - 1`.
Consumed by `ta.lsma` (Task 8), `ta.dpo` (Task 10), and the future
Phase-3 `regressionTrend` drawing.

Numerical stability note: invinite uses the closed-form
`(N·Σxy − Σx·Σy) / (N·Σx² − (Σx)²)` with `x` as integer indices
0..N-1. The port keeps the same closed-form; the property test
asserts the slope against an independent reference (e.g. `simple-
statistics` in dev only) on random fixtures.

### 6. `lib/pearson.ts`

```ts
export function pearson(
    a: Float64Array,
    b: Float64Array,
    length: number,
): Float64Array;
```

Rolling Pearson correlation. Warmup: `length - 1`. Output ∈
[-1, 1] (property test asserts the range). Consumed by
`ta.trendStrengthIndex` (Task 17). Phase-5 `correlationCoeff`
re-uses this helper once external-data primitives ship.

### 7. Test layers per §16.3

For each new helper:

| File | Coverage |
|---|---|
| `<helper>.test.ts` | Unit tests pinning the math against hand-curated fixtures (port verbatim from invinite). |
| `<helper>.property.test.ts` | `fast-check` invariants — length invariance, warmup NaN, determinism, output ranges where the math implies them (Pearson ∈ [-1, 1]; ADX ∈ [0, 100]). |
| `<helper>.bench.ts` + `<helper>.bench.test.ts` | Bench pair for hot-path helpers — `wilderDirectional`, `linearRegression`, `pearson`. `donchianMid` and `adxFromDi` skip the bench files because they reduce to two `Math.max/min` scans or a Wilder smooth respectively — the consumer primitive's bench (Tasks 16, 18) covers the perf surface. |

### 8. NaN propagation

Every helper handles NaN inputs by propagating NaN at the matching
output slot. Property test asserts this.

### 9. JSDoc

Per helper: `@since 0.2`, `@stable`, `@formula`, `@warmup`,
`@example` (comment-only — no `defineIndicator`).

### 10. Coverage

100% on every helper. Each new file's branch matrix (NaN seeds,
zero variance for `linearRegression` / `pearson`, zero TR for
`wilderDirectional`) is covered by unit tests; the property tests
add fuzz coverage.

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `packages/runtime/src/ta/lib/donchianMid.ts` | Create | Port. |
| `packages/runtime/src/ta/lib/donchianMid.{test,property.test}.ts` | Create | Tests. |
| `packages/runtime/src/ta/lib/wilderDirectional.ts` | Create | Port. |
| `packages/runtime/src/ta/lib/wilderDirectional.{test,property.test,bench,bench.test}.ts` | Create | Tests + bench. |
| `packages/runtime/src/ta/lib/adxFromDi.ts` | Create | Port. |
| `packages/runtime/src/ta/lib/adxFromDi.{test,property.test}.ts` | Create | Tests. |
| `packages/runtime/src/ta/lib/linearRegression.ts` | Create | Port. |
| `packages/runtime/src/ta/lib/linearRegression.{test,property.test,bench,bench.test}.ts` | Create | Tests + bench. |
| `packages/runtime/src/ta/lib/pearson.ts` | Create | Port. |
| `packages/runtime/src/ta/lib/pearson.{test,property.test,bench,bench.test}.ts` | Create | Tests + bench. |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage)
- `pnpm bench:ci`
- `pnpm docs:check`
- `pnpm readme:check`

Note: `pnpm conformance` is intentionally **not** in this task's
gates — helpers don't expose script-author surfaces. Consumer
primitives in Tasks 6–28 carry the conformance scenarios.

## Changeset

`.changeset/phase-2-helpers-stats-volatility.md` — `minor` for
`@invinite-org/chartlang-runtime` (internal helpers; public delta
lands in consumer primitive tasks).

## Acceptance Criteria

- Five helpers compile + pass tests with 100% coverage.
- Property tests pin output ranges (Pearson ∈ [-1, 1], ADX-side
  helper outputs propagate through to the [0, 100] ADX range).
- Provenance header present on every file.
- Changeset committed.
