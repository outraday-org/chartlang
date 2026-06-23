# Task 13 — lightweight-charts: line-family `colorValue` (structural)

> **Status: TODO**

## Goal

Honor per-bar `colorValue` for line-family plots in lightweight-charts —
the structurally hardest case, because an LC line series carries a
single creation-time color with no per-point color field. Implement it
by splitting a line slot into consecutive same-color **runs**, each a
native series, mirroring the 3-state contract from the canvas2d
reference (Task 3).

## Prerequisites

Task 3 (line-family colorValue reference + contract); Task 12 (same LC
file — land sequentially).

## Current Behavior

`applyLineLikePlot` (`:421-434`) forwards the static `plot.color` once
at series creation and never reads `plot.colorValue`. LC line series
have no per-point color, and the factory never re-`applyOptions`es the
color — so even the static color is creation-only and per-bar dynamic
color is impossible with a single series. The audit flagged this as the
hardest gap (the runtime DOES emit `colorValue` for line plots).

## Desired Behavior

Per `PlotEmission.colorValue` (`adapter-kit/src/types.ts:582`):

- **omitted** ⇒ one series, static `plot.color` (today's behavior,
  byte-identical wire).
- **present** ⇒ the line is partitioned into maximal runs of bars
  sharing a resolved color; each run is its own LC `Line` series with
  that color; runs connect at the shared boundary bar so the line looks
  continuous.
- **`null`** ⇒ that bar is a whitespace gap (no run spans it), exactly
  like a `value:null` gap.

## Requirements

### 1. Per-run segment series

For a line/step/area slot whose emissions carry `colorValue`, maintain
a set of native series keyed by `(slotId, runColor, runIndex)`. As bars
arrive, resolve each bar's color (`colorValue === undefined ?
plot.color : colorValue`); when the color changes, close the current
run and open a new series, duplicating the boundary bar into both runs
so the segments visually join (LC requires ≥2 points to draw a
segment). A `null` color ends the current run and starts no new series
until the next finite-colored bar. Reuse `shiftedBarTime` for x.

Keep the **omitted-`colorValue`** path on the single-series code (do
NOT split when no `colorValue` is present) so existing goldens / call
logs are byte-identical.

### 2. Histogram

LC histogram series DO carry per-point `color` (like candlesticks).
For `histogram` line-family with `colorValue`, stamp the per-point
`color` on the data point directly (no run-splitting needed) — simpler
than lines. A `null` ⇒ whitespace point.

Note: the mock's `dataPoint` factory + `LwcDataPoint` type
(`src/testing.ts`) only record per-point `color` for candlestick points
today; line/area/histogram points are built as `{ time, value }`. To
assert the histogram per-point color, extend `LwcDataPoint` +
`dataPoint` + `canonicalise` in lockstep (mirrors the candle per-point
`color`/`borderColor`/`wickColor` machinery), so the relational hash
tests stay valid.

### 3. Bookkeeping + dispose

Track the run-series per slot in state (a map) so re-emits reuse/extend
runs deterministically and `dispose` removes them all. Ensure
`visible:false` hides all runs of the slot. Mind LC's "strictly
increasing unique time per series" rule within each run.

### 4. Tests + docs

- omitted `colorValue` ⇒ single series, identical to today.
- present `colorValue` with a mid-series color change ⇒ two run series
  with the boundary bar duplicated; the mock records the per-run
  `addSeries` color (options recorded since the earlier fix).
- `colorValue: null` mid-series ⇒ a gap (run ends; no series spans it).
- histogram per-point color path covered (incl. `null` whitespace).
- Update `examples/lightweight-charts-adapter/CLAUDE.md` with the
  per-color-run line strategy (the documented LC-specific realization of
  the universal `colorValue` contract).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/createLightweightChartsAdapter.ts` | Modify | Per-run line series; histogram per-point color; run bookkeeping + dispose |
| `src/testing.ts` | Modify (if histogram per-point color asserted) | Grow `LwcDataPoint` + `dataPoint` + `canonicalise` in lockstep |
| `src/createLightweightChartsAdapter.test.ts` | Modify | Run-split / null-gap / histogram colorValue tests |
| `examples/lightweight-charts-adapter/CLAUDE.md` | Modify | Per-color-run line colorValue invariant |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm test` (lwc 100% coverage — every run/gap/boundary branch)
- `pnpm conformance` (plot-hash `{bar,value}` unaffected)
- `pnpm adapters:generate` + `pnpm adapters:gate`
- `pnpm docs:check`

## Changeset

`.changeset/lwc-line-colorvalue.md` — private example package (empty
changeset).

## Acceptance Criteria

- Line/step/area honor `colorValue` via per-color-run series; histogram
  via per-point color; `null` ⇒ gap; omitted ⇒ single-series byte-
  identical to today.
- Run bookkeeping disposed cleanly; `visible:false` hides all runs.
- 100% coverage; conformance + `adapters:gate` green; `CLAUDE.md`
  updated; changeset committed. Completes line-family `colorValue` in
  all five adapters.
