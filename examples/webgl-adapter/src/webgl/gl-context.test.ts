// Ported from invinite src/components/trading-chart/webgl/gl-context.test.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.

import { describe, expect, it } from "vitest";

import {
    CONTEXT_OPTIONS,
    MAX_CANVAS_PX,
    WebGl2UnsupportedError,
    resolveBackbufferSize,
} from "./gl-context.js";

// Node-safe pure tests only. `createGlContext` resolves a real GL context
// and reads canvas layout, so its resize/dispose paths are browser-only
// (exercised by the demo / react-starter build, NOT node-tested — this
// adapter is not coverage-gated). The pure rounding + clamp + the options
// bag carry the unit coverage.

describe("CONTEXT_OPTIONS", () => {
    it("is the exact MSAA attribute bag", () => {
        expect({ ...CONTEXT_OPTIONS }).toEqual({
            alpha: true,
            antialias: true,
            premultipliedAlpha: true,
            preserveDrawingBuffer: false,
        });
    });

    it("enables antialias (MSAA on the default framebuffer)", () => {
        expect(CONTEXT_OPTIONS.antialias).toBe(true);
    });
});

describe("resolveBackbufferSize", () => {
    it("rounds CSS px × dpr to integer backbuffer dimensions", () => {
        expect(resolveBackbufferSize(640, 480, 2)).toEqual({
            exceeded: false,
            heightPx: 960,
            widthPx: 1280,
        });
    });

    it("rounds (not truncates) a fractional device size", () => {
        // 100 * 1.5 = 150 exactly; 101 * 1.5 = 151.5 → round to 152.
        expect(resolveBackbufferSize(101, 100, 1.5)).toEqual({
            exceeded: false,
            heightPx: 150,
            widthPx: 152,
        });
    });

    it("is a no-op identity at dpr 1", () => {
        expect(resolveBackbufferSize(300, 150, 1)).toEqual({
            exceeded: false,
            heightPx: 150,
            widthPx: 300,
        });
    });

    it("flags exceeded and clamps each axis at MAX_CANVAS_PX", () => {
        const r = resolveBackbufferSize(MAX_CANVAS_PX + 1, 100, 1);

        expect(r.exceeded).toBe(true);

        expect(r.widthPx).toBe(MAX_CANVAS_PX);

        expect(r.heightPx).toBe(100);
    });

    it("clamps the height axis independently", () => {
        const r = resolveBackbufferSize(100, MAX_CANVAS_PX + 5, 1);

        expect(r.exceeded).toBe(true);

        expect(r.heightPx).toBe(MAX_CANVAS_PX);

        expect(r.widthPx).toBe(100);
    });

    it("trips the ceiling via the dpr multiplier, not just the css px", () => {
        // 9000 css × 2 dpr = 18000 > 16384.
        expect(resolveBackbufferSize(9000, 9000, 2).exceeded).toBe(true);
    });
});

describe("WebGl2UnsupportedError", () => {
    it("carries a remediation hint and a stable name by default", () => {
        const err = new WebGl2UnsupportedError();

        expect(err).toBeInstanceOf(Error);

        expect(err.name).toBe("WebGl2UnsupportedError");

        expect(err.message).toMatch(/WebGL2 is required/);

        expect(err.message).toMatch(/caniuse\.com\/webgl2/);
    });

    it("accepts a custom message", () => {
        expect(new WebGl2UnsupportedError("nope").message).toBe("nope");
    });
});
