// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { Diagnostic, DiagnosticSeverity, SourceSpan } from "../index.js";
import { DiagnosticReport, upgradeWarningsToErrors } from "./report.js";

const SPAN: SourceSpan = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 5 };

function diag(
    severity: DiagnosticSeverity,
    code = `pine-converter/transform/${severity}`,
): Diagnostic {
    return { code, severity, message: `${severity} message`, span: SPAN };
}

const SAMPLE: readonly Diagnostic[] = [
    diag("error"),
    diag("warning"),
    diag("info"),
    diag("warning", "pine-converter/transform/second-warning"),
];

describe("upgradeWarningsToErrors (free fn)", () => {
    it("turns warnings into errors and leaves error/info untouched", () => {
        const upgraded = upgradeWarningsToErrors(SAMPLE);
        expect(upgraded.map((d) => d.severity)).toEqual(["error", "error", "info", "error"]);
    });

    it("does not mutate the input array or its diagnostics", () => {
        const input = [diag("warning")];
        upgradeWarningsToErrors(input);
        expect(input[0]?.severity).toBe("warning");
    });

    it("preserves code, message, and span when upgrading", () => {
        const [upgraded] = upgradeWarningsToErrors([diag("warning")]);
        expect(upgraded).toEqual({
            code: "pine-converter/transform/warning",
            severity: "error",
            message: "warning message",
            span: SPAN,
        });
    });
});

describe("DiagnosticReport", () => {
    it("partitions by severity in original order", () => {
        const report = new DiagnosticReport(SAMPLE);
        expect(report.errors()).toHaveLength(1);
        expect(report.warnings()).toHaveLength(2);
        expect(report.infos()).toHaveLength(1);
        expect(report.all()).toHaveLength(4);
    });

    it("copies the input so later mutation does not leak in", () => {
        const input = [diag("error")];
        const report = new DiagnosticReport(input);
        input.push(diag("warning"));
        expect(report.all()).toHaveLength(1);
    });

    it("returns a frozen snapshot from frozen()", () => {
        const frozen = new DiagnosticReport(SAMPLE).frozen();
        expect(Object.isFrozen(frozen)).toBe(true);
        expect(frozen).toHaveLength(4);
    });

    it("upgradeWarningsToErrors returns a new report with warnings flipped", () => {
        const report = new DiagnosticReport(SAMPLE);
        const strict = report.upgradeWarningsToErrors();
        expect(strict.errors()).toHaveLength(3);
        expect(strict.warnings()).toHaveLength(0);
        // original is unchanged
        expect(report.warnings()).toHaveLength(2);
    });
});
