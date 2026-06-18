# packages/cli/

`@invinite-org/chartlang-cli` — `chartlang compile` +
`chartlang scaffold-adapter` (Phase 1) + `chartlang docs` (Phase 2).

## Invariants

- **`bin.ts` is the `#!/usr/bin/env node` entry; all logic lives in
  `index.ts` / `commands/`.** The shebang must stay on the first line
  of the published `dist/bin.js`. `bin.ts` runs `runCli(process.argv
  .slice(2))` at import-time, so it is excluded from per-package
  vitest coverage (same precedent as host-worker's `workerBoot.ts`).
  Adding logic to `bin.ts` requires the same exclusion + a dedicated
  child-process test — the Phase-1 convention is "in-process only,
  drive `runCli` directly".
- **`runCompile`'s `--out <dir>` branch uses `compile` +
  `writeAtomic` directly; the sibling-write branch uses
  `compileFile`.** `compileFile` only writes siblings of the source —
  there is no `outDir` parameter in the compiler API. Do not "unify"
  the two branches by always going through `compile` — sibling writes
  use the compiler's own atomic-rename path, which we don't want to
  reimplement.
- **`runCompile` continues with the next file after a
  `CompileError`.** Per-file diagnostics flow to stderr + the process
  exits 1 at end; non-`CompileError` errors (ENOENT, EACCES) propagate
  to `bin.ts` for top-level formatting.
- **`runScaffoldAdapter` refuses to overwrite a non-empty target.**
  Idempotence is enforced via `readdir(target).length === 0`. An
  empty target dir is allowed (mkdir-then-fill); a missing target
  works too. There is no `--force` flag in Phase 1.
- **Generated `package.json` is unscoped + `"private": true`.**
  Consumer-repo adapters opt-in to publishing by editing the file.
  The name pattern `chartlang-adapter-<NAME>` matches the task spec,
  not the workspace's `@invinite-org/chartlang-*` scope (those names
  are reserved for OSS packages we ship).
- **Bare `--sourcemap` token is rewritten to `--sourcemap=true`
  before `parseArgs`.** `node:util.parseArgs` does not natively
  support "bare-flag-or-value" duality on a single option, so
  `normaliseBareSourcemap` does a pre-pass over `argv`. Same trick is
  not needed for `--minify` (boolean by default).
- **Help text lives in `commands/help.ts` only.** Both subcommands
  delegate to `printHelp` on `--help`; the dispatcher routes
  no-args / `-h` / `--help` to `runHelp`. Editing the help string in
  multiple places is a regression.
- **`genPhase4Docs` resolves `Object.freeze({ name })` shorthands to the
  top-level overloaded function declaration.** When a namespace member is a
  shorthand (e.g. `request.security` lives as `function security(...)`
  declarations referenced by `Object.freeze({ security, lowerTf })` rather
  than an inline method), `resolveShorthand` walks to the declaration that
  carries the JSDoc — the **first** overload signature (TS splits the doc
  onto the first signature, the body onto the implementation). That signature
  is what the page prints, so the doc page shows the public overload, not the
  widened implementation. Adding a member to a freeze-namespace as a
  shorthand-of-a-function (vs an inline method) is the supported pattern;
  both resolve identically.
- **`chartlang docs` owns `docs/primitives/ta/<id>.md`.** Pages open
  with the `AUTO_GENERATED_HEADER` sentinel; never hand-edit them.
  `index.md` in the same folder IS hand-written. The signature
  block in each generated page intentionally shows the runtime
  export (with the leading `slotId: string` parameter) — the page
  text annotates that the compiler injects `slotId` so script
  authors call `ta.<id>(...)` directly. The skip list (in
  `genDocs.ts`) excludes `index.ts`, `registry.ts`, `sourceValue.ts`,
  every `*.test.ts` / `*.bench.ts` / `*.bench.test.ts` /
  `*.golden.test.ts` / `*.property.test.ts` basename, and all
  subdirectories under `packages/runtime/src/ta/` (the generator
  does not descend — `lib/` holds helpers, not primitives).
- **`chartlang docs` (this primitives generator) vs PLAN §17.7's
  `chartlang docs <script>`.** Phase 2 ships the no-positional form
  that regenerates the primitives index. PLAN §17.7's user-script
  form (`chartlang docs <script.chart.ts>` → emits a single
  markdown page describing one script's manifest) defers to a
  later phase. The two share the subcommand name; positional
  presence disambiguates. The dispatcher routes both forms to
  `runDocsCommand`; future work adds the positional branch there.
- **`typescript` is a runtime `dependency` (not `devDependency`).**
  `genDocs.ts` imports `typescript` at runtime to parse JSDoc via
  the compiler API. The published `dist/` ships against the
  consumer's `typescript` install.
- **`pine-convert` is a thin in-process layer over
  `@invinite-org/chartlang-pine-converter`'s `convertFile` + its
  `/diagnostics` formatters — it owns NO conversion logic.**
  `commands/pineConvert.ts` parses flags via `node:util.parseArgs`
  (same precedent as `runCompile`), builds `ConvertFileOpts`, and
  routes output: `--out` writes the file (nothing converted to
  stdout), else the source streams to stdout; diagnostics go to
  stderr as a human report when `--report` or `process.stderr.isTTY`,
  or to stdout as JSON under `--diagnostics-json` (which suppresses the
  source from stdout). `runPineConvert` sets `process.exitCode` per the
  converter CLI's stable contract — `1` error-severity diagnostics,
  `2` file I/O failure, `3` invalid args — and `InvalidArgsError`
  distinguishes the arg-error (exit 3, prints help) from the I/O-error
  (exit 2) catch. The `errorMessage(err)` helper is exported solely so a
  unit test can cover its non-`Error` fallback (unreachable via real
  `parseArgs`/`fs` errors, which always throw `Error`s). Drive
  `runPineConvert` / `runCli` IN-PROCESS in tests (the Phase-1
  convention); `@invinite-org/chartlang-pine-converter` is a runtime
  `dependency`.
