// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { roc } from "./roc.js";

describe("ta.roc", () => {
    it("emits NaN for the first `length` bars", () => {
        const bars = syntheticBars(20, 7);
        const length = 5;
        const out = harness(bars, bars.length + 1, (bar) => roc("slot", bar.close, length).current);
        for (let i = 0; i < length; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[length])).toBe(true);
    });

    it("returns 100 × (source[t] − source[t − length]) / source[t − length]", () => {
        const bars = syntheticBars(15, 11);
        const length = 3;
        const out = harness(bars, bars.length + 1, (bar) => roc("slot", bar.close, length).current);
        for (let i = length; i < bars.length; i += 1) {
            const head = bars[i].close;
            const old = bars[i - length].close;
            const expected = (100 * (head - old)) / old;
            expect(out[i]).toBeCloseTo(expected, 10);
        }
    });

    it("emits NaN when the lookback source is exactly zero", () => {
        const bars = syntheticBars(10, 3).map((b, i) => (i === 2 ? { ...b, close: 0 } : b));
        const out = harness(bars, bars.length + 1, (bar) => roc("slot", bar.close, 3).current);
        expect(Number.isNaN(out[5])).toBe(true);
    });

    it("emits NaN when the head source is NaN", () => {
        const bars = syntheticBars(10, 3).map((b, i) =>
            i === 7 ? { ...b, close: Number.NaN } : b,
        );
        const out = harness(bars, bars.length + 1, (bar) => roc("slot", bar.close, 2).current);
        expect(Number.isNaN(out[7])).toBe(true);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(8, 2);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            identities.add(roc("slot", bar.close, 2));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => roc("oops", 1, 5)).toThrowError(/ta.roc called outside an active script step/);
    });
});

describe("ta.roc tick-mode", () => {
    it("replaces the head against the original lookback target", () => {
        const bars = syntheticBars(12, 6);
        const length = 4;
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            roc("slot", bar.close, length),
        );
        const tickClose = bars[bars.length - 1].close + 11;
        const head = tick(
            ctxRef,
            { ...bars[bars.length - 1], close: tickClose },
            () => roc("slot", tickClose, length).current,
        );
        const lookback = bars[bars.length - 1 - length].close;
        const expected = (100 * (tickClose - lookback)) / lookback;
        expect(head).toBeCloseTo(expected, 10);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(2, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            roc("slot", bar.close, 5),
        );
        const head = tick(ctxRef, bars[1], () => roc("slot", bars[1].close, 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick with NaN source returns NaN", () => {
        const bars = syntheticBars(10, 1);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            roc("slot", bar.close, 2),
        );
        const head = tick(ctxRef, bars[bars.length - 1], () => roc("slot", Number.NaN, 2).current);
        expect(Number.isNaN(head)).toBe(true);
    });
});
