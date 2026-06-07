// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { fileURLToPath } from "node:url";
import { resolve as resolvePath } from "node:path";

import { compileFile } from "@invinite-org/chartlang-compiler";
import { describe, expect, it } from "vitest";

const here = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolvePath(here, "../../..");

const EXAMPLE_SCRIPTS = [
    "examples/scripts/ema-cross.chart.ts",
    "examples/scripts/bollinger-bands.chart.ts",
    "examples/scripts/rsi-divergence-alert.chart.ts",
    "examples/scripts/fib-retracement.chart.ts",
] as const;

describe("Phase-1 example scripts compile end-to-end", () => {
    for (const relPath of EXAMPLE_SCRIPTS) {
        it(`compiles ${relPath}`, async () => {
            const absolute = resolvePath(REPO_ROOT, relPath);
            const compiled = await compileFile(absolute, { apiVersion: 1, write: false });

            expect(compiled.moduleSource).toMatch(/__manifest/);
            expect(compiled.manifest.apiVersion).toBe(1);
            expect(compiled.manifest.kind).toBe("indicator");
            expect(compiled.manifest.capabilities).toContain("indicators");
            expect(compiled.types).toMatch(/export default script/);
        });
    }
});
