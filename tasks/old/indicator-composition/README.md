# Indicator Composition

> **Status: DONE.** Implements the indicator-composition requirements
> as an additive `apiVersion: 1.x` extension. PLAN.md does not yet
> reference this feature — the closest neighbour is the
> "Library scripts that other scripts can import" line in
> PLAN §19 "Beyond `1.0`". This task folder lands the feature
> additively without an `apiVersion` bump.
>
> **Version target:** per-package minor bump. `STATEFUL_PRIMITIVES`
> stays locked at 172 entries (the new `.output` / `.withInputs`
> accessors are compiler-rewritten sentinels on user-bound
> `CompiledScriptObject` instances — not new primitives).

## Goal

Let one chartlang indicator depend on another indicator's output
series in a deterministic, typed, sandbox-safe way.

The dependent script binds the producer's `defineIndicator(...)`
result to a local `const` — no new `indicatorRef` API. Optionally
overrides inputs via `.withInputs({...})`. Reads a named output
series via `<binding>.output("title")` inside `compute`.

Outputs are **inferred from the producer's `plot(value, { title })`
calls** — the producer's surface stays the same. Plot titles double
as output names; an untitled `plot()` in a producer disables the
"single default output" path with a diagnostic.

**Export = drawn. Non-exported `const` = data-only dep.** A
`.chart.ts` file MAY declare multiple `defineIndicator(...)` results.
Every result that's part of the module's exported surface (default
or named) is mounted and rendered by the host. Results that are only
held by a private `const` are mounted only as data feeds for other
indicators in the same file or in cross-file consumers; their plots,
drawings, alerts, and logs are dropped, and a `dep:<localId>/...`
diagnostic carries dep context.

Example target author experience:

```ts
import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";
import baseTrend from "./base-trend.chart";

// Private dep — local `const`, not exported. Not drawn.
const fastTrend = baseTrend.withInputs({ length: 20 });

// Drawn — `export const` makes the host mount + render it.
export const slowTrend = baseTrend.withInputs({ length: 50 });

// Drawn — default export, the file's "primary" script.
export default defineIndicator({
    name: "Trend Confirmation",
    apiVersion: 1,
    compute({ bar, ta, plot }) {
        const fast = fastTrend.output("line");
        const slow = slowTrend.output("line");
        if (ta.crossover(fast, slow).current) {
            plot(bar.close, { title: "Cross", style: { kind: "marker" } });
        }
    },
});
```

## Current State

- `defineIndicator(opts)` returns
  `CompiledScriptObject = { manifest, compute }`. No `.output`,
  `.withInputs`, or output-name surface.
  (`packages/core/src/define/defineIndicator.ts`)
- `createScriptRunner(args)` mounts **exactly one**
  `CompiledScriptObject` per call. No dep graph. State slots are
  flat — keyed by `<sourcePath>:<line>:<col>#<callIndex>`.
  (`packages/runtime/src/createScriptRunner.ts`)
- The compiler bundles **exactly one ESM module per `.chart.ts`
  file**, with `export default <CompiledScriptObject>` as the only
  expected export. Sidecar `<file>.chart.manifest.json` is a single
  `ScriptManifest` JSON.
  (`packages/compiler/src/api.ts`,
  `packages/compiler/src/bundle.ts`)
- `STATEFUL_PRIMITIVES` is a 172-entry frozen registry. The
  compiler walks it for callsite-id injection. Frozen by the
  `apiVersion: 1` contract (`docs/spec/versioning.md`).
- `ScriptManifest` carries no `dependencies` / `siblings` fields.
- `DiagnosticCode` has 26 stable entries. No `dep-*` entries.
- `examples/scripts/*.chart.ts` are single-indicator files. The
  CLI's `e2e.test.ts` pins one default export per file.

## Target State

After all 8 tasks land:

### Core (`packages/core/src/`)

- `CompiledScriptObject<TOutputs>` gains:
    - `output<K extends keyof TOutputs>(name: K): TOutputs[K]` — runtime
      sentinel; the compiler rewrites every call site at bundle time so
      the runtime never executes it.
    - `withInputs(overrides: Partial<InputDefaults<...>>): CompiledScriptObject<TOutputs>` — runtime
      sentinel that throws when called outside a static module-level
      binding; the compiler statically rewrites the chain.
- `ScriptManifest` extended (optional, additive):
    - `dependencies?: ReadonlyArray<DependencyDeclaration>` — flat
      list of statically-declared deps, one entry per local `const`
      binding that consumes a dep.
    - `outputs?: ReadonlyArray<OutputDeclaration>` — list of plot
      titles this script exposes for consumption by other scripts.
    - `exportName?: string` — when a file has multiple drawn
      indicators, each manifest carries its export-binding name.
      `"default"` for the default export.
    - `siblings?: ReadonlyArray<ScriptManifest>` — array of every
      other drawn `ScriptManifest` in the same compiled file.
      Always omitted on default-export manifests when the file has
      only one drawn script.
- `DiagnosticCode` extended with 6 new entries:
    - `dep-error` — dependency `compute` threw; parent's bar dropped.
    - `dep-cycle` — compile-time cycle detected.
    - `dep-unknown-output` — `<binding>.output("foo")` references a
      title the producer doesn't emit via `plot`.
    - `dep-invalid-input-override` — `.withInputs({...})` carries a
      key not in the producer's `inputs` schema or fails coercion.
    - `dep-dynamic` — dep binding cannot be statically resolved
      (non-`const`, conditional initialiser, computed access).
    - `dep-output-not-titled` — producer's `plot(...)` call has no
      `title`, so consumers cannot reference it by name.

### Compiler (`packages/compiler/src/`)

- New analysis pass `extractDependencyGraph` (in
  `packages/compiler/src/analysis/`) — walks each module-level
  `defineIndicator(...)` binding, classifies exported vs private,
  resolves `.withInputs(...)` chains, finds every consumer-side
  `<binding>.output(<string-literal>)` call, validates output
  names against producer manifests, validates input overrides
  against producer input schemas, detects cycles.
- New transformer `rewriteDependencyAccessors` (in
  `packages/compiler/src/transformers/`) — replaces
  `<binding>.output("title")` with a synthesised runtime call
  (`__chartlang_depOutput(slotId, depLocalId, "title")`) so the
  runtime can look up the value without the user-side accessor.
- `bundle.ts` extended to emit **one ESM module per
  `.chart.ts` file** with one default export + one named export
  per drawn `defineIndicator(...)`. Private dep bindings stay
  module-local consts inside the bundle (no exports).
- `<file>.chart.manifest.json` is either:
    - **One `ScriptManifest`** (current shape, when the file has
      exactly one drawn indicator — back-compat for every existing
      `.chart.ts` file in the repo).
    - **An array of `ScriptManifest`** entries when the file has
      multiple drawn indicators. The first entry is the default
      export. Each entry carries `exportName`; `siblings` is
      omitted in the array form.
- `<file>.chart.d.ts` extended to declare the typed `output` /
  `withInputs` accessors on every exported drawn indicator and on
  the module-imported deps.

### Runtime (`packages/runtime/src/`)

- `createScriptRunner` reshaped to accept either a single
  `CompiledScriptObject` (current Phase-1 contract — preserved) or
  a **`CompiledScriptBundle`** — a new shape carrying the primary
  drawn script + every dep / sibling.
- `DepRunner` sub-runners — one per dep instance per parent mount.
  Each owns its own slot store, ring buffer head into the main
  stream, and emission queues that are filtered before flowing up.
- `DepOutputStore` — per-bar buffer indexed by `(depLocalId,
  outputTitle)`. Populated when the dep's compute calls
  `plot(value, { title })`. Read by the rewritten
  `__chartlang_depOutput` runtime helper.
- Per-bar execution order: deps in topological order, then
  siblings (named exports), then default export. Private dep
  emissions dropped; sibling emissions forwarded with
  `exportName` namespacing in the plot/drawing slot ids.
- Dep error → parent's bar's emissions dropped; `dep-error`
  diagnostic surfaces with dep context. (Sibling errors halt only
  the sibling's bar — primary script keeps going.)

### Language service (`packages/language-service/src/`)

- Hover docs for `.output(...)`, `.withInputs(...)`,
  `CompiledScriptObject` (when bound).
- Completion of output names — when typing
  `<binding>.output("|"`, suggest the producer's `plot()` titles
  from its compiled `.chart.d.ts`.
- Diagnostics surface the new `dep-*` codes before compile when
  statically detectable.

### Conformance (`packages/conformance/`)

- 5 new scenarios:
    - `dep-private-single-file` — non-exported dep + default-export
      consumer in one file.
    - `dep-multi-export` — file with private dep + named export +
      default export.
    - `dep-cross-file` — `import baseTrend from "./..."` + consumer.
    - `dep-diamond` — two consumers reference the same dep instance.
    - `dep-error-halts-parent` — dep throws → consumer's bar drops.

### Docs (`docs/`)

- `docs/language/indicator-composition.md` — narrative guide.
- `docs/spec/manifest.md` — `dependencies` / `outputs` /
  `exportName` / `siblings` fields documented.
- `docs/spec/semantics.md` — dep execution order, emission
  isolation, slot-id namespacing.
- `docs/spec/versioning.md` — explicit note that composition is
  `apiVersion: 1.x` additive.
- `docs/reference/glossary.md` — "dependency", "private dep",
  "drawn indicator", "output".
- `docs/getting-started/write-your-first-script.md` — appendix
  link.
- `README.md` — one-line mention; ≤ 300-line cap preserved.

### Examples (`examples/`)

- `examples/scripts/trend-confirmation.chart.ts` — multi-export
  example. Exports `baseTrend` + default consumer.
- `examples/scripts/base-trend.chart.ts` — cross-file producer
  for the cross-file scenario.
- `examples/react-demo/src/scripts.ts` — fifth catalogue entry
  `trend-composition`: one file with **three** indicators — a
  private `const` dep (data-only reference), a named export
  (drawn sibling), and a default export consuming both.

## Architecture Decisions

| Decision | Rationale |
|---|---|
| **No new `indicatorRef` / `request.indicator` API.** Just `const` + `defineIndicator(...)`. | The user picked the smallest possible surface. The local `const` binding name doubles as the dep id; the compiler statically walks it. Adds zero exports to the script-author surface beyond the two chainable methods on `CompiledScriptObject` (`.output`, `.withInputs`). |
| **Outputs inferred from `plot(value, { title })` titles.** | The user picked this. The producer's surface stays the same; consumers reference outputs by the same string already used for legend chips. An untitled `plot(...)` in a producer raises a `dep-output-not-titled` diagnostic at compile time — only when that producer is actually consumed elsewhere. Free producers still ship untitled plots fine. |
| **Inline-bundle: one ESM file per `.chart.ts`.** | The user picked this. Deps and consumers ship in one artefact, so the host loads one file per top-level script. No new "register sibling bundles" host surface. Cross-file deps are recursively inlined by the compiler's `extractDependencyGraph` pass walking each `import ./X.chart` it finds at a dep binding. |
| **Export-status = drawn-status.** Default export + every named export = drawn. Private `const` = data feed. | The user picked this. Maps the host's "what do I render?" question onto the existing TypeScript module surface. No new manifest flag needed; static analysis already knows which bindings are exported. |
| **`.withInputs({...})` for overrides; no opt-in `.forward({...})`.** | Emissions follow export status. A dep that's also `export const` renders normally; a dep that's `const` only does not. No third "forwarded but not exported" mode — the user's model is binary. |
| **Stay in `apiVersion: 1` (additive).** | The user picked this. Every change is an additive optional manifest field or new export. The 172-entry `STATEFUL_PRIMITIVES` set is untouched — the new accessors aren't primitives. `DiagnosticCode` is documented as additive across `1.x` (per `docs/spec/versioning.md`'s "Emission Wire Schemas" clause). |
| **Dep error → parent's bar dropped (best-effort isolation).** | The user picked this. Mirrors today's `runtime-error-thrown` containment. A buggy dep cannot smuggle wrong values into a consumer. Sibling errors only halt the sibling's bar (siblings are independent renderable scripts, not data deps). |
| **One file's compiled manifest is a `ScriptManifest \| ReadonlyArray<ScriptManifest>`.** | Single-script files (every existing `.chart.ts` in the repo) stay byte-identical. Multi-script files emit an array. The host runs `Array.isArray` to branch. Cleanest back-compat path; no breaking change for consumer-repo adapters that drive one script per file. |
| **Slot-id namespacing: `dep:<localId>/<inner-slotId>`** for private deps; `export:<exportName>/<inner-slotId>` for siblings; primary script's slot ids unchanged. | Stable, namespaced, JSON-safe. The host can dedup emissions across deps without re-parsing slot id format. Private deps and siblings both get a prefix; the primary stays clean for the back-compat path. |
| **Numbering = execution order; no parallel waves.** | Task 1 lands all the new core types; Task 2 the analysis pass; Task 3 the bundling; Task 4 the runtime exec; Task 5 the state / persistence isolation; Task 6 the host + adapter pass-through (DiagnosticCode reaches adapter-kit); Task 7 the language service; Task 8 conformance + docs + examples + changeset. |

## Dependency Graph

```
Task 1 (core types + manifest + diagnostic codes)
    |
    v
Task 2 (compiler analysis — extract dep graph, validate)
    |
    v
Task 3 (compiler bundling — multi-export, dep inlining, d.ts)
    |
    v
Task 4 (runtime — dep exec, output store, emission filter)
    |
    v
Task 5 (runtime — slot isolation, persistence namespacing)
    |
    v
Task 6 (host + adapter — multi-script mount, DiagnosticCode)
    |
    v
Task 7 (language service — hover/completion/diagnostics)
    |
    v
Task 8 (conformance + docs + examples + changeset)
```

## Task Summary

| # | Title | Package(s) | Dependencies | Est. Complexity |
|---|---|---|---|---|
| 1 | [Core types, manifest extensions, diagnostic codes](./X-1-core-types.md) | core, adapter-kit | None | Medium |
| 2 | [Compiler — dependency graph analysis + validation](./X-2-compiler-analysis.md) | compiler | 1 | High |
| 3 | [Compiler — multi-export bundle + inline deps + `.d.ts` accessors](./X-3-compiler-bundling.md) | compiler | 2 | High |
| 4 | [Runtime — dep executor + output store + emission filter](./X-4-runtime-dep-executor.md) | runtime | 3 | High |
| 5 | [Runtime — slot-id namespacing + persistence isolation](./X-5-runtime-state-persistence.md) | core, runtime | 4 | Medium |
| 6 | [Host + adapter — multi-script mount + new `DiagnosticCode` round-trip](./X-6-host-adapter-passthrough.md) | host-worker, host-quickjs, adapter-kit, canvas2d-adapter | 5 | Medium |
| 7 | [Language service — hover, completion, diagnostics for deps](./X-7-language-service.md) | language-service, editor | 6 | Medium |
| 8 | [Conformance scenarios + docs + example scripts + changeset](./X-8-conformance-docs-example.md) | conformance, cli, docs, examples | 7 | High |

## Code Reuse

The feature reuses every Phase-1 / Phase-2 facility — coverage / lint
/ scaffold / docs / readme / conformance gates, the
`Float64RingBuffer` / `Series<T>` data structures, the slot-store
mechanism, the `RuntimeContext` accessor, and the existing
extractors / transformers.

| Reuse | Source | Notes |
|---|---|---|
| `packages/compiler/src/program.ts` (TS ambient shim + `createProgramForSource`) | Phase 1 | Reused for compiling imported `.chart.ts` files inside the new `extractDependencyGraph` pass — same shim, recursive resolution. |
| `packages/compiler/src/transformers/callsiteIdInjection.ts` | Phase 1 | Reused — runs **after** `rewriteDependencyAccessors` so synthesised `__chartlang_depOutput` calls receive callsite-id slots too. |
| `packages/compiler/src/analysis/extractInputs.ts` + `extractCapabilities.ts` | Phase 1 | Reused unchanged. The new dep pass calls into them when recursively analysing imported producers. |
| `packages/compiler/src/bundle.ts` esbuild driver | Phase 1 | Reused. The new emitter pre-prints the inlined dep modules into the parent's TS source, then runs esbuild over the combined source — no esbuild flag changes. |
| `packages/runtime/src/createScriptRunner.ts` | Phase 1 | Reused. The new shape (`CompiledScriptBundle`) is a tagged-union accepted alongside `CompiledScriptObject` — single-script callers keep working byte-identically. |
| `packages/runtime/src/buildComputeContext.ts` | Phase 1 | Reused. Each `DepRunner` gets its own `RuntimeContext` built through the existing builder; the parent's `ComputeContext` is unchanged. |
| `packages/runtime/src/execution/onBarClose.ts` | Phase 1 | Reused. The dep-executor wraps it — each dep is just `await onBarClose(depState, bar)` in topological order before the consumer runs. |
| `packages/runtime/src/persistentStateStore.runtime.ts` | Phase 4 | Reused. Snapshot keys gain a `dep:<localId>` prefix; the existing flush/restore plumbing isn't changed. |
| `packages/host-worker/src/createWorkerHost.ts` | Phase 1 | Reused. Worker boot loop iterates over the compiled bundle's exports if `Array.isArray(manifest)` — single-script back-compat preserved. |
| `examples/canvas2d-adapter/src/createCanvas2dAdapter.ts` | Phase 1 | Reused. Its `Adapter.onEmissions` already accepts namespaced slot ids — no renderer change. |
| `packages/conformance/src/runConformanceSuite.ts` Scenario.inlineSource | Phase 2 | Reused. New dep scenarios use `inlineSource` to keep dep code inline with the scenario file. |

New artefacts introduced (consumed by Tasks 2–8):

| New artefact | Location | Rationale |
|---|---|---|
| `DependencyDeclaration` / `OutputDeclaration` / `CompiledScriptBundle` | `packages/core/src/types.ts` (Task 1) | Manifest + runner shapes. Additive — single-script files don't carry these. |
| `extractDependencyGraph` analysis pass | `packages/compiler/src/analysis/extractDependencyGraph.ts` (Task 2) | Walks bindings, builds graph, validates. Returns a `DepGraph` consumed by the bundler + runtime. |
| `rewriteDependencyAccessors` transformer | `packages/compiler/src/transformers/rewriteDependencyAccessors.ts` (Task 2) | Replaces `<binding>.output(...)` with `__chartlang_depOutput(...)`. |
| `DepRunner` + `DepOutputStore` | `packages/runtime/src/dep/` (Task 4) | Sub-runner per dep instance; per-bar title-keyed value buffer. |
| `emissionFilter` (dep-aware) | `packages/runtime/src/dep/emissionFilter.ts` (Task 4) | Drops private-dep plots/draws/alerts/logs; namespaces diagnostics. |
| `__chartlang_depOutput` runtime helper | `packages/runtime/src/dep/depOutput.ts` (Task 4) | Looks up the dep's titled output Series for the current bar. |

## Provenance

This feature has no `../invinite/` math port — it's a pure
chartlang language extension. No provenance header required on any
new file.

The conformance scenario fixtures (`dep-diamond` etc.) reuse the
existing 10 000-bar `packages/conformance/fixtures/goldenBars.json`
(Phase-1 generated; no regen).

## Deferred / Follow-Up Work

Out of scope for this folder, even though the original requirements
draft mentioned adjacent ideas:

- **Dynamic dep loading** — host-supplied registry of compiled
  scripts resolved at mount time. The user explicitly picked the
  inline-bundle path; dynamic resolution stays out of scope until
  a future `apiVersion`.
- **Per-dep emission opt-in via `.forward({...})`** — superseded by
  the export-status model. If `apiVersion: 2` later adds it, the
  surface stays additive.
- **`request.indicator(...)` ctx-namespace alternative** —
  superseded by the local-`const` model.
- **`outputs:` explicit-declaration mode on `defineIndicator(...)`**
  — superseded by the plot-title-inference model.
- **Multi-mount instance sharing across chart panels** —
  per-mount isolation is the simplest model and is what the
  requirements doc allows.
- **Cross-package dep imports (`import from "@some/other-pkg/x.chart"`)**
  — same-package only in this folder. A future task can extend the
  compiler's resolver.
- **Dep alerts forwarded with rate-limit ledger merge** — out of
  scope; alerts only flow when the dep is also a drawn export.
- **`apiVersion: 2`** — explicitly not bumped. Every change here
  is additive within the `1.x` clarification window of
  `docs/spec/versioning.md`.

## Pre-flight Checks

Before starting Task 1, verify:

- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` are
      green on the current `main` snapshot.
- [ ] The 172-entry `STATEFUL_PRIMITIVES` cardinality matches
      `docs/spec/versioning.md`'s frozen count (assertion lives at
      `packages/core/src/statefulPrimitives.test.ts:382`).
- [ ] No existing changeset already touches `dependencies` /
      `siblings` on `ScriptManifest` (search `.changeset/*.md`).
- [ ] `examples/scripts/*.chart.ts` snapshot still default-exports
      a single indicator each (back-compat baseline for Task 3).
- [ ] `DiagnosticCode` count in `packages/adapter-kit/src/types.ts`
      is **26** at the start of Task 1 (the task adds 6 new `dep-*`
      entries, bringing it to 32).
