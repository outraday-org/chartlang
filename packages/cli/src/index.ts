// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { runCompile } from "./commands/compile.js";
import { runDocsCommand } from "./commands/docs.js";
import { runHelp } from "./commands/help.js";
import { runScaffoldAdapter } from "./commands/scaffoldAdapter.js";

export { runCompile } from "./commands/compile.js";
export { runDocsCommand } from "./commands/docs.js";
export {
    generateDrawingDocsPage,
    parseDrawingSource,
    runGenDrawingDocs,
} from "./commands/extractDrawingPages.js";
export type {
    DrawingDocInput,
    RunGenDrawingDocsOptions,
} from "./commands/extractDrawingPages.js";
export {
    AUTO_GENERATED_HEADER,
    GenDocsError,
    findRepoRoot,
    generateDocsPage,
    parsePrimitiveSource,
    runGenDocs,
} from "./commands/genDocs.js";
export type { PrimitiveDocInput, RunGenDocsOptions } from "./commands/genDocs.js";
export { printHelp, runHelp } from "./commands/help.js";
export { runScaffoldAdapter } from "./commands/scaffoldAdapter.js";

/**
 * Dispatch a `chartlang` CLI invocation. Reads the first positional as
 * the subcommand and forwards the remaining arguments. Unknown commands
 * set `process.exitCode = 1` and print the help text.
 *
 * Phase 1 ships two subcommands: `compile` (compiles `.chart.ts`
 * sources via `@invinite-org/chartlang-compiler`) and
 * `scaffold-adapter` (generates a starter adapter package outside the
 * OSS repo). Phase 2 adds `docs` — the auto-generator that writes
 * `docs/primitives/ta/<id>.md` per primitive from the runtime JSDoc.
 * Later phases add `lint` / `bench` via the same dispatcher seam.
 *
 * @since 0.1
 * @example
 *     import { runCli } from "@invinite-org/chartlang-cli";
 *     await runCli(["compile", "./demo.chart.ts"]);
 *     await runCli(["docs", "--out", "docs/primitives/ta"]);
 *     await runCli(["--help"]);
 */
export async function runCli(argv: ReadonlyArray<string>): Promise<void> {
    const [command, ...rest] = argv;
    switch (command) {
        case "compile":
            await runCompile(rest);
            return;
        case "scaffold-adapter":
            await runScaffoldAdapter(rest);
            return;
        case "docs":
            await runDocsCommand(rest);
            return;
        case "--help":
        case "-h":
        case undefined:
            runHelp();
            return;
        default:
            process.stderr.write(`Unknown command: ${command}\n`);
            process.exitCode = 1;
            runHelp();
            return;
    }
}
