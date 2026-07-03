// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { MockCanvas2DContext } from "../testing.js";
import type { Viewport } from "./coords.js";
import { type OhlcBarArgs, drawOhlcBar } from "./ohlcBar.js";

// priceToY(p) === 100 - p under this viewport (yMin 0, yMax 100, pxHeight 100).
const VIEWPORT: Viewport = { xMin: 0, xMax: 10, yMin: 0, yMax: 100, pxWidth: 100, pxHeight: 100 };

function args(overrides: Partial<OhlcBarArgs> = {}): OhlcBarArgs {
    return {
        x: 50,
        open: 40,
        high: 60,
        low: 30,
        close: 50,
        color: "#f0a",
        barCount: 10,
        ...overrides,
    };
}

describe("drawOhlcBar", () => {
    it("strokes the high-low line plus open (left) and close (right) ticks", () => {
        const ctx = new MockCanvas2DContext();
        drawOhlcBar(ctx, args(), VIEWPORT);
        expect(ctx.calls).toEqual([
            { kind: "set", prop: "strokeStyle", value: "#f0a" },
            { kind: "beginPath" },
            { kind: "moveTo", x: 50, y: 40 },
            { kind: "lineTo", x: 50, y: 70 },
            { kind: "moveTo", x: 47, y: 60 },
            { kind: "lineTo", x: 50, y: 60 },
            { kind: "moveTo", x: 50, y: 50 },
            { kind: "lineTo", x: 53, y: 50 },
            { kind: "stroke" },
        ]);
    });

    it("prefers upColor on an up bar and downColor on a down bar", () => {
        const up = new MockCanvas2DContext();
        drawOhlcBar(up, args({ upColor: "#0f0", downColor: "#f00" }), VIEWPORT);
        expect(up.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#0f0" });

        const down = new MockCanvas2DContext();
        drawOhlcBar(
            down,
            args({ open: 50, close: 40, upColor: "#0f0", downColor: "#f00" }),
            VIEWPORT,
        );
        expect(down.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#f00" });
    });

    it("falls back to color when the directional override is absent", () => {
        const up = new MockCanvas2DContext();
        drawOhlcBar(up, args(), VIEWPORT);
        expect(up.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#f0a" });

        const down = new MockCanvas2DContext();
        drawOhlcBar(down, args({ open: 50, close: 40 }), VIEWPORT);
        expect(down.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#f0a" });
    });

    it("draws nothing for an all-null gap bar", () => {
        const ctx = new MockCanvas2DContext();
        drawOhlcBar(ctx, args({ open: null, high: null, low: null, close: null }), VIEWPORT);
        expect(ctx.calls).toEqual([]);
    });

    it("draws nothing when any single OHLC field is null", () => {
        for (const gap of [
            { open: null },
            { high: null },
            { low: null },
            { close: null },
        ] as const) {
            const ctx = new MockCanvas2DContext();
            drawOhlcBar(ctx, args(gap), VIEWPORT);
            expect(ctx.calls).toEqual([]);
        }
    });
});
