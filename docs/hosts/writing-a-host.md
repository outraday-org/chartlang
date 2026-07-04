# Writing a host

A chartlang host is the sandbox boundary between the script bundle and
the embedder. It owns the runtime instance, polices CPU and memory, and
keeps the `RunnerEmissions` payload structured-clone-safe. There are two
hosts in the workspace today — [`host-worker`](./worker.md) (browser
default) and [`host-quickjs`](./quickjs.md) (server-side, untrusted).
This page is for anyone writing a third host (Bun isolate, Deno worker,
process-isolated runner, ...).

## The `ScriptHost` interface

Every host implements the same lifecycle handle:

```ts
import type {
    CandleEvent,
    ExternalSeriesFeedMap,
    PlotOverride,
    RunnerEmissions,
} from "@invinite-org/chartlang-adapter-kit";
import type { HostCompiledScript, HostLimits } from "@invinite-org/chartlang-host-worker";

export type ScriptHost = {
    load(compiled: HostCompiledScript): Promise<void>;
    push(event: CandleEvent): Promise<void>;
    drain(): Promise<RunnerEmissions>;
    setPlotOverrides(overrides: Readonly<Record<string, PlotOverride>>): void;
    setExternalSeries(feeds: ExternalSeriesFeedMap): void;
    dispose(): void;
    readonly limits: HostLimits;
};
```

`PlotOverride` and `ExternalSeriesFeedMap` are re-exported from
`@invinite-org/chartlang-adapter-kit`.

`HostCompiledScript` is `{ moduleSource: string; manifest: ScriptManifest }`.
The compiled output of `pnpm chartlang compile` is exactly this shape
(plus a `.d.ts` sidecar — hosts ignore that file).

Stage the lifecycle as:

1. **`load`.** Boot the isolate, ferry the compiled module source plus
   the adapter's `Capabilities`, `symInfo`, resolved input overrides,
   initial external-series feeds, and `HostLimits` across the membrane. Run the module to construct
   the `CompiledScriptObject`, then build a `ScriptRunnerHandle`
   around it via `createScriptRunner` from
   `@invinite-org/chartlang-runtime`. Resolve when the boot acks; reject
   with a descriptive message and a deadline on
   `HostLimits.maxLoadTimeoutMs`.
2. **`push`.** Forward `CandleEvent`s in delivery order. The runtime
   inside the isolate calls `runner.push(event)` for each one. A `history`
   event delivered to a runner that has already advanced past bar `0` is a
   full **re-seed** when it **overlaps** already-processed history (its first
   bar is not strictly newer than the last closed bar): the runtime rebuilds
   runner state and replays the batch from bar `0`, preserving the latest
   `setExternalSeries` / `setPlotOverrides` maps and dropping any undrained
   emissions. A forward-continuation batch (every bar strictly newer — e.g.
   chunked history loading) appends as before (see
   [Execution semantics § History re-seed](../spec/semantics.md#history-re-seed)).
   Secondary streams reset to empty on a re-seed — if the script uses
   `request.security` / `request.lowerTf`, the host MUST re-push the secondary
   `history` for each `streamKey` after re-pushing the main `history`, or those
   requests read warmup `NaN` / empty buckets until the next secondary event.
3. **`drain`.** Round-trip a request for the queued `RunnerEmissions`
   batch since the last drain. Revalidate plot and alert emissions on
   the way out with `validateEmission` from
   `@invinite-org/chartlang-adapter-kit` — this is the defence-in-depth
   trust boundary.
4. **`dispose`.** Tear down the isolate. Reject every pending drain
   with a descriptive error (do not resolve with empty emissions —
   that hides resource leaks).

## Resource caps

`HostLimits` is the cross-host contract:

| Field | Meaning |
| --- | --- |
| `maxHeapBytes` | Hard memory cap if the underlying runtime supports one (QuickJS does, Web Workers do not). |
| `maxCpuMsPerStep` | CPU budget per compute step. Hosts that can preempt should preempt; hosts that can only measure should report `step-overshoot`. |
| `maxRingBufferBars` | Forwarded for runtime sizing decisions; the adapter's `Capabilities.maxLookback` is the canonical source. |
| `maxLoadTimeoutMs` | Deadline for the boot ack. Informational on hosts whose load is synchronous. |

Expose the resolved `HostLimits` on `host.limits`. Embedders read it
back to size their own watchdogs.

## The wire shape

The Worker host uses postMessage + structured clone. The QuickJS host
uses JSON-string passing through the WASM membrane. Any host design
must satisfy two invariants:

- **Frames are JSON-friendly and structured-clone-safe.** No functions,
  no class instances, no `Date`, no `Map`, no `Set`, no `RegExp`, no
  `bigint`, no `symbol`. The wire-safety rules are normative in
  [Emission payloads § wire-safety invariant](../spec/emissions.md#wire-safety-invariant).
- **The host is the source of truth for capabilities and limits.** The
  isolate never falls back to a default capability bag or default
  limits — every `load` frame carries both.

`host-worker`'s frame shape is a good blueprint:

| Direction | Frame |
| --- | --- |
| Host → guest | `{ kind: "load", compiled, capabilities, symInfo?, inputOverrides?, plotOverrides?, externalSeriesFeeds?, limits }` |
| Host → guest | `{ kind: "candleEvent", event }` (fire-and-forget) |
| Host → guest | `{ kind: "drain", nonce }` |
| Host → guest | `{ kind: "setPlotOverrides", overrides }` |
| Host → guest | `{ kind: "setExternalSeries", feeds }` |
| Host → guest | `{ kind: "dispose" }` |
| Guest → host | `{ kind: "loaded" }` or `{ kind: "loadError", message }` |
| Guest → host | `{ kind: "emissions", nonce, emissions }` |
| Guest → host | `{ kind: "step-overshoot", observedMs }` (fire-and-forget) |
| Guest → host | `{ kind: "fatal", message }` |

The `nonce` on `drain` is mandatory — drains are round-trips and
pipelining is allowed.

The optional `plotOverrides` on the `load` frame is the initial
`slotId`-keyed [plot override](../adapters/contract.md#plot-overrides) map
(resolved from `Adapter.resolvePlotOverrides`), mirroring `inputOverrides`.
The `setPlotOverrides` frame is a live, presentation-only update: the boot
scope calls `runner.setPlotOverrides(overrides)`, which replaces the
runtime's override map in place (no recompute). Because overrides are
applied at emit time — not fed to `compute` — they are safe to change
mid-run without breaking the frozen-input determinism guarantee. The
QuickJS host relays `setPlotOverrides` as a synchronous host→guest call
(like `drain`); the Worker host posts it fire-and-forget.

The optional `externalSeriesFeeds` on the `load` frame is the initial
`input.externalSeries(...)` feed map resolved from
`Adapter.feedExternalSeries` / host constructor options. The
`setExternalSeries` frame is a live whole-map replacement:
`runner.setExternalSeries(feeds)` replaces the runtime's map without
merging partial keys. Omitted feed names clear previous data and read as
`NaN` on later computes. QuickJS relays it synchronously through the JSON
membrane; the Worker host posts it fire-and-forget.

## Determinism contract

A host that swaps in for another must preserve cross-host emission
parity. For the same compiled bundle, the same candle stream, the same
inputs, external-series feeds, the same symbol metadata, and the same capabilities, the
drained `RunnerEmissions` must be byte-identical.

The conformance suite at
[`@invinite-org/chartlang-conformance`](../adapters/conformance.md)
runs 220 scenarios; both shipped hosts pass every one. A third host
must do the same before declaring `apiVersion: 1` support.

## Cross-links

- The two shipped hosts:
  [worker host](./worker.md) and [QuickJS host](./quickjs.md).
- The adapter contract a host gates against: [Adapter contract](../adapters/contract.md).
- The wire schemas a host re-validates: [Emission payloads](../spec/emissions.md).
- The frozen contract: [apiVersion contract](../spec/versioning.md).
