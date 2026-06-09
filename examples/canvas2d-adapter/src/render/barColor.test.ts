// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { MockCanvas2DContext } from "../testing";
import { drawBarColor } from "./barColor";
import type { Viewport } from "./coords";

const VIEWPORT: Viewport = { xMin: 0, xMax: 10, yMin: 0, yMax: 100, pxWidth: 100, pxHeight: 100 };
const BAR = { time: 5, open: 40, high: 60, low: 30, close: 50, volume: 1, interval: "1D" };

describe("drawBarColor", () => {
    it("uses the OHLC outline path", () => {
        const ctx = new MockCanvas2DContext();
        drawBarColor(ctx, { bar: BAR, color: "#a0a", barCount: 10 }, VIEWPORT);
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#a0a" });
        expect(ctx.calls.at(-1)).toEqual({ kind: "stroke" });
    });
});
