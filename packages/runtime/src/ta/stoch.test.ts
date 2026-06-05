// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { stoch } from "./stoch";

describe("ta.stoch", () => {
    it("emits NaN until warmup (kLength + kSmoothing + dLength - 3) bars elapse", () => {
        const bars = syntheticBars(40, 5);
        // Default opts: 14, 3, 3 → warmup = 14 + 3 + 3 - 3 = 17.
        const out = harness(bars, bars.length + 1, () => {
            const s = stoch("slot");
            return { k: s.k.current, d: s.d.current };
        });
        for (let i = 0; i < 17; i += 1) expect(Number.isNaN(out[i].d)).toBe(true);
        expect(Number.isFinite(out[17].d)).toBe(true);
    });

    it("k ∈ [0, 100] and d ∈ [0, 100] after warmup", () => {
        const bars = syntheticBars(60, 7);
        const out = harness(bars, bars.length + 1, () => {
            const s = stoch("slot", { kLength: 5, kSmoothing: 3, dLength: 3 });
            return { k: s.k.current, d: s.d.current };
        });
        for (let i = 9; i < bars.length; i += 1) {
            if (Number.isFinite(out[i].k)) {
                expect(out[i].k).toBeGreaterThanOrEqual(0);
                expect(out[i].k).toBeLessThanOrEqual(100);
            }
            if (Number.isFinite(out[i].d)) {
                expect(out[i].d).toBeGreaterThanOrEqual(0);
                expect(out[i].d).toBeLessThanOrEqual(100);
            }
        }
    });

    it("returns the same StochResult identity on every call", () => {
        const bars = syntheticBars(10, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            const s = stoch("slot");
            identities.add(s);
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => stoch("oops")).toThrowError(/ta.stoch called outside an active script step/);
    });

    it("flat-line window (hh === ll) emits NaN at k (and d)", () => {
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
        const out = harness(bars, bars.length + 1, () => {
            const s = stoch("slot", { kLength: 5, kSmoothing: 3, dLength: 3 });
            return { k: s.k.current, d: s.d.current };
        });
        // Once warmed-up, every k value should be NaN because kRaw is NaN.
        for (let i = 9; i < bars.length; i += 1) {
            expect(Number.isNaN(out[i].k)).toBe(true);
            expect(Number.isNaN(out[i].d)).toBe(true);
        }
    });

    it("uses defaults (14, 3, 3) when opts is omitted", () => {
        const bars = syntheticBars(30, 3);
        // No throw; output is reproducible (defaults applied).
        const out = harness(bars, bars.length + 1, () => {
            const s = stoch("slot");
            return { k: s.k.current, d: s.d.current };
        });
        expect(Number.isFinite(out[bars.length - 1].d)).toBe(true);
    });

    it("respects custom opts", () => {
        const bars = syntheticBars(30, 8);
        const out = harness(bars, bars.length + 1, () => {
            const s = stoch("slot", { kLength: 7, kSmoothing: 2, dLength: 2 });
            return { k: s.k.current, d: s.d.current };
        });
        // Warmup = 7 + 2 + 2 - 3 = 8; output at bar 8 should be defined.
        expect(Number.isFinite(out[8].d)).toBe(true);
    });
});

describe("ta.stoch tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(30, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => stoch("slot"));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickBar = { ...bars[bars.length - 1], close: bars[bars.length - 1].close + 5 };
        tick(ctxRef, tickBar, () => stoch("slot"));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });
});
