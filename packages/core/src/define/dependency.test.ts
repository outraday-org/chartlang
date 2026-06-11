// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { DependencyDeclaration, OutputDeclaration } from "./dependency.js";

describe("DependencyDeclaration / OutputDeclaration", () => {
    it("accepts a fully-populated frozen literal", () => {
        const output: OutputDeclaration = Object.freeze({
            title: "line",
            kind: "series-number",
        });
        const dep: DependencyDeclaration = Object.freeze({
            localId: "fastTrend",
            producerName: "Base Trend",
            producerSourcePath: "trend-confirmation.chart.ts",
            producerExportName: "default",
            effectiveInputs: Object.freeze({ length: 20 }),
            outputs: Object.freeze([output]),
            isDrawn: false,
        });
        expect(dep.localId).toBe("fastTrend");
        expect(dep.outputs[0]?.title).toBe("line");
        expect(dep.outputs[0]?.kind).toBe("series-number");
        expect(Object.isFrozen(dep)).toBe(true);
        expect(Object.isFrozen(dep.outputs)).toBe(true);
        expect(Object.isFrozen(output)).toBe(true);
    });

    it("round-trips through JSON.parse(JSON.stringify(...))", () => {
        const dep: DependencyDeclaration = {
            localId: "slowTrend",
            producerName: "Base Trend",
            producerSourcePath: "trend.chart.ts",
            producerExportName: "default",
            effectiveInputs: { length: 50, source: "close" },
            outputs: [{ title: "line", kind: "series-number" }],
            isDrawn: true,
        };
        const roundTripped = JSON.parse(JSON.stringify(dep)) as DependencyDeclaration;
        expect(roundTripped).toEqual(dep);
    });

    it("permits an empty outputs array for a producer with no titled plots", () => {
        const dep: DependencyDeclaration = {
            localId: "untitled",
            producerName: "Producer",
            producerSourcePath: "x.chart.ts",
            producerExportName: "default",
            effectiveInputs: {},
            outputs: [],
            isDrawn: false,
        };
        expect(dep.outputs.length).toBe(0);
    });
});
