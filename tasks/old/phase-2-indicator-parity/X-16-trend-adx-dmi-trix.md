# Task 16 — Trend ports: `ta.adx`, `ta.dmi`, `ta.trix`

> **Status: TODO**

## Goal

Port ADX (Average Directional Index), DMI (Directional Movement
Index), TRIX (triple-EMA momentum).

## Prerequisites

- Task 4 (`wilderDirectional`, `adxFromDi`).
- Task 7 (EMA backbone for TRIX's triple-EMA chain).

## Current Behavior

`ta.adx`, `ta.dmi`, `ta.trix` absent.

## Desired Behavior

- `TaNamespace` extends with three new methods.
- `TA_REGISTRY` cardinality 48 → 51.

## Requirements

### 1. Provenance

Standard 4-line header (`078f41fe2569d659d5aba726da8bcb5d3e2ced02`).

### 2. Signatures

```ts
ta.adx(length: number, opts?: AdxOpts): Series<number>;
ta.dmi(length: number, opts?: DmiOpts): DmiResult;             // { plusDi, minusDi }
ta.trix(source: Series<number>, length: number, opts?: TrixOpts): TrixResult; // { trix, signal }
```

Opts:
- `AdxOpts`: `{ smoothing?: number; offset?: number; lineStyle?: PlotLineStyle }` (defaults `smoothing = 14`).
- `DmiOpts`: `{ offset?: number; outputs?: ... }`.
- `TrixOpts`: `{ signalLength?: number; offset?: number }` (default `signalLength = 9`).

### 3. Math + warmup

| Primitive | Source | Warmup |
|---|---|---|
| `ta.adx` | `indicators/adx.ts` + `lib/wilderDirectional` + `lib/adxFromDi` | `2 * length + smoothing - 2` |
| `ta.dmi` | `indicators/dmi.ts` + `lib/wilderDirectional` | `length` |
| `ta.trix` | `indicators/trix.ts` | `3 * length + signalLength - 4` |

### 4. Slot value shapes

- `ta.adx`: `{ outBuffer, series, dirState: DirectionalMovementSlot, dxSmoothing: Float64 (running), prevAdx }`. Reuses the
  helper's `+DI` / `−DI` outputs.
- `ta.dmi`: `{ outputs: { plusDi, minusDi }, dirState }`.
- `ta.trix`: `{ outputs: { trix, signal }, ema1Sub, ema2Sub, ema3Sub, signalSub }`.

### 5. Multi-output for `ta.dmi` + `ta.trix`

- `ta.dmi`: `primarySeriesKey: "plusDi"`, `yDomain: { kind: "auto" }`.
- `ta.trix`: `primarySeriesKey: "trix"`, `yDomain: { kind: "auto" }`.

### 6. Range invariants

- ADX, +DI, −DI ∈ [0, 100] (property tests).
- TRIX unbounded.

### 7. NaN handling

Zero-TR window → NaN (matches invinite). Property test.

### 8. §22.10 set + scenarios

| File | Script |
|---|---|
| `taAdx.scenario.ts` | `plot(ta.adx(14))`. |
| `taDmi.scenario.ts` | `const d = ta.dmi(14); plot(d.plusDi); plot(d.minusDi);`. |
| `taTrix.scenario.ts` | `const t = ta.trix(bar.close, 18); plot(t.trix); plot(t.signal);`. |

### 9. JSDoc

`@formula`, `@warmup`, `@since 0.2`, `@experimental`, `@example`.

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `packages/core/src/ta/ta.ts` | Modify | TaNamespace + opts + DmiResult / TrixResult. |
| `packages/core/src/ta/ta.test.ts` | Modify | Stub coverage. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Three entries. |
| `packages/core/src/statefulPrimitives.test.ts` | Modify | Cardinality. |
| `packages/runtime/src/ta/{adx,dmi,trix}.ts` | Create | Impls. |
| `packages/runtime/src/ta/<id>.{test,property.test,golden.test,bench,bench.test}.ts` | Create (×3 × 5) | §22.10. |
| `packages/runtime/src/ta/registry.ts` | Modify | Cardinality 51 + multi-output metadata. |
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

`.changeset/phase-2-trend-adx-dmi-trix.md` — `minor` for
core / runtime / conformance.

## Acceptance Criteria

- Three primitives exported + registered (cardinality 51).
- ADX / DMI reuse `lib/wilderDirectional` + `lib/adxFromDi` (no
  re-implemented Wilder smoothing).
- TRIX composes three EMA sub-slots + signal sub-slot via the
  registry.
- Range invariants pinned.
- §22.10 set complete; 100% coverage.
- Changeset committed.
