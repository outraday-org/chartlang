# .github/

GitHub-specific configuration: CI workflow and pull-request template.

## Conventions

- `workflows/ci.yml` is **§22.6 verbatim** with three annotated
  divergences: (1) a `pnpm coverage:report` step is inserted between
  `pnpm test` and the Codecov upload (§22.6's block omits it; the
  Codecov action needs the merged `./coverage/lcov.info` produced by
  `scripts/coverage-merge.ts`); (2) Phase 2 Task 2 adds a `pnpm docs:gate`
  step after `pnpm docs:check` — the gate that regenerates
  `docs/primitives/ta/<id>.md` and byte-compares against the committed
  tree; (3) Phase 4 Task 13 adds `pnpm hover:check` after `pnpm docs:gate`
  to regenerate the language-service hover registry and fail on drift;
  (4) the skills-folder task set adds a `pnpm skills:gate` step after
  `pnpm hover:check` — regenerates
  `skills/chartlang-coding/references/primitives.md` from `ta.*`/`draw.*`
  JSDoc and byte-diffs against the committed file (repo tooling, not in
  PLAN.md §22.6).
- The `ci-gate` job (`name: CI Gate`) is the **single required status
  check** in the branch ruleset, replacing the four `Test (os / Node n)`
  matrix contexts. The `test` job is skipped on the
  `changeset-release/main` PR (`if: github.head_ref != …`), which leaves
  per-matrix checks perpetually "Expected" and blocks merge. `ci-gate`
  runs with `if: always()`, `needs: test`, and passes when
  `needs.test.result` is `success` **or** `skipped`, failing on
  `failure`/`cancelled`. If you rename the job or its matrix legs, update
  the ruleset's required contexts to match.
- The `changes` job emits `has_changesets` by counting `.changeset/*.md`
  (excluding `README.md`). `test` skips its matrix on a push to `main`
  when `has_changesets == 'false'` — the **publish push** that follows a
  "Version Packages" merge — since that code was already tested on the PR
  that produced it. Feature merges (changesets present) still run the
  matrix on push.
- The `release:` job at the bottom of `ci.yml` is live and runs only on
  `push` events to `main`. Its `if` uses `always()` plus
  `needs.test.result != 'failure'/'cancelled'` so it still publishes when
  `test` was **skipped** on the publish push, but never publishes when the
  matrix actually ran and failed. It uses `changesets/action@v1` to
  open/update the Version Packages PR (changesets present) and to publish
  `changeset publish` when none remain. Keep write permissions job-local
  and ensure `NPM_TOKEN` is configured in repo secrets before merging
  release PRs. Manual fallback is `pnpm publish:release` from a maintainer
  machine.
- `pull_request_template.md` is **§22.7 verbatim** — six checklist items.
  New checklist items go in PLAN.md §22.7 first, then mirror here.

## Gate matrix

CI runs `ubuntu-latest` × `macos-latest` × Node `20` × `22`. Codecov upload
runs only on `ubuntu-latest` + Node 20 to avoid four duplicate uploads per
PR. All other gate steps run on every leg.
