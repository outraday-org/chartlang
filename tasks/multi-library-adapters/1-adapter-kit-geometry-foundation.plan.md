# Plan — Task 1: adapter-kit geometry foundation

Audit artifact for `1-adapter-kit-geometry-foundation.md`. Validated against the
workspace on 2026-06-20.

## Context

Add a renderer-agnostic geometry layer to the **existing** public package
`packages/adapter-kit/`. No new package, no scaffold edit. The layer is the
shared foundation for the four new example adapters (Tasks 5–12) and the
canvas2d refactor (Task 4). This task ships: projection + IR types, the
`_lib` geometry helpers, the `decomposeDrawing` dispatcher covering the 20
**basic** drawing kinds, and the canvas sink (`RenderCtx`, `paintPrimitive`,
`MockCanvasContext`, `hashCallLog`).

## Pre-existing work / validated references

- `examples/canvas2d-adapter/src/render/coords.ts` — `Viewport`, `timeToX`,
  `priceToY` (verified, verbatim source). Also holds `yToPrice`,
  `medianBarSpacing`, `shiftedBarTime`, `projectShiftedX` + `PlotPoint`/`HLine`
  — these STAY in canvas2d (Task 4 §3); only `Viewport`/`timeToX`/`priceToY`
  port.
- `examples/canvas2d-adapter/src/render/clear.ts` — `RenderCtx` structural type
  (verified, full Phase-2/5 surface). `clear()` stays in canvas2d.
- `examples/canvas2d-adapter/src/render/lineDash.ts` — `dashPattern` (verified,
  one level UP from `draw/`, imported by surviving plot renderers → **copy**).
- `examples/canvas2d-adapter/src/render/draw/{bezier,lineExtend,arrowhead,
  chevron,namedPolyline,shapeStyle,textStyle}.ts` — geometry helpers (verified).
- `examples/canvas2d-adapter/src/render/draw/worldToCanvas.ts` —
  `worldPointToCanvas` (verified, composes timeToX/priceToY) → becomes
  `worldPointToPixel` in `project.ts`.
- 20 basic-kind renderers verified present under `draw/`:
  line, horizontalLine, horizontalRay, verticalLine, crossLine, trendAngle,
  rectangle, rotatedRectangle, triangle, polyline, circle, ellipse, path,
  fillBetween, text, arrow, arrowMarker, arrowMarkUp, arrowMarkDown, marker.
- `src/testing.ts` — `MockCanvas2DContext` + `RecordedCall` + `hashCallLog` +
  `canonicalise` (verified) → generalised into `canvas/mockContext.ts` as
  `MockCanvasContext`.
- Core state types (`LineState`, …, `MarkerState`, `TextState`,
  `ArrowState`, …) all exported from `@invinite-org/chartlang-core` (verified at
  `packages/core/src/draw/drawingState.ts`).
- `DrawingEmission`, `DrawingKind`, `DrawingState`, `WorldPoint`, `LineStyle`,
  `ShapeStyle`, `LineDrawStyle`, `TextOpts`, `FillBetweenStyle` all exported
  (verified).
- `adapter-kit/package.json` exports only `"."` today (verified) → add
  `"./canvas"`.
- `vitest.config.ts` excludes `index.ts` + `types.ts` from coverage (verified).
  So `geometry/index.ts`, `canvas/index.ts`, `geometry/types.ts` are excluded;
  everything else needs 100%.
- `scripts/docs-check.ts`: `@formula`/`@anchors` are required ONLY for
  `/src/ta/` or `/src/draw/` paths (verified). `geometry/` + `canvas/` need
  only JSDoc block + `@since` + `@example`-with-code-block. Project convention
  also wants a stability marker — include `@stable`.
- `@example` blocks are compiled ONLY if they contain
  `from "@invinite-org/chartlang-` AND `defineIndicator(`/`defineAlert(`
  (verified `docs-check.executor.ts`). Plain-TS examples (like coords.ts) are
  not compiled — safe.

## Issues found / decisions

1. **`marker` kind paints TEXT only, not a glyph.** The canvas2d `renderMarker`
   issues NO calls when `text` is empty/undefined, and a `fillText` when set —
   it never paints a marker glyph. Task §5 says "marker primitive (+ optional
   text)", but **behaviour-preservation wins**: `decomposeMarker` emits a single
   `text` primitive when `state.text` is set, else `[]`. The IR `marker`
   primitive is exported for adapters/future kinds (Tasks 2–3 / 5–12) but no
   basic kind emits it. Documented in CLAUDE.md.

2. **`paintPrimitive` ordering vs. legacy renderers.** Legacy renderers differ
   in property-set ORDER (e.g. `fill-between` sets `setLineDash` before stroke
   props; `applyShapeStyle` sets stroke props before dash). Pixels depend on the
   final path + styles, NOT set order. Task 4 re-pins all hashes, so I adopt ONE
   canonical per-IR-kind ordering in `paintPrimitive`. Pixel geometry is
   preserved exactly; the call SEQUENCE is canonicalised. Documented in CLAUDE.md.

3. **`trend-angle` decomposes to THREE primitives** (polyline segment + arc +
   text), proving the IR composes multi-shape drawings. Verified the arc maps
   to the IR `arc` (start=`-angleRad`, end=`0`) and the text to an IR `text`.
   The legacy renderer's angle text uses `font "12px sans-serif"`, no explicit
   align/baseline (canvas defaults `start`/`alphabetic`). The IR `text`
   primitive REQUIRES `align`+`baseline` — I pin `align:"left"`,
   `baseline:"alphabetic"`? IR only allows top|middle|bottom. Decision: pin
   `align:"left"`, `baseline:"middle"` for the angle label — this is a pixel
   CHANGE vs legacy baseline (`alphabetic`). Acceptable: Task 4 re-pins, and
   trend-angle is not in the canvas2d integration golden (EMA-cross). Documented.

4. **IR `text` has no align/baseline `alphabetic`/`start`.** The legacy
   `arrow`/`arrowMarker` labels use `textBaseline "bottom"`/`"middle"` and
   `textAlign "center"`/`"left"` — all expressible. `text`/`marker` drawings use
   `resolveTextOpts` → already top|middle|bottom + left|center|right. Good.

5. **No provenance header needed for moved files** — these are MOVED from
   canvas2d (which already carry their own invinite-provenance headers where the
   math originated). Per task: "moved, not re-derived". I keep the existing
   provenance headers verbatim on the moved `_lib` files (they already cite the
   invinite source + commit), and the standard 2-line MIT header on the new
   pure files (types/project/decompose/kinds/canvas).

6. **`renderCtx.ts` is type-only** — no runtime, so no coverage rows. Named
   `renderCtx.ts` per task (not `types.ts`); v8 reports nothing to cover.

## Steps

1. `geometry/types.ts` — `Point2`, `Viewport`, `StrokeStyle`, `FillStyle`,
   `DrawPrimitive` (4-kind union). Excluded from coverage.
2. `geometry/project.ts` (+test) — `timeToX`, `priceToY`, `worldPointToPixel`.
3. `geometry/_lib/dash.ts` (+test) — `dashPattern` (COPY).
4. `geometry/_lib/bezier.ts` (+test) — `quadraticBezier`, `cubicBezier`,
   `sampleQuadratic`, `sampleCubic`, re-using IR `Point2`.
5. `geometry/_lib/lineExtend.ts` (+test) — `extendLineSegment`.
6. `geometry/_lib/arrowhead.ts` (+test) — `arrowheadPolygon(from, to, size?)`
   → `ReadonlyArray<Point2>` (3 pts: tip, left, right). Pure (no ctx).
7. `geometry/_lib/chevron.ts` (+test) — `chevronPolygon(at, dir, base?, h?)`
   → `ReadonlyArray<Point2>` (tip, baseLeft, baseRight). Pure.
8. `geometry/_lib/shapeStyle.ts` (+test) — `resolveShapeStyle(style)` →
   `{ stroke: StrokeStyle; fill?: FillStyle }`. Pure resolver mapping
   `ShapeStyle` to IR styles (default stroke `#000000`/1/solid; fill present
   iff `style.fill` set).
9. `geometry/_lib/textStyle.ts` (+test) — `resolveTextOpts` + `SIZE_TO_PX` +
   `HALIGN_TO_TEXTALIGN` + `VALIGN_TO_TEXTBASELINE` + `ResolvedTextOpts`
   (font/align/baseline/color → IR text fields). Pure (no ctx).
10. `geometry/_lib/namedPolyline.ts` (+test) — `namedPolylinePrimitives(points,
    labels, style)` → `DrawPrimitive[]` (one open polyline + per-vertex text).
11. `geometry/kinds/lines.ts` (+test) — 6 decomposers.
12. `geometry/kinds/boxes.ts` (+test) — 8 decomposers (incl. `fill-between`).
13. `geometry/kinds/annotations.ts` (+test) — 5 decomposers.
14. `geometry/kinds/marker.ts` (+test) — 1 decomposer (text-only).
15. `geometry/decompose.ts` (+test) — dispatcher: 20 basic arms + widening
    `default` returning `[]` (NOT `satisfies never` — Task 3 closes it).
16. `geometry/index.ts` — barrel (projection, IR types, decomposeDrawing).
17. `canvas/renderCtx.ts` — `RenderCtx` structural type (type-only).
18. `canvas/paintPrimitive.ts` (+test) — `paintPrimitive(ctx, p)` over 4 IR
    kinds.
19. `canvas/mockContext.ts` (+test) — `MockCanvasContext`, `RecordedCall`,
    `hashCallLog`, `canonicalise`.
20. `canvas/index.ts` — barrel (RenderCtx, paintPrimitive, MockCanvasContext,
    hashCallLog).
21. `src/index.ts` — add geometry re-exports.
22. `package.json` — add `./canvas` export.
23. `packages/adapter-kit/CLAUDE.md` — create, document invariants.
24. `.changeset/adapter-kit-geometry-foundation.md` — minor.

## Files to create / modify

| File | Action |
|------|--------|
| `packages/adapter-kit/src/geometry/types.ts` | Create |
| `packages/adapter-kit/src/geometry/project.ts` (+test) | Create |
| `packages/adapter-kit/src/geometry/decompose.ts` (+test) | Create |
| `packages/adapter-kit/src/geometry/kinds/{lines,boxes,annotations,marker}.ts` (+tests) | Create |
| `packages/adapter-kit/src/geometry/_lib/{bezier,lineExtend,arrowhead,chevron,namedPolyline,shapeStyle,textStyle,dash}.ts` (+tests) | Create |
| `packages/adapter-kit/src/geometry/index.ts` | Create |
| `packages/adapter-kit/src/canvas/{renderCtx,paintPrimitive,mockContext,index}.ts` (+tests) | Create |
| `packages/adapter-kit/src/index.ts` | Modify |
| `packages/adapter-kit/package.json` | Modify |
| `packages/adapter-kit/CLAUDE.md` | Create |
| `.changeset/adapter-kit-geometry-foundation.md` | Create |

## Gates

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (adapter-kit 100% cov),
  `pnpm docs:check`, `pnpm readme:check` (README ≤ 100 lines).
- canvas2d UNTOUCHED.

## Changeset

`.changeset/adapter-kit-geometry-foundation.md` — **minor** bump for
`@invinite-org/chartlang-adapter-kit`.

## Acceptance criteria

- [x] `decomposeDrawing` covers 20 basic kinds; remaining 43 → `[]` default.
- [x] `paintPrimitive` + `MockCanvasContext` + `hashCallLog` exported via
      `./canvas`; deterministic hashing verified.
- [x] 100% coverage (694 tests); docs:check (0 violations) + readme:check
      (80 lines) green; biome lint + format clean.
- [x] `adapter-kit/CLAUDE.md` created.
- [x] Changeset (minor) added.
- [x] canvas2d untouched.

## Deviations from the task

1. **`hashCallLog(calls)` not `hashCallLog(mock)`.** Kept the established
   array signature (`ReadonlyArray<RecordedCall>`) so canvas2d's Task-4
   re-export is drop-in (every existing call site passes `mock.calls`).
2. **`marker` kind → text primitive only** (behaviour-preserving; the source
   `renderMarker` paints text, never a glyph). The IR `marker` primitive is
   still exported + painted by `paintPrimitive` for adapters / future kinds.
3. **`paintPrimitive` canonicalises call ORDER** (one ordering per IR kind);
   pixels preserved, sequence canonicalised. Task 4 re-pins hashes.
4. **`@types/node` added to adapter-kit devDependencies** — `hashCallLog`
   uses `node:crypto` (same pattern as canvas2d `testing.ts`). Orchestrator's
   install materialises it; typecheck verified clean with it symlinked.
5. **`./canvas` hand-added to `package.json#exports`** (per task §7); did NOT
   edit `scripts/scaffold.ts` (per instruction #9). The scaffold never
   overwrites existing files, so the edit survives `pnpm scaffold`. A future
   full regeneration would need `./canvas` in `SUBPATH_EXPORTS` — noted in
   `packages/adapter-kit/CLAUDE.md`.

## Out-of-scope changes observed (NOT mine)

`scripts/scaffold.ts` and four `examples/{echarts,konva,lightweight-charts,
uplot}-adapter/` dirs are modified/created by concurrent sibling tasks
(5/7/9/11), not Task 1. Left untouched.
