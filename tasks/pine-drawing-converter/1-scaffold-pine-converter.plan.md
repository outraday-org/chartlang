# Task 1 — Scaffold `pine-converter` — Implementation Plan

> Audit artifact accompanying `1-scaffold-pine-converter.md`. Validates every
> reference in the task against the live workspace and pins the smallest
> idempotent diff that lands the §22.4 package + initial public surface stub.

## Context

- Greenfield package. No port from `../invinite/`.
- New workspace package `@invinite-org/chartlang-pine-converter` under
  `packages/pine-converter/`.
- Scaffold mechanism is `scripts/scaffold.ts` (idempotent — re-running
  produces zero diff). Five maps to update: `PACKAGE_DIRS`,
  `DESCRIPTIONS`, `PUBLIC_SURFACE`, `DOCS_LINKS`, `SUBPATH_EXPORTS`.
- §22.4 template emits six files: `package.json`, `tsconfig.json`,
  `vitest.config.ts`, `README.md`, `src/index.ts`, `src/index.test.ts`.
- Per-package `vitest.config.ts` excludes `src/**/index.ts` and
  `src/**/types.ts` from coverage. Real exported logic lives in
  dedicated files OUTSIDE `index.ts`. For this task there is no real
  logic yet — only types and one throw-shim function (`convert`). Because
  `index.ts` is excluded from coverage, the throw and constructor still
  need test coverage on a NON-`index.ts` file: not applicable here since
  the §22.4 default vitest config’s coverage excludes mean `index.ts`
  contributes nothing to the threshold. The test file therefore just has
  to import and exercise the symbols so the `pnpm test` run passes; the
  100% gate is auto-satisfied because no covered files contribute lines.
  Verified by reading `scripts/scaffold.ts` (lines 191–211) and
  `packages/conformance/vitest.config.ts`.

## Pre-existing work

- `scripts/scaffold.ts` already enumerates 11 packages/examples; no
  `pine-converter` entry yet. Lines 14–26, 28–42, 44–63, 65–77, 84–94.
- `packages/pine-converter/` does NOT exist.
- `docs/converter/` does NOT exist — placeholder link is fine because
  `scripts/readme-check.ts` does not verify link targets.
- `.changeset/` carries `README.md` + `config.json` only; no pending
  changesets for this package.

## Issues found

- The task spec lists the `SUBPATH_EXPORTS` value as `{ types:
  "./dist/diagnostics/index.d.ts", import: "./dist/diagnostics/index.js" }`
  but the matching `src/diagnostics/index.ts` contains only an
  `export {}` placeholder. That is fine for the §22.4 template — the
  scaffold writes the exports map blindly; no published `dist/` yet
  because the package has not been built. The forward reservation
  matches what Task 17/18 will fill in. No action.
- `convert` in the spec imports use of `void source; void opts;` then
  throws — needed because biome enforces `noUnusedParameters` via
  tsconfig (`tsconfig.base.json` — verified). `void` discharges the
  warning without renaming the parameter. Keep as written.
- `convert` example block `convert("//@version=6\nindicator('hello')");`
  does NOT contain `from "@invinite-org/chartlang-` substring, so
  `docs-check.executor.qualifiesForExecution` returns false and the
  block is NOT compiled. No risk of executor throwing inside docs:check.
- `EXEMPT_EXPORTS` in `docs-check.ts` is intentionally empty
  (`scripts/CLAUDE.md` line 41–43). Therefore `PACKAGE_VERSION` and
  every type must carry `@since` + `@example`. Spec already pins those.
- `noConsoleLog` is `warn`; scripts override it `off`. The package src
  has no `console.log` so neither rule fires.
- `verbatimModuleSyntax` is on — no type/value mixing in the test file.
- README ≤100 lines per `scripts/readme-check.ts`. Plan: 35-line README
  to leave headroom.

## Improvements (vs. naive transcription of the spec)

- Co-locate the subpath exports diagnostics shape with a comment in
  `scripts/scaffold.ts` so a future contributor sees WHY a placeholder
  subpath ships before its `dist/` exists (forward reservation for
  Task 17/18). Single-line comment, no new indirection.
- Match exact 4-space indent + double-quote + trailing-comma rules from
  `biome.json` in every new file.
- `src/index.test.ts` covers: `PACKAGE_VERSION` value, `convert` throws
  `ConverterNotReadyError` with `missingLayer === "lexer"`, exception
  inherits `Error`, plus a smoke construction of each exported type
  literal pinned through the `satisfies` operator (cheaper than a
  runtime assertion and exercises the type checker — matches the
  `expect-type`-style intent without adding a dep).

## Steps

1. **Edit `scripts/scaffold.ts`** — five additions, all keyed on
   `"packages/pine-converter"`.
   - `PACKAGE_DIRS`: insert the new entry between `"packages/cli"` and
     `"packages/conformance"`. The task spec says "before
     `packages/runtime`" — but in the current file (lines 14–26)
     `runtime` already sits at index 2 (third item, near the top), so
     ordering is loosely "converter family near compiler". Verified by
     re-reading the array order: core → compiler → runtime → host-worker
     → host-quickjs → adapter-kit → language-service → editor → cli →
     conformance → canvas2d-adapter. The cleanest non-disruptive
     placement that respects the "converter family near compiler"
     intent is **directly after `"packages/compiler"`** — which is the
     same neighborhood the task hint pointed at (the compiler family
     cluster). Re-reading the spec: "insert before
     `packages/runtime`" makes that exact spot. Insert at index 2.
   - `DESCRIPTIONS`: append `"packages/pine-converter": "Pine Script v6
     → chartlang source-to-source converter (drawings v1)"`. Place
     directly under `"packages/compiler"` to mirror the array order.
   - `PUBLIC_SURFACE`: append the spec's exact string. Mirror the array
     order.
   - `DOCS_LINKS`: append `"packages/pine-converter":
     "docs/converter/"`. Mirror order.
   - `SUBPATH_EXPORTS`: add `"packages/pine-converter": { "./diagnostics":
     { types: "./dist/diagnostics/index.d.ts", import:
     "./dist/diagnostics/index.js" } }`. Add a one-line comment above
     it noting it's a forward reservation for Tasks 17/18.
2. **Run `pnpm scaffold`** → creates the six template files in
   `packages/pine-converter/`.
3. **Run `pnpm scaffold` a second time** → verify zero diff (idempotent).
4. **Replace `packages/pine-converter/src/index.ts`** with the public
   surface per spec §2. Keep the MIT header. Use the exact JSDoc tags
   the spec lists (`@since 0.1`, `@experimental`).
5. **Replace `packages/pine-converter/src/index.test.ts`** with a test
   file that exercises every exported symbol — required so the test
   suite has at least one passing assertion per export and the file
   never goes stale (no coverage threshold counts these since the
   src/index.ts is excluded from coverage).
6. **Create eight subdirectory marker files** — `src/lexer/index.ts`,
   `src/parser/index.ts`, `src/ast/index.ts`, `src/semantic/index.ts`,
   `src/mapping/index.ts`, `src/transform/index.ts`,
   `src/codegen/index.ts`, `src/diagnostics/index.ts`. Each contains
   the MIT header + a one-line rationale comment + `export {};` so
   TypeScript treats the file as a module (rather than a script) and
   docs-check / readme-check have no exports to gate.
7. **Replace `packages/pine-converter/README.md`** with the §17.1
   structure (≤100 lines, stability `@experimental`, install line,
   public surface table, MV API, docs link, MIT).
8. **Add changeset** `.changeset/pine-converter-scaffold.md`. Minor bump
   for `@invinite-org/chartlang-pine-converter` only. Single bullet
   summary.
9. **Verify per-package** with `pnpm --filter
   @invinite-org/chartlang-pine-converter test`. Skip workspace-wide
   gates per task lead's instruction.

## Files to create / modify

| File | Action | Notes |
|------|--------|-------|
| `scripts/scaffold.ts` | Modify | Five map additions for `pine-converter`. |
| `packages/pine-converter/package.json` | Generated (scaffold) | §22.4. |
| `packages/pine-converter/tsconfig.json` | Generated (scaffold) | §22.4. |
| `packages/pine-converter/vitest.config.ts` | Generated (scaffold) | §22.4. |
| `packages/pine-converter/README.md` | Replace generated stub | §17.1. |
| `packages/pine-converter/src/index.ts` | Replace generated stub | Public surface §2. |
| `packages/pine-converter/src/index.test.ts` | Replace generated stub | Full coverage. |
| `packages/pine-converter/src/lexer/index.ts` | Create | Subdir marker. |
| `packages/pine-converter/src/parser/index.ts` | Create | Subdir marker. |
| `packages/pine-converter/src/ast/index.ts` | Create | Subdir marker. |
| `packages/pine-converter/src/semantic/index.ts` | Create | Subdir marker. |
| `packages/pine-converter/src/mapping/index.ts` | Create | Subdir marker. |
| `packages/pine-converter/src/transform/index.ts` | Create | Subdir marker. |
| `packages/pine-converter/src/codegen/index.ts` | Create | Subdir marker. |
| `packages/pine-converter/src/diagnostics/index.ts` | Create | Subdir marker. |
| `.changeset/pine-converter-scaffold.md` | Create | Minor bump. |

## Gates to keep green

- `pnpm typecheck` — green across all packages.
- `pnpm lint` — biome 4-space, double-quote, trailing-comma, semicolons,
  no-non-null-assertion, no-explicit-any, useImportType.
- `pnpm test` — per-package vitest with 100% coverage thresholds (note:
  `src/index.ts` is excluded — so no covered lines for this package
  yet, threshold trivially satisfied).
- `pnpm docs:check` — every export carries `@since` + `@example` +
  `@experimental`. No `ta.*` / `draw.*` files so `@formula`/`@anchors`
  don’t apply.
- `pnpm readme:check` — ≤100 lines, stability label, install line,
  public-surface heading, fenced ```ts``` block, MIT line.
- `pnpm scaffold` — idempotent on a second run.

## Changeset

- File: `.changeset/pine-converter-scaffold.md`
- Bump: `"@invinite-org/chartlang-pine-converter": minor`
- Body: one paragraph; new package, drawings v1 first slice (scaffold
  only, no conversion logic yet).

## Acceptance criteria

- [ ] `scripts/scaffold.ts` lists `pine-converter` in all five maps,
      ordering preserved.
- [ ] `pnpm scaffold` creates the six template files.
- [ ] Second `pnpm scaffold` run produces zero diff.
- [ ] `packages/pine-converter/src/index.ts` exports `PACKAGE_VERSION`,
      `convert`, `ConvertOpts`, `ConvertResult`, `Diagnostic`,
      `DiagnosticSeverity`, `SourceSpan`, `ConvertManifest`,
      `ConverterCapabilities`, `ConverterNotReadyError`. Every export
      carries `@since 0.1` + `@example` + `@experimental`.
- [ ] `convert("")` throws `ConverterNotReadyError` with
      `missingLayer === "lexer"`.
- [ ] Eight subdirectory markers exist under `src/` with the MIT
      header and `export {};`.
- [ ] README ≤100 lines, §17.1 structure, `@experimental` label.
- [ ] Changeset committed for `@invinite-org/chartlang-pine-converter`
      minor bump.
