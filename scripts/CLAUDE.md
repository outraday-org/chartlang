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
  `PACKAGE_DIRS` and re-run `pnpm scaffold`. **Not every published package
  belongs in `PACKAGE_DIRS`:** `create-chartlang` is hand-authored and
  excluded, because the template emits a `@invinite-org/chartlang-<name>`
  name with no `bin` field, whereas that package publishes as
  `@invinite-org/create-chartlang` with a `bin`. Adding it would break the
  zero-diff guarantee. See `packages/create-chartlang/CLAUDE.md`.
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
- `cross-adapter-offset.test.ts` (+ its `cross-adapter-offset.fixture.ts`)
  is the ONE cross-adapter guardrail: it drives a single multi-plot +
  universal-`offset` (`xShift`) `sma-offset` scenario through ALL FIVE
  example adapters' headless mocks (via each adapter's public `.` factory +
  `./testing` mock) and asserts each renders exactly three
  distinctly-positioned, distinctly-coloured line series — the
  offset-collapse + colour-collapse regression net. It is the reason the
  five `chartlang-example-*-adapter` packages (plus `adapter-kit`, `core`,
  `host-worker`) are root `devDependencies`: a `scripts/` test resolves
  package specifiers from root `node_modules`, so the example adapters must
  be linked there. The compute is inlined (the worker `data:` URL can't
  resolve workspace specifiers), mirroring each adapter's
  `integration.test.ts`. Fixture input bars are method-less `WireBar`s
  (`Omit<Bar, "point">`) because they cross the worker `MessageChannel` via
  `postMessage` (a method can't be structured-cloned; the runtime installs
  its own `bar.point`).
- `run-conformance.ts` iterates the `CONFORMANCE_ADAPTERS` registry —
  the canvas2d reference adapter plus the five full-surface library / zero-dep
  adapters (lightweight-charts / uplot / echarts / konva / webgl). Each is
  imported from `examples/<dir>/src/index.ts` (preferred, run under `tsx`)
  then its built `dist/index.js`; a not-yet-built adapter is logged
  (`skip <name>: not built`) and SKIPPED, never a hard failure (CI builds
  all six before the run; local runs may not). The exit code is non-zero
  iff any adapter reports a scenario failure (or, under `--check`, the
  committed report drifts). **`--report` / `--check` render only the
  canvas2d report pair** (`examples/canvas2d-adapter/CONFORMANCE.md` +
  `conformance-report.json`) — the reference adapter is the single adapter
  with a committed, diff-friendly report; the other five are run for
  pass/fail only and own no committed report. `CONFORMANCE_ADAPTERS` is
  **derived from `ADAPTERS` in `scripts/adapters/registry.ts`** (the same
  SSOT `gen-adapters` reads), so adding a new example adapter = append ONE
  entry to that registry (and build its dist before CI's conformance step) —
  no second list to keep in sync. Registry order keeps canvas2d first, so
  `CONFORMANCE_ADAPTERS[0]` is the reference adapter the `--report` /
  `--check` paths key on. The report run reuses the loop's canvas2d run — the
  suite is never executed twice for one adapter.
- `gen-adapters.ts` (`adapters:generate` / `adapters:gate`) bakes each
  example adapter declared in `scripts/adapters/registry.ts` (the SSOT —
  six entries: canvas2d + echarts + konva + lightweight-charts + uplot + webgl)
  into the CLI as an offline, version-pinned string-template bundle under
  `packages/cli/src/generated/adapters/`. For each entry it collects
  `src/**/*.ts` (OMITTING `integration.test.ts` + `conformance.test.ts`,
  which import workspace-internal host-worker test internals / pin a hashed
  call-log / drive the conformance suite — a fresh copy can't reproduce
  them), `README.md` + `tsconfig.json` verbatim, a `package.json` rewritten
  so every `@invinite-org/chartlang-*` `workspace:^` dep is pinned to that
  package's current published `version` (`resolveWorkspaceVersions`) and the
  `name` becomes `__PKG_NAME__`, plus a synthesized `.gitignore`. It emits
  `<id>.ts` (a frozen `{ id, files }` literal), `index.ts`
  (`BUNDLED_ADAPTERS` + re-exports), a `registry.ts` runtime metadata mirror
  (so the CLI never imports from `scripts/`), and `types.ts`. Every emitted
  file is prefixed `// GENERATED by pnpm adapters:generate — DO NOT EDIT`;
  the dir is Biome-ignored (string-literal bundles) and excluded from cli
  coverage. `--check` (`adapters:gate`, wired into `pnpm check`) re-renders
  in memory and byte-diffs the committed tree — red on drift (an example
  gaining/removing a file, or a published version bump). After touching an
  example adapter or the registry, re-run `pnpm adapters:generate` and
  commit. Task 15 extends this generator to also emit the docs gallery.
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
| `adapters/registry.ts` | — | SSOT for the six example adapters (`ADAPTERS` + `githubFolder`); consumed by `gen-adapters.ts` (and Task 15's gallery). |
| `gen-adapters.ts` | `pnpm adapters:generate` / `pnpm adapters:gate` | Bakes each example adapter into `packages/cli/src/generated/adapters/` as an offline version-pinned bundle for `chartlang add-adapter`; `--check` byte-diffs the committed tree. Never hand-edit the generated dir — re-run the generator. |
| `docs-check.ts` | `pnpm docs:check` | §17.6 + §17.2 JSDoc gate (TS compiler API) + `@example` execution via the chartlang compiler. |
| `docs-check.executor.ts` | — | Executor module imported by `docs-check.ts`; covered by `docs-check.executor.test.ts`. |
| `docs-gate.ts` | `pnpm docs:gate` | Regenerates `docs/primitives/ta/<id>.md` into a tmp dir and byte-compares against the committed tree. Fails on drift. Imports `runGenDocs` from `packages/cli/src/commands/genDocs.ts` directly (source, not `dist/`). |
| `docs-committed-check.ts` | `pnpm docs:committed:check` | Git-aware companion to `docs:gate`. Runs `pnpm docs:generate` into the working tree, then fails if `git diff HEAD -- docs/primitives` is non-empty. Unlike `docs:gate` (which compares generator output against the **working-tree** file, so a regenerated-but-uncommitted page passes locally while CI fails), this compares against the **committed** tree — so local `pnpm run check` mirrors CI. A failure leaves the regenerated pages in the working tree; just `git add` + commit. It is the sole `check:committed` phase: `pnpm check` runs `check:content` (every working-tree correctness gate) first, then `check:committed`, so a git-state-only failure (correct-but-uncommitted pages) surfaces **last** and never masks a real content failure. |
| `gen-demo-scripts.ts` | — (folded into `examples:generate` / `examples:gate`) | Pure renderers + IO collector for the THREE generated example artifacts: `apps/site/src/components/demo/scripts.ts` (`DEMO_SCRIPTS`, sources inlined verbatim from each `.chart.ts`), `examples/catalogue.json`, and `packages/examples/src/catalogue.generated.ts` (the published `@invinite-org/chartlang-examples` data module — self-contained, taxonomy + types + `EXAMPLE_CATALOGUE` with inlined sources, no repo-root imports so it ships in the package dist). Reads `examples/catalogue.ts` + the on-disk sources; hard-errors on a catalogue id with no file or a stray file with no entry. |
| `gen-examples-docs.ts` | `pnpm examples:generate` / `pnpm examples:gate` | Orchestrates the example pipeline: regenerates `scripts.ts` + `examples/catalogue.json` + `packages/examples/src/catalogue.generated.ts` (via `gen-demo-scripts`) **then** `docs/examples/index.md` + one page per example, all from the SAME in-memory catalogue data. `--check` byte-diffs them all against the committed tree (drift / missing / stale). Never hand-edit `docs/examples/*.md`, `scripts.ts`, `catalogue.json`, or `catalogue.generated.ts` — re-run `pnpm examples:generate`. |
| `examples-coverage.ts` | `pnpm examples:coverage` | Per-primitive coverage gate. Enumerates the canonical id set from the `docs/primitives/**` page tree (no hardcoded list), then asserts `target ⊆ covered` exactly — fully enforcing, **no allowlist** (drained to empty + deleted by Task 22). Fails (structured stderr + exit 1) on MISSING (a page not covered by any `EXAMPLE_CATALOGUE` `primitives` credit) or UNKNOWN (a credit with no page). Helper covered by `examples-coverage.test.ts`. |
| `examples-idioms.ts` | `pnpm examples:idioms` | Language-**idiom** coverage gate — the orthogonal sibling of `examples:coverage` (idioms have no `docs/primitives/**` page). Target set = the committed `examples/idiom-manifest.json` (`{ idioms: { id, page }[], unrepresentedPages: { page, reason }[] }`), NOT a doc-tree walk; covered set = the union of every `EXAMPLE_CATALOGUE` entry's optional `idioms` array (set only on `language`-category entries). Fails (structured stderr + exit 1) on MISSING (a manifest idiom with no example), UNKNOWN (a catalogue `idioms` id absent from the manifest), or UNREPRESENTED_PAGE (a `docs/language/*.md` page neither paired with a manifest idiom nor in `unrepresentedPages`). NO allowlist coupling to `examples:coverage` — idioms never touch `coverage-allowlist.json`. Helper covered by `examples-idioms.test.ts`. |
| `examples-sync-check.ts` | `pnpm examples:sync` | Asserts each `examples/scripts/<id>.chart.ts` file matches its same-`id` `DEMO_SCRIPTS` mirror (the two hand-maintained copies the docs pipeline can't unify — real on-disk source vs. inlined demo string). Compares **token streams** via the TS scanner so comments, whitespace, line-wrapping, and trailing commas are ignored (the example is Biome-formatted; `apps/**` is Biome-exempt) — only real code drift fails. Demo-only ids (no file) and example-only files (no demo entry) are reported, not failed. Pure check, no generate step. |
| `generate-skills-reference.ts` | `pnpm skills:generate` / `pnpm skills:gate` | Walks `ta.*`/`draw.*`/plot-family JSDoc plus the consolidated `math.*` / `str.*` value namespaces → `skills/chartlang-coding/references/primitives.md`; `--check` byte-diffs against the committed file. Deep-imports `parsePrimitiveSource` / `parseDrawingSource` (source, not `dist/`) and mirrors their skip lists. The `## plot family` section is driven by `collectPlotFamily`, which reads the four core holes (`plot`/`hline`/`bgcolor`/`barcolor`) from `packages/core/src/plot/plot.ts` directly via the TS AST — those holes are author signatures with no `@formula`/`@warmup`, so they can't go through `parsePrimitiveSource`. The `## math.*` / `## str.*` sections are driven by `collectNamespace`, which reuses `parsePhase4DocEntry` + the shared `PHASE4_DOC_ENTRIES` registry (deep-imported from `packages/cli/src/commands/genPhase4Docs.ts`, source not `dist/`) so the source/symbol paths can't drift from `docs:gate`; each renders as ONE consolidated block (the whole `Object.freeze({...})` member list), not per-member. The parsed `sourceUrl` is intentionally NOT rendered (the reference carries no GitHub links). Never hand-edit `primitives.md` — re-run `pnpm skills:generate`. |
| `gen-converter-docs.ts` | `pnpm converter:docs:generate` / `pnpm converter:docs:check` | Renders `docs/converter/diagnostics.md` from `DIAGNOSTIC_CODE_ENTRIES` (deep-imported from `packages/pine-converter/src/diagnostics/codes.ts`, source not `dist/`) — one anchored `### <slug>` section per code, sorted by full code string. `--check` byte-diffs against the committed page (drift fails CI). Never hand-edit `docs/converter/diagnostics.md` — re-run the generator; the intro preamble is the `INTRO` generator constant. The per-code anchor (`#<slug>`) MUST match `shortCode` in `pine-converter`'s `diagnostics/format.ts` so the CLI's `= docs:` links resolve. |
| `readme-check.ts` | `pnpm readme:check` | §17.6 + §17.1 README structure gate. |
| `run-conformance.ts` | `pnpm conformance` | §16.5 / §15.3 conformance harness wrapper. Iterates ALL SIX example adapters (`CONFORMANCE_ADAPTERS`: canvas2d + lightweight-charts + uplot + echarts + konva + webgl). |
| `coverage-merge.ts` | `pnpm coverage:report` | §16.5 per-package → root LCOV + summary. |
| `vitest.config.ts` | `pnpm test:scripts` | Per-folder vitest config — discovers `scripts/**/*.test.ts`. |
| `refresh-local-starters.ts` | `pnpm starters:local [lib]` / `pnpm starters:local:linked [lib]` | Dev preview only (not a gate). Recreates the git-ignored `local-starters/<lib>/` apps from the LOCAL `apps/react-starter` tree via create-chartlang's real transforms (injected `cloneStarter` clones from disk, not GitHub), so uncommitted starter / `seamTemplates` changes are previewable across every chart library with no publish + no push. **Two dep modes:** `starters:local` installs the **published** `@invinite-org/chartlang-*` (tests the real release path — but BREAKS when the repo uses unreleased package APIs the published versions lack, e.g. an `adapter-kit` capability the example adapters already call); `starters:local:linked` (`--local`) builds + `pnpm pack`s every workspace `@invinite-org/chartlang-*` package (pack resolves `workspace:*` → versions so the tarballs install under npm) and forces them into each clone — direct deps rewritten to `file:` (npm EOVERRIDEs an `overrides` entry that differs from a direct dep), transitive-only ones via `overrides` — so the clones run on CURRENT repo code. The `pnpm` scripts build first (create-chartlang for published; all packages for linked), then refresh **every bundled library** (or one, by id arg). **The library list is derived from create-chartlang's exported `SEAM_IDS` (the SSOT — canvas2d + lightweight-charts + uplot + echarts + konva + webgl), NOT a hardcoded copy**, so a newly-bundled adapter shows up automatically with no second list to sync. Published mode preserves each starter's `node_modules` + `data/` (fast re-runs); linked mode drops the lockfile + `node_modules/@invinite-org`/`@local` to re-resolve from fresh tarballs. Shared env overrides live ONCE in the git-ignored `local-starters/.env.shared`: every refresh overlays its non-empty keys onto each starter's `.env` (market data needs no key — it loads from Yahoo Finance — so there's nothing to share today; the generic overlay mechanism is kept for any future shared var). The shared file is auto-created on first run. Per-folder `.env` edits are preserved as the base; shared wins for the keys it defines. **The preserved `data/` keeps saved `scripts` but its `eod_cache` table is DROPPED on every refresh** (`clearEodCache`, best-effort via the starter's own `better-sqlite3`): a market-data row written by a superseded source (the legacy EODData tier returned only ~20 daily bars) would otherwise shadow the current ~5y Nasdaq/Yahoo/Stooq fetch for its 24h TTL — the "not enough history" symptom. |
