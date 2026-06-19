// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { FillBetweenState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords.js";
import { MockCanvas2DContext } from "../../testing.js";
import { renderFillBetween } from "./fillBetween.js";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: FillBetweenState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "fill-between",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

describe("renderFillBetween", () => {
    it("fills a closed polygon (edgeA forward then edgeB reversed)", () => {
        const ctx = new MockCanvas2DContext();
        renderFillBetween(
            ctx,
            emission({
                kind: "fill-between",
                edgeA: [
                    { time: 0, price: 80 },
                    { time: 100, price: 80 },
                ],
                edgeB: [
                    { time: 0, price: 20 },
                    { time: 100, price: 20 },
                ],
                style: { fill: "#3b82f6", fillAlpha: 0.2 },
            }),
            VIEW,
        );
        expect(ctx.calls.filter((c) => c.kind === "closePath")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(1);
        // moveTo (edgeA[0]) + 3 lineTo (edgeA[1], edgeB[1], edgeB[0]).
        expect(ctx.calls.filter((c) => c.kind === "moveTo")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(3);
        const fillStyle = ctx.calls.find((c) => c.kind === "set" && c.prop === "fillStyle");
        if (fillStyle?.kind === "set") expect(fillStyle.value).toBe("#3b82f6");
        const alphaCalls = ctx.calls.filter((c) => c.kind === "set" && c.prop === "globalAlpha");
        expect(alphaCalls).toHaveLength(2);
        if (alphaCalls[0].kind === "set") expect(alphaCalls[0].value).toBe(0.2);
    });

    it("does not stroke when style.color is unset (fill-only band)", () => {
        const ctx = new MockCanvas2DContext();
        renderFillBetween(
            ctx,
            emission({
                kind: "fill-between",
                edgeA: [
                    { time: 0, price: 80 },
                    { time: 100, price: 80 },
                ],
                edgeB: [
                    { time: 0, price: 20 },
                    { time: 100, price: 20 },
                ],
                style: { fill: "#3b82f6" },
            }),
            VIEW,
        );
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(0);
        // fillAlpha defaults to 1 when omitted.
        const alphaCalls = ctx.calls.filter((c) => c.kind === "set" && c.prop === "globalAlpha");
        if (alphaCalls[0]?.kind === "set") expect(alphaCalls[0].value).toBe(1);
    });

    it("strokes the outline when style.color is set", () => {
        const ctx = new MockCanvas2DContext();
        renderFillBetween(
            ctx,
            emission({
                kind: "fill-between",
                edgeA: [
                    { time: 0, price: 80 },
                    { time: 100, price: 80 },
                ],
                edgeB: [
                    { time: 0, price: 20 },
                    { time: 100, price: 20 },
                ],
                style: { color: "#1e293b", lineWidth: 2, lineStyle: "dashed" },
            }),
            VIEW,
        );
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
        const strokeStyle = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (strokeStyle?.kind === "set") expect(strokeStyle.value).toBe("#1e293b");
        // No fill when style.fill is unset.
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
    });

    it("defaults the outline lineWidth to 1 when omitted", () => {
        const ctx = new MockCanvas2DContext();
        renderFillBetween(
            ctx,
            emission({
                kind: "fill-between",
                edgeA: [
                    { time: 0, price: 80 },
                    { time: 100, price: 80 },
                ],
                edgeB: [
                    { time: 0, price: 20 },
                    { time: 100, price: 20 },
                ],
                style: { color: "#1e293b" },
            }),
            VIEW,
        );
        const lineWidth = ctx.calls.find((c) => c.kind === "set" && c.prop === "lineWidth");
        if (lineWidth?.kind === "set") expect(lineWidth.value).toBe(1);
    });

    it("is a no-op when edgeA is empty (degenerate)", () => {
        const ctx = new MockCanvas2DContext();
        renderFillBetween(
            ctx,
            emission({
                kind: "fill-between",
                edgeA: [],
                edgeB: [{ time: 0, price: 20 }],
                style: { fill: "#3b82f6" },
            }),
            VIEW,
        );
        expect(ctx.calls).toEqual([]);
    });

    it("is a no-op when edgeB is empty (degenerate)", () => {
        const ctx = new MockCanvas2DContext();
        renderFillBetween(
            ctx,
            emission({
                kind: "fill-between",
                edgeA: [{ time: 0, price: 80 }],
                edgeB: [],
                style: { fill: "#3b82f6" },
            }),
            VIEW,
        );
        expect(ctx.calls).toEqual([]);
    });

    it("is a no-op when an edgeA anchor maps to a non-finite x (NaN time)", () => {
        const ctx = new MockCanvas2DContext();
        renderFillBetween(
            ctx,
            emission({
                kind: "fill-between",
                edgeA: [{ time: Number.NaN, price: 80 }],
                edgeB: [{ time: 0, price: 20 }],
                style: { fill: "#3b82f6" },
            }),
            VIEW,
        );
        expect(ctx.calls).toEqual([]);
    });

    it("is a no-op when an edgeB anchor maps to a non-finite y (NaN price)", () => {
        const ctx = new MockCanvas2DContext();
        renderFillBetween(
            ctx,
            emission({
                kind: "fill-between",
                edgeA: [{ time: 0, price: 80 }],
                edgeB: [{ time: 0, price: Number.NaN }],
                style: { fill: "#3b82f6" },
            }),
            VIEW,
        );
        expect(ctx.calls).toEqual([]);
    });
});
