# scripts/

Workspace-level tooling scripts invoked via `pnpm <name>` from the repo root.

## Conventions

- Each script is a standalone `.ts` file runnable via `tsx`.
- Scripts are tooling, not exported APIs — no `dist/` build, no JSDoc gate.
- Gate scripts (`docs-check.ts`, `readme-check.ts`, `run-conformance.ts`,
  `coverage-merge.ts`) carry the two-line MIT header per Task 3.
  `scaffold.ts` does not — Task 2 settled it without one. New tooling
  scripts should follow the gate-script convention (include the MIT
  header).
- `scaffold.ts` is **idempotent**: re-running it must produce zero diff on
  an already-scaffolded tree. Adding a new package = append to
  `PACKAGE_DIRS` and re-run `pnpm scaffold`.
- Do not hand-edit files inside `packages/<name>/` or
  `examples/canvas2d-adapter/` that the scaffold generates (six §22.4
  files per package). Edit `scripts/scaffold.ts` instead and re-run.
- Gate scripts must print **every** failure per run (not just the first)
  so contributors see the full punch-list. Each gate owns one concern:
  `readme-check` does not validate JSDoc, `docs-check` does not validate
  README structure, etc.

## Map

| Script | `pnpm` alias | Purpose |
|---|---|---|
| `scaffold.ts` | `pnpm scaffold` | Idempotent per-package §22.4 generator. |
| `docs-check.ts` | `pnpm docs:check` | §17.6 + §17.2 JSDoc gate (TS compiler API). |
| `readme-check.ts` | `pnpm readme:check` | §17.6 + §17.1 README structure gate. |
| `run-conformance.ts` | `pnpm conformance` | §16.5 / §15.3 conformance harness wrapper. |
| `coverage-merge.ts` | `pnpm coverage:report` | §16.5 per-package → root LCOV + summary. |
