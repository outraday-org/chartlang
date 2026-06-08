// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { collectCompletions } from "./collectCompletions";
import { isInsideIntervalLiteral } from "./isInsideIntervalLiteral";
import { makeDiagnostic, mapDiagnostic } from "./mapDiagnostic";
import { findTokenAtOffset, resolveFqnAtOffset } from "./resolveFqnAtOffset";
import { toHoverDoc } from "./toHoverDoc";

describe("language-service helpers", () => {
    it("resolves FQNs and returns null for non-identifiers", () => {
        expect(resolveFqnAtOffset("ta.ema(bar.close, 20)", 4)).toBe("ta.ema");
        expect(resolveFqnAtOffset("plot(1)", 1)).toBe("plot");
        expect(resolveFqnAtOffset("42", 0)).toBeNull();
        expect(resolveFqnAtOffset("factory().ema()", 10)).toBeNull();
    });

    it("finds tokens by offset", () => {
        const sourceFile = ts.createSourceFile(
            "x.ts",
            "const alpha = 1;",
            ts.ScriptTarget.Latest,
            true,
        );
        expect(findTokenAtOffset(sourceFile, 7)?.getText(sourceFile)).toBe("alpha");
        expect(findTokenAtOffset(sourceFile, 200)).toBeNull();
    });

    it("detects only supported interval literals", () => {
        expect(isInsideIntervalLiteral('request.security({ interval: "1D" })', 31)).toBe(true);
        expect(isInsideIntervalLiteral('input.interval("1D")', 17)).toBe(true);
        expect(isInsideIntervalLiteral('input.string("1D")', 15)).toBe(false);
        expect(isInsideIntervalLiteral('request.security({ symbol: "AAPL" })', 29)).toBe(false);
        expect(isInsideIntervalLiteral('request.security(interval("1D"))', 27)).toBe(false);
        expect(isInsideIntervalLiteral('request.security({ ["interval"]: "1D" })', 35)).toBe(false);
        expect(isInsideIntervalLiteral('input["interval"]("1D")', 19)).toBe(false);
        expect(isInsideIntervalLiteral('const interval = "1D";', 18)).toBe(false);
        expect(isInsideIntervalLiteral('input.config.interval("1D")', 24)).toBe(false);
    });

    it("collects registry and local completions", () => {
        const completions = collectCompletions(
            "function helper(param: number) { const local = param; }",
            0,
            {
                "ta.ema": {
                    fqn: "ta.ema",
                    kind: "function",
                    title: "ta.ema(source, length)",
                    summary: "EMA.",
                    since: "0.1",
                    stability: "stable",
                },
            },
        );

        expect(completions.map((item) => item.label)).toEqual([
            "helper",
            "local",
            "param",
            "ta.ema",
        ]);
    });

    it("maps diagnostics and hover entries with optional fields", () => {
        expect(
            mapDiagnostic({
                severity: "warning",
                code: "dynamic-series-index",
                message: "dynamic",
                file: "x.ts",
                line: 2,
                column: 3,
                nodeText: "series[i]",
            }),
        ).toMatchObject({
            code: "dynamic-series-index",
            relatedCallsite: "series[i]",
            range: { startLine: 2, startColumn: 3 },
        });
        expect(
            makeDiagnostic({
                line: 1,
                column: 1,
                severity: "hint",
                code: "hint",
                message: "message",
            }),
        ).not.toHaveProperty("relatedCallsite");
        expect(
            toHoverDoc({
                fqn: "x",
                kind: "property",
                title: "x",
                summary: "summary",
                examples: ["x"],
                since: "0.4",
                stability: "stable",
            }),
        ).toEqual({ title: "x", summary: "summary", examples: ["x"] });
    });
});
