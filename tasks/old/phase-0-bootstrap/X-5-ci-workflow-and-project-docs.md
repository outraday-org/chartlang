# Task 5 — CI Workflow + Project Docs

> **Status: TODO**

## Goal

Land the CI workflow (§22.6), PR template (§22.7), and the human-facing
project docs (root `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`).
After this task, the first PR opened against `main` runs every gate
green on the empty bootstrap, and Phase 0 is complete.

## Prerequisites

- Task 1 complete: directory tree + root configs + `pnpm install`.
- Task 2 complete: per-package scaffold; `pnpm build` works.
- Task 3 complete: all four gate helper scripts exit 0 on the
  bootstrap and have teeth on real input.
- Task 4 complete: every `docs/<section>/` page exists as a stub that
  the root README can link to.

## Current Behavior

No `.github/`, no PR template, no CI. Root `README.md` is missing (or
is the one-line stub from Task 3's verification step). No
`CONTRIBUTING.md` or `CODE_OF_CONDUCT.md`. Every `docs/<section>/` has
its stub pages from Task 4.

## Desired Behavior

CI runs on every push to `main` and every PR, matrix-tested on Ubuntu
+ macOS × Node 20 + 22, gating typecheck / lint / format / build /
test+coverage / conformance / bench / docs-check / readme-check. The
PR template injects the §22.7 checklist. The root README satisfies
the §17.1 structure (verified by `pnpm readme:check`).
`CONTRIBUTING.md` covers the §22.3-listed sections. `CODE_OF_CONDUCT.md`
is the Contributor Covenant 2.1 verbatim. The bootstrap PR is open and
green.

## Requirements

### 1. `.github/workflows/ci.yml` (§22.6 verbatim)

Copy the `ci.yml` block from §22.6 verbatim. Specifically:

- `name: CI`
- Triggers: `push.branches: [main]`, `pull_request.branches: [main]`.
- `permissions`: `contents: read`, `id-token: write`,
  `pull-requests: write`.
- `concurrency`: `group: ci-${{ github.ref }}`,
  `cancel-in-progress: true`.
- One job `test` with matrix `os: [ubuntu-latest, macos-latest]` ×
  `node: [20, 22]`.
- Steps in order:
  1. `actions/checkout@v4`
  2. `pnpm/action-setup@v4` (`with: { version: 9 }`)
  3. `actions/setup-node@v4` (`node-version: ${{ matrix.node }}`,
     `cache: pnpm`)
  4. `pnpm install --frozen-lockfile`
  5. `pnpm typecheck`
  6. `pnpm lint`
  7. `pnpm format:check`
  8. `pnpm build`
  9. `pnpm test`
  10. `pnpm conformance`
  11. `pnpm bench:ci`
  12. `pnpm docs:check`
  13. `pnpm readme:check`
  14. `codecov/codecov-action@v4` — only on `ubuntu-latest` + Node 20;
      uploads `./coverage/lcov.info`; `fail_ci_if_error: true`.
- Below the job, keep the commented-out `release:` block from §22.6
  verbatim (no edits, no deletions — the comment block explains how
  to flip to CI-driven releases later per §22.11).

**Codecov caveat:** `codecov/codecov-action@v4` reads
`./coverage/lcov.info`, which is produced by `pnpm coverage:report`
(Task 3). The §22.6 verbatim block does not include a
`pnpm coverage:report` step before the Codecov upload. Add the line

```yaml
            - run: pnpm coverage:report   # merges per-package coverage to ./coverage/lcov.info for Codecov
```

after `pnpm test` and before the Codecov step. Run it on every matrix
combination (it's cheap; uniform matrix is easier to reason about).
This is the **one** justified divergence from §22.6 verbatim;
everything else is copy-paste.

### 2. `.github/pull_request_template.md` (§22.7 verbatim)

Copy from §22.7 verbatim:

```markdown
## Summary

<!-- 1–3 bullets describing the change. -->

## Checklist

- [ ] Tests added / updated (§16 — coverage stays at 100%).
- [ ] Docs added / updated (§17 — JSDoc on new exports, package
      README, `docs/` page if a new concept).
- [ ] Changeset added (`pnpm changeset`).
- [ ] For new `ta.*` primitives: all 5 files from §16.6.
- [ ] For new drawing kinds: schema variant added to
      `packages/core/src/drawings/schema.ts` AND canvas2d-adapter
      render support AND conformance scenario.
- [ ] CI green (test, lint, coverage, conformance, bench, docs).
```

### 3. Root `README.md` (§17.1 — required structure, ≤ 300 lines)

Sections in order:

1. **Elevator pitch** — single paragraph, ≤ 80 words. Mention:
   `chartlang` is an open-source TypeScript embedded DSL for writing
   indicator / drawing / alert scripts that run on any conforming
   chart adapter.
2. **Runnable example** — a 10-line fenced ` ```ts ` block. Use the
   canonical PLAN §4 example shape:

   ```ts
   import { defineIndicator, ta, plot, color } from "@invinite-org/chartlang-core";

   export default defineIndicator({ name: "ema-20" }, () => {
       const fastEma = ta.ema(series.close, 20);
       plot(fastEma, { color: color.purple });
   });
   ```

   Add a comment noting this script needs Phase 1's runtime to
   actually execute, and link to
   `docs/getting-started/write-your-first-script.md`.
3. **Status & version badges** — npm / build / coverage / license
   badges. The npm badge can point to `@invinite-org/chartlang-core`
   (returns 404 until first publish — that is fine for the bootstrap).
   Build badge:
   `https://github.com/outraday-org/chartlang/actions/workflows/ci.yml/badge.svg`.
   Coverage badge points at Codecov (will show "unknown" until first
   upload). License: shields.io MIT badge.
4. **"Why"** — three bullets:
   - Open source, MIT-licensed, no chart-vendor lock-in.
   - Portable across charts via the adapter contract; one script
     runs on any conforming front-end.
   - Sandboxable for server-side alert execution via the QuickJS
     host.
5. **Install** — three one-liners per role:
   - **Script author**: `pnpm add @invinite-org/chartlang-core`.
   - **Adapter author**: `pnpm add @invinite-org/chartlang-adapter-kit`.
   - **Embedder**: `pnpm add @invinite-org/chartlang-core
     @invinite-org/chartlang-compiler @invinite-org/chartlang-runtime
     @invinite-org/chartlang-host-worker`.
6. **Quickstart in 60 seconds** — three commands ending in a rendered
   chart. For the bootstrap these are aspirational. Mark them as
   "Available from Phase 1" with a link to
   `docs/getting-started/write-your-first-script.md`.
7. **Architecture diagram** — `mermaid` fenced block mirroring
   PLAN §2: `[script.chart.ts] → compiler → runtime → adapter →
   chart`.
8. **Links** — bulleted list:
   - Docs site: `https://chartlang.dev` (placeholder URL — repo
     hasn't deployed yet).
   - Language spec: `./docs/spec/grammar.md`.
   - Primitive reference: `./docs/primitives/`.
   - Adapter list: `./docs/adapters/reference/`.
   - Conformance reports: forward-link to canvas2d-adapter
     `CONFORMANCE.md` (Phase 1 lands the file).
   - Examples: `./examples/`.
   - `CONTRIBUTING.md`
   - `CODE_OF_CONDUCT.md`
   - `LICENSE`

Length cap: 300 lines. Stay well under.

After writing the README, run `pnpm readme:check` and confirm it
passes.

### 4. `CONTRIBUTING.md` (§22.3 — required sections)

Sections, in order:

1. **Setup commands** — mirror §22.2 steps 1–6 (skip step 1's
   `gh repo create` because the repo exists):

   ```bash
   git clone https://github.com/outraday-org/chartlang
   cd chartlang
   corepack enable && corepack prepare pnpm@9.12.0 --activate
   nvm use   # uses .nvmrc → Node 20
   pnpm install
   pnpm typecheck && pnpm lint && pnpm test && pnpm build
   ```

2. **Test + coverage gate (§16)** — short summary plus links:
   - 100% line / statement / branch / function coverage per
     package, enforced by `vitest.config.ts`.
   - Paste the per-package §16.3 layer matrix.
   - `pnpm changeset` required on every PR that touches publishable
     code.

3. **Documentation requirements (§17)** — short summary plus links:
   - JSDoc on every exported symbol with `@example`, `@since`,
     stability marker; primitive-specific tags per §17.2.
   - Package `README.md` ≤ 100 lines, root `README.md` ≤ 300 lines.
   - New concepts get a narrative page under `docs/`.

4. **Provenance + relicense note for math ported from
   `../invinite/` (§3.1)** — provide the literal header template that
   every ported file must carry:

   ````markdown
   When porting math from `../invinite/src/components/trading-chart/
   indicators/<id>.ts` (or any sibling under that tree), prepend the
   following 4-line header to the new file in `packages/runtime/src/ta/`:

       // Ported from invinite/src/components/trading-chart/indicators/<id>.ts
       //   (commit <sha at port time>, © Invinite).
       // Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
       // provenance contract; the math is the reference, the code style is not.

   Translate, do not transcribe. The behavioural contract — same
   numbers in, same numbers out for the §16.6 golden bars — is what
   the port owes; copying the plugin shape or naming conventions is
   not. See PLAN §3.1 "Provenance is 'look here for behavior,' not
   'look here for code style.'".
   ````

5. **Changeset workflow** — `pnpm changeset` before pushing; link to
   `.changeset/README.md` (Task 1).

6. **PR checklist** — auto-injected via
   `.github/pull_request_template.md`. Link to it.

Length cap: 300 lines.

### 5. `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1)

Copy the official Contributor Covenant 2.1 text verbatim from
`https://www.contributor-covenant.org/version/2/1/code_of_conduct.md`.

### 6. Lint, format, gate-test the whole repo

After writing everything in this task:

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm coverage:report
pnpm conformance
pnpm bench:ci
pnpm docs:check
pnpm readme:check
```

Every command must exit 0. This is the local mirror of what the CI
workflow runs on the first PR.

### 7. Open the bootstrap PR

Push the branch and open a PR titled `chore: bootstrap workspace +
tooling` (matches the §22.2 step-7 commit message). The PR description
should:

- Link to PLAN.md §22 ("Starting the Repo").
- List each phase-0 task by file and state it complete.
- Confirm the PR template's checklist. For the bootstrap PR itself,
  several items — new primitives, new drawing kinds — do not apply;
  leave them unchecked with a one-line "N/A — bootstrap PR" note.

Wait for CI to pass on every matrix combination (Ubuntu + macOS ×
Node 20 + 22) before merging. Codecov will upload `./coverage/lcov.info`
but the report is empty-passing (no `src/**/*.ts` executable lines
not excluded by `vitest.config.ts`).

### 8. What this task does NOT do

- Does **not** write `docs/` content (Task 4 owns that).
- Does **not** ship a vitepress config (see Task 4 Requirement 5).
- Does **not** uncomment the `release:` job in `ci.yml`. Manual
  release workflow per §22.11 is the current policy.
- Does **not** add `NPM_TOKEN` to repo secrets. There is no CI
  release job to consume it.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `.github/workflows/ci.yml` | Create | §22.6 verbatim (+ one-line `coverage:report` addition). |
| `.github/pull_request_template.md` | Create | §22.7 verbatim. |
| `README.md` | Create (or replace Task-3 stub) | §17.1 root README structure. |
| `CONTRIBUTING.md` | Create | §22.3 required sections + §3.1 relicense template. |
| `CODE_OF_CONDUCT.md` | Create | Contributor Covenant 2.1 verbatim. |

## Acceptance Criteria

- [ ] `.github/workflows/ci.yml` matches §22.6 verbatim except for
      the one annotated `pnpm coverage:report` step.
- [ ] `.github/pull_request_template.md` matches §22.7 verbatim.
- [ ] `README.md` exists, is ≤ 300 lines, and passes
      `pnpm readme:check`.
- [ ] `CONTRIBUTING.md` exists, covers all 6 sections from §22.3,
      includes the §3.1 relicense header template.
- [ ] `CODE_OF_CONDUCT.md` exists and is Contributor Covenant 2.1
      verbatim with the enforcement email substituted.
- [ ] `pnpm readme:check` exits 0.
- [ ] `pnpm docs:check` exits 0.
- [ ] `pnpm coverage:report` exits 0 after `pnpm test`, writing
      `./coverage/lcov.info` and `./coverage/coverage-summary.json`.
- [ ] `pnpm conformance` exits 0 with the
      `conformance: 0 scenarios, 0 failures.` message.
- [ ] `pnpm bench:ci` exits 0 (no `*.bench.test.ts` files yet).
- [ ] CI runs on the bootstrap PR; every matrix combination
      (Ubuntu + macOS × Node 20 + 22) reports green.
- [ ] Codecov uploads `./coverage/lcov.info` from the
      `ubuntu-latest` + Node 20 leg and reports a (trivially) green
      coverage delta.
- [ ] The commented-out `release:` job in `ci.yml` is preserved as a
      comment block (not removed), matching §22.6.
- [ ] Bootstrap PR merged into `main`. Phase 0 is complete.
