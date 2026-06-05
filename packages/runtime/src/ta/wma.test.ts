// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { wmaFloat64 } from "./lib/wmaFloat64";
import { wma } from "./wma";

describe("ta.wma", () => {
    it("matches wmaFloat64 over a 50-bar synthetic walk", () => {
        const bars = syntheticBars(50, 11);
        const closes = new Float64Array(bars.map((b) => b.close));
        const expected = wmaFloat64(closes, 10);
        const actual = harness(bars, bars.length + 1, (bar) => wma("slot", bar.close, 10).current);
        for (let i = 0; i < bars.length; i += 1) {
            const a = actual[i];
            const e = expected[i];
            if (Number.isNaN(e)) expect(Number.isNaN(a)).toBe(true);
            else expect(a).toBeCloseTo(e, 10);
        }
    });

    it("emits NaN until the window is filled", () => {
        const bars = syntheticBars(20, 5);
        const out = harness(bars, bars.length + 1, (bar) => wma("slot", bar.close, 4).current);
        for (let i = 0; i < 3; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[3])).toBe(true);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            const s = wma("slot", bar.close, 3);
            identities.add(s);
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => wma("oops", 1, 3)).toThrowError(/ta.wma called outside an active script step/);
    });

    it("emits NaN when any source in the window is NaN (full-window short-circuit)", () => {
        const bars = syntheticBars(20, 4).map((b, i) =>
            i === 10 ? { ...b, close: Number.NaN } : b,
        );
        const out = harness(bars, bars.length + 1, (bar) => wma("slot", bar.close, 5).current);
        // The NaN at bar 10 short-circuits bars 10..14 (window covers
        // [t-4..t], so 10 is in the window of every bar in 10..14).
        for (let i = 10; i <= 14; i += 1) {
            expect(Number.isNaN(out[i])).toBe(true);
        }
        // Bar 15 — window is [11..15], no NaN.
        expect(Number.isFinite(out[15])).toBe(true);
    });

    it("equals the constant for a constant-input stream past warmup", () => {
        const bars = [5, 5, 5, 5, 5, 5, 5, 5].map((c, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: c,
            high: c,
            low: c,
            close: c,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(bars, bars.length + 1, (bar) => wma("slot", bar.close, 4).current);
        for (let i = 3; i < bars.length; i += 1) {
            expect(out[i]).toBeCloseTo(5, 12);
        }
    });
});

describe("ta.wma tick-mode", () => {
    it("replaces the head without advancing the window", () => {
        const bars = syntheticBars(10, 8);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            wma("slot", bar.close, 4),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickClose = bars[bars.length - 1].close + 5;
        tick(ctxRef, { ...bars[bars.length - 1], close: tickClose }, () =>
            wma("slot", tickClose, 4),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(20, 9);
        const length = 5;
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            wma("slot", bar.close, length),
        );
        const tickClose = bars[bars.length - 1].close + 10;
        const tickBar = { ...bars[bars.length - 1], close: tickClose };
        const a = tick(ctxRef, tickBar, () => wma("slot", tickClose, length).current);
        const b = tick(ctxRef, tickBar, () => wma("slot", tickClose, length).current);
        expect(b).toBeCloseTo(a, 12);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(3, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            wma("slot", bar.close, 5),
        );
        const head = tick(ctxRef, bars[2], () => wma("slot", bars[2].close, 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick with NaN source returns NaN", () => {
        const bars = syntheticBars(20, 1);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            wma("slot", bar.close, 5),
        );
        const head = tick(ctxRef, bars[bars.length - 1], () => wma("slot", Number.NaN, 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick value matches a recomputed reference against the closed window", () => {
        const bars = syntheticBars(20, 3);
        const length = 4;
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            wma("slot", bar.close, length),
        );
        const tickClose = bars[bars.length - 1].close + 2;
        const head = tick(
            ctxRef,
            { ...bars[bars.length - 1], close: tickClose },
            () => wma("slot", tickClose, length).current,
        );
        // Reference: head replaces bars[N-1]; window is bars[N-4..N-1].
        const denom = (length * (length + 1)) / 2;
        let sum = tickClose * length;
        for (let j = 1; j < length; j += 1) {
            sum += bars[bars.length - 1 - j].close * (length - j);
        }
        expect(head).toBeCloseTo(sum / denom, 10);
    });

    it("tick with NaN somewhere in the closed window returns NaN", () => {
        const bars = syntheticBars(10, 4).map((b, i) =>
            i === 7 ? { ...b, close: Number.NaN } : b,
        );
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            wma("slot", bar.close, 4),
        );
        const head = tick(
            ctxRef,
            bars[bars.length - 1],
            () => wma("slot", bars[bars.length - 1].close, 4).current,
        );
        // The window for bar 9 covers bars 6..9; bar 7 is NaN.
        expect(Number.isNaN(head)).toBe(true);
    });
});
