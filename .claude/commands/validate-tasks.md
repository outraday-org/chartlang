---
description: Double-check and validate a tasklist for gaps, issues, and improvements. Directly fixes all problems found in the task files.
model: opus
---

# Validate Tasks

## Purpose

You are a **senior technical reviewer** specializing in task quality assurance.
Your job is to validate a task folder written by `/write-tasks`, find gaps,
inconsistencies, and issues, and **fix them directly** in the task files. You run
after task authoring is complete, before execution begins.

**Arguments**: $ARGUMENTS

The argument should be either:
- A **task folder** path (e.g., `tasks/cli-tool/`) -- validates all tasks
- A **single task file** path (e.g., `tasks/cli-tool/3-rest-api-server.md`) --
  validates just that task (still reads README and sibling tasks for context)

## Step 1: Detect Mode and Load Tasks

### 1a. Determine scope

- If the argument points to a **directory** (or ends with `/`), validate all
  tasks in the folder (**full mode**).
- If the argument points to a **single `.md` file**, validate only that task
  (**single mode**). Still read the parent folder's README and sibling tasks for
  context, but only report/fix issues in the target task.

### 1b. Load files

1. Read the `README.md` in the task folder (or the target file's parent folder).
2. In **full mode**: list and read **all** task files matching `N-*.md` (exclude
   `X-` prefixed).
3. In **single mode**: read the target task file. Also read `X-` prefixed
   siblings for context on what's already done.
4. Read any parent `README.md` if the folder is nested (e.g.,
   `tasks/structural-refactor/README.md` for a sub-feature).

## Step 2: Validate Against the Codebase

Launch **parallel Explore subagents** (one per task, max 5 concurrent) to verify
every concrete reference in each task file:

### 2a. File path verification

For every file path mentioned in a task:
- Verify the file exists at that path
- If it doesn't, find the correct path and note the fix
- Check that referenced functions, types, hooks, and components exist in those
  files

### 2b. Schema and type verification

For every table, field, validator, or type referenced:
- Verify it exists in `/convex/` with the stated field names and types
- Check that referenced indexes actually exist in `schema.ts`
- Verify type aliases exist in `convex/schemaTypes.ts`

### 2c. Existing code detection

For every new file, hook, component, or utility a task proposes to create:
- Search the codebase to check if it already exists (partially or fully).
  Check `/src/components/ui/`, `/src/components/`, the nearest `hooks/`
  folder, `/src/api/hooks/`, `/src/lib/`, `/convex/`, `/convex/lib/`,
  `/shared/`.
- Search for naming conflicts (same name, different module)
- Check if the functionality already exists under a different name
- If a near-equivalent exists: prefer **extending or reusing** the
  existing symbol over creating a parallel version. Fix the task to
  reference the existing import path and note any extension needed.
- Check for **deleted / guarded concepts** that must not be reintroduced
  (root and folder CLAUDE.md guard rules -- e.g. no standalone
  `/watchlists`, no `companyLists.spaceId`, no `Doc<"table">` outside
  `schemaTypes.ts`, no `index.ts` / `index.tsx`, no `createdAt` field).

### 2d. Dependency verification

For each task's stated prerequisites:
- Verify the dependency exists as a task file
- Verify the dependency covers what the dependent task claims it provides
- Check for **unstated dependencies** -- does a task implicitly require something
  from another task without declaring it?

## Step 3: Structural Analysis

### 3a. Task sizing

For each task, evaluate against the sizing rules from `/write-tasks`:

- **Too small?** (< 50 lines of real code, < 3 files, exists solely to enable
  the next task) -- flag for merging
- **Too large?** (> 15 files, 2+ independent deliverables, mixes unrelated
  domains) -- flag for splitting
- **Right size?** (3-10 files, one clear deliverable, 50+ lines of real code)

### 3b. Ordering validation

Walk through tasks 1, 2, 3, ... in sequence and confirm:
- Each task's prerequisites are satisfied by lower-numbered tasks
- Backend tasks come before their frontend consumers
- Shared infrastructure comes before consumers
- No circular dependencies exist

### 3c. Coverage analysis

Check for **gaps** -- work that is needed but not covered by any task:
- Missing cleanup cascade registrations for new tables
- Missing type alias additions to `convex/schemaTypes.ts`
- Missing CLAUDE.md updates for touched folders
- Missing i18n wrapping for user-visible text
- Missing index definitions for queries that will need them
- Schema changes without corresponding CRUD operations
- Frontend consumers without backend data sources
- New switch/union cases that aren't handled in existing code

### 3d. Redundancy detection

Check for **overlap** between tasks:
- Two tasks creating the same file or modifying the same function
- Duplicate work spread across tasks (e.g., both task 2 and task 4 define
  the same type)
- Unnecessary intermediate tasks that could be folded into their consumers

### 3e. Reusability and code placement

For every new file, type, hook, component, or utility that genuinely
needs to be created, verify it is placed where every actual consumer can
import it -- not buried in one feature folder when multiple features will
use it.

**Cross-package placement** -- follow the Code Sharing Between Packages
table from root CLAUDE.md:

- Convex + Frontend only -> `/convex/` (imported as `"convex/..."` from
  `/src/`)
- Worker, Agent-sandbox, or Frontend (>=2 packages) -> `/shared/`
  (alias `@shared/*`)
- Convex functions + Worker only -> `/convex/shared/`
- Frontend + Worker TLDraw schemas -> `/shared/canvas-schemas/`
  (`@tldraw/validate` + `@tldraw/tlschema`)
- Never runtime-import frontend code from `"use node"` Convex modules

**Frontend placement** -- shared UI primitives in `/src/components/ui/`,
shared feature-agnostic components in `/src/components/`, shared hooks
in `/src/api/hooks/` or the nearest `hooks/`, generic utilities in
`/src/lib/`. A utility with >=2 real consumers does not belong inside
one consumer's folder.

**Convex placement** -- shared backend logic in `/convex/lib/` or the
feature's own `lib/`; never cross-import between sibling feature
folders -- promote shared code to `/src/components/` (frontend) or
`/convex/lib/` (backend) first.

**Types** -- backend document types via aliases in
`convex/schemaTypes.ts`; frontend types co-located in `types/` folders.

**Extract-and-share opportunities the task missed:**

- Are there existing code paths that do almost the same thing as the
  proposed new code? If yes, and there will be >=2 real consumers, the
  task should refactor the existing path to share with the new one
  rather than write a parallel implementation.
- Are two new tasks each introducing a similar utility / hook /
  component? Consolidate into one shared symbol referenced by both.

**Do not flag speculative reuse.** Only flag when there is actual
current duplication (>=2 real consumers of near-identical logic).
Premature abstraction with one consumer is worse than waiting for the
second consumer to appear -- three similar lines is better than the
wrong abstraction.

When a placement / reuse issue is found, fix the task to:

- reference the existing symbol (with correct import path), OR
- move the new file to the correct package / folder, OR
- add an explicit requirement to refactor the existing implementation
  to share with the new consumer (with both old and new call sites
  listed in `Files to Create/Modify`).

## Step 4: Content Quality Review

For each task file, check:

### 4a. Requirements quality
- Are requirements specific enough to implement without guessing?
- Do they include exact file paths, function signatures, validator shapes?
- Are code snippets accurate (correct field names, types, imports)?
- Do code snippets match the actual schema field names and types?

### 4b. Acceptance criteria quality
- Is every requirement reflected in the acceptance criteria?
- Are criteria testable/verifiable?
- Are any criteria missing for implied work?

### 4c. Files to Create/Modify table
- Does the table include all files the task will actually touch?
- Are any files listed that shouldn't be?
- Are the stated actions (Create/Modify) correct?

### 4d. Consistency
- Do task files use consistent terminology?
- Do field names match the actual schema (not invented names)?
- Do entity type names match the codebase conventions?
- Are the same concepts named the same way across all tasks?

## Step 5: Second Wave -- Edge Case Sweep

Steps 2-4 catch *what's specified but wrong*. This step catches *what isn't
specified at all but should be*. Walk every task through each category below
and explicitly answer: **"Does this task handle X, and if not, should it?"**

This wave is largely judgment + targeted reads, not broad codebase exploration.
Spawn Explore subagents only when verifying a specific guarantee (e.g. "is
this new table registered in `convex/cleanup.ts`?", "does this query have a
backing index in `schema.ts`?"). Otherwise read the task file against the
checklist directly.

### 5a. Failure and error paths

- What happens if the primary action throws? Is rollback / cleanup defined?
- Network failures against external systems (Postgres, R2, DO, Qdrant,
  Stripe, Clerk, Ably)
- Convex action timeouts (default 60s) on long-running work
- Partial-write recovery -- if one step in a multi-mutation flow fails,
  is the system in a recoverable state?
- OCC conflicts on hot documents (frequent writers, counters)

### 5b. Empty, null, and boundary states

- Empty arrays / no rows / zero-count cases
- Single-item case where logic implicitly assumes >= 2
- First-time users with no existing data
- Documents missing newly-added optional fields (schema drift)
- Hard limits: Convex 1024-key object limit, 8192-item array limit,
  pagination cursors, query result caps, R2 blob sizes
- Off-by-one on ranges, dates, fiscal periods

### 5c. Auth, permissions, and team scoping

- Does every new query / mutation / action authenticate the caller?
- Is access scoped to the right team / space / portfolio / wiki?
- Behavior when team membership changes mid-flow
- Public / share-link / unauthenticated surfaces -- do they bypass checks
  only where intentional?
- Dev-only seed actions guarded with `envServer.STAGE === "prod"` throw?

### 5d. Concurrency and races

- Two users editing the same document simultaneously
- Cron job racing with a user-initiated mutation
- DO writes racing with direct Convex writes (DO must be the sole writer
  for collaborative bodies -- documents, notes, annotator surfaces)
- Scheduled actions firing before their prerequisite mutation commits
- Per-team rate limits via `convex/rateLimiting/teamRateLimit.ts` for
  expensive operations

### 5e. Cleanup, cascades, and lifecycle

- When the parent entity is deleted, what happens to children?
- Is `convex/cleanup.ts` updated for every new table?
- Storage IDs -- orphaned files cleaned up?
- DO blobs in R2 -- entity-key cleanup wired?
- Cron jobs removed when their feature is deleted
- Soft-delete vs hard-delete -- consistent with the surrounding domain?

### 5f. Feature limits, rate limits, and function cost

- New count-gated resource registered in
  `convex/stripe/featureLimits.ts`?
- Expensive operations throttled via `assertTeamRateLimit` /
  `checkTeamRateLimit`?
- No `ctx.runQuery` / `ctx.runMutation` inside queries / mutations for
  shared logic -- extracted to plain helpers with `QueryCtxOrMutationCtx`?
- Cascading internal function calls that should be a single composite?

### 5g. Schema, types, and indexes

- New table -> type alias added to `convex/schemaTypes.ts`?
- Every `withIndex` call has a matching index in `schema.ts` with all
  fields in the index name?
- No `filter()` used where an index would suffice
- No `createdAt` field added -- `_creationTime` already exists
- New union variant -> every `switch` / discriminated handler updated?
- New optional field -> existing documents still load and render?
- No `Doc<"table">` used outside `schemaTypes.ts`?

### 5h. Frontend state, reactivity, and React rules

- Loading, error, empty, and partial states defined for each new surface
- Stale data after a mutation -- does the subscription re-render?
- Server-paginated tables keep the shell mounted during refetches?
- Hook order: no hooks declared below an early return / guard
- No variable shadowing (`@typescript-eslint/no-shadow`)
- No `++` / `--`; no `() => {}` empty arrow
- React Compiler: no partial `useCallback` deps that branch on mode flags
- `@fluentui/react-context-selector` (not plain React context) for shared
  context, with `useMemo`'d provider values
- Select triggers render the translated label, not `<SelectValue />`
  when the item label is a `<Trans>` node

### 5i. i18n and accessibility

- Every user-visible string wrapped in `<Trans>` or `` t`...` `` (or
  `msg` for deferred descriptors)
- No `` t`...` `` / `t()` at module scope -- wrapped in a getter and
  called inside the component?
- Keyboard navigation, focus management on new dialogs / popovers
- ARIA labels on icon-only buttons

### 5j. Z-index and portal layering

- Portaled / fixed UI uses `Z_INDEX` constants from `/src/lib/z-index.ts`,
  not hardcoded numbers above 999?
- Nested dialogs / popovers use `useParentDialogZIndex()` where they
  open from inside another dialog?

### 5k. Cross-package and cross-database

- Code shared between >=2 packages lives in `/shared/` (or
  `/convex/shared/` for Convex+Worker), not duplicated?
- No runtime imports from `"use node"` Convex modules into frontend?
- Convex + Postgres + DO consistency -- if a write to one fails, what
  is the documented fallback?
- External Postgres queries are read-only (no writes through
  `convex/externalBackend/`)?
- Vault (Postgres `vault_items`) vs Research Vault (Convex
  `researchItems`) -- the task references the correct system?

### 5l. Collaborative documents

- Mutations to collaborative bodies go through the DO
  (`NoteDurableObject` / annotator DOs), never directly to Convex?
- New annotator surface -> DO + R2 blob + entity-key cleanup wired?
- Yjs snapshot path defined for Convex persistence?

### 5m. Borders, file naming, and code-style traps

- 1px solid borders use the `border-{top,right,bottom,left}` custom
  classes, not Tailwind's `border-{t,r,b,l}`?
- File naming: components PascalCase, hooks / utils kebab-case, Convex
  files camelCase; no `index.ts` / `index.tsx`?
- New shared utility -- searched for an existing equivalent before
  creating?

### 5n. Mirror and tooling drift

- New `.claude/commands/`, `skills/`, or `agents/` entry mirrored to
  `.codex/`, `.cursor/`, `.agent/` per the provider mirror rules?
- Deleted entries -> mirrors removed in the same change?
- Folder-level `CLAUDE.md` update needed for a non-obvious invariant
  introduced by the task?

### 5o. Test coverage

- New backend behavior covered by a Convex test suite?
- Per-feature test harness entry point updated?
- Test scenarios for the edge cases flagged above (empty / failure /
  permission denied / concurrent write)?

### Output of Step 5

Fold edge-case gaps into the Step 6 per-task finding tables using
`Category = "Edge case"` plus a sub-tag (e.g. `Edge case / Cascade`,
`Edge case / i18n`, `Edge case / Concurrency`, `Edge case / Limits`).
Apply the same severity scale:

- **Critical**: missing handling will produce broken or unsafe code
  (no cleanup cascade for a new table, missing auth check, schema
  drift unhandled, direct Convex write to a collaborative body)
- **Moderate**: missing handling will produce suboptimal code
  (no empty state, missing rate limit on an expensive action,
  unwrapped user-visible string)
- **Minor**: stylistic or low-impact gaps

Critical and Moderate edge-case gaps must be fixed in Step 7 alongside
first-wave findings. If an edge case is a genuine architectural
decision (e.g. "should this be soft or hard delete?"), surface it via
`AskUserQuestion` rather than guessing.

## Scope Rules for Single vs Full Mode

- **Full mode**: All checks apply to all tasks. Cross-task issues are reported
  and fixed. README is updated for structural changes.
- **Single mode**: Steps 2-5 run only against the target task. Cross-task
  checks (3b ordering, 3d redundancy) still run but only report/fix issues that
  affect the target task. README updates are limited to the target task's row
  in the summary table.

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
| 1 | Stale path | Critical | `src/old/path.ts` doesn't exist | Correct to `src/new/path.ts` |
| 2 | Missing dep | Moderate | Implicitly needs Task 2's hook | Add to Prerequisites |
| 3 | Sizing | Minor | Only touches 2 files, ~30 lines | Consider merging into Task N+1 |

### Cross-Task Issues

| # | Category | Severity | Finding | Fix |
|---|----------|----------|---------|-----|
| 1 | Gap | Critical | No task adds type alias to schemaTypes.ts | Add to Task 1 |
| 2 | Overlap | Moderate | Tasks 2 and 4 both define TradeStatusBadge | Consolidate in Task 2 |
| 3 | Ordering | Critical | Task 3 needs Task 4's hook | Swap order to 3→4 or add dep |

### README Issues

| # | Finding | Fix |
|---|---------|-----|
| 1 | Dependency graph doesn't match task numbers | Update graph |
| 2 | Code reuse table missing existing utility X | Add row |
```

**Severity levels:**
- **Critical**: Will cause task execution to fail or produce incorrect code
  (stale paths, wrong field names, missing dependencies, gaps in coverage)
- **Moderate**: Won't fail but will produce suboptimal code (missing reuse
  opportunities, sizing issues, weak acceptance criteria)
- **Minor**: Cosmetic or stylistic (inconsistent terminology, minor
  documentation gaps)

## Step 7: Fix All Issues

After reporting, **directly edit the task files** to fix all Critical and
Moderate issues (from both Step 2-4 first-wave findings and Step 5
edge-case findings). For each fix:

1. Edit the task file with the corrected content.
2. If tasks need reordering, rename files to maintain sequential numbering
   (use `git mv` for tracked files).
3. If tasks need merging, combine content into the target task and delete the
   source task (use `git rm` for tracked files). Update numbering.
4. If tasks need splitting, create new task files with correct numbering.
5. Update the `README.md` to reflect any structural changes (dependency graph,
   task summary table, code reuse table).

### What to fix directly:

- **Stale file paths** -- replace with verified paths
- **Wrong field/type/function names** -- replace with actual names from codebase
- **Missing prerequisites** -- add to the Prerequisites section
- **Missing acceptance criteria** -- add criteria for uncovered requirements
- **Missing files in Files to Create/Modify** -- add missing entries
- **Inaccurate code snippets** -- correct to match actual codebase
- **Missing coverage** -- add requirements for gaps (cleanup cascades,
  schemaTypes, CLAUDE.md updates, i18n, indexes)
- **Task ordering issues** -- renumber and update dependency references
- **Sizing issues** -- merge too-small tasks, split too-large ones
- **Overlap/redundancy** -- consolidate duplicate work into one task
- **Duplicate-of-existing** -- replace a new-file plan with reuse of an
  existing symbol; update the task to import the existing path
- **Wrong placement** -- move new shared code to the correct package /
  folder per the Code Sharing table (3e), update `Files to
  Create/Modify` accordingly
- **Missed extraction** -- when >=2 real consumers exist, add a
  requirement to refactor the existing implementation into a shared
  symbol instead of writing a parallel one
- **README inconsistencies** -- update dependency graph, summary table, code
  reuse table

### What NOT to fix (flag only):

- Architectural decisions that may need user input
- Ambiguous requirements where multiple valid interpretations exist
- Scope questions (should feature X be included or deferred?)

For these, use `AskUserQuestion` to get clarification before proceeding.

## Step 8: Final Verification

After all fixes:

1. Re-read every modified task file to confirm changes are correct.
2. Verify task numbering is sequential with no gaps.
3. Verify all cross-references between tasks are consistent.
4. Verify the README's dependency graph and summary table match the actual
   task files.
5. Report a final summary:

```
## Fixes Applied

| # | Task/File | Change |
|---|-----------|--------|
| 1 | 2-system-columns.md | Fixed 3 stale paths, added missing prerequisite |
| 2 | README.md | Updated dependency graph, added code reuse entry |
| 3 | Merged 3-types.md into 2-backend.md, renumbered 4→3, 5→4 |

## Remaining Items (need user input)

- [ ] Should database status config UI be in Task 5 or deferred?
- [ ] Task 3 assumes API X exists -- confirm or defer
```

## Constraints

- Read every task file completely -- do not skim
- Verify all file paths, types, and functions against the actual codebase
- Maximum 5 parallel Explore subagents at any time
- Fix issues directly in files -- do not just report them
- Use `git mv` for renames, `git rm` for deletions
- Ask the user only for genuine ambiguities or architectural decisions
- All output in English
- Do not modify `X-` prefixed (completed) task files
- Do not change the feature folder name
- Preserve the established task file format (Goal, Prerequisites, Current
  Behavior, Desired Behavior, Requirements, Files to Create/Modify,
  Acceptance Criteria)
