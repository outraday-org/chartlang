// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { computeEmaOfFloat64 } from "./lib/emaFloat64";
import { ppo } from "./ppo";

/**
 * Reference PPO — full-recompute against an array of source values.
 * Mirrors invinite's compute exactly: fast/slow EMA over closes, then
 * `100 * (fast - slow) / slow`, signal = EMA(ppo, signalLength),
 * hist = ppo - signal. NaN when slow EMA is zero.
 */
function referencePpo(
    src: ReadonlyArray<number>,
    fastLength: number,
    slowLength: number,
    signalLength: number,
): { ppo: number[]; signal: number[]; hist: number[] } {
    const n = src.length;
    const closes = new Float64Array(src);
    const fast = computeEmaOfFloat64(closes, fastLength);
    const slow = computeEmaOfFloat64(closes, slowLength);
    const ppoArr = new Float64Array(n);
    ppoArr.fill(Number.NaN);
    for (let i = 0; i < n; i += 1) {
        const fa = fast[i];
        const sa = slow[i];
        if (Number.isFinite(fa) && Number.isFinite(sa) && sa !== 0) {
            ppoArr[i] = (100 * (fa - sa)) / sa;
        }
    }
    const signal = computeEmaOfFloat64(ppoArr, signalLength);
    const hist = new Array<number>(n).fill(Number.NaN);
    for (let i = 0; i < n; i += 1) {
        if (Number.isFinite(ppoArr[i]) && Number.isFinite(signal[i])) {
            hist[i] = ppoArr[i] - signal[i];
        }
    }
    return { ppo: Array.from(ppoArr), signal: Array.from(signal), hist };
}

describe("ta.ppo", () => {
    it("matches the reference computation on a 60-bar walk (defaults 12/26/9)", () => {
        const bars = syntheticBars(60, 11);
        const src = bars.map((b) => b.close);
        const expected = referencePpo(src, 12, 26, 9);
        const actual = harness(bars, bars.length + 1, (bar) => {
            const p = ppo("slot", bar.close);
            return {
                ppo: p.ppo.current,
                signal: p.signal.current,
                hist: p.hist.current,
            };
        });
        for (let i = 0; i < bars.length; i += 1) {
            if (Number.isNaN(expected.ppo[i])) {
                expect(Number.isNaN(actual[i].ppo)).toBe(true);
            } else {
                // The runtime's `ta.ema` recurrence holds prior value
                // on mid-stream NaN, while the reference does the same.
                // Match within a tolerance for fp drift across the
                // two-stage composition.
                expect(actual[i].ppo).toBeCloseTo(expected.ppo[i], 8);
            }
        }
        // Spot-check the tail signal + hist.
        const tail = bars.length - 1;
        if (Number.isFinite(expected.signal[tail])) {
            expect(actual[tail].signal).toBeCloseTo(expected.signal[tail], 8);
            expect(actual[tail].hist).toBeCloseTo(expected.hist[tail], 8);
        }
    });

    it("emits NaN through the warmup window (signal lands at slowLength + signalLength − 2)", () => {
        const bars = syntheticBars(50, 5);
        // Defaults (12, 26, 9): signal warmup ends at bar 26 + 9 − 2 = 33.
        const out = harness(bars, bars.length + 1, (bar) => {
            const p = ppo("slot", bar.close);
            return { signal: p.signal.current, hist: p.hist.current };
        });
        for (let i = 0; i < 33; i += 1) {
            expect(Number.isNaN(out[i].signal)).toBe(true);
            expect(Number.isNaN(out[i].hist)).toBe(true);
        }
        expect(Number.isFinite(out[bars.length - 1].signal)).toBe(true);
    });

    it("ppo line lands once the slow EMA seeds (bar slowLength - 1)", () => {
        const bars = syntheticBars(40, 7);
        const out = harness(bars, bars.length + 1, (bar) => ppo("slot", bar.close).ppo.current);
        // Slow EMA seeds at bar 25 (slowLength - 1 = 25 for default 26).
        for (let i = 0; i < 25; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[25])).toBe(true);
    });

    it("returns the same PpoResult identity on every call (offset === 0)", () => {
        const bars = syntheticBars(40, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            identities.add(ppo("slot", bar.close));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("returns a stable per-offset PpoResult identity", () => {
        const bars = syntheticBars(40, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            identities.add(ppo("slot", bar.close, { offset: 5 }));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => ppo("oops", 1)).toThrowError(/ta.ppo called outside an active script step/);
    });

    it("uses defaults (12, 26, 9) when opts is omitted", () => {
        const bars = syntheticBars(50, 3);
        const out = harness(bars, bars.length + 1, (bar) => ppo("slot", bar.close).signal.current);
        expect(Number.isFinite(out[bars.length - 1])).toBe(true);
    });

    it("respects custom opts (fast=5, slow=10, signal=3)", () => {
        const bars = syntheticBars(40, 8);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) =>
                ppo("slot", bar.close, { fastLength: 5, slowLength: 10, signalLength: 3 }).signal
                    .current,
        );
        // Warmup = 10 + 3 - 2 = 11.
        expect(Number.isFinite(out[12])).toBe(true);
    });

    it("hist equals ppo − signal where both are finite", () => {
        const bars = syntheticBars(50, 9);
        const out = harness(bars, bars.length + 1, (bar) => {
            const p = ppo("slot", bar.close);
            return { ppo: p.ppo.current, signal: p.signal.current, hist: p.hist.current };
        });
        for (const { ppo: pv, signal, hist } of out) {
            if (Number.isFinite(pv) && Number.isFinite(signal)) {
                expect(hist).toBeCloseTo(pv - signal, 12);
            }
        }
    });
});

describe("ta.ppo tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(40, 4);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) => ppo("slot", bar.close));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickBar = { ...bars[bars.length - 1], close: bars[bars.length - 1].close + 5 };
        tick(ctxRef, tickBar, () => ppo("slot", tickBar.close));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });
});
