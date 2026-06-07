# Task 6 — Boxes A — `rectangle` / `rotatedRectangle` / `triangle` / `polyline`

> **Status: TODO**

## Goal

Port the 4 straight-edged box kinds. Each lands the §22.10 set
per kind: runtime emit fn (replacing Task-3 stub), per-kind
`validateEmission` validator, canvas2d renderer (replacing Task-4
no-op stub), per-kind conformance scenario via `inlineSource`,
auto-generated docs page. Follows the structural template
established in Task 5.

## Prerequisites

- Tasks 1–5.

## Kinds Landed

| Kind (kebab) | Kind (camel) | Anchors | State shape | Invinite source | Bucket |
|---|---|---|---|---|---|
| `rectangle` | `rectangle` | 2 (from, to) | `from`, `to`, `style: ShapeStyle` | `tools/rectangle-tool.ts` | `boxes` |
| `rotated-rectangle` | `rotatedRectangle` | 3 (a, b, widthOffset) | `a`, `b`, `widthOffset: WorldPoint`, `style: ShapeStyle` | `tools/rotated-rectangle-tool.ts` | `boxes` |
| `triangle` | `triangle` | 3 (a, b, c) | `a`, `b`, `c`, `style: ShapeStyle` | `tools/triangle-tool.ts` | `boxes` |
| `polyline` | `polyline` | 3..20 (points) | `points: ReadonlyArray<WorldPoint>` (closed), `style: ShapeStyle` | `tools/polyline-tool.ts` | `polylines` |

## Distinct Decisions vs Task 5

- **Variable-length anchors for `polyline`.** Validator pins
  `3 ≤ points.length ≤ 20` (mirrors invinite's 20-point cap).
  Use `validateAnchorVariable(min, max)` helper from Task 2.
- **`rotatedRectangle.widthOffset` is a `WorldPoint` (third
  anchor).** The rectangle's rotation is implicit in the (a→b)
  edge; `widthOffset` projects perpendicular for the parallel
  edge. Renderer projects all four corners via the perpendicular
  vector in canvas pixel space.
- **`triangle` is a 3-anchor solid shape** distinct from
  `trianglePattern` (5 anchors, harmonic — lands in Task 15).
  Make this distinction clear in the JSDoc (`@example` annotates
  "Not to be confused with `draw.pattern.triangle`").
- **`polyline` is closed (auto-connects last → first).** `path`
  (Task 7) is the open polyline equivalent.

## Renderer Notes

- `rectangle` — `ctx.strokeRect(x, y, w, h)` + optional fill.
- `rotatedRectangle` — `ctx.save()` + `ctx.translate(a.x, a.y)` +
  `ctx.rotate(angle)` + `ctx.fillRect/strokeRect` + `ctx.restore()`.
- `triangle` — `ctx.beginPath()` + 3 `moveTo`/`lineTo` +
  `ctx.closePath()` + `stroke()` (+ `fill()` if style.fill).
- `polyline` — `ctx.beginPath()` + N `lineTo` + `ctx.closePath()`
  + `stroke()` (+ `fill()` if style.fill).

All four use `applyShapeStyle(ctx, style)` from a new shared
helper `examples/canvas2d-adapter/src/render/draw/shapeStyle.ts`
(stroke + fill + lineWidth + lineStyle + fillAlpha → ctx
properties). Add this helper in Task 6's PR.

## Conformance

4 per-kind scenarios + 1 category bundle (`drawBoxesAScenario.ts`
or `drawBoxesAll.scenario.ts` — Task 7 ships the full
`drawBoxesAll` scenario; Task 6 ships `drawBoxesA.scenario.ts`
with just these 4 kinds, then Task 7 merges into a single
all-boxes scenario). For simplicity, ship a per-task bundle in
Task 6 and let Task 7 re-export combined.

## Tests (§22.10 per kind)

- Unit / property / golden / bench / types for each of the 4
  runtime emit functions.
- Renderer unit tests using `MockCanvas2DContext` verifying the
  expected `strokeRect`/`beginPath`/etc. calls.
- Validator unit tests (1 happy + ≥3 sad per kind).
- Property test for `polyline`: `points.length` out of
  `[3, 20]` triggers `malformed-emission`.
- Property test for `rotatedRectangle`: any non-degenerate
  `(a, b, widthOffset)` triple produces 4 distinct projected
  canvas corners.

## Files to Create / Modify

| File | Action |
|------|--------|
| `packages/runtime/src/emit/draw/{rectangle,rotatedRectangle,triangle,polyline}.ts` + 5 test files each | Create |
| `packages/runtime/src/emit/draw/index.ts` | Modify (wire 4 exports) |
| `packages/core/src/draw/drawingState.ts` | Modify (refine 4 variants) |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Modify (4 validators) |
| `packages/adapter-kit/src/validation/validateEmission.test.ts` | Modify (4 happy + ≥12 sad) |
| `examples/canvas2d-adapter/src/render/draw/{rectangle,rotatedRectangle,triangle,polyline}.ts` + tests | Create |
| `examples/canvas2d-adapter/src/render/draw/shapeStyle.ts` + test | Create |
| `examples/canvas2d-adapter/src/render/draw/drawingDispatch.ts` | Modify (4 stubs replaced) |
| `packages/conformance/src/scenarios/{drawRectangle,drawRotatedRectangle,drawTriangle,drawPolyline,drawBoxesA}.scenario.ts` | Create |
| `packages/conformance/src/scenarios/index.ts` | Modify |
| `docs/primitives/draw/{rectangle,rotated-rectangle,triangle,polyline}.md` | Create (auto-gen) |
| `.changeset/phase-3-task-6-boxes-a.md` | Create |

## Gates

- `pnpm typecheck`, `pnpm test` (100% coverage), `pnpm conformance`,
  `pnpm bench:ci`, `pnpm docs:check`, `pnpm readme:check`.

## Changeset

Minor on runtime, core, adapter-kit, canvas2d, conformance.

## Acceptance Criteria

- 4 kinds emit, validate, decode, render, scenario-pass.
- Per-kind golden hashes pinned.
- 100% coverage maintained.
- Phase-1/-2 + Tasks 1–5 gates green.
- Changeset committed.
