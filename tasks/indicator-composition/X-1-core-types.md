# Task 1 — Core types, manifest extensions, diagnostic codes

> **Status: DONE**

## Goal

Land every type and contract change in `packages/core/` and
`packages/adapter-kit/` that downstream tasks read from. Single
foundational PR — no compiler, runtime, or host changes. After this
task lands, the rest of the workspace still type-checks and behaves
identically (the new shapes are optional / additive), and Tasks 2–8
have stable types to depend on.

## Prerequisites

None. This is the first task in the folder.

## Current Behavior

- `CompiledScriptObject` (`packages/core/src/types.ts`) is
  `{ manifest: ScriptManifest; compute: ComputeFn }`. No
  `.output(...)` accessor; no `.withInputs(...)` builder.
- `ScriptManifest` carries no `dependencies`, no `outputs`, no
  `exportName`, no `siblings`.
- `DiagnosticCode` (`packages/adapter-kit/src/types.ts`) has 26
  stable entries. No `dep-*` codes.

## Desired Behavior

- `CompiledScriptObject` becomes a non-generic struct (still
  back-compat) carrying two new optional / no-op-by-default
  accessors:
    - `output(name: string): Series<number>` — sentinel that throws
      `"<name>.output() called outside an active script step"` when
      executed at the script-author boundary. Inside a compiled
      bundle, the compiler statically rewrites every call site
      before this body is ever invoked.
    - `withInputs(overrides: Record<string, unknown>): CompiledScriptObject`
      — sentinel that throws unless invoked at module top-level by
      the compiler-rewritten bundle path. Statically the compiler
      sees the chain and folds the override into the dep's effective
      inputs at bundle time.
- `ScriptManifest` gains five optional fields:
  `dependencies`, `outputs`, `exportName`, `siblings`,
  `isDrawn`. All additive — single-script files keep emitting
  byte-identical manifests.
- `DiagnosticCode` extended additively with six new entries
  (`dep-error` / `dep-cycle` / `dep-unknown-output` /
  `dep-invalid-input-override` / `dep-dynamic` /
  `dep-output-not-titled`).
- Two new exported types — `DependencyDeclaration` and
  `OutputDeclaration` — carry the manifest payload.
- `CompiledScriptBundle` shape introduced as a separate exported
  type — Task 4 consumes it in the runner.

## Requirements

### 1. `CompiledScriptObject` extension

In `packages/core/src/types.ts`:

```ts
/**
 * Sentinel thrown when `output` / `withInputs` are called outside
 * the compiler-rewritten bundle path. The compiler statically
 * replaces every consumer-side `.output("title")` call site with
 * a synthesised `__chartlang_depOutput(slotId, depLocalId, "title")`
 * runtime call (see Task 2), so this body is unreachable when the
 * bundle is loaded normally. Hand-running an un-compiled script in
 * a unit test will hit the sentinel, which is the desired failure.
 *
 * @since 0.7
 * @stable
 */
const depAccessorSentinel = (name: string): never => {
    throw new Error(
        `${name} can only be called on a compiled chartlang ` +
            `indicator binding inside another indicator's compute body`,
    );
};

export type CompiledScriptObject = {
    readonly manifest: ScriptManifest;
    readonly compute: ComputeFn;
    /**
     * Read the named output of this indicator inside another
     * indicator's compute body. Output names come from the
     * producer's `plot(value, { title })` calls. The compiler
     * rewrites every consumer-side call site before bundling;
     * direct invocation throws the {@link depAccessorSentinel}.
     *
     * @since 0.7
     * @stable
     * @example
     *     const baseTrend = defineIndicator({
     *         name: "Base Trend",
     *         apiVersion: 1,
     *         compute({ bar, ta, plot }) {
     *             plot(ta.ema(bar.close, 50), { title: "line" });
     *         },
     *     });
     *     export default defineIndicator({
     *         name: "Consumer",
     *         apiVersion: 1,
     *         compute({ plot }) {
     *             plot(baseTrend.output("line"));
     *         },
     *     });
     */
    readonly output: (name: string) => Series<number>;
    /**
     * Return a new `CompiledScriptObject` whose dependency-binding
     * effective inputs are the merge of the producer's defaults with
     * the supplied overrides. Static — the compiler folds the
     * override into the inlined dep manifest at bundle time.
     *
     * @since 0.7
     * @stable
     * @example
     *     const trend = baseTrend.withInputs({ length: 50 });
     */
    readonly withInputs: (
        overrides: Readonly<Record<string, unknown>>,
    ) => CompiledScriptObject;
};
```

Both accessors land as runtime sentinels through the helper above.
`defineIndicator(...)` in `packages/core/src/define/defineIndicator.ts`
attaches them on the frozen return object:

```ts
return Object.freeze({
    manifest: Object.freeze(manifest),
    compute: opts.compute,
    output: (name) => depAccessorSentinel(`output("${name}")`),
    withInputs: () => depAccessorSentinel("withInputs"),
});
```

### 2. `DependencyDeclaration` + `OutputDeclaration`

New file `packages/core/src/define/dependency.ts`:

```ts
/**
 * One node in a script's compiled dependency graph. Emitted by the
 * compiler's `extractDependencyGraph` pass (Task 2) and consumed by
 * the runtime's dep executor (Task 4).
 *
 * `localId` is the JavaScript binding name the consumer used —
 * `const trend = baseTrend.withInputs(...)` produces `localId:
 * "trend"`. Stable across script edits as long as the binding name
 * is stable.
 *
 * `producerSourcePath` is the POSIX path the compiler resolved for
 * the producer. Same-file deps use the consumer's `sourcePath`.
 *
 * `effectiveInputs` is the merge of producer defaults + every
 * `.withInputs(...)` chained on the binding, JSON-serialised.
 *
 * `outputs` mirrors the producer's `ScriptManifest.outputs` so the
 * runtime can validate consumer `.output("...")` calls at mount time.
 *
 * @since 0.7
 * @stable
 */
export type DependencyDeclaration = Readonly<{
    readonly localId: string;
    readonly producerName: string;
    readonly producerSourcePath: string;
    readonly producerExportName: string;
    readonly effectiveInputs: Readonly<Record<string, JsonValue>>;
    readonly outputs: ReadonlyArray<OutputDeclaration>;
    readonly isDrawn: boolean;
}>;

/**
 * One titled output a script exposes. Derived from the producer's
 * `plot(value, { title })` calls during compile. `title` is the
 * key consumers reference via `<binding>.output("title")`.
 *
 * @since 0.7
 * @stable
 */
export type OutputDeclaration = Readonly<{
    readonly title: string;
    readonly kind: "series-number";
}>;
```

Both re-export from `packages/core/src/define/index.ts` and the
package barrel.

### 3. `ScriptManifest` extension

In `packages/core/src/types.ts`:

```ts
export type ScriptManifest = {
    // ... existing fields unchanged ...
    /**
     * Statically-resolved dependency graph nodes consumed by this
     * script. Empty / omitted for scripts with no `<binding>.output(...)`
     * calls. Each entry is one consumer-side binding.
     *
     * @since 0.7
     * @stable
     */
    readonly dependencies?: ReadonlyArray<DependencyDeclaration>;
    /**
     * Titled outputs this script exposes for consumption by other
     * indicators. Derived from `plot(value, { title })` calls in
     * this script's compute body. Empty / omitted when the script
     * has no titled plots.
     *
     * @since 0.7
     * @stable
     */
    readonly outputs?: ReadonlyArray<OutputDeclaration>;
    /**
     * The ES-module binding name this manifest was reached through.
     * `"default"` for `export default defineIndicator(...)`; the
     * named-binding identifier otherwise. Always present when the
     * source file has more than one drawn indicator; omitted on
     * single-script files for back-compat.
     *
     * @since 0.7
     * @stable
     */
    readonly exportName?: string;
    /**
     * Other drawn manifests in the same compiled file. Present
     * only when this manifest is the file's default export and the
     * file has additional named-exported drawn indicators. Omitted
     * for single-script files and for non-default-export entries
     * in the array-form manifest sidecar.
     *
     * @since 0.7
     * @stable
     */
    readonly siblings?: ReadonlyArray<ScriptManifest>;
    /**
     * `true` when this manifest belongs to a drawn (exported)
     * indicator — the host should mount it. `false` when this
     * manifest belongs to a private dep — emissions are dropped.
     * Defaults to `true` for back-compat.
     *
     * @since 0.7
     * @stable
     */
    readonly isDrawn?: boolean;
};
```

### 4. `CompiledScriptBundle` (Task 4 consumes)

In `packages/core/src/types.ts`:

```ts
/**
 * The compiled artefact for a `.chart.ts` file when it contains
 * multiple drawn indicators or any dependency graph. Task 4's
 * runtime accepts either this shape or the legacy
 * `CompiledScriptObject` (single-script files).
 *
 * `primary` is the default-exported drawn script. `siblings` are
 * every other drawn export (named consts). `dependencies` is every
 * private-dep compiled object — keyed by `localId` so the runtime
 * can look them up by the `DependencyDeclaration.localId` it sees
 * on each consumer's manifest.
 *
 * @since 0.7
 * @stable
 */
export type CompiledScriptBundle = Readonly<{
    readonly primary: CompiledScriptObject;
    readonly siblings: ReadonlyArray<{
        readonly exportName: string;
        readonly compiled: CompiledScriptObject;
    }>;
    readonly dependencies: ReadonlyArray<{
        readonly localId: string;
        readonly compiled: CompiledScriptObject;
    }>;
}>;

export const isCompiledScriptBundle = (
    v: CompiledScriptObject | CompiledScriptBundle,
): v is CompiledScriptBundle =>
    Object.prototype.hasOwnProperty.call(v, "primary");
```

### 5. `DiagnosticCode` extension

In `packages/adapter-kit/src/types.ts`, append to the existing
union:

```ts
export type DiagnosticCode =
    // ... existing 26 entries unchanged ...
    | "dep-error"
    | "dep-cycle"
    | "dep-unknown-output"
    | "dep-invalid-input-override"
    | "dep-dynamic"
    | "dep-output-not-titled";
```

Update the JSDoc above the union to enumerate the new codes
(replicates the existing pattern). The Phase-7 frozen-set
clarification in `docs/spec/versioning.md` already covers
additive `DiagnosticCode` extensions across `1.x`.

### 6. Compiler ambient shim (lockstep)

`packages/compiler/src/program.ts` carries a hand-rolled
`@invinite-org/chartlang-core` declaration block. Mirror every
change above:

- Add `output` and `withInputs` to the `CompiledScriptObject`
  declaration in the shim.
- Add `DependencyDeclaration` / `OutputDeclaration` /
  `CompiledScriptBundle` / `isCompiledScriptBundle` declarations.
- Add the five new optional fields on `ScriptManifest`.

The shim test (`packages/compiler/src/program.test.ts` —
already exists; verify it still passes) loads a sample script that
uses every new declaration and confirms TS doesn't complain.

### 7. Test layers (per `CONTRIBUTING.md` §2 table)

`packages/core/` test layers: **unit + type**.

- `packages/core/src/define/defineIndicator.test.ts` — extend with
  an assertion that the returned object now has `output` and
  `withInputs` properties; calling them throws the sentinel.
- `packages/core/src/define/dependency.test.ts` — new. Smoke-test
  `DependencyDeclaration` / `OutputDeclaration` shapes (frozen,
  JSON-serialisable round-trip).
- `packages/core/src/define/dependency.types.test.ts` — new. Pin
  the inferred TS types via `expectType` patterns matching the
  existing `*.types.test.ts` files.
- `packages/core/src/types.types.test.ts` — extend with a case
  that constructs a `ScriptManifest` carrying every new optional
  field and asserts the type accepts it.
- `packages/core/src/index.test.ts` — extend the barrel-export
  check to include `DependencyDeclaration`, `OutputDeclaration`,
  `CompiledScriptBundle`, `isCompiledScriptBundle`.

`packages/adapter-kit/` test layer: **unit + type + conformance**.

- `packages/adapter-kit/src/types.types.test.ts` — extend the
  `DiagnosticCode` type-level smoke test to include the six new
  entries (the union is type-only; the existing assertions use
  `expectType` patterns, follow the same style).
- `packages/adapter-kit/src/validation/validateEmission.test.ts`
  — confirm the new codes round-trip the validator's
  pass-through path (validator doesn't reject any
  `DiagnosticCode`).

### 8. JSDoc gate

Every new exported symbol needs:

- `@since 0.7` (the version this lands on).
- `@stable` marker.
- `@example` block — compiled by `pnpm docs:check`. Make the
  examples actually compile; the gate runs them.

### 9. README + docs gates

- `packages/core/README.md` — bump the public-API section to
  mention the new dep accessors. Stay within the 100-line cap.
- `packages/adapter-kit/README.md` — note the `dep-*`
  `DiagnosticCode` additions; stay within 100 lines.
- Root `README.md` — no change in this task (Task 8 owns the
  README mention).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/types.ts` | modify | Add `dependencies?`, `outputs?`, `exportName?`, `siblings?`, `isDrawn?` to `ScriptManifest`; extend `CompiledScriptObject` with `output` + `withInputs`; add `CompiledScriptBundle` + `isCompiledScriptBundle`. |
| `packages/core/src/define/defineIndicator.ts` | modify | Attach `output` + `withInputs` sentinels on the frozen return object. |
| `packages/core/src/define/defineIndicator.test.ts` | modify | Assert new accessors exist + throw. |
| `packages/core/src/define/dependency.ts` | create | `DependencyDeclaration` + `OutputDeclaration` types. |
| `packages/core/src/define/dependency.test.ts` | create | Smoke + frozen + JSON-roundtrip tests. |
| `packages/core/src/define/dependency.types.test.ts` | create | Type-level expectType tests. |
| `packages/core/src/define/index.ts` | modify | Re-export the new types. |
| `packages/core/src/index.ts` | modify | Re-export the new types from the package barrel. |
| `packages/core/src/index.test.ts` | modify | Barrel-export smoke check. |
| `packages/core/src/types.types.test.ts` | modify | Type case for new manifest fields. |
| `packages/core/README.md` | modify | Public-API section. Stay ≤ 100 lines. |
| `packages/adapter-kit/src/types.ts` | modify | Append 6 new `DiagnosticCode` entries. |
| `packages/adapter-kit/src/types.types.test.ts` | modify | Type-level smoke for new `dep-*` codes. |
| `packages/adapter-kit/src/validation/validateEmission.test.ts` | modify | New-code pass-through. |
| `packages/adapter-kit/README.md` | modify | Note dep diagnostic codes. Stay ≤ 100 lines. |
| `packages/compiler/src/program.ts` | modify | Mirror every new type in the ambient shim. |
| `packages/compiler/src/program.test.ts` | modify | Compile a sample script that uses the new declarations to confirm the shim is in lockstep. |

## Gates

- `pnpm typecheck` — must pass with strict mode after the new
  fields are added.
- `pnpm lint` — must pass; new files carry the two-line MIT
  header.
- `pnpm test` — 100% line/statement/branch/function coverage on
  every touched file in `core/` and `adapter-kit/`.
- `pnpm docs:check` — every new export has `@example` + `@since`
  + stability marker.
- `pnpm readme:check` — both READMEs ≤ 100 lines; root README
  untouched.
- `pnpm conformance` — unchanged (no scenarios added in this
  task). Suite must still pass.

## Changeset

- File: `.changeset/indicator-composition-1-core-types.md`
- Bump: **minor** for `@invinite-org/chartlang-core` and
  `@invinite-org/chartlang-adapter-kit`. Minor on the compiler
  package as well (the program shim widens its declared types).
- Reason: "Add `CompiledScriptObject.output` / `.withInputs`
  sentinels, `DependencyDeclaration` + `OutputDeclaration` types,
  optional `dependencies` / `outputs` / `exportName` / `siblings`
  / `isDrawn` fields on `ScriptManifest`, and six new `dep-*`
  `DiagnosticCode` entries. Additive within `apiVersion: 1`."

## Acceptance Criteria

- [ ] `CompiledScriptObject` carries `output` and `withInputs`;
      both throw a clear sentinel when invoked at the script-author
      boundary.
- [ ] `ScriptManifest` accepts every new optional field;
      single-script manifests stay byte-identical (the new fields
      are simply omitted).
- [ ] `DependencyDeclaration`, `OutputDeclaration`,
      `CompiledScriptBundle`, `isCompiledScriptBundle` are exported
      from the `core` barrel.
- [ ] `DiagnosticCode` has six new entries; the union type
      otherwise unchanged.
- [ ] Compiler ambient shim mirrors every change; the existing
      `program.test.ts` typecheck still passes.
- [ ] 100% coverage maintained on touched packages.
- [ ] JSDoc gate green on every new export.
- [ ] Both READMEs stay within their 100-line caps.
- [ ] Changeset committed with the wording above.
- [ ] No `STATEFUL_PRIMITIVES` change — its 172-entry cardinality
      check still passes.
