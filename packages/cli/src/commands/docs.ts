// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { isAbsolute, relative, resolve as resolvePath } from "node:path";
import { parseArgs } from "node:util";

import { runGenDrawingDocs } from "./extractDrawingPages.js";
import { GenDocsError, findRepoRoot, runGenDocs } from "./genDocs.js";
import { printHelp } from "./help.js";

const DEFAULT_TA_SOURCE = "packages/runtime/src/ta";
const DEFAULT_TA_OUT = "docs/primitives/ta";
const DEFAULT_DRAW_SOURCE = "packages/runtime/src/emit/draw";
const DEFAULT_DRAW_OUT = "docs/primitives/draw";

function resolveDir(raw: string, repoRoot: string): string {
    if (isAbsolute(raw)) return raw;
    return resolvePath(repoRoot, raw);
}

/**
 * Execute the `chartlang docs` subcommand. Walks every `ta.*`
 * primitive source under `--source` / `--ta-source` (default
 * `packages/runtime/src/ta`) and every `draw.<camelKind>` runtime
 * source under `--draw-source`
 * (default `packages/runtime/src/emit/draw`), parses each export's
 * JSDoc via the TypeScript compiler API, and writes one
 * `docs/primitives/ta/<id>.md` per `ta.*` primitive into `--out` /
 * `--ta-out` (default `docs/primitives/ta`) plus one
 * `docs/primitives/draw/<kebab-kind>.md` per `draw.*` kind into
 * `--draw-out` (default `docs/primitives/draw`). Pages open with the
 * `<!-- AUTO-GENERATED -->` sentinel so the `docs:gate` byte-equality
 * check is robust.
 *
 * On a {@link GenDocsError} (missing required JSDoc tag, bucket
 * mismatch, etc.), the runner writes the structured error to stderr
 * and sets `process.exitCode = 1`. Other errors propagate for the
 * `bin.ts` outer handler.
 *
 * Backwards compat: `--source` / `--out` continue to control the
 * `ta.*` walk (the only one Phase 2 shipped).
 *
 * @since 0.2
 * @experimental
 * @example
 *     // import { runDocsCommand } from "@invinite-org/chartlang-cli";
 *     // await runDocsCommand([]);
 */
export async function runDocsCommand(args: ReadonlyArray<string>): Promise<void> {
    const parsed = parseArgs({
        args: args.slice(),
        options: {
            source: { type: "string" },
            out: { type: "string" },
            "ta-source": { type: "string" },
            "ta-out": { type: "string" },
            "draw-source": { type: "string" },
            "draw-out": { type: "string" },
            help: { type: "boolean", short: "h" },
        },
        allowPositionals: false,
        strict: true,
    });

    if (parsed.values.help) {
        printHelp();
        return;
    }

    const repoRoot = await findRepoRoot(process.cwd());
    const taSourceRaw = parsed.values["ta-source"] ?? parsed.values.source ?? DEFAULT_TA_SOURCE;
    const taOutRaw = parsed.values["ta-out"] ?? parsed.values.out ?? DEFAULT_TA_OUT;
    const drawSourceRaw = parsed.values["draw-source"] ?? DEFAULT_DRAW_SOURCE;
    const drawOutRaw = parsed.values["draw-out"] ?? DEFAULT_DRAW_OUT;

    const taSourceDir = resolveDir(taSourceRaw, repoRoot);
    const taOutDir = resolveDir(taOutRaw, repoRoot);
    const drawSourceDir = resolveDir(drawSourceRaw, repoRoot);
    const drawOutDir = resolveDir(drawOutRaw, repoRoot);

    try {
        const taResult = await runGenDocs({
            sourceDir: taSourceDir,
            outDir: taOutDir,
            repoRoot,
        });
        for (const path of taResult.written) {
            const rel = relative(repoRoot, path);
            process.stdout.write(`wrote ${rel}\n`);
        }
        process.stdout.write(`generated ${taResult.written.length} primitive page(s)\n`);

        const drawResult = await runGenDrawingDocs({
            sourceDir: drawSourceDir,
            outDir: drawOutDir,
            repoRoot,
        });
        for (const path of drawResult.written) {
            const rel = relative(repoRoot, path);
            process.stdout.write(`wrote ${rel}\n`);
        }
        process.stdout.write(`generated ${drawResult.written.length} drawing page(s)\n`);
    } catch (err) {
        if (err instanceof GenDocsError) {
            process.stderr.write(`error: ${err.message}\n`);
            process.exitCode = 1;
            return;
        }
        throw err;
    }
}
