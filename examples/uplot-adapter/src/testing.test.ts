// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { UplotLike, UplotOptions } from "./createUplotAdapter.js";
import { MockUplot, hashCallLog, makeMockUplotFactory } from "./testing.js";

function opts(overrides: Partial<UplotOptions> = {}): UplotOptions {
    return {
        width: 800,
        height: 400,
        paneKey: "overlay",
        series: [],
        hooks: { draw: [] },
        ...overrides,
    };
}

describe("MockUplot", () => {
    it("records the constructor opts + initial data as a 'new' record", () => {
        const u = new MockUplot(opts(), [[0, 1]]);
        expect(u.records).toEqual([{ kind: "new", opts: opts(), data: [[0, 1]] }]);
    });

    it("records setData / setScale / destroy", () => {
        const u = new MockUplot(opts(), [[0, 1]]);
        u.setData([[0, 1, 2]]);
        u.setScale("y", { min: 10, max: 20 });
        u.destroy();
        expect(u.records.slice(1)).toEqual([
            { kind: "setData", data: [[0, 1, 2]] },
            { kind: "setScale", scaleKey: "y", min: 10, max: 20 },
            { kind: "destroy" },
        ]);
    });

    it("maps valToPos linearly across the y scale, flipped", () => {
        const u = new MockUplot(opts({ height: 100 }), [[0, 1]]);
        u.setScale("y", { min: 0, max: 10 });
        // value at the top of the scale → y near 0; bottom → y near height.
        expect(u.valToPos(10, "y")).toBe(0);
        expect(u.valToPos(0, "y")).toBe(100);
        expect(u.valToPos(5, "y")).toBe(50);
    });

    it("centres valToPos on a zero-span scale", () => {
        const u = new MockUplot(opts({ height: 100 }), [[0, 1]]);
        u.setScale("y", { min: 5, max: 5 });
        expect(u.valToPos(5, "y")).toBe(50);
    });

    it("ignores non-y setScale for the valToPos mapping", () => {
        const u = new MockUplot(opts({ height: 100 }), [[0, 1]]);
        u.setScale("x", { min: 100, max: 200 });
        // y scale untouched ⇒ default [0, 1].
        expect(u.valToPos(1, "y")).toBe(0);
    });

    it("runDraw invokes every registered draw hook with itself", () => {
        const seen: UplotLike[] = [];
        const u = new MockUplot(opts({ hooks: { draw: [(self): void => void seen.push(self)] } }), [
            [0, 1],
        ]);
        u.runDraw();
        expect(seen).toEqual([u]);
    });

    it("exposes a recordable canvas ctx", () => {
        const u = new MockUplot(opts(), [[0, 1]]);
        u.ctx.beginPath();
        expect(u.ctx.calls).toEqual([{ kind: "beginPath" }]);
    });

    it("exposes a flush plotting-area bbox matching the canvas dims", () => {
        const u = new MockUplot(opts({ width: 640, height: 320 }), [[0, 1]]);
        expect(u.bbox).toEqual({ left: 0, top: 0, width: 640, height: 320 });
    });

    it("ranges the x scale from the data's bar-time row", () => {
        const u = new MockUplot(opts(), [[100, 300, 500]]);
        expect(u.scales.x).toEqual({ min: 100, max: 500 });
        // y scale defaults to [0, 1] until setScale.
        expect(u.scales.y).toEqual({ min: 0, max: 1 });
    });

    it("re-ranges the x scale on setData", () => {
        const u = new MockUplot(opts(), [[100, 200]]);
        u.setData([[1_000, 4_000]]);
        expect(u.scales.x).toEqual({ min: 1_000, max: 4_000 });
    });

    it("widens a single-point x range so the span is non-zero", () => {
        const u = new MockUplot(opts(), [[700]]);
        expect(u.scales.x).toEqual({ min: 700, max: 701 });
    });

    it("keeps the default x range when the data carries no finite times", () => {
        const u = new MockUplot(opts(), [[null, Number.NaN]]);
        expect(u.scales.x).toEqual({ min: 0, max: 1 });
    });

    it("keeps the default x range when the data table is empty", () => {
        const u = new MockUplot(opts(), []);
        expect(u.scales.x).toEqual({ min: 0, max: 1 });
    });

    it("maps valToPos linearly across the x scale (plot-area origin)", () => {
        const u = new MockUplot(opts({ width: 200 }), [[0, 10]]);
        expect(u.valToPos(0, "x")).toBe(0);
        expect(u.valToPos(10, "x")).toBe(200);
        expect(u.valToPos(5, "x")).toBe(100);
    });

    it("widens an all-equal x row so valToPos stays finite", () => {
        // [5, 5] widens to [5, 6] (non-zero span), so valToPos(5) sits at the
        // plot-area left edge — the x span is never zero by construction.
        const u = new MockUplot(opts({ width: 200 }), [[5, 5]]);
        expect(u.valToPos(5, "x")).toBe(0);
        expect(Number.isFinite(u.valToPos(6, "x"))).toBe(true);
    });
});

describe("makeMockUplotFactory", () => {
    it("collects every constructed instance in order", () => {
        const { factory, instances } = makeMockUplotFactory();
        const target = {} as HTMLElement;
        const a = factory(opts({ paneKey: "overlay" }), [[0]], target);
        const b = factory(opts({ paneKey: "rsi" }), [[0]], target);
        expect(instances).toEqual([a, b]);
    });
});

describe("hashCallLog re-export", () => {
    it("is the adapter-kit canvas hasher", () => {
        expect(typeof hashCallLog).toBe("function");
        expect(hashCallLog([{ kind: "beginPath" }])).toMatch(/^[0-9a-f]{64}$/);
    });
});
