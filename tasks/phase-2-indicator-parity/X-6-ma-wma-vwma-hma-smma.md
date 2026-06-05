# Task 6 — MA ports: `ta.wma`, `ta.vwma`, `ta.hma`, `ta.smma`

> **Status: TODO**

## Goal

Port four moving averages whose math reduces to the Task-3
chained-MA helpers. Each ships the §22.10 set (impl + 4 test
layers + JSDoc + conformance scenario + auto-generated doc page),
honours universal `opts.offset`, and registers in
`TA_REGISTRY` + `TaNamespace` + `STATEFUL_PRIMITIVES`.

## Prerequisites

- Task 3 (`wmaFloat64`, `smmaFloat64`, `vwmaFloat64`,
  `computeMaOfFloat64` helpers).
- Task 5 (cross-functional primitives + `STATEFUL_PRIMITIVES`
  `slot: boolean` shape).

## Current Behavior

`ta.wma`, `ta.vwma`, `ta.hma`, `ta.smma` are absent from
`TaNamespace`. Scripts referencing them are compile-time errors.

## Desired Behavior

- `TaNamespace` extends with four new methods (signatures below).
- `TA_REGISTRY` cardinality grows from 15 → 19.
- `STATEFUL_PRIMITIVES` gains `ta.wma`, `ta.vwma`, `ta.hma`,
  `ta.smma` — all `slot: true`.
- Four conformance scenarios in
  `packages/conformance/src/scenarios/`.
- Auto-generated `docs/primitives/ta/<id>.md` per primitive.

## Requirements

### 1. Provenance

Standard 4-line header on every ported file
(`078f41fe2569d659d5aba726da8bcb5d3e2ced02`).

### 2. Signatures

```ts
ta.wma(source: Series<number>, length: number, opts?: WmaOpts): Series<number>;
ta.vwma(source: Series<number>, length: number, opts?: VwmaOpts): Series<number>;
ta.hma(source: Series<number>, length: number, opts?: HmaOpts): Series<number>;
ta.smma(source: Series<number>, length: number, opts?: SmmaOpts): Series<number>;
```

Each opts: `Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>`.

### 3. Math + warmup

| Primitive | Source | Warmup | Notes |
|---|---|---|---|
| `ta.wma` | `indicators/wma.ts` + `lib/wmaFloat64` | `length - 1` | Linear weights `1..N`. |
| `ta.vwma` | `indicators/vwma.ts` + `lib/vwmaFloat64` | `length - 1` | Volume-weighted; consumes `bar.volume`. |
| `ta.hma` | `indicators/hma.ts` | `length + ceil(sqrt(length)) - 2` | Hull MA: `WMA(2·WMA(src, N/2) − WMA(src, N), sqrt(N))`. Chains the WMA helper twice. |
| `ta.smma` | `indicators/smma.ts` + `lib/smmaFloat64` | `length - 1` | Smoothed MA, α = 1/N. |

### 4. Slot value shapes

| Primitive | Slot value |
|---|---|
| `ta.wma` | `{ outBuffer, series, sourceWindow: Float64RingBuffer of size length, weightedSum, simpleSum, count }`. |
| `ta.vwma` | `{ outBuffer, series, sourceWindow, volumeWindow, sumPV, sumV, count }`. |
| `ta.hma` | `{ outBuffer, series, halfWma: sub-slot, fullWma: sub-slot, diffSeries: Series<number>, finalWma: sub-slot }` (composes via sub-slot ids `${slotId}/half`, `${slotId}/full`, `${slotId}/diff`, `${slotId}/final`). |
| `ta.smma` | `{ outBuffer, series, prevSmma, count }`. |

`ta.hma` uses three nested WMA sub-slots. The composition follows
the §22.10 convention "multi-output primitives compose via
sub-slot ids derived from the parent slot id." Same routing
through the registry (no private copies of WMA math).

### 5. `opts.offset` wiring

Every primitive applies `lib/applyOffset` to the output `Series`
on first call (or recomputes from cached output when offset
changes — same convention Task 29 backfills onto Phase 1
primitives). Property test asserts `offset = 0` → original output,
`offset = k` → shifted output by `k` slots.

### 6. NaN handling

Sources with NaN slots → NaN at the output, window state
ignores that slot. `vwma` with zero-volume bar → NaN at output;
property test asserts.

### 7. §22.10 test set per primitive

Same five-file pattern as Task 5 + co-located conformance
scenario.

### 8. Conformance scenarios

Each scenario uses the `Scenario.inlineSource` field introduced
in Task 1 (wraps the body below in a `defineIndicator` shell;
runner picks the virtual `<inline:<id>>.chart.ts` path for
callsite-id assignment).

| File | Body (inside `compute`) |
|---|---|
| `taWma.scenario.ts` | `plot(ta.wma(bar.close, 14))`. |
| `taVwma.scenario.ts` | `plot(ta.vwma(bar.close, 20))`. |
| `taHma.scenario.ts` | `plot(ta.hma(bar.close, 21))`. |
| `taSmma.scenario.ts` | `plot(ta.smma(bar.close, 14))`. |

Each pinned against `goldenBars.json` (10 000 bars). Goldens
captured at task-execution time.

### 9. JSDoc per primitive

Per §17.2: one-line description, `@formula`, `@warmup`, `@since
0.2`, `@experimental`, one `@example` block.

### 10. Bench thresholds

`THRESHOLD_MS = ceil(median × 3)` per primitive, captured against
Apple-silicon on a 10 000-bar input. The Phase-1 SMA/EMA benches
are the perf reference — WMA/SMMA should be within 2× of SMA;
HMA roughly 3× of SMA (three chained WMAs); VWMA roughly 1.5× of
SMA.

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `packages/core/src/ta/ta.ts` | Modify | Extend TaNamespace + opts types + throw stubs. |
| `packages/core/src/ta/ta.test.ts` | Modify | Stub coverage. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Add four entries. |
| `packages/core/src/statefulPrimitives.test.ts` | Modify | Update cardinality. |
| `packages/runtime/src/ta/wma.ts` | Create | Impl. |
| `packages/runtime/src/ta/vwma.ts` | Create | Impl. |
| `packages/runtime/src/ta/hma.ts` | Create | Impl (composed sub-slots). |
| `packages/runtime/src/ta/smma.ts` | Create | Impl. |
| `packages/runtime/src/ta/<id>.{test,property.test,golden.test,bench,bench.test}.ts` | Create (×4 prims × 5) | §22.10 set. |
| `packages/runtime/src/ta/registry.ts` | Modify | Add four entries; cardinality 19. |
| `packages/runtime/src/ta/registry.test.ts` | Modify | Cardinality. |
| `packages/conformance/src/scenarios/ta<Id>.scenario.ts` | Create (×4) | Scenarios. |
| `packages/conformance/src/scenarios/index.ts` | Modify | Re-export. |
| `packages/conformance/src/scenarios/scenarios.test.ts` | Modify | Add scenarios. |
| `docs/primitives/ta/<id>.md` | Generate (×4) | Auto-generated pages. |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage)
- `pnpm bench:ci`
- `pnpm docs:check`
- `pnpm docs:gate`
- `pnpm readme:check`
- `pnpm conformance`

## Changeset

`.changeset/phase-2-ma-wma-vwma-hma-smma.md` — `minor` for
`@invinite-org/chartlang-core`,
`@invinite-org/chartlang-runtime`,
`@invinite-org/chartlang-conformance`.

## Acceptance Criteria

- Four primitives exported, registry-registered, conformance-
  scenario-pinned.
- HMA's three sub-slots compose through `TA_REGISTRY` (no private
  WMA math).
- Universal `opts.offset` honoured (property test asserts the
  shifted output).
- 100% coverage on every touched package.
- Auto-generated doc pages committed.
- Changeset committed.
