# chartlang-example-lightweight-charts-adapter

`experimental`

Reference adapter — renders chartlang candles, `plot` series, `hline`
horizontal lines, glyph markers, and sub-panes onto TradingView's
[lightweight-charts](https://github.com/tradingview/lightweight-charts)
v5 **native** series / pane API, and the 63 drawing kinds via a
**series-primitive** overlay. Copy from this folder when writing your own
adapter.

## Install

Not published — copy from `examples/lightweight-charts-adapter/`.

## Public surface

- `createLightweightChartsAdapter(opts) → LwcAdapterHandle` — main
  factory; returns an `Adapter` plus an attached `ScriptHost`. Pass
  `opts.chartApi` (a `MockLwcApi`) in tests or `opts.container` (+ the
  real `createChart`) in a browser.
- `runRendererLoop(handle, opts?) → Promise<void>` — iterates the candle
  source, pushes each event to the host, drains, and feeds emissions back
  into `adapter.onEmissions`. Pass `opts.signal` to cancel cleanly.
- `LWC_CAPABILITIES` — full `Capabilities` bag (every Phase-5 plot kind,
  all Phase-3 drawing kinds + `table`, `log`/`toast` alerts, intervals,
  multi-timeframe, unlimited sub-panes).
- `LWC_SYM_INFO` — demo symbol metadata.
- `DEFAULT_ADAPTER` (also the package `default`) — headless,
  capabilities-only adapter the conformance suite consumes.
- `DrawingPrimitive` — the `ISeriesPrimitive`-shaped overlay the factory
  attaches to the candle series; paints every buffered drawing via
  adapter-kit's `decomposeDrawing` + the canvas sink.
- `buildViewport(series, timeScale, scope)` — builds an adapter-kit
  `Viewport` from LC's converters (linear-price approximation, see below).

## Native mapping

Candles → `addSeries(Candlestick)`; line/step/area/histogram → their
native series; `horizontal-line` → `createPriceLine`; `filled-band` →
two line series (the fill is a drawing); glyphs → the v5 markers plugin;
candle/bar overrides → `applyOptions`; `bg-color` /
`horizontal-histogram` → documented no-ops. Panes route `overlay`→0,
`new`→`addPane()`, named→a stable index. See the file-header table in
`src/createLightweightChartsAdapter.ts`.

**Drawings (63 kinds) paint via a series primitive**, not natively. The
factory buffers each live `DrawingEmission` and attaches one
`DrawingPrimitive` to the candle series; its pane renderer paints
`decomposeDrawing(emission, view)` through the shared canvas sink. The
viewport is built from LC's `timeToCoordinate` / `coordinateToPrice` —
**exact on a linear price scale (the v5 default), approximate on a log
scale** (a deferred follow-up).

- Sub-path `chartlang-example-lightweight-charts-adapter/testing`:
  - `MockLwcApi` / `createMockChart()` — records every native call into a
    `LwcRecordedCall[]` log (mirrors `MockCanvas2DContext`).
  - `hashLwcCallLog(calls) → string` — deterministic SHA-256 over the
    canonicalised log (floats rounded to 4 dp).

## Minimum-viable API call

```ts
import { createLightweightChartsAdapter, runRendererLoop } from "chartlang-example-lightweight-charts-adapter";
import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";

declare const container: HTMLElement;
declare const compiled: import("@invinite-org/chartlang-compiler").CompiledScript;
declare const bars: ReadonlyArray<import("@invinite-org/chartlang-core").Bar>;

const adapter = createLightweightChartsAdapter({
    container,
    candleSource: mockCandleSource(bars, { interval: "1D", mode: "stream" }),
});
await adapter.host.load({ moduleSource: compiled.moduleSource, manifest: compiled.manifest });
await runRendererLoop(adapter);
```

## Docs

See [`docs/adapters/reference/lightweight-charts.md`](../../docs/adapters/reference/lightweight-charts.md).

## License

MIT
