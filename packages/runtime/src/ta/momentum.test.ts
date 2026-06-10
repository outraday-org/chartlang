// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { momentum } from "./momentum.js";

describe("ta.momentum", () => {
    it("emits NaN for the first `length` bars", () => {
        const bars = syntheticBars(15, 7);
        const length = 5;
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => momentum("slot", bar.close, length).current,
        );
        for (let i = 0; i < length; i += 1) {
            expect(Number.isNaN(out[i])).toBe(true);
        }
        for (let i = length; i < out.length; i += 1) {
            expect(Number.isFinite(out[i])).toBe(true);
        }
    });

    it("returns source[t] − source[t − length]", () => {
        const bars = syntheticBars(20, 11);
        const length = 4;
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => momentum("slot", bar.close, length).current,
        );
        for (let i = length; i < bars.length; i += 1) {
            expect(out[i]).toBeCloseTo(bars[i].close - bars[i - length].close, 12);
        }
    });

    it("emits NaN when the source is NaN", () => {
        const bars = syntheticBars(10, 4).map((b, i) =>
            i === 6 ? { ...b, close: Number.NaN } : b,
        );
        const out = harness(bars, bars.length + 1, (bar) => momentum("slot", bar.close, 1).current);
        expect(Number.isNaN(out[6])).toBe(true);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(8, 2);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            identities.add(momentum("slot", bar.close, 3));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => momentum("oops", 1, 5)).toThrowError(
            /ta.momentum called outside an active script step/,
        );
    });
});

describe("ta.momentum tick-mode", () => {
    it("replaces the head against the original lookback target", () => {
        const bars = syntheticBars(12, 6);
        const length = 4;
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            momentum("slot", bar.close, length),
        );
        const tickClose = bars[bars.length - 1].close + 7;
        const head = tick(
            ctxRef,
            { ...bars[bars.length - 1], close: tickClose },
            () => momentum("slot", tickClose, length).current,
        );
        const expected = tickClose - bars[bars.length - 1 - length].close;
        expect(head).toBeCloseTo(expected, 12);
    });
});
