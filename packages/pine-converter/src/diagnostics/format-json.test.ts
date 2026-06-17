// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { Diagnostic, SourceSpan } from "../index.js";
import { formatDiagnosticsJson } from "./formatJson.js";

const SPAN: SourceSpan = { startLine: 2, startColumn: 3, endLine: 2, endColumn: 9 };

describe("formatDiagnosticsJson", () => {
    it("serializes with a stable property order regardless of source key order", () => {
        // Build the diagnostic with the properties in a SCRAMBLED order; the
        // serializer must still emit code → severity → message → span →
        // suggestion.
        const scrambled = {
            span: SPAN,
            message: "m",
            suggestion: "s",
            severity: "error",
            code: "pine-converter/parse/unexpected-token",
        } as Diagnostic;
        const json = formatDiagnosticsJson([scrambled]);
        expect(json).toBe(
            [
                "[",
                "  {",
                '    "code": "pine-converter/parse/unexpected-token",',
                '    "severity": "error",',
                '    "message": "m",',
                '    "span": {',
                '      "startLine": 2,',
                '      "startColumn": 3,',
                '      "endLine": 2,',
                '      "endColumn": 9',
                "    },",
                '    "suggestion": "s"',
                "  }",
                "]",
            ].join("\n"),
        );
    });

    it("omits suggestion entirely when absent (never null)", () => {
        const diagnostic: Diagnostic = {
            code: "pine-converter/parse/expected-token",
            severity: "error",
            message: "m",
            span: SPAN,
        };
        const json = formatDiagnosticsJson([diagnostic]);
        expect(json).not.toContain("suggestion");
        expect(JSON.parse(json)[0]).not.toHaveProperty("suggestion");
    });

    it("round-trips through JSON.parse", () => {
        const diagnostic: Diagnostic = {
            code: "pine-converter/transform/cap-mismatch",
            severity: "warning",
            message: "clamped",
            span: SPAN,
            suggestion: "lower",
        };
        expect(JSON.parse(formatDiagnosticsJson([diagnostic]))).toEqual([
            {
                code: "pine-converter/transform/cap-mismatch",
                severity: "warning",
                message: "clamped",
                span: SPAN,
                suggestion: "lower",
            },
        ]);
    });

    it("serializes an empty list as []", () => {
        expect(formatDiagnosticsJson([])).toBe("[]");
    });
});
