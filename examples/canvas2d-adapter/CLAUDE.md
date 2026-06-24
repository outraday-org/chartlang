# examples/canvas2d-adapter/

Reference adapter package — **not published to npm**.

## Shared geometry layer (multi-library-adapters Task 4)

- **Drawings render through the shared adapter-kit geometry layer, not a
  local `render/draw/` tree.** `paintSortableMark`'s `case "drawing"`
  (`createCanvas2dAdapter.ts`) calls
  `for (const prim of decomposeDrawing(mark.drawing, viewport))
  paintPrimitive(state.ctx, prim)` — `decomposeDrawing` from
  `@invinite-org/chartlang-adapter-kit` (exhaustive over all 63
  `DrawingKind`s) and `paintPrimitive` from
  `@invinite-org/chartlang-adapter-kit/canvas`. The entire
  `src/render/draw/` directory (63 per-kind renderers, `drawingDispatch.ts`,
  and the moved geometry helpers `worldToCanvas`/`bezier`/`gannLevels`/
  `pitchforkGeom`/`lineExtend`/`arrowhead`/`chevron`/`namedPolyline`/
  `fibLevels`/`shapeStyle`/`textStyle`, plus the `draw/index.ts` barrel
  and all co-located tests) was **deleted** — do not re-create it. To
  change drawing geometry, edit the adapter-kit decomposers, never fork
  them here. `op:"remove"` is dropped by `applyDrawing` before render, so
  `decomposeDrawing` only ever sees live drawings.
- **`src/render/lineDash.ts` stays.** `dashPattern` was *copied* into
  adapter-kit `_lib/dash.ts`, not moved — the surviving plot renderers
  (`render/area.ts`, `render/horizontalLine.ts`) still import it.
- **Only DRAWINGS are shared. Plot/candle/marker/glyph/hline/pane/axis/
  alert renderers under `src/render/` stay local** (they map to native
  facilities per the architecture decision and are NOT part of
  `decomposeDrawing`).
- **`Viewport` / `timeToX` / `priceToY` AND the bar-shift helpers
  (`projectShiftedX` / `shiftedBarTime` / `medianBarSpacing`) are
  re-exported from adapter-kit** by `src/render/coords.ts` (no parallel
  copy). The shift helpers were promoted to adapter-kit's
  `geometry/shift.ts` so all five adapters share one xShift contract; the
  re-export keeps every `./render` import site unchanged and `extendXMaxForShifts`
  (still local — it also walks glyph overlays + drawing anchors) calls the
  shared `shiftedBarTime`. Only `yToPrice` and the adapter-layer render
  types (`PlotPoint` / `HLine`) stay defined locally in `coords.ts`.
- **`RenderCtx` is re-exported from `@invinite-org/chartlang-adapter-kit/canvas`**
  by `src/render/clear.ts` (the structural type lives once in the shared
  canvas sink). `clear()`/`clearFrame` helpers stay local.
- **`src/testing.ts` re-exports the shared `MockCanvasContext` as
  `MockCanvas2DContext`** (plus `hashCallLog` + the `RecordedCall` type)
  from `@invinite-org/chartlang-adapter-kit/canvas`. The `./testing`
  export-map entry and the public `MockCanvas2DContext` name are
  unchanged — see the Phase-1 invariant below. The mock implementation +
  its coverage now live in adapter-kit.
- **The integration `PINNED_HASH` is unchanged by this refactor.** The
  pinned EMA-cross bundle emits zero drawings, so the drawing code path is
  not exercised by the hash; the geometry was moved, not changed, so the
  structural forecast-line / anchored-line drawing assertions hold. Re-pin
  only on a deliberate visual change, as before.

## Interaction (zoom / pan / auto-fit)

- **`state.view` is an adapter-kit `ViewController`; `computePaneViewport`
  resolves the x-window through it.** Per frame it calls
  `state.view.resolveXWindow(dataXMin, dataXMaxExtended, autoFollowXMin)` —
  the auto-follow range until the user wheels/drags, then the held window. y
  auto-fits the VISIBLE window via `computeYRange(..., win)` →
  `yRangeInWindow` (bars + series filtered to the window; hlines folded in
  unconditionally), matching lightweight-charts' auto price scale.
- **`opts.initialVisibleBars` frames the default view on the most recent N
  bars.** `computePaneViewport` derives `autoFollowXMin = bars[len - N].time`
  (only when `N` is set, `> 0`, and `len > N`; else `undefined`) and threads
  it as the 3rd `resolveXWindow` arg, so the chart opens showing the last N
  bars while the rest stay scrollable (pan / zoom-out). Once the user
  interacts the held window wins and `autoFollowXMin` is ignored. The option
  is **never defaulted** in the adapter — `undefined` ⇒ fit all data,
  byte-identical to the pre-feature render (so a caller that does not opt in
  keeps every pinned hash). It is stored on state via the conditional-spread
  idiom (`exactOptionalPropertyTypes`).
- **DOM listeners attach ONLY to a real canvas.** The interaction-wiring
  block (`attachInteraction(opts.canvas, …)`) is guarded by
  `typeof opts.canvas.addEventListener === "function"` and `/* v8 ignore */`d
  — headless tests pass `opts.ctx` + a bare `{ width, height }` canvas, so no
  listeners attach. `requestRender` is `renderFrame(state)` (the loop only
  repaints on candle events); the detach fn is stored on state and called in
  `dispose`.
- **`redraw(handle)` is the exported interaction re-render entry** (retrieves
  state via the `HANDLE_STATE` WeakMap; throws the sentinel on a foreign
  handle). The DOM handlers call `renderFrame` directly; `redraw` is the
  public seam for the same.
- **Plain `line` plots stroke as a monotone-cubic curve by default.**
  `paintSeries` passes `smooth = style === undefined || style.kind === "line"`
  to `drawLine`; a smoothed run of ≥3 finite points is emitted as
  `bezierCurveTo` segments from `render/monotoneSpline.ts`
  (`monotoneCubicSegments`, Fritsch–Carlson tangents — passes THROUGH every
  point with NO overshoot, so the curve never invents a peak the data lacks).
  Step-lines, area edges, and 2-point runs stay straight (`lineTo`); NaN gaps
  still split into independent runs. `bezierCurveTo` was added to the shared
  adapter-kit `RenderCtx` + `MockCanvasContext` (type, mock, `RecordedCall`
  union, `canonicalise`). The non-smooth (`smooth = false`) path is
  byte-identical to the old straight polyline, so step-line/area goldens hold;
  `integration.test.ts`'s `PINNED_HASH` was re-pinned once for the EMA-cross
  bundle's now-curved plot lines. The library adapters smooth via their native
  options (konva `tension`, echarts `smooth`, uplot spline paths, LC
  `lineType: Curved`) for cross-adapter parity.
- **The pinned `hashCallLog` was re-snapped for the line-style change.**
  `drawLine` now emits `lineWidth` (`PLOT_LINE_WIDTH_PX = 1`) + round
  `lineJoin`/`lineCap` before stroking each plot series (thin like
  TradingView; the smoothness is the round joins + the monotone curve above),
  so the default frame's call log changed and `integration.test.ts`'s
  `PINNED_HASH` was updated. `lineJoin`/`lineCap` were added to the shared adapter-kit
  `RenderCtx` + `MockCanvasContext` (type, mock, `RecordedCall` union — the
  generic `set` `canonicalise` arm needed no change). Candle bodies now floor
  at `MIN_BODY_WIDTH_PX = 1` (`render/candles.ts`) so they never collapse to
  wicks-only when many bars are packed in; with few bars the body is already
  wider than 1px so existing candle hashes/tests are untouched. The `lineJoin`/`lineCap` were added to the shared adapter-kit
  `RenderCtx` + `MockCanvasContext` (type, mock, `RecordedCall` union — the
  generic `set` `canonicalise` arm needed no change). Candle bodies now floor
  at `MIN_BODY_WIDTH_PX = 1` (`render/candles.ts`) so they never collapse to
  wicks-only when many bars are packed in; with few bars the body is already
  wider than 1px so existing candle hashes/tests are untouched. The
  auto-follow no-interaction frame (no `initialVisibleBars`) still resolves to
  the full data range, so only the line-style setters moved the hash.
- **`opts.devicePixelRatio` (default 1) scales the RENDER via one ambient
  transform so HiDPI strokes are full-thickness, not half-thick hairlines.**
  When the caller backs the canvas at `cssWidth * dpr` and lays it out at
  `cssWidth` (the retina-crispness idiom the react-starter seam uses),
  `renderFrame` applies `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` once and lays
  the panes out in **CSS px** (`canvas.{width,height} / dpr`), so every absolute
  size — `ctx.lineWidth` (the `1`px plot line / `1`px wick), `MIN_BODY_WIDTH_PX`,
  the `*px` fonts, `Y_AXIS_GUTTER_PX` — renders at its intended CSS thickness and
  the GPU upsamples to the backing store. WITHOUT this, a `lineWidth = 1` on a 2×
  backing store is `0.5` CSS px — the thin / edgy hairline bug. Because the
  viewport (`pxWidth`) is now CSS px and pointer events are CSS px, the wheel/drag
  handlers do NOT multiply by `dpr` (`pxToWorldX` / `worldXPerPx` map CSS→world
  directly). **`dpr === 1` skips `setTransform` and lays out in backing px exactly
  as before — byte-identical, so every pinned hash and the headless tests are
  untouched** (the `dpr !== 1` branch is covered by a dedicated HiDPI render test).
  `setTransform` was added to the shared adapter-kit `RenderCtx` + `MockCanvasContext`
  (type, mock, `RecordedCall` union, `canonicalise`) in lockstep.

## Conventions

- `package.json` carries `"private": true` and the unscoped name
  `chartlang-example-canvas2d-adapter`. No `publishConfig`. No
  `repository.directory` field.
- Same six-file §22.4 surface as `packages/*` (generated by
  `pnpm scaffold`). Do not hand-edit the generated template files;
  edit `scripts/scaffold.ts` and re-run.
- The intent is "copy from this folder when writing your own adapter".

## Phase-1 invariants

- **`MockCanvas2DContext` lives at `src/testing.ts`, exposed via
  the `"./testing"` sub-path entry in `package.json`'s `exports`
  map.** Coverage applies — `src/testing.test.ts` walks every
  method and setter. Task 12's conformance harness imports the
  mock from `chartlang-example-canvas2d-adapter/testing`. Do not
  move the file under `src/__fixtures__/` — fixtures are excluded
  from coverage and from package consumers.
- **No `node-canvas` dependency.** The hand-rolled
  `MockCanvas2DContext` is the only test-time canvas. Adding
  `node-canvas` reintroduces a native build step and is incompatible
  with Phase-1's portability target.
- **Renderer helpers under `src/render/` are pure on `ctx`.** Each
  helper takes a `RenderCtx` (the structural type the mock + the
  real `CanvasRenderingContext2D` both satisfy) plus the world-
  coordinate inputs. No DOM mutation outside `ctx`. No setTimeout,
  no requestAnimationFrame, no document access.
- **`runRendererLoop` yields after every `host.push(...)`.** The
  yield (`await new Promise(r => setTimeout(r, 0))`) gives an
  async worker host time to complete its candle-event dispatch
  before the next `drain` frame arrives. In-process stub hosts
  resolve `push` synchronously and the yield is a no-op for them.
  Removing the yield breaks the worker integration test.
- **`runRendererLoop` is registered against the handle via a
  module-local `WeakMap`.** The renderer's `AdapterState` (bars,
  plot series, hlines, recent alerts) is not on the public
  `Canvas2dAdapterHandle` surface — `runRendererLoop` retrieves it
  through the WeakMap so consumers cannot mutate the state
  directly. A `runRendererLoop(handle)` call on a foreign handle
  throws the documented sentinel.
- **The integration test compiles an EMA-cross-equivalent bundle
  inline.** The Phase-1 compiler bundles via `esbuild.transform`
  (single-file), so a real `defineIndicator(...)` source with
  `import { ... } from "@invinite-org/chartlang-core"` cannot be
  loaded via the worker's `data:` URL import (no resolver). The
  integration test mirrors `host-worker/src/integration.test.ts`'s
  literal-`{ manifest, compute }` pattern and uses `ctx.ta.ema(
  slotId, ctx.bar.close, length)` directly. Task 12's CLI-driven
  conformance pipeline exercises the on-disk bundle path.
- **`hashCallLog` canonicalises floats to 4 decimal places.** The
  integration test's pinned hash is robust to microscopic floating-
  point drift across runs. A deliberate visual change re-shapes
  the call log and the pinned constant in `integration.test.ts`
  must be updated.
- **`createCanvas2dAdapter` accepts an `opts.ctx` test seam.** When
  supplied, the factory skips `canvas.getContext("2d")` resolution
  and uses the supplied `RenderCtx` directly. Production callers
  pass a real `HTMLCanvasElement`; tests pass a
  `MockCanvas2DContext`.

## Phase-2 invariants

- **`RenderCtx` is the shared structural type, now owned by adapter-kit.**
  `src/render/clear.ts` **re-exports** `RenderCtx` from
  `@invinite-org/chartlang-adapter-kit/canvas` (Task 4); the structural
  `CanvasRenderingContext2D` subset every renderer + `MockCanvas2DContext`
  satisfies lives once in `packages/adapter-kit/src/canvas/renderCtx.ts`.
  It covers the line + arc + setter surface plus `fillText`,
  `globalAlpha`, `font`, `textAlign`, `textBaseline`, and the line-style
  setters `lineWidth` / `lineJoin` / `lineCap` (the latter two added for the
  round-joined plot line). Extensions are made
  in adapter-kit — the type, the mock (`MockCanvasContext`), and its
  `canonicalise` rule grow in lockstep there so `hashCallLog` stays
  stable; canvas2d picks the change up through the re-export.
- **`src/render/` Phase-2 renderers stay pure-on-`RenderCtx`.**
  `histogram.ts` / `area.ts` / `filledBand.ts` / `label.ts`
  / `marker.ts` each take a `RenderCtx` + a typed args bag + a
  `Palette` and emit exactly one canonical call sequence. Each has a
  paired `<name>.test.ts` asserting the call sequence against
  `MockCanvas2DContext.calls`. Adding a new renderer = add the file
  + the test + the re-export through `render/index.ts`; the
  conformance pipeline picks up the wider cap surface automatically.
- **The `fill-between` drawing kind (and all other drawing geometry) now
  lives in the shared adapter-kit geometry layer** (`decomposeFillBetween`
  in `packages/adapter-kit/src/geometry/kinds/boxes.ts`), painted by
  `paintPrimitive`. The former local `render/draw/fillBetween.ts` +
  `drawingDispatch.ts` were deleted in Task 4 (see "Shared geometry
  layer" above). The behavioural contract (closed filled polygon, edge
  fill + optional outline, degenerate-edge no-op) is preserved in the
  decomposer.
- **`createCanvas2dAdapter.ts` does NOT dispatch to the Phase-2
  renderers in this task.** The runtime's `plot` impl
  (`packages/runtime/src/emit/plot.ts`) still hardcodes `kind:
  "line"`, so no Phase-2 `PlotStyle` reaches `applyPlot`. Per-port
  Phase-2 tasks (Tasks 21+) wire each new kind into both the runtime
  emit path and the adapter dispatch when they introduce the
  matching primitive. Task 1 ships the renderers in pure-helper form
  so wiring lands one-line later.

## Plot x-shift invariants

- **Shifted-series plot styles render through `projectShiftedX`
  (`render/coords.ts`).** A `PlotEmission.xShift` (signed integer bars;
  `+n` right / future, `−n` left / past) displaces where a series draws,
  not its value. Line / step-line / histogram store `bar` + `xShift` on
  each `PlotPoint`; shape / character / arrow glyphs read `bar` + `xShift`
  off the stored `PlotEmission` in `plotOverlays`. Every shifted-series
  render path funnels through `projectShiftedX`, which resolves the
  displaced world time via `shiftedBarTime(bars, bar, xShift, spacing)`
  then `timeToX`. There is exactly one bar-offset → x funnel; do not map a
  shifted glyph through `timeToX(plot.time)` directly.
- **`+k` past the data edge extrapolates and extends `xMax`.** A target
  bar `bar + xShift` beyond the last bar has no real time, so
  `shiftedBarTime` extrapolates from the last bar's time and the run's
  **median bar spacing** (`medianBarSpacing(state.bars)`, computed once per
  frame in `renderFrame`). `computePaneViewport` then widens `xMax` (via
  `extendXMaxForShifts`) so the projected point stays inside the plot area
  instead of being clipped off the right edge. A far-past `−k` (before bar
  0) extrapolates left and is drawn at a negative x (canvas-clipped, like
  any pre-shift off-screen point) — `xMin` is not extended.
- **`xShift` omitted / `0` is byte-identical to the no-shift render.**
  `shiftedBarTime` returns the bar's own time for an in-range, zero-shift
  point, so `projectShiftedX === timeToX(point.time)`; the stored
  `PlotPoint` omits `xShift` when it is absent or `0`; `extendXMaxForShifts`
  only fires on `xShift > 0`. No-shift frames keep today's hashes.
- **Candle-state overrides ignore `xShift`.** `bg-color` / `bar-color` /
  `candle-override` / `bar-override` / `horizontal-histogram` are candle /
  background state at a bar, not shifted series visuals: their render
  anchors on the bar's own time and `extendXMaxForShifts` skips them. This
  is explicit (unit-tested), not accidental.
- **Future-anchored drawings widen `xMax` too.** Drawings render only in
  the overlay pane (`renderOverlayTail`), and their anchors persist as
  absolute world `(time, price)` tuples — not `bar` + `xShift`. So a
  `bar.point(+k, …)` endpoint (e.g. `forecast-line`'s `draw.line`, whose
  forward anchor resolves to `lastTime + k · spacing`) lands past the data
  edge and, before this widening, started on the right edge with the rest
  of the segment overflowing off-canvas — invisible. `extendXMaxForShifts`'
  overlay branch now also walks `state.drawings` and folds in
  `maxDrawingAnchorTime(drawing.state, …)`, the largest finite `time`
  anchored anywhere in the state. That walk is **structural** (recurses any
  nested object/array, takes any finite `time` key) so the 60-kind
  `DrawingState` union — `anchors` / `anchor` / `edgeA` / `edgeB` /
  vertical-line's bare `time` — needs no per-kind enumeration, and it is
  defensive against unexpected state shapes (`null` fields and non-numeric
  `time` keys are skipped, never poisoning `xMax` with `NaN`). Drawings
  fully inside the data range leave `xMax` untouched; only the future case
  fires. Like the plot path, `xMin` is **not** extended for far-past
  anchors (canvas-clipped at negative x).

## Phase-5 invariants

- **`createMultiStreamCandlePump` interleaves secondary closes WITHIN a
  `history` batch.** A `close` / `tick` main event keeps the original
  "flush secondary bars with `time <= mainTime`, then yield the event"
  order. A `history` event is different: it carries many bars, so the
  pump splits it and weaves the due secondary closes between the history
  bars (emitting the buffered chunk, then `drainSecondary(bar.time)`,
  before each history bar a secondary candle has reached). Without the
  split, a monolithic batch gates the secondary flush on the batch's
  *last* timestamp — every secondary bar is dumped up front, the cap-1
  secondary ring buffer (`maxLookback + 1` for a no-lookback MTF script)
  retains only the final future-dated bar, and `request.security`
  alignment is all-NaN across the replayed history (e.g. the demo's
  `htf-trend-filter` weekly EMA never drew). The split is loss-free
  (every main bar survives in source order) and reproduces the per-bar
  streaming path's finite higher-timeframe series. `streamPump.test.ts`
  pins both the streaming order and the multi-bar history interleaving;
  `integration.test.ts` pins a finite weekly EMA under `mode: "history"`.

## Z-order render pass invariants

- **`renderFrame` paints sortable marks through ONE global z-sort pass
  per pane, not a hard-coded band sequence.** `collectSortableMarks`
  gathers every sortable mark for a pane — plot **series**, **glyph**
  overlays (shape / character / arrow / horizontal-histogram, overlay
  pane only), horizontal **lines**, and **drawings** (overlay pane only)
  — tags each with `(z, band, seq)`, and `sortByRenderOrder`
  (`render/renderOrder.ts`) **stable-sorts** ascending by `z`, then
  `band`, then `seq`. `paintSortableMark` then dispatches each mark to
  its existing per-kind renderer (`paintSeries` / `paintGlyph` /
  `drawHorizontalLine` / the `decomposeDrawing` + `paintPrimitive`
  drawing arm). The sort changed **order**, not per-mark drawing.
- **`BAND = { series: 0, glyph: 1, hline: 2, drawing: 3 }` reproduces the
  pre-`z` phase order.** At the default `z = 0` the composite key reduces
  to `(band, declarationSeq)` = series → glyphs → hlines → drawings in
  declaration order — **byte-identical** to the old hard-coded sequence
  (the `integration.test.ts` pinned hash holds because EMA-cross has no
  drawings; the z-order tests pin the band order directly). A drawing at
  `z < 0` sorts beneath `z = 0` plots; a plot at `z > 0` sorts above
  drawings — the lever a fixed band stack cannot express.
- **Substrate stays below, alerts stay above — both `z`-independent.**
  Background fills (`bg-color`), candles, the price axis, and
  bar/candle overrides paint **before** the sorted pass (still in
  `renderBackgroundOverlays` / `drawCandles` / `renderBarOverlays`).
  Alert badges, alert conditions, and the log pane paint **after**, in
  `renderOverlayTail` — they are pinned on top, **not** sortable by `z`
  in v1 (a deliberate deferral). Only plots + glyphs + hlines + drawings
  participate in the `z` sort.
- **`state.plotOverlays` is partitioned by style.** It holds glyph marks
  AND substrate overlays; `isGlyphOverlay` selects only the glyph subset
  (shape / character / arrow / horizontal-histogram) into the sorted
  band. `bg-color` keeps painting with the background, bar/candle
  overrides with the candles — neither is `z`-sorted.
- **Drawings moved OUT of `renderOverlayTail` into the sorted pass.**
  They render in the overlay pane's translate during the pane walk
  (same offset as before), so a `z`-bearing drawing layers against plots.
  `renderOverlayTail` now paints only the always-on-top alert tail.
- **`z` / `seq` are assigned at ingest and persisted per mark.**
  `applyPlot` / `applyDrawing` read `emission.z ?? 0` and a global
  `state.seq++` (ingest order = declaration order). `PlotPoint` and
  `HLine` (`render/coords.ts`) carry `z`/`seq` inline; glyph overlays and
  drawings keep their `seq` in the parallel `overlaySeq` / `drawingSeq`
  maps (written in lockstep with `plotOverlays` / `drawings`), since
  those stores hold the raw emission (which carries `z` but not `seq`).
  A series mark uses its **last** point's `z`/`seq` (last-write-wins,
  like its style).
- **Sorting is per-pane, never cross-pane.** Panes paint in pane order;
  each pane's marks are collected and sorted independently. A subpane
  mark's `z` cannot reorder it into the overlay pane — `z` orders within
  the resolved pane only (per the README's per-pane scope).
