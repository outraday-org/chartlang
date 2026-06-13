# Task 3 — Compiler multi-export bundling + dep inlining + `.d.ts`

> **Status: DONE**

## Goal

Extend the compiler's bundler so a single `.chart.ts` source emits
one ESM module that:

- exports the file's default `defineIndicator(...)` result,
- exports every named `defineIndicator(...)` result,
- holds every private dep as a module-local const,
- inlines every cross-file dep (`import X from "./Y.chart"`)
  recursively, with cycle prevention.

Also widen the manifest sidecar format so a multi-script file emits
an array, the `.d.ts` sidecar declares the typed `output` /
`withInputs` accessors, and the recursive cross-file producer
resolution is wired into Task 2's `resolveProducer` callback.

## Prerequisites

Task 1 (core types) — manifest fields + `CompiledScriptBundle`.
Task 2 (analysis pass) — `extractDependencyGraph` +
`rewriteDependencyAccessors`. This task supplies the missing
`resolveProducer` callback the analysis pass declared as a
parameter.

## Current Behavior

- `bundleModule` in `packages/compiler/src/bundle.ts` runs esbuild
  over the printed (callsite-injected) source and returns one ESM
  string plus an optional sourcemap. Bare specifier
  `@invinite-org/chartlang-core` resolves via the compiler
  package's own `node_modules/`. No cross-file `.chart.ts`
  resolution.
- `formatManifestAssignment` appends `export const __manifest =
  <single-manifest-json>;` to the bundle.
- `compile` / `compileFile` / `compileProject` (all colocated in
  `packages/compiler/src/api.ts`) emit `<base>.chart.js` +
  `<base>.chart.manifest.json` + `<base>.chart.d.ts` (+ optional
  `<base>.chart.js.map`). Manifest sidecar is always one JSON object.
- esbuild config in `bundle.ts` sets `format: "esm"`,
  `target: "es2022"`, `bundle: true`, `treeShaking: true`,
  `platform: "neutral"`. It does NOT currently set
  `sourcesContent: true`; Task 3 adds it so the combined sourcemap
  carries every inlined producer source.
- `emitTypes` (in `typesEmit.ts`) writes a `.d.ts` declaring the
  bundle's `default` export as `CompiledScriptObject` with a
  narrow `inputs` schema. No named export declarations. No
  `output` / `withInputs` typing.

## Desired Behavior

- Cross-file `.chart.ts` imports are resolved by a recursive
  `resolveProducer(absPath, exportName)` walker. The walker
  compiles each producer via the same `transformAndAnalyse` +
  `bundleModule` pipeline, caches results by absolute path,
  detects import cycles (raises `dep-cycle`).
- `bundleModule` emits one ESM module per file with:
    - The default export carrying the primary drawn indicator.
    - One named export per `export const X = defineIndicator(...)`.
    - Private deps as module-local `const __dep_<localId> = ...`.
    - Cross-file producers inlined as `const __producer_<hash> = ...`
      blocks injected before the consumer's source. `hash` is a
      stable identifier derived from the producer's absolute path
      to keep the inlining idempotent and shareable across
      consumers in the same compile session.
- `formatManifestAssignment` emits **either** a single manifest
  (back-compat: file has one drawn indicator) **or** an array
  `[<default>, <named1>, <named2>, ...]`. The runtime branches on
  `Array.isArray(__manifest)`.
- `compileFile` writes `<base>.chart.manifest.json` as the same
  union shape — a single object or an array.
- `emitTypes` widens the `.d.ts` to:
    - Declare each drawn export with its own `CompiledScriptObject`
      shape, where `output` is overloaded with the actual output
      titles literal-union and `withInputs` is typed against the
      script's `inputs` schema.
    - For imported producers, the consumer file's `.d.ts` doesn't
      need to declare them (TypeScript already resolves
      `./base-trend.chart.d.ts`). The producer file's own `.d.ts`
      must already carry the typed shape — that's emitted by the
      producer's own compile pass.

## Requirements

### 1. Cross-file producer resolver

New file `packages/compiler/src/dependency/resolveProducer.ts`.

```ts
type ProducerCompiled = Readonly<{
    sourcePath: string;
    manifest: ScriptManifest; // primary drawn manifest
    drawnByExportName: ReadonlyMap<string, ScriptManifest>;
    moduleSource: string; // the inlined dep's printed JS
}>;

type ResolveProducer = (
    importPath: string,
    fromSourcePath: string,
) => Promise<ProducerCompiled | null>;

export function createProducerResolver(opts: {
    rootDir: string;
}): ResolveProducer;
```

Behaviour:

- Resolves `importPath` to an absolute filesystem path. Only
  `.chart.ts` files inside `opts.rootDir` (the consumer's package
  / repo) are valid producers. Anything outside → `null` (the
  caller treats as "not a chart import").
- Maintains an in-process LRU keyed by absolute path. Cache hits
  return the prior `ProducerCompiled` instance, preserving
  identity across consumers.
- Detects import cycles via an `inProgress` set guarded around
  each recursive compile. A cycle → returns `null` and surfaces a
  `dep-cycle` diagnostic on the original consumer's compile.
- On each cache miss: read the file, call the existing
  `transformAndAnalyse(source, { sourcePath, resolveProducer })`
  (passing self as the resolver — recursion!), capture the
  resulting `transformed` AST + `manifest` + diagnostics, run
  `bundleModule` to get the producer's ESM string. Return the
  triple.

### 2. `bundleModule` extension

In `packages/compiler/src/bundle.ts`:

- Accept new `bundleOpts.inlinedProducers: ReadonlyArray<{
    hash: string;
    moduleSource: string;
  }>` plus
  `bundleOpts.privateDeps: ReadonlyArray<{
    localId: string;
    transformedSource: string;
  }>` (the analyser-provided dep source already with callsite ids
  injected).
- Pre-emit a header block:

```ts
// Inlined cross-file producers (Task 3)
const __producer_<hash> = (() => {
    <producer's printed moduleSource minus the `export default`>
    return __exports;
})();

// Inlined same-file private deps (Task 3)
const __dep_<localId> = (() => {
    <private dep's printed body>
    return __exports;
})();
```

  These IIFE blocks expose the same surface as the standalone
  bundle's `export default` — but via a `__exports` local var, so
  the parent's source can read them without colliding on `export`
  statements.
- The runtime expects each block to expose `compute` +
  `manifest` + an `outputs` table (`Record<title, Series<number>>`)
  that the runtime populates during the dep's per-bar `plot()`
  calls. Task 4 wires the table; this task just lays the syntactic
  ground.
- The parent's source — already rewritten by Task 2's
  `rewriteDependencyAccessors` — references each dep via the
  synthesised `__chartlang_depOutput(slotId, localId, title)`
  helper, never via the dep's local binding directly. So the
  bundler just needs to make sure the helper symbol is in scope
  (imported from `@invinite-org/chartlang-runtime/internal`).

### 3. `formatManifestAssignment` extension

```ts
export function formatManifestAssignment(
    manifestOrArray: ScriptManifest | ReadonlyArray<ScriptManifest>,
): string {
    return `\nexport const __manifest = ${JSON.stringify(
        manifestOrArray,
        null,
        4,
    )};\n`;
}
```

- Single manifest → single object (back-compat).
- Array of manifests → JSON array. The first entry is the default
  export; subsequent entries are named exports in source order.
- Sidecar `.chart.manifest.json` written in `compileFile` mirrors
  the same union shape.

### 4. `emitTypes` extension

In `packages/compiler/src/typesEmit.ts`:

For each drawn binding, emit:

```ts
export const <bindingName>: CompiledScriptObject & {
    output<K extends "<title1>" | "<title2>">(name: K): Series<number>;
    withInputs(overrides: { length?: number /* etc */ }): typeof <bindingName>;
};
```

`<title1>` / `<title2>` come from the binding's
`OutputDeclaration[]`. The `withInputs` overrides type comes from
the binding's `inputs` schema (mapped through `InputDescriptor<T>`
→ `T`).

For the default export, emit the existing `export default`
shape with the same overload. For cross-file producers, no
declaration is needed in the consumer's `.d.ts` — TypeScript
resolves the producer's own emitted `.d.ts`.

### 5. `transformAndAnalyse` wiring

In `packages/compiler/src/api.ts`:

- `CompileOptions` gains an optional `resolveProducer` field. When
  omitted, the compiler defaults to a resolver that treats every
  `.chart.ts` import as `null` (Task 2's "no cross-file" stub).
  When provided (by `compile` / `compileFile` after Task 3 lands),
  the resolver enables cross-file dep resolution.
- `compile(source, opts)` builds a default resolver via
  `createProducerResolver({ rootDir: cwd })` if the caller doesn't
  supply one. `compileFile(path, opts)` builds the resolver with
  `rootDir: dirname(absolutePath)`.
- `compileProject(rootDir, opts)` builds a single shared resolver
  per project compile — cache identity across files is preserved.

### 6. `compileFile` artefact writes

- `<base>.chart.js` is the multi-export bundle from `bundleModule`.
- `<base>.chart.manifest.json` is the union JSON.
- `<base>.chart.d.ts` carries the per-export typed declarations.
- Sourcemap (when requested): one combined sourcemap covering the
  parent source + every inlined producer source. The esbuild call
  in `bundleModule` is extended with `sourcesContent: true` so
  every inlined producer's text is preserved in the map. The
  existing `sourcemap` option flag (`false | "inline" | "external"`)
  is unchanged.
- `writeAtomic` is reused unchanged.

### 7. Coverage on cross-file recursion

`compileProject.test.ts` extended with a 3-file diamond fixture
under `examples/scripts/` (Task 8 lands the real example; Task 3
uses a `packages/compiler/src/__fixtures__/cross-file-diamond/`
fixture):

```
base.chart.ts        — produces "line"
fast.chart.ts        — imports base, exports `fast = base.withInputs({len: 20})`
slow.chart.ts        — imports base, exports `slow = base.withInputs({len: 50})`
crossover.chart.ts   — imports fast + slow, default export consumes both
```

Assert: compiling `crossover.chart.ts` produces a single bundle
that inlines `base` exactly once (no duplicate inlining for fast
and slow sharing it).

### 8. Determinism

Both the inlined-producer header order and the named-export order
in the bundle must be **source-declaration order** (not
import-declaration order). Stable across re-compiles. Add a
property test that re-compiling the same source 10 times yields
byte-identical bundle output + sidecar manifest + `.d.ts`.

### 9. Test layers

`packages/compiler/` already runs unit + property + golden +
bench. Co-locate new tests:

- `bundle.test.ts` — multi-export, inlined-producer, sourcemap.
- `bundle.property.test.ts` — determinism over random fixtures.
- `bundle.golden.test.ts` — pin three reference bundles.
- `compileFile.test.ts` — multi-export sidecar shape (single
  manifest vs array).
- `compileProject.test.ts` — diamond cross-file fixture.
- `dependency/resolveProducer.test.ts` — cache identity, cycle
  detection, non-`.chart.ts` paths return `null`.
- `typesEmit.test.ts` — per-export typed `.d.ts` declarations.
- `compile.bench.ts` — bench multi-export + cross-file resolution.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/compiler/src/dependency/resolveProducer.ts` | create | Recursive cross-file resolver + LRU cache. |
| `packages/compiler/src/dependency/resolveProducer.test.ts` | create | Cache + cycle tests. |
| `packages/compiler/src/dependency/index.ts` | create | Barrel re-export. |
| `packages/compiler/src/bundle.ts` | modify | Accept `inlinedProducers` + `privateDeps`; emit IIFE blocks. Multi-export emission. |
| `packages/compiler/src/bundle.test.ts` | modify | New cases. |
| `packages/compiler/src/bundle.property.test.ts` | create | Determinism property. |
| `packages/compiler/src/bundle.golden.test.ts` | create | Golden bundle snapshots. |
| `packages/compiler/src/api.ts` | modify | Wire `resolveProducer` callback. `formatManifestAssignment` union shape. `compileFile` + `compileProject` live in this file. |
| `packages/compiler/src/api.test.ts` | modify | Multi-export integration. |
| `packages/compiler/src/compile.test.ts` | modify | Sidecar shape branch. |
| `packages/compiler/src/compileFile.test.ts` | modify | Sidecar JSON write shape (file exists; covers `compileFile` exported from `api.ts`). |
| `packages/compiler/src/compileProject.test.ts` | modify | Diamond fixture (file exists; covers `compileProject` exported from `api.ts`). |
| `packages/compiler/src/typesEmit.ts` | modify | Per-export typed `.d.ts`. |
| `packages/compiler/src/typesEmit.test.ts` | modify | Output-name + override typing. |
| `packages/compiler/src/compile.bench.ts` | modify | Multi-export + cross-file bench. |
| `packages/compiler/src/__fixtures__/cross-file-diamond/*.chart.ts` | create | 4-file diamond fixture. |
| `packages/compiler/src/__fixtures__/golden/bundle-*.js` | create | Pinned bundle snapshots. |

## Gates

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm docs:check`,
  `pnpm readme:check`, `pnpm conformance`, `pnpm bench:ci` — green.
- 100% coverage on touched compiler files.
- Bundle output determinism asserted via the property test.

## Changeset

- File: `.changeset/indicator-composition-3-bundling.md`
- Bump: **minor** for `@invinite-org/chartlang-compiler`.
- Reason: "Compiler bundles multi-export `.chart.ts` files into
  one ESM module, inlines cross-file `.chart.ts` deps recursively
  via `createProducerResolver`, and emits a union-shape manifest
  sidecar (single object or array) plus per-export `.d.ts`
  declarations for the `output` / `withInputs` accessors.
  Single-script files keep emitting byte-identical artefacts."

## Acceptance Criteria

- [ ] `bundleModule` emits one ESM module with multi-export +
      inlined producer + private-dep blocks; old single-script
      bundle output stays byte-identical when the file has
      one drawn indicator and zero deps.
- [ ] `formatManifestAssignment` returns single-object JSON for
      single-script files, array JSON for multi-script files.
- [ ] `compileFile` writes the union-shape sidecar JSON.
- [ ] `typesEmit` declares the typed `output` overload per export
      with the producer's literal output titles in the type
      parameter.
- [ ] Cross-file resolver detects cycles and shares cache across
      consumers (diamond fixture inlines `base` exactly once).
- [ ] Bundle output is determinism-pinned by the property test.
- [ ] Existing Phase-1 example scripts compile to byte-identical
      artefacts after this task lands (no diff on
      `examples/scripts/*.chart.js`).
- [ ] 100% coverage on touched files.
- [ ] Bench landed; threshold pinned.
- [ ] Changeset committed.
