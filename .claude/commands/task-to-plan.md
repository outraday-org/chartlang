---
description: Create an implementation plan from a task file, then implement it. Validates against the codebase, flags issues, produces a step-by-step plan, and executes it.
model: opus
---

# Task to Plan + Implement

Create a validated, actionable implementation plan from a task file, then
implement it. The plan accounts for the current state of the codebase, reuses
existing patterns, and flags issues before coding begins.

**Arguments**: $ARGUMENTS

The argument should be a path to a task file (e.g., `tasks/feature/03-step.md`)
or a description like "the calendar component task".

## Workflow

### 1. Read and understand the task

- Read the task file and its parent `README.md` for full context.
- Read any sibling tasks that are marked as dependencies or already completed
  (check git log for commits referencing the task or prefixed files like
  `X-01-*.md`).
- Understand the goal, scope, and constraints.

### 2. Validate against the current codebase

For every file, table, hook, component, type, or function the task references:

- **Verify it exists** at the stated path and line numbers. Tasks go stale —
  code moves, line numbers shift, APIs change.
- **Check if work is already done.** Prior tasks or ad-hoc commits may have
  partially or fully implemented what this task describes. Don't redo work.
- **Check for naming conflicts.** If the task says "create `useCalendarEvents`",
  search for it first — it may already exist.
- **Verify imports and dependencies.** Confirm that referenced modules, exports,
  validators, and types are still where the task says they are.

Flag anything that is outdated, missing, or already implemented.

### 3. Check for issues and improvements

Review the task's proposed approach and identify:

- **Duplicate code.** Does the task propose creating something that already
  exists in a reusable form? Search `/src/components/`, `/src/lib/`,
  `/src/api/hooks/`, `/convex/`, nearest `hooks/` folders.
- **Missing reuse.** Could existing hooks, components, utilities, or patterns
  be extended instead of writing new ones?
- **Convention violations.** Does the approach match project conventions in
  `CLAUDE.md`? (file naming, `Id<"table">` vs `string`, i18n wrapping,
  context-selector usage, z-index constants, etc.)
- **Schema/data issues.** Missing indexes, unnecessary fields, wrong validator
  patterns, missing cleanup cascades.
- **Scope creep.** Does the task include work that belongs in a different task
  or isn't needed yet?
- **Missing steps.** Are there implied steps the task doesn't mention? (e.g.
  adding type aliases to `schemaTypes.ts`, wiring up deletion cascades,
  updating existing switch statements that need a new case)

### 4. Produce the plan

Output a plan using `EnterPlanMode`. Structure it as:

```
## Context
One-sentence summary of what the task achieves.
Reference: `tasks/feature/NN-step.md`

## Pre-existing work
List anything already implemented that the plan builds on or skips.

## Issues found
Numbered list of problems with the task as written.
For each: what's wrong, what the fix is.
(Omit section if none found.)

## Improvements
Numbered list of suggested improvements.
For each: what to change and why.
(Omit section if none found.)

## Steps
Numbered, ordered steps. Each step includes:
- What to do (action verb)
- Which file(s) to touch
- Key details (function signatures, validator shapes, imports)
- What existing code to reuse or extend

## Verification
How to confirm the work is correct (diagnostics, manual checks, etc.)
```

### 5. Rules for the plan

- **Reuse first.** Every new file, hook, component, or utility in the plan
  must justify why an existing one can't be extended.
- **Minimal diff.** Prefer the smallest change that achieves the goal. Don't
  refactor surrounding code unless the task requires it.
- **Correct paths.** All file paths must be verified against the actual
  codebase, not copied from the (potentially stale) task.
- **Respect dependencies.** If the task depends on a prior task that isn't done,
  flag it and exclude those steps.
- **No placeholders.** Every step must be concrete enough to implement without
  guessing. Include validator shapes, function signatures, and import paths.
- **Follow conventions.** All code in the plan must follow `CLAUDE.md` rules
  (naming, operators, types, i18n, z-index, etc.).

### 6. Implement the plan

After the plan is accepted and you exit plan mode (context clears), **implement
the plan**:

1. **Re-read the plan** from the conversation (it persists across the context
   clear as the accepted plan).
2. **Implement each step** in order. For each step:
   - Read the target file(s) before modifying them.
   - Search before creating to avoid duplicates.
   - Follow all CLAUDE.md conventions.
3. **Run TypeScript** after implementation:
   ```bash
   pnpm tsc --noEmit --pretty
   ```
   Filter to changed files. Fix all type errors. Re-run until clean.
4. **Update folder-level CLAUDE.md** files for every folder you touched.

Use `bypassPermissions` mode — do not ask for permission on each edit.

### 7. Mark the task as done

After implementation is complete and tsc is clean, rename the task file by
prefixing it with `X-` to mark it as done. For example:

- `tasks/feature/03-step.md` → `tasks/feature/X-03-step.md`

Use `git mv` so the rename is tracked. If the file already has an `X-` prefix,
skip this step.
