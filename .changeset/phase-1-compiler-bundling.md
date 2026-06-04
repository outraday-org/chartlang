---
"@invinite-org/chartlang-compiler": minor
---

Phase-1 public compile API: `compile(source, opts)`, `compileFile(path, opts)`,
`compileProject(rootDir, opts)` wrap the Task-2 transformer + analysis driver
and feed the printed AST through esbuild to produce the `.chart.js` +
`manifest.json` + `.d.ts` triple per §5.2 / §5.3. Adds `CompileError` carrying
the full diagnostic array, `bundleModule` + `formatManifestAssignment` (esbuild
driver), `emitTypes` (minimal `.d.ts` generator), and `writeAtomic` +
`walkChartFiles` helpers. `compileFile` writes the triple atomically via
tmp + rename; sourcemaps support `false` / `"inline"` / `"external"`. The
sibling docs-check gate now compiles every qualifying `@example` block through
the compiler — `EXEMPT_EXPORTS` is empty, and placeholder packages keep a
JSDoc'd `PACKAGE_VERSION` shim until their Phase-1 tasks land.
