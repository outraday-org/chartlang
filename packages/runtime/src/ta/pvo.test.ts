// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { computeEmaOfFloat64 } from "./lib/emaFloat64";
import { pvo } from "./pvo";

/**
 * Reference PVO — full-recompute against an array of volume values.
 * Mirrors the runtime: fast/slow EMA over volume, then `100 * (fast -
 * slow) / slow`; signal = EMA(pvo, signalLength); hist = pvo - signal.
 * NaN when slow EMA is zero.
 */
function referencePvo(
    volumes: ReadonlyArray<number>,
    fastLength: number,
    slowLength: number,
    signalLength: number,
): { pvo: number[]; signal: number[]; hist: number[] } {
    const n = volumes.length;
    const buf = new Float64Array(volumes);
    const fast = computeEmaOfFloat64(buf, fastLength);
    const slow = computeEmaOfFloat64(buf, slowLength);
    const pvoArr = new Float64Array(n);
    pvoArr.fill(Number.NaN);
    for (let i = 0; i < n; i += 1) {
        const fa = fast[i];
        const sa = slow[i];
        if (Number.isFinite(fa) && Number.isFinite(sa) && sa !== 0) {
            pvoArr[i] = (100 * (fa - sa)) / sa;
        }
    }
    const signal = computeEmaOfFloat64(pvoArr, signalLength);
    const hist = new Array<number>(n).fill(Number.NaN);
    for (let i = 0; i < n; i += 1) {
        if (Number.isFinite(pvoArr[i]) && Number.isFinite(signal[i])) {
            hist[i] = pvoArr[i] - signal[i];
        }
    }
    return { pvo: Array.from(pvoArr), signal: Array.from(signal), hist };
}

describe("ta.pvo", () => {
    it("matches the reference computation on a 60-bar walk (defaults 12/26/9)", () => {
        const bars = syntheticBars(60, 11);
        const vols = bars.map((b) => b.volume);
        const expected = referencePvo(vols, 12, 26, 9);
        const actual = harness(bars, bars.length + 1, () => {
            const p = pvo("slot");
            return { pvo: p.pvo.current, signal: p.signal.current, hist: p.hist.current };
        });
        for (let i = 0; i < bars.length; i += 1) {
            if (Number.isNaN(expected.pvo[i])) {
                expect(Number.isNaN(actual[i].pvo)).toBe(true);
            } else {
                expect(actual[i].pvo).toBeCloseTo(expected.pvo[i], 8);
            }
        }
        const tail = bars.length - 1;
        if (Number.isFinite(expected.signal[tail])) {
            expect(actual[tail].signal).toBeCloseTo(expected.signal[tail], 8);
            expect(actual[tail].hist).toBeCloseTo(expected.hist[tail], 8);
        }
    });

    it("emits NaN through the warmup window (signal lands at slowLength + signalLength − 2)", () => {
        const bars = syntheticBars(50, 5);
        // Defaults (12, 26, 9): signal warmup ends at bar 33.
        const out = harness(bars, bars.length + 1, () => {
            const p = pvo("slot");
            return { signal: p.signal.current, hist: p.hist.current };
        });
        for (let i = 0; i < 33; i += 1) {
            expect(Number.isNaN(out[i].signal)).toBe(true);
            expect(Number.isNaN(out[i].hist)).toBe(true);
        }
        expect(Number.isFinite(out[bars.length - 1].signal)).toBe(true);
    });

    it("pvo line lands once the slow EMA seeds (bar slowLength - 1)", () => {
        const bars = syntheticBars(40, 7);
        const out = harness(bars, bars.length + 1, () => pvo("slot").pvo.current);
        for (let i = 0; i < 25; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[25])).toBe(true);
    });

    it("returns the same PvoResult identity on every call (offset === 0)", () => {
        const bars = syntheticBars(40, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            identities.add(pvo("slot"));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("returns a stable per-offset PvoResult identity", () => {
        const bars = syntheticBars(40, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            identities.add(pvo("slot", { offset: 5 }));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => pvo("oops")).toThrowError(/ta.pvo called outside an active script step/);
    });

    it("uses defaults (12, 26, 9) when opts is omitted", () => {
        const bars = syntheticBars(50, 3);
        const out = harness(bars, bars.length + 1, () => pvo("slot").signal.current);
        expect(Number.isFinite(out[bars.length - 1])).toBe(true);
    });

    it("respects custom opts (fast=5, slow=10, signal=3)", () => {
        const bars = syntheticBars(40, 8);
        const out = harness(
            bars,
            bars.length + 1,
            () => pvo("slot", { fastLength: 5, slowLength: 10, signalLength: 3 }).signal.current,
        );
        // Warmup = 10 + 3 - 2 = 11.
        expect(Number.isFinite(out[12])).toBe(true);
    });

    it("hist equals pvo − signal where both are finite", () => {
        const bars = syntheticBars(50, 9);
        const out = harness(bars, bars.length + 1, () => {
            const p = pvo("slot");
            return { pvo: p.pvo.current, signal: p.signal.current, hist: p.hist.current };
        });
        for (const { pvo: pv, signal, hist } of out) {
            if (Number.isFinite(pv) && Number.isFinite(signal)) {
                expect(hist).toBeCloseTo(pv - signal, 12);
            }
        }
    });

    it("emits NaN for the pvo line when slow EMA is zero", () => {
        // All-zero volume bars → slow EMA seeds at 0 → pvo NaN.
        const bars = syntheticBars(40, 1).map((b) => ({ ...b, volume: 0 }));
        const out = harness(bars, bars.length + 1, () => pvo("slot").pvo.current);
        // From bar 25 onward, slow EMA is 0; pvo is NaN.
        for (let i = 25; i < bars.length; i += 1) expect(Number.isNaN(out[i])).toBe(true);
    });
});

describe("ta.pvo tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(40, 4);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => pvo("slot"));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickBar = { ...bars[bars.length - 1], volume: bars[bars.length - 1].volume + 5000 };
        tick(ctxRef, tickBar, () => pvo("slot"));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });
});
