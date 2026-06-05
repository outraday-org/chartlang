// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { ao } from "./ao";

function smaOfFloat64(values: Float64Array, length: number): Float64Array {
    const n = values.length;
    const out = new Float64Array(n);
    out.fill(Number.NaN);
    let sum = 0;
    for (let i = 0; i < n; i += 1) {
        sum += values[i];
        if (i >= length) sum -= values[i - length];
        if (i + 1 >= length) out[i] = sum / length;
    }
    return out;
}

describe("ta.ao", () => {
    it("emits NaN until slowLength bars have accumulated", () => {
        const bars = syntheticBars(40, 5);
        const out = harness(
            bars,
            bars.length + 1,
            (bar, _ctx) => ao("slot", { fastLength: 5, slowLength: 34 }).current,
        );
        for (let i = 0; i < 33; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[33])).toBe(true);
    });

    it("matches the brute-force SMA(hl2, fast) − SMA(hl2, slow)", () => {
        const bars = syntheticBars(60, 11);
        const out = harness(
            bars,
            bars.length + 1,
            (_bar) => ao("slot", { fastLength: 5, slowLength: 34 }).current,
        );
        const hl2 = new Float64Array(bars.length);
        for (let i = 0; i < bars.length; i += 1) {
            hl2[i] = (bars[i].high + bars[i].low) / 2;
        }
        const fast = smaOfFloat64(hl2, 5);
        const slow = smaOfFloat64(hl2, 34);
        for (let i = 33; i < bars.length; i += 1) {
            expect(out[i]).toBeCloseTo(fast[i] - slow[i], 10);
        }
    });

    it("honours custom fast/slow lengths", () => {
        const bars = syntheticBars(20, 4);
        const out = harness(
            bars,
            bars.length + 1,
            (_bar) => ao("slot", { fastLength: 3, slowLength: 7 }).current,
        );
        for (let i = 0; i < 6; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[6])).toBe(true);
    });

    it("falls back to Pine defaults (5 / 34) when opts is omitted", () => {
        const bars = syntheticBars(40, 9);
        const a = harness(bars, bars.length + 1, (_bar) => ao("sa").current);
        const b = harness(
            bars,
            bars.length + 1,
            (_bar) => ao("sb", { fastLength: 5, slowLength: 34 }).current,
        );
        for (let i = 0; i < a.length; i += 1) {
            if (Number.isNaN(a[i])) expect(Number.isNaN(b[i])).toBe(true);
            else expect(b[i]).toBeCloseTo(a[i], 12);
        }
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 2);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (_bar) => {
            identities.add(ao("slot"));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => ao("oops")).toThrowError(/ta.ao called outside an active script step/);
    });
});

describe("ta.ao tick-mode", () => {
    it("replaces the head with the SMA(hl2)-pair tick value", () => {
        const bars = syntheticBars(40, 6);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (_bar) =>
            ao("slot", { fastLength: 5, slowLength: 34 }),
        );
        const lastBar = bars[bars.length - 1];
        // Bump high/low to force a tick hl2 shift.
        const tickBar = {
            ...lastBar,
            high: lastBar.high + 5,
            low: lastBar.low + 5,
        };
        const head = tick(
            ctxRef,
            tickBar,
            () => ao("slot", { fastLength: 5, slowLength: 34 }).current,
        );
        expect(Number.isFinite(head)).toBe(true);
    });
});
