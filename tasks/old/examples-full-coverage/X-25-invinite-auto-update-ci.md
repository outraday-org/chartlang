# invinite — Auto-Update CI (re-sync on chartlang release)

> **Status: TODO**

## Goal

Close the loop: when chartlang publishes new examples, invinite
automatically bumps `@invinite-org/chartlang-examples`, re-runs the
template sync, and opens a PR — so the template dialog stays current
without manual work. **This task is in the `../invinite/` repo.**

## Prerequisites

Task 24 (the `chartlang:templates:sync` script + gate exist in invinite)
and Task 23 (chartlang dispatches `chartlang-examples-updated` on
main/release).

> Read invinite's `.github/` workflow conventions first and match them
> (runner image, pnpm setup, PR-bot identity, required checks).

## Current Behavior

The template catalogue only updates when a human bumps the dependency
and runs `pnpm chartlang:templates:sync` locally.

## Desired Behavior

- A `repository_dispatch` (type `chartlang-examples-updated`) from
  chartlang — or a scheduled fallback — triggers an invinite workflow
  that bumps the dep, runs the sync, and opens (or updates) a PR.

## Requirements

### 1. Receiver workflow

- Add `.github/workflows/sync-chartlang-templates.yml` (invinite) with
  triggers:
  - `repository_dispatch: { types: [chartlang-examples-updated] }`
    (primary — fired by Task 23's `notify-invinite.yml`),
  - `workflow_dispatch` (manual),
  - `schedule` (a daily/weekly fallback in case a dispatch is missed).
- Steps: checkout → setup pnpm/node (match invinite CI) → bump
  `@invinite-org/chartlang-examples` to the latest published version
  (`pnpm up @invinite-org/chartlang-examples@latest`, or the version
  from `client_payload` when present) → `pnpm install` →
  `pnpm chartlang:templates:sync` → `pnpm chartlang:templates:gate` →
  if the working tree changed, open/update a PR.

### 2. PR automation

- Use the repo's existing PR-bot pattern (e.g.
  `peter-evans/create-pull-request` or `gh pr create`) with a stable
  branch name (`chore/chartlang-templates-sync`) so repeat runs update
  one PR rather than spawning many. PR title/body note the new
  chartlang examples version and that the catalogue is generated. Label
  per invinite conventions; assign reviewers if the repo expects it.
- Required status checks (typecheck/lint/test +
  `chartlang:templates:gate`) must pass before the PR is mergeable —
  the workflow does **not** auto-merge unless invinite policy allows it
  (default: leave for human review).

### 3. Token / secret

- The chartlang→invinite dispatch (Task 23) needs an
  `INVINITE_DISPATCH_TOKEN` with `actions:write` on invinite; this task
  documents the matching invinite-side trust (or, if the org declines a
  cross-repo PAT, relies solely on the `schedule` + Renovate/Dependabot
  bump — document whichever path is chosen in invinite `.github/`
  docs).

### 4. Dependabot/Renovate fallback (optional but recommended)

- If invinite uses Renovate/Dependabot, ensure
  `@invinite-org/chartlang-examples` is in scope so a version bump PR is
  raised even without the dispatch; add a post-upgrade task / CI step
  that runs `chartlang:templates:sync` so the bumped PR also regenerates
  the catalogue.

## Files to Create / Modify (in `../invinite/`)

| File | Action | Purpose |
|------|--------|---------|
| `.github/workflows/sync-chartlang-templates.yml` | Create | Dispatch/scheduled re-sync + PR. |
| `.github/dependabot.yml` or Renovate config | Modify (if present) | Keep the package in bump scope. |
| invinite `.github/` docs / `CLAUDE.md` | Modify | Document the automation + token. |

## Gates (invinite repo)

- The workflow runs on `workflow_dispatch` and produces a green PR when
  a new version exists (verify with a manual trigger).
- `chartlang:templates:gate` passes inside the workflow.
- invinite CI green.

## Changeset

Per invinite conventions (CI-only change; typically none).

## Acceptance Criteria

- A chartlang `chartlang-examples-updated` dispatch (or manual/scheduled
  trigger) opens/updates a single `chore/chartlang-templates-sync` PR
  that bumps the dep + regenerates the catalogue.
- The PR passes invinite CI incl. `chartlang:templates:gate`; no
  auto-merge unless invinite policy allows.
- Automation + token documented. End-to-end: chartlang push to main →
  invinite PR with refreshed templates.
