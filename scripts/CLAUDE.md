# scripts/

Workspace-level tooling scripts invoked via `pnpm <name>` from the repo root.

## Conventions

- Each script is a standalone `.ts` file runnable via `tsx`.
- Scripts are tooling, not exported APIs — no `dist/` build, no JSDoc gate.
- Gate scripts (`docs-check.ts`, `docs-gate.ts`, `readme-check.ts`,
  `run-conformance.ts`, `coverage-merge.ts`) carry the two-line MIT
  header per Task 3.
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
- `docs-check.ts` skips re-export-only `export { … } from "./y"` /
  `export * from "./y"` statements — barrel re-exports forward names
  whose JSDoc already lives at the original declaration. JSDoc gating
  applies at the declaration site, not the re-export site.
- `docs-check.ts` splits the `ta` vs `draw` namespace requirement set:
  `/src/ta/` requires `@formula` + `@stable | @experimental`;
  `/src/draw/` additionally requires `@anchors`. Anchors are drawing-
  specific (world-point semantics) and don't apply to `ta.*`.
- `docs-check.ts` also pipes every qualifying `@example` block through
  `@invinite-org/chartlang-compiler`'s `compile`. A block qualifies iff it
  contains BOTH a chartlang import substring (`from "@invinite-org/chartlang-`)
  AND a `defineIndicator(` or `defineAlert(` call. The executor lives in
  `docs-check.executor.ts` so the heuristic + fence-stripping + violation
  recording can be unit-tested independently. `scripts/vitest.config.ts`
  wires `scripts/**/*.test.ts` into `pnpm test:scripts` (coverage off —
  scripts are tooling, not exported APIs).
- `EXEMPT_EXPORTS` in `docs-check.ts` is intentionally empty. Placeholder
  packages keep their `PACKAGE_VERSION` export but ship the JSDoc shim from
  Task 3 (or their own real exports once their Phase-1 task lands).
- `biome.json` overrides `lint/suspicious/noConsoleLog` to `off` for
  `scripts/**`. Gate scripts are CLI tools whose entire job is to print
  status / failure lists to stdout; suppressing here keeps the lint
  output noise-free without weakening the rule package-wide.

## Map

| Script | `pnpm` alias | Purpose |
|---|---|---|
| `scaffold.ts` | `pnpm scaffold` | Idempotent per-package §22.4 generator. |
| `docs-check.ts` | `pnpm docs:check` | §17.6 + §17.2 JSDoc gate (TS compiler API) + `@example` execution via the chartlang compiler. |
| `docs-check.executor.ts` | — | Executor module imported by `docs-check.ts`; covered by `docs-check.executor.test.ts`. |
| `docs-gate.ts` | `pnpm docs:gate` | Regenerates `docs/primitives/ta/<id>.md` into a tmp dir and byte-compares against the committed tree. Fails on drift. Imports `runGenDocs` from `packages/cli/src/commands/genDocs.ts` directly (source, not `dist/`). |
| `readme-check.ts` | `pnpm readme:check` | §17.6 + §17.1 README structure gate. |
| `run-conformance.ts` | `pnpm conformance` | §16.5 / §15.3 conformance harness wrapper. |
| `coverage-merge.ts` | `pnpm coverage:report` | §16.5 per-package → root LCOV + summary. |
| `vitest.config.ts` | `pnpm test:scripts` | Per-folder vitest config — discovers `scripts/**/*.test.ts`. |
