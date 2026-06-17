# Usage

Two entry points: the `chartlang pine-convert` CLI subcommand and the
programmatic `convert` / `convertFile` API.

## CLI

```
chartlang pine-convert <input.pine> [--out <path>] [--strict]
                       [--diagnostics-json] [--report]
                       [--bar-interval <ms>] [--bar-index-origin <ms>]
```

| Flag | Effect |
|---|---|
| `<input.pine>` | The Pine v6 source file to convert (required, single file). |
| `--out <path>` | Write the converted `.chart.ts` to `<path>`. Without it, the converted source streams to **stdout**. |
| `--strict` | Upgrade every **warning** to an **error** (see [strict mode](#strict-mode)). |
| `--diagnostics-json` | Print diagnostics as JSON to stdout (suppresses the converted source on stdout). |
| `--report` | Force the human diagnostics report to stderr even when stderr is not a TTY. |
| `--bar-interval <ms>` | Milliseconds per bar — **required** when the script uses future `bar_index + N` anchors. |
| `--bar-index-origin <ms>` | Absolute time (ms) of `bar_index = 0` — used for historical `bar_index[N]` anchors. |

**Exit codes** (the CLI's stable contract):

| Code | Meaning |
|---|---|
| `0` | Success — no error-severity diagnostics. |
| `1` | The conversion emitted one or more **error**-severity diagnostics. |
| `2` | File I/O failure (missing input, permission denied). |
| `3` | Invalid CLI arguments. |

Diagnostics go to **stderr** as a human report when stderr is a TTY or
`--report` is passed; the converted source (when not `--out`) goes to
**stdout**, so you can pipe one without the other:

```bash
# Convert to stdout, see the diagnostics report on stderr:
pnpm chartlang pine-convert strategy.pine --report > strategy.chart.ts

# Machine-readable diagnostics only:
pnpm chartlang pine-convert strategy.pine --diagnostics-json
```

Each diagnostic in the human report ends with a
`= docs: https://chartlang.dev/converter/diagnostics#<slug>` line that
links straight to the [diagnostics reference](./diagnostics.md).

## Programmatic API

The package exports a synchronous `convert` and an async `convertFile`.

```ts
import { convert, convertFile } from "@invinite-org/chartlang-pine-converter";
import type { ConvertOpts, ConvertResult } from "@invinite-org/chartlang-pine-converter";

// Synchronous, in-memory. Never touches the filesystem.
const result: ConvertResult = convert(pineSource, {
    barInterval: 60_000, // ms per bar — required for future bar_index + N anchors
    strictMode: false,
} satisfies ConvertOpts);

result.output;      // the chartlang `.chart.ts` string, or null on a fatal lex/parse error
result.manifest;    // { kind, name, inputs, drawingKindsUsed, requiresBarInterval } | null
result.diagnostics; // readonly Diagnostic[] — always defined
```

```ts
// Async fs wrapper: reads `path`, converts, and (when `outPath` is set
// and output is non-null) writes the result. REJECTS on an I/O error —
// an I/O failure is distinct from a clean conversion with error diagnostics.
const fileResult = await convertFile("strategy.pine", {
    outPath: "strategy.chart.ts",
});
```

`convert` does **not** round-trip the output through the chartlang
compiler. If you want compile-verification, call `compile(result.output)`
yourself with `@invinite-org/chartlang-compiler`.

### Options

`ConvertOpts` (all optional):

- `barInterval?: number | null` — ms per bar. **Required** when the source
  produces a future `bar_index + N` anchor; the resolver emits a single
  `requires-bar-interval` error otherwise.
- `barIndexOrigin?: number | null` — absolute time (ms) of `bar_index = 0`,
  used for historical `bar_index[N]` anchors.
- `strictMode?: boolean` — upgrade warnings to errors (default `false`).
- `targetApiVersion?: 1` — pinned to `1` in v1.

`ConvertFileOpts = ConvertOpts & { outPath?: string }`.

### Diagnostics formatters

The `/diagnostics` sub-export carries the formatters the CLI uses, so you
can render diagnostics the same way in your own tooling:

```ts
import {
    formatDiagnosticReport,
    formatDiagnosticsJson,
    DiagnosticReport,
} from "@invinite-org/chartlang-pine-converter/diagnostics";

console.error(formatDiagnosticReport(result.diagnostics, pineSource));
const report = new DiagnosticReport(result.diagnostics);
report.errors(); // only error-severity entries
```

## Strict mode

`strictMode: true` (CLI `--strict`) runs `upgradeWarningsToErrors` over the
returned diagnostics: every `warning` comes back as an `error`; `info` and
existing `error` entries are untouched. It does **not** null `output` —
strict callers detect failure by scanning the diagnostics for any
error-severity entry (the CLI does this and exits `1`).

## Runtime notes

`convertFile` uses `node:fs/promises`, so it requires a Node-like host.
`convert` is pure in-memory string processing with no `node:*` imports, so
it runs anywhere ES modules run (browsers, Deno, workers).
