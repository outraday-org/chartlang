# Line-strip program (line / area-edge / step plots)

> **Status: TODO**

## Goal

Port invinite's `line-strip-program.ts` + `line-strip-pack.ts` and wire
them so plot series (`line`, `step-line`, area edges) render as
miter-joined, anti-aliased, configurable-width polylines with dash + NaN
support — the smooth indicator line that motivated this whole effort.

Plain `line` plots additionally render as a **monotone-cubic curve by
default** (parity: the other five adapters now smooth `line` plots — canvas2d
via `monotoneCubicSegments`, konva `tension`, echarts `smooth`, uPlot
`paths.spline()`, lightweight-charts `lineType: Curved`). WebGL has no native
curve, so it **samples** the shared monotone-cubic spline into denser
line-strip points before packing — keeping `step-line` and area edges straight.
Skipping this leaves WebGL the lone faceted adapter.

## Prerequisites

Task 5 (Renderer + descriptors). Complements Task 6 (candles).

## Desired Behavior

`line`/`step-line` plot series render as thick miter-joined AA line
strips honoring the emission's `lineWidth`, with dashed-stroke support,
NaN gaps (warmup) collapsing cleanly, and `xShift` offsets applied.

## Requirements

1. **`src/webgl/programs/line-strip-pack.ts`** — port the pure packer:
   N world points → the instance buffer (`aSide`, `aPrev`, `aCurrent`,
   `aNext`, `aFurther`, arclength start/end per segment). **Pure →
   unit-test**: 2-point line, N-point, NaN-gap segments (degenerate →
   zero-area), arclength continuity across gaps (so dashes don't go
   solid), `xShift` applied via `projectShiftedX`/`medianBarSpacing`
   (reuse the shared helpers). step-line variant inserts the stair points.

2. **`src/webgl/programs/line-strip-program.ts`** — port: shared VAO +
   shared scratch instance buffer (every line descriptor uploads its own
   bytes), vertex shader computing miter direction from neighbor segment
   normals (scale `1/dot(miter,normal)`; fall back to segment normal when
   a neighbor is NaN/coincident via `nan-skip`), `uHalfWidthPx` (CSS-px,
   DPR-scaled in-shader via `uPxToWorldX/Y`), `vArclength` (highp) for
   dashes, fragment dash via `mod(vArclength, period)`; uniforms `uProj`,
   `uPxToWorldX/Y`, `uHalfWidthPx`, `uColor`(vec4), `uDashOnPx`,
   `uDashOffPx`; `drawArrays(TRIANGLE_STRIP, ...)`. Provenance.

3. **Line width + color** — honor the descriptor's `lineWidth` (the
   compiler default is 1; thin like TradingView, smoothness from GPU MSAA
   + miter joins) and color (per-series `color` ?? palette default).
   Map `lineStyle` (`solid`/`dashed`/`dotted`) → dash on/off px.

   **Line-family `colorValue` (parity, wire-honest)** — when a slot
   carries per-bar `colorValue` (the 3-state contract from
   `tasks/adapter-feature-parity` Task 3: omitted ⇒ static, present ⇒
   override, `null` ⇒ gap), split the polyline into consecutive
   same-color **runs** and emit one line-strip descriptor per run, with a
   `null` run opening a NaN gap (no segment). Mirror the per-color-run
   approach feature-parity adopted; the run-splitter is **pure →
   unit-test** (uniform color = one run, alternating = N runs, `null` =
   gap). No script emits line-family `colorValue` today, so this is
   wire-honesty (a synthetic emission paints), not a conformance path.

4. **Area / step** — render area as its boundary line via this program
   for now (filled area body is the `filled-band` program, Task 11 — note
   the deferral in CLAUDE.md); `step-line` uses the stair packer variant.

5. **Renderer dispatch** — add the `line-strip` arm to `dispatchLayer`,
   resolving from `program-cache` (one shared program instance reused
   across all line descriptors).

6. **Default line smoothing (parity)** — for a plain `line` style, densify
   the world points through a monotone-cubic spline (Fritsch–Carlson, passes
   through every point, no overshoot) BEFORE the packer, so the line-strip
   draws a smooth curve. **Reuse the shared helper, do not fork**: promote
   canvas2d's `render/monotoneSpline.ts` (`monotoneCubicSegments`) into
   `packages/adapter-kit` as a pure curve-sampler (returns sampled world
   points) and import it here — same "never fork the shared layer" rule as the
   geometry/interaction layers. `step-line` and area edges stay straight (no
   sampling). Sampling cadence: a few points per gap is enough for visual
   smoothness; keep it pure + unit-tested. NaN gaps still split runs (sample
   each contiguous run independently); `xShift` applies to the source points
   before sampling.

   The promoted `monotoneCubicSegments` is a **new public adapter-kit
   export** (adapter-kit is docs-gated): carry `@since 1.7` + `@stable` +
   `@example` JSDoc on it (and on any exported helper type — reuse the
   shared `Point2` rather than re-declaring a parallel `Point`), and export
   it from BOTH the `packages/adapter-kit/src/geometry/index.ts` barrel and
   the root `packages/adapter-kit/src/index.ts` barrel (webgl and canvas2d
   import it via the package root `@invinite-org/chartlang-adapter-kit`).
   canvas2d's `render/monotoneSpline.ts` becomes a bare
   `export { monotoneCubicSegments } from "@invinite-org/chartlang-adapter-kit"`
   re-export — the SAME promotion precedent as `render/coords.ts` (shift
   helpers) and `render/renderOrder.ts` (z-order comparator), which pass
   `docs:check` without re-stating JSDoc on the bare re-export.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/webgl-adapter/src/webgl/programs/line-strip-pack.ts` | Create | Pure polyline packer |
| `examples/webgl-adapter/src/webgl/programs/line-strip-program.ts` | Create | Miter/AA/dash line program |
| `examples/webgl-adapter/src/webgl/Renderer.ts` | Modify | Dispatch `line-strip` |
| `examples/webgl-adapter/src/webgl/programs/line-strip-pack.test.ts` | Create | Packer unit tests |
| `packages/adapter-kit/src/geometry/monotoneSpline.ts` (+ test) | Create | Promote canvas2d's `monotoneCubicSegments` to a shared pure curve-sampler (JSDoc `@since 1.7`/`@stable`/`@example`) |
| `packages/adapter-kit/src/geometry/index.ts` | Modify | Export `monotoneCubicSegments` (+ `BezierSegment`) from the geometry barrel |
| `packages/adapter-kit/src/index.ts` | Modify | Re-export `monotoneCubicSegments` on the root barrel |
| `examples/canvas2d-adapter/src/render/monotoneSpline.ts` | Modify | Bare re-export from adapter-kit (drop the local copy) |

## Gates

- `pnpm typecheck` · `pnpm lint` · `pnpm format:check` · `pnpm test`
- `pnpm docs:check` — the promoted adapter-kit export must carry `@since` +
  `@example` + a stability marker (docs:check covers `packages/*` +
  `examples/canvas2d-adapter/src`)
- `pnpm conformance` (unchanged)

## Changeset

`@invinite-org/chartlang-adapter-kit` (minor) — promotes `monotoneCubicSegments`
to a shared public curve-sampler. (The webgl example adapter itself is private,
no changeset.)

## Acceptance Criteria

- Line-strip packer is pure + unit-tested (2/N-point, NaN gaps, arclength
  continuity, xShift, step variant).
- Program ported with provenance: miter joins, `lineWidth`, dashes, NaN
  skip, shared scratch buffer.
- Renderer dispatches `line-strip`; build/typecheck/lint green.
- Plain `line` plots render as a smooth monotone-cubic curve (sampled into
  line-strip points); `step-line` / area edges stay straight. The spline
  sampler lives in adapter-kit (shared, pure, unit-tested), exported from
  the geometry + root barrels with `@since`/`@stable`/`@example`
  (`docs:check` green) — canvas2d imports it too via a bare re-export (no
  fork). Visually matches the smooth lines the other five adapters now
  render by default.
