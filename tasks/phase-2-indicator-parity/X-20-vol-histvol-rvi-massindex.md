# Task 20 — Volatility ports: `ta.historicalVolatility`, `ta.rvi`, `ta.massIndex`

> **Status: TODO**

## Goal

Port Historical Volatility, RVI (Relative Volatility Index, the
stddev-based oscillator — distinct from RVGI), Mass Index.

## Prerequisites

- Phase 1 (`ta.stdev` for HV and RVI).
- Task 7 (EMA chains for Mass Index).

## Current Behavior

`ta.historicalVolatility`, `ta.rvi`, `ta.massIndex` absent.

## Desired Behavior

- `TaNamespace` extends with three new methods.
- `TA_REGISTRY` cardinality 60 → 63.

## Requirements

### 1. Provenance

Standard 4-line header (`078f41fe2569d659d5aba726da8bcb5d3e2ced02`).

### 2. Signatures

```ts
ta.historicalVolatility(source: Series<number>, length: number, opts?: HvOpts): Series<number>;
ta.rvi(source: Series<number>, length: number, opts?: RviOpts): Series<number>;
ta.massIndex(opts?: MassIndexOpts): Series<number>;
```

- `HvOpts`: `{ annualisationFactor?: number; offset?: number }` (default `annualisationFactor = 365`).
- `RviOpts`: `{ offset?: number; lineStyle?: PlotLineStyle }`.
- `MassIndexOpts`: `{ emaLength?: number; sumLength?: number; offset?: number }` (defaults 9, 25).

### 3. Math + warmup

| Primitive | Source | Warmup |
|---|---|---|
| `ta.historicalVolatility` | `indicators/historical-volatility.ts` + `lib/rollingStddev` | `length` |
| `ta.rvi` | `indicators/rvi.ts` | `length + 10 - 1` (10-bar Wilder smoothing on the up/down stddev split) |
| `ta.massIndex` | `indicators/mass-index.ts` + `lib/emaFloat64` | `emaLength + emaLength + sumLength - 3` |

- HV: `stddev(ln(src[0] / src[1]), length) · sqrt(annualisationFactor) · 100`.
- RVI: stddev split into up- / down-move stddev, smoothed; ratio
  `100 · upSmoothed / (upSmoothed + downSmoothed)`. Range [0, 100].
- Mass Index: `sum(EMA(H−L, 9) / EMA(EMA(H−L, 9), 9), sumLength)`.

### 4. Slot value shapes

- `ta.historicalVolatility`: `{ outBuffer, series, logReturnsWindow: Float64RingBuffer of size length, stdevSub }`.
- `ta.rvi`: `{ outBuffer, series, upWindow, downWindow, upSmoothSub, downSmoothSub, prevSrc }`.
- `ta.massIndex`: `{ outBuffer, series, ema1Sub, ema2Sub, ratioWindow: Float64RingBuffer of size sumLength, sumRatio }`.

### 5. Range invariants

- RVI ∈ [0, 100] (property test).
- HV ≥ 0.

### 6. NaN handling

- HV: NaN log-return → NaN output.
- RVI: zero-denominator → NaN.
- Mass Index: zero-ratio → carry forward (matches invinite).

### 7. §22.10 set + scenarios

| File | Script |
|---|---|
| `taHistoricalVolatility.scenario.ts` | `plot(ta.historicalVolatility(bar.close, 10))`. |
| `taRvi.scenario.ts` | `plot(ta.rvi(bar.close, 10))`. |
| `taMassIndex.scenario.ts` | `plot(ta.massIndex())`. |

### 8. JSDoc

`@formula`, `@warmup`, `@since 0.2`, `@experimental`, `@example`,
`@anchors annualisationFactor` for HV.

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `packages/core/src/ta/ta.ts` | Modify | TaNamespace + opts. |
| `packages/core/src/ta/ta.test.ts` | Modify | Stub coverage. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Three entries. |
| `packages/core/src/statefulPrimitives.test.ts` | Modify | Cardinality. |
| `packages/runtime/src/ta/{historicalVolatility,rvi,massIndex}.ts` | Create | Impls. |
| `packages/runtime/src/ta/<id>.{test,property.test,golden.test,bench,bench.test}.ts` | Create (×3 × 5) | §22.10. |
| `packages/runtime/src/ta/registry.ts` | Modify | Cardinality 63. |
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

`.changeset/phase-2-vol-histvol-rvi-massindex.md` — `minor` for
core / runtime / conformance.

## Acceptance Criteria

- Three primitives exported + registered (cardinality 63).
- HV uses `lib/rollingStddev` (no private stddev math).
- RVI range [0, 100] pinned.
- §22.10 set complete; 100% coverage.
- Changeset committed.
