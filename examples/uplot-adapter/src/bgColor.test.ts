// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Viewport } from "@invinite-org/chartlang-adapter-kit";
import { MockCanvasContext } from "@invinite-org/chartlang-adapter-kit/canvas";
import { describe, expect, it } from "vitest";

import { type BgColorBand, drawBgColorBand } from "./bgColor.js";

// A viewport with one bar at the centre of a 100×200 plotting area.
const VIEWPORT: Viewport = {
    xMin: 0,
    xMax: 10,
    yMin: 0,
    yMax: 100,
    pxWidth: 100,
    pxHeight: 200,
};

describe("drawBgColorBand", () => {
    it("paints a full-pane-height band centred on the bar, with transp→alpha", () => {
        const ctx = new MockCanvasContext();
        const band: BgColorBand = { time: 5, color: "#26a69a", transp: 85 };
        // barCount 2 ⇒ width = pxWidth / 2 = 50; centred on x = timeToX(5) = 50
        // ⇒ left edge 50 - 25 = 25; offset dx = 0.
        drawBgColorBand(ctx, band, VIEWPORT, 0, 2);
        expect(ctx.calls).toEqual([
            { kind: "set", prop: "globalAlpha", value: 1 - 85 / 100 },
            { kind: "set", prop: "fillStyle", value: "#26a69a" },
            { kind: "fillRect", x: 25, y: 0, w: 50, h: 200 },
            { kind: "set", prop: "globalAlpha", value: 1 },
        ]);
    });

    it("treats an omitted transp as fully opaque (alpha 1)", () => {
        const ctx = new MockCanvasContext();
        const band: BgColorBand = { time: 0, color: "#ef5350" };
        drawBgColorBand(ctx, band, VIEWPORT, 0, 1);
        const alphaSets = ctx.calls.filter((c) => c.kind === "set" && c.prop === "globalAlpha");
        // Open with alpha 1, close back to 1.
        expect(alphaSets).toEqual([
            { kind: "set", prop: "globalAlpha", value: 1 },
            { kind: "set", prop: "globalAlpha", value: 1 },
        ]);
    });

    it("shifts the band by the device-px plotting-area offset dx", () => {
        const ctx = new MockCanvasContext();
        const band: BgColorBand = { time: 0, color: "#00f" };
        // dx = 12 ⇒ x = timeToX(0)=0 + 12 - width/2.
        drawBgColorBand(ctx, band, VIEWPORT, 12, 4);
        const rect = ctx.calls.find((c) => c.kind === "fillRect");
        // width = 100/4 = 25 ⇒ x = 0 + 12 - 12.5 = -0.5.
        expect(rect).toEqual({ kind: "fillRect", x: -0.5, y: 0, w: 25, h: 200 });
    });

    it("guards a zero barCount to a single full-width band", () => {
        const ctx = new MockCanvasContext();
        const band: BgColorBand = { time: 0, color: "#0f0" };
        drawBgColorBand(ctx, band, VIEWPORT, 0, 0);
        const rect = ctx.calls.find((c) => c.kind === "fillRect");
        // Math.max(1, 0) ⇒ width = pxWidth = 100.
        expect(rect).toEqual({ kind: "fillRect", x: -50, y: 0, w: 100, h: 200 });
    });
});
