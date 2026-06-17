// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { Diagnostic } from "../index.js";
import { formatDiagnostic } from "./format.js";

describe("formatDiagnostic", () => {
    it("renders a single-line error with caret underline, suggestion, and docs", () => {
        const source = "linefill.new(array.get(linesA, i), array.get(linesB, j))\n";
        const diagnostic: Diagnostic = {
            code: "pine-converter/transform/cross-collection-linefill",
            severity: "error",
            message: "linefill across two collections has no chartlang analogue",
            span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 13 },
            suggestion: "Use a single `draw.path(...)` over the pair of anchor points instead.",
        };
        expect(formatDiagnostic(diagnostic, source)).toBe(
            [
                "error[cross-collection-linefill]: linefill across two collections has no chartlang analogue",
                "  --> :1:1",
                "  |",
                "1 | linefill.new(array.get(linesA, i), array.get(linesB, j))",
                "  | ^^^^^^^^^^^^ here",
                "  = suggestion: Use a single `draw.path(...)` over the pair of anchor points instead.",
                "  = docs: https://chartlang.dev/converter/diagnostics#cross-collection-linefill",
            ].join("\n"),
        );
    });

    it("renders a warning whose span starts past column 1 with leading padding", () => {
        const source = "    box.new(a, b)\n";
        const diagnostic: Diagnostic = {
            code: "pine-converter/transform/cap-mismatch",
            severity: "warning",
            message: "cap clamped",
            span: { startLine: 1, startColumn: 5, endLine: 1, endColumn: 12 },
            suggestion: "lower the cap",
        };
        expect(formatDiagnostic(diagnostic, source)).toBe(
            [
                "warning[cap-mismatch]: cap clamped",
                "  --> :1:5",
                "  |",
                "1 |     box.new(a, b)",
                "  |     ^^^^^^^ here",
                "  = suggestion: lower the cap",
                "  = docs: https://chartlang.dev/converter/diagnostics#cap-mismatch",
            ].join("\n"),
        );
    });

    it("renders an info with no suggestion (docs line still present)", () => {
        const source = "plot(close)\n";
        const diagnostic: Diagnostic = {
            code: "pine-converter/transform/ring-eviction-implicit",
            severity: "info",
            message: "eviction is implicit",
            span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 5 },
        };
        const text = formatDiagnostic(diagnostic, source);
        expect(text).toContain("info[ring-eviction-implicit]: eviction is implicit");
        expect(text).not.toContain("= suggestion:");
        expect(text).toContain(
            " = docs: https://chartlang.dev/converter/diagnostics#ring-eviction-implicit",
        );
    });

    it("renders a multi-line span with start/end underlines and an elision", () => {
        const source = ["if cond", "    box.new(a, b)", "    box.delete(x)"].join("\n");
        const diagnostic: Diagnostic = {
            code: "pine-converter/transform/anchor-mirror-required",
            severity: "warning",
            message: "anchor mirror required",
            span: { startLine: 2, startColumn: 5, endLine: 3, endColumn: 18 },
        };
        expect(formatDiagnostic(diagnostic, source)).toBe(
            [
                "warning[anchor-mirror-required]: anchor mirror required",
                "  --> :2:5",
                "  |",
                "2 |     box.new(a, b)",
                "  |     ^^^^^^^^^^^^^",
                "  ...",
                "3 |     box.delete(x)",
                "  | ^^^^^^^^^^^^^^^^^ here",
                "  = docs: https://chartlang.dev/converter/diagnostics#anchor-mirror-required",
            ].join("\n"),
        );
    });

    it("falls back to an empty source line when a single-line span points past EOF", () => {
        // Defensive arm: the span's line index is out of the source's line range
        // (e.g. a synthetic span), so the `?? ""` source fallback fires.
        const diagnostic: Diagnostic = {
            code: "pine-converter/transform/cap-mismatch",
            severity: "warning",
            message: "out of range",
            span: { startLine: 5, startColumn: 1, endLine: 5, endColumn: 3 },
        };
        expect(formatDiagnostic(diagnostic, "only one line")).toBe(
            [
                "warning[cap-mismatch]: out of range",
                "  --> :5:1",
                "  |",
                "5 | ",
                "  | ^^ here",
                "  = docs: https://chartlang.dev/converter/diagnostics#cap-mismatch",
            ].join("\n"),
        );
    });

    it("falls back to empty source lines when a multi-line span points past EOF", () => {
        // Defensive arm: both start and end line indices are out of range, so
        // both `?? ""` source fallbacks fire on the multi-line branch.
        const diagnostic: Diagnostic = {
            code: "pine-converter/transform/anchor-mirror-required",
            severity: "warning",
            message: "spans past eof",
            span: { startLine: 4, startColumn: 1, endLine: 5, endColumn: 2 },
        };
        expect(formatDiagnostic(diagnostic, "line one\nline two")).toBe(
            [
                "warning[anchor-mirror-required]: spans past eof",
                "  --> :4:1",
                "  |",
                "4 | ",
                "  | ^",
                "  ...",
                "5 | ",
                "  | ^ here",
                "  = docs: https://chartlang.dev/converter/diagnostics#anchor-mirror-required",
            ].join("\n"),
        );
    });

    it("handles a code with no slash by using it verbatim as the slug", () => {
        const diagnostic: Diagnostic = {
            code: "barecode",
            severity: "error",
            message: "m",
            span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
        };
        const text = formatDiagnostic(diagnostic, "");
        expect(text.startsWith("error[barecode]: m")).toBe(true);
        expect(text).toContain("#barecode");
    });
});
