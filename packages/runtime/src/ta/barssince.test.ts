// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Series } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { barssince } from "./barssince.js";

function boolSeries(value: boolean): Series<boolean> {
    return { current: value, length: 1 } as unknown as Series<boolean>;
}

describe("ta.barssince", () => {
    it("emits NaN until the first true", () => {
        const pattern = [false, false, true, false, false];
        const bars = syntheticBars(pattern.length, 1);
        const out = harness(
            bars,
            bars.length + 1,
            (_bar, ctx) => barssince("slot", boolSeries(pattern[ctx.barIndex()])).current,
        );
        expect(Number.isNaN(out[0])).toBe(true);
        expect(Number.isNaN(out[1])).toBe(true);
        expect(out[2]).toBe(0);
        expect(out[3]).toBe(1);
        expect(out[4]).toBe(2);
    });

    it("resets to 0 at every match", () => {
        const pattern = [true, false, true, false, false, true];
        const bars = syntheticBars(pattern.length, 2);
        const out = harness(
            bars,
            bars.length + 1,
            (_bar, ctx) => barssince("slot", boolSeries(pattern[ctx.barIndex()])).current,
        );
        expect(out[0]).toBe(0);
        expect(out[1]).toBe(1);
        expect(out[2]).toBe(0);
        expect(out[3]).toBe(1);
        expect(out[4]).toBe(2);
        expect(out[5]).toBe(0);
    });

    it("does not reset on a non-boolean (NaN-like) condition value", () => {
        // Pine: NaN treated as false.
        const pattern: ReadonlyArray<boolean | null> = [false, true, false];
        const bars = syntheticBars(pattern.length, 3);
        const out = harness(bars, bars.length + 1, (_bar, ctx) => {
            const v = pattern[ctx.barIndex()];
            const cond = v === true;
            return barssince("slot", boolSeries(cond)).current;
        });
        expect(Number.isNaN(out[0])).toBe(true);
        expect(out[1]).toBe(0);
        expect(out[2]).toBe(1);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (_bar) => {
            const s = barssince("slot", boolSeries(true));
            identities.add(s);
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("returns a stable, unshifted Series when opts.offset is supplied (presentation-only)", () => {
        const pattern = [true, false, false];
        const bars = syntheticBars(pattern.length, 1);
        const identities = new Set<unknown>();
        const out = harness(bars, bars.length + 1, (_bar, ctx) => {
            const s = barssince("slot", boolSeries(pattern[ctx.barIndex()]), { offset: 1 });
            identities.add(s);
            return s.current;
        });
        // offset is presentation-only: the value series is unshifted —
        // fires at bar 0 (0), then 1, then 2 bars since.
        expect(out[0]).toBe(0);
        expect(out[1]).toBe(1);
        expect(out[2]).toBe(2);
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => barssince("oops", boolSeries(false))).toThrowError(
            /ta.barssince called outside an active script step/,
        );
    });
});

describe("ta.barssince tick-mode", () => {
    it("tick that fires resets head to 0", () => {
        const pattern = [true, false, false];
        const bars = syntheticBars(pattern.length, 4);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (_bar, ctx) =>
            barssince("slot", boolSeries(pattern[ctx.barIndex()])),
        );
        const head = tick(
            ctxRef,
            bars[bars.length - 1],
            () => barssince("slot", boolSeries(true)).current,
        );
        expect(head).toBe(0);
    });

    it("tick that does not fire increments head against the pre-close snapshot", () => {
        const pattern = [true, false];
        const bars = syntheticBars(pattern.length, 5);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (_bar, ctx) =>
            barssince("slot", boolSeries(pattern[ctx.barIndex()])),
        );
        // After the two closes (true, false), state = sinceTrue: 1.
        // pre-close snapshot = sinceTrue: 0 (after the true at bar 0).
        // tick (false) increments → 1.
        const head = tick(
            ctxRef,
            bars[bars.length - 1],
            () => barssince("slot", boolSeries(false)).current,
        );
        expect(head).toBe(1);
    });

    it("tick during warmup (never seen a match) returns NaN", () => {
        const pattern = [false, false];
        const bars = syntheticBars(pattern.length, 6);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (_bar, ctx) =>
            barssince("slot", boolSeries(pattern[ctx.barIndex()])),
        );
        const head = tick(
            ctxRef,
            bars[bars.length - 1],
            () => barssince("slot", boolSeries(false)).current,
        );
        expect(Number.isNaN(head)).toBe(true);
    });
});
