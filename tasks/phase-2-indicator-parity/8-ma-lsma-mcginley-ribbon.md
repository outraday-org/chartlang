# Task 8 — MA ports: `ta.lsma`, `ta.mcginley`, `ta.maRibbon`

> **Status: TODO**

## Goal

Port the final three MAs in §9.2: LSMA (linear regression value),
McGinley Dynamic, and MA Ribbon (a multi-output MA family
visualiser). Closes out the §9.2 moving-averages list.

## Prerequisites

- Task 4 (`lib/linearRegression` for `ta.lsma`).
- Task 7 (registry cardinality 23).

## Current Behavior

`ta.lsma`, `ta.mcginley`, `ta.maRibbon` absent.

## Desired Behavior

- `TaNamespace` extends with three new methods.
- `TA_REGISTRY` cardinality 23 → 26.
- `STATEFUL_PRIMITIVES` adds three entries (all `slot: true`).
- Three conformance scenarios.

## Requirements

### 1. Provenance

Standard 4-line header (`078f41fe2569d659d5aba726da8bcb5d3e2ced02`).

### 2. Signatures

```ts
ta.lsma(source: Series<number>, length: number, opts?: LsmaOpts): Series<number>;
ta.mcginley(source: Series<number>, length: number, opts?: McginleyOpts): Series<number>;
ta.maRibbon(source: Series<number>, opts?: MaRibbonOpts): MaRibbonResult;
```

Opts:

- `LsmaOpts`: `{ offset?: number; lineStyle?: PlotLineStyle }`.
- `McginleyOpts`: `{ offset?: number; lineStyle?: PlotLineStyle }`.
- `MaRibbonOpts`: `{ lengths?: ReadonlyArray<number>; maType?: MaTypeNoVolume; offset?: number; outputs?: Readonly<Record<string, { lineStyle?: PlotLineStyle }>> }` (defaults `lengths = [10, 20, 30, 40, 50]`, `maType = "sma"`).

`MaRibbonResult`: dynamic-key record — `{ ma_<length>: Series<number> }` keyed by `lengths`. Type expressed as `Readonly<Record<string, Series<number>>>` with a stable iteration helper exported from core (`ta.maRibbon.outputKeys(opts)` returns the ordered keys).

### 3. Math + warmup

| Primitive | Source | Warmup |
|---|---|---|
| `ta.lsma` | `indicators/lsma.ts` + `lib/linearRegression` | `length - 1` |
| `ta.mcginley` | `indicators/mcginley.ts` | `length` |
| `ta.maRibbon` | `indicators/ma-ribbon.ts` | `max(lengths) - 1` (per output: matches the source MA's warmup) |

LSMA: linear regression value at the last bar of the trailing
`length` window. McGinley: `mc[t] = mc[t-1] + (src[t] − mc[t-1]) / (N · (src[t] / mc[t-1])^4)`. MA Ribbon: a fan of `K` MAs at
different lengths, all of the same `maType`.

### 4. Slot value shapes

- `ta.lsma`: `{ outBuffer, series, sourceWindow: Float64RingBuffer of size length, sumX, sumX2 (precomputed constants for the rolling-x regression), sumY, sumXY }`.
- `ta.mcginley`: `{ outBuffer, series, prevMc, count }`.
- `ta.maRibbon`: `{ outputs: Map<string, { outBuffer, series, subSlotId }>, lengths: ReadonlyArray<number>, maType: MaTypeNoVolume }`. Each output composes via a sub-slot id `${slotId}/ma_${length}` and dispatches through `computeMaOfFloat64`.

### 5. Multi-output contract (per §9.1)

`ta.maRibbon` is a multi-output primitive — it declares:

- `primarySeriesKey: "ma_<max(lengths)>"`.
- `getVisibleSeriesKeys(opts)`: returns every `ma_<length>`.
- `yDomain: { kind: "auto" }`.

These metadata fields live on the runtime registry entry (extend
`TA_REGISTRY` entries to optionally carry a `metadata: { primarySeriesKey, getVisibleSeriesKeys, yDomain }` field; Phase-1 single-output primitives leave it `undefined`). The editor / adapter
read it when sizing legend chips and sub-pane axes.

### 6. `opts.offset` wiring

LSMA and McGinley honour `opts.offset` via `lib/applyOffset`. MA
Ribbon applies `opts.offset` to every output series.

### 7. NaN handling

LSMA's source NaN slot → NaN at output. McGinley's `prevMc = 0`
edge case (zero-seed) → NaN until the first finite source slot
seeds it (matches invinite).

### 8. §22.10 test set + scenarios

| File | Script |
|---|---|
| `taLsma.scenario.ts` | `plot(ta.lsma(bar.close, 25))`. |
| `taMcginley.scenario.ts` | `plot(ta.mcginley(bar.close, 14))`. |
| `taMaRibbon.scenario.ts` | `const r = ta.maRibbon(bar.close, { lengths: [10, 20, 30], maType: "ema" }); plot(r.ma_10); plot(r.ma_20); plot(r.ma_30);`. |

### 9. JSDoc

`@formula`, `@warmup`, `@since 0.2`, `@experimental`, `@example`.
`ta.maRibbon` also documents `@anchors lengths, maType` and
`primarySeriesKey` resolution rules.

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `packages/core/src/ta/ta.ts` | Modify | TaNamespace + opts + MaRibbonResult. |
| `packages/core/src/ta/ta.test.ts` | Modify | Stub coverage. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Three entries. |
| `packages/core/src/statefulPrimitives.test.ts` | Modify | Cardinality. |
| `packages/runtime/src/ta/{lsma,mcginley,maRibbon}.ts` | Create | Impls. |
| `packages/runtime/src/ta/<id>.{test,property.test,golden.test,bench,bench.test}.ts` | Create (×3 × 5) | §22.10. |
| `packages/runtime/src/ta/registry.ts` | Modify | Cardinality 26; multi-output metadata for `maRibbon`. |
| `packages/runtime/src/ta/registry.test.ts` | Modify | Cardinality + metadata. |
| `packages/conformance/src/scenarios/<id>.scenario.ts` | Create (×3) | Scenarios. |
| `packages/conformance/src/scenarios/index.ts` | Modify | Re-export. |
| `packages/conformance/src/scenarios/scenarios.test.ts` | Modify | Add scenarios. |
| `docs/primitives/ta/<id>.md` | Generate (×3) | Pages. |

## Gates

`pnpm typecheck`, `pnpm lint`, `pnpm test` (100% coverage),
`pnpm bench:ci`, `pnpm docs:check`, `pnpm docs:gate`,
`pnpm readme:check`, `pnpm conformance`.

## Changeset

`.changeset/phase-2-ma-lsma-mcginley-ribbon.md` — `minor` for
`@invinite-org/chartlang-core`,
`@invinite-org/chartlang-runtime`,
`@invinite-org/chartlang-conformance`.

## Acceptance Criteria

- Three primitives exported + registered (cardinality 26).
- `ta.maRibbon` is registry-tagged as multi-output with
  `primarySeriesKey` + `getVisibleSeriesKeys` + `yDomain`.
- LSMA reuses `lib/linearRegression` (no private regression copy).
- McGinley's zero-seed edge is NaN-correct.
- §22.10 set complete; 100% coverage.
- Changeset committed.
