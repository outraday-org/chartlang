# Task 26 — S/R ports: `ta.chandelier`, `ta.chandeKrollStop`, `ta.williamsFractal`

> **Status: TODO**

## Goal

Port Chandelier Exit (ATR-trailing stops), Chande Kroll Stop
(double-ATR stop), Williams Fractal (5-bar fractal markers).

## Prerequisites

- Task 25 (S/R backbone, ATR composition pattern).

## Current Behavior

These three primitives absent.

## Desired Behavior

- `TaNamespace` extends with three new methods.
- `TA_REGISTRY` cardinality 80 → 83.
- Williams Fractal uses Task-1's `marker` PlotKind for the
  default plot style.

## Requirements

### 1. Provenance

Standard 4-line header (`078f41fe2569d659d5aba726da8bcb5d3e2ced02`).

### 2. Signatures

```ts
ta.chandelier(opts?: ChandelierOpts): ChandelierResult;          // { long, short }
ta.chandeKrollStop(opts?: ChandeKrollStopOpts): ChandeKrollStopResult; // { long, short }
ta.williamsFractal(opts?: WilliamsFractalOpts): WilliamsFractalResult; // { up, down }
```

- `ChandelierOpts`: `{ length?: number; multiplier?: number; offset?: number }` (defaults 22, 3).
- `ChandeKrollStopOpts`: `{ length?: number; multiplier?: number; smoothingLength?: number; offset?: number }` (defaults 10, 1, 9).
- `WilliamsFractalOpts`: `{ length?: number; offset?: number }` (default length=2 → 5-bar window).

`WilliamsFractalResult`: `{ up: Series<boolean>; down: Series<boolean> }` — boolean series for fractal detection, NOT level series.

### 3. Math + warmup

| Primitive | Source | Warmup |
|---|---|---|
| `ta.chandelier` | `indicators/chandelier.ts` | `length` |
| `ta.chandeKrollStop` | `indicators/chande-kroll-stop.ts` | `length + smoothingLength` |
| `ta.williamsFractal` | `indicators/williams-fractal.ts` | `2 * length` (centred window) |

### 4. Slot value shapes

- `ta.chandelier`: `{ outputs: { long, short }, atrSub, highestSub, lowestSub }`.
- `ta.chandeKrollStop`: `{ outputs: { long, short }, atrSub, firstHighStopSub, firstLowStopSub, smoothHighSub, smoothLowSub }`.
- `ta.williamsFractal`: `{ outputs: { up, down }, highWindow: Float64RingBuffer of size 2*length+1, lowWindow: same, pendingMarkers: ReadonlyArray<number> }`. The fractal centres on bar `t - length` so the output at any bar `t` is the boolean for bar `t - length`. Implementation produces NaN-equivalent (false) until the centred bar's window is full.

### 5. Multi-output metadata

- Chandelier / Chande Kroll: `primarySeriesKey: "long"`,
  `yDomain: { kind: "auto" }`.
- Williams Fractal: `primarySeriesKey: "up"`, `yDomain: { kind: "auto" }`. Plot style: `marker`.

### 6. NaN handling

Chandelier / Chande Kroll: NaN ATR → NaN at both outputs.
Williams Fractal: NaN in any of the 5 bars → no fractal at that
centre bar.

### 7. §22.10 set + scenarios

| File | Script |
|---|---|
| `taChandelier.scenario.ts` | `const c = ta.chandelier({ length: 22, multiplier: 3 }); plot(c.long); plot(c.short);`. |
| `taChandeKrollStop.scenario.ts` | `const c = ta.chandeKrollStop(); plot(c.long); plot(c.short);`. |
| `taWilliamsFractal.scenario.ts` | `const f = ta.williamsFractal(); plot(f.up, { style: { kind: "marker", shape: "triangle-up", size: 6 } }); plot(f.down, { style: { kind: "marker", shape: "triangle-down", size: 6 } });`. |

### 8. JSDoc

`@formula`, `@warmup`, `@since 0.2`, `@experimental`, `@example`,
`@anchors length, multiplier`.

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `packages/core/src/ta/ta.ts` | Modify | TaNamespace + opts + result types. |
| `packages/core/src/ta/ta.test.ts` | Modify | Stub coverage. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Three entries. |
| `packages/core/src/statefulPrimitives.test.ts` | Modify | Cardinality. |
| `packages/runtime/src/ta/{chandelier,chandeKrollStop,williamsFractal}.ts` | Create | Impls. |
| `packages/runtime/src/ta/<id>.{test,property.test,golden.test,bench,bench.test}.ts` | Create (×3 × 5) | §22.10. |
| `packages/runtime/src/ta/registry.ts` | Modify | Cardinality 83 + metadata. |
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

`.changeset/phase-2-sr-chandelier-chandekrollstop-fractal.md` —
`minor` for core / runtime / conformance.

## Acceptance Criteria

- Three primitives exported + registered (cardinality 83).
- Williams Fractal scenario exercises Task-1's `marker` PlotKind
  end-to-end.
- Centred-window semantics documented in JSDoc + asserted in
  property test.
- §22.10 set complete; 100% coverage.
- Changeset committed.
