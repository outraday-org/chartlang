# chartlang-example-canvas2d-adapter

Reference adapter — renders chartlang OHLC candles, `plot` series, `hline`
horizontal lines, all 63 `draw.*` drawing kinds, and `alert` badges to an
HTML `<canvas>` 2D context. The zero-dependency baseline every other
adapter is measured against.

`experimental` · MIT · copy-only — not published · HTML Canvas 2D context ·
full conformance

## Get it

```bash
npx @invinite-org/chartlang-cli add-adapter canvas2d
```

Not published to npm — `add-adapter` bakes a version-pinned copy into your
repo, or copy
[`examples/canvas2d-adapter/`](https://github.com/outraday-org/chartlang/tree/main/examples/canvas2d-adapter)
directly.

## Public surface

- `createCanvas2dAdapter(opts) → Canvas2dAdapterHandle` — main factory;
  returns an `Adapter` plus an attached `ScriptHost` so consumers can
  `await adapter.host.load(compiled)` before driving the renderer loop.
- `runRendererLoop(handle, opts?) → Promise<void>` — iterates the candle
  source, pushes each event to the host, drains, and feeds emissions back
  into `adapter.onEmissions`. Pass `opts.signal` (an `AbortSignal`) to
  cancel cleanly — on abort the loop returns silently, no throw.
- `CANVAS2D_CAPABILITIES` — full `Capabilities` bag (every plot kind, all
  63 drawing kinds, `log` + `toast` alerts, MTF, unlimited sub-panes).
- `DEFAULT_ADAPTER` (also the package `default`) — headless,
  capabilities-only adapter the conformance suite consumes.
- `DEFAULT_PALETTE`, `Palette` — colour constants + type.
- Sub-path `chartlang-example-canvas2d-adapter/testing` — `MockCanvas2DContext`
  (records calls) + `hashCallLog` (SHA-256, floats rounded to 4 dp).

## How drawings render

The shared `decomposeDrawing(emission, viewport)` (exhaustive over all 63
kinds) reduces each drawing to a flat `DrawPrimitive` IR, then the canvas
sink `paintPrimitive(ctx, prim)` (from `@invinite-org/chartlang-adapter-kit/canvas`)
paints each one — no per-kind drawing code lives in the adapter.

## Minimum-viable API call

```ts
import { createCanvas2dAdapter, runRendererLoop } from "chartlang-example-canvas2d-adapter";
import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";

declare const canvas: HTMLCanvasElement;
declare const compiled: import("@invinite-org/chartlang-compiler").CompiledScript;
declare const bars: ReadonlyArray<import("@invinite-org/chartlang-core").Bar>;

const adapter = createCanvas2dAdapter({
    canvas,
    candleSource: mockCandleSource(bars, { interval: "1D", mode: "stream" }),
});
await adapter.host.load({ moduleSource: compiled.moduleSource, manifest: compiled.manifest });
await runRendererLoop(adapter);
```

## Docs

See the [adapter gallery](../../docs/adapters/gallery.md) for a comparison of
all five adapters, and
[`docs/adapters/reference/canvas2d.md`](../../docs/adapters/reference/canvas2d.md)
for this adapter's deep dive.

## License

MIT
