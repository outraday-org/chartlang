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
  microscopic drift does not re-hash. The canvas2d adapter re-exports
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
- **`worldPointToPixel` does NOT do bar-shift projection.** It composes
  `timeToX` / `priceToY` only. The shifted-series helpers
  (`projectShiftedX`, `shiftedBarTime`, `medianBarSpacing`) stay in the
  canvas2d adapter's `render/coords.ts` for plot rendering.

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
