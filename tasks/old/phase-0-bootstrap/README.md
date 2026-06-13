# Phase 0 — Repo Bootstrap

> **Plan reference:** PLAN.md §22 "Starting the Repo" (§22.1–§22.8),
> with cross-cuts into §3 (package layout / responsibilities),
> §16 (testing — full coverage), §17 (documentation — required).
> **Prerequisite for:** every later phase.
> **Version target:** none (pre-`0.1`).

## Overview

Stand up the empty `chartlang` monorepo so that
`pnpm install && pnpm typecheck && pnpm lint && pnpm test && pnpm build`
all pass green from a clean clone, every CI gate the plan calls out
is live, and the next PR can drop real feature code into
`packages/core/src/` without changing a single piece of tooling.

The deliverable is **scaffolding only** — no primitives, no compiler
logic, no runtime loops, no adapters. The repo is "fully wired" per
§22.2: lint / format / typecheck / test / coverage / docs / bench /
conformance gates all live in CI, every package has a stub README
naming its public surface (§3.2), every gate script exits cleanly on
the empty bootstrap.

## Current State

`/Users/julianwaibel/Documents/GitHub/chartlang/` currently contains:

```
chartlang/
├── PLAN.md                # the spec
├── .git/                  # git history
├── .claude/               # Claude Code config
└── tasks/                 # per-phase task plans (this folder)
```

No `package.json`, no workspace, no packages, no CI. Git remote should
point at `https://github.com/outraday-org/chartlang`.

## Target State

After all four tasks land, the repo matches §3's layout and §22's
bootstrap surface:

```
chartlang/
├── package.json                       # workspace root, "private": true
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── biome.json
├── .changeset/{config.json,README.md}
├── .editorconfig
├── .nvmrc
├── .npmrc
├── .env.example
├── .gitignore
├── LICENSE                            # MIT
├── README.md                          # §17.1 required structure
├── CONTRIBUTING.md                    # §22.3 required sections
├── CODE_OF_CONDUCT.md                 # Contributor Covenant 2.1
├── .github/
│   ├── workflows/ci.yml               # §22.6
│   └── pull_request_template.md       # §22.7
├── docs/
│   ├── index.md
│   ├── getting-started/
│   ├── language/
│   ├── primitives/{ta,plot,draw,alert,input}/
│   ├── adapters/{reference/}
│   ├── hosts/
│   ├── spec/{grammar,semantics,manifest,emissions,versioning}.md
│   └── reference/
├── examples/
│   ├── canvas2d-adapter/              # workspace package (PR 9)
│   │   └── src/
│   └── scripts/                       # seeded but empty
├── packages/
│   ├── core/                          # @invinite-org/chartlang-core
│   ├── compiler/                      # @invinite-org/chartlang-compiler
│   ├── runtime/                       # @invinite-org/chartlang-runtime
│   ├── host-worker/                   # @invinite-org/chartlang-host-worker
│   ├── host-quickjs/                  # @invinite-org/chartlang-host-quickjs
│   ├── adapter-kit/                   # @invinite-org/chartlang-adapter-kit
│   ├── language-service/              # @invinite-org/chartlang-language-service
│   ├── editor/                        # @invinite-org/chartlang-editor
│   ├── cli/                           # @invinite-org/chartlang-cli
│   └── conformance/                   # @invinite-org/chartlang-conformance
└── scripts/
    ├── scaffold.ts
    ├── docs-check.ts
    ├── readme-check.ts
    ├── run-conformance.ts
    └── coverage-merge.ts
```

Each `packages/<name>/` and `examples/canvas2d-adapter/` ships:

- `package.json` (per §22.4 template)
- `tsconfig.json` (per §22.4 template)
- `vitest.config.ts` with the §16.1 `thresholds: { lines: 100, ... }` block
- `README.md` (≤ 100 lines, §17.1 structure, public surface per §3.2)
- `src/index.ts` exporting only `PACKAGE_VERSION = "0.0.0"`
- `src/index.test.ts` with the §22.4 placeholder test

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **One bootstrap PR, five execution tasks** | §22.8 names "Root scaffold + CI" as PR 1. Splitting it for execution keeps each spec focused on one surface (workspace / scaffold / gates / docs stubs / CI + project docs) without expanding scope — they all land in the same PR. |
| **npm scope `@invinite-org/chartlang-*`, GitHub owner `outraday-org`** | npm scope is fixed by §3.2's responsibility table; GitHub repo is `https://github.com/outraday-org/chartlang`. Per-package `repository.url` is filled in with `outraday-org` (not the placeholder `<OWNER>`). |
| **Real gate-script implementations, not stubs** | `docs:check`, `readme:check`, `coverage:report`, `conformance` are CI-blocking from PR 1. Real implementations now means later phases can rely on them; stub-then-replace risks the "follow-up never happens" trap §22.10 calls out. The empty bootstrap passes each gate naturally (no exports → no JSDoc gaps; no scenarios → 0 failures). |
| **100% coverage gate from day 0** | Threshold is wired into every `packages/*/vitest.config.ts` from PR 1. The §22.4 placeholder test (`expect(PACKAGE_VERSION).toBe("0.0.0")`) trivially achieves 100% on a one-export module. Adding a new export with no test fails the gate immediately — the policy is self-enforcing from the first PR. |
| **Manual release flow (§22.11) — no `NPM_TOKEN` in CI** | The release job in `.github/workflows/ci.yml` stays commented per §22.6. Publishing is a maintainer-local `pnpm release` step. No secrets ship in PR 1. |
| **Scaffold is idempotent and rerunnable** | `scripts/scaffold.ts` skips any file that already exists. Future packages get the same template via the same command (§22.4). Phase 0 runs it once; later phases never edit per-package scaffolds by hand. |
| **`examples/scripts/` is seeded but empty** | §22.2 step 2 lists four `.chart.ts` filenames as future seeds. Phase 0 creates the directory; Phase 1 writes the files. Avoids landing files that depend on primitives that don't exist yet. |
| **`docs/` site has stub pages with TBD bodies, not empty files** | §17.6's `pnpm docs:check` enforces the spec/page-link structure. Stubs let the gate pass without `--no-verify`. Each stub names its target section in PLAN.md so phase 2+ knows where the content lives. |

## Dependency Graph

```
Task 1 (workspace skeleton + root configs)
   |
   |  - directory tree
   |  - package.json, pnpm-workspace.yaml, tsconfig.base.json,
   |    biome.json, .gitignore, .npmrc, .env.example, .nvmrc,
   |    .editorconfig, .changeset/, LICENSE
   |  - pnpm install (root devDependencies)
   v
Task 2 (scaffold script + per-package surface)
   |
   |  - scripts/scaffold.ts
   |  - per-package: package.json, tsconfig.json, vitest.config.ts,
   |    README.md, src/index.ts, src/index.test.ts
   |  - pnpm install (now resolves workspace pkgs)
   |  - pnpm typecheck / lint / test / build all green
   v
Task 3 (gate helper scripts: docs-check, readme-check, run-conformance, coverage-merge)
   |
   |  - real implementations that pass on the empty bootstrap
   |  - each script exits 0 cleanly so CI can adopt it in Task 5
   v
Task 4 (docs/ stub pages)
   |
   |  - docs/index.md
   |  - one stub page per §17.1 tree node
   |  - .gitkeep removed from consumed dirs; preserved in
   |    auto-generated areas (docs/primitives/<area>/,
   |    docs/adapters/reference/)
   v
Task 5 (CI workflow + project docs)
   |
   |  - .github/workflows/ci.yml, .github/pull_request_template.md
   |  - root README.md (§17.1), CONTRIBUTING.md, CODE_OF_CONDUCT.md
   |  - bootstrap PR opened, every CI job green on the no-op bootstrap
```

Every task depends only on lower-numbered tasks. Task 4 sequences
before Task 5 so the root README in Task 5 can link to docs stub
pages that already exist on disk.

## Task Summary

| # | Title | Type | Dependencies | Est. Complexity |
|---|-------|------|--------------|-----------------|
| 1 | [Workspace skeleton + root configs](./X-1-workspace-skeleton-and-root-configs.md) | Tooling | None | Medium |
| 2 | [Scaffold script + per-package surface](./X-2-scaffold-script-and-packages.md) | Tooling | 1 | Medium |
| 3 | [Gate helper scripts](./X-3-gate-helper-scripts.md) | Tooling | 2 | Medium |
| 4 | [Docs stub pages](./X-4-docs-stub-pages.md) | Docs | 1, 3 | Low |
| 5 | [CI workflow + project docs](./X-5-ci-workflow-and-project-docs.md) | Tooling + Docs | 1, 2, 3, 4 | Medium |

## Code Reuse

Phase 0 ships against an effectively empty repo — there is nothing to
reuse. New surfaces:

| New artefact | Location | Rationale |
|---|---|---|
| `scripts/scaffold.ts` | repo root `scripts/` | Used at bootstrap and by every future `pnpm scaffold` (§22.5). |
| `scripts/docs-check.ts` | repo root `scripts/` | CI-invoked from every PR (§17.6). |
| `scripts/readme-check.ts` | repo root `scripts/` | CI-invoked from every PR (§17.6). |
| `scripts/run-conformance.ts` | repo root `scripts/` | CI-invoked from every PR (§16.5 / §22.6). |
| `scripts/coverage-merge.ts` | repo root `scripts/` | CI-invoked from every PR (§16.5). |

Per-package files come from the §22.4 templates and live in each
package — no shared abstraction is justified for a one-time scaffolding
step. The scripts above are placed at `scripts/` (not in any package)
because they're tooling consumed by the workspace, not exported APIs.

## Deferred / Follow-Up Work

Anything not on the §22 bootstrap list. In particular, the following
land in Phase 1 (`tasks/phase-1-walking-skeleton/`):

- Real exports in `packages/core/src/` (types, `defineIndicator`,
  `defineAlert`, the first 8 primitives).
- The compiler / runtime / host-worker / adapter-kit implementations.
- `examples/canvas2d-adapter/src/` rendering code.
- The four example scripts in `examples/scripts/` (§22.2 step 2's
  comment names them — Phase 1 writes them).
- Conformance scenarios in `packages/conformance/scenarios/` and
  `golden-bars.json` fixture.
- VitePress site build (`pnpm docs:build`). Phase 0 only ships the
  stub markdown; vitepress config + theme arrive when there's content
  worth building.
- `chartlang` CLI commands (`compile`, `lint`, `bench`,
  `scaffold-adapter`, `docs`) — Phase 1+ per §3.2.
- The commented-out CI `release` job (§22.6). Publishing is manual
  (§22.11) for the foreseeable future.
- `provenance: true` in per-package `publishConfig`. Re-enabled only
  if releases flip to CI.
- JSDoc enforcement of `@example` compile-execution. The bootstrap
  `docs-check.ts` enforces JSDoc presence + tag set; executing
  `@example` blocks needs the compiler, which arrives in Phase 1.

After Phase 0 the next user-visible PR is "PR 2: `@invinite-org/chartlang-core` types"
per §22.9.
