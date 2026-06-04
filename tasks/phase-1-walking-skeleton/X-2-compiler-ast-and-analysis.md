# Task 2 — Compiler: AST Transformer, Static Analysis, Manifest Extraction

> **Status: TODO**

## Goal

Land the load-bearing first half of `@invinite-org/chartlang-compiler`:
the TypeScript-program construction, the AST transformer that injects
callsite ids per §5.5, the static-analysis pass that rejects forbidden
constructs, and the manifest extractor that derives
`capabilities` + `seriesCapacities` + `maxLookback` from the script
source. Bundling (esbuild) and the public `compile` / `compileFile`
/ `compileProject` API land in Task 3 — this task ships everything
that operates on the TS AST.

## Prerequisites

- Task 1 complete: `@invinite-org/chartlang-core` ships the
  `STATEFUL_PRIMITIVES` registry and the typed surface (`ta`,
  `plot`, `hline`, `alert`) the compiler matches against.

## Desired Behavior

After this task, given a `.chart.ts` source string and a TypeScript
program built against the core types:

- The transformer walks every `CallExpression`, resolves the callee
  through the type checker, and — for any callee whose
  fully-qualified name is in `STATEFUL_PRIMITIVES` — rewrites the
  call to inject a `__slot` string literal as the **first**
  argument, with format `<path>:<line>:<col>#<callIndex>`.
- The static-analysis pass rejects every forbidden construct from
  §4.2 / §5.2 / §5.5 with a stable diagnostic code and the input
  AST's original position.
- The manifest extractor produces a `ScriptManifest` object whose
  `capabilities` reflect the primitive surfaces actually used,
  `seriesCapacities` reflects the largest literal `N` in any
  `series[N]` read, and `userPickableInterval` is `false` for
  Phase 1 (no `input.interval` exists yet).
- 100% coverage on every analysis branch. Every diagnostic code has
  a negative test asserting the compiler rejects the offending shape.

The output of this task is a callable `transformAndAnalyse(source,
opts) → { transformed: ts.SourceFile, manifest: ScriptManifest,
diagnostics: CompileDiagnostic[] }` function. Task 3 wraps it in
the bundler and the public `compile` API.

## Requirements

### 1. TypeScript program construction

```ts
// packages/compiler/src/program.ts
export function createProgramForSource(
    source: string,
    opts: { sourcePath: string; coreLibPath: string },
): { program: ts.Program; sourceFile: ts.SourceFile; checker: ts.TypeChecker };
```

- Use `ts.createCompilerHost` overrides so the synthetic source file
  resolves against the on-disk `@invinite-org/chartlang-core` types
  (`coreLibPath` defaults to the workspace package path resolved
  via `require.resolve`).
- Compiler options match `tsconfig.base.json` exactly:
  `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`,
  `strict: true`, `noEmit: true` (the transformer runs separately
  via `ts.transform`). `lib: ["ES2022"]` — **no DOM**. Scripts run
  in a sandbox without browser globals.
- `sourcePath` is the user-relative POSIX path used in callsite ids
  (e.g. `examples/scripts/ema-cross.chart.ts`).

### 2. Callsite-id transformer (`src/transformers/callsiteIdInjection.ts`)

Per §5.5:

- ID format: `<package-relative-source-path>:<line>:<column>#<callIndex>`
- Path: POSIX-normalised; no leading `./`. Use the
  `sourcePath` passed to the program builder.
- Line / column: 1-based, read via
  `sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))`
  and converted to 1-based.
- `callIndex`: always `0` for hand-written code; non-zero is
  reserved for future macro expansion. Phase 1 hardcodes `0`. The
  format string is `${path}:${line}:${col}#${callIndex}`.

Algorithm:

```ts
function injectIds(
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker,
    sourcePath: string,
    statefulSet: ReadonlySet<string>,
): ts.SourceFile {
    const factory = factoryFor(checker, sourcePath, statefulSet);
    const result = ts.transform(sourceFile, [factory]);
    const transformed = result.transformed[0];
    result.dispose();
    return transformed;
}
```

`ts.transform` provides its own `TransformationContext` to each
factory — do not reach for `ts.nullTransformationContext` (it's a
private TS API that isn't part of the public typings under
`verbatimModuleSyntax`).

Inside the visitor, for every `ts.CallExpression`:

1. Resolve the fully-qualified call name via the checker:
   `resolveCalleeName(node, checker)` returns strings like `"ta.ema"`,
   `"plot"`, `"alert"`. The resolver:
   - For `node.expression` of kind `PropertyAccessExpression`
     (`ta.ema`), returns `"<obj>.<prop>"`.
   - For `node.expression` of kind `Identifier` (`plot`), returns
     the symbol's name **only if** the resolved symbol's declaration
     comes from `@invinite-org/chartlang-core`. Otherwise returns
     `null`.
   - For everything else (computed access, optional chaining,
     element access), returns `null`.
   - Resolution uses `checker.getResolvedSignature(node)` +
     `checker.getSymbolAtLocation(...)` to walk through aliases.
2. If the name is in `statefulSet`, build the slot id and inject it
   as the **first** argument:

```ts
const slotId = `${sourcePath}:${line}:${col}#0`;
const newArgs = ts.factory.createNodeArray([
    ts.factory.createStringLiteral(slotId),
    ...node.arguments,
]);
return ts.factory.updateCallExpression(
    node, node.expression, node.typeArguments, newArgs,
);
```

3. Recurse into children regardless of whether this node was
   rewritten (a `ta.ema` call may itself contain `bar.close[N]`
   reads that need other passes).

The transformer **must not** mutate the input AST. Always return
new nodes via `ts.factory.*`.

### 3. Determinism guarantees (§5.5 / §16.7)

- Slot id strings are pure string literals (no template strings, no
  symbol references). esbuild's minifier preserves them
  byte-for-byte.
- Compiling the same source twice yields byte-identical transformed
  output. Pin with a determinism unit test: `transform(src,
  opts) === transform(src, opts)` (string compare on the printed
  result).
- Line / column come from the **input** SourceFile, not from any
  intermediate AST — `node.getStart(sourceFile)` against the
  original `sourceFile`. The transformer never reads positions off
  rewritten nodes.

### 4. Static-analysis pass (`src/analysis/`)

One module per concern. Each module exports a `(sourceFile,
checker) → CompileDiagnostic[]` function. The driver runs them in
order and concatenates results.

#### 4.1 `forbiddenConstructs.ts`

Rejects:

| Construct | Diagnostic code |
|---|---|
| `while` statement | `unbounded-loop` |
| `do … while` statement | `unbounded-loop` |
| `for` with non-numeric-literal bound (e.g. `for (let i=0; i<N; ...)` where `N` is not a literal `NumericLiteral`) | `unbounded-loop` |
| Self-recursive function (function calling itself by name) | `recursion-not-allowed` |
| Reference to `Math.random` | `hostile-global` |
| Reference to `Date` (any property) | `hostile-global` |
| Reference to `fetch`, `setTimeout`, `setInterval`, `queueMicrotask`, `Promise`, `requestAnimationFrame` | `hostile-global` |
| `require(...)` call | `hostile-global` |
| Dynamic `import(...)` expression | `hostile-global` |
| `eval(...)` call | `hostile-global` |
| `new Function(...)` | `hostile-global` |

Detection: walk the AST, match by `ts.SyntaxKind` and the symbol's
resolved name. For globals (`Math.random`), use the checker — match
the resolved symbol against the lib.es2022.d.ts `Math` symbol; an
unresolved `Math` identifier from the script's own scope is fine.

For `for`-loop bound enforcement, accept:
- `for (let i = <lit>; i < <lit>; i++)` where both bounds are
  `NumericLiteral`.
- `for...of` over a `ReadonlyArray` whose length is statically a
  literal.
Reject everything else.

#### 4.2 `statefulCallInLoop.ts`

After (or piggybacked on) the callsite-id transformer pass, walk
the AST again. For every `CallExpression` whose resolved name is in
`STATEFUL_PRIMITIVES`, walk up through `node.parent` ancestors. If
any ancestor is a `ForStatement` / `ForOfStatement` /
`ForInStatement` / `WhileStatement` / `DoStatement`, emit
diagnostic `stateful-call-inside-loop` (§5.5).

#### 4.3 `extractCapabilities.ts`

For Phase 1, the only `CapabilityId` derivable from script source
is `"indicators"` (every Phase-1 script is a `defineIndicator`).
`alerts` is added iff the script's AST contains any `alert(...)`
call **whose resolved symbol comes from `@invinite-org/chartlang-core`**
— this avoids false positives from arbitrary identifiers named
`alert` (e.g. `bar.alert`, a user-shadowed local). Resolve via
`checker.getSymbolAtLocation` and walk through aliases to the
declaration's source file. `drawings` stays out (no draw.* in
Phase 1). Return the array deduplicated and sorted (deterministic
output).

#### 4.4 `extractMaxLookback.ts`

Walks the AST for `ElementAccessExpression` nodes where the
argument is a `NumericLiteral` and the base resolves to a
`Series<T>` (or `bar.<source>` which the runtime exposes as a
series). For Phase 1, treat any `bar.<field>[N]`,
`ta.X(...)[N]`, or `<series-var>[N]` as a series read. Track the
max literal `N` across all reads. Emit it as `manifest.maxLookback`.

Non-literal indices (`bar.close[i]`) trigger
`dynamic-series-index` diagnostic (severity: warning, not error)
and contribute `5000` to `seriesCapacities.dynamicFallback`
(§6.6). Phase 1's example scripts never hit this path; the
warning + fallback is shipped so Task 5's runtime can size its
ring buffers safely.

#### 4.5 `extractInputs.ts`

For Phase 1, `input.*` builders are not in core's surface. The
extractor returns an empty `InputSchema` and sets
`userPickableInterval: false`. The file ships so Phase 4's
`input.*` work has a hook to extend.

### 5. Manifest assembly (`src/manifest.ts`)

```ts
export function buildManifest(args: {
    name: string;                  // from the defineIndicator/Alert call
    kind: "indicator" | "drawing" | "alert";
    capabilities: ReadonlyArray<CapabilityId>;
    requestedIntervals: ReadonlyArray<string>;  // empty in Phase 1
    userPickableInterval: boolean;              // false in Phase 1
    seriesCapacities: Readonly<Record<string, number>>;
    maxLookback: number;
}): ScriptManifest;
```

The driver collects each pass's contribution and calls
`buildManifest`. Output uses `Object.freeze` recursively so the
runtime can structurally clone it without worrying about
mutation.

### 6. Diagnostic format (`src/diagnostics.ts`)

```ts
export type CompileDiagnosticCode =
    | "unbounded-loop"
    | "recursion-not-allowed"
    | "hostile-global"
    | "stateful-call-inside-loop"
    | "request-security-interval-not-literal"  // reserved; never emitted in Phase 1
    | "dynamic-series-index"
    | "callsite-id-conflict"                   // duplicate ids at same source position
    | "missing-default-export"                 // script must default-export defineIndicator(...)
    | "api-version-mismatch";                  // defineIndicator({ apiVersion }) ≠ 1

export type CompileDiagnostic = {
    readonly severity: "error" | "warning";
    readonly code: CompileDiagnosticCode;
    readonly message: string;
    readonly file: string;
    readonly line: number;       // 1-based
    readonly column: number;     // 1-based
    readonly nodeText?: string;  // short snippet for error messages
};
```

Errors abort `compile`; warnings flow through to the caller for
display.

`api-version-mismatch` and `missing-default-export` are checked by
walking the top-level statements of the source file:
- Find the `ExportAssignment` (default export). If none →
  `missing-default-export`.
- Its expression must be a `CallExpression` to `defineIndicator` or
  `defineAlert` (resolved via the checker). If not →
  `missing-default-export`.
- Inspect the object-literal first argument for an `apiVersion`
  property. If absent or `!== 1` → `api-version-mismatch`.

`callsite-id-conflict` triggers if two stateful calls share the
exact `(path, line, col)` tuple. Shouldn't happen in hand-written
code; the check exists so a future macro that expands to two
stateful calls at one position is rejected loudly rather than
silently corrupting slot state.

### 7. Driver function

```ts
// packages/compiler/src/api.ts (Task 3 fills the rest)
export function transformAndAnalyse(
    source: string,
    opts: { sourcePath: string; coreLibPath?: string },
): {
    transformed: ts.SourceFile;
    manifest: ScriptManifest;
    diagnostics: ReadonlyArray<CompileDiagnostic>;
};
```

Internal flow:

1. `createProgramForSource(source, opts)`.
2. Run all error-severity analysis passes; if any returns errors,
   bail early with `{ transformed: sourceFile (unchanged), manifest:
   placeholder, diagnostics }`.
3. Run callsite-id transformer.
4. Run `statefulCallInLoop` against the **transformed** source so
   we can identify stateful calls by their `__slot` first
   argument (or, equivalently, re-resolve callee names against
   the original mapping kept in a side table).
5. Run capability / lookback / input extractors.
6. Build manifest. Return.

### 8. Dependencies

Add to `packages/compiler/package.json`:

```jsonc
{
    "dependencies": {
        "typescript": "^5.6.0",
        "@invinite-org/chartlang-core": "workspace:*"
    }
}
```

(`esbuild` lands in Task 3.) `typescript` is moved from a root
devDependency reference to an explicit compiler dependency so
consumers depending on the compiler package pull it transitively.

### 9. Tests (§16.3 row: unit + property AST round-trip + bench + type)

- **Unit (per analysis module):** one positive fixture + one
  negative fixture per diagnostic code. ~12 small `.chart.ts`
  strings inline as constants — no on-disk fixtures yet.
- **Callsite-id transformer:**
  - Asserts a `ta.ema(close, 20)` call rewrites to
    `ta.ema("<path>:<line>:<col>#0", close, 20)`.
  - Asserts every primitive in `STATEFUL_PRIMITIVES` is rewritten.
  - Asserts a non-stateful call (e.g. `Math.abs(x)` rejected
    elsewhere, but `Number.isFinite(x)` allowed) is **not**
    rewritten.
  - Property test (§16.3): generate N synthetic stateful calls at
    random positions; assert each gets a unique slot id matching
    `(line, col)`.
- **Determinism test:** compile the same source twice; printed
  output must be byte-identical (using `ts.createPrinter`).
- **Manifest extraction:**
  - `capabilities` is `["indicators"]` for an EMA-cross script
    that doesn't call `alert`.
  - `capabilities` is `["alerts", "indicators"]` (sorted) for the
    same script with one `alert(...)` call.
  - `maxLookback` is the largest literal in any `series[N]` read.
- **Bench (§16.3):** one `transform.bench.test.ts` measuring
  median transformation time over the EMA-cross example.
- **Type tests (`.types.test.ts`):** `transformAndAnalyse` return
  type assertions via `expect-type`.

100% coverage per §16.1 across every analysis branch — every
diagnostic code has a positive AND a negative test.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/compiler/package.json` | Modify | Add `typescript` + `@invinite-org/chartlang-core` workspace dep. |
| `packages/compiler/src/program.ts` | Create | TS program builder. |
| `packages/compiler/src/transformers/callsiteIdInjection.ts` | Create | §5.5 transformer. |
| `packages/compiler/src/transformers/index.ts` | Create | Barrel. |
| `packages/compiler/src/analysis/forbiddenConstructs.ts` | Create | Reject unbounded loops + hostile globals. |
| `packages/compiler/src/analysis/statefulCallInLoop.ts` | Create | §5.5 loop check. |
| `packages/compiler/src/analysis/extractCapabilities.ts` | Create | Derive `CapabilityId[]`. |
| `packages/compiler/src/analysis/extractMaxLookback.ts` | Create | §6.6 series capacity inference. |
| `packages/compiler/src/analysis/extractInputs.ts` | Create | Phase-1 stub returning empty schema. |
| `packages/compiler/src/analysis/index.ts` | Create | Barrel. |
| `packages/compiler/src/manifest.ts` | Create | `buildManifest` assembly. |
| `packages/compiler/src/diagnostics.ts` | Create | `CompileDiagnostic` shape + codes. |
| `packages/compiler/src/api.ts` | Create | `transformAndAnalyse` driver. |
| `packages/compiler/src/index.ts` | Modify | Export `transformAndAnalyse` + diagnostic types (replace `PACKAGE_VERSION`). |
| `packages/compiler/src/index.test.ts` | Delete | Replaced by per-module tests. |
| `packages/compiler/src/*/*.test.ts` | Create | Per-module unit + property tests. |
| `packages/compiler/src/transform.bench.test.ts` | Create | §16.3 bench coverage. |
| `packages/compiler/src/api.types.test.ts` | Create | `expect-type` assertions on the public driver type. |
| `packages/compiler/README.md` | Modify | Replace planned-surface text with `transformAndAnalyse` example. |

## Acceptance Criteria

- `pnpm -F @invinite-org/chartlang-compiler typecheck && pnpm -F
  @invinite-org/chartlang-compiler test` pass with 100% coverage.
- `pnpm -F @invinite-org/chartlang-compiler bench` reports a median
  transform time and a `THRESHOLD_MS` ≈ `ceil(median × 3)`.
- A 12-line EMA-cross script (matching the §4.1 example) flows
  through `transformAndAnalyse` and produces:
  - 4 callsite ids (one each for `ta.ema`, `ta.crossover`, `plot`,
    `alert`).
  - `manifest.capabilities` = `["alerts", "indicators"]`.
  - `manifest.maxLookback` = `0` (no `series[N]` reads in the
    EMA-cross example).
  - Zero error-severity diagnostics.
- Every forbidden construct in §4.2 has a test asserting the
  expected diagnostic code and source position.
- Compiling the EMA-cross example twice yields the exact same
  printed `ts.SourceFile` source string.
- `pnpm docs:check && pnpm readme:check && pnpm lint && pnpm
  format:check` all pass.
- Phase-0 gates (`pnpm conformance`, `pnpm coverage:report`)
  continue to pass on the whole workspace.
