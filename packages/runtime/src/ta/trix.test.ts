// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { computeEmaOfFloat64 } from "./lib/emaFloat64.js";
import { trix } from "./trix.js";
import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";

function referenceTrix(
    closes: Float64Array,
    length: number,
    signalLength: number,
): { trix: Float64Array; signal: Float64Array } {
    const ema1 = computeEmaOfFloat64(closes, length);
    const ema2 = computeEmaOfFloat64(ema1, length);
    const ema3 = computeEmaOfFloat64(ema2, length);
    const trixOut = new Float64Array(closes.length);
    trixOut.fill(Number.NaN);
    for (let i = 1; i < closes.length; i += 1) {
        const prev = ema3[i - 1];
        const cur = ema3[i];
        if (Number.isFinite(prev) && Number.isFinite(cur) && prev !== 0) {
            trixOut[i] = (100 * (cur - prev)) / prev;
        }
    }
    const signal = computeEmaOfFloat64(trixOut, signalLength);
    return { trix: trixOut, signal };
}

describe("ta.trix", () => {
    it("matches the reference triple-EMA + signal stack over 80 bars × length=18, signal=9", () => {
        const bars = syntheticBars(80, 23);
        const closes = new Float64Array(bars.map((b) => b.close));
        const expected = referenceTrix(closes, 18, 9);
        const actual = harness(bars, bars.length + 1, (bar) => {
            const r = trix("slot", bar.close, 18);
            return { trix: r.trix.current, signal: r.signal.current };
        });
        for (let i = 0; i < bars.length; i += 1) {
            if (Number.isNaN(expected.trix[i])) {
                expect(Number.isNaN(actual[i].trix)).toBe(true);
            } else {
                expect(actual[i].trix).toBeCloseTo(expected.trix[i], 8);
            }
            if (Number.isNaN(expected.signal[i])) {
                expect(Number.isNaN(actual[i].signal)).toBe(true);
            } else {
                expect(actual[i].signal).toBeCloseTo(expected.signal[i], 8);
            }
        }
    });

    it("emits NaN until `3·length + signalLength − 3`; first defined signal at that bar", () => {
        const length = 5;
        const signalLength = 4;
        const bars = syntheticBars(40, 29);
        const out = harness(bars, bars.length + 1, (bar) => {
            const r = trix("slot", bar.close, length, { signalLength });
            return r.signal.current;
        });
        const firstDefined = 3 * length + signalLength - 3;
        for (let i = 0; i < firstDefined && i < out.length; i += 1) {
            expect(Number.isNaN(out[i])).toBe(true);
        }
        expect(Number.isFinite(out[firstDefined])).toBe(true);
    });

    it("trix line warmup is `3·length − 2`; first defined trix at `3·length − 2`", () => {
        const length = 5;
        const bars = syntheticBars(30, 31);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => trix("slot", bar.close, length).trix.current,
        );
        // 3·5 − 3 = 12; first defined at index 13 (need ema3[t-1] to be finite).
        // ema3 first defined at 3·5 − 3 = 12; trix first defined at 13.
        for (let i = 0; i < 13 && i < out.length; i += 1) {
            expect(Number.isNaN(out[i])).toBe(true);
        }
        expect(Number.isFinite(out[13])).toBe(true);
    });

    it("returns the same TrixResult identity on every call", () => {
        const bars = syntheticBars(20, 5);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            ids.add(trix("slot", bar.close, 5));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("emits 0 for a constant-input stream past warmup (ema3 stable, percentage delta is 0)", () => {
        const bars = Array.from({ length: 40 }, (_, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: 100,
            high: 100,
            low: 100,
            close: 100,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => trix("slot", bar.close, 5).trix.current,
        );
        // 3·5 − 2 = 13; from then on, ema3 = 100 and percentage delta = 0.
        for (let i = 13; i < bars.length; i += 1) expect(out[i]).toBeCloseTo(0, 12);
    });

    it("throws when called outside an active script step", () => {
        expect(() => trix("oops", 0, 5)).toThrowError(
            /ta.trix called outside an active script step/,
        );
    });

    it("opts.offset returns the value `offset` bars ago", () => {
        const bars = syntheticBars(50, 33);
        const unshifted = harness(
            bars,
            bars.length + 1,
            (bar) => trix("slot", bar.close, 5).trix.current,
        );
        const shifted = harness(
            bars,
            bars.length + 1,
            (bar) => trix("slot", bar.close, 5, { offset: 2 }).trix.current,
        );
        for (let k = 2; k < bars.length; k += 1) {
            const u = unshifted[k - 2];
            const s = shifted[k];
            if (Number.isNaN(u)) expect(Number.isNaN(s)).toBe(true);
            else expect(s).toBeCloseTo(u, 12);
        }
    });

    it("offset=0 returns the canonical result by identity", () => {
        const bars = syntheticBars(8, 37);
        const seen = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            seen.add(trix("slot", bar.close, 3, { offset: 0 }));
            return null;
        });
        expect(seen.size).toBe(1);
    });
});

describe("ta.trix tick-mode", () => {
    it("replaces the head without advancing the buffer", () => {
        const bars = syntheticBars(30, 41);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            trix("slot", bar.close, 5),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const last = bars[bars.length - 1];
        const tickClose = last.close + 5;
        tick(ctxRef, { ...last, close: tickClose }, () => trix("slot", tickClose, 5));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(40, 43);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            trix("slot", bar.close, 5),
        );
        const last = bars[bars.length - 1];
        const tickClose = last.close + 2;
        const tickBar = { ...last, close: tickClose };
        const a = tick(ctxRef, tickBar, () => trix("slot", tickClose, 5).trix.current);
        const b = tick(ctxRef, tickBar, () => trix("slot", tickClose, 5).trix.current);
        expect(b).toBeCloseTo(a, 12);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(3, 47);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            trix("slot", bar.close, 5),
        );
        const head = tick(ctxRef, bars[2], () => trix("slot", bars[2].close, 5).trix.current);
        expect(Number.isNaN(head)).toBe(true);
    });
});
