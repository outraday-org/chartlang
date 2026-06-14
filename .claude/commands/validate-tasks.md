---
description: Double-check and validate a chartlang task folder for gaps, issues, and improvements. Directly fixes all problems found in the task files.
model: opus
---

# Validate Tasks

## Purpose

You are a **senior technical reviewer** specializing in task quality
assurance for the chartlang workspace. Your job is to validate a task
folder written by `/write-tasks`, find gaps, inconsistencies, and
issues, and **fix them directly** in the task files. You run after task
authoring is complete, before execution begins.

**Arguments**: $ARGUMENTS

The argument should be either:

- A **task folder** path (e.g. `tasks/phase-0-bootstrap/`) — validates
  all tasks.
- A **single task file** path (e.g.
  `tasks/phase-0-bootstrap/3-gate-helper-scripts.md`) — validates just
  that task (still reads README and sibling tasks for context).

## Step 1: Detect Mode and Load Tasks

### 1a. Determine scope

- If the argument points to a **directory** (or ends with `/`),
  validate all tasks in the folder (**full mode**).
- If the argument points to a **single `.md` file**, validate only
  that task (**single mode**). Still read the parent folder's README
  and sibling tasks for context, but only report/fix issues in the
  target task.

### 1b. Load files

1. Read the `README.md` in the task folder (or the target file's
   parent folder).
2. In **full mode**: list and read **all** task files matching `N-*.md`
   (exclude `X-` prefixed).
3. In **single mode**: read the target task file. Also read `X-`
   prefixed siblings for context on what's already done.
4. Read `CONTRIBUTING.md` and any package-local `CLAUDE.md`
   relevant to the tasks.

## Step 2: Validate Against the Workspace

Launch **parallel Explore subagents** (one per task, max 5 concurrent)
to verify every concrete reference in each task file:

### 2a. File path verification

For every file path mentioned in a task:

- Verify the file (or its parent directory) exists at that path.
- For files yet to be created, verify the path obeys chartlang
  conventions (`packages/<name>/src/...`,
  `examples/canvas2d-adapter/src/...`, `scripts/...`,
  `docs/<area>/...`).
- Check that referenced functions, types, helpers, and capability keys
  exist or are scheduled to exist by an earlier task.

### 2b. Public surface and type verification

For every type, capability key, primitive, or export referenced:

- Verify it exists in the named package (`packages/<name>/src/`) or is
  declared by a lower-numbered task.
- Check that JSDoc tags referenced in the task match the docs gate
  requirements (`@example`, `@since`, stability marker; `@formula` +
  `@anchors` + `@warmup` for `ta.*` / `draw.*`).
- For ports from `../invinite/`: verify the source file exists at the
  named path under `../invinite/` and the commit SHA is plausible
  (40-char hex).

### 2c. Existing code detection

For every new file, type, helper, or scenario a task proposes to
create:

- Search the workspace to check if it already exists (partially or
  fully). Check `packages/core/src/`,
  `packages/runtime/src/ta/_lib/`, `packages/compiler/src/_lib/`,
  `packages/adapter-kit/src/`, `packages/conformance/scenarios/`,
  `scripts/`.
- Search for naming conflicts (same name, different module).
- Check if the functionality already exists under a different name.
- If a near-equivalent exists: prefer **extending or reusing** the
  existing symbol over creating a parallel version. Fix the task to
  reference the existing import path and note any extension needed.
- Check for **deleted / guarded concepts** that must not be
  reintroduced (e.g. hand-edited `docs/primitives/*`, hand-written
  §22.4 template files, ESLint or Prettier configs).

### 2d. Dependency verification

For each task's stated prerequisites:

- Verify the dependency exists as a task file.
- Verify the dependency covers what the dependent task claims it
  provides.
- Check for **unstated dependencies** — does a task implicitly require
  something from another task without declaring it (e.g. a runtime
  task that needs a `core` type the previous task didn't add)?

## Step 3: Structural Analysis

### 3a. Task sizing

For each task, evaluate against the sizing rules from `/write-tasks`:

- **Too small?** (< 50 lines of real code change, exists solely to
  enable the next task) — flag for merging.
- **Too large?** (spec > ~400 lines, 2+ independent primitives or
  passes mixed in) — flag for splitting.
- **Right size?** (spec ~200–300 lines, one clear deliverable).

### 3b. Ordering validation

Walk through tasks 1, 2, 3, ... in sequence and confirm:

- Each task's prerequisites are satisfied by lower-numbered tasks.
- `core` types come before any consuming package.
- `adapter-kit` capability changes come before runtime gating and
  adapter implementations.
- Compiler passes come before runtime emit consumers.
- `pnpm scaffold` runs before the package src is populated.
- Conformance scenarios come after the surface they exercise.
- No circular dependencies exist.

### 3c. Coverage analysis

Check for **gaps** — work that is needed but not covered by any task:

- New `ta.*` / `draw.*` missing one of the §22.10 set (unit, property,
  golden, bench, JSDoc with `@formula`+`@warmup`, conformance scenario,
  auto-generated docs page).
- New public export missing `@since` / stability marker / `@example`.
- New capability key missing the conformance scenario that exercises it.
- New package missing the `PACKAGE_DIRS` append + `pnpm scaffold` step.
- Missing changeset for a `packages/*/src/` change.
- Provenance header missing for an `../invinite/` port.
- New host-side surface missing sandbox-escape tests.
- README length / structure drift after the task lands.
- Coverage gate: a branch the task introduces without a matching test.

### 3d. Redundancy detection

Check for **overlap** between tasks:

- Two tasks creating the same file or modifying the same exported
  symbol.
- Duplicate work spread across tasks (e.g. both task 2 and task 4
  define the same helper).
- Unnecessary intermediate tasks that could be folded into their
  consumers.

### 3e. Reusability and code placement

For every new file, type, helper, or scenario that genuinely needs to
be created, verify it is placed where every actual consumer can import
it — not buried in one package's `_lib/` when multiple packages will
use it.

**Cross-package placement:**

- Type / contract used by 2+ packages → `packages/core/src/`
- Conformance scenario used by adapter + adapter-kit + worker →
  `packages/conformance/scenarios/`
- Helper used by 2+ ta primitives in the same package →
  package-private `_lib/`
- Cross-package shared logic → public surface of the owning package,
  imported via `@invinite-org/chartlang-<name>` (never relative path
  into a sibling `src/`)
- Workspace tooling → `scripts/<name>.ts`

**Within-package placement:**

- Public exports → `src/index.ts` (barrel; excluded from coverage)
- Declarations-only → `src/types.ts` (excluded from coverage)
- Real logic → dedicated files, all coverage-covered
- Package-private helpers → `_lib/` (or the package's existing
  convention)

**Extract-and-share opportunities the task missed:**

- Are there existing helpers that do almost the same thing? If yes,
  and there will be ≥ 2 real consumers, the task should refactor the
  existing helper to share with the new one rather than write a
  parallel implementation.
- Are two new tasks each introducing a similar helper / scenario?
  Consolidate into one shared symbol referenced by both.

**Do not flag speculative reuse.** Only flag when there is actual
current duplication (≥ 2 real consumers of near-identical logic).
Premature abstraction with one consumer is worse than waiting for the
second consumer.

When a placement / reuse issue is found, fix the task to:

- reference the existing symbol (with correct import path), OR
- move the new file to the correct package, OR
- add an explicit requirement to refactor the existing implementation
  to share with the new consumer (with both old and new call sites
  listed in `Files to Create/Modify`).

## Step 4: Content Quality Review

For each task file, check:

### 4a. Requirements quality

- Are requirements specific enough to implement without guessing?
- Do they include exact file paths, JSDoc tags, capability key names,
  test-layer expectations?
- Are code snippets accurate (correct import paths, correct types)?
- For `ta.*`: is the `@formula` content stated and the `@warmup` value
  given?

### 4b. Acceptance criteria quality

- Is every requirement reflected in the acceptance criteria?
- Are criteria testable / verifiable?
- Are the required CI gates listed (`pnpm typecheck`, `pnpm lint`,
  `pnpm test`, `pnpm docs:check`, `pnpm readme:check`, `pnpm conformance`
  where relevant)?

### 4c. Files to Create/Modify table

- Does the table include all files the task will actually touch?
- Are any files listed that shouldn't be (e.g. hand-edits to
  scaffold-owned templates, hand-edits to generated docs)?
- Are the stated actions (Create/Modify) correct?

### 4d. Consistency

- Do task files use consistent terminology?
- Do package names match the workspace (`@invinite-org/chartlang-<name>`)?
- Do capability keys and JSDoc tags match the codebase conventions?
- Are the same concepts named the same way across all tasks?

## Step 5: Second Wave — Edge Case Sweep

Steps 2-4 catch *what's specified but wrong*. This step catches
*what isn't specified at all but should be*. Walk every task through
each category below and explicitly answer: **"Does this task handle X,
and if not, should it?"**

### 5a. Math edge cases (for `ta.*` / `draw.*` tasks)

- Warmup window: first N bars produce the documented value (NaN, seed,
  or whatever `@warmup` declares)?
- Bar indexing: off-by-one from `0` vs `length - 1`?
- NaN input on `series.close` / `series.high` / etc. — silenced for the
  current bar without poisoning warmup state?
- Source-series variant selection (close vs hlc3 vs ohlc4) documented?
- Goldens: which canonical bar series exercises the primitive; what
  numerical tolerance?

### 5b. Compiler edge cases

- Slot id stability across re-runs on unchanged source?
- Nested `ta.*` calls each get their own slot?
- New AST pass ordering doesn't conflict with existing passes?
- Script with type errors is rejected before the bundler stage?

### 5c. Runtime edge cases

- Capability lookup happens **before** emit?
- Unsupported capability path returns a silent no-op (not throw)?
- Bar-by-bar state retention is reset between independent script runs?
- Multi-output primitives emit all outputs even when one is NaN?

### 5d. Host / sandbox edge cases

- New script-reachable API surface has a corresponding sandbox-escape
  test?
- `host-quickjs` and `host-worker` parity for the new surface
  (or documented capability difference)?
- Transferable cloning preserves type info?

### 5e. Adapter contract edge cases

- New capability key declared in `adapter-kit` and consumed by both the
  runtime gate and the reference adapter?
- Conformance scenario added for the new capability?
- Capability mismatch (script wants feature, adapter doesn't declare
  it) is a silent no-op?

### 5f. Public surface / API

- New export has `@example`, `@since`, stability marker?
- New export added to `src/index.ts` (or intentionally package-private)?
- Stability bump on the export honors semver (breaking → major; new
  surface → minor; bug fix → patch)?
- Removed export honors a deprecation cycle (or was `@experimental`)?

### 5g. Provenance & relicensing

- `../invinite/` ports carry the 4-line provenance + relicense header?
- "Translate, not transcribe" — task explicitly says the goldens (not
  the source code style) are the contract?
- Source path + commit SHA recorded in the README's Provenance section?

### 5h. Test layer completeness (per CONTRIBUTING.md §2)

Walk the affected package against this table:

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

For new `ta.*` / `draw.*` primitives the **§22.10 set** is mandatory.

### 5i. Coverage gate

- Does the task introduce a branch without a matching test?
- Is real logic hiding in `src/index.ts` / `types.ts` to dodge the
  coverage exclusion list?

### 5j. Docs

- New hand-authored `docs/<area>/` page for a new concept?
- `pnpm docs:check` still passes (JSDoc completeness on all exports)?
- `pnpm readme:check` still passes (package ≤ 100 lines, root ≤ 300
  lines)?
- `docs/primitives/<area>/<id>.md` flagged as auto-generated (the
  task must not hand-edit it; it must run gen-docs)?

### 5k. Changeset

- Every `packages/*/src/` diff has a corresponding `.changeset/*.md`
  noted in the task?
- Semver bump matches the change shape?

### 5l. Tooling drift

- New / changed entries in `.claude/commands/`, `.claude/agents/`, or
  `.claude/skills/` referenced by the task?
- Folder-level `CLAUDE.md` update needed for a non-obvious invariant
  introduced by the task?

### Output of Step 5

Fold edge-case gaps into the Step 6 per-task finding tables using
`Category = "Edge case"` plus a sub-tag (e.g. `Edge case / Warmup`,
`Edge case / Capability`, `Edge case / Sandbox`, `Edge case / Coverage`).
Apply the same severity scale:

- **Critical**: missing handling will produce broken or unsafe code
  (golden drift, capability ungated emit, sandbox-escape leak,
  coverage drop, missing changeset, missing provenance header).
- **Moderate**: missing handling will produce suboptimal code
  (missing property test, missing conformance scenario, missing
  `@since`, README length drift).
- **Minor**: stylistic gaps (missing `@example`, generic JSDoc).

Critical and Moderate edge-case gaps must be fixed in Step 7 alongside
first-wave findings. If an edge case is a genuine architectural
decision, surface it via `AskUserQuestion` rather than guessing.

## Scope Rules for Single vs Full Mode

- **Full mode**: All checks apply to all tasks. Cross-task issues are
  reported and fixed. README is updated for structural changes.
- **Single mode**: Steps 2-5 run only against the target task.
  Cross-task checks (3b ordering, 3d redundancy) still run but only
  report/fix issues that affect the target task. README updates are
  limited to the target task's row in the summary table.

## Step 6: Report Findings

Output a structured report:

```
## Validation Report: <feature-name>

### Summary
- Tasks validated: N
- Issues found: N (X critical, Y moderate, Z minor)

### Per-Task Findings

#### Task N: <title>

| # | Category | Severity | Finding | Fix |
|---|----------|----------|---------|-----|
| 1 | Stale path | Critical | `packages/runtime/src/old.ts` doesn't exist | Correct to `packages/runtime/src/ta/rsi.ts` |
| 2 | Missing dep | Moderate | Implicitly needs Task 2's capability key | Add to Prerequisites |
| 3 | Sizing | Minor | Spec is 80 lines; merge candidate | Merge into Task N+1 |

### Cross-Task Issues

| # | Category | Severity | Finding | Fix |
|---|----------|----------|---------|-----|
| 1 | Gap | Critical | No task lands the conformance scenario | Add to Task 4 |
| 2 | Overlap | Moderate | Tasks 2 and 4 both extract the warmup helper | Consolidate in Task 2 |
| 3 | Ordering | Critical | Task 3 needs Task 4's capability key | Swap order or move the key add |

### README Issues

| # | Finding | Fix |
|---|---------|-----|
| 1 | Dependency graph doesn't match task numbers | Update graph |
| 2 | Code reuse table missing existing helper X | Add row |
```

**Severity levels:**

- **Critical**: Will cause task execution to fail or produce incorrect
  code (stale paths, wrong field names, missing dependencies, gaps in
  coverage, missing provenance header).
- **Moderate**: Won't fail but will produce suboptimal code (missing
  reuse, sizing issues, weak acceptance criteria, missing
  conformance scenario).
- **Minor**: Cosmetic or stylistic (inconsistent terminology, minor
  documentation gaps).

## Step 7: Fix All Issues

After reporting, **directly edit the task files** to fix all Critical
and Moderate issues. For each fix:

1. Edit the task file with the corrected content.
2. If tasks need reordering, rename files to maintain sequential
   numbering (use `git mv` for tracked files).
3. If tasks need merging, combine content into the target task and
   delete the source task (use `git rm` for tracked files). Update
   numbering.
4. If tasks need splitting, create new task files with correct
   numbering.
5. Update the `README.md` to reflect any structural changes
   (dependency graph, task summary table, code reuse table).

### What to fix directly:

- **Stale file paths** — replace with verified paths.
- **Wrong type / capability key / JSDoc tag names** — replace with
  actual names from the workspace.
- **Missing prerequisites** — add to the Prerequisites section.
- **Missing acceptance criteria** — add criteria for uncovered
  requirements (especially the required CI gates).
- **Missing files in Files to Create/Modify** — add missing entries.
- **Inaccurate code snippets** — correct to match actual workspace.
- **Missing coverage** — add requirements for gaps (conformance
  scenarios, JSDoc tags, sandbox-escape tests, changesets, provenance
  headers).
- **Task ordering issues** — renumber and update dependency
  references.
- **Sizing issues** — merge too-small tasks, split too-large ones.
- **Overlap/redundancy** — consolidate duplicate work into one task.
- **Duplicate-of-existing** — replace a new-file plan with reuse of an
  existing symbol; update the task to import the existing path.
- **Wrong placement** — move new shared code to the correct package,
  update `Files to Create/Modify` accordingly.
- **Missed extraction** — when ≥ 2 real consumers exist, add a
  requirement to refactor the existing implementation into a shared
  symbol.
- **Hand-edit of scaffold-owned / generated files** — replace with the
  correct workflow (`scripts/scaffold.ts` + `pnpm scaffold` for
  templates; edit JSDoc source for generated docs).
- **README inconsistencies** — update dependency graph, summary table,
  code reuse table.

### What NOT to fix (flag only):

- Architectural decisions that may need user input.
- Ambiguous requirements where multiple valid interpretations exist.
- Scope questions (should feature X be included or deferred?).

For these, use `AskUserQuestion` to get clarification before
proceeding.

## Step 8: Final Verification

After all fixes:

1. Re-read every modified task file to confirm changes are correct.
2. Verify task numbering is sequential with no gaps.
3. Verify all cross-references between tasks are consistent.
4. Verify the README's dependency graph and summary table match the
   actual task files.
5. Report a final summary:

```
## Fixes Applied

| # | Task/File | Change |
|---|-----------|--------|
| 1 | 2-runtime-ta-rsi.md | Fixed 3 stale paths, added missing conformance criterion |
| 2 | README.md | Updated dependency graph, added code reuse entry |
| 3 | Merged 3-types.md into 2-core.md, renumbered 4→3, 5→4 |

## Remaining Items (need user input)

- [ ] Should `ta.atr` use SMA or RMA smoothing — confirm before Task 5
- [ ] Task 3 references `../invinite/` source — confirm SHA before port
```

## Constraints

- Read every task file completely — do not skim.
- Verify all file paths, types, and capability keys against the actual
  workspace.
- Maximum 5 parallel Explore subagents at any time.
- Fix issues directly in files — do not just report them.
- Use `git mv` for renames, `git rm` for deletions.
- Ask the user only for genuine ambiguities or architectural
  decisions.
- All output in English.
- Do not modify `X-` prefixed (completed) task files.
- Do not change the feature folder name.
- Preserve the established task file format (Goal, Prerequisites,
  Current Behavior, Desired Behavior, Requirements, Files to
  Create/Modify, Gates, Changeset, Acceptance Criteria).
