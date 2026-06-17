// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import { convertFile } from "@invinite-org/chartlang-pine-converter";
import type { ConvertFileOpts } from "@invinite-org/chartlang-pine-converter";
import {
    formatDiagnosticReport,
    formatDiagnosticsJson,
} from "@invinite-org/chartlang-pine-converter/diagnostics";

import { printHelp } from "./help.js";

// Exit codes are the converter CLI's stable contract (task §5):
//   0 success · 1 error diagnostics · 2 I/O failure · 3 invalid args.
const EXIT_INVALID_ARGS = 3;
const EXIT_IO_FAILURE = 2;
const EXIT_ERRORS = 1;

// Distinguishes a CLI-arg failure (exit 3) from a file-I/O failure (exit 2)
// when both surface as thrown errors inside `runPineConvert`.
class InvalidArgsError extends Error {}

/**
 * Coerce a caught `unknown` into a printable message string. Exported for the
 * unit test that exercises the non-`Error` fallback (thrown primitives), which
 * the in-process command paths cannot reach via real `parseArgs` / `fs` errors.
 *
 * @since 0.1
 * @example
 *     errorMessage(new Error("boom")); // "boom"
 *     errorMessage("boom"); // "boom"
 */
export function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

function parseNumericFlag(raw: string | undefined, flag: string): number | undefined {
    if (raw === undefined) {
        return undefined;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
        throw new InvalidArgsError(`invalid ${flag} value "${raw}" (expected a number)`);
    }
    return value;
}

function buildOpts(values: {
    out: string | undefined;
    strict: boolean | undefined;
    barInterval: number | undefined;
    barIndexOrigin: number | undefined;
}): ConvertFileOpts {
    const opts: { -readonly [K in keyof ConvertFileOpts]: ConvertFileOpts[K] } = {
        strictMode: values.strict ?? false,
    };
    if (values.out !== undefined) opts.outPath = values.out;
    if (values.barInterval !== undefined) opts.barInterval = values.barInterval;
    if (values.barIndexOrigin !== undefined) opts.barIndexOrigin = values.barIndexOrigin;
    return opts;
}

/**
 * Execute the `chartlang pine-convert <input.pine>` subcommand. Converts a
 * Pine Script v6 source file to a chartlang `.chart.ts` source string via
 * {@link convertFile}, prints diagnostics, and writes or streams the output.
 *
 * Routing: with `--out <path>` the converted source is written to that file;
 * otherwise (and without `--diagnostics-json`) it streams to stdout. Diagnostics
 * go to stderr as a human report when stderr is a TTY or `--report` is set, or
 * as JSON to stdout under `--diagnostics-json` (which suppresses the converted
 * source from stdout). `--strict` upgrades warnings to errors. `--bar-interval`
 * / `--bar-index-origin` thread milliseconds through to `ConvertOpts`.
 *
 * Sets `process.exitCode`: `1` when any error-severity diagnostic fires, `2` on
 * file I/O failure (missing input, permission denied), `3` on invalid CLI args.
 *
 * @since 0.1
 * @example
 *     import { runPineConvert } from "@invinite-org/chartlang-cli";
 *     await runPineConvert(["hello.pine", "--out", "hello.chart.ts"]);
 */
export async function runPineConvert(args: ReadonlyArray<string>): Promise<void> {
    let input: string;
    let opts: ConvertFileOpts;
    let wantsJson: boolean;
    let wantsReport: boolean;
    try {
        const parsed = parseArgs({
            args: args.slice(),
            options: {
                out: { type: "string" },
                report: { type: "boolean" },
                "diagnostics-json": { type: "boolean" },
                strict: { type: "boolean" },
                "bar-interval": { type: "string" },
                "bar-index-origin": { type: "string" },
                help: { type: "boolean", short: "h" },
            },
            allowPositionals: true,
            strict: true,
        });

        if (parsed.values.help) {
            printHelp();
            return;
        }

        const [positional, ...extra] = parsed.positionals;
        if (positional === undefined) {
            throw new InvalidArgsError("chartlang pine-convert requires an input file path");
        }
        if (extra.length > 0) {
            throw new InvalidArgsError("chartlang pine-convert accepts a single input file");
        }

        input = positional;
        opts = buildOpts({
            out: parsed.values.out,
            strict: parsed.values.strict,
            barInterval: parseNumericFlag(parsed.values["bar-interval"], "--bar-interval"),
            barIndexOrigin: parseNumericFlag(
                parsed.values["bar-index-origin"],
                "--bar-index-origin",
            ),
        });
        wantsJson = parsed.values["diagnostics-json"] ?? false;
        wantsReport = parsed.values.report ?? false;
    } catch (err) {
        const message = errorMessage(err);
        process.stderr.write(`error: ${message}\n`);
        process.exitCode = EXIT_INVALID_ARGS;
        if (err instanceof InvalidArgsError) {
            printHelp(process.stderr);
        }
        return;
    }

    let source: string;
    let result: Awaited<ReturnType<typeof convertFile>>;
    try {
        // The human report formatter needs the source text for span rendering;
        // convertFile reads it internally too, but does not return it.
        source = await readFile(input, "utf-8");
        result = await convertFile(input, opts);
    } catch (err) {
        const message = errorMessage(err);
        process.stderr.write(`error: failed to read ${input}: ${message}\n`);
        process.exitCode = EXIT_IO_FAILURE;
        return;
    }

    if (wantsJson) {
        process.stdout.write(`${formatDiagnosticsJson(result.diagnostics)}\n`);
    } else {
        if (opts.outPath === undefined && result.output !== null) {
            process.stdout.write(result.output);
        }
        if (wantsReport || process.stderr.isTTY) {
            process.stderr.write(formatDiagnosticReport(result.diagnostics, source));
        }
    }

    if (result.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
        process.exitCode = EXIT_ERRORS;
    }
}
