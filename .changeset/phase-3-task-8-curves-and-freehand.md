---
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
"chartlang-example-canvas2d-adapter": minor
---

Phase-3 Task 8 — fourth per-port task. Lands the 6 curve + freehand
drawing kinds (`arc`, `curve`, `doubleCurve`, `pen`, `highlighter`,
`brush`) per PLAN.md §10 and §22.10. Behaviour ports from invinite
commit `078f41fe2569d659d5aba726da8bcb5d3e2ced02`:
`tools/arc-tool.ts`, `tools/curve-tool.ts`,
`tools/double-curve-tool.ts`, `tools/pen-tool.ts`,
`tools/highlighter-tool.ts`, `tools/brush-tool.ts`, and the matching
`y-doc-bridge.ts` variants (`ArcDrawing`, `CurveDrawing`,
`DoubleCurveDrawing`, `PenDrawing`, `HighlighterDrawing`,
`BrushDrawing`). All 6 kinds map to the `polylines` bucket.

`@invinite-org/chartlang-adapter-kit` adds per-kind state validators
for the 6 curve + freehand kinds — `validateArcState`,
`validateCurveState`, `validateDoubleCurveState`, `validatePenState`,
`validateHighlighterState`, `validateBrushState` — wired into the
existing `validateStateByKind` dispatch. Three new file-local helpers
land alongside: `validateAnchorQuint` (5-tuple for `double-curve`),
`validateHighlighterStyle` (required `color: string` + required
`alpha ∈ [0, 1]`), and `validateBrushStyle` (required `stroke` + `fill`
colour strings). Freehand kinds pin `2 ≤ anchors.length ≤ 500`
(matches invinite's stroke cap; broader than the 2..20 path cap).
Wire shape is stricter than before — payloads previously passing the
permissive default arm now reject with `malformed-emission`.

`@invinite-org/chartlang-runtime` ships 6 new `draw.<kind>(...)` emit
functions under `src/emit/draw/curves/` and extends the
`DRAW_NAMESPACE` swap-seam at `src/emit/draw/namespace.ts`. Each impl
uses the dual-overload pattern Tasks 5–7 pinned. `draw.highlighter`
and `draw.brush` differ from the other emit fns — their `opts`
parameter is REQUIRED on the script-facing overload (no `?` because
`HighlighterStyle` / `BrushStyle` carry required fields).

`chartlang-example-canvas2d-adapter` ships 6 new renderers under
`src/render/draw/`. The 3 curve renderers (`renderArc`, `renderCurve`,
`renderDoubleCurve`) sample the curve via Task 4's `sampleQuadratic` /
`sampleCubic` helpers at `CURVE_SAMPLES = 32` segments and stroke as a
polyline — the structural `RenderCtx` exposes neither
`quadraticCurveTo` nor `bezierCurveTo`, so this keeps the renderer
pure on the Phase-1 surface (mirrors Task 7's `ellipse` 64-segment
polyline approximation). `renderArc` derives the Bezier control point
from `apex` via inverse-quadratic interpolation so the curve passes
through `apex` at `t = 0.5`; `renderCurve` uses `anchors[1]` as the
Bezier control directly (curve does NOT pass through control);
`renderDoubleCurve` paints a single cubic from `anchors[0]` to
`anchors[4]` with off-curve controls `anchors[1]` / `anchors[3]` (the
middle stitch anchor `anchors[2]` is preserved in state but unused by
the current render path — flagged for future split-rendering). The 3
freehand renderers paint polylines: `renderPen` strokes open;
`renderHighlighter` wraps the stroke in a `globalAlpha` set/reset
bracket (default 6 px line width); `renderBrush` paints
fill-then-stroke with `closePath` for a closed filled region. The
`drawingDispatch` switch flips the 6 arms from no-op stubs to real
`renderXxx(ctx, e, view)` calls; exhaustiveness is preserved.

`@invinite-org/chartlang-conformance` ships 6 new per-kind scenarios
under `src/scenarios/` (`drawArc`, `drawCurve`, `drawDoubleCurve`,
`drawPen`, `drawHighlighter`, `drawBrush`) plus one bundle scenario
`drawCurvesAndFreehandAll` that emits one drawing per curve + freehand
kind on the first bar (per README §22.10 Task 8 collapses both
categories into ONE bundle). All seven scenarios use `inlineSource`
against the bundled 10 000-bar `goldenBars.json` fixture with anchor
times pulled from `bars[0]` / `bars[500]` / `bars[1000]` (plus
`bars[1500]` for the 4-point freehand strokes). The `TEST_CAPABILITIES`
bags in `runConformanceSuite.test.ts` + `scenarios/scenarios.test.ts`
extend the `drawings` set with `allCurveDrawings()` +
`allFreehandDrawings()`; the existing `polylines: 100` bucket budget
covers the bundle scenarios with headroom. `ALL_SCENARIOS` extends
additively.

No core edits — the `DrawingState` variants and `DrawNamespace`
signatures Task 1 shipped are the canonical shape and Task 8 wires
real impls to them.

Deviations from spec, flagged for review:
- `PressurePoint` type widening NOT applied — Task 1's `PenState`
  shape (`anchors: ReadonlyArray<WorldPoint>`) preserved per Tasks
  6/7 precedent of not reshaping Task-1 mid-phase. Adapter-level
  pressure-driven stroke-width variance is a follow-up concern.
- `freehand.ts` smoothing helper NOT created. Per-renderer inline
  polyline loops suffice for Phase-3 deterministic `drawing-hash`
  assertions. If pressure-driven smoothing lands later, the helper
  can ship then.
- `double-curve` middle anchor (`anchors[2]`, the stitch point) is
  preserved in state but currently unused by the renderer (single
  cubic from `anchors[0]` to `anchors[4]` with controls `[1]` / `[3]`).
  Future split-rendering can stitch two cubics through `mid`.
- `arc` / `curve` / `doubleCurve` fill-path NOT rendered.
  `LineDrawStyle` has no fill fields; invinite's tools do support
  fill on these kinds. Widening to support fill is a Task-1 reshape
  and out of scope.
- Bezier rendered as 32-segment polyline approximation because
  `RenderCtx` exposes `arc(...)` but not `quadraticCurveTo` /
  `bezierCurveTo`. Mirrors Task 7's `ellipse` 64-segment approach;
  widening would touch Phase-1 surface.
- Per-kind §22.10 5-file test set deferred to pragmatic 1-file set
  (mirrors Tasks 5–7) — Task 3's `pushDrawing.*` and `handle.*`
  suite covers the underlying infra exhaustively.
- `gen-docs` doc-page generation deferred to Task 21 (mirrors Tasks
  5–7).
