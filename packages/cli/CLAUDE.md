# packages/cli/

`@invinite-org/chartlang-cli` — `chartlang compile` +
`chartlang scaffold-adapter` for Phase 1.

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
