// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { isAbsolute, relative, resolve as resolvePath } from "node:path";
import { parseArgs } from "node:util";

import { GenDocsError, findRepoRoot, runGenDocs } from "./genDocs.js";
import { printHelp } from "./help.js";

const DEFAULT_SOURCE = "packages/runtime/src/ta";
const DEFAULT_OUT = "docs/primitives/ta";

function resolveDir(raw: string, repoRoot: string): string {
    if (isAbsolute(raw)) return raw;
    return resolvePath(repoRoot, raw);
}

/**
 * Execute the `chartlang docs [--source <dir>] [--out <dir>]`
 * subcommand. Walks every `ta.*` primitive source under `--source`
 * (default `packages/runtime/src/ta`), parses each export's JSDoc via
 * the TypeScript compiler API, and writes one `docs/primitives/ta/<id>.md`
 * per primitive into `--out` (default `docs/primitives/ta`). Pages
 * open with the `<!-- AUTO-GENERATED -->` sentinel so the `docs:gate`
 * byte-equality check is robust.
 *
 * On a {@link GenDocsError} (missing required JSDoc tag), the runner
 * writes the structured error to stderr and sets `process.exitCode = 1`.
 * Other errors propagate for the `bin.ts` outer handler.
 *
 * @since 0.2
 * @experimental
 * @example
 *     // import { runDocsCommand } from "@invinite-org/chartlang-cli";
 *     // await runDocsCommand(["--out", "docs/primitives/ta"]);
 */
export async function runDocsCommand(args: ReadonlyArray<string>): Promise<void> {
    const parsed = parseArgs({
        args: args.slice(),
        options: {
            source: { type: "string" },
            out: { type: "string" },
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
    const sourceDir = resolveDir(parsed.values.source ?? DEFAULT_SOURCE, repoRoot);
    const outDir = resolveDir(parsed.values.out ?? DEFAULT_OUT, repoRoot);

    try {
        const { written } = await runGenDocs({ sourceDir, outDir, repoRoot });
        for (const path of written) {
            const rel = relative(repoRoot, path);
            process.stdout.write(`wrote ${rel}\n`);
        }
        process.stdout.write(`generated ${written.length} primitive page(s)\n`);
    } catch (err) {
        if (err instanceof GenDocsError) {
            process.stderr.write(`error: ${err.message}\n`);
            process.exitCode = 1;
            return;
        }
        throw err;
    }
}
