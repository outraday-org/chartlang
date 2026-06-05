// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { pvt } from "./pvt";

const mkBar = (close: number, volume: number, t = 0): Bar => ({
    time: 1_700_000_000_000 + t,
    open: close,
    high: close,
    low: close,
    close,
    volume,
    symbol: "T",
    interval: "1m",
});

describe("ta.pvt", () => {
    it("first bar emits 0 (no prior close to difference against)", () => {
        const bars = [mkBar(100, 50)];
        const out = harness(bars, bars.length + 1, () => pvt("slot").current);
        expect(out[0]).toBe(0);
    });

    it("accumulates volume × (close − prevClose) / prevClose", () => {
        const bars = [mkBar(100, 50, 0), mkBar(110, 100, 60_000), mkBar(99, 200, 120_000)];
        const out = harness(bars, bars.length + 1, () => pvt("slot").current);
        // bar 0 → 0.
        // bar 1 contribution = 100 * (110 - 100) / 100 = 10. cum = 10.
        // bar 2 contribution = 200 * (99 - 110) / 110 = -20. cum = -10.
        expect(out[0]).toBe(0);
        expect(out[1]).toBeCloseTo(10, 12);
        expect(out[2]).toBeCloseTo(-10, 12);
    });

    it("flat close (delta = 0) contributes nothing", () => {
        const bars = [mkBar(100, 50, 0), mkBar(100, 999, 60_000)];
        const out = harness(bars, bars.length + 1, () => pvt("slot").current);
        expect(out[1]).toBe(0);
    });

    it("NaN volume contributes 0 (carries cum forward, advances prevClose)", () => {
        const bars = [
            mkBar(100, 50, 0),
            mkBar(110, 100, 60_000),
            { ...mkBar(120, Number.NaN, 120_000) },
            mkBar(130, 200, 180_000),
        ];
        const out = harness(bars, bars.length + 1, () => pvt("slot").current);
        // bar 1 contribution = 100 * 10 / 100 = 10 → cum = 10.
        // bar 2 NaN volume → contribution = 0 → cum = 10 (prevClose → 120).
        // bar 3 contribution = 200 * (130 - 120) / 120 = 16.6666… → cum ≈ 26.6666.
        expect(out[1]).toBeCloseTo(10, 12);
        expect(out[2]).toBeCloseTo(10, 12);
        expect(out[3]).toBeCloseTo(10 + (200 * 10) / 120, 12);
    });

    it("zero prevClose emits NaN AND carries cumPvt forward", () => {
        const bars = [mkBar(0, 50, 0), mkBar(10, 100, 60_000), mkBar(20, 200, 120_000)];
        const out = harness(bars, bars.length + 1, () => pvt("slot").current);
        // bar 0 → 0 (seed prevClose = 0).
        // bar 1: prevClose === 0 → NaN AND carry cum (still 0); advance
        // prevClose to 10.
        // bar 2: contribution = 200 * (20 - 10) / 10 = 200 → cum = 0 + 200 = 200.
        expect(out[0]).toBe(0);
        expect(Number.isNaN(out[1])).toBe(true);
        expect(out[2]).toBeCloseTo(200, 12);
    });

    it("NaN close carries everything forward without advancing prevClose", () => {
        const bars = [
            mkBar(100, 50, 0),
            mkBar(110, 100, 60_000),
            { ...mkBar(Number.NaN, 200, 120_000) },
            mkBar(120, 300, 180_000),
        ];
        const out = harness(bars, bars.length + 1, () => pvt("slot").current);
        // bar 2 NaN close → emit prior cum (10) unchanged.
        // bar 3 should difference against bar-1 close (110), not bar-2.
        expect(out[1]).toBeCloseTo(10, 12);
        expect(out[2]).toBeCloseTo(10, 12);
        expect(out[3]).toBeCloseTo(10 + (300 * (120 - 110)) / 110, 12);
    });

    it("returns the same Series identity on every call (offset === 0)", () => {
        const bars = syntheticBars(10, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            identities.add(pvt("slot"));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("returns a stable per-offset Series identity", () => {
        const bars = syntheticBars(10, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            identities.add(pvt("slot", { offset: 3 }));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => pvt("oops")).toThrowError(/ta.pvt called outside an active script step/);
    });
});

describe("ta.pvt tick-mode", () => {
    it("replaces the head without polluting next close's accumulator", () => {
        const bars = [mkBar(100, 50, 0), mkBar(110, 100, 60_000), mkBar(120, 200, 120_000)];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => pvt("slot"));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickBar: Bar = mkBar(90, 500, 120_000);
        const head = tick(ctxRef, tickBar, () => pvt("slot").current);
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
        // prev-closed cum after bar 1 = 10; prev-closed prevClose = 110.
        // tick contribution = 500 * (90 - 110) / 110 ≈ -90.909.
        // head = 10 + (-90.909) ≈ -80.909.
        expect(head).toBeCloseTo(10 + (500 * (90 - 110)) / 110, 12);
    });

    it("tick with NaN volume carries the accumulator forward unchanged", () => {
        const bars = [mkBar(100, 50, 0), mkBar(110, 100, 60_000)];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => pvt("slot"));
        const tickBar: Bar = mkBar(120, Number.NaN, 60_000);
        const head = tick(ctxRef, tickBar, () => pvt("slot").current);
        // prev-closed cum = 0 (before bar 1's update); NaN volume → +0 → 0.
        expect(head).toBe(0);
    });

    it("tick on zero prevClose emits NaN (carry-forward semantics)", () => {
        const bars = [mkBar(0, 50, 0), mkBar(10, 100, 60_000)];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => pvt("slot"));
        const tickBar: Bar = mkBar(20, 200, 60_000);
        const head = tick(ctxRef, tickBar, () => pvt("slot").current);
        // prev-closed prevClose = 0 (bar 0's seed); tick → NaN.
        expect(Number.isNaN(head)).toBe(true);
    });
});
