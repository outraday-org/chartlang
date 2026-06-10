// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { pvi } from "./pvi.js";

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

describe("ta.pvi", () => {
    it("first bar emits the 1000 seed", () => {
        const bars = [mkBar(100, 50)];
        const out = harness(bars, bars.length + 1, () => pvi("slot").current);
        expect(out[0]).toBe(1000);
    });

    it("updates on higher-volume bars; carries forward on equal/lower", () => {
        const bars = [
            mkBar(100, 100, 0), // seed at 1000.
            mkBar(110, 50, 60_000), // lower volume → carry.
            mkBar(99, 200, 120_000), // higher volume → update.
            mkBar(110, 200, 180_000), // equal volume → carry.
        ];
        const out = harness(bars, bars.length + 1, () => pvi("slot").current);
        expect(out[0]).toBe(1000);
        expect(out[1]).toBe(1000);
        expect(out[2]).toBeCloseTo(1000 * (1 + (99 - 110) / 110), 12);
        expect(out[3]).toBe(out[2]);
    });

    it("NaN volume is treated as 0 (no carry-forward of prev higher vol)", () => {
        const bars = [
            mkBar(100, 100, 0),
            { ...mkBar(110, Number.NaN, 60_000) }, // NaN → 0 → !(0 > 100) → carry.
        ];
        const out = harness(bars, bars.length + 1, () => pvi("slot").current);
        expect(out[1]).toBe(1000);
    });

    it("zero prevClose carries the value forward", () => {
        const bars = [mkBar(0, 100, 0), mkBar(50, 200, 60_000)];
        const out = harness(bars, bars.length + 1, () => pvi("slot").current);
        // bar 1: higher volume, but prevClose === 0 → carry.
        expect(out[0]).toBe(1000);
        expect(out[1]).toBe(1000);
    });

    it("NaN close carries the value forward without advancing prevClose", () => {
        const bars = [
            mkBar(100, 100, 0),
            mkBar(110, 200, 60_000), // higher vol → update.
            { ...mkBar(Number.NaN, 300, 120_000) }, // NaN close → carry.
            mkBar(99, 400, 180_000), // higher vol → differences vs 110.
        ];
        const out = harness(bars, bars.length + 1, () => pvi("slot").current);
        expect(out[1]).toBeCloseTo(1100, 12);
        expect(out[2]).toBe(out[1]);
        expect(out[3]).toBeCloseTo(1100 * (1 + (99 - 110) / 110), 12);
    });

    it("returns the same Series identity on every call (offset === 0)", () => {
        const bars = syntheticBars(10, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            identities.add(pvi("slot"));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("returns a stable per-offset Series identity", () => {
        const bars = syntheticBars(10, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            identities.add(pvi("slot", { offset: 2 }));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => pvi("oops")).toThrowError(/ta.pvi called outside an active script step/);
    });
});

describe("ta.pvi tick-mode", () => {
    it("replaces the head without polluting next close's accumulator", () => {
        const bars = [
            mkBar(100, 100, 0),
            mkBar(110, 200, 60_000), // higher vol → update to 1100.
        ];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => pvi("slot"));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickBar: Bar = mkBar(120, 999, 60_000); // tick: higher vol.
        const head = tick(ctxRef, tickBar, () => pvi("slot").current);
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
        // prev-closed: value=1000, prevClose=100, prevVolume=100.
        // tick: 999 > 100 → update: 1000 * (1 + (120 - 100)/100) = 1200.
        expect(head).toBeCloseTo(1200, 12);
    });

    it("tick with lower-vol carries the prior value", () => {
        const bars = [mkBar(100, 100, 0), mkBar(110, 200, 60_000)];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => pvi("slot"));
        const tickBar: Bar = mkBar(120, 10, 60_000); // lower vol → carry.
        const head = tick(ctxRef, tickBar, () => pvi("slot").current);
        expect(head).toBe(1000);
    });
});
