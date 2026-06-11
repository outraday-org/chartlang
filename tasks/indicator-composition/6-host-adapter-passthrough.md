# Task 6 — Host + adapter multi-script mount + DiagnosticCode round-trip

> **Status: TODO**

## Goal

Wire the new compiled-bundle shape through the host packages
(`host-worker`, `host-quickjs`), the adapter contract
(`adapter-kit`), and the canvas2d reference adapter so end users
running a script bundle actually see deps execute, siblings
forward emissions, and the new `dep-*` diagnostic codes round-trip
across the worker boundary. No new feature work — this task closes
the gap between Task 4's local runtime and the
out-of-the-process / in-browser usage that real hosts depend on.

## Prerequisites

- Tasks 1–5 — the new types, manifest shape, bundle runner, and
  persistence schema must all be in place.

## Current Behavior

- `packages/host-worker/src/workerBoot.ts` is a thin 21-line
  entry point that wires `self` to the worker boot factory. The
  real boot logic lives in
  `packages/host-worker/src/createWorkerBoot.ts`, which:
    - Imports the compiled script's module (and `__manifest`) from
      the `data:` URL or file URL via `await import(url)`.
    - Constructs one `ScriptRunner` from one `CompiledScriptObject`.
    - Pumps candles through the runner.
    - Drains emissions and forwards them to the host-side adapter.
    - Single-manifest assumption baked into the worker bootstrap.
- `packages/host-quickjs/` is similar. Both expect a single
  default export with a single `__manifest`.
- `packages/adapter-kit/src/types.ts` `DiagnosticCode` extension
  from Task 1 is already present in the union; this task
  verifies the validator handles the new codes.
- `examples/canvas2d-adapter/` defines `Adapter` with a single
  `onEmissions(emissions: RunnerEmissions)` callback —
  diagnostics arrive inside `emissions.diagnostics` on that same
  callback. There is no separate `onDiagnostics` callback.

## Desired Behavior

- `host-worker` loads the compiled bundle (multi-export, optional
  array `__manifest`), detects the bundle shape, mounts a
  `CompiledScriptBundle` through `createScriptRunner`, and pumps
  candles. Drained emissions are forwarded as before — the
  prefixed slot ids round-trip without any host-side parsing.
- `host-quickjs` mirrors the worker boot — same detection logic,
  same `CompiledScriptBundle` mount. The new helper
  `__chartlang_depOutput` is in scope inside the QuickJS sandbox
  via the same `internal` subpath import the bundler produces (so
  no new sandbox surface — the runtime helper is just another
  workspace import).
- `adapter-kit`'s `validateEmission` accepts the new `dep-*`
  diagnostic codes (already extended at the type level in Task 1
  — this task verifies the actual validator). Capability checks
  carry no change: the new feature doesn't add a capability key.
- `examples/canvas2d-adapter` renders sibling-prefixed slot ids
  the same as plain slot ids (its existing renderer is slot-id
  agnostic). Per-emission tests pin that diagnostics flow through
  with their dep / export prefix intact.

## Requirements

### 1. `host-worker` bundle mount

In `packages/host-worker/src/createWorkerBoot.ts` (the file that
actually owns the module-import + runner-construction code;
`workerBoot.ts` is a thin shim that calls into this factory):

```ts
// existing — load compiled module
const mod = await import(scriptModuleUrl);
const manifestOrArray = mod.__manifest;

const bundle = await buildBundleFromModule(mod, manifestOrArray);
// bundle is either CompiledScriptObject (back-compat) or
// CompiledScriptBundle (multi-export). createScriptRunner accepts
// both since Task 4.
const runner = createScriptRunner({
    compiled: bundle,
    capabilities,
    /* ... */
});
```

`buildBundleFromModule(mod, manifestOrArray)`:

- If `Array.isArray(manifestOrArray)`:
    - Iterate the array. The first entry is the default export.
    - Each entry's `exportName` field tells the boot which module
      export to pluck: `mod.default` for `"default"`,
      `mod[exportName]` otherwise.
    - Build a `CompiledScriptBundle`:
        - `primary` = `{ manifest: <default-manifest>, compute:
          mod.default.compute, output: ..., withInputs: ... }`
        - `siblings` = array of `{ exportName, compiled }`
          objects.
        - `dependencies` = the bundler also exports a hidden
          `__dependencies: ReadonlyArray<{ localId,
          compiled }>` global from the inlined IIFE blocks. Worker
          boot grabs it via `mod.__dependencies` (Task 3's bundler
          adds the export). If absent (single-script file),
          deps[] is empty.
    - Return the bundle.
- Else (single-manifest, single-default-export): build the legacy
  `CompiledScriptObject` from `mod.default` + `manifestOrArray`.

### 2. `host-worker` capability surface

No capability change. The worker hands the same `Capabilities`
bag to the runner that it does today.

### 3. `host-worker` protocol round-trip

`packages/host-worker/src/protocol.ts` — confirm
`RuntimeDiagnostic` round-trips with new codes through
`structuredClone` (the wire boundary). Add a smoke test:

```ts
const dx: RuntimeDiagnostic = {
    kind: "diagnostic",
    severity: "error",
    code: "dep-error",
    message: "boom",
    slotId: "dep:trend/inner-slot:1:1#0",
    bar: 3,
};
expect(structuredClone(dx)).toEqual(dx);
```

For all six new `dep-*` codes.

### 4. `host-worker` filtering

`packages/host-worker/src/filterEmissions.ts` — confirm the
filter pass-through accepts new slot id prefixes. The filter
currently strips emissions exceeding capability budgets; it
shouldn't strip on slot id format.

Add a unit test ensuring `dep:<localId>/...` and
`export:<exportName>/...` slot ids round-trip without truncation.

### 5. `host-worker` sandbox-escape tests

`packages/host-worker/src/sandbox.test.ts` — add a sandbox-escape
case for the new `__chartlang_depOutput` helper. Confirm:

- The helper is reachable inside the worker (via the bundled
  module's `import { __chartlang_depOutput } from
  "@invinite-org/chartlang-runtime/internal"`).
- The helper is NOT reachable from arbitrary user code (the
  compiler's `forbiddenConstructs` already rejects user-side
  references — verify the test).

### 6. `host-quickjs` bundle mount

Mirror Task 6 §1 in
`packages/host-quickjs/src/moduleSourceToScript.ts`:

- Detect `__manifest` array shape.
- Pluck each export from the QuickJS-evaluated module.
- Build `CompiledScriptBundle`.
- Hand to `createScriptRunner`.

Sandbox surface stays the same. The `__chartlang_depOutput`
helper enters the QuickJS sandbox via the same compiled-bundle
import path as `ta.*` does — no new sandbox boundary.

Add sandbox-escape tests mirroring Task 6 §5.

### 7. `adapter-kit` validation

`packages/adapter-kit/src/validation/validateEmission.ts` already
accepts any `DiagnosticCode` from the union (Task 1 widened the
union). Add explicit pass-through tests for each new code.

`packages/adapter-kit/src/types.ts` — JSDoc on `DiagnosticCode`:
extend the listing to mention the `dep-*` block + which task
introduced them.

### 8. `canvas2d-adapter` (reference)

`examples/canvas2d-adapter/src/createCanvas2dAdapter.ts`:

- No capability change.
- Confirm `Adapter.onEmissions(emissions)` accepts every new
  `dep-*` code via `emissions.diagnostics` without crashing.
  (There is no separate `onDiagnostics` callback in the adapter
  contract — diagnostics ride the same `onEmissions` pipe.)
- Add an integration test:
  `examples/canvas2d-adapter/src/integration.test.ts` extended
  with a bundle-script scenario (multi-export). Drive the script
  through `createWorkerHost` and assert that:
    - Sibling exports' plots render.
    - Private-dep plots do NOT render.
    - `dep-error` diagnostics surface inside
      `onEmissions(emissions).diagnostics`.

### 9. Conformance hand-off

`packages/conformance/`'s `runConformanceSuite` already
constructs runners directly (bypasses worker host for emission
contract testing). It picks up the new bundle shape automatically
because Task 4 made `createScriptRunner` accept it. Task 8 adds
the new conformance scenarios — this task just verifies the
suite still passes on existing scenarios.

### 10. Test layers

- `host-worker/src/workerBoot.test.ts` — bundle vs single
  branch.
- `host-worker/src/createWorkerHost.test.ts` — end-to-end with
  a bundle compiled by the real compiler.
- `host-worker/src/protocol.types.test.ts` — `dep-*` round-trip
  type tests.
- `host-worker/src/sandbox.test.ts` — `__chartlang_depOutput`
  escape coverage.
- `host-worker/src/filterEmissions.test.ts` — prefixed slot id
  round-trip.
- `host-quickjs/src/*.test.ts` — mirror.
- `adapter-kit/src/validation/validateEmission.test.ts` —
  `dep-*` code pass-through.
- `examples/canvas2d-adapter/src/integration.test.ts` — bundle
  scenario.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/host-worker/src/createWorkerBoot.ts` | modify | Detect array manifest, build `CompiledScriptBundle`. (Owns the real boot logic; `workerBoot.ts` is a thin shim and does not need changes.) |
| `packages/host-worker/src/createWorkerBoot.test.ts` | modify | Bundle vs single branch tests. |
| `packages/host-worker/src/createWorkerHost.ts` | modify | Propagate the new shape to `createScriptRunner`. |
| `packages/host-worker/src/createWorkerHost.test.ts` | modify | End-to-end bundle. |
| `packages/host-worker/src/protocol.ts` | modify (minimal) | Confirm `RuntimeDiagnostic` includes the new codes (Task 1 already widened the type). |
| `packages/host-worker/src/protocol.types.test.ts` | modify | Type-level coverage of new codes. |
| `packages/host-worker/src/filterEmissions.test.ts` | modify | Prefix round-trip. |
| `packages/host-worker/src/sandbox.test.ts` | modify | `__chartlang_depOutput` escape coverage. |
| `packages/host-quickjs/src/moduleSourceToScript.ts` | modify | Detect array manifest, build bundle. |
| `packages/host-quickjs/src/moduleSourceToScript.test.ts` | modify | Bundle branch. |
| `packages/host-quickjs/src/createQuickJsHost.ts` | modify | Propagate. |
| `packages/host-quickjs/src/createQuickJsHost.test.ts` | modify | Bundle integration. |
| `packages/host-quickjs/src/sandbox.test.ts` | modify | Escape coverage. |
| `packages/host-quickjs/src/integration.test.ts` | modify | Bundle scenario. |
| `packages/adapter-kit/src/validation/validateEmission.test.ts` | modify | `dep-*` pass-through. |
| `packages/adapter-kit/src/types.ts` | modify (minimal) | JSDoc note on `dep-*` block. |
| `examples/canvas2d-adapter/src/integration.test.ts` | modify | Bundle scenario integration. |
| `examples/canvas2d-adapter/src/createCanvas2dAdapter.ts` | modify (minimal) | Verify `onEmissions(emissions)` accepts every new code via `emissions.diagnostics` (likely no code change needed — the adapter is already diagnostic-code-agnostic). |

## Gates

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm docs:check`,
  `pnpm readme:check`, `pnpm conformance`, `pnpm bench:ci` —
  green.
- 100% coverage on touched files.
- Sandbox-escape tests pass for both hosts.

## Changeset

- File: `.changeset/indicator-composition-6-hosts.md`
- Bump: **minor** for `@invinite-org/chartlang-host-worker`,
  `@invinite-org/chartlang-host-quickjs`,
  `@invinite-org/chartlang-adapter-kit`. **Patch** for the
  canvas2d-adapter example package.
- Reason: "Hosts (`host-worker`, `host-quickjs`) detect the
  array-shape manifest sidecar, mount the compiled
  `CompiledScriptBundle`, and round-trip the new `dep-*`
  diagnostic codes. Adapter-kit's `validateEmission` confirmed
  to accept the additive codes. canvas2d-adapter integration
  test covers bundle scenarios."

## Acceptance Criteria

- [ ] `host-worker` boots a multi-export bundle and the runner
      mounts every drawn indicator + private dep.
- [ ] `host-quickjs` does the same inside the QuickJS sandbox.
- [ ] Both hosts round-trip every new `dep-*` diagnostic code
      across the worker / quickjs boundary.
- [ ] Sandbox-escape tests pass — `__chartlang_depOutput` is
      not reachable from user code (compiler-rejected) and is
      reachable from the bundled code only via the
      `@invinite-org/chartlang-runtime/internal` subpath.
- [ ] Canvas2d-adapter integration test renders sibling exports'
      plots and drops private-dep plots.
- [ ] Phase-1 single-script scenarios still pass unchanged.
- [ ] 100% coverage on touched files.
- [ ] Changeset committed.
