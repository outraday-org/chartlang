// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { EMA_CROSS } from "./__fixtures__/scripts";
import { transformAndAnalyse } from "./api";

function printFile(file: ts.SourceFile): string {
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    return printer.printFile(file);
}

describe("transformAndAnalyse", () => {
    it("transforms an EMA-cross script and produces 4 callsite ids", () => {
        const result = transformAndAnalyse(EMA_CROSS, {
            sourcePath: "ema-cross.chart.ts",
        });
        const text = printFile(result.transformed);
        const slots = text.match(/"ema-cross\.chart\.ts:\d+:\d+#0"/g) ?? [];
        expect(slots).toHaveLength(4);
    });

    it("returns capabilities = [alerts, indicators] sorted for the EMA-cross script", () => {
        const result = transformAndAnalyse(EMA_CROSS, {
            sourcePath: "ema-cross.chart.ts",
        });
        expect(result.manifest.capabilities).toEqual(["alerts", "indicators"]);
    });

    it("returns maxLookback = 0 and no error diagnostics for the EMA-cross script", () => {
        const result = transformAndAnalyse(EMA_CROSS, {
            sourcePath: "ema-cross.chart.ts",
        });
        expect(result.manifest.maxLookback).toBe(0);
        const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
        expect(errors).toHaveLength(0);
    });

    it("captures the script name + kind from the default export", () => {
        const result = transformAndAnalyse(EMA_CROSS, {
            sourcePath: "ema-cross.chart.ts",
        });
        expect(result.manifest.name).toBe("EMA cross");
        expect(result.manifest.kind).toBe("indicator");
    });

    it("is deterministic — two runs of the same source yield byte-identical transformed text", () => {
        const a = transformAndAnalyse(EMA_CROSS, {
            sourcePath: "ema-cross.chart.ts",
        });
        const b = transformAndAnalyse(EMA_CROSS, {
            sourcePath: "ema-cross.chart.ts",
        });
        expect(printFile(a.transformed)).toBe(printFile(b.transformed));
    });

    it("bails on structural errors and returns the original source", () => {
        const result = transformAndAnalyse("const x = 1; void x;", {
            sourcePath: "broken.chart.ts",
        });
        expect(result.diagnostics[0]?.code).toBe("missing-default-export");
        expect(printFile(result.transformed)).toBe(printFile(result.transformed));
    });

    it("bails on forbidden-construct errors", () => {
        const result = transformAndAnalyse(
            `
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute: () => { while (false) {} },
});
`,
            { sourcePath: "broken.chart.ts" },
        );
        const codes = result.diagnostics.map((diagnostic) => diagnostic.code);
        expect(codes).toContain("unbounded-loop");
    });

    it("bails on stateful-call-inside-loop errors", () => {
        const result = transformAndAnalyse(
            `
import { defineIndicator, ta } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute: () => { for (let i = 0; i < 3; i++) { ta.ema(close, 20); } },
});
`,
            { sourcePath: "broken.chart.ts" },
        );
        const codes = result.diagnostics.map((diagnostic) => diagnostic.code);
        expect(codes).toContain("stateful-call-inside-loop");
    });

    it("flows warnings through (dynamic-series-index) without bailing", () => {
        const source = `
import { defineIndicator } from "@invinite-org/chartlang-core";
declare const bar: import("@invinite-org/chartlang-core").Bar;
export default defineIndicator({
    name: "demo",
    apiVersion: 1,
    compute: () => { const i = 1; const v = bar.close[i]; void v; },
});
`;
        const result = transformAndAnalyse(source, { sourcePath: "demo.chart.ts" });
        const warnings = result.diagnostics.filter(
            (diagnostic) => diagnostic.severity === "warning",
        );
        expect(warnings[0]?.code).toBe("dynamic-series-index");
        expect(result.manifest.seriesCapacities).toEqual({ dynamicFallback: 5000 });
    });
});
