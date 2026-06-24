# packages/adapter-kit/

`@invinite-org/chartlang-adapter-kit` — public (MIT) SDK for writing
chartlang rendering adapters. Ships the adapter contract, capabilities
model, emission validators, mock candles, test base classes, and (since
the multi-library-adapters feature) the **renderer-agnostic geometry
layer** every adapter shares.

## Geometry-layer invariants

- **The `DrawPrimitive` IR is the shared rendering contract.** Every
  drawing reduces to a flat `ReadonlyArray<DrawPrimitive>` of four
  shapes — `polyline` | `arc` | `text` | `marker` — with `StrokeStyle`
  / `FillStyle`. `decomposeDrawing(emission, viewport)` derives that
  list **once**; each adapter paints it with its own sink (canvas
  `paintPrimitive`, Konva nodes, ECharts `graphic`, LC primitive).
  Adapters MUST NOT re-derive per-kind geometry — extend
  `decomposeDrawing`, never fork it.
- **Decomposers are PURE.** `src/geometry/kinds/*.ts` and
  `src/geometry/_lib/*.ts` take typed state + a `Viewport` and return
  primitives — no `ctx`, no library types, no DOM. This is what keeps
  the layer testable to 100% in isolation. The `_lib` helpers
  (`bezier`, `lineExtend`, `arrowhead`, `chevron`, `namedPolyline`,
  `shapeStyle`, `textStyle`, `dash`, `fibLevels`) are package-private —
  consumed by the decomposers only, never re-exported.
- **`decomposeDrawing` is EXHAUSTIVE over all 63 `DrawingKind`s; its
  `default` arm is the `const _exhaustive: never` guard.** The switch
  covers the 20 basic kinds (Task 1) + the 20 curve / freehand / channel /
  fibonacci kinds (Task 2) + the 23 gann / pitchfork / pattern / elliott /
  cycle / container / table kinds (Task 3) — 63 of 63. The `default` is
  `{ const _exhaustive: never = e.drawingKind; void _exhaustive; return
  []; }` (mirroring canvas2d's `drawingDispatch.ts` default — no coverage
  pragma; the defensive `return []` is exercised by an unknown-kind cast
  test). Adding a future `DrawingKind` to core fails `pnpm typecheck` here
  until a decomposer is added — that is the guard. Do NOT widen the
  assignment back to `DrawingKind`. `op: "remove"` is handled by each
  adapter's drawing-state map — `decomposeDrawing` operates on whatever
  `state` it is handed.
- **`table` is the ONLY pixel-space decomposer; `group` emits `[]`.**
  `decomposeTable` ignores world transforms and resolves `state.position`
  against `Viewport.pxWidth`/`pxHeight`, emitting per-cell bg-fill
  `polyline` + `text` (+ optional per-cell border `polyline` when BOTH
  `borderColor` and `borderWidth` are set) + an optional outer `frame`
  `polyline`. Zero rows/cols → `[]` without throwing. `decomposeGroup`
  returns `[]` (metadata-only container; children render through their own
  arms). `decomposeFrame` is world-space: a closed border `polyline`
  (`#64748b`/1) + optional `bgColor` fill + optional `label` `text`;
  degenerate (zero w/h, non-finite) → `[]`. The 6 pattern + 5 elliott
  decomposers reuse `_lib/namedPolyline`; head-and-shoulders appends a
  neckline `polyline`; elliott applies the teal `#14b8a6` default unless
  `style.color` overrides, and honours `state.labels` only when its length
  matches the anchor count.
- **The `marker` drawing KIND decomposes to text, not the `marker`
  PRIMITIVE.** The reference adapter paints a marker's label only (no
  glyph), so `decomposeMarker` emits a single `text` primitive when
  `state.text` is set and `[]` otherwise. The IR `marker` primitive is
  exported for adapters / future kinds; no basic kind emits it.
- **`paintPrimitive` canonicalises the call ORDER, preserving pixel
  geometry.** It applies the stroke style, builds the path, fills before
  stroking, then resets `setLineDash([])` + `globalAlpha = 1`. The
  per-kind legacy renderers it replaces differed in property-set order;
  pixels depend on the final path + styles, so the IR fixes one
  canonical order. Adapters that re-pin a `hashCallLog` constant pin it
  against this painter's sequence.
- **The canvas sink lives under `src/canvas/` and the `./canvas`
  sub-path.** `RenderCtx` (structural type), `paintPrimitive`,
  `MockCanvasContext`, `RecordedCall`, and `hashCallLog` are shared by
  the canvas-family adapters (canvas2d, lightweight-charts, uplot).
  ECharts / Konva do NOT import it. `hashCallLog(mock.calls)` takes the
  recorded-call array and rounds floats to 4 dp before hashing, so
  microscopic drift does not re-hash. `RenderCtx` carries path-`rect` +
  `clip` (distinct from `fillRect`) so a canvas adapter can confine a
  hand-rolled draw pass to a plotting-area box via the standard
  `beginPath()` → `rect()` → `clip()` idiom (the uplot adapter clips its
  candle/band/hline/drawing overlay to uPlot's plot bbox); production
  `CanvasRenderingContext2D` already has both, and `MockCanvasContext`
  records them as `{kind:"rect"|"clip"}` (adding a draw call means
  extending the mock, the `RecordedCall` union, and `canonicalise`
  together). The canvas2d adapter re-exports
  `MockCanvasContext` as `MockCanvas2DContext` (Task 4) — implementation
  shared, its public `./testing` name unchanged.
- **`StrokeStyle.alpha` is the one IR field Task 2 added, and an omitted
  `alpha` is byte-identical to a Task-1 stroke.** `paintPrimitive`'s
  `strokeWithAlpha` brackets the `stroke()` in `globalAlpha = alpha` /
  reset to `1` ONLY when `alpha !== undefined`; with `alpha` absent it
  emits exactly `stroke()` → `setLineDash([])` and never touches
  `globalAlpha`, so adapters re-pinning a `hashCallLog` for non-highlighter
  draws keep their constant. Only the `highlighter` freehand kind sets it
  (carrying `HighlighterStyle.alpha`). The basic + curve + channel + fib
  decomposers omit it.
- **`regression-trend` + the three channels are stroke-only placeholders
  matching the source — no σ bands, no inter-rail fill.**
  `decomposeRegressionTrend` emits a single line between the two anchors
  (default `#3b82f6`): the OLS fit + ±σ bands its `RegressionTrendOpts`
  flags name need a bar buffer the `Viewport` does not expose and band
  anchors the 2-point `state` does not carry, and the canvas2d source
  renders the same placeholder. `trend-channel` / `flat-top-bottom` /
  `disjoint-channel` carry `LineDrawStyle` (no fill field) and the source
  renderers are stroke-only, so the rails are strokes with no band fill.
  "Moved, not re-derived" — do not invent band/fill geometry these state +
  style types cannot carry.
- **`fib-spiral` is the ONLY fib kind that early-returns `[]` on a zero
  radius.** It mirrors the source's `if (r === 0) return`. `fib-circles` /
  `fib-speed-arcs` do NOT early-return — they emit a (possibly zero-radius)
  `arc` per level, exactly as the source does. `fib-wedge` / `fib-speed-fan`
  skip an individual level whose ray magnitude is `0` (both its ray AND its
  label), per the source `continue`. All 10 fib decomposers read
  `style.levels ?? FIB_LEVELS` from the moved-verbatim
  `_lib/fibLevels.ts` (no parallel level array); an empty `levels` override
  yields no level primitives. Fib labels are emitted only when
  `showLabels === true`.
- **`worldPointToPixel` does NOT do bar-shift projection** — it composes
  `timeToX` / `priceToY` only. **The shifted-series helpers live in
  `src/geometry/shift.ts`** (`medianBarSpacing`, `shiftedBarTime`,
  `projectShiftedX`, `maxShiftedTime`, `shiftedBarIndex`), shared by EVERY
  adapter so a `PlotEmission.xShift` (the universal `ta` `offset`; `+n`
  right/future, `−n` left/past) projects identically across the three
  rendering models — self-scaled time (canvas2d, konva: `projectShiftedX` +
  `maxShiftedTime` to widen `xMax`), category/index (echarts:
  `shiftedBarIndex` + category extension), and aligned/native-time (uplot
  `AlignedData`, lightweight-charts native time: `shiftedBarTime`). These
  were promoted out of canvas2d's `render/coords.ts` (which now re-exports
  them) — four hand-ports were exactly how the offset-collapse bug arose.
  Pure (no `ctx` / DOM / library types), 100%-covered. `xShift` omitted / `0`
  reproduces the unshifted `timeToX(time)` byte-for-byte, so no-offset
  goldens are untouched.

## Interaction-layer invariants (`src/interaction/`)

- **`createViewController()` is the shared pan/zoom MATH; it is pure and
  DOM-free.** It holds a user x-window (world time) + a `userInteracted`
  flag. `resolveXWindow(dataXMin, dataXMax, autoFollowXMin?)` returns the
  auto-follow window `[autoFollowXMin ?? dataXMin, dataXMax]` until the user
  interacts (live bars keep extending `xMax`), then the held window
  re-clamped into the current data bounds (`autoFollowXMin` ignored once
  interacted). The optional `autoFollowXMin` (clamped into the data range)
  lets a self-scaled adapter frame only the most recent N bars by default
  (`initialVisibleBars`) while keeping the full history scrollable; omit it
  to fit all data (byte-identical to the pre-feature behaviour). `zoomAt` /
  `panBy` / `reset` are
  the transforms; `zoomAt` seeds the held window from the data bounds on the
  first call, guards a `minSpan` floor, and clamps the span to
  `dataSpan * maxSpanFactor` (default `1` ⇒ cannot zoom out past all-data).
  All branches are unit-tested to 100% — no DOM, no library types.
- **`yRangeInWindow(candidates, win)` is the shared "auto-fit the price
  scale to the VISIBLE window" helper** (lightweight-charts parity). The two
  self-scaled adapters feed bars `{x:time, lo:low, hi:high}` + series points
  and fold only in-window finite rows; horizontal lines (no `x`) are folded
  in by the CALLER, not here. Returns `undefined` when no in-window finite
  candidate exists so the caller keeps its `(0,1)` + degenerate-widen + pad.
- **`attachInteraction(el, handlers)` wires wheel→`zoomAt`, drag→`panBy`,
  dblclick→`reset`, returning a detach fn.** The `addEventListener` plumbing
  is the ONLY DOM-bound code and carries the `/* v8 ignore */` seam; the
  decision cores (`onWheelCore` / `onDragCore` / `onDblCore`) are pure and
  100% covered via synthetic-number tests. Consumers supply `pxToWorldX`,
  `worldXPerPx`, `dataBounds`, `controller`, `requestRender` (closures over
  the adapter's last overlay `Viewport`). The wheel factor is
  `Math.exp(deltaY * zoomStep)`, so zoom-out exists in BOTH directions.
- **Shipped on the ROOT `.` entry, NOT `./canvas`.** Konva (forbidden from
  `/canvas`) imports `createViewController` / `yRangeInWindow`, so the
  interaction surface rides the root barrel alongside `timeToX` / `Viewport`.
  Every export carries `@since 1.6` + `@stable` + `@example` (the gate).
- **Reused by uplot too, despite uPlot being library-scaled.** uPlot speaks
  `setScale("x")` directly, so its adapter passes `u.over` to
  `attachInteraction` and a `requestRender` that pushes
  `controller.resolveXWindow(...)` onto every pane instance. The controller
  is library-agnostic by design.

## Wire + capability invariants

- **`PlotEmission.colorValue?: Color | null` is the per-bar dynamic-color
  channel and is APPENDED (the last field), so an omitted emission is
  byte-identical to the pre-feature wire and every pinned `plot-hash`
  (`{ bar, value }` only) is untouched.** Three states, all DISTINCT:
  **omitted** ⇒ adapter uses the static color (`style.color` for
  `bg-color`/`bar-color`, the top-level `color` for line-family); **present**
  ⇒ it OVERRIDES the static color for this `(slotId, bar)` at render time
  (the precedence contract: `colorValue` wins over `style.color`); **`null`**
  ⇒ an explicit "no color this bar" gap (paint nothing), NOT the static
  fallback. It is orthogonal to numeric `value` (a `bg-color` emission still
  carries `value: null`) — do NOT widen `value` to carry color, and do NOT
  add a per-bar-color `PlotStyle` arm; both were rejected (see the field
  JSDoc rationale). Task 4 landed the TYPE; the runtime resolve + the
  `colorValue` finite-color-or-null validation (`validation/validateEmission
  .ts`) landed in Task 5; the render-time precedence (`colorValue` wins over
  the static color, `null` ⇒ paint-nothing gap) is the **normative adapter
  contract** stated on the `PlotEmission.colorValue` JSDoc and implemented in
  the canvas2d reference adapter (Task 6 — `render/bgColor.ts` +
  `createCanvas2dAdapter.ts`'s bg/bar overlays). Other adapters bind to the
  same contract as they port it.
- **`CandleEvent.streamKey` IS the composite feed key — the same string
  `feedKey(symbol, interval)` produces, byte-for-byte.** Omit it for the main
  stream; a bare interval (`"1D"`) tags a higher-timeframe stream of the
  chart's own symbol; `"<symbol>@<interval>"` (`"AMEX:SPY@1D"`) tags a
  different-symbol stream. The wire TYPE stays `string` — only the meaning
  widened. `feedKey` is re-exported from the barrel (identity from core, NOT a
  fork) so producers build the key from the one canonical helper; never
  re-derive the format inline. `mockCandleSource({ symbol })` tags its events
  through `feedKey`; omitting `symbol` leaves `streamKey` off, byte-identical
  to the single-symbol baseline.
- **`Capabilities.multiSymbol` is a required boolean, independent of
  `multiTimeframe`.** It gates non-chart-symbol `request.security` requests
  (a strictly larger ask than a higher timeframe of the chart's own symbol).
  The two are orthogonal: a builder setting one never implies the other, and
  the runtime gates per request (symbol differs ⇒ `multiSymbol`; interval
  differs ⇒ `multiTimeframe`). Default `false` (conservative; adapters opt
  in). The `multi-symbol-not-supported` NaN fallback itself lives in the
  runtime/host (the multi-symbol-security feature's Task 5), not here.

## Package-shape invariants

- **`./canvas` is hand-added to `package.json#exports`.**
  `scripts/scaffold.ts`'s `SUBPATH_EXPORTS` map is the long-term source
  of truth for subpath exports, but the scaffold's `write()` never
  overwrites an existing file, so a normal `pnpm scaffold` run leaves
  this edit intact. A full regeneration (delete + re-scaffold) would
  need `./canvas` added to `SUBPATH_EXPORTS["packages/adapter-kit"]`.
- Same six-file §22.4 template surface as every package. `index.ts`
  (barrels) and `types.ts` (declarations only) are excluded from
  coverage; everything else under `src/` is 100% line/branch/function.
  `src/canvas/renderCtx.ts` is type-only (no runtime → nothing to
  cover).
- Every export carries JSDoc with `@since`, `@example` (code block), and
  a stability marker. `@formula` / `@anchors` are NOT required here —
  `docs-check` keys those on `/src/ta/` and `/src/draw/` paths only.
- README caps at 100 lines (§17.1 structure).
