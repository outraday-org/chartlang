# chartlang-example-canvas2d-adapter

`experimental`

Reference adapter — renders OHLC candles, `plot` line series,
`hline` horizontal lines, and `alert` badges to a `<canvas>`
element via the 2D context. Copy from this folder when writing
your own adapter.

## Install

Not published — copy from `examples/canvas2d-adapter/`.

## Public surface

- `createCanvas2dAdapter(opts) → Canvas2dAdapterHandle` — main
  factory; returns an `Adapter` plus an attached `ScriptHost` so
  consumers can `await adapter.host.load(compiled)` before
  driving the renderer loop.
- `runRendererLoop(handle) → Promise<void>` — convenience helper
  that iterates the candle source, pushes each event to the host,
  drains, and feeds emissions back into `adapter.onEmissions`.
- `CANVAS2D_CAPABILITIES` — `Capabilities` bag declaring the 12
  Phase-1 stateful primitives (`line` + `horizontal-line` plots,
  `log` + `toast` alert channels, three intervals).
- `DEFAULT_PALETTE`, `Palette` — colour constants + type.
- Sub-path `chartlang-example-canvas2d-adapter/testing`:
  - `MockCanvas2DContext` — hand-rolled Canvas 2D mock for tests.
  - `RecordedCall` — discriminated union over the mock's
    captured calls.
  - `hashCallLog(calls) → string` — deterministic SHA-256 over
    a canonicalised call log (floats rounded to 4 dp).

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

See [`docs/adapters/writing-an-adapter.md`](../../docs/adapters/writing-an-adapter.md).

## License

MIT
