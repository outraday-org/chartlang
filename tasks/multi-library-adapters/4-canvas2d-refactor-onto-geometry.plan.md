# Plan — Refactor canvas2d-adapter onto the shared geometry layer

> Task: `4-canvas2d-refactor-onto-geometry.md`
> Status: validated against the workspace (paths + exports confirmed)

## Context

Tasks 1–3 moved the renderer-agnostic geometry into
`packages/adapter-kit/`:

- `decomposeDrawing(e, view): ReadonlyArray<DrawPrimitive>` — pure,
  exhaustive over all 63 `DrawingKind`s — exported from
  `@invinite-org/chartlang-adapter-kit` (`src/index.ts:14`).
- `paintPrimitive`, `RenderCtx`, `MockCanvasContext`, `hashCallLog`,
  `RecordedCall` — exported from the `./canvas` sub-path
  (`packages/adapter-kit/src/canvas/index.ts`).
- `Viewport`, `Point2`, `StrokeStyle`, `FillStyle`, `timeToX`,
  `priceToY`, `worldPointToPixel` — exported from the package root
  (`src/index.ts:14-21`).

The `adapter-kit` `package.json` already exposes both `.` and
`./canvas` (`packages/adapter-kit/package.json` exports map), and
`examples/canvas2d-adapter/package.json` already depends on
`@invinite-org/chartlang-adapter-kit` (`workspace:^`). No new dep, no
new export entry.

This task makes canvas2d **consume** that surface for **drawings**
only, and deletes its now-duplicated `src/render/draw/` tree.

## Pre-existing work (verified)

- `decomposeDrawing` signature takes the full `DrawingEmission` (it
  reads `e.drawingKind` + `e.state`) and a `Viewport`
  (`decompose.ts:167`). The adapter passes `mark.drawing` (a
  `DrawingEmission`) + the pane `viewport` — a direct fit.
- `op:"remove"` is dropped by the adapter's `state.drawings` map in
  `applyDrawing` (`createCanvas2dAdapter.ts:812-823`) **before** any
  render, so `collectSortableMarks` only ever yields live drawings;
  `decomposeDrawing` need not (and does not) re-check `op`.
- `paintPrimitive` covers all four IR shapes and resets
  `setLineDash([])`/`globalAlpha=1` after each primitive.

## Issues found (deviations from the task's literal wording)

1. **Drawings no longer render in `renderOverlayTail`.** The task body
   (§1) says to change `renderOverlayTail`'s drawing loop. That is
   **stale**: the Z-order refactor (documented in
   `examples/canvas2d-adapter/CLAUDE.md` "Z-order render pass
   invariants") moved drawings OUT of `renderOverlayTail` into the
   per-pane z-sorted pass. The live drawing dispatch is
   `paintSortableMark`'s `case "drawing"`
   (`createCanvas2dAdapter.ts:651-653`), which calls
   `drawingDispatch(state.ctx, mark.drawing, viewport)`.
   **Resolution:** replace the body of that `case`, not
   `renderOverlayTail`. Same pixels, same pane translate, same z-order
   position — only the dispatch implementation swaps.

2. **The integration `PINNED_HASH` will NOT change.** The pinned test
   (`integration.test.ts:609`) drives an EMA-cross bundle that emits
   **zero drawings** (only plots + alerts). The drawing code path is
   never exercised by the pinned hash; the only drawing tests
   (`forecast-line`, `anchored-line`) assert structural `moveTo`/`lineTo`
   coordinates, not the hash. Per Task 1–3 provenance ("moved, not
   re-derived" + `paintPrimitive` canonicalises call order), the `line`
   geometry is preserved, so even those structural assertions hold.
   **Resolution:** keep the hash; if a re-pin is somehow required after
   running, document it and re-pin. Plan assumes no change and verifies
   by running the package test (the only authority).

3. **`render/index.ts` re-exports many `./draw/index.js` symbols**
   (`render/index.ts:51-68`: `FIB_LEVELS`, `cubicBezier`,
   `drawingDispatch`, `extendLineSegment`, `formatLevel`,
   `quadraticBezier`, `renderCrossLine`, `renderHorizontalLine`,
   `renderHorizontalRay`, `renderLine`, `renderTrendAngle`,
   `renderVerticalLine`, `sampleCubic`, `sampleQuadratic`,
   `worldPointToCanvas`, and `type Point2`). A workspace grep confirms
   the ONLY external consumer of any of them is
   `createCanvas2dAdapter.ts` importing `drawingDispatch`. Once that
   import is removed, the whole `export { … } from "./draw/index.js"`
   block (and the `Point2` type re-export) is dead and can be dropped
   with the directory.

4. **Stale test comment.** `createCanvas2dAdapter.test.ts:1102-1106`
   claims "per-kind renderers are no-op stubs — every dispatch adds
   zero context calls." That has been false since Tasks 5–18 (real
   renderers) and is doubly false now (`decomposeDrawing`+`paintPrimitive`
   emit real calls). The assertions (`ctx.calls.length > baseline`)
   still pass. **Resolution:** update the comment + the test name's
   "through drawingDispatch" wording to "through
   decomposeDrawing+paintPrimitive" so the test reads true.

## Improvements

- Re-pointing `Viewport`/`timeToX`/`priceToY` to adapter-kit removes
  the last parallel copy of the projection primitives; the
  layout-specific bar-shift math (`projectShiftedX`/`shiftedBarTime`/
  `medianBarSpacing`/`yToPrice`) and the adapter-layer render types
  (`PlotPoint`/`HLine`) stay canvas2d-local (not moved by Tasks 1–3).
- Deleting `src/render/draw/` removes ~130 source+test files of
  duplicated geometry, leaving canvas2d's drawing path a 3-line loop.

## Steps (verified paths)

1. **`src/render/coords.ts`** — replace the local definitions of
   `Viewport`, `timeToX`, `priceToY` with a re-export from
   `@invinite-org/chartlang-adapter-kit`, and `import` the same three
   symbols for use by the surviving local helpers
   (`priceToY`/`timeToX` are used by `yToPrice`? no — `yToPrice` is
   standalone; `projectShiftedX` uses `timeToX`). Keep `PlotPoint`,
   `HLine`, `yToPrice`, `medianBarSpacing`, `shiftedBarTime`,
   `projectShiftedX` defined locally. `LineStyle` import stays (used by
   `HLine`).

2. **`src/render/clear.ts`** — re-export `RenderCtx` from
   `@invinite-org/chartlang-adapter-kit/canvas` instead of declaring it
   locally. Keep `clear()` (it imports `RenderCtx` + `Viewport` +
   `Palette`). The adapter-kit `RenderCtx` is structurally identical
   (same method/setter surface — confirmed against `renderCtx.ts`).

3. **`src/render/index.ts`** — delete the
   `export { … } from "./draw/index.js"` block (lines 51-68 incl. the
   `Point2` type re-export). Everything else stays.

4. **`src/createCanvas2dAdapter.ts`**
   - Drop `drawingDispatch` from the `./render/index.js` import.
   - Add `import { decomposeDrawing } from
     "@invinite-org/chartlang-adapter-kit";` (or fold into the existing
     adapter-kit import block) and `import { paintPrimitive } from
     "@invinite-org/chartlang-adapter-kit/canvas";`.
   - In `paintSortableMark`'s `case "drawing"`, replace
     `drawingDispatch(state.ctx, mark.drawing, viewport)` with:
     ```ts
     for (const prim of decomposeDrawing(mark.drawing, viewport)) {
         paintPrimitive(state.ctx, prim);
     }
     ```

5. **`src/testing.ts`** — replace the hand-rolled `MockCanvas2DContext`
   + `RecordedCall` + `hashCallLog` with a re-export from
   `@invinite-org/chartlang-adapter-kit/canvas`:
   ```ts
   export {
       MockCanvasContext as MockCanvas2DContext,
       hashCallLog,
   } from "@invinite-org/chartlang-adapter-kit/canvas";
   export type { RecordedCall } from "@invinite-org/chartlang-adapter-kit/canvas";
   ```
   The `./testing` export-map entry in `package.json` is unchanged; the
   public `MockCanvas2DContext` name is preserved. `testing.test.ts`
   currently walks the local mock's methods — see step 7.

6. **Delete the entire `src/render/draw/` directory** (all renderers,
   `drawingDispatch.ts`, moved geometry helpers
   `worldToCanvas.ts`/`bezier.ts`/`gannLevels.ts`/`pitchforkGeom.ts`/
   `lineExtend.ts`/`arrowhead.ts`/`chevron.ts`/`namedPolyline.ts`/
   `fibLevels.ts`/`shapeStyle.ts`/`textStyle.ts`, the `draw/index.ts`
   barrel, and every co-located `*.test.ts` incl. the two
   `*.property.test.ts`). **`src/render/lineDash.ts` stays** (one level
   up, still imported by `area.ts`/`horizontalLine.ts`).

7. **`src/testing.test.ts`** — it now tests a re-export. The
   `MockCanvasContext` implementation is already covered to 100% in
   adapter-kit (`canvas/mockContext.test.ts`). Reduce this file to a
   thin re-export assertion (the symbol is importable under the legacy
   name + `hashCallLog` is callable), since `testing.ts` is a barrel-
   style re-export with no own logic to cover. (`testing.ts` is NOT in
   the coverage-excluded `index.ts`/`types.ts` set, so it must still
   import clean; a re-export file has no executable lines to cover.)

8. **`src/createCanvas2dAdapter.test.ts`** — update the stale
   no-op-stub comment + the "through drawingDispatch" test name to
   reflect `decomposeDrawing`+`paintPrimitive`. No assertion changes
   (the `> baseline` / `fillRect present` checks still hold).

9. **`examples/canvas2d-adapter/CLAUDE.md`** — record that drawings now
   flow through adapter-kit `decomposeDrawing`+`paintPrimitive`, that
   `src/render/draw/` was deleted, that `RenderCtx` +
   `Viewport`/`timeToX`/`priceToY` are re-exported from adapter-kit, and
   that `testing.ts` re-exports the shared `MockCanvasContext` as
   `MockCanvas2DContext`. Update the Phase-2/Z-order invariants that
   name `drawingDispatch`/`render/draw/fillBetween.ts` to point at the
   shared layer.

10. **`integration.test.ts`** — verify `PINNED_HASH` is unchanged by
    running the test. If it changed, re-pin + extend the existing
    re-pin comment with the geometry-preserving reason. (Expected: no
    change — see Issue 2.)

## Files to create / modify / DELETE

| File | Action |
|------|--------|
| `examples/canvas2d-adapter/src/render/coords.ts` | Modify — re-export `Viewport`/`timeToX`/`priceToY` from adapter-kit; keep local bar-shift helpers + `PlotPoint`/`HLine`/`yToPrice` |
| `examples/canvas2d-adapter/src/render/clear.ts` | Modify — re-export `RenderCtx` from adapter-kit/canvas |
| `examples/canvas2d-adapter/src/render/index.ts` | Modify — drop the `./draw/index.js` re-export block |
| `examples/canvas2d-adapter/src/createCanvas2dAdapter.ts` | Modify — route drawings via `decomposeDrawing`+`paintPrimitive` |
| `examples/canvas2d-adapter/src/testing.ts` | Modify — re-export shared mock as `MockCanvas2DContext` |
| `examples/canvas2d-adapter/src/testing.test.ts` | Modify — thin re-export assertion (impl covered in adapter-kit) |
| `examples/canvas2d-adapter/src/createCanvas2dAdapter.test.ts` | Modify — update stale comment/name |
| `examples/canvas2d-adapter/src/integration.test.ts` | Verify/modify — re-pin hash only if it changed (expected unchanged) |
| `examples/canvas2d-adapter/src/render/draw/**` | DELETE — entire directory (renderers + dispatch + moved helpers + tests) |
| `examples/canvas2d-adapter/CLAUDE.md` | Modify — drawings/geometry/mock now from adapter-kit |

Public surface unchanged: package `default` export, `createCanvas2dAdapter`,
`runRendererLoop`, `./testing` path + `MockCanvas2DContext` name.

## Gates

- `pnpm --filter chartlang-example-canvas2d-adapter typecheck`
- `pnpm --filter chartlang-example-canvas2d-adapter lint` (via biome)
- `pnpm --filter chartlang-example-canvas2d-adapter test` (100% coverage)
- `pnpm conformance` (canvas2d default export still passes) — if the
  team-lead scope allows; otherwise the package test + typecheck are the
  binding gates for this task's diff.

## Changeset

None — `chartlang-example-canvas2d-adapter` is `"private": true` and the
changesets config has no `privatePackages` versioning. Task §Changeset
marks it optional.

## Acceptance checklist

- [ ] Drawings render via `decomposeDrawing`+`paintPrimitive`; `case
      "drawing"` is the only dispatch site.
- [ ] `src/render/draw/` removed entirely; `render/index.ts` no longer
      re-exports it.
- [ ] `coords.ts` re-exports `Viewport`/`timeToX`/`priceToY` from
      adapter-kit; bar-shift helpers stay local.
- [ ] `clear.ts` re-exports `RenderCtx` from adapter-kit/canvas.
- [ ] `testing.ts` re-exports `MockCanvasContext` as
      `MockCanvas2DContext`; `./testing` path + name unchanged.
- [ ] `lineDash.ts` retained.
- [ ] Integration hash verified (re-pinned only if changed, with
      documented reason).
- [ ] 100% coverage on canvas2d; typecheck + lint clean.
- [ ] `CLAUDE.md` updated.
