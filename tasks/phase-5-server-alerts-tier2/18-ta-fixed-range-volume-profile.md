# Task 18 — `ta.fixedRangeVolumeProfile` port + full §22.10 set

> **Status: TODO**

## Goal

Port `fixedRangeVolumeProfile` from
`../invinite/.../indicators/fixed-range-volume-profile.ts` (363 LOC)
into `packages/runtime/src/ta/fixedRangeVolumeProfile.ts`. The
"fixed range" variant takes two time anchors (`from`, `to`) and
bucketizes volume between them. Last of the four volume-profile
ports. Ships the full §22.10 set.

## Prerequisites

- Task 17: `ta.sessionVolumeProfile` shipped. All shared
  volume-profile infrastructure proven.

## Current Behavior

- `packages/runtime/src/ta/` has no `fixedRangeVolumeProfile.ts`.
- The TA registry does not include `fixedRangeVolumeProfile`.

## Desired Behavior

- `ta.fixedRangeVolumeProfile(opts)` takes `from: Time` + `to: Time`,
  windows the bar stream between them (inclusive on both ends), and
  bucketizes the volume. Useful for analyzing a specific historical
  range without depending on chart viewport.
- The script typically wires both anchors via
  `input.time({ pickFromChart: true })` × 2.
- Emits `PlotKind = "horizontal-histogram"` + the developing series.
- Pre-`from` bars: NaN POC / VAH / VAL.
- Post-`to` bars: results frozen at the `to` bar's bucket histogram.
- Registered in `STATEFUL_PRIMITIVES`; cardinality bumps to **171**.

## Requirements

### 1. Provenance header

```
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/fixed-range-volume-profile.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — Series<T> shape, opts.offset, JSDoc.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.
```

### 2. `packages/runtime/src/ta/fixedRangeVolumeProfile.ts`

```ts
import { computeProfile, developingSeries } from "./_lib/volume-profile";
import type { Series, Time, ComputeContext } from "@invinite-org/chartlang-core";

export type FixedRangeVolumeProfileOpts = Readonly<{
    from: Time;
    to: Time;
    rowSize?: number;
    valueAreaPct?: number;
    offset?: number;
    bucketColor?: string;
}>;

export type FixedRangeVolumeProfileResult = Readonly<{
    poc: Series<number>;
    valHigh: Series<number>;
    valLow: Series<number>;
    buckets: ReadonlyArray<Readonly<{ price: number; volume: number }>>;
}>;

/**
 * Fixed-Range Volume Profile — bucketizes volume between two user-
 * picked time anchors. Results freeze at `opts.to`; bars after that
 * read the frozen state. Pre-`from` bars produce NaN.
 *
 * @formula  See `../invinite/.../fixed-range-volume-profile.ts`.
 * @anchors  `opts.from: Time` + `opts.to: Time` (typically two
 *           `input.time({ pickFromChart: true })` inputs).
 * @warmup   First bar at or after `opts.from` (NaN before).
 * @since 0.5
 * @example
 *     const from = input.time(0, { pickFromChart: true, title: "From" });
 *     const to   = input.time(0, { pickFromChart: true, title: "To" });
 *     const vp = ta.fixedRangeVolumeProfile({
 *         from: inputs.from, to: inputs.to,
 *     });
 *     plot(vp.poc, { style: { kind: "horizontal-histogram", buckets: vp.buckets } });
 */
export function fixedRangeVolumeProfile(
    slotId: string,
    ctx: ComputeContext,
    opts: FixedRangeVolumeProfileOpts,
): FixedRangeVolumeProfileResult {
    // … 1:1 port of the invinite math
}
```

### 3. Range-handling semantics

- `opts.from > opts.to` → invariant violation. Emit
  `fixed-range-inverted` diagnostic once + return NaN series.
  Document in JSDoc.
- `opts.from === opts.to` → degenerate; single-bar window.
  Buckets contain one bucket if the bar's close is in range,
  else empty.
- `opts.from` after the last bar → all NaN.
- `opts.to` before the first bar → all NaN.

### 4. Multi-output contract (PLAN §9.1)

- `primarySeriesKey: "poc"`.
- `getVisibleSeriesKeys`: full set within the window, empty
  outside.
- `yDomain: { kind: "auto" }`.

### 5. Registry + STATEFUL_PRIMITIVES

- Register in `packages/runtime/src/ta/registry.ts`.
- Append `{ name: "ta.fixedRangeVolumeProfile", slot: true }` to
  `STATEFUL_PRIMITIVES`. Bump test to **171**.

### 6. Tests (§22.10 set)

#### `packages/runtime/src/ta/fixedRangeVolumeProfile.test.ts`

- Full-range (`from = first bar.time`, `to = last bar.time`) →
  identical to `visibleRangeVolumeProfile`.
- Mid-range (`from = bar[25]`, `to = bar[75]` of 100 bars) → bars
  0–24 and 76–99 produce NaN; bars 25–75 produce non-NaN.
- Post-`to` freeze: bar 76's bucket histogram matches bar 75's.
- Inverted range (`from > to`) → diagnostic + NaN.
- Future range (`from > last bar.time`) → all NaN.

#### `packages/runtime/src/ta/fixedRangeVolumeProfile.property.test.ts`

- Conservation: sum of bucket volumes = sum of bar volumes between
  `from` and `to`.
- Freeze invariant: for bars after `to`, the buckets snapshot
  equals the buckets at `to`.
- Pre-`from` NaN invariant.

#### `packages/runtime/src/ta/fixedRangeVolumeProfile.golden.test.ts`

- Three captured invinite reference outputs:
  - 200 bars, range `[50, 150]`.
  - 500 bars, range `[100, 400]`.
  - 100 bars, range `[0, 99]` (full).

#### `packages/runtime/src/ta/fixedRangeVolumeProfile.bench.ts` (+ pair)

- 5,000-bar profile, range `[1000, 4000]`.
- `THRESHOLD_MS = 15`.

### 7. Conformance scenarios

- `taFixedRangeVolumeProfile.ts` — happy path.
- `taFixedRangeVolumeProfileInverted.ts` — `from > to`. Assertion:
  `diagnostic-code-present`: `fixed-range-inverted`.

### 8. Docs + CORE_AMBIENT_SHIM

JSDoc with full tag set; mirror in `CORE_AMBIENT_SHIM`.

### 9. Phase-5 indicator inventory cross-check

After this task:

- `STATEFUL_PRIMITIVES.size === 171` (163 Phase-4 baseline
  + 1 `defineAlertCondition.signal` + 1 `runtime.log` + 1 `runtime.error`
  + 1 `draw.table` + 4 volume-profile primitives = 171).
- The Phase-5 README projects the same final cardinality (171). The
  closeout (Task 19) confirms the assertion matches.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/ta/fixedRangeVolumeProfile.ts` | Create | Port |
| `packages/runtime/src/ta/fixedRangeVolumeProfile.test.ts` | Create | Unit |
| `packages/runtime/src/ta/fixedRangeVolumeProfile.property.test.ts` | Create | Property |
| `packages/runtime/src/ta/fixedRangeVolumeProfile.golden.test.ts` | Create | Golden |
| `packages/runtime/src/ta/__fixtures__/fixedRangeVolumeProfile/*.json` | Create | Goldens (3) |
| `packages/runtime/src/ta/fixedRangeVolumeProfile.bench.ts` | Create | Bench |
| `packages/runtime/src/ta/fixedRangeVolumeProfile.bench.test.ts` | Create | Threshold |
| `packages/runtime/src/ta/registry.ts` | Modify | Register |
| `packages/core/src/ta/index.ts` (namespace) | Modify | Add to `ta` namespace |
| `packages/core/src/statefulPrimitives.ts` | Modify | Append; bump to 171 |
| `packages/compiler/src/program.ts` | Modify | Mirror in `CORE_AMBIENT_SHIM` |
| `packages/conformance/src/scenarios/taFixedRangeVolumeProfile.ts` | Create | Happy |
| `packages/conformance/src/scenarios/taFixedRangeVolumeProfileInverted.ts` | Create | Inverted |
| `packages/conformance/src/scenarios/index.ts` | Modify | Register |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100%)
- `pnpm docs:check`
- `pnpm conformance`
- `pnpm bench:ci`
- `pnpm readme:check`

## Changeset

`.changeset/phase5-ta-fixed-range-volume-profile.md` — `minor`
bump for core + runtime. Body cites PLAN §9.2 + §10.1.1 + invinite
commit SHA.

## Acceptance Criteria

- [ ] Port shipped with 4-line provenance header.
- [ ] Full §22.10 set; freeze + conservation + pre-`from` NaN
      invariants all pinned by property tests.
- [ ] Inverted-range diagnostic fires exactly once per mount.
- [ ] `STATEFUL_PRIMITIVES.size === 171`.
- [ ] Bench under threshold.
- [ ] Both conformance scenarios green.
- [ ] 100% coverage; all gates green.
- [ ] Changeset committed.
