// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { ElliottDoubleComboState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { renderElliottDoubleCombo } from "./elliottDoubleCombo";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: ElliottDoubleComboState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "elliott-double-combo",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

const STATE: ElliottDoubleComboState = {
    kind: "elliott-double-combo",
    anchors: [
        { time: 0, price: 0 },
        { time: 15, price: 30 },
        { time: 30, price: 20 },
        { time: 45, price: 50 },
        { time: 60, price: 40 },
        { time: 75, price: 70 },
        { time: 90, price: 60 },
    ],
    style: {},
};

describe("renderElliottDoubleCombo", () => {
    it("strokes one open polyline (1 beginPath / 1 moveTo / 6 lineTo / 1 stroke)", () => {
        const ctx = new MockCanvas2DContext();
        renderElliottDoubleCombo(ctx, emission(STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "beginPath")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "moveTo")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(6);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
    });

    it("labels every pivot with the default S/W/x1/X/x2/Yi/Y sequence", () => {
        const ctx = new MockCanvas2DContext();
        renderElliottDoubleCombo(ctx, emission(STATE), VIEW);
        const texts = ctx.calls
            .filter((c) => c.kind === "fillText")
            .map((c) => (c.kind === "fillText" ? c.text : ""));
        expect(texts).toEqual(["S", "W", "x1", "X", "x2", "Yi", "Y"]);
    });

    it("honours state.labels override when length matches", () => {
        const ctx = new MockCanvas2DContext();
        renderElliottDoubleCombo(
            ctx,
            emission({
                ...STATE,
                labels: ["0", "1", "2", "3", "4", "5", "6"],
            }),
            VIEW,
        );
        const texts = ctx.calls
            .filter((c) => c.kind === "fillText")
            .map((c) => (c.kind === "fillText" ? c.text : ""));
        expect(texts).toEqual(["0", "1", "2", "3", "4", "5", "6"]);
    });

    it("honours state.style.color overriding the teal default", () => {
        const ctx = new MockCanvas2DContext();
        renderElliottDoubleCombo(ctx, emission({ ...STATE, style: { color: "#abcdef" } }), VIEW);
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (stroke?.kind === "set") expect(stroke.value).toBe("#abcdef");
    });

    it("defaults to elliott teal #14b8a6", () => {
        const ctx = new MockCanvas2DContext();
        renderElliottDoubleCombo(ctx, emission(STATE), VIEW);
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (stroke?.kind === "set") expect(stroke.value).toBe("#14b8a6");
    });
});
