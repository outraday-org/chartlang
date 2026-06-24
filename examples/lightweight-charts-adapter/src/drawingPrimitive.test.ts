// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AlertConditionEmission,
    DrawingEmission,
    LogEmission,
} from "@invinite-org/chartlang-adapter-kit";
import { RENDER_BAND } from "@invinite-org/chartlang-adapter-kit";
import { MockCanvasContext } from "@invinite-org/chartlang-adapter-kit/canvas";
import { describe, expect, it } from "vitest";

import {
    type BgBand,
    DrawingPrimitive,
    type DrawingPrimitiveAttach,
    type GlyphMark,
    type OverlayBuffers,
    type PaintScope,
} from "./drawingPrimitive.js";

const SCOPE_FIELDS = {
    bitmapSize: { width: 800, height: 400 },
    mediaSize: { width: 400, height: 200 },
    horizontalPixelRatio: 2,
    verticalPixelRatio: 2,
} as const;

function paintScope(context: MockCanvasContext): PaintScope {
    return { ...SCOPE_FIELDS, context };
}

// A linear attach parameter (the exact case option A reproduces). Time
// 1000..2000 → media x 50..350; media y = −2·price + 600.
function linearAttach(): DrawingPrimitiveAttach {
    return {
        series: {
            priceToCoordinate: (p) => -2 * p + 600,
            coordinateToPrice: (y) => (y - 600) / -2,
        },
        chart: {
            timeScale: () => ({
                getVisibleRange: () => ({ from: 1000, to: 2000 }),
                timeToCoordinate: (t) => 50 + ((350 - 50) / (2000 - 1000)) * (t - 1000),
            }),
        },
    };
}

function lineDrawing(op: DrawingEmission["op"], handleId: string): DrawingEmission {
    return {
        kind: "drawing",
        op,
        handleId,
        drawingKind: "line",
        bar: 0,
        time: 1_000,
        state: {
            kind: "line",
            anchors: [
                { time: 1200, price: 280 },
                { time: 1800, price: 220 },
            ],
            style: { color: "#3b82f6", lineWidth: 2 },
        },
    };
}

// Reach the pane renderer the factory drives. The pane view + renderer are
// package-private; the public surface hands them back structurally.
function paintOf(primitive: DrawingPrimitive, scope: PaintScope): void {
    primitive.paneViews()[0].renderer().paintInto(scope);
}

// A full overlay-buffer bundle (the Task-12 construction shape) defaulting to
// empty maps/arrays; tests override only the buffer under test.
function overlay(partial: Partial<OverlayBuffers> = {}): OverlayBuffers {
    return {
        drawings: new Map(),
        glyphs: new Map(),
        drawingKeys: new Map(),
        glyphKeys: new Map(),
        bgBands: new Map(),
        alertConditions: [],
        logs: [],
        ...partial,
    };
}

describe("DrawingPrimitive", () => {
    it("exposes exactly one pane view with a renderer", () => {
        const primitive = new DrawingPrimitive(new Map());
        const views = primitive.paneViews();
        expect(views).toHaveLength(1);
        expect(typeof views[0].renderer().paintInto).toBe("function");
    });

    it("paints buffered drawings via decomposeDrawing + paintPrimitive once attached", () => {
        const buffer = new Map<string, DrawingEmission>([["d1", lineDrawing("create", "d1")]]);
        const primitive = new DrawingPrimitive(buffer);
        primitive.attached(linearAttach());

        const ctx = new MockCanvasContext();
        paintOf(primitive, paintScope(ctx));

        // A line decomposes to a polyline → moveTo + lineTo + stroke.
        expect(ctx.calls.some((c) => c.kind === "moveTo")).toBe(true);
        expect(ctx.calls.some((c) => c.kind === "lineTo")).toBe(true);
        expect(ctx.calls.some((c) => c.kind === "stroke")).toBe(true);
    });

    it("paints the line at the LC-projected bitmap coordinates", () => {
        const buffer = new Map<string, DrawingEmission>([["d1", lineDrawing("create", "d1")]]);
        const primitive = new DrawingPrimitive(buffer);
        primitive.attached(linearAttach());

        const ctx = new MockCanvasContext();
        paintOf(primitive, paintScope(ctx));

        const moveTo = ctx.calls.find((c) => c.kind === "moveTo");
        const lineTo = ctx.calls.find((c) => c.kind === "lineTo");
        if (moveTo?.kind !== "moveTo" || lineTo?.kind !== "lineTo") {
            throw new Error("expected a moveTo + lineTo for the line drawing");
        }
        // Anchor A: time 1200 → media x 110 → bitmap 220; price 280 → media y
        // 40 → bitmap 80. Anchor B: time 1800 → media x 290 → bitmap 580;
        // price 220 → media y 160 → bitmap 320.
        expect(moveTo.x).toBeCloseTo(220, 4);
        expect(moveTo.y).toBeCloseTo(80, 4);
        expect(lineTo.x).toBeCloseTo(580, 4);
        expect(lineTo.y).toBeCloseTo(320, 4);
    });

    it("is a no-op before attachment", () => {
        const buffer = new Map<string, DrawingEmission>([["d1", lineDrawing("create", "d1")]]);
        const primitive = new DrawingPrimitive(buffer);
        const ctx = new MockCanvasContext();
        paintOf(primitive, paintScope(ctx));
        expect(ctx.calls).toEqual([]);
    });

    it("stops painting after detach", () => {
        const buffer = new Map<string, DrawingEmission>([["d1", lineDrawing("create", "d1")]]);
        const primitive = new DrawingPrimitive(buffer);
        primitive.attached(linearAttach());
        primitive.detached();
        const ctx = new MockCanvasContext();
        paintOf(primitive, paintScope(ctx));
        expect(ctx.calls).toEqual([]);
    });

    it("skips a stale op:remove entry left in the buffer", () => {
        const buffer = new Map<string, DrawingEmission>([["d1", lineDrawing("remove", "d1")]]);
        const primitive = new DrawingPrimitive(buffer);
        primitive.attached(linearAttach());
        const ctx = new MockCanvasContext();
        paintOf(primitive, paintScope(ctx));
        expect(ctx.calls).toEqual([]);
    });

    it("re-reads the live buffer each paint (added drawing appears, removed vanishes)", () => {
        const buffer = new Map<string, DrawingEmission>();
        const primitive = new DrawingPrimitive(buffer);
        primitive.attached(linearAttach());

        const before = new MockCanvasContext();
        paintOf(primitive, paintScope(before));
        expect(before.calls).toEqual([]);

        buffer.set("d1", lineDrawing("create", "d1"));
        const after = new MockCanvasContext();
        paintOf(primitive, paintScope(after));
        expect(after.calls.some((c) => c.kind === "stroke")).toBe(true);

        buffer.delete("d1");
        const gone = new MockCanvasContext();
        paintOf(primitive, paintScope(gone));
        expect(gone.calls).toEqual([]);
    });
});

describe("DrawingPrimitive — overlay glyphs", () => {
    // time 1800 → media x 290 → bitmap 580; price 220 → media y 160 →
    // bitmap 320 (the same linear attach the drawing tests use).
    function markerGlyph(): GlyphMark {
        return {
            time: 1800,
            value: 220,
            color: "#26a69a",
            style: { kind: "marker", shape: "diamond", size: 8 },
        };
    }

    it("paints a buffered marker glyph via the shared helper at LC coordinates", () => {
        const glyphs = new Map<string, GlyphMark>([["g1", markerGlyph()]]);
        const primitive = new DrawingPrimitive(new Map(), glyphs);
        primitive.attached(linearAttach());

        const ctx = new MockCanvasContext();
        paintOf(primitive, paintScope(ctx));

        // A diamond marker fills with the glyph colour and draws its polygon
        // centred on the projected anchor.
        const fillStyle = ctx.calls.find((c) => c.kind === "set" && c.prop === "fillStyle");
        expect(fillStyle?.kind === "set" && fillStyle.value).toBe("#26a69a");
        const moveTo = ctx.calls.find((c) => c.kind === "moveTo");
        expect(moveTo?.kind === "moveTo" && moveTo.x).toBeCloseTo(580, 4);
        expect(ctx.calls.some((c) => c.kind === "fill")).toBe(true);
    });

    it("paints a shape glyph (cross strokes its geometry)", () => {
        const glyphs = new Map<string, GlyphMark>([
            [
                "g1",
                {
                    time: 1800,
                    value: 220,
                    color: null,
                    style: { kind: "shape", shape: "cross", size: 8, location: "above" },
                },
            ],
        ]);
        const primitive = new DrawingPrimitive(new Map(), glyphs);
        primitive.attached(linearAttach());

        const ctx = new MockCanvasContext();
        paintOf(primitive, paintScope(ctx));

        // A null colour falls back to the default glyph blue on the stroke.
        const strokeStyle = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        expect(strokeStyle?.kind === "set" && strokeStyle.value).toBe("#3b82f6");
        expect(ctx.calls.some((c) => c.kind === "stroke")).toBe(true);
    });

    it("paints a shape glyph with no location (absolute default)", () => {
        const glyphs = new Map<string, GlyphMark>([
            [
                "g1",
                {
                    time: 1800,
                    value: 220,
                    color: "#ef5350",
                    style: { kind: "shape", shape: "flag", size: 8 },
                },
            ],
        ]);
        const primitive = new DrawingPrimitive(new Map(), glyphs);
        primitive.attached(linearAttach());

        const ctx = new MockCanvasContext();
        paintOf(primitive, paintScope(ctx));
        const strokeStyle = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        expect(strokeStyle?.kind === "set" && strokeStyle.value).toBe("#ef5350");
        expect(ctx.calls.some((c) => c.kind === "stroke")).toBe(true);
    });

    it("skips a glyph with a non-finite value", () => {
        const glyphs = new Map<string, GlyphMark>([
            ["g1", { ...markerGlyph(), value: Number.NaN }],
        ]);
        const primitive = new DrawingPrimitive(new Map(), glyphs);
        primitive.attached(linearAttach());

        const ctx = new MockCanvasContext();
        paintOf(primitive, paintScope(ctx));
        expect(ctx.calls).toEqual([]);
    });

    it("paints glyphs THEN drawings in one sorted pass (shared RENDER_BAND order)", () => {
        const buffer = new Map<string, DrawingEmission>([["d1", lineDrawing("create", "d1")]]);
        const glyphs = new Map<string, GlyphMark>([["g1", markerGlyph()]]);
        const primitive = new DrawingPrimitive(buffer, glyphs);
        primitive.attached(linearAttach());

        const ctx = new MockCanvasContext();
        paintOf(primitive, paintScope(ctx));
        // Task 12 routes both through the shared `sortByRenderOrder`: at the
        // default z the glyph band (1) sorts BEFORE the drawing band (3), so the
        // glyph's fill now precedes the drawing's stroke (drawings on top —
        // matching the canvas2d reference band order, the parity contract).
        const fillIdx = ctx.calls.findIndex((c) => c.kind === "fill");
        const strokeIdx = ctx.calls.findIndex((c) => c.kind === "stroke");
        expect(fillIdx).toBeGreaterThanOrEqual(0);
        expect(strokeIdx).toBeGreaterThan(fillIdx);
    });

    it("defaults to an empty glyph buffer (no extra calls)", () => {
        const primitive = new DrawingPrimitive(new Map());
        primitive.attached(linearAttach());
        const ctx = new MockCanvasContext();
        paintOf(primitive, paintScope(ctx));
        expect(ctx.calls).toEqual([]);
    });
});

describe("DrawingPrimitive — bg-color bands", () => {
    // time 1000 → media x 50 → bitmap 100 (the band centre). spacing 1000 →
    // edge at time 2000 → media x 350 → bitmap 700, so the stripe is 600 wide.
    function band(partial: Partial<BgBand> = {}): BgBand {
        return {
            time: 1000,
            color: "#26a69a",
            spacing: 1000,
            z: 0,
            band: RENDER_BAND.drawing,
            seq: 0,
            ...partial,
        };
    }

    it("paints a full-height stripe centred on the bar's projected x", () => {
        const bgBands = new Map<string, BgBand>([["b1", band()]]);
        const primitive = new DrawingPrimitive(new Map(), new Map(), overlay({ bgBands }));
        primitive.attached(linearAttach());

        const ctx = new MockCanvasContext();
        paintOf(primitive, paintScope(ctx));

        const fillRect = ctx.calls.find((c) => c.kind === "fillRect");
        if (fillRect?.kind !== "fillRect") throw new Error("expected a fillRect for the band");
        // centre 100, width 600 ⇒ x = 100 - 300 = -200; full pane height 400.
        expect(fillRect.x).toBeCloseTo(-200, 4);
        expect(fillRect.w).toBeCloseTo(600, 4);
        expect(fillRect.h).toBeCloseTo(400, 4);
        const fillStyle = ctx.calls.find((c) => c.kind === "set" && c.prop === "fillStyle");
        expect(fillStyle?.kind === "set" && fillStyle.value).toBe("#26a69a");
    });

    it("folds transp into the stripe opacity (1 - transp/100)", () => {
        const bgBands = new Map<string, BgBand>([["b1", band({ transp: 70 })]]);
        const primitive = new DrawingPrimitive(new Map(), new Map(), overlay({ bgBands }));
        primitive.attached(linearAttach());

        const ctx = new MockCanvasContext();
        paintOf(primitive, paintScope(ctx));

        const alphaSet = ctx.calls.find(
            (c) => c.kind === "set" && c.prop === "globalAlpha" && c.value !== 1,
        );
        expect(alphaSet?.kind === "set" && alphaSet.value).toBeCloseTo(0.3, 4);
        // The alpha is reset to 1 after the fill so later marks are opaque.
        const resets = ctx.calls.filter(
            (c) => c.kind === "set" && c.prop === "globalAlpha" && c.value === 1,
        );
        expect(resets.length).toBeGreaterThanOrEqual(1);
    });

    it("falls back to a 1px hairline when the projected width is degenerate", () => {
        // spacing 0 ⇒ edge === centre ⇒ zero width ⇒ the 1px floor.
        const bgBands = new Map<string, BgBand>([["b1", band({ spacing: 0 })]]);
        const primitive = new DrawingPrimitive(new Map(), new Map(), overlay({ bgBands }));
        primitive.attached(linearAttach());

        const ctx = new MockCanvasContext();
        paintOf(primitive, paintScope(ctx));
        const fillRect = ctx.calls.find((c) => c.kind === "fillRect");
        expect(fillRect?.kind === "fillRect" && fillRect.w).toBe(1);
    });
});

describe("DrawingPrimitive — alert conditions + logs (always-on-top)", () => {
    function condition(partial: Partial<AlertConditionEmission> = {}): AlertConditionEmission {
        return {
            kind: "alert-condition",
            conditionId: "c",
            title: "T",
            description: "D",
            defaultMessage: "fired!",
            fired: true,
            bar: 0,
            time: 1,
            ...partial,
        };
    }

    function log(partial: Partial<LogEmission> = {}): LogEmission {
        return { kind: "log", level: "info", message: "hi", bar: 0, time: 1, ...partial };
    }

    it("paints only FIRED alert conditions as a side panel", () => {
        const alertConditions = [condition({ conditionId: "up" }), condition({ fired: false })];
        const primitive = new DrawingPrimitive(new Map(), new Map(), overlay({ alertConditions }));
        primitive.attached(linearAttach());

        const ctx = new MockCanvasContext();
        paintOf(primitive, paintScope(ctx));
        const texts = ctx.calls.filter((c) => c.kind === "fillText");
        expect(texts).toHaveLength(1);
        expect(texts[0].kind === "fillText" && texts[0].text).toBe("up: fired!");
    });

    it("paints nothing when no alert condition fired", () => {
        const alertConditions = [condition({ fired: false })];
        const primitive = new DrawingPrimitive(new Map(), new Map(), overlay({ alertConditions }));
        primitive.attached(linearAttach());
        const ctx = new MockCanvasContext();
        paintOf(primitive, paintScope(ctx));
        expect(ctx.calls.some((c) => c.kind === "fillText")).toBe(false);
    });

    it("paints the latest logs as a bottom-left pane", () => {
        const logs = [log({ message: "a" }), log({ level: "warn", message: "b" })];
        const primitive = new DrawingPrimitive(new Map(), new Map(), overlay({ logs }));
        primitive.attached(linearAttach());

        const ctx = new MockCanvasContext();
        paintOf(primitive, paintScope(ctx));
        const texts = ctx.calls.filter((c) => c.kind === "fillText");
        expect(texts.map((t) => (t.kind === "fillText" ? t.text : ""))).toEqual([
            "[info] a",
            "[warn] b",
        ]);
    });

    it("paints nothing for an empty log buffer", () => {
        const primitive = new DrawingPrimitive(new Map(), new Map(), overlay({ logs: [] }));
        primitive.attached(linearAttach());
        const ctx = new MockCanvasContext();
        paintOf(primitive, paintScope(ctx));
        expect(ctx.calls).toEqual([]);
    });
});

describe("DrawingPrimitive — overlay z-order (shared sort)", () => {
    function bgAt(z: number, seq: number): BgBand {
        return {
            time: 1000,
            color: "#26a69a",
            spacing: 1000,
            z,
            band: RENDER_BAND.drawing,
            seq,
        };
    }

    it("orders overlay marks by (z, band, seq): a z:-1 drawing paints below a z:0 band", () => {
        const drawings = new Map<string, DrawingEmission>([["d1", lineDrawing("create", "d1")]]);
        const drawingKeys = new Map([["d1", { z: -1, band: RENDER_BAND.drawing, seq: 1 }]]);
        const bgBands = new Map<string, BgBand>([["b1", bgAt(0, 0)]]);
        const primitive = new DrawingPrimitive(
            drawings,
            new Map(),
            overlay({ drawings, drawingKeys, bgBands }),
        );
        primitive.attached(linearAttach());

        const ctx = new MockCanvasContext();
        paintOf(primitive, paintScope(ctx));
        // The z:-1 drawing strokes BEFORE the z:0 band fills (lower z first).
        const strokeIdx = ctx.calls.findIndex((c) => c.kind === "stroke");
        const fillRectIdx = ctx.calls.findIndex((c) => c.kind === "fillRect");
        expect(strokeIdx).toBeGreaterThanOrEqual(0);
        expect(fillRectIdx).toBeGreaterThan(strokeIdx);
    });

    it("a z:0 drawing missing its parallel key falls back to band/seq 0 without throwing", () => {
        const drawings = new Map<string, DrawingEmission>([["d1", lineDrawing("create", "d1")]]);
        // No drawingKeys entry → the defensive default key path.
        const primitive = new DrawingPrimitive(drawings, new Map(), overlay({ drawings }));
        primitive.attached(linearAttach());
        const ctx = new MockCanvasContext();
        paintOf(primitive, paintScope(ctx));
        expect(ctx.calls.some((c) => c.kind === "stroke")).toBe(true);
    });

    it("an overlay glyph missing its parallel key falls back to band/seq 0", () => {
        const glyphs = new Map<string, GlyphMark>([
            [
                "g1",
                {
                    time: 1800,
                    value: 220,
                    color: "#26a69a",
                    style: { kind: "marker", shape: "diamond", size: 8 },
                },
            ],
        ]);
        const primitive = new DrawingPrimitive(new Map(), glyphs, overlay({ glyphs }));
        primitive.attached(linearAttach());
        const ctx = new MockCanvasContext();
        paintOf(primitive, paintScope(ctx));
        expect(ctx.calls.some((c) => c.kind === "fill")).toBe(true);
    });
});
