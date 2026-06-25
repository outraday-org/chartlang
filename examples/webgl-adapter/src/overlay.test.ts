// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { RenderCtx } from "@invinite-org/chartlang-adapter-kit/canvas";
import { describe, expect, it, vi } from "vitest";

import type { AxisRenderInfo } from "./axes.js";
import { DEFAULT_PALETTE } from "./layer-descriptor.js";
import { axisLabelItems, createTextOverlay } from "./overlay.js";

// Recording stub `RenderCtx` — only the text + transform surface the overlay
// touches, with `vi.fn()` recorders. The same stub idiom as the renderer's
// stub-gl tests.
function stubCtx(): RenderCtx & {
    fillTextCalls: Array<{ text: string; x: number; y: number }>;
} {
    const fillTextCalls: Array<{ text: string; x: number; y: number }> = [];
    const ctx = {
        setTransform: vi.fn(),
        clearRect: vi.fn(),
        fillText: (text: string, x: number, y: number) => {
            fillTextCalls.push({ text, x, y });
        },
        // Setters the overlay assigns — plain fields are enough for a stub.
        font: "",
        fillStyle: "",
        textAlign: "left" as RenderCtx["textAlign"],
        textBaseline: "alphabetic" as RenderCtx["textBaseline"],
    } as unknown as RenderCtx & {
        fillTextCalls: Array<{ text: string; x: number; y: number }>;
    };
    return Object.assign(ctx, { fillTextCalls });
}

const overlayInfo: AxisRenderInfo = {
    paneKey: "overlay",
    cssRect: { x: 0, y: 0, width: 800, height: 400 },
    window: { xMin: 0, xMax: 100, yMin: 100, yMax: 200 },
    ticks: {
        priceTicks: [100, 150, 200],
        timeTicks: [0, 50, 100],
    },
};

describe("axisLabelItems", () => {
    it("projects each in-range price + time tick into a label", () => {
        const items = axisLabelItems(overlayInfo, "#cccccc");
        // 3 price + 3 time labels.
        expect(items.length).toBe(6);
    });

    it("places price labels in the right gutter and time labels along the bottom", () => {
        const items = axisLabelItems(overlayInfo, "#cccccc");
        const priceLabels = items.filter((i) => i.align === "left");
        const timeLabels = items.filter((i) => i.align === "center");
        expect(priceLabels.length).toBe(3);
        expect(timeLabels.length).toBe(3);
        // Price labels sit at x = pane width + gap (806), beyond the plot edge.
        for (const p of priceLabels) expect(p.x).toBe(806);
        // Time labels sit below the plot (y > pane height).
        for (const t of timeLabels) expect(t.y).toBeGreaterThan(400);
    });

    it("pins the top / bottom price labels inside the pane (baseline)", () => {
        const items = axisLabelItems(overlayInfo, "#cccccc");
        const priceLabels = items.filter((i) => i.align === "left");
        // yMax (200) projects to y=0 (top); yMin (100) to y=400 (bottom).
        const top = priceLabels.find((p) => p.y === 0);
        const bottom = priceLabels.find((p) => p.y === 400);
        expect(top?.baseline).toBe("top");
        expect(bottom?.baseline).toBe("bottom");
    });

    it("offsets a sub-pane's labels by its cssRect origin", () => {
        const sub: AxisRenderInfo = {
            ...overlayInfo,
            paneKey: "rsi",
            cssRect: { x: 0, y: 420, width: 800, height: 120 },
        };
        const items = axisLabelItems(sub, "#cccccc");
        // Every label's y is shifted down by the pane's y origin (>= 420).
        for (const i of items) expect(i.y).toBeGreaterThanOrEqual(420);
    });

    it("drops ticks projected outside the pane box", () => {
        const info: AxisRenderInfo = {
            ...overlayInfo,
            ticks: { priceTicks: [50, 150, 300], timeTicks: [-10, 50, 200] },
        };
        const items = axisLabelItems(info, "#cccccc");
        // Only the in-range price (150) + time (50) survive.
        expect(items.length).toBe(2);
    });
});

describe("createTextOverlay", () => {
    it("paints axis labels through the ctx", () => {
        const ctx = stubCtx();
        const overlay = createTextOverlay({ ctx, cssWidth: 800, cssHeight: 400, dpr: 1 });
        overlay.paintAxisLabels(overlayInfo, DEFAULT_PALETTE);
        expect(ctx.fillTextCalls.length).toBe(6);
        // Labels carry the formatted price text.
        expect(ctx.fillTextCalls.some((c) => c.text === "100")).toBe(true);
    });

    it("clear() resets transform, clears the backing store, re-applies dpr", () => {
        const ctx = stubCtx();
        const overlay = createTextOverlay({ ctx, cssWidth: 320, cssHeight: 240, dpr: 2 });
        overlay.clear();
        expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0);
        expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 640, 480);
        expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    });

    it("paintText writes each item with its align / baseline", () => {
        const ctx = stubCtx();
        const overlay = createTextOverlay({ ctx, cssWidth: 100, cssHeight: 100, dpr: 1 });
        overlay.paintText([{ x: 4, y: 12, text: "hi", color: "#fff" }]);
        expect(ctx.fillTextCalls).toEqual([{ text: "hi", x: 4, y: 12 }]);
    });

    it("dispose() is a no-op without an owned canvas", () => {
        const ctx = stubCtx();
        const overlay = createTextOverlay({ ctx, cssWidth: 100, cssHeight: 100, dpr: 1 });
        expect(() => overlay.dispose()).not.toThrow();
    });
});
