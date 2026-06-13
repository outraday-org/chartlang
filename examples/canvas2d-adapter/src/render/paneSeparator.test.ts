// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { DEFAULT_PALETTE } from "../palette.js";
import { MockCanvas2DContext } from "../testing.js";
import { drawPaneSeparator } from "./paneSeparator.js";

describe("drawPaneSeparator", () => {
    it("emits the canonical strokeStyle / lineWidth / beginPath / moveTo / lineTo / stroke sequence", () => {
        const ctx = new MockCanvas2DContext();
        drawPaneSeparator(ctx, { x: 0, y: 280, w: 800, h: 120 }, DEFAULT_PALETTE);
        expect(ctx.calls).toEqual([
            { kind: "set", prop: "strokeStyle", value: DEFAULT_PALETTE.paneBorder },
            { kind: "set", prop: "lineWidth", value: 1 },
            { kind: "beginPath" },
            { kind: "moveTo", x: 0, y: 280.5 },
            { kind: "lineTo", x: 800, y: 280.5 },
            { kind: "stroke" },
        ]);
    });

    it("draws the line at rect.y + 0.5 for an offset rect", () => {
        const ctx = new MockCanvas2DContext();
        drawPaneSeparator(ctx, { x: 10, y: 100, w: 600, h: 50 }, DEFAULT_PALETTE);
        expect(ctx.calls).toContainEqual({ kind: "moveTo", x: 10, y: 100.5 });
        expect(ctx.calls).toContainEqual({ kind: "lineTo", x: 610, y: 100.5 });
    });
});
