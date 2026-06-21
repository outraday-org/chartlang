# chartlang-example-echarts-adapter

Full-surface adapter — renders OHLC candles, `plot` series, `hline`
horizontal lines, and all 63 `draw.*` drawings to
[Apache ECharts](https://echarts.apache.org). Candles / plots / panes use
ECharts **native** series + `grid` sub-panes; drawings render through the
declarative `graphic` component.

`experimental` · Apache-2.0 · copy-only — not published ·
Declarative graphic component · full conformance

## Get it

```bash
npx @invinite-org/chartlang-cli add-adapter echarts
```

Not published to npm — `add-adapter` bakes a version-pinned copy into your
repo, or copy
[`examples/echarts-adapter/`](https://github.com/outraday-org/chartlang/tree/main/examples/echarts-adapter)
directly.

## Public surface

- `createEChartsAdapter(opts) → EChartsAdapterHandle` — main factory;
  returns an `Adapter` plus an attached `ScriptHost`. `opts` requires an
  `echartsFactory` seam (`() => echarts.init(container)` in production;
  `() => new MockECharts()` in tests).
- `runEChartsLoop(handle, opts?) → Promise<void>` — iterates the candle
  source, pushes each event to the host, drains, and feeds emissions back.
  Pass `opts.signal` to cancel cleanly — silent return on abort, no throw.
- `ECHARTS_CAPABILITIES` / `ECHARTS_SYM_INFO` — full `Capabilities` bag +
  demo symbol metadata.
- `DEFAULT_ADAPTER` (also the package `default`) — headless,
  capabilities-only adapter the conformance suite consumes.
- `primitiveToGraphic(prim) → EChartsGraphicElement` + `primitiveIsFinite` —
  the declarative drawing map; `buildViewport(chart, bars)` derives the
  drawing viewport from ECharts' grid pixels.
- Sub-path `chartlang-example-echarts-adapter/testing` — `MockECharts` +
  `hashOptionLog` (SHA-256 over the canonicalised option log, 4 dp).

## How drawings render

The shared `decomposeDrawing(emission, viewport)` IR maps each primitive via
`primitiveToGraphic` to one ECharts `graphic` element on `option.graphic` —
ECharts is declarative, so there is no `paintPrimitive` call. A drawing
projecting to a non-finite pixel is skipped (ECharts warns on NaN).

## Minimum-viable API call

```ts
import { createEChartsAdapter, runEChartsLoop } from "chartlang-example-echarts-adapter";
import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
import * as echarts from "echarts";

declare const container: HTMLElement;
declare const compiled: import("@invinite-org/chartlang-compiler").CompiledScript;
declare const bars: ReadonlyArray<import("@invinite-org/chartlang-core").Bar>;

const adapter = createEChartsAdapter({
    echartsFactory: () => echarts.init(container),
    candleSource: mockCandleSource(bars, { interval: "1D", mode: "stream" }),
});
await adapter.host.load({ moduleSource: compiled.moduleSource, manifest: compiled.manifest });
await runEChartsLoop(adapter);
```

## Docs

See the [adapter gallery](../../docs/adapters/gallery.md) for a comparison of
all five adapters, and
[`docs/adapters/reference/echarts.md`](../../docs/adapters/reference/echarts.md)
for this adapter's deep dive.

## License

MIT
