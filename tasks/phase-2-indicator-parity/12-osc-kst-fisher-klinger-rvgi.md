# Task 12 — Oscillator ports: `ta.kst`, `ta.fisher`, `ta.klinger`, `ta.rvgi`

> **Status: TODO**

## Goal

Port the remaining four §9.2 oscillators: KST (Know Sure Thing),
Fisher Transform, Klinger Volume Oscillator, RVGI (Relative Vigor
Index).

## Prerequisites

- Task 7 (EMA chains for Klinger, multi-output backbone).

## Current Behavior

`ta.kst`, `ta.fisher`, `ta.klinger`, `ta.rvgi` absent.

## Desired Behavior

- `TaNamespace` extends with four new methods.
- `TA_REGISTRY` cardinality 35 → 39.

## Requirements

### 1. Provenance

Standard 4-line header (`078f41fe2569d659d5aba726da8bcb5d3e2ced02`).

### 2. Signatures

```ts
ta.kst(source: Series<number>, opts?: KstOpts): KstResult;        // { kst, signal }
ta.fisher(length: number, opts?: FisherOpts): FisherResult;       // { fisher, trigger }
ta.klinger(opts?: KlingerOpts): KlingerResult;                    // { klinger, signal }
ta.rvgi(opts?: RvgiOpts): RvgiResult;                             // { rvgi, signal }
```

Opts default the standard parameter sets per invinite source.
Results are typed records of two outputs each. Universal
`opts.offset` honoured.

### 3. Math + warmup

| Primitive | Source | Warmup |
|---|---|---|
| `ta.kst` | `indicators/kst.ts` | `max(rocLengths) + max(smaLengths) + signalLength - 2` |
| `ta.fisher` | `indicators/fisher.ts` | `length` |
| `ta.klinger` | `indicators/klinger.ts` | `slowLength + signalLength - 2` |
| `ta.rvgi` | `indicators/rvgi.ts` | `length + 4 + 4 - 1` |

- KST: weighted sum of 4 SMA-smoothed ROCs + an SMA signal.
- Fisher: bounded transform of normalised price `0.5 · ln((1 + x) / (1 − x))`.
- Klinger: VF-based volume force EMA cross.
- RVGI: 4-bar weighted-EMA close/open relative to range.

### 4. Slot value shapes

Each primitive composes sub-slots through the registry (no
private SMA / EMA / WMA math). Slot value carries the sub-slot
ids + output buffers.

### 5. Multi-output metadata

Each primitive declares `primarySeriesKey`, `getVisibleSeriesKeys`,
`yDomain` per §9.1 on its registry entry. Fisher's `yDomain` is
`{ kind: "auto" }` (Fisher transforms to roughly [-3, 3] but
isn't clipped).

### 6. NaN handling

Per-primitive:
- KST: NaN ROC → NaN output.
- Fisher: input outside ±1 (after normalisation) → NaN
  (matches invinite's clamp guard).
- Klinger: zero-volume bar → no VF update (NaN at output).
- RVGI: flat range → NaN at output.

### 7. §22.10 set + scenarios

| File | Script |
|---|---|
| `taKst.scenario.ts` | `const k = ta.kst(bar.close); plot(k.kst); plot(k.signal);`. |
| `taFisher.scenario.ts` | `const f = ta.fisher(10); plot(f.fisher); plot(f.trigger);`. |
| `taKlinger.scenario.ts` | `const k = ta.klinger(); plot(k.klinger); plot(k.signal);`. |
| `taRvgi.scenario.ts` | `const r = ta.rvgi(); plot(r.rvgi); plot(r.signal);`. |

### 8. JSDoc

`@formula`, `@warmup`, `@since 0.2`, `@experimental`, `@example`.
Each multi-output primitive carries `@anchors` for its tunable
params + `primarySeriesKey` doc note.

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `packages/core/src/ta/ta.ts` | Modify | TaNamespace + opts + result types. |
| `packages/core/src/ta/ta.test.ts` | Modify | Stub coverage. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Four entries. |
| `packages/core/src/statefulPrimitives.test.ts` | Modify | Cardinality. |
| `packages/runtime/src/ta/{kst,fisher,klinger,rvgi}.ts` | Create | Impls. |
| `packages/runtime/src/ta/<id>.{test,property.test,golden.test,bench,bench.test}.ts` | Create (×4 × 5) | §22.10. |
| `packages/runtime/src/ta/registry.ts` | Modify | Cardinality 39 + multi-output metadata. |
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

`.changeset/phase-2-osc-kst-fisher-klinger-rvgi.md` — `minor` for
core / runtime / conformance.

## Acceptance Criteria

- Four primitives exported + registered (cardinality 39).
- All multi-output metadata wired.
- All ports compose helpers / sub-slots through the registry; no
  private SMA / EMA / WMA / ROC math.
- §22.10 set complete; 100% coverage.
- Changeset committed.
