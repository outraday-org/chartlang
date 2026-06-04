// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mkdir, readFile } from "node:fs/promises";
import { basename, isAbsolute, resolve as resolvePath } from "node:path";
import { parseArgs } from "node:util";

import { CompileError, compile, compileFile, writeAtomic } from "@invinite-org/chartlang-compiler";
import type { CompileFileOptions, CompiledScript } from "@invinite-org/chartlang-compiler";

import { printHelp } from "./help.js";

type SourcemapMode = boolean | "inline" | "external";

type CompileFlags = Readonly<{
    sourcemap?: SourcemapMode;
    minify: boolean;
    outDir?: string;
}>;

function parseSourcemapFlag(raw: string | undefined): SourcemapMode | undefined {
    if (raw === undefined) return undefined;
    if (raw === "true") return true;
    if (raw === "inline") return "inline";
    if (raw === "external") return "external";
    if (raw === "none") return undefined;
    throw new Error(`invalid --sourcemap value "${raw}" (expected: inline | external | none)`);
}

function normaliseBareSourcemap(argv: ReadonlyArray<string>): string[] {
    return argv.map((arg) => (arg === "--sourcemap" ? "--sourcemap=true" : arg));
}

function buildCompileOptions(flags: CompileFlags): CompileFileOptions {
    const opts: { -readonly [K in keyof CompileFileOptions]: CompileFileOptions[K] } = {
        apiVersion: 1,
        write: true,
    };
    if (flags.sourcemap !== undefined) opts.sourcemap = flags.sourcemap;
    if (flags.minify) opts.minify = true;
    return opts;
}

async function writeTripleToOutDir(
    sourcePath: string,
    outDir: string,
    flags: CompileFlags,
): Promise<{ outBase: string; result: CompiledScript }> {
    const source = await readFile(sourcePath, "utf8");
    const stem = basename(sourcePath).replace(/\.chart\.ts$/, "");
    const sourcePathRel = `${stem}.chart.ts`;

    const compileOpts: {
        apiVersion: 1;
        sourcePath: string;
        sourcemap?: SourcemapMode;
        minify?: boolean;
    } = { apiVersion: 1, sourcePath: sourcePathRel };
    if (flags.sourcemap !== undefined) compileOpts.sourcemap = flags.sourcemap;
    if (flags.minify) compileOpts.minify = true;

    const result = await compile(source, compileOpts);

    await mkdir(outDir, { recursive: true });
    const outBase = resolvePath(outDir, stem);
    const jsPath = `${outBase}.chart.js`;
    await writeAtomic(jsPath, result.moduleSource);
    await writeAtomic(`${outBase}.chart.manifest.json`, JSON.stringify(result.manifest, null, 4));
    await writeAtomic(`${outBase}.chart.d.ts`, result.types);
    if (
        (flags.sourcemap === true || flags.sourcemap === "external") &&
        result.sourcemap !== undefined
    ) {
        await writeAtomic(`${jsPath}.map`, result.sourcemap);
    }
    return { outBase, result };
}

function formatDiagnostics(err: CompileError, sourcePath: string): string {
    const lines = err.diagnostics.map(
        (d) => `${d.file}:${d.line}:${d.column} [${d.code}] ${d.message}`,
    );
    return `error: failed to compile ${sourcePath}\n${lines.join("\n")}\n`;
}

/**
 * Execute the `chartlang compile <file...>` subcommand. Parses
 * `--sourcemap[=mode]`, `--minify`, `--out <dir>`, and `--help` flags,
 * then compiles each positional file via the compiler API. Without
 * `--out`, the compiler writes the `.chart.js` / `.chart.manifest.json`
 * / `.chart.d.ts` triple as siblings of the source. With `--out`, the
 * triple lands under the supplied directory keyed by the source's
 * stem. `--sourcemap=external` adds a `.chart.js.map` sibling next to
 * the `.chart.js`.
 *
 * On `CompileError`, diagnostics are written to `process.stderr` and
 * `process.exitCode` is set to `1`; remaining files still attempt to
 * compile so a single bad file does not mask successful ones. Other
 * errors (missing file, permission denied) are rethrown for the
 * `bin.ts` outer handler.
 *
 * @since 0.1
 * @example
 *     import { runCompile } from "@invinite-org/chartlang-cli";
 *     await runCompile(["./demo.chart.ts", "--sourcemap=external"]);
 */
export async function runCompile(args: ReadonlyArray<string>): Promise<void> {
    const normalised = normaliseBareSourcemap(args);
    const parsed = parseArgs({
        args: normalised.slice(),
        options: {
            sourcemap: { type: "string" },
            minify: { type: "boolean" },
            out: { type: "string" },
            help: { type: "boolean", short: "h" },
        },
        allowPositionals: true,
        strict: true,
    });

    if (parsed.values.help) {
        printHelp();
        return;
    }

    if (parsed.positionals.length === 0) {
        process.stderr.write("error: chartlang compile requires at least one file path\n");
        process.exitCode = 1;
        printHelp(process.stderr);
        return;
    }

    const sourcemap = parseSourcemapFlag(parsed.values.sourcemap);
    const flags: CompileFlags = {
        ...(sourcemap !== undefined ? { sourcemap } : {}),
        minify: parsed.values.minify ?? false,
        ...(parsed.values.out !== undefined ? { outDir: parsed.values.out } : {}),
    };

    for (const file of parsed.positionals) {
        const absolute = isAbsolute(file) ? file : resolvePath(process.cwd(), file);
        try {
            if (flags.outDir !== undefined) {
                const outDirAbsolute = isAbsolute(flags.outDir)
                    ? flags.outDir
                    : resolvePath(process.cwd(), flags.outDir);
                const { outBase } = await writeTripleToOutDir(absolute, outDirAbsolute, flags);
                process.stdout.write(
                    `compiled ${file} → ${outBase}.chart.js (+ manifest + types)\n`,
                );
            } else {
                await compileFile(absolute, buildCompileOptions(flags));
                const sibling = absolute.replace(/\.chart\.ts$/, ".chart.js");
                process.stdout.write(`compiled ${file} → ${sibling} (+ manifest + types)\n`);
            }
        } catch (err) {
            if (err instanceof CompileError) {
                process.stderr.write(formatDiagnostics(err, file));
                process.exitCode = 1;
                continue;
            }
            throw err;
        }
    }
}
