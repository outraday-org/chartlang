// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { CompileDiagnostic } from "../diagnostics.js";
import { createProgramForSource } from "../program.js";
import { extractInputs } from "./extractInputs.js";
import { extractRequestedIntervals } from "./extractRequestedIntervals.js";

function run(source: string): Readonly<{
    intervals: ReadonlyArray<string>;
    diagnostics: ReadonlyArray<CompileDiagnostic>;
}> {
    const { sourceFile, checker } = createProgramForSource(source, {
        sourcePath: "demo.chart.ts",
    });
    const inputResult = extractInputs(sourceFile, checker, "demo.chart.ts");
    const diagnostics: CompileDiagnostic[] = [...inputResult.diagnostics];
    const intervals = extractRequestedIntervals(
        sourceFile,
        checker,
        inputResult.inputs,
        diagnostics,
        "demo.chart.ts",
    );
    return Object.freeze({
        intervals,
        diagnostics: Object.freeze(diagnostics.slice()),
    });
}

function runWithInputs(
    source: string,
    inputs: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
): Readonly<{
    intervals: ReadonlyArray<string>;
    diagnostics: ReadonlyArray<CompileDiagnostic>;
}> {
    const { sourceFile, checker } = createProgramForSource(source, {
        sourcePath: "demo.chart.ts",
    });
    const diagnostics: CompileDiagnostic[] = [];
    const intervals = extractRequestedIntervals(
        sourceFile,
        checker,
        inputs,
        diagnostics,
        "demo.chart.ts",
    );
    return Object.freeze({
        intervals,
        diagnostics: Object.freeze(diagnostics.slice()),
    });
}

describe("extractRequestedIntervals", () => {
    it("extracts distinct literal request.security intervals sorted", () => {
        const result = run(`
import { defineIndicator, request } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute: () => {
        request.security({ interval: "5m" });
        request.security({ interval: "1D" });
        request.security({ interval: "5m" });
    },
});
`);
        expect(result.intervals).toEqual(["1D", "5m"]);
        expect(result.diagnostics).toEqual([]);
    });

    it("extracts request.security and request.lowerTf intervals together", () => {
        const result = run(`
import { defineIndicator, request } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute: () => {
        request.security({ interval: "1D" });
        request.lowerTf({ interval: "30s" });
    },
});
`);
        expect(result.intervals).toEqual(["1D", "30s"]);
        expect(result.diagnostics).toEqual([]);
    });

    it("emits a diagnostic for dynamic interval values", () => {
        const result = run(`
import { defineIndicator, request } from "@invinite-org/chartlang-core";
const tf = "1D";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute: () => {
        request.security({ interval: tf });
    },
});
`);
        expect(result.intervals).toEqual([]);
        expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
            "request-security-interval-not-literal",
        );
        expect(result.diagnostics[0]?.message).toBe(
            "request.security({ interval }) must be a string literal or input.enum value",
        );
    });

    it("emits a diagnostic for dynamic request.lowerTf interval values", () => {
        const result = run(`
import { defineIndicator, request } from "@invinite-org/chartlang-core";
const tf = "30s";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute: () => {
        request.lowerTf({ interval: tf });
    },
});
`);
        expect(result.intervals).toEqual([]);
        expect(result.diagnostics.map((d) => d.code)).toEqual([
            "request-lower-tf-interval-not-literal",
        ]);
        expect(result.diagnostics[0]?.message).toBe(
            "request.lowerTf({ interval }) must be a string literal or input.enum value",
        );
    });

    it("returns an empty interval set when no request.security calls exist", () => {
        const result = run(`
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute: () => {},
});
`);
        expect(result.intervals).toEqual([]);
        expect(result.diagnostics).toEqual([]);
    });

    it("expands inputs.enum interval references to all enum options", () => {
        const result = run(`
import { defineIndicator, input } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    inputs: {
        htf: input.enum("1D", ["1D", "1W"] as const),
    },
    compute: ({ inputs, request }) => {
        request.security({ interval: inputs.htf });
    },
});
`);
        expect(result.intervals).toEqual(["1D", "1W"]);
        expect(result.diagnostics).toEqual([]);
    });

    it("ignores malformed request.security opts without an interval property", () => {
        const result = run(`
import { defineIndicator, request } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute: () => {
        request.security();
        request.security("1D");
        request.security({});
    },
});
`);
        expect(result.intervals).toEqual([]);
        expect(result.diagnostics).toEqual([]);
    });

    it("rejects inputs references that are missing or not enum descriptors", () => {
        const result = run(`
import { defineIndicator, input } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    inputs: {
        htf: input.interval("1D"),
    },
    compute: ({ inputs, request }) => {
        request.security({ interval: inputs.htf });
        request.security({ interval: inputs.missing });
    },
});
`);
        expect(result.intervals).toEqual([]);
        expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
            "request-security-interval-not-literal",
            "request-security-interval-not-literal",
        ]);
    });

    it("rejects malformed enum descriptors from manual callers", () => {
        const result = runWithInputs(
            `
import { request } from "@invinite-org/chartlang-core";
request.security({ interval: inputs.htf });
request.security({ interval: inputs.bad });
`,
            {
                htf: { kind: "enum", options: "1D" },
                bad: { kind: "enum", options: ["1D", 1] },
            },
        );
        expect(result.intervals).toEqual([]);
        expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
            "request-security-interval-not-literal",
            "request-security-interval-not-literal",
        ]);
    });
});
