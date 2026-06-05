// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { DEFAULT_PALETTE } from "../palette";
import { MockCanvas2DContext } from "../testing";
import { drawHistogram } from "./histogram";

describe("drawHistogram", () => {
    it("emits one fillStyle set + one fillRect with the column centred on x", () => {
        const ctx = new MockCanvas2DContext();
        drawHistogram(
            ctx,
            { x: 100, y: 40, baseline: 80, color: "#26a69a", width: 6 },
            DEFAULT_PALETTE,
        );
        expect(ctx.calls).toEqual([
            { kind: "set", prop: "fillStyle", value: "#26a69a" },
            // top = min(40, 80) = 40; height = |40 - 80| = 40; x = 100 - 6/2 = 97.
            { kind: "fillRect", x: 97, y: 40, w: 6, h: 40 },
        ]);
    });

    it("flips the rectangle correctly when y is below baseline (negative column)", () => {
        const ctx = new MockCanvas2DContext();
        drawHistogram(
            ctx,
            { x: 50, y: 100, baseline: 60, color: "#ef5350", width: 4 },
            DEFAULT_PALETTE,
        );
        // top = min(100, 60) = 60; height = |100 - 60| = 40; x = 50 - 4/2 = 48.
        const rect = ctx.calls.find((c) => c.kind === "fillRect");
        expect(rect).toEqual({ kind: "fillRect", x: 48, y: 60, w: 4, h: 40 });
    });

    it("emits a zero-height fillRect when y === baseline (degenerate column)", () => {
        const ctx = new MockCanvas2DContext();
        drawHistogram(
            ctx,
            { x: 10, y: 50, baseline: 50, color: "#abcdef", width: 2 },
            DEFAULT_PALETTE,
        );
        const rect = ctx.calls.find((c) => c.kind === "fillRect");
        expect(rect).toEqual({ kind: "fillRect", x: 9, y: 50, w: 2, h: 0 });
    });

    it("falls back to palette.plotDefault when color is null", () => {
        const ctx = new MockCanvas2DContext();
        drawHistogram(ctx, { x: 5, y: 0, baseline: 10, color: null, width: 2 }, DEFAULT_PALETTE);
        const setFill = ctx.calls.find((c) => c.kind === "set" && c.prop === "fillStyle");
        expect(setFill).toEqual({
            kind: "set",
            prop: "fillStyle",
            value: DEFAULT_PALETTE.plotDefault,
        });
    });
});
