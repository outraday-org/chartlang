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
import type {
    HostCompiledScript,
    HostLimits,
    HostSnapshot,
} from "@invinite-org/chartlang-host-worker";

export type ScriptHost = {
    load(compiled: HostCompiledScript): Promise<void>;
    push(event: CandleEvent): Promise<void>;
    drain(): Promise<RunnerEmissions>;
    setPlotOverrides(overrides: Readonly<Record<string, PlotOverride>>): void;
    setExternalSeries(feeds: ExternalSeriesFeedMap): void;
    exportSnapshot(): Promise<HostSnapshot | null>;
    importSnapshot(exported: HostSnapshot): Promise<{ barIndex: number }>;
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
   trust boundary. Note that the **mount-time** diagnostics raised while
   inputs resolve (`unsupported-input-kind`, `input-coercion-failed`) are
   only observable if the embedder drains before the first event or seeds
   the runner with a `history` push — the per-bar close path resets the
   emission queues before each compute step. A host that streams bar-by-bar
   from mount and never re-seeds discards them (see
   [Emissions § Mount-time diagnostics](../spec/emissions.md#mount-time-diagnostics)).
4. **`exportSnapshot` / `importSnapshot`.** Lift the runner's whole state
   out (`runner.exportSnapshot()` inside the isolate) as a
   {@link HostSnapshot} envelope — the `StateSnapshot` bound to the
   `StateStoreKey` the host was constructed with — and put it back into a
   freshly loaded runner. Import is legal only **after `load` and before the
   first `push`**, and only when the envelope's key matches the host's own
   (two absent keys also match). Refuse anything else with a **typed**
   error, never the host's fatal channel: the runner is still alive and the
   caller's fallback is a full replay. The ack carries the last bar folded
   in, so the embedder resumes at `barIndex + 1` — the host never skips bars
   on its behalf.
5. **`dispose`.** Tear down the isolate. Reject every pending drain
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
| Host → guest | `{ kind: "load", compiled, capabilities, symInfo?, inputOverrides?, plotOverrides?, externalSeriesFeeds?, stateStoreKey?, sessionCalendar?, limits }` |
| Host → guest | `{ kind: "candleEvent", event }` (fire-and-forget) |
| Host → guest | `{ kind: "drain", nonce }` |
| Host → guest | `{ kind: "setPlotOverrides", overrides }` |
| Host → guest | `{ kind: "setExternalSeries", feeds }` |
| Host → guest | `{ kind: "exportSnapshot", nonce }` |
| Host → guest | `{ kind: "importSnapshot", nonce, snapshot, key }` |
| Host → guest | `{ kind: "dispose" }` |
| Guest → host | `{ kind: "loaded" }` or `{ kind: "loadError", message }` |
| Guest → host | `{ kind: "emissions", nonce, emissions }` |
| Guest → host | `{ kind: "snapshot", nonce, snapshot, key }` |
| Guest → host | `{ kind: "snapshotImported", nonce, barIndex }` |
| Guest → host | `{ kind: "snapshotError", nonce, message }` |
| Guest → host | `{ kind: "step-overshoot", observedMs }` (fire-and-forget) |
| Guest → host | `{ kind: "fatal", message }` |

The `nonce` on `drain` is mandatory — drains are round-trips and
pipelining is allowed. The snapshot frames use the same nonce convention.

`snapshotError` is deliberately separate from `fatal`. A refused snapshot
verb (called before `load`, called after the first push, a `StateStoreKey`
mismatch, a payload the validator rejects) leaves the runner usable; a
`fatal` does not. Hosts surface it as
[`SnapshotError`](https://npmjs.com/package/@invinite-org/chartlang-core) from
`@invinite-org/chartlang-core`, whose `isSnapshotError` guard matches on
`name` so it survives a membrane crossing.

The optional `stateStoreKey` on the `load` frame is the snapshot identity the
guest stamps on every export and checks on every import. It is
caller-supplied: a host cannot derive `scriptHash` (a digest of the module
source), `symbol`, or `mainInterval` on its own.

The optional `sessionCalendar` on the `load` frame carries exchange-calendar
ROWS (`SessionCalendarDay[]`), never a built calendar: the `lookup()` interface
has a method and would not survive `structuredClone` or a JSON membrane, so the
guest rebuilds it via `createScriptRunner({ sessionCalendar })`. It is a field
on the existing `load` frame by design — a calendar is mount data, not a verb.

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
