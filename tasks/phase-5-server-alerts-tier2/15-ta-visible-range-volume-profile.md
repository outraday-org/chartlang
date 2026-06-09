# Task 15 — `ta.visibleRangeVolumeProfile` port + full §22.10 set

> **Status: TODO**

## Goal

Port `visibleRangeVolumeProfile` from
`../invinite/.../indicators/visible-range-volume-profile.ts` into
`packages/runtime/src/ta/visibleRangeVolumeProfile.ts`. Emits
`PlotKind = "horizontal-histogram"`. Ships the full §22.10 set:
JSDoc with `@formula` / `@anchors` / `@warmup`, unit + property +
golden + bench tests, conformance scenario, auto-generated docs
page.

## Prerequisites

- Task 14: shared volume-profile lib port available at
  `packages/runtime/src/ta/lib/volume-profile/`.

## Current Behavior

- `packages/runtime/src/ta/` has no `visibleRangeVolumeProfile.ts`.
- The TA registry does not include `visibleRangeVolumeProfile`.
- Invinite source: `../invinite/src/components/trading-chart/indicators/visible-range-volume-profile.ts`
  (209 LOC) + its `.test.ts`.

## Desired Behavior

- `ta.visibleRangeVolumeProfile(opts)` runs against the script's
  candle stream. The "visible range" is supplied via the
  `Capabilities.intervals`-style adapter contract — per PLAN §9.2,
  the visibleRange variant reads the chart viewport.
- For Phase-5 OSS scope (no chart UI required), the runtime exposes
  the visible range via `ComputeContext.bar.viewport` — a small new
  `{ fromTime, toTime }` view computed from the latest 100 bars
  ending at the current head. Adapters that DO have a real viewport
  (canvas2d-adapter at least) can override via a sub-input. Defer
  the proper viewport-driven version to Phase 6 if simpler.
- Emits a `PlotEmission` with `style.kind === "horizontal-histogram"`
  and `style.buckets` populated from the VP shared lib.
- The result also surfaces a multi-output series shape per the
  PLAN §9.1 multi-output contract: `poc`, `valHigh`, `valLow` as
  `Series<number>`.
- Registered in `STATEFUL_PRIMITIVES` (`slot: true`); cardinality
  bumps to **168**.

## Requirements

### 1. Provenance header

```
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/visible-range-volume-profile.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — Series<T> shape, opts.offset, JSDoc.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.
```

### 2. `packages/runtime/src/ta/visibleRangeVolumeProfile.ts`

```ts
import { computeProfile, type ProfileConfig } from "./lib/volume-profile";
import type { Series, ComputeContext } from "@invinite-org/chartlang-core";

export type VisibleRangeVolumeProfileOpts = Readonly<{
    rowSize?: number;            // default: auto from price range
    valueAreaPct?: number;       // default: 0.7
    offset?: number;             // universal §9.1
    bucketColor?: string;
}>;

export type VisibleRangeVolumeProfileResult = Readonly<{
    poc: Series<number>;
    valHigh: Series<number>;
    valLow: Series<number>;
}>;

/**
 * Visible-Range Volume Profile — buckets the visible range's volume
 * by price and surfaces POC / VAH / VAL series.
 *
 * @formula  See `../invinite/.../visible-range-volume-profile.ts`.
 * @anchors  Visible range = `(viewport.fromTime, viewport.toTime)`.
 * @warmup   First 2 bars (bucketize needs ≥ 2 bars for a non-zero range).
 * @since 0.5
 * @example
 *     const vp = ta.visibleRangeVolumeProfile({ rowSize: 0.1 });
 *     plot(vp.poc, { style: { kind: "horizontal-histogram", buckets: vp.buckets } });
 */
export function visibleRangeVolumeProfile(
    slotId: string,
    ctx: ComputeContext,
    opts?: VisibleRangeVolumeProfileOpts,
): VisibleRangeVolumeProfileResult {
    // … 1:1 port of the invinite math, retargeted at Series<T>
}
```

### 3. `lib/volume-profile/index.ts` extension

Re-export `computeProfile` + the `ProfileConfig` type from Task 14
so the indicator can pull both with a single import.

### 4. Registry + STATEFUL_PRIMITIVES

- `packages/runtime/src/ta/registry.ts` — append the entry per the
  Phase-2 registry pattern.
- `packages/core/src/statefulPrimitives.ts` — append
  `{ name: "ta.visibleRangeVolumeProfile", slot: true }`. Bump
  test assertion to **168**.

### 5. `packages/core/src/ta/visibleRangeVolumeProfile.types.ts` (or extend `ta` namespace)

The script-side `TaNamespace` already declares the `ta` surface
shape. Add `visibleRangeVolumeProfile: (opts?) => …` to the
namespace + the compile-time hole stub.

### 6. Tests (§22.10 set)

#### `packages/runtime/src/ta/visibleRangeVolumeProfile.test.ts`

- Port of the invinite unit test, retargeted. Covers:
  - Single-bar input → all volume in one bucket.
  - Constant-price input → one bucket at that price.
  - Edge case: zero-volume bars → empty buckets, NaN POC.
  - `rowSize: 0` → falls back to auto-sizing.

#### `packages/runtime/src/ta/visibleRangeVolumeProfile.property.test.ts`

- Sum of bucket volumes equals sum of input bar volumes
  (conservation invariant).
- POC is always within `[min(close), max(close)]` of the input.
- Value-area sum ≥ `valueAreaPct × totalVolume`.

#### `packages/runtime/src/ta/visibleRangeVolumeProfile.golden.test.ts`

- Three captured invinite reference outputs (run the invinite
  implementation against the same fixtures and persist).
  Fixture sets:
  - 100 bars of synthetic uptrend.
  - 200 bars of mean-reverting random walk.
  - 50 bars with a price gap (NaN handling).

#### `packages/runtime/src/ta/visibleRangeVolumeProfile.bench.ts` (+ pair)

- 5,000-bar profile, single iteration.
- `THRESHOLD_MS = 15` (per invinite's perf baseline; document).

### 7. Conformance scenario

Existing scenarios use the `<name>.scenario.ts` suffix
(e.g. `barstateConfirmed.scenario.ts`).

`packages/conformance/src/scenarios/taVisibleRangeVolumeProfile.scenario.ts`:

- Script: `defineIndicator` calling `ta.visibleRangeVolumeProfile()`
  and plotting `poc` + emitting buckets as a `horizontal-histogram`.
- Assertions: `plot-hash` against captured golden + no diagnostic.

### 8. Docs

- JSDoc with `@formula`, `@anchors`, `@warmup`, `@example`,
  `@since 0.5`, `@experimental`. The doc generator picks these up.
- `pnpm chartlang docs` regenerates `docs/primitives/ta/visibleRangeVolumeProfile.md`.

### 9. CORE_AMBIENT_SHIM

Mirror the new function signature in `packages/compiler/src/program.ts`.

### 10. Capability gating

The visible-range VP doesn't itself add a capability key, but its
emit goes through the `horizontal-histogram` PlotKind (Task 9). If
that kind is missing from `Capabilities.plots`, the emit becomes a
silent no-op + `unsupported-plot-kind` diagnostic.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/ta/visibleRangeVolumeProfile.ts` | Create | Port |
| `packages/runtime/src/ta/visibleRangeVolumeProfile.test.ts` | Create | Unit |
| `packages/runtime/src/ta/visibleRangeVolumeProfile.property.test.ts` | Create | Property |
| `packages/runtime/src/ta/visibleRangeVolumeProfile.golden.test.ts` | Create | Golden |
| `packages/runtime/src/ta/__fixtures__/visibleRangeVolumeProfile/*.json` | Create | Goldens |
| `packages/runtime/src/ta/visibleRangeVolumeProfile.bench.ts` | Create | Bench |
| `packages/runtime/src/ta/visibleRangeVolumeProfile.bench.test.ts` | Create | Threshold |
| `packages/runtime/src/ta/registry.ts` | Modify | Register |
| `packages/runtime/src/ta/lib/volume-profile/index.ts` | Modify | Re-export `computeProfile` |
| `packages/core/src/ta/index.ts` (or namespace file) | Modify | Add to `ta` namespace |
| `packages/core/src/statefulPrimitives.ts` | Modify | Append; bump to 168 |
| `packages/compiler/src/program.ts` | Modify | Mirror in `CORE_AMBIENT_SHIM` |
| `packages/conformance/src/scenarios/taVisibleRangeVolumeProfile.scenario.ts` | Create | Scenario |
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

`.changeset/phase5-ta-visible-range-volume-profile.md` — `minor`
bump for `@invinite-org/chartlang-core` + `@invinite-org/chartlang-runtime`.
Body cites PLAN §9.2 + invinite commit SHA.

## Acceptance Criteria

- [ ] Port shipped with 4-line provenance header.
- [ ] Full §22.10 set: JSDoc (@formula / @anchors / @warmup / @example /
      @since 0.5 / @experimental), unit + property + golden + bench +
      conformance + docs page.
- [ ] Conservation invariant property test green.
- [ ] Goldens match invinite reference outputs bar-for-bar.
- [ ] `STATEFUL_PRIMITIVES.size === 168`.
- [ ] Bench under `THRESHOLD_MS = 15`.
- [ ] 100% coverage; all gates green.
- [ ] Changeset committed.
