# Lightweight Charts adapter

The repo ships a working Lightweight Charts adapter at
[`examples/lightweight-charts-adapter/`](https://github.com/outraday-org/chartlang/tree/main/examples/lightweight-charts-adapter).
It renders chartlang candles, plots, horizontal lines, glyphs, and
sub-panes onto TradingView's
[lightweight-charts](https://github.com/tradingview/lightweight-charts) v5
**native** series / pane API, and paints the 63 drawing kinds through a
**series primitive** overlay. It is a private example (copy it into your own
repo) and mirrors the `canvas2d-adapter` shape: a real factory, a
capabilities-only conformance default export, a headless mock seam, and a
hashed integration test.

Lightweight Charts 5.2 creates built-in series with `chart.addSeries(...)`,
accepts full data through `setData(...)`, incremental updates through
`update(...)`, price lines through `createPriceLine(...)`, and attached
plugins through `attachPrimitive(...)`. See the official docs for
[series types](https://tradingview.github.io/lightweight-charts/docs/series-types),
[series API](https://tradingview.github.io/lightweight-charts/docs/api/interfaces/ISeriesApi),
and [plugins](https://tradingview.github.io/lightweight-charts/docs/plugins/intro).

## Public surface

- `createLightweightChartsAdapter(opts) → LwcAdapterHandle` — the factory.
  Pass `opts.container` (+ the real `createChart`) in a browser, or
  `opts.chartApi` (a `MockLwcApi`) in tests. Returns an `Adapter` plus an
  attached `ScriptHost`.
- `runRendererLoop(handle, opts?)` — drives the candle source, pushes each
  event to the host, drains, and feeds emissions back into `onEmissions`.
- `LWC_CAPABILITIES` — the full capability bag (every Phase-5 plot kind, all
  63 drawing kinds, `log`/`toast` alerts, intervals, multi-timeframe,
  unlimited sub-panes).
- `DEFAULT_ADAPTER` (the package `default`) — the capabilities-only adapter
  the conformance suite reads.
- `DrawingPrimitive` / `buildViewport` — the drawing overlay and its
  viewport builder (see [Drawings](#drawings-via-a-series-primitive)).

## Native mapping

Candles, plots, horizontal lines, glyphs, and panes use Lightweight Charts'
own facilities — they are never hand-painted:

| chartlang | Lightweight Charts |
| --- | --- |
| candle stream | `addSeries(Candlestick)`; `history` → `setData`, `close`/`tick` → `update` |
| `line` / `step-line` | `addSeries(Line)` (`lineType: WithSteps` for step) |
| `area` | `addSeries(Area)` |
| `histogram` | `addSeries(Histogram)` |
| `horizontal-line` | `series.createPriceLine` on the pane anchor series |
| `filled-band` | two `Line` series; the fill between them is a drawing |
| `shape` / `character` / `arrow` / `marker` / `label` | the v5 markers plugin (`createSeriesMarkers`) |
| `candle-override` / `bar-override` / `bar-color` | `candleSeries.applyOptions` (whole-series tint) |
| `bg-color` / `horizontal-histogram` | documented no-ops (no native facility) |

`visible: false` hides a series (`applyOptions`), never removes it. A
non-finite / `null` plot value becomes a whitespace point so the native
series leaves a gap instead of a break. Panes route `"overlay"` → pane 0,
`"new"` → a fresh `addPane()`, a named string → a stable index. The
authoritative per-kind table is the file header of
`src/createLightweightChartsAdapter.ts`.

## Drawings via a series primitive

Lightweight Charts has no native facility for the 63 chartlang drawing
kinds, so they paint as an overlay through the v5 series-primitive plugin
API. The factory buffers every live `DrawingEmission` (last-write-wins;
`op: "remove"` drops the key) and attaches one `DrawingPrimitive` to the
overlay candle series. Each frame the primitive's pane renderer:

1. builds an adapter-kit `Viewport` from LC's converters
   (`buildViewport`), then
2. paints `decomposeDrawing(emission, view)` — the shared, renderer-agnostic
   geometry IR from
   [`@invinite-org/chartlang-adapter-kit`](https://github.com/outraday-org/chartlang/tree/main/packages/adapter-kit) —
   through `paintPrimitive`, the shared canvas sink.

No drawing geometry lives in the adapter: it consumes the same
`decomposeDrawing` / `paintPrimitive` the `canvas2d` adapter uses, so all
63 kinds (fib / Gann / Elliott / pitchfork / pattern / cycle / container /
table) render identically across adapters.

### Linear-price caveat

`decomposeDrawing` projects world `(time, price)` to pixels with a **linear**
`timeToX` / `priceToY` over the `Viewport`. LC's `priceToCoordinate` /
`timeToCoordinate` are its own (potentially non-linear) projectors, and the
primitive paints in bitmap pixel space. `buildViewport` synthesises a linear
`Viewport` that reproduces LC's coordinates at the visible extremes, scaled
into bitmap space by the render scope's pixel ratios. This is **exact on a
linear price scale (the v5 default)** and an **approximation on a log price
scale** — drawings drift toward the edges of a log axis. A log-scale-exact
path (threading LC's converters through a projector override on
`decomposeDrawing`) is the documented follow-up. Any non-resolvable axis
(no visible range yet, off-screen, coincident anchors) falls back to an
identity window so painting never throws.

## Headless testing

The factory takes `opts.chartApi` (a `MockLwcApi`, exposed via the
`./testing` sub-path) the same way `canvas2d` takes `opts.ctx`; the mock
records every native call into an `LwcRecordedCall[]` log that
`hashLwcCallLog` canonicalises to a stable SHA-256. The drawing overlay is
tested by painting the buffered drawings into a `MockCanvasContext` (from
`@invinite-org/chartlang-adapter-kit/canvas`) and pinning `hashCallLog` over
the resulting paint sequence. The conformance suite reads `capabilities`
only, so the capabilities-only default export is its subject —
`runConformanceSuite(default)` reports `failed === 0`.
