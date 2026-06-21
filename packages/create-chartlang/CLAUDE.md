# packages/create-chartlang/

`create-chartlang` — the `npm create chartlang@latest my-app` installer. It
clones `apps/react-starter` from GitHub, prompts for a chart library (default
echarts), vendors the chosen adapter from the CLI's offline bundles, rewrites
the single `activeAdapter.ts` seam + `package.json` workspace deps, writes
`.env`, and prints next steps.

## Invariants

- **Hand-authored, NOT scaffold-generated; published under the BARE name
  `create-chartlang` with a `bin`.** This package is deliberately **absent**
  from `scripts/scaffold.ts` `PACKAGE_DIRS`: the §22.4 library template
  hardcodes a `@invinite-org/chartlang-<name>` scoped name with no `bin`
  field, so re-running `pnpm scaffold` would emit a wrong, non-zero-diff
  `package.json`. `bin` is `{ "create-chartlang": "./dist/index.js" }` (the
  npm convention that makes `npm create chartlang` work). Mirror
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

See `packages/CLAUDE.md` (package-wide gates) and `apps/react-starter/CLAUDE.md`
(the seam SSOT + what the clone contains).
