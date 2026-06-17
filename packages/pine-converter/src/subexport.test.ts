// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import {
    DiagnosticReport,
    formatDiagnostic,
    formatDiagnosticReport,
    formatDiagnosticsJson,
    upgradeWarningsToErrors,
} from "./diagnostics/index.js";

// The `@invinite-org/chartlang-pine-converter/diagnostics` subpath export
// resolves to `./dist/diagnostics/index.js` (see package.json + scaffold.ts).
// Pre-build, that barrel is `src/diagnostics/index.ts`; this test asserts the
// formatter surface a consumer importing the subpath gets is wired up.
describe("diagnostics sub-export surface", () => {
    it("exposes the formatter + report helpers", () => {
        expect(typeof formatDiagnostic).toBe("function");
        expect(typeof formatDiagnosticReport).toBe("function");
        expect(typeof formatDiagnosticsJson).toBe("function");
        expect(typeof upgradeWarningsToErrors).toBe("function");
        expect(typeof DiagnosticReport).toBe("function");
    });

    it("formats a diagnostic report end-to-end through the sub-export", () => {
        const report = formatDiagnosticReport(
            [
                {
                    code: "pine-converter/parse/unexpected-token",
                    severity: "error",
                    message: "Unexpected token.",
                    span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
                },
            ],
            "//@version=6",
        );
        expect(report.startsWith("==== converter diagnostics ====")).toBe(true);
    });
});
