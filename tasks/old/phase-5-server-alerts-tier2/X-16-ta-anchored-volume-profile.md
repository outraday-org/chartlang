# Task 16 — `ta.anchoredVolumeProfile` port + full §22.10 set

> **Status: TODO**

## Goal

Port `anchoredVolumeProfile` from
`../invinite/.../indicators/anchored-volume-profile.ts` (317 LOC)
into `packages/runtime/src/ta/anchoredVolumeProfile.ts`. The
"anchored" variant reads a user-picked time anchor via
`input.time({ pickFromChart: true })` per PLAN §10.1.1. Ships the
full §22.10 set.

## Prerequisites

- Task 15: `ta.visibleRangeVolumeProfile` shipped. Provenance + test
  patterns proven on the previous indicator.

## Current Behavior

- `packages/runtime/src/ta/` has no `anchoredVolumeProfile.ts`.
- The TA registry does not include `anchoredVolumeProfile`.
- The script-side `input.time({ pickFromChart: true })` builder shipped
  in Phase 4; this task is the first runtime consumer of the picker.

## Desired Behavior

- `ta.anchoredVolumeProfile(opts)` reads its time anchor from a
  declared `input.time({ pickFromChart: true })` input. The script
  passes the resolved anchor as `opts.anchor: Time` (matching the
  invinite signature). The runtime windows bars from `anchor`
  forward to the current bar and bucketizes their volume.
- Emits `PlotKind = "horizontal-histogram"` + the developing series
  (`poc` / `valHigh` / `valLow`) per Task 15's multi-output shape.
- Registered in `STATEFUL_PRIMITIVES`; cardinality bumps to **169**.
- The picker integration is verified by a conformance scenario that
  passes a known anchor time and asserts the expected histogram.

## Requirements

### 1. Provenance header

Same 4-line header as Task 15, with the invinite path swapped to
`anchored-volume-profile.ts`.

### 2. `packages/runtime/src/ta/anchoredVolumeProfile.ts`

```ts
import { computeProfile, developingSeries } from "./lib/volume-profile";
import type { Series, Time, ComputeContext } from "@invinite-org/chartlang-core";

export type AnchoredVolumeProfileOpts = Readonly<{
    anchor: Time;
    rowSize?: number;
    valueAreaPct?: number;
    offset?: number;
    bucketColor?: string;
}>;

export type AnchoredVolumeProfileResult = Readonly<{
    poc: Series<number>;
    valHigh: Series<number>;
    valLow: Series<number>;
    buckets: ReadonlyArray<Readonly<{ price: number; volume: number }>>;
}>;

/**
 * Anchored Volume Profile — reads a user-picked time anchor and
 * bucketizes volume from that anchor forward.
 *
 * @formula  See `../invinite/.../anchored-volume-profile.ts`.
 * @anchors  `opts.anchor: Time` — supplied by `input.time({ pickFromChart: true })`.
 * @warmup   First bar at or after `anchor` (NaN before anchor).
 * @since 0.5
 * @example
 *     const anchor = input.time(0, { pickFromChart: true });
 *     const vp = ta.anchoredVolumeProfile({ anchor: inputs.anchor });
 *     plot(vp.poc, { style: { kind: "horizontal-histogram", buckets: vp.buckets } });
 */
export function anchoredVolumeProfile(
    slotId: string,
    ctx: ComputeContext,
    opts: AnchoredVolumeProfileOpts,
): AnchoredVolumeProfileResult {
    // … 1:1 port of the invinite math
}
```

### 3. NaN-before-anchor handling

The invinite source carries semantics for bars before the anchor:
the buckets are empty, the POC / VAH / VAL series are NaN. Port
this verbatim. Property test pins it.

### 4. Multi-output contract (PLAN §9.1)

- `primarySeriesKey: "poc"` — the click-target series.
- `getVisibleSeriesKeys` returns all three keys when buckets
  non-empty; empty array before anchor.
- `yDomain: { kind: "auto" }`.

### 5. Registry + STATEFUL_PRIMITIVES

- Register in `packages/runtime/src/ta/registry.ts`.
- Append `{ name: "ta.anchoredVolumeProfile", slot: true }` to
  `STATEFUL_PRIMITIVES`. Bump test to **169**.

### 6. Tests (§22.10 set)

#### `packages/runtime/src/ta/anchoredVolumeProfile.test.ts`

- Anchor at first bar → identical to visibleRange with no offset.
- Anchor at bar 50 of 100-bar input → bars 0–49 produce NaN POC;
  bars 50–99 produce non-NaN.
- Anchor in the future (after last bar) → all NaN.
- Anchor at exactly current bar → empty buckets (no bars yet).
- `rowSize: 0` → auto-sizing.

#### `packages/runtime/src/ta/anchoredVolumeProfile.property.test.ts`

- Pre-anchor bars: POC / VAH / VAL are always NaN.
- Post-anchor bars: bucket-volume conservation invariant from
  Task 14 (`bucketizeVolume.property.test.ts`).
- Monotonic POC under monotonic price input.

#### `packages/runtime/src/ta/anchoredVolumeProfile.golden.test.ts`

- Three captured invinite reference outputs:
  - 200 bars, anchor at bar 50.
  - 100 bars, anchor at bar 0.
  - 500 bars, anchor at bar 250.

#### `packages/runtime/src/ta/anchoredVolumeProfile.bench.ts` (+ pair)

- 5,000-bar profile with anchor at bar 2,500.
- `THRESHOLD_MS = 15`.

### 7. Conformance scenario

Existing scenarios use the `<name>.scenario.ts` suffix.

`packages/conformance/src/scenarios/taAnchoredVolumeProfile.scenario.ts`:

- Script declares `input.time(<anchor>, { pickFromChart: true })`
  and calls `ta.anchoredVolumeProfile({ anchor: inputs.anchor })`.
- Harness passes a known anchor + 100-bar fixture.
- Assertions: `plot-hash` against captured golden + no diagnostic.

### 8. Docs + CORE_AMBIENT_SHIM

- JSDoc with full tag set; `pnpm chartlang docs` regenerates.
- Mirror in `CORE_AMBIENT_SHIM`.

### 9. Capability gating

- `Capabilities.inputs` must declare `"time"` (Phase 4 closeout
  ensured this). If not declared → `unsupported-input-kind` per
  Phase-4 behaviour.
- `Capabilities.plots` must declare `"horizontal-histogram"` (added
  in Task 9). If not declared → silent no-op +
  `unsupported-plot-kind`.

### 10. Reuse Task 15's `lib/volume-profile/index.ts` re-exports

No new shared math; just consume what Task 14 + 15 wired.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/ta/anchoredVolumeProfile.ts` | Create | Port |
| `packages/runtime/src/ta/anchoredVolumeProfile.test.ts` | Create | Unit |
| `packages/runtime/src/ta/anchoredVolumeProfile.property.test.ts` | Create | Property |
| `packages/runtime/src/ta/anchoredVolumeProfile.golden.test.ts` | Create | Golden |
| `packages/runtime/src/ta/__fixtures__/anchoredVolumeProfile/*.json` | Create | Goldens (3) |
| `packages/runtime/src/ta/anchoredVolumeProfile.bench.ts` | Create | Bench |
| `packages/runtime/src/ta/anchoredVolumeProfile.bench.test.ts` | Create | Threshold |
| `packages/runtime/src/ta/registry.ts` | Modify | Register |
| `packages/core/src/ta/index.ts` (namespace) | Modify | Add to `ta` namespace |
| `packages/core/src/statefulPrimitives.ts` | Modify | Append; bump to 169 |
| `packages/compiler/src/program.ts` | Modify | Mirror in `CORE_AMBIENT_SHIM` |
| `packages/conformance/src/scenarios/taAnchoredVolumeProfile.scenario.ts` | Create | Scenario |
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

`.changeset/phase5-ta-anchored-volume-profile.md` — `minor` bump for
core + runtime. Body cites PLAN §9.2 + §10.1.1 + invinite commit SHA.


- [x] Port shipped with 4-line provenance header.
- [x] Full §22.10 set: JSDoc (@formula / @anchors / @warmup / @example /
      @since 0.5 / @experimental), unit + property + golden + bench +
      conformance + docs page.
- [x] Pre-anchor NaN invariant pinned by property test.
- [x] Goldens match invinite reference outputs bar-for-bar.
- [x] `STATEFUL_PRIMITIVES.size === 169`.
- [x] Bench under threshold.
- [x] 100% coverage; all gates green.
- [x] Changeset committed.
