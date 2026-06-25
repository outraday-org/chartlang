# Vertical / volume bars program + subpane layout

> **Status: TODO**

## Goal

Port invinite's `vertical-bars-program.ts` (and
`horizontal-volume-bars-program.ts`) for histogram-style series (volume,
MACD histogram, the `histogram` plot kind), and add multi-pane (subpane)
layout so non-overlay panes (e.g. a volume/RSI subpane) get their own
viewport + scale, paving the way for full parity.

## Prerequisites

Task 9 (MVP shipped). Builds on Task 5 (Renderer) + Task 4 (descriptors).

## Desired Behavior

`histogram` plot series render as GPU-instanced vertical bars anchored at
a baseline (or y=0), colored per the style; series assigned to a non-overlay
pane render in a stacked subpane with its own viewport + auto-fit y-scale.

## Requirements

1. **`src/webgl/programs/vertical-bars-program.ts`** — port: instanced
   quad anchored at baseline (`Y_ZERO_QUAD` for y=0, or a baseline
   uniform), per-instance `aIdx/aValue/aColor` (or bull/bear), device-px
   snapping, blend; `drawArraysInstanced`. Pure packer (bar rows →
   instance buffer) unit-tested. Provenance.

2. **`src/webgl/programs/horizontal-volume-bars-program.ts`** — port for
   the `horizontal-histogram` plot kind (volume-profile style). Pure
   packer tested. (If lower priority, may defer to Task 14’s overrides —
   but it is part of full parity; include unless spec length forces a
   split.)

3. **Subpane layout** — extend the layout computation (Task 5's single
   overlay pane) to multiple panes: read `state.paneOrder` (overlay at
   index 0 + subpanes), split the canvas vertically into pane rects
   (reserve the time-axis gutter once at the bottom), and have
   `buildFrame` emit one `PaneRenderState` per pane with its own visible
   y-window (`yRangeInWindow` over that pane's series) sharing the x-window.
   `Renderer` already loops panes (Task 5). Keep pane-rect math pure +
   unit-tested.

4. **Dispatch** — add `vertical-bars` (+ `horizontal-volume-bars`) arms
   to `dispatchLayer`.

5. **Histogram plot kind** — route `style.kind === "histogram"` series in
   `buildFrame` to a `vertical-bars` descriptor (baseline from
   `style.baseline`), mirroring canvas2d's histogram dispatch.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/webgl-adapter/src/webgl/programs/vertical-bars-program.ts` | Create | Instanced vertical bars |
| `examples/webgl-adapter/src/webgl/programs/horizontal-volume-bars-program.ts` | Create | Horizontal volume profile |
| `examples/webgl-adapter/src/layout.ts` | Create/Modify | Multi-pane rect computation (pure) |
| `examples/webgl-adapter/src/buildFrame.ts` | Modify | Per-pane windows + histogram routing |
| `examples/webgl-adapter/src/webgl/Renderer.ts` | Modify | Dispatch bar kinds |
| `examples/webgl-adapter/src/*.test.ts` | Create | Packer + layout unit tests |

## Gates

- `pnpm typecheck` · `pnpm lint` · `pnpm format:check` · `pnpm test`
- `pnpm conformance` (unchanged)

## Changeset

None.

## Acceptance Criteria

- Vertical-bars (+ horizontal-volume-bars) programs ported with
  provenance; pure packers tested.
- Multi-pane layout splits the canvas into per-pane viewports with
  independent y-autofit; pane-rect math pure + tested.
- `histogram` plot kind routes to vertical bars; build/lint green.
