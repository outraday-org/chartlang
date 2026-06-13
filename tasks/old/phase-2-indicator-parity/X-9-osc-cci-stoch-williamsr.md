# Task 9 — Oscillator ports: `ta.cci`, `ta.stoch`, `ta.williamsR`

> **Status: TODO**

## Goal

Port three foundational oscillators: CCI (Commodity Channel
Index), Stochastic (multi-output %K / %D), Williams %R.

## Prerequisites

- Task 5 (`ta.highest` / `ta.lowest` for the Stoch / Williams%R
  rolling range).

## Current Behavior

`ta.cci`, `ta.stoch`, `ta.williamsR` absent.

## Desired Behavior

- `TaNamespace` extends with three new methods.
- `TA_REGISTRY` cardinality 26 → 29.
- Three conformance scenarios.

## Requirements

### 1. Provenance

Standard 4-line header (`078f41fe2569d659d5aba726da8bcb5d3e2ced02`).

### 2. Signatures

```ts
ta.cci(source: Series<number>, length: number, opts?: CciOpts): Series<number>;
ta.stoch(opts?: StochOpts): StochResult; // multi-output: { k, d }
ta.williamsR(length: number, opts?: WilliamsROpts): Series<number>;
```

- `CciOpts`: `{ offset?: number; lineStyle?: PlotLineStyle }`.
- `StochOpts`: `{ kLength?: number; kSmoothing?: number; dLength?: number; offset?: number }` (defaults 14, 3, 3).
- `WilliamsROpts`: `{ offset?: number; lineStyle?: PlotLineStyle }`.

`StochResult = Readonly<{ k: Series<number>; d: Series<number> }>`.

### 3. Math + warmup

| Primitive | Source | Warmup | Range |
|---|---|---|---|
| `ta.cci` | `indicators/cci.ts` | `length - 1` | unbounded (typically ±200) |
| `ta.stoch` | `indicators/stoch.ts` | `kLength + kSmoothing + dLength - 3` | `k`, `d` ∈ [0, 100] |
| `ta.williamsR` | `indicators/williams-r.ts` | `length - 1` | [-100, 0] |

`ta.stoch` derives from `bar.high` / `bar.low` / `bar.close`
(no `source` param — mirrors Pine + invinite).
`ta.williamsR` also derives from OHLC, not a source param.

### 4. Slot value shapes

- `ta.cci`: `{ outBuffer, series, typicalPriceWindow: Float64RingBuffer of size length, sumTp, count }`.
- `ta.stoch`: `{ outputs: { k, d }, highestSub, lowestSub, kSmoothingSub, dSmoothingSub }` — composes `ta.highest` + `ta.lowest` via sub-slots, then SMA via two more sub-slots for the k / d smoothing.
- `ta.williamsR`: `{ outBuffer, series, highestSub, lowestSub }` — composes `ta.highest` + `ta.lowest` via sub-slots.

### 5. Multi-output contract for `ta.stoch`

- `primarySeriesKey: "k"`.
- `getVisibleSeriesKeys`: `["k", "d"]`.
- `yDomain: { kind: "fixed", min: 0, max: 100 }`.

Recorded on the registry entry's `metadata` field.

### 6. `opts.offset` wiring

Universal `opts.offset` applied to output(s).

### 7. NaN handling

- `ta.cci`: NaN source slot → NaN output; window state skips.
- `ta.stoch`: highest == lowest (flat-line input) → NaN at `k`
  (matches invinite — zero-denominator guard).
- `ta.williamsR`: same flat-line edge → NaN.

### 8. Property tests

- `ta.stoch.k` ∈ [0, 100] (after warmup, where defined).
- `ta.williamsR` ∈ [-100, 0] (after warmup, where defined).
- `ta.cci` — unbounded; assert determinism + length invariance.

### 9. §22.10 + scenarios

| File | Script |
|---|---|
| `taCci.scenario.ts` | `plot(ta.cci(bar.hlc3, 20))`. |
| `taStoch.scenario.ts` | `const s = ta.stoch({ kLength: 14, kSmoothing: 3, dLength: 3 }); plot(s.k); plot(s.d);`. |
| `taWilliamsR.scenario.ts` | `plot(ta.williamsR(14))`. |

### 10. JSDoc

`@formula`, `@warmup`, `@since 0.2`, `@experimental`, `@example`.
Stoch additionally documents `primarySeriesKey: "k"`.

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `packages/core/src/ta/ta.ts` | Modify | TaNamespace + opts + StochResult. |
| `packages/core/src/ta/ta.test.ts` | Modify | Stub coverage. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Three entries. |
| `packages/core/src/statefulPrimitives.test.ts` | Modify | Cardinality. |
| `packages/runtime/src/ta/{cci,stoch,williamsR}.ts` | Create | Impls. |
| `packages/runtime/src/ta/<id>.{test,property.test,golden.test,bench,bench.test}.ts` | Create (×3 × 5) | §22.10. |
| `packages/runtime/src/ta/registry.ts` | Modify | Cardinality 29; metadata for `stoch`. |
| `packages/runtime/src/ta/registry.test.ts` | Modify | Cardinality + metadata. |
| `packages/conformance/src/scenarios/<id>.scenario.ts` | Create (×3) | Scenarios. |
| `packages/conformance/src/scenarios/index.ts` | Modify | Re-export. |
| `packages/conformance/src/scenarios/scenarios.test.ts` | Modify | Add. |
| `docs/primitives/ta/<id>.md` | Generate (×3) | Pages. |

## Gates

`pnpm typecheck`, `pnpm lint`, `pnpm test` (100% coverage),
`pnpm bench:ci`, `pnpm docs:check`, `pnpm docs:gate`,
`pnpm readme:check`, `pnpm conformance`.

## Changeset

`.changeset/phase-2-osc-cci-stoch-williamsr.md` — `minor` for
core / runtime / conformance.

## Acceptance Criteria

- Three primitives exported + registered (cardinality 29).
- `ta.stoch` multi-output metadata recorded.
- Range invariants (Stoch.k ∈ [0,100], Williams%R ∈ [-100, 0])
  pinned via property tests.
- §22.10 set complete; 100% coverage.
- Changeset committed.
