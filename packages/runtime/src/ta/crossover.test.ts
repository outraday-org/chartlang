// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { crossover } from "./crossover.js";

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

describe("ta.crossover", () => {
    it("fires exactly on the bar where a crosses above b", () => {
        // a series: [1, 2, 4]   b scalar: 3 → crossover at bar 2 (4 > 3 && 2 <= 3).
        const bars = makeBars([1, 2, 4]);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => crossover("slot", bar.close, 3).current,
        );
        expect(out[0]).toBe(false); // initial bar
        expect(out[1]).toBe(false); // 2 not > 3
        expect(out[2]).toBe(true); // 4 > 3 && 2 <= 3
    });

    it("does NOT fire when a was already above b", () => {
        const bars = makeBars([5, 6, 7]);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => crossover("slot", bar.close, 3).current,
        );
        // a starts above b; no crossing.
        expect(out.every((v) => v === false)).toBe(true);
    });

    it("treats NaN inputs as false", () => {
        const bars = makeBars([1, Number.NaN, 4]);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => crossover("slot", bar.close, 3).current,
        );
        for (const v of out) expect(v).toBe(false);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 1);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            ids.add(crossover("slot", bar.close, 100));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => crossover("oops", 1, 2)).toThrowError(
            /ta.crossover called outside an active script step/,
        );
    });

    it("works with Series sources via .current", () => {
        const bars = makeBars([1, 2, 4]);
        const out = harness(
            bars,
            bars.length + 1,
            (_bar, ctx) => crossover("slot", ctx.stream.seriesViews.close, 3).current,
        );
        expect(out[2]).toBe(true);
    });
});

describe("ta.crossover tick-mode", () => {
    it("replaces the head without advancing length", () => {
        const bars = makeBars([1, 2, 3]);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            crossover("slot", bar.close, 2.5),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        tick(ctxRef, { ...bars[2], close: 4 }, () => crossover("slot", 4, 2.5));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("tick recomputes the head from the previous closed values", () => {
        const bars = makeBars([1, 2, 2.5]);
        // After closes: prev=(2, 2.5), curr=(2.5, 2.5) → at the close, 2.5 > 2.5 is false.
        // Tick with new close 4: 4 > 2.5 && 2 <= 2.5 → true.
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            crossover("slot", bar.close, 2.5),
        );
        const tickResult = tick(
            ctxRef,
            { ...bars[2], close: 4 },
            () => crossover("slot", 4, 2.5).current,
        );
        expect(tickResult).toBe(true);
    });
});

describe("ta.crossover — opts.offset", () => {
    it("offset === 0 returns the same Series identity as no opts", () => {
        const bars = syntheticBars(20, 7);
        const identities = new Set<unknown>();
        let toggle = false;
        harness(bars, bars.length + 1, (bar) => {
            toggle = !toggle;
            identities.add(
                toggle
                    ? crossover("slot", bar.close, 100)
                    : crossover("slot", bar.close, 100, { offset: 0 }),
            );
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("offset === k > 0 shifts the boolean series by k bars", () => {
        // [1, 2, 4] crosses 3 at bar 2 (out[2] === true). With offset 1
        // applied, .current at bar 2 reads out[2-? wait] reads at(1) which
        // is bar 1's value (false); .current at bar 3 (if we had it) would
        // read bar 2's value (true). Use a 4-bar fixture.
        const bars = makeBars([1, 2, 4, 5]);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => crossover("slot", bar.close, 3, { offset: 1 }).current,
        );
        expect(out[0]).toBe(undefined); // OOR (no prior bar to read)
        expect(out[1]).toBe(false); // bar 0
        expect(out[2]).toBe(false); // bar 1
        expect(out[3]).toBe(true); // bar 2 (the crossover)
    });

    it("offset === -k returns undefined at the head (future read)", () => {
        const bars = makeBars([1, 2, 4]);
        const head = harness(
            bars,
            bars.length + 1,
            (bar) => crossover("slot", bar.close, 3, { offset: -1 }).current,
        );
        expect(head[head.length - 1]).toBe(undefined);
    });

    it("two calls with the same non-zero offset return the same Series identity", () => {
        const bars = syntheticBars(10, 3);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            identities.add(crossover("slot", bar.close, 100, { offset: 2 }));
            return null;
        });
        expect(identities.size).toBe(1);
    });
});
