# create-chartlang

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
