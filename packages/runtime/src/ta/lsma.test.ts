// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { linearRegression } from "./lib/linearRegression";
import { lsma } from "./lsma";

describe("ta.lsma", () => {
    it("matches the linearRegression reference over a 50-bar synthetic walk", () => {
        const bars = syntheticBars(50, 11);
        const closes = new Float64Array(bars.map((b) => b.close));
        const expected = linearRegression(closes, 10).value;
        const actual = harness(bars, bars.length + 1, (bar) => lsma("slot", bar.close, 10).current);
        for (let i = 0; i < bars.length; i += 1) {
            const a = actual[i];
            const e = expected[i];
            if (Number.isNaN(e)) expect(Number.isNaN(a)).toBe(true);
            else expect(a).toBeCloseTo(e, 10);
        }
    });

    it("emits NaN until length - 1 closed bars", () => {
        const bars = syntheticBars(20, 5);
        const out = harness(bars, bars.length + 1, (bar) => lsma("slot", bar.close, 5).current);
        for (let i = 0; i < 4; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[4])).toBe(true);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            const s = lsma("slot", bar.close, 3);
            identities.add(s);
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => lsma("oops", 1, 3)).toThrowError(
            /ta.lsma called outside an active script step/,
        );
    });

    it("emits NaN when any source in the window is NaN (full-window short-circuit)", () => {
        const bars = syntheticBars(20, 4).map((b, i) =>
            i === 10 ? { ...b, close: Number.NaN } : b,
        );
        const out = harness(bars, bars.length + 1, (bar) => lsma("slot", bar.close, 5).current);
        // Bar 10 carries NaN; window for any bar containing it (10..14) → NaN.
        expect(Number.isNaN(out[10])).toBe(true);
        expect(Number.isNaN(out[14])).toBe(true);
        // Once the NaN slides past the trailing edge of the window
        // (bar >= 15), the regression has finite inputs again.
        expect(Number.isFinite(out[15])).toBe(true);
    });

    it("equals the constant for a constant-input stream past warmup", () => {
        const bars = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5].map((c, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: c,
            high: c,
            low: c,
            close: c,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(bars, bars.length + 1, (bar) => lsma("slot", bar.close, 4).current);
        // length - 1 = 3 warmup bars; first defined at index 3. The
        // regression line through a constant series is the constant
        // itself (slope = 0, intercept = constant).
        for (let i = 3; i < bars.length; i += 1) {
            expect(out[i]).toBeCloseTo(5, 12);
        }
    });

    it("tracks a linear ramp exactly (zero residual regression)", () => {
        // src[t] = 100 + 2·t. The OLS fit is `slope = 2, intercept = src[t - length + 1]`
        // so LSMA = src[t] at every bar past warmup (the line passes through
        // the last window point exactly).
        const bars = Array.from({ length: 20 }, (_, i) => {
            const c = 100 + 2 * i;
            return {
                time: 1_700_000_000_000 + i * 60_000,
                open: c,
                high: c,
                low: c,
                close: c,
                volume: 0,
                symbol: "T",
                interval: "1m",
            };
        });
        const out = harness(bars, bars.length + 1, (bar) => lsma("slot", bar.close, 5).current);
        for (let i = 4; i < bars.length; i += 1) {
            expect(out[i]).toBeCloseTo(bars[i].close, 10);
        }
    });
});

describe("ta.lsma tick-mode", () => {
    it("replaces the head without advancing the buffer", () => {
        const bars = syntheticBars(20, 8);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            lsma("slot", bar.close, 4),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickClose = bars[bars.length - 1].close + 5;
        tick(ctxRef, { ...bars[bars.length - 1], close: tickClose }, () =>
            lsma("slot", tickClose, 4),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(30, 9);
        const length = 5;
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            lsma("slot", bar.close, length),
        );
        const tickClose = bars[bars.length - 1].close + 10;
        const tickBar = { ...bars[bars.length - 1], close: tickClose };
        const a = tick(ctxRef, tickBar, () => lsma("slot", tickClose, length).current);
        const b = tick(ctxRef, tickBar, () => lsma("slot", tickClose, length).current);
        expect(b).toBeCloseTo(a, 12);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(3, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            lsma("slot", bar.close, 5),
        );
        const head = tick(ctxRef, bars[2], () => lsma("slot", bars[2].close, 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick with NaN source returns NaN (window-short-circuit semantic)", () => {
        const bars = syntheticBars(30, 1);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            lsma("slot", bar.close, 5),
        );
        const head = tick(ctxRef, bars[bars.length - 1], () => lsma("slot", Number.NaN, 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });
});
