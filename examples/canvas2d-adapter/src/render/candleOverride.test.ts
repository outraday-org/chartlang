// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { MockCanvas2DContext } from "../testing.js";
import { drawCandleOverride } from "./candleOverride.js";
import type { Viewport } from "./coords.js";

const VIEWPORT: Viewport = { xMin: 0, xMax: 10, yMin: 0, yMax: 100, pxWidth: 100, pxHeight: 100 };
const BAR = { time: 5, open: 40, high: 60, low: 30, close: 50, volume: 1, interval: "1D" };

describe("drawCandleOverride", () => {
    it("paints a bullish candle body with bull color", () => {
        const ctx = new MockCanvas2DContext();
        drawCandleOverride(ctx, { bar: BAR, bull: "#0f0", bear: "#f00", barCount: 10 }, VIEWPORT);
        expect(ctx.calls).toEqual([
            { kind: "set", prop: "fillStyle", value: "#0f0" },
            { kind: "fillRect", x: 47, y: 50, w: 6, h: 10 },
        ]);
    });

    it("paints bearish and doji branches", () => {
        const bear = new MockCanvas2DContext();
        drawCandleOverride(
            bear,
            { bar: { ...BAR, open: 50, close: 40 }, bull: "#0f0", bear: "#f00", barCount: 10 },
            VIEWPORT,
        );
        expect(bear.calls[0]).toEqual({ kind: "set", prop: "fillStyle", value: "#f00" });

        const doji = new MockCanvas2DContext();
        drawCandleOverride(
            doji,
            {
                bar: { ...BAR, open: 40, close: 40 },
                bull: "#0f0",
                bear: "#f00",
                doji: "#999",
                barCount: 10,
            },
            VIEWPORT,
        );
        expect(doji.calls[0]).toEqual({ kind: "set", prop: "fillStyle", value: "#999" });

        const dojiFallback = new MockCanvas2DContext();
        drawCandleOverride(
            dojiFallback,
            { bar: { ...BAR, open: 40, close: 40 }, bull: "#0f0", bear: "#f00", barCount: 10 },
            VIEWPORT,
        );
        expect(dojiFallback.calls[0]).toEqual({ kind: "set", prop: "fillStyle", value: "#0f0" });
    });
});
