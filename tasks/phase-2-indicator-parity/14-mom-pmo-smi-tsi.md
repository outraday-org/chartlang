# Task 14 — Momentum ports: `ta.pmo`, `ta.smi`, `ta.tsi`

> **Status: TODO**

## Goal

Port three double-smoothed momentum primitives: PMO (Price
Momentum Oscillator), SMI (Stochastic Momentum Index), TSI (True
Strength Index).

## Prerequisites

- Tasks 7, 13 (EMA backbone + momentum infrastructure).

## Current Behavior

`ta.pmo`, `ta.smi`, `ta.tsi` absent.

## Desired Behavior

- `TaNamespace` extends with three new methods.
- `TA_REGISTRY` cardinality 43 → 46.

## Requirements

### 1. Provenance

Standard 4-line header (`078f41fe2569d659d5aba726da8bcb5d3e2ced02`).

### 2. Signatures

```ts
ta.pmo(source: Series<number>, opts?: PmoOpts): PmoResult;       // { pmo, signal }
ta.smi(opts?: SmiOpts): SmiResult;                                // { smi, signal }
ta.tsi(source: Series<number>, opts?: TsiOpts): TsiResult;        // { tsi, signal }
```

Defaults per invinite. Each result is a two-output record.

### 3. Math + warmup

| Primitive | Source | Warmup |
|---|---|---|
| `ta.pmo` | `indicators/pmo.ts` | `firstSmoothing + secondSmoothing + signalLength - 3` |
| `ta.smi` | `indicators/smi.ts` | `kLength + firstSmoothing + secondSmoothing + dLength - 4` |
| `ta.tsi` | `indicators/tsi.ts` | `firstSmoothing + secondSmoothing + signalLength - 3` |

- PMO: 10·ROC ratio double-EMA-smoothed.
- SMI: Double-EMA-smoothed `(C − ((H+L)/2)) / ((H−L)/2)`.
- TSI: Double-EMA-smoothed momentum / absolute momentum ratio.

### 4. Slot value shapes

Each primitive composes EMA sub-slots through the registry (PMO:
2 sub-slots + signal sub-slot; SMI: 4 sub-slots; TSI: 4
sub-slots).

### 5. Multi-output metadata

Each primitive declares `primarySeriesKey: <main output>`,
`getVisibleSeriesKeys`, `yDomain: { kind: "auto" }` for PMO /
TSI; SMI is `{ kind: "fixed", min: -100, max: 100 }`.

### 6. NaN handling

PMO: source NaN → NaN. SMI: flat range → NaN at `smi`. TSI:
zero-denominator (zero absolute momentum) → NaN.

### 7. §22.10 set + scenarios

| File | Script |
|---|---|
| `taPmo.scenario.ts` | `const p = ta.pmo(bar.close); plot(p.pmo); plot(p.signal);`. |
| `taSmi.scenario.ts` | `const s = ta.smi(); plot(s.smi); plot(s.signal);`. |
| `taTsi.scenario.ts` | `const t = ta.tsi(bar.close); plot(t.tsi); plot(t.signal);`. |

### 8. JSDoc

`@formula`, `@warmup`, `@since 0.2`, `@experimental`, `@example`.

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `packages/core/src/ta/ta.ts` | Modify | TaNamespace + opts + result types. |
| `packages/core/src/ta/ta.test.ts` | Modify | Stub coverage. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Three entries. |
| `packages/core/src/statefulPrimitives.test.ts` | Modify | Cardinality. |
| `packages/runtime/src/ta/{pmo,smi,tsi}.ts` | Create | Impls. |
| `packages/runtime/src/ta/<id>.{test,property.test,golden.test,bench,bench.test}.ts` | Create (×3 × 5) | §22.10. |
| `packages/runtime/src/ta/registry.ts` | Modify | Cardinality 46 + multi-output metadata. |
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

`.changeset/phase-2-mom-pmo-smi-tsi.md` — `minor` for
core / runtime / conformance.

## Acceptance Criteria

- Three primitives exported + registered (cardinality 46).
- All double-EMA sub-slots compose via `TA_REGISTRY`.
- SMI `yDomain` fixed to [-100, 100].
- §22.10 set complete; 100% coverage.
- Changeset committed.
