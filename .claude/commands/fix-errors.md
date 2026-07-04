---
description: Fix all chartlang gate failures via pnpm run check:content, run the conditional site e2e gate (pnpm check:site), then commit and run pnpm run check:committed.
---

# Fix Errors

## Purpose

You are a code-quality fixer. Your task is to make the chartlang workspace pass the full content gate (`pnpm run check:content`), then the conditional site e2e gate (`pnpm check:site`), then commit the result and make the committed gate (`pnpm run check:committed`) pass. Source the initial failure list either from the user's pasted output or by running `pnpm run check:content` yourself, then iterate until the gates are clean.

`check:content` runs the whole quality pipeline: `build`, `typecheck`, `lint`, `format:check`, `test`, `coverage:report`, `conformance` (+ `conformance:check`), `site:typecheck`, `site:build`, `bench:ci`, `docs:check`, `docs:gate`, `examples:gate`, `examples:sync`, `adapters:gate`, `docs:snippets`, `docs:build`, `hover:check`, `skills:gate`, `converter:docs:check`, and `readme:check`. A failure in any one stage fails the gate.

`check:site` (`scripts/check-site.ts`) is the Playwright e2e suite for `apps/site/`, deliberately excluded from `check:content` because it rebuilds the site and needs a Chromium install. It self-skips (exit 0) when nothing under `apps/site/` changed relative to the upstream branch, so it is always cheap to call — but it is the ONLY local gate that catches a site UI/selector change breaking the CI `E2E (apps/site/)` job.

## Task

### Phase 1: Source the failure list

1. Inspect the user's prompt for pasted gate output. Indicators:
   - Lines like `./path/to/file.ts:12:5 lint/<group>/<rule> ERROR ...` (Biome)
   - Lines like `path/to/file.ts(12,5): error TS2345: ...` (tsc)
   - Vitest failures, conformance diffs, gate scripts exiting non-zero (`adapters:gate`, `examples:sync`, `docs:check`, etc.)
2. **If failures are pasted:** parse them into a deduplicated list of `{ filePath, line, column, message, source }` entries and which gate stage produced them. Skip Phase 1.3.
3. **If nothing is pasted:** run the gate **exactly once** in a way that captures the complete failure output *and* the exit code together, so a single run is fully authoritative. Use:

   ```bash
   pnpm run check:content > /tmp/gate.log 2>&1; echo "EXIT: $?"
   ```

   Then read `/tmp/gate.log` (e.g. `grep`/Read for the failing stage and file paths) to enumerate the failures. **Do not** pipe the run straight to `tail`/`head` — a pipe discards the gate's exit code and truncates the failure list, which is exactly what forces a wasteful second run. One run must yield both the failures and the pass/fail verdict. Note the failing stage and every file path involved. Because the gate is ordered and fails fast, an early stage failure (e.g. `build` or `typecheck`) may hide later ones — expect to re-run after fixing the first failing stage.
   - **If this sourcing run already exits `0` (clean):** there is nothing to fix in the content gate. Skip Phases 2–3 entirely and go straight to Phase 4 (`pnpm check:site` — the site e2e can be red even when `check:content` is clean). Do not re-run `check:content` to "confirm" — the captured exit code is authoritative.

### Phase 2: Fix

1. Group issues by file and by failing gate stage. For each affected file:
   - Read the file.
   - Apply the minimal correct fix for every reported failure. Follow the chartlang conventions in `CONTRIBUTING.md` and the nearest `CLAUDE.md`:
     - **No `any`** — `noExplicitAny` is a Biome error. Use `unknown` + narrowing.
     - **No non-null assertions** (`x!`) — `noNonNullAssertion` is a Biome error. Refactor or narrow.
     - **`useImportType`** — type-only imports must use `import type { ... }`.
     - **No `console.log`** in production code — `noConsoleLog` is a Biome warning. Remove or replace.
     - **MIT header** on every `.ts` file under `packages/*/src/` and gate scripts under `scripts/`.
     - **Strict-mode obligations** — `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`.
   - For non-lint gate failures, fix the underlying cause, not the symptom:
     - **Generated-artifact gates** (`adapters:gate`, `examples:gate`, `examples:sync`, `docs:check`, `converter:docs:check`, `hover:check`, `readme:check`, `docs:snippets`) usually fail because a generated file drifted from its source. Run the matching generator (e.g. `pnpm adapters:generate`, `pnpm examples:sync`, the relevant `docs:*` generator) rather than hand-editing the generated output.
     - **`conformance` / `conformance:check`** failures mean output diverged from the recorded baseline — investigate the divergence; never blindly re-record a golden without confirming the change is intended.
     - **`test` / `coverage:report`** failures mean a real test broke or a branch went uncovered — fix the code or add the test.
   - Do not introduce unrelated refactors.
2. After each batch of edits, re-verify only the narrow gate you were fixing where possible (e.g. `pnpm lint`, `pnpm typecheck`, the specific `pnpm <stage>` script, or `npx biome check --write <files>`) before re-running the full gate.
3. If a fix is non-obvious (rule disagreement, type model conflict, missing import path, unexpected conformance diff), read related files via Grep / Read before editing — never guess.

### Phase 3: Verify the content gate

Run this phase **only after applying fixes in Phase 2** — if the Phase 1 sourcing run was already clean, you are in Phase 4, not here.

1. Run the gate once with the same capture-everything pattern — `pnpm run check:content > /tmp/gate.log 2>&1; echo "EXIT: $?"`, then read `/tmp/gate.log` — to re-collect failures across the whole pipeline and read the exit code from the same run.
2. If any stage fails, return to Phase 2 with the new list.
3. Repeat Phases 2–3 until `pnpm run check:content` exits cleanly. Each iteration is a single gate run — never re-run just to re-check the exit code.

### Phase 4: Conditional site e2e gate

Run this phase once `check:content` is clean (including when the Phase 1 sourcing run was already clean).

1. Run `pnpm check:site > /tmp/gate-site.log 2>&1; echo "EXIT: $?"`, then read `/tmp/gate-site.log`. The script self-skips (exit 0, "apps/site/ untouched") when nothing under `apps/site/` changed vs the upstream branch; otherwise it runs `site:e2e:install` + the full Playwright suite.
2. If the e2e suite fails, fix the cause with the Phase 2 discipline. Decide which side is stale: a UI/copy/selector change with an un-updated spec means fix the spec under `apps/site/tests/e2e/`; a genuine regression means fix the app code. Never loosen an assertion just to pass.
3. If a fix touched anything outside `apps/site/tests/`, re-run Phase 3 (`check:content`) first, then re-run `pnpm check:site`. Repeat until it exits 0.

### Phase 5: Commit, then verify the committed gate

1. Once `pnpm run check:content` and `pnpm check:site` are clean, stage and commit the working tree. If on the default branch, branch first per repo policy. Use a concise message describing the fixes and end it with the required `Co-Authored-By` trailer.
2. Run `pnpm run check:committed`.
3. If it fails, return to Phase 2, fix the cause, and amend or add a follow-up commit. Re-run `pnpm run check:committed` until it is clean.

### Phase 6: Report

1. Summarize in 1–3 sentences: how many files were touched, which gate stages were failing and are now resolved, the commit SHA/message, and the final status of `check:content`, `check:site`, and `check:committed`.

## Constraints

- Never disable lint rules (`// biome-ignore <rule>:`) or suppress TS errors (`// @ts-ignore`, `// @ts-expect-error`) to make a check pass. If a rule is genuinely wrong for a case, ask the user before suppressing.
- Never widen types to `any` or use `as` casts to silence TypeScript. Use `unknown` + narrowing, proper generics, or fix the underlying type.
- Never delete code purely to make errors disappear — fix the actual issue.
- Never re-record a conformance/golden baseline to silence a diff unless you have confirmed the behavior change is intended.
- Do not push — committing is part of this workflow, but pushing is the user's call.
- Stop and ask the user if the same failure persists after two distinct fix attempts — there may be a deeper architectural issue.
