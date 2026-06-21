# chartlang-example-lightweight-charts-adapter

Renders chartlang candles, `plot` series, `hline` horizontal lines, glyph
markers, and sub-panes onto TradingView's
[lightweight-charts](https://github.com/tradingview/lightweight-charts) v5
**native** series / pane API, with the 63 drawing kinds painted via a
**series-primitive** overlay.

`experimental` · Apache-2.0 · copy-only — not published ·
Native series + series-primitive overlay · full conformance

## Get it

```bash
npx @invinite-org/chartlang-cli add-adapter lightweight-charts
```

Not published to npm — `add-adapter` bakes a version-pinned copy into your
repo, or copy
[`examples/lightweight-charts-adapter/`](https://github.com/outraday-org/chartlang/tree/main/examples/lightweight-charts-adapter)
directly.

## Public surface

- `createLightweightChartsAdapter(opts) → LwcAdapterHandle` — main factory;
  returns an `Adapter` plus an attached `ScriptHost`. Pass `opts.chartApi`
  (a `MockLwcApi`) in tests or `opts.container` (+ the real `createChart`)
  in a browser.
- `runRendererLoop(handle, opts?) → Promise<void>` — iterates the candle
  source, pushes each event to the host, drains, and feeds emissions back.
  Pass `opts.signal` to cancel cleanly.
- `LWC_CAPABILITIES` / `LWC_SYM_INFO` — full `Capabilities` bag + demo
  symbol metadata.
- `DEFAULT_ADAPTER` (also the package `default`) — headless,
  capabilities-only adapter the conformance suite consumes.
- `DrawingPrimitive` — the `ISeriesPrimitive`-shaped overlay that paints the
  buffered drawings; `buildViewport(series, timeScale, scope)` builds the
  adapter-kit `Viewport`.
- Sub-path `chartlang-example-lightweight-charts-adapter/testing` —
  `MockLwcApi` / `createMockChart()` + `hashLwcCallLog` (SHA-256, 4 dp).

## How drawings render

Candles / series / panes / hlines use lightweight-charts' own facilities.
The 63 drawing kinds go through the shared `decomposeDrawing` IR painted via
a series-primitive's canvas context — exact on a linear price scale (the v5
default), approximate on a log scale (a deferred follow-up).

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

See the [adapter gallery](../../docs/adapters/gallery.md) for a comparison of
all five adapters, and
[`docs/adapters/reference/lightweight-charts.md`](../../docs/adapters/reference/lightweight-charts.md)
for this adapter's deep dive.

## License

MIT
