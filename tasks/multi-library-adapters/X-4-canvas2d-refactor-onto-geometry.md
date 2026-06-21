# Refactor canvas2d-adapter onto the shared geometry layer

> **Status: TODO**

## Goal

Migrate `examples/canvas2d-adapter/` to consume the adapter-kit geometry
layer (Tasks 1–3): replace the 63 per-kind drawing renderers + their
geometry helpers with `paintPrimitive(ctx, decomposeDrawing(emission,
viewport))`, import `Viewport`/`timeToX`/`priceToY`/`RenderCtx` from
adapter-kit, and re-export the shared `MockCanvasContext` as
`MockCanvas2DContext` to preserve the `./testing` public path. Re-pin the
integration hash with zero behavioural drift.

## Prerequisites

- Tasks 1, 2, 3 (full `decomposeDrawing` + `paintPrimitive` + canvas sink).

## Current Behavior

`canvas2d-adapter` owns: `src/render/coords.ts` (`Viewport`/projection +
bar-shift helpers), `src/render/clear.ts` (`RenderCtx`), `src/render/draw/`
(63 per-kind renderers + `drawingDispatch.ts` + geometry helpers), and
`src/testing.ts` (`MockCanvas2DContext`). `renderOverlayTail` calls
`drawingDispatch(ctx, drawing, viewport)`. `src/render/index.ts` re-exports
`./draw/index.js`.

## Desired Behavior

`canvas2d-adapter` keeps its plot/candle/pane/glyph renderers but routes
**drawings** through the shared layer. The entire `src/render/draw/`
directory (63 per-kind renderers + dispatch + geometry helpers) is
deleted. Public surface (`./` and `./testing` exports,
`MockCanvas2DContext` name) is unchanged.

## Requirements

### 1. Replace drawing dispatch

In `src/createCanvas2dAdapter.ts`, change `renderOverlayTail`:

```ts
import { decomposeDrawing } from "@invinite-org/chartlang-adapter-kit";
import { paintPrimitive } from "@invinite-org/chartlang-adapter-kit/canvas";

// for each drawing in state.drawings.values():
if (drawing.op === "remove") continue;          // unchanged: map already dropped it
for (const prim of decomposeDrawing(drawing, viewport)) {
    paintPrimitive(state.ctx, prim);
}
```

Delete `src/render/draw/drawingDispatch.ts`.

### 2. Delete the migrated geometry

Delete the **entire `src/render/draw/` directory** — all 63 per-kind
renderers, `drawingDispatch.ts`, every geometry helper now living in
adapter-kit (`worldToCanvas.ts`, `bezier.ts`, `gannLevels.ts`,
`pitchforkGeom.ts`, `lineExtend.ts`, `arrowhead.ts`, `chevron.ts`,
`namedPolyline.ts`, `fibLevels.ts`, `shapeStyle.ts`, `textStyle.ts`),
the `draw/index.ts` barrel, and all co-located `*.test.ts`. This is safe:
nothing outside `src/render/draw/` imports from it **except**
`src/render/index.ts`'s `export … from "./draw/index.js"` — remove that
re-export line from `render/index.ts` (the surviving plot renderers do
not consume `draw/`).

> **Do NOT delete `src/render/lineDash.ts`.** `dashPattern` was *copied*
> into adapter-kit `_lib/dash.ts` (Task 1), not moved — `lineDash.ts` is
> still imported by surviving plot renderers (`render/area.ts`,
> `render/horizontalLine.ts`). It stays in canvas2d (it lives one level
> **up** from `draw/`, so deleting the `draw/` directory leaves it intact).

> Only the **drawings** path is migrated. The plot/candle/marker/glyph/
> hline/pane/axis/alert renderers under `src/render/` (`candles.ts`,
> `line.ts`, `histogram.ts`, `area.ts`, `filledBand.ts`, `marker.ts`,
> `shape.ts`, `character.ts`, `arrow.ts` (glyph), `barColor.ts`,
> `bgColor.ts`, `candleOverride.ts`, `barOverride.ts`,
> `horizontalHistogram.ts`, `horizontalLine.ts`, `paneLayout.ts`,
> `yAxis.ts`, `alertBadge.ts`, `alertConditions.ts`, `logPane.ts`, etc.)
> stay — they map to native facilities per the architecture decision and
> are NOT part of `decomposeDrawing`.

### 3. Re-point shared types

- **Keep `src/render/coords.ts` — do NOT delete it.** Only
  `Viewport`/`timeToX`/`priceToY` were moved to adapter-kit; `coords.ts`
  also exports the bar-shift helpers `projectShiftedX`, `shiftedBarTime`,
  `medianBarSpacing`, and `yToPrice`, which the **surviving plot/candle
  renderers** still use and which were **not** ported. Re-point only the
  three moved symbols:
  `export { type Viewport, timeToX, priceToY } from "@invinite-org/chartlang-adapter-kit";`
  and keep the bar-shift helpers defined locally (they now import
  `Viewport`/`timeToX`/`priceToY` from adapter-kit instead of defining
  them). No adapter owns a parallel copy of the projection primitives,
  while the layout-specific bar-shift math stays canvas2d-local.
- Replace the `RenderCtx` in `src/render/clear.ts`:
  `export type { RenderCtx } from "@invinite-org/chartlang-adapter-kit/canvas";`
  Keep `clear.ts`'s own `clearFrame`/`clearPaneRect` helpers if present.

### 4. Preserve the `./testing` invariant

`src/testing.ts` must stay (documented invariant: conformance imports
`MockCanvas2DContext` from `chartlang-example-canvas2d-adapter/testing`).
Make it re-export the shared mock under the legacy name:

```ts
export { MockCanvasContext as MockCanvas2DContext, hashCallLog } from
    "@invinite-org/chartlang-adapter-kit/canvas";
// keep any canvas2d-specific RecordedCall type re-exports the tests use
```

The `./testing` export map entry in `package.json` is unchanged.

### 5. Dependency

`examples/canvas2d-adapter/package.json` already depends on
`@invinite-org/chartlang-adapter-kit` (`workspace:^`) — no new dep. The
`./canvas` sub-path resolves through the same package.

### 6. Re-pin the integration hash

`src/integration.test.ts` pins a `hashCallLog` constant. Because the
drawing geometry was **moved, not changed**, the painted call sequence
for drawings should be identical — but `paintPrimitive` may emit calls in
a slightly different (still-canonical) order than the old per-kind
renderers (e.g. fill-then-stroke grouping). Run the test, inspect the
diff, confirm it is an ordering/grouping change with no geometry drift,
then update the pinned constant. **Document the re-pin reason** in the
test comment.

### Edge cases

- `op: "remove"` stays a no-op (canvas2d is stateless).
- Coverage: deleting renderers + their tests must not drop canvas2d below
  100% — the surviving code (factory, plot/candle renderers, ingest) must
  stay fully covered. Add a `paintPrimitive`-dispatch test in canvas2d
  only if a branch in `renderOverlayTail` is otherwise uncovered.
- The `integration.test.ts` MTF / history scenarios (`htf-trend-filter`)
  must still pass — drawings there should be byte-identical post-move.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/canvas2d-adapter/src/createCanvas2dAdapter.ts` | Modify | route drawings via `decomposeDrawing`+`paintPrimitive` |
| `examples/canvas2d-adapter/src/render/draw/**` | Delete | entire directory: 63 renderers + dispatch + moved helpers (+ their tests) |
| `examples/canvas2d-adapter/src/render/index.ts` | Modify | drop the `export … from "./draw/index.js"` re-export |
| `examples/canvas2d-adapter/src/render/coords.ts` | Modify | re-export `Viewport`/`timeToX`/`priceToY` from adapter-kit; keep local bar-shift helpers (`projectShiftedX`/`shiftedBarTime`/`medianBarSpacing`/`yToPrice`) |
| `examples/canvas2d-adapter/src/render/clear.ts` | Modify | re-export `RenderCtx` from adapter-kit/canvas |
| `examples/canvas2d-adapter/src/testing.ts` | Modify | re-export shared mock as `MockCanvas2DContext` |
| `examples/canvas2d-adapter/src/integration.test.ts` | Modify | re-pin hash; document reason |
| `examples/canvas2d-adapter/CLAUDE.md` | Modify | note drawings now flow through adapter-kit `decomposeDrawing`; geometry no longer lives here |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (canvas2d-adapter 100% coverage; adapter-kit unchanged)
- `pnpm conformance` (canvas2d default export still passes)

## Changeset

`.changeset/canvas2d-consume-geometry.md` — **patch** for the (private)
example is optional; if the repo changesets private packages, use patch.
No public-package behaviour change beyond Task 1–3's adapter-kit minor.

## Acceptance Criteria

- canvas2d renders all 63 drawings via `decomposeDrawing`+`paintPrimitive`;
  the `src/render/draw/` directory is removed entirely and
  `render/index.ts` no longer re-exports it.
- `./` and `./testing` exports unchanged; `MockCanvas2DContext` importable
  from `chartlang-example-canvas2d-adapter/testing`.
- Integration hash re-pinned with a documented, geometry-preserving reason;
  MTF/history scenarios pass.
- 100% coverage on canvas2d; conformance green.
- `CLAUDE.md` updated.
