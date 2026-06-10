// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { vwmaFloat64 } from "./lib/vwmaFloat64.js";
import { vwma } from "./vwma.js";

describe("ta.vwma", () => {
    it("matches vwmaFloat64 over a 50-bar synthetic walk", () => {
        const bars = syntheticBars(50, 17);
        const closes = new Float64Array(bars.map((b) => b.close));
        const volumes = new Float64Array(bars.map((b) => b.volume));
        const expected = vwmaFloat64(closes, volumes, 10);
        const actual = harness(bars, bars.length + 1, (bar) => vwma("slot", bar.close, 10).current);
        for (let i = 0; i < bars.length; i += 1) {
            const a = actual[i];
            const e = expected[i];
            if (Number.isNaN(e)) expect(Number.isNaN(a)).toBe(true);
            else expect(a).toBeCloseTo(e, 10);
        }
    });

    it("emits NaN until the window is filled", () => {
        const bars = syntheticBars(20, 5);
        const out = harness(bars, bars.length + 1, (bar) => vwma("slot", bar.close, 4).current);
        for (let i = 0; i < 3; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        // synthetic bars have non-zero volume by construction; bar 3 onward
        // must produce finite output.
        expect(Number.isFinite(out[3])).toBe(true);
    });

    it("equals SMA when every bar has identical positive volume", () => {
        const bars = [10, 12, 14, 11, 13, 15, 12, 14].map((c, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: c,
            high: c,
            low: c,
            close: c,
            volume: 100,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(bars, bars.length + 1, (bar) => vwma("slot", bar.close, 4).current);
        // With identical volumes, VWMA collapses to SMA. Bar 3: mean(10,12,14,11) = 11.75.
        expect(out[3]).toBeCloseTo(11.75, 12);
        // Bar 5: mean(14,11,13,15) = 13.25.
        expect(out[5]).toBeCloseTo(13.25, 12);
    });

    it("emits NaN when the trailing-window volume sum is 0", () => {
        const bars = [10, 11, 12, 13].map((c, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: c,
            high: c,
            low: c,
            close: c,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(bars, bars.length + 1, (bar) => vwma("slot", bar.close, 3).current);
        expect(Number.isNaN(out[2])).toBe(true);
        expect(Number.isNaN(out[3])).toBe(true);
    });

    it("emits NaN when any source in the window is NaN", () => {
        const bars = syntheticBars(20, 4).map((b, i) =>
            i === 10 ? { ...b, close: Number.NaN } : b,
        );
        const out = harness(bars, bars.length + 1, (bar) => vwma("slot", bar.close, 5).current);
        for (let i = 10; i <= 14; i += 1) {
            expect(Number.isNaN(out[i])).toBe(true);
        }
        expect(Number.isFinite(out[15])).toBe(true);
    });

    it("treats NaN volume as 0 (ignored from the weighted sum and denominator)", () => {
        const bars = [10, 12, 14, 16].map((c, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: c,
            high: c,
            low: c,
            close: c,
            // Bar 1 has NaN volume → treated as 0.
            volume: i === 1 ? Number.NaN : 100,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(bars, bars.length + 1, (bar) => vwma("slot", bar.close, 3).current);
        // Bar 2: window (10·100 + 12·0 + 14·100) / (100 + 0 + 100) = 2400 / 200 = 12.
        expect(out[2]).toBeCloseTo(12, 12);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            const s = vwma("slot", bar.close, 3);
            identities.add(s);
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => vwma("oops", 1, 3)).toThrowError(
            /ta.vwma called outside an active script step/,
        );
    });
});

describe("ta.vwma tick-mode", () => {
    it("replaces the head without advancing the window", () => {
        const bars = syntheticBars(10, 8);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            vwma("slot", bar.close, 4),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickClose = bars[bars.length - 1].close + 5;
        tick(ctxRef, { ...bars[bars.length - 1], close: tickClose }, () =>
            vwma("slot", tickClose, 4),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(20, 9);
        const length = 5;
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            vwma("slot", bar.close, length),
        );
        const tickClose = bars[bars.length - 1].close + 10;
        const tickBar = { ...bars[bars.length - 1], close: tickClose };
        const a = tick(ctxRef, tickBar, () => vwma("slot", tickClose, length).current);
        const b = tick(ctxRef, tickBar, () => vwma("slot", tickClose, length).current);
        expect(b).toBeCloseTo(a, 12);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(3, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            vwma("slot", bar.close, 5),
        );
        const head = tick(ctxRef, bars[2], () => vwma("slot", bars[2].close, 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick with NaN source returns NaN", () => {
        const bars = syntheticBars(20, 1);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            vwma("slot", bar.close, 5),
        );
        const head = tick(ctxRef, bars[bars.length - 1], () => vwma("slot", Number.NaN, 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick with NaN volume treats the head's contribution as zero", () => {
        // Constant-source, positive-volume window with a single bar; tick's
        // NaN volume removes the head from the weighted sum AND denominator.
        // With length=3 and bars at constant volume 100, the closed window
        // for bar 2 = [bar0,bar1,bar2]. A tick with NaN volume on bar 2
        // computes (src·0 + bar1·100 + bar0·100) / (0 + 100 + 100) =
        // weighted mean of bar0+bar1.
        const bars = [10, 20, 30].map((c, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: c,
            high: c,
            low: c,
            close: c,
            volume: 100,
            symbol: "T",
            interval: "1m",
        }));
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            vwma("slot", bar.close, 3),
        );
        const tickClose = 999;
        const head = tick(
            ctxRef,
            { ...bars[bars.length - 1], close: tickClose, volume: Number.NaN },
            () => vwma("slot", tickClose, 3).current,
        );
        // (10·100 + 20·100 + 999·0) / (100 + 100 + 0) = 3000 / 200 = 15.
        expect(head).toBeCloseTo(15, 12);
    });

    it("tick with NaN source in the closed window returns NaN", () => {
        const bars = [10, Number.NaN, 30].map((c, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: 5,
            high: 5,
            low: 5,
            close: c,
            volume: 100,
            symbol: "T",
            interval: "1m",
        }));
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            vwma("slot", bar.close, 3),
        );
        const head = tick(ctxRef, bars[bars.length - 1], () => vwma("slot", 42, 3).current);
        // bar 1 is NaN — the closed window walk hits a NaN.
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick treats NaN volume in the closed window as zero", () => {
        const bars = [10, 20, 30].map((c, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: c,
            high: c,
            low: c,
            close: c,
            // Bar 1 has NaN volume → treated as 0 in tick replay.
            volume: i === 1 ? Number.NaN : 100,
            symbol: "T",
            interval: "1m",
        }));
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            vwma("slot", bar.close, 3),
        );
        const tickClose = 50;
        const head = tick(
            ctxRef,
            { ...bars[bars.length - 1], close: tickClose, volume: 100 },
            () => vwma("slot", tickClose, 3).current,
        );
        // (50·100 + 20·0 + 10·100) / (100 + 0 + 100) = 6000 / 200 = 30.
        expect(head).toBeCloseTo(30, 12);
    });

    it("tick with zero volume on a zero-volume window returns NaN", () => {
        const bars = [10, 11, 12, 13].map((c, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: c,
            high: c,
            low: c,
            close: c,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            vwma("slot", bar.close, 3),
        );
        const head = tick(
            ctxRef,
            { ...bars[bars.length - 1], volume: 0 },
            () => vwma("slot", 99, 3).current,
        );
        expect(Number.isNaN(head)).toBe(true);
    });
});
