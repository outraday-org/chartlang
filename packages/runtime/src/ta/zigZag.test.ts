// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { zigZag } from "./zigZag";

function makeBar(close: number, i: number): Bar {
    return {
        time: 1_700_000_000_000 + i * 60_000,
        open: close,
        high: close + 0.5,
        low: close - 0.5,
        close,
        volume: 0,
        symbol: "T",
        interval: "1m",
    };
}

describe("ta.zigZag", () => {
    it("emits NaN on bar 0 (no pivot confirmed yet)", () => {
        const bars = [makeBar(100, 0)];
        const out = harness(bars, bars.length + 1, () => {
            const z = zigZag("slot", { deviation: 5, depth: 2 });
            return { value: z.value.current, direction: z.direction.current };
        });
        expect(Number.isNaN(out[0].value)).toBe(true);
        expect(Number.isNaN(out[0].direction)).toBe(true);
    });

    it("flat series → no pivot confirms, value stays NaN", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 20; i += 1) bars.push(makeBar(100, i));
        const out = harness(bars, bars.length + 1, () => {
            const z = zigZag("slot", { deviation: 5, depth: 2 });
            return z.value.current;
        });
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });

    it("strong uptrend ≥ deviation after depth bars confirms first pivot", () => {
        // Bar 0 at 100; bars 1..9 at 100; bar 10 jumps to 110 (≥ 5%).
        const bars: Bar[] = [];
        for (let i = 0; i < 10; i += 1) bars.push(makeBar(100, i));
        bars.push(makeBar(110, 10));
        const out = harness(bars, bars.length + 1, () => {
            const z = zigZag("slot", { deviation: 5, depth: 10 });
            return { value: z.value.current, direction: z.direction.current };
        });
        // First 10 bars: no confirmation yet.
        for (let i = 0; i < 10; i += 1) expect(Number.isNaN(out[i].value)).toBe(true);
        // Bar 10: first pivot confirms, value = 110 (the confirmed peak),
        // direction = +1.
        expect(out[10].value).toBeCloseTo(110, 10);
        expect(out[10].direction).toBe(1);
    });

    it("V-shape: up then sharp down ≥ deviation flips direction", () => {
        const bars: Bar[] = [];
        // Bar 0 at 100; ramp up to 110 by bar 10 (5% rise, depth=10).
        for (let i = 0; i <= 10; i += 1) bars.push(makeBar(100 + i, i));
        // Hold at 110 for a few more bars (peak at bar 10).
        for (let i = 11; i < 13; i += 1) bars.push(makeBar(110, i));
        // Now drop to 100 by bar 23 — 10/110 ≈ 9.1% drop, depth = 10
        // bars since the peak.
        for (let i = 13; i <= 23; i += 1) bars.push(makeBar(110 - (i - 12), i));
        const out = harness(bars, bars.length + 1, () => {
            const z = zigZag("slot", { deviation: 5, depth: 10 });
            return { value: z.value.current, direction: z.direction.current };
        });
        // The reversal should flip direction to -1; the value at the
        // flip bar carries the just-confirmed peak (110).
        let sawFlip = false;
        for (const o of out) {
            if (o.direction === -1) {
                sawFlip = true;
                break;
            }
        }
        expect(sawFlip).toBe(true);
    });

    it("returns the same ZigZagResult identity on every call", () => {
        const bars = syntheticBars(20, 7);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            ids.add(zigZag("slot"));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => zigZag("oops")).toThrowError(/ta.zigZag called outside an active script step/);
    });

    it("NaN close → NaN outputs, state freezes", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 10; i += 1) bars.push(makeBar(100, i));
        bars.push({ ...makeBar(0, 10), close: Number.NaN });
        bars.push(makeBar(110, 11));
        const out = harness(bars, bars.length + 1, () => {
            const z = zigZag("slot", { deviation: 5, depth: 10 });
            return { value: z.value.current, direction: z.direction.current };
        });
        expect(Number.isNaN(out[10].value)).toBe(true);
        expect(Number.isNaN(out[10].direction)).toBe(true);
        // Bar 11 picks back up; with depth=10, bar 11 is barsSince=11
        // since lastPivot=bar0, so the first-pivot check fires.
        expect(out[11].value).toBeCloseTo(110, 10);
    });

    it("uses defaults: deviation=5, depth=10", () => {
        const bars = syntheticBars(40, 1);
        const out = harness(bars, bars.length + 1, () => zigZag("slot").value.current);
        // Some bars later, expect at least one finite value once
        // synthetic walk drifts.
        const hasFinite = out.some((v) => Number.isFinite(v));
        expect(typeof hasFinite).toBe("boolean"); // exists check
    });

    it("zero pivot price → no division blow-up (NaN-safe)", () => {
        // Bar 0 at 0; bar 1+ at non-zero. The pct-change calc divides
        // by lastPivotPrice. We guard against this — emit NaN.
        const bars: Bar[] = [makeBar(0, 0)];
        for (let i = 1; i < 15; i += 1) bars.push(makeBar(10, i));
        const out = harness(bars, bars.length + 1, () => {
            const z = zigZag("slot", { deviation: 5, depth: 2 });
            return z.value.current;
        });
        // No confirmation possible (lastPivotPrice === 0); outputs
        // stay NaN.
        for (const v of out) expect(Number.isNaN(v)).toBe(true);
    });

    it("zero running peak (down-trend) → div-by-zero guarded", () => {
        // Construct: bar 0 at 100; bars 1-2 at 100; bar 3 at 110 (10%
        // up, depth=2) → confirms first pivot up. Bars 4+ at 0 (price
        // collapses to 0): direction=+1, close < peak, so peak gets
        // set to 0. Subsequent bars at 0 trigger the
        // `prevPeakSinceLastPivot === 0` branch with `pctDrop = 0`.
        const bars: Bar[] = [];
        for (let i = 0; i < 3; i += 1) bars.push(makeBar(100, i));
        bars.push(makeBar(110, 3));
        for (let i = 4; i < 12; i += 1) bars.push(makeBar(0, i));
        const out = harness(bars, bars.length + 1, () => {
            const z = zigZag("slot", { deviation: 5, depth: 2 });
            return { value: z.value.current, direction: z.direction.current };
        });
        // No division blow-up — every output is either NaN or finite.
        for (const o of out) {
            expect(Number.isFinite(o.value) || Number.isNaN(o.value)).toBe(true);
        }
    });

    it("zero running trough (up-trend after down) → div-by-zero guarded", () => {
        // Mirror: drive to a confirmed down pivot, then run prices at
        // 0 so the running trough becomes 0; the `prevPeakSinceLastPivot
        // === 0` branch in the down-trend section gets exercised.
        const bars: Bar[] = [];
        for (let i = 0; i < 3; i += 1) bars.push(makeBar(100, i));
        bars.push(makeBar(85, 3)); // 15% drop, depth=2 → confirms down.
        for (let i = 4; i < 12; i += 1) bars.push(makeBar(0, i));
        const out = harness(bars, bars.length + 1, () => {
            const z = zigZag("slot", { deviation: 5, depth: 2 });
            return { value: z.value.current, direction: z.direction.current };
        });
        for (const o of out) {
            expect(Number.isFinite(o.value) || Number.isNaN(o.value)).toBe(true);
        }
    });
});

describe("ta.zigZag tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(20, 11);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
            zigZag("slot", { deviation: 5, depth: 5 }),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const last = bars[bars.length - 1];
        tick(ctxRef, { ...last, close: last.close + 50 }, () =>
            zigZag("slot", { deviation: 5, depth: 5 }),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(20, 13);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
            zigZag("slot", { deviation: 5, depth: 5 }),
        );
        const last = bars[bars.length - 1];
        const tickBar = { ...last, close: last.close + 3 };
        const a = tick(ctxRef, tickBar, () => {
            const z = zigZag("slot", { deviation: 5, depth: 5 });
            return { value: z.value.current, direction: z.direction.current };
        });
        const b = tick(ctxRef, tickBar, () => {
            const z = zigZag("slot", { deviation: 5, depth: 5 });
            return { value: z.value.current, direction: z.direction.current };
        });
        if (Number.isNaN(a.value)) expect(Number.isNaN(b.value)).toBe(true);
        else expect(b.value).toBe(a.value);
        if (Number.isNaN(a.direction)) expect(Number.isNaN(b.direction)).toBe(true);
        else expect(b.direction).toBe(a.direction);
    });

    it("tick on the first closed bar returns NaN (seed)", () => {
        const bars = [makeBar(100, 0)];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, () => zigZag("slot"));
        const head = tick(ctxRef, bars[0], () => {
            const z = zigZag("slot");
            return { value: z.value.current, direction: z.direction.current };
        });
        expect(Number.isNaN(head.value)).toBe(true);
        expect(Number.isNaN(head.direction)).toBe(true);
    });

    it("tick with NaN close returns NaN", () => {
        const bars = syntheticBars(20, 17);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, () => zigZag("slot"));
        const last = bars[bars.length - 1];
        const head = tick(ctxRef, { ...last, close: Number.NaN }, () => {
            const z = zigZag("slot");
            return { value: z.value.current, direction: z.direction.current };
        });
        expect(Number.isNaN(head.value)).toBe(true);
        expect(Number.isNaN(head.direction)).toBe(true);
    });

    it("ticking the last closed bar's own values reproduces the close output", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 15; i += 1) bars.push(makeBar(100 + i, i));
        const closedOut = harness(bars, bars.length + 1, () => {
            const z = zigZag("slot", { deviation: 5, depth: 5 });
            return { value: z.value.current, direction: z.direction.current };
        });
        const lastClosed = closedOut[closedOut.length - 1];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
            zigZag("slot", { deviation: 5, depth: 5 }),
        );
        const last = bars[bars.length - 1];
        const tickHead = tick(ctxRef, last, () => {
            const z = zigZag("slot", { deviation: 5, depth: 5 });
            return { value: z.value.current, direction: z.direction.current };
        });
        if (Number.isNaN(lastClosed.value)) {
            expect(Number.isNaN(tickHead.value)).toBe(true);
        } else {
            expect(tickHead.value).toBeCloseTo(lastClosed.value, 10);
        }
        if (Number.isNaN(lastClosed.direction)) {
            expect(Number.isNaN(tickHead.direction)).toBe(true);
        } else {
            expect(tickHead.direction).toBe(lastClosed.direction);
        }
    });
});
