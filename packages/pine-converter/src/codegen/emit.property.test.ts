// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";
import { describe, expect, it } from "vitest";

import type { ScriptScaffold } from "../transform/ir.js";
import { NameAllocator } from "../transform/nameAllocator.js";
import { emit } from "./emit.js";

function scaffold(overrides: Partial<ScriptScaffold> = {}): ScriptScaffold {
    return {
        constructor: "defineIndicator",
        apiVersion: 1,
        name: "Prop",
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
        names: new NameAllocator(),
        ...overrides,
    };
}

// Parse the emitted string through the TS compiler API; a clean parse means
// the synthesised source is at least syntactically valid TypeScript.
function parsesCleanly(source: string): boolean {
    const file = ts.createSourceFile("emit.chart.ts", source, ts.ScriptTarget.ES2022, true);
    return (
        (file as unknown as { parseDiagnostics: readonly unknown[] }).parseDiagnostics.length === 0
    );
}

const RICH = scaffold({
    inputs: [{ name: "len", code: "input.int(14)" }],
    stateSlots: [{ name: "__count_state", initExpr: "state.int(0)" }],
    handleSlots: [{ name: "__lvl_handle", kind: "line", compact: false }],
    handleRings: [{ name: "__lvls_ring", kind: "label", cap: 20 }],
    maxDrawings: { lines: 5, labels: 20 },
    computeBody: {
        statements: [
            "if (__lvl_handle.current() === null) { __lvl_handle.set(draw.line({ time: bar.time, price: bar.high }, { time: bar.time, price: bar.low })); }",
            '__lvls_ring.push(draw.text({ time: bar.time, price: bar.high }, "hi"));',
            "for (let i = 0; i < 20; i++) { const __h = __lvls_ring.at(i); if (__h === null) continue; __h.update({}); }",
            "plot(inputs.len);",
            "__count_state.value += 1;",
            "const idx = __barIndexBridge();",
            "void idx;",
        ],
    },
});

describe("emit determinism + validity", () => {
    it("is deterministic across 100 invocations", () => {
        const first = emit(RICH);
        for (let i = 0; i < 100; i += 1) {
            expect(emit(RICH)).toBe(first);
        }
    });

    it("produces syntactically valid TypeScript for an empty body", () => {
        expect(parsesCleanly(emit(scaffold()))).toBe(true);
    });

    it("produces syntactically valid TypeScript for a rich scaffold", () => {
        expect(parsesCleanly(emit(RICH))).toBe(true);
    });

    it("omits the handle helpers when no handle slot or ring is present", () => {
        const out = emit(scaffold({ computeBody: { statements: ["plot(bar.close);"] } }));
        expect(out).not.toContain("useDrawingHandleSlot");
        expect(out).not.toContain("useDrawingHandleRing");
        expect(out).not.toContain("DrawingHandle");
    });
});
