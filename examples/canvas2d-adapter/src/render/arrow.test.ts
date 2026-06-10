// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { DEFAULT_PALETTE } from "../palette.js";
import { MockCanvas2DContext } from "../testing.js";
import { drawArrow } from "./arrow.js";

describe("drawArrow", () => {
    it("renders an up arrow as a filled triangle", () => {
        const ctx = new MockCanvas2DContext();
        drawArrow(ctx, { x: 10, y: 20, direction: "up", size: 8, color: null }, DEFAULT_PALETTE);
        expect(ctx.calls).toEqual([
            { kind: "set", prop: "fillStyle", value: DEFAULT_PALETTE.plotDefault },
            { kind: "beginPath" },
            { kind: "moveTo", x: 10, y: 16 },
            { kind: "lineTo", x: 14, y: 24 },
            { kind: "lineTo", x: 6, y: 24 },
            { kind: "closePath" },
            { kind: "fill" },
        ]);
    });

    it("renders a down arrow branch", () => {
        const ctx = new MockCanvas2DContext();
        drawArrow(
            ctx,
            { x: 10, y: 20, direction: "down", size: 8, color: "#fff" },
            DEFAULT_PALETTE,
        );
        expect(ctx.calls[2]).toEqual({ kind: "moveTo", x: 10, y: 24 });
    });
});
