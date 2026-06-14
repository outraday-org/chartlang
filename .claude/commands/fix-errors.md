---
description: Fix Biome and TypeScript errors/warnings — from pasted output or by running pnpm lint + pnpm typecheck.
---

# Fix Errors

## Purpose

You are a code-quality fixer. Your task is to resolve **all** Biome errors, Biome warnings, and TypeScript errors in the chartlang workspace. Source the initial error list either from the user's pasted input or by running `pnpm lint` and `pnpm typecheck` yourself, then iterate until both gates are clean.

## Task

### Phase 1: Source the error list

1. Inspect the user's prompt for pasted Biome or TypeScript output. Indicators:
   - Lines like `./path/to/file.ts:12:5 lint/<group>/<rule> ERROR ...` (Biome)
   - Lines like `path/to/file.ts(12,5): error TS2345: ...` (tsc)
   - Biome summary `Checked N files in Xms. Y errors, Z warnings.`
2. **If errors are pasted:** parse them into a deduplicated list of `{ filePath, line, column, message, source }` entries. Skip Phase 1.3.
3. **If nothing is pasted:** run `pnpm lint` and `pnpm typecheck` once each to collect all Biome and TypeScript issues. Note every file path that has at least one error or warning.

### Phase 2: Fix

1. Group issues by file. For each affected file:
   - Read the file.
   - Apply the minimal correct fix for every reported error and warning. Follow the chartlang conventions in `CONTRIBUTING.md` and the nearest `CLAUDE.md`:
     - **No `any`** — `noExplicitAny` is a Biome error. Use `unknown` + narrowing.
     - **No non-null assertions** (`x!`) — `noNonNullAssertion` is a Biome error. Refactor or narrow.
     - **`useImportType`** — type-only imports must use `import type { ... }`.
     - **No `console.log`** in production code — `noConsoleLog` is a Biome warning. Remove or replace.
     - **MIT header** on every `.ts` file under `packages/*/src/` and gate scripts under `scripts/`.
     - **Strict-mode obligations** — `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`.
   - Do not introduce unrelated refactors.
2. After each batch of edits, re-verify only the files you touched:
   - Biome: `npx biome check --apply <file1> <file2> ...` (lint + format together; `--apply` auto-fixes safe rules).
   - TypeScript: `pnpm typecheck` (chartlang's per-package `tsc` cannot type-check a subset reliably while honoring the package's `tsconfig.json`; if the per-file invocation produces noise, fall back to the full `pnpm typecheck` when ready to verify).
3. If a fix is non-obvious (rule disagreement, type model conflict, missing import path), read related files via Grep / Read before editing — never guess.

### Phase 3: Verify

1. Run `pnpm lint` and `pnpm typecheck` to re-collect Biome **and** TypeScript output across the whole workspace.
2. If any errors or warnings remain, return to Phase 2 with the new list.
3. Repeat Phases 2–3 until both gates exit cleanly with zero errors and zero warnings.

### Phase 4: Report

1. Summarize in 1–3 sentences: how many files were touched, how many Biome errors / warnings / TS errors were resolved, and the final gate status.
2. Do **not** commit or push — that is the user's call.

## Constraints

- Never disable lint rules (`// biome-ignore <rule>:`) or suppress TS errors (`// @ts-ignore`, `// @ts-expect-error`) to make a check pass. If a rule is genuinely wrong for a case, ask the user before suppressing.
- Never widen types to `any` or use `as` casts to silence TypeScript. Use `unknown` + narrowing, proper generics, or fix the underlying type.
- Never delete code purely to make errors disappear — fix the actual issue.
- Do not run `pnpm lint` / `pnpm typecheck` repeatedly on the full workspace during Phase 2; only the final Phase 3 verification re-runs the full gates.
- Stop and ask the user if the same error persists after two distinct fix attempts — there may be a deeper architectural issue.
