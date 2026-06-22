# chartlang-example-uplot-adapter

Full-surface adapter — renders OHLC candles, `plot` series (line / step /
histogram / area / filled-band), `hline` horizontal lines, and all 63
drawing kinds to [uPlot](https://github.com/leeoniya/uPlot) instances via
its immediate-mode canvas draw hooks.

`experimental` · MIT · copy-only — not published · Canvas draw-hooks ·
full conformance

## Get it

```bash
npx @invinite-org/chartlang-cli add-adapter uplot
```

Not published to npm — `add-adapter` bakes a version-pinned copy into your
repo, or copy
[`examples/uplot-adapter/`](https://github.com/outraday-org/chartlang/tree/main/examples/uplot-adapter)
directly.

## Public surface

- `createUplotAdapter(opts) → UplotAdapterHandle` — main factory; returns an
  `Adapter` plus an attached `ScriptHost`. Maps each `PlotEmission.pane` to
  its own stacked uPlot instance, candles to a custom path builder, hlines +
  drawings to a `hooks.draw` ctx pass.
- `runUplotLoop(handle, opts?) → Promise<void>` — iterates the candle
  source, pushes each event to the host, drains, and feeds emissions back.
  Pass `opts.signal` to cancel cleanly — silent return on abort, no throw.
- `UPLOT_CAPABILITIES` / `UPLOT_SYM_INFO` — full `Capabilities` bag + demo
  symbol metadata.
- `DEFAULT_ADAPTER` (also the package `default`) — headless,
  capabilities-only adapter the conformance suite consumes.
- `drawCandlePaths(ctx, candles, style)` — the ported candlestick path
  builder; `buildViewport(u)` / `offsetForViewport(u)` / `UPLOT_PRICE_SCALE`
  reproduce `u.valToPos` as an adapter-kit `Viewport`.
- Sub-path `chartlang-example-uplot-adapter/testing` — `MockUplot` +
  `hashCallLog` (re-exported from adapter-kit/canvas).

## How drawings render

The shared `decomposeDrawing(emission, view)` IR is painted via
`paintPrimitive(u.ctx, prim)` in each instance's `hooks.draw`, after the
hlines. The viewport comes from the instance's own scales + bbox, so
projected pixels line up with the native series.

## Minimum-viable API call

```ts
import { createUplotAdapter, runUplotLoop } from "chartlang-example-uplot-adapter";
import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";

declare const target: HTMLElement;
declare const compiled: import("@invinite-org/chartlang-compiler").CompiledScript;
declare const bars: ReadonlyArray<import("@invinite-org/chartlang-core").Bar>;

const adapter = createUplotAdapter({
    target,
    width: 800,
    height: 400,
    candleSource: mockCandleSource(bars, { interval: "1D", mode: "stream" }),
});
await adapter.host.load({ moduleSource: compiled.moduleSource, manifest: compiled.manifest });
await runUplotLoop(adapter);
```

**Import uPlot's stylesheet once in your app** (`import "uplot/dist/uPlot.min.css"`).
uPlot ships its canvas sizing + `.u-wrap`/`.u-over` layout in CSS; without it the
canvas renders at its device-px backing size (2× on Retina) and overflows the
mount, so the chart appears tiny in a clipped corner. The adapter source does not
import it (a `.css` import would break the headless test + SSR graph) — it is the
consuming app's responsibility.

## Docs

See the [adapter gallery](../../docs/adapters/gallery.md) for a comparison of
all five adapters, and
[`docs/adapters/reference/uplot.md`](../../docs/adapters/reference/uplot.md)
for this adapter's deep dive.

## License

MIT
