# Task 7 — host-quickjs: `createQuickJsHost` impl + JsonValue membrane

> **Status: TODO**

## Goal

Replace the Task-6 stub with a working QuickJS-backed `ScriptHost`.
Boot a `quickjs-emscripten` context per script load, enforce
`setMaxMemory(64 MB)` + `setInterruptHandler` (≤ 1 ms per `compute`
step), implement the JsonValue membrane that marshals
`HostToQuickJs` / `QuickJsToHost` frames in and out, and pin
emission shape parity with `host-worker` via a cross-host
determinism test.

## Prerequisites

- Task 6: `host-quickjs` scaffold + protocol + stub function shipped.

## Current Behavior

- `createQuickJsHost` throws `"membrane not yet implemented (Task 7)"`.
- No QuickJS context is initialised.
- No emission-shape parity test against `host-worker`.

## Desired Behavior

- `createQuickJsHost(opts)` returns a real frozen `ScriptHost`.
- The host owns a `quickjs-emscripten` `QuickJSAsyncContext`:
  - Memory cap: `setMaxMemory(opts.limits.maxHeapBytes ?? 64 MB)`.
  - CPU cap: `setInterruptHandler(() => stepStartedAtMs has elapsed
    > maxStepMs)` polled every ~10k instructions.
  - No host globals exposed beyond the candle pump + emission
    channel. `eval`, `Function`, `globalThis` not bridged.
- The membrane:
  - Compiled script `moduleSource` evaluated inside the QuickJS
    context as an ES module string.
  - `HostToQuickJs.candleEvent` frames marshal in via
    `JSON.stringify` → `eval` of a typed dispatcher; the dispatcher
    pushes the event into the script's runner and accumulates
    emissions.
  - `drain(nonce)` round-trips: the host posts a drain request,
    the dispatcher returns the accumulated `RunnerEmissions` as a
    `JSON.stringify`d string, the host parses + resolves the
    pending drain promise.
- Cross-host parity: a script run under `host-quickjs` produces
  the **same** `RunnerEmissions` (byte-identical JSON serialisation)
  as the same script run under `host-worker`, for the same input
  candles. The parity test pins this for 5 representative scripts.

## Requirements

### 1. `packages/host-quickjs/src/createQuickJsHost.ts` — replace stub

Replace the throwing stub with the real implementation. Key points:

- Lazy QuickJS context initialisation: the first `load()` call awaits
  `getQuickJS()` (from `quickjs-emscripten`) and constructs a
  `QuickJSAsyncContext`. Subsequent calls reuse it.
- `setMaxMemory(limits.maxHeapBytes)` and
  `setInterruptHandler(...)` configured immediately after context
  creation.
- A small dispatcher module is `evalCode`-installed into the QuickJS
  context once per `load()`:
  - The dispatcher imports `@invinite-org/chartlang-runtime`'s
    `createScriptRunner` (bundled into the dispatcher source at
    build time — see step 3).
  - It exposes three globals to the host: `__chartlang_load(json)`,
    `__chartlang_push(json)`, `__chartlang_drain()`.
  - The host calls these via `context.getProp(handle, "name")` +
    `context.callFunction(handle, undefined, ...)` patterns.
- `load(compiled)` evaluates the compiled script as an ES module
  inside the QuickJS context and resolves the dispatcher's
  `__chartlang_load(compiled, capabilities, symInfo, inputOverrides, limits)`
  call. Resolves the host-side `load` promise on `"loaded"` /
  rejects on `"loadError"`.
- `push(event)` calls `__chartlang_push(eventJson)` — fire-and-
  forget. Step-overshoot detection: the dispatcher times each
  `onBarClose` / `onBarTick`; if `> maxStepMs`, it accumulates a
  pending `step-overshoot` notification that the next `drain`
  surfaces to the host alongside emissions.
- `drain()` calls `__chartlang_drain()`, parses the returned JSON
  into `RunnerEmissions`, resolves the matching pending drain
  promise. Increments the host-side `nonce` counter.
- `dispose()` calls `__chartlang_dispose()` then `context.dispose()`.
- All errors thrown inside the QuickJS context are caught at the
  membrane boundary, stringified, and posted as `"fatal"` frames to
  `onHostError`.

### 2. Membrane invariants

- Every value crossing the boundary is `JsonValue`. The host
  validates inbound emissions via the existing
  `validateEmission` (per `adapter-kit`) before resolving the
  drain promise.
- No host functions exposed inside QuickJS. The dispatcher pulls
  its references from the bundled runtime module — host bindings
  are not Free-Variables in the script.
- The QuickJS-side dispatcher is **the only code** that handles
  `JSON.parse` / `JSON.stringify`. Scripts can't access host JSON
  state.
- The interrupt handler polls a host-supplied `(now - stepStartedAt > maxStepMs)`
  flag rather than wall-clock from inside QuickJS — keeps the
  budget consistent under nested calls.

### 3. Dispatcher bundling

A small bundler script `packages/host-quickjs/scripts/buildDispatcher.ts`
(create new) produces `packages/host-quickjs/dist/dispatcher.js` —
a single self-contained ES module string carrying:

- `@invinite-org/chartlang-core` (used types).
- `@invinite-org/chartlang-runtime` (`createScriptRunner` +
  primitives).
- The three `__chartlang_*` globals.

Use `esbuild` (already a dev dep across the monorepo — verify) with
`{ format: "esm", bundle: true, platform: "neutral", target: "es2020", minify: false }`.
The output is loaded by `createQuickJsHost` via `fs.readFileSync` at
host-process startup (Node) or `fetch` from the host's static asset
serving (browser) — defer the browser asset path to Task 8's
sandbox suite. For Phase 5, the OSS package ships the dispatcher
bundle and the host loads it via a build-time `import` of a string
literal (mirror the existing `host-worker/scripts/buildWorkerBoot.ts`
pattern).

### 4. Tests

#### `packages/host-quickjs/src/createQuickJsHost.test.ts` — replace

- `createQuickJsHost({ capabilities })` returns a frozen `ScriptHost`.
- `load(compiledHelloScript)` resolves; `drain()` returns the
  expected emissions for a 10-bar input.
- `push(event)` is fire-and-forget; `drain()` is the only path that
  resolves emissions.
- `dispose()` calls `context.dispose()` once and clears pending
  drains.
- Memory cap: a script that allocates 100 MB throws an OOM caught
  at the membrane → `onHostError` receives a `quickjs-oom` message.
- CPU cap: a script with an infinite `while(true)` triggers the
  interrupt handler → `step-overshoot` notification + the bar's
  emissions are dropped.
- `loadError` path: a script with a syntax error → `load()` rejects
  with the parser error.

#### `packages/host-quickjs/src/integration.test.ts`

- Run a Phase-1 hello-world script through `createQuickJsHost`
  against a 100-bar fixture.
- Assert emitted `PlotEmission`s match the byte representation from
  the same script under `host-worker` (load both hosts; compare
  `JSON.stringify(emissionsA) === JSON.stringify(emissionsB)`).
- Repeat for 4 more scripts covering: `ta.ema`, `ta.bb` (multi-
  output), `alert()` immediate-fire, `draw.line` (Phase-3 drawing).

#### `packages/host-quickjs/src/roundTrip.bench.ts` (+ pair)

- Bench `host-quickjs` roundTrip (10 bars in → drain → emissions out).
- `THRESHOLD_MS`: target ≤ 10× the host-worker baseline (per PLAN
  §8.3 "10–100× slower for tight loops, but tolerable for alert-
  class workloads"). Document the budget in the test.

### 5. JSDoc + docs

- `createQuickJsHost` — replace the stub JSDoc with a real `@example`
  that constructs a host, loads a script, pushes 10 bars, drains.
- README updates: stability stays `experimental`; bump the public
  surface section to reference the real implementation (drop the
  "stub; Task 7 lands the membrane" line).

### 6. Compatibility audit

- Ensure no `runtime` invariant breaks under the QuickJS host. The
  Phase-1 `data:` URL pattern is host-worker-specific; this host
  evaluates source directly via `evalCode`, so no URL games. Document
  the divergence in `packages/host-quickjs/CLAUDE.md` (new file).
- `runtime` imports `Buffer` / Node-only APIs? Audit and fail fast
  on any that don't work under QuickJS. If found, add a small
  shim inside the dispatcher (e.g. `globalThis.Buffer = …`) — but
  the runtime is meant to be platform-neutral per the §22.10 rule.
  Surface findings in the task implementation thread.

### 7. `packages/host-quickjs/CLAUDE.md` (new)

Document the invariants (mirror the host-worker CLAUDE.md style):

- Dispatcher loaded once per QuickJS context; not re-uploaded per
  script.
- Memory cap fires `quickjs-oom`; CPU cap fires `step-overshoot`.
- No host bindings inside QuickJS (verified by sandbox-escape suite
  in Task 8).
- Cross-host parity is the conformance contract — never diverge
  semantics intentionally.
- `dispose()` clears `pendingDrains` after disposing the context (a
  drain awaiting reply post-dispose stays unresolved forever).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/host-quickjs/src/createQuickJsHost.ts` | Modify | Replace stub with real impl |
| `packages/host-quickjs/scripts/buildDispatcher.ts` | Create | Bundles `dispatcher.js` |
| `packages/host-quickjs/dist/dispatcher.js` | Create (generated, committed per host-worker pattern) | Bundled dispatcher source |
| `packages/host-quickjs/src/createQuickJsHost.test.ts` | Modify | Real-impl tests |
| `packages/host-quickjs/src/integration.test.ts` | Create | Cross-host parity tests |
| `packages/host-quickjs/src/roundTrip.bench.ts` | Create | Bench (vitest bench mode) |
| `packages/host-quickjs/src/roundTrip.bench.test.ts` | Create | `THRESHOLD_MS` gate |
| `packages/host-quickjs/CLAUDE.md` | Create | Package invariants |
| `packages/host-quickjs/README.md` | Modify | Drop the "stub" language |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm -F @invinite-org/chartlang-host-quickjs test --coverage` (100%)
- `pnpm docs:check`
- `pnpm bench:ci`

## Changeset

`.changeset/phase5-host-quickjs-impl.md` — `minor` bump for
`@invinite-org/chartlang-host-quickjs`. Body cites PLAN §8.3.

## Acceptance Criteria

- [ ] `createQuickJsHost` boots a real `QuickJSAsyncContext` with
      memory + CPU caps configured.
- [ ] All 5 cross-host parity tests pass — `host-quickjs` and
      `host-worker` emissions are byte-identical.
- [ ] `quickjs-oom` and `step-overshoot` surface via `onHostError`
      as documented.
- [ ] `loadError` / `fatal` paths cover script syntax errors +
      runtime throws.
- [ ] Dispatcher bundle is self-contained; no host bindings exposed
      inside QuickJS.
- [ ] CLAUDE.md documents the invariants; future contributors can't
      regress them silently.
- [ ] 100% coverage; bench under threshold.
- [ ] Changeset committed.
