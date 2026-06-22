// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { MockCanvas2DContext } from "../testing.js";
import { drawBgColor } from "./bgColor.js";
import type { Viewport } from "./coords.js";

const VIEWPORT: Viewport = { xMin: 0, xMax: 10, yMin: 0, yMax: 1, pxWidth: 100, pxHeight: 50 };

describe("drawBgColor", () => {
    it("paints a translucent bar-width band and restores alpha", () => {
        const ctx = new MockCanvas2DContext();
        drawBgColor(ctx, { time: 5, color: "#00f", transp: 75, barCount: 10 }, VIEWPORT);
        expect(ctx.calls).toEqual([
            { kind: "set", prop: "globalAlpha", value: 0.25 },
            { kind: "set", prop: "fillStyle", value: "#00f" },
            { kind: "fillRect", x: 45, y: 0, w: 10, h: 50 },
            { kind: "set", prop: "globalAlpha", value: 1 },
        ]);
    });

    it("defaults transparency to opaque", () => {
        const ctx = new MockCanvas2DContext();
        drawBgColor(ctx, { time: 5, color: "#00f", barCount: 10 }, VIEWPORT);
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "globalAlpha", value: 1 });
    });

    it("prefers the per-bar colorValue over the static color", () => {
        const ctx = new MockCanvas2DContext();
        drawBgColor(
            ctx,
            { time: 5, color: "#00f", colorValue: "#16a34a", transp: 75, barCount: 10 },
            VIEWPORT,
        );
        expect(ctx.calls[1]).toEqual({ kind: "set", prop: "fillStyle", value: "#16a34a" });
    });

    it("skips the fill entirely for an explicit colorValue gap (null)", () => {
        const ctx = new MockCanvas2DContext();
        drawBgColor(
            ctx,
            { time: 5, color: "#00f", colorValue: null, transp: 75, barCount: 10 },
            VIEWPORT,
        );
        expect(ctx.calls).toEqual([]);
    });
});
