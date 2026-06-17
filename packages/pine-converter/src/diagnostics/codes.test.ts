// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { SourceSpan } from "../index.js";
import { DIAGNOSTIC_CODES, makeDiagnostic, type ParserDiagnosticCode } from "./codes.js";

const SPAN: SourceSpan = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 5 };

describe("DIAGNOSTIC_CODES", () => {
    it("namespaces every code under pine-converter/parse/", () => {
        for (const entry of Object.values(DIAGNOSTIC_CODES)) {
            expect(entry.code.startsWith("pine-converter/parse/")).toBe(true);
        }
    });
});

describe("makeDiagnostic", () => {
    it("carries the default message, severity, and suggestion from the registry", () => {
        const diag = makeDiagnostic("unsupported-strategy", SPAN);
        expect(diag.code).toBe("pine-converter/parse/unsupported-strategy");
        expect(diag.severity).toBe("error");
        expect(diag.message).toBe(DIAGNOSTIC_CODES["unsupported-strategy"].defaultMessage);
        expect(diag.suggestion).toBe(DIAGNOSTIC_CODES["unsupported-strategy"].defaultSuggestion);
        expect(diag.span).toEqual(SPAN);
    });

    it("omits the suggestion for an entry without one", () => {
        const diag = makeDiagnostic("expected-token", SPAN);
        expect(diag.suggestion).toBeUndefined();
        expect(diag.message).toBe(DIAGNOSTIC_CODES["expected-token"].defaultMessage);
    });

    it("applies a message override while keeping the stable code", () => {
        const diag = makeDiagnostic("unexpected-token", SPAN, "Unexpected `)`.");
        expect(diag.message).toBe("Unexpected `)`.");
        expect(diag.code).toBe("pine-converter/parse/unexpected-token");
    });

    it("exposes every registry key as a ParserDiagnosticCode", () => {
        const keys: ParserDiagnosticCode[] = Object.keys(
            DIAGNOSTIC_CODES,
        ) as ParserDiagnosticCode[];
        expect(keys).toContain("missing-version-directive");
    });
});
