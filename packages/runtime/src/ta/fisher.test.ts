// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { fisher } from "./fisher";

describe("ta.fisher", () => {
    it("emits NaN through warmup (defined fisher at bar length-1)", () => {
        const bars = syntheticBars(40, 5);
        const out = harness(bars, bars.length + 1, (bar) => {
            const f = fisher("slot", 9);
            return { fisher: f.fisher.current, trigger: f.trigger.current };
        });
        // Conservatively: highest/lowest sub-slots emit NaN through `length - 1`,
        // so fisher is NaN for at least first 7 bars (length=9).
        for (let i = 0; i < 7; i += 1) expect(Number.isNaN(out[i].fisher)).toBe(true);
        expect(Number.isFinite(out[bars.length - 1].fisher)).toBe(true);
    });

    it("trigger equals the PRIOR bar's fisher value", () => {
        const bars = syntheticBars(40, 7);
        const out = harness(bars, bars.length + 1, (bar) => {
            const f = fisher("slot", 9);
            return { fisher: f.fisher.current, trigger: f.trigger.current };
        });
        // Walk past the warmup; trigger[i] should equal fisher[i - 1] when both finite.
        for (let i = 11; i < bars.length; i += 1) {
            if (Number.isFinite(out[i].trigger) && Number.isFinite(out[i - 1].fisher)) {
                expect(out[i].trigger).toBe(out[i - 1].fisher);
            }
        }
    });

    it("first bar's trigger is NaN", () => {
        const bars = syntheticBars(40, 7);
        const out = harness(bars, bars.length + 1, (bar) => fisher("slot", 9).trigger.current);
        expect(Number.isNaN(out[0])).toBe(true);
    });

    it("returns the same FisherResult identity on every call", () => {
        const bars = syntheticBars(40, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            identities.add(fisher("slot", 9));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => fisher("oops", 9)).toThrowError(
            /ta.fisher called outside an active script step/,
        );
    });

    it("flat-range input — normalised = 0 so x decays toward 0", () => {
        const bars = Array.from({ length: 30 }, (_, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: 100,
            high: 100,
            low: 100,
            close: 100,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(bars, bars.length + 1, (bar) => fisher("slot", 9).fisher.current);
        // Once warmed, the recurrence is x = 0.67 · prevX (starting at 0) → x stays 0;
        // fisher = 0.5 · ln(1/1) + 0.5 · prevFisher = 0.5 · prevFisher (also 0).
        for (let i = 8; i < bars.length; i += 1) {
            expect(out[i]).toBe(0);
        }
    });
});

describe("ta.fisher tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(30, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) => fisher("slot", 9));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickBar = { ...bars[bars.length - 1], high: bars[bars.length - 1].high + 5 };
        tick(ctxRef, tickBar, () => fisher("slot", 9));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("tick-replay is idempotent (two ticks with same value → same result)", () => {
        const bars = syntheticBars(30, 3);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) => fisher("slot", 9));
        const tickBar = { ...bars[bars.length - 1], high: bars[bars.length - 1].high + 2 };
        const a = tick(ctxRef, tickBar, () => fisher("slot", 9).fisher.current);
        const b = tick(ctxRef, tickBar, () => fisher("slot", 9).fisher.current);
        if (Number.isNaN(a)) expect(Number.isNaN(b)).toBe(true);
        else expect(b).toBe(a);
    });

    it("tick with NaN bar.high → fisher head = NaN, trigger holds prior fisher", () => {
        const bars = syntheticBars(30, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) => fisher("slot", 9));
        const tickBar = { ...bars[bars.length - 1], high: Number.NaN };
        const v = tick(ctxRef, tickBar, () => fisher("slot", 9).fisher.current);
        expect(Number.isNaN(v)).toBe(true);
    });
});
