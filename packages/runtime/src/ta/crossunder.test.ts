// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
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

describe("ta.crossunder", () => {
    it("fires exactly on the bar where a crosses below b", () => {
        // a: [5, 4, 2]   b: 3 → crossunder at bar 2 (2 < 3 && 4 >= 3).
        const bars = makeBars([5, 4, 2]);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => crossunder("slot", bar.close, 3).current,
        );
        expect(out[0]).toBe(false);
        expect(out[1]).toBe(false);
        expect(out[2]).toBe(true);
    });

    it("does NOT fire when a was already below b", () => {
        const bars = makeBars([1, 0.5, 0.1]);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => crossunder("slot", bar.close, 3).current,
        );
        for (const v of out) expect(v).toBe(false);
    });

    it("treats NaN inputs as false (per Pine — booleans don't carry NaN)", () => {
        const bars = makeBars([4, Number.NaN, 2]);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => crossunder("slot", bar.close, 3).current,
        );
        // Any bar with NaN on either side of the comparison must be false.
        expect(out[0]).toBe(false); // init
        expect(out[1]).toBe(false); // NaN in curr
        expect(out[2]).toBe(false); // NaN in prev (prevA = NaN from bar 1)
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 1);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            ids.add(crossunder("slot", bar.close, 100));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => crossunder("oops", 1, 2)).toThrowError(
            /ta.crossunder called outside an active script step/,
        );
    });

    it("works with Series sources via .current", () => {
        const bars = makeBars([5, 4, 2]);
        const out = harness(
            bars,
            bars.length + 1,
            (_bar, ctx) => crossunder("slot", ctx.stream.seriesViews.close, 3).current,
        );
        expect(out[2]).toBe(true);
    });
});

describe("ta.crossunder tick-mode", () => {
    it("replaces the head without advancing length", () => {
        const bars = makeBars([5, 4, 4]);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            crossunder("slot", bar.close, 3.5),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        tick(ctxRef, { ...bars[2], close: 1 }, () => crossunder("slot", 1, 3.5));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("tick recomputes the head from the previous closed values", () => {
        const bars = makeBars([5, 4, 3.5]);
        // prev=(4, 3.5), curr=(3.5, 3.5) → 3.5 < 3.5 false.
        // Tick with new close 1: 1 < 3.5 && 4 >= 3.5 → true.
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            crossunder("slot", bar.close, 3.5),
        );
        const tickResult = tick(
            ctxRef,
            { ...bars[2], close: 1 },
            () => crossunder("slot", 1, 3.5).current,
        );
        expect(tickResult).toBe(true);
    });
});

describe("ta.crossunder — opts.offset", () => {
    it("offset === 0 returns the same Series identity as no opts", () => {
        const bars = syntheticBars(20, 7);
        const identities = new Set<unknown>();
        let toggle = false;
        harness(bars, bars.length + 1, (bar) => {
            toggle = !toggle;
            identities.add(
                toggle
                    ? crossunder("slot", bar.close, 100)
                    : crossunder("slot", bar.close, 100, { offset: 0 }),
            );
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("offset === k > 0 leaves the boolean series unshifted (presentation-only)", () => {
        // [5, 4, 2, 1] crosses under 3 at bar 2. The offset is
        // presentation-only, so the value series matches the no-offset run.
        const bars = makeBars([5, 4, 2, 1]);
        const unshifted = harness(
            bars,
            bars.length + 1,
            (bar) => crossunder("slot", bar.close, 3).current,
        );
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => crossunder("slot", bar.close, 3, { offset: 1 }).current,
        );
        for (let i = 0; i < bars.length; i += 1) expect(out[i]).toBe(unshifted[i]);
    });

    it("offset === -k leaves the boolean series unshifted (no future read; presentation-only)", () => {
        const bars = makeBars([5, 4, 2]);
        const unshifted = harness(
            bars,
            bars.length + 1,
            (bar) => crossunder("slot", bar.close, 3).current,
        );
        const head = harness(
            bars,
            bars.length + 1,
            (bar) => crossunder("slot", bar.close, 3, { offset: -1 }).current,
        );
        expect(head[head.length - 1]).toBe(unshifted[unshifted.length - 1]);
    });

    it("two calls with the same non-zero offset return the same Series identity", () => {
        const bars = syntheticBars(10, 3);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            identities.add(crossunder("slot", bar.close, 100, { offset: 2 }));
            return null;
        });
        expect(identities.size).toBe(1);
    });
});
