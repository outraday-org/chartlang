# Price + time axes + grid + 2D text overlay + pan/zoom interaction

> **Status: TODO**

## Goal

Complete the MVP visual: a price (y) axis + time (x) axis with grid
lines, a thin **2D-canvas text overlay** for axis labels (and later
drawing/marker text), and pan/zoom/reset interaction wired to the shared
`ViewController` so the chart is navigable — with the 120-bar default
window already in effect via Task 4.

## Prerequisites

Task 6 (candles) + Task 7 (lines) — something to navigate over.

## Desired Behavior

The chart shows a right-gutter price axis + bottom time axis with grid
lines and numeric/time labels; wheel zooms about the cursor, drag pans,
double-click resets to the auto-follow window; the y-scale auto-fits the
visible window (`yRangeInWindow`).

## Requirements

1. **2D text overlay** — create a second `<canvas>` (or reuse a 2D
   context) sized to the GL canvas (CSS size + dpr), positioned over it.
   Axis labels, grid-label text, and (later) drawing/marker/alert text
   paint here via the shared `RenderCtx` text API
   (`@invinite-org/chartlang-adapter-kit/canvas`). The GL canvas paints
   geometry; the overlay paints text. Document this split in CLAUDE.md.
   Grid LINES render via the GL `line-strip` program (or a dedicated thin
   grid program) in world/pixel space; only text uses the overlay.

2. **Axes geometry (pure)** — compute price-axis tick values + positions
   from the pane's visible y-window and time-axis ticks from the visible
   x-window (reuse any existing tick/nice-number helper in adapter-kit /
   canvas2d's `yAxis.ts`; if none is shared, port a small pure
   `niceTicks` helper and unit-test it). Pure → unit-test tick selection
   + label formatting (price precision, time formatting per interval).

3. **Interaction** — prefer the shared `attachInteraction(el, handlers)`
   (`adapter-kit/interaction/domWiring.ts`) wired to the `ViewController`
   (wheel→`zoomAt`, drag→`panBy`, dblclick→`reset`), exactly as
   canvas2d/uplot do, rather than porting invinite's `ChartController`
   wholesale (keeps one interaction contract across adapters). Supply
   `pxToWorldX`/`worldXPerPx`/`dataBounds`/`requestRender` closures over
   the current pane window. If invinite-specific gestures (shift-pan,
   pinch) are wanted, port them from `ChartController.ts` as additive
   handlers — but the core pan/zoom/reset MUST go through the shared
   `ViewController` so `initialVisibleBars` auto-follow + held-window
   semantics match the other adapters. Guard DOM wiring behind a real
   canvas (`/* v8 ignore */`).

4. **`requestRender`** — re-runs `buildFrame` + `renderer.update` +
   `scheduleDraw` so interaction repaints (the loop only repaints on
   candle events).

5. **Tests** — unit-test the pure tick/label/format helpers and the
   pan/zoom decision cores if ported (synthetic numbers, like
   adapter-kit's `attachInteraction` core tests). DOM wiring + GL draw
   are browser-only.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/webgl-adapter/src/overlay.ts` | Create | 2D text-overlay canvas + RenderCtx |
| `examples/webgl-adapter/src/axes.ts` | Create | Pure tick/label/format helpers |
| `examples/webgl-adapter/src/interaction.ts` | Create | `attachInteraction` → ViewController wiring |
| `examples/webgl-adapter/src/webgl/Renderer.ts` | Modify | Grid-line layer + axis label hook |
| `examples/webgl-adapter/src/index.ts` | Modify | Mount overlay + interaction + requestRender |
| `examples/webgl-adapter/src/*.test.ts` | Create | Tick/format + interaction-core tests |

## Gates

- `pnpm typecheck` · `pnpm lint` · `pnpm format:check` · `pnpm test`
- `pnpm conformance` (unchanged)

## Changeset

None.

## Acceptance Criteria

- Price + time axes + grid render; labels via the 2D overlay; y-scale
  auto-fits the visible window via `yRangeInWindow`.
- Pan/zoom/reset go through the shared `ViewController`; `initialVisibleBars`
  120-bar default window is in effect on load; held-window semantics match
  the other adapters.
- Pure tick/format + interaction cores unit-tested; build/lint green.
- The MVP renderer (candles + lines + axes + nav) is visually complete.
