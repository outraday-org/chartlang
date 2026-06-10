// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { obv } from "./obv.js";

const mkBar = (close: number, volume: number, timeOffset = 0): Bar => ({
    time: 1_700_000_000_000 + timeOffset,
    open: close,
    high: close,
    low: close,
    close,
    volume,
    symbol: "T",
    interval: "1m",
});

describe("ta.obv", () => {
    it("first bar emits 0 (no prior close to difference against)", () => {
        const bars = [mkBar(100, 50)];
        const out = harness(bars, bars.length + 1, () => obv("slot").current);
        expect(out[0]).toBe(0);
    });

    it("accumulates sign(close - prevClose) * volume", () => {
        const bars = [
            mkBar(100, 50, 0),
            mkBar(110, 100, 60_000),
            mkBar(90, 200, 120_000),
            mkBar(90, 300, 180_000),
            mkBar(95, 400, 240_000),
        ];
        const out = harness(bars, bars.length + 1, () => obv("slot").current);
        expect(out[0]).toBe(0);
        expect(out[1]).toBe(100);
        expect(out[2]).toBe(-100);
        expect(out[3]).toBe(-100);
        expect(out[4]).toBe(300);
    });

    it("flat close (delta = 0) contributes nothing", () => {
        const bars = [mkBar(100, 50, 0), mkBar(100, 999, 60_000)];
        const out = harness(bars, bars.length + 1, () => obv("slot").current);
        expect(out[1]).toBe(0);
    });

    it("NaN volume carries the accumulator forward without polluting it", () => {
        const bars = [
            mkBar(100, 50, 0),
            mkBar(110, 100, 60_000),
            { ...mkBar(120, Number.NaN, 120_000) },
            mkBar(130, 200, 180_000),
        ];
        const out = harness(bars, bars.length + 1, () => obv("slot").current);
        expect(out[1]).toBe(100);
        expect(out[2]).toBe(100);
        expect(out[3]).toBe(300);
    });

    it("NaN close holds prevClose at its prior value", () => {
        const bars = [
            mkBar(100, 50, 0),
            { ...mkBar(110, 100, 60_000), close: Number.NaN, high: Number.NaN, low: Number.NaN },
            mkBar(120, 200, 120_000),
        ];
        const out = harness(bars, bars.length + 1, () => obv("slot").current);
        expect(out[0]).toBe(0);
        expect(out[1]).toBe(0);
        // Bar 2 sees prev=100, delta=+20, contributes +200.
        expect(out[2]).toBe(200);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 3);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            identities.add(obv("slot"));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => obv("oops")).toThrowError(/ta.obv called outside an active script step/);
    });

    it("ignores the opts.offset placeholder (Phase-2 wiring is the no-op path)", () => {
        const bars = syntheticBars(8, 4);
        const out = harness(bars, bars.length + 1, () => obv("slot", { offset: 0 }).current);
        expect(out.length).toBe(bars.length);
        expect(out[0]).toBe(0);
    });
});

describe("ta.obv tick-mode", () => {
    it("replaces the head without polluting next close's accumulator", () => {
        const bars = [mkBar(100, 50, 0), mkBar(110, 100, 60_000), mkBar(120, 200, 120_000)];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => obv("slot"));
        // After close[2]: prev-close cum=100 (from bar 1), prev-close
        // prevClose=110. Tick at bar 2 with close=90 (delta vs 110 < 0)
        // → contribute -500.
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickBar: Bar = mkBar(90, 500, 120_000);
        const head = tick(ctxRef, tickBar, () => obv("slot").current);
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
        expect(head).toBe(100 - 500);
    });

    it("two identical ticks produce the same head", () => {
        const bars = [mkBar(100, 50, 0), mkBar(110, 100, 60_000)];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => obv("slot"));
        const tickBar: Bar = mkBar(120, 200, 60_000);
        let a = 0;
        let b = 0;
        tick(ctxRef, tickBar, () => {
            a = obv("slot").current;
            return a;
        });
        tick(ctxRef, tickBar, () => {
            b = obv("slot").current;
            return b;
        });
        expect(b).toBe(a);
    });

    it("tick with NaN volume carries the accumulator forward unchanged", () => {
        const bars = [mkBar(100, 50, 0), mkBar(110, 100, 60_000)];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => obv("slot"));
        const tickBar: Bar = mkBar(120, Number.NaN, 60_000);
        const head = tick(ctxRef, tickBar, () => obv("slot").current);
        // prev-close cum = 0 (snapshot before bar 1); fold(tickClose=120 vs
        // prevClose=100): NaN volume → no accumulator update → cumObv stays
        // at 0. Bar 1's normal close emitted 100; this tick replaces head
        // with 0.
        expect(head).toBe(0);
    });
});
