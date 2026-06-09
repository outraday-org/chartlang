// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { MockCanvas2DContext } from "../testing";
import { drawBarOverride } from "./barOverride";
import type { Viewport } from "./coords";

const VIEWPORT: Viewport = { xMin: 0, xMax: 10, yMin: 0, yMax: 100, pxWidth: 100, pxHeight: 100 };
const BAR = { time: 5, open: 40, high: 60, low: 30, close: 50, volume: 1, interval: "1D" };

describe("drawBarOverride", () => {
    it("draws a deterministic OHLC outline", () => {
        const ctx = new MockCanvas2DContext();
        drawBarOverride(ctx, { bar: BAR, color: "#fff", barCount: 10 }, VIEWPORT);
        expect(ctx.calls.map((c) => c.kind)).toEqual([
            "set",
            "beginPath",
            "moveTo",
            "lineTo",
            "moveTo",
            "lineTo",
            "moveTo",
            "lineTo",
            "stroke",
        ]);
        expect(ctx.calls[2]).toEqual({ kind: "moveTo", x: 50, y: 40 });
    });
});
