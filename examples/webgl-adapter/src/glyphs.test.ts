// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { AlertEmission, PlotEmission, PlotStyle } from "@invinite-org/chartlang-adapter-kit";
import type { RenderCtx } from "@invinite-org/chartlang-adapter-kit/canvas";
import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { AxisRenderInfo } from "./axes.js";
import {
    alertBadgeAnchor,
    dispatchGlyph,
    glyphAnchor,
    isGlyphOverlay,
    paintAlertBadge,
    paneViewportFromInfo,
} from "./glyphs.js";
import { DEFAULT_PALETTE } from "./layer-descriptor.js";

// 3 bars at evenly-spaced times; the overlay window frames compressed bar slots
// 0..2 over an 800×400 CSS box, so bar 1 projects to x 400.
const BARS: Bar[] = [
    { time: 0, open: 10, high: 12, low: 9, close: 11 },
    { time: 100, open: 11, high: 14, low: 10, close: 13 },
    { time: 200, open: 13, high: 15, low: 12, close: 14 },
];

const INFO: AxisRenderInfo = {
    paneKey: "overlay",
    cssRect: { x: 0, y: 0, width: 800, height: 400 },
    window: { xMin: 0, xMax: 2, yMin: 10, yMax: 20 },
    ticks: { priceTicks: [], timeTicks: [] },
};

const SPACING = 100;

function emission(style: PlotStyle, over: Partial<PlotEmission> = {}): PlotEmission {
    return {
        kind: "plot",
        slotId: "s#0",
        title: "t",
        style,
        bar: 1,
        time: 100,
        value: 15,
        color: "#26a69a",
        meta: {},
        pane: "overlay",
        ...over,
    };
}

// Recording stub RenderCtx — the glyph helpers touch the path / text / setter
// surface; record fillText + arc + the call sequence so the dispatch routing is
// observable without asserting the (shared, already-tested) glyph geometry.
function stubCtx(): RenderCtx & {
    calls: string[];
    fillTexts: Array<{ text: string; x: number; y: number }>;
    arcs: Array<{ x: number; y: number; r: number }>;
} {
    const calls: string[] = [];
    const fillTexts: Array<{ text: string; x: number; y: number }> = [];
    const arcs: Array<{ x: number; y: number; r: number }> = [];
    const rec =
        (name: string) =>
        (...args: unknown[]) => {
            calls.push(name);
            void args;
        };
    const ctx = {
        beginPath: rec("beginPath"),
        moveTo: rec("moveTo"),
        lineTo: rec("lineTo"),
        closePath: rec("closePath"),
        stroke: rec("stroke"),
        fill: rec("fill"),
        fillRect: rec("fillRect"),
        arc: (x: number, y: number, r: number) => {
            calls.push("arc");
            arcs.push({ x, y, r });
        },
        fillText: (text: string, x: number, y: number) => {
            calls.push("fillText");
            fillTexts.push({ text, x, y });
        },
        strokeStyle: "",
        fillStyle: "",
        lineWidth: 0,
        font: "",
        textAlign: "left" as RenderCtx["textAlign"],
        textBaseline: "alphabetic" as RenderCtx["textBaseline"],
    } as unknown as RenderCtx & {
        calls: string[];
        fillTexts: Array<{ text: string; x: number; y: number }>;
        arcs: Array<{ x: number; y: number; r: number }>;
    };
    return Object.assign(ctx, { calls, fillTexts, arcs });
}

describe("paneViewportFromInfo", () => {
    it("maps the window + cssRect into a Viewport", () => {
        const vp = paneViewportFromInfo(INFO);
        expect(vp).toEqual({
            xMin: 0,
            xMax: 2,
            yMin: 10,
            yMax: 20,
            pxWidth: 800,
            pxHeight: 400,
        });
    });
});

describe("isGlyphOverlay", () => {
    it("selects the five glyph styles and rejects the rest", () => {
        expect(isGlyphOverlay({ kind: "marker", shape: "circle", size: 6 })).toBe(true);
        expect(isGlyphOverlay({ kind: "shape", shape: "flag", size: 8 })).toBe(true);
        expect(isGlyphOverlay({ kind: "character", char: "A", size: 12 })).toBe(true);
        expect(isGlyphOverlay({ kind: "arrow", direction: "up", size: 10 })).toBe(true);
        expect(isGlyphOverlay({ kind: "label", text: "x", position: "above" })).toBe(true);
        expect(isGlyphOverlay({ kind: "line" })).toBe(false);
        expect(isGlyphOverlay({ kind: "horizontal-line", lineWidth: 1, lineStyle: "solid" })).toBe(
            false,
        );
    });
});

describe("glyphAnchor", () => {
    it("projects the shifted bar point to a CSS-pixel anchor", () => {
        const e = emission({ kind: "marker", shape: "circle", size: 6 });
        // bar 1 → x = 1/2 * 800 = 400; value 15 → y = (20-15)/(20-10)*400 = 200.
        const anchor = glyphAnchor(e, INFO, BARS, SPACING);
        expect(anchor).toEqual({ x: 400, y: 200 });
    });

    it("honours a +xShift (shifts the world x right by k bars)", () => {
        const e = emission({ kind: "marker", shape: "circle", size: 6 }, { bar: 1, xShift: 1 });
        // bar 1 + 1 → slot 2 → x = 800.
        const anchor = glyphAnchor(e, INFO, BARS, SPACING);
        expect(anchor?.x).toBe(800);
    });

    it("returns null for a non-finite value (per-glyph skip)", () => {
        expect(
            glyphAnchor(
                emission({ kind: "marker", shape: "circle", size: 6 }, { value: null }),
                INFO,
                BARS,
                SPACING,
            ),
        ).toBeNull();
        expect(
            glyphAnchor(
                emission({ kind: "marker", shape: "circle", size: 6 }, { value: Number.NaN }),
                INFO,
                BARS,
                SPACING,
            ),
        ).toBeNull();
    });
});

describe("dispatchGlyph — routes each style into the shared helper", () => {
    it("a label paints text", () => {
        const ctx = stubCtx();
        dispatchGlyph(ctx, emission({ kind: "label", text: "PEAK", position: "above" }), 100, 50);
        expect(ctx.fillTexts).toEqual([{ text: "PEAK", x: 100, y: 50 }]);
    });

    it("a character paints text", () => {
        const ctx = stubCtx();
        dispatchGlyph(ctx, emission({ kind: "character", char: "A", size: 12 }), 10, 20);
        expect(ctx.fillTexts.map((c) => c.text)).toEqual(["A"]);
    });

    it("a circle marker arcs + fills", () => {
        const ctx = stubCtx();
        dispatchGlyph(ctx, emission({ kind: "marker", shape: "circle", size: 6 }), 10, 20);
        expect(ctx.calls).toContain("arc");
        expect(ctx.calls).toContain("fill");
    });

    it("an arrow fills a triangle path", () => {
        const ctx = stubCtx();
        dispatchGlyph(ctx, emission({ kind: "arrow", direction: "up", size: 10 }), 10, 20);
        expect(ctx.calls).toContain("fill");
    });

    it("a cross shape strokes (stroke-only glyph)", () => {
        const ctx = stubCtx();
        dispatchGlyph(ctx, emission({ kind: "shape", shape: "cross", size: 8 }), 10, 20);
        expect(ctx.calls).toContain("stroke");
    });

    it("falls back to the default color when the emission color is null", () => {
        const ctx = stubCtx();
        dispatchGlyph(
            ctx,
            emission({ kind: "marker", shape: "circle", size: 6 }, { color: null }),
            10,
            20,
        );
        expect(ctx.fillStyle).toBe("#90caf9");
    });
});

const ALERT: AlertEmission = {
    kind: "alert",
    slotId: "a#0",
    severity: "warning",
    message: "m",
    bar: 1,
    time: 100,
    meta: {},
    channels: [],
    dedupeKey: "k",
};

describe("alertBadgeAnchor", () => {
    it("anchors at the alert bar's (time, high)", () => {
        // bar 1 → x 400; high 14 → y = (20-14)/10*400 = 240.
        expect(alertBadgeAnchor(ALERT, INFO, BARS)).toEqual({ x: 400, y: 240 });
    });

    it("falls back to the latest bar for an out-of-range bar index", () => {
        const anchor = alertBadgeAnchor({ ...ALERT, bar: 99 }, INFO, BARS);
        // latest bar (index 2) → x 800.
        expect(anchor?.x).toBe(800);
    });

    it("returns null when there are no bars", () => {
        expect(alertBadgeAnchor(ALERT, INFO, [])).toBeNull();
    });
});

describe("paintAlertBadge", () => {
    it("paints one severity-colored dot (arc + fill)", () => {
        const ctx = stubCtx();
        paintAlertBadge(ctx, ALERT, { x: 100, y: 50 }, DEFAULT_PALETTE);
        expect(ctx.arcs).toEqual([{ x: 100, y: 50, r: 4 }]);
        expect(ctx.fillStyle).toBe(DEFAULT_PALETTE.alertWarning);
        expect(ctx.calls.filter((c) => c === "fill").length).toBe(1);
    });

    it("colors info / critical from the palette", () => {
        const info = stubCtx();
        paintAlertBadge(info, { ...ALERT, severity: "info" }, { x: 0, y: 0 }, DEFAULT_PALETTE);
        expect(info.fillStyle).toBe(DEFAULT_PALETTE.alertInfo);
        const crit = stubCtx();
        paintAlertBadge(crit, { ...ALERT, severity: "critical" }, { x: 0, y: 0 }, DEFAULT_PALETTE);
        expect(crit.fillStyle).toBe(DEFAULT_PALETTE.alertCritical);
    });
});
