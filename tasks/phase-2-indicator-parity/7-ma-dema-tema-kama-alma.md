# Task 7 — MA ports: `ta.dema`, `ta.tema`, `ta.kama`, `ta.alma`

> **Status: TODO**

## Goal

Port four chained / adaptive moving averages. DEMA / TEMA chain
the Phase-1 EMA helper; KAMA is Kaufman's adaptive MA; ALMA is the
Arnaud Legoux MA with Gaussian-weighted distribution.

## Prerequisites

- Task 6 (registry cardinality 19, MA backbone in place).

## Current Behavior

These four primitives are absent from `TaNamespace`. Adaptive-MA
math is not yet expressible in chartlang.

## Desired Behavior

- `TaNamespace` extends with four new methods.
- `TA_REGISTRY` cardinality 19 → 23.
- `STATEFUL_PRIMITIVES` adds four `slot: true` entries.
- Four conformance scenarios.
- Auto-generated doc pages.

## Requirements

### 1. Provenance

Standard 4-line header (`078f41fe2569d659d5aba726da8bcb5d3e2ced02`).

### 2. Signatures

```ts
ta.dema(source: Series<number>, length: number, opts?: DemaOpts): Series<number>;
ta.tema(source: Series<number>, length: number, opts?: TemaOpts): Series<number>;
ta.kama(source: Series<number>, opts?: KamaOpts): Series<number>;
ta.alma(source: Series<number>, length: number, opts?: AlmaOpts): Series<number>;
```

- `DemaOpts` / `TemaOpts`: `{ offset?: number; lineStyle?: PlotLineStyle }`.
- `KamaOpts`: `{ length?: number; fastLength?: number; slowLength?: number; offset?: number; lineStyle?: PlotLineStyle }` (defaults `length=10`, `fast=2`, `slow=30`).
- `AlmaOpts`: `{ offset?: number; sigma?: number; lineStyle?: PlotLineStyle }` (defaults `offset=0.85`, `sigma=6`; the ALMA `offset` is the Gaussian centre, NOT the universal bar-shift — distinguished by `barShift?: number` field for universal offset on this opts only).

### 3. Math + warmup

| Primitive | Source | Warmup |
|---|---|---|
| `ta.dema` | `indicators/dema.ts` | `2 * length - 2` |
| `ta.tema` | `indicators/tema.ts` | `3 * length - 3` |
| `ta.kama` | `indicators/kama.ts` | `length` |
| `ta.alma` | `indicators/alma.ts` | `length - 1` |

DEMA: `2·EMA(src) − EMA(EMA(src))`. TEMA: `3·EMA − 3·EMA² + EMA³`.
KAMA: adaptive α between `2/(fast+1)` and `2/(slow+1)` scaled by
the volatility ratio. ALMA: Gaussian-weighted MA with centred
peak at `offset · (length − 1)` and spread `length / sigma`.

### 4. Slot value shapes

- `ta.dema`: `{ outBuffer, series, ema1: sub-slot, ema2: sub-slot }`.
- `ta.tema`: `{ outBuffer, series, ema1, ema2, ema3 }` (sub-slots).
- `ta.kama`: `{ outBuffer, series, prevKama, sourceWindow: Float64RingBuffer of size length+1, fastAlpha, slowAlpha, count }`.
- `ta.alma`: `{ outBuffer, series, sourceWindow: Float64RingBuffer of size length, weights: Float64Array of size length, normaliser }` (weights computed once at first call from `offset`/`sigma`).

### 5. `opts.offset` wiring

Standard via `lib/applyOffset`. ALMA's `offset` param is the
Gaussian centre and is documented in JSDoc with a distinct
`@anchors offset` tag; the universal bar-shift on ALMA uses
`opts.barShift` (documented in JSDoc).

### 6. NaN handling

Source NaN slot → NaN at output. KAMA with zero volatility (all
equal sources) → `prevKama` carries forward (matches invinite +
property test).

### 7. §22.10 test set + scenarios

| File | Script |
|---|---|
| `taDema.scenario.ts` | `plot(ta.dema(bar.close, 20))`. |
| `taTema.scenario.ts` | `plot(ta.tema(bar.close, 20))`. |
| `taKama.scenario.ts` | `plot(ta.kama(bar.close, { length: 10, fastLength: 2, slowLength: 30 }))`. |
| `taAlma.scenario.ts` | `plot(ta.alma(bar.close, 9, { offset: 0.85, sigma: 6 }))`. |

### 8. JSDoc

Per §17.2 — `@formula`, `@warmup`, `@since 0.2`, `@experimental`,
`@example`. ALMA also carries `@anchors offset, sigma` so the
generated doc page surfaces both.

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `packages/core/src/ta/ta.ts` | Modify | Extend TaNamespace + opts + throw stubs. |
| `packages/core/src/ta/ta.test.ts` | Modify | Stub coverage. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Four entries. |
| `packages/core/src/statefulPrimitives.test.ts` | Modify | Cardinality. |
| `packages/runtime/src/ta/{dema,tema,kama,alma}.ts` | Create | Impls. |
| `packages/runtime/src/ta/<id>.{test,property.test,golden.test,bench,bench.test}.ts` | Create (×4 prims × 5) | §22.10. |
| `packages/runtime/src/ta/registry.ts` | Modify | Cardinality 23. |
| `packages/runtime/src/ta/registry.test.ts` | Modify | Cardinality. |
| `packages/conformance/src/scenarios/<id>.scenario.ts` | Create (×4) | Scenarios. |
| `packages/conformance/src/scenarios/index.ts` | Modify | Re-export. |
| `packages/conformance/src/scenarios/scenarios.test.ts` | Modify | Add. |
| `docs/primitives/ta/<id>.md` | Generate (×4) | Pages. |

## Gates

`pnpm typecheck`, `pnpm lint`, `pnpm test` (100% coverage),
`pnpm bench:ci`, `pnpm docs:check`, `pnpm docs:gate`,
`pnpm readme:check`, `pnpm conformance`.

## Changeset

`.changeset/phase-2-ma-dema-tema-kama-alma.md` — `minor` for
`@invinite-org/chartlang-core`,
`@invinite-org/chartlang-runtime`,
`@invinite-org/chartlang-conformance`.

## Acceptance Criteria

- Four primitives exported + registered (cardinality 23).
- DEMA / TEMA compose EMA sub-slots through `TA_REGISTRY`.
- KAMA's adaptive α handles zero-volatility regime.
- ALMA's `offset` (Gaussian centre) is distinct from
  `opts.barShift` (universal shift); both documented.
- §22.10 set complete; 100% coverage.
- Changeset committed.
