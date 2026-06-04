---
description: Lint, typecheck, fix all issues, then commit and push.
---

# Lint, Typecheck & Push

## Purpose

You are a code quality and git workflow assistant. Your task is to lint and typecheck the chartlang workspace with Biome + tsc, fix all errors and warnings, then stage changes, commit with a short descriptive message, and push to the remote.

## Task

### Phase 1: Lint (Biome)

1. Run `pnpm lint` once to collect all Biome errors and warnings. Note the specific file paths that have issues.
2. Fix the issues in the source files. Common chartlang rules: `noExplicitAny` (error), `noNonNullAssertion` (error), `useImportType` (error), `noConsoleLog` (warning).
3. Re-run Biome on **only the files that had errors/warnings**: `npx biome check --apply <file1> <file2> ...` (this auto-fixes safe rules; manual fixes still required for `noExplicitAny`, `noNonNullAssertion`, and type-model issues).
4. Repeat steps 2-3 until those files pass with zero errors and zero warnings.
5. **Never run `pnpm lint` (full workspace) a second time during this phase** — it is slower than per-file checks. Only re-check the specific files you touched.

### Phase 2: Typecheck

1. Run `pnpm typecheck` once to collect all TypeScript errors across packages. Note the specific package(s) and file paths that have issues.
2. Fix the issues in the source files. Honor strict-mode obligations: `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`.
3. Re-run typecheck on **only the affected packages**: `npx tsc --noEmit -p packages/<name>/tsconfig.json`.
4. Repeat steps 2-3 until those packages pass with zero errors.
5. **Never run `pnpm typecheck` (full workspace) a second time during this phase** — it is slower than per-package checks. Only re-check the specific packages you touched.

### Phase 3: Commit & Push

1. Run `git status` to see all changes (staged, unstaged, untracked). If there are no changes, inform the user and stop.
2. Run `git diff` and `git diff --cached` to understand what changed.
3. Run `git log --oneline -5` to match the repo's commit message style.
4. Stage all changes with `git add -A`.
5. Write a commit message that is:
   - As short as possible (ideally under 50 characters)
   - Descriptive of *what* changed, not *how*
   - In imperative mood (e.g., "add", "fix", "update", "remove")
   - Without a trailing period
   - Ending with the co-author line
6. Commit using a HEREDOC:
   ```
   git commit -m "$(cat <<'EOF'
   <message>

   Co-Authored-By: Claude <noreply@anthropic.com>
   EOF
   )"
   ```
7. Push to the remote with `git push`. If no upstream is set, use `git push -u origin HEAD`.

## Constraints

- Never amend an existing commit.
- Never force push.
- If a pre-commit hook fails, fix the issue, re-stage, and create a new commit.
- Do not skip hooks (no `--no-verify`).
- If there are no changes to commit, do not create an empty commit — just inform the user.
- Keep iterating on lint/typecheck until ALL issues (errors AND warnings) are resolved before moving to the commit phase.
