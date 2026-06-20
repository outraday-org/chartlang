# Tier 3 (reference adapter): Global Z-Sort Paint Order

> **Status: TODO**

## Goal

Make the canvas2d reference adapter honor `z` by computing **one global
render order** for all marks (plots + drawings) instead of the current
hard-coded band sequence. Sort by `(z ?? 0, groupBand, declarationSeq)`
with a stable sort, then paint. At the default `z=0` the output is
pixel-identical to today; a drawing with `z < 0` paints beneath `z=0`
plots, and a plot with `z > 0` paints above drawings.

## Prerequisites

- Task 3 (`PlotEmission.z` / `DrawingEmission.z` on the wire).
- Task 4 (runtime emits `z`).

## Current Behavior

`examples/canvas2d-adapter/src/createCanvas2dAdapter.ts`:
- `ingest` (≈703–720) drains `emissions.plots` then `emissions.drawings`
  into `state.plotSeries` / `state.plotOverlays` / `state.drawings`
  Maps, keyed by slot/handle — so render falls out as Map (insertion)
  order.
- `renderFrame` (≈555–610) paints a fixed sequence: clear → price axis →
  background overlays → candles → bar overlays → plot series → glyph
  overlays → horizontal lines → `renderOverlayTail` (drawings → alert
  badges → conditions → logs).
- `applyPlot` (≈612–661) and `applyDrawing` accumulate marks; neither
  records a `z` or a global declaration sequence.

## Desired Behavior

- The adapter assigns each ingested mark a monotonically increasing
  **declaration sequence** number (global, in ingest order) and stores
  its `z` (default `0`).
- `renderFrame` builds a single list of *paintable marks* (plot series,
  plot glyph/overlay marks, drawings, horizontal lines) and paints them
  in the order given by a **stable sort** on the composite key
  `(z, band, seq)`.
- **Background fills, candles, price axis stay below** the sortable
  band (they are chart substrate, not `z`-ordered marks). **Alert badges
  / conditions / logs stay above** everything (rendered last,
  unaffected by `z`). Only plots + drawings + hlines participate in the
  `z` sort.
- **`state.plotOverlays` is mixed** — it holds glyph marks
  (`shape`/`character`/`arrow`, via `renderGlyphOverlays`) **and**
  substrate overlays (`bg-color` via `renderBackgroundOverlays`;
  `bar-color`/candle/bar overrides via `renderBarOverlays`). **Only the
  glyph subset** joins the sortable band. `bg-color` keeps painting with
  the background (below), and bar/candle overrides keep painting with the
  candles (substrate) — they are **not** `z`-sorted. Partition
  `plotOverlays` by style when collecting sortable marks.

## Requirements

### 1. Record `z` + sequence at ingest

In `applyPlot` / `applyDrawing` (and the hline/overlay accumulators),
store:
- `z: emission.z ?? 0`
- `seq:` a global counter incremented per ingested mark (ingest order =
  declaration order, since the runtime drains in script order).

Record `z`/`seq` on **every** sortable store, not just the series:
- `PlotPoint` (series entries) — extend the type in
  `examples/canvas2d-adapter/src/render/coords.ts`.
- The **glyph** entries in `state.plotOverlays` (shape/character/arrow
  only — see the substrate carve-out in *Desired Behavior*).
- The `state.hlines` entries.
- The drawing store (`state.drawings`).

Persist `z`/`seq` across frames like other per-mark fields.

### 2. Define group bands

To keep pixel-identity at `z=0`, the bands MUST reproduce today's
phase order, which is **series → glyphs → hlines → drawings** (see
*Current Behavior*: `renderPaneSeries` then `renderGlyphOverlays` then
the hline loop, then drawings in `renderOverlayTail`). A flat
`plot/hline` band would reorder glyphs vs. hlines. Use one band per
phase:

```ts
const BAND = { series: 0, glyph: 1, hline: 2, drawing: 3 } as const;
```

(Background/candles/axis and bg-color/bar-override overlays are **not**
in this table — they render before the sorted pass; alerts render
after.)

### 3. Single sorted paint pass in `renderFrame`

Refactor `renderFrame` so that, after painting substrate
(axis/background/candles/bar overlays), it:

1. Collects all sortable marks into one array of a tagged union
   (`{kind:'series'|'glyph'|'hline'|'drawing', z, seq, band, payload}`).
2. **Stable-sorts** by `(z asc, band asc, seq asc)`. Use a stable sort
   (JS `Array.prototype.sort` is stable in modern engines; rely on it or
   include `seq` as the final comparator key to make it total and
   deterministic regardless).
3. Iterates the sorted array, dispatching each mark to its existing
   per-kind renderer (`renderLine`, glyph renderer, `renderHLine`,
   `applyDrawing`'s painter, etc.). **Reuse the existing renderers** —
   this task changes *order*, not per-mark drawing code.
4. Paints `renderOverlayTail`'s alert/badge/condition/log portion
   **after** the sorted pass (move drawings *out* of `renderOverlayTail`
   into the sorted pass; keep alerts there).

### 4. Preserve default-order pixel-identity

With every mark at `z=0`, the composite key reduces to `(0, band, seq)`
= band order then declaration order = **exactly today's order**
(series → glyphs → hlines → drawings, ingest/declaration order within
each band). Add an adapter test/golden
asserting a no-`z` script renders the same draw-call sequence as before
the refactor (capture the ordered renderer-dispatch list and compare).

### 5. Tests (co-located adapter tests)

- **Default identity:** no-`z` script → renderer dispatch order
  unchanged vs. a captured baseline.
- **Cross-band:** `draw.line(.., { z: -1 })` + `plot(.., { z: 0 })` →
  the drawing is dispatched **before** (beneath) the plot.
- **Plot above drawing:** `plot(.., { z: 5 })` + `draw.line(.., {})` →
  plot dispatched after the drawing.
- **Fractional:** `z: 1.5` slots between `z: 1` and `z: 2`.
- **Tie → declaration order:** two plots both `z: 2` keep call order.
- **Alerts unaffected:** alert badges still paint last regardless of any
  mark's `z`.

Use the adapter's existing test harness (capture dispatch order via a
spy/recording canvas context, as existing render tests do).

### 6. Edge cases / invariants

- Per-pane scope: marks are sorted **within their resolved pane**; do
  not let a `z` value reorder across panes (sort within each pane's mark
  set, or include pane in the partition before sorting).
- Stability: equal `(z, band)` MUST fall back to `seq`; never rely on
  Map iteration alone once `z` is in play.
- No behavior change for background/candles/axis/alerts.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/canvas2d-adapter/src/createCanvas2dAdapter.ts` | Modify | `z`/`seq` capture; single sorted paint pass; move drawings into the sort |
| `examples/canvas2d-adapter/src/render/coords.ts` | Modify | `z`/`seq` on `PlotPoint` (+ drawing store struct) |
| `examples/canvas2d-adapter/src/render/*` | Modify (if needed) | Renderer dispatch entry points reused by the sorted pass |
| `examples/canvas2d-adapter/**/*.test.ts` | Modify/Create | Order tests (identity, cross-band, fractional, tie, alerts) |
| `examples/canvas2d-adapter/CONFORMANCE.md` / `conformance-report.json` | Modify (if the report tracks render-order capabilities) | Reflect z-order support |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (adapter test suite; coverage per the example's gate)
- `pnpm conformance` (if the adapter participates; ensure no regression)

## Changeset

None if `examples/canvas2d-adapter` is unpublished (examples are not
released to npm). If it has a published package name, add a `minor`
bump line to `.changeset/plot-draw-z-order.md`. Confirm via its
`package.json` `private`/`name`.

## Acceptance Criteria

- A no-`z` script renders an identical dispatch order to the
  pre-refactor adapter (golden/baseline test passes).
- `z` produces the correct global order across plots and drawings,
  including cross-band (drawing under plot, plot over drawing),
  fractional, and tie-breaks-by-declaration cases.
- Alerts/badges remain on top; background/candles/axis remain on the
  bottom, both `z`-independent.
- Sorting is stable and partitioned per pane.
- Adapter tests + conformance green; CONFORMANCE.md/report updated if
  they enumerate render-order support.
