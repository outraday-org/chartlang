# Task 22 — Volume ports: `ta.obv`, `ta.adl`, `ta.bop`, `ta.cmf`

> **Status: TODO**

## Goal

Port four cumulative / range-relative volume primitives: OBV
(On-Balance Volume), ADL (Accumulation / Distribution Line), BOP
(Balance of Power), CMF (Chaikin Money Flow).

## Prerequisites

- Task 21 (volume backbone in place).

## Current Behavior

These four primitives absent.

## Desired Behavior

- `TaNamespace` extends with four new methods.
- `TA_REGISTRY` cardinality 66 → 70.

## Requirements

### 1. Provenance

Standard 4-line header (`078f41fe2569d659d5aba726da8bcb5d3e2ced02`).

### 2. Signatures

```ts
ta.obv(opts?: ObvOpts): Series<number>;
ta.adl(opts?: AdlOpts): Series<number>;
ta.bop(opts?: BopOpts): Series<number>;
ta.cmf(length: number, opts?: CmfOpts): Series<number>;
```

All opts: `Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>`.

### 3. Math + warmup

| Primitive | Source | Warmup |
|---|---|---|
| `ta.obv` | `indicators/obv.ts` | 1 (needs prevClose) |
| `ta.adl` | `indicators/adl.ts` | 0 |
| `ta.bop` | `indicators/bop.ts` | 0 |
| `ta.cmf` | `indicators/cmf.ts` | `length - 1` |

- OBV: cumulative `sign(close − prevClose) · volume`.
- ADL: cumulative `((C − L) − (H − C)) / (H − L) · volume`.
- BOP: `(C − O) / (H − L)`.
- CMF: `sum(((C − L) − (H − C)) / (H − L) · volume, N) / sum(volume, N)`.

### 4. Slot value shapes

- `ta.obv`: `{ outBuffer, series, cumObv, prevClose }`.
- `ta.adl`: `{ outBuffer, series, cumAdl }`.
- `ta.bop`: `{ outBuffer, series }`.
- `ta.cmf`: `{ outBuffer, series, mfvWindow: Float64RingBuffer, volWindow, sumMfv, sumVol }`.

### 5. NaN / edge handling

- OBV / ADL / BOP / CMF with `high === low` (flat bar) → contribute 0 to numerator (matches invinite's zero-range guard).
- NaN volume → carry forward (no accumulator update).

### 6. §22.10 set + scenarios

| File | Script |
|---|---|
| `taObv.scenario.ts` | `plot(ta.obv())`. |
| `taAdl.scenario.ts` | `plot(ta.adl())`. |
| `taBop.scenario.ts` | `plot(ta.bop())`. |
| `taCmf.scenario.ts` | `plot(ta.cmf(20))`. |

### 7. JSDoc

`@formula`, `@warmup`, `@since 0.2`, `@experimental`, `@example`.

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `packages/core/src/ta/ta.ts` | Modify | TaNamespace + opts. |
| `packages/core/src/ta/ta.test.ts` | Modify | Stub coverage. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Four entries. |
| `packages/core/src/statefulPrimitives.test.ts` | Modify | Cardinality. |
| `packages/runtime/src/ta/{obv,adl,bop,cmf}.ts` | Create | Impls. |
| `packages/runtime/src/ta/<id>.{test,property.test,golden.test,bench,bench.test}.ts` | Create (×4 × 5) | §22.10. |
| `packages/runtime/src/ta/registry.ts` | Modify | Cardinality 70. |
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

`.changeset/phase-2-volume-obv-adl-bop-cmf.md` — `minor` for
core / runtime / conformance.

## Acceptance Criteria

- Four primitives exported + registered (cardinality 70).
- Zero-range guards aligned with invinite.
- §22.10 set complete; 100% coverage.
- Changeset committed.
