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
  PLAN.md §22.6); (5) the landing-site task set adds
  `pnpm --filter chartlang-site typecheck` + `… build` steps (after the
  conformance block, before `pnpm bench:ci`) so a broken marketing site
  fails the matrix, plus a separate `e2e-site` job (Ubuntu, Node 20,
  `needs: test`, own `e2e-site-${{ github.ref }}` concurrency group)
  that installs Chromium, builds `apps/site`, runs its Playwright suite,
  and uploads `apps/site/playwright-report/` on failure.
- **GitHub Pages is retired.** The old `workflows/docs.yml` (VitePress
  build → Pages deploy) is deleted; docs deploy from `main` via the
  Netlify GitHub App, and `pnpm docs:build` in the `test` job is the
  only docs CI gate. Pages must be disabled at the repo level manually
  (no public API); previews + production deploys for both Netlify sites
  are posted by the Netlify GitHub App, so no `netlify-*` workflow
  exists here.
- The `ci-gate` job (`name: CI Gate`) is the **single required status
  check** in the branch ruleset, replacing the four `Test (os / Node n)`
  matrix contexts. The `test` job is skipped on the
  `changeset-release/main` PR (`if: github.head_ref != …`), which leaves
  per-matrix checks perpetually "Expected" and blocks merge. `ci-gate`
  runs with `if: always()`, `needs: test`, and passes when
  `needs.test.result` is `success` **or** `skipped`, failing on
  `failure`/`cancelled`. If you rename the job or its matrix legs, update
  the ruleset's required contexts to match.
- The `detect` job emits `is_release_merge` by querying the PR(s)
  associated with the pushed commit
  (`/commits/{sha}/pulls`, robust across merge/squash/rebase) and checking
  for `head.ref == 'changeset-release/main'`. `test` skips its matrix on a
  push to `main` **only** when that is true — the merge of the "Version
  Packages" PR, whose code was already tested on the PR that produced it.
  Every other push (feature merges) still runs the matrix. The job needs
  `pull-requests: read` and uses `GH_TOKEN: ${{ github.token }}`.
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
