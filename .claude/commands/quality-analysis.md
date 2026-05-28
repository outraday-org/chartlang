---
description: Analyze code quality, reusability, and type patterns. Staff engineer review for diffs, branches, or task verification. Fixes all issues found and runs tsc.
model: opus
---

# Quality Analysis

You are a **senior staff engineer** conducting a thorough code quality review.
Your job is to analyze code against the unified quality rules below — scoped to
the detected mode.

**Arguments**: $ARGUMENTS

## Step 1: Detect Mode

Determine the analysis mode using this priority chain. Stop at the first match.

| Priority | Condition | Mode | Scope |
|----------|-----------|------|-------|
| 1 | User mentions tasks in arguments (e.g. "tasks/my-feature/ all tasks", "tasks/my-feature/ task 3") | **Task** | Task requirements + all code introduced by the task |
| 2 | Current branch has an open PR | **PR** | Full PR diff + local diff if present |
| 3 | Not on default branch, no open PR | **Branch** | `git diff <default>...HEAD` + local diff if present |
| 4 | Local staged/unstaged changes exist | **Local** | `git diff` + `git diff --cached` |
| 5 | None of the above | — | Tell the user there are no changes to analyze and **stop** |

### Detection commands

Run these to determine the mode:

```bash
# Default branch name
git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo main

# Current branch
git branch --show-current

# Open PR?
gh pr view --json number,title,baseRefName,url 2>/dev/null

# Local changes?
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
and inline code comments (e.g., `// IMPORTANT:`, `// NOTE:`, `// WARNING:`) near
modified lines. Flag if the diff contradicts explicit inline guidance or
reintroduces a previously reverted pattern.

### Task mode

1. **Locate task files** — the argument includes a folder path and task
   specifier. Parse the folder path (e.g. `tasks/my-feature/`) and the task
   specifier (`all tasks`, `task 3`, `tasks 3 and 5`). If `all tasks`, list
   all `N-*.md` and `X-N-*.md` files in that folder. Otherwise resolve the
   referenced task numbers to files in the folder. If ambiguous, list
   candidates and ask.
2. **Parse requirements** — for each task file, extract every discrete
   requirement, acceptance criterion, and specification.
3. **Audit implementation** — for each requirement, use `Explore` subagents
   (one per task, max 5 concurrent) to search the codebase for the
   corresponding implementation. Check that the code exists, is wired up, and
   matches the spec.
4. **Read all implemented code** — for each file introduced or modified by the
   task, read the full file for context.

### Task file naming convention

Task files follow a naming convention that indicates their status:
- **`X-` prefix** (e.g., `X-7-channel-chat-input-messaging.md`) — the task has
  been previously marked as done/implemented. Still verify it thoroughly, but
  note its pre-existing "done" status in your output.
- **No prefix** (e.g., `7-channel-chat-input-messaging.md`) — the task has not
  been marked as done yet.

When resolving user references (e.g., "task 7"), match against both prefixed and
non-prefixed filenames. If both exist, prefer the `X-` prefixed version.

## Review Style

- Be direct and specific. Point to exact lines and explain why they're
  problematic.
- Make your own judgement calls. Only ask the developer a question when there is
  a genuine ambiguity you cannot resolve from the code alone (e.g., unclear
  intent, multiple valid approaches with real trade-offs). Do not ask rhetorical
  or "make the developer think" questions — state your analysis directly.
- After a mediocre fix, challenge: **"Knowing everything you know now, scrap
  this and implement the elegant solution."**

## Step 3: Check Against Quality Rules

### Diff modes — Parallel Review

For diff modes (PR, Branch, Local), launch **4 parallel review agents** (Sonnet
model) using the Task tool. Pass each agent the diff, the full file contents read
in Step 2, and its assigned rules (copied verbatim from the rule reference
below).

| Agent | Rules | Focus |
|-------|-------|-------|
| A | 1, 6 | **Conventions & Types** — Convex type patterns + project conventions |
| B | 2, 3 | **Reusability & Placement** — deduplication search + code sharing rules |
| C | 7, 8 | **Correctness, Robustness & Edge Cases** — bugs, security, performance, error handling, inline guidance, missing edge-case handling |
| D | 4, 5 | **Code Health** — new SATD, complexity heuristics, nested ternaries, dense one-liners |

Each agent must:
- Only flag violations **in or directly caused by the diff** — never flag
  pre-existing issues in unchanged code
- Score each issue 0-100 using the confidence rubric below
- Include the rule number, `file:line`, and a specific fix suggestion
- Apply the false-positive avoidance list from Constraints

#### Confidence rubric (include verbatim in each agent prompt)

- **0**: False positive or pre-existing issue
- **25**: Might be real, might be false positive. Stylistic issues not explicitly
  backed by a project rule
- **50**: Real issue but a nitpick or unlikely to matter in practice
- **75**: Verified real issue that will be hit in practice, or directly cited in
  a project rule
- **100**: Confirmed definite issue with clear evidence

#### Consolidation

After all 4 agents return:
1. **Filter out issues with confidence < 80**
2. Deduplicate — if multiple agents flag the same line, keep the
   highest-confidence version
3. Assign impact levels (HIGH/MEDIUM/LOW) per the Impact Guidelines in Step 4
4. If no issues survive filtering, report a clean bill of health

### Task mode

Check **all code introduced by the task** against all 8 rules below. Use the
existing Explore subagent approach (one per task, max 5 concurrent) for
requirement verification, then check all introduced code against all rules
directly — no confidence scoring in task mode since issues are reported as
requirement statuses.

---

The following rules are distributed across the 4 parallel agents in diff modes.
In task mode, check all rules directly.

---

### Rule 1 — Convex Type Patterns

#### Pattern A: Extracted Validators

```typescript
// GOOD — extracted to /convex/<feature>/types/*.ts
export const vViewportCamera = v.object({
  x: v.number(),
  y: v.number(),
  z: v.number(),
});
export type ViewportCamera = Infer<typeof vViewportCamera>;
```

- `v` prefix on all validators (`vMyType`)
- Derive types with `Infer<typeof vMyType>` — never write types manually
- Place in `/convex/<feature>/types/*.ts`
- Import validators into `schema.ts`

#### Pattern B: Discriminated Unions

```typescript
// GOOD — each variant is its own validator, combined with v.union
export const vCompanyListItem = v.union(
  vCompanyListItemTicker,
  vCompanyListItemSection,
);
export type CompanyListItem = Infer<typeof vCompanyListItem>;
```

#### Pattern C: Enum + Validator

```typescript
// GOOD — literal-first design
export const AI_CHAT_STATUSES = [
  "idle",
  "streaming",
  "error",
  "stopped",
] as const;
export type AiChatStatus = (typeof AI_CHAT_STATUSES)[number];
export const vAiChatStatus = v.union(
  v.literal("idle"),
  v.literal("streaming"),
  v.literal("error"),
  v.literal("stopped"),
);
```

#### Pattern D: Dual Convex + Zod

**ONLY allowed** when data crosses a `v.any()` boundary or needs runtime parsing
(AI streaming, external APIs). Not the default.

#### Anti-Patterns

| Anti-pattern                                             | Fix                                               |
| -------------------------------------------------------- | ------------------------------------------------- |
| Inline `v.object({...})` in `schema.ts`                 | Extract to `/convex/<feature>/types/*.ts`          |
| Inline complex `v.object({...})` in mutation/query args  | Extract to shared validator file                   |
| Manually written types instead of `Infer<typeof>`        | Derive from validator                              |
| Missing `v` prefix on validators                         | Rename to `vMyType`                                |
| Zod schemas where only Convex validators are needed      | Remove Zod, use Convex only                        |

---

### Rule 2 — Reusability & Deduplication

- **Duplicated logic**: Does the code introduce a function/hook/component that
  already exists elsewhere? Search before flagging.
- **Existing utilities ignored**: Check if the code reimplements something
  that already exists in `/src/lib/`, `/src/components/ui/`, `/src/hooks/`,
  `/src/api/hooks/`, or `/convex/`. Flag with a pointer to the existing code.
- **Dead code**: Does the code add exports that are never imported?
- **Inconsistent patterns**: Does the code solve a problem differently from how
  it's solved elsewhere in the codebase?
- **Frontend types duplicating Convex types**: Manual type definitions that
  should use `Doc<"table">` or `Id<"table">`

#### Search-Before-Creating Checklist

If the code **creates** a new file, type, hook, component, or utility, verify it
doesn't already exist:

| Looking for…        | Search first                                             |
| -------------------- | -------------------------------------------------------- |
| UI components        | `/src/components/ui/`, `/src/components/`                |
| Hooks                | Nearest `hooks/`, `/src/api/hooks/`                      |
| Utilities            | `/src/lib/`, feature-specific `lib/`                     |
| Types                | `/convex/` for backend, nearest `types/` for frontend    |
| Convex functions     | `/convex/` — reuse via `ctx.runQuery/Mutation/Action`    |
| Constants/enums      | Feature-specific `constants/`, `pnpm gen:metric-trees`   |

---

### Rule 3 — Code Sharing & Placement

Follow the project's code sharing rules:

| Consumers | Correct location |
|-----------|-----------------|
| Convex + Frontend only | `/convex/` — import in frontend via `"convex/..."` |
| Worker, Agent-sandbox, or Frontend (2+ packages) | `/shared/` |
| Convex functions + Worker only | `/convex/shared/` |

- **Convex types/constants reused in frontend** — verify that shared types,
  enums, and constants live in `/convex/` and are imported (not duplicated) in
  `/src/`. Flag duplicates.
- **Cross-package duplication** — if the same code appears in both
  `/agent-sandbox/` and `/src/` (or `/worker/`), flag and recommend moving to
  `/shared/`.
- **Misplaced shared code** — if code in `/src/` or `/convex/` is also needed
  by the worker or agent-sandbox, flag and suggest relocation to `/shared/`.

---

### Rule 4 — SATD Detection

Flag any **new** `TODO`, `FIXME`, or `HACK` comments introduced in the code.
Pre-existing ones are out of scope.

---

### Rule 5 — Complexity Heuristics

- **Large functions**: Any new or modified function exceeding ~50 lines — suggest
  extraction
- **Deep nesting**: 4+ levels of nesting (if/for/try) — suggest flattening with
  early returns or extraction
- **Cyclomatic complexity**: Functions with many branches (>10 paths) — suggest
  decomposition
- **Nested ternaries**: Ternary expressions nested 2+ levels deep — suggest
  replacing with `if`/`else` or `switch`
- **Dense one-liners**: Chained operations that sacrifice readability for
  brevity — suggest breaking into named intermediate steps

---

### Rule 6 — Project Conventions (from CLAUDE.md)

Flag violations of these project conventions:

- No `index.ts` / `index.tsx` files
- No `any` types — use `unknown` with type guards
- No `as` coercion when the source type is already known — **except**:
  `as const` is always allowed; `string` ↔ `Id<"x">` conversions are allowed;
  narrowing from `any` or `unknown` is allowed. Only flag `as` when casting
  between two known, incompatible types.
- No `++`/`--` operators — use `+= 1`/`-= 1`
- No empty arrow functions `() => {}` — use `() => undefined`
- No `Doc<"table">` directly — use type aliases from `convex/schemaTypes`
- No `filter()` in Convex queries — define proper indexes instead
- No `createdAt` fields — use `_creationTime`
- No cross-feature imports between sibling features — use `/src/components/`
  for shared code
- Context providers must use `@fluentui/react-context-selector`
- Convex functions must have `args` validators — `returns` validators are
  **not required** and should never be flagged as missing; TypeScript return
  types on the handler are the preferred pattern
- `v.any()` is acceptable for `args` when the type is complex and no validator
  exists yet — do not flag this
- Convex indexes must include all fields in their name
  (`by_userId_and_projectId`, not `user_project`)
- User-visible text must be wrapped with `<Trans>` or `` t`...` `` — the source
  language inside these wrappers should always be English (not German or others)
- Node actions for external APIs must have `"use node"` at top
- Convex files (`/convex/`) must use camelCase naming; component files must use
  PascalCase
- Z-index values above 999 must use constants from `/src/lib/z-index.ts`
- Convex backend throws must use `ConvexError({ severity, message })` —
  flag `throw new Error(...)` and `new ConvexError("plain string")`
  inside `/convex/` queries / mutations / actions
- Frontend error toasts must go through `toastError(error, fallback)`
  from `@/lib/errors` — flag any `toast.error(error.message)`,
  `toast.error(error instanceof Error ? error.message : ...)`,
  `toast.error(String(error))`, or `toast.error(<convex-message>)`
  call sites outside `src/lib/errors/toast.ts` and
  `src/api/hooks/use-handle-limit-error.ts`
- Inline UI rendering of caught errors must use
  `getUserFacingMessage(error) ?? t\`fallback\`` — flag direct reads of
  `error.message` (or `err.message` / `e.message`) in JSX or
  `setError(...)` calls in `src/`
- Fallback strings passed to `toastError` / `getUserFacingMessage`
  must describe the operation and be wrapped in `` t`...` `` at the
  call site — flag generic `t\`Something went wrong\`` /
  `t\`Error\`` / raw English strings

---

### Rule 7 — Correctness & Robustness

- **Correctness**: Does the code do what it claims? Are there edge cases?
- **Security**: Any injection risks, auth bypasses, data leaks?
- **Performance**: N+1 queries, unnecessary re-renders, missing indexes?
- **Error handling**: What happens when things fail?
- **Test coverage**: Are critical paths tested?
- **Inline guidance**: Do changes contradict nearby `// IMPORTANT:`, `// NOTE:`,
  `// WARNING:`, or `// HACK:` comments? Flag contradictions.

---

### Rule 8 — Edge Case Coverage

Rule 7 catches what's written incorrectly. Rule 8 catches what *isn't written
at all but should be*. Walk the diff through each category below and ask:
**"Does this code handle X, and if not, should it?"** Only flag when the
missing handling is in scope for the change — pre-existing gaps in unchanged
code are out of scope, and speculative future scenarios are not.

There is intentional overlap with Rules 1, 3, and 6 (e.g. schema/index gaps,
cross-package placement, i18n wrapping). Flag at the most specific rule and
do not double-count.

#### 8a — Failure and error paths

- Primary action throws — is rollback / cleanup defined?
- Network failures against external systems (Postgres, R2, DO, Qdrant,
  Stripe, Clerk, Ably)
- Convex action timeouts (default 60s) on long-running work
- Partial-write recovery — if one step in a multi-mutation flow fails, is
  the system in a recoverable state?
- OCC conflicts on hot documents (frequent writers, counters)

#### 8b — Empty, null, and boundary states

- Empty arrays / no rows / zero-count cases
- Single-item case where logic implicitly assumes ≥ 2
- First-time users with no existing data
- Documents missing newly-added optional fields (schema drift)
- Hard limits: Convex 1024-key object limit, 8192-item array limit,
  pagination cursors, query result caps, R2 blob sizes
- Off-by-one on ranges, dates, fiscal periods

#### 8c — Auth, permissions, and team scoping

- Every new query / mutation / action authenticates the caller
- Access scoped to the right team / space / portfolio / wiki
- Behavior when team membership changes mid-flow
- Public / share-link / unauthenticated surfaces — checks bypassed only
  where intentional
- Dev-only seed actions guarded with `envServer.STAGE === "prod"` throw

#### 8d — Concurrency and races

- Two users editing the same document simultaneously
- Cron job racing with a user-initiated mutation
- DO writes racing with direct Convex writes (DO must be the sole writer
  for collaborative bodies — documents, notes, annotator surfaces)
- Scheduled actions firing before their prerequisite mutation commits
- Per-team rate limits via `convex/rateLimiting/teamRateLimit.ts` for
  expensive operations

#### 8e — Cleanup, cascades, and lifecycle

- When the parent entity is deleted, what happens to children?
- New table → `convex/cleanup.ts` updated?
- Storage IDs — orphaned files cleaned up?
- DO blobs in R2 — entity-key cleanup wired?
- Cron jobs removed when their feature is deleted
- Soft-delete vs hard-delete — consistent with the surrounding domain?

#### 8f — Feature limits, rate limits, and function cost

- New count-gated resource registered in `convex/stripe/featureLimits.ts`?
- Expensive operations throttled via `assertTeamRateLimit` /
  `checkTeamRateLimit`?
- No `ctx.runQuery` / `ctx.runMutation` inside queries / mutations for
  shared logic — extracted to plain helpers with `QueryCtxOrMutationCtx`?
- Cascading internal function calls that should be a single composite?

#### 8g — Schema, types, and indexes

- New table → type alias added to `convex/schemaTypes.ts`?
- Every `withIndex` call has a matching index in `schema.ts` with all
  fields in the index name?
- New union variant → every `switch` / discriminated handler updated?
- New optional field → existing documents still load and render?

#### 8h — Frontend state, reactivity, and React rules

- Loading, error, empty, and partial states defined for each new surface
- Stale data after a mutation — does the subscription re-render?
- Server-paginated tables keep the shell mounted during refetches?
- Hook order: no hooks declared below an early return / guard
- React Compiler: no partial `useCallback` deps that branch on mode flags
- `@fluentui/react-context-selector` (not plain React context) for shared
  context, with `useMemo`'d provider values
- Select triggers render the translated label, not `<SelectValue />` when
  the item label is a `<Trans>` node

#### 8i — Collaborative documents

- Mutations to collaborative bodies go through the DO
  (`NoteDurableObject` / annotator DOs), never directly to Convex?
- New annotator surface → DO + R2 blob + entity-key cleanup wired?
- Yjs snapshot path defined for Convex persistence?

#### 8j — Cross-database consistency

- Convex + Postgres + DO writes — if one fails, what is the documented
  fallback?
- External Postgres queries via `convex/externalBackend/` are read-only?
- Vault (Postgres `vault_items`) vs Research Vault (Convex
  `researchItems`) — code references the correct system?

#### 8k — Test coverage

- New backend behavior covered by a Convex test suite?
- Per-feature test harness entry point updated?
- Test scenarios for the edge cases flagged above (empty / failure /
  permission denied / concurrent write)?

#### 8l — Error reporting and user feedback

- Every new user-initiated mutation / action handler in `src/`
  (button click, form submit, drag drop, keyboard shortcut) has a
  catch that either calls `toastError(error, fallback)` from
  `@/lib/errors` or short-circuits via `if (handleLimitError(error))
  return;`. Silent catches on user-initiated work are a bug.
- Background / passive failures call `reportError(error, { where })`
  — flag pure `console.error(error)` calls that should route through
  `reportError`.
- New Convex queries / mutations / actions throw `ConvexError({
  severity, message })` — flag `throw new Error(...)` or
  `new ConvexError("plain string")` in `/convex/` handlers.
- A new collaboratively-edited surface, file-upload flow, or
  external-API action defines what the user sees on failure (toast,
  inline banner, retry affordance). "Nothing visible" is a HIGH
  severity gap.

#### Severity for edge-case gaps

- **HIGH**: Missing handling will produce broken or unsafe code (no
  cleanup cascade for a new table, missing auth check, schema drift
  unhandled, direct Convex write to a collaborative body, silent catch
  on a user-initiated mutation / action — silent failure = broken UX)
- **MEDIUM**: Missing handling will produce suboptimal code (no empty
  state, missing rate limit on an expensive action, unwrapped
  user-visible string, missing `reportError` on a background failure)
- **LOW**: Stylistic or low-impact gaps (generic `t\`Something went
  wrong\`` fallback copy instead of operation-specific wording)

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

Group findings by file. If there are no violations, say so.

#### Impact Guidelines

- **HIGH**: Type safety holes (`any`, missing validators), duplicated
  code/components, security issues, correctness bugs, missing edge-case
  handling that produces broken or unsafe code (missing cleanup cascade,
  missing auth check, direct Convex write to a collaborative body)
- **MEDIUM**: Missing `Infer<typeof>`, inline validators that should be
  extracted, new SATD, inconsistent patterns, missing error handling,
  missing edge-case handling that produces suboptimal code (no empty
  state, missing rate limit on an expensive action)
- **LOW**: Naming convention mismatches (`v` prefix), complexity warnings,
  missing translations, stylistic edge-case gaps

When reviewing a PR, note the PR number and link at the top of the report.

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
  types/validators, or other problem that should be fixed
- `Improvement` — code works but could be better (e.g., extract shared util,
  move to `/shared/`, add stricter types)

Quality rule violations go in the same table with a `[Quality]` prefix in the
Requirement column (e.g., `[Quality] Duplicate presence logic in two hooks`).

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

**Applies to all modes** — diff modes and task mode alike.

Only ask questions if there is a genuine ambiguity that blocks grading (e.g.,
unclear intent, missing context you cannot infer). Otherwise, assign the grade
directly based on your analysis.

In task mode, assign a grade per task and one overall.

- **Ship**: Code is clean, correct, handles edge cases, follows conventions.
  Ready for production.
- **Needs work**: Generally solid but has specific issues that must be addressed.
  List them explicitly.
- **Rethink approach**: Fundamental problems with the approach. Step back and
  reconsider the design.

## Step 6: Fix Issues

After reporting and grading, **fix all HIGH, MEDIUM and LOW issues** found in Steps
3–4. For each issue:

1. Edit the code directly to resolve the issue.
2. Track all files you modified.

**Exception:** If a later task in the same task folder will explicitly address
the issue, skip the fix and note it as deferred.

## Step 7: Type Check

After fixing issues, run TypeScript on all files that were changed (by the
original diff/task AND by your fixes):

1. **Run TypeScript:**
   ```bash
   pnpm tsc --noEmit --pretty
   ```
   Filter output to changed files only.

2. **Fix all type errors** in changed files.

3. **Re-run TypeScript** after fixing. Repeat until zero errors remain on
   changed files.

**Do not run ESLint** — it is too slow.
**Do not run `build`** — only `tsc --noEmit`.

## Step 8: Rename Completed Task Files

**Task mode only.** After grading, if a task's verdict is **Complete** and its
task file does **not** already have the `X-` prefix, rename it:

```bash
git mv tasks/.../N-task-name.md tasks/.../X-N-task-name.md
```

This marks the task as done for future runs. Do this for every task that received
a **Complete** verdict and a **Ship** grade.

## Constraints

- Only report on code in scope for the detected mode — never flag pre-existing
  issues in unchanged code (diff modes) or unrelated code (task mode)
- Read changed/implemented files for context but do not scan unrelated
  directories
- Fix all HIGH, MEDIUM and LOW issues found — do not just report them
- Maximum of 5 parallel subagents at any time (task mode)
- Be specific — cite file paths and line numbers where possible
- If a requirement is ambiguous in the task file, note it but still attempt to
  verify (task mode)
- Check both backend (Convex functions, schema) and frontend (components, hooks,
  routes) as applicable
- Only ask questions when there is a genuine ambiguity blocking the grade
- All output must be in English

### False positive avoidance

Do not flag:
- Pre-existing issues in unchanged code (already stated, but worth reinforcing)
- Intentional functionality changes that are directly related to the task/PR
  purpose
- Issues explicitly silenced in code (e.g., eslint-disable, @ts-ignore with
  explanation)
- Pedantic nitpicks a senior engineer wouldn't call out in review
- General code quality opinions not backed by a specific rule above
