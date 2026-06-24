# Task 2 — canvas2d: complete plot-style dispatch

> **Status: TODO**

## Goal

Wire the four orphaned / degraded plot styles in the reference adapter:
dispatch the `marker` plot style (currently dropped), give `step-line`
real step geometry (currently a plain line), and dispatch the existing
but never-called `area` / `filled-band` / `label` render helpers. After
this task `canvas2d` paints every wire-level `PlotStyle` kind.

## Prerequisites

Task 1 (shared sort) — `marker` joins the z-sorted glyph band, which
goes through `sortByRenderOrder`.

## Current Behavior

In `examples/canvas2d-adapter/src/createCanvas2dAdapter.ts`:

- `applyPlot` routes `line` / `step-line` / `histogram` into
  `plotSeries` (`:778`), `horizontal-line` into `hlines` (`:800`),
  everything else into `plotOverlays` (`:820`).
- `isGlyphOverlay` (`:484`) selects only `shape` / `character` /
  `arrow` / `horizontal-histogram` into the z-sorted glyph band — so a
  `marker` emission is stored but never painted.
- `step-line` is painted by `drawLine` (`render/line.ts`) — a straight
  polyline, no step knee.
- `drawArea` (`render/area.ts:77`), `drawFilledBand`
  (`render/filledBand.ts:76`), `drawLabel` (`render/label.ts:74`),
  `drawMarker` (`render/marker.ts:64`) exist + are unit-tested but are
  never dispatched from the factory.

`marker` IS authorable (`core` `PlotOptsStyle`, runtime
`emit/plot.ts:41`). `area` / `filled-band` / `label` are NOT yet
reachable from the authoring surface but ARE declared in
`CANVAS2D_PLOT_KINDS` (`capabilities.ts`); wiring their dispatch makes
the declared capability honest (see README Deferred for authoring
exposure).

## Desired Behavior

- `marker` joins the glyph band: `isGlyphOverlay` returns `true` for
  it and `paintGlyph` dispatches `drawMarker`.
- `step-line` paints with a horizontal-then-vertical step path
  (Pine/LWC `WithSteps` parity), distinct from `line`.
- `area`, `filled-band`, `label` dispatch their existing render
  helpers (area + filled-band are series-shaped; label is a
  per-bar/time glyph overlay).

## Requirements

### 1. Dispatch `marker`

In `isGlyphOverlay` (`createCanvas2dAdapter.ts:484`) add
`plot.style.kind === "marker"`. In `paintGlyph` (`:495`) add a
`case`/branch that calls `drawMarker(state.ctx, {...}, viewport)` with
the marker `shape` + `size` from `plot.style`, anchored at the plot's
shifted x (use the same `projectShiftedX` path the other glyphs use)
and `priceToY(plot.value, …)`. A non-finite `plot.value` is a no-op
(match the other glyph guards). Reuse `render/marker.ts`'s arg bag —
do not re-derive geometry.

### 2. Step-line geometry

Add a step-aware path. **Decision: extend `render/line.ts`'s `drawLine`
with a `step?: boolean` arg** (single entry point, no duplicate
sub-path/gap logic) that emits `lineTo(xNext, yPrev)` then
`lineTo(xNext, yNext)` per segment. Route `step-line` from `applyPlot`
through `plotSeries` (unchanged) but tag the stored style so
`paintSeries` selects the step path. Preserve the `value:null` gap
break (sub-path split) and per-point `color`. Add a
`render/line.test.ts` case asserting the step call sequence vs
`MockCanvas2DContext.calls`.

### 3. Dispatch `area` / `filled-band`

These are series-shaped (one value, or upper/lower per bar). **Decision:
extend `plotSeries` handling** (not a parallel overlay store) so
`applyPlot` accumulates their per-bar points (area: `value`;
filled-band: `style.upper` / `style.lower`, either `null` for a gap). In
`renderFrame`'s pane walk (or as a `SortableMark` series variant),
dispatch `drawArea` / `drawFilledBand` with the accumulated points +
the plot `color` + `fillAlpha` / `alpha`. Honor `visible:false` and
the z/seq keys so they participate in the sorted pass. Reuse
`render/area.ts` + `render/filledBand.ts` arg bags verbatim.

### 4. Dispatch `label`

`label` is a per-bar text glyph. Add `label` to the glyph-overlay
keying (`${slotId}@${time}`) and, in `paintGlyph`, dispatch
`drawLabel(state.ctx, { text: plot.style.text, position:
plot.style.position, … }, viewport)` at the plot anchor. Non-finite
`value` → no-op. `label` is NOT in `isGlyphOverlay`'s shifted-glyph
set today. **Decision: `label` shifts at `xShift`** (matches
`shape`/`character` for parity); document the shift in the adapter
`CLAUDE.md`.

### 5. Edge cases + docs

- Marker shapes: `circle` / `triangle-up` / `triangle-down` / `square`
  / `diamond` (the `marker` style's shape set, narrower than `shape`).
- `filled-band`: both edges `null` is rejected upstream by
  `validateEmission` — do not guard for it; a single `null` edge is a
  per-bar gap.
- Update `examples/canvas2d-adapter/CLAUDE.md` Phase-2 invariants: the
  note "createCanvas2dAdapter.ts does NOT dispatch to the Phase-2
  renderers" is now obsolete — replace it with the dispatch wiring this
  task adds (marker/step/area/filled-band/label).
- Add adapter unit tests per kind asserting the call sequence; the
  existing test in `createCanvas2dAdapter.test.ts` (~`:1088`, "ignores
  a plot whose style.kind is not in the Phase-1 union", using `area`)
  MUST be updated — `area` now renders. (Line numbers in this task are
  approximate after the recent plot-color/offset/candle commits; anchor
  on the symbol/description, not the exact line.)

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/createCanvas2dAdapter.ts` | Modify | Dispatch marker/area/filled-band/label; step-line routing |
| `src/render/line.ts` | Modify | Step-line path (+ test) |
| `src/render/line.test.ts` | Modify | Step call-sequence assertion |
| `src/createCanvas2dAdapter.test.ts` | Modify | Per-kind dispatch tests; fix the `area`-ignored test |
| `examples/canvas2d-adapter/CLAUDE.md` | Modify | Replace the obsolete "does NOT dispatch" invariant |

(All paths under `examples/canvas2d-adapter/` unless noted.)

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm test` (canvas2d 100% coverage)
- `pnpm conformance` (plot-hash `{bar,value}` unaffected; confirm green)
- `pnpm adapters:generate` + `pnpm adapters:gate`
- `pnpm docs:check` (if any JSDoc added)

## Changeset

`.changeset/canvas2d-complete-plot-dispatch.md` — private example
package (empty changeset, no bump).

## Acceptance Criteria

- `marker`, `step-line` (stepped), `area`, `filled-band`, `label` each
  render with a per-kind dispatch test.
- The `area`-is-ignored test is replaced; no plot kind silently drops.
- canvas2d at 100% coverage; conformance green; `adapters:gate` green.
- `CLAUDE.md` updated; changeset committed.
