// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { MockCanvas2DContext } from "../../testing.js";
import type { Point2 } from "./bezier.js";
import { renderNamedPolyline } from "./namedPolyline.js";

const POINTS: ReadonlyArray<Point2> = [
    { x: 0, y: 0 },
    { x: 100, y: 50 },
    { x: 200, y: 20 },
];
const LABELS: ReadonlyArray<string> = ["A", "B", "C"];

describe("renderNamedPolyline", () => {
    it("strokes one open polyline through the points", () => {
        const ctx = new MockCanvas2DContext();
        renderNamedPolyline(ctx, POINTS, LABELS, {});
        expect(ctx.calls.filter((c) => c.kind === "beginPath")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "moveTo")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(2);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "closePath")).toHaveLength(0);
    });

    it("emits exactly one fillText per label", () => {
        const ctx = new MockCanvas2DContext();
        renderNamedPolyline(ctx, POINTS, LABELS, {});
        const fillTexts = ctx.calls.filter((c) => c.kind === "fillText");
        expect(fillTexts).toHaveLength(3);
        const texts = fillTexts.map((c) => (c.kind === "fillText" ? c.text : ""));
        expect(texts).toEqual(["A", "B", "C"]);
    });

    it("places each label 6 px above its anchor (textBaseline: bottom)", () => {
        const ctx = new MockCanvas2DContext();
        renderNamedPolyline(ctx, POINTS, LABELS, {});
        const fillTexts = ctx.calls.filter((c) => c.kind === "fillText");
        for (let i = 0; i < fillTexts.length; i++) {
            const call = fillTexts[i];
            if (call.kind !== "fillText") continue;
            expect(call.x).toBe(POINTS[i].x);
            expect(call.y).toBe(POINTS[i].y - 6);
        }
        const baselineCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "textBaseline");
        if (baselineCall?.kind === "set") expect(baselineCall.value).toBe("bottom");
        const alignCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "textAlign");
        if (alignCall?.kind === "set") expect(alignCall.value).toBe("center");
    });

    it("defaults strokeStyle + fillStyle to pattern amber #f59e0b", () => {
        const ctx = new MockCanvas2DContext();
        renderNamedPolyline(ctx, POINTS, LABELS, {});
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        const fill = ctx.calls.find((c) => c.kind === "set" && c.prop === "fillStyle");
        if (stroke?.kind === "set") expect(stroke.value).toBe("#f59e0b");
        if (fill?.kind === "set") expect(fill.value).toBe("#f59e0b");
    });

    it("honours style.color + style.lineWidth", () => {
        const ctx = new MockCanvas2DContext();
        renderNamedPolyline(ctx, POINTS, LABELS, { color: "#123456", lineWidth: 3 });
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        const width = ctx.calls.find((c) => c.kind === "set" && c.prop === "lineWidth");
        if (stroke?.kind === "set") expect(stroke.value).toBe("#123456");
        if (width?.kind === "set") expect(width.value).toBe(3);
    });

    it("is a no-op when points is empty", () => {
        const ctx = new MockCanvas2DContext();
        renderNamedPolyline(ctx, [], [], {});
        expect(ctx.calls).toEqual([]);
    });

    it("supports a single-point polyline (no lineTo, but one label)", () => {
        const ctx = new MockCanvas2DContext();
        renderNamedPolyline(ctx, [{ x: 5, y: 10 }], ["X"], {});
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(0);
        expect(ctx.calls.filter((c) => c.kind === "moveTo")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "fillText")).toHaveLength(1);
    });
});
