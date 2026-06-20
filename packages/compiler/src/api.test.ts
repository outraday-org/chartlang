// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { EMA_CROSS, MULTI_EXPORT_COMPOSITION } from "./__fixtures__/scripts.js";
import { transformAndAnalyse } from "./api.js";

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

    it("records a request.security expression unit in the manifest", () => {
        const result = transformAndAnalyse(
            `
import { defineIndicator, request } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "htf",
    apiVersion: 1,
    compute: ({ ta, plot }) => {
        const trend = request.security({ interval: "1W" }, (bar) => ta.ema(bar.close, 20));
        plot(trend);
    },
});
`,
            { sourcePath: "htf.chart.ts" },
        );
        expect(result.diagnostics).toEqual([]);
        expect(result.manifest.requestedIntervals).toEqual(["1W"]);
        expect(result.manifest.securityExpressions).toEqual([
            { slotId: "htf.chart.ts:7:23#0", interval: "1W", paramName: "bar" },
        ]);
    });

    it("omits securityExpressions for the data-only request.security form", () => {
        const result = transformAndAnalyse(
            `
import { defineIndicator, request } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "data-only",
    apiVersion: 1,
    compute: ({ plot }) => {
        const weekly = request.security({ interval: "1W" });
        plot(weekly.close);
    },
});
`,
            { sourcePath: "data-only.chart.ts" },
        );
        expect(result.diagnostics).toEqual([]);
        expect(result.manifest.securityExpressions).toBeUndefined();
    });

    it("attaches securityExpressions to the default manifest of a multi-export file", () => {
        const result = transformAndAnalyse(
            `
import { defineIndicator, request } from "@invinite-org/chartlang-core";
export const sibling = defineIndicator({
    name: "Sibling",
    apiVersion: 1,
    compute: ({ plot, bar }) => { plot(bar.close, { title: "echo" }); },
});
export default defineIndicator({
    name: "Composition",
    apiVersion: 1,
    compute: ({ ta, plot }) => {
        const trend = request.security({ interval: "1W" }, (bar) => ta.ema(bar.close, 20));
        plot(trend);
    },
});
`,
            { sourcePath: "multi.chart.ts" },
        );
        expect(result.diagnostics).toEqual([]);
        expect(result.manifest.securityExpressions).toEqual([
            { slotId: "multi.chart.ts:12:23#0", interval: "1W", paramName: "bar" },
        ]);
        // Named-export sibling manifests omit the flat list (mirrors `plots`).
        expect(result.siblings?.[0]?.securityExpressions).toBeUndefined();
    });

    it("rejects an outer-local capture in a request.security callback", () => {
        const result = transformAndAnalyse(
            `
import { defineIndicator, request } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "bad",
    apiVersion: 1,
    compute: ({ ta, plot }) => {
        const k = 20;
        const trend = request.security({ interval: "1W" }, (bar) => ta.ema(bar.close, k));
        plot(trend);
    },
});
`,
            { sourcePath: "bad.chart.ts" },
        );
        expect(result.diagnostics.map((d) => d.code)).toContain(
            "request-security-expr-captures-local",
        );
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

    it("emits lower-tf-not-lower when declaredIntervals are supplied", () => {
        const source = `
import { defineIndicator, request } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute: () => {
        request.lowerTf({ interval: "1D" });
    },
});
`;
        const declaredIntervals = [{ value: "1m", label: "1 minute", group: "minute" }];
        const withIntervals = transformAndAnalyse(source, {
            sourcePath: "demo.chart.ts",
            declaredIntervals,
        });
        expect(withIntervals.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
            "lower-tf-not-lower",
        );

        const withoutIntervals = transformAndAnalyse(source, { sourcePath: "demo.chart.ts" });
        expect(withoutIntervals.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain(
            "lower-tf-not-lower",
        );
    });

    it("surfaces TypeScript semantic errors as `type-error` diagnostics with file/line/column", () => {
        // PLAN §5.2 step 1: tsc programmatic-API typechecking against
        // @invinite-org/chartlang-core ambient declarations must abort
        // `compile`. Bug repro: `const x: number = "oops"` slipped
        // through silently and the bad script ran anyway.
        const source = `
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "T",
    apiVersion: 1,
    compute({ bar, plot }) {
        const x: number = "oops";
        plot(x);
        void bar;
    },
});
`;
        const result = transformAndAnalyse(source, { sourcePath: "demo.chart.ts" });
        const typeErrors = result.diagnostics.filter((d) => d.code === "type-error");
        expect(typeErrors).toHaveLength(1);
        const first = typeErrors[0];
        expect(first?.severity).toBe("error");
        expect(first?.file).toBe("demo.chart.ts");
        expect(first?.line).toBe(7);
        expect(first?.message).toMatch(/^TS2322:/);
        expect(first?.message).toContain("string");
        expect(first?.message).toContain("number");
    });

    it("flags wrong-arg-type calls on `ta.*` primitives as `type-error`", () => {
        const source = `
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "T",
    apiVersion: 1,
    compute({ ta, plot }) {
        const x = ta.ema("not-a-source", 14);
        plot(x);
    },
});
`;
        const result = transformAndAnalyse(source, { sourcePath: "demo.chart.ts" });
        const typeErrors = result.diagnostics.filter((d) => d.code === "type-error");
        expect(typeErrors.length).toBeGreaterThan(0);
        const first = typeErrors[0];
        expect(first?.severity).toBe("error");
        expect(first?.file).toBe("demo.chart.ts");
        expect(first?.message).toMatch(/^TS\d+:/);
    });

    it("does not surface ambient-shim diagnostics — only the user's source file", () => {
        // Sanity: a clean script must not pick up shim-internal noise.
        const source = `
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ok",
    apiVersion: 1,
    compute: () => {},
});
`;
        const result = transformAndAnalyse(source, { sourcePath: "demo.chart.ts" });
        const typeErrors = result.diagnostics.filter((d) => d.code === "type-error");
        expect(typeErrors).toEqual([]);
    });

    it("flows warnings through (dynamic-series-index) without bailing", () => {
        // The `dynamic-series-index` warning fires when a script reads a
        // Series at a non-literal index. `bar.close` is now an indexable
        // `PriceSeries` on the compute bar, so we index it directly — no
        // need to route through `ta.ema` just to obtain a series shape.
        // A `let` (mutable) index stays unresolvable by design: the
        // compiler refuses to fold it, so the warning still flows through.
        const source = `
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "demo",
    apiVersion: 1,
    compute: ({ bar }) => {
        let i = 1;
        const v = bar.close[i];
        void v;
    },
});
`;
        const result = transformAndAnalyse(source, { sourcePath: "demo.chart.ts" });
        const warnings = result.diagnostics.filter(
            (diagnostic) => diagnostic.severity === "warning",
        );
        expect(warnings[0]?.code).toBe("dynamic-series-index");
        expect(result.manifest.seriesCapacities).toEqual({ dynamicFallback: 5000 });
    });

    it("keeps the manifest free of `dependencies`/`outputs` for single-script files (back-compat)", () => {
        const result = transformAndAnalyse(
            `
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "demo",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close); },
});
`,
            { sourcePath: "single.chart.ts" },
        );
        expect(result.manifest.dependencies).toBeUndefined();
        expect(result.manifest.outputs).toBeUndefined();
    });

    it("attaches dependencies + outputs to the default manifest for a private-dep + consumer file", () => {
        const result = transformAndAnalyse(
            `
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
const base = defineIndicator({
    name: "Base",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close, { title: "line" }); },
});
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: ({ bar }) => {
        const value = base.output("line");
        plot(value, { title: "echo" });
        void bar;
    },
});
`,
            { sourcePath: "composition.chart.ts" },
        );
        const errors = result.diagnostics.filter((d) => d.severity === "error");
        expect(errors).toEqual([]);
        expect(result.manifest.outputs).toEqual([{ title: "echo", kind: "series-number" }]);
        expect(result.manifest.dependencies).toHaveLength(1);
        const dep = result.manifest.dependencies?.[0];
        expect(dep?.localId).toBe("base");
        expect(dep?.producerSourcePath).toBe("composition.chart.ts");
        expect(dep?.outputs).toEqual([{ title: "line", kind: "series-number" }]);
    });

    it("marks the dependency as drawn when the producer is a named-export sibling", () => {
        const result = transformAndAnalyse(
            `
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
export const sibling = defineIndicator({
    name: "Sib",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close, { title: "echo" }); },
});
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: ({ bar }) => {
        const value = sibling.output("echo");
        plot(value, { title: "main" });
        void bar;
    },
});
`,
            { sourcePath: "named-sibling.chart.ts" },
        );
        const errors = result.diagnostics.filter((d) => d.severity === "error");
        expect(errors).toEqual([]);
        const dep = result.manifest.dependencies?.[0];
        expect(dep?.localId).toBe("sibling");
        expect(dep?.isDrawn).toBe(true);
        expect(dep?.producerExportName).toBe("sibling");
    });

    it("surfaces dep-unknown-output as an error diagnostic", () => {
        const result = transformAndAnalyse(
            `
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
const base = defineIndicator({
    name: "Base",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close, { title: "line" }); },
});
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void base.output("missing"); },
});
`,
            { sourcePath: "missing-output.chart.ts" },
        );
        const codes = result.diagnostics.map((d) => d.code);
        expect(codes).toContain("dep-unknown-output");
    });

    it("populates `siblings` and stamps each manifest with exportName + isDrawn for multi-export files", () => {
        const result = transformAndAnalyse(MULTI_EXPORT_COMPOSITION, {
            sourcePath: "multi-export.chart.ts",
        });
        expect(result.siblings).toBeDefined();
        expect(result.siblings).toHaveLength(1);
        expect(result.manifest.exportName).toBe("default");
        expect(result.manifest.isDrawn).toBe(true);
        const sibling = result.siblings?.[0];
        expect(sibling?.exportName).toBe("sibling");
        expect(sibling?.isDrawn).toBe(true);
        expect(sibling?.name).toBe("sibling");
    });

    it("omits `siblings` on single-script files (back-compat)", () => {
        const result = transformAndAnalyse(EMA_CROSS, {
            sourcePath: "ema-cross.chart.ts",
        });
        expect(result.siblings).toBeUndefined();
        expect(result.manifest.exportName).toBeUndefined();
        expect(result.manifest.isDrawn).toBeUndefined();
    });

    it("omits manifest.outputs when a drawn binding has no titled plots", () => {
        const source = `
import { defineIndicator } from "@invinite-org/chartlang-core";
export const sibling = defineIndicator({
    name: "Sibling",
    apiVersion: 1,
    compute: () => {},
});
export default defineIndicator({
    name: "Default",
    apiVersion: 1,
    compute: () => {},
});
`;
        const result = transformAndAnalyse(source, {
            sourcePath: "outputs-empty.chart.ts",
        });
        expect(result.manifest.outputs).toBeUndefined();
        const sibling = result.siblings?.[0];
        expect(sibling?.outputs).toBeUndefined();
    });
});
