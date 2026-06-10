// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { CompileDiagnostic } from "../diagnostics.js";
import { createProgramForSource } from "../program.js";
import { extractRequiresIntervals } from "./extractRequiresIntervals.js";

function run(source: string): Readonly<{
    intervals: ReadonlyArray<string>;
    diagnostics: ReadonlyArray<CompileDiagnostic>;
}> {
    const { sourceFile, checker } = createProgramForSource(source, {
        sourcePath: "demo.chart.ts",
    });
    const diagnostics: CompileDiagnostic[] = [];
    const intervals = extractRequiresIntervals(sourceFile, checker, diagnostics, "demo.chart.ts");
    return Object.freeze({
        intervals,
        diagnostics: Object.freeze(diagnostics.slice()),
    });
}

describe("extractRequiresIntervals", () => {
    it("extracts static defineIndicator requiresIntervals values sorted", () => {
        const result = run(`
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    requiresIntervals: ["1W", "1D", "1D"],
    compute: () => {},
});
`);
        expect(result.intervals).toEqual(["1D", "1W"]);
        expect(result.diagnostics).toEqual([]);
    });

    it("emits a diagnostic for non-literal entries", () => {
        const result = run(`
import { defineIndicator } from "@invinite-org/chartlang-core";
const tf = "1D";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    requiresIntervals: [tf],
    compute: () => {},
});
`);
        expect(result.intervals).toEqual([]);
        expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
            "requires-intervals-not-literal",
        ]);
        expect(result.diagnostics[0]?.message).toBe(
            "defineIndicator({ requiresIntervals }) must be a static string-literal array",
        );
    });

    it("emits a diagnostic when requiresIntervals is not an array literal", () => {
        const result = run(`
import { defineIndicator } from "@invinite-org/chartlang-core";
const intervals = ["1D"];
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    requiresIntervals: intervals,
    compute: () => {},
});
`);
        expect(result.intervals).toEqual([]);
        expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
            "requires-intervals-not-literal",
        ]);
    });

    it("ignores define calls without object-literal opts", () => {
        const result = run(`
import { defineIndicator } from "@invinite-org/chartlang-core";
defineIndicator();
defineIndicator("x");
`);
        expect(result.intervals).toEqual([]);
        expect(result.diagnostics).toEqual([]);
    });
});
