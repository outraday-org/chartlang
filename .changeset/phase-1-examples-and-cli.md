---
"@invinite-org/chartlang-cli": minor
---

Phase-1 CLI: `chartlang compile` and `chartlang scaffold-adapter`.
`compile` writes the `.chart.js` + `.chart.manifest.json` + `.chart.d.ts`
triple per source via the compiler API, with `--sourcemap[=mode]` /
`--minify` / `--out <dir>` flags. Continues compiling on a per-file
`CompileError` so a single bad file does not mask successes.
`scaffold-adapter` generates a starter adapter package outside the
OSS repo from string templates (kebab-case name validation, refuses
to overwrite a non-empty target, mints `package.json` /
`tsconfig.json` / `src/index.ts` / `src/index.test.ts` / `README.md`
/ `.gitignore`). Adds three Phase-1 example scripts under
`examples/scripts/` (ema-cross, bollinger-bands,
rsi-divergence-alert), each compiled end-to-end by the CLI package's
`e2e.test.ts`. Removes the Phase-0 `PACKAGE_VERSION` placeholder.
