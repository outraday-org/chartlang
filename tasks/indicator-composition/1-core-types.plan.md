# 1-core-types — Implementation Plan

> Audit artefact for `tasks/indicator-composition/1-core-types.md`.
> Lands every core type / manifest / diagnostic-code extension that
> Tasks 2–8 depend on. Pure additive — no behaviour change.

## Context

- Single foundational PR. Touches `packages/core/`,
  `packages/adapter-kit/`, `packages/compiler/` (ambient shim only).
- No runtime / host / compiler-pass / runner changes.
- `apiVersion` stays at `1`; the changes are additive within `1.x`
  (`docs/spec/versioning.md`).
- Workspace verified clean: no pre-existing files / symbols / tests
  carrying `dependencies`, `siblings`, `DependencyDeclaration`,
  `OutputDeclaration`, `CompiledScriptBundle`, `isCompiledScriptBundle`,
  or `dep-*` diagnostic codes (grep across `packages/**/src/` returned
  zero hits outside `tasks/indicator-composition/*.md`).

## Pre-existing work

None. All artefacts described below need to be created or extended for
the first time.

- `packages/core/src/types.ts:265-355` — `ScriptManifest` shape (no
  `dependencies` / `outputs` / `exportName` / `siblings` / `isDrawn`).
- `packages/core/src/types.ts:473-476` — `CompiledScriptObject` carries
  only `manifest` + `compute`.
- `packages/core/src/define/defineIndicator.ts:80-83` —
  `Object.freeze({ manifest, compute })`.
- `packages/core/src/index.ts:4-26` — exports list (no `Dependency*` /
  `Output*` / `CompiledScriptBundle*`).
- `packages/adapter-kit/src/types.ts:605-631` — `DiagnosticCode` union,
  26 entries. **Verified 26** (matches task pre-flight).
- `packages/adapter-kit/src/validation/validateEmission.ts:121-148` —
  `VALID_DIAGNOSTIC_CODES` `Set<DiagnosticCode>` literal. Must be
  widened in lockstep with the union or `validateDiagnostic` will
  reject the new codes at the wire boundary.
- `packages/compiler/src/program.ts:1028-1265` — hand-rolled ambient
  shim declaration of `CompiledScriptObject`, `ScriptManifest`,
  `ComputeContext`. Must be widened to mirror the additions.
- `packages/compiler/src/program.test.ts` — exists; covers shim symbol
  resolution + Phase-4/5 + `STATEFUL_PRIMITIVES.size === 172` pin.

## Issues found vs. raw task text

1. **`@since 0.7` in the task spec.** The chartlang workspace tags
   primitives by phase ordinal (`@since 0.1` … `@since 0.6`) rather
   than published semver. The most recent extensions land as
   `@since 0.6`. **Keep `@since 0.7`** as the task explicitly states —
   it's the next phase ordinal, and PLAN.md §19 + task spec both pin
   it. Published semver (`@invinite-org/chartlang-core` is at `1.0.1`)
   is orthogonal and tracked via changesets.
2. **`@since 0.4` widening of `InputSchema`** uses an inline
   "widened in 0.4 from opaque…" remark in JSDoc. Mirror that style
   for any field on `ScriptManifest` that semantically widens. None
   here — every new field is brand-new, so `@since 0.7` is enough.
3. **`VALID_DIAGNOSTIC_CODES` lockstep — not called out in the task
   text but required.** `packages/adapter-kit/src/validation/validateEmission.ts:121`
   carries a runtime `Set<DiagnosticCode>` that must include every
   new code, otherwise `validateDiagnostic` will reject `dep-*`
   payloads with `malformed-emission` at every structured-clone
   boundary. Add to the plan as a non-optional sub-step of §5.
4. **Coverage exclusion: `types.ts` is excluded from the coverage
   gate** (per `packages/CLAUDE.md` line 17). New types in `types.ts`
   don't need coverage tests beyond the `types.types.test.ts`
   type-level pins. New runtime code in `defineIndicator.ts` and
   `dependency.ts` (the file holds *only* type declarations, so it's
   coverage-excluded — verify via vitest config) **does** need
   coverage. The sentinel throw branches inside `defineIndicator.ts`
   are reachable in tests via direct invocation; they must be
   covered.
5. **`@example` blocks compile.** The `docs:check` /
   `docs:snippets` gate compiles fenced ` ```ts ` examples in
   `README.md` and `docs/getting-started/*.md`. JSDoc `@example`
   blocks in `packages/*/src/*.ts` go through the `docs:check`
   JSDoc gate — they must be syntactically valid TypeScript but
   the gate (`scripts/check-docs.ts` family) reads them without
   compilation in the default path. Verify the example pattern
   matches existing surface (`Series<number>` typed, no unused
   identifiers).
6. **`packages/core/src/define/dependency.ts` is type-only.** The
   `dependency.test.ts` smoke test must construct runtime values
   (frozen literals, JSON-roundtrip) to exercise actual coverage.
   No runtime code in the new file means `vitest.config.ts`
   coverage may need the file added to its exclude list if it's
   declarations-only. Decision: keep the file declarations-only,
   excluded from coverage like `types.ts`. Confirmed by the
   `coverage:` block in `packages/core/vitest.config.ts` (excludes
   `**/*.ts` files that are pure types).
7. **Compiler ambient shim duplicates types.** The shim is hand-
   rolled; the `program.test.ts` "loads sample script that uses
   every new declaration" assertion is the only gate. Add a new
   test case (`resolves indicator-composition surface without
   semantic errors`) using the documented usage from `README.md`
   in `tasks/indicator-composition/`.

## Improvements

- Mirror `@since 0.4` style for any field that semantically widens an
  existing surface. None to widen here, so just stamp `@since 0.7`
  on the new exports.
- `isCompiledScriptBundle` uses `Object.prototype.hasOwnProperty.call`
  — keep it; matches the safe-narrowing patterns elsewhere
  (`packages/core/src/draw/draw.ts` uses `Object.prototype.hasOwnProperty`).
- `VALID_DIAGNOSTIC_CODES` widening — fold into the same diff so the
  runtime validator can't drop `dep-*` diagnostics silently.

## Numbered Steps

### Step 1 — `packages/core/src/types.ts` (modify)

1.1. **Import the new types** at the top of `types.ts`:

```ts
import type { DependencyDeclaration, OutputDeclaration } from "./define/dependency.js";
```

(The `dependency.ts` file is created in §2, but TS allows the
forward-declared import.)

1.2. **Add a `dep` accessor sentinel** as a non-exported helper:

```ts
const depAccessorSentinel = (name: string): never => {
    throw new Error(
        `${name} can only be called on a compiled chartlang ` +
            `indicator binding inside another indicator's compute body`,
    );
};
```

Actually — the sentinel ONLY needs to be reachable inside
`defineIndicator.ts`. Move it there to keep `types.ts` purely
declarative. **Decision:** define the sentinel in
`packages/core/src/define/defineIndicator.ts` (it's the only call
site) and document the cross-link in the JSDoc on
`CompiledScriptObject.output` / `withInputs`.

1.3. **Extend `ScriptManifest`** — append five optional fields after
the existing fields (in order): `dependencies?`, `outputs?`,
`exportName?`, `siblings?`, `isDrawn?`. Each gets a JSDoc with
`@since 0.7` + `@stable` + `@example`. The fields are all read-only.
For `siblings?: ReadonlyArray<ScriptManifest>` use a self-type
reference — the recursive shape resolves cleanly because the array
is `readonly`.

1.4. **Extend `CompiledScriptObject`** with `output` + `withInputs`:

```ts
export type CompiledScriptObject = {
    readonly manifest: ScriptManifest;
    readonly compute: ComputeFn;
    /** @since 0.7 @stable @example ... */
    readonly output: (name: string) => Series<number>;
    /** @since 0.7 @stable @example ... */
    readonly withInputs: (
        overrides: Readonly<Record<string, unknown>>,
    ) => CompiledScriptObject;
};
```

1.5. **Add `CompiledScriptBundle` + `isCompiledScriptBundle`** at the
bottom of `types.ts`, before the closing of the file:

```ts
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

Both get full `@since 0.7` + `@stable` + `@example` JSDoc.

### Step 2 — `packages/core/src/define/dependency.ts` (create)

2.1. Create the file with the two-line MIT header + the two type
declarations from the task spec. The file is type-only — no runtime
code.

2.2. JSDoc tags: `@since 0.7`, `@stable`, `@example`. The example
must compile: use a `Readonly<Record<string, JsonValue>>` literal,
not a free-form record.

### Step 3 — `packages/core/src/define/index.ts` (modify)

3.1. Add `export type { DependencyDeclaration, OutputDeclaration } from "./dependency.js";` to the re-export list.

### Step 4 — `packages/core/src/index.ts` (modify)

4.1. Add to the type-export block:
- `CompiledScriptBundle`
- `DependencyDeclaration`
- `OutputDeclaration`

4.2. Add a value-export for `isCompiledScriptBundle` (it's a runtime
function, not a type).

### Step 5 — `packages/core/src/define/defineIndicator.ts` (modify)

5.1. Add the `depAccessorSentinel` helper as a module-local
function with full JSDoc:

```ts
const depAccessorSentinel = (name: string): never => {
    throw new Error(
        `${name} can only be called on a compiled chartlang ` +
            `indicator binding inside another indicator's compute body`,
    );
};
```

5.2. Extend the frozen return object inside `defineIndicator`:

```ts
return Object.freeze({
    manifest: Object.freeze(manifest),
    compute: opts.compute,
    output: (name: string): Series<number> =>
        depAccessorSentinel(`output("${name}")`),
    withInputs: (): CompiledScriptObject =>
        depAccessorSentinel("withInputs"),
});
```

5.3. Verify return-type still matches `CompiledScriptObject`. Adjust
the `Series<number>` and `CompiledScriptObject` imports as needed.

### Step 6 — `packages/adapter-kit/src/types.ts` (modify)

6.1. Append 6 new entries to `DiagnosticCode`:

```ts
| "dep-error"
| "dep-cycle"
| "dep-unknown-output"
| "dep-invalid-input-override"
| "dep-dynamic"
| "dep-output-not-titled"
```

6.2. Update the JSDoc block above the union to mention the new codes
(matches the existing pattern).

### Step 7 — `packages/adapter-kit/src/validation/validateEmission.ts` (modify)

7.1. Append the same 6 entries to `VALID_DIAGNOSTIC_CODES` so the
runtime validator accepts them. Same order as the union.

### Step 8 — `packages/compiler/src/program.ts` (modify)

8.1. Inside `CORE_AMBIENT_SHIM`, mirror every type change above:

- Add the five new optional fields on `ScriptManifest`.
- Extend `CompiledScriptObject` with `output` + `withInputs` method
  signatures (return-type bodies don't matter — shim is declaration
  only).
- Add new exported types: `DependencyDeclaration`,
  `OutputDeclaration`, `CompiledScriptBundle`.
- Add `export function isCompiledScriptBundle(...)`.

### Step 9 — Tests

9.1. `packages/core/src/define/defineIndicator.test.ts` — extend
the existing suite with:
- `it("attaches output sentinel that throws when invoked")`
- `it("attaches withInputs sentinel that throws when invoked")`
- `it("preserves the sentinel error shape (carries name in message)")`

9.2. `packages/core/src/define/dependency.test.ts` — new file:
- A frozen `DependencyDeclaration` literal round-trips through
  `JSON.parse(JSON.stringify(...))`.
- An `OutputDeclaration` with `kind: "series-number"` is
  JSON-serialisable.

9.3. `packages/core/src/define/dependency.types.test.ts` — new file:
- Use `expectTypeOf<...>` patterns matching neighbouring
  `*.types.test.ts` to pin:
    - `DependencyDeclaration["localId"]` is `string`
    - `DependencyDeclaration["effectiveInputs"]` is
      `Readonly<Record<string, JsonValue>>`
    - `DependencyDeclaration["outputs"]` is
      `ReadonlyArray<OutputDeclaration>`
    - `OutputDeclaration["kind"]` is the literal `"series-number"`

9.4. `packages/core/src/types.types.test.ts` — extend with:
- `it("ScriptManifest accepts every new optional composition field")`
- Pin every new field's inferred type via `expectTypeOf<...>`
- Pin `CompiledScriptBundle.primary`, `siblings`, `dependencies`
  shapes
- Pin that `isCompiledScriptBundle` narrows the union

9.5. `packages/core/src/index.test.ts` — the barrel test only does
a `expect(publicSurface).toBeDefined()` smoke check. Extend it to
assert the new exports are present:
- `expect(publicSurface.isCompiledScriptBundle).toBeTypeOf("function")`

9.6. `packages/adapter-kit/src/types.types.test.ts` — widen the
`ExpectedCodes` union in the existing `DiagnosticCode` test to
include the 6 new entries. The pinned set goes from 26 to 32.

9.7. `packages/adapter-kit/src/validation/validateEmission.test.ts`
— add a `describe("validateEmission — dep diagnostic codes")` with
one `it("accepts each new dep-* DiagnosticCode")` that loops over
the new codes and confirms each returns `{ ok: true }`.

9.8. `packages/compiler/src/program.test.ts` — add a new test:
`it("resolves the indicator-composition surface without semantic
errors")`. The fixture source imports `defineIndicator`,
constructs a producer + consumer using `.output(...)` and
`.withInputs({...})` calls, and asserts
`program.getSemanticDiagnostics(sourceFile)` returns `[]`.

### Step 10 — READMEs

10.1. `packages/core/README.md` — add `output` / `withInputs` /
`DependencyDeclaration` / `OutputDeclaration` /
`CompiledScriptBundle` mentions to the "Public surface" section.
Keep total ≤ 100 lines.

10.2. `packages/adapter-kit/README.md` — note the 6 new `dep-*`
codes in the "Public surface" or "Types" section. Keep total
≤ 100 lines.

### Step 11 — Changeset

11.1. Create `.changeset/indicator-composition-1-core-types.md`
with:

```md
---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-compiler": minor
---

Add `CompiledScriptObject.output` / `.withInputs` sentinels,
`DependencyDeclaration` + `OutputDeclaration` types, optional
`dependencies` / `outputs` / `exportName` / `siblings` / `isDrawn`
fields on `ScriptManifest`, and six new `dep-*` `DiagnosticCode`
entries. Additive within `apiVersion: 1`.
```

## Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `packages/core/src/types.ts` | modify | Extend `ScriptManifest`; extend `CompiledScriptObject`; add `CompiledScriptBundle` + `isCompiledScriptBundle`; type-only import of new dep types. |
| `packages/core/src/define/dependency.ts` | **create** | `DependencyDeclaration` + `OutputDeclaration`. MIT header. Type-only. |
| `packages/core/src/define/defineIndicator.ts` | modify | Add `depAccessorSentinel` helper; attach `output` + `withInputs` on the frozen return. |
| `packages/core/src/define/index.ts` | modify | Re-export new types. |
| `packages/core/src/index.ts` | modify | Re-export new types + `isCompiledScriptBundle`. |
| `packages/core/src/define/defineIndicator.test.ts` | modify | Sentinel-throw assertions. |
| `packages/core/src/define/dependency.test.ts` | **create** | Frozen + JSON round-trip. |
| `packages/core/src/define/dependency.types.test.ts` | **create** | `expectTypeOf` pins. |
| `packages/core/src/types.types.test.ts` | modify | New manifest + bundle type pins. |
| `packages/core/src/index.test.ts` | modify | Barrel-export smoke for `isCompiledScriptBundle`. |
| `packages/core/README.md` | modify | Public-API additions. ≤ 100 lines. |
| `packages/adapter-kit/src/types.ts` | modify | Append 6 `dep-*` codes; update JSDoc. |
| `packages/adapter-kit/src/validation/validateEmission.ts` | modify | Widen `VALID_DIAGNOSTIC_CODES`. |
| `packages/adapter-kit/src/types.types.test.ts` | modify | Widen `ExpectedCodes` to 32 entries. |
| `packages/adapter-kit/src/validation/validateEmission.test.ts` | modify | `dep-*` codes pass-through. |
| `packages/adapter-kit/README.md` | modify | Note `dep-*` codes. ≤ 100 lines. |
| `packages/compiler/src/program.ts` | modify | Mirror every shape in the ambient shim. |
| `packages/compiler/src/program.test.ts` | modify | Add semantic-typecheck case for the composition surface. |
| `.changeset/indicator-composition-1-core-types.md` | **create** | Minor on core, adapter-kit, compiler. |

## Gates

- `pnpm typecheck` — every new field is optional / additive. The
  changes can't break consumers.
- `pnpm lint` — new files carry the two-line MIT header; no `any`;
  no `!`; type-only imports use `import type`.
- `pnpm test` — 100% coverage on touched runtime files. New types
  file (`dependency.ts`) is declaration-only and stays out of the
  coverage crawl by default (matches the pattern used by `types.ts`
  in the same package).
- `pnpm docs:check` — every new export has `@example`, `@since 0.7`,
  `@stable`. JSDoc examples compile.
- `pnpm readme:check` — both READMEs ≤ 100 lines; root unchanged.
- `pnpm conformance` — unchanged (no scenarios added in this task);
  must still pass.
- `STATEFUL_PRIMITIVES.size === 172` — unchanged; the pin in
  `packages/compiler/src/program.test.ts` and the
  `statefulPrimitives.test.ts:382` assertion both continue to pass.

## Changeset

- File: `.changeset/indicator-composition-1-core-types.md`
- Bumps: `@invinite-org/chartlang-core` **minor**,
  `@invinite-org/chartlang-adapter-kit` **minor**,
  `@invinite-org/chartlang-compiler` **minor**.
- Body: see Step 11 above.

## Acceptance Criteria

- [ ] `CompiledScriptObject` carries `output` + `withInputs`; both
      throw the sentinel when invoked.
- [ ] `ScriptManifest` accepts every new optional field; single-script
      manifests stay byte-identical.
- [ ] `DependencyDeclaration`, `OutputDeclaration`,
      `CompiledScriptBundle`, `isCompiledScriptBundle` exported from
      `@invinite-org/chartlang-core` barrel.
- [ ] `DiagnosticCode` has 32 entries (was 26).
- [ ] `VALID_DIAGNOSTIC_CODES` runtime set carries the 6 new codes.
- [ ] Compiler ambient shim mirrors every change; the new
      `program.test.ts` case typechecks against the shim.
- [ ] JSDoc gate green on every new export.
- [ ] Both READMEs ≤ 100 lines.
- [ ] Changeset committed.
- [ ] `STATEFUL_PRIMITIVES.size` still equals 172.
