// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { MockCanvas2DContext } from "../../testing.js";
import { applyShapeStyle } from "./shapeStyle.js";

describe("applyShapeStyle", () => {
    it("sets strokeStyle / lineWidth / setLineDash from the style", () => {
        const ctx = new MockCanvas2DContext();
        applyShapeStyle(ctx, { stroke: "#3b82f6", lineWidth: 2, lineStyle: "dashed" });
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#3b82f6" });
        expect(ctx.calls[1]).toEqual({ kind: "set", prop: "lineWidth", value: 2 });
        const dash = ctx.calls[2];
        if (dash.kind === "setLineDash") {
            expect(dash.segments).toEqual([6, 4]);
        } else {
            throw new Error("expected setLineDash call");
        }
    });

    it("defaults stroke to #000000, lineWidth to 1, lineStyle to solid", () => {
        const ctx = new MockCanvas2DContext();
        applyShapeStyle(ctx, {});
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#000000" });
        expect(ctx.calls[1]).toEqual({ kind: "set", prop: "lineWidth", value: 1 });
        const dash = ctx.calls[2];
        if (dash.kind === "setLineDash") {
            expect(dash.segments).toEqual([]);
        } else {
            throw new Error("expected setLineDash call");
        }
    });

    it("reports hasFill: false when fill is omitted", () => {
        const ctx = new MockCanvas2DContext();
        const applied = applyShapeStyle(ctx, { stroke: "#fff" });
        expect(applied.hasFill).toBe(false);
        expect(applied.fillColor).toBe("#000000");
        expect(applied.fillAlpha).toBe(1);
    });

    it("reports hasFill: true with fillColor + fillAlpha when fill is present", () => {
        const ctx = new MockCanvas2DContext();
        const applied = applyShapeStyle(ctx, { fill: "#dbeafe", fillAlpha: 0.4 });
        expect(applied.hasFill).toBe(true);
        expect(applied.fillColor).toBe("#dbeafe");
        expect(applied.fillAlpha).toBe(0.4);
    });

    it("defaults fillAlpha to 1 when fill is present but fillAlpha is omitted", () => {
        const ctx = new MockCanvas2DContext();
        const applied = applyShapeStyle(ctx, { fill: "#fef3c7" });
        expect(applied.fillAlpha).toBe(1);
    });
});
