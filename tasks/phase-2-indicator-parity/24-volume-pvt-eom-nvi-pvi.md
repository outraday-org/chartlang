# Task 24 — Volume ports: `ta.pvt`, `ta.eom`, `ta.nvi`, `ta.pvi`

> **Status: TODO**

## Goal

Port Price Volume Trend, Ease of Movement, Negative Volume Index,
Positive Volume Index. Closes the §9.2 volume list (excluding the
4 volume-profile primitives — deferred to Phase 5).

## Prerequisites

- Task 22 (volume backbone).

## Current Behavior

These four primitives absent.

## Desired Behavior

- `TaNamespace` extends with four new methods.
- `TA_REGISTRY` cardinality 74 → 78.

## Requirements

### 1. Provenance

Standard 4-line header (`078f41fe2569d659d5aba726da8bcb5d3e2ced02`).

### 2. Signatures

```ts
ta.pvt(opts?: PvtOpts): Series<number>;
ta.eom(length: number, opts?: EomOpts): Series<number>;
ta.nvi(opts?: NviOpts): Series<number>;
ta.pvi(opts?: PviOpts): Series<number>;
```

Each opts: `Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>`.

### 3. Math + warmup

| Primitive | Source | Warmup |
|---|---|---|
| `ta.pvt` | `indicators/pvt.ts` | 1 (needs prevClose) |
| `ta.eom` | `indicators/eom.ts` | `length` |
| `ta.nvi` | `indicators/nvi.ts` | 1 |
| `ta.pvi` | `indicators/pvi.ts` | 1 |

- PVT: cumulative `((C − prevC) / prevC) · volume`.
- EOM: `SMA((midpoint move / box ratio), length)` where
  midpoint move = `((H + L) / 2 − prevMidpoint)` and box ratio =
  `(volume / scale) / (H − L)`. Invinite scales by 1.0; the port
  follows.
- NVI: cumulative `prev + (C − prevC) / prevC · prev` only on
  bars where `volume < prevVolume`; otherwise unchanged. Seed at
  1000.
- PVI: mirror of NVI on bars where `volume > prevVolume`.

### 4. Slot value shapes

- `ta.pvt`: `{ outBuffer, series, cumPvt, prevClose }`.
- `ta.eom`: `{ outBuffer, series, rawEomWindow, sumRawEom, prevMid }`.
- `ta.nvi`: `{ outBuffer, series, value, prevClose, prevVolume }`.
- `ta.pvi`: same shape as NVI.

### 5. NaN handling

- PVT: `prevC === 0` → NaN.
- EOM: zero box ratio → NaN; flat-line bar → 0 contribution.
- NVI / PVI: NaN volume → carry forward without updating.

### 6. Seed values

NVI / PVI seed at 1000. Property tests assert the first
finite-volume slot equals the seed.

### 7. §22.10 set + scenarios

| File | Script |
|---|---|
| `taPvt.scenario.ts` | `plot(ta.pvt())`. |
| `taEom.scenario.ts` | `plot(ta.eom(14))`. |
| `taNvi.scenario.ts` | `plot(ta.nvi())`. |
| `taPvi.scenario.ts` | `plot(ta.pvi())`. |

### 8. JSDoc

`@formula`, `@warmup`, `@since 0.2`, `@experimental`, `@example`,
`@anchors seedValue` for NVI / PVI.

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `packages/core/src/ta/ta.ts` | Modify | TaNamespace + opts. |
| `packages/core/src/ta/ta.test.ts` | Modify | Stub coverage. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Four entries. |
| `packages/core/src/statefulPrimitives.test.ts` | Modify | Cardinality. |
| `packages/runtime/src/ta/{pvt,eom,nvi,pvi}.ts` | Create | Impls. |
| `packages/runtime/src/ta/<id>.{test,property.test,golden.test,bench,bench.test}.ts` | Create (×4 × 5) | §22.10. |
| `packages/runtime/src/ta/registry.ts` | Modify | Cardinality 78. |
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

`.changeset/phase-2-volume-pvt-eom-nvi-pvi.md` — `minor` for
core / runtime / conformance.

## Acceptance Criteria

- Four primitives exported + registered (cardinality 78).
- NVI / PVI seed at 1000 (pinned by property test).
- §22.10 set complete; 100% coverage.
- Changeset committed.
