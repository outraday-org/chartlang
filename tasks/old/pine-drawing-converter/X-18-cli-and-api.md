# Task 18 — CLI subcommand + programmatic API polish

> **Status: TODO**

## Goal

Wire the converter into the chartlang CLI as a `pine-convert`
subcommand so users can run `pnpm chartlang pine-convert input.pine
--out output.chart.ts`, and finalize the programmatic API
(`convertFile`, `convert`) for downstream Node consumers. Both paths
share the same pipeline; the CLI is a thin layer over the programmatic
surface.

## Prerequisites

Task 17 (diagnostics framework — the CLI prints reports from it).

## Current Behavior

`convert(source, opts)` exists (Task 16). No CLI subcommand exists.
`convertFile` is declared in `src/index.ts` but not implemented.

## Desired Behavior

- `pnpm chartlang pine-convert <input.pine>` — converts the Pine
  file, prints diagnostics, writes output. Exit code 0 on success,
  1 on errors.
- `convertFile(path, opts?)` — async file-system wrapper around
  `convert(source, opts)` that resolves output paths and handles
  encoding.
- `--out <path>` flag to write output to disk.
- `--report` flag to print the human-readable diagnostic report
  (default when stderr is TTY).
- `--diagnostics-json` flag to emit JSON diagnostics.
- `--strict` flag to set `ConvertOpts.strictMode === true`.
- `--bar-interval <ms>` flag to set `ConvertOpts.barInterval`.
- `--bar-index-origin <ms>` flag to set `ConvertOpts.barIndexOrigin`.

## Requirements

### 1. `convertFile` implementation

```ts
// src/index.ts
export async function convertFile(
    path: string,
    opts?: ConvertOpts & { outPath?: string }
): Promise<ConvertResult>;
```

- Reads `path` as UTF-8.
- Calls `convert(source, opts)`.
- If `opts.outPath` is set and `output !== null`, writes the output
  to disk.
- Returns the same `ConvertResult` as `convert`.
- Throws on file I/O errors (these are not converter diagnostics —
  they're host-environment failures).

### 2. CLI subcommand integration

The chartlang CLI lives in `packages/cli`. Inspect existing structure
(today: `compile`, `scaffold-adapter`, `docs`). Add `pine-convert`
following the same dispatcher, `parseArgs`, help-text, and
`process.exitCode` conventions.

`packages/cli/src/commands/pineConvert.ts`:

```ts
import { convertFile } from "@invinite-org/chartlang-pine-converter";
import { formatDiagnosticReport, formatDiagnosticsJson } from "@invinite-org/chartlang-pine-converter/diagnostics";

export type PineConvertOpts = Readonly<{
    input: string;
    out?: string;
    report?: boolean;
    diagnosticsJson?: boolean;
    strict?: boolean;
    barInterval?: number;
    barIndexOrigin?: number;
}>;

export async function pineConvertCommand(opts: PineConvertOpts): Promise<number> {
    const source = await readFile(opts.input, "utf-8");
    const result = await convertFile(opts.input, {
        outPath: opts.out,
        strictMode: opts.strict ?? false,
        barInterval: opts.barInterval ?? null,
        barIndexOrigin: opts.barIndexOrigin ?? null,
    });
    if (opts.diagnosticsJson) {
        process.stdout.write(formatDiagnosticsJson(result.diagnostics) + "\n");
    } else if (opts.report || process.stderr.isTTY) {
        process.stderr.write(formatDiagnosticReport(result.diagnostics, source));
    }
    const hasErrors = result.diagnostics.some(d => d.severity === "error");
    return hasErrors ? 1 : 0;
}
```

Wire it into `packages/cli/src/index.ts`'s switch-case dispatcher
(matches the existing `compile`, `scaffold-adapter`, `docs`
subcommands):

```ts
case "pine-convert":
    await runPineConvert(rest);
    return;
```

Add the imported entry to the dispatcher in `packages/cli/src/index.ts`
following the existing pattern.

### 3. Sub-export entry for diagnostics

`@invinite-org/chartlang-pine-converter/diagnostics` is already
reserved in `scripts/scaffold.ts` from Task 1. In this task, verify the
generated `package.json` has the subpath export so consumers can import
only the diagnostic helpers:

```json
// package.json
"exports": {
    ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" },
    "./diagnostics": { "import": "./dist/diagnostics/index.js", "types": "./dist/diagnostics/index.d.ts" }
}
```

The default-export entry (`.`) keeps the public surface from Task 1
intact. The `./diagnostics` sub-export adds the formatters and
collector.

### 4. CLI help text

Standard structure (match existing subcommands):

```
Usage: chartlang pine-convert <input.pine> [options]

Convert a Pine Script v6 source file to a chartlang .chart.ts file.

Arguments:
  <input.pine>          Path to the Pine v6 source file.

Options:
  --out <path>          Write the converted .chart.ts to disk at this path.
                        If omitted, output is printed to stdout.
  --report              Print a human-readable diagnostic report to stderr
                        (default when stderr is a TTY).
  --diagnostics-json    Print machine-readable diagnostics as JSON to stdout.
                        When set, the converted source is suppressed from
                        stdout (use --out to write the converted source to
                        a file instead). Incompatible with --report.
  --strict              Treat all warnings as errors; suppress output if any
                        error fires.
  --bar-interval <ms>   Milliseconds per bar — required if the script uses
                        `bar_index + N` future anchors.
  --bar-index-origin <ms>  Absolute time of bar_index 0 — required for
                            historical bar_index references.
  --help                Show this help.
```

### 5. Exit codes

| Code | When |
|---|---|
| 0 | Converted successfully (no errors; warnings/infos may be present). |
| 1 | One or more error-severity diagnostics emitted. |
| 2 | I/O failure (file not found, permission denied). |
| 3 | Invalid CLI arguments. |

### 6. Output flushing

When writing to `--out`, ensure stdout is not used for the output; the
file is the output sink. When `--out` is absent and `--diagnostics-json`
is absent, the converted source goes to stdout and diagnostics go to
stderr. Test this routing.

### 7. Tests (§16.3)

| File | Purpose |
|------|---------|
| `convertFile.test.ts` | File-system roundtrip: write input → convert → assert output content + diagnostics shape. |
| `cli.test.ts` | Spawn the CLI binary with each flag combination, assert exit codes + stdout/stderr routing. Uses `child_process.spawnSync` against the built `dist/bin.js` (the actual bin entry; `packages/cli/package.json` declares `"bin": { "chartlang": "./dist/bin.js" }`). |
| `cli-strict.test.ts` | `--strict` upgrades warnings to errors → exit 1 when warnings present. |
| `cli-json.test.ts` | `--diagnostics-json` produces parseable JSON on stdout. |
| `subexport.test.ts` | Importing `@invinite-org/chartlang-pine-converter/diagnostics` resolves and exposes the formatters. |

Coverage 100% on `src/index.ts` (`convert` + `convertFile`),
`packages/cli/src/commands/pineConvert.ts`.

### 8. JSDoc

Every exported function/type carries `@since 0.1`, `@experimental`,
and an `@example`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/index.ts` | Modify | Implement `convertFile`. |
| `scripts/scaffold.ts` | Verify | `SUBPATH_EXPORTS["packages/pine-converter"]["./diagnostics"]` exists from Task 1; update only if missing. |
| `packages/pine-converter/package.json` | Generated / verify | Sub-export for `./diagnostics` is present after scaffold. |
| `packages/pine-converter/src/diagnostics/index.ts` | Modify | Add formatter re-exports to the package surface. |
| `packages/cli/src/commands/pineConvert.ts` | Create | CLI command. |
| `packages/cli/src/index.ts` | Modify | Register `pine-convert` in the command registry. |
| `packages/cli/package.json` | Modify | Add `@invinite-org/chartlang-pine-converter` as a dep. |
| Tests (per the table above) | Create | §16.3 layer set. |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage on touched files)
- `pnpm docs:check`
- `pnpm readme:check`

## Changeset

`.changeset/pine-converter-cli.md` — minor bump for both
`@invinite-org/chartlang-pine-converter` (new public surface
`convertFile` + sub-export) and `@invinite-org/chartlang-cli` (new
subcommand).

## Acceptance Criteria

- `pnpm chartlang pine-convert fixtures/hello.pine --out
  out/hello.chart.ts` writes a valid `.chart.ts` file.
- Default invocation prints output to stdout, diagnostics to stderr.
- `--strict` exits 1 when warnings present.
- `--diagnostics-json` produces valid parseable JSON on stdout.
- File-not-found exits with code 2.
- Importing `@invinite-org/chartlang-pine-converter/diagnostics` works.
- 100% coverage on the listed files.
- JSDoc + lint + typecheck gates green.
- Changeset committed (one entry covering both packages).
