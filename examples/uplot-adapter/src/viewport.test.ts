// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { priceToY, timeToX } from "@invinite-org/chartlang-adapter-kit";
import { describe, expect, it } from "vitest";

import type { UplotLike } from "./createUplotAdapter.js";
import { UPLOT_PRICE_SCALE, buildViewport, offsetForViewport } from "./viewport.js";

// A minimal stand-in for a real uPlot instance exposing exactly the
// `scales` / `bbox` / `valToPos` surface `buildViewport` reads, with a
// real-uPlot-shaped `valToPos`: it folds the `bbox.left/top` offset in and
// works in canvas (device) px — `bbox` is already `× devicePixelRatio` and
// `valToPos(.., true)` returns device px (uPlot's `getHPos`/`getVPos` use
// the device-px `plotWid`/`plotLft`), the same space the `hooks.draw` ctx
// draws in.
function stubUplot(args: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    bbox: { left: number; top: number; width: number; height: number };
}): UplotLike {
    const valToPos = (val: number, scaleKey: string): number => {
        if (scaleKey === "x") {
            const span = args.xMax - args.xMin;
            const plotPx = (span === 0 ? 0.5 : (val - args.xMin) / span) * args.bbox.width;
            return args.bbox.left + plotPx;
        }
        const span = args.yMax - args.yMin;
        const norm = (val - args.yMin) / span;
        const plotPx = args.bbox.height - norm * args.bbox.height;
        return args.bbox.top + plotPx;
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

        // The viewport carries uPlot's device-px plot dims + offset verbatim.
        expect(view.pxWidth).toBe(600);
        expect(view.pxHeight).toBe(300);
        expect(dx).toBe(40);
        expect(dy).toBe(10);

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

    it("reproduces valToPos on a Retina-shaped bbox (device px, offset > 0)", () => {
        // bbox is already × devicePixelRatio (e.g. a 400×300 CSS plot at
        // dpr 2 → 800×600 device px, inset 80×20 device px). The viewport
        // stays in that device-px space, so the ctx-drawn marks land on the
        // same canvas pixel uPlot's series do — the Retina fix.
        const u = stubUplot({
            xMin: 0,
            xMax: 10,
            yMin: 0,
            yMax: 50,
            bbox: { left: 80, top: 20, width: 800, height: 600 },
        });
        const view = buildViewport(u);
        const { dx, dy } = offsetForViewport(u);
        expect(view.pxWidth).toBe(800);
        expect(view.pxHeight).toBe(600);
        expect(dx).toBe(80);
        expect(dy).toBe(20);
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
});
