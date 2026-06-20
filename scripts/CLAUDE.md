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
- `SUBPATH_EXPORTS` entries can be **forward-reserved** before the matching
  `src/<subpath>/` ships real exports — the map is the authoritative
  `package.json#exports` shape, and an empty subpath module is fine until
  the later task populates it (see `packages/pine-converter` `./diagnostics`).
  Doing this in the scaffold avoids a hand-edit to the generated
  `package.json` when the real exports land.
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
- `run-conformance.ts` iterates the `CONFORMANCE_ADAPTERS` registry —
  the canvas2d reference adapter plus the four full-surface library
  adapters (lightweight-charts / uplot / echarts / konva). Each is imported
  from `examples/<dir>/src/index.ts` (preferred, run under `tsx`) then its
  built `dist/index.js`; a not-yet-built adapter is logged
  (`skip <name>: not built`) and SKIPPED, never a hard failure (CI builds
  all five before the run; local runs may not). The exit code is non-zero
  iff any adapter reports a scenario failure (or, under `--check`, the
  committed report drifts). **`--report` / `--check` render only the
  canvas2d report pair** (`examples/canvas2d-adapter/CONFORMANCE.md` +
  `conformance-report.json`) — the reference adapter is the single adapter
  with a committed, diff-friendly report; the other four are run for
  pass/fail only and own no committed report. Adding a new example adapter =
  append an entry to `CONFORMANCE_ADAPTERS` (and build its dist before CI's
  conformance step). The report run reuses the loop's canvas2d run — the
  suite is never executed twice for one adapter.
- `gen-hover-registry.ts` walks `packages/core/src` exports into
  `packages/language-service/src/hoverRegistry.generated.ts`; `--check`
  byte-diffs it (the `hover:check` gate). It resolves
  `Object.freeze({ name })` **shorthand** namespace members to the matching
  top-level `function name(...)` declaration (preferring the documented
  overload) — the same model `genPhase4Docs` uses — so a freeze-namespace
  member written as a shorthand-of-an-overloaded-function (e.g.
  `request.security`) still produces a `function` hover entry. Re-run
  `pnpm gen-hover-registry` after touching any core export's JSDoc/signature
  and commit the regenerated file.

## Map

| Script | `pnpm` alias | Purpose |
|---|---|---|
| `scaffold.ts` | `pnpm scaffold` | Idempotent per-package §22.4 generator. |
| `docs-check.ts` | `pnpm docs:check` | §17.6 + §17.2 JSDoc gate (TS compiler API) + `@example` execution via the chartlang compiler. |
| `docs-check.executor.ts` | — | Executor module imported by `docs-check.ts`; covered by `docs-check.executor.test.ts`. |
| `docs-gate.ts` | `pnpm docs:gate` | Regenerates `docs/primitives/ta/<id>.md` into a tmp dir and byte-compares against the committed tree. Fails on drift. Imports `runGenDocs` from `packages/cli/src/commands/genDocs.ts` directly (source, not `dist/`). |
| `docs-committed-check.ts` | `pnpm docs:committed:check` | Git-aware companion to `docs:gate`. Runs `pnpm docs:generate` into the working tree, then fails if `git diff HEAD -- docs/primitives` is non-empty. Unlike `docs:gate` (which compares generator output against the **working-tree** file, so a regenerated-but-uncommitted page passes locally while CI fails), this compares against the **committed** tree — so local `pnpm run check` mirrors CI. A failure leaves the regenerated pages in the working tree; just `git add` + commit. |
| `gen-examples-docs.ts` | `pnpm examples:generate` / `pnpm examples:gate` | Renders `docs/examples/index.md` + one page per example from `apps/site` `DEMO_SCRIPTS` (the single source of truth); `--check` byte-diffs against the committed tree (drift / missing / stale). Never hand-edit `docs/examples/*.md` — re-run `pnpm examples:generate`. |
| `examples-sync-check.ts` | `pnpm examples:sync` | Asserts each `examples/scripts/<id>.chart.ts` file matches its same-`id` `DEMO_SCRIPTS` mirror (the two hand-maintained copies the docs pipeline can't unify — real on-disk source vs. inlined demo string). Compares **token streams** via the TS scanner so comments, whitespace, line-wrapping, and trailing commas are ignored (the example is Biome-formatted; `apps/**` is Biome-exempt) — only real code drift fails. Demo-only ids (no file) and example-only files (no demo entry) are reported, not failed. Pure check, no generate step. |
| `generate-skills-reference.ts` | `pnpm skills:generate` / `pnpm skills:gate` | Walks `ta.*`/`draw.*` JSDoc → `skills/chartlang-coding/references/primitives.md`; `--check` byte-diffs against the committed file. Deep-imports `parsePrimitiveSource` / `parseDrawingSource` (source, not `dist/`) and mirrors their skip lists. Never hand-edit `primitives.md` — re-run `pnpm skills:generate`. |
| `gen-converter-docs.ts` | `pnpm converter:docs:generate` / `pnpm converter:docs:check` | Renders `docs/converter/diagnostics.md` from `DIAGNOSTIC_CODE_ENTRIES` (deep-imported from `packages/pine-converter/src/diagnostics/codes.ts`, source not `dist/`) — one anchored `### <slug>` section per code, sorted by full code string. `--check` byte-diffs against the committed page (drift fails CI). Never hand-edit `docs/converter/diagnostics.md` — re-run the generator; the intro preamble is the `INTRO` generator constant. The per-code anchor (`#<slug>`) MUST match `shortCode` in `pine-converter`'s `diagnostics/format.ts` so the CLI's `= docs:` links resolve. |
| `readme-check.ts` | `pnpm readme:check` | §17.6 + §17.1 README structure gate. |
| `run-conformance.ts` | `pnpm conformance` | §16.5 / §15.3 conformance harness wrapper. Iterates ALL FIVE example adapters (`CONFORMANCE_ADAPTERS`: canvas2d + lightweight-charts + uplot + echarts + konva). |
| `coverage-merge.ts` | `pnpm coverage:report` | §16.5 per-package → root LCOV + summary. |
| `vitest.config.ts` | `pnpm test:scripts` | Per-folder vitest config — discovers `scripts/**/*.test.ts`. |
