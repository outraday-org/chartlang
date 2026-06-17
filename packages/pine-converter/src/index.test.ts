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

    it("convert() returns a non-null output whose first line is the header", () => {
        const result = convert("//@version=6\nindicator('hello')");
        expect(result.output).not.toBeNull();
        expect(result.output?.startsWith("// Auto-generated")).toBe(true);
        expect(result.manifest?.kind).toBe("indicator");
        expect(result.manifest?.name).toBe("hello");
    });

    it("convert() returns a null output (no manifest) when no declaration parses", () => {
        const result = convert("");
        expect(result.output).toBeNull();
        expect(result.manifest).toBeNull();
    });

    it("convert() accepts optional ConvertOpts", () => {
        const opts: ConvertOpts = {
            barInterval: 60_000,
            barIndexOrigin: 0,
            strictMode: true,
            targetApiVersion: 1,
        };
        const result = convert("//@version=6\nindicator('opts')", opts);
        expect(result.output).not.toBeNull();
    });

    it("ConverterNotReadyError stays on the public surface for the async path", () => {
        const err = new ConverterNotReadyError("round-trip");
        expect(err).toBeInstanceOf(Error);
        expect(err.missingLayer).toBe("round-trip");
        expect(err.name).toBe("ConverterNotReadyError");
        expect(err.message).toContain("round-trip");
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
