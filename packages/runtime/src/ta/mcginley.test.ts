// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { mcginley } from "./mcginley";

function referenceMcginley(input: Float64Array, length: number): Float64Array {
    const out = new Float64Array(input.length);
    out.fill(Number.NaN);
    let prev = Number.NaN;
    let seedCount = 0;
    for (let i = 0; i < input.length; i += 1) {
        const src = input[i];
        if (!Number.isFinite(src)) {
            out[i] = prev;
            continue;
        }
        if (seedCount < length - 1) {
            seedCount += 1;
            continue;
        }
        if (!Number.isFinite(prev)) {
            seedCount += 1;
            prev = src;
            out[i] = src;
            continue;
        }
        if (prev === 0) {
            out[i] = Number.NaN;
            continue;
        }
        const ratio = src / prev;
        const denom = length * ratio * ratio * ratio * ratio;
        const next = prev + (src - prev) / denom;
        prev = next;
        out[i] = next;
    }
    return out;
}

describe("ta.mcginley", () => {
    it("matches the reference McGinley over a 50-bar synthetic walk", () => {
        const bars = syntheticBars(50, 11);
        const closes = new Float64Array(bars.map((b) => b.close));
        const expected = referenceMcginley(closes, 10);
        const actual = harness(
            bars,
            bars.length + 1,
            (bar) => mcginley("slot", bar.close, 10).current,
        );
        for (let i = 0; i < bars.length; i += 1) {
            const a = actual[i];
            const e = expected[i];
            if (Number.isNaN(e)) expect(Number.isNaN(a)).toBe(true);
            else expect(a).toBeCloseTo(e, 10);
        }
    });

    it("emits NaN until length closed bars then seeds with src", () => {
        const bars = syntheticBars(20, 5);
        const out = harness(bars, bars.length + 1, (bar) => mcginley("slot", bar.close, 5).current);
        for (let i = 0; i < 4; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        // length-th finite bar (index 4) seeds the recurrence with src.
        expect(out[4]).toBeCloseTo(bars[4].close, 12);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            const s = mcginley("slot", bar.close, 3);
            identities.add(s);
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => mcginley("oops", 1, 3)).toThrowError(
            /ta.mcginley called outside an active script step/,
        );
    });

    it("forward-fills the prior value on a mid-stream NaN source", () => {
        const bars = syntheticBars(30, 4).map((b, i) =>
            i === 15 ? { ...b, close: Number.NaN } : b,
        );
        const out = harness(bars, bars.length + 1, (bar) => mcginley("slot", bar.close, 5).current);
        // After warmup (bar 4 onward), the recurrence is alive.
        expect(Number.isFinite(out[14])).toBe(true);
        // NaN at bar 15 forward-fills the prior value.
        expect(out[15]).toBeCloseTo(out[14], 12);
    });

    it("equals the constant for a constant-input stream past warmup", () => {
        const bars = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5].map((c, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: c,
            high: c,
            low: c,
            close: c,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(bars, bars.length + 1, (bar) => mcginley("slot", bar.close, 3).current);
        // length - 1 = 2 warmup bars; first defined at index 2 (seed = 5).
        // Subsequent constants give (src - prev) = 0 → recurrence holds.
        for (let i = 2; i < bars.length; i += 1) {
            expect(out[i]).toBeCloseTo(5, 12);
        }
    });

    it("emits NaN when the recurrence anchor is zero (zero-seed edge)", () => {
        // Construct a 5-bar fixture whose 3rd close is 0 — the seed
        // value lands at index 2 with `prev = 0`, then every subsequent
        // step's `prev` stays 0 and emits NaN per the documented edge.
        const bars = [1, 2, 0, 4, 5].map((c, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: c,
            high: c,
            low: c,
            close: c,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(bars, bars.length + 1, (bar) => mcginley("slot", bar.close, 3).current);
        // Bar 2 is the seed boundary (length=3 → warmup 2; index 2 seeds with src=0).
        expect(out[2]).toBeCloseTo(0, 12);
        // Bar 3 hits the zero-anchor edge → NaN. The NaN propagates to
        // prevClosedMc; the next finite source bar (4) re-seeds the
        // recurrence per the documented "NaN until the first finite
        // source slot seeds it" rule.
        expect(Number.isNaN(out[3])).toBe(true);
        expect(out[4]).toBeCloseTo(5, 12);
    });
});

describe("ta.mcginley tick-mode", () => {
    it("replaces the head without advancing the buffer", () => {
        const bars = syntheticBars(20, 8);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            mcginley("slot", bar.close, 4),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickClose = bars[bars.length - 1].close + 5;
        tick(ctxRef, { ...bars[bars.length - 1], close: tickClose }, () =>
            mcginley("slot", tickClose, 4),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(30, 9);
        const length = 5;
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            mcginley("slot", bar.close, length),
        );
        const tickClose = bars[bars.length - 1].close + 10;
        const tickBar = { ...bars[bars.length - 1], close: tickClose };
        const a = tick(ctxRef, tickBar, () => mcginley("slot", tickClose, length).current);
        const b = tick(ctxRef, tickBar, () => mcginley("slot", tickClose, length).current);
        expect(b).toBeCloseTo(a, 12);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(3, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            mcginley("slot", bar.close, 5),
        );
        const head = tick(ctxRef, bars[2], () => mcginley("slot", bars[2].close, 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });

    it("tick with NaN source carries the prior MC forward", () => {
        const bars = syntheticBars(30, 1);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            mcginley("slot", bar.close, 5),
        );
        const head = tick(
            ctxRef,
            bars[bars.length - 1],
            () => mcginley("slot", Number.NaN, 5).current,
        );
        expect(Number.isFinite(head)).toBe(true);
    });

    it("tick at the seed boundary returns the tick's source value", () => {
        // Drive `length - 1` closed bars so seedCount reaches length-1
        // but the seed has not yet been laid down (prevClosedMc is still
        // NaN). A tick on the next would-be-seed bar should return the
        // tick's source value (the seed-on-tick branch).
        const length = 4;
        const bars = syntheticBars(length - 1, 7);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            mcginley("slot", bar.close, length),
        );
        const tickClose = 123;
        const head = tick(
            ctxRef,
            { ...bars[bars.length - 1], close: tickClose },
            () => mcginley("slot", tickClose, length).current,
        );
        expect(head).toBeCloseTo(tickClose, 12);
    });
});
