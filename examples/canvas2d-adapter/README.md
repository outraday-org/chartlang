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
- `runRendererLoop(handle, opts?) → Promise<void>` — convenience
  helper that iterates the candle source, pushes each event to the
  host, drains, and feeds emissions back into `adapter.onEmissions`.
  Pass `opts.signal` (an `AbortSignal`) to cancel the loop cleanly;
  on abort the loop returns silently — no throw — so React consumers
  can unmount mid-stream without swallowing rejections.
- `CANVAS2D_CAPABILITIES` — `Capabilities` bag declaring the 9
  Phase-1+2 plot kinds, all 61 Phase-3 drawing kinds, `log` +
  `toast` alert channels, three intervals, and per-bucket
  `maxDrawingsPerScript` budgets sized for the `drawAll61` smoke
  scenario.
- `DEFAULT_PALETTE`, `Palette` — colour constants + type.

## Drawing rendering (Phase 3)

Shared scaffolding under `src/render/draw/` powering every per-kind
renderer (Tasks 5–18):

- `worldPointToCanvas(p, view) → { x, y }` — composes `timeToX` +
  `priceToY`; the projector every drawing renderer consumes.
- `drawingDispatch(ctx, emission, view) → void` — single switch over
  the 61-entry `DrawingKind` union with `satisfies never`
  exhaustiveness. Task 4 stubs every arm to no-op; per-kind tasks
  swap in their renderer one arm at a time. `op: "remove"`
  short-circuits.
- `FIB_LEVELS` + `formatLevel(level)` — canonical Fibonacci ratios
  (13 entries: 0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.414,
  1.618, 2, 2.618, 4.236) + Pine-style label formatter consumed by
  every fib renderer (Tasks 11–12).
- `quadraticBezier` / `cubicBezier` / `sampleQuadratic` /
  `sampleCubic` + the `Point2` type — pure curve helpers consumed
  by `arc` / `curve` / `doubleCurve` (Task 8), `fibSpiral` (Task 12),
  and pattern-leg projections (Task 15). Endpoints are float-exact.

`createCanvas2dAdapter`'s `ingest` accumulates `DrawingEmission`s
keyed by `handleId` (last-write-wins; `op: "remove"` drops the key)
and `renderFrame` walks the map through `drawingDispatch` against
the computed `Viewport`.

- Sub-path `chartlang-example-canvas2d-adapter/testing`:
  - `MockCanvas2DContext` — hand-rolled Canvas 2D mock for tests.
  - `RecordedCall` — discriminated union over the mock's
    captured calls.
  - `hashCallLog(calls) → string` — deterministic SHA-256 over
    a canonicalised call log (floats rounded to 4 dp).

## Pane-aware rendering

`AdapterState.plotSeries` is keyed by `${paneKey}|${slotId}`; `paneOrder` is
`["overlay", ...subpaneKeys]` in first-emit order. `renderFrame` walks
`computePaneLayout(state.paneOrder, state.canvas)` and draws each pane in its rect
via `ctx.save(); ctx.translate(0, rect.y); ...; ctx.restore()`, so the pure
`render/<kind>.ts` helpers keep emitting y relative to `viewport.pxHeight`. The
price pane takes the top 80%, subpanes share the bottom 20%, and each gets an
independent y-scale + right-gutter price axis; bars/drawings/alerts are overlay-bound.

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
