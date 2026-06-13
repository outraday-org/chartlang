# Task 25 — S/R ports: `ta.psar`, `ta.supertrend`

> **Status: TODO**

## Goal

Port Parabolic SAR and Supertrend — the two flagship trend-
following S/R primitives. Both ship as multi-output (level +
direction).

## Prerequisites

- Task 5 (cross-functional primitives).
- Phase 1 (`ta.atr` for Supertrend).

## Current Behavior

`ta.psar`, `ta.supertrend` absent.

## Desired Behavior

- `TaNamespace` extends with two new methods.
- `TA_REGISTRY` cardinality 78 → 80.

## Requirements

### 1. Provenance

Standard 4-line header (`078f41fe2569d659d5aba726da8bcb5d3e2ced02`).

### 2. Signatures

```ts
ta.psar(opts?: PsarOpts): PsarResult;             // { sar, direction }
ta.supertrend(opts?: SupertrendOpts): SupertrendResult; // { line, direction }
```

- `PsarOpts`: `{ accelerationStart?: number; accelerationStep?: number; accelerationMax?: number; offset?: number }` (defaults 0.02, 0.02, 0.2).
- `SupertrendOpts`: `{ length?: number; multiplier?: number; offset?: number }` (defaults 10, 3).

`PsarResult = Readonly<{ sar: Series<number>; direction: Series<number> }>` where `direction` is `+1` (uptrend) or `-1` (downtrend).

`SupertrendResult = Readonly<{ line: Series<number>; direction: Series<number> }>`.

### 3. Math + warmup

| Primitive | Source | Warmup |
|---|---|---|
| `ta.psar` | `indicators/psar.ts` | 1 (needs prev bar to seed) |
| `ta.supertrend` | `indicators/supertrend.ts` + Phase-1 `ta.atr` | `length` |

PSAR: classic acceleration-factor algorithm with extreme-point
tracking + trend flip semantics. Supertrend: ATR-based final
upper / lower bands with directional state machine.

### 4. Slot value shapes

- `ta.psar`: `{ outputs: { sar, direction }, state: { trend: 1 | -1; ep: number; af: number; sar: number; prevHigh: number; prevLow: number }, accStart, accStep, accMax }`.
- `ta.supertrend`: `{ outputs: { line, direction }, atrSub, prevUpper, prevLower, prevDirection, prevSt }`.

### 5. Multi-output metadata

- `ta.psar`: `primarySeriesKey: "sar"`, `yDomain: { kind: "auto" }`.
- `ta.supertrend`: `primarySeriesKey: "line"`, `yDomain: { kind: "auto" }`.

### 6. NaN handling

- PSAR: NaN at any input → NaN at outputs; trend state suspended (matches invinite).
- Supertrend: NaN ATR → NaN at outputs.

### 7. `replaceHead` correctness

Both primitives have non-trivial state machines. The `replaceHead`
implementation MUST snapshot the state at the start of the bar
(before the head append) so a final tick can recompute from the
seed. Property test asserts append-vs-replaceHead equivalence on
adversarial sequences (sharp reversals).

### 8. §22.10 set + scenarios

| File | Script |
|---|---|
| `taPsar.scenario.ts` | `const p = ta.psar(); plot(p.sar);`. |
| `taSupertrend.scenario.ts` | `const s = ta.supertrend({ length: 10, multiplier: 3 }); plot(s.line);`. |

Each scenario also pins the direction flip count over the
goldenBars fixture (additional snapshot value).

### 9. JSDoc

`@formula`, `@warmup`, `@since 0.2`, `@experimental`, `@example`,
`@anchors accelerationStart/step/max` for PSAR.

### 10. Bench note

PSAR and Supertrend are stateful + branchy — bench is mandatory
(§16.2). Threshold pinned post-port.

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `packages/core/src/ta/ta.ts` | Modify | TaNamespace + opts + result types. |
| `packages/core/src/ta/ta.test.ts` | Modify | Stub coverage. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Two entries. |
| `packages/core/src/statefulPrimitives.test.ts` | Modify | Cardinality. |
| `packages/runtime/src/ta/{psar,supertrend}.ts` | Create | Impls. |
| `packages/runtime/src/ta/<id>.{test,property.test,golden.test,bench,bench.test}.ts` | Create (×2 × 5) | §22.10. |
| `packages/runtime/src/ta/registry.ts` | Modify | Cardinality 80 + multi-output metadata. |
| `packages/runtime/src/ta/registry.test.ts` | Modify | Cardinality. |
| `packages/conformance/src/scenarios/<id>.scenario.ts` | Create (×2) | Scenarios. |
| `packages/conformance/src/scenarios/index.ts` | Modify | Re-export. |
| `packages/conformance/src/scenarios/scenarios.test.ts` | Modify | Add. |
| `docs/primitives/ta/<id>.md` | Generate (×2) | Pages. |

## Gates

`pnpm typecheck`, `pnpm lint`, `pnpm test` (100% coverage),
`pnpm bench:ci`, `pnpm docs:check`, `pnpm docs:gate`,
`pnpm readme:check`, `pnpm conformance`.

## Changeset

`.changeset/phase-2-sr-psar-supertrend.md` — `minor` for
core / runtime / conformance.

## Acceptance Criteria

- Two primitives exported + registered (cardinality 80).
- `replaceHead` correctness asserted via append-vs-replaceHead
  property test on adversarial fixtures.
- Direction outputs are `+1` / `-1` (or NaN during warmup).
- §22.10 set complete; 100% coverage.
- Changeset committed.
