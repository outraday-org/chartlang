// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { change } from "./change";

describe("ta.change", () => {
    it("emits NaN for the first `length` bars (default length=1 → 1 NaN)", () => {
        const bars = syntheticBars(10, 5);
        const out = harness(bars, bars.length + 1, (bar) => change("slot", bar.close).current);
        expect(Number.isNaN(out[0])).toBe(true);
        expect(Number.isFinite(out[1])).toBe(true);
    });

    it("returns source[t] - source[t - length]", () => {
        const bars = syntheticBars(20, 11);
        const length = 5;
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => change("slot", bar.close, { length }).current,
        );
        for (let i = length; i < bars.length; i += 1) {
            const expected = bars[i].close - bars[i - length].close;
            expect(out[i]).toBeCloseTo(expected, 12);
        }
        for (let i = 0; i < length; i += 1) {
            expect(Number.isNaN(out[i])).toBe(true);
        }
    });

    it("emits NaN when the source is NaN", () => {
        const bars = syntheticBars(10, 4).map((b, i) =>
            i === 5 ? { ...b, close: Number.NaN } : b,
        );
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => change("slot", bar.close, { length: 1 }).current,
        );
        expect(Number.isNaN(out[5])).toBe(true);
    });

    it("emits NaN when the lookback target is NaN", () => {
        const bars = syntheticBars(10, 4).map((b, i) =>
            i === 2 ? { ...b, close: Number.NaN } : b,
        );
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => change("slot", bar.close, { length: 3 }).current,
        );
        // bar 5 looks back at bar 2 (NaN).
        expect(Number.isNaN(out[5])).toBe(true);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            const s = change("slot", bar.close);
            identities.add(s);
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => change("oops", 1)).toThrowError(
            /ta.change called outside an active script step/,
        );
    });
});

describe("ta.change tick-mode", () => {
    it("replaces the head against the original lookback target", () => {
        const bars = syntheticBars(10, 6);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            change("slot", bar.close, { length: 3 }),
        );
        const tickClose = bars[bars.length - 1].close + 10;
        const head = tick(
            ctxRef,
            { ...bars[bars.length - 1], close: tickClose },
            () => change("slot", tickClose, { length: 3 }).current,
        );
        const expected = tickClose - bars[bars.length - 1 - 3].close;
        expect(head).toBeCloseTo(expected, 12);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(2, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            change("slot", bar.close, { length: 5 }),
        );
        const head = tick(
            ctxRef,
            bars[1],
            () => change("slot", bars[1].close, { length: 5 }).current,
        );
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick with NaN source returns NaN", () => {
        const bars = syntheticBars(10, 1);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            change("slot", bar.close, { length: 2 }),
        );
        const head = tick(
            ctxRef,
            bars[bars.length - 1],
            () => change("slot", Number.NaN, { length: 2 }).current,
        );
        expect(Number.isNaN(head)).toBe(true);
    });
});
