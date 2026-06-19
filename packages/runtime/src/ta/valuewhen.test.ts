// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Series } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { valuewhen } from "./valuewhen.js";

function boolSeries(value: boolean): Series<boolean> {
    return { current: value, length: 1 } as unknown as Series<boolean>;
}

describe("ta.valuewhen", () => {
    it("emits NaN until enough matches have been seen (occurrence=0 → 1 match)", () => {
        // pattern: false, false, true, false, false
        const pattern = [false, false, true, false, false];
        const bars = syntheticBars(pattern.length, 1);
        const out = harness(
            bars,
            bars.length + 1,
            (bar, _ctx) =>
                valuewhen("slot", boolSeries(pattern[_ctx.barIndex()]), bar.close, 0).current,
        );
        expect(Number.isNaN(out[0])).toBe(true);
        expect(Number.isNaN(out[1])).toBe(true);
        expect(out[2]).toBe(bars[2].close);
        expect(out[3]).toBe(bars[2].close);
        expect(out[4]).toBe(bars[2].close);
    });

    it("emits the second-most-recent match value when occurrence=1", () => {
        const pattern = [true, false, true, false, true];
        const bars = syntheticBars(pattern.length, 2);
        const out = harness(
            bars,
            bars.length + 1,
            (bar, _ctx) =>
                valuewhen("slot", boolSeries(pattern[_ctx.barIndex()]), bar.close, 1).current,
        );
        // After bar 2 (2nd match), out = bars[0].close (the 1st match's value).
        expect(Number.isNaN(out[0])).toBe(true);
        expect(Number.isNaN(out[1])).toBe(true);
        expect(out[2]).toBe(bars[0].close);
        // After bar 4 (3rd match), out = bars[2].close (2nd most recent).
        expect(out[4]).toBe(bars[2].close);
    });

    it("propagates a NaN source at the matching bar", () => {
        const pattern = [false, true, false, false];
        const bars = syntheticBars(pattern.length, 3).map((b, i) =>
            i === 1 ? { ...b, close: Number.NaN } : b,
        );
        const out = harness(
            bars,
            bars.length + 1,
            (bar, _ctx) =>
                valuewhen("slot", boolSeries(pattern[_ctx.barIndex()]), bar.close, 0).current,
        );
        // After bar 1's match (with NaN source), the emitted value is NaN.
        expect(Number.isNaN(out[1])).toBe(true);
        expect(Number.isNaN(out[2])).toBe(true);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            const s = valuewhen("slot", boolSeries(true), bar.close, 0);
            identities.add(s);
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("returns a stable, unshifted Series when opts.offset is supplied (presentation-only)", () => {
        const pattern = [true, false, false];
        const bars = syntheticBars(pattern.length, 1);
        const identities = new Set<unknown>();
        const out = harness(bars, bars.length + 1, (bar, ctx) => {
            const s = valuewhen("slot", boolSeries(pattern[ctx.barIndex()]), bar.close, 0, {
                offset: 1,
            });
            identities.add(s);
            return s.current;
        });
        // offset is presentation-only: the value series is unshifted — the
        // condition fires at bar 0 and holds bars[0].close thereafter.
        expect(out[0]).toBe(bars[0].close);
        expect(out[1]).toBe(bars[0].close);
        expect(out[2]).toBe(bars[0].close);
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => valuewhen("oops", boolSeries(false), 1, 0)).toThrowError(
            /ta.valuewhen called outside an active script step/,
        );
    });
});

describe("ta.valuewhen tick-mode", () => {
    it("tick that fires the condition replaces head with the tick's source", () => {
        const bars = syntheticBars(5, 4);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            valuewhen("slot", boolSeries(true), bar.close, 0),
        );
        // After the last close (which fires), the most recent match value is
        // the last close. A tick that also fires with a new value should
        // replace it.
        const tickClose = bars[bars.length - 1].close + 42;
        const head = tick(
            ctxRef,
            { ...bars[bars.length - 1], close: tickClose },
            () => valuewhen("slot", boolSeries(true), tickClose, 0).current,
        );
        expect(head).toBe(tickClose);
    });

    it("tick that does not fire reverts head to the pre-close match", () => {
        const pattern = [true, true, true];
        const bars = syntheticBars(3, 5);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar, ctx) =>
            valuewhen("slot", boolSeries(pattern[ctx.barIndex()]), bar.close, 0),
        );
        // After all 3 closes, most-recent match = bars[2].close.
        const tickClose = bars[bars.length - 1].close + 50;
        const head = tick(
            ctxRef,
            { ...bars[bars.length - 1], close: tickClose },
            () => valuewhen("slot", boolSeries(false), tickClose, 0).current,
        );
        // Tick condition is false; head should fall back to the 2nd-to-last
        // match (bars[1].close — the most recent match before the most
        // recent close).
        expect(head).toBe(bars[1].close);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(2, 6);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            valuewhen("slot", boolSeries(false), bar.close, 0),
        );
        const head = tick(
            ctxRef,
            bars[1],
            () => valuewhen("slot", boolSeries(false), bars[1].close, 0).current,
        );
        expect(Number.isNaN(head)).toBe(true);
    });
});
