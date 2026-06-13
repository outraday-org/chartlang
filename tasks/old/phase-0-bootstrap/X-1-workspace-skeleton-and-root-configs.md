# Task 1 — Workspace Skeleton + Root Configs

> **Status: TODO**

## Goal

Lay out the empty monorepo directory tree and write every root-level
configuration file listed verbatim in PLAN.md §22.3. After this task,
`pnpm install` succeeds at the repo root and resolves all root
`devDependencies`, even though no workspace packages exist yet.

## Prerequisites

None. This is the first task in Phase 0.

## Current Behavior

The repo contains only `PLAN.md`, `tasks/`, `.claude/`, and `.git/`.
There is no workspace, no `package.json`, no CI configuration, no
license file.

## Desired Behavior

The full repo skeleton from §3 / §22.2 exists on disk. Every root
config file from §22.3 has been written verbatim with no modifications
beyond filling in `<OWNER>` placeholders (use `outraday-org`). Root
`pnpm install` succeeds and pins `pnpm@9.12.0` via Corepack.

## Requirements

### 1. Directory tree (§22.2 step 2)

Create the following directories. They must exist even when empty so
that future tasks and packages can land into a known shape. **Skip
`gh repo create`** — the repo already exists at
`https://github.com/outraday-org/chartlang`.

```bash
mkdir -p packages/{core,compiler,runtime,host-worker,host-quickjs,adapter-kit,language-service,editor,cli,conformance}/src
mkdir -p examples/canvas2d-adapter/src
mkdir -p examples/scripts
mkdir -p docs/{language,primitives,adapters,hosts,spec,getting-started,reference}
mkdir -p docs/primitives/{ta,plot,draw,alert,input}
mkdir -p docs/adapters/reference
mkdir -p scripts
mkdir -p .github/workflows
mkdir -p .changeset
```

`examples/scripts/` stays empty for this phase — Phase 1 seeds it with
`ema-cross.chart.ts`, `bollinger-bands.chart.ts`,
`fib-retracement.chart.ts`, `rsi-divergence-alert.chart.ts` (per the
§22.2 comment block).

To ensure git tracks the empty package `src/` dirs (so future tasks
land into the right place), add a `.gitkeep` to each `src/` directory
that has no files yet:

```bash
for d in packages/*/src examples/canvas2d-adapter/src examples/scripts docs/primitives/{ta,plot,draw,alert,input} docs/adapters/reference; do
  touch "$d/.gitkeep"
done
```

Subsequent tasks (2, 4) will replace these `.gitkeep` files as they
write real content; do not delete them manually.

### 2. Root configuration files (§22.3 — copy verbatim)

Write each file at the path shown. **Every file is copy-verbatim from
PLAN.md §22.3.** The only allowed modification is filling `<OWNER>`
with `outraday-org` (this placeholder only appears in §22.4's
per-package template, not in any root config — root configs are 100%
verbatim).

| Path | Source section | Notes |
|------|----------------|-------|
| `package.json` | §22.3 "**`package.json`**" block | Root workspace manager. Must include `"private": true`, `"packageManager": "pnpm@9.12.0"`, `"engines": { "node": ">=20" }`, and every script (`build`, `typecheck`, `test`, `test:watch`, `bench`, `bench:ci`, `lint`, `format`, `format:check`, `conformance`, `docs:check`, `docs:build`, `readme:check`, `coverage:report`, `scaffold`, `changeset`, `release`). |
| `pnpm-workspace.yaml` | §22.3 "**`pnpm-workspace.yaml`**" | Lists `packages/*` and `examples/canvas2d-adapter` (not `examples/scripts`). |
| `tsconfig.base.json` | §22.3 "**`tsconfig.base.json`**" | Strict mode, ES2022, `verbatimModuleSyntax`, `exactOptionalPropertyTypes`. |
| `biome.json` | §22.3 "**`biome.json`**" | 4-space indent, 100-char line, double quotes, trailing commas, `noExplicitAny: error`, `noNonNullAssertion: error`. |
| `.gitignore` | §22.3 "**`.gitignore`**" | Includes `node_modules/`, `dist/`, `coverage/`, `*.tsbuildinfo`, `.vitest-cache/`, `.DS_Store`, `.env`, `.env.local`, `.env.*.local`, `docs/.vitepress/{cache,dist}/`. |
| `.npmrc` | §22.3 "**`.npmrc`**" | `//registry.npmjs.org/:_authToken=${NPM_TOKEN}`, scope mapping, `access=public`. |
| `.env.example` | §22.3 "**`.env.example`**" | Single `NPM_TOKEN=` placeholder line with header comment pointing to §22.11. |
| `.nvmrc` | §22.3 "**`.nvmrc`**" | Just `20` on its own line. |
| `.editorconfig` | §22.3 "**`.editorconfig`**" | 4-space indent, LF, UTF-8, trim trailing whitespace except in `*.md`. |
| `.changeset/config.json` | §22.3 "**`.changeset/config.json`**" | `"baseBranch": "main"`, `"access": "public"`. |
| `LICENSE` | MIT — copy from any standard MIT template, copyright holder `Invinite` (or as named in the repo's existing `gh` license blob if one was created by `gh repo create --license=MIT`; if no LICENSE exists yet, write fresh MIT text dated `2026` with holder `Invinite`). |

### 3. Changesets bootstrap (§22.2 step 4)

Beyond `config.json`, the changeset CLI expects a `.changeset/README.md`
(it generates one on `changeset init`). Write a minimal placeholder:

```markdown
# Changesets

This folder collects changesets used to version and publish the
`@invinite-org/chartlang-*` packages.

Every PR that touches publishable code must include a changeset:

    pnpm changeset

See PLAN.md §22.11 ("Manual release workflow") for the publish flow,
and `CONTRIBUTING.md` for the per-PR checklist.
```

### 4. Install root devDependencies

Run:

```bash
pnpm install
```

This installs the root `devDependencies` from §22.3's `package.json`
verbatim:

- `@biomejs/biome ^1.9.0`
- `@changesets/cli ^2.27.0`
- `@vitest/coverage-v8 ^2.1.0`
- `tsx ^4.19.0`
- `typescript ^5.6.0`
- `vitest ^2.1.0`
- `vitepress ^1.4.0`
- `expect-type ^1.0.0`

The `pnpm-lock.yaml` produced by this step must be committed.

### 5. Smoke-check what's possible at this stage

The following commands must work (or fail gracefully) before this task
is done:

- `pnpm install --frozen-lockfile` — passes (lockfile just committed).
- `pnpm format:check` — passes; no source files yet besides configs,
  which were written to match `biome.json`'s style.
- `pnpm lint` — passes; same reason.
- `pnpm typecheck` — passes vacuously (`pnpm -r --parallel typecheck`
  runs zero packages).
- `pnpm test` — runs `vitest run --coverage` and exits zero (no
  test files yet). Vitest must not error out — if it does because of
  zero `include` patterns or missing root config, add the minimum
  vitest workaround needed to make it exit clean (e.g. a root
  `vitest.config.ts` that points `include` at `packages/**/*.test.ts`
  is fine if vitest requires it — but prefer leaving config to the
  per-package `vitest.config.ts` files that arrive in Task 2).
- `pnpm build` — runs `pnpm -r --parallel build` over zero packages
  and exits zero.

**Do not** run `pnpm conformance`, `pnpm bench:ci`, `pnpm docs:check`,
`pnpm docs:build`, `pnpm readme:check`, or `pnpm coverage:report` —
those gate scripts are written in Task 3 and integrated into CI in
Task 5. Verifying they exit zero is **out of scope** for this task.

### 6. What this task does NOT do

- Does **not** write any per-package files (`packages/*/package.json`,
  `tsconfig.json`, `vitest.config.ts`, `README.md`, `src/index.ts`,
  `src/index.test.ts`). That's Task 2.
- Does **not** write any `scripts/*.ts` helper scripts. That's Task 2
  (`scaffold.ts`) and Task 3 (gate scripts).
- Does **not** write `.github/workflows/ci.yml` or
  `pull_request_template.md`. That's Task 5.
- Does **not** write root `README.md`, `CONTRIBUTING.md`,
  `CODE_OF_CONDUCT.md`. That's Task 5.
- Does **not** write `docs/` page content. That's Task 4. (The empty
  `docs/` directory tree is created here so paths exist.)

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/{core,compiler,runtime,host-worker,host-quickjs,adapter-kit,language-service,editor,cli,conformance}/src/.gitkeep` | Create | Track empty package dirs in git until Task 2 scaffolds them. |
| `examples/canvas2d-adapter/src/.gitkeep` | Create | Same. |
| `examples/scripts/.gitkeep` | Create | Track empty seed dir; Phase 1 will replace. |
| `docs/{language,primitives,adapters,hosts,spec,getting-started,reference}/` | Create (dirs) | Doc tree per §17.1. |
| `docs/primitives/{ta,plot,draw,alert,input}/.gitkeep` | Create | Track future per-primitive auto-gen targets. |
| `docs/adapters/reference/.gitkeep` | Create | Track future per-adapter page dir. |
| `scripts/` | Create (dir) | Future home for scaffold + gate scripts. |
| `.github/workflows/` | Create (dir) | Future home for `ci.yml`. |
| `.changeset/` | Create (dir) | Changeset state lives here. |
| `package.json` | Create | Root workspace manager — §22.3 verbatim. |
| `pnpm-workspace.yaml` | Create | §22.3 verbatim. |
| `tsconfig.base.json` | Create | §22.3 verbatim. |
| `biome.json` | Create | §22.3 verbatim. |
| `.gitignore` | Create | §22.3 verbatim. |
| `.npmrc` | Create | §22.3 verbatim. |
| `.env.example` | Create | §22.3 verbatim. |
| `.nvmrc` | Create | §22.3 verbatim. |
| `.editorconfig` | Create | §22.3 verbatim. |
| `.changeset/config.json` | Create | §22.3 verbatim. |
| `.changeset/README.md` | Create | Changesets folder explainer. |
| `LICENSE` | Create | MIT (dated 2026, holder `Invinite`) if not already present. |
| `pnpm-lock.yaml` | Create (via `pnpm install`) | Pin root devDependencies. |

## Acceptance Criteria

- [ ] Every directory listed in Requirement 1 exists.
- [ ] Every file in the Files table exists with the verbatim contents
      from PLAN.md §22.3 (with `outraday-org` substituted for any
      `<OWNER>` if needed — note that §22.3 root configs have no
      `<OWNER>` placeholders; this is a Task 2 concern).
- [ ] `pnpm install` succeeds from a clean clone.
- [ ] `pnpm install --frozen-lockfile` succeeds (lockfile committed).
- [ ] `pnpm format:check` exits 0.
- [ ] `pnpm lint` exits 0.
- [ ] `pnpm typecheck` exits 0 (vacuously).
- [ ] `pnpm build` exits 0 (vacuously).
- [ ] `pnpm test` exits 0 (no test files, no failures).
- [ ] `pnpm changeset` (interactive: just type `q` / ctrl-C after
      confirming the prompt appears) prompts cleanly — verifies the
      changesets CLI is wired.
- [ ] `node --version` reports `v20.x.x` (matches `.nvmrc`).
- [ ] `pnpm --version` reports `9.12.0` (matches `packageManager`
      field in root `package.json`).
- [ ] No per-package or `scripts/*.ts` files exist yet — those are
      Tasks 2 and 3.
