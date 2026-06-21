// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { createViewController, yRangeInWindow } from "./viewController.js";

describe("createViewController", () => {
    it("auto-follows the full data range before any interaction", () => {
        const view = createViewController();
        expect(view.userInteracted).toBe(false);
        expect(view.resolveXWindow(0, 100)).toEqual({ xMin: 0, xMax: 100 });
        // Auto-follow tracks the growing data extent.
        expect(view.resolveXWindow(0, 200)).toEqual({ xMin: 0, xMax: 200 });
    });

    it("zooms in about the pivot and marks interacted", () => {
        const view = createViewController();
        view.zoomAt(50, 0.5, 0, 100); // halve the span about x=50
        expect(view.userInteracted).toBe(true);
        expect(view.resolveXWindow(0, 100)).toEqual({ xMin: 25, xMax: 75 });
    });

    it("keeps the pivot fractionally fixed when zooming off-centre", () => {
        const view = createViewController();
        view.zoomAt(0, 0.5, 0, 100); // pivot at the left edge
        expect(view.resolveXWindow(0, 100)).toEqual({ xMin: 0, xMax: 50 });
    });

    it("clamps zoom-out to the data span (cannot zoom past all-data)", () => {
        const view = createViewController();
        view.zoomAt(50, 4, 0, 100); // try to zoom way out
        expect(view.resolveXWindow(0, 100)).toEqual({ xMin: 0, xMax: 100 });
    });

    it("honours a custom maxSpanFactor ceiling", () => {
        const view = createViewController({ maxSpanFactor: 2 });
        view.zoomAt(50, 10, 0, 100); // span clamps to 2× data = 200, pinned within bounds
        const win = view.resolveXWindow(0, 100);
        expect(win.xMax - win.xMin).toBe(100); // span 200 ≥ dataSpan ⇒ pinned to full data
    });

    it("honours the minSpan zoom-in floor", () => {
        const view = createViewController({ minSpan: 10 });
        view.zoomAt(50, 0.0001, 0, 100); // try to collapse to a point
        const win = view.resolveXWindow(0, 100);
        expect(win.xMax - win.xMin).toBe(10);
        expect((win.xMin + win.xMax) / 2).toBe(50);
    });

    it("treats a zero factor as a point zoom clamped to minSpan", () => {
        const view = createViewController({ minSpan: 10 });
        view.zoomAt(50, 0, 0, 100); // newSpan = span * 0 = 0 ⇒ floored to minSpan
        const win = view.resolveXWindow(0, 100);
        expect(win.xMax - win.xMin).toBe(10);
        expect((win.xMin + win.xMax) / 2).toBe(50);
    });

    it("pans within bounds and clamps at the left edge", () => {
        const view = createViewController();
        view.zoomAt(50, 0.5, 0, 100); // window [25,75]
        view.panBy(-100, 0, 100); // shove far left
        expect(view.resolveXWindow(0, 100)).toEqual({ xMin: 0, xMax: 50 });
    });

    it("clamps a pan at the right edge", () => {
        const view = createViewController();
        view.zoomAt(50, 0.5, 0, 100); // window [25,75]
        view.panBy(100, 0, 100); // shove far right
        expect(view.resolveXWindow(0, 100)).toEqual({ xMin: 50, xMax: 100 });
    });

    it("seeds the held window from data bounds when panning first", () => {
        const view = createViewController();
        view.panBy(0, 10, 110); // no zoom yet; base is the data range
        expect(view.resolveXWindow(10, 110)).toEqual({ xMin: 10, xMax: 110 });
        expect(view.userInteracted).toBe(true);
    });

    it("centres the pivot when the base span is zero (single bar)", () => {
        const view = createViewController({ minSpan: 4 });
        view.zoomAt(5, 0.5, 5, 5); // degenerate data span
        const win = view.resolveXWindow(5, 5);
        // dataSpan 0 ⇒ minSpan window pinned to data (span ≥ dataSpan branch).
        expect(win).toEqual({ xMin: 5, xMax: 5 });
    });

    it("reset() returns to auto-follow", () => {
        const view = createViewController();
        view.zoomAt(50, 0.5, 0, 100);
        expect(view.userInteracted).toBe(true);
        view.reset();
        expect(view.userInteracted).toBe(false);
        expect(view.resolveXWindow(0, 100)).toEqual({ xMin: 0, xMax: 100 });
    });

    it("re-clamps the held window as the data extent grows", () => {
        const view = createViewController();
        view.zoomAt(50, 0.5, 0, 100); // [25,75]
        // Data shrinks below the held window ⇒ span clamps to new data span.
        const win = view.resolveXWindow(40, 60);
        expect(win).toEqual({ xMin: 40, xMax: 60 });
    });
});

describe("yRangeInWindow", () => {
    it("folds the y range of in-window candidates", () => {
        const r = yRangeInWindow(
            [
                { x: 5, lo: 99, hi: 101 },
                { x: 8, lo: 98, hi: 102 },
            ],
            { xMin: 0, xMax: 10 },
        );
        expect(r).toEqual({ yMin: 98, yMax: 102 });
    });

    it("ignores candidates outside the window (both edges)", () => {
        const r = yRangeInWindow(
            [
                { x: -1, lo: 0, hi: 1000 },
                { x: 5, lo: 99, hi: 101 },
                { x: 99, lo: 0, hi: 1000 },
            ],
            { xMin: 0, xMax: 10 },
        );
        expect(r).toEqual({ yMin: 99, yMax: 101 });
    });

    it("includes candidates exactly on both window edges (inclusive bounds)", () => {
        const r = yRangeInWindow(
            [
                { x: 0, lo: 90, hi: 95 }, // exactly at xMin
                { x: 10, lo: 105, hi: 110 }, // exactly at xMax
            ],
            { xMin: 0, xMax: 10 },
        );
        expect(r).toEqual({ yMin: 90, yMax: 110 });
    });

    it("skips non-finite lo/hi rows", () => {
        const r = yRangeInWindow(
            [
                { x: 5, lo: Number.NaN, hi: 101 },
                { x: 6, lo: 99, hi: Number.POSITIVE_INFINITY },
                { x: 7, lo: 100, hi: 100 },
            ],
            { xMin: 0, xMax: 10 },
        );
        expect(r).toEqual({ yMin: 100, yMax: 100 });
    });

    it("returns undefined when no finite in-window candidate is seen", () => {
        expect(yRangeInWindow([], { xMin: 0, xMax: 10 })).toBeUndefined();
        expect(yRangeInWindow([{ x: 50, lo: 1, hi: 2 }], { xMin: 0, xMax: 10 })).toBeUndefined();
    });
});
