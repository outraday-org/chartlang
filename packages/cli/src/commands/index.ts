// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

export { runCompile } from "./compile.js";
export { runDocsCommand } from "./docs.js";
export {
    AUTO_GENERATED_HEADER,
    GenDocsError,
    findRepoRoot,
    generateDocsPage,
    parsePrimitiveSource,
    runGenDocs,
} from "./genDocs.js";
export type { PrimitiveDocInput, RunGenDocsOptions } from "./genDocs.js";
export { printHelp, runHelp } from "./help.js";
export { runScaffoldAdapter } from "./scaffoldAdapter.js";
