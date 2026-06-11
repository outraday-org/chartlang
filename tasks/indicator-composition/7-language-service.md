# Task 7 — Language service hover, completion, diagnostics for deps

> **Status: TODO**

## Goal

Teach the language service (`@invinite-org/chartlang-language-service`)
and the editor (`@invinite-org/chartlang-editor`) about the new
indicator-composition surface. Authors see hover docs for `.output`
/ `.withInputs`, get completions for output titles, and see the
`dep-*` compile diagnostics inline before they hit the compiler.

## Prerequisites

- Tasks 1–6 — the new types, manifest, compiler analysis, runtime,
  and host plumbing must all be present.

## Current Behavior

- `packages/language-service/src/createLanguageService.ts` runs the
  real compiler via
  `compile(source, { apiVersion: 1, sourcePath: ... })` to surface
  diagnostics in the editor.
- `getHoverDoc(source, offset)` looks up the FQN-at-offset in
  `HOVER_REGISTRY` (generated from JSDoc by
  `scripts/gen-hover-registry.ts`; the docs generator
  `packages/cli/src/commands/genDocs.ts` is a sibling pipeline,
  not the registry's source of truth).
- `getCompletions(source, offset)` returns symbols from the
  registry, plus interval values when inside a
  `request.security(...)` literal slot.
- No knowledge of `CompiledScriptObject.output` / `withInputs`,
  no awareness of cross-file `.chart.ts` imports.

## Desired Behavior

- Hover on `.output("...")` shows the producer's plot title and
  its `OutputDeclaration.kind` (always `Series<number>` in this
  release).
- Hover on `.withInputs({...})` shows the producer's `inputs`
  schema with descriptions inherited from the input builder JSDoc.
- Completion of output names: when the cursor is inside the string
  argument of `<binding>.output("…|")` and the receiver type
  resolves to `CompiledScriptObject` with statically-known outputs,
  suggest each title.
- Completion of override keys: inside `<binding>.withInputs({
  |})` suggest the producer's input names.
- Diagnostics for `dep-cycle`, `dep-unknown-output`,
  `dep-invalid-input-override`, `dep-dynamic`,
  `dep-output-not-titled` surface inline via the existing
  `compileToDiagnostics` path (Tasks 2 + 6 produce them).
- Go-to-definition on a `.output(...)` title navigates to the
  producer's matching `plot(...)` call. Best-effort — depends on
  having the producer's source available; cross-package or
  pre-compiled producers fall back to "no definition" (current
  behaviour for built-ins).

## Requirements

### 1. Hover registry extension

`packages/language-service/src/hoverRegistry.generated.ts` is
generated from the workspace's JSDoc by
`scripts/gen-hover-registry.ts`. Two new registry entries are
needed automatically because Task 1 added `@example` + `@since`
+ `@stable` to the new `output` / `withInputs` properties on
`CompiledScriptObject`. Re-running the generator (typically via
`pnpm gen:hover` or whichever workspace script invokes it; the
exact script name is in root `package.json`) will pick them up.

Verify both registry entries land via a snapshot test:
`hoverRegistry.generated.test.ts` already exercises every entry.

For dynamic hovers (typed output names, typed input schema), add
a runtime computation in `createLanguageService.ts`'s
`getHoverDoc`:

```ts
getHoverDoc(source, offset) {
    const fqn = resolveFqnAtOffset(source, offset);
    if (fqn !== null) {
        // Existing path — registry lookup.
        const entry = HOVER_REGISTRY[fqn];
        if (entry !== undefined) return toHoverDoc(entry);
    }
    // NEW: dep-aware hovers
    const depHover = resolveDepAccessorHover(source, offset);
    if (depHover !== null) return depHover;
    return null;
},
```

`resolveDepAccessorHover` (new helper in
`packages/language-service/src/_lib/resolveDepAccessor.ts`):

- Parse the source through the language service's existing
  TS-language host.
- Find the token at offset.
- If the token is the string-literal argument of `<binding>.output(...)`:
    - Resolve the binding's type to `CompiledScriptObject`.
    - Pull the producer's `outputs` from the binding's
      type-level `output<K extends ...>(name: K)` overload
      (Task 3 emitted these in the `.chart.d.ts`).
    - Format a hover doc listing every declared output title +
      kind.
- If the token is inside `<binding>.withInputs({...})`:
    - Walk the binding's manifest's `inputs` schema.
    - Format a hover doc listing every declared input + its
      kind + default.
- Otherwise return `null`.

### 2. Completion extension

In `packages/language-service/src/_lib/collectCompletions.ts`:

Add a branch:

```ts
// Inside <binding>.output("|")
if (isInsideOutputStringLiteral(source, offset)) {
    const outputs = resolveDepOutputsFor(source, offset);
    return outputs.map((title) => ({
        label: title,
        kind: "field",
        insertText: title,
        detail: "Series<number> output",
    }));
}

// Inside <binding>.withInputs({ "|"...
if (isInsideWithInputsKey(source, offset)) {
    const inputs = resolveDepInputsFor(source, offset);
    return inputs.map((entry) => ({
        label: entry.name,
        kind: "field",
        insertText: entry.name,
        detail: `${entry.kind} (default: ${entry.default})`,
    }));
}
```

Both new helpers go in `packages/language-service/src/_lib/`.

### 3. Diagnostics

`compileToDiagnostics` already pipes every compiler diagnostic
through `mapDiagnostic`. The new `dep-*` codes flow through
without code change in this task. Add a regression test for each
code: drive the language service with a tiny source that
reliably triggers the diagnostic and confirm it surfaces inline.

### 4. Go-to-definition

`packages/language-service/src/createLanguageService.ts` exposes
`getDefinition(source, offset): DefinitionLocation | null`. Extend
the existing TS-language-host resolution:

- When the offset lands on a `.output("title")` string literal:
    - Resolve the binding's source declaration (existing TS
      go-to-def).
    - If the binding's RHS is a `defineIndicator(...)` call in a
      known file (same-file or `import X from "./Y.chart"`),
      open the producer's source file and find the
      `plot(value, { title: "<same-title>" })` call. Return its
      span as the definition.
    - Else fall back to the binding's declaration site.

This is a "stretch" requirement per the requirements doc — keep
it lightweight; if resolution fails, fall back to the binding
location.

### 5. Test layers

`packages/language-service/` test layer: **unit**.

- `createLanguageService.golden.test.ts` — extend with bundle
  scripts; confirm hover, completion, and diagnostics match
  golden snapshots.
- `createLanguageService.test.ts` — extend with dep-aware cases.
- `hoverRegistry.generated.test.ts` — confirm new entries land
  (auto via the generator — this test snapshots them).
- `_lib/languageServiceHelpers.test.ts` — co-located cases for
  the new `_lib/` helpers (`resolveDepAccessor`,
  `isInsideOutputStringLiteral`, `isInsideWithInputsKey`, and
  the new `collectCompletions` branches), matching the existing
  convention used by `isInsideIntervalLiteral`.

`packages/editor/` test layer: **unit**.

- `editor.test.ts` — wire the bundle-aware language service into
  the editor; confirm completion + hover trigger paths work.

### 6. JSDoc

Every new helper exported from `_lib/` carries the standard
JSDoc set (`@since 0.7`, `@stable`, `@example`). The package
`README.md` is updated to mention the dep-aware capabilities.

### 7. Editor surface

`packages/editor/src/` — no API change, just a regression test.
The editor already routes through the language service; new
capabilities surface automatically.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/language-service/src/createLanguageService.ts` | modify | Wire dep-aware hover + completion + go-to-def. |
| `packages/language-service/src/_lib/resolveDepAccessor.ts` | create | Dep-accessor hover resolution. |
| `packages/language-service/src/_lib/isInsideOutputStringLiteral.ts` | create | Predicate (mirrors existing `isInsideIntervalLiteral.ts`). |
| `packages/language-service/src/_lib/isInsideWithInputsKey.ts` | create | Predicate. |
| `packages/language-service/src/_lib/collectCompletions.ts` | modify | Dep-completion branches. |
| `packages/language-service/src/_lib/languageServiceHelpers.test.ts` | modify | Co-located tests for `resolveDepAccessor`, `isInsideOutputStringLiteral`, `isInsideWithInputsKey`, and the new `collectCompletions` branches — follows the existing `_lib/` convention (no separate `*.test.ts` per helper). |
| `packages/language-service/src/createLanguageService.test.ts` | modify | Dep-aware integration. |
| `packages/language-service/src/createLanguageService.golden.test.ts` | modify | Dep golden snapshots. |
| `packages/language-service/src/hoverRegistry.generated.ts` | regenerate | Picks up new `.output` / `.withInputs` registry entries. |
| `packages/language-service/src/hoverRegistry.generated.test.ts` | modify | New-entry snapshot. |
| `packages/language-service/README.md` | modify | Note dep-aware capabilities. Stay ≤ 100 lines. |
| `packages/editor/src/*.test.ts` | modify | Bundle wiring regression. |
| `packages/editor/README.md` | modify | Optional update. Stay ≤ 100 lines. |

## Gates

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm docs:check`,
  `pnpm readme:check`, `pnpm conformance` — green.
- 100% coverage on touched files in both packages.

## Changeset

- File: `.changeset/indicator-composition-7-lsp.md`
- Bump: **minor** for `@invinite-org/chartlang-language-service`.
  **Patch** for `@invinite-org/chartlang-editor` (no public API
  change).
- Reason: "Language service understands indicator-composition
  hovers, output-name + override-key completions, and surfaces
  the new `dep-*` diagnostics inline. Best-effort
  go-to-definition for `.output(...)` titles navigates to the
  producer's matching `plot(...)` call."

## Acceptance Criteria

- [ ] Hover on `<binding>.output(...)` shows the producer's
      declared outputs.
- [ ] Hover on `<binding>.withInputs({...})` shows the producer's
      input schema.
- [ ] Completion fires for output names and override keys.
- [ ] All six `dep-*` diagnostic codes surface inline via
      `compileToDiagnostics`.
- [ ] Go-to-definition on `.output("title")` navigates to the
      producer's matching `plot(...)` call when source is
      resolvable; falls back gracefully otherwise.
- [ ] 100% coverage on touched files.
- [ ] Hover registry snapshot updated.
- [ ] Changeset committed.
