// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { Diagnostic, DiagnosticSeverity, SourceSpan } from "../index.js";
import { formatDiagnostic } from "./format.js";
import { formatDiagnosticReport } from "./formatReport.js";

const SPAN: SourceSpan = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 4 };

function diag(severity: DiagnosticSeverity, code: string, message: string): Diagnostic {
    return { code, severity, message, span: SPAN };
}

const SOURCE = "plot(close)\n";

describe("formatDiagnosticReport", () => {
    it("emits the counted header and only the non-empty severity sections", () => {
        const diagnostics: readonly Diagnostic[] = [
            diag("error", "pine-converter/transform/fill-not-mapped", "fill not mapped"),
            diag("info", "pine-converter/transform/ring-eviction-implicit", "implicit"),
            diag("info", "pine-converter/transform/cap-mismatch", "clamped"),
        ];
        const report = formatDiagnosticReport(diagnostics, SOURCE);
        expect(report).toBe(
            [
                "==== converter diagnostics ====",
                "errors:   1",
                "warnings: 0",
                "infos:    2",
                "",
                "[errors]",
                formatDiagnostic(diagnostics[0] as Diagnostic, SOURCE),
                "",
                "[infos]",
                [
                    formatDiagnostic(diagnostics[1] as Diagnostic, SOURCE),
                    formatDiagnostic(diagnostics[2] as Diagnostic, SOURCE),
                ].join("\n\n"),
            ].join("\n"),
        );
    });

    it("renders only the header when there are no diagnostics", () => {
        expect(formatDiagnosticReport([], SOURCE)).toBe(
            ["==== converter diagnostics ====", "errors:   0", "warnings: 0", "infos:    0"].join(
                "\n",
            ),
        );
    });

    it("includes a [warnings] section when warnings are present", () => {
        const report = formatDiagnosticReport(
            [diag("warning", "pine-converter/transform/cap-mismatch", "clamped")],
            SOURCE,
        );
        expect(report).toContain("warnings: 1");
        expect(report).toContain("[warnings]");
        expect(report).not.toContain("[errors]");
        expect(report).not.toContain("[infos]");
    });
});
