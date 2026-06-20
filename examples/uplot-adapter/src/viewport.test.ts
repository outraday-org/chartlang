// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { priceToY, timeToX } from "@invinite-org/chartlang-adapter-kit";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { UplotLike } from "./createUplotAdapter.js";
import { UPLOT_PRICE_SCALE, buildViewport, offsetForViewport } from "./viewport.js";

// A minimal stand-in for a real uPlot instance exposing exactly the
// `scales` / `bbox` / `valToPos` surface `buildViewport` reads, with a
// real-uPlot-shaped `valToPos`: it folds the `bbox.left/top` offset in
// and works in canvas px (× devicePixelRatio).
function stubUplot(args: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    bbox: { left: number; top: number; width: number; height: number };
    dpr?: number;
}): UplotLike {
    const ratio = args.dpr ?? 1;
    const valToPos = (val: number, scaleKey: string): number => {
        if (scaleKey === "x") {
            const span = args.xMax - args.xMin;
            const plotPx =
                (span === 0 ? 0.5 : (val - args.xMin) / span) * (args.bbox.width / ratio);
            return args.bbox.left / ratio + plotPx;
        }
        const span = args.yMax - args.yMin;
        const norm = (val - args.yMin) / span;
        const plotPx = args.bbox.height / ratio - norm * (args.bbox.height / ratio);
        return args.bbox.top / ratio + plotPx;
    };
    return {
        setData: () => {},
        setScale: () => {},
        destroy: () => {},
        valToPos,
        ctx: {} as UplotLike["ctx"],
        scales: { x: { min: args.xMin, max: args.xMax }, y: { min: args.yMin, max: args.yMax } },
        bbox: args.bbox,
    };
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("buildViewport", () => {
    it("reproduces u.valToPos (x and y) once the plotting-area offset is applied", () => {
        const u = stubUplot({
            xMin: 1_000,
            xMax: 5_000,
            yMin: 100,
            yMax: 200,
            bbox: { left: 40, top: 10, width: 600, height: 300 },
        });
        const view = buildViewport(u);
        const { dx, dy } = offsetForViewport(u);

        // Sample several (time, price) pairs: the plotting-area projection
        // (timeToX/priceToY) plus the offset must equal uPlot's valToPos.
        for (const time of [1_000, 2_500, 5_000]) {
            const projected = timeToX(time, view) + dx;
            expect(projected).toBeCloseTo(u.valToPos(time, "x", true), 6);
        }
        for (const price of [100, 150, 200]) {
            const projected = priceToY(price, view) + dy;
            expect(projected).toBeCloseTo(u.valToPos(price, UPLOT_PRICE_SCALE, true), 6);
        }
    });

    it("reproduces valToPos under a devicePixelRatio > 1 (CSS-px viewport)", () => {
        vi.stubGlobal("devicePixelRatio", 2);
        const u = stubUplot({
            xMin: 0,
            xMax: 10,
            yMin: 0,
            yMax: 50,
            // bbox is canvas px (already × dpr); width 800 canvas px == 400 CSS px.
            bbox: { left: 80, top: 20, width: 800, height: 600 },
            dpr: 2,
        });
        const view = buildViewport(u);
        const { dx, dy } = offsetForViewport(u);
        // CSS-px viewport: 400 × 300, offset 40 × 10.
        expect(view.pxWidth).toBe(400);
        expect(view.pxHeight).toBe(300);
        expect(dx).toBe(40);
        expect(dy).toBe(10);
        expect(timeToX(5, view) + dx).toBeCloseTo(u.valToPos(5, "x", true), 6);
        expect(priceToY(25, view) + dy).toBeCloseTo(u.valToPos(25, "y", true), 6);
    });

    it("falls back to a unit range when a scale carries no min/max", () => {
        const u: UplotLike = {
            setData: () => {},
            setScale: () => {},
            destroy: () => {},
            valToPos: () => 0,
            ctx: {} as UplotLike["ctx"],
            scales: {},
            bbox: { left: 0, top: 0, width: 100, height: 100 },
        };
        const view = buildViewport(u);
        expect(view).toMatchObject({ xMin: 0, xMax: 1, yMin: 0, yMax: 1 });
    });

    it("treats a zero / missing devicePixelRatio as 1", () => {
        vi.stubGlobal("devicePixelRatio", 0);
        const u = stubUplot({
            xMin: 0,
            xMax: 1,
            yMin: 0,
            yMax: 1,
            bbox: { left: 5, top: 7, width: 200, height: 100 },
        });
        const view = buildViewport(u);
        const { dx, dy } = offsetForViewport(u);
        // dpr clamped to 1 ⇒ CSS px == canvas px.
        expect(view.pxWidth).toBe(200);
        expect(view.pxHeight).toBe(100);
        expect(dx).toBe(5);
        expect(dy).toBe(7);
    });
});
