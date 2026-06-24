# Task 4 — echarts: glyph fidelity + candle-override direction + drawing z

> **Status: TODO**

## Goal

Fix echarts' three rendering-correctness gaps: render the five glyph
plot kinds (`shape` / `character` / `arrow` / `marker` / `label`) with
real geometry via the `graphic` path instead of one uniform scatter
dot; pick candle-override colors by bar direction (bull/bear/doji); and
honor `z` so drawings can render beneath plots.

## Prerequisites

Task 1 (shared `sortByRenderOrder` / `RENDER_BAND`).

## Current Behavior

In `examples/echarts-adapter/src/createEChartsAdapter.ts`:

- All five glyph kinds route to one `glyphSeries` (`:691-718`) that
  emits a `scatter` with fixed `symbolSize:8` + the series color.
  `label.text`, `character.char`, `shape.shape`/`location`,
  `arrow.direction`, and `marker.shape` are never read — an up-arrow
  and a down-arrow are identical dots; a label shows a dot, not text.
- `candle-override` (`:771-774`) maps only `plot.style.bull` onto every
  overridden bar; `bear` / `doji` and bar direction are ignored.
- Drawings live in `option.graphic` (`buildGraphics` `:337-351`) which
  echarts always paints on top; `DrawingEmission.z` is never read, so a
  `draw.fillBetween(..., { z: -1 })` cannot sit beneath the price line.
  Plot `series.z` IS set (`:288,306,716`) but the cross-band
  plot-vs-drawing order is unsatisfiable.

All these kinds are declared in `ECHARTS_CAPABILITIES`.

## Desired Behavior

- Each glyph renders distinctly: shaped markers (triangle/cross/xcross/
  flag/diamond/square/circle by `shape.shape`), arrows by `direction`,
  characters as text glyphs (`char`), labels as positioned text
  (`text` + `position`), markers by their narrower shape set —
  matching the `canvas2d` `render/{shape,character,arrow,marker,label}`
  visual intent.
- `candle-override` colors each overridden bar by direction:
  `close > open ? bull : close < open ? bear : (doji ?? bull)` — copy
  the logic from `canvas2d/render/candleOverride.ts:52`.
- A drawing with `z < 0` renders beneath `z = 0` plots; a plot with
  `z > 0` renders above drawings.

## Requirements

### 1. Glyph rendering via `graphic`

Replace the uniform `glyphSeries` scatter with a `graphic`-element
builder (echarts `graphic` supports `text`, `polygon`, `path`,
`circle`, `rect`). Map each kind:

- `shape`: a `graphic` element per `shape.shape` (reuse the geometry
  intent from `canvas2d/render/shape.ts`); honor `location`
  (`above`/`below`/`absolute`) for the anchor offset (see
  `canvas2d/render/plotLocation.ts`).
- `character`: a `graphic.text` with `style.text = char`, sized by
  `size`.
- `arrow`: a directional `graphic` (triangle/path) by `direction`.
- `marker`: a `graphic` per the marker shape set
  (circle/triangle-up/triangle-down/square/diamond).
- `label`: a `graphic.text` with `text` + `position`
  (above/below/anchor) offset.

Anchor each at the category index (`shiftedBarIndex`) + price via the
existing pixel mapping the adapter uses for graphics. Glyphs carry
`plot.color`. A non-finite `value` ⇒ skip.

### 2. candle-override by direction

In `applyPlot` (`:771-774`), resolve the per-bar override color by
direction using `bull` / `bear` / `doji`. The override is applied as
the candlestick data point's `itemStyle` (as `bar-color` already does,
`:779-791`) so the body recolors per bar by its own direction — not one
bull color for all.

### 3. Drawing `z` participation

Import `sortByRenderOrder` / `RENDER_BAND` from `adapter-kit`. Assign
each drawing and each plot `series`/`graphic` a z-key
`(z ?? 0, band, seq)` and resolve a single ascending z-order, then map
that order onto echarts' `z` / `zlevel` numeric stacking so a
negative-`z` drawing's `graphic` sits below the `z = 0` series. Echarts
paints `graphic` above `series` by default; counter it by driving both
through a computed numeric `z` derived from the shared sort (e.g.
drawings get a `z` below the series band when their emission `z < 0`).
Document the mapping in the adapter `CLAUDE.md` (echarts cannot
interleave `graphic` and `series` arbitrarily — describe the achievable
ordering and any residual constraint).

### 4. Tests + docs

- Per-glyph tests asserting the emitted `graphic` element type +
  payload (text/shape/direction) differ across kinds — no two kinds
  produce identical output.
- candle-override: a bullish, a bearish, and a doji bar each get the
  correct color.
- z: a `z:-1` drawing sorts below a `z:0` plot in the resolved order.
- Update `examples/echarts-adapter/CLAUDE.md`: glyph `graphic` mapping,
  candle-override direction, and the `z` stacking strategy + its
  limits.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/createEChartsAdapter.ts` | Modify | Glyph `graphic` builder; candle-override direction; z mapping |
| `src/primitiveToGraphic.ts` | Modify (maybe) | Shared graphic helpers if reused for glyphs |
| `src/createEChartsAdapter.test.ts` | Modify | Per-glyph + candle-override + z tests |
| `examples/echarts-adapter/CLAUDE.md` | Modify | Glyph/candle/z invariants |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm test` (echarts 100% coverage)
- `pnpm conformance` (echarts scenario suite green)
- `pnpm adapters:generate` + `pnpm adapters:gate`
- `pnpm docs:check`

## Changeset

`.changeset/echarts-glyphs-candle-z.md` — private example package
(empty changeset).

## Acceptance Criteria

- Five glyph kinds render distinctly (no uniform dot); per-kind tests.
- candle-override picks bull/bear/doji by direction.
- `z` resolved through the shared sort; a `z:-1` drawing orders below
  plots (within echarts' achievable stacking, documented).
- 100% coverage; conformance + `adapters:gate` green; changeset.
