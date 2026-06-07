// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { ElliottCorrectionWaveState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { renderElliottCorrectionWave } from "./elliottCorrectionWave";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: ElliottCorrectionWaveState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "elliott-correction-wave",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

const STATE: ElliottCorrectionWaveState = {
    kind: "elliott-correction-wave",
    anchors: [
        { time: 0, price: 60 },
        { time: 30, price: 20 },
        { time: 60, price: 40 },
    ],
    style: {},
};

describe("renderElliottCorrectionWave", () => {
    it("strokes one open polyline (1 beginPath / 1 moveTo / 2 lineTo / 1 stroke)", () => {
        const ctx = new MockCanvas2DContext();
        renderElliottCorrectionWave(ctx, emission(STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "beginPath")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "moveTo")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(2);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
    });

    it("labels every pivot with A, B, C by default", () => {
        const ctx = new MockCanvas2DContext();
        renderElliottCorrectionWave(ctx, emission(STATE), VIEW);
        const texts = ctx.calls
            .filter((c) => c.kind === "fillText")
            .map((c) => (c.kind === "fillText" ? c.text : ""));
        expect(texts).toEqual(["A", "B", "C"]);
    });

    it("honours state.labels override when length matches", () => {
        const ctx = new MockCanvas2DContext();
        renderElliottCorrectionWave(
            ctx,
            emission({ ...STATE, labels: ["α", "β", "γ"] }),
            VIEW,
        );
        const texts = ctx.calls
            .filter((c) => c.kind === "fillText")
            .map((c) => (c.kind === "fillText" ? c.text : ""));
        expect(texts).toEqual(["α", "β", "γ"]);
    });

    it("honours state.style.color overriding the teal default", () => {
        const ctx = new MockCanvas2DContext();
        renderElliottCorrectionWave(
            ctx,
            emission({ ...STATE, style: { color: "#abcdef" } }),
            VIEW,
        );
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (stroke?.kind === "set") expect(stroke.value).toBe("#abcdef");
    });

    it("defaults to elliott teal #14b8a6", () => {
        const ctx = new MockCanvas2DContext();
        renderElliottCorrectionWave(ctx, emission(STATE), VIEW);
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (stroke?.kind === "set") expect(stroke.value).toBe("#14b8a6");
    });
});
