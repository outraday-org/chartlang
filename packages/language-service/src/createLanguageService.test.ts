// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { describe, expect, it } from "vitest";

import { createLanguageService } from "./createLanguageService.js";

const capabilities: Capabilities = {
    plots: new Set(["line"]),
    drawings: new Set(),
    alerts: new Set(),
    alertConditions: false,
    logs: false,
    inputs: new Set(["interval"]),
    intervals: [
        { value: "1m", label: "1 minute", group: "minute" },
        { value: "1D", label: "1 day", group: "daily" },
    ],
    multiTimeframe: false,
    subPanes: 0,
    symInfoFields: new Set(),
    maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
    maxLookback: 5000,
    maxTickHz: 10,
};

const script = `
import { defineIndicator, input, plot, request, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Demo",
    apiVersion: 1,
    inputs: { interval: input.interval("1D") },
    compute: ({ bar }) => {
        const ema = ta.ema(bar.close, 20);
        const daily = request.security({ interval: "1W" });
        plot(ema, { style: { kind: "histogram" } });
        void daily;
    },
});
`;

describe("createLanguageService", () => {
    it("maps compiler errors and target capability hints to diagnostics", async () => {
        const service = createLanguageService({ targetCapabilities: capabilities });
        const bad = `
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "Bad",
    apiVersion: 1,
    compute: () => { while (true) break; },
});
`;

        const diagnostics = await service.compileToDiagnostics(bad);

        expect(diagnostics.some((d) => d.code === "unbounded-loop")).toBe(true);
        expect(diagnostics[0]?.range.startLine).toBeGreaterThan(0);
    });

    it("returns no diagnostics for a valid script without target capabilities", async () => {
        const service = createLanguageService();

        await expect(service.compileToDiagnostics(script)).resolves.toEqual([]);
    });

    it("forwards `inMemoryModules` to the local Node compiler", async () => {
        // The forwarded stub is what esbuild resolves the bare import to;
        // a marker inside `defineIndicator` proving it reached the bundler
        // would be invisible here (compileToDiagnostics discards output), so
        // we assert the happy path stays clean when core is served from the
        // forwarded map instead of disk.
        const minimal = `
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({ name: "x", apiVersion: 1, compute: () => {} });
`;
        const service = createLanguageService({
            inMemoryModules: {
                "@invinite-org/chartlang-core": `
export function defineIndicator(o){ return o; }
`,
            },
        });

        await expect(service.compileToDiagnostics(minimal)).resolves.toEqual([]);
    });

    it("forwards `inMemoryChartSources` so a sibling `.chart` import does not error", async () => {
        // Without the forwarded map the diagnostics compile would report
        // `TS2307: Cannot find module './base-trend.chart'`; supplying the
        // sibling source in memory resolves it and keeps diagnostics clean.
        const producer = `import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "p",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) { plot(ta.ema(bar.close, 14), { title: "line" }); },
});`;
        const consumer = `import { defineIndicator, plot } from "@invinite-org/chartlang-core";
import baseTrend from "./base-trend.chart";
export default defineIndicator({
    name: "c",
    apiVersion: 1,
    overlay: true,
    compute({ plot }) { plot(baseTrend.output("line").current, { title: "x" }); },
});`;
        const service = createLanguageService({
            inMemoryChartSources: { "./base-trend.chart": producer },
        });

        await expect(service.compileToDiagnostics(consumer)).resolves.toEqual([]);
    });

    it("maps TypeScript semantic errors to `type-error` diagnostics with correct range", async () => {
        // Regression test for the PLAN §5.2 step 1 gap: a script with a
        // semantic type error must surface a diagnostic the editor's
        // linter can underline (1-based line/column range from the
        // user's source file).
        const service = createLanguageService();
        const bad = `
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
        const diagnostics = await service.compileToDiagnostics(bad);
        const typeErrors = diagnostics.filter((d) => d.code === "type-error");
        expect(typeErrors.length).toBeGreaterThan(0);
        const first = typeErrors[0];
        expect(first?.severity).toBe("error");
        expect(first?.range.startLine).toBe(7);
        expect(first?.range.startColumn).toBeGreaterThan(0);
        expect(first?.message).toContain("TS2322");
        expect(first?.message).toContain("string");
        expect(first?.message).toContain("number");
    });

    it("maps a wrong-arg-type call on `ta.ema` to a `type-error` diagnostic", async () => {
        const service = createLanguageService();
        const bad = `
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
        const diagnostics = await service.compileToDiagnostics(bad);
        const typeErrors = diagnostics.filter((d) => d.code === "type-error");
        expect(typeErrors.length).toBeGreaterThan(0);
        expect(typeErrors[0]?.message).toMatch(/^TS\d+:/);
    });

    it("returns capability hints for unsupported intervals, MTF, and plot kinds", async () => {
        const service = createLanguageService({ targetCapabilities: capabilities });
        const diagnostics = await service.compileToDiagnostics(script);

        expect(diagnostics.map((d) => d.code)).toEqual([
            "unsupported-interval",
            "multi-timeframe-not-supported",
            "unsupported-plot-kind",
        ]);
    });

    it("uses an injected diagnostics compiler before capability hints", async () => {
        const service = createLanguageService({
            targetCapabilities: capabilities,
            compileToDiagnostics: async () => [
                {
                    range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
                    severity: "error",
                    code: "remote-compile",
                    message: "Remote compile failed.",
                },
            ],
        });

        const diagnostics = await service.compileToDiagnostics(script);

        expect(diagnostics.map((d) => d.code)).toEqual([
            "remote-compile",
            "unsupported-interval",
            "multi-timeframe-not-supported",
            "unsupported-plot-kind",
        ]);
    });

    it("skips capability hints for supported or dynamic constructs", async () => {
        const service = createLanguageService({
            targetCapabilities: {
                ...capabilities,
                plots: new Set(["histogram"]),
                multiTimeframe: true,
            },
        });
        const dynamic = `
import { defineIndicator, plot, request } from "@invinite-org/chartlang-core";
const interval = "1D";
const style = "histogram";
const styleObj = { kind: "histogram" };
export default defineIndicator({
    name: "Dynamic",
    apiVersion: 1,
    compute: () => {
        request.security({ interval });
        request.security({ symbol: "AAPL" });
        request.security({ interval });
        request.security({ "interval": "1D" });
        plot(1);
        plot(1, { title: "plain" });
        plot(1, { style: { kind: "histogram" } });
        plot(1, { "style": { "kind": "histogram" } });
        plot(1, { style: { title: "not-kind" } });
        plot(1, { style: {} });
        plot(1, { style: { ...styleObj } });
        plot(1, { style: { kind: style } });
        plot(1, { ["style"]: { kind: "histogram" } });
        plot(1, { style: "line" });
    },
});
`;

        // The fixture intentionally exercises malformed plot/request
        // shapes that the capability-hint pass walks. Those same shapes
        // now also trip the semantic typecheck — assert ONLY that the
        // capability-hint codes are absent, not that the diagnostic
        // array is empty.
        const diagnostics = await service.compileToDiagnostics(dynamic);
        const hints = diagnostics.filter((d) => d.code !== "type-error");
        expect(hints).toEqual([]);
        expect(createLanguageService(undefined).getAvailableIntervals()).toEqual([]);
    });

    it("returns hover docs for registry symbols", () => {
        const service = createLanguageService();
        const offset = script.indexOf("ema(bar") + 1;

        expect(service.getHoverDoc(script, offset)).toMatchObject({
            title: "ta.ema(source, length, opts?)",
            summary: expect.stringContaining("ta"),
        });
        expect(service.getHoverDoc("42", 0)).toBeNull();
        expect(service.getHoverDoc("unknown", 1)).toBeNull();
    });

    it("returns interval completions inside interval string literals", () => {
        const service = createLanguageService({ targetCapabilities: capabilities });
        const offset = script.indexOf('"1W"') + 1;

        expect(service.getCompletions(script, offset)).toEqual([
            {
                label: "1m",
                kind: "enumMember",
                insertText: "1m",
                detail: "1 minute",
                doc: { title: "1m", summary: "Group: minute" },
            },
            {
                label: "1D",
                kind: "enumMember",
                insertText: "1D",
                detail: "1 day",
                doc: { title: "1D", summary: "Group: daily" },
            },
        ]);
    });

    it("returns registry and local identifier completions outside interval literals", () => {
        const service = createLanguageService();
        const labels = service
            .getCompletions(script, script.indexOf("const ema"))
            .map((i) => i.label);

        expect(labels).toContain("ta.ema");
        expect(labels).toContain("ema");
    });

    it("returns signature help for request.security", () => {
        const service = createLanguageService();
        const offset = script.lastIndexOf("interval:") + 1;

        expect(service.getSignatureHelp(script, offset)).toMatchObject({
            label: expect.stringContaining("request.security"),
            activeParameter: 0,
        });
        expect(service.getSignatureHelp("ta.ema(bar.close, 20)", 17)).toMatchObject({
            label: "ta.ema(source, length, opts?)",
            activeParameter: 1,
        });
        expect(service.getSignatureHelp("42", 0)).toBeNull();
        expect(service.getSignatureHelp("ta.ema()", 100)).toBeNull();
        expect(service.getSignatureHelp("local()", 2)).toBeNull();
        expect(service.getSignatureHelp("ta", 1)).toBeNull();
    });

    it("returns definitions into core declarations and target intervals", () => {
        const service = createLanguageService({ targetCapabilities: capabilities });
        const offset = script.indexOf("ta.ema") + 4;

        expect(service.getDefinition(script, offset)).toEqual({
            file: "packages/core/dist/index.d.ts",
            line: 1,
            column: 1,
        });
        expect(service.getDefinition("42", 0)).toBeNull();
        expect(service.getDefinition("unknown", 1)).toBeNull();
        expect(service.getAvailableIntervals()).toBe(capabilities.intervals);
        expect(createLanguageService().getAvailableIntervals()).toEqual([]);
    });
});

describe("createLanguageService — indicator-composition (Task 7)", () => {
    const composition = `
import { defineIndicator, input, plot } from "@invinite-org/chartlang-core";

const baseTrend = defineIndicator({
    name: "Base",
    apiVersion: 1,
    inputs: { length: input.int(20) },
    compute: ({ bar }) => {
        plot(bar.close, { title: "line" });
    },
});

export const fast = baseTrend.withInputs({ length: 10 });
export default defineIndicator({
    name: "Consumer",
    apiVersion: 1,
    compute: ({ bar }) => {
        const value = fast.output("line");
        void value; void bar;
    },
});
`;

    it("hovers over .output(...) with the producer's titled outputs", () => {
        const service = createLanguageService();
        const offset = composition.indexOf('fast.output("line")') + 'fast.output("'.length;

        const hover = service.getHoverDoc(composition, offset);
        expect(hover?.title).toContain("fast.output");
        expect(hover?.summary).toContain('"line"');
    });

    it("hovers over .withInputs({...}) with the producer's input schema", () => {
        const service = createLanguageService();
        const offset = composition.indexOf("withInputs({ length: 10") + 13;

        const hover = service.getHoverDoc(composition, offset);
        expect(hover?.title).toContain("baseTrend.withInputs");
        expect(hover?.summary).toContain("length: int (default: 20)");
    });

    it("returns null hover when the offset is not on a known FQN or dep accessor", () => {
        const service = createLanguageService();
        expect(service.getHoverDoc("const x = 1;", 4)).toBeNull();
    });

    it('returns completions for output titles inside <binding>.output("|")', () => {
        const service = createLanguageService();
        const offset = composition.indexOf('fast.output("line")') + 'fast.output("'.length;

        const completions = service.getCompletions(composition, offset);
        expect(completions.map((c) => c.label)).toEqual(["line"]);
    });

    it("returns completions for override keys inside <binding>.withInputs({ |})", () => {
        const service = createLanguageService();
        const offset = composition.indexOf("withInputs({ length: 10") + 13;

        const completions = service.getCompletions(composition, offset);
        expect(completions.map((c) => c.label)).toEqual(["length"]);
    });

    it("surfaces dep-unknown-output as a compile diagnostic", async () => {
        const service = createLanguageService();
        const bad = `
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
const producer = defineIndicator({
    name: "P",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close, { title: "real" }); },
});
export default defineIndicator({
    name: "C",
    apiVersion: 1,
    compute: () => { producer.output("missing"); },
});
`;
        const diagnostics = await service.compileToDiagnostics(bad);
        expect(diagnostics.some((d) => d.code === "dep-unknown-output")).toBe(true);
    });

    it("surfaces dep-invalid-input-override as a compile diagnostic", async () => {
        const service = createLanguageService();
        const bad = `
import { defineIndicator, input } from "@invinite-org/chartlang-core";
const producer = defineIndicator({
    name: "P",
    apiVersion: 1,
    inputs: { length: input.int(20) },
    compute: () => undefined,
});
export const tuned = producer.withInputs({ unknown: 1 });
export default defineIndicator({
    name: "C",
    apiVersion: 1,
    compute: () => undefined,
});
`;
        const diagnostics = await service.compileToDiagnostics(bad);
        expect(diagnostics.some((d) => d.code === "dep-invalid-input-override")).toBe(true);
    });

    it("surfaces dep-output-not-titled as a compile diagnostic", async () => {
        const service = createLanguageService();
        const bad = `
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
const producer = defineIndicator({
    name: "P",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close); },
});
export default defineIndicator({
    name: "C",
    apiVersion: 1,
    compute: () => { producer.output("anything"); },
});
`;
        const diagnostics = await service.compileToDiagnostics(bad);
        expect(diagnostics.some((d) => d.code === "dep-output-not-titled")).toBe(true);
    });

    it("surfaces dep-dynamic as a compile diagnostic", async () => {
        const service = createLanguageService();
        const bad = `
import { defineIndicator, input, plot } from "@invinite-org/chartlang-core";
const producer = defineIndicator({
    name: "P",
    apiVersion: 1,
    inputs: { length: input.int(20) },
    compute: ({ bar }) => { plot(bar.close, { title: "line" }); },
});
const dynLen = 10;
const tuned = producer.withInputs({ length: dynLen });
export default defineIndicator({
    name: "C",
    apiVersion: 1,
    compute: () => { tuned.output("line"); },
});
`;
        const diagnostics = await service.compileToDiagnostics(bad);
        expect(diagnostics.some((d) => d.code === "dep-dynamic")).toBe(true);
    });

    it("surfaces dep-cycle as a compile diagnostic", async () => {
        const service = createLanguageService();
        const bad = `
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
const a = defineIndicator({
    name: "A",
    apiVersion: 1,
    compute: ({ bar }) => { b.output("line"); plot(bar.close, { title: "line" }); },
});
const b = defineIndicator({
    name: "B",
    apiVersion: 1,
    compute: ({ bar }) => { a.output("line"); plot(bar.close, { title: "line" }); },
});
export default defineIndicator({
    name: "C",
    apiVersion: 1,
    compute: () => { a.output("line"); b.output("line"); },
});
`;
        const diagnostics = await service.compileToDiagnostics(bad);
        expect(diagnostics.some((d) => d.code === "dep-cycle")).toBe(true);
    });

    it('returns go-to-definition for .output("title") matching a producer\'s plot title', () => {
        const service = createLanguageService();
        const offset = composition.indexOf('fast.output("line")') + 'fast.output("'.length;

        const def = service.getDefinition(composition, offset);
        expect(def).not.toBeNull();
        expect(def?.file).toBe("script.chart.ts");
        expect(def?.line).toBeGreaterThan(0);
        expect(def?.column).toBeGreaterThan(0);
    });

    it("returns null go-to-definition when no matching plot title exists", () => {
        const service = createLanguageService();
        const bad = `
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
const producer = defineIndicator({
    name: "P",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close, { title: "real" }); },
});
const x = producer.output("missing");
void x;
`;
        const offset = bad.indexOf('"missing"') + 1;
        expect(service.getDefinition(bad, offset)).toBeNull();
    });
});
