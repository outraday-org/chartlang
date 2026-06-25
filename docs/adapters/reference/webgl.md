# WebGL adapter

The in-repo [WebGL2](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext)
example adapter (`examples/webgl-adapter/`, private
`chartlang-example-webgl-adapter`) is a **GPU-instanced, zero-dependency**
renderer — the same full surface as the [canvas2d reference](./canvas2d.md)
(candles, every `plot` kind, horizontal lines, alert badges, and all 63 drawing
kinds), but painted through raw WebGL2 programs plus a thin 2D-canvas text
overlay. Copy the folder when writing your own GPU adapter.

## Architecture

WebGL2 has no chart facilities, so the adapter is **self-scaled** like canvas2d:
`buildFrame` resolves each pane's world window through the shared
`ViewController` + `yRangeInWindow` (no forked window math) and emits
renderer-agnostic `LayerDescriptor`s in world space. The deliberate split is:

- **GL paints geometry.** Instanced candle bodies/wicks, miter-joined line
  strips (plot lines, the grid, step-lines, smoothed `line` curves sampled from
  the shared monotone-cubic spline), signed vertical bars (histograms / volume),
  and alpha-blended filled bands (Bollinger / `area` fills / `draw.fillBetween`)
  each run a dedicated GPU program behind the renderer's `dispatchLayer` seam.
- **A 2D-canvas overlay paints text.** A sibling `<canvas>` over the GL canvas
  paints axis labels, glyph plots (`shape` / `character` / `arrow` / `marker` /
  `label`), alert badges, drawings, the candle/background overrides, and the
  right-edge volume-profile — crisp at any DPR, where a GPU glyph atlas would
  not match this MVP tier.
- **Headless-constructible.** With no real `canvas` / `gl` test seam the factory
  builds no GL context and `onEmissions` runs ingestion only (a safe no-op
  draw), so the conformance suite and node unit tests need no GPU.

## Render order

Plots, glyphs, horizontal lines, and drawings paint in one stable
`z → band → seq` order **per pane**, via the shared
`sortByRenderOrder` + `RENDER_BAND` from `@invinite-org/chartlang-adapter-kit`
— never a forked comparator (the same bug class that promotion was made to
kill). The WebGL adapter supplies only its own `(z, band, seq)`-tagged marks:
the GL series + hline descriptors sort in `buildFrame`, the overlay glyphs +
drawings sort in their own passes. At the default `z = 0` the key reduces to the
canonical band order (series → glyph → hline → drawing); a `z`-bearing mark
reorders globally within the pane, identically to the other five adapters.
Substrate (background fills, candles, candle/bar overrides) paints **before**
the sorted pass and alert badges **after** — both `z`-independent.

## Overrides and the volume-profile

`bg-color`, `bar-color`, `bar-override`, `candle-override`, and
`horizontal-histogram` resolve on the overlay over the GL candles, mirroring the
canvas2d reference's precedence + direction semantics byte-for-concept (the
no-cross-example-import rule forbids reaching into canvas2d's source):

- `bg-color` washes a translucent per-bar background band (`alpha = 1 -
  transp/100`); the per-bar `colorValue` wins over the static color, and a
  `null` is an explicit no-fill gap.
- `bar-color` / `bar-override` tint a per-bar OHLC outline; `candle-override`
  recolors the candle body by **direction** (bull when `close > open`, bear when
  `close < open`, else the doji color, falling back to bull).
- `horizontal-histogram` paints right-edge volume-profile bars (`maxWidth 96`,
  `rowHeight 6`).

## Drawings

Drawings reuse the shared, renderer-agnostic geometry layer — the adapter never
re-derives per-kind geometry. `decomposeDrawing` reduces every `draw.*` kind to
the flat `DrawPrimitive` list, which the overlay paints through the shared
`paintPrimitive` sink (the same output canvas2d / uPlot / lightweight-charts
paint), so all 63 kinds render identically across the ctx-family surfaces:

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

Painting drawings on the overlay (whose `arc` is native) avoids both a
pixel→world inverse and GL arc tessellation — the "less surface" outcome.

## Capabilities and conformance

`WEBGL_CAPABILITIES` declares the full surface byte-for-shape identical to
`CANVAS2D_CAPABILITIES` (every plot kind, all 63 drawing kinds, alerts +
conditions, sub-panes, multi-timeframe / multi-symbol), so the adapter exercises
the entire conformance battery. The package's headless `default` export is
capabilities-only; from the repo root `pnpm conformance` drives every bundled
scenario through the runtime against that bag and asserts zero failures (the
WebGL adapter is iterated alongside the other five from the registry). Unlike
the canvas2d reference, it ships no committed `CONFORMANCE.md` — it is run
pass/fail only.

## Minimum-viable usage

```ts
import { createWebglAdapter, runWebglLoop } from "chartlang-example-webgl-adapter";
import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";

declare const canvas: HTMLCanvasElement;
declare const compiled: import("@invinite-org/chartlang-compiler").CompiledScript;
declare const bars: ReadonlyArray<import("@invinite-org/chartlang-core").Bar>;

const adapter = createWebglAdapter({
    canvas,
    candleSource: mockCandleSource(bars, { interval: "1D", mode: "stream" }),
});
await adapter.host.load({ moduleSource: compiled.moduleSource, manifest: compiled.manifest });
await runWebglLoop(adapter);
```

See also [`docs/adapters/writing-an-adapter.md`](../writing-an-adapter.md)
for the general adapter contract.
