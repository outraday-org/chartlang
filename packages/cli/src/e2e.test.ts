// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

import { compileFile } from "@invinite-org/chartlang-compiler";
import { describe, expect, it } from "vitest";

const here = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolvePath(here, "../../..");

const EXAMPLE_SCRIPTS = [
    "examples/scripts/ema-cross.chart.ts",
    "examples/scripts/bollinger-bands.chart.ts",
    "examples/scripts/rsi-divergence-alert.chart.ts",
    "examples/scripts/fib-retracement.chart.ts",
    "examples/scripts/session-high-alert.chart.ts",
    "examples/scripts/daily-rsi-divergence.chart.ts",
    "examples/scripts/mintick-snapped-entry.chart.ts",
] as const;

describe("example scripts compile end-to-end", () => {
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

    it("extracts Phase-4 input and timeframe manifest fields", async () => {
        const daily = await compileFile(
            resolvePath(REPO_ROOT, "examples/scripts/daily-rsi-divergence.chart.ts"),
            { apiVersion: 1, write: false },
        );
        expect(Object.keys(daily.manifest.inputs).sort()).toEqual(["length", "tf"]);
        expect(daily.manifest.userPickableInterval).toBe(true);
        expect(daily.manifest.requestedIntervals).toEqual([]);

        const session = await compileFile(
            resolvePath(REPO_ROOT, "examples/scripts/session-high-alert.chart.ts"),
            { apiVersion: 1, write: false },
        );
        expect(Object.keys(session.manifest.inputs)).toEqual(["alertOnCross"]);
        expect(session.manifest.userPickableInterval).toBe(false);
    });
});
