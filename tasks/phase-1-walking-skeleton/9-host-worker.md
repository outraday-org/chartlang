# Task 9 — Host-worker: `createWorkerHost` + postMessage Protocol

> **Status: TODO**

## Goal

Land `@invinite-org/chartlang-host-worker` per §8.2: a `ScriptHost`
implementation that boots a Web Worker, loads a `CompiledScript`
inside it, relays `CandleEvent`s in, and streams
`RunnerEmissions` out via a structured-clone-safe postMessage
protocol. The host is the browser default — the canvas2d adapter
(Task 10) consumes it.

## Prerequisites

- Task 6 (runtime `ScriptRunner`).
- Tasks 7-8 (runtime primitives — the compiled bundle imports from
  `@invinite-org/chartlang-runtime` and needs the full ta.* + plot
  / hline / alert surface loaded inside the Worker).
- Task 4 (`CandleEvent`, `RunnerEmissions`, `validateEmission`).

## Desired Behavior

After this task:

- `createWorkerHost(opts) → ScriptHost` returns a host whose
  methods (`load`, `push`, `drain`, `dispose`) cross the Worker
  boundary via `postMessage` with structured clones.
- The boot script (the JS the Worker runs) loads
  `@invinite-org/chartlang-runtime`, registers a message handler,
  loads the compiled `moduleSource`, and runs it against a
  `ScriptRunner`.
- Watchdog: `maxCpuMsPerStep` enforces a per-step CPU cap by
  measuring `performance.now()` deltas around the script's
  `compute`. Excess → terminate the Worker, emit a
  `runtime-cpu-budget-exceeded` diagnostic on the main side.
- 100% coverage. The Worker side is testable via a
  `node:worker_threads` shim wrapped in a `WorkerLike` interface
  so vitest can drive both sides in one process.

## Requirements

### 1. `ScriptHost` interface

`ScriptHost` and `HostLimits` are **host-package concerns** —
`createScriptRunner` (Task 6) ships the per-VM `ScriptRunner`; the
worker boundary belongs to host-worker. Declare both types here,
not in runtime. Phase-5's `host-quickjs` re-uses the same
`ScriptHost` shape (it lives in this package and Phase 5 imports
it OR redeclares it identically per §8.1 — Phase 1 is the single
declaration).

Per §8.1:

```ts
// packages/host-worker/src/index.ts
export type ScriptHost = {
    load(compiled: CompiledScript): Promise<void>;
    push(event: CandleEvent): Promise<void>;
    drain(): Promise<RunnerEmissions>;
    dispose(): void;
    readonly limits: HostLimits;
};

export type HostLimits = {
    readonly maxHeapBytes: number;
    readonly maxCpuMsPerStep: number;
    readonly maxRingBufferBars: number;
};
```

`createScriptRunner` returns a `ScriptRunner` (per-process, same
VM); the host wraps it across the Worker boundary into a
`ScriptHost`. No back-amend to Task 6 is needed.

### 2. `src/protocol.ts` — wire messages

Discriminated union for both directions. The `load` message
carries the adapter's `Capabilities` bag alongside the compiled
module — there is **no `defaultWorkerCapabilities`**; the host
side is the source of truth and the worker boot accepts whatever
the host supplies.

```ts
export type HostToWorker =
    | { kind: "load"; compiled: { moduleSource: string; manifest: ScriptManifest }; capabilities: Capabilities }
    | { kind: "candleEvent"; event: CandleEvent }
    | { kind: "drain"; nonce: number }
    | { kind: "dispose" };

export type WorkerToHost =
    | { kind: "loaded" }
    | { kind: "loadError"; message: string }
    | { kind: "emissions"; nonce: number; emissions: RunnerEmissions }
    | { kind: "step-overshoot"; observedMs: number; nonce: number }
    | { kind: "fatal"; message: string };
```

`nonce` correlates a `drain` request with its `emissions` reply.

All payloads are JSON-clean (use Task 4's `validateEmission` on
emissions before posting back). No structured-clone surprises.

### 3. `src/workerBoot.ts` — the script the Worker runs

```ts
// Worker entry. Imports run inside the worker via the worker's
// module loader.
import { createScriptRunner } from "@invinite-org/chartlang-runtime";

let runner: ScriptRunner | null = null;
let dynamicModule: { default: CompiledScriptObject } | null = null;

self.addEventListener("message", async (ev: MessageEvent<HostToWorker>) => {
    const msg = ev.data;
    try {
        switch (msg.kind) {
            case "load": {
                // Boot the compiled module from a blob URL.
                const blob = new Blob([msg.compiled.moduleSource], { type: "text/javascript" });
                const url = URL.createObjectURL(blob);
                dynamicModule = await import(url) as { default: CompiledScriptObject };
                URL.revokeObjectURL(url);
                runner = createScriptRunner({
                    compiled: dynamicModule.default,
                    capabilities: msg.capabilities,             // host supplies — no in-worker default
                });
                postBack({ kind: "loaded" });
                break;
            }
            case "candleEvent": {
                if (!runner) throw new Error("candleEvent before load");
                await dispatchEvent(runner, msg.event);
                break;
            }
            case "drain": {
                if (!runner) throw new Error("drain before load");
                postBack({ kind: "emissions", nonce: msg.nonce, emissions: runner.drain() });
                break;
            }
            case "dispose": {
                runner?.dispose();
                runner = null;
                dynamicModule = null;
                break;
            }
        }
    } catch (err) {
        postBack({ kind: "fatal", message: (err as Error).message });
    }
});

function dispatchEvent(runner: ScriptRunner, ev: CandleEvent): Promise<void> {
    switch (ev.kind) {
        case "history": return runner.onHistory(ev.bars);
        case "close":   return runner.onBarClose(ev.bar);
        case "tick":    return runner.onBarTick(ev.bar);
    }
}
```

The consumer (the canvas2d adapter — Task 10) passes the
adapter's real `Capabilities` bag in
`createWorkerHost({ capabilities })`. That bag is bolted onto
every `load` postMessage. The worker boot is **stateless** about
capabilities: it never falls back to a default.

### 4. `src/limits.ts` — watchdog

```ts
export const DEFAULT_LIMITS: HostLimits = {
    maxHeapBytes: 64 * 1024 * 1024,
    maxCpuMsPerStep: 50,
    maxRingBufferBars: 5_000,
};

export function watchStep<T>(fn: () => Promise<T>, maxMs: number): Promise<{
    result: T | null;
    overshoot: number;   // 0 if within budget; observed ms if over
}>;
```

Phase-1 enforcement is **measurement, not preemption**: V8 can't
suspend a synchronous Worker mid-script. The watchdog measures
`performance.now()` deltas and, if a step exceeds `maxMs`,
reports back via `{ kind: "step-overshoot" }`. The main-side host
promotes overshoots to `runtime-cpu-budget-exceeded` diagnostics.

Phase 5's QuickJS host adds real preemption via
`setInterruptHandler`. Don't try to fake it with `setTimeout +
worker.terminate()` here — that path destroys state without
recovery and we don't want to ship that complexity for the walking
skeleton.

`maxHeapBytes` is advisory in Phase 1 (no browser API exists for
reliable per-worker heap caps). Document this as deferred (§19
Phase 5 ships real heap caps).

### 5. `src/createWorkerHost.ts` — the public factory

```ts
export type CreateWorkerHostOpts = {
    capabilities: Capabilities;
    workerLike?: WorkerLike;   // injection point for tests
    limits?: Partial<HostLimits>;
    onWorkerError?: (message: string) => void;
};

export function createWorkerHost(opts: CreateWorkerHostOpts): ScriptHost {
    const limits: HostLimits = { ...DEFAULT_LIMITS, ...opts.limits };
    const worker = opts.workerLike ?? new Worker(WORKER_BOOT_URL, { type: "module" });

    let nonce = 0;
    const pendingDrains = new Map<number, (e: RunnerEmissions) => void>();
    let loadedResolve: (() => void) | null = null;
    let loadedReject: ((err: Error) => void) | null = null;

    worker.addEventListener("message", (ev: MessageEvent<WorkerToHost>) => {
        const msg = ev.data;
        switch (msg.kind) {
            case "loaded": loadedResolve?.(); break;
            case "loadError": loadedReject?.(new Error(msg.message)); break;
            case "emissions": pendingDrains.get(msg.nonce)?.(msg.emissions); pendingDrains.delete(msg.nonce); break;
            case "step-overshoot": opts.onWorkerError?.(`step overshoot ${msg.observedMs}ms`); break;
            case "fatal": opts.onWorkerError?.(msg.message); break;
        }
    });

    return {
        async load(compiled) {
            await new Promise<void>((resolve, reject) => {
                loadedResolve = resolve; loadedReject = reject;
                worker.postMessage({
                    kind: "load",
                    compiled: {
                        moduleSource: compiled.moduleSource,
                        manifest: compiled.manifest,
                    },
                    capabilities: opts.capabilities,
                });
            });
        },
        async push(event) {
            worker.postMessage({ kind: "candleEvent", event });
        },
        async drain() {
            const n = nonce++;
            return new Promise<RunnerEmissions>((resolve) => {
                pendingDrains.set(n, resolve);
                worker.postMessage({ kind: "drain", nonce: n });
            });
        },
        dispose() {
            worker.postMessage({ kind: "dispose" });
            if ("terminate" in worker) worker.terminate();
        },
        limits,
    };
}
```

`WorkerLike` is a tiny interface (`addEventListener`,
`postMessage`, optional `terminate`) so tests can pass a Node
`MessageChannel`-backed shim — `new Worker(...)` only works in a
browser/Bun, but the protocol logic is independent.

### 6. `WORKER_BOOT_URL` resolution

The boot script ships with the package. esbuild (added in Task 3)
can be used to pre-bundle the worker boot into a single JS file
that lives at `packages/host-worker/dist/worker-boot.js` and is
loaded via `new URL("./worker-boot.js", import.meta.url)`.

Build step: extend `packages/host-worker/package.json` `scripts`:

```jsonc
{
    "scripts": {
        "build": "tsc -p tsconfig.json && pnpm tsx ./scripts/buildWorkerBoot.ts",
        "typecheck": "tsc -p tsconfig.json --noEmit",
        "test": "vitest run --coverage"
    }
}
```

`scripts/buildWorkerBoot.ts` runs `esbuild.build` with
`bundle: true`, `format: "esm"`, `platform: "browser"`, and writes
`dist/worker-boot.js`.

### 7. Tests (§16.3 row: unit + conformance + bench + type + sandbox)

- **Unit (worker-boot side):** stub `self.addEventListener` via a
  `MessageChannel` and assert every `HostToWorker` message
  triggers the right runtime call. Covers each switch branch.
- **Unit (createWorkerHost side):** drive a `MessageChannel`-
  backed `WorkerLike`. Assert:
  - `load` resolves on `loaded`.
  - `load` rejects on `loadError`.
  - `push` posts the event verbatim.
  - `drain` round-trips with matching `nonce`.
  - `dispose` calls `terminate` if present.
  - `onWorkerError` fires on `step-overshoot` and `fatal`.
- **Conformance:** Task 12 runs the canvas2d adapter end-to-end
  through this host. This task ships a smaller integration test
  that mocks the canvas adapter with `PassThroughAdapter` (Task 4)
  and drives an EMA-cross fixture through the worker round-trip,
  asserting the emissions match a precomputed expectation.
- **Sandbox tests (Phase-1 placeholder per CONTRIBUTING §16.3).**
  The full sandbox-escape suite — instruction-level CPU caps, hard
  heap caps, an exhaustive list of forbidden globals — lands with
  QuickJS in Phase 5. Phase 1's coverage is the structural-clone
  + measurement-based watchdog pair, with two minimal tests:
  - A compiled bundle with no forbidden constructs loads cleanly
    (positive case).
  - A compiled bundle whose source contained `Math.random` /
    `eval` / `new Function` fails earlier — at compile time in
    Task 2's `forbiddenConstructs` pass. Assert via a unit test
    that the bundle the Worker receives is therefore always free
    of those constructs.
  - Document the remaining "real sandbox" items (Worker-side CSP,
    heap caps, preemption, fingerprint-only globals) as deferred
    in `packages/host-worker/README.md`'s Stability section.
- **Bench:** `roundTrip.bench.test.ts` measures
  `push → drain` latency for a 1-bar emission.
- **Type tests:** `expect-type` on `createWorkerHost`'s return.

100% coverage on the main-side host. The boot script's coverage
exclude lives in the per-package `vitest.config.ts` —
`dist/worker-boot.js` is generated and not counted.

### 8. JSDoc

`createWorkerHost`, `WorkerLike`, `HostLimits` all carry
`@since 0.1` + `@example`. The example is import-only (no
chartlang script source) so docs-check skips compilation:

```ts
/**
 * @example
 *     import { createWorkerHost } from "@invinite-org/chartlang-host-worker";
 *     // host: ScriptHost — passed to an adapter at construction time.
 */
```

(That import string doesn't match the docs-check substring
heuristic from Task 3 because it's a host package, not the
script-facing core. Confirm the heuristic; if it does match,
switch to a commented import.)

### 9. Remove `PACKAGE_VERSION`

Delete the Phase-0 placeholder + Task-3 JSDoc shim from
`packages/host-worker/src/index.ts`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/host-worker/src/protocol.ts` | Create | postMessage schemas. |
| `packages/host-worker/src/workerBoot.ts` | Create | Worker-side entry. |
| `packages/host-worker/src/limits.ts` | Create | `HostLimits` defaults + watchStep. |
| `packages/host-worker/src/createWorkerHost.ts` | Create | Main-side factory. |
| `packages/host-worker/src/workerLike.ts` | Create | `WorkerLike` interface. |
| `packages/host-worker/scripts/buildWorkerBoot.ts` | Create | esbuild bundle step. |
| `packages/host-worker/src/index.ts` | Modify | Export factory + types. |
| `packages/host-worker/src/index.test.ts` | Delete | Replaced by per-module tests. |
| `packages/host-worker/src/*.test.ts` | Create | Unit + integration tests. |
| `packages/host-worker/src/roundTrip.bench.test.ts` | Create | Bench. |
| `packages/host-worker/package.json` | Modify | Add `esbuild` build script + workspace deps for `@invinite-org/chartlang-runtime` and `@invinite-org/chartlang-adapter-kit`. |
| `packages/host-worker/README.md` | Modify | Replace placeholder text. |
| `packages/host-worker/vitest.config.ts` | Modify | Exclude `dist/worker-boot.js` from coverage. |

## Acceptance Criteria

- `pnpm -F @invinite-org/chartlang-host-worker typecheck && pnpm
  -F @invinite-org/chartlang-host-worker test` pass with 100%
  coverage on every metric (excluding `dist/worker-boot.js` via
  config).
- Driving a Task-3-compiled EMA-cross bundle through
  `createWorkerHost` against a `MessageChannel` shim produces the
  expected `RunnerEmissions` round-trip.
- `dispose()` terminates the Worker shim and clears pending
  drains.
- Bench test reports a finite median + threshold.
- `pnpm docs:check`, `readme:check`, `lint`, `format:check` pass.
- All earlier gates (`conformance`, `coverage:report`) stay green.
