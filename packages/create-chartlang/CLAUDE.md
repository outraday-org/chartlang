# packages/create-chartlang/

`@invinite-org/create-chartlang` — the `npm create @invinite-org/chartlang@latest my-app` installer. It
clones `apps/react-starter` from GitHub, prompts for a chart library (default
canvas2d), vendors the chosen adapter from the CLI's offline bundles, rewrites
the single `activeAdapter.ts` seam + `package.json` workspace deps, writes
`.env`, and prints next steps.

## Invariants

- **Hand-authored, NOT scaffold-generated; published as
  `@invinite-org/create-chartlang` with a `bin`.** This package is
  deliberately **absent** from `scripts/scaffold.ts` `PACKAGE_DIRS`: the
  §22.4 library template hardcodes a `@invinite-org/chartlang-<name>` name
  (note the `chartlang-` prefix) with no `bin` field, so re-running
  `pnpm scaffold` would emit a wrong, non-zero-diff `package.json`. `bin` is
  `{ "create-chartlang": "./dist/index.js" }` (the npm convention that makes
  `npm create @invinite-org/chartlang` resolve `@invinite-org/create-chartlang`
  and run it). Mirror
  `packages/cli`'s tsconfig/vitest shape, but edit the six "template" files
  by hand here — never via the scaffold.
- **`index.ts` is the shebang `bin` entry (coverage-excluded), like the CLI's
  `bin.ts`.** It owns the `#!/usr/bin/env node` line, wires the real
  `giget` clone + a child-process install into `defaultDeps`, and invokes
  `runCreateChartlang` at import time. `vitest.config.ts` excludes
  `src/**/index.ts` (the barrel-entry convention). All testable logic lives
  in `createApp.ts` + the pure helpers (`seamTemplates.ts`,
  `rewritePackageJson.ts`, `chartlangVersions.ts`), which hit 100% coverage.
- **Adapters are vendored from the CLI's PUBLIC `BUNDLED_ADAPTERS`, never
  re-implemented.** `create-chartlang` depends on
  `@invinite-org/chartlang-cli` and imports `BUNDLED_ADAPTERS` +
  `ADAPTER_REGISTRY` from its public surface (re-exported from the CLI index
  for exactly this reason — do NOT deep-import `cli/src/generated/**` or the
  unpublished `examples/*`). The vendoring mirrors `addAdapter.ts`: array
  `BUNDLED_ADAPTERS.find(b => b.id === id)`, Windows-safe path re-join, and
  `__PKG_NAME__` substituted ONLY in the bundle's `package.json` (to a local
  `@local/<id>-adapter` name). A new CLI release is required before a matching
  `create-chartlang` release picks up bundle changes.
- **`seamTemplates.ts` MUST stay byte-identical to the app SSOT
  `apps/react-starter/src/lib/chart/seamVariants.ts`.** It holds the
  installer's own copy of each per-library `activeAdapter.ts` body;
  `seamTemplateFor(id, localName)` substitutes only the example-adapter
  package name → the vendored local name. `seamTemplates.test.ts` imports the
  real `SEAM_VARIANTS` from the monorepo source and byte-diffs every id, so
  the installer can never emit a seam the starter's `adapter-matrix.spec.ts`
  never rendered. Edit a seam in `seamVariants.ts` first, then mirror it
  here — the parity test fails until they agree.
- **`chartlangVersions.ts` is a BAKED version manifest — a maintenance
  point.** The starter's `package.json` references `@invinite-org/chartlang-*`
  packages that no adapter bundle lists (notably `editor` +
  `language-service`, which the UI imports but no adapter depends on).
  `resolveWorkspaceVersions` (scripts/gen-adapters.ts) is build-time-only and
  not runtime-importable, so the rewrite prefers the vendored bundle's own
  generator-pinned dep map (`bundleChartlangVersions`) and falls back to
  `CHARTLANG_VERSIONS` for the rest. **Bump `CHARTLANG_VERSIONS` (and
  `STARTER_CLONE_REF`) on publish** so a given `create-chartlang` release
  produces a self-consistent project. An unknown chartlang dep with no
  manifest entry throws at rewrite time (caught by the unit test).
- **`STARTER_CLONE_REF` is the single release-time clone pin.** `#main` until
  the first tagged release; the release pipeline bumps it to the matching
  starter tag. The clone is the ONLY networked step (normal for `create-*`);
  everything else is offline.
- **The emitted tree carries no repo-internal artefacts.** `runCreateChartlang`
  strips `CLAUDE.md`, `tests/`, `.changeset`, and `.github` from the clone
  (asserted by a test) so the user's project ships none of the monorepo's
  maintenance/CI files.

- **The clone is made STANDALONE by four post-clone transforms** so the emitted
  project installs, typechecks, builds, and runs with no monorepo around it.
  All four live in `create-chartlang` only — they never touch the published
  compiler, the `react-starter` app, or the CLI.
  - **Standalone tsconfig (`starterTsconfig.ts`).** The cloned `tsconfig.json`
    `extends "../../tsconfig.base.json"`, a monorepo-relative path absent from a
    standalone clone (breaks `vite build` + `tsc --noEmit`). `writeStandaloneTsconfig`
    writes `<targetDir>/tsconfig.base.json` from the BAKED `STANDALONE_TSCONFIG_BASE`
    constant, then repoints the cloned `tsconfig.json` `extends` →
    `"./tsconfig.base.json"`. If the clone has no `tsconfig.json` the base is
    still written and the repoint is skipped. The baked constant is held in sync
    with the repo-root `tsconfig.base.json` by a deep-equal PARITY TEST
    (`starterTsconfig.test.ts`) — bump it there if the root base changes. The
    vendored adapter's own `extends: "../../tsconfig.base.json"` resolves to this
    clone-root base automatically; do NOT modify the adapter tsconfig.
  - **`.npmrc legacy-peer-deps` (`writeNpmrc`).** Published
    `@invinite-org/chartlang-compiler` depends on `esbuild@^0.24` while `vite@8`
    has an optional peer `esbuild@^0.27 || ^0.28`; the app runs fine on 0.24, so
    the clone writes `<targetDir>/.npmrc` with `legacy-peer-deps=true` to clear
    npm's strict optional-peer check. Do NOT bump esbuild or touch the compiler.
  - **Vendored-adapter SRC repoint (`repointVendoredPackageJson`) — intentional
    DIVERGENCE from `cli add-adapter`.** `add-adapter` keeps the bundle's
    dist-pointing `package.json` (it expects a build); create-chartlang vendors
    only `src/` and never builds, so the vendored `package.json`'s `main`/`types`
    and every `exports` entry's `types`/`import` are repointed `./dist/*` →
    `./src/*.ts` (`.d.ts`/`.js` → `.ts`). Vite + tsc then resolve the adapter
    directly from source with NO build step. Absent fields are left untouched.
  - **Matrix chart-lib drop (`rewritePackageJson.ts`).** The starter ships every
    adapter-matrix chart lib (`echarts`/`konva`/`lightweight-charts`/`uplot`, all
    in devDeps now that canvas2d is the committed default) for its in-monorepo dev
    setup. `rewriteBlock` drops all of `MATRIX_CHART_LIBS`; the existing re-add of
    the chosen `chartLibrary` at its registry range puts back only the one the user
    picked (none for the default canvas2d).

See `packages/CLAUDE.md` (package-wide gates) and `apps/react-starter/CLAUDE.md`
(the seam SSOT + what the clone contains).
