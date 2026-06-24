# Task 6 — konva: bar-color colorValue + candle-override + glyphs + z

> **Status: TODO**

## Goal

Fix konva's four rendering-correctness gaps: honor `colorValue` for
`bar-color`; pick candle-override colors by direction; render `marker`/
`shape` with real per-shape glyph geometry instead of a square; and add
z-render-order via the shared sort.

## Prerequisites

Task 1 (shared `sortByRenderOrder` / `RENDER_BAND`).

## Current Behavior

In `examples/konva-adapter/src/createKonvaAdapter.ts`:

- `bar-color` (`:649-655`) uses `style.color` directly and never reads
  `plot.colorValue` — a per-bar dynamic tint never overrides and a
  `null` gap still paints. (bg-color DOES honor colorValue, `:679-680`.)
- `candle-override` (`:655`) hardcodes `style.bull` for every bar;
  `bear` / `doji` and direction ignored.
- `marker` and all eight `shape` values render as one square `Rect`
  (`:612-633`); `shape.location` ignored.
- No z-order anywhere (`grep ".z" → 0`); paint order is fixed
  (candles → bg-color → series → glyphs → hlines → drawings).

`primitiveToNode.markerNodes` already has true per-shape glyph geometry
that the plot path does not reuse.

## Desired Behavior

- `bar-color` honors `colorValue` 3-state (copy the bg-color resolution
  at `:679-680`: omitted ⇒ `style.color`, present ⇒ override, `null` ⇒
  no tint that bar).
- `candle-override` resolves bull/bear/doji by direction (copy
  `canvas2d/render/candleOverride.ts:52`).
- `marker` / `shape` render their actual shapes (reuse
  `primitiveToNode.markerNodes` geometry), honoring `shape.location`.
- A shared z-sort orders plots / glyphs / hlines / drawings via konva
  `zIndex` so a `z:-1` drawing sits below a `z:0` plot and a `z:1` plot
  above drawings.

## Requirements

### 1. bar-color colorValue

In the `bar-color` arm (`:649-655`) resolve `const resolved =
plot.colorValue === undefined ? plot.style.color : plot.colorValue;`
and skip the tint when `resolved === null`. Mirror the existing
bg-color branch exactly. Add a test (none exists today — bg-color is
tested at `:847-855`).

### 2. candle-override direction

Replace the hardcoded `style.bull` (`:655`) with the direction
resolution `close > open ? bull : close < open ? bear : (doji ??
bull)`. Test bullish/bearish/doji bars.

### 3. marker / shape glyphs

Route `marker` and `shape` plot kinds through the per-shape node
geometry already in `primitiveToNode.markerNodes` (a private fn at
`primitiveToNode.ts:~191`) instead of the square `Rect`. **Coverage
gap:** `markerNodes` today only renders five shapes — `circle` /
`square` / `diamond` / `triangle-up` / `triangle-down` — which exactly
covers the narrower `marker` shape set but is only 5 of the 8 `shape`
kinds. The three remaining `shape` glyphs (`cross` / `xcross` / `flag`)
have NO konva geometry yet and must be added; use
`canvas2d/render/shape.ts` (`drawShape`, the canonical 8-glyph
reference) as the geometry intent. Factor a shared per-shape helper so
both the marker-plot path and the drawing-layer marker primitive consume
ONE source (the union of all 8 shapes), rather than duplicating. Apply
`shape.location` (above/below/absolute) for the anchor — `location` is
currently read nowhere. Keep `plot.color`. Non-finite `value` ⇒ skip.

### 4. z-render-order

Import `sortByRenderOrder` / `RENDER_BAND`. Build a per-pane mark list
(`series` / `glyph` / `hline` / `drawing`) each tagged
`(z ?? 0, RENDER_BAND.*, seq)` (assign `seq` at ingest, mirroring
canvas2d), sort once, and assign ascending konva `zIndex` (or insert
into the layer in sorted order). Drawings currently paint on a separate
layer always-above (`:939-958`) — bring them into the same z-sorted
pass within the overlay pane so a negative-`z` drawing can sink below
plots. Background fills + candles + bar/candle overrides stay below the
sorted pass; alerts/logs (Task 7) stay above (match canvas2d's posture).

### 5. Tests + docs

- bar-color colorValue (3-state), candle-override (3 directions),
  marker/shape (per-shape geometry differs; location offset), z (a
  `z:-1` drawing below a `z:0` plot; a `z:1` plot above a drawing).
- Update `examples/konva-adapter/CLAUDE.md`: bar-color colorValue,
  candle-override direction, marker/shape glyph geometry, and the z-sort
  pass. NOTE: the "glyph geometry owned by drawings layer" wording lives
  in a `createKonvaAdapter.ts` source comment (~`:596`), not the
  `CLAUDE.md` — update/remove it at the source comment AND reflect the
  new reality in `CLAUDE.md`. The "validated-and-ignored" note for
  alerts/logs in `CLAUDE.md` (~line 152) is Task 7's to revise, not this
  task's.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/createKonvaAdapter.ts` | Modify | bar-color colorValue; candle direction; glyph geometry; z-sort |
| `src/primitiveToNode.ts` | Modify | Factor shared per-shape glyph helper; add `cross`/`xcross`/`flag` geometry (markerNodes covers only 5 of 8 shapes today) |
| `src/createKonvaAdapter.test.ts` | Modify | colorValue/candle/glyph/z tests |
| `examples/konva-adapter/CLAUDE.md` | Modify | Updated invariants |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm test` (konva 100% coverage)
- `pnpm conformance`
- `pnpm adapters:generate` + `pnpm adapters:gate`
- `pnpm docs:check`

## Changeset

`.changeset/konva-render-correctness.md` — private example package
(empty changeset).

## Acceptance Criteria

- bar-color honors colorValue; candle-override picks by direction;
  marker/shape render real shapes with location; z-order works via the
  shared sort.
- 100% coverage; conformance + `adapters:gate` green; `CLAUDE.md`
  updated; changeset committed.
