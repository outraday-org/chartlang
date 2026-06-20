# uPlot adapter

The in-repo [uPlot](https://github.com/leeoniya/uPlot) example adapter
(`examples/uplot-adapter/`, private `chartlang-example-uplot-adapter`) is a
**full-surface** rendering adapter: candles, every `plot` kind, horizontal
lines, and all 63 drawing kinds. uPlot is tiny and fast, and its draw hooks
expose the raw canvas `ctx` plus `valToPos` — the same immediate-mode model
as the `canvas2d` reference adapter. Copy the folder when writing your own
uPlot adapter.

## Architecture

uPlot owns candles' scales, axes, and the time x-axis; chartlang owns the
emission stream. The adapter bridges them:

- **Stacked instances per pane.** Each `PlotEmission.pane` maps to its own
  uPlot instance, ordered `["overlay", ...subpanes]` in first-emit order.
  Each pane owns an independent y scale + axis (mirroring canvas2d's
  per-pane rects). The overlay instance carries the candles.
- **Native series for continuous plots.** `line` / `step-line` →
  line/stepped paths, `area` / `filled-band` → series `fill`, `histogram`
  → bars. `null` / `NaN` plot values become uPlot `null` gaps.
- **A single `hooks.draw` ctx pass for everything hand-painted.** Candles
  (a ported candlestick path builder), horizontal lines, and drawings all
  paint to the instance's own `u.ctx` (a real `CanvasRenderingContext2D` in
  production, a `MockCanvasContext` under test).

## Drawings

Drawings reuse the shared, renderer-agnostic geometry layer in
`@invinite-org/chartlang-adapter-kit` — the adapter never re-derives per-kind
geometry. In the overlay (and each sub-pane's) draw hook, after the
horizontal lines:

```ts
import { decomposeDrawing } from "@invinite-org/chartlang-adapter-kit";
import { paintPrimitive } from "@invinite-org/chartlang-adapter-kit/canvas";
import { buildViewport, offsetForViewport } from "chartlang-example-uplot-adapter";

const view = buildViewport(u);
const { dx, dy } = offsetForViewport(u);
ctx.save();
ctx.translate(dx, dy);
for (const d of state.drawings.values()) {
    for (const prim of decomposeDrawing(d, view)) paintPrimitive(ctx, prim);
}
ctx.restore();
```

`op: "remove"` drawings are dropped at ingest, so the map only ever holds
live drawings. Each pane decomposes drawings against its own scales, so a
sub-pane drawing projects into that pane's price range.

## Viewport: reproducing `valToPos`

uPlot's x scale is time and its y scale is price — both linear by default —
so adapter-kit's linear `timeToX` / `priceToY` over a `Viewport` reproduce
`u.valToPos`. `buildViewport(u)` reads the instance's own ranges and
plotting-area bbox:

| `Viewport` field | source |
| --- | --- |
| `xMin` / `xMax` | `u.scales.x.min` / `.max` |
| `yMin` / `yMax` | `u.scales.y.min` / `.max` |
| `pxWidth` / `pxHeight` | `u.bbox.width` / `.height`, divided by `devicePixelRatio` |

### devicePixelRatio and the plotting-area offset

`u.valToPos(val, key, true)` returns a **canvas** pixel: it folds in the
`bbox.left/top` plotting-area offset and is expressed in canvas px (scaled
by `devicePixelRatio`). adapter-kit's projection starts at the
plotting-area origin `(0, 0)` and works in **CSS px**. The adapter
reconciles the two by:

1. building the `Viewport` in CSS px (`bbox.width/height ÷ dpr`), so
   `timeToX` / `priceToY` produce plotting-area-relative CSS pixels; and
2. translating the canvas once by the CSS-px `bbox.left/top` offset
   (`offsetForViewport`) around the drawing pass, so those plotting-area
   pixels land on the exact canvas pixel uPlot's series occupy.

Splitting the offset out (rather than baking `bbox.left` into `xMin`) keeps
`decomposeDrawing`'s output in the clean plotting-area space the candle +
hline pass already use. Verified by sampling `worldPointToPixel(p, view) +
offset` against `u.valToPos` for several points in `viewport.test.ts`.

## Capabilities and conformance

The adapter declares the full surface (every Phase-5 plot kind, all 63
drawing kinds, `log` + `toast` alerts, MTF, unlimited sub-panes) so it is
interchangeable with the canvas2d reference. The package's headless
`default` export is capabilities-only; `runConformanceSuite(default)` drives
every bundled scenario through the runtime against that bag and asserts
zero failures (`src/conformance.test.ts`).

## Minimum-viable usage

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

See also [`docs/adapters/writing-an-adapter.md`](../writing-an-adapter.md)
for the general adapter contract.
