# Task 27 — S/R ports: `ta.zigZag`, `ta.pivotsHighLow`, `ta.pivotsStandard`, `ta.volatilityStop`

> **Status: TODO**

## Goal

Port ZigZag (significant-move filter), Pivots High/Low (recent
swing detection), Pivots Standard (classical R/S levels),
Volatility Stop (ATR-based stop level). Closes the §9.2 S/R list.

## Prerequisites

- Phase 1 (`ta.atr`).
- Task 5 (`ta.highest` / `ta.lowest`).
- Task 25 (S/R backbone + multi-output state-machine pattern).

## Current Behavior

These four primitives absent.

## Desired Behavior

- `TaNamespace` extends with four new methods.
- `TA_REGISTRY` cardinality 83 → 87.
- `pivotsStandard` ships R1–R3 / S1–S3; R4/S4/R5/S5 deferred per
  §19 / Phase-2 README footnote.

## Requirements

### 1. Provenance

Standard 4-line header (`078f41fe2569d659d5aba726da8bcb5d3e2ced02`).

### 2. Signatures

```ts
ta.zigZag(opts?: ZigZagOpts): ZigZagResult;                       // { value, direction }
ta.pivotsHighLow(opts?: PivotsHighLowOpts): PivotsHighLowResult;  // { high, low }
ta.pivotsStandard(opts?: PivotsStandardOpts): PivotsStandardResult;
ta.volatilityStop(opts?: VolatilityStopOpts): VolatilityStopResult; // { value, direction }
```

- `ZigZagOpts`: `{ deviation?: number; depth?: number; offset?: number }` (defaults 5%, 10).
- `PivotsHighLowOpts`: `{ leftLength?: number; rightLength?: number; offset?: number }` (defaults 4, 4).
- `PivotsStandardOpts`: `{ system?: "classic" | "fibonacci" | "camarilla" | "woodie"; offset?: number }` (default "classic").
- `VolatilityStopOpts`: `{ length?: number; multiplier?: number; offset?: number }` (defaults 20, 2).

Result shapes:
- `PivotsStandardResult = Readonly<{ pp; r1; s1; r2; s2; r3; s3 }>` — seven `Series<number>`.

### 3. Math + warmup

| Primitive | Source | Warmup |
|---|---|---|
| `ta.zigZag` | `indicators/zig-zag.ts` | input-dependent (NaN until first confirmed pivot) |
| `ta.pivotsHighLow` | `indicators/pivots-high-low.ts` | `leftLength + rightLength` |
| `ta.pivotsStandard` | `indicators/pivots-standard.ts` | 1 daily-bar (resets at session boundary) |
| `ta.volatilityStop` | `indicators/volatility-stop.ts` + `ta.atr` | `length` |

ZigZag: confirms a pivot when price reverses by `deviation%`
from a swing. Pivots H/L: a high/low confirmed by `leftLength`
bars rising into it and `rightLength` bars falling from it
(matches Pine `pivothigh` / `pivotlow`). Pivots Standard: classical pivot levels per system over the previous day's HLC. Volatility Stop: ATR-based trailing stop level.

### 4. Slot value shapes

- `ta.zigZag`: `{ outputs: { value, direction }, lastPivotValue, lastPivotIndex, currentTrendDirection, peakSinceLastPivot, peakIndex }`.
- `ta.pivotsHighLow`: `{ outputs: { high, low }, highWindow, lowWindow }` (`Float64RingBuffer` of size `leftLength + rightLength + 1`).
- `ta.pivotsStandard`: `{ outputs: { pp, r1, s1, r2, s2, r3, s3 }, currentDayKey, prevHigh, prevLow, prevClose }`.
- `ta.volatilityStop`: `{ outputs: { value, direction }, atrSub, prevStop, prevDirection }`.

### 5. Multi-output metadata

Each primitive declares `primarySeriesKey`. `pivotsStandard`'s
seven outputs all visible by default (`getVisibleSeriesKeys`
returns all 7).

### 6. NaN handling

- ZigZag: NaN inputs → no pivot update.
- Pivots H/L: centred-window NaN-correct (matches Fractal).
- Pivots Standard: NaN prevHLC → NaN at all outputs.
- Volatility Stop: NaN ATR → NaN.

### 7. `replaceHead` correctness

ZigZag and Volatility Stop are state-machine heavy. Property
test asserts append-vs-replaceHead equivalence on a fixture with
adversarial reversals.

### 8. §22.10 set + scenarios

| File | Script |
|---|---|
| `taZigZag.scenario.ts` | `const z = ta.zigZag({ deviation: 5 }); plot(z.value);`. |
| `taPivotsHighLow.scenario.ts` | `const p = ta.pivotsHighLow({ leftLength: 4, rightLength: 4 }); plot(p.high); plot(p.low);`. |
| `taPivotsStandard.scenario.ts` | `const p = ta.pivotsStandard(); plot(p.pp); plot(p.r1); plot(p.s1); plot(p.r2); plot(p.s2); plot(p.r3); plot(p.s3);`. |
| `taVolatilityStop.scenario.ts` | `const v = ta.volatilityStop({ length: 20, multiplier: 2 }); plot(v.value);`. |

### 9. JSDoc

`@formula`, `@warmup`, `@since 0.2`, `@experimental`, `@example`.
`pivotsStandard` JSDoc enumerates supported systems and notes
that R4 / S4 / R5 / S5 defer to a later phase.

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `packages/core/src/ta/ta.ts` | Modify | TaNamespace + opts + result types. |
| `packages/core/src/ta/ta.test.ts` | Modify | Stub coverage. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Four entries. |
| `packages/core/src/statefulPrimitives.test.ts` | Modify | Cardinality. |
| `packages/runtime/src/ta/{zigZag,pivotsHighLow,pivotsStandard,volatilityStop}.ts` | Create | Impls. |
| `packages/runtime/src/ta/<id>.{test,property.test,golden.test,bench,bench.test}.ts` | Create (×4 × 5) | §22.10. |
| `packages/runtime/src/ta/registry.ts` | Modify | Cardinality 87 + metadata. |
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

`.changeset/phase-2-sr-zigzag-pivots-volatilitystop.md` — `minor`
for core / runtime / conformance.

## Acceptance Criteria

- Four primitives exported + registered (cardinality 87).
- `pivotsStandard` supports the four documented systems
  (classic, fibonacci, camarilla, woodie); R4–R5 / S4–S5
  deferred and noted in JSDoc.
- ZigZag + Volatility Stop replaceHead equivalence pinned by
  property test.
- §22.10 set complete; 100% coverage.
- Changeset committed.
