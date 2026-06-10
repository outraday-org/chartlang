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

    it("returns capability hints for unsupported intervals, MTF, and plot kinds", async () => {
        const service = createLanguageService({ targetCapabilities: capabilities });
        const diagnostics = await service.compileToDiagnostics(script);

        expect(diagnostics.map((d) => d.code)).toEqual([
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

        expect(await service.compileToDiagnostics(dynamic)).toEqual([]);
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
