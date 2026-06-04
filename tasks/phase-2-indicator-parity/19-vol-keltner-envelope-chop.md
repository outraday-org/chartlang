# Task 19 — Volatility ports: `ta.keltner`, `ta.envelope`, `ta.chop`

> **Status: TODO**

## Goal

Port Keltner Channels (filled-band), Envelope (filled-band), and
the Choppiness Index.

## Prerequisites

- Phase 1 (`ta.atr` for Keltner).
- Task 7 (`computeMa` dispatcher for Keltner / Envelope middle).
- Task 18 (volatility backbone).

## Current Behavior

`ta.keltner`, `ta.envelope`, `ta.chop` absent.

## Desired Behavior

- `TaNamespace` extends with three new methods.
- `TA_REGISTRY` cardinality 57 → 60.

## Requirements

### 1. Provenance

Standard 4-line header (`078f41fe2569d659d5aba726da8bcb5d3e2ced02`).

### 2. Signatures

```ts
ta.keltner(opts?: KeltnerOpts): KeltnerResult;       // { upper, middle, lower }
ta.envelope(source: Series<number>, opts?: EnvelopeOpts): EnvelopeResult; // { upper, middle, lower }
ta.chop(length: number, opts?: ChopOpts): Series<number>;
```

Opts:
- `KeltnerOpts`: `{ length?: number; multiplier?: number; maType?: MaTypeNoVolume; offset?: number; outputs?: ... }` (defaults length=20, multiplier=2, maType="ema").
- `EnvelopeOpts`: `{ length?: number; percent?: number; maType?: MaTypeNoVolume; offset?: number }` (defaults length=20, percent=10, maType="sma").
- `ChopOpts`: `{ offset?: number; lineStyle?: PlotLineStyle }`.

### 3. Math + warmup

| Primitive | Source | Warmup |
|---|---|---|
| `ta.keltner` | `indicators/keltner.ts` + `lib/trSeries` + `lib/computeMa` | `length` |
| `ta.envelope` | `indicators/envelope.ts` + `lib/computeMa` | `length - 1` |
| `ta.chop` | `indicators/chop.ts` + `lib/trSeries` + `ta.highest` + `ta.lowest` | `length` |

- Keltner: `middle = MA(close, length, maType)`, `upper/lower =
  middle ± multiplier · ATR(length)`.
- Envelope: `middle = MA(src, length, maType)`,
  `upper/lower = middle · (1 ± percent / 100)`.
- Chop: `100 · log10(sum(TR, N) / (highest(high, N) − lowest(low, N))) / log10(N)`. Range [0, 100].

### 4. Slot value shapes

- `ta.keltner`: `{ outputs: { upper, middle, lower }, middleSub: <maType>, atrSub }`.
- `ta.envelope`: `{ outputs: { upper, middle, lower }, middleSub: <maType> }`.
- `ta.chop`: `{ outBuffer, series, trWindow, sumTr, highestSub, lowestSub }`.

### 5. Multi-output metadata

- Keltner / Envelope: `primarySeriesKey: "middle"`,
  `getVisibleSeriesKeys`: `["upper", "middle", "lower"]`,
  `yDomain: { kind: "auto" }`.
- Chop: single-output; `yDomain: { kind: "fixed", min: 0, max: 100 }`.

### 6. NaN handling

- Keltner / Envelope: middle NaN → all outputs NaN.
- Chop: zero range → NaN.

### 7. Range invariant

Chop ∈ [0, 100] — pinned via property test.

### 8. §22.10 set + scenarios

| File | Script |
|---|---|
| `taKeltner.scenario.ts` | `const k = ta.keltner({ length: 20, multiplier: 2 }); plot(k.upper); plot(k.middle); plot(k.lower);`. |
| `taEnvelope.scenario.ts` | `const e = ta.envelope(bar.close); plot(e.upper); plot(e.middle); plot(e.lower);`. |
| `taChop.scenario.ts` | `plot(ta.chop(14))`. |

### 9. JSDoc

`@formula`, `@warmup`, `@since 0.2`, `@experimental`, `@example`,
`@anchors maType`.

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `packages/core/src/ta/ta.ts` | Modify | TaNamespace + opts + result types. |
| `packages/core/src/ta/ta.test.ts` | Modify | Stub coverage. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Three entries. |
| `packages/core/src/statefulPrimitives.test.ts` | Modify | Cardinality. |
| `packages/runtime/src/ta/{keltner,envelope,chop}.ts` | Create | Impls. |
| `packages/runtime/src/ta/<id>.{test,property.test,golden.test,bench,bench.test}.ts` | Create (×3 × 5) | §22.10. |
| `packages/runtime/src/ta/registry.ts` | Modify | Cardinality 60 + multi-output metadata. |
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

`.changeset/phase-2-vol-keltner-envelope-chop.md` — `minor` for
core / runtime / conformance.

## Acceptance Criteria

- Three primitives exported + registered (cardinality 60).
- Keltner uses `lib/computeMa` for middle + reuses `ta.atr` slot.
- Chop range [0, 100] pinned.
- §22.10 set complete; 100% coverage.
- Changeset committed.
