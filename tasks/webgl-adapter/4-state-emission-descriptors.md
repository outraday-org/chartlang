# Adapter state + emission ingestion + layer descriptors + window/y-fit

> **Status: TODO**

## Goal

Build the **pure, headless-testable** bridge between chartlang emissions
and the GPU: an `AdapterState` (bars, plot series, hlines, drawings,
alerts, overrides, pane order), an `onEmissions` ingestion that maps
`RunnerEmissions` into that state, and a per-frame builder that turns
state into renderer-agnostic **layer descriptors** (the input the GPU
programs consume in Task 5+). Reuses the shared `ViewController` for the
x-window (incl. `initialVisibleBars`) and `yRangeInWindow` for the
y-autofit.

## Prerequisites

Task 1 (state surface, capabilities), Task 3 (descriptor consumers will
project via ortho2d; the resolved window feeds it).

## Current Behavior

`onEmissions` is a no-op; no state.

## Desired Behavior

`onEmissions(emissions)` accumulates into `AdapterState` exactly like the
canvas2d adapter (last-write-wins per slot, pane-keyed series, z/seq at
ingest), and a pure `buildFrame(state, window)` returns a
`PaneRenderState[]` of typed `LayerDescriptor`s (candle / line-strip /
etc.) ready for the GPU — all without touching `gl`.

## Requirements

1. **`src/state.ts`** — define `AdapterState` mirroring canvas2d's
   (`bars`, `paneOrder`, `plotSeries` + `plotSeriesStyle` keyed
   `${paneKey}|${slotId}`, `plotOverlays`, `hlines`, `drawings`,
   `recentAlerts`, `currentAlertConditions`, `recentLogs`, `seq`,
   `overlaySeq`/`drawingSeq`, `palette`, `view: ViewController`,
   `initialVisibleBars?`). Construct `view` via `createViewController()`.

2. **`src/ingest.ts`** — `applyEmissions(state, emissions)`: port the
   **post-parity** canvas2d ingestion (applyPlot / applyDrawing / candle
   accumulation / alert+log ring buffers / z+seq assignment). **Reuse, do
   not fork**, the emission shapes from adapter-kit. Handle `bg-color` /
   `bar-color` / `candle-override` / `bar-override` /
   `horizontal-histogram` into the override stores (rendered in Task 14).
   Retain per-bar `colorValue` for **line-family** slots (line / step /
   area / histogram), not just bg/bar-color — the 3-state contract
   (omitted ⇒ static, present ⇒ override, `null` ⇒ gap) that
   `tasks/adapter-feature-parity` Task 3 established as the cross-adapter
   reference; the per-segment recolor is applied in Task 7. Pure →
   unit-test thoroughly.

3. **`src/layer-descriptor.ts`** — port invinite's `layer-descriptor.ts`
   (adapted) + `colors.ts` (bull/bear/palette color resolution). Define
   the descriptor union (`candle-bodies`, `candle-wicks`, `line-strip`,
   `vertical-bars`, `filled-band`, `cursor`, `marker`, `drawing`, `text`)
   carrying ONLY plain data (Float32Array packs or the inputs to pack) —
   no `gl`. Provenance header.

4. **`src/buildFrame.ts`** — pure `buildFrame(state, layoutRects)`:
   - Compute `dataXMin/dataXMax` over `state.bars`; derive
     `autoFollowXMin = bars[len-N].time` when
     `state.initialVisibleBars` is set (`N>0 && len>N`), else `undefined`
     (mirror the canvas2d contract exactly).
   - `const win = state.view.resolveXWindow(dataXMin, dataXMax, autoFollowXMin)`.
   - y-autofit the visible window via `yRangeInWindow(candidates, win)`
     (bars `{x,lo,hi}` + series points; hlines folded by the caller),
     with the same degenerate/pad fallback canvas2d uses.
   - Emit per pane a `PaneRenderState { paneKey, window:{xMin,xMax,yMin,yMax},
     layers: LayerDescriptor[] }`. The descriptor builders honor `xShift`
     via `projectShiftedX`/`medianBarSpacing` (reuse) and z/seq ordering.
   - **Pure** → unit-test the window/y-fit/descriptor output for: empty
     bars, fewer-than-N bars (full window), N-windowed, NaN gaps, xShift.

5. The world window from `buildFrame` is what Task 5 feeds to `ortho2d`
   (per pane). Keep `buildFrame` ignorant of clip space — it stays in
   world (time, price).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/webgl-adapter/src/state.ts` | Create | `AdapterState` + construction |
| `examples/webgl-adapter/src/ingest.ts` | Create | `applyEmissions` ingestion |
| `examples/webgl-adapter/src/layer-descriptor.ts` | Create | Descriptor union + colors |
| `examples/webgl-adapter/src/buildFrame.ts` | Create | Pure state→descriptors + window |
| `examples/webgl-adapter/src/*.test.ts` | Create | Ingestion + buildFrame unit tests |

## Gates

- `pnpm typecheck` · `pnpm lint` · `pnpm format:check` · `pnpm test`
- `pnpm conformance` (unchanged)

## Changeset

None.

## Acceptance Criteria

- `applyEmissions` reproduces the post-parity canvas2d accumulation
  semantics (last-write-wins, pane keys, z/seq, override stores,
  line-family `colorValue` retained per bar), unit-tested.
- `buildFrame` is pure and unit-tested: window math matches the
  `initialVisibleBars` contract; y-autofit uses `yRangeInWindow`; xShift
  via the shared helpers; descriptors carry plain data only.
- No `gl` reference in any file in this task; shared adapter-kit helpers
  reused (not forked).
