# Task 1 — Shared render-order sort in adapter-kit

> **Status: TODO**

## Goal

Promote the z-order comparator + band constants out of
`examples/canvas2d-adapter/src/render/renderOrder.ts` into
`@invinite-org/chartlang-adapter-kit` as a single payload-generic
helper, then refactor `canvas2d` to consume it. Behavior-preserving:
the pinned integration `hashCallLog` is unchanged. This is the shared
foundation every adapter's `z` work (Tasks 4, 6, 10, 12) builds on —
mirrors the earlier `shift.ts` promotion.

## Prerequisites

None.

## Current Behavior

`canvas2d` owns the only z-order implementation. `renderOrder.ts`
exports `BAND = { series: 0, glyph: 1, hline: 2, drawing: 3 }`, a
canvas2d-specific `SortableMark` union (payloads carry `PlotPoint` /
`HLine` / `PlotEmission` / `DrawingEmission`), and
`sortByRenderOrder(marks)` whose body is the model-agnostic comparator
`a.z - b.z || a.band - b.band || a.seq - b.seq`. The other four
adapters have no z-order at all.

## Desired Behavior

`adapter-kit` exposes, on the ROOT `.` barrel (alongside `timeToX` /
`shiftedBarTime`):

- `RENDER_BAND` — the `{ series, glyph, hline, drawing }` band map.
- `RenderOrderKey` — the structural `{ z: number; band: number; seq:
  number }` a sortable mark must satisfy.
- `sortByRenderOrder<T extends RenderOrderKey>(marks: T[]): T[]` — the
  generic in-place comparator.

`canvas2d`'s `renderOrder.ts` re-exports `sortByRenderOrder` +
`RENDER_BAND` from `adapter-kit` (no local comparator), keeps its
local `SortableMark` union (the payloads stay local), and aliases
`BAND = RENDER_BAND` so existing call sites are untouched.

## Requirements

### 1. New file `packages/adapter-kit/src/geometry/renderOrder.ts`

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Default render-order bands. At the default `z = 0` the composite key
 * reduces to `(band, seq)` = series → glyphs → hlines → drawings, the
 * phase order every adapter shared before `z` existed. A `z < 0` mark
 * sorts beneath `z = 0` marks; a `z > 0` plot sorts above drawings —
 * the lever a fixed band stack cannot express.
 *
 * @since 1.6
 * @stable
 * @example
 *     const seriesBeforeDrawing = RENDER_BAND.series < RENDER_BAND.drawing;
 *     void seriesBeforeDrawing;
 */
export const RENDER_BAND = { series: 0, glyph: 1, hline: 2, drawing: 3 } as const;

/**
 * The structural key a mark must carry to participate in the z-sort:
 * presentation `z` (default 0), its default `band`, and a global
 * monotonic declaration `seq` (ingest order = script order) that makes
 * the comparator total and deterministic.
 *
 * @since 1.6
 * @stable
 * @example
 *     const k: RenderOrderKey = { z: 0, band: RENDER_BAND.series, seq: 0 };
 *     void k;
 */
export type RenderOrderKey = { readonly z: number; readonly band: number; readonly seq: number };

/**
 * Stable total order for the z-ordered paint pass: ascending by `z`,
 * then `band`, then `seq`. Sorts in place and returns the same array
 * for chaining. Generic over the mark payload so every adapter keeps
 * its own mark union and shares ONE comparator (no hand-port).
 *
 * @since 1.6
 * @stable
 * @example
 *     const marks = [{ z: 1, band: 0, seq: 0 }, { z: 0, band: 0, seq: 1 }];
 *     sortByRenderOrder(marks);
 *     // marks[0].z === 0
 *     void marks;
 */
export function sortByRenderOrder<T extends RenderOrderKey>(marks: T[]): T[] {
    marks.sort((a, b) => a.z - b.z || a.band - b.band || a.seq - b.seq);
    return marks;
}
```

### 2. Barrel export

Add to `packages/adapter-kit/src/index.ts` (root barrel) the three
symbols. Follow the existing `geometry/shift.ts` re-export pattern.
Do NOT add to the `./canvas` sub-path — konva (forbidden from
`/canvas`) needs this on root, exactly like `shift.ts`.

### 3. Tests `packages/adapter-kit/src/geometry/renderOrder.test.ts`

100% coverage. Cover: ascending `z` wins; tie on `z` falls to `band`;
tie on `z`+`band` falls to `seq`; negative `z` sorts first; in-place
mutation returns the same reference; empty array. Use bare
`RenderOrderKey` objects (no library payloads needed).

### 4. Refactor `examples/canvas2d-adapter/src/render/renderOrder.ts`

Replace the local `sortByRenderOrder` body and the `BAND` literal with
re-exports:

```ts
import { RENDER_BAND, sortByRenderOrder } from "@invinite-org/chartlang-adapter-kit";
export { sortByRenderOrder };
// Local alias so existing `BAND.series` call sites are untouched.
export const BAND = RENDER_BAND;
```

Keep the local `SortableMark` union as-is (its payloads —
`PlotPoint`, `HLine`, `PlotEmission`, `DrawingEmission` — stay local).
`SortableMark` already satisfies `RenderOrderKey` structurally, so
`sortByRenderOrder(marks: SortableMark[])` still type-checks. Update
the local `renderOrder.test.ts` if it asserted the old local symbol
identity; the BAND values and sort results are unchanged.

### 5. Edge cases

- The comparator is unchanged math — the `canvas2d` integration
  `PINNED_HASH` (EMA-cross, no drawings) is byte-identical. Do not
  re-pin.
- `@since 1.6` on all three new exports (current adapter-kit version is
  `1.5.0`, so the next unreleased minor is `1.6` — confirm against
  `package.json` and bump the tag if `package.json` has moved on).
  Note the pending `adapter-kit-renderctx-clip` /
  `adapter-kit-shared-shift-contract` changesets are already minor, so
  the consolidated next release is `1.6.0` and `@since 1.6` is correct.

### 6. Document the shared sort in `packages/adapter-kit/CLAUDE.md`

Per the repo CLAUDE.md rule (a behavior change in a folder updates that
folder's `CLAUDE.md`), add a bullet to the **Geometry-layer invariants**
section recording that the z-order comparator now lives in adapter-kit
and adapters MUST import it rather than re-port it — mirroring the
existing `geometry/shift.ts` invariant ("four hand-ports were exactly how
the offset-collapse bug arose"). State that `sortByRenderOrder` /
`RENDER_BAND` / `RenderOrderKey` are pure, 100%-covered, on the root `.`
barrel (NOT `./canvas`, so konva can import them), each carrying
`@since 1.6` + `@stable` + `@example`, and that the per-adapter mark
union stays local while the comparator is shared.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/adapter-kit/src/geometry/renderOrder.ts` | Create | Shared comparator + band const + key type |
| `packages/adapter-kit/src/geometry/renderOrder.test.ts` | Create | 100% coverage of the comparator |
| `packages/adapter-kit/src/index.ts` | Modify | Re-export the three symbols on root barrel |
| `examples/canvas2d-adapter/src/render/renderOrder.ts` | Modify | Re-export shared comparator + `BAND` alias |
| `examples/canvas2d-adapter/src/render/renderOrder.test.ts` | Modify | Drop assertions on the moved comparator's local identity |
| `packages/adapter-kit/CLAUDE.md` | Modify | Geometry-layer invariant for the shared `sortByRenderOrder` (mirrors the `shift.ts` invariant) |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (adapter-kit + canvas2d 100% coverage)
- `pnpm docs:check` (JSDoc `@since` / `@example` / stability on new exports)
- `pnpm adapters:generate` + `pnpm adapters:gate` (canvas2d embedded copy re-synced)

## Changeset

`.changeset/adapter-kit-shared-render-order.md` — **minor** for
`@invinite-org/chartlang-adapter-kit` (new public surface); the
`canvas2d` example is private (empty changeset note, no bump).

## Acceptance Criteria

- `sortByRenderOrder` / `RENDER_BAND` / `RenderOrderKey` exported from
  the `adapter-kit` root barrel with full JSDoc.
- adapter-kit + canvas2d at 100% coverage.
- `canvas2d` consumes the shared comparator; no local comparator body
  remains; `BAND` call sites unchanged.
- canvas2d integration `PINNED_HASH` unchanged (behavior-preserving).
- `packages/adapter-kit/CLAUDE.md` documents the shared-sort invariant.
- `adapters:gate` green; changeset committed.
