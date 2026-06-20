# chartlang-example-echarts-adapter

`experimental`

Full-surface example adapter — renders chartlang OHLC candles, `plot`
series, `hline` horizontal lines, and all 63 `draw.*` drawings to
[Apache ECharts](https://echarts.apache.org). Candles / plots / panes use
ECharts **native** series (candlestick / line / bar / scatter) + `grid`
sub-panes; drawings render through the declarative `graphic` component. Copy
from this folder when writing your own ECharts adapter.

## Install

Not published — copy from `examples/echarts-adapter/`.

## Public surface

- `createEChartsAdapter(opts) → EChartsAdapterHandle` — main factory;
  returns an `Adapter` plus an attached `ScriptHost` so consumers can
  `await adapter.host.load(compiled)` before driving the loop. `opts`
  requires an `echartsFactory` seam (`() => echarts.init(container)` in
  production; `() => new MockECharts()` in tests).
- `runEChartsLoop(handle, opts?) → Promise<void>` — iterates the candle
  source, pushes each event to the host, drains, and feeds emissions back
  into `adapter.onEmissions`. Pass `opts.signal` (an `AbortSignal`) to
  cancel cleanly — on abort the loop returns silently (no throw).
- `ECHARTS_CAPABILITIES` — `Capabilities` bag declaring the full Phase-5
  plot inventory, all 63 drawing kinds (62 + `table`), alert channels,
  intervals, and `maxDrawingsPerScript` budgets — identical to canvas2d's.
- `primitiveToGraphic(prim) → EChartsGraphicElement` — pure map from a
  shared `DrawPrimitive` (from `decomposeDrawing`) to one ECharts `graphic`
  element; `primitiveIsFinite(prim)` gates the NaN filter.
- `buildViewport(chart, bars) → Viewport` / `computeViewport(...)` — derive
  the drawing viewport from ECharts' grid pixels (`convertToPixel`).
- `ECHARTS_SYM_INFO`, `EChartsSurface`, `EChartsAdapterHandle`,
  `EChartsGraphicElement`, `CreateEChartsAdapterOpts`, `RunEChartsLoopOpts`,
  `DEFAULT_ADAPTER`.
- Sub-path `chartlang-example-echarts-adapter/testing`: `MockECharts`
  (records `setOption` / `resize` / `convertToPixel` / `dispose`),
  `RecordedOptionCall`, `mockValueToPixel`, and `hashOptionLog(calls)`
  (SHA-256 over a canonicalised option log — finite floats → 4 dp).

## Declarative ECharts mapping

Each emission drain rebuilds one authoritative `EChartsOption` and applies
it with `chart.setOption(option, { notMerge: true })`:

- **Candles** → a `candlestick` series (`[open, close, low, high]`).
- **line / step-line** → `line` series (`step: 'end'` for step).
- **area** → `line` series + `areaStyle`.
- **histogram / horizontal-histogram** → `bar` series.
- **filled-band** → two stacked `line` series (transparent `lower` + an
  `upper` band carrying the thickness with `areaStyle`).
- **horizontal-line** → a `markLine` on a per-pane carrier series.
- **shape / marker / character / arrow / label** → `scatter` series.
- **candle-override / bar-override / bar-color** → per-bar `itemStyle`;
  **bg-color** → the chart `backgroundColor`.
- **Sub-panes** → one ECharts `grid` + x/y axis pair per pane (overlay =
  grid 0), mirroring canvas2d's `paneOrder`.
- **Drawings (`draw.*`)** → `option.graphic`. Each live drawing is run
  through the shared `decomposeDrawing(emission, viewport)` → `DrawPrimitive[]`
  and each primitive mapped by `primitiveToGraphic`: open polyline →
  `polyline`, closed → `polygon`, `arc` → `arc`, `text` → `text`, `marker`
  → small `circle` / `polygon`. Stroke / fill / dash / alpha map onto the
  path or text style. `op:"remove"` drawings are dropped before render.

`null` / non-finite values become the ECharts `'-'` gap; a `visible: false`
slot is omitted from the option tree but kept in state for re-enable.

**NaN-anchor divergence.** ECharts warns on a non-finite `graphic`
coordinate, so a drawing whose anchors project to a `NaN` pixel is **skipped**
— unlike the canvas adapters, which paint a harmless no-op path.

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

See [`docs/adapters/reference/echarts.md`](../../docs/adapters/reference/echarts.md)
and [`docs/adapters/writing-an-adapter.md`](../../docs/adapters/writing-an-adapter.md).

## License

MIT
