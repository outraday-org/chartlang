# Contributing to chartlang

Thanks for considering a contribution. This document covers what every
PR needs to land — setup, the test and coverage gate, documentation
requirements, the provenance rule for math ports from `../invinite/`,
the changeset workflow, and the PR checklist. PLAN.md §22 is the
canonical reference; this file is the operational summary.

By participating, you agree to abide by the
[Code of Conduct](./CODE_OF_CONDUCT.md).

## 1. Setup

```bash
git clone https://github.com/outraday-org/chartlang
cd chartlang
corepack enable && corepack prepare pnpm@9.12.0 --activate
nvm use   # uses .nvmrc → Node 20
pnpm install
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

The last line is the local mirror of what the CI workflow runs on every
PR. If any of those four commands fail, the PR will fail in CI.

## 2. Test + coverage gate (§16)

Every package enforces **100% line / statement / branch / function**
coverage via `vitest.config.ts`. The gate is wired from PR 1 — there is
no "add tests in a follow-up" allowance.

Per-package test layers (PLAN.md §16.3):

| Package | Unit | Property | Golden | Type | Sandbox-escape | Bench | Conformance |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `@invinite-org/chartlang-core` | ✓ |   |   | ✓ |   |   |   |
| `@invinite-org/chartlang-compiler` | ✓ | ✓ | ✓ |   |   | ✓ |   |
| `@invinite-org/chartlang-runtime` | ✓ | ✓ | ✓ |   |   | ✓ |   |
| `@invinite-org/chartlang-host-worker` | ✓ |   |   |   | ✓ | ✓ | ✓ |
| `@invinite-org/chartlang-host-quickjs` | ✓ |   |   |   | ✓ | ✓ |   |
| `@invinite-org/chartlang-adapter-kit` | ✓ |   |   | ✓ |   |   | ✓ |
| `@invinite-org/chartlang-language-service` | ✓ |   |   |   |   |   |   |
| `@invinite-org/chartlang-editor` | ✓ |   |   |   |   |   |   |
| `@invinite-org/chartlang-cli` | ✓ |   |   |   |   |   |   |
| `@invinite-org/chartlang-conformance` | ✓ |   |   |   |   |   | ✓ |
| `examples/canvas2d-adapter` | ✓ |   | ✓ |   |   |   | ✓ |

Run locally:

```bash
pnpm test               # all packages, full coverage report
pnpm conformance        # adapter conformance suite
pnpm bench:ci           # benchmarks in run-once mode
pnpm coverage:report    # merges per-package coverage to ./coverage/lcov.info
```

`pnpm changeset` is required on every PR that touches publishable code.
See section 5.

## 3. Documentation requirements (§17)

- **JSDoc on every exported symbol.** `@example`, `@since`, and a
  stability marker (`@stable` / `@experimental` / `@frozen`) are
  required. For `ta.*` and `draw.*` namespaces add `@formula` and
  `@anchors`. Enforced by `pnpm docs:check`.
- **Package README ≤ 100 lines** (§17.1). One sentence of purpose,
  install line, minimum-viable API call (5–15 lines of code), docs
  link, stability label.
- **Root README ≤ 300 lines** (§17.1). Pitch, runnable example,
  badges, install, why, quickstart, architecture, links.
- **`docs/<area>/` page** for any new concept. Auto-generated pages
  live under `docs/primitives/<area>/` and are owned by
  `packages/cli/src/gen-docs.ts`; do not hand-edit those. Narrative
  pages (`docs/language/*`, `docs/adapters/*`, etc.) are
  hand-authored.

Run locally:

```bash
pnpm docs:check     # JSDoc gate
pnpm readme:check   # README structure + length gate
```

## 4. Provenance + relicense note (§3.1)

When porting math from
`../invinite/src/components/trading-chart/indicators/<id>.ts` (or any
sibling under that tree), prepend the following 4-line header to the
new file in `packages/runtime/src/ta/`:

    // Ported from invinite/src/components/trading-chart/indicators/<id>.ts
    //   (commit <sha at port time>, © Invinite).
    // Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
    // provenance contract; the math is the reference, the code style is not.

**Translate, do not transcribe.** The behavioural contract — same
numbers in, same numbers out for the §16.6 golden bars — is what the
port owes. Copying the plugin shape, the helper names, or the
register-with-the-chart-engine boilerplate is **not** what the port
owes. See PLAN.md §3.1: "Provenance is 'look here for behavior,' not
'look here for code style.'"

Every port also lands the full §16.6 / §22.10 set in the same PR (unit
test, property test, golden test, bench test, JSDoc with `@formula`
and `@warmup`, a conformance scenario, and the auto-generated
`docs/primitives/ta/<id>.md`). No "land the port now, add tests in a
follow-up" allowance.

## 5. Changeset workflow

Run `pnpm changeset` before pushing any PR that touches publishable
code (anything under `packages/*/src/`). Pick the affected packages
and the semver bump; commit the generated file in
[`.changeset/`](./.changeset/) alongside your code change. The CI release workflow
collects pending changesets into the "Version Packages" PR and
publishes to npm when that PR merges to `main`.

PRs that don't touch publishable code (docs, tooling-only edits, CI
config) don't need a changeset, but adding an empty one is still
welcome — it makes the release log more readable.

Maintainers can fall back to a local publish with `pnpm publish:release`
after running the normal gates and sourcing `NPM_TOKEN`.

## 6. PR checklist

The pull request template lives at
[`.github/pull_request_template.md`](./.github/pull_request_template.md)
and is auto-injected when you open a PR via the GitHub UI. Tick each
box, or write a one-line "N/A — <reason>" note next to items that
don't apply (e.g. the new-primitive line on a docs-only PR).

CI must be green on every matrix combination (Ubuntu + macOS × Node 20
+ 22) before a maintainer will merge.
