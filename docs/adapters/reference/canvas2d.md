# Canvas 2D adapter

The in-repo [HTML Canvas 2D](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D)
example adapter (`examples/canvas2d-adapter/`, private
`chartlang-example-canvas2d-adapter`) is the **reference** rendering
adapter: candles, every `plot` kind, horizontal lines, alert badges, and all
63 drawing kinds painted directly to a `<canvas>` 2D context. It is the
adapter every other example is modelled on, and the one the conformance
runner reports against. Copy the folder when writing your own canvas adapter.

## Architecture

Canvas 2D has no chart facilities, so the adapter is **self-scaled**: it
computes its own `Viewport` from the bars + canvas size and projects with the
shared `timeToX` / `priceToY` from `@invinite-org/chartlang-adapter-kit` — no
local projection copy. Everything is painted immediate-mode to the context:

- **Self-computed panes.** `computePaneLayout` splits the canvas into an
  overlay (top) plus uniform sub-pane rects, one per `PlotEmission.pane`.
- **Hand-painted candles + plots.** Candles, line / step-line / area /
  histogram plots, filled bands, and horizontal lines all paint to the 2D
  context each frame. `null` / non-finite values become gaps.
- **A per-frame redraw.** `createCanvas2dAdapter`'s `ingest` accumulates
  emissions; `renderFrame` clears and repaints from the accumulated state.

## Drawings

Drawings reuse the shared, renderer-agnostic geometry layer in
`@invinite-org/chartlang-adapter-kit` — the adapter never re-derives per-kind
geometry. Each frame, after the candles and plots:

```ts
import { decomposeDrawing } from "@invinite-org/chartlang-adapter-kit";
import { paintPrimitive } from "@invinite-org/chartlang-adapter-kit/canvas";

declare const ctx: import("@invinite-org/chartlang-adapter-kit/canvas").RenderCtx;
declare const view: import("@invinite-org/chartlang-adapter-kit").Viewport;
declare const drawings: ReadonlyArray<
    import("@invinite-org/chartlang-adapter-kit").DrawingEmission
>;

for (const d of drawings) {
    for (const prim of decomposeDrawing(d, view)) paintPrimitive(ctx, prim);
}
```

`ingest` keys live drawings by `handleId` (last-write-wins; `op: "remove"`
drops the key), so the map only ever holds live drawings. Because canvas2d
is the reference for the shared geometry layer, the
[lightweight-charts](./lightweight-charts.md) and [uPlot](./uplot.md)
adapters paint the **same** `decomposeDrawing` → `paintPrimitive` output —
all 63 kinds (fib / Gann / Elliott / pitchfork / pattern / cycle / container
/ table) render identically across the ctx-family adapters.

## Capabilities and conformance

`CANVAS2D_CAPABILITIES` declares the full surface (every plot kind, all 63
drawing kinds, `log` + `toast` alerts, three intervals, multi-timeframe,
sub-panes) so the adapter exercises the entire conformance battery. The
package's headless `default` export is capabilities-only;
`runConformanceSuite(default)` drives every bundled scenario through the
runtime against that bag and asserts zero failures. From the repo root,
`pnpm conformance` runs the suite against this reference adapter (alongside
the other four) and `pnpm conformance:report` regenerates its committed
`CONFORMANCE.md` + `conformance-report.json` pair.

## Minimum-viable usage

```ts
import { createCanvas2dAdapter, runRendererLoop } from "chartlang-example-canvas2d-adapter";
import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";

declare const canvas: HTMLCanvasElement;
declare const compiled: import("@invinite-org/chartlang-compiler").CompiledScript;
declare const bars: ReadonlyArray<import("@invinite-org/chartlang-core").Bar>;

const adapter = createCanvas2dAdapter({
    ctx: canvas.getContext("2d"),
    width: 800,
    height: 400,
    candleSource: mockCandleSource(bars, { interval: "1D", mode: "stream" }),
});
await adapter.host.load({ moduleSource: compiled.moduleSource, manifest: compiled.manifest });
await runRendererLoop(adapter);
```

See also [`docs/adapters/writing-an-adapter.md`](../writing-an-adapter.md)
for the general adapter contract.
