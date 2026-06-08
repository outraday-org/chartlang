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
  to regenerate the language-service hover registry and fail on drift. Any
  other change to `ci.yml` must update PLAN.md §22.6 in the same PR.
- The commented-out `release:` job at the bottom of `ci.yml` is preserved
  intentionally — manual release per §22.11 is the current policy. Do not
  delete the block; uncomment it (and add `NPM_TOKEN` to repo secrets) only
  when flipping to CI-driven releases.
- `pull_request_template.md` is **§22.7 verbatim** — six checklist items.
  New checklist items go in PLAN.md §22.7 first, then mirror here.

## Gate matrix

CI runs `ubuntu-latest` × `macos-latest` × Node `20` × `22`. Codecov upload
runs only on `ubuntu-latest` + Node 20 to avoid four duplicate uploads per
PR. All other gate steps run on every leg.
