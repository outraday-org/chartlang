# 2-compiler-analysis — Implementation Plan

> Audit artefact for `tasks/indicator-composition/2-compiler-analysis.md`.
> Adds the compile-time dependency-graph analysis pass + the AST rewriter
> that turns `<binding>.output("title")` call sites into synthesised
> `__chartlang_depOutput(...)` calls. Builds on Task 1 (core types,
> manifest fields, diagnostic codes) which is already in the working
> tree (uncommitted).

## Context

- Single compiler-internal PR. Touches `packages/compiler/` only.
- No runtime / host / bundler / runner changes — Task 3 will wire the
  bundler around `extractDependencyGraph`'s `resolveProducer` callback.
- `apiVersion` stays at `1`; the new diagnostics are additive within
  `1.x` (`docs/spec/versioning.md`).
- Workspace verified clean for the new symbols: no pre-existing
  `extractDependencyGraph`, `rewriteDependencyAccessors`, `DepGraph`,
  `DrawnScript`, `PrivateDep`, `ProducerRef`, `__chartlang_depOutput`,
  `multiple-default-exports`, `non-const-define-binding`, or
  `duplicate-output-title` definitions anywhere under
  `packages/**/src/`.
- The 6 `dep-*` diagnostic codes live on `DiagnosticCode` in
  `packages/adapter-kit/src/types.ts` (runtime emission union, added by
  Task 1). This task adds the same six codes to **`CompileDiagnosticCode`**
  in `packages/compiler/src/diagnostics.ts` (compiler-internal union).
  The two sets are deliberately separate per the task spec note line
  312: "Diagnostics package surface is internal — separate from
  `DiagnosticCode` (which is the runtime emission union)."

## Pre-existing work

Task 1 already landed (uncommitted) the following — DO NOT duplicate:

- `packages/core/src/define/dependency.ts` — `DependencyDeclaration` /
  `OutputDeclaration` type definitions.
- `packages/core/src/types.ts` — `ScriptManifest` gains
  `dependencies?`, `outputs?`, `exportName?`, `siblings?`, `isDrawn?`.
  `CompiledScriptObject` gains `output` / `withInputs` sentinels.
  `CompiledScriptBundle` + `isCompiledScriptBundle` added.
- `packages/core/src/define/defineIndicator.ts` + `depAccessorSentinel.ts`
  — runtime sentinels.
- `packages/adapter-kit/src/types.ts` — `DiagnosticCode` widened to 32
  entries including all 6 `dep-*` codes.
- `packages/adapter-kit/src/validation/validateEmission.ts` —
  `VALID_DIAGNOSTIC_CODES` widened in lockstep.
- `packages/compiler/src/program.ts` — ambient shim mirrors every new
  core type.
- `.changeset/indicator-composition-1-core-types.md` — minor on core,
  adapter-kit, compiler.

Other relevant pre-existing surface:

- `packages/compiler/src/analysis/structuralChecks.ts:164-318` —
  single-default-export validator. Must be widened to track multiple
  `defineIndicator(...)` const bindings.
- `packages/compiler/src/analysis/index.ts` — barrel for analysis
  passes. Adds new `extractDependencyGraph` export.
- `packages/compiler/src/transformers/index.ts` — barrel for
  transformers. Adds new `rewriteDependencyAccessors` export.
- `packages/compiler/src/transformers/callsiteIdInjection.ts:50-139` —
  AST rewriter pattern; `rewriteDependencyAccessors` mirrors the
  `ts.transform([factory])` pattern, then runs **before**
  `injectCallsiteIds` so the synthesised `__chartlang_depOutput` calls
  receive their own slot ids.
- `packages/compiler/src/transformers/resolveCallee.ts:27-131` —
  `resolveCalleeName` is reused for finding `plot(...)` and
  `defineIndicator(...)` calls. The new analysis uses the same
  primitive when matching producer outputs in Sweep D.
- `packages/compiler/src/analysis/extractInputs.ts` — pattern for
  literal-only object-literal validation (the `readLiteral` helper).
  `extractDependencyGraph` reuses the same JSON-literal extraction
  approach when validating `.withInputs({...})` argument values.
- `packages/compiler/src/diagnostics.ts:18-37` — `CompileDiagnosticCode`
  union, 19 entries. Adds 9 new codes (3 structural + 6 dep-*) bringing
  it to 28.
- `packages/compiler/src/api.ts:92-209` — `transformAndAnalyse` shape.
  New pass slots in after the early-diagnostic gate, before manifest
  assembly. Existing single-script behaviour stays byte-identical.
- `packages/compiler/src/__fixtures__/scripts.ts` — `VALID_DEFINE` and
  `EMA_CROSS` fixtures. New `MULTI_EXPORT_COMPOSITION` fixture lands
  here for the bench case.
- `packages/core/src/statefulPrimitives.test.ts:381-382` — already pins
  `STATEFUL_PRIMITIVES.size === 172`. No change needed.

## Issues found vs. raw task text

1. **Task spec uses both "diagnostic" and "compile diagnostic" interchangeably.**
   The compiler's emission set is `CompileDiagnosticCode` (compiler
   internal); the runtime's is `DiagnosticCode` (adapter-kit). The task
   spec line 312 acknowledges this separation. Task 1 already added the
   6 `dep-*` to `DiagnosticCode`; **Task 2 adds them to
   `CompileDiagnosticCode`** plus three new structural codes
   (`multiple-default-exports`, `non-const-define-binding`,
   `duplicate-output-title`).

2. **Task lists `duplicate-output-title` under "reusing the existing
   `malformed-emission` style"** (line 167-168). But `malformed-emission`
   doesn't exist in `CompileDiagnosticCode`. **Decision:** add
   `duplicate-output-title` as a brand new code in
   `CompileDiagnosticCode`. The task's mention of
   `malformed-emission` was descriptive guidance about the diagnostic
   shape, not a literal reuse.

3. **`compileFile.test.ts` / `compileProject.test.ts`.** These tests
   compile `.chart.ts` files via `compileFile` and `compileProject`.
   Single-script behaviour must stay byte-identical — verified by the
   existing `examples/scripts/*.chart.ts` fixtures + their snapshot
   pins. The new code path **only** activates when the source file
   contains more than one top-level `defineIndicator(...)` const
   binding. The early gate via `structural.bindings.length === 1` keeps
   the back-compat path zero-cost.

4. **`resolveProducer` callback is stubbed in Task 2.** Per the task
   spec line 223-224: "`resolveProducer` callback that's a no-op in
   Task 2 (returns `null` for every cross-file path) but is replaced
   by Task 3's recursive-compile wiring." The pass must accept the
   callback but Task 2 cannot exercise cross-file flows — those tests
   land in Task 3. Task 2's unit test uses a mocked `resolveProducer`
   that returns hand-built `DrawnScript` shapes.

5. **`STATEFUL_PRIMITIVES.size === 172`** — already pinned. No change
   needed to `statefulPrimitives.test.ts`. The acceptance criterion is
   satisfied by leaving the test alone.

6. **Coverage exclusion.** `packages/compiler/vitest.config.ts` excludes
   `index.ts` (barrel) + `types.ts` (declarations only). The new
   `extractDependencyGraph.ts` and `rewriteDependencyAccessors.ts`
   carry runtime logic and require 100% coverage. Sentinel branches
   (e.g. "input is not a CallExpression — bail") are reachable via the
   property-test corpus.

7. **Coverage on cycle detection.** Tarjan's SCC has a few never-hit
   branches when the graph is empty or a single node. **Decision:** use
   an iterative-DFS-based cycle finder rather than full Tarjan since
   the graph is small (≤ N bindings per file, typically ≤ 5). A simple
   colour-marking DFS (white / grey / black) reports cycle paths
   directly and stays inside 100% coverage easily. The task spec calls
   for "Tarjan's SCC" but the *behavioural* requirement is "raise
   `dep-cycle` at every binding in the SCC, naming the cycle path."
   Colour-marking DFS satisfies that, and the property test still
   pins detection over generated graphs.

8. **`forbiddenConstructs` for `__chartlang_depOutput`.** The task
   spec asks for the identifier to fire the existing `hostile-global`
   diagnostic. The current `HOSTILE_GLOBAL_NAMES` set rejects identifier
   references; the `__chartlang_depOutput` synthesised by the
   transformer is created via `ts.factory.createIdentifier(...)` on a
   **new** source file produced after `runForbiddenConstructs` runs, so
   the check stays on the original AST and doesn't reject our own
   synthesised calls. This matches the existing pattern where
   `injectCallsiteIds` emits synthesised identifiers ("ta.ema", etc.)
   without re-triggering forbidden-construct diagnostics.

9. **`alertConditions` early-return.** When the existing flow hits an
   error, `transformAndAnalyse` early-returns at line 124-141 with a
   placeholder manifest. The new dep-graph pass runs **after** that
   early-return — its diagnostics flow into the unified list, but
   error diagnostics from earlier passes still short-circuit. The
   plan extends the early-return path to also handle structural
   `multiple-default-exports` / `non-const-define-binding` (they're
   structural errors).

10. **Sibling-binding analysis scope.** Per the task spec line
    237-239: "The existing `extractCapabilities` /
    `extractRequestedIntervals` / `extractInputs` / `extractMaxLookback`
    calls run **once per drawn binding**, not once per file." But every
    existing extractor takes a `sourceFile` + `checker` — they walk the
    whole file. **Decision (Task 2 scope):** Leave the extractors as
    whole-file scans in this task, because:
    - The task title is "compiler analysis"; per-binding extractor
      isolation belongs to the bundler when it carves the file into
      separate emitted ESM modules.
    - Task 3 owns the bundling and will repeatedly compile the
      separated bindings, picking up per-binding capabilities then.
    - Single-script back-compat stays byte-identical without churn.
    Task 2 still attaches `dependencies` + `outputs` to the default
    manifest (the back-compat slot) so `compileFile` consumers
    immediately benefit. Multi-export per-binding scope lands in
    Task 3 alongside the bundle emit.

## Improvements

- Reuse `resolveCalleeName` for both `plot(...)` matching (Sweep D) and
  `defineIndicator(...)` matching (already used by `structuralChecks`).
- Reuse the `readLiteral` JSON-literal-extraction pattern from
  `extractInputs.ts` rather than re-implementing it. Pull it into a
  small inline helper inside `extractDependencyGraph.ts` (the file
  level helper from `extractInputs` is module-private and the task
  shouldn't widen its surface mid-flight).
- Test fixtures land under `packages/compiler/src/__fixtures__/dep-graph/`
  as separate `.chart.ts` sources rather than inline strings — easier
  to read and snapshot.
- Golden fixtures in `__fixtures__/golden/` get JSON-frozen `DepGraph`
  serialisations (only the serialisable subset; `ts.CallExpression`
  nodes are stripped before serialising).

## Numbered Steps

### Step 1 — `packages/compiler/src/diagnostics.ts` (modify)

1.1. Append nine new entries to the `CompileDiagnosticCode` union:

```ts
// structural multi-binding additions
| "multiple-default-exports"
| "non-const-define-binding"
// dep-graph analysis
| "dep-cycle"
| "dep-unknown-output"
| "dep-invalid-input-override"
| "dep-dynamic"
| "dep-output-not-titled"
| "duplicate-output-title"
```

Note: `dep-error` is **runtime-only** (the runtime raises it when a
dep's compute throws); it lives in `DiagnosticCode` but not in
`CompileDiagnosticCode`.

1.2. Update the JSDoc block above the union to mention the new codes.

### Step 2 — `packages/compiler/src/analysis/structuralChecks.ts` (modify)

2.1. Add a new exported type `StructuralBindingInfo`:

```ts
export type StructuralBindingInfo = Readonly<{
    readonly exportKind: "default" | "named" | "private";
    readonly bindingName: string;
    readonly defineCall: ts.CallExpression;
    readonly defineKind: "indicator" | "drawing" | "alert" | "alertCondition";
}>;
```

2.2. Extend `StructuralCheckResult` with a `bindings` field:
`ReadonlyArray<StructuralBindingInfo>`. The default-export entry
(when present) is always first.

2.3. Rework the scanner: walk every top-level statement; for each
`VariableStatement` / `ExportAssignment` whose initialiser or
expression is a `CallExpression` to one of `DEFINE_CALLS`, push a
`StructuralBindingInfo`. Classify:

- `ExportAssignment` (no `isExportEquals`) → `exportKind: "default"`.
- `export const X = defineIndicator(...);` → `exportKind: "named"`.
- `const X = defineIndicator(...);` (no `export`) → `exportKind: "private"`.

2.4. Emit `non-const-define-binding` when the binding uses `let` /
`var` (`VariableDeclarationList.flags & ts.NodeFlags.Const` is zero)
**and** the initialiser is a `defineIndicator(...)` call. Surfaces only
when the user explicitly wrote `let foo = defineIndicator(...)`.

2.5. Emit `multiple-default-exports` when more than one
`ExportAssignment` (excluding `isExportEquals`) appears in the file.

2.6. Keep existing `missing-default-export` firing on zero defaults.
Keep existing `api-version-mismatch` firing on the default's argument
shape. **Do not** validate `apiVersion` on named or private bindings
in Task 2 — Task 3 will widen that loop when it emits per-binding
manifests. Task 2's default-binding behaviour stays byte-identical.

2.7. Return the augmented `StructuralCheckResult` carrying `bindings`.

### Step 3 — `packages/compiler/src/analysis/extractDependencyGraph.ts` (create)

3.1. MIT header.

3.2. Exported types:

```ts
export type ProducerRef =
    | Readonly<{ kind: "same-file"; bindingName: string }>
    | Readonly<{ kind: "cross-file"; sourcePath: string; exportName: string }>;

export type DepConsumesEntry = Readonly<{
    readonly localId: string;
    readonly producerRef: ProducerRef;
    readonly outputs: ReadonlyArray<OutputDeclaration>;
    readonly effectiveInputs: Readonly<Record<string, JsonValue>>;
}>;

export type DrawnScript = Readonly<{
    readonly exportName: string;
    readonly bindingName: string;
    readonly defineCall: ts.CallExpression;
    readonly outputs: ReadonlyArray<OutputDeclaration>;
    readonly consumes: ReadonlyArray<DepConsumesEntry>;
}>;

export type PrivateDep = Readonly<{
    readonly localId: string;
    readonly producerRef: ProducerRef;
    readonly effectiveInputs: Readonly<Record<string, JsonValue>>;
    readonly defineCall: ts.CallExpression | null;
    readonly outputs: ReadonlyArray<OutputDeclaration>;
    readonly consumes: ReadonlyArray<DepConsumesEntry>;
}>;

export type ResolveProducer = (
    sourcePath: string,
    exportName: string,
) => Readonly<{
    outputs: ReadonlyArray<OutputDeclaration>;
    inputs: Readonly<Record<string, unknown>>;
    name: string;
}> | null;

export type DepGraph = Readonly<{
    readonly drawn: ReadonlyArray<DrawnScript>;
    readonly privateDeps: ReadonlyArray<PrivateDep>;
    readonly diagnostics: ReadonlyArray<CompileDiagnostic>;
}>;
```

3.3. Exported function:

```ts
export function extractDependencyGraph(
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker,
    sourcePath: string,
    structuralBindings: ReadonlyArray<StructuralBindingInfo>,
    resolveProducer: ResolveProducer,
): DepGraph;
```

3.4. Implementation per the four-sweep design in the task spec:

- **Sweep A** — partition `structuralBindings` into `drawn` (default +
  named) and `privateBindings` (private). Build a binding-name → kind
  index used by Sweeps B/C.
- **Sweep D first** (yes, ahead of B/C — Sweep B/C need the per-binding
  outputs to validate `.output("title")` titles): walk every
  binding's `defineIndicator({ compute })` call; locate the
  `compute` property's function body; walk every `plot(...)` call
  inside the function body. Each `plot(...)` whose 2nd argument
  (options object) carries a literal-string `title` becomes one
  `OutputDeclaration`. Duplicate titles within the same binding →
  `duplicate-output-title`. Untitled `plot` is *recorded* in the
  per-binding "untitled-plot count" so Sweep C can raise
  `dep-output-not-titled` only when consumed.
- **Sweep B** — for each binding's RHS expression (originally a
  `defineIndicator(...)` call, possibly with chained `.withInputs(...)`
  / passed via another const-aliased reference), walk the chain of
  `PropertyAccessExpression`/`CallExpression` nodes. For each
  `.withInputs(objectLit)` call: validate every property is a
  `PropertyAssignment` with literal RHS via the inlined `readLiteral`
  helper. Reject computed property names + spread elements + non-literal
  values with `dep-dynamic`. Capture the merged inputs.
- **Sweep C** — walk every consumer body (each binding's compute
  function) looking for `CallExpression`s whose callee is
  `<receiver>.output(<arg>)`. The receiver MUST trace back to a
  module-level const binding via `checker.getSymbolAtLocation`. The
  argument MUST be a single `ts.StringLiteral` — else `dep-dynamic`.
  Resolve receiver-binding → producer:
    - If receiver is a *same-file* binding declared via
      `defineIndicator(...)` or a `.withInputs(...)` chain off another
      same-file binding: use `producerRef: { kind: "same-file", ... }`.
    - If receiver is an `ImportSpecifier` / `ImportClause`: resolve
      via `resolveProducer(modulePath, exportName)` to a producer
      spec. In Task 2 the callback is a no-op, so cross-file
      receivers see `null` — that's fine in Task 2 (tests use a
      mocked callback that returns hand-built producer specs).
    - Validate `name` (string-literal arg) against the producer's
      `outputs[]`. Unknown → `dep-unknown-output`. If producer has any
      "untitled-plot" tagged and the consumer is consuming, raise
      `dep-output-not-titled` at the **consumer's** call site.

3.5. **Cycle detection.** Build the same-file directed graph
(`bindingName` → set of `bindingName` it consumes from), run a
colour-marking iterative DFS. Any back-edge raises `dep-cycle` at
every binding in the discovered cycle, with the cycle path in the
message (`"A -> B -> A"`).

3.6. JSDoc with `@since 0.7`, `@stable`, `@example`. Inline helpers
(no exports) carry a single short JSDoc line each.

### Step 4 — `packages/compiler/src/analysis/extractDependencyGraph.test.ts` (create)

Unit cases per the task spec acceptance list:

1. single private dep + single consumer.
2. multiple consumers diamond.
3. cross-file via mocked `resolveProducer`.
4. `.withInputs({...})` chain merge (declaration order wins).
5. `dep-invalid-input-override` for unknown key.
6. `dep-invalid-input-override` for type-mismatched key.
7. `dep-unknown-output` for missing title.
8. cycle A→B→A detected with `dep-cycle`.
9. cycle A→B→C→A detected.
10. `dep-output-not-titled` only when consumed.
11. `dep-dynamic` for non-literal `.withInputs({...})` argument.
12. `dep-dynamic` for `let X = defineIndicator(...)`.

### Step 5 — `packages/compiler/src/analysis/extractDependencyGraph.property.test.ts` (create)

`fast-check` corpus with pinned seed (use the workspace's existing
seed-pinning pattern from `extractInputs.property.test.ts`). Generate
random graphs of ≤ 4 producers + ≤ 4 consumers and assert:

- no false positives on acyclic graphs (every random DAG produces 0
  `dep-cycle` diagnostics).
- every injected cycle is detected.
- `.withInputs(...)` chain merge is associative — chaining `a.withInputs(x)`
  then `.withInputs(y)` yields the same effective inputs as a single
  `.withInputs({...x, ...y})` call.
- rewriter determinism: `printFile(rewrite(src)) === printFile(rewrite(src))`.

### Step 6 — `packages/compiler/src/analysis/extractDependencyGraph.golden.test.ts` (create)

Three reference scripts (under
`packages/compiler/src/__fixtures__/dep-graph/`):

- `single-private-dep.chart.ts` — base + consumer with one
  `.output("line")`.
- `multi-export.chart.ts` — private dep + named export + default
  export.
- `diamond.chart.ts` — two consumers point at one private dep.

Each fixture compiles to a pinned JSON snapshot in
`packages/compiler/src/__fixtures__/golden/`. Snapshots omit
`defineCall` (non-serialisable) and pin the structural shape only.

### Step 7 — `packages/compiler/src/transformers/rewriteDependencyAccessors.ts` (create)

7.1. MIT header.

7.2. Exported function:

```ts
export type RewriteDependencyAccessorsResult = Readonly<{
    transformed: ts.SourceFile;
    diagnostics: ReadonlyArray<CompileDiagnostic>;
}>;

export function rewriteDependencyAccessors(
    sourceFile: ts.SourceFile,
    depGraph: DepGraph,
    sourcePath: string,
): RewriteDependencyAccessorsResult;
```

7.3. Build a map from `bindingName` → `localId` derived from the
graph's `drawn` + `privateDeps` entries. The `localId` is the binding
name itself (same identity).

7.4. The transformer factory:

- Match every `CallExpression` whose callee is a
  `PropertyAccessExpression` with `.name.text === "output"`.
- Resolve the receiver via the same logic as Sweep C — back to a
  known binding name from the depGraph map.
- If matched: compute the slot id (`<sourcePath>:<line>:<col>#0` from
  the call's start position), then replace the call with
  `ts.factory.createCallExpression(ts.factory.createIdentifier("__chartlang_depOutput"), undefined, [stringLit(slotId), stringLit(localId), stringLit(title)])`.

7.5. Match every `.withInputs(...)` chain in private-dep binding
initialisers — strip it (return the chained receiver only). Drawn
bindings keep their RHS intact.

Actually — closer reading: `.withInputs(...)` strip is a *Task 3*
bundler concern (per spec line 199-202: "the effective inputs are
baked into the bundle's emitted dep manifest by Task 3, not invoked
at runtime"). **Decision:** Task 2's rewriter only handles
`.output(...)` rewrites. The `withInputs` strip lands in Task 3
alongside the bundle's dep-source inlining. Task 2's rewriter is
narrower and safer.

7.6. Return `{ transformed, diagnostics: [] }` — the rewriter raises
no new diagnostics. All validation lives in `extractDependencyGraph`.

### Step 8 — `packages/compiler/src/transformers/rewriteDependencyAccessors.test.ts` (create)

Snapshot the transformer's output against a hand-written expected
source string per fixture. Cover:

- Single `.output("line")` call site → synthesised
  `__chartlang_depOutput(...)` call.
- Multiple call sites on the same binding share localId, different
  slot ids.
- Cross-binding reads (consumer A reads dep B, consumer C reads dep
  B) get the same localId.
- Determinism: same input → same output across runs.

### Step 9 — `packages/compiler/src/analysis/forbiddenConstructs.ts` (modify)

9.1. Add `"__chartlang_depOutput"` to `HOSTILE_GLOBAL_NAMES`.

### Step 10 — `packages/compiler/src/analysis/forbiddenConstructs.test.ts` (modify)

10.1. Add one test asserting user-written
`__chartlang_depOutput("foo", "bar", "baz")` produces a
`hostile-global` diagnostic.

### Step 11 — `packages/compiler/src/analysis/index.ts` (modify)

11.1. Re-export `extractDependencyGraph` + all the new types.

### Step 12 — `packages/compiler/src/transformers/index.ts` (modify)

12.1. Re-export `rewriteDependencyAccessors` + result type.

### Step 13 — `packages/compiler/src/api.ts` (modify)

13.1. After the early-diagnostic gate (semantic + structural +
forbidden + statefulInLoop), run
`extractDependencyGraph(sourceFile, checker, sourcePath,
structural.bindings, /* resolveProducer: */ () => null)`.

13.2. Pipe `extractDependencyGraph`'s diagnostics into
`allDiagnostics`. If any are error-severity, the existing
`hasError` check at line 124 must include them too — restructure
so the early-error short-circuit also accounts for the new pass's
output.

13.3. **Decision:** Move the dep-graph extraction BEFORE the early
short-circuit so its errors flow through the same error path. The
`structural.bindings` field is always populated (the existing
structural pass produces bindings even on error paths).

Actually — cleaner: keep the dep-graph extraction **after** the
early gate, but include its errors in a second short-circuit just
before bundler-bound code runs. The single-script back-compat
path (no `.output(...)` calls anywhere) returns 0 diagnostics so the
short-circuit never fires.

13.4. Run `rewriteDependencyAccessors` after `extractDependencyGraph`
and **before** `injectCallsiteIds`. The injection pass then sees the
new `__chartlang_depOutput` callsite and gets to assign its own slot
id (although `__chartlang_depOutput` isn't a stateful primitive, so
in practice the injection pass walks past it harmlessly).

Wait — the task spec line 209-211 says the rewriter "runs **before**
`injectCallsiteIds` so the synthesised `__chartlang_depOutput` call
site gets its own callsite slot id from the existing injection pass."
But the injection pass only adds slot ids to **stateful primitives**.
`__chartlang_depOutput` is not in `STATEFUL_PRIMITIVES`. The rewriter
itself bakes the slot id directly into the synthesised call as its
first string argument — that's the slot id the runtime uses to key
the per-bar dep output buffer. So "before `injectCallsiteIds`" is
correct ordering but for a different reason: it ensures the slot
ids in synthesised calls are read from the **original** source
positions, not from post-injection positions. Order: dep-rewrite →
callsite-id injection.

13.5. Manifest assembly: when `depGraph.drawn.length > 0` or
`depGraph.privateDeps.length > 0`, attach `dependencies` (the default
binding's consumes, mapped to `DependencyDeclaration[]`) and
`outputs` (the default binding's outputs) to the manifest. Same-file
deps use `producerSourcePath: sourcePath`; cross-file deps use
their resolved path (in Task 2 these are always `null` since the
resolveProducer stub returns null — those edges get a diagnostic
but the manifest only includes successfully-resolved deps).

13.6. Add helper `buildDependencyDeclarations(drawnDefault, depGraph,
sourcePath, resolveProducer)` that converts the dep-graph entries
into `DependencyDeclaration[]` for the manifest. Inline as a small
function inside `api.ts` (the conversion is api-specific glue).

13.7. `manifest`'s back-compat: single-script files (no
`<binding>.output(...)` calls, no extra named/private bindings) get a
manifest with neither `dependencies` nor `outputs` — byte-identical
to today.

### Step 14 — `packages/compiler/src/api.test.ts` (modify)

14.1. Add positive tests:

- A two-binding file (private dep + default consumer) produces a
  manifest with `dependencies` carrying one entry and the default
  binding's `outputs` reflecting its `plot(value, { title })` calls.
- A single-script file's manifest stays byte-identical (no
  `dependencies` / `outputs` keys present).
- A file with a `dep-unknown-output` raises the error via the new
  early-error gate.

### Step 15 — `packages/compiler/src/analysis/structuralChecks.test.ts` (modify)

15.1. Add tests:

- Single default + zero named/private: existing behaviour.
- Default + one named + one private: 0 diagnostics, 3 bindings.
- Default + named, no private: 0 diagnostics, 2 bindings.
- Zero default + one named: `missing-default-export` (because the
  default-export slot is still empty).
- Two defaults: `multiple-default-exports` (one diagnostic).
- `let X = defineIndicator(...)`: `non-const-define-binding`.

### Step 16 — Fixture sources

16.1. Create three new fixture files:

- `packages/compiler/src/__fixtures__/dep-graph/single-private-dep.chart.ts`
- `packages/compiler/src/__fixtures__/dep-graph/multi-export.chart.ts`
- `packages/compiler/src/__fixtures__/dep-graph/diamond.chart.ts`

16.2. Create three golden snapshot files:

- `packages/compiler/src/__fixtures__/golden/single-private-dep.json`
- `packages/compiler/src/__fixtures__/golden/multi-export.json`
- `packages/compiler/src/__fixtures__/golden/diamond.json`

Each pins the JSON-serialisable subset of the `DepGraph`.

16.3. Add a `MULTI_EXPORT_COMPOSITION` constant to
`packages/compiler/src/__fixtures__/scripts.ts` for the bench case
in Step 17.

### Step 17 — `packages/compiler/src/compile.bench.ts` (modify)

17.1. Add a second `bench` block driving `MULTI_EXPORT_COMPOSITION`
through `compile`. Per the existing convention, no `THRESHOLD_MS` is
literally pinned in the bench file itself; the `pnpm bench:ci` gate
reads the timings and enforces the `ceil(median × 3)` heuristic
across the suite.

### Step 18 — Changeset

18.1. Create `.changeset/indicator-composition-2-analysis.md`:

```md
---
"@invinite-org/chartlang-compiler": minor
---

Add `extractDependencyGraph` analysis pass and
`rewriteDependencyAccessors` transformer for indicator composition.
Six new `dep-*` compile diagnostics plus three structural diagnostics
(`multiple-default-exports`, `non-const-define-binding`,
`duplicate-output-title`). Multi-binding `defineIndicator` per file
now accepted; single-file behaviour unchanged.
```

## Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `packages/compiler/src/diagnostics.ts` | modify | Append 9 new `CompileDiagnosticCode` entries. |
| `packages/compiler/src/analysis/structuralChecks.ts` | modify | Track multi-binding `defineIndicator`s; emit `multiple-default-exports` / `non-const-define-binding`; extend `StructuralCheckResult.bindings`. |
| `packages/compiler/src/analysis/structuralChecks.test.ts` | modify | Multi-binding test cases. |
| `packages/compiler/src/analysis/extractDependencyGraph.ts` | **create** | Four-sweep graph builder + cycle detection. |
| `packages/compiler/src/analysis/extractDependencyGraph.test.ts` | **create** | Unit cases (12 scenarios). |
| `packages/compiler/src/analysis/extractDependencyGraph.property.test.ts` | **create** | `fast-check` property test (pinned seed). |
| `packages/compiler/src/analysis/extractDependencyGraph.golden.test.ts` | **create** | Three golden snapshots. |
| `packages/compiler/src/__fixtures__/dep-graph/single-private-dep.chart.ts` | **create** | Reference script. |
| `packages/compiler/src/__fixtures__/dep-graph/multi-export.chart.ts` | **create** | Reference script. |
| `packages/compiler/src/__fixtures__/dep-graph/diamond.chart.ts` | **create** | Reference script. |
| `packages/compiler/src/__fixtures__/golden/single-private-dep.json` | **create** | Pinned snapshot. |
| `packages/compiler/src/__fixtures__/golden/multi-export.json` | **create** | Pinned snapshot. |
| `packages/compiler/src/__fixtures__/golden/diamond.json` | **create** | Pinned snapshot. |
| `packages/compiler/src/__fixtures__/scripts.ts` | modify | Add `MULTI_EXPORT_COMPOSITION` for the bench. |
| `packages/compiler/src/analysis/index.ts` | modify | Re-export new pass + types. |
| `packages/compiler/src/transformers/rewriteDependencyAccessors.ts` | **create** | AST rewriter. |
| `packages/compiler/src/transformers/rewriteDependencyAccessors.test.ts` | **create** | Rewrite snapshots + determinism check. |
| `packages/compiler/src/transformers/index.ts` | modify | Re-export rewriter + result type. |
| `packages/compiler/src/analysis/forbiddenConstructs.ts` | modify | Forbid `__chartlang_depOutput`. |
| `packages/compiler/src/analysis/forbiddenConstructs.test.ts` | modify | Test user-written reference fires `hostile-global`. |
| `packages/compiler/src/api.ts` | modify | Integrate new pass + rewriter; manifest gains `dependencies` + `outputs`. |
| `packages/compiler/src/api.test.ts` | modify | Multi-binding integration test. |
| `packages/compiler/src/compile.bench.ts` | modify | Bench case for multi-export source. |
| `.changeset/indicator-composition-2-analysis.md` | **create** | Compiler minor bump. |

## Gates

- `pnpm typecheck` — every new export carries explicit types; no `any`.
- `pnpm lint` — MIT header on every new `.ts`; `useImportType` for
  type-only imports.
- `pnpm test` — 100% coverage on every new file (matches the existing
  compiler coverage gate). Single-script back-compat is verified by
  the existing `compileFile.test.ts` + `examples/scripts/*.chart.ts`
  snapshots.
- `pnpm docs:check` — every new export has `@example`, `@since 0.7`,
  `@stable` (`@experimental` is reserved for in-flight ports).
- `pnpm readme:check` — no README touched in this task; root unchanged.
- `pnpm conformance` — unchanged (no scenarios added in this task);
  must still pass.
- `pnpm bench:ci` — new bench case lands; threshold logic auto-pins.
- `STATEFUL_PRIMITIVES.size === 172` — unchanged.

## Changeset

- File: `.changeset/indicator-composition-2-analysis.md`
- Bump: `@invinite-org/chartlang-compiler` **minor**.
- Body: see Step 18 above.

## Acceptance Criteria

- [x] `extractDependencyGraph` handles 12 unit cases above and yields
      a stable JSON-serialisable `DepGraph` for each fixture.
- [x] Property test (pinned `fast-check` seed) pins acyclic +
      cycle-detection over generated graphs.
- [x] Golden snapshots match the three reference scripts.
- [x] `rewriteDependencyAccessors` produces byte-identical AST output
      across re-runs.
- [x] Cycle detection works for A→B→A and A→B→C→A — both raise
      `dep-cycle` at every node in the SCC with the cycle path in
      the message.
- [x] Input-override validation catches unknown keys and type
      mismatches; valid overrides merge in declaration order.
- [x] `dep-output-not-titled` raised at the consumer's call site only
      when a producer's untitled plot is actually consumed.
- [x] Existing single-script `.chart.ts` files compile through
      unchanged — manifest carries no `dependencies` / `outputs` /
      `exportName` / `siblings`.
- [x] `STATEFUL_PRIMITIVES.size === 172` still asserted.
- [x] 100% coverage on every new file.
- [x] Bench case for multi-export source lands.
- [x] Changeset committed (file in working tree, awaiting commit).

## Validation Status (2026-06-11)

Cross-checked the plan against the working tree (uncommitted) on
2026-06-11. Every Step is materialised in source:

- `packages/compiler/src/diagnostics.ts` — 28 `CompileDiagnosticCode`
  entries; the 9 new codes are present and JSDoc was updated.
- `packages/compiler/src/analysis/structuralChecks.ts` —
  `StructuralBindingInfo` + `bindings` field on `StructuralCheckResult`
  present; `multiple-default-exports` + `non-const-define-binding`
  diagnostics implemented.
- `packages/compiler/src/analysis/extractDependencyGraph.ts` — full
  four-sweep implementation + colour-marking iterative DFS cycle finder
  (per Issue #7 in this plan). One naming nuance: the file calls the
  sweep ordering "Sweep D first" (outputs ahead of B/C) because B/C
  depend on Sweep D's per-binding outputs — matches the implementation
  comments and is consistent with the task spec's behavioural intent.
- `packages/compiler/src/transformers/rewriteDependencyAccessors.ts` —
  rewrites `<binding>.output("title")` calls only; `.withInputs(...)`
  strip stays deferred to Task 3 per Step 7.5 of this plan.
- `packages/compiler/src/api.ts` — pass + rewriter integrated; the
  `defaultDrawn` lookup is a hard-coded assumption that the structural
  pass produces a default-export binding by this point (errors
  short-circuit earlier).
- `packages/compiler/src/__fixtures__/dep-graph/` — three fixture
  scripts present (`single-private-dep`, `multi-export`, `diamond`)
  matching Step 16's design.
- `packages/compiler/src/__fixtures__/golden/` — three JSON snapshots
  present, pinning `drawn` + `privateDeps` + `diagnostics`.
- `.changeset/indicator-composition-2-analysis.md` — present, scoped
  to `@invinite-org/chartlang-compiler` minor.

Gate runs:

- `pnpm --filter @invinite-org/chartlang-compiler test`: **309 tests
  pass**, 100% statements / branches / functions / lines on every
  file under `src/`, including the two new ones (per the v8 coverage
  table in the test run).
- `pnpm typecheck`: **clean** across all 12 workspace projects.
- `pnpm lint`: 2 pre-existing errors in Task 1 files
  (`packages/core/src/define/depAccessorSentinel.ts:27:9` —
  `useTemplate` and `packages/core/src/types.types.test.ts:7:8` —
  `useImportType`). Both belong to the 1-core-types task scope, NOT
  Task 2. Task 2's new files (`extractDependencyGraph.ts`,
  `rewriteDependencyAccessors.ts`, fixtures, test files, changeset)
  lint cleanly.

### Follow-up — outside this plan's scope

- **Task 1 lint fixes** — the two errors above should be fixed in
  the 1-core-types task scope (or rolled into a follow-up commit).
  Captured in [[project_indicator_composition_status]] (a memory
  entry may be worth landing if these slip).
- **Manifest-`exportName` / `siblings` on named exports** — Task 2
  intentionally attaches `dependencies` + `outputs` only to the
  **default** binding's manifest (per Step 13.5 + Issue #10 in this
  plan). Named-export per-binding manifests with their own
  `exportName` / `siblings` ride on Task 3's bundler when it carves
  the file into separate emitted ESM modules.
- **`docs:check`, `readme:check`, `conformance`, `bench:ci`** — not
  yet run inside this audit. Task 2 lands no doc / README / scenario
  changes (per the gate notes above), so these are pre-existing
  gates the working tree must still satisfy at commit time.
