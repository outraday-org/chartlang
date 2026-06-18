// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { CompileDiagnostic } from "../diagnostics.js";
import { createProgramForSource } from "../program.js";
import { extractInputs } from "./extractInputs.js";
import { extractRequestAnalysis, extractRequestedIntervals } from "./extractRequestedIntervals.js";

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

function analyse(
    source: string,
    validateExpressions = false,
): ReturnType<typeof extractRequestAnalysis> & { diagnostics: ReadonlyArray<CompileDiagnostic> } {
    const { sourceFile, checker } = createProgramForSource(source, {
        sourcePath: "demo.chart.ts",
    });
    const inputResult = extractInputs(sourceFile, checker, "demo.chart.ts");
    const diagnostics: CompileDiagnostic[] = [...inputResult.diagnostics];
    const analysis = extractRequestAnalysis(
        sourceFile,
        checker,
        inputResult.inputs,
        diagnostics,
        "demo.chart.ts",
        validateExpressions,
    );
    return Object.freeze({ ...analysis, diagnostics: Object.freeze(diagnostics.slice()) });
}

describe("extractRequestAnalysis security expressions", () => {
    it("still emits the interval and records the expression descriptor", () => {
        const result = analyse(
            `import { request } from "@invinite-org/chartlang-core";
const trend = request.security({ interval: "1W" }, (bar) => bar.close);`,
        );
        expect(result.intervals).toEqual(["1W"]);
        expect(result.securityExpressions).toEqual([
            { slotId: "demo.chart.ts:2:15#0", interval: "1W", paramName: "bar" },
        ]);
    });

    it("records a function-expression callback and reads its param name", () => {
        const result = analyse(
            `import { request } from "@invinite-org/chartlang-core";
const trend = request.security({ interval: "1D" }, function (candle) { return candle.close; });`,
        );
        expect(result.securityExpressions).toEqual([
            { slotId: "demo.chart.ts:2:15#0", interval: "1D", paramName: "candle" },
        ]);
    });

    it("sorts multiple expression units by slotId", () => {
        const result = analyse(
            `import { request } from "@invinite-org/chartlang-core";
const a = request.security({ interval: "1D" }, (bar) => bar.close);
const b = request.security({ interval: "1W" }, (bar) => bar.open);`,
        );
        expect(result.securityExpressions.map((e) => e.interval)).toEqual(["1D", "1W"]);
        expect(result.securityExpressions.map((e) => e.slotId)).toEqual(
            [...result.securityExpressions.map((e) => e.slotId)].sort(),
        );
    });

    it("omits a descriptor when the interval is not a string literal", () => {
        const result = analyse(
            `import { request } from "@invinite-org/chartlang-core";
const trend = request.security({ interval: inputs.htf }, (bar) => bar.close);`,
        );
        expect(result.securityExpressions).toEqual([]);
        expect(result.diagnostics.map((d) => d.code)).toContain(
            "request-security-interval-not-literal",
        );
    });

    it("records no expression unit for the data-only form", () => {
        const result = analyse(
            `import { request } from "@invinite-org/chartlang-core";
const weekly = request.security({ interval: "1W" });`,
        );
        expect(result.intervals).toEqual(["1W"]);
        expect(result.securityExpressions).toEqual([]);
    });

    it("records an empty paramName for a no-parameter callback", () => {
        const result = analyse(
            `import { request } from "@invinite-org/chartlang-core";
const trend = request.security({ interval: "1W" }, () => 5);`,
        );
        expect(result.securityExpressions).toEqual([
            { slotId: "demo.chart.ts:2:15#0", interval: "1W", paramName: "" },
        ]);
    });

    it("records an empty paramName for a destructured callback parameter", () => {
        const result = analyse(
            `import { request } from "@invinite-org/chartlang-core";
const trend = request.security({ interval: "1W" }, ({ close }) => close);`,
        );
        expect(result.securityExpressions).toEqual([
            { slotId: "demo.chart.ts:2:15#0", interval: "1W", paramName: "" },
        ]);
    });

    it("omits a descriptor when the opts is not an object literal", () => {
        const result = analyse(
            `import { request } from "@invinite-org/chartlang-core";
declare const opts: { interval: string };
const trend = request.security(opts, (bar) => bar.close);`,
        );
        expect(result.securityExpressions).toEqual([]);
    });

    it("omits a descriptor when the opts object literal has no interval property", () => {
        // The interval property is structurally absent; the raw extractor runs
        // regardless of the resulting type error.
        const result = analyse(
            `import { request } from "@invinite-org/chartlang-core";
// @ts-expect-error opts missing required interval
const trend = request.security({ notInterval: "x" }, (bar) => bar.close);`,
        );
        expect(result.securityExpressions).toEqual([]);
    });

    it("runs the capture check only when validateExpressions is set", () => {
        const captured = `import { request } from "@invinite-org/chartlang-core";
const trend = request.security({ interval: "1W" }, (bar) => bar.close[k]);`;
        expect(analyse(captured, false).diagnostics).toEqual([]);
        expect(analyse(captured, true).diagnostics.map((d) => d.code)).toContain(
            "request-security-expr-captures-local",
        );
    });
});
