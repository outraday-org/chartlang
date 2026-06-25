# chartlang-example-webgl-adapter

Full-surface adapter — renders OHLC candles, `plot` series, `hline`
horizontal lines, and all 63 `draw.*` drawings to a **raw WebGL2** GPU
renderer with **zero npm dependencies** (like the canvas2d reference). It
uploads decomposed geometry to GPU programs (instanced candle bodies/wicks,
miter-joined line strips) and paints text through a thin 2D-canvas overlay —
the GPU AA tier the canvas/SVG adapters cannot reach.

`experimental` · MIT · copy-only — not published · WebGL2 (raw,
GPU-instanced) · full conformance · full parity

GL paints geometry (instanced candle bodies/wicks, miter-joined line strips,
vertical bars, filled bands, the grid); a thin 2D-canvas overlay paints text +
glyphs + drawings + the candle/background overrides + the right-edge
volume-profile. Plots, hlines, glyphs, and drawings paint in one stable
`z → band → seq` order per pane via the shared adapter-kit `sortByRenderOrder`,
so a `z`-bearing mark layers identically to the other five adapters.

## Get it

```bash
npx @invinite-org/chartlang-cli add-adapter webgl
```

Not published to npm — `add-adapter` bakes a version-pinned copy into your
repo, or copy
[`examples/webgl-adapter/`](https://github.com/outraday-org/chartlang/tree/main/examples/webgl-adapter)
directly.

## Public surface

- `createWebglAdapter(opts) → WebglAdapterHandle` — main factory; returns an
  `Adapter` plus an attached `ScriptHost`. Constructible headlessly from
  `{ width, height }`; pass a real `canvas` (or a `gl`
  `WebGL2RenderingContext` test seam) for the GPU path.
- `runWebglLoop(handle, opts?) → Promise<void>` — iterates the candle source,
  pushes each event to the host, drains, and feeds emissions back. Pass
  `opts.signal` to cancel cleanly — silent return on abort, no throw.
- `WEBGL_CAPABILITIES` / `WEBGL_SYM_INFO` — full `Capabilities` bag (parity
  with canvas2d) + demo symbol metadata.
- `DEFAULT_ADAPTER` (also the package `default`) — headless,
  capabilities-only adapter the conformance suite consumes.

## How drawings render

The shared `decomposeDrawing(emission, viewport)` IR (from
`@invinite-org/chartlang-adapter-kit`) reduces every drawing to a flat
primitive list once; the WebGL adapter paints that list (polylines / arcs /
text / markers) on the 2D-canvas overlay through the shared `paintPrimitive`
sink — byte-consistent with canvas2d / uPlot / lightweight-charts. The geometry
layer is never forked. GL programs paint the series geometry (candles, line
strips, vertical bars, filled bands); the overlay paints text and everything
`decomposeDrawing` emits, so no GL arc tessellation is needed.

## Render order, overrides, and the volume-profile

- **Per-pane z-order.** Series, glyphs, hlines, and drawings paint in one
  stable `z → band → seq` order per pane via the shared adapter-kit
  `sortByRenderOrder` + `RENDER_BAND` (never a forked comparator). Default
  `z = 0` reproduces the canonical band order (series → glyph → hline →
  drawing); a `z` override reorders globally within the pane.
- **Candle / background overrides.** `bg-color` washes the pane background,
  `bar-color` / `bar-override` tint per-bar candles, and `candle-override`
  recolors a candle body by bull / bear / doji direction — painted as
  substrate on the overlay (over the GL candles) before the sorted pass, the
  same precedence + direction semantics the other adapters share.
- **`horizontal-histogram`** (volume profile) paints right-edge bars on the
  overlay (`maxWidth 96`, `rowHeight 6`), matching the canvas2d reference.

## Minimum-viable API call

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

## Docs

See the [adapter gallery](../../docs/adapters/gallery.md) for a comparison of
all adapters, and
[`docs/adapters/reference/webgl.md`](../../docs/adapters/reference/webgl.md)
for this adapter's deep dive.

## License

MIT
