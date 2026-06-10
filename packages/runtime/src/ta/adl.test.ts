// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { adl } from "./adl.js";

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

const mfv = (close: number, high: number, low: number, volume: number): number => {
    const range = high - low;
    if (range === 0) return 0;
    return ((close - low - (high - close)) / range) * volume;
};

describe("ta.adl", () => {
    it("first bar emits its own MFV (cumulative starting at 0 + mfv)", () => {
        const bars = [mkBar(100, 120, 80, 110, 100, 0)];
        const expected = mfv(110, 120, 80, 100);
        const out = harness(bars, bars.length + 1, () => adl("slot").current);
        expect(out[0]).toBeCloseTo(expected, 12);
    });

    it("accumulates MFV across bars", () => {
        const bars = [
            mkBar(100, 110, 90, 105, 100, 0),
            mkBar(105, 115, 95, 100, 200, 60_000),
            mkBar(100, 102, 98, 101, 300, 120_000),
        ];
        const expectedMfv = bars.map((b) => mfv(b.close, b.high, b.low, b.volume));
        const out = harness(bars, bars.length + 1, () => adl("slot").current);
        expect(out[0]).toBeCloseTo(expectedMfv[0], 12);
        expect(out[1]).toBeCloseTo(expectedMfv[0] + expectedMfv[1], 12);
        expect(out[2]).toBeCloseTo(expectedMfv[0] + expectedMfv[1] + expectedMfv[2], 12);
    });

    it("zero-range bar (high === low) contributes 0", () => {
        const bars = [mkBar(100, 110, 90, 105, 100, 0), mkBar(100, 100, 100, 100, 999, 60_000)];
        const first = mfv(105, 110, 90, 100);
        const out = harness(bars, bars.length + 1, () => adl("slot").current);
        expect(out[0]).toBeCloseTo(first, 12);
        expect(out[1]).toBeCloseTo(first, 12);
    });

    it("NaN volume contributes 0 (carries the accumulator forward)", () => {
        const bars = [
            mkBar(100, 110, 90, 105, 100, 0),
            { ...mkBar(105, 115, 95, 110, Number.NaN, 60_000) },
            mkBar(110, 120, 100, 115, 200, 120_000),
        ];
        const first = mfv(105, 110, 90, 100);
        const third = mfv(115, 120, 100, 200);
        const out = harness(bars, bars.length + 1, () => adl("slot").current);
        expect(out[0]).toBeCloseTo(first, 12);
        expect(out[1]).toBeCloseTo(first, 12);
        expect(out[2]).toBeCloseTo(first + third, 12);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 3);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            identities.add(adl("slot"));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => adl("oops")).toThrowError(/ta.adl called outside an active script step/);
    });

    it("ignores the opts.offset placeholder (Phase-2 wiring is the no-op path)", () => {
        const bars = syntheticBars(8, 4);
        const out = harness(bars, bars.length + 1, () => adl("slot", { offset: 0 }).current);
        expect(out.length).toBe(bars.length);
        expect(Number.isFinite(out[0])).toBe(true);
    });
});

describe("ta.adl tick-mode", () => {
    it("replaces the head without polluting next close's accumulator", () => {
        const bars = [mkBar(100, 110, 90, 105, 100, 0), mkBar(105, 115, 95, 100, 200, 60_000)];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => adl("slot"));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const first = mfv(105, 110, 90, 100);
        const tickBar: Bar = mkBar(105, 115, 95, 115, 200, 60_000);
        const tickMfv = mfv(115, 115, 95, 200);
        const head = tick(ctxRef, tickBar, () => adl("slot").current);
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
        expect(head).toBeCloseTo(first + tickMfv, 12);
    });

    it("two identical ticks produce the same head", () => {
        const bars = [mkBar(100, 110, 90, 105, 100, 0), mkBar(105, 115, 95, 100, 200, 60_000)];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => adl("slot"));
        const tickBar: Bar = mkBar(105, 115, 95, 110, 100, 60_000);
        let a = 0;
        let b = 0;
        tick(ctxRef, tickBar, () => {
            a = adl("slot").current;
            return a;
        });
        tick(ctxRef, tickBar, () => {
            b = adl("slot").current;
            return b;
        });
        expect(b).toBe(a);
    });

    it("tick with NaN volume returns the prior-close cum (no contribution)", () => {
        const bars = [mkBar(100, 110, 90, 105, 100, 0), mkBar(105, 115, 95, 100, 200, 60_000)];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => adl("slot"));
        const tickBar: Bar = mkBar(105, 115, 95, 110, Number.NaN, 60_000);
        const head = tick(ctxRef, tickBar, () => adl("slot").current);
        const first = mfv(105, 110, 90, 100);
        // prev-closed cum (snapshot before bar 1) = first; tick adds 0
        // (NaN volume) → head = first.
        expect(head).toBeCloseTo(first, 12);
    });
});
