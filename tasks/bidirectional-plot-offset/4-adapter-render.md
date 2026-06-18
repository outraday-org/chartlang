# Task 4 — Reference adapter: render the x-shift both directions

> **Status: TODO**

## Goal

Render `PlotEmission.xShift` in the canvas2d reference adapter: a plotted
series is drawn shifted `xShift` bars along the x-axis (right for `+`,
left for `−`). This is what actually makes a negative offset visible.

## Prerequisites

Tasks 1 (field) + 3 (runtime emits `xShift`).

## Current Behavior

- `examples/canvas2d-adapter/src/createCanvas2dAdapter.ts` stores each
  plot slot's points as `PlotPoint { time, value, color }`
  (`src/render/coords.ts`) — **keyed by bar `time`, not bar index** — and
  renders them via `timeToX(time, viewport)`, where the viewport's
  `xMin`/`xMax` are bar **times**. There is no display shift; a
  right-shifted line today is only a side effect of the runtime
  value-read. **There is no bar-index axis and no future-projection
  helper** — `xShift` (which is in *bars*) cannot be applied by simple
  pixel math.
- The mock canvas + `hashCallLog` (`src/testing.ts`) pin the exact draw
  call sequence; `integration.test.ts` pins the `sma-offset` render.

## Desired Behavior

- When a plot emission carries `xShift = k`, each plotted visual computed
  at bar `T` is drawn at the x of bar `T + k`. This applies to line,
  step-line, histogram, and currently-rendered glyph-like plot styles
  (`shape`, `character`, `arrow`) because all of them render a visual at
  a bar's x coordinate. Bar/candle/background override styles are candle-state
  overrides, not shifted series visuals; they must either ignore `xShift`
  explicitly with a unit test or be documented as unsupported for shifted
  rendering in v1. Do not leave the behavior accidental.
- Because the x-axis is time-based, `xShift` (bars) must first be
  converted to an x position:
  - **`−k` (left, past):** the target bar `T − k` has a known historical
    `time`; map that time through `timeToX`.
  - **`+k` (right, future):** bar `T + k` is past the last candle and has
    no real `time`; **extrapolate** its time from the median bar spacing
    of the run (`lastTime + (T + k − lastIndex) · spacing`) and extend the
    viewport `xMax` so the projected points are not clipped away.
- The shift therefore needs the source **bar index** per visual, which the
  emission already carries (`PlotEmission.bar`). The adapter must thread
  `bar` into the stored `PlotPoint` (or keep a parallel index→time table)
  plus the per-slot `xShift`, then resolve the shifted time at draw time.
  Overlay plot emissions stored in `plotOverlays` must keep enough
  information to use the same projection helper; do not keep using
  `plot.time` directly for shifted glyphs.
- `xShift` absent / `0` ⇒ pixel-identical to today (no regression on
  every existing plot scenario). Points whose shifted x still falls
  outside the drawable range are clipped consistently with other
  off-screen points.

## Requirements

1. Thread `xShift` (per slot / overlay emission) and the source bar index
   (per point / visual) from the stored plot emission into every plot
   render path that maps a plot to an x coordinate. Add a bar-offset → x
   projection: convert `xShift` bars to a target time (historical lookup
   for `−k`; median-spacing extrapolation + `xMax` extension for `+k`),
   then `timeToX`. Add the projection as a pure helper in
   `src/render/coords.ts` (there is none today).
2. Keep renderer purity (pure on `RenderCtx`); no new DOM/timer use. The
   projection helper takes world inputs (bar times / spacing) only.
3. Tests: extend the plot renderer test with a `+k` (future-projected,
   right) and a `−k` (historical, left) case asserting the shifted x in
   the recorded call log for line/histogram rendering, plus at least one
   glyph-style plot to prove `plotOverlays` uses the same projection.
   Cover the `xMax`-extension branch and the single-bar / zero-spacing
   edge. Add/adjust the `MockCanvas2DContext` canonicalisation only if a
   new call variant appears. Maintain 100% coverage.
4. Update `examples/canvas2d-adapter/CLAUDE.md` (the new bar-offset → x
   projection step, time-axis extrapolation for `+k`, and the no-shift
   byte-identity guarantee).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/canvas2d-adapter/src/createCanvas2dAdapter.ts` | Modify | thread `xShift` + bar index; extend `xMax` for projected points |
| `examples/canvas2d-adapter/src/render/coords.ts` | Modify | `PlotPoint` gains `bar`; add bar-offset → x projection helper |
| `examples/canvas2d-adapter/src/render/line.ts` | Modify | apply the projected x in the polyline |
| `examples/canvas2d-adapter/src/render/index.ts` | Modify | export the new projection helper if render paths import through the barrel |
| `examples/canvas2d-adapter/src/*.test.ts` | Modify | `+k` / `−k` render cases + projection edge cases |
| `examples/canvas2d-adapter/CLAUDE.md` | Modify | x-shift render + extrapolation note |

## Gates

- `pnpm -F chartlang-example-canvas2d-adapter test` (100% coverage; mock
  call-log hashes updated, not hand-edited)

## Changeset

None — `examples/canvas2d-adapter` is private (no changeset). It rides the
feature changeset's behavior description only.

## Acceptance Criteria

- A `−k` offset renders line/histogram/glyph plot visuals `k` bars left;
  `+k` renders them `k` right; no-shift is pixel-identical to today.
  Bar/candle/background override behavior is explicit and tested.
- Adapter suite + coverage green; CLAUDE.md updated.
