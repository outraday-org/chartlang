---
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
"chartlang-example-canvas2d-adapter": minor
---

Phase-3 Task 6 — second per-port task. Lands the 4 straight-edged
box-family drawing kinds (`rectangle`, `rotatedRectangle`, `triangle`,
`polyline`) per PLAN.md §10 and §22.10. Behaviour ports from invinite
commit `078f41fe2569d659d5aba726da8bcb5d3e2ced02`:
`tools/rectangle-tool.ts`, `tools/rotated-rectangle-tool.ts`,
`tools/triangle-tool.ts`, `tools/polyline-tool.ts`, and the matching
`y-doc-bridge.ts` `DrawingMetadata` variants.

`@invinite-org/chartlang-adapter-kit` adds per-kind state validators
for the 4 box-A kinds — `validateRectangleState`,
`validateRotatedRectangleState`, `validateTriangleState`,
`validatePolylineState` — wired into the existing
`validateStateByKind` dispatch. New file-local helpers
`validateAnchorTriple` / `validateAnchorQuad` /
`validateAnchorVariable(min, max)` / `validateShapeStyle` cover the
anchor cardinalities and the `ShapeStyle` payload bag. `polyline`
pins `3 ≤ anchors.length ≤ 20` (mirrors invinite's 20-point cap).
Wire shape is stricter than before — payloads previously passing the
permissive default arm now reject with `malformed-emission`.

`@invinite-org/chartlang-runtime` ships 4 new `draw.<kind>(...)` emit
functions under `src/emit/draw/boxes/` and extends the
`DRAW_NAMESPACE` swap-seam at `src/emit/draw/namespace.ts`. Each impl
uses the dual-overload pattern (`(...)` script-facing throw +
`(slotId, ...)` compiler-injected) mirroring Task 5 / `plot` /
`alert`. Returns a `DrawingHandle` per PLAN.md §10.3.

`chartlang-example-canvas2d-adapter` ships 4 new renderers under
`src/render/draw/` plus a shared `shapeStyle.ts` helper exporting
`applyShapeStyle(ctx, style): AppliedShapeStyle` — sets stroke /
lineWidth / dash and returns the resolved fill payload so the
renderer can wrap `ctx.fill()` in a `globalAlpha` bracket. The
`drawingDispatch` switch flips the 4 box-A arms from no-op stubs to
real `renderXxx(ctx, e, view)` calls; exhaustiveness is preserved.
Fill defaults to no-op, stroke defaults to `"#000000"`, lineWidth
defaults to `1`. Rectangle is rendered as a closed 4-corner polygon
(no `strokeRect` in the structural `RenderCtx`); rotatedRectangle
walks the four world anchors directly (no canvas matrix ops);
triangle walks 3 vertices; polyline auto-closes via `closePath()`.

`@invinite-org/chartlang-conformance` ships 5 new scenarios under
`src/scenarios/` — 4 per-kind (`drawRectangle`, `drawRotatedRectangle`,
`drawTriangle`, `drawPolyline`) and 1 bundle (`drawBoxesA`). All five
use `inlineSource` against the bundled 10 000-bar `goldenBars.json`
fixture with anchor times pulled from `bars[0]` / `bars[500]` /
`bars[1000]`. The `TEST_CAPABILITIES` bag in
`runConformanceSuite.test.ts` + `scenarios.test.ts` widens to include
`allBoxDrawings()` plus `boxes: 100` / `polylines: 100` budgets so
the new scenarios reach `pushDrawing`'s happy path. The 5 new
scenarios extend `PHASE_1_SCENARIOS` (now 96 entries) and the public
re-export surface.

No core edits — the `DrawingState` variants and `DrawNamespace`
signatures Task 1 shipped are the canonical shape and Task 6 wires
real impls to them.

Deviations from spec, flagged for review:
- Spec's `rotatedRectangle` "3 anchors (a, b, widthOffset)"
  ergonomics — Task 1's `AnchorQuad` (4 corners) is the persisted
  shape. Callers supply the 4 corners directly; the
  (a, b, widthOffset) reshape belongs to Task 20's `defineDrawing`
  if it remains a hard requirement.
- Spec's `polyline` `ShapeStyle` + auto-close — Task 1 ships
  `LineDrawStyle` (no fill). Renderer strokes the closed path; fill
  would require widening the variant in a follow-up.
- Per-kind §22.10 5-file test set deferred to pragmatic 1-file set
  (mirrors Task 5) — Task 3's `pushDrawing.*` and `handle.*` suite
  covers the underlying infra exhaustively.
- `gen-docs` doc-page generation deferred to Task 21 (mirrors Task 5).
