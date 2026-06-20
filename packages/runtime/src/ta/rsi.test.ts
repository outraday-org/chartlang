// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { wilderStep } from "./lib/wilderSmoothing.js";
import { rsi } from "./rsi.js";

function computeRsiReference(closes: number[], length: number): number[] {
    const n = closes.length;
    const out = new Array<number>(n).fill(Number.NaN);
    if (n <= length) return out;
    let g = 0;
    let l = 0;
    for (let i = 1; i <= length; i += 1) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) g += diff;
        else l += -diff;
    }
    g /= length;
    l /= length;
    out[length] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    for (let i = length + 1; i < n; i += 1) {
        const diff = closes[i] - closes[i - 1];
        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;
        g = wilderStep(g, gain, length);
        l = wilderStep(l, loss, length);
        out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    }
    return out;
}

describe("ta.rsi", () => {
    it("matches a reference Wilder RSI implementation", () => {
        const bars = syntheticBars(50, 23);
        const closes = bars.map((b) => b.close);
        const expected = computeRsiReference(closes, 14);
        const actual = harness(bars, bars.length + 1, (bar) => rsi("slot", bar.close, 14).current);
        for (let i = 0; i < bars.length; i += 1) {
            const a = actual[i];
            const e = expected[i];
            if (Number.isNaN(e)) expect(Number.isNaN(a)).toBe(true);
            else expect(a).toBeCloseTo(e, 8);
        }
    });

    it("emits NaN for the first length bars then a defined value", () => {
        const bars = syntheticBars(20, 4);
        const out = harness(bars, bars.length + 1, (bar) => rsi("slot", bar.close, 5).current);
        for (let i = 0; i < 5; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        expect(Number.isFinite(out[5])).toBe(true);
    });

    it("output is in [0, 100] for every defined slot", () => {
        const bars = syntheticBars(100, 19);
        const out = harness(bars, bars.length + 1, (bar) => rsi("slot", bar.close, 14).current);
        for (const v of out) {
            if (Number.isFinite(v)) {
                expect(v).toBeGreaterThanOrEqual(0);
                expect(v).toBeLessThanOrEqual(100);
            }
        }
    });

    it("returns 100 when avgLoss is 0 (monotonically increasing closes)", () => {
        const bars: Bar[] = syntheticBars(20, 1).map((b, i) => ({ ...b, close: 100 + i }));
        const out = harness(bars, bars.length + 1, (bar) => rsi("slot", bar.close, 5).current);
        expect(out[bars.length - 1]).toBe(100);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 1);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            ids.add(rsi("slot", bar.close, 5));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => rsi("oops", 1, 5)).toThrowError(/ta.rsi called outside an active script step/);
    });

    it("holds the prior RSI when the source is NaN past warmup", () => {
        const bars = syntheticBars(30, 7).map((b, i) =>
            i === 20 ? { ...b, close: Number.NaN } : b,
        );
        const out = harness(bars, bars.length + 1, (bar) => rsi("slot", bar.close, 5).current);
        expect(out[20]).toBeCloseTo(out[19], 12);
    });

    it("NaN during warmup yields NaN", () => {
        const bars = syntheticBars(10, 1).map((b, i) =>
            i === 0 ? { ...b, close: Number.NaN } : b,
        );
        const out = harness(bars, bars.length + 1, (bar) => rsi("slot", bar.close, 4).current);
        expect(Number.isNaN(out[0])).toBe(true);
    });
});

describe("ta.rsi tick-mode", () => {
    it("replaces the head without advancing length", () => {
        const bars = syntheticBars(30, 5);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            rsi("slot", bar.close, 5),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickClose = bars[bars.length - 1].close + 10;
        tick(ctxRef, { ...bars[bars.length - 1], close: tickClose }, () =>
            rsi("slot", tickClose, 5),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("post-warmup tick after a flat / up close — exercises gain branch", () => {
        const bars: import("@invinite-org/chartlang-core").Bar[] = [];
        for (let i = 0; i < 10; i += 1) {
            bars.push({
                time: 1_700_000_000_000 + i * 60_000,
                open: 100,
                high: 105,
                low: 95,
                close: 100 + i, // monotonically up
                volume: 0,
                symbol: "T",
                interval: "1m",
            });
        }
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            rsi("slot", bar.close, 5),
        );
        const last = bars[bars.length - 1];
        const head = tick(ctxRef, last, () => rsi("slot", last.close, 5).current);
        expect(head).toBeGreaterThanOrEqual(0);
        expect(head).toBeLessThanOrEqual(100);
    });

    it("post-warmup tick after a down-close — exercises closed-loss branch", () => {
        // Construct bars where the last close is BELOW the prev, so
        // diffClosed < 0 → closedLoss branch fires inside the tick path.
        const bars: import("@invinite-org/chartlang-core").Bar[] = [];
        for (let i = 0; i < 10; i += 1) {
            bars.push({
                time: 1_700_000_000_000 + i * 60_000,
                open: 100,
                high: 105,
                low: 95,
                close: 100 + (i < 9 ? 5 : -5),
                volume: 0,
                symbol: "T",
                interval: "1m",
            });
        }
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            rsi("slot", bar.close, 5),
        );
        const last = bars[bars.length - 1];
        const head = tick(ctxRef, last, () => rsi("slot", last.close, 5).current);
        expect(head).toBeGreaterThanOrEqual(0);
        expect(head).toBeLessThanOrEqual(100);
    });

    it("post-warmup tick — up-move covers gain branch", () => {
        const bars = syntheticBars(30, 5);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            rsi("slot", bar.close, 5),
        );
        const last = bars[bars.length - 1];
        const tickClose = last.close + 50;
        const head = tick(
            ctxRef,
            { ...last, close: tickClose },
            () => rsi("slot", tickClose, 5).current,
        );
        expect(head).toBeGreaterThanOrEqual(0);
        expect(head).toBeLessThanOrEqual(100);
    });

    it("post-warmup tick — down-move covers loss branch", () => {
        const bars = syntheticBars(30, 5);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            rsi("slot", bar.close, 5),
        );
        const last = bars[bars.length - 1];
        const tickClose = Math.max(0.1, last.close - 50);
        const head = tick(
            ctxRef,
            { ...last, close: tickClose },
            () => rsi("slot", tickClose, 5).current,
        );
        expect(head).toBeGreaterThanOrEqual(0);
        expect(head).toBeLessThanOrEqual(100);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(30, 9);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            rsi("slot", bar.close, 5),
        );
        const tickBar: Bar = { ...bars[bars.length - 1], close: bars[bars.length - 1].close + 7 };
        let a = 0;
        let b = 0;
        tick(ctxRef, tickBar, () => {
            a = rsi("slot", tickBar.close, 5).current;
            return a;
        });
        tick(ctxRef, tickBar, () => {
            b = rsi("slot", tickBar.close, 5).current;
            return b;
        });
        expect(b).toBeCloseTo(a, 10);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(3, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            rsi("slot", bar.close, 5),
        );
        const head = tick(ctxRef, bars[2], () => rsi("slot", bars[2].close, 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick at the seed-completion boundary returns the provisional seed RSI", () => {
        // 5 closes, length 5: diffCount = 4 (one less than length). A
        // tick that brings the provisional count to 5 returns the seed
        // RSI computed off the simple-mean gain / loss.
        const bars = syntheticBars(5, 4);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            rsi("slot", bar.close, 5),
        );
        const last = bars[bars.length - 1];
        const head = tick(
            ctxRef,
            { ...last, close: last.close + 10 },
            () => rsi("slot", last.close + 10, 5).current,
        );
        expect(Number.isFinite(head)).toBe(true);
        expect(head).toBeGreaterThanOrEqual(0);
        expect(head).toBeLessThanOrEqual(100);
    });

    it("tick before the first close returns NaN (no prior bar at all)", () => {
        // Force the tick before any closes by exposing the harness ctx
        // with zero bars.
        const { ctxRef } = harnessWithCtx<unknown>([], 5, () => rsi("slot", 100, 5));
        // Initialise the slot via a first compute outside any close (just to
        // create it). Then tick directly: src finite, prevClosedSrc NaN,
        // avgGain/avgLoss NaN.
        const head = tick(
            ctxRef,
            {
                time: 0,
                open: 0,
                high: 0,
                low: 0,
                close: 0,
                volume: 0,
                symbol: "T",
                interval: "1m",
            },
            () => rsi("slot", Number.NaN, 5).current,
        );
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick with NaN source holds the prior closed value", () => {
        const bars = syntheticBars(30, 3);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            rsi("slot", bar.close, 5),
        );
        const closedHead = (
            ctxRef.ctx.stream.taSlots.get("slot") as {
                series: { current: number };
            }
        ).series.current;
        const head = tick(ctxRef, bars[bars.length - 1], () => rsi("slot", Number.NaN, 5).current);
        expect(head).toBeCloseTo(closedHead, 12);
    });
});

describe("ta.rsi — opts.offset", () => {
    it("offset === 0 returns the same Series identity as no opts", () => {
        const bars = syntheticBars(20, 7);
        const identities = new Set<unknown>();
        let toggle = false;
        harness(bars, bars.length + 1, (bar) => {
            toggle = !toggle;
            identities.add(
                toggle ? rsi("slot", bar.close, 5) : rsi("slot", bar.close, 5, { offset: 0 }),
            );
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("offset === k > 0 leaves .current unshifted (offset is presentation-only)", () => {
        const bars = syntheticBars(30, 11);
        const unshifted = harness(
            bars,
            bars.length + 1,
            (bar) => rsi("slot", bar.close, 5).current,
        );
        const shifted = harness(
            bars,
            bars.length + 1,
            (bar) => rsi("slot", bar.close, 5, { offset: 3 }).current,
        );
        for (let i = 0; i < bars.length; i += 1) {
            const u = unshifted[i];
            const s = shifted[i];
            if (Number.isNaN(u)) expect(Number.isNaN(s)).toBe(true);
            else expect(s).toBeCloseTo(u, 12);
        }
    });

    it("offset === -k leaves .current unshifted (no future read; presentation-only)", () => {
        const bars = syntheticBars(20, 1);
        const unshifted = harness(
            bars,
            bars.length + 1,
            (bar) => rsi("slot", bar.close, 5).current,
        );
        const head = harness(
            bars,
            bars.length + 1,
            (bar) => rsi("slot", bar.close, 5, { offset: -2 }).current,
        );
        expect(head[head.length - 1]).toBeCloseTo(unshifted[unshifted.length - 1], 12);
        expect(Number.isNaN(head[head.length - 1])).toBe(false);
    });

    it("two calls with the same non-zero offset return the same Series identity", () => {
        const bars = syntheticBars(10, 3);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            identities.add(rsi("slot", bar.close, 5, { offset: 2 }));
            return null;
        });
        expect(identities.size).toBe(1);
    });
});
