// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// The monorepo's `tsconfig.base.json`, BAKED verbatim. The cloned starter's
// `tsconfig.json` `extends` `"../../tsconfig.base.json"` — a monorepo-relative
// path that does NOT exist in a standalone clone, so both `vite build`
// ("Tsconfig not found") and `tsc --noEmit` (TS5083) die. The installer writes
// this content as `<targetDir>/tsconfig.base.json` and repoints the cloned
// `tsconfig.json` `extends` to `"./tsconfig.base.json"`. The parity test in
// `starterTsconfig.test.ts` deep-equals this against the real repo-root file so
// the bake can never silently drift from the monorepo source.

const TSCONFIG_BASE_FILE = "tsconfig.base.json";
const TSCONFIG_FILE = "tsconfig.json";
const STANDALONE_EXTENDS = "./tsconfig.base.json";

/**
 * The monorepo `tsconfig.base.json` compiler options, baked verbatim so the
 * standalone clone has a self-contained base to `extends`. Kept in sync with
 * the repo-root file by the parity test.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { STANDALONE_TSCONFIG_BASE } from "@invinite-org/create-chartlang";
 *     void STANDALONE_TSCONFIG_BASE.compilerOptions.strict;
 */
export const STANDALONE_TSCONFIG_BASE = {
    compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        strict: true,
        noImplicitAny: true,
        noImplicitOverride: true,
        noImplicitReturns: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
        exactOptionalPropertyTypes: true,
        isolatedModules: true,
        esModuleInterop: true,
        forceConsistentCasingInFileNames: true,
        skipLibCheck: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true,
        inlineSources: true,
        verbatimModuleSyntax: true,
        resolveJsonModule: true,
        noEmit: false,
    },
} as const;

type TsconfigFile = {
    extends?: string;
    [key: string]: unknown;
};

/**
 * Make the cloned starter's TypeScript config self-contained: write
 * `<dir>/tsconfig.base.json` from {@link STANDALONE_TSCONFIG_BASE}, then repoint
 * the cloned `<dir>/tsconfig.json` `extends` to the sibling
 * `"./tsconfig.base.json"`. If the clone has no `tsconfig.json`, the base is
 * still written and the repoint is skipped (so the vendored adapter's own
 * `extends: "../../tsconfig.base.json"` still resolves to the clone-root base).
 *
 * @since 0.1
 * @stable
 * @example
 *     import { writeStandaloneTsconfig } from "@invinite-org/create-chartlang";
 *     await writeStandaloneTsconfig("/tmp/my-app");
 */
export async function writeStandaloneTsconfig(dir: string): Promise<void> {
    const baseText = `${JSON.stringify(STANDALONE_TSCONFIG_BASE, null, 4)}\n`;
    await writeFile(join(dir, TSCONFIG_BASE_FILE), baseText, "utf8");

    let source: string;
    try {
        source = await readFile(join(dir, TSCONFIG_FILE), "utf8");
    } catch {
        // No committed `tsconfig.json` in the clone — base is enough.
        return;
    }
    const parsed = JSON.parse(source) as TsconfigFile;
    parsed.extends = STANDALONE_EXTENDS;
    await writeFile(join(dir, TSCONFIG_FILE), `${JSON.stringify(parsed, null, 4)}\n`, "utf8");
}
