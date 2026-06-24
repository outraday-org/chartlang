# Line-strip program (line / area-edge / step plots)

> **Status: TODO**

## Goal

Port invinite's `line-strip-program.ts` + `line-strip-pack.ts` and wire
them so plot series (`line`, `step-line`, area edges) render as
miter-joined, anti-aliased, configurable-width polylines with dash + NaN
support — the smooth indicator line that motivated this whole effort.

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

4. **Area / step** — render area as its boundary line via this program
   for now (filled area body is the `filled-band` program, Task 11 — note
   the deferral in CLAUDE.md); `step-line` uses the stair packer variant.

5. **Renderer dispatch** — add the `line-strip` arm to `dispatchLayer`,
   resolving from `program-cache` (one shared program instance reused
   across all line descriptors).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/webgl-adapter/src/webgl/programs/line-strip-pack.ts` | Create | Pure polyline packer |
| `examples/webgl-adapter/src/webgl/programs/line-strip-program.ts` | Create | Miter/AA/dash line program |
| `examples/webgl-adapter/src/webgl/Renderer.ts` | Modify | Dispatch `line-strip` |
| `examples/webgl-adapter/src/webgl/programs/line-strip-pack.test.ts` | Create | Packer unit tests |

## Gates

- `pnpm typecheck` · `pnpm lint` · `pnpm format:check` · `pnpm test`
- `pnpm conformance` (unchanged)

## Changeset

None.

## Acceptance Criteria

- Line-strip packer is pure + unit-tested (2/N-point, NaN gaps, arclength
  continuity, xShift, step variant).
- Program ported with provenance: miter joins, `lineWidth`, dashes, NaN
  skip, shared scratch buffer.
- Renderer dispatches `line-strip`; build/typecheck/lint green.
