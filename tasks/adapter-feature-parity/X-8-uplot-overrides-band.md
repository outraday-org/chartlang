# Task 8 — uplot: candle/bar overrides + horizontal-histogram + filled-band + visible

> **Status: TODO**

## Goal

Paint the substrate/series plot kinds uplot currently buffers but never
draws — `candle-override` (by direction), `bar-override`, and
`horizontal-histogram` — fix `filled-band` to render the upper+lower
pair (not a single edge), and make `visible:false` keep the slot
listed. This is the first of three uplot tasks closing the largest
coverage gap of any adapter.

## Prerequisites

Task 1 (shared sort — referenced by Task 10, not strictly here; land
Task 1 first regardless).

## Current Behavior

In `examples/uplot-adapter/src/createUplotAdapter.ts`:

- `applyPlot` (`:824`) buffers `candle-override`, `bar-override`,
  `horizontal-histogram` (and the glyph kinds — Task 9) into
  `state.overlays` (the catch-all `state.overlays.set(...)` at `:870`);
  nothing paints them. Capabilities declare the full `allPhase5Plots()`
  set (`capabilities.ts:28`).
- `filled-band` maps to a uPlot `"band"` path (`pathsFor`, `:397`) but
  `buildPaneData` (`:667`) builds only ONE value row per slot — the
  `style.upper` / `style.lower` are never consumed, so only a single
  edge renders.
- `visible:false` early-returns (`:825`), dropping the slot entirely
  rather than keeping it listed.
- `bg-color` (`applyBgColor` `:878`) + `bar-color` (`applyBarColor`
  `:900`) already paint via the canvas draw-hook sink (`bgColor.ts`,
  `candlePaths.ts`).

uplot draws candles/bands/hlines/drawings through a uPlot `draw` hook
onto the canvas, clipped to the plot bbox (the `RenderCtx` `rect`/`clip`
seam — see `adapter-kit/CLAUDE.md`).

## Desired Behavior

- `candle-override` recolors each overridden bar's body by direction
  (`canvas2d/render/candleOverride.ts:52` logic) via the candle draw
  pass.
- `bar-override` recolors per bar (outline/body) via the draw pass.
- `horizontal-histogram` paints its volume-profile buckets
  (`canvas2d/render/horizontalHistogram.ts` intent) via the draw hook.
- `filled-band` renders the region between `upper` and `lower` (two
  rows feeding the uPlot band, or a hand-painted fill in the draw
  hook), with `null` edges as per-bar gaps.
- `visible:false` keeps the slot registered (listed) while contributing
  no painted points and no y-scale stretch.

## Requirements

### 1. candle-override + bar-override

Thread these overrides (keyed by bar time, like `bar-color` already is
in `applyBarColor` `:900`) into the candle draw pass
(`candlePaths.ts` / `projectCandles` / `drawCandlePaths`). Resolve
candle-override color by direction; resolve bar-override per its
`style.color`. Both already have a canvas painting path for candles —
extend it, do not add a parallel one.

### 2. horizontal-histogram

Paint buckets via the draw hook + canvas sink (reuse `paintPrimitive`
or a small local painter mirroring
`canvas2d/render/horizontalHistogram.ts`). Anchor at price → y; widths
scale to a max px. Clip to the plot bbox.

### 3. filled-band upper/lower

**Decision: native uPlot band (two adjacent series), NOT a hand-painted
draw-hook fill.** In `buildPaneData` (`:667`), for a `filled-band` slot
accumulate TWO rows (`style.upper`, `style.lower`) and feed uPlot's
native band fill (two adjacent series). A `null` edge is a per-bar gap
(uPlot `null`). Honor the band `alpha`.

### 4. visible:false keeps the slot

Replace the early-return drop (`:825`) with: register the slot (so it
stays listed) but skip painting + skip y-scale inclusion. Mirror
canvas2d's "hidden but declared" semantics.

### 5. Tests + docs

- candle-override (3 directions), bar-override (per bar),
  horizontal-histogram (buckets paint), filled-band (both edges →
  region; null edge → gap), visible:false (slot retained, not painted).
- Assert via the canvas call-log (`hashCallLog` / `MockCanvasContext`
  over the draw hook).
- Update `examples/uplot-adapter/CLAUDE.md` with the newly-painted
  kinds + the filled-band pair + visible-keep-slot semantics.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/createUplotAdapter.ts` | Modify | Dispatch overrides/h-histogram/band; visible-keep |
| `src/candlePaths.ts` | Modify | candle/bar override into candle draw |
| `src/createUplotAdapter.test.ts` | Modify | Per-kind + visible tests |
| `examples/uplot-adapter/CLAUDE.md` | Modify | Newly-painted kinds + band + visible |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm test` (uplot 100% coverage)
- `pnpm conformance`
- `pnpm adapters:generate` + `pnpm adapters:gate`
- `pnpm docs:check`

## Changeset

`.changeset/uplot-overrides-band.md` — private example package (empty
changeset).

## Acceptance Criteria

- candle-override (by direction), bar-override, horizontal-histogram
  paint; filled-band renders the upper/lower region; visible:false
  keeps the slot.
- 100% coverage; conformance + `adapters:gate` green; `CLAUDE.md`
  updated; changeset committed.
