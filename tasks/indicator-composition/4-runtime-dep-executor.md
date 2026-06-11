# Task 4 — Runtime dep executor, output store, emission filter

> **Status: TODO**

## Goal

Add the runtime machinery that mounts a `CompiledScriptBundle`,
executes dependencies before their consumers each bar, hands the
consumer a typed `Series<number>` for each `<binding>.output(name)`
call, and filters dep emissions according to the export-status
model (drawn = forwarded; private = dropped, except diagnostics).
After this task lands, a compiled bundle from Task 3 produces a
runnable indicator with deps.

## Prerequisites

- Task 1 — `CompiledScriptBundle`, `__chartlang_depOutput` symbol
  contract, `dep-*` `DiagnosticCode` entries.
- Task 2 — synthesised `__chartlang_depOutput(slotId, localId,
  title)` rewrites at every consumer call site.
- Task 3 — bundle structure (IIFE blocks per dep, runtime helper
  imported from `@invinite-org/chartlang-runtime/internal`).

## Current Behavior

- `createScriptRunner({ compiled, capabilities, ... })` mounts
  exactly one `CompiledScriptObject`. State is one slot store; one
  `StreamState`; one `RuntimeContext`; one emission queue set.
- `buildComputeContext(state)` returns the script's
  `ComputeContext` once per bar.
- `pushPlot` / `pushAlert` / etc. push directly to
  `state.emissions.*`. No per-dep filtering.
- The runtime has no concept of "dep" — every call site is a
  primary-script call site.

## Desired Behavior

- `createScriptRunner(args)` accepts either a
  `CompiledScriptObject` (existing, back-compat) **or** a
  `CompiledScriptBundle`. When given a bundle, the runner mounts:
    - One **`DepRunner`** per private dep (per
      `bundle.dependencies[]` entry), keyed by `localId`.
    - One **`SiblingRunner`** per named drawn export (per
      `bundle.siblings[]` entry), keyed by `exportName`.
    - The **primary `RunnerState`** for `bundle.primary`.
- Each `DepRunner` owns its own `StreamState`? **No** — deps share
  the parent's main `StreamState` (same OHLCV history). They own
  their own `StateStore`, `RuntimeContext`, emission queues, and
  `BarView` reference.
- Per bar, the runner walks deps in topological order (already
  enforced by Task 2's analysis — the manifest's `dependencies[]`
  is already topologically sorted because the analyser emits
  `consumes` in dep-first order), then walks siblings in
  declaration order, then the primary. Each `compute` runs through
  the existing `onBarClose` / `onBarTick` execution functions.
- The runtime helper `__chartlang_depOutput(slotId, localId,
  title)` reads from a per-bar `DepOutputStore` that the dep's
  `plot(value, { title })` calls populate.
- Emissions from a private dep are dropped except diagnostics —
  which surface as parent diagnostics with `slotId:
  "dep:<localId>/<inner-slotId>"`.
- Emissions from a sibling drawn export are forwarded with
  `slotId: "export:<exportName>/<inner-slotId>"`. The primary's
  emissions keep their plain slot ids.
- A dep throw → consumer's parent bar emissions are dropped + a
  single `dep-error` diagnostic surfaces with the inner error
  message. Sibling throw → only that sibling's bar drops; the
  primary keeps going.

## Requirements

### 1. `createScriptRunner` shape

In `packages/runtime/src/createScriptRunner.ts`:

```ts
export type CreateScriptRunnerArgs = {
    readonly compiled: CompiledScriptObject | CompiledScriptBundle;
    // ... existing fields unchanged ...
};
```

`isCompiledScriptBundle(compiled)` branches the constructor.

When `compiled` is a single `CompiledScriptObject`, the
constructor behaves exactly as today. No `DepRunner` instances are
created. The output store stays empty. No code path changes for
single-script users.

When `compiled` is a `CompiledScriptBundle`:

1. Construct the primary `RunnerState` (existing logic).
2. For each `bundle.dependencies[i]`: construct a `DepRunner`
   with its own `RuntimeContext` + emission queues +
   `slotIdPrefix: "dep:<localId>/"`.
3. For each `bundle.siblings[j]`: construct a `SiblingRunner`
   with `slotIdPrefix: "export:<exportName>/"`.
4. Build a `DepOutputStore` shared by the primary + siblings (the
   one place every consumer reads `__chartlang_depOutput`).
5. Wire the store into each `DepRunner` and `SiblingRunner`'s
   `RuntimeContext` (so when their `compute` calls
   `plot(value, { title })` the runtime captures the value into
   the store keyed by `(localId, title)`).

### 2. `DepRunner` + `SiblingRunner`

New file `packages/runtime/src/dep/DepRunner.ts`:

```ts
export type DepRunner = Readonly<{
    readonly localId: string;
    readonly state: RunnerState;
    readonly slotIdPrefix: string;
}>;

export function createDepRunner(args: {
    compiled: CompiledScriptObject;
    localId: string;
    parentCapabilities: Capabilities;
    mainStream: StreamState; // shared with parent
    stateStore: StateStore;
    depOutputStore: DepOutputStore;
    persistentStateStore?: PersistentStateStore;
    now: () => number;
    inputOverrides: Readonly<Record<string, unknown>>;
}): DepRunner;
```

`createDepRunner` builds a `RunnerState` whose:

- `manifest` is the dep's compiled manifest.
- `compute` is the dep's compute function.
- `mainStream` is the shared parent stream.
- `stateStore` is the parent's `StateStore` but reads/writes through
  a key transformer `prefix("dep:<localId>/")` so dep state slot
  ids never collide with parent state.
- `emissions` is a fresh `MutableRunnerEmissions` — the dep's per-bar
  emissions are drained into the filter (Task 4 §4) at the end of
  each step.
- `runtimeContext.isDep = true` (new field, propagates the slot-id
  prefix to every emit primitive).

`SiblingRunner` mirrors `DepRunner` with `slotIdPrefix:
"export:<exportName>/"` and `isDep: false` (its emissions are
forwarded, not dropped).

### 3. `DepOutputStore`

New file `packages/runtime/src/dep/DepOutputStore.ts`:

```ts
type StoreEntry = {
    readonly buffer: Float64RingBuffer;
    readonly view: Series<number>;
};

export type DepOutputStore = Readonly<{
    /** Called by the dep's emit/plot path when title matches a
     *  declared output. Pushes the current bar value into the
     *  buffer. */
    push(localId: string, title: string, value: number): void;
    /** Called by `__chartlang_depOutput(slotId, localId, title)`
     *  from the consumer's compute. Returns the dep's series
     *  view; throws `dep-unknown-output` (caught + diagnostic)
     *  if not declared. */
    read(localId: string, title: string): Series<number>;
    /** Called once per bar by the executor before any compute
     *  runs. Resets buffer-write tracking but does NOT clear
     *  history (lookback works). */
    beginBar(): void;
    /** Called when the executor disposes. */
    dispose(): void;
}>;
```

The buffer capacity matches the consumer's
`manifest.maxLookback + 1` (sized at mount time). Each `(localId,
title)` pair gets one buffer; pre-allocated from the dep's
declared `OutputDeclaration[]`.

When a dep's `compute` does NOT call `plot(value, { title: "X" })`
on a bar (e.g. early warmup, conditional plot), the store pushes
`NaN`. Every bar pushes exactly once per declared output, so
consumers see a continuous series with NaN gaps where the producer
skipped.

### 4. `__chartlang_depOutput` runtime helper

New file `packages/runtime/src/dep/depOutput.ts`:

```ts
export function __chartlang_depOutput(
    slotId: string,
    localId: string,
    title: string,
): Series<number> {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error(
            `__chartlang_depOutput called outside an active script step`,
        );
    }
    const store = ctx.depOutputStore;
    if (store === null) {
        throw new Error(
            `__chartlang_depOutput called on a runner with no deps`,
        );
    }
    return store.read(localId, title);
}
```

The helper is exported from the new `internal` subpath
`@invinite-org/chartlang-runtime/internal` (added to
`packages/runtime/package.json` `exports`). Only Task 3's bundler
imports it; user scripts can't import the subpath (the bundler
rewrites every consumer-side `.output(...)` to this helper anyway).

### 5. Emission filter

New file `packages/runtime/src/dep/emissionFilter.ts`:

```ts
export function applyDepEmissionPolicy(
    dep: DepRunner | SiblingRunner,
    parentEmissions: MutableRunnerEmissions,
): void;
```

- For each `dep.state.emissions.plots[]`:
    - If `dep` is `DepRunner` (private): try to capture the
      `(localId, title, value)` into the `DepOutputStore`. If the
      title isn't declared by the dep's manifest, drop with a
      `dep-output-not-titled` diagnostic. Either way, don't forward
      the plot itself.
    - If `dep` is `SiblingRunner` (drawn): prefix the `slotId`
      with `"export:<exportName>/"`, then push into
      `parentEmissions.plots`.
- For `drawings[]` / `alerts[]` / `alertConditions[]` / `logs[]`:
    - `DepRunner` — drop all (private deps don't emit visuals).
      No diagnostic — the call was technically valid; the policy
      simply doesn't forward.
    - `SiblingRunner` — prefix `slotId`, push into the
      corresponding parent queue.
- For `diagnostics[]` (both `DepRunner` and `SiblingRunner`):
    - Prefix the diagnostic's `slotId` with the runner's
      `slotIdPrefix`.
    - Push into `parentEmissions.diagnostics`.
- For sibling drawn plots that the dep also exports as outputs
  (the rare case of a drawn binding being consumed by another
  drawn binding in the same file): both code paths run — the plot
  is captured into the store AND forwarded with the prefix. The
  parent's `_.output(title)` accessor still works; the host still
  renders the sibling's plot.

### 6. Per-bar execution order

Update `packages/runtime/src/execution/onHistory.ts`,
`onBarClose.ts`, `onBarTick.ts`:

```ts
export async function onBarClose(state, rawBar, eventKind = "close") {
    appendBarToStream(state.mainStream, rawBar);  // existing
    updateFallbackViewport(state.mainStream);     // existing
    state.depOutputStore.beginBar();              // NEW

    // NEW: deps in topological order
    for (const dep of state.depRunners) {
        await runDepStep(dep, rawBar, eventKind);
        applyDepEmissionPolicy(dep, state.emissions);
    }
    // NEW: siblings in declaration order
    for (const sibling of state.siblingRunners) {
        await runSiblingStep(sibling, rawBar, eventKind);
        applyDepEmissionPolicy(sibling, state.emissions);
    }
    // existing primary compute step
    // ... rest of onBarClose unchanged ...
}
```

There is no pre-existing `runComputeStep` helper in the runtime
today — the per-bar compute boilerplate (reset queues, set
`ACTIVE_RUNTIME_CONTEXT.current`, invoke `state.compute(ctx)`,
flush state slots, restore the previous context) lives inline
inside `onBarClose` / `onBarTick` / `onHistory`. Task 4 extracts
that boilerplate into a new exported helper
`runComputeStep(state, rawBar, eventKind)` in
`packages/runtime/src/execution/runComputeStep.ts` and rewrites
the three existing entry points to call it. Each
`runDepStep` / `runSiblingStep` then wraps `runComputeStep` with
the dep- or sibling-specific context switch and emission filter.
The parent's primary `ACTIVE_RUNTIME_CONTEXT.current` is set last
so the primary's compute sees its own context.

Dep error handling:

```ts
async function runDepStep(dep, rawBar, eventKind) {
    try {
        await runComputeStep(dep.state, rawBar, eventKind);
    } catch (err) {
        // Surface a `dep-error` diagnostic on the dep's queue —
        // the filter will namespace + forward it.
        pushDiagnostic(dep.state.emissions, {
            kind: "diagnostic",
            severity: "error",
            code: "dep-error",
            message:
                err instanceof Error ? err.message : String(err),
            slotId: dep.slotIdPrefix,
            bar: dep.state.barIndex,
        });
        // Mark the dep as failed for this bar so the parent
        // skips its plot-output read attempts? No — push NaN into
        // every declared output instead. The consumer reads NaN
        // naturally; the runtime's halt-parent semantics handle
        // the rest via the diagnostic.
        for (const out of dep.state.manifest.outputs ?? []) {
            dep.state.depOutputStore.push(
                dep.localId,
                out.title,
                Number.NaN,
            );
        }
    }
}
```

Then, in the parent's primary compute:

```ts
// After the parent's compute attempt, check if any dep emitted
// `dep-error` this bar. If so, drop the parent's primary
// emissions for this bar (best-effort isolation).
if (depErroredThisBar(state)) {
    state.emissions.plots = [];
    state.emissions.drawings = [];
    state.emissions.alerts = [];
    state.emissions.alertConditions = [];
    state.emissions.logs = [];
    // Diagnostics stay — they're how the host learns.
}
```

Sibling throws don't halt the primary — they just lose that
sibling's emissions for the bar (the sibling's emission queue stays
empty after the catch).

### 7. State slot prefixing

When the runtime emit / `ta.*` / `state.*` primitives mint a slot id,
the existing code reads `ACTIVE_RUNTIME_CONTEXT.current` for the
`stateSlots` map. The new field `RuntimeContext.slotIdPrefix:
string` defaults to `""` and is set to the dep's
`"dep:<localId>/"` (or sibling's `"export:<exportName>/"`) in
each `DepRunner` / `SiblingRunner`'s context.

The compiler-injected slot-id literal at each call site is the
**inner** slot id (file-relative line:col). The runtime prepends
the active context's prefix when storing in `stateSlots`. This
keeps the existing slot-id format intact at the compiler boundary;
namespacing is a runtime concern.

Task 5 owns the persistence-snapshot side of this change. Task 4
just wires the prefix into the `stateSlots` map key.

### 8. `RuntimeNamespace` halt + log scope

`runtime.log.*` and `runtime.error(...)` from a private dep go
through the dep's `RuntimeContext` — its log queue is prefixed and
forwarded as diagnostics via the filter. `runtime.error()` from a
private dep raises the same `dep-error` flow.

### 9. Test layers

`packages/runtime/` already runs unit + property + golden + bench:

- `dep/DepRunner.test.ts` — unit: mount, step, dispose, emission
  filter.
- `dep/DepOutputStore.test.ts` — unit: push / read / `beginBar`
  semantics; NaN-on-skip; unknown title throws +
  `dep-output-not-titled` diagnostic.
- `dep/emissionFilter.test.ts` — unit: per-emission-kind policy
  for `DepRunner` vs `SiblingRunner`.
- `dep/depOutput.test.ts` — unit: helper throws when context is
  null or store is null.
- `dep/integration.test.ts` — unit + golden: end-to-end on a
  diamond bundle from Task 2's golden fixture, asserting plot
  output hashes + diagnostic codes.
- `dep/property.test.ts` — property: random dep counts × random
  bar counts × random `plot()` cadences. Invariants:
    - dep order respects topological order
    - private-dep emissions never reach the parent's `plots[]`
    - dep diagnostics always reach the parent with the dep prefix
    - sibling diagnostics reach the parent with the export prefix
- `dep/bench.ts` + `dep/bench.test.ts` — bench: 1-dep, 5-dep,
  10-dep bundles × 10 000 bars. `THRESHOLD_MS = ceil(median × 3)`
  pinned.

`createScriptRunner.test.ts` and `createScriptRunner.persist.test.ts`
extended with bundle-shape mount cases.

`onBarClose.test.ts` + `onBarTick.test.ts` + `onHistory.test.ts`
extended with dep-aware execution-order tests.

### 10. Determinism

Bundle execution is deterministic per bar:

- Dep order from manifest `dependencies[]` order (toposort
  artefact from Task 2).
- Sibling order from `siblings[]` order (source declaration order
  from Task 3).
- Each step's emission filtering is pure.
- The property test above pins this — re-running the same
  scenario yields byte-identical `runner.drain()` output.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/dep/DepRunner.ts` | create | Per-dep / per-sibling sub-runner. |
| `packages/runtime/src/dep/DepRunner.test.ts` | create | Unit tests. |
| `packages/runtime/src/dep/DepOutputStore.ts` | create | Titled-output buffer. |
| `packages/runtime/src/dep/DepOutputStore.test.ts` | create | Store semantics. |
| `packages/runtime/src/dep/depOutput.ts` | create | `__chartlang_depOutput` helper. |
| `packages/runtime/src/dep/depOutput.test.ts` | create | Helper unit tests. |
| `packages/runtime/src/dep/emissionFilter.ts` | create | Per-emission-kind policy. |
| `packages/runtime/src/dep/emissionFilter.test.ts` | create | Policy unit. |
| `packages/runtime/src/dep/integration.test.ts` | create | End-to-end golden. |
| `packages/runtime/src/dep/property.test.ts` | create | Property invariants. |
| `packages/runtime/src/dep/bench.ts` | create | Bench harness. |
| `packages/runtime/src/dep/bench.test.ts` | create | Threshold guard. |
| `packages/runtime/src/dep/index.ts` | create | Barrel re-export. |
| `packages/runtime/src/createScriptRunner.ts` | modify | Branch on bundle shape. |
| `packages/runtime/src/createScriptRunner.test.ts` | modify | Bundle-mount case. |
| `packages/runtime/src/buildComputeContext.ts` | modify | No script-author surface change; ensure `RuntimeContext.slotIdPrefix` flows through. |
| `packages/runtime/src/runtimeContext.ts` | modify | Add `slotIdPrefix`, `isDep`, `depOutputStore` fields. |
| `packages/runtime/src/runtimeContext.test.ts` | modify | New-field defaults. |
| `packages/runtime/src/execution/runComputeStep.ts` | create | Extract the per-bar compute boilerplate (reset queues, set `ACTIVE_RUNTIME_CONTEXT.current`, run `compute`, flush state slots, restore context) into a single exported helper. |
| `packages/runtime/src/execution/runComputeStep.test.ts` | create | Unit cases for the extracted helper. |
| `packages/runtime/src/execution/onHistory.ts` | modify | Call `runComputeStep` instead of inlining the boilerplate. Run deps + siblings first. |
| `packages/runtime/src/execution/onBarClose.ts` | modify | Same. Dep-error halts parent's emissions. |
| `packages/runtime/src/execution/onBarTick.ts` | modify | Same. |
| `packages/runtime/src/execution/*.test.ts` | modify | New ordering + halt tests; existing behaviour pinned unchanged. |
| `packages/runtime/src/emit/plotEmission.ts` | modify | When `RuntimeContext.isDep`, capture plot into `DepOutputStore` (in addition to / instead of queue, per filter policy). |
| `packages/runtime/src/emit/plotEmission.test.ts` | modify | New capture path. |
| `packages/runtime/package.json` | modify | Add `internal` subpath export. |
| `packages/runtime/src/internal.ts` | create | Re-exports `__chartlang_depOutput`. |
| `packages/runtime/src/index.ts` | modify | Re-export `DepRunner` / `DepOutputStore` types. |

## Gates

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm docs:check`,
  `pnpm readme:check`, `pnpm conformance`, `pnpm bench:ci` — green.
- 100% coverage on every new + touched runtime file.
- Bundle integration golden test (Task 2 fixture → Task 3 bundle →
  Task 4 runner) passes.

## Changeset

- File: `.changeset/indicator-composition-4-runtime.md`
- Bump: **minor** for `@invinite-org/chartlang-runtime`.
- Reason: "`createScriptRunner` accepts `CompiledScriptBundle`,
  mounts a `DepRunner` per private dep + `SiblingRunner` per drawn
  export, executes deps + siblings before the primary each bar,
  filters emissions per export status, and surfaces `dep-error`
  with parent-bar halt semantics. Single-script callers unchanged."

## Acceptance Criteria

- [ ] Single-`CompiledScriptObject` callers see byte-identical
      behaviour — no Phase-1 conformance scenario diff.
- [ ] Bundle callers execute deps first, then siblings, then
      primary, per bar, deterministically.
- [ ] Private-dep `plot(value, { title })` populates the
      `DepOutputStore`; visuals never reach `parent.emissions.plots`.
- [ ] Sibling drawn emissions surface with
      `slotId: "export:<exportName>/..."` prefix.
- [ ] Dep diagnostics surface with
      `slotId: "dep:<localId>/..."` prefix.
- [ ] Dep throw → parent's primary bar emissions dropped +
      `dep-error` diagnostic with inner message.
- [ ] `dep-unknown-output` raised when a consumer reads a title
      the dep didn't emit (compile-time path from Task 2; runtime
      sanity check confirms).
- [ ] 100% coverage on new files.
- [ ] Bench thresholds pinned for 1 / 5 / 10 dep bundles.
- [ ] Property test pins topological + emission invariants.
- [ ] Changeset committed.
