# Task 13 — Momentum ports: `ta.ao`, `ta.cmo`, `ta.momentum`, `ta.roc`

> **Status: TODO**

## Goal

Port four momentum primitives: Awesome Oscillator, Chande Momentum
Oscillator, Momentum (Pine `mom`), Rate of Change (ROC).

## Prerequisites

- Task 5 (`ta.change` is the math kernel for `momentum` / `roc`).

## Current Behavior

`ta.ao`, `ta.cmo`, `ta.momentum`, `ta.roc` absent.

## Desired Behavior

- `TaNamespace` extends with four new methods.
- `TA_REGISTRY` cardinality 39 → 43.

## Requirements

### 1. Provenance

Standard 4-line header (`078f41fe2569d659d5aba726da8bcb5d3e2ced02`).

### 2. Signatures

```ts
ta.ao(opts?: AoOpts): Series<number>;
ta.cmo(source: Series<number>, length: number, opts?: CmoOpts): Series<number>;
ta.momentum(source: Series<number>, length: number, opts?: MomentumOpts): Series<number>;
ta.roc(source: Series<number>, length: number, opts?: RocOpts): Series<number>;
```

Opts:
- `AoOpts`: `{ fastLength?: number; slowLength?: number; offset?: number }` (defaults 5, 34).
- `CmoOpts`, `MomentumOpts`, `RocOpts`: `{ offset?: number; lineStyle?: PlotLineStyle }`.

### 3. Math + warmup

| Primitive | Source | Warmup |
|---|---|---|
| `ta.ao` | `indicators/ao.ts` | `slowLength - 1` |
| `ta.cmo` | `indicators/cmo.ts` | `length` |
| `ta.momentum` | `indicators/momentum.ts` | `length` |
| `ta.roc` | `indicators/roc.ts` | `length` |

- AO: `SMA(hl2, fast) − SMA(hl2, slow)`. Derives `hl2` via
  `lib/pickCandleSource`.
- CMO: `100 · (sumGain − sumLoss) / (sumGain + sumLoss)` over the
  trailing `length` window. Range [-100, 100].
- Momentum: `src[0] − src[length]` — exact `ta.change` semantics
  with required `length`. Reuses `ta.change` sub-slot.
- ROC: `100 · (src[0] − src[length]) / src[length]`.

### 4. Slot value shapes

- `ta.ao`: `{ outBuffer, series, fastSmaSub, slowSmaSub }`.
- `ta.cmo`: `{ outBuffer, series, gainWindow: Float64RingBuffer of size length, lossWindow, sumGain, sumLoss, prevSrc }`.
- `ta.momentum`: `{ outBuffer, series, changeSub }` — composes `ta.change`.
- `ta.roc`: `{ outBuffer, series, sourceWindow: Float64RingBuffer of size length+1 }`.

### 5. NaN handling

- AO: NaN slot in either SMA → NaN output.
- CMO: zero-denominator (flat-line input) → NaN.
- Momentum / ROC: NaN in current or lagged source → NaN.

### 6. Range invariants (property tests)

- CMO ∈ [-100, 100].
- ROC unbounded.
- AO / Momentum unbounded.

### 7. §22.10 set + scenarios

| File | Script |
|---|---|
| `taAo.scenario.ts` | `plot(ta.ao())`. |
| `taCmo.scenario.ts` | `plot(ta.cmo(bar.close, 9))`. |
| `taMomentum.scenario.ts` | `plot(ta.momentum(bar.close, 10))`. |
| `taRoc.scenario.ts` | `plot(ta.roc(bar.close, 12))`. |

### 8. JSDoc

`@formula`, `@warmup`, `@since 0.2`, `@experimental`, `@example`.

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `packages/core/src/ta/ta.ts` | Modify | TaNamespace + opts. |
| `packages/core/src/ta/ta.test.ts` | Modify | Stub coverage. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Four entries. |
| `packages/core/src/statefulPrimitives.test.ts` | Modify | Cardinality. |
| `packages/runtime/src/ta/{ao,cmo,momentum,roc}.ts` | Create | Impls. |
| `packages/runtime/src/ta/<id>.{test,property.test,golden.test,bench,bench.test}.ts` | Create (×4 × 5) | §22.10. |
| `packages/runtime/src/ta/registry.ts` | Modify | Cardinality 43. |
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

`.changeset/phase-2-mom-ao-cmo-momentum-roc.md` — `minor` for
core / runtime / conformance.

## Acceptance Criteria

- Four primitives exported + registered (cardinality 43).
- `ta.momentum` composes `ta.change` (no private subtraction
  loop).
- CMO range invariant pinned by property test.
- §22.10 set complete; 100% coverage.
- Changeset committed.
