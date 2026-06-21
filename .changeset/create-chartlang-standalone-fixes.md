---
"create-chartlang": patch
---

Scaffolded project now installs, typechecks, builds and runs out of the box.
Four standalone-clone fixes: a baked standalone `tsconfig.base.json` with the
cloned `tsconfig.json` `extends` repointed (the old monorepo-relative
`../../tsconfig.base.json` broke `vite build` + `tsc`); a `.npmrc` with
`legacy-peer-deps=true` to clear the `vite@8` / `chartlang-compiler` esbuild
optional-peer conflict; the vendored adapter's `package.json` `main`/`types`/
`exports` repointed from `./dist/*` to `./src/*.ts` so it resolves with no
build step; and dropping the unused adapter-matrix chart libs
(`echarts`/`konva`/`lightweight-charts`/`uplot`), keeping only the chosen one.
