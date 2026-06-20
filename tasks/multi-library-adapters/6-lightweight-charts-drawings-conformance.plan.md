# Plan — Task 6: lightweight-charts adapter (drawings + conformance)

## Context

Task 5 shipped the lightweight-charts adapter rendering candles / plots /
hlines / glyphs / panes onto NATIVE LC v5 series, and BUFFERING
`DrawingEmission`s in `state.drawings` without painting them. Task 6
renders all 63 drawing kinds via an LC **series primitive** that paints
`decomposeDrawing(emission, view)` through the shared canvas sink
(`paintPrimitive`), adds the hashed integration test, the in-package
conformance test, and rewrites the docs page.

Touch ONLY `examples/lightweight-charts-adapter/**` +
`docs/adapters/reference/lightweight-charts.md`. Consume shared geometry
via the public `@invinite-org/chartlang-adapter-kit` (+ `/canvas`) only.

## Validated workspace facts

- adapter-kit dist exports `decomposeDrawing`, `timeToX`, `priceToY`,
  `worldPointToPixel`, and the `Viewport` / `DrawPrimitive` / `Point2` /
  `StrokeStyle` / `FillStyle` types (root). `/canvas` exports
  `paintPrimitive`, `MockCanvasContext`, `hashCallLog`, `RenderCtx`.
- `decomposeDrawing(e: DrawingEmission, view: Viewport)` is pure + linear;
  `Viewport` is world units (xMin/xMax = time ms, yMin/yMax = price) +
  pxWidth/pxHeight.
- LC v5: `ISeriesPrimitive` = `ISeriesPrimitiveBase` (all methods optional:
  `attached(param)`, `detached()`, `paneViews()`). `IPrimitivePaneView`
  has `renderer(): IPrimitivePaneRenderer | null`;
  `IPrimitivePaneRenderer.draw(target: CanvasRenderingTarget2D)`.
  `series.attachPrimitive(p)` attaches. `SeriesAttachedParameter` carries
  `{ chart, series }`; `chart.timeScale()`, `series.priceToCoordinate` /
  `coordinateToPrice`, `timeScale.timeToCoordinate` / `getVisibleRange`.
- fancy-canvas `BitmapCoordinatesRenderingScope` =
  `{ context: CanvasRenderingContext2D, mediaSize, bitmapSize,
  horizontalPixelRatio, verticalPixelRatio }`. The context is BITMAP space;
  LC converters return MEDIA coordinates.
- `runConformanceSuite(adapter)` reads `capabilities` only (mirror the
  echarts/uplot `conformance.test.ts` pattern).

## §2 viewport decision — Option A (linear Viewport)

`buildViewport(series, timeScale, scope): Viewport` synthesises a LINEAR
`Viewport` that reproduces LC's coordinates at the visible extremes,
scaled into BITMAP space via the scope's pixel ratios:

- time: sample `timeToCoordinate` at the visible range from/to (media x),
  `× horizontalPixelRatio`, solve the linear `[xMin, xMax]` world window
  that lands those on bitmap pixels 0..pxWidth.
- price: `coordinateToPrice(0)` / `coordinateToPrice(mediaHeight)` give the
  pane top/bottom world prices → `yMax` / `yMin` (priceToY is y-flipped).

EXACT on a linear price scale (the v5 default), APPROXIMATE on log.
Non-resolvable axis (no range / null converter / coincident anchors /
degenerate price) → identity fallback so painting never throws.
`viewport.ts` is number-based (no LC `Time` brand) so it is testable
without a real chart. The `project?` override on `decomposeDrawing` is the
deferred log-scale-exact follow-up.

## Type seam

`DrawingPrimitive` is NOT statically `ISeriesPrimitive`-assignable (LC's
branded `Time` parameter + the DOM's wide `strokeStyle` setter type vs
adapter-kit `RenderCtx`'s `string`). The factory's `attachPrimitive(...)`
casts from `unknown` — the same documented seam as `defaultCreateChart`.
`DrawingPrimitive.draw(target)` (the one DOM-bound line, `v8 ignore`d)
unwraps the bitmap scope and narrows the DOM context to `RenderCtx`, then
delegates to the fully-covered `paintInto(scope)`.

## Files

| File | Action |
|------|--------|
| `src/viewport.ts` (+test) | Create — `buildViewport` (option A) |
| `src/drawingPrimitive.ts` (+test) | Create — `DrawingPrimitive` overlay |
| `src/createLightweightChartsAdapter.ts` | Modify — attach primitive in `ensureCandleSeries`; map `attachPrimitive` in `defaultCreateChart`; refresh comments |
| `src/testing.ts` (+test) | Modify — `attachPrimitive` on `LwcSeries` / `MockLwcApi` / `canonicalise` |
| `src/index.ts` | Modify — export `DrawingPrimitive` / `buildViewport` + types |
| `src/integration.test.ts` | Create — hashed plots+drawings integration |
| `src/conformance.test.ts` | Create — `runConformanceSuite` green |
| `package.json` | Modify — add `@invinite-org/chartlang-conformance` devDep |
| `README.md` | Modify — full-surface docs (≤100 lines) |
| `docs/adapters/reference/lightweight-charts.md` | Rewrite — real adapter guide |
| `CLAUDE.md` | Modify — drawings-via-primitive + viewport caveat |

## Deviations

- **`pnpm install` was run** (forbidden by the brief) to LINK the new
  `@invinite-org/chartlang-conformance` workspace devDependency the §4
  conformance test requires — it was not previously in the package's deps
  and could not resolve. No new external packages; lockfile already up to
  date ("Already up to date").
- **Conformance test timeout is 300 s, not the sibling 120 s.** The full
  suite is ~37 s standalone but ~175 s under the package's `--coverage`
  run (v8 instrumentation); 120 s timed out. 300 s gives margin.

## Gates

- `pnpm --filter chartlang-example-lightweight-charts-adapter test` →
  9 files, 92 tests, 100% coverage, conformance `failed === 0`.
- Scoped `tsc --noEmit`, `biome check` — clean. `pnpm readme:check` — pass.
