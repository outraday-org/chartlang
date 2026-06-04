# Task 11 — Oscillator ports: `ta.stochRsi`, `ta.ultimateOsc`, `ta.coppock`

> **Status: TODO**

## Goal

Port Stochastic RSI, Ultimate Oscillator, and Coppock Curve.

## Prerequisites

- Task 9 (Stoch baseline + `ta.highest` / `ta.lowest`).

## Current Behavior

These three primitives absent.

## Desired Behavior

- `TaNamespace` extends with three new methods.
- `TA_REGISTRY` cardinality 32 → 35.

## Requirements

### 1. Provenance

Standard 4-line header (`078f41fe2569d659d5aba726da8bcb5d3e2ced02`).

### 2. Signatures

```ts
ta.stochRsi(source: Series<number>, opts?: StochRsiOpts): StochRsiResult; // { k, d }
ta.ultimateOsc(opts?: UltimateOscOpts): Series<number>;
ta.coppock(source: Series<number>, opts?: CoppockOpts): Series<number>;
```

- `StochRsiOpts`: `{ rsiLength?: number; stochLength?: number; kSmoothing?: number; dSmoothing?: number; offset?: number }` (defaults 14, 14, 3, 3).
- `UltimateOscOpts`: `{ shortLength?: number; mediumLength?: number; longLength?: number; offset?: number }` (defaults 7, 14, 28).
- `CoppockOpts`: `{ roc1Length?: number; roc2Length?: number; wmaLength?: number; offset?: number }` (defaults 11, 14, 10).

`StochRsiResult = Readonly<{ k: Series<number>; d: Series<number> }>`.

### 3. Math + warmup

| Primitive | Source | Warmup |
|---|---|---|
| `ta.stochRsi` | `indicators/stoch-rsi.ts` | `rsiLength + stochLength + kSmoothing + dSmoothing - 4` |
| `ta.ultimateOsc` | `indicators/ultimate-osc.ts` | `longLength` |
| `ta.coppock` | `indicators/coppock.ts` | `max(roc1, roc2) + wmaLength` |

- Stoch RSI: Stoch applied to RSI's output. Composes `ta.rsi` +
  `ta.highest` + `ta.lowest` + two SMAs via sub-slots.
- Ultimate Oscillator: weighted average of 3 BP/TR averages
  across three lookback windows.
- Coppock: `WMA(ROC(src, n1) + ROC(src, n2), wmaLength)`.
  Composes `ta.change` (via two ROC sub-slots) and `lib/wmaFloat64`.

### 4. Slot value shapes

- `ta.stochRsi`: `{ outputs: { k, d }, rsiSub, highestSub, lowestSub, kSub, dSub }`.
- `ta.ultimateOsc`: `{ outBuffer, series, bpWindow1, bpWindow2, bpWindow3, trWindow1, trWindow2, trWindow3, prevClose }` (all `Float64RingBuffer`s; bpN / trN sums maintained incrementally per Wilder-style accumulator).
- `ta.coppock`: `{ outBuffer, series, roc1Sub, roc2Sub, wmaSub }`.

### 5. Multi-output for `ta.stochRsi`

- `primarySeriesKey: "k"`.
- `getVisibleSeriesKeys`: `["k", "d"]`.
- `yDomain: { kind: "fixed", min: 0, max: 100 }`.

### 6. NaN handling

Stoch RSI: zero-denominator (flat RSI range) → NaN. Ultimate
Osc: zero-TR window → NaN. Coppock: NaN ROC → NaN output.

### 7. §22.10 set + scenarios

| File | Script |
|---|---|
| `taStochRsi.scenario.ts` | `const s = ta.stochRsi(bar.close); plot(s.k); plot(s.d);`. |
| `taUltimateOsc.scenario.ts` | `plot(ta.ultimateOsc())`. |
| `taCoppock.scenario.ts` | `plot(ta.coppock(bar.close))`. |

### 8. JSDoc

`@formula`, `@warmup`, `@since 0.2`, `@experimental`, `@example`.

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `packages/core/src/ta/ta.ts` | Modify | TaNamespace + opts + StochRsiResult. |
| `packages/core/src/ta/ta.test.ts` | Modify | Stub coverage. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Three entries. |
| `packages/core/src/statefulPrimitives.test.ts` | Modify | Cardinality. |
| `packages/runtime/src/ta/{stochRsi,ultimateOsc,coppock}.ts` | Create | Impls. |
| `packages/runtime/src/ta/<id>.{test,property.test,golden.test,bench,bench.test}.ts` | Create (×3 × 5) | §22.10. |
| `packages/runtime/src/ta/registry.ts` | Modify | Cardinality 35; metadata for `stochRsi`. |
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

`.changeset/phase-2-osc-stochrsi-ultimateosc-coppock.md` —
`minor` for core / runtime / conformance.

## Acceptance Criteria

- Three primitives exported + registered (cardinality 35).
- StochRsi composes via the registry (no private RSI / Stoch
  copies).
- Stoch RSI's `k` ∈ [0, 100] (property test).
- §22.10 set complete; 100% coverage.
- Changeset committed.
