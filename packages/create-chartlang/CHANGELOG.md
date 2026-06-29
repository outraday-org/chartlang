# create-chartlang

## 0.1.4

### Patch Changes

- 903f14a: Default the React starter's chart library to `webgl` (the zero-dep raw WebGL2
  example adapter) instead of `canvas2d`. `npm create @invinite-org/chartlang`
  with no `--library` (or an empty interactive answer / `--yes`) now vendors the
  webgl adapter and writes the webgl `activeAdapter.ts` seam; the prompt list
  shows webgl first, marked `(default)`. `canvas2d` remains a fully supported
  non-default choice via `--library canvas2d`.
  - @invinite-org/chartlang-cli@1.3.4

## 0.1.3

### Patch Changes

- 3770236: Add the `webgl` seam template so `npm create @invinite-org/chartlang` can
  vendor + rewrite the active-adapter seam for the new zero-dependency raw
  WebGL2 example adapter (`chartlang-example-webgl-adapter`). `SEAM_IDS` now
  carries six bundled ids (`canvas2d`, `lightweight-charts`, `uplot`,
  `echarts`, `konva`, `webgl`); the new template body is byte-identical to the
  matrix-proven `apps/react-starter` seam SSOT after the example-adapter →
  vendored-local name substitution (`seamTemplates.test.ts` parity green).
- Updated dependencies [810125e]
  - @invinite-org/chartlang-cli@1.3.2

## 0.1.2

### Patch Changes

- ab8b218: Change the default chart library from `echarts` to `canvas2d`. When you run
  `npm create @invinite-org/chartlang@latest` without `--library` (or accept the
  prompt default / pass `--yes`), the installer now scaffolds the dependency-free
  `canvas2d` adapter instead of `echarts`. The other four libraries
  (`echarts`, `lightweight-charts`, `uplot`, `konva`) are still available via the
  prompt or `--library <id>`.
- a66b28d: Fix the lightweight-charts starter rendering blank ("Assertion failed" in
  lightweight-charts 5.x `addSeriesImpl`). The lightweight-charts seam overrode
  the adapter's `createChart` with the raw `IChartApi` (force-cast through
  `unknown`), bypassing the adapter's internal wrapper that maps its string-keyed
  `addSeries("Candlestick" | "Line", …)` calls onto v5's series-definition API.
  The seam now omits the override so the adapter uses its own (correct) default
  `createChart`, matching how the site demo driver mounts it. The chosen library
  is still installed (the adapter imports `lightweight-charts` internally).
- Updated dependencies [08cba38]
- Updated dependencies [1efb49c]
- Updated dependencies [1efb49c]
  - @invinite-org/chartlang-cli@1.3.1

## 0.1.1

### Patch Changes

- 24946e4: Scaffolded project now installs, typechecks, builds and runs out of the box.
  Four standalone-clone fixes: a baked standalone `tsconfig.base.json` with the
  cloned `tsconfig.json` `extends` repointed (the old monorepo-relative
  `../../tsconfig.base.json` broke `vite build` + `tsc`); a `.npmrc` with
  `legacy-peer-deps=true` to clear the `vite@8` / `chartlang-compiler` esbuild
  optional-peer conflict; the vendored adapter's `package.json` `main`/`types`/
  `exports` repointed from `./dist/*` to `./src/*.ts` so it resolves with no
  build step; and dropping the unused adapter-matrix chart libs
  (`echarts`/`konva`/`lightweight-charts`/`uplot`), keeping only the chosen one.

## 0.1.0

### Minor Changes

- c7fd749: New package `create-chartlang` — the `npm create chartlang@latest my-app`
  installer. It clones the `apps/react-starter` TanStack Start starter from
  GitHub, prompts for a chart library (default echarts, or
  lightweight-charts / uplot / konva / canvas2d), vendors the chosen adapter
  from the CLI's offline `BUNDLED_ADAPTERS`, rewrites the single
  `activeAdapter.ts` seam + the `package.json` workspace deps to published
  versions, writes a `.env`, and prints next steps. Flags: `[dir]`,
  `--library <id>`, `--pm <npm|pnpm|yarn|bun>`, `--no-install`, `--yes`. Only
  the GitHub clone + optional install touch the network; adapter vendoring +
  seam rewrite are offline. The emitted seam for every library is
  byte-identical to the matrix-proven `SEAM_VARIANTS` (guarded by a parity
  test).

### Patch Changes

- Updated dependencies [a165b3b]
- Updated dependencies [c7fd749]
  - @invinite-org/chartlang-cli@1.3.0
