// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { cum } from "./cum.js";

function makeBars(values: number[]): Bar[] {
    return values.map((v, i) => ({
        time: 1_700_000_000_000 + i * 60_000,
        open: v,
        high: v,
        low: v,
        close: v,
        volume: v,
        symbol: "T",
        interval: "1m",
    }));
}

describe("ta.cum", () => {
    it("emits the running total of the source (finite from bar 0)", () => {
        const bars = makeBars([1, 2, 3, 4]);
        const out = harness(bars, bars.length + 1, (bar) => cum("slot", bar.close).current);
        expect(out).toEqual([1, 3, 6, 10]);
    });

    it("a NaN sample contributes 0 — the total is unchanged across the NaN bar", () => {
        const bars = makeBars([1, 2, Number.NaN, 4]);
        const out = harness(bars, bars.length + 1, (bar) => cum("slot", bar.close).current);
        // bar 2 (NaN) carries 3 forward; bar 3 adds 4 → 7.
        expect(out).toEqual([1, 3, 3, 7]);
    });

    it("accepts a scalar source", () => {
        const bars = makeBars([0, 0, 0]);
        const out = harness(bars, bars.length + 1, () => cum("slot", 5).current);
        expect(out).toEqual([5, 10, 15]);
    });

    it("reads a Series source via .current", () => {
        const bars = makeBars([1, 2, 3]);
        const out = harness(
            bars,
            bars.length + 1,
            (_bar, ctx) => cum("slot", ctx.stream.seriesViews.close).current,
        );
        expect(out).toEqual([1, 3, 6]);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 1);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            ids.add(cum("slot", bar.close));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => cum("oops", 1)).toThrowError(/ta.cum called outside an active script step/);
    });
});

describe("ta.cum tick-mode", () => {
    it("tick replays prevClosedCum + tick without advancing the closed total", () => {
        const bars = makeBars([1, 2, 3]);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) => cum("slot", bar.close));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        // Closed total after [1,2,3] is 6; prevClosedCum snapshot is 3.
        const head = tick(ctxRef, { ...bars[2], close: 10 }, () => cum("slot", 10).current);
        expect(head).toBe(13); // prevClosedCum (3) + tick (10)
        expect(ctxRef.ctx.stream.ohlcv.close.length).toBe(lengthBefore);
        // The committed accumulator is untouched by the tick — a later close
        // resumes from 6, not the ticked 13.
        const slot = ctxRef.ctx.stream.taSlots.get("slot") as { cum: number };
        expect(slot.cum).toBe(6);
    });

    it("tick with a NaN source contributes 0 (replays prevClosedCum)", () => {
        const bars = makeBars([1, 2, 3]);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) => cum("slot", bar.close));
        const head = tick(ctxRef, bars[2], () => cum("slot", Number.NaN).current);
        expect(head).toBe(3); // prevClosedCum (3) + 0
    });
});
