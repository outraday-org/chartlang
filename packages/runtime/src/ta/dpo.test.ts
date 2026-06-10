// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { dpo } from "./dpo.js";
import { computeSmaOfFloat64 } from "./lib/smaFloat64.js";

/**
 * Reference DPO — full-recompute against an array of source values.
 * `dpo[i] = source[i - displacement] - sma[i]` with `displacement =
 * floor(length / 2) + 1` (non-centered mode).
 */
function referenceDpo(src: ReadonlyArray<number>, length: number): number[] {
    const n = src.length;
    const sma = computeSmaOfFloat64(new Float64Array(src), length);
    const displacement = Math.floor(length / 2) + 1;
    const out = new Array<number>(n).fill(Number.NaN);
    for (let i = 0; i < n; i += 1) {
        const shiftedIdx = i - displacement;
        const m = sma[i];
        if (shiftedIdx < 0 || !Number.isFinite(m)) continue;
        const s = src[shiftedIdx];
        if (!Number.isFinite(s)) continue;
        out[i] = s - m;
    }
    return out;
}

describe("ta.dpo", () => {
    it("matches the reference computation on a 60-bar walk (length=21)", () => {
        const bars = syntheticBars(60, 11);
        const src = bars.map((b) => b.close);
        const expected = referenceDpo(src, 21);
        const actual = harness(bars, bars.length + 1, (bar) => dpo("slot", bar.close, 21).current);
        for (let i = 0; i < bars.length; i += 1) {
            if (Number.isNaN(expected[i])) {
                expect(Number.isNaN(actual[i])).toBe(true);
            } else {
                expect(actual[i]).toBeCloseTo(expected[i], 9);
            }
        }
    });

    it("emits NaN until SMA seeds (length=21 → first defined at bar 20)", () => {
        const bars = syntheticBars(40, 5);
        const out = harness(bars, bars.length + 1, (bar) => dpo("slot", bar.close, 21).current);
        for (let i = 0; i < 20; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[20])).toBe(true);
    });

    it("returns the same Series identity on every call (offset === 0)", () => {
        const bars = syntheticBars(30, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            identities.add(dpo("slot", bar.close, 21));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("returns a stable per-offset Series identity", () => {
        const bars = syntheticBars(30, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            identities.add(dpo("slot", bar.close, 21, { offset: 3 }));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => dpo("oops", 1, 21)).toThrowError(
            /ta.dpo called outside an active script step/,
        );
    });

    it("propagates NaN when source is NaN at the lookback bar", () => {
        // Inject a NaN close at bar 5; with length=10, displacement=6,
        // dpo at bar 11 reads src[5] (NaN) and emits NaN.
        const baseBars = syntheticBars(30, 2);
        const bars = baseBars.map((b, i) => (i === 5 ? { ...b, close: Number.NaN } : b));
        const out = harness(bars, bars.length + 1, (bar) => dpo("slot", bar.close, 10).current);
        expect(Number.isNaN(out[11])).toBe(true);
    });

    it("accepts opts (offset, lineStyle) without throwing", () => {
        const bars = syntheticBars(40, 2);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => dpo("slot", bar.close, 21, { offset: 0, lineStyle: "line" }).current,
        );
        expect(Number.isFinite(out[bars.length - 1])).toBe(true);
    });
});

describe("ta.dpo tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(40, 7);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            dpo("slot", bar.close, 21),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickClose = bars[bars.length - 1].close + 10;
        const tickBar = { ...bars[bars.length - 1], close: tickClose };
        tick(ctxRef, tickBar, () => dpo("slot", tickClose, 21));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(40, 9);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            dpo("slot", bar.close, 21),
        );
        const tickClose = bars[bars.length - 1].close + 3;
        const tickBar = { ...bars[bars.length - 1], close: tickClose };
        const a = tick(ctxRef, tickBar, () => dpo("slot", tickClose, 21).current);
        const b = tick(ctxRef, tickBar, () => dpo("slot", tickClose, 21).current);
        expect(b).toBeCloseTo(a, 12);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(5, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            dpo("slot", bar.close, 21),
        );
        const head = tick(ctxRef, bars[4], () => dpo("slot", bars[4].close, 21).current);
        expect(Number.isNaN(head)).toBe(true);
    });
});
