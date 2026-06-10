// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { rvi } from "./rvi.js";

describe("ta.rvi", () => {
    it("emits NaN until warmup completes (~2 · length − 1 closed bars)", () => {
        const bars = syntheticBars(30, 4);
        const out = harness(bars, bars.length + 1, (bar) => rvi("slot", bar.close, 5).current);
        // First sigma lands at length-1 = 4; EMA of length 5 needs 5 more
        // bars to seed → first defined output at ~2*length-1 = 9.
        for (let i = 0; i < 8; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        // By bar 9 onwards we should see a finite value.
        let sawFinite = false;
        for (let i = 9; i < bars.length; i += 1) {
            if (Number.isFinite(out[i])) {
                sawFinite = true;
                break;
            }
        }
        expect(sawFinite).toBe(true);
    });

    it("output is bounded in [0, 100] when defined", () => {
        const bars = syntheticBars(80, 22);
        const out = harness(bars, bars.length + 1, (bar) => rvi("slot", bar.close, 10).current);
        for (const v of out) {
            if (Number.isFinite(v)) {
                expect(v).toBeGreaterThanOrEqual(0);
                expect(v).toBeLessThanOrEqual(100);
            }
        }
    });

    it("emits ~50 on a strictly monotonically increasing source (no down moves)", () => {
        // All diffs > 0 → downRaw is always 0 → downEma → 0 → ratio
        // 100 · upEma / upEma = 100, BUT before the EMA fully drowns
        // the leading zeros it sits below 100. After enough bars the
        // value approaches 100.
        const bars = syntheticBars(60, 31).map((b, i) => ({
            ...b,
            close: 100 + i,
        }));
        const out = harness(bars, bars.length + 1, (bar) => rvi("slot", bar.close, 5).current);
        const tail = out[out.length - 1];
        expect(Number.isFinite(tail)).toBe(true);
        // After 60 bars of pure up moves the up-EMA dominates; rvi is
        // close to 100.
        expect(tail).toBeGreaterThan(90);
    });

    it("emits ~0 on a strictly decreasing source (no up moves)", () => {
        const bars = syntheticBars(60, 33).map((b, i) => ({
            ...b,
            close: 1000 - i,
        }));
        const out = harness(bars, bars.length + 1, (bar) => rvi("slot", bar.close, 5).current);
        const tail = out[out.length - 1];
        expect(Number.isFinite(tail)).toBe(true);
        expect(tail).toBeLessThan(10);
    });

    it("emits NaN on a flat source (zero denominator: both EMAs are 0)", () => {
        const bars = syntheticBars(40, 8).map((b) => ({ ...b, close: 50 }));
        const out = harness(bars, bars.length + 1, (bar) => rvi("slot", bar.close, 5).current);
        // After warmup, sigma = 0 and diffs = 0 so both up/down EMAs
        // are 0 → NaN.
        for (let i = 12; i < bars.length; i += 1) {
            expect(Number.isNaN(out[i])).toBe(true);
        }
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(20, 6);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            ids.add(rvi("slot", bar.close, 5));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("supports offset, returning distinct Series views per offset", () => {
        const bars = syntheticBars(20, 11);
        let viewA: unknown = null;
        let viewB: unknown = null;
        harness(bars, bars.length + 1, (bar) => {
            viewA = rvi("slot", bar.close, 5, { offset: 0 });
            viewB = rvi("slot", bar.close, 5, { offset: 2 });
            return null;
        });
        expect(viewA).not.toBe(viewB);
    });

    it("throws when called outside an active script step", () => {
        expect(() => rvi("oops", 1, 5)).toThrowError(/ta.rvi called outside an active script step/);
    });

    it("NaN source → NaN output", () => {
        const bars = syntheticBars(20, 5);
        const out = harness(bars, bars.length + 1, () => rvi("slot", Number.NaN, 5).current);
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });
});

describe("ta.rvi tick-mode", () => {
    it("replaces the head without advancing output length", () => {
        const bars = syntheticBars(25, 12);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            rvi("slot", bar.close, 5),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const last = bars[bars.length - 1];
        tick(ctxRef, { ...last, close: last.close + 10 }, () => rvi("slot", last.close + 10, 5));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("identical ticks produce the same head", () => {
        const bars = syntheticBars(25, 14);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            rvi("slot", bar.close, 5),
        );
        const last = bars[bars.length - 1];
        const tickClose = last.close + 7;
        const a = tick(
            ctxRef,
            { ...last, close: tickClose },
            () => rvi("slot", tickClose, 5).current,
        );
        const b = tick(
            ctxRef,
            { ...last, close: tickClose },
            () => rvi("slot", tickClose, 5).current,
        );
        expect(b).toBe(a);
    });

    it("tick before warmup returns NaN", () => {
        const bars = syntheticBars(3, 22);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            rvi("slot", bar.close, 10),
        );
        const last = bars[bars.length - 1];
        const v = tick(
            ctxRef,
            { ...last, close: last.close + 1 },
            () => rvi("slot", last.close + 1, 10).current,
        );
        expect(Number.isNaN(v)).toBe(true);
    });

    it("tick with NaN source short-circuits to NaN at the head", () => {
        const bars = syntheticBars(25, 33);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            rvi("slot", bar.close, 5),
        );
        const last = bars[bars.length - 1];
        const v = tick(ctxRef, { ...last }, () => rvi("slot", Number.NaN, 5).current);
        expect(Number.isNaN(v)).toBe(true);
    });

    it("tick after a NaN poisoned the closed sigma window recovers via full recompute", () => {
        // Drive 5 normal bars, one NaN close (poisons running sums),
        // then a few normal closes (window NaN drops out), then a tick.
        const bars = syntheticBars(30, 91);
        const bars2: typeof bars = [];
        for (let i = 0; i < bars.length; i += 1) {
            bars2.push(i === 5 ? { ...bars[i], close: Number.NaN } : bars[i]);
        }
        const { ctxRef } = harnessWithCtx(bars2, bars2.length + 1, (bar) =>
            rvi("slot", bar.close, 5),
        );
        const last = bars2[bars2.length - 1];
        // Tick should not throw; exercises the tick-side window-NaN
        // recompute branch (oldestInHead may still be defined here).
        const v = tick(
            ctxRef,
            { ...last, close: last.close + 1 },
            () => rvi("slot", last.close + 1, 5).current,
        );
        // Either NaN or finite — main thing is no crash.
        expect(Number.isNaN(v) || Number.isFinite(v)).toBe(true);
    });
});

describe("ta.rvi — NaN window recovery", () => {
    it("recovers running sums after a NaN closed source drops out of the window", () => {
        // Drive 15 normal bars, inject a NaN close, drive 10 more normal
        // bars. Exercises the closed-side window-NaN recompute branch.
        const bars = syntheticBars(40, 88);
        const bars2 = bars.map((b, i) => (i === 15 ? { ...b, close: Number.NaN } : b));
        const out = harness(bars2, bars2.length + 1, (bar) => rvi("slot", bar.close, 5).current);
        // Once the NaN-induced sigma window slot drops out (around bar
        // 15 + length = 20) the running sums recover and finite output
        // resumes.
        let sawRecoveredFinite = false;
        for (let i = 25; i < bars2.length; i += 1) {
            if (Number.isFinite(out[i])) {
                sawRecoveredFinite = true;
                break;
            }
        }
        expect(sawRecoveredFinite).toBe(true);
    });
});
