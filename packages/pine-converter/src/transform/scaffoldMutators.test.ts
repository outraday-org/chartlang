// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { ScriptScaffold } from "./ir.js";
import { NameAllocator } from "./nameAllocator.js";
import {
    appendComputeStatement,
    appendHandleRing,
    appendHandleSlot,
    appendInput,
    appendStateSlot,
} from "./scaffoldMutators.js";

function emptyScaffold(): ScriptScaffold {
    return {
        constructor: "defineIndicator",
        apiVersion: 1,
        name: "x",
        shortName: null,
        overlay: null,
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
    };
}

describe("scaffold mutators", () => {
    it("appendInput pushes an input descriptor", () => {
        const scaffold = emptyScaffold();
        appendInput(scaffold, { name: "length", code: "input.int(14)" });
        expect(scaffold.inputs).toEqual([{ name: "length", code: "input.int(14)" }]);
    });

    it("appendStateSlot pushes a scalar slot", () => {
        const scaffold = emptyScaffold();
        appendStateSlot(scaffold, { name: "count", initExpr: "0" });
        expect(scaffold.stateSlots).toEqual([{ name: "count", initExpr: "0" }]);
    });

    it("appendHandleSlot pushes a handle slot", () => {
        const scaffold = emptyScaffold();
        appendHandleSlot(scaffold, { name: "lvl", kind: "line", compact: false });
        expect(scaffold.handleSlots).toEqual([{ name: "lvl", kind: "line", compact: false }]);
    });

    it("appendHandleRing pushes a ring buffer", () => {
        const scaffold = emptyScaffold();
        appendHandleRing(scaffold, { name: "pivots", kind: "label", cap: 20 });
        expect(scaffold.handleRings).toEqual([{ name: "pivots", kind: "label", cap: 20 }]);
    });

    it("appendComputeStatement preserves order", () => {
        const scaffold = emptyScaffold();
        appendComputeStatement(scaffold, "a;");
        appendComputeStatement(scaffold, "b;");
        expect(scaffold.computeBody.statements).toEqual(["a;", "b;"]);
    });
});
