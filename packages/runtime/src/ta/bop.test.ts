// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { bop } from "./bop.js";

const mkBar = (
    open: number,
    high: number,
    low: number,
    close: number,
    volume = 100,
    timeOffset = 0,
): Bar => ({
    time: 1_700_000_000_000 + timeOffset,
    open,
    high,
    low,
    close,
    volume,
    symbol: "T",
    interval: "1m",
});

describe("ta.bop", () => {
    it("emits (close - open) / (high - low) per bar", () => {
        const bars = [
            mkBar(100, 110, 90, 105, 1, 0),
            mkBar(105, 115, 95, 100, 1, 60_000),
            mkBar(100, 102, 98, 101, 1, 120_000),
        ];
        const out = harness(bars, bars.length + 1, () => bop("slot").current);
        expect(out[0]).toBeCloseTo((105 - 100) / (110 - 90), 12);
        expect(out[1]).toBeCloseTo((100 - 105) / (115 - 95), 12);
        expect(out[2]).toBeCloseTo((101 - 100) / (102 - 98), 12);
    });

    it("returns 0 on a zero-range (high === low) bar", () => {
        const bars = [mkBar(100, 100, 100, 100, 1, 0)];
        const out = harness(bars, bars.length + 1, () => bop("slot").current);
        expect(out[0]).toBe(0);
    });

    it("propagates NaN OHLC to a NaN output", () => {
        const bars = [
            mkBar(100, 110, 90, 105, 1, 0),
            mkBar(Number.NaN, 115, 95, 100, 1, 60_000),
            mkBar(100, 102, 98, 101, 1, 120_000),
        ];
        const out = harness(bars, bars.length + 1, () => bop("slot").current);
        expect(out[0]).toBeCloseTo((105 - 100) / (110 - 90), 12);
        expect(Number.isNaN(out[1])).toBe(true);
        expect(out[2]).toBeCloseTo((101 - 100) / (102 - 98), 12);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 3);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            identities.add(bop("slot"));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => bop("oops")).toThrowError(/ta.bop called outside an active script step/);
    });

    it("ignores the opts.offset placeholder (Phase-2 wiring is the no-op path)", () => {
        const bars = syntheticBars(8, 4);
        const out = harness(bars, bars.length + 1, () => bop("slot", { offset: 0 }).current);
        for (let i = 0; i < bars.length; i += 1) {
            const expected = (bars[i].close - bars[i].open) / (bars[i].high - bars[i].low);
            expect(out[i]).toBeCloseTo(expected, 12);
        }
    });
});

describe("ta.bop tick-mode", () => {
    it("replaces the head without advancing the buffer", () => {
        const bars = [mkBar(100, 110, 90, 105, 1, 0), mkBar(105, 115, 95, 100, 1, 60_000)];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => bop("slot"));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickBar: Bar = mkBar(105, 120, 95, 118, 1, 60_000);
        const head = tick(ctxRef, tickBar, () => bop("slot").current);
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
        expect(head).toBeCloseTo((118 - 105) / (120 - 95), 12);
    });

    it("two identical ticks produce the same head", () => {
        const bars = [mkBar(100, 110, 90, 105, 1, 0), mkBar(105, 115, 95, 100, 1, 60_000)];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => bop("slot"));
        const tickBar: Bar = mkBar(105, 120, 95, 110, 1, 60_000);
        let a = 0;
        let b = 0;
        tick(ctxRef, tickBar, () => {
            a = bop("slot").current;
            return a;
        });
        tick(ctxRef, tickBar, () => {
            b = bop("slot").current;
            return b;
        });
        expect(b).toBe(a);
    });

    it("tick on a zero-range head returns 0", () => {
        const bars = [mkBar(100, 110, 90, 105, 1, 0), mkBar(105, 115, 95, 100, 1, 60_000)];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => bop("slot"));
        const tickBar: Bar = mkBar(110, 110, 110, 110, 1, 60_000);
        const head = tick(ctxRef, tickBar, () => bop("slot").current);
        expect(head).toBe(0);
    });
});
