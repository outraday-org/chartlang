# Phase 0 — Repo Bootstrap

> **Plan reference:** PLAN.md §22 "Starting the Repo" (§22.1–§22.8).
> **Prerequisite for:** every later phase.
> **Version target:** none (pre-`0.1`).

## Goal

Stand up the empty monorepo so that `pnpm typecheck`, `pnpm lint`,
`pnpm test`, and `pnpm build` all pass green against placeholder
sources, and every CI gate the plan calls out is live before any
feature code is written.

## Deliverables

- Root config files (verbatim per §22.3): `package.json`,
  `pnpm-workspace.yaml`, `tsconfig.base.json`, `biome.json`,
  `vitest.config.ts`, `.changeset/config.json`, `.nvmrc`,
  `.gitignore`.
- Workspace layout (per §22.2 step 2): `packages/{core, compiler,
  runtime, host-worker, host-quickjs, adapter-kit, language-service,
  editor, cli, conformance}/src/`, `examples/canvas2d-adapter/src/`,
  `examples/scripts/`, `docs/{language, primitives, adapters, hosts,
  spec, getting-started, reference}/`, `scripts/`,
  `.github/workflows/`.
- Per-package scaffold (via `scripts/scaffold.ts`, §22.4): each
  package gets `package.json`, `tsconfig.json`, `vitest.config.ts`,
  `README.md`, `src/index.ts`, plus one passing placeholder test.
- CI workflows (per §16.5 / §17.6 / §22): typecheck, lint, test +
  coverage, build, docs-check, readme-check, conformance, bench. All
  required to pass on PRs.
- Changesets initialised.
- License header (MIT) on every source file.
- Root `README.md` pointing to PLAN.md and the package matrix from
  §3.2.
- `CONTRIBUTING.md` with the §3.1 relicense-note template for ports
  from the sibling `invinite` repo.

## Done criteria

- `pnpm install && pnpm typecheck && pnpm lint && pnpm test && pnpm
  build` succeeds from a clean clone.
- CI green on a no-op PR.
- Every package directory has a stub README that names its public
  surface (matches the §3.2 responsibility table) and an empty
  `dist/` after `pnpm build`.
- `pnpm changeset` works and writes to `.changeset/`.
- Zero feature code shipped — no primitives, no compiler logic, no
  runtime loops. Just scaffolding.

## Notes for `/write-tasks`

- Read §22 in full before writing tasks; every config file is quoted
  verbatim there.
- Treat §22.8's PR sequencing as guidance for task granularity (PR 1
  = bootstrap, PR 2 = core types, etc.) but stay inside the bootstrap
  scope for this phase.
- Coverage thresholds + README requirements (§16, §17) must be wired
  *now* — every later phase assumes they exist.
