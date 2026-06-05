// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { netVolume } from "./netVolume";

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

describe("ta.netVolume", () => {
    it("first bar emits 0 (no prior close to difference against)", () => {
        const bars = [mkBar(100, 50)];
        const out = harness(bars, bars.length + 1, () => netVolume("slot").current);
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
        const out = harness(bars, bars.length + 1, () => netVolume("slot").current);
        expect(out[0]).toBe(0);
        expect(out[1]).toBe(100);
        expect(out[2]).toBe(-100);
        expect(out[3]).toBe(-100);
        expect(out[4]).toBe(300);
    });

    it("flat close (delta = 0) contributes nothing", () => {
        const bars = [mkBar(100, 50, 0), mkBar(100, 999, 60_000)];
        const out = harness(bars, bars.length + 1, () => netVolume("slot").current);
        expect(out[1]).toBe(0);
    });

    it("NaN volume carries the accumulator forward", () => {
        const bars = [
            mkBar(100, 50, 0),
            mkBar(110, 100, 60_000),
            { ...mkBar(120, Number.NaN, 120_000) },
            mkBar(130, 200, 180_000),
        ];
        const out = harness(bars, bars.length + 1, () => netVolume("slot").current);
        expect(out[1]).toBe(100);
        expect(out[2]).toBe(100);
        expect(out[3]).toBe(300);
    });

    it("returns the same Series identity on every call (offset === 0)", () => {
        const bars = syntheticBars(10, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            identities.add(netVolume("slot"));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("returns a stable per-offset Series identity", () => {
        const bars = syntheticBars(10, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            identities.add(netVolume("slot", { offset: 3 }));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => netVolume("oops")).toThrowError(
            /ta.netVolume called outside an active script step/,
        );
    });
});

describe("ta.netVolume tick-mode", () => {
    it("replaces the head without polluting next close's accumulator", () => {
        const bars = [mkBar(100, 50, 0), mkBar(110, 100, 60_000), mkBar(120, 200, 120_000)];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => netVolume("slot"));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickBar: Bar = mkBar(90, 500, 120_000);
        const head = tick(ctxRef, tickBar, () => netVolume("slot").current);
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
        // prev-close cum=100, prev-close prevClose=110; tick close=90
        // → delta < 0 → contribute -500. Head = 100 - 500 = -400.
        expect(head).toBe(-400);
    });

    it("tick with NaN volume carries the accumulator forward unchanged", () => {
        const bars = [mkBar(100, 50, 0), mkBar(110, 100, 60_000)];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => netVolume("slot"));
        const tickBar: Bar = mkBar(120, Number.NaN, 60_000);
        const head = tick(ctxRef, tickBar, () => netVolume("slot").current);
        // prev-close cum = 0 (before bar 1); NaN volume → no update → 0.
        expect(head).toBe(0);
    });
});
