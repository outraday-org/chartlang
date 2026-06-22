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
    "examples/scripts/base-trend.chart.ts",
    "examples/scripts/trend-confirmation.chart.ts",
    "examples/scripts/htf-trend-filter.chart.ts",
    "examples/scripts/sma-offset.chart.ts",
    "examples/scripts/pivot-high-ray.chart.ts",
    "examples/scripts/forecast-line.chart.ts",
    "examples/scripts/fill-between-band.chart.ts",
    "examples/scripts/anchored-line.chart.ts",
    "examples/scripts/up-streak.chart.ts",
    "examples/scripts/rolling-window-mean.chart.ts",
    "examples/scripts/symbol-ratio.chart.ts",
    "examples/scripts/z-layering.chart.ts",
] as const;

const COMPILE_TIMEOUT_MS = 15_000;

describe("example scripts compile end-to-end", () => {
    for (const relPath of EXAMPLE_SCRIPTS) {
        it(
            `compiles ${relPath}`,
            async () => {
                const absolute = resolvePath(REPO_ROOT, relPath);
                const compiled = await compileFile(absolute, { apiVersion: 1, write: false });

                expect(compiled.moduleSource).toMatch(/__manifest/);
                expect(compiled.manifest.apiVersion).toBe(1);
                expect(compiled.manifest.kind).toBe("indicator");
                expect(compiled.manifest.capabilities).toContain("indicators");
                expect(compiled.types).toMatch(/export default script/);
            },
            COMPILE_TIMEOUT_MS,
        );
    }

    it(
        "extracts Phase-4 input and timeframe manifest fields",
        async () => {
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
        },
        COMPILE_TIMEOUT_MS,
    );

    it(
        "records the request.security expression unit for htf-trend-filter.chart.ts",
        async () => {
            const htf = await compileFile(
                resolvePath(REPO_ROOT, "examples/scripts/htf-trend-filter.chart.ts"),
                { apiVersion: 1, write: false },
            );
            // The callback form records one security-expression unit (the EMA
            // runs on the weekly clock) plus the requested interval.
            expect(htf.manifest.requestedIntervals).toEqual(["1W"]);
            expect(htf.manifest.securityExpressions).toHaveLength(1);
            const [expr] = htf.manifest.securityExpressions ?? [];
            expect(expr?.interval).toBe("1W");
            expect(expr?.paramName).toBe("bar");
            expect(expr?.slotId).toMatch(/htf-trend-filter\.chart\.ts:\d+:\d+#0$/);
        },
        COMPILE_TIMEOUT_MS,
    );

    it(
        "emits a single-object sidecar for base-trend.chart.ts (single drawn indicator)",
        async () => {
            const baseTrend = await compileFile(
                resolvePath(REPO_ROOT, "examples/scripts/base-trend.chart.ts"),
                { apiVersion: 1, write: false },
            );
            // Single-script files keep the byte-identical single-object
            // sidecar form; the array form only appears when multiple
            // drawn indicators co-exist in one file.
            expect(baseTrend.moduleSource).toMatch(/__manifest\s*=\s*\{/);
            expect(baseTrend.moduleSource).not.toMatch(/__manifest\s*=\s*\[/);
            expect(baseTrend.manifest.dependencies).toBeUndefined();
        },
        COMPILE_TIMEOUT_MS,
    );

    it(
        "emits an array sidecar + __dependencies for trend-confirmation.chart.ts (multi-export composition)",
        async () => {
            const confirmation = await compileFile(
                resolvePath(REPO_ROOT, "examples/scripts/trend-confirmation.chart.ts"),
                { apiVersion: 1, write: false },
            );
            // Multi-export files carry the array-form __manifest plus
            // the __dependencies export the host mounts (Task 6).
            expect(confirmation.moduleSource).toMatch(/__manifest\s*=\s*\[/);
            expect(confirmation.moduleSource).toMatch(/__dependencies\s*=\s*\[/);
            expect(confirmation.manifest.dependencies).toBeDefined();
            expect(confirmation.manifest.dependencies?.some((d) => d.localId === "fastTrend")).toBe(
                true,
            );
        },
        COMPILE_TIMEOUT_MS,
    );
});
