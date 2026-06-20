# chartlang-example-uplot-adapter

`experimental`

Full-surface example adapter — renders OHLC candles, `plot` series (line /
step / histogram / area / filled-band), `hline` horizontal lines, and all
63 drawing kinds to [uPlot](https://github.com/leeoniya/uPlot) instances.
Copy from this folder when writing your own uPlot adapter.

## Install

Not published — copy from `examples/uplot-adapter/`.

## Public surface

- `createUplotAdapter(opts) → UplotAdapterHandle` — main factory;
  returns an `Adapter` plus an attached `ScriptHost` so consumers can
  `await adapter.host.load(compiled)` before driving the loop. Maps each
  `PlotEmission.pane` to its own stacked uPlot instance (`"overlay"`
  first), candles to a custom path builder, horizontal lines to a
  `hooks.draw` pass using `u.valToPos`, and every drawing to the shared
  adapter-kit geometry layer painted in that same hook.
- `runUplotLoop(handle, opts?) → Promise<void>` — iterates the candle
  source, pushes each event to the host, drains, and feeds emissions back
  into `adapter.onEmissions`. Pass `opts.signal` (an `AbortSignal`) to
  cancel cleanly — on abort the loop returns silently, no throw.
- `UPLOT_CAPABILITIES` / `UPLOT_SYM_INFO` — the full `Capabilities` bag
  (every Phase-5 plot kind, all 63 drawing kinds, `log` + `toast`
  alerts, MTF, unlimited sub-panes) + demo symbol metadata, matching the
  canvas2d reference so the two adapters are interchangeable.
- `DEFAULT_ADAPTER` (also the default export) — headless,
  capabilities-only adapter the conformance suite consumes.
- `drawCandlePaths(ctx, candles, style)` — the ported candlestick path
  builder (pure on a `RenderCtx`).
- `buildViewport(u)` / `offsetForViewport(u)` / `UPLOT_PRICE_SCALE` — build
  an adapter-kit `Viewport` from a uPlot instance's scales + bbox (so
  `timeToX`/`priceToY` reproduce `u.valToPos`) plus the plotting-area
  offset the drawing pass translates by.

## Plot / candle / pane mapping

- **Candles** → a custom path builder (`candlePaths.ts`, ported from
  uPlot's official candlestick demo) painted in the overlay pane's draw
  hook: one wick line + one bull/bear-tinted body rect per bar.
- **Plots** → native uPlot series, one per `${pane}|${slotId}`:
  `line`/`step-line` via line/stepped paths, `area`/`filled-band` via the
  series `fill`, `histogram` via a bars path. NaN/`null` values become
  uPlot `null` gaps.
- **Horizontal lines** → drawn in `hooks.draw` via `u.valToPos(price,
  "y")`. The same ctx hook paints drawings.
- **Drawings** (all 63 kinds) → `decomposeDrawing(emission, view)` →
  `paintPrimitive(u.ctx, prim)` in `hooks.draw`, after the hlines. The
  `Viewport` comes from the instance's own scales + bbox (`buildViewport`),
  so projected pixels match the series; the plotting-area offset is applied
  once via a ctx translate. Drawings paint against each pane's own
  viewport. CSS px throughout — `pxWidth/pxHeight` divide `bbox` by
  `devicePixelRatio` so coordinates align with uPlot's series.
- **Sub-panes** → stacked uPlot instances keyed by `PlotEmission.pane`,
  ordered overlay-first, each with its own y scale.
- **Glyph / override kinds** (`shape`, `character`, `arrow`, `label`,
  `marker`, `candle-override`, `bar-override`, `bg-color`, `bar-color`,
  `horizontal-histogram`) are buffered (declared in Capabilities, not
  silently dropped) — they paint in the draw hook in a later task.

Test seam: pass `opts.uplotFactory` (a `UplotFactory`) to inject a
`MockUplot` (`./testing`) instead of constructing a real uPlot; the mock
records `new` / `setData` / `setScale` / `destroy` and exposes a
`MockCanvasContext` ctx for hashable draw-pass assertions.

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

## Docs

See [`docs/adapters/reference/uplot.md`](../../docs/adapters/reference/uplot.md)
and [`docs/adapters/writing-an-adapter.md`](../../docs/adapters/writing-an-adapter.md).

## License

MIT
