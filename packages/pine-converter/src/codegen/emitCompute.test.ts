// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { ScriptScaffold } from "../transform/ir.js";
import { emitCompute } from "./emitCompute.js";

function scaffold(overrides: Partial<ScriptScaffold> = {}): ScriptScaffold {
    return {
        constructor: "defineIndicator",
        apiVersion: 1,
        name: "C",
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

describe("emitCompute destructure minimization", () => {
    it("destructures only bar for an empty body", () => {
        expect(emitCompute(scaffold())[0]).toBe("compute({ bar }) {");
    });

    it("destructures every referenced surface in fixed order", () => {
        const head = emitCompute(
            scaffold({
                inputs: [{ name: "len", code: "input.int(1)" }],
                stateSlots: [{ name: "__s", initExpr: "state.int(0)" }],
                computeBody: {
                    statements: [
                        "plot(ta.ema(bar.close, 5));",
                        "hline(0);",
                        'alert("x");',
                        "draw.line({}, {});",
                        'const r = request.security({ interval: "1h" });',
                        "if (barstate.islast) {}",
                        "void r;",
                    ],
                },
            }),
        )[0];
        expect(head).toBe(
            "compute({ bar, ta, plot, hline, alert, draw, inputs, state, request, barstate }) {",
        );
    });

    it("adds barstate when only the bar-index bridge needs it", () => {
        const head = emitCompute(
            scaffold({ computeBody: { statements: ["const x = __bar_index(); void x;"] } }),
        )[0];
        expect(head).toBe("compute({ bar, barstate }) {");
    });
});
