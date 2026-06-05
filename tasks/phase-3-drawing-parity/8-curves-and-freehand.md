# Task 8 — Curves + Freehand — `arc` / `curve` / `doubleCurve` / `pen` / `highlighter` / `brush`

> **Status: TODO**

## Goal

Port the 3 curve + 3 freehand kinds. Curves consume the Bezier
helpers from Task 4; freehand kinds consume a new
`perfectFreehand` shared helper for stroke smoothing.

## Prerequisites

- Tasks 1–7 (Task 4's `quadraticBezier` / `cubicBezier` /
  `sampleQuadratic` / `sampleCubic` are required for curve
  renderers).

## Kinds Landed

| Kind (kebab) | Kind (camel) | Anchors | State shape | Invinite source | Bucket |
|---|---|---|---|---|---|
| `arc` | `arc` | 3 (from, to, apex) | `from`, `to`, `apex` (control point), `style: LineDrawStyle` | `tools/arc-tool.ts` | `polylines` |
| `curve` | `curve` | 3 (from, to, control) | `from`, `to`, `control: WorldPoint`, `style: LineDrawStyle` | `tools/curve-tool.ts` | `polylines` |
| `double-curve` | `doubleCurve` | 4 (from, to, control1, control2) | `from`, `to`, `control1`, `control2`, `style: LineDrawStyle` | `tools/double-curve-tool.ts` | `polylines` |
| `pen` | `pen` | variable (points[]) | `points: ReadonlyArray<{ time, price, pressure? }>`, `style: LineDrawStyle` | `tools/pen-tool.ts` | `polylines` |
| `highlighter` | `highlighter` | variable (points[]) | `points`, `style: HighlighterStyle` | `tools/highlighter-tool.ts` | `polylines` |
| `brush` | `brush` | variable (points[]) | `points`, `style: BrushStyle` | `tools/brush-tool.ts` | `polylines` |

## Distinct Decisions vs Tasks 5–7

- **Arc vs Curve.** `arc` uses `apex` as the control point for
  a quadratic Bezier shaped to pass through `(from, apex, to)`
  approximately (apex is roughly the midpoint of the arc).
  `curve` uses `control` as a literal quadratic Bezier control
  point (curve does NOT pass through `control`). Both are
  quadratic — `doubleCurve` is the cubic.
- **Freehand pressure field.** `pen` points carry an optional
  `pressure ∈ [0, 1]` per `y-doc-bridge.ts` `WorldCoord`. Phase
  3 keeps the field but the canvas2d renderer ignores it (a
  consumer adapter can vary stroke width by pressure;
  `WorldPoint` type stays unchanged — pressure lives in an
  extension state field).

Actually: rather than widen `WorldPoint`, declare a sibling
`PressurePoint = WorldPoint & { readonly pressure?: number }`
in `packages/core/src/draw/worldPoint.ts` and use it for `pen`
only. `highlighter` and `brush` use plain `WorldPoint[]`.

- **Variable-length anchors for `pen` / `highlighter` /
  `brush`.** Validator pins `2 ≤ points.length ≤ 500` (matches
  invinite's stroke cap). Each `points[i]` validated as
  `PressurePoint` (pen) or `WorldPoint` (highlighter/brush).
- **`HighlighterStyle.alpha ∈ [0, 1]`** validated as a finite
  number in range. `BrushStyle` has both `stroke` and `fill`
  colors.
- **`perfectFreehand` helper.** New
  `examples/canvas2d-adapter/src/render/draw/freehand.ts` — a
  minimal smoothing path generator (NOT the npm package; a
  ~40-line pure helper that fits chartlang's "no third-party
  rendering deps" stance). Consumed by pen / highlighter /
  brush renderers. Property test pins endpoints + monotonic
  ordering.

## Renderer Notes

- `arc` / `curve` — `ctx.beginPath()` + `ctx.moveTo(from)` +
  `ctx.quadraticCurveTo(control, to)`. For `arc`, derive the
  control point from `apex` via inverse-quadratic interpolation
  (helper in `bezier.ts` Task 4 if added; OK to add here in
  `bezier.ts` extension).
- `doubleCurve` — `ctx.bezierCurveTo(c1, c2, to)`.
- `pen` / `highlighter` / `brush` — `ctx.beginPath()` + smoothed
  path via `freehand` helper + `ctx.stroke()` (+ `ctx.fill()` for
  brush). Highlighter additionally sets `ctx.globalAlpha =
  style.alpha` before stroke, restores after.

## Conformance

6 per-kind scenarios + 1 category bundle (`drawCurvesAndFreehand
All.scenario.ts`). Pen/highlighter/brush scenarios use a
hand-curated 4-point stroke at known canvas pixels for
predictable hashing.

## Tests

Per-kind §22.10. Specific:
- `arc.property.test.ts` — at `t = 0` and `t = 1` the rendered
  curve hits `from` / `to` (sample-based test).
- `pen.property.test.ts` — `points.length ∈ [2, 500]`;
  out-of-range fails validation.
- `highlighter.property.test.ts` — `alpha ∈ [0, 1]` enforced.
- `freehand.test.ts` — smoothing helper endpoint preservation +
  monotonic time-ordering.

## Files to Create / Modify

| File | Action |
|------|--------|
| `packages/runtime/src/emit/draw/{arc,curve,doubleCurve,pen,highlighter,brush}.ts` + 5 test files each | Create |
| `packages/runtime/src/emit/draw/index.ts` | Modify (wire 6) |
| `packages/core/src/draw/drawingState.ts` | Modify (refine 6 variants) |
| `packages/core/src/draw/worldPoint.ts` | Modify (add `PressurePoint`) |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Modify (6 validators) |
| `examples/canvas2d-adapter/src/render/draw/{arc,curve,doubleCurve,pen,highlighter,brush}.ts` + tests | Create |
| `examples/canvas2d-adapter/src/render/draw/freehand.ts` + test | Create |
| `examples/canvas2d-adapter/src/render/draw/drawingDispatch.ts` | Modify |
| `packages/conformance/src/scenarios/{drawArc,drawCurve,drawDoubleCurve,drawPen,drawHighlighter,drawBrush,drawCurvesAndFreehandAll}.scenario.ts` | Create |
| `packages/conformance/src/scenarios/index.ts` | Modify |
| `docs/primitives/draw/{arc,curve,double-curve,pen,highlighter,brush}.md` | Create (auto-gen) |
| `.changeset/phase-3-task-8-curves-and-freehand.md` | Create |

## Gates

Standard set.

## Changeset

Minor on runtime, core, adapter-kit, canvas2d, conformance.

## Acceptance Criteria

- 6 kinds emit / validate / decode / render / scenario-pass.
- `PressurePoint` declared in core without breaking
  `WorldPoint` consumers.
- `freehand` helper renders pen / highlighter / brush
  deterministically (golden hash pins).
- 100% coverage maintained.
- Phase-1/-2 + Tasks 1–7 gates green.
- Changeset committed.
