# Task 17 — Trend ports: `ta.vortex`, `ta.trendStrengthIndex`, `ta.ichimoku`

> **Status: TODO**

## Goal

Port Vortex Indicator, Trend Strength Index (Pearson-based slope
of regression), Ichimoku Cloud — a five-output filled-band-heavy
primitive.

## Prerequisites

- Task 4 (`pearson`, `donchianMid`).
- Task 16 (trend backbone; Ichimoku consumes `donchianMid`).

## Current Behavior

`ta.vortex`, `ta.trendStrengthIndex`, `ta.ichimoku` absent.

## Desired Behavior

- `TaNamespace` extends with three new methods.
- `TA_REGISTRY` cardinality 51 → 54.
- Ichimoku uses Task-1's `filled-band` PlotKind for the cloud.

## Requirements

### 1. Provenance

Standard 4-line header (`078f41fe2569d659d5aba726da8bcb5d3e2ced02`).

### 2. Signatures

```ts
ta.vortex(length: number, opts?: VortexOpts): VortexResult;                           // { plus, minus }
ta.trendStrengthIndex(source: Series<number>, length: number, opts?: TsiOpts2): Series<number>;
ta.ichimoku(opts?: IchimokuOpts): IchimokuResult; // { tenkan, kijun, senkouA, senkouB, chikou }
```

Opts default `conversionLength=9, baseLength=26, leadingSpanBLength=52, displacement=26` for Ichimoku, `length=14` for Vortex, `length=20` for TSI.

Note: `ta.trendStrengthIndex` is distinct from `ta.tsi` (True
Strength Index from Task 14). Names follow §9.2 spelling
exactly. TS type alias `TsiOpts2` distinguishes them.

### 3. Math + warmup

| Primitive | Source | Warmup |
|---|---|---|
| `ta.vortex` | `indicators/vortex.ts` | `length` |
| `ta.trendStrengthIndex` | `indicators/trend-strength-index.ts` + `lib/pearson` | `length - 1` |
| `ta.ichimoku` | `indicators/ichimoku.ts` + `lib/donchianMid` | `max(conversionLength, baseLength, leadingSpanBLength) + displacement - 1` |

### 4. Slot value shapes

- `ta.vortex`: `{ outputs: { plus, minus }, vmPlusWindow: Float64RingBuffer, vmMinusWindow, trWindow, prevHigh, prevLow, prevClose }`.
- `ta.trendStrengthIndex`: `{ outBuffer, series, pearsonSub, indexSeries: Float64RingBuffer }` — composes `lib/pearson` against a linear index series.
- `ta.ichimoku`: `{ outputs: { tenkan, kijun, senkouA, senkouB, chikou }, tenkanSub, kijunSub, senkouBSub, chikouShift, senkouSpanDisplaceBuffer }` — composes three `donchianMid` sub-slots; `chikou` shifts close by `displacement`; `senkouA` / `senkouB` shift forward by `displacement`.

### 5. Multi-output metadata

- `ta.vortex`: `primarySeriesKey: "plus"`, `yDomain: { kind: "auto" }`.
- `ta.trendStrengthIndex`: single-output; metadata not required.
- `ta.ichimoku`: `primarySeriesKey: "tenkan"`,
  `getVisibleSeriesKeys`: all five, `yDomain: { kind: "auto" }`.
  Cloud rendering uses `filled-band` between `senkouA` and
  `senkouB`.

### 6. NaN handling

- Vortex: zero-TR window → NaN.
- TSI: zero-variance window → NaN (Pearson denominator).
- Ichimoku: warmup-NaN on each component until its individual
  warmup completes; displaced spans NaN until displacement is
  fulfilled.

### 7. §22.10 set + scenarios

| File | Script |
|---|---|
| `taVortex.scenario.ts` | `const v = ta.vortex(14); plot(v.plus); plot(v.minus);`. |
| `taTrendStrengthIndex.scenario.ts` | `plot(ta.trendStrengthIndex(bar.close, 20))`. |
| `taIchimoku.scenario.ts` | `const i = ta.ichimoku(); plot(i.tenkan); plot(i.kijun); plot(i.senkouA, { style: { kind: "filled-band", upper: i.senkouA[0], lower: i.senkouB[0], alpha: 0.2 } });` (or however the Phase-1 `plot()` style options are wired). |

### 8. JSDoc

`@formula`, `@warmup`, `@since 0.2`, `@experimental`, `@example`,
`@anchors` for displacement.

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `packages/core/src/ta/ta.ts` | Modify | TaNamespace + opts + result types. |
| `packages/core/src/ta/ta.test.ts` | Modify | Stub coverage. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Three entries. |
| `packages/core/src/statefulPrimitives.test.ts` | Modify | Cardinality. |
| `packages/runtime/src/ta/{vortex,trendStrengthIndex,ichimoku}.ts` | Create | Impls. |
| `packages/runtime/src/ta/<id>.{test,property.test,golden.test,bench,bench.test}.ts` | Create (×3 × 5) | §22.10. |
| `packages/runtime/src/ta/registry.ts` | Modify | Cardinality 54 + multi-output metadata. |
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

`.changeset/phase-2-trend-vortex-tsi-ichimoku.md` — `minor` for
core / runtime / conformance.

## Acceptance Criteria

- Three primitives exported + registered (cardinality 54).
- `ta.trendStrengthIndex` is named distinctly from `ta.tsi` (§9.2
  honours both).
- Ichimoku composes `donchianMid` sub-slots + uses
  `filled-band` PlotKind (Task 1 prerequisite).
- §22.10 set complete; 100% coverage.
- Changeset committed.
