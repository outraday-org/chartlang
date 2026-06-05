// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { pivotsHighLow } from "./pivotsHighLow";

function makeBar(high: number, low: number, i: number): Bar {
    const close = (high + low) / 2;
    return {
        time: 1_700_000_000_000 + i * 60_000,
        open: close,
        high,
        low,
        close,
        volume: 0,
        symbol: "T",
        interval: "1m",
    };
}

describe("ta.pivotsHighLow", () => {
    it("emits NaN until the window fills (leftLength + rightLength bars)", () => {
        const bars = syntheticBars(20, 3);
        const out = harness(bars, bars.length + 1, () => {
            const p = pivotsHighLow("slot", { leftLength: 2, rightLength: 2 });
            return { high: p.high.current, low: p.low.current };
        });
        // windowSize = 5; the first 4 outputs are NaN, bar 4 onwards
        // can confirm a centre.
        for (let i = 0; i < 4; i += 1) {
            expect(Number.isNaN(out[i].high)).toBe(true);
            expect(Number.isNaN(out[i].low)).toBe(true);
        }
    });

    it("strict up-pivot at centre is confirmed", () => {
        // Construct 5-bar pattern with centre having the unique max
        // high: highs = [10, 11, 13, 11, 10]. With leftLength=2 +
        // rightLength=2, the centre at bar 2 is the pivot. Output
        // emitted at bar 4 (= centre + rightLength).
        const highs = [10, 11, 13, 11, 10];
        const bars = highs.map((h, i) => makeBar(h, h - 1, i));
        const out = harness(bars, bars.length + 1, () => {
            const p = pivotsHighLow("slot", { leftLength: 2, rightLength: 2 });
            return p.high.current;
        });
        expect(out[4]).toBeCloseTo(13, 10);
    });

    it("strict down-pivot at centre is confirmed", () => {
        // Lows = [10, 9, 7, 9, 10]; highs above. Centre at bar 2.
        const bars: Bar[] = [];
        bars.push(makeBar(11, 10, 0));
        bars.push(makeBar(10, 9, 1));
        bars.push(makeBar(8, 7, 2));
        bars.push(makeBar(10, 9, 3));
        bars.push(makeBar(11, 10, 4));
        const out = harness(bars, bars.length + 1, () => {
            const p = pivotsHighLow("slot", { leftLength: 2, rightLength: 2 });
            return p.low.current;
        });
        expect(out[4]).toBeCloseTo(7, 10);
    });

    it("equal-high plateau on the LEFT side disqualifies the pivot (strict left)", () => {
        // highs = [13, 11, 13, 11, 10]; centre at bar 2 ties with
        // bar 0 on the left. Strict left → no pivot.
        const highs = [13, 11, 13, 11, 10];
        const bars = highs.map((h, i) => makeBar(h, h - 1, i));
        const out = harness(bars, bars.length + 1, () => {
            const p = pivotsHighLow("slot", { leftLength: 2, rightLength: 2 });
            return p.high.current;
        });
        expect(Number.isNaN(out[4])).toBe(true);
    });

    it("equal-high plateau on the RIGHT side still allows pivot (geq right; rightmost wins)", () => {
        // highs = [10, 11, 13, 11, 13]; centre at bar 2 ties with
        // bar 4 on the right. invinite's geq-right tie-break: the
        // RIGHTMOST equal bar (bar 4) is the pivot. But our scan at
        // bar 4 checks centre = bar 2: every right entry (bar 3, bar
        // 4) must be <= 13. Bar 4's high = 13 (equal). Pivot
        // confirms at centre bar 2 → emit centreHigh = 13.
        const highs = [10, 11, 13, 11, 13];
        const bars = highs.map((h, i) => makeBar(h, h - 1, i));
        const out = harness(bars, bars.length + 1, () => {
            const p = pivotsHighLow("slot", { leftLength: 2, rightLength: 2 });
            return p.high.current;
        });
        // With the geq-right tie-break the centre at bar 2 IS a
        // pivot (right side allows ties). Output lands at bar 4.
        expect(out[4]).toBeCloseTo(13, 10);
    });

    it("strictly-greater bar on the right side disqualifies the pivot", () => {
        const highs = [10, 11, 13, 11, 14];
        const bars = highs.map((h, i) => makeBar(h, h - 1, i));
        const out = harness(bars, bars.length + 1, () => {
            const p = pivotsHighLow("slot", { leftLength: 2, rightLength: 2 });
            return p.high.current;
        });
        expect(Number.isNaN(out[4])).toBe(true);
    });

    it("NaN in window slot → no pivot at centre", () => {
        const bars: Bar[] = [
            makeBar(10, 9, 0),
            makeBar(11, 10, 1),
            makeBar(13, 12, 2),
            { ...makeBar(0, 0, 3), high: Number.NaN, low: Number.NaN },
            makeBar(10, 9, 4),
        ];
        const out = harness(bars, bars.length + 1, () => {
            const p = pivotsHighLow("slot", { leftLength: 2, rightLength: 2 });
            return p.high.current;
        });
        expect(Number.isNaN(out[4])).toBe(true);
    });

    it("NaN at the centre bar → no pivot (centre check)", () => {
        // 5-bar window; the centre at bar 2 has NaN high/low.
        const bars: Bar[] = [
            makeBar(10, 9, 0),
            makeBar(11, 10, 1),
            { ...makeBar(0, 0, 2), high: Number.NaN, low: Number.NaN },
            makeBar(11, 10, 3),
            makeBar(10, 9, 4),
        ];
        const out = harness(bars, bars.length + 1, () => {
            const p = pivotsHighLow("slot", { leftLength: 2, rightLength: 2 });
            return { high: p.high.current, low: p.low.current };
        });
        expect(Number.isNaN(out[4].high)).toBe(true);
        expect(Number.isNaN(out[4].low)).toBe(true);
    });

    it("NaN in LEFT-side window slot → no pivot", () => {
        // 5-bar window; bar 0 (oldest, leftmost) has NaN. The
        // remaining bars form a clean up-pivot at centre (so the
        // right-side check passes and we reach the left-side NaN
        // guard).
        const bars: Bar[] = [
            { ...makeBar(0, 0, 0), high: Number.NaN, low: Number.NaN },
            makeBar(11, 10, 1),
            makeBar(15, 14, 2),
            makeBar(13, 12, 3),
            makeBar(11, 10, 4),
        ];
        const out = harness(bars, bars.length + 1, () => {
            const p = pivotsHighLow("slot", { leftLength: 2, rightLength: 2 });
            return p.high.current;
        });
        // Right window (bar 3, 4): highs 13, 11 — both < centre 15 ✓
        // Left window (bar 1, 0): bar 1's high = 11 (< centre 15 OK),
        // bar 0 = NaN → line 114 fires → NaN.
        expect(Number.isNaN(out[4])).toBe(true);
    });

    it("NaN in LEFT-side low-window slot → no down-pivot (line 141 branch)", () => {
        // Similar construction for the down-pivot left-side check.
        // Lows form a clean down-pivot (centre low strictly less than
        // both right-side lows); bar 0 NaN forces the left-side scan
        // to fail.
        const bars: Bar[] = [
            { ...makeBar(0, 0, 0), high: Number.NaN, low: Number.NaN },
            makeBar(20, 15, 1),
            makeBar(15, 10, 2),
            makeBar(18, 13, 3),
            makeBar(20, 16, 4),
        ];
        const out = harness(bars, bars.length + 1, () => {
            const p = pivotsHighLow("slot", { leftLength: 2, rightLength: 2 });
            return p.low.current;
        });
        // Right window (bar 3, 4): lows 13, 16 — both > centre 10 ✓.
        // Left window (bar 1, 0): bar 1's low = 15 (> centre 10 OK),
        // bar 0 = NaN → line 141 fires → NaN.
        expect(Number.isNaN(out[4])).toBe(true);
    });

    it("asymmetric (leftLength, rightLength)", () => {
        // leftLength=1, rightLength=3 → 5-bar window, centre at age 3.
        // Output emitted at bar 4 (= centre + 3); centre = bar 1.
        // highs = [10, 14, 13, 12, 11]: centre bar 1 (high=14) is
        // strictly > left bar 0 (10) and geq every right (13, 12, 11).
        const highs = [10, 14, 13, 12, 11];
        const bars = highs.map((h, i) => makeBar(h, h - 1, i));
        const out = harness(bars, bars.length + 1, () => {
            const p = pivotsHighLow("slot", { leftLength: 1, rightLength: 3 });
            return p.high.current;
        });
        expect(out[4]).toBeCloseTo(14, 10);
    });

    it("returns the same PivotsHighLowResult identity on every call", () => {
        const bars = syntheticBars(20, 7);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            ids.add(pivotsHighLow("slot"));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => pivotsHighLow("oops")).toThrowError(
            /ta.pivotsHighLow called outside an active script step/,
        );
    });

    it("uses defaults: leftLength=4, rightLength=4", () => {
        const bars = syntheticBars(20, 1);
        const out = harness(bars, bars.length + 1, () => pivotsHighLow("slot").high.current);
        // windowSize = 9; first 8 outputs are NaN.
        for (let i = 0; i < 8; i += 1) expect(Number.isNaN(out[i])).toBe(true);
    });
});

describe("ta.pivotsHighLow tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(15, 11);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
            pivotsHighLow("slot", { leftLength: 2, rightLength: 2 }),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const last = bars[bars.length - 1];
        tick(ctxRef, { ...last, high: last.high + 50, low: last.low - 50 }, () =>
            pivotsHighLow("slot", { leftLength: 2, rightLength: 2 }),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(2, 5);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, () =>
            pivotsHighLow("slot", { leftLength: 2, rightLength: 2 }),
        );
        const head = tick(ctxRef, bars[1], () => {
            const p = pivotsHighLow("slot", { leftLength: 2, rightLength: 2 });
            return { high: p.high.current, low: p.low.current };
        });
        expect(Number.isNaN(head.high)).toBe(true);
        expect(Number.isNaN(head.low)).toBe(true);
    });

    it("ticking the last closed bar's own values reproduces the close output", () => {
        const bars = syntheticBars(20, 17);
        const closedOut = harness(bars, bars.length + 1, () => {
            const p = pivotsHighLow("slot", { leftLength: 2, rightLength: 2 });
            return { high: p.high.current, low: p.low.current };
        });
        const lastClosed = closedOut[closedOut.length - 1];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
            pivotsHighLow("slot", { leftLength: 2, rightLength: 2 }),
        );
        const last = bars[bars.length - 1];
        const tickHead = tick(ctxRef, last, () => {
            const p = pivotsHighLow("slot", { leftLength: 2, rightLength: 2 });
            return { high: p.high.current, low: p.low.current };
        });
        if (Number.isNaN(lastClosed.high)) {
            expect(Number.isNaN(tickHead.high)).toBe(true);
        } else {
            expect(tickHead.high).toBeCloseTo(lastClosed.high, 10);
        }
        if (Number.isNaN(lastClosed.low)) {
            expect(Number.isNaN(tickHead.low)).toBe(true);
        } else {
            expect(tickHead.low).toBeCloseTo(lastClosed.low, 10);
        }
    });

    it("tick with NaN high/low returns NaN", () => {
        const bars = syntheticBars(15, 19);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, () =>
            pivotsHighLow("slot", { leftLength: 2, rightLength: 2 }),
        );
        const last = bars[bars.length - 1];
        const head = tick(ctxRef, { ...last, high: Number.NaN, low: Number.NaN }, () => {
            const p = pivotsHighLow("slot", { leftLength: 2, rightLength: 2 });
            return { high: p.high.current, low: p.low.current };
        });
        expect(Number.isNaN(head.high)).toBe(true);
        expect(Number.isNaN(head.low)).toBe(true);
    });
});
