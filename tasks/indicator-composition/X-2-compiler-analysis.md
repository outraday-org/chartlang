# Task 2 — Compiler dependency graph analysis + validation

> **Status: TODO**

## Goal

Add the compile-time analysis pass that walks a `.chart.ts` source,
identifies every `defineIndicator(...)` const binding, classifies
each as drawn (exported) or private dep, follows `.withInputs(...)`
chains, finds every consumer-side `<binding>.output(<string>)` call,
validates the graph, and emits a `DepGraph` artefact that Task 3's
bundler consumes. Also land the small AST transformer that rewrites
`<binding>.output("title")` call sites with a synthesised runtime
helper call — so Task 4's runtime never sees the user-side accessor.

## Prerequisites

Task 1 (core types). The new compiler code imports
`DependencyDeclaration`, `OutputDeclaration`, and the extended
`CompiledScriptObject` shape from `@invinite-org/chartlang-core`.

## Current Behavior

- `transformAndAnalyse` runs in `packages/compiler/src/api.ts` over
  a single `.chart.ts` source. It expects exactly **one**
  `defineIndicator(...)` default export per file (enforced by
  `structuralChecks` via the `missing-default-export` diagnostic).
  `structuralChecks` does not currently emit any "too-many-defaults"
  diagnostic — additional `defineIndicator` call expressions in the
  same module simply have no recognised role.
- `structuralChecks` returns `StructuralCheckResult` with fields
  `{ diagnostics, name, kind, overrides }`. No `bindings` field.
- No analysis pass walks `import X from "./Y.chart"` for any
  language semantics. Imports are esbuild's problem.
- No pass classifies which call expressions reference a
  `CompiledScriptObject`-typed binding.

## Desired Behavior

- `structuralChecks` is reworked to accept multiple top-level
  `defineIndicator(...)` const bindings (default + named + private)
  in one file. The "exactly one default export" rule stays — a file
  with zero or multiple defaults still errors — but additional named
  / private bindings are allowed.
- New analysis `extractDependencyGraph(sourceFile, checker,
  sourcePath, resolveProducer)` returns a `DepGraph`:

```ts
type DepGraph = Readonly<{
    readonly drawn: ReadonlyArray<DrawnScript>;
    readonly privateDeps: ReadonlyArray<PrivateDep>;
    readonly diagnostics: ReadonlyArray<CompileDiagnostic>;
}>;

type DrawnScript = Readonly<{
    readonly exportName: string; // "default" or named binding
    readonly bindingName: string; // JS identifier
    readonly defineCall: ts.CallExpression; // the defineIndicator(...) node
    readonly outputs: ReadonlyArray<OutputDeclaration>;
    readonly consumes: ReadonlyArray<DependencyDeclaration>;
}>;

type PrivateDep = Readonly<{
    readonly localId: string; // bindingName
    readonly producerRef: ProducerRef; // resolved producer
    readonly effectiveInputs: Readonly<Record<string, JsonValue>>;
    readonly defineCall: ts.CallExpression | null; // null for cross-file
    readonly outputs: ReadonlyArray<OutputDeclaration>;
    readonly consumes: ReadonlyArray<DependencyDeclaration>;
}>;

type ProducerRef =
    | { kind: "same-file"; bindingName: string }
    | { kind: "cross-file"; sourcePath: string; exportName: string };
```

- New transformer `rewriteDependencyAccessors(sourceFile, depGraph,
  checker)` returns a new `ts.SourceFile` where each
  `<binding>.output("title")` call site is replaced with a synthesised
  call `__chartlang_depOutput("slotId", "<localId>", "title")`.

## Requirements

### 1. `structuralChecks` rework

In `packages/compiler/src/analysis/structuralChecks.ts`:

- Track every top-level `const` initialiser whose RHS is a
  `defineIndicator(...)` call expression. Classify each as
  `"default"`, `"named"` (`export const X = ...`), or `"private"`.
- Surface a diagnostic per malformed binding:
    - `missing-default-export` — file has zero default
      `defineIndicator` exports (existing code, keep it firing).
    - `multiple-default-exports` — new code; file has more than one
      default `defineIndicator` export.
    - `non-const-define-binding` — new code; `defineIndicator(...)`
      assigned to `let` / `var` or wrapped in a function.
- Add the two new codes to `CompileDiagnosticCode` in
  `packages/compiler/src/diagnostics.ts`.
- Extend `StructuralCheckResult` with a new readonly `bindings`
  field carrying the classified set (`Array<{ exportKind:
  "default" | "named" | "private"; bindingName: string;
  defineCall: ts.CallExpression }>`).
- Existing single-script behaviour (1 default, 0 named, 0 private)
  is byte-identical — the new diagnostics fire only on multi-binding
  inputs.

### 2. `extractDependencyGraph` pass

New file
`packages/compiler/src/analysis/extractDependencyGraph.ts`.

Walks the source file in four sweeps:

**Sweep A — collect every `defineIndicator(...)` binding from
`structuralChecks` output.** Each binding gets a slot in either
`drawn[]` (default + named) or `privateDeps[]` (unexported `const`).

**Sweep B — resolve `.withInputs(...)` chains.** Walk every
`PropertyAccessExpression` whose receiver type resolves to
`CompiledScriptObject`. Follow the chain (`base.withInputs({...})
.withInputs({...})`) and:

- Validate that every `.withInputs(...)` argument is an object
  literal with literal-only property values
  (`number | string | boolean | null`). Reject computed property
  names, spread, or non-literal values with `dep-dynamic`.
- Validate every key against the producer's `manifest.inputs`
  schema. Unknown keys → `dep-invalid-input-override`. Type
  mismatches → `dep-invalid-input-override`.
- Merge in declaration order (later chain wins) and JSON-freeze
  the result.

**Sweep C — resolve consumer-side `.output("title")` calls.** Walk
every `CallExpression` whose callee is a `PropertyAccessExpression`
with name `"output"` and receiver typed as `CompiledScriptObject`.
For each call:

- The argument MUST be a single string literal — else `dep-dynamic`.
- Resolve the receiver to a binding declared in this file. If the
  receiver is a property access on a binding (after `.withInputs`),
  walk back to the source binding.
- The binding MUST be one of:
    - A same-file `const` whose RHS is `defineIndicator(...)` or a
      `withInputs` chain off a `CompiledScriptObject` binding.
    - An imported identifier from a sibling `.chart.ts` file —
      resolved via the `resolveProducer` callback (recursive
      compile entry point).
- The title MUST appear in the producer's `outputs` declaration
  list (built in Sweep D). Unknown titles →
  `dep-unknown-output`.
- Each unique `(consumer-binding, target-binding,
  effectiveInputs)` tuple creates one `DependencyDeclaration` entry
  on the consumer's `consumes[]` list. Multiple `.output("...")`
  calls against the same binding share one declaration.

**Sweep D — extract producer outputs from `plot(value, { title })`
calls.** For each binding's compute body, walk every `plot(...)`
call (matched the same way `extractCapabilities` matches plot
calls — `resolveCallee`-equivalent). Each call with a literal-string
`title` opt becomes an `OutputDeclaration{ title, kind:
"series-number" }`. Same title twice → diagnostic
`duplicate-output-title` (reusing the existing
`malformed-emission` style). Untitled `plot()` is fine **unless**
the binding is consumed by another script — in that case, raise
`dep-output-not-titled` at the consumer's call site (we know the
consumer exists from Sweep C). Producers without consumers can
ship untitled plots forever.

**Cycle detection.** Build a directed graph from `drawn` ∪
`privateDeps` → their `consumes` targets. Tarjan's SCC. Any SCC
of size > 1 → `dep-cycle` diagnostic at every binding in the SCC,
naming the cycle path.

**Cross-file resolution.** `resolveProducer(sourcePath,
exportName)` is a caller-provided callback (Task 3's bundler wires
it). For an `import X from "./Y.chart"` the analysis pass needs
the producer's `outputs[]`, `dependencies[]`, and `inputs` schema.
The bundler runs the full compiler on `./Y.chart` first (recursive),
caches by absolute path, and returns the producer's
`DepGraph.drawn[<exportName>]` entry. The cache also prevents
infinite recursion on cycles.

### 3. `rewriteDependencyAccessors` transformer

New file
`packages/compiler/src/transformers/rewriteDependencyAccessors.ts`.

Given the source file + the `DepGraph`, produce a new
`ts.SourceFile` where:

- Each consumer-side `<binding>.output("title")` call is replaced
  with `__chartlang_depOutput("<slotId>", "<localId>", "title")`.
  - `slotId` follows the existing
    `<sourcePath>:<line>:<col>#<callIndex>` format from
    `callsiteIdInjection.ts`.
  - `localId` is the consumer-side `bindingName` (resolved via
    Sweep C's tuple).
- Each `.withInputs(...)` chain on a private dep is stripped from
  the consumer's source — the effective inputs are baked into the
  bundle's emitted dep manifest by Task 3, not invoked at runtime.
- Each drawn-export `<binding>.output(...)` call (when one drawn
  indicator consumes another drawn one in the same file) is
  rewritten identically to the private-dep case. The dep edge is
  the same.

The transformer runs **before** `injectCallsiteIds` so the
synthesised `__chartlang_depOutput` call site gets its own
callsite slot id from the existing injection pass.

Add `__chartlang_depOutput` to the `HOSTILE_GLOBAL_NAMES` list in
`forbiddenConstructs.ts` so scripts can't synthesise it manually.
User-written references emit the existing `hostile-global`
diagnostic code (consistent with `eval` / `new Function` handling).

### 4. `transformAndAnalyse` integration

In `packages/compiler/src/api.ts`:

- After the early diagnostic gate (semantic + structural +
  forbidden + statefulInLoop), run `extractDependencyGraph` with a
  `resolveProducer` callback that's a no-op in Task 2 (returns
  `null` for every cross-file path) but is replaced by Task 3's
  recursive-compile wiring.
- Run `rewriteDependencyAccessors` to produce the AST that the
  bundler will print.
- Pipe `extractDependencyGraph`'s diagnostics into the unified
  diagnostic list.
- For the manifest: each drawn binding gets a
  `ScriptManifest.dependencies = [...consumes]` plus
  `ScriptManifest.outputs = [...]`. Drawn bindings emit one
  manifest each — `transformAndAnalyse` returns the **default
  binding's** manifest in the existing `manifest` slot for
  back-compat; Task 3 widens the result to expose the full set.
- The existing `extractCapabilities` /
  `extractRequestedIntervals` / `extractInputs` /
  `extractMaxLookback` calls run **once per drawn binding**, not
  once per file. Each drawn binding gets its own narrow analysis
  scope. Same for `validateLowerTfIntervals`.

### 5. Property + golden tests

`packages/compiler/` test layers: **unit + property + golden +
bench**.

- `extractDependencyGraph.test.ts` — unit. Cover:
    - single private dep, single consumer
    - multiple consumers diamond
    - cross-file via mocked `resolveProducer`
    - `.withInputs({...})` chain merge
    - input override validation (unknown key, wrong type)
    - output title validation (unknown title)
    - cycle detection (A→B→A direct; A→B→C→A indirect)
    - `dep-output-not-titled` only when consumed
    - `dep-dynamic` for non-literal `.withInputs(...)`
    - `dep-dynamic` for `let X = defineIndicator(...)`
- `extractDependencyGraph.property.test.ts` — property. Generate
  random small graphs (≤ 4 producers + ≤ 4 consumers), assert:
    - no false positives on acyclic graphs
    - all cycles detected
    - effective-inputs merge is associative on chained
      `.withInputs(...)` calls
- `extractDependencyGraph.golden.test.ts` — golden. Three
  reference scripts in
  `packages/compiler/src/__fixtures__/dep-graph/`
  (single-private-dep, multi-export, diamond) → pinned
  `DepGraph` JSON snapshots in `__fixtures__/golden/`.
- `rewriteDependencyAccessors.test.ts` — unit. Assert AST
  produced by the rewriter is byte-identical to a hand-written
  expected source for each fixture.

`packages/compiler/src/compile.bench.ts` extended with one bench
case driving a multi-export source through the new analysis.
Bench threshold = ceil(median × 3) per the existing convention.

### 6. `STATEFUL_PRIMITIVES` is untouched

Confirm in the unit test: `STATEFUL_PRIMITIVES.size === 172`
remains. Add an explicit assertion in
`packages/core/src/statefulPrimitives.test.ts` if not already
there.

### 7. `forbiddenConstructs` extension

Add `__chartlang_depOutput` to `HOSTILE_GLOBAL_NAMES` in
`forbiddenConstructs.ts` (the existing list that already covers
`eval`, `Function`, `Math.random`, `Date.*`). Any user-written
reference emits the existing `hostile-global` code — no new
diagnostic code is needed.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/compiler/src/analysis/structuralChecks.ts` | modify | Track multiple `defineIndicator` bindings (default + named + private). |
| `packages/compiler/src/analysis/structuralChecks.test.ts` | modify | Add tests for multi-binding cases. |
| `packages/compiler/src/analysis/extractDependencyGraph.ts` | create | Four-sweep graph builder + validators. |
| `packages/compiler/src/analysis/extractDependencyGraph.test.ts` | create | Unit cases. |
| `packages/compiler/src/analysis/extractDependencyGraph.property.test.ts` | create | Property tests. |
| `packages/compiler/src/analysis/extractDependencyGraph.golden.test.ts` | create | Golden snapshots. |
| `packages/compiler/src/__fixtures__/dep-graph/*.chart.ts` | create | Three reference scripts. |
| `packages/compiler/src/__fixtures__/golden/*.json` | create | Pinned DepGraph snapshots. |
| `packages/compiler/src/analysis/index.ts` | modify | Re-export the new pass. |
| `packages/compiler/src/transformers/rewriteDependencyAccessors.ts` | create | AST rewriter. |
| `packages/compiler/src/transformers/rewriteDependencyAccessors.test.ts` | create | Rewrite snapshots. |
| `packages/compiler/src/transformers/index.ts` | modify | Re-export. |
| `packages/compiler/src/analysis/forbiddenConstructs.ts` | modify | Forbid `__chartlang_depOutput` identifier. |
| `packages/compiler/src/analysis/forbiddenConstructs.test.ts` | modify | Test new forbidden identifier. |
| `packages/compiler/src/api.ts` | modify | Integrate new pass. `resolveProducer` callback stays a stub here; Task 3 wires it. |
| `packages/compiler/src/api.test.ts` | modify | New-shape integration test. |
| `packages/compiler/src/compile.bench.ts` | modify | Bench case for multi-export source. |
| `packages/compiler/src/diagnostics.ts` | modify | Register new diagnostic codes (`dep-*`). Diagnostics package surface is internal — separate from `DiagnosticCode` (which is the runtime emission union). |
| `packages/core/src/statefulPrimitives.test.ts` | modify (if needed) | Re-assert the 172-entry cardinality. |

## Gates

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm docs:check`,
  `pnpm readme:check`, `pnpm conformance`, `pnpm bench:ci` —
  green.
- 100% coverage on `packages/compiler/src/analysis/` and
  `packages/compiler/src/transformers/`.

## Changeset

- File: `.changeset/indicator-composition-2-analysis.md`
- Bump: **minor** for `@invinite-org/chartlang-compiler`.
- Reason: "Add `extractDependencyGraph` analysis pass and
  `rewriteDependencyAccessors` transformer for indicator
  composition. Six new `dep-*` compile diagnostics. Multi-binding
  `defineIndicator` per file now accepted; single-file behaviour
  unchanged."

## Acceptance Criteria

- [ ] `extractDependencyGraph` handles the six unit cases above and
      yields a stable JSON-serialisable `DepGraph` for each.
- [ ] Property test pins acyclic + cycle detection over generated
      graphs (pinned `fast-check` seed per the existing convention).
- [ ] Golden snapshots match the three reference scripts.
- [ ] `rewriteDependencyAccessors` produces byte-identical AST
      output across re-runs (determinism — the property test
      asserts this via `printFile(rewrite(src)) ===
      printFile(rewrite(src))`).
- [ ] Cycle detection works for A→B→A and A→B→C→A — both raise
      `dep-cycle` at every node in the SCC with the cycle path in
      the message.
- [ ] Input-override validation catches unknown keys and type
      mismatches; valid overrides merge in declaration order.
- [ ] `dep-output-not-titled` raised at the consumer's call site
      only when a producer's untitled plot is actually consumed.
- [ ] Existing single-script `.chart.ts` files compile through
      unchanged — `transformAndAnalyse` returns a manifest with no
      `dependencies` / `outputs` / `exportName` / `siblings`.
- [ ] `STATEFUL_PRIMITIVES.size === 172` still asserted.
- [ ] 100% coverage on every new file.
- [ ] Bench case for multi-export source lands with a pinned
      `THRESHOLD_MS`.
- [ ] Changeset committed.
