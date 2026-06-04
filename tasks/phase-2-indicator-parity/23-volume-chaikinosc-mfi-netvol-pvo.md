# Task 23 — Volume ports: `ta.chaikinOsc`, `ta.mfi`, `ta.netVolume`, `ta.pvo`

> **Status: TODO**

## Goal

Port Chaikin Oscillator (ADL EMA diff), Money Flow Index (volume-
weighted RSI), Net Volume (signed running sum), PVO (Percentage
Volume Oscillator).

## Prerequisites

- Task 7 (EMA backbone).
- Task 22 (`ta.adl` for Chaikin Oscillator composition).

## Current Behavior

These four primitives absent.

## Desired Behavior

- `TaNamespace` extends with four new methods.
- `TA_REGISTRY` cardinality 70 → 74.

## Requirements

### 1. Provenance

Standard 4-line header (`078f41fe2569d659d5aba726da8bcb5d3e2ced02`).

### 2. Signatures

```ts
ta.chaikinOsc(opts?: ChaikinOscOpts): Series<number>;
ta.mfi(length: number, opts?: MfiOpts): Series<number>;
ta.netVolume(opts?: NetVolumeOpts): Series<number>;
ta.pvo(opts?: PvoOpts): PvoResult;   // { pvo, signal, hist }
```

- `ChaikinOscOpts`: `{ fastLength?: number; slowLength?: number; offset?: number }` (defaults 3, 10).
- `MfiOpts`: `{ offset?: number; lineStyle?: PlotLineStyle }`.
- `NetVolumeOpts`: `{ offset?: number }`.
- `PvoOpts`: `{ fastLength?: number; slowLength?: number; signalLength?: number; offset?: number }` (defaults 12, 26, 9).

### 3. Math + warmup

| Primitive | Source | Warmup |
|---|---|---|
| `ta.chaikinOsc` | `indicators/chaikin-osc.ts` | `slowLength - 1` |
| `ta.mfi` | `indicators/mfi.ts` | `length + 1` |
| `ta.netVolume` | `indicators/net-volume.ts` | 1 (needs prevClose for sign) |
| `ta.pvo` | `indicators/pvo.ts` | `slowLength + signalLength - 2` |

- Chaikin Osc: `EMA(ADL, fast) − EMA(ADL, slow)`. Composes
  `ta.adl` + two EMA sub-slots.
- MFI: 100·posMF / (posMF + negMF) where posMF / negMF are
  volume-weighted typical-price up/down sums. Range [0, 100].
- Net Volume: cumulative `sign(close − prevClose) · volume` (same
  rule as OBV, but exposed separately per invinite — assert in
  task spec that the math equals OBV; document the dup).
- PVO: `100 · (EMA(volume, fast) − EMA(volume, slow)) / EMA(volume, slow)`, signal = EMA(PVO, signalLength), hist = PVO − signal.

### 4. Slot value shapes

- `ta.chaikinOsc`: `{ outBuffer, series, adlSub, fastEmaSub, slowEmaSub }`.
- `ta.mfi`: `{ outBuffer, series, posMfWindow, negMfWindow, sumPosMf, sumNegMf, prevTp }`.
- `ta.netVolume`: `{ outBuffer, series, cum, prevClose }`.
- `ta.pvo`: `{ outputs: { pvo, signal, hist }, fastEmaSub, slowEmaSub, signalEmaSub }`.

### 5. Multi-output for `ta.pvo`

- `primarySeriesKey: "pvo"`.
- `getVisibleSeriesKeys`: `["pvo", "signal", "hist"]`.
- `yDomain: { kind: "auto" }`.

### 6. Range invariant

MFI ∈ [0, 100] — property test.

### 7. NaN handling

- MFI: zero negMF → carries forward (matches invinite's
  zero-denominator guard).
- PVO: zero slow-EMA → NaN.

### 8. §22.10 set + scenarios

| File | Script |
|---|---|
| `taChaikinOsc.scenario.ts` | `plot(ta.chaikinOsc())`. |
| `taMfi.scenario.ts` | `plot(ta.mfi(14))`. |
| `taNetVolume.scenario.ts` | `plot(ta.netVolume())`. |
| `taPvo.scenario.ts` | `const p = ta.pvo(); plot(p.pvo); plot(p.signal); plot(p.hist);`. |

### 9. JSDoc

`@formula`, `@warmup`, `@since 0.2`, `@experimental`, `@example`.
`ta.netVolume` JSDoc explicitly notes equivalence to `ta.obv`
(both exist in invinite; this is a deliberate dup for naming
parity).

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `packages/core/src/ta/ta.ts` | Modify | TaNamespace + opts + PvoResult. |
| `packages/core/src/ta/ta.test.ts` | Modify | Stub coverage. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Four entries. |
| `packages/core/src/statefulPrimitives.test.ts` | Modify | Cardinality. |
| `packages/runtime/src/ta/{chaikinOsc,mfi,netVolume,pvo}.ts` | Create | Impls. |
| `packages/runtime/src/ta/<id>.{test,property.test,golden.test,bench,bench.test}.ts` | Create (×4 × 5) | §22.10. |
| `packages/runtime/src/ta/registry.ts` | Modify | Cardinality 74 + metadata for `pvo`. |
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

`.changeset/phase-2-volume-chaikinosc-mfi-netvol-pvo.md` —
`minor` for core / runtime / conformance.

## Acceptance Criteria

- Four primitives exported + registered (cardinality 74).
- Chaikin Osc composes `ta.adl` + two EMAs.
- `ta.netVolume` ≡ `ta.obv` (asserted by a property test that
  hashes their outputs and compares).
- MFI range [0, 100] pinned.
- §22.10 set complete; 100% coverage.
- Changeset committed.
