// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { dmi } from "./dmi.js";
import { wilderDirectional } from "./lib/wilderDirectional.js";
import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";

describe("ta.dmi", () => {
    it("matches the reference wilderDirectional output over 60 bars × length=14", () => {
        const bars = syntheticBars(60, 17);
        const highs = new Float64Array(bars.map((b) => b.high));
        const lows = new Float64Array(bars.map((b) => b.low));
        const closes = new Float64Array(bars.map((b) => b.close));
        const expected = wilderDirectional(highs, lows, closes, 14);
        const actual = harness(bars, bars.length + 1, () => {
            const r = dmi("slot", 14);
            return { plusDi: r.plusDi.current, minusDi: r.minusDi.current };
        });
        for (let i = 0; i < bars.length; i += 1) {
            if (Number.isNaN(expected.plusDi[i])) {
                expect(Number.isNaN(actual[i].plusDi)).toBe(true);
                expect(Number.isNaN(actual[i].minusDi)).toBe(true);
            } else {
                expect(actual[i].plusDi).toBeCloseTo(expected.plusDi[i], 10);
                expect(actual[i].minusDi).toBeCloseTo(expected.minusDi[i], 10);
            }
        }
    });

    it("emits NaN until `length` closed bars have been folded in", () => {
        const bars = syntheticBars(30, 5);
        const out = harness(bars, bars.length + 1, () => {
            const r = dmi("slot", 7);
            return { plusDi: r.plusDi.current, minusDi: r.minusDi.current };
        });
        // First defined at bar index `length`.
        for (let i = 0; i < 7; i += 1) {
            expect(Number.isNaN(out[i].plusDi)).toBe(true);
            expect(Number.isNaN(out[i].minusDi)).toBe(true);
        }
        expect(Number.isFinite(out[7].plusDi)).toBe(true);
        expect(Number.isFinite(out[7].minusDi)).toBe(true);
    });

    it("returns the same DmiResult identity on every call", () => {
        const bars = syntheticBars(20, 3);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            ids.add(dmi("slot", 5));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("falls back to 0 DI when smoothed TR is zero (constant-bar input)", () => {
        const bars = Array.from({ length: 10 }, (_, i) => ({
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
            const r = dmi("slot", 5);
            return { plusDi: r.plusDi.current, minusDi: r.minusDi.current };
        });
        expect(out[5].plusDi).toBe(0);
        expect(out[5].minusDi).toBe(0);
    });

    it("throws when called outside an active script step", () => {
        expect(() => dmi("oops", 5)).toThrowError(/ta.dmi called outside an active script step/);
    });

    it("holds prior values forward on a NaN bar (recurrence preserved)", () => {
        const bars = syntheticBars(30, 7);
        bars[20] = { ...bars[20], high: Number.NaN, low: Number.NaN, close: Number.NaN };
        const out = harness(bars, bars.length + 1, () => {
            const r = dmi("slot", 5);
            return { plusDi: r.plusDi.current, minusDi: r.minusDi.current };
        });
        // Bar 19 has a finite DI; bar 20 (NaN inputs) holds the value forward.
        expect(Number.isFinite(out[19].plusDi)).toBe(true);
        expect(out[20].plusDi).toBe(out[19].plusDi);
        expect(out[20].minusDi).toBe(out[19].minusDi);
    });

    it("opts.offset leaves the series unshifted (presentation-only)", () => {
        const bars = syntheticBars(30, 9);
        const unshifted = harness(bars, bars.length + 1, () => dmi("slot", 5).plusDi.current);
        const shifted = harness(
            bars,
            bars.length + 1,
            () => dmi("slot", 5, { offset: 2 }).plusDi.current,
        );
        for (let k = 0; k < bars.length; k += 1) {
            const u = unshifted[k];
            const s = shifted[k];
            if (Number.isNaN(u)) expect(Number.isNaN(s)).toBe(true);
            else expect(s).toBeCloseTo(u, 12);
        }
    });

    it("offset=0 returns the canonical result by identity (fast path)", () => {
        const bars = syntheticBars(8, 11);
        const seen = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            seen.add(dmi("slot", 3, { offset: 0 }));
            return null;
        });
        expect(seen.size).toBe(1);
    });
});

describe("ta.dmi tick-mode", () => {
    it("replaces the head without advancing the buffer", () => {
        const bars = syntheticBars(20, 4);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => dmi("slot", 7));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const last = bars[bars.length - 1];
        tick(ctxRef, { ...last, high: last.high + 1, low: last.low - 1 }, () => dmi("slot", 7));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(30, 12);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => dmi("slot", 7));
        const last = bars[bars.length - 1];
        const tickBar = { ...last, high: last.high + 0.5, low: last.low - 0.5 };
        const a = tick(ctxRef, tickBar, () => {
            const r = dmi("slot", 7);
            return { plusDi: r.plusDi.current, minusDi: r.minusDi.current };
        });
        const b = tick(ctxRef, tickBar, () => {
            const r = dmi("slot", 7);
            return { plusDi: r.plusDi.current, minusDi: r.minusDi.current };
        });
        expect(b.plusDi).toBeCloseTo(a.plusDi, 12);
        expect(b.minusDi).toBeCloseTo(a.minusDi, 12);
    });

    it("tick during DI warmup returns NaN", () => {
        const bars = syntheticBars(3, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, () => dmi("slot", 5));
        const head = tick(ctxRef, bars[2], () => {
            const r = dmi("slot", 5);
            return r.plusDi.current;
        });
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick on the seed-completion bar replays the same DI as the close", () => {
        // length=5 → seed completes at bar index 5 (6th closed bar).
        const bars = syntheticBars(6, 13);
        const { results, ctxRef } = harnessWithCtx(bars, bars.length + 5, () => {
            const r = dmi("slot", 5);
            return { plusDi: r.plusDi.current, minusDi: r.minusDi.current };
        });
        const closeHead = results[results.length - 1];
        const tickHead = tick(ctxRef, bars[bars.length - 1], () => {
            const r = dmi("slot", 5);
            return { plusDi: r.plusDi.current, minusDi: r.minusDi.current };
        });
        // Tick with the SAME OHLC as the close should reproduce the close's DI.
        expect(tickHead.plusDi).toBeCloseTo(closeHead.plusDi, 10);
        expect(tickHead.minusDi).toBeCloseTo(closeHead.minusDi, 10);
    });
});
