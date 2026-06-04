# @invinite-org/chartlang-host-worker

`experimental`

Browser-default `ScriptHost` for chartlang. Boots a Web Worker, loads a
compiled script bundle, and round-trips `CandleEvent` / `RunnerEmissions`
across a structured-clone-safe postMessage protocol.

## Install

```bash
pnpm add @invinite-org/chartlang-host-worker
```

## Public surface

- `createWorkerHost(opts) → ScriptHost` — main-side factory; the canvas2d
  reference adapter (Task 10) consumes the returned host.
- `DEFAULT_LIMITS` — Phase-1 `HostLimits` defaults
  (`maxCpuMsPerStep: 50`, `maxHeapBytes: 64 MiB`, `maxRingBufferBars: 5000`).
- Types: `ScriptHost`, `HostLimits`, `WorkerLike`, `HostCompiledScript`,
  `HostToWorker`, `WorkerToHost`, `CreateWorkerHostOpts`.

## Minimum-viable API call

```ts
import { createWorkerHost } from "@invinite-org/chartlang-host-worker";
// host: ScriptHost — passed to an adapter at construction time.
```

## Stability

Phase 1 ships the postMessage wire protocol + a measurement-based CPU
watchdog (`step-overshoot` reports observed elapsed ms; no preemption).
Deferred to Phase 5 (per PLAN §19):

- Worker-side CSP enforcement.
- Hard heap caps (`maxHeapBytes` is advisory today — no browser API
  exposes a reliable per-worker heap limit).
- Real preemption via `setInterruptHandler` (lands with the QuickJS
  host).
- Fingerprint-only globals (`Math.random`, `Date.now`, …) — Phase 1
  relies on the compiler's `forbiddenConstructs` pass to scrub these
  from the bundle before it ever reaches a worker.

## Docs

See [`docs/hosts/worker.md`](../../docs/hosts/worker.md).

## License

MIT
