# Embed in your chart

Run user-supplied chartlang scripts inside an existing chart UI. The
embed is three layers — compile, host, adapter — wired through a pair
of typed JSON-safe boundaries.

```mermaid
flowchart LR
    user[user-supplied .chart.ts] --> compiler[compiler]
    compiler --> host[host]
    host --> adapter[your adapter]
    adapter --> chart[your chart UI]
```

The compiler runs server-side (it needs node and native esbuild). The
host runs wherever you want isolation — a Web Worker in the browser, a
QuickJS-WASM sandbox on a server. The adapter is the bridge to your
existing chart library.

## Start by installing the integration skill

Before you wire any of this up, install the **chartlang-setup** skill
into the AI assistant you build with (Claude Code, Claude.ai, Cursor).
It teaches the assistant the compiler → host → adapter flow, capability
gating, and the host parity guarantee — so it scaffolds the embed
correctly instead of guessing at the boundaries below. Wiring chartlang
into a product is the step the skill helps with most:

```bash
npx skills add outraday-org/chartlang/tree/main/skills/chartlang-setup
```

See [Skills](../skills/) for the full overview and manual-install
targets. The companion [chartlang-coding](../skills/chartlang-coding)
skill helps once you (or your users) are writing the `.chart.ts`
scripts that run through this embed.

## Compile server-side

The compiler imports node builtins (`fs`, `crypto`, `path`) and a
native esbuild launcher, so it does not bundle for the browser. Run it
under node — typically inside a small HTTP endpoint your editor calls:

```ts no-gate
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

`apps/site/src/routes/api/compile.ts` (with its server-only helper
`apps/site/src/lib/server/compile.ts`) shows the same pattern as a
TanStack Start server route deployed as a Netlify Function — it runs
`compile()` behind `POST /api/compile` and ships the response to the
browser editor.

## Host the bundle

The compiled `moduleSource` is a self-contained ESM string with an
`export const __manifest = ...;` tail. Pick a host based on where you
want execution to live:

- `@invinite-org/chartlang-host-worker` — Web Worker isolation in the
  browser. Loads the bundle via a `data:` URL so a single code path
  works in production browsers and node test environments.
- `@invinite-org/chartlang-host-quickjs` — QuickJS-WASM sandbox.
  Process-isolated, with real CPU preemption + hard heap caps. Ideal
  for server-side alert execution when no browser is open.

Both hosts expose the same `ScriptHost` shape, so swapping is a
one-line change:

```ts no-gate
import { createWorkerHost } from "@invinite-org/chartlang-host-worker";
import type { Capabilities, ScriptManifest } from "@invinite-org/chartlang-adapter-kit";

declare const myCapabilities: Capabilities;
declare const moduleSource: string;
declare const manifest: ScriptManifest;

const host = createWorkerHost({ capabilities: myCapabilities });
await host.load({ moduleSource, manifest });
// later: host.push({ kind: "close", bar }); host.drain(); host.dispose();
```

The Worker host accepts a `workerLike` injection seam so tests can
drive it through a `MessageChannel` (the
[`parity-smoke.mts`](https://github.com/outraday-org/chartlang/blob/main/parity-smoke.mts)
script demonstrates).

## Render through an adapter

`@invinite-org/chartlang-adapter-kit` defines the contract; you bring
the renderer. The reference adapter under
[`examples/canvas2d-adapter/`](https://github.com/outraday-org/chartlang/tree/main/examples/canvas2d-adapter)
shows the full flow — `createCanvas2dAdapter` constructs a handle that
wraps a host, a candle source, and a renderer; `runRendererLoop`
pumps candles through the host and drains emissions onto a canvas:

```ts no-gate
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
// later: controller.abort(); adapter.dispose();
```

`apps/site/src/components/demo/ChartPane.tsx` shows the React-flavoured
version of the same pattern — every new compile disposes the previous
adapter and spins up a fresh one against the same canvas.

## Sandboxing

The execution sandbox is the runtime's first guarantee. Scripts cannot
reach `Math.random`, `Date`, `fetch`, `setTimeout`, or the DOM — the
compiler rejects every hostile global through `forbiddenConstructs`
before the bundle is built, and the host re-validates every emission
on `drain()` as defence-in-depth.

Per-script limits are set on the host:

- **Worker host** — CPU watchdog is measurement-only (the browser
  cannot preempt a Worker mid-step). A `step-overshoot` warning
  surfaces through the optional `onWorkerError` callback when a single
  compute step exceeds the configured budget.
- **QuickJS host** — real CPU preemption and a hard heap cap. A
  runaway script aborts cleanly without taking the host process with
  it. This is the host to run on a server.

Both hosts return byte-identical plot and alert streams for the same
input — the
[`parity-smoke.mts`](https://github.com/outraday-org/chartlang/blob/main/parity-smoke.mts)
script in the repo root runs the EMA-cross example through all three
execution paths (in-process runner, Worker host, QuickJS host) and
asserts identical output.

## Browser bundling rough edges

The compiler and the language service both transitively import node
builtins (`fs/promises`, `path`, `url`, `crypto`, `os`) and a native
esbuild launcher. The
[`apps/site/vite.config.ts`](https://github.com/outraday-org/chartlang/blob/main/apps/site/vite.config.ts)
file shows the pattern that lets the language service load in the
browser for hover / completion while the real `compile()` runs
server-side over `/api/compile`. The stubs are redirected with a
**client-only** plugin — a plain `resolve.alias` would rewrite the
server graph too and neuter the real compiler the server route needs:

```ts no-gate
import { fileURLToPath } from "node:url";
import { type Plugin, defineConfig } from "vite";

const ESBUILD_STUB = fileURLToPath(
    new URL("./src/lib/browser-stubs/esbuildStub.ts", import.meta.url),
);
const NODE_BUILTIN_STUB = fileURLToPath(
    new URL("./src/lib/browser-stubs/nodeBuiltinStub.ts", import.meta.url),
);
const NODE_BUILTIN_RE = /^node:(crypto|fs\/promises|path|url|os)$/;

function clientBrowserStubs(): Plugin {
    return {
        name: "chartlang-client-browser-stubs",
        applyToEnvironment: (env) => env.name === "client",
        enforce: "pre",
        resolveId(id) {
            if (id === "esbuild") return ESBUILD_STUB;
            if (NODE_BUILTIN_RE.test(id)) return NODE_BUILTIN_STUB;
            return null;
        },
    };
}

export default defineConfig({
    optimizeDeps: { exclude: ["esbuild"] },
    // esbuild's JS API cannot be bundled into the server build — keep it
    // external so the function runtime loads it from node_modules.
    environments: { ssr: { build: { rollupOptions: { external: ["esbuild"] } } } },
    plugins: [clientBrowserStubs() /* …framework plugins… */],
});
```

The stubs return enough surface for module-load to succeed; any
attempt to actually call into them fails fast. The server-side
`compile()` runs in node and reaches the real implementations because
the stub plugin is scoped to the `client` environment only.

## Next steps

- [Skills](../skills/) — install the chartlang-setup skill so your AI
  assistant scaffolds this embed against the real contract.
- [Hosts/Worker](../hosts/worker.md) — the Worker host's limits API,
  the postMessage protocol, the `step-overshoot` contract.
- [Hosts/QuickJS](../hosts/quickjs.md) — the QuickJS host's heap
  cap, real preemption, and the WASM module flow.
- [Adapter contract](../adapters/contract.md) — the type-level
  reference for every emission shape your `onEmissions` will see.
- [Spec/Emissions](../spec/emissions.md) — the canonical wire shape
  for every payload moving through the boundaries above.
