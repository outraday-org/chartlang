// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { vol } from "./vol.js";

describe("ta.vol", () => {
    it("emits bar.volume verbatim across a synthetic walk", () => {
        const bars = syntheticBars(30, 17);
        const out = harness(bars, bars.length + 1, (bar) => vol("slot", bar).current);
        for (let i = 0; i < bars.length; i += 1) {
            expect(out[i]).toBe(bars[i].volume);
        }
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 3);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (_bar) => {
            identities.add(vol("slot"));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => vol("oops")).toThrowError(/ta.vol called outside an active script step/);
    });

    it("propagates NaN volume to a NaN output", () => {
        const bars = syntheticBars(8, 1).map((b, i) =>
            i === 3 ? { ...b, volume: Number.NaN } : b,
        );
        const out = harness(bars, bars.length + 1, () => vol("slot").current);
        expect(Number.isNaN(out[3])).toBe(true);
        expect(out[2]).toBe(bars[2].volume);
        expect(out[4]).toBe(bars[4].volume);
    });

    it("ignores the opts.offset placeholder (Phase-2 wiring is the no-op path)", () => {
        const bars = syntheticBars(8, 4);
        const out = harness(bars, bars.length + 1, (_bar) => vol("slot", { offset: 0 }).current);
        for (let i = 0; i < bars.length; i += 1) expect(out[i]).toBe(bars[i].volume);
    });
});

describe("ta.vol tick-mode", () => {
    it("replaces the head without advancing the buffer", () => {
        const bars = syntheticBars(10, 8);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => vol("slot"));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickBar = { ...bars[bars.length - 1], volume: 999_999 };
        const head = tick(ctxRef, tickBar, () => vol("slot").current);
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
        expect(head).toBe(999_999);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(10, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => vol("slot"));
        const tickBar = { ...bars[bars.length - 1], volume: 42 };
        let a = 0;
        let b = 0;
        tick(ctxRef, tickBar, () => {
            a = vol("slot").current;
            return a;
        });
        tick(ctxRef, tickBar, () => {
            b = vol("slot").current;
            return b;
        });
        expect(b).toBe(a);
    });

    it("tick with NaN volume returns NaN", () => {
        const bars = syntheticBars(5, 6);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => vol("slot"));
        const tickBar = { ...bars[bars.length - 1], volume: Number.NaN };
        const head = tick(ctxRef, tickBar, () => vol("slot").current);
        expect(Number.isNaN(head)).toBe(true);
    });
});
