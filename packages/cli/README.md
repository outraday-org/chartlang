# @invinite-org/chartlang-cli

`experimental`

chartlang CLI — compiles `.chart.ts` sources via
`@invinite-org/chartlang-compiler` and scaffolds starter adapter
packages outside the OSS repo.

## Install

```bash
pnpm add @invinite-org/chartlang-cli
```

Once installed and built, the `chartlang` binary is available on
`PATH` inside the package's bin dir. From the workspace root, use the
`pnpm chartlang …` script alias defined in the root `package.json`.

## Public surface

Subcommands:

- `chartlang compile <file...> [--sourcemap[=mode]] [--minify] [--out <dir>]`
  — compiles each `.chart.ts` file into the `.chart.js` +
  `.chart.manifest.json` + `.chart.d.ts` triple. Default writes
  siblings of each source; `--out <dir>` redirects them under a single
  directory. `--sourcemap=external` adds a `.chart.js.map` sibling.
  Phase 2+ adds `lint`, `bench`, `docs`.
- `chartlang scaffold-adapter <name> [--target <dir>]` — generates a
  starter adapter package outside this repo. `name` must be kebab-case
  (`^[a-z][a-z0-9-]*$`). Default target is `./<name>`. Refuses to
  overwrite a non-empty target.
- `chartlang docs [--source <dir>] [--out <dir>]` — auto-generates
  `docs/primitives/ta/<id>.md` per `ta.*` primitive from the runtime's
  JSDoc. CI gate: `pnpm docs:gate` byte-diffs the regenerated pages
  against the committed tree.
- `chartlang --help` / `-h` — prints the usage block.

Programmatic surface (re-exported from `./index`):

- `runCli(argv)` — async dispatcher used by the `bin.ts` entry
- `runCompile(args)`, `runScaffoldAdapter(args)`, `runDocsCommand(args)`,
  `runHelp()`, `printHelp(stream?)` — individual command runners
- `runGenDocs`, `generateDocsPage`, `parsePrimitiveSource`,
  `GenDocsError`, `AUTO_GENERATED_HEADER`, `findRepoRoot` — the
  docs-generator primitives

## Minimum-viable API call

```ts
import { runCli } from "@invinite-org/chartlang-cli";

// Equivalent to: chartlang compile ./demo.chart.ts --sourcemap=external
await runCli(["compile", "./demo.chart.ts", "--sourcemap=external"]);
```

## Docs

See [`docs/reference/`](../../docs/reference/).

## License

MIT
