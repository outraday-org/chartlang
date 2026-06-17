// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import {
    type ConvertManifest,
    type ConvertOpts,
    type ConvertResult,
    type ConverterCapabilities,
    ConverterNotReadyError,
    type Diagnostic,
    type DiagnosticSeverity,
    PACKAGE_VERSION,
    type SourceSpan,
    convert,
} from "./index.js";

describe("public surface", () => {
    it("pins PACKAGE_VERSION to the §22.4 placeholder value", () => {
        expect(PACKAGE_VERSION).toBe("0.0.0");
    });

    it("throws ConverterNotReadyError from convert() with missingLayer === 'lexer'", () => {
        let thrown: unknown;
        try {
            convert("");
        } catch (err) {
            thrown = err;
        }
        expect(thrown).toBeInstanceOf(ConverterNotReadyError);
        expect(thrown).toBeInstanceOf(Error);
        const err = thrown as ConverterNotReadyError;
        expect(err.missingLayer).toBe("lexer");
        expect(err.name).toBe("ConverterNotReadyError");
        expect(err.message).toContain("lexer");
    });

    it("accepts optional ConvertOpts (does not change the throw site)", () => {
        const opts: ConvertOpts = {
            barInterval: 60_000,
            barIndexOrigin: 0,
            strictMode: true,
            targetApiVersion: 1,
        };
        expect(() => convert("//@version=6", opts)).toThrow(ConverterNotReadyError);
    });

    it("constructs every exported type literal", () => {
        const severity: DiagnosticSeverity = "warning";
        const span: SourceSpan = {
            startLine: 1,
            startColumn: 1,
            endLine: 1,
            endColumn: 10,
        };
        const diagnostic: Diagnostic = {
            code: "pine-converter/test",
            severity,
            message: "smoke",
            span,
            suggestion: "n/a",
        };
        const manifest: ConvertManifest = {
            kind: "drawing",
            name: "test",
            inputs: [],
            drawingKindsUsed: [],
            requiresBarInterval: false,
        };
        const result: ConvertResult = {
            output: null,
            manifest,
            diagnostics: [diagnostic],
        };
        const caps: ConverterCapabilities = {
            pineVersion: 6,
            convertibleDrawingKinds: [],
            convertibleInputs: [],
            convertibleCampModes: ["camp-a"],
        };
        expect(result.diagnostics[0]?.severity).toBe("warning");
        expect(caps.pineVersion).toBe(6);
        expect(manifest.kind).toBe("drawing");
    });
});
