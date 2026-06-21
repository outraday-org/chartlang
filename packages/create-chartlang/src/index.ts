#!/usr/bin/env node
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { spawn } from "node:child_process";

import { downloadTemplate } from "giget";

import { defaultDeps, runCreateChartlang } from "./createApp.js";

export {
    bundleChartlangVersions,
    defaultDeps,
    renderLibraryChoices,
    repointVendoredPackageJson,
    resolveAdapter,
    runCreateChartlang,
    STARTER_SOURCE_BASE,
} from "./createApp.js";
export type {
    CloneRequest,
    CloneStarter,
    CreateChartlangDeps,
    Prompter,
    ResolvedAdapter,
} from "./createApp.js";
export { CHARTLANG_VERSIONS, STARTER_CLONE_REF } from "./chartlangVersions.js";
export { rewriteStarterPackageJson } from "./rewritePackageJson.js";
export type { RewriteOpts } from "./rewritePackageJson.js";
export { isSeamId, SEAM_IDS, seamTemplateFor } from "./seamTemplates.js";
export type { SeamId } from "./seamTemplates.js";
export { STANDALONE_TSCONFIG_BASE, writeStandaloneTsconfig } from "./starterTsconfig.js";

await runCreateChartlang(
    process.argv.slice(2),
    defaultDeps({
        cloneStarter: async ({ source, dir }) => {
            await downloadTemplate(source, { dir, forceClean: true });
        },
        runInstall: (pm, dir) =>
            new Promise<void>((resolve, reject) => {
                const child = spawn(pm, ["install"], { cwd: dir, stdio: "inherit", shell: true });
                child.on("error", reject);
                child.on("exit", (code) =>
                    code === 0 ? resolve() : reject(new Error(`${pm} install exited with ${code}`)),
                );
            }),
    }),
);
