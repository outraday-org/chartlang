# Task 15 — Trend ports: `ta.aroon`, `ta.aroonOsc`

> **Status: TODO**

## Goal

Port Aroon Up/Down and Aroon Oscillator. The simplest trend pair
— both consume `ta.highest` / `ta.lowest` from Task 5.

## Prerequisites

- Task 5 (`ta.highest` / `ta.lowest`).

## Current Behavior

`ta.aroon`, `ta.aroonOsc` absent.

## Desired Behavior

- `TaNamespace` extends with two new methods.
- `TA_REGISTRY` cardinality 46 → 48.

## Requirements

### 1. Provenance

Standard 4-line header (`078f41fe2569d659d5aba726da8bcb5d3e2ced02`).

### 2. Signatures

```ts
ta.aroon(length: number, opts?: AroonOpts): AroonResult;       // { up, down }
ta.aroonOsc(length: number, opts?: AroonOscOpts): Series<number>;
```

- `AroonOpts`: `{ offset?: number; outputs?: Readonly<Record<"up" | "down", { lineStyle?: PlotLineStyle }>> }`.
- `AroonOscOpts`: `{ offset?: number; lineStyle?: PlotLineStyle }`.

`AroonResult = Readonly<{ up: Series<number>; down: Series<number> }>`.

### 3. Math + warmup

| Primitive | Source | Warmup |
|---|---|---|
| `ta.aroon` | `indicators/aroon.ts` | `length` |
| `ta.aroonOsc` | `indicators/aroon-osc.ts` | `length` |

- Aroon Up: `100 · (length − barsSince(highest(high, length))) / length`.
- Aroon Down: `100 · (length − barsSince(lowest(low, length))) / length`.
- Aroon Osc: `aroonUp − aroonDown`. Composes `ta.aroon` via a
  sub-slot.

### 4. Slot value shapes

- `ta.aroon`: `{ outputs: { up, down }, highestSub, lowestSub, lastHighIndex: number, lastLowIndex: number, count: number }`. The "bars since highest" tracker uses a stable counter — invinite uses an `indexOfMaximum` scan; the port keeps it for simplicity (Task 13's bench is the perf reference).
- `ta.aroonOsc`: `{ outBuffer, series, aroonSub }`.

### 5. Multi-output for `ta.aroon`

- `primarySeriesKey: "up"`.
- `getVisibleSeriesKeys`: `["up", "down"]`.
- `yDomain: { kind: "fixed", min: 0, max: 100 }`.

### 6. Range invariants

- Aroon Up / Down ∈ [0, 100].
- Aroon Osc ∈ [-100, 100].

Pinned via property test.

### 7. NaN handling

NaN high / low → NaN output. Property test asserts.

### 8. §22.10 set + scenarios

| File | Script |
|---|---|
| `taAroon.scenario.ts` | `const a = ta.aroon(14); plot(a.up); plot(a.down);`. |
| `taAroonOsc.scenario.ts` | `plot(ta.aroonOsc(14))`. |

### 9. JSDoc

`@formula`, `@warmup`, `@since 0.2`, `@experimental`, `@example`.

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `packages/core/src/ta/ta.ts` | Modify | TaNamespace + opts + AroonResult. |
| `packages/core/src/ta/ta.test.ts` | Modify | Stub coverage. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Two entries. |
| `packages/core/src/statefulPrimitives.test.ts` | Modify | Cardinality. |
| `packages/runtime/src/ta/{aroon,aroonOsc}.ts` | Create | Impls. |
| `packages/runtime/src/ta/<id>.{test,property.test,golden.test,bench,bench.test}.ts` | Create (×2 × 5) | §22.10. |
| `packages/runtime/src/ta/registry.ts` | Modify | Cardinality 48 + metadata for `aroon`. |
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

`.changeset/phase-2-trend-aroon-aroonosc.md` — `minor` for
core / runtime / conformance.

## Acceptance Criteria

- Two primitives exported + registered (cardinality 48).
- `ta.aroonOsc` composes `ta.aroon`.
- Range invariants pinned.
- §22.10 set complete; 100% coverage.
- Changeset committed.
