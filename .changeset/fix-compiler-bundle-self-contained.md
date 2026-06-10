---
"@invinite-org/chartlang-compiler": patch
"@invinite-org/chartlang-host-quickjs": patch
---

Fix end-user-blocking bug where compiled scripts could not load in either sandbox host: `compile()` now emits a self-contained ESM bundle (`esbuild.build` with `bundle: true`) so the bare `@invinite-org/chartlang-core` import is inlined and tree-shaken, matching PLAN §5.2's "~5–50 KB ESM" contract. The host-worker `data:` URL load path now succeeds end-to-end. The host-quickjs `moduleSourceToScript` regex also accepts the `export { name as default };` form produced by `esbuild`'s bundled output (the previous regex only matched literal `export default <expr>;`, so every real compile output threw "compiled module did not declare an export default").
