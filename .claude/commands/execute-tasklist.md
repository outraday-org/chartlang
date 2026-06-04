---
description: Execute all tasks in a task folder (or a single task file) — plan, implement, and quality-analyze each task using agent teams.
model: opus
---

# Execute Tasklist

## Purpose

You are a task orchestrator (team lead) that processes an entire task folder
end-to-end. For each task, you spawn **teammates** that plan, implement, and
quality-fix the code. Teammates are full Claude Code sessions that can spawn
their own subagents and run commands/skills.

**Arguments**: $ARGUMENTS

The argument can be:
- A **task folder** (e.g., `tasks/cli-tool/`) — executes all tasks in the folder
- A **single task file** (e.g., `tasks/cli-tool/3-some-task.md`) — executes only that task

## Step −1: Detect Runtime

Inspect the tools available to you in *this* session, then pick **exactly one**
orchestration branch and ignore the other for the rest of the turn:

- **Claude Code branch** — choose if you have a `TeamCreate` tool and an
  `Agent` tool that accepts `team_name`, `mode`, and `model` parameters.
  Follow `## Runtime A: Claude Code orchestration` below.
- **pi branch** — choose if you have a single `teams` tool with actions
  `member_spawn`, `delegate`, `task_list`, and `member_stop`. Follow
  `## Runtime B: pi orchestration` below.

If neither tool surface is present, stop and tell the user the runtime is
unsupported (this command requires either Claude Code with teams or pi with
the teams extension loaded).

Steps 0, 1, 7, and 8 are runtime-agnostic and apply to both branches.

## Step 0: Environment Setup

Before doing anything else, ensure the development environment is ready.

### 0a. Install dependencies

Check whether `node_modules/` exists in the project root. If it does not, run:

```bash
pnpm install
```

Wait for it to complete before proceeding.

### 0b. Scaffold

If any task adds a new package to `PACKAGE_DIRS` in
`scripts/scaffold.ts`, that step must run before population:

```bash
pnpm scaffold
```

`scaffold.ts` is idempotent — re-running it on an already-scaffolded tree
produces zero diff. Never hand-write the six §22.4 template files
(`package.json`, `tsconfig.json`, `vitest.config.ts`, `README.md`,
`src/index.ts`, `src/index.test.ts`) per package.

## Step 1: Discover Tasks

**Detect mode** based on the argument:
- If the argument ends in `.md` → **single-task mode** (the argument is a task file)
- Otherwise → **folder mode** (the argument is a task folder)

### Folder mode

1. Read the `README.md` in the provided task folder to understand the feature.
2. List all task files matching the pattern `N-*.md` (where N is a number).
   Exclude files prefixed with `X-` (already completed).
3. Sort by number to get execution order.
4. Report the task list to the user:

```
Found <N> tasks to execute in <folder>:
  1. <task-1-filename> — <task title from first line>
  2. <task-2-filename> — <task title>
  ...
```

If no uncompleted tasks are found, tell the user and stop.

### Single-task mode

1. Derive the task folder from the file's parent directory.
2. Read the `README.md` in that folder for context.
3. Verify the file exists and is not already prefixed with `X-`.
4. The task list is just the one file. Report:

```
Executing single task: <task-filename> — <task title from first line>
```

---

## Runtime A: Claude Code orchestration

Follow this section only if Step −1 selected **Claude Code**. Skip ahead to
`## Runtime B: pi orchestration` otherwise.

## Step 2: Create Team

Create a team for executing the tasklist:

```
TeamCreate: execute-<folder-name>
```

You are the team lead. Teammates will be spawned for each phase.

## Step 3: Parse Dependencies

Read the **Task Summary** table from the README.md and extract the
**Dependencies** column for each task. Build a dependency map:

```
Task 1: depends on []
Task 2: depends on [1]
Task 3: depends on [2]
Task 4: depends on [1]
Task 6: depends on []
```

Group tasks into **execution waves** — a wave contains all tasks whose
dependencies are fully satisfied by previously completed waves:

```
Wave 1: [1, 6]        ← no dependencies
Wave 2: [2, 4, 5, 7]  ← depend only on wave-1 tasks
Wave 3: [3]            ← depends on wave-2 task
```

Report the execution plan to the user:

```
Execution plan (parsed from README.md dependencies):
  Wave 1 (parallel): Task 1, Task 6
  Wave 2 (parallel): Task 2, Task 4, Task 5, Task 7
  Wave 3 (parallel): Task 3
```

If the Dependencies column is missing or all tasks list "None", fall back to
**sequential execution** (each task is its own wave).

## Step 4: Execute Waves

Process waves **sequentially**. Within each wave, execute all tasks **in
parallel** using teammates.

### For each wave:

Spawn **one teammate per task** in the wave, all in a **single message** with
multiple Agent tool calls so they run concurrently. Each teammate is named
`plan-execute-<N>` using the Agent tool with `team_name`,
`mode: "bypassPermissions"`, and **always `model: "opus"`**.

**Model rule (non-negotiable):** Every plan+execute teammate runs on
`model: "opus"` — never Sonnet, never Haiku, regardless of task size or
perceived triviality. Do not apply per-task downgrading heuristics. This
matches the user's explicit standing instruction; Sonnet/Haiku output
quality on this codebase has been unsatisfactory.

```
Plan and implement task: <full-path-to-task-file>

You are a senior engineer working on chartlang (open-source TypeScript
embedded DSL; pnpm workspace; @invinite-org/chartlang-* packages). Follow
these steps:

1. Read the task file and the parent folder's README.md for context.
2. Read folder-level CLAUDE.md files for every folder you'll touch
   (`packages/CLAUDE.md`, `scripts/CLAUDE.md`, `docs/CLAUDE.md`,
   `.github/CLAUDE.md`, and any package-local CLAUDE.md).
3. Read PLAN.md / CONTRIBUTING.md sections referenced by the task.
4. Read any sibling tasks prefixed with X- (already completed) for context.
5. Validate every reference in the task against the workspace:
   - Verify files, types, capability keys, and helpers exist at stated paths
   - Check if work is already partially done
   - Search for naming conflicts before creating anything new
6. Check for issues: duplicate code, missing reuse, convention violations,
   missing test layers, missing JSDoc tags, missing changeset, missing
   provenance header on ports.
7. Write a validated .plan.md file next to the task file (audit artifact).
   Use this structure:
   - Context, Pre-existing work, Issues found, Improvements
   - Numbered steps with verified file paths and concrete details
   - Files to create/modify table
   - Gates the task must keep green (typecheck, lint, test, docs:check,
     readme:check, conformance where relevant)
   - Changeset filename + semver bump
   - Acceptance criteria checklist
8. Implement all steps from the plan:
   - Follow the plan precisely
   - Search before creating any new file/type/helper
   - Follow all chartlang conventions:
     - MIT header on every new .ts file under packages/*/src/ and scripts/
     - JSDoc with @example, @since, stability marker on every export
     - @formula + @anchors + @warmup on new ta.* / draw.*
     - No any, no `!`, no `as` between known incompatible types
     - useImportType for type-only imports
   - Use existing patterns from neighboring files
9. If you added a new package, append to PACKAGE_DIRS in
   `scripts/scaffold.ts` and run `pnpm scaffold` BEFORE populating src.
   Never hand-write the six §22.4 template files.
10. If you ported from `../invinite/`, add the 4-line provenance + relicense
    header (PLAN.md §3.1).
11. If you touched any export's JSDoc, primitive math, or the gen-docs
    surface: run `pnpm tsx packages/cli/src/gen-docs.ts` (or the project's
    documented gen-docs command) so `docs/primitives/*` regenerates. Never
    hand-edit those.
12. Add the changeset with `pnpm changeset` if `packages/*/src/` was touched.
13. Update folder-level CLAUDE.md for every folder you touched when the
    change introduces a non-obvious invariant.

Rules:
- Reuse first — extend existing code instead of creating new
- Minimal diff — smallest change that achieves the goal
- All file paths must be verified against actual workspace, not copied from task
- Write .plan.md even though you implement it yourself — it's an audit artifact
- **Clarify before guessing** — if the task is ambiguous, contradicts the
  workspace, leaves an approach/scope decision open, or you are otherwise
  unsure, call the `AskUserQuestion` tool to resolve every open question
  with the user before finalizing `.plan.md` or writing code. Do not
  silently pick an interpretation. Batch related questions into one call
  (up to 4 questions) instead of asking one-by-one.
- **Do NOT run `pnpm typecheck`, `pnpm lint`, `pnpm test`, or `pnpm build`
  on the full workspace** during execution — those gates run once at the
  end of the tasklist (or by the user). For per-package verification use
  `pnpm --filter @invinite-org/chartlang-<name> test` sparingly. Just write
  correct code and move on.
```

**Wait for ALL teammates in the wave to complete.** Then for each:
- Read the generated `.plan.md` to verify it exists.
- Note the number of files created/modified from the teammate's output.

#### Progress reporting

After all tasks in a wave complete, report:

```
Wave <W>/<total-waves> complete:
  Task <N>/<total>: <task-title> — Plan+Execute: completed
  Task <M>/<total>: <task-title> — Plan+Execute: completed
```

**Then proceed to the next wave.** Do not start a wave until all tasks in the
previous wave have completed.

## Step 5: Quality Pass

After all waves are complete, spawn a final teammate named
`quality-holistic` using the Agent tool with `team_name`,
`mode: "bypassPermissions"`, and `model: "opus"`. The QA pass **always**
runs on Opus regardless of how individual implementation tasks were
graded — never downgrade quality review to Sonnet or Haiku:

### Folder mode (multiple tasks)

```
Quality review for all tasks in: <full-path-to-task-folder>

Run /quality-analysis with argument: "<full-path-to-task-folder> all tasks"
(e.g. "tasks/phase-0-bootstrap/ all tasks")

This will:
1. Parse all requirements and acceptance criteria from EVERY task file
2. Audit each task's implementation against its requirements
3. Check all code introduced by every task against all 8 quality rules
   (TS + Biome, reusability, placement, SATD, complexity, conventions,
   correctness, edge cases)
4. Catch cross-task issues:
   - Duplicate helpers introduced across different tasks
   - Inconsistent patterns (naming, JSDoc, capability-key style)
   - Missing shared abstractions — code that should have been extracted
   - Integration issues — tasks that don't wire together correctly
   - Hand-edits to scaffold-owned templates or generated docs
   - Coverage gaps after wave completion
   - Missing changesets across the wave
   - Missing provenance headers on ports
5. Grade each task individually AND provide an overall grade
6. Fix all HIGH, MEDIUM and LOW issues found
7. Rename task files with X- prefix for tasks graded Complete + Ship
```

### Single-task mode

```
Quality review for task: <full-path-to-task-file>

Run /quality-analysis with argument: "<full-path-to-task-folder> task <N>"
(e.g. "tasks/phase-0-bootstrap/ task 3")

This will:
1. Parse all requirements and acceptance criteria from the task file
2. Audit the implementation against each requirement
3. Check all code introduced by the task against all 8 quality rules
   (TS + Biome, reusability, placement, SATD, complexity, conventions,
   correctness, edge cases)
4. Report findings with impact levels
5. Grade the implementation
6. Fix all HIGH, MEDIUM and LOW issues
7. Rename task file with X- prefix if Complete + Ship
```

**After the teammate completes:**
- Note the per-task grades, overall grade, number of fixes applied, and any
  remaining issues.
- Include the grades in the final report.

## Step 6: Clean Up Team

After all tasks are processed, clean up:

```
TeamDelete: execute-<folder-name>
```

---

## Runtime B: pi orchestration

Follow this section only if Step −1 selected **pi**. Everything below mirrors
Steps 2–6 of Runtime A, translated to pi's `teams` tool surface
(`src/extensions/teams/tool.ts`). Worker output is read from `task.result`
in the JSON returned by `teams action: "task_list"`, not from inline tool
results — pi workers run as background subprocesses, not synchronous Agent
calls.

### Step 2 (pi): Implicit team

pi auto-derives the team ID from the leader's cwd via `ensureTeamId()`; there
is no `TeamCreate` equivalent and no name to choose. Skip directly to Step 3.

You are the leader. Workers will be spawned in Step 4 via the
`teams action: "delegate"` action.

### Step 3 (pi): Parse Dependencies

Identical to Runtime A Step 3 — read the Task Summary table from `README.md`,
build a dependency map, group tasks into waves. Report the execution plan to
the user in the same format.

### Step 4 (pi): Execute Waves

Process waves **sequentially**. Within each wave, dispatch all tasks **in one
`teams delegate` call** so the workers spin up concurrently. Then poll until
the wave completes.

**Model rule (non-negotiable, identical to Runtime A):** every plan+execute
worker runs on `model: "anthropic/claude-opus-4-7"`. Never Sonnet, never
Haiku, regardless of task size. The thinking level is `high`.

#### For each wave:

Issue a single `teams` tool call:

```
action: "delegate"
spawn: [
  { name: "plan-execute-<N1>", model: "anthropic/claude-opus-4-7", thinking: "high" },
  { name: "plan-execute-<N2>", model: "anthropic/claude-opus-4-7", thinking: "high" },
  ...
]
tasks: [
  { text: "<full plan+execute prompt for task N1>", assignee: "plan-execute-<N1>" },
  { text: "<full plan+execute prompt for task N2>", assignee: "plan-execute-<N2>" },
  ...
]
```

Each task `text` is the same plan+execute prompt as Runtime A Step 4 (the
13-step "You are a senior engineer…" block including `pnpm scaffold`
guidance and the no-full-workspace-gate rule). Workers inherit the
leader's extensions and slash commands, so prompts that reference
`/build`, `/quality-analysis`, etc. work unchanged.

Record the `taskIds` returned by `delegate` — you need them to poll.

#### Wait for the wave to complete

Loop:

1. Sleep ~10 seconds.
2. Call `teams action: "task_list"`.
3. From the returned `tasks` array, filter to the wave's `taskIds`.
4. Stop when **every** matching task has `status === "completed"` or
   `status === "failed"`. While the loop runs, optionally report progress
   ("3/5 tasks complete").

For each completed task, read `task.result` (worker's final output) and
`task.error` (if it failed). Treat `failed` like a Claude Code teammate
error — record it, continue to the next wave (per the Error Handling
section).

#### Progress reporting

Same format as Runtime A:

```
Wave <W>/<total-waves> complete:
  Task <N>/<total>: <task-title> — Plan+Execute: completed
  Task <M>/<total>: <task-title> — Plan+Execute: failed (<task.error short>)
```

**Then proceed to the next wave.**

### Step 5 (pi): Quality Pass

After all waves are done, run the quality pass via `teams delegate` with a
single spawn and a single task:

```
action: "delegate"
spawn: [
  { name: "quality-holistic", model: "anthropic/claude-opus-4-7", thinking: "high" }
]
tasks: [
  { text: "<same quality prompt as Runtime A Step 5>", assignee: "quality-holistic" }
]
```

Use the same prompt as Runtime A Step 5 (folder mode vs single-task mode).
Poll `teams task_list` the same way until the quality task is `completed` or
`failed`. The QA worker **always** runs on opus regardless of how
implementation workers were graded.

Parse the worker's `task.result` for per-task grades, overall grade, fixes
applied, and remaining issues. Include them in the final report.

### Step 6 (pi): Stop Workers

Stop every worker the leader spawned:

```
action: "member_stop"
all: true
```

The session-shutdown hook in `src/extensions/teams/index.ts` is a safety net
that also stops workers when the leader exits, but call `member_stop`
explicitly here so the workers are gone before Step 7 runs.

---

## Step 7: Clean Up Plan Files

Delete all `.plan.md` files generated during execution:

```bash
rm <task-folder>/*.plan.md
```

These are intermediate audit artifacts — the completed task files (prefixed
with `X-`) and the code itself are the durable outputs.

## Step 8: Final Report

Present a summary:

```
## Execution Complete: <feature-name>

### Execution Plan
  Wave 1 (parallel): Task 1, Task 6
  Wave 2 (parallel): Task 2, Task 4
  Wave 3: Task 3, Task 5

### Results

| Task | Wave | Plan+Execute | Quality Grade | Status |
|------|------|-------------|---------------|--------|
| 1: <title> | 1 | OK | Ship | Marked done |
| 6: <title> | 1 | OK | Ship | Marked done |
| 2: <title> | 2 | OK | Needs work | Pending |
| ... | ... | ... | ... | ... |

**Overall quality grade:** <grade> — <N> issues fixed

### Action Items
- [ ] <Any tasks that need rework>
- [ ] <Any unresolved issues>
```

## Constraints

- Process waves **sequentially** — a wave only starts after the previous wave
  completes
- Within each wave, execute all tasks **in parallel** using concurrent teammates
- Parse the Dependencies column from the Task Summary table to determine waves
- If no Dependencies column exists, fall back to sequential (one task per wave)
- Do NOT implement code yourself — always delegate to teammates
- Do NOT analyze code yourself — always delegate to teammates
- If a task has unresolved prerequisites, skip it and report why
- Skip tasks that already have an `X-` prefix (already completed)
- All reporting must be in English
- Teammates run with `bypassPermissions` mode for autonomous execution
  (Runtime A only — pi workers always run with the leader's permission scope)
- Parallel teammate spawning:
  - Runtime A: a **single message with multiple `Agent` tool calls** so they
    run concurrently
  - Runtime B: a **single `teams delegate` call** with all workers in
    `spawn[]` and all tasks in `tasks[]` so workers spin up together

## Error Handling

- **Plan+Execute teammate fails**: Report the error, continue to next task
- **Quality pass teammate fails**: Report the error, include partial results
  in the final report
- **All tasks skipped**: Report why and suggest fixes

## Why Teams

Teammates are full agent sessions (Claude Code sessions in Runtime A,
background pi worker subprocesses in Runtime B) that can:
- Run commands and skills (`/quality-analysis`, `/build`, etc.) — workers
  inherit the leader's slash commands and extensions
- Use all available tools without nesting restrictions
- Runtime A: spawn their own subagents (e.g., `quality-analysis` spawns 4
  parallel Sonnet review agents)
- Runtime B: cannot spawn their own teams (recursion is blocked by the
  `PI_TEAMS_WORKER=1` guard in `src/extensions/teams/index.ts`), but can
  still call subagents via the `Agent` tool from the subagents extension.

This is faster and more capable than running each task synchronously in the
leader's context, regardless of runtime.
