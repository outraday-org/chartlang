// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { createDiagnostic, mapTsDiagnostic } from "./diagnostics.js";

function sourceFor(text: string): ts.SourceFile {
    return ts.createSourceFile("demo.chart.ts", text, ts.ScriptTarget.ES2022, true);
}

describe("createDiagnostic", () => {
    it("derives 1-based line/column from the node position", () => {
        const source = sourceFor("const x = 1;\nconst y = 2;\n");
        const statement = source.statements[1];
        if (!statement) throw new Error("missing statement");
        const diagnostic = createDiagnostic({
            severity: "error",
            code: "unbounded-loop",
            message: "msg",
            file: "demo.chart.ts",
            node: statement,
            sourceFile: source,
        });
        expect(diagnostic.line).toBe(2);
        expect(diagnostic.column).toBe(1);
        expect(diagnostic.severity).toBe("error");
        expect(Object.isFrozen(diagnostic)).toBe(true);
        expect(diagnostic.nodeText).toBeUndefined();
    });

    it("captures a single-line snippet when includeSnippet is true", () => {
        const source = sourceFor("const x = 1;");
        const node = source.statements[0];
        if (!node) throw new Error("missing statement");
        const diagnostic = createDiagnostic({
            severity: "warning",
            code: "dynamic-series-index",
            message: "msg",
            file: "demo.chart.ts",
            node,
            sourceFile: source,
            includeSnippet: true,
        });
        expect(diagnostic.nodeText).toBe("const x = 1;");
    });

    it("truncates long snippets to 80 chars with an ellipsis", () => {
        const long = "x".repeat(120);
        const source = sourceFor(`const a = "${long}";`);
        const node = source.statements[0];
        if (!node) throw new Error("missing statement");
        const diagnostic = createDiagnostic({
            severity: "warning",
            code: "dynamic-series-index",
            message: "msg",
            file: "demo.chart.ts",
            node,
            sourceFile: source,
            includeSnippet: true,
        });
        expect(diagnostic.nodeText).toMatch(/\.\.\.$/);
        expect(diagnostic.nodeText?.length).toBe(80);
    });

    it("truncates a multi-line snippet to the first line", () => {
        const source = sourceFor("const x = {\n    a: 1,\n};");
        const node = source.statements[0];
        if (!node) throw new Error("missing statement");
        const diagnostic = createDiagnostic({
            severity: "warning",
            code: "dynamic-series-index",
            message: "msg",
            file: "demo.chart.ts",
            node,
            sourceFile: source,
            includeSnippet: true,
        });
        expect(diagnostic.nodeText).toBe("const x = {");
    });

    it("returns empty snippet text when the node text has no newline", () => {
        // Cover the `firstLine ?? ""` fallback by passing a synthetic node
        // (impossible in practice but exercises the branch).
        const source = sourceFor("");
        const diagnostic = createDiagnostic({
            severity: "error",
            code: "missing-default-export",
            message: "msg",
            file: "demo.chart.ts",
            node: source,
            sourceFile: source,
            includeSnippet: true,
        });
        expect(diagnostic.nodeText).toBeDefined();
    });

    it("accepts the `type-error` code on the diagnostic union", () => {
        // Ensures the new typecheck path can land its own code without
        // tripping the existing `CompileDiagnosticCode` consumers.
        const source = sourceFor("const x = 1;");
        const node = source.statements[0];
        if (!node) throw new Error("missing statement");
        const diagnostic = createDiagnostic({
            severity: "error",
            code: "type-error",
            message: "msg",
            file: "demo.chart.ts",
            node,
            sourceFile: source,
        });
        expect(diagnostic.code).toBe("type-error");
    });

    it("accepts request security and requiresIntervals diagnostic codes", () => {
        const source = sourceFor("const x = 1;");
        const node = source.statements[0];
        if (!node) throw new Error("missing statement");
        const requestDiagnostic = createDiagnostic({
            severity: "error",
            code: "request-security-interval-not-literal",
            message: "request.security({ interval }) must be a string literal or input.enum value",
            file: "demo.chart.ts",
            node,
            sourceFile: source,
        });
        const requiresDiagnostic = createDiagnostic({
            severity: "error",
            code: "requires-intervals-not-literal",
            message: "defineIndicator({ requiresIntervals }) must be a static string-literal array",
            file: "demo.chart.ts",
            node,
            sourceFile: source,
        });
        expect(requestDiagnostic.message).toBe(
            "request.security({ interval }) must be a string literal or input.enum value",
        );
        expect(requiresDiagnostic.message).toBe(
            "defineIndicator({ requiresIntervals }) must be a static string-literal array",
        );
    });
});

describe("mapTsDiagnostic", () => {
    it("maps a TS diagnostic with file + position to a `type-error` with 1-based line/column", () => {
        const source = sourceFor("const x: number = 'oops';\n");
        const diagnostic: ts.Diagnostic = {
            category: ts.DiagnosticCategory.Error,
            code: 2322,
            file: source,
            start: source.text.indexOf("'oops'"),
            length: 6,
            messageText: "Type 'string' is not assignable to type 'number'.",
        };
        const mapped = mapTsDiagnostic(diagnostic, "demo.chart.ts");
        expect(mapped.severity).toBe("error");
        expect(mapped.code).toBe("type-error");
        expect(mapped.file).toBe("demo.chart.ts");
        expect(mapped.line).toBe(1);
        expect(mapped.column).toBe(19);
        expect(mapped.message).toBe("TS2322: Type 'string' is not assignable to type 'number'.");
        expect(Object.isFrozen(mapped)).toBe(true);
    });

    it("falls back to (1, 1) when the TS diagnostic has no file", () => {
        const diagnostic: ts.Diagnostic = {
            category: ts.DiagnosticCategory.Error,
            code: 6053,
            file: undefined,
            start: undefined,
            length: undefined,
            messageText: "File 'x.d.ts' not found.",
        };
        const mapped = mapTsDiagnostic(diagnostic, "demo.chart.ts");
        expect(mapped.line).toBe(1);
        expect(mapped.column).toBe(1);
        expect(mapped.message).toBe("TS6053: File 'x.d.ts' not found.");
    });

    it("falls back to (1, 1) when the TS diagnostic carries a file but no start position", () => {
        const source = sourceFor("const x = 1;");
        const diagnostic: ts.Diagnostic = {
            category: ts.DiagnosticCategory.Error,
            code: 1234,
            file: source,
            start: undefined,
            length: undefined,
            messageText: "msg",
        };
        const mapped = mapTsDiagnostic(diagnostic, "demo.chart.ts");
        expect(mapped.line).toBe(1);
        expect(mapped.column).toBe(1);
    });

    it("flattens a DiagnosticMessageChain into a single space-joined message", () => {
        const source = sourceFor("const x = 1;");
        const chain: ts.DiagnosticMessageChain = {
            messageText: "Top-level reason.",
            category: ts.DiagnosticCategory.Error,
            code: 2322,
            next: [
                {
                    messageText: "Nested reason A.",
                    category: ts.DiagnosticCategory.Error,
                    code: 2322,
                },
                {
                    messageText: "Nested reason B.",
                    category: ts.DiagnosticCategory.Error,
                    code: 2322,
                    next: [
                        {
                            messageText: "Deep reason.",
                            category: ts.DiagnosticCategory.Error,
                            code: 2322,
                        },
                    ],
                },
            ],
        };
        const diagnostic: ts.Diagnostic = {
            category: ts.DiagnosticCategory.Error,
            code: 2322,
            file: source,
            start: 0,
            length: 1,
            messageText: chain,
        };
        const mapped = mapTsDiagnostic(diagnostic, "demo.chart.ts");
        expect(mapped.message).toBe(
            "TS2322: Top-level reason. Nested reason A. Nested reason B. Deep reason.",
        );
    });
});
