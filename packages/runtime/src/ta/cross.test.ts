// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { cross } from "./cross.js";
import { crossover } from "./crossover.js";
import { crossunder } from "./crossunder.js";

function makeBars(values: number[]): Bar[] {
    return values.map((v, i) => ({
        time: 1_700_000_000_000 + i * 60_000,
        open: v,
        high: v,
        low: v,
        close: v,
        volume: 0,
        symbol: "T",
        interval: "1m",
    }));
}

describe("ta.cross", () => {
    it("fires when a crosses ABOVE b", () => {
        // [1, 2, 4] crosses 3 at bar 2 (4 > 3 && 2 <= 3).
        const bars = makeBars([1, 2, 4]);
        const out = harness(bars, bars.length + 1, (bar) => cross("slot", bar.close, 3).current);
        expect(out[0]).toBe(false);
        expect(out[1]).toBe(false);
        expect(out[2]).toBe(true);
    });

    it("fires when a crosses BELOW b", () => {
        // [5, 4, 2] crosses 3 at bar 2 (2 < 3 && 4 >= 3).
        const bars = makeBars([5, 4, 2]);
        const out = harness(bars, bars.length + 1, (bar) => cross("slot", bar.close, 3).current);
        expect(out[0]).toBe(false);
        expect(out[1]).toBe(false);
        expect(out[2]).toBe(true);
    });

    it("is false when neither direction crosses", () => {
        const bars = makeBars([5, 6, 7]);
        const out = harness(bars, bars.length + 1, (bar) => cross("slot", bar.close, 3).current);
        expect(out.every((v) => v === false)).toBe(true);
    });

    it("supports a scalar b", () => {
        const bars = makeBars([2, 2, 5]);
        const out = harness(bars, bars.length + 1, (bar) => cross("slot", bar.close, 3).current);
        expect(out[2]).toBe(true); // 5 > 3 && 2 <= 3
    });

    it("treats NaN inputs as false", () => {
        const bars = makeBars([1, Number.NaN, 4]);
        const out = harness(bars, bars.length + 1, (bar) => cross("slot", bar.close, 3).current);
        for (const v of out) expect(v).toBe(false);
    });

    it("equals crossover || crossunder on the same inputs", () => {
        const bars = syntheticBars(60, 17);
        const out = harness(bars, bars.length + 1, (bar) => {
            const c = cross("x", bar.close, 100).current;
            // Advance BOTH sub-primitives every bar (a `||` on the `.current`
            // reads would short-circuit the crossunder call and desync it).
            const o = crossover("o", bar.close, 100).current;
            const u = crossunder("u", bar.close, 100).current;
            return c === (o || u);
        });
        expect(out.every((v) => v === true)).toBe(true);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 1);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            ids.add(cross("slot", bar.close, 100));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => cross("oops", 1, 2)).toThrowError(
            /ta.cross called outside an active script step/,
        );
    });

    it("works with Series sources via .current", () => {
        const bars = makeBars([1, 2, 4]);
        const out = harness(
            bars,
            bars.length + 1,
            (_bar, ctx) => cross("slot", ctx.stream.seriesViews.close, 3).current,
        );
        expect(out[2]).toBe(true);
    });
});

describe("ta.cross tick-mode", () => {
    it("replaces the head without advancing length", () => {
        const bars = makeBars([1, 2, 3]);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            cross("slot", bar.close, 2.5),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        tick(ctxRef, { ...bars[2], close: 4 }, () => cross("slot", 4, 2.5));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("tick recomputes the head from the previous closed values", () => {
        const bars = makeBars([1, 2, 2.5]);
        // Closed: prev=(2, 2.5), curr=(2.5, 2.5) → 2.5 crosses neither → false.
        // Tick with new close 4: 4 > 2.5 && 2 <= 2.5 → crossover → cross true.
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            cross("slot", bar.close, 2.5),
        );
        const tickResult = tick(
            ctxRef,
            { ...bars[2], close: 4 },
            () => cross("slot", 4, 2.5).current,
        );
        expect(tickResult).toBe(true);
    });
});
