// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { chaikinOsc } from "./chaikinOsc";

describe("ta.chaikinOsc", () => {
    it("emits NaN through the warmup window (slow EMA seeds at slowLength - 1)", () => {
        const bars = syntheticBars(40, 4);
        const out = harness(bars, bars.length + 1, () => chaikinOsc("slot").current);
        // Defaults (3, 10): slow EMA seeds at bar 9.
        for (let i = 0; i < 9; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[9])).toBe(true);
    });

    it("returns the same Series identity on every call (offset === 0)", () => {
        const bars = syntheticBars(20, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            identities.add(chaikinOsc("slot"));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("returns a stable per-offset Series identity", () => {
        const bars = syntheticBars(20, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            identities.add(chaikinOsc("slot", { offset: 5 }));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => chaikinOsc("oops")).toThrowError(
            /ta.chaikinOsc called outside an active script step/,
        );
    });

    it("uses defaults (3, 10) when opts omitted", () => {
        const bars = syntheticBars(20, 2);
        const out = harness(bars, bars.length + 1, () => chaikinOsc("slot").current);
        expect(Number.isFinite(out[bars.length - 1])).toBe(true);
    });

    it("respects custom opts (fastLength=5, slowLength=15)", () => {
        const bars = syntheticBars(30, 3);
        const out = harness(
            bars,
            bars.length + 1,
            () => chaikinOsc("slot", { fastLength: 5, slowLength: 15 }).current,
        );
        // slow EMA seeds at bar 14.
        for (let i = 0; i < 14; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[14])).toBe(true);
    });

    it("composes ADL + two EMA sub-slots (three sub-slot entries under taSlots)", () => {
        const bars = syntheticBars(15, 5);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => chaikinOsc("slot"));
        const slotIds = Array.from(ctxRef.ctx.stream.taSlots.keys()).sort();
        expect(slotIds).toContain("slot");
        expect(slotIds).toContain("slot/adl");
        expect(slotIds).toContain("slot/fast");
        expect(slotIds).toContain("slot/slow");
    });
});

describe("ta.chaikinOsc tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(20, 6);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => chaikinOsc("slot"));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickBar = { ...bars[bars.length - 1], close: bars[bars.length - 1].close + 1 };
        tick(ctxRef, tickBar, () => chaikinOsc("slot"));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });
});
