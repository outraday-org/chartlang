# Embed chartlang in your chart

Run user-supplied `.chart.ts` scripts inside an existing chart UI. The
embed is three layers wired through two typed, JSON-safe boundaries:
**compile** (server-side) → **host** (Worker or QuickJS) → **adapter**
(your renderer). Condensed from
[`docs/getting-started/embed-in-our-chart.md`](https://github.com/outraday-org/chartlang/blob/main/docs/getting-started/embed-in-our-chart.md).

## 1. Compile server-side

`@invinite-org/chartlang-compiler` imports node builtins (`fs`, `crypto`,
`path`) and a native esbuild launcher, so it does **not** bundle for the
browser. Run it under node — typically a small HTTP endpoint your editor
calls. On any error-severity diagnostic, `compile()` throws a
`CompileError` carrying the full diagnostic array:

```ts
import { compile, CompileError } from "@invinite-org/chartlang-compiler";

export async function compileScript(
    source: string,
): Promise<{ moduleSource: string; manifest: unknown } | { errors: unknown[] }> {
    try {
        const result = await compile(source, {
            apiVersion: 1,
            sourcePath: "user-script.chart.ts",
        });
        return { moduleSource: result.moduleSource, manifest: result.manifest };
    } catch (err) {
        if (err instanceof CompileError) return { errors: [...err.diagnostics] };
        throw err;
    }
}
```

`compile()` returns a frozen `CompiledScript` —
`{ moduleSource, manifest, types, sourcemap? }`. Only `moduleSource` and
`manifest` cross the boundary to the host. The reference middleware is
[`examples/react-demo/server/compilePlugin.ts`](https://github.com/outraday-org/chartlang/blob/main/examples/react-demo/server/compilePlugin.ts),
a Vite dev-server plugin — call it from a `POST /api/compile` endpoint
and ship the response to the browser editor.

## 2. Host the bundle

The compiled `moduleSource` is a self-contained ESM string with an
`export const __manifest = …;` tail. Pick a host by where execution
should live:

- `@invinite-org/chartlang-host-worker` — Web Worker isolation in the
  browser (loads the bundle via a `data:` URL, so one code path works in
  production browsers and node test environments).
- `@invinite-org/chartlang-host-quickjs` — QuickJS-WASM sandbox with
  real CPU preemption + a hard heap cap; ideal server-side. See
  [`server-alerts.md`](./server-alerts.md).

Both expose the same `ScriptHost` shape, so swapping is a one-line
change. `push` and `drain` are async:

```ts
import { createWorkerHost } from "@invinite-org/chartlang-host-worker";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { ScriptManifest } from "@invinite-org/chartlang-core";

declare const myCapabilities: Capabilities;
declare const moduleSource: string;
declare const manifest: ScriptManifest;

const host = createWorkerHost({ capabilities: myCapabilities });
await host.load({ moduleSource, manifest });
// per bar: await host.push({ kind: "close", bar });
//          const emissions = await host.drain();
// teardown: host.dispose();
```

The Worker host accepts a `workerLike` injection seam so tests can drive
it through a `MessageChannel` (see
[`parity-smoke.mts`](https://github.com/outraday-org/chartlang/blob/main/parity-smoke.mts)).
To run server-side instead, swap `createWorkerHost` for
`createQuickJsHost` — the `load` / `push` / `drain` / `dispose` calls are
identical.

## 3. Render through an adapter

`@invinite-org/chartlang-adapter-kit` defines the contract; you bring
the renderer. The reference adapter,
[`examples/canvas2d-adapter/`](https://github.com/outraday-org/chartlang/tree/main/examples/canvas2d-adapter)
(package `chartlang-example-canvas2d-adapter`), shows the full flow:
`createCanvas2dAdapter` constructs a handle wrapping a host, a candle
source, and a renderer; `runRendererLoop` pumps candles through the host
and drains emissions onto a canvas.

```ts
import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
import type { Bar, ScriptManifest } from "@invinite-org/chartlang-core";
import {
    createCanvas2dAdapter,
    runRendererLoop,
} from "chartlang-example-canvas2d-adapter";

declare const canvas: HTMLCanvasElement;
declare const bars: ReadonlyArray<Bar>;
declare const moduleSource: string;
declare const manifest: ScriptManifest;

const controller = new AbortController();
const adapter = createCanvas2dAdapter({
    canvas,
    candleSource: mockCandleSource(bars, { interval: "1D", mode: "stream" }),
});
await adapter.host.load({ moduleSource, manifest });
await runRendererLoop(adapter, { signal: controller.signal });
// teardown: controller.abort(); adapter.dispose();
```

The adapter's `Capabilities` gate every emission: anything it does not
advertise is a silent no-op (see [`adapter.md`](./adapter.md)).

## Full wiring

- [`examples/react-demo/`](https://github.com/outraday-org/chartlang/tree/main/examples/react-demo)
  — editor + live chart. `src/ChartPane.tsx` shows the React pattern
  (every new compile disposes the previous adapter and spins up a fresh
  one against the same canvas); `vite.config.ts` shows the alias stubs
  that let the language service load in-browser for hover/completion
  while the real `compile()` runs server-side over `/api/compile`.
- [`examples/canvas2d-adapter/playground/`](https://github.com/outraday-org/chartlang/tree/main/examples/canvas2d-adapter/playground)
  — the vanilla (no-framework) version of the same loop.

## Next steps

- [Hosts/Worker](https://github.com/outraday-org/chartlang/blob/main/docs/hosts/worker.md) — the Worker host's limits API and `step-overshoot` contract.
- [Hosts/QuickJS](https://github.com/outraday-org/chartlang/blob/main/docs/hosts/quickjs.md) — heap cap, real preemption, WASM flow.
- [Spec/Emissions](https://github.com/outraday-org/chartlang/blob/main/docs/spec/emissions.md) — the canonical wire shape your `onEmissions` sees.
