// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { ElliottTriangleWaveState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { renderElliottTriangleWave } from "./elliottTriangleWave";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: ElliottTriangleWaveState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "elliott-triangle-wave",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

const STATE: ElliottTriangleWaveState = {
    kind: "elliott-triangle-wave",
    anchors: [
        { time: 0, price: 60 },
        { time: 20, price: 20 },
        { time: 40, price: 55 },
        { time: 60, price: 25 },
        { time: 80, price: 40 },
    ],
    style: {},
};

describe("renderElliottTriangleWave", () => {
    it("strokes one open polyline (1 beginPath / 1 moveTo / 4 lineTo / 1 stroke)", () => {
        const ctx = new MockCanvas2DContext();
        renderElliottTriangleWave(ctx, emission(STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "beginPath")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "moveTo")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(4);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
    });

    it("labels every pivot with a..e by default", () => {
        const ctx = new MockCanvas2DContext();
        renderElliottTriangleWave(ctx, emission(STATE), VIEW);
        const texts = ctx.calls
            .filter((c) => c.kind === "fillText")
            .map((c) => (c.kind === "fillText" ? c.text : ""));
        expect(texts).toEqual(["a", "b", "c", "d", "e"]);
    });

    it("honours state.labels override when length matches", () => {
        const ctx = new MockCanvas2DContext();
        renderElliottTriangleWave(
            ctx,
            emission({ ...STATE, labels: ["A", "B", "C", "D", "E"] }),
            VIEW,
        );
        const texts = ctx.calls
            .filter((c) => c.kind === "fillText")
            .map((c) => (c.kind === "fillText" ? c.text : ""));
        expect(texts).toEqual(["A", "B", "C", "D", "E"]);
    });

    it("honours state.style.color overriding the teal default", () => {
        const ctx = new MockCanvas2DContext();
        renderElliottTriangleWave(
            ctx,
            emission({ ...STATE, style: { color: "#abcdef" } }),
            VIEW,
        );
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (stroke?.kind === "set") expect(stroke.value).toBe("#abcdef");
    });

    it("defaults to elliott teal #14b8a6", () => {
        const ctx = new MockCanvas2DContext();
        renderElliottTriangleWave(ctx, emission(STATE), VIEW);
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (stroke?.kind === "set") expect(stroke.value).toBe("#14b8a6");
    });
});
