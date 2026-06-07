// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { TimeCyclesState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { renderTimeCycles } from "./timeCycles";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: TimeCyclesState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "time-cycles",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

const STATE: TimeCyclesState = {
    kind: "time-cycles",
    anchors: [
        { time: 40, price: 50 },
        { time: 60, price: 50 },
    ],
    style: {},
};

describe("renderTimeCycles", () => {
    it("strokes one arc per cycle (each via beginPath + arc + stroke)", () => {
        const ctx = new MockCanvas2DContext();
        renderTimeCycles(ctx, emission(STATE), VIEW);
        const arcs = ctx.calls.filter((c) => c.kind === "arc");
        const strokes = ctx.calls.filter((c) => c.kind === "stroke");
        expect(arcs.length).toBe(strokes.length);
        expect(arcs.length).toBeGreaterThan(1);
    });

    it("uses the upper semicircle (start = PI, end = 2*PI)", () => {
        const ctx = new MockCanvas2DContext();
        renderTimeCycles(ctx, emission(STATE), VIEW);
        const firstArc = ctx.calls.find((c) => c.kind === "arc");
        if (firstArc?.kind === "arc") {
            expect(firstArc.start).toBe(Math.PI);
            expect(firstArc.end).toBe(2 * Math.PI);
        }
    });

    it("defaults to cycle sky-blue #0ea5e9 stroke", () => {
        const ctx = new MockCanvas2DContext();
        renderTimeCycles(ctx, emission(STATE), VIEW);
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (stroke?.kind === "set") expect(stroke.value).toBe("#0ea5e9");
    });

    it("honours state.style.color override", () => {
        const ctx = new MockCanvas2DContext();
        renderTimeCycles(ctx, emission({ ...STATE, style: { color: "#abcdef" } }), VIEW);
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (stroke?.kind === "set") expect(stroke.value).toBe("#abcdef");
    });

    it("no-ops silently when anchors share a time", () => {
        const ctx = new MockCanvas2DContext();
        renderTimeCycles(
            ctx,
            emission({
                ...STATE,
                anchors: [
                    { time: 50, price: 50 },
                    { time: 50, price: 50 },
                ],
            }),
            VIEW,
        );
        expect(ctx.calls).toEqual([]);
    });
});
