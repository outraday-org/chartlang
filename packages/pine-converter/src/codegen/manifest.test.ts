// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { SemanticResult } from "../semantic/index.js";
import type { ScriptScaffold } from "../transform/ir.js";
import { scaffoldToManifest } from "./manifest.js";

function scaffold(overrides: Partial<ScriptScaffold> = {}): ScriptScaffold {
    return {
        constructor: "defineIndicator",
        apiVersion: 1,
        name: "M",
        shortName: null,
        overlay: true,
        format: null,
        precision: null,
        scale: null,
        maxDrawings: {},
        maxBarsBack: null,
        inputs: [],
        stateSlots: [],
        handleSlots: [],
        handleRings: [],
        computeBody: { statements: [] },
        diagnostics: [],
        ...overrides,
    };
}

function analysisWith(referencesFutureBarIndex: boolean): SemanticResult {
    return {
        script: {
            kind: "script",
            version: null,
            declaration: null,
            body: [],
            span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
        },
        rootScope: {
            parent: null,
            symbols: new Map(),
            span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
        },
        scopes: new Map(),
        annotations: new Map(),
        symbols: new Map(),
        lifetimes: new Map(),
        drawingSites: [],
        drawingClassifications: new Map(),
        referencesBarIndex: false,
        referencesFutureBarIndex,
        diagnostics: [],
    };
}

describe("scaffoldToManifest", () => {
    it("reports indicator kind, name, and input names", () => {
        const manifest = scaffoldToManifest(
            scaffold({
                name: "Hello",
                inputs: [
                    { name: "len", code: "input.int(1)" },
                    { name: "src", code: "input.source(close)" },
                ],
            }),
            analysisWith(false),
        );
        expect(manifest.kind).toBe("indicator");
        expect(manifest.name).toBe("Hello");
        expect(manifest.inputs).toEqual(["len", "src"]);
        expect(manifest.requiresBarInterval).toBe(false);
    });

    it("reports drawing kind for a defineDrawing scaffold", () => {
        const manifest = scaffoldToManifest(
            scaffold({ constructor: "defineDrawing" }),
            analysisWith(false),
        );
        expect(manifest.kind).toBe("drawing");
    });

    it("unions + sorts the draw kinds across handle slots and rings", () => {
        const manifest = scaffoldToManifest(
            scaffold({
                handleSlots: [
                    { name: "__a", kind: "line" },
                    { name: "__b", kind: "rectangle" },
                ],
                handleRings: [
                    { name: "__c_ring", kind: "label", cap: 5 },
                    { name: "__d_ring", kind: "line", cap: 5 },
                ],
            }),
            analysisWith(false),
        );
        expect(manifest.drawingKindsUsed).toEqual(["label", "line", "rectangle"]);
    });

    it("sets requiresBarInterval from the analysis future-bar flag", () => {
        const manifest = scaffoldToManifest(scaffold(), analysisWith(true));
        expect(manifest.requiresBarInterval).toBe(true);
    });
});
