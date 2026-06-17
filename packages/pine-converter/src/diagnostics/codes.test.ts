// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { DiagnosticSeverity, SourceSpan } from "../index.js";
import {
    DIAGNOSTIC_CODE_ENTRIES,
    DIAGNOSTIC_CODES,
    type ParserDiagnosticCode,
    makeDiagnostic,
} from "./codes.js";

const SPAN: SourceSpan = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 5 };

describe("DIAGNOSTIC_CODE_ENTRIES", () => {
    it("namespaces every code under a pine-converter/<stage>/ prefix", () => {
        for (const entry of Object.values(DIAGNOSTIC_CODE_ENTRIES)) {
            expect(/^pine-converter\/(parse|semantic|transform|codegen)\//.test(entry.code)).toBe(
                true,
            );
        }
    });

    it("gives every entry a non-empty default message and a valid severity", () => {
        const severities: readonly DiagnosticSeverity[] = ["error", "warning", "info"];
        for (const entry of Object.values(DIAGNOSTIC_CODE_ENTRIES)) {
            expect(entry.defaultMessage.length).toBeGreaterThan(0);
            expect(severities).toContain(entry.severity);
        }
    });

    it("registers the Task-8 declaration-transform codes", () => {
        for (const key of [
            "indicator-arg-not-mapped",
            "drawing-only-script",
            "strategy-as-indicator",
            "computed-indicator-title",
            "max-count-out-of-range",
        ] as const) {
            expect(DIAGNOSTIC_CODE_ENTRIES[key].code).toBe(`pine-converter/transform/${key}`);
        }
    });

    it("pins the per-task severities that downstream tooling depends on", () => {
        const expected: ReadonlyArray<readonly [ParserDiagnosticCode, DiagnosticSeverity]> = [
            ["unsupported-strategy", "error"],
            ["accidental-shadowing", "warning"],
            ["dynamic-handle-collection", "info"],
            ["cap-mismatch", "info"],
            ["cross-collection-linefill", "error"],
            ["ta-not-mapped", "warning"],
            ["codegen-output-invalid", "error"],
        ];
        for (const [key, severity] of expected) {
            expect(DIAGNOSTIC_CODE_ENTRIES[key].severity).toBe(severity);
        }
    });
});

describe("DIAGNOSTIC_CODES (by full code string)", () => {
    it("indexes every entry by its full code string", () => {
        for (const entry of Object.values(DIAGNOSTIC_CODE_ENTRIES)) {
            expect(DIAGNOSTIC_CODES.get(entry.code)).toBe(entry);
        }
    });

    it("has exactly one map entry per registry entry (codes are unique)", () => {
        expect(DIAGNOSTIC_CODES.size).toBe(Object.keys(DIAGNOSTIC_CODE_ENTRIES).length);
    });
});

describe("makeDiagnostic", () => {
    it("carries the default message, severity, and suggestion from the registry", () => {
        const diag = makeDiagnostic("unsupported-strategy", SPAN);
        expect(diag.code).toBe("pine-converter/parse/unsupported-strategy");
        expect(diag.severity).toBe("error");
        expect(diag.message).toBe(DIAGNOSTIC_CODE_ENTRIES["unsupported-strategy"].defaultMessage);
        expect(diag.suggestion).toBe(
            DIAGNOSTIC_CODE_ENTRIES["unsupported-strategy"].defaultSuggestion,
        );
        expect(diag.span).toEqual(SPAN);
    });

    it("omits the suggestion for an entry without one", () => {
        const diag = makeDiagnostic("expected-token", SPAN);
        expect(diag.suggestion).toBeUndefined();
        expect(diag.message).toBe(DIAGNOSTIC_CODE_ENTRIES["expected-token"].defaultMessage);
    });

    it("applies a message override while keeping the stable code", () => {
        const diag = makeDiagnostic("unexpected-token", SPAN, "Unexpected `)`.");
        expect(diag.message).toBe("Unexpected `)`.");
        expect(diag.code).toBe("pine-converter/parse/unexpected-token");
    });

    it("exposes every registry key as a ParserDiagnosticCode", () => {
        const keys: ParserDiagnosticCode[] = Object.keys(
            DIAGNOSTIC_CODE_ENTRIES,
        ) as ParserDiagnosticCode[];
        expect(keys).toContain("missing-version-directive");
    });
});
