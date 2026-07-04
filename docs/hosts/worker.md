# Worker host

`@invinite-org/chartlang-host-worker` is the browser-default `ScriptHost`.
It boots a Web Worker, loads a compiled chartlang bundle into it, and
relays `CandleEvent` and `RunnerEmissions` between the main thread and
the worker through a structured-clone-safe postMessage protocol.

## When to use it

The worker host is the right default for any browser embedder. It runs
the script off the main thread, lets the runtime own its own event loop,
and keeps the postMessage boundary as the trust line for emission
validation.

For server-side execution, untrusted-script runs, and CI conformance,
use [`@invinite-org/chartlang-host-quickjs`](./quickjs.md) instead. The
two hosts implement the same `ScriptHost` interface; swap behind that
interface as needed.

## Minimum-viable usage

```ts
import { capabilities, defineAdapter } from "@invinite-org/chartlang-adapter-kit";
import type { Adapter } from "@invinite-org/chartlang-adapter-kit";
import { createWorkerHost } from "@invinite-org/chartlang-host-worker";
import type { HostCompiledScript } from "@invinite-org/chartlang-host-worker";

declare const adapter: Adapter;
declare const compiled: HostCompiledScript;

const host = createWorkerHost({ capabilities: adapter.capabilities });
await host.load(compiled);
await host.push({ kind: "history", bars: [] });
const emissions = await host.drain();
adapter.onEmissions(emissions);
host.dispose();
```

`createWorkerHost` returns a frozen `ScriptHost`. The lifecycle methods
are:

| Method | Purpose |
| --- | --- |
| `load(compiled)` | Send the compiled bundle plus the adapter's capabilities, resolved inputs, resolved plot overrides, and initial external-series feeds to the worker. Awaits the boot `loaded` reply or rejects after `maxLoadTimeoutMs` (default 30 s). |
| `push(event)` | Forward a `history`, `close`, or `tick` `CandleEvent` to the worker. Fire-and-forget. |
| `drain()` | Round-trip a request for the queued `RunnerEmissions` batch since the last drain. |
| `setPlotOverrides(overrides)` | Replace the live `slotId`-keyed [plot overrides](../adapters/contract.md#plot-overrides) — visibility / color / line cosmetics. Presentation-only, no recompute; the next `drain()` reflects it. Fire-and-forget. |
| `setExternalSeries(feeds)` | Replace the complete `input.externalSeries(...)` feed map. Omitted keys clear previous feeds and resolve to `NaN` on later computes. Fire-and-forget. |
| `dispose()` | Terminate the worker and reject any pending drains. |

`host.limits` exposes the resolved `HostLimits` (`maxCpuMsPerStep: 50`,
`maxHeapBytes: 64 MiB`, `maxRingBufferBars: 5_000`,
`maxLoadTimeoutMs: 30_000`).

## History re-seed

`push({ kind: "history", bars })` into a runner that has already advanced
past bar 0 is a full **re-seed** when the batch **overlaps** already-processed
history (its first bar is not strictly newer than the last closed bar): the
runtime rebuilds runner state and replays `bars` from bar 0
(`emissions.fromBar === 0`), so re-pushed bars land at `0..N-1` instead of
`N..2N-1`. A forward-continuation batch (every bar strictly newer — the shape
a host emits when it chunks one history load) appends as before. The worker
forwards `history` frames verbatim, so it inherits the semantics with no
host-side change. The
re-seed **preserves** the latest `setExternalSeries` / `setPlotOverrides`
maps (it exists precisely to re-read them from bar 0) and **drops** any
undrained pre-re-seed emissions. See
[Execution semantics § History re-seed](../spec/semantics.md#history-re-seed).

Caveat — **secondary streams reset to empty** on a re-seed. If the script
uses `request.security` / `request.lowerTf`, re-push each secondary
`history` (by `streamKey`) after re-pushing the main `history`, or those
requests read warmup `NaN` until the next secondary event arrives.

## Wiring a real Worker

The worker host boots via `data:` URL on internal test runs; production
callers point a real `Worker` at the package's `worker-boot` subpath so
the bundler emits the file as a module Worker:

```ts
import { createWorkerHost } from "@invinite-org/chartlang-host-worker";

const workerUrl = new URL(
    "@invinite-org/chartlang-host-worker/worker-boot",
    import.meta.url,
);
const worker = new Worker(workerUrl, { type: "module" });

declare const capabilities: import("@invinite-org/chartlang-adapter-kit").Capabilities;
const host = createWorkerHost({ capabilities, workerLike: worker });
void host;
```

Vite, Webpack 5, Rspack, and Parcel all support the `new URL(..., import.meta.url)`
pattern for Worker boot files.

## Constructor options

`CreateWorkerHostOpts` lets the adapter pass:

- `capabilities` — required. The capability bag the runtime gates every
  emission against. The worker never falls back to a default capability
  bag; the host is the source of truth.
- `symInfo` — optional adapter-supplied per-mount symbol metadata for
  the runtime's `syminfo.*` view.
- `resolveInputs` — optional adapter callback. The host calls it during
  `load()` and forwards the plain override record to the worker.
- `resolvePlotOverrides` — optional adapter callback for the initial
  `slotId`-keyed [plot overrides](../adapters/contract.md#plot-overrides).
  The host calls it during `load()` and forwards the plain override record
  on the `load` frame; push live changes afterward via
  `host.setPlotOverrides(...)`.
- `resolveExternalSeries` — optional adapter callback for initial
  `input.externalSeries(...)` feeds. The host calls it during `load()` and
  forwards the plain feed map on the `load` frame. Push live whole-map
  replacements afterward via `host.setExternalSeries(...)`; omitted keys
  clear previous feeds.
- `workerLike` — test seam. Tests supply a `MessageChannel` port; in
  production omit it and the host constructs a real `Worker`.
- `limits` — partial `HostLimits` overrides. Missing fields fall through
  to `DEFAULT_LIMITS`.
- `onWorkerError` — called when the worker posts `step-overshoot` or
  `fatal`. Use it to surface diagnostics in the host UI.

## Persistent state

`@invinite-org/chartlang-host-worker/idb` ships `idbStateStore(opts)`,
an IndexedDB-backed `PersistentStateStore` for browser warm starts. The
store persists one snapshot per `StateStoreKey` (compiler version,
script hash, capabilities hash, symbol, intervals, ...) and evicts the
oldest snapshot when writes exceed the configured cap (50 MiB default).

The warm-start guarantee is documented in
[Execution semantics § State Persistence](../spec/semantics.md#state-persistence):
a warm-started run followed by the replayed gap and live suffix
produces byte-identical emissions to a cold run over the full stream.

## Sandbox model

The worker host does **not** enforce a heap cap — no browser API
exposes one reliably per Worker. CPU watchdog is measurement-only: the
worker reports observed `step-overshoot` events but cannot preempt the
compute. The compiler's
[forbidden-constructs pass](../language/forbidden-constructs.md) is the
primary sandbox: it scrubs `Date`, `Math.random`, `fetch`, dynamic
`import()`, `eval`, and the rest from the bundle before it ever reaches
the worker.

Real CPU and memory enforcement live in the
[QuickJS host](./quickjs.md), which is what production server-side
deployments should reach for.

## Cross-links

- The other host: [QuickJS host](./quickjs.md).
- The author-side contract: [Writing a host](./writing-a-host.md).
- Adapter contract the host gates against: [Adapter contract](../adapters/contract.md).
- Emission wire shapes: [Emission payloads](../spec/emissions.md).
