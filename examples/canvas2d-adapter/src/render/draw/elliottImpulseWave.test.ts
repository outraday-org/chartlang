// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { ElliottImpulseWaveState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { renderElliottImpulseWave } from "./elliottImpulseWave";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: ElliottImpulseWaveState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "elliott-impulse-wave",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

const STATE: ElliottImpulseWaveState = {
    kind: "elliott-impulse-wave",
    anchors: [
        { time: 0, price: 0 },
        { time: 20, price: 50 },
        { time: 40, price: 25 },
        { time: 60, price: 75 },
        { time: 80, price: 40 },
    ],
    style: {},
};

describe("renderElliottImpulseWave", () => {
    it("strokes one open polyline (1 beginPath / 1 moveTo / 4 lineTo / 1 stroke)", () => {
        const ctx = new MockCanvas2DContext();
        renderElliottImpulseWave(ctx, emission(STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "beginPath")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "moveTo")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(4);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
    });

    it("labels every pivot with the default 1..5 sequence", () => {
        const ctx = new MockCanvas2DContext();
        renderElliottImpulseWave(ctx, emission(STATE), VIEW);
        const texts = ctx.calls
            .filter((c) => c.kind === "fillText")
            .map((c) => (c.kind === "fillText" ? c.text : ""));
        expect(texts).toEqual(["1", "2", "3", "4", "5"]);
    });

    it("honours state.labels override when length matches", () => {
        const ctx = new MockCanvas2DContext();
        renderElliottImpulseWave(
            ctx,
            emission({ ...STATE, labels: ["I", "II", "III", "IV", "V"] }),
            VIEW,
        );
        const texts = ctx.calls
            .filter((c) => c.kind === "fillText")
            .map((c) => (c.kind === "fillText" ? c.text : ""));
        expect(texts).toEqual(["I", "II", "III", "IV", "V"]);
    });

    it("honours state.style.color overriding the teal default", () => {
        const ctx = new MockCanvas2DContext();
        renderElliottImpulseWave(
            ctx,
            emission({ ...STATE, style: { color: "#abcdef" } }),
            VIEW,
        );
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (stroke?.kind === "set") expect(stroke.value).toBe("#abcdef");
    });

    it("defaults to elliott teal #14b8a6", () => {
        const ctx = new MockCanvas2DContext();
        renderElliottImpulseWave(ctx, emission(STATE), VIEW);
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (stroke?.kind === "set") expect(stroke.value).toBe("#14b8a6");
    });

    it("emits no fills (stroked-only)", () => {
        const ctx = new MockCanvas2DContext();
        renderElliottImpulseWave(ctx, emission(STATE), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
    });
});
