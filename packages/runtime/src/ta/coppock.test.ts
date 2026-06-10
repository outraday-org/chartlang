// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { coppock } from "./coppock.js";

/**
 * Reference Coppock — full-recompute against an array of source values.
 * Mirrors invinite's `compute` exactly (percentage ROC + linear-weighted
 * WMA). Used by the unit-test reference-equivalence assertion.
 */
function referenceCoppock(
    src: ReadonlyArray<number>,
    roc1Length: number,
    roc2Length: number,
    wmaLength: number,
): number[] {
    const n = src.length;
    const roc1 = new Array<number>(n).fill(Number.NaN);
    const roc2 = new Array<number>(n).fill(Number.NaN);
    for (let i = roc1Length; i < n; i += 1) {
        const prev = src[i - roc1Length];
        if (prev !== 0 && Number.isFinite(prev)) {
            roc1[i] = (100 * (src[i] - prev)) / prev;
        }
    }
    for (let i = roc2Length; i < n; i += 1) {
        const prev = src[i - roc2Length];
        if (prev !== 0 && Number.isFinite(prev)) {
            roc2[i] = (100 * (src[i] - prev)) / prev;
        }
    }
    const sum = new Array<number>(n).fill(Number.NaN);
    for (let i = 0; i < n; i += 1) {
        if (Number.isFinite(roc1[i]) && Number.isFinite(roc2[i])) sum[i] = roc1[i] + roc2[i];
    }
    const out = new Array<number>(n).fill(Number.NaN);
    const denom = (wmaLength * (wmaLength + 1)) / 2;
    for (let i = wmaLength - 1; i < n; i += 1) {
        let acc = 0;
        let valid = true;
        for (let j = 0; j < wmaLength; j += 1) {
            const v = sum[i - j];
            if (!Number.isFinite(v)) {
                valid = false;
                break;
            }
            acc += v * (wmaLength - j);
        }
        if (valid) out[i] = acc / denom;
    }
    return out;
}

describe("ta.coppock", () => {
    it("matches the reference computation on a 60-bar walk (defaults 11, 14, 10)", () => {
        const bars = syntheticBars(60, 11);
        const src = bars.map((b) => b.close);
        const expected = referenceCoppock(src, 11, 14, 10);
        const actual = harness(bars, bars.length + 1, (bar) => coppock("slot", bar.close).current);
        for (let i = 0; i < bars.length; i += 1) {
            if (Number.isNaN(expected[i])) {
                expect(Number.isNaN(actual[i])).toBe(true);
            } else {
                expect(actual[i]).toBeCloseTo(expected[i], 9);
            }
        }
    });

    it("emits NaN through the warmup window (max(roc1, roc2) + wmaLength − 1)", () => {
        const bars = syntheticBars(40, 5);
        // Defaults (11, 14, 10) → first defined output at bar max(11,14)+10−1 = 23.
        const out = harness(bars, bars.length + 1, (bar) => coppock("slot", bar.close).current);
        for (let i = 0; i < 23; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[bars.length - 1])).toBe(true);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(30, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            const s = coppock("slot", bar.close);
            identities.add(s);
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => coppock("oops", 1)).toThrowError(
            /ta.coppock called outside an active script step/,
        );
    });

    it("emits NaN when a lookback source is zero (ROC undefined)", () => {
        // Force a zero lookback by setting bar 0's close to 0; ROC at
        // bars roc1Length and roc2Length will be NaN.
        const bars = syntheticBars(40, 6).map((b, i) => (i === 0 ? { ...b, close: 0 } : b));
        const out = harness(
            bars,
            bars.length + 1,
            (bar) =>
                coppock("slot", bar.close, { roc1Length: 5, roc2Length: 7, wmaLength: 3 }).current,
        );
        // bars 5 / 7 should propagate NaN through the WMA window.
        expect(Number.isNaN(out[5])).toBe(true);
    });

    it("accepts opts (offset, lineStyle) without throwing", () => {
        const bars = syntheticBars(40, 2);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) =>
                coppock("slot", bar.close, {
                    offset: 0,
                    lineStyle: "line",
                }).current,
        );
        expect(Number.isFinite(out[bars.length - 1])).toBe(true);
    });
});

describe("ta.coppock tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(40, 7);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            coppock("slot", bar.close),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickClose = bars[bars.length - 1].close + 10;
        const tickBar = { ...bars[bars.length - 1], close: tickClose };
        tick(ctxRef, tickBar, () => coppock("slot", tickClose));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(40, 9);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            coppock("slot", bar.close),
        );
        const tickClose = bars[bars.length - 1].close + 3;
        const tickBar = { ...bars[bars.length - 1], close: tickClose };
        const a = tick(ctxRef, tickBar, () => coppock("slot", tickClose).current);
        const b = tick(ctxRef, tickBar, () => coppock("slot", tickClose).current);
        expect(b).toBeCloseTo(a, 12);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(5, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            coppock("slot", bar.close),
        );
        const head = tick(ctxRef, bars[4], () => coppock("slot", bars[4].close).current);
        expect(Number.isNaN(head)).toBe(true);
    });
});
