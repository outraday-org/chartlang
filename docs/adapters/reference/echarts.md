# ECharts adapter

The in-repo [Apache ECharts](https://echarts.apache.org) example adapter
(`examples/echarts-adapter/`, private `chartlang-example-echarts-adapter`) is a
**full-surface** rendering adapter: candles, every `plot` kind, horizontal
lines, and all 63 drawing kinds. ECharts has a huge install base and native
candlesticks; unlike the canvas-family adapters it is **declarative** — the
adapter rebuilds one authoritative `EChartsOption` per emission drain rather
than painting to a `ctx`. Copy the folder when writing your own ECharts
adapter.

## Architecture

ECharts owns the candle scales, axes, time axis, and panes; chartlang owns the
emission stream. The adapter bridges them declaratively:

- **One `setOption` per drain.** `onEmissions` ingests the drain into
  accumulated state, calls `buildOption(state)` to produce the full option
  tree, and applies it with `chart.setOption(option, { notMerge: true })`.
  There is no imperative per-series mutation.
- **Native series for plots.** `candlestick` for candles; `line`
  (`step: 'end'` for step-line, `areaStyle` for area); `bar` for histograms;
  two stacked `line` series for `filled-band`; a `markLine` carrier for
  horizontal lines; `scatter` for glyph kinds. Candle-state overrides become
  per-bar `itemStyle`; `bg-color` becomes the chart `backgroundColor`.
- **Sub-panes are ECharts `grid`s.** One `grid` + x/y axis pair per pane key
  (overlay = grid 0), mirroring canvas2d's `paneOrder`. Series route to their
  pane's `xAxisIndex` / `yAxisIndex`.

`null` / non-finite plot values become the ECharts `'-'` gap; a
`visible: false` slot is omitted from the option tree but kept in state so
re-enabling re-renders it.

## Drawings: the `graphic` path

ECharts is not ctx-based, so drawings do **not** use the canvas
`paintPrimitive` sink. Instead the adapter reuses the shared, renderer-agnostic
geometry layer in `@invinite-org/chartlang-adapter-kit` — `decomposeDrawing`
reduces every one of the 63 drawing kinds to a flat `DrawPrimitive[]` in PIXEL
space — and maps each primitive to one ECharts `graphic` element. `buildOption`
sets `option.graphic` on every drain:

```ts
import { decomposeDrawing } from "@invinite-org/chartlang-adapter-kit";
import { buildViewport, primitiveToGraphic } from "chartlang-example-echarts-adapter";

const view = buildViewport(chart, bars);
const graphics = [...state.drawings.values()].flatMap((d) =>
    decomposeDrawing(d, view).map(primitiveToGraphic),
);
chart.setOption({ graphic: graphics }, { replaceMerge: ["graphic"] });
```

`primitiveToGraphic` is a pure structural remap, since the IR is already in
pixel coordinates — exactly what `graphic` elements consume:

| `DrawPrimitive` | ECharts `graphic` element |
| --- | --- |
| open `polyline` | `{ type: "polyline", shape: { points } }` |
| closed `polyline` | `{ type: "polygon", shape: { points } }` |
| `arc` | `{ type: "arc", shape: { cx, cy, r, startAngle, endAngle } }` |
| `text` | `{ type: "text", x, y, style: { text, align, verticalAlign, … } }` |
| `marker` | a small `circle` (round) or `polygon` (square / diamond / triangle) |

`StrokeStyle.dash` → `style.lineDash` (omitted when solid); `StrokeStyle.alpha`
→ `strokeOpacity`; `FillStyle` → `fill` + `fillOpacity`. `op:"remove"`
drawings are dropped from `state.drawings` at ingest, so only live drawings are
mapped.

### NaN-anchor divergence

ECharts logs a console warning for a `graphic` element with a non-finite
coordinate. A drawing whose anchors carry a `NaN` time / price project to a
`NaN` pixel, so the adapter **skips** that element entirely (via
`primitiveIsFinite`). This is a deliberate divergence from the canvas-family
adapters, which paint a harmless no-op path for a non-finite point.

## Viewport: reproducing `convertToPixel`

ECharts value axes are linear (the bar-time axis is linear in ms), so
adapter-kit's linear `timeToX` / `priceToY` over a `Viewport` reproduce
ECharts' own grid pixels. `buildViewport(chart, bars)` samples two grid corners
via `chart.convertToPixel({ gridIndex: 0 }, [time, price])` and hands them to
the pure `computeViewport`, which derives `pxWidth` / `pxHeight` from the corner
delta and the price extent from the samples; the bar-time x extent comes from
the bar window. When the chart has not laid out yet (or the headless default,
whose surface omits `convertToPixel`), a deterministic fallback viewport keeps
the `graphic` array well-defined. The projection identity is verified against
`convertToPixel` in `viewport.test.ts`.

## Capabilities and conformance

The adapter declares the full surface (every Phase-5 plot kind, all 63 drawing
kinds, `log` + `toast` alerts, MTF, sub-panes) so it is interchangeable with
the canvas2d reference. The package's headless `default` export is
capabilities-only; `runConformanceSuite(default)` drives every bundled scenario
through the runtime against that bag and asserts zero failures
(`src/conformance.test.ts`).

## Minimum-viable usage

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

See also [`docs/adapters/writing-an-adapter.md`](../writing-an-adapter.md)
for the general adapter contract.
