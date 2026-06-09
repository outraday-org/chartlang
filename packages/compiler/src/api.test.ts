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

    it("captures static defineIndicator override fields in the manifest", () => {
        const result = transformAndAnalyse(
            `
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "demo",
    apiVersion: 1,
    maxBarsBack: 100,
    format: "compact",
    precision: 3,
    scale: "new",
    requiresIntervals: ["1H", "1D"],
    shortName: "DM",
    compute: () => {},
});
`,
            { sourcePath: "demo.chart.ts" },
        );
        expect(result.manifest.maxBarsBack).toBe(100);
        expect(result.manifest.format).toBe("compact");
        expect(result.manifest.precision).toBe(3);
        expect(result.manifest.scale).toBe("new");
        expect(result.manifest.requiresIntervals).toEqual(["1D", "1H"]);
        expect(result.manifest.requestedIntervals).toEqual(["1D", "1H"]);
        expect(result.manifest.shortName).toBe("DM");
    });

    it("unions request.security intervals with defineIndicator requiresIntervals", () => {
        const result = transformAndAnalyse(
            `
import { defineIndicator, request } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "demo",
    apiVersion: 1,
    requiresIntervals: ["1D"],
    compute: () => {
        request.security({ interval: "5m" });
    },
});
`,
            { sourcePath: "request-union.chart.ts" },
        );
        expect(result.diagnostics).toEqual([]);
        expect(result.manifest.requiresIntervals).toEqual(["1D"]);
        expect(result.manifest.requestedIntervals).toEqual(["1D", "5m"]);
    });

    it("extracts define inputs into the manifest", () => {
        const result = transformAndAnalyse(
            `
import { defineIndicator, input } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "with inputs",
    apiVersion: 1,
    inputs: {
        len: input.int(14, { title: "Length" }),
        tf: input.interval("chart"),
    },
    compute: () => {},
});
`,
            { sourcePath: "inputs.chart.ts" },
        );
        expect(result.diagnostics).toEqual([]);
        expect(result.manifest.inputs).toEqual({
            len: { kind: "int", defaultValue: 14, title: "Length" },
            tf: { kind: "interval", defaultValue: "chart" },
        });
        expect(result.manifest.userPickableInterval).toBe(true);
    });

    it("extracts defineAlertCondition descriptors into the manifest", () => {
        const result = transformAndAnalyse(
            `
import { defineAlertCondition } from "@invinite-org/chartlang-core";
export default defineAlertCondition({
    name: "alerts",
    apiVersion: 1,
    conditions: {
        up: { title: "Up", description: "Close crossed up", defaultMessage: "{{ticker}} up" },
    },
    compute: () => {},
});
`,
            { sourcePath: "alert-conditions.chart.ts" },
        );
        expect(result.diagnostics).toEqual([]);
        expect(result.manifest.alertConditions).toEqual([
            {
                id: "up",
                title: "Up",
                description: "Close crossed up",
                defaultMessage: "{{ticker}} up",
            },
        ]);
    });

    it("flows input extraction errors through diagnostics", () => {
        const result = transformAndAnalyse(
            `
import { defineIndicator, input } from "@invinite-org/chartlang-core";
const len = 14;
export default defineIndicator({
    name: "bad inputs",
    apiVersion: 1,
    inputs: { len: input.int(len) },
    compute: () => {},
});
`,
            { sourcePath: "bad-inputs.chart.ts" },
        );
        expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
            "input-default-not-literal",
        );
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
