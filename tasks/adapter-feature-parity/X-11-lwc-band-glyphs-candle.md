# Task 11 — lightweight-charts: filled-band color + area alpha + glyphs + candle-override

> **Status: TODO**

## Goal

Fix lightweight-charts' rendering-fidelity gaps: forward `color` +
`alpha` to filled-band edges (same bug class as the just-fixed
line-color drop), pass `area` `fillAlpha`, render the five glyph kinds
with real shape/text/direction instead of one blue circle, and recolor
candle-override per bar by direction.

## Prerequisites

Task 9 (the shared `adapter-kit/canvas` glyph helper — Task 11's
overlay-painted glyphs consume it; do not re-derive geometry).
Otherwise independent of the canvas-family tasks; builds directly on the
already-landed `color`-forwarding fix.

## Current Behavior

In `examples/lightweight-charts-adapter/src/createLightweightChartsAdapter.ts`:

- `applyFilledBand` (`:449-450`) creates both edge series with `{}` —
  `plot.color` is never forwarded (the same drop the line path had);
  the band `alpha` is discarded.
- `area` goes through `applyLineLikePlot` (`:427`); `style.fillAlpha`
  is never passed to the `Area` series.
- All five glyph kinds route to `applyMarker` (`:509-513`) → a bare
  `{ time }` marker; the production `toMarker` (`:214-221`) hardcodes
  `position:"aboveBar"`, `shape:"circle"`, `color:"#3b82f6"` — every
  glyph is an identical blue circle (text/shape/char/direction/size/
  location/color all discarded).
- `candle-override` (`:518-521`,`:563-568`) applies a whole-series tint
  (`upColor`/`downColor`), not a per-bar direction-resolved override.

## Desired Behavior

- Filled-band edges carry `plot.color`; the band `alpha` is honored
  (edges + the drawing fill).
- Area series carries `fillAlpha`.
- Glyphs render distinctly: use the LC v5 markers plugin where it can
  express the glyph (shape set, text, position, color, size); for
  glyphs LC's marker plugin cannot express, paint via the existing
  `DrawingPrimitive` canvas overlay (the adapter already has a canvas
  sink there).
- `candle-override` recolors each overridden bar's body+border+wick by
  direction via the per-point candle color fields (the same native path
  `bar-color` uses), picking bull/bear/doji.

## Requirements

### 1. Filled-band edge color + alpha

In `applyFilledBand` (`:438-451`), forward `{ color: plot.color }` to
both edge `addSeries("Line", …)` calls (mirror `applyLineLikePlot`'s
options). Thread the band `alpha` to the drawing fill and/or edge
opacity. Add a test asserting the edge series creation options carry the
color (the mock records `addSeries` options after the prior fix).

### 2. Area fillAlpha

When the style is `area`, pass `{ ...lineOptions, lineColor:
plot.color, topColor/bottomColor or relevant opacity from fillAlpha }`
to the `Area` series (consult the LC `AreaSeries` option names). Add a
test for the forwarded alpha/options.

### 3. Glyph fidelity

Replace the uniform `applyMarker` path:

- For kinds the markers plugin supports (shape subset, position), build
  a `SeriesMarker` with the real `shape`, `position` (from `location`),
  `text` (for `character` → the `char`; for `label` → the `text`),
  `color` (`plot.color`), and `size`. Map `arrow` `direction` →
  `arrowUp`/`arrowDown` marker shapes.
- For glyphs the plugin cannot express (e.g. `shape` values like
  cross/xcross/flag), paint them through the `DrawingPrimitive` canvas
  overlay using the **shared `adapter-kit/canvas` glyph helper** promoted
  in Task 9 (do NOT re-derive geometry — same `RenderCtx` sink uplot
  uses). Document which kinds take which path in the adapter `CLAUDE.md`.

Glyphs shift at `xShift` via `shiftedBarTime` (already used).

**Mock recording is REQUIRED, not optional.** Today `MockLwcApi`'s
`setMarkers` call records only `{ kind: "setMarkers", seriesId, markers:
markers.length }` — the COUNT, not the payload. The req-5 assertions
("each glyph kind produces a distinct marker"; "arrow up vs down
differ"; "character/label carry text") are impossible against a count.
Extend `src/testing.ts` so `setMarkers` records the marker payload
(`shape` / `position` / `text` / `color` / `size`) and grow the
`LwcRecordedCall` union + `canonicalise` in lockstep (mirrors how the
candlestick per-point `color`/`borderColor`/`wickColor` machinery was
added), so the relational hash tests stay valid. Glyphs painted via the
`DrawingPrimitive` overlay instead are asserted through the existing
canvas call-log (`paintInto` → `RenderCtx`), not `setMarkers`.

### 4. candle-override by direction

Replace the whole-series tint with a per-bar override stamped on the
candlestick DATA POINT (reuse the `barColors`/`candleData` machinery
that `bar-color` uses, `:530-541`,`:647-667`), choosing the color by
direction `close > open ? bull : close < open ? bear : (doji ?? bull)`.
Keep `bar-color` / `bar-override` working; candle-override now layers
through the same per-point path. Update the file header mapping +
`CLAUDE.md` (candle-override is no longer "whole-series tint").

### 5. Tests + docs

- filled-band edges carry color (mock `addSeries` options); area alpha
  forwarded.
- Each glyph kind produces a distinct marker/overlay (no uniform blue
  circle); arrow up vs down differ; character/label carry text.
- candle-override: bullish/bearish/doji bars get the right per-point
  color.
- Update `examples/lightweight-charts-adapter/CLAUDE.md` (band color,
  area alpha, glyph routing, candle-override per-point direction).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/createLightweightChartsAdapter.ts` | Modify | Band color/alpha; area alpha; glyph routing; candle direction |
| `src/drawingPrimitive.ts` | Modify (maybe) | Overlay-painted glyphs |
| `src/testing.ts` | Modify | Record `setMarkers` payload (shape/position/text/color/size); grow `LwcRecordedCall` union + `canonicalise` in lockstep |
| `src/createLightweightChartsAdapter.test.ts` | Modify | Band/area/glyph/candle tests |
| `examples/lightweight-charts-adapter/CLAUDE.md` | Modify | Updated native mapping |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm test` (lwc 100% coverage)
- `pnpm conformance` (lwc scenario suite — slow ~200s; confirm green)
- `pnpm adapters:generate` + `pnpm adapters:gate`
- `pnpm docs:check`

## Changeset

`.changeset/lwc-band-glyphs-candle.md` — private example package
(empty changeset).

## Acceptance Criteria

- Filled-band edges carry color; area alpha forwarded; glyphs render
  distinctly; candle-override per-bar by direction.
- `MockLwcApi`'s `setMarkers` records the marker payload (not just the
  count); the `LwcRecordedCall` union + `canonicalise` grow in lockstep
  (the relational hash tests stay valid).
- 100% coverage; conformance + `adapters:gate` green; `CLAUDE.md`
  updated; changeset committed.
