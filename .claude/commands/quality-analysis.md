---
description: Analyze code quality, reusability, and conventions. Staff engineer review for diffs, branches, or task verification. Fixes all issues found and runs the chartlang gates.
model: opus
---

# Quality Analysis

You are a **senior staff engineer** conducting a thorough code quality review
of the chartlang workspace. Your job is to analyze code against the unified
quality rules below — scoped to the detected mode.

**Arguments**: $ARGUMENTS

## Step 1: Detect Mode

Determine the analysis mode using this priority chain. Stop at the first match.

| Priority | Condition | Mode | Scope |
|----------|-----------|------|-------|
| 1 | User mentions tasks in arguments (e.g. "tasks/phase-0-bootstrap/ all tasks", "tasks/phase-0-bootstrap/ task 3") | **Task** | Task requirements + all code introduced by the task |
| 2 | Current branch has an open PR | **PR** | Full PR diff + local diff if present |
| 3 | Not on default branch, no open PR | **Branch** | `git diff <default>...HEAD` + local diff if present |
| 4 | Local staged/unstaged changes exist | **Local** | `git diff` + `git diff --cached` |
| 5 | None of the above | — | Tell the user there are no changes to analyze and **stop** |

### Detection commands

```bash
git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo main
git branch --show-current
gh pr view --json number,title,baseRefName,url 2>/dev/null
git status --porcelain
```

If mode is **Task**, skip to the Task-specific instructions in Step 2.

## Step 2: Gather Context

### Diff modes (PR, Branch, Local)

Collect the diff for the detected mode:

| Mode | Diff commands |
|------|---------------|
| **PR** | `gh pr diff` for the full PR diff. Also `git diff` + `git diff --cached` if local changes exist. Fetch review comments: `gh pr view --json reviews,comments` |
| **Branch** | `git diff <default>...HEAD` for all committed work on the branch. Also `git diff` + `git diff --cached` if local changes exist |
| **Local** | `git diff` + `git diff --cached` |

When both PR/Branch diff and local diff are present, deduplicate overlap and
clearly label sections:

- **Local changes** — violations found in unstaged/staged diff
- **PR changes** / **Branch changes** — violations found in the broader diff

For each file in the diff, read the **full file** for surrounding context
(imports, function signatures, neighboring code).

For files with non-trivial changes, optionally check `git log --oneline -5 <file>`
and inline code comments (`// IMPORTANT:`, `// NOTE:`, `// WARNING:`,
`// HACK:`) near modified lines. Flag if the diff contradicts explicit inline
guidance or reintroduces a previously reverted pattern.

### Task mode

1. **Locate task files** — the argument includes a folder path and task
   specifier (e.g. `tasks/phase-0-bootstrap/ task 3`). Parse the folder
   path and the task specifier (`all tasks`, `task 3`, `tasks 3 and 5`).
   If `all tasks`, list all `N-*.md` and `X-N-*.md` files in that folder.
   Otherwise resolve the referenced task numbers. If ambiguous, list
   candidates and ask.
2. **Parse requirements** — for each task file, extract every discrete
   requirement, acceptance criterion, and specification.
3. **Audit implementation** — for each requirement, use `Explore`
   subagents (one per task, max 5 concurrent) to search the workspace
   for the corresponding implementation. Check that the code exists, is
   wired up, and matches the spec.
4. **Read all implemented code** — for each file introduced or modified
   by the task, read the full file for context.

### Task file naming convention

Task files follow a naming convention that indicates their status:

- **`X-` prefix** (e.g. `X-2-scaffold-script-and-packages.md`) — the
  task has been previously marked as done. Still verify it thoroughly,
  but note its pre-existing "done" status in your output.
- **No prefix** (e.g. `2-scaffold-script-and-packages.md`) — the task
  has not been marked as done yet.

When resolving user references (e.g. "task 2"), match against both
prefixed and non-prefixed filenames. If both exist, prefer the `X-`
prefixed version.

## Review Style

- Be direct and specific. Point to exact lines and explain why they're
  problematic.
- Make your own judgement calls. Only ask the developer a question when
  there is a genuine ambiguity you cannot resolve from the code alone.
  Do not ask rhetorical or "make the developer think" questions — state
  your analysis directly.
- After a mediocre fix, challenge: **"Knowing everything you know now,
  scrap this and implement the elegant solution."**

## Step 3: Check Against Quality Rules

### Diff modes — Parallel Review

For diff modes (PR, Branch, Local), launch **4 parallel review agents**
(Sonnet model) using the Task tool. Pass each agent the diff, the full
file contents read in Step 2, and its assigned rules (copied verbatim
from the rule reference below).

| Agent | Rules | Focus |
|-------|-------|-------|
| A | 1, 6 | **Conventions & Types** — TS strict-mode + Biome + project conventions |
| B | 2, 3 | **Reusability & Placement** — deduplication + cross-package boundary |
| C | 7, 8 | **Correctness, Robustness & Edge Cases** — math, sandbox, capability gating, gates |
| D | 4, 5 | **Code Health** — new SATD, complexity, nested ternaries, dense one-liners |

Each agent must:

- Only flag violations **in or directly caused by the diff** — never
  flag pre-existing issues in unchanged code.
- Score each issue 0–100 using the confidence rubric below.
- Include the rule number, `file:line`, and a specific fix.
- Apply the false-positive avoidance list from Constraints.

#### Confidence rubric (include verbatim in each agent prompt)

- **0**: False positive or pre-existing issue
- **25**: Might be real, might be false positive. Stylistic issues not
  explicitly backed by a project rule
- **50**: Real issue but a nitpick or unlikely to matter in practice
- **75**: Verified real issue that will be hit in practice, or directly
  cited in a project rule
- **100**: Confirmed definite issue with clear evidence

#### Consolidation

After all 4 agents return:

1. **Filter out issues with confidence < 80**.
2. Deduplicate — if multiple agents flag the same line, keep the
   highest-confidence version.
3. Assign impact levels (HIGH/MEDIUM/LOW) per the Impact Guidelines in
   Step 4.
4. If no issues survive filtering, report a clean bill of health.

### Task mode

Check **all code introduced by the task** against all 8 rules below.
Use the existing Explore subagent approach (one per task, max 5
concurrent) for requirement verification, then check all introduced
code against all rules directly — no confidence scoring in task mode
since issues are reported as requirement statuses.

---

The following rules are distributed across the 4 parallel agents in
diff modes. In task mode, check all rules directly.

---

### Rule 1 — TypeScript & Biome

chartlang TS is configured with strict + `exactOptionalPropertyTypes` +
`verbatimModuleSyntax` + `noImplicitOverride` + `noImplicitReturns` +
`noUnusedLocals` + `noUnusedParameters` + `noFallthroughCasesInSwitch` +
`isolatedModules`. Biome enforces additional rules.

| Anti-pattern | Fix |
|---|---|
| `any` (Biome: `noExplicitAny` error) | `unknown` + type guards, proper generics |
| `x!` non-null assertion (Biome: `noNonNullAssertion` error) | Narrow with a check; refactor to remove the asserted nullable |
| `import { type T }` mixed with values (Biome: `useImportType` error) | `import type { T }` separate from value imports |
| `as` between two known, incompatible types | Fix the underlying type model. `as const`, `unknown→T` narrowing, and brand-safe conversions are still allowed |
| Manual return-type widening to silence a strict-mode error | Actually fix the inferred type |
| `console.log` in `packages/*/src/` (Biome: `noConsoleLog` warning) | Remove, or route through a documented logging surface |
| Stringly-typed enum | `const X = ["a","b"] as const` + `type X = typeof X[number]` |
| Non-exhaustive `switch` with no `never` default | Add a `default: const _exhaustive: never = x;` |
| Missing JSDoc on a new export | Add `@example`, `@since`, stability marker (`@stable`/`@experimental`/`@frozen`). `ta.*` / `draw.*` also need `@formula` + `@anchors`; warmup-bearing primitives need `@warmup` |

---

### Rule 2 — Reusability & Deduplication

- **Duplicated logic**: Does the diff introduce a function/utility/test
  helper that already exists elsewhere? Search before flagging.
- **Existing helpers ignored**: Check if the code reimplements something
  that already exists in `packages/core/src/`,
  `packages/runtime/src/ta/_lib/` (or equivalent),
  `packages/compiler/src/_lib/`, `packages/adapter-kit/src/`, or
  `scripts/`. Flag with a pointer to the existing code.
- **Dead code**: Does the diff add exports never imported? Are they
  excluded from coverage by being routed through `index.ts` / `types.ts`
  (the only files excluded from the 100% gate)? Real logic hiding in
  the barrel to dodge coverage is a HIGH issue.
- **Inconsistent patterns**: Does the diff solve a problem differently
  from how it's solved in sibling files in the same package?
- **Warmup / NaN / bar-walking duplication** across `ta.*` primitives is
  the single most common dedup hit — flag and propose extraction to a
  package-private helper.

#### Search-Before-Creating Checklist

If the diff **creates** a new file, type, helper, or test fixture,
verify it doesn't already exist:

| Looking for… | Search first |
|---|---|
| Type used across packages | `packages/core/src/` — the type contract hub |
| ta-internal helper (warmup, NaN, ring-buffer) | `packages/runtime/src/ta/_lib/` (or the existing convention) |
| Compiler AST visitor / scope helper | `packages/compiler/src/_lib/` |
| Adapter capability key / surface helper | `packages/adapter-kit/src/` |
| Conformance scenario / golden fixture | `packages/conformance/scenarios/` |
| Gate / tooling utility | `scripts/` |
| CLI subcommand | `packages/cli/src/` |

---

### Rule 3 — Code Sharing & Placement

Follow chartlang's cross-package boundary rules:

| Consumers | Correct location |
|---|---|
| Type / contract used by 2+ packages | `packages/core/src/` (with JSDoc + tests) |
| Conformance scenario used by adapter + adapter-kit + worker | `packages/conformance/scenarios/` |
| Helper used by 2+ ta primitives in the same package | Package-private `_lib/` (not exported) |
| Cross-package shared logic | Public surface of the owning package, imported via `@invinite-org/chartlang-<name>` |
| Workspace tooling | `scripts/<name>.ts` |

- **No cross-package source imports** — never import from
  `../../<sibling>/src/`. Cross-package use goes through the public
  package surface (`@invinite-org/chartlang-<name>`).
- **Public surface bloat** — flag exports added to `index.ts` that
  should be package-private.
- **Hand-written §22.4 template files** — `package.json`,
  `tsconfig.json`, `vitest.config.ts`, `README.md`, `src/index.ts`,
  `src/index.test.ts` are owned by `scripts/scaffold.ts`. Hand-edits
  are a HIGH issue; the fix is to update `scaffold.ts` and re-run
  `pnpm scaffold`.
- **Hand-edited generated docs** — `docs/primitives/*` is owned by
  `packages/cli/src/gen-docs.ts`. Hand-edits are a HIGH issue.

---

### Rule 4 — SATD Detection

Flag any **new** `TODO`, `FIXME`, or `HACK` comments introduced in the
diff. Pre-existing ones are out of scope. If a `TODO` is the right call
for the scope, it must reference a tracking artifact (task file, issue,
PLAN.md section).

---

### Rule 5 — Complexity Heuristics

- **Large functions**: any new or modified function exceeding ~50 lines
  — suggest extraction.
- **Deep nesting**: 4+ levels of nesting (`if`/`for`/`try`) — suggest
  flattening with early returns.
- **Cyclomatic complexity**: functions with many branches (>10 paths) —
  suggest decomposition (each branch must also be coverage-hit).
- **Nested ternaries**: 2+ levels deep — replace with `if`/`else` or
  `switch`.
- **Dense one-liners**: chained operations that sacrifice readability —
  break into named intermediate steps.

---

### Rule 6 — Project Conventions

Flag violations of these chartlang conventions (from `PLAN.md`,
`CONTRIBUTING.md`, the nearest `CLAUDE.md`):

- **MIT header**: every `.ts` file in `packages/*/src/` (and gate
  scripts in `scripts/`) must start with the two-line MIT header.
  Documented exception: `scripts/scaffold.ts`.
- **§22.4 template intactness**: never hand-edit the six scaffold-owned
  files per package. Add via `PACKAGE_DIRS` + `pnpm scaffold`.
- **JSDoc gate (`pnpm docs:check`)**: every export has `@example`,
  `@since`, stability marker. `ta.*` / `draw.*` also need `@formula`
  + `@anchors` (`@warmup` where relevant).
- **README gate (`pnpm readme:check`)**: root README ≤ 300 lines;
  package README ≤ 100 lines following §17.1 structure (title,
  stability label, purpose, install, public surface, minimum-viable
  API call, docs link, license).
- **Auto-generated docs**: `docs/primitives/*` is owned by gen-docs.
  Hand-edits are forbidden.
- **Provenance header**: any new `ta.*` math ported from
  `../invinite/` carries the 4-line provenance + relicense header
  (PLAN.md §3.1).
- **No new lint/format tooling**: Biome is the single tool.
- **Adapter capability gating**: unsupported features become silent
  no-ops, not throws. Emits that don't consult the capability surface
  are a bug.
- **Changeset**: any PR touching `packages/*/src/` must include a
  changeset under `.changeset/` (`pnpm changeset`).
- **Sandbox surface**: `host-worker` and `host-quickjs` changes that
  cross the script/host boundary must be backed by sandbox-escape
  tests.
- **File extension**: chartlang scripts are `.chart.ts` (not `.chartlang`,
  not `.ts` without the suffix). Compiler / CLI examples should reflect
  this.

---

### Rule 7 — Correctness & Robustness

- **Correctness**: Does the code do what it claims? Walk warmup math
  by hand for `ta.*` changes.
- **Goldens are the contract**: any change that shifts a golden bar
  series owes a `@since` bump, a stability marker review, and a
  changeset explanation. Unintentional drift is HIGH.
- **NaN propagation**: does a NaN input correctly silence output for the
  current bar without poisoning the warmup state for subsequent bars?
- **Capability gating**: every `runtime` emit consults the adapter
  capability surface; unsupported features become no-ops.
- **Sandbox boundary**: `host-*` packages must not leak `Function`,
  `Realm`, prototype-chain reach, or top-level `globalThis` into
  script land.
- **Bench drift**: changes to a hot path should keep `pnpm bench:ci`
  noise-clean; large regressions need acknowledgement.
- **Error handling**: what happens when an adapter throws? What happens
  on malformed bar input?
- **Inline guidance**: do changes contradict nearby `// IMPORTANT:`,
  `// NOTE:`, `// WARNING:`, or `// HACK:` comments? Flag
  contradictions.

---

### Rule 8 — Edge Case Coverage

Rule 7 catches what's written incorrectly. Rule 8 catches what *isn't
written at all but should be*. Walk the diff through each category and
ask: **"Does this code handle X, and if not, should it?"** Only flag
when the missing handling is in scope for the change — pre-existing
gaps and speculative future scenarios are not.

There is intentional overlap with Rules 1, 3, and 6. Flag at the most
specific rule and do not double-count.

#### 8a — Math & primitive behavior

- Warmup window: first N bars produce the documented value (NaN, seed
  value, or whatever `@warmup` declares)?
- Bar indexing: off-by-one from `0` vs `length - 1`.
- NaN input handling for `series.close` / `series.high` / etc.
- Source-series selection variants documented (close vs hlc3 vs ohlc4)?

#### 8b — Compiler

- Slot id stability across re-runs on unchanged source.
- Nested `ta.*` calls each get their own slot.
- New AST pass ordering doesn't conflict with existing passes.
- Script with type errors is rejected before the bundler stage.

#### 8c — Runtime

- Capability lookup happens **before** emit (not after).
- Unsupported capability path returns a silent no-op (not throw).
- Bar-by-bar state retention is reset between independent script runs.
- Multi-output primitives (e.g. macd → macd/signal/histogram) emit all
  outputs even when one is NaN.

#### 8d — Host / sandbox

- New script-reachable API surface has a corresponding sandbox-escape
  test.
- `host-quickjs` and `host-worker` parity for the new surface (or
  documented capability difference).
- Transferable cloning preserves type information across the boundary.

#### 8e — Adapter contract

- New capability key is declared in `adapter-kit` and consumed by both
  the runtime and the reference adapter.
- Conformance scenario added for the new capability.
- Capability mismatch (script wants feature, adapter doesn't declare
  it) is a silent no-op.

#### 8f — Public surface / API

- New export gets `@example`, `@since`, stability marker.
- New export is added to `src/index.ts` (or intentionally package-private).
- Stability bump on the export honors semver (breaking change → major bump
  in the changeset; new surface → minor; bug fix → patch).
- Removed export: a deprecation cycle was honored (or it was `@experimental`).

#### 8g — Docs

- New hand-authored `docs/<area>/` page for a new concept.
- `pnpm docs:check` still passes (JSDoc completeness).
- `pnpm readme:check` still passes (length + structure).
- `docs/primitives/<area>/<id>.md` regenerated (do not hand-edit) for
  new `ta.*` / `draw.*`.

#### 8h — Test layer completeness (per PLAN.md §16.3)

| Package | Required layers |
|---|---|
| `core` | unit + type |
| `compiler`, `runtime` | unit + property + golden + bench |
| `host-worker` | unit + sandbox-escape + bench + conformance |
| `host-quickjs` | unit + sandbox-escape + bench |
| `adapter-kit` | unit + type + conformance |
| `language-service`, `editor`, `cli` | unit |
| `conformance` | unit + conformance |
| `examples/canvas2d-adapter` | unit + golden + conformance |

For new `ta.*` / `draw.*` primitives, the **§22.10 set** is mandatory:
unit, property, golden, bench, JSDoc with `@formula`+`@warmup`,
conformance scenario, auto-generated docs page.

#### 8i — Provenance & relicensing

- `../invinite/` port carries the 4-line provenance + relicense header
  (PLAN.md §3.1).
- Golden bars match the source's behavior numerically; translation
  (not transcription) is the path.

#### 8j — Coverage

- Coverage gate stays at 100% line/statement/branch/function.
- New branches are either covered by a real test or removed.
- Real logic is not hiding in `src/index.ts` / `types.ts` to dodge the
  coverage exclusion list.

#### 8k — Changeset

- Every `packages/*/src/` diff has a corresponding `.changeset/*.md`.
- Semver bump matches the change shape (patch / minor / major).

#### Severity for edge-case gaps

- **HIGH**: Missing handling produces broken or unsafe code (golden
  drift, capability ungated emit, sandbox-escape leak, coverage drop,
  missing changeset, missing provenance header).
- **MEDIUM**: Missing handling produces suboptimal code (missing
  property test for new shape, missing conformance scenario for a new
  capability, README length drift, missing `@since`).
- **LOW**: Stylistic gaps (missing `@example`, generic JSDoc, minor
  README structure drift).

---

## Step 4: Report

### Diff modes (PR, Branch, Local)

For each violation found, output:

```
**[impact]** `file:line` — category
Description of what's wrong.
→ Fix: specific instruction on how to fix it.
```

Where `[impact]` is one of: **HIGH**, **MEDIUM**, **LOW**.

Group findings by package, then by file. If there are no violations,
say so.

#### Impact Guidelines

- **HIGH**: Type safety holes (`any`, `!`), coverage drop, golden drift,
  capability ungated emit, sandbox-escape leak, hand-edit to a
  generated doc / scaffold-owned file, missing changeset, missing
  provenance header, missing §22.10 element on a new `ta.*` primitive.
- **MEDIUM**: Missing `@since` / stability marker / `@formula` /
  `@warmup`, README length drift, dedup miss, missing conformance
  scenario for a new capability, missing property test for a new
  shape.
- **LOW**: Naming-convention drift, missing `@example`, complexity
  warnings, minor stylistic gaps.

When reviewing a PR, note the PR number and link at the top.

### Task mode

Output a table per task:

```
## Task N: <Task Title>

| # | Requirement | Status | Details |
|---|-------------|--------|---------|
| 1 | <requirement summary> | <status> | <details> |
| 2 | ... | ... | ... |
```

**Status values:**

- `Done` — fully implemented and matches the spec
- `Partial` — implementation exists but is incomplete or differs from spec
- `Missing` — no implementation found
- `Issue` — implemented but has a bug, type error, duplicate code, missing
  gate-required tag, or other problem that should be fixed
- `Improvement` — code works but could be better (e.g. extract shared
  helper, tighten types, add property test)

Quality rule violations go in the same table with a `[Quality]` prefix
in the Requirement column.

After all task tables, output an **Overall Summary**:

```
## Overall Summary

| Task | Done | Partial | Missing | Issue | Improvement | Verdict |
|------|------|---------|---------|-------|-------------|---------|
| Task N: <title> | X | Y | Z | W | V | <verdict> |
```

**Verdict values:**

- `Complete` — all requirements Done
- `Mostly Complete` — minor gaps only
- `Incomplete` — significant requirements missing or broken

## Step 5: Grading

**Applies to all modes.**

Only ask questions if there is a genuine ambiguity that blocks grading.
Otherwise, assign the grade directly based on your analysis. In task
mode, assign a grade per task and one overall.

- **Ship**: Code is clean, correct, handles edge cases, follows
  conventions. Gates green. Ready for review.
- **Needs work**: Generally solid but has specific issues that must be
  addressed. List them explicitly.
- **Rethink approach**: Fundamental problems with the approach. Step
  back and reconsider the design.

## Step 6: Fix Issues

After reporting and grading, **fix all HIGH, MEDIUM and LOW issues**
found in Steps 3–4. For each issue:

1. Edit the code directly to resolve the issue.
2. Track all files you modified.

**Exception:** If a later task in the same task folder will explicitly
address the issue, skip the fix and note it as deferred.

## Step 7: Verify the Gates

After fixing issues, run the chartlang gates on the touched packages:

1. **Typecheck:**
   ```bash
   pnpm typecheck
   ```
2. **Biome:**
   ```bash
   pnpm lint
   ```
3. **Tests (with coverage):**
   ```bash
   pnpm test
   ```
   Or filter to affected packages: `pnpm --filter @invinite-org/chartlang-<name> test`.
4. **Doc gates** if JSDoc or README files were touched:
   ```bash
   pnpm docs:check
   pnpm readme:check
   ```
5. **Conformance** if a `ta.*` / `draw.*` primitive or an adapter
   surface changed:
   ```bash
   pnpm conformance
   ```

Fix all errors and re-run until each gate is green on the changed
packages.

**Do not run `pnpm build`** unless verifying an emit-shape concern.

## Step 8: Rename Completed Task Files

**Task mode only.** After grading, if a task's verdict is **Complete**
and its task file does **not** already have the `X-` prefix, rename it:

```bash
git mv tasks/<phase>/N-task-name.md tasks/<phase>/X-N-task-name.md
```

This marks the task as done for future runs. Do this for every task
that received a **Complete** verdict and a **Ship** grade.

## Constraints

- Only report on code in scope for the detected mode — never flag
  pre-existing issues in unchanged code (diff modes) or unrelated code
  (task mode).
- Read changed/implemented files for context but do not scan unrelated
  directories.
- Fix all HIGH, MEDIUM and LOW issues found — do not just report them.
- Maximum of 5 parallel subagents at any time (task mode).
- Be specific — cite file paths and line numbers where possible.
- If a requirement is ambiguous in the task file, note it but still
  attempt to verify (task mode).
- Check the gates relevant to the touched packages (per the §16.3
  table).
- Only ask questions when there is a genuine ambiguity blocking the
  grade.
- All output must be in English.

### False positive avoidance

Do not flag:

- Pre-existing issues in unchanged code.
- Intentional functionality changes that are directly related to the
  task/PR purpose (e.g. an intentional golden update bundled with a
  semver-major changeset).
- Issues explicitly silenced in code (`biome-ignore` / `@ts-expect-error`
  with explanation).
- Pedantic nitpicks a senior engineer wouldn't call out in review.
- General code-quality opinions not backed by a specific rule above.
