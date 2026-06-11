# Feature Requirements: Indicator Composition

> **Status: Draft**

## Goal

Allow a chartlang indicator script to depend on the output of another
indicator definition in a deterministic, typed, sandbox-safe way.

Today authors can compose built-in `ta.*` primitives inside one
`defineIndicator(...)` script, but they cannot declare that one
loadable indicator consumes another loadable indicator's computed
series. This feature defines the requirements for first-class
script-to-script indicator composition.

## Current Behavior

- `defineIndicator(...)` returns one `CompiledScriptObject` with a
  single `manifest` and `compute` function.
- `createScriptRunner(...)` mounts and executes one compiled script at
  a time.
- Built-in indicator math is exposed through composable `ta.*`
  primitives.
- Complex built-in primitives can compose lower-level primitives by
  using deterministic sub-slot ids.
- User code can share ordinary TypeScript helper functions through
  imports bundled by the compiler, but imported helpers are not
  separately mounted indicators with manifests, inputs, plots, or
  emissions.

## Desired Behavior

An author can define one indicator and consume selected outputs from it
inside another indicator while preserving chartlang's determinism,
type safety, manifest-driven capability model, and runtime isolation.

Example target author experience:

```ts
import { defineIndicator, indicatorRef, plot } from "@invinite-org/chartlang-core";
import baseTrend from "./base-trend.chart";

const trend = indicatorRef(baseTrend, {
    id: "baseTrend",
    inputs: { length: 50 },
});

export default defineIndicator({
    name: "Trend Confirmation",
    apiVersion: 1,
    compute({ bar, ta }) {
        const trendLine = trend.output("line");
        const trigger = ta.crossover(bar.close, trendLine);
        plot(trigger, { title: "Confirmed cross" });
    },
});
```

The exact API is not prescribed by this requirements file. The final
design may use `indicatorRef(...)`, a `request.indicator(...)`
namespace, manifest declarations, or another explicit dependency
surface, provided it satisfies the requirements below.

## Requirements

### 1. Explicit dependency declaration

- A dependent script MUST declare each indicator dependency statically.
- The compiler MUST reject dynamic dependency ids, computed import
  paths, or runtime-created dependency graphs.
- The dependency declaration MUST include a stable local id used for
  diagnostics, manifest output, state slots, and adapter UI.
- The dependency graph MUST be visible in the compiled manifest.

### 2. Output contract

- An indicator that is consumed by another indicator MUST expose a typed
  output contract.
- At minimum, single-output indicators MUST expose one
  `Series<number>` output.
- Multi-output indicators MUST expose named outputs, for example
  `"macd"`, `"signal"`, `"hist"`.
- A dependent script MUST fail typechecking when it asks for an unknown
  output name.
- Output series MUST preserve normal chartlang series behavior:
  `.current`, `[n]` lookback indexing, warmup `NaN`, and stable object
  identity where existing `Series<T>` consumers expect it.

### 3. Input overrides

- The dependent script MUST be able to pass static input overrides to
  the dependency.
- Input override values MUST be validated against the dependency's
  declared input schema.
- Invalid overrides MUST produce compile-time diagnostics when
  statically knowable.
- Runtime input changes from the host MUST invalidate and recompute the
  affected dependency tree consistently.

### 4. Deterministic execution order

- Dependencies MUST execute before their consumers for each bar.
- The runtime MUST execute each unique dependency instance at most once
  per bar per owning script mount.
- Diamond graphs MUST share the same dependency result when the local
  dependency id and effective inputs are identical.
- Cycles MUST be rejected at compile time or manifest-load time with a
  clear diagnostic.
- Tick-mode replacement semantics MUST match existing primitive and
  script runner behavior.

### 5. State isolation and persistence

- Each dependency instance MUST receive isolated `ta.*`, `state.*`,
  draw, alert, and runtime slots.
- State slot ids MUST be deterministic and namespaced by the parent
  script id plus dependency local id.
- Persistent state snapshots MUST include dependency state without
  colliding with the parent script or sibling dependencies.
- Removing or renaming a dependency local id MAY reset that dependency's
  state, but MUST NOT corrupt unrelated state.

### 6. Emission behavior

- The feature MUST specify whether dependency plots, drawings, alerts,
  alert conditions, logs, and diagnostics are forwarded, suppressed, or
  namespaced.
- Default behavior SHOULD suppress visual emissions from dependencies
  unless explicitly requested by the parent script or host.
- Diagnostics from dependencies MUST be surfaced with dependency
  context.
- Alert emissions from dependencies MUST NOT fire implicitly unless the
  dependency was explicitly mounted for alert behavior.

### 7. Manifest and adapter contract

- The manifest MUST include dependency metadata sufficient for hosts to
  preload, validate, cache, and display the dependency graph.
- Adapter capability checks MUST account for the union of required
  capabilities across the parent and dependencies.
- The runtime MUST reject unsupported dependency graphs before
  execution begins.
- The manifest format MUST remain JSON-compatible.

### 8. Compiler behavior

- The compiler MUST analyze dependency declarations before bundling.
- The compiler MUST emit dependency diagnostics with source ranges in
  the parent script.
- The compiler MUST prevent hidden dynamic imports that bypass the
  dependency manifest.
- Callsite-id injection MUST remain stable when dependency declarations
  are added, removed, or reordered outside a given compute body.
- The generated `.chart.d.ts` file MUST expose dependency outputs in a
  way that editor tooling can understand.

### 9. Runtime behavior

- `createScriptRunner(...)` or a successor API MUST accept the parent
  compiled script and its resolved dependency graph.
- The runtime MUST maintain separate stream state for each dependency
  instance while sharing the same incoming bar events.
- Dependency output series MUST be available to the parent compute body
  during the same bar step.
- Historical warmup MUST process dependencies and parent scripts in the
  same order used for live bars.
- Runtime errors in a dependency MUST be reported with dependency
  context and MUST have a defined impact on the parent output.

### 10. Language service and editor

- Hover, completion, signature help, and diagnostics MUST understand the
  dependency API.
- Unknown output names, invalid input overrides, and cycles SHOULD be
  shown in the editor before compile/run when possible.
- Go-to-definition SHOULD navigate from a dependency reference to the
  referenced indicator source when the host has that source available.

### 11. Security and sandboxing

- Dependency composition MUST NOT introduce host access beyond the
  existing chartlang script sandbox.
- Dependency resolution MUST be host-controlled. User scripts MUST NOT
  fetch arbitrary remote indicators at runtime.
- A compiled parent bundle MUST NOT execute arbitrary dependency module
  code outside the compiler/runtime-controlled path.

### 12. Backward compatibility

- Existing `defineIndicator(...)` scripts MUST continue to compile and
  run unchanged.
- Existing `ta.*` primitive composition MUST remain the preferred path
  for built-in indicator math.
- The feature SHOULD be additive to `apiVersion: 1` only if it can be
  represented with optional manifest fields and no semantic break.
  Otherwise it MUST be gated behind a future `apiVersion`.

## Non-Goals

- Do not add arbitrary user-defined stateful primitives as part of this
  feature.
- Do not make adapters extend the chartlang language dynamically.
- Do not allow runtime network loading of dependencies.
- Do not require dependency visual plots to render automatically.
- Do not replace `ta.*` primitives with user-script dependencies for
  core indicator parity.

## Open Design Questions

- Should the public API be `indicatorRef(...)`,
  `request.indicator(...)`, or manifest-only metadata?
- Should dependency scripts be imported by source path, package id,
  registry id, or host-provided handle?
- Are dependency outputs declared explicitly in `defineIndicator(...)`,
  inferred from `plot(...)`, or returned from `compute(...)` through a
  new output API?
- Should multiple parent indicators share dependency instances across
  chart mounts, or should sharing be limited to one parent runner?
- How should dependency input overrides interact with host-controlled
  input panels?
- Which dependency emissions, if any, should be visible by default?

## Acceptance Criteria

- [ ] A script can statically declare a dependency on another indicator.
- [ ] The compiled manifest contains a JSON-compatible dependency graph.
- [ ] The runtime executes dependencies before consumers on history,
      close, and tick events.
- [ ] The parent script can read at least one named
      `Series<number>` output from a dependency.
- [ ] Dependency inputs can be overridden and validated.
- [ ] Cyclic dependencies are rejected with a clear diagnostic.
- [ ] Dependency state is isolated and persists without slot collisions.
- [ ] Diagnostics include dependency context.
- [ ] Existing scripts and `ta.*` primitive behavior are unchanged.
- [ ] Tests cover compiler analysis, runtime execution order, state
      isolation, warmup behavior, cycle rejection, and editor diagnostics.

## Suggested Implementation Phases

1. **Design spike** — choose the public API and manifest shape; write
   examples and failure cases.
2. **Core types** — add dependency declaration and output contract
   types.
3. **Compiler analysis** — extract dependency graph, validate static
   declarations, emit manifest metadata.
4. **Runtime graph executor** — execute dependency runners in
   topological order and expose output series to consumers.
5. **State and persistence** — namespace dependency slots and snapshots.
6. **Language service** — add completions, diagnostics, and navigation.
7. **Docs and conformance** — document the feature and add
   cross-adapter conformance scenarios.
