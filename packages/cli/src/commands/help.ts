// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

const HELP_TEXT = `chartlang — script compiler + adapter scaffolding

Usage:
  chartlang compile <file...> [--sourcemap[=mode]] [--minify] [--out <dir>]
  chartlang scaffold-adapter <name> [--target <dir>]
  chartlang docs [--source <dir>] [--out <dir>] [--draw-source <dir>] [--draw-out <dir>]
  chartlang pine-convert <input.pine> [--out <path>] [--strict] [--diagnostics-json] [--report] [--bar-interval <ms>] [--bar-index-origin <ms>]
  chartlang --help

Examples:
  chartlang compile examples/scripts/ema-cross.chart.ts
  chartlang scaffold-adapter my-trading-chart --target ./out
  chartlang docs --out docs/primitives/ta --draw-out docs/primitives/draw
  chartlang pine-convert strategy.pine --out strategy.chart.ts
`;

/**
 * Write the `chartlang --help` text to a writable stream. Split from
 * {@link runHelp} so coverage tests can capture output without
 * stubbing `console.log` or `process.stdout`. Defaults to
 * `process.stdout` for the production caller.
 *
 * @since 0.1
 * @example
 *     import { printHelp } from "@invinite-org/chartlang-cli";
 *     const chunks: string[] = [];
 *     printHelp({ write: (c: string) => { chunks.push(c); return true; } } as NodeJS.WritableStream);
 *     // chunks.join("") includes "chartlang —"
 */
export function printHelp(stream: NodeJS.WritableStream = process.stdout): void {
    stream.write(HELP_TEXT);
}

/**
 * Production entrypoint for the `chartlang --help` subcommand — writes
 * the help text to `process.stdout`. Called by the dispatcher when the
 * user passes `--help`, `-h`, or no subcommand.
 *
 * @since 0.1
 * @example
 *     import { runHelp } from "@invinite-org/chartlang-cli";
 *     runHelp();
 */
export function runHelp(): void {
    printHelp();
}
