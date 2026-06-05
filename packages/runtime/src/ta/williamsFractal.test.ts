// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { williamsFractal } from "./williamsFractal";
import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";

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

describe("ta.williamsFractal", () => {
    it("emits NaN for the first `2 · length` bars (warmup)", () => {
        const bars = syntheticBars(20, 3);
        const out = harness(bars, bars.length + 1, () => {
            const f = williamsFractal("slot", { length: 2 });
            return { up: f.up.current, down: f.down.current };
        });
        // Warmup is 2 * length = 4: bars 0..3 emit NaN.
        for (let i = 0; i < 4; i += 1) {
            expect(Number.isNaN(out[i].up)).toBe(true);
            expect(Number.isNaN(out[i].down)).toBe(true);
        }
    });

    it("detects an up-fractal at the centre with a strict 5-bar peak pattern", () => {
        // Highs: 10, 11, 15, 11, 10. Centre is bar 2 (high=15);
        // all 4 surrounding bars have high < 15 → up-fractal at
        // centre (bar 2). Output is emitted at bar 4 (= centre + length).
        const highs = [10, 11, 15, 11, 10];
        const lows = [9, 10, 14, 10, 9];
        const bars = highs.map((h, i) => makeBar(h, lows[i], i));
        const out = harness(bars, bars.length + 1, () => {
            const f = williamsFractal("slot", { length: 2 });
            return { up: f.up.current, down: f.down.current };
        });
        // Output at bar 4 (= centre 2 + length 2) carries centre's up.
        expect(out[4].up).toBe(15);
        // Bar 2 (centre) was a valley low? Lows: 9, 10, 14, 10, 9.
        // Centre low = 14; surrounding lows all < 14 → centre low is
        // a MAX, not min → no down-fractal.
        expect(Number.isNaN(out[4].down)).toBe(true);
    });

    it("detects a down-fractal at the centre with a strict 5-bar trough pattern", () => {
        // Lows: 10, 9, 5, 9, 10. Centre bar 2 (low=5); all surrounding
        // > 5 → down-fractal.
        const lows = [10, 9, 5, 9, 10];
        const highs = [12, 11, 7, 11, 12];
        const bars = highs.map((h, i) => makeBar(h, lows[i], i));
        const out = harness(bars, bars.length + 1, () => {
            const f = williamsFractal("slot", { length: 2 });
            return { up: f.up.current, down: f.down.current };
        });
        expect(out[4].down).toBe(5);
        expect(Number.isNaN(out[4].up)).toBe(true);
    });

    it("tied high in the window → no up-fractal (strict comparison)", () => {
        // Centre 15; one of the surrounding bars also has 15 → not
        // strictly greater → no fractal.
        const highs = [10, 15, 15, 11, 10];
        const lows = [9, 10, 14, 10, 9];
        const bars = highs.map((h, i) => makeBar(h, lows[i], i));
        const out = harness(bars, bars.length + 1, () => {
            const f = williamsFractal("slot", { length: 2 });
            return f.up.current;
        });
        expect(Number.isNaN(out[4])).toBe(true);
    });

    it("NaN in any window slot → no fractal at the centre", () => {
        const bars: Bar[] = [
            makeBar(10, 9, 0),
            makeBar(11, 10, 1),
            makeBar(15, 14, 2), // potential up-centre
            { ...makeBar(11, 10, 3), high: Number.NaN }, // NaN in right window
            makeBar(10, 9, 4),
        ];
        const out = harness(bars, bars.length + 1, () => {
            const f = williamsFractal("slot", { length: 2 });
            return f.up.current;
        });
        expect(Number.isNaN(out[4])).toBe(true);
    });

    it("NaN at the centre bar's high → no up-fractal at that centre", () => {
        const bars: Bar[] = [
            makeBar(10, 9, 0),
            makeBar(11, 10, 1),
            { ...makeBar(15, 14, 2), high: Number.NaN }, // centre high NaN
            makeBar(11, 10, 3),
            makeBar(10, 9, 4),
        ];
        const out = harness(bars, bars.length + 1, () => {
            const f = williamsFractal("slot", { length: 2 });
            return f.up.current;
        });
        expect(Number.isNaN(out[4])).toBe(true);
    });

    it("NaN at the centre bar's low → no down-fractal at that centre", () => {
        const bars: Bar[] = [
            makeBar(12, 10, 0),
            makeBar(11, 9, 1),
            { ...makeBar(7, 5, 2), low: Number.NaN }, // centre low NaN
            makeBar(11, 9, 3),
            makeBar(12, 10, 4),
        ];
        const out = harness(bars, bars.length + 1, () => {
            const f = williamsFractal("slot", { length: 2 });
            return f.down.current;
        });
        expect(Number.isNaN(out[4])).toBe(true);
    });

    it("NaN in a non-centre window slot → no down-fractal (down scan returns NaN at the non-finite entry)", () => {
        const bars: Bar[] = [
            makeBar(12, 10, 0),
            { ...makeBar(11, 9, 1), low: Number.NaN }, // non-centre NaN in low
            makeBar(7, 5, 2), // would be down-centre, but window has NaN
            makeBar(11, 9, 3),
            makeBar(12, 10, 4),
        ];
        const out = harness(bars, bars.length + 1, () => {
            const f = williamsFractal("slot", { length: 2 });
            return f.down.current;
        });
        expect(Number.isNaN(out[4])).toBe(true);
    });

    it("returns the same WilliamsFractalResult identity on every call", () => {
        const bars = syntheticBars(10, 7);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            ids.add(williamsFractal("slot"));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => williamsFractal("oops")).toThrowError(
            /ta.williamsFractal called outside an active script step/,
        );
    });

    it("supports length=1 (3-bar window)", () => {
        // 3-bar window: bars [c-1, c, c+1]. Up-fractal at c if
        // high[c] > high[c-1] and high[c] > high[c+1].
        const highs = [10, 15, 11];
        const lows = [9, 14, 10];
        const bars = highs.map((h, i) => makeBar(h, lows[i], i));
        const out = harness(bars, bars.length + 1, () => {
            const f = williamsFractal("slot", { length: 1 });
            return f.up.current;
        });
        // Output at bar 2 (= centre 1 + length 1).
        expect(out[2]).toBe(15);
    });

    it("uses default length=2 (5-bar window) when opts omitted", () => {
        const bars = syntheticBars(20, 9);
        const out = harness(bars, bars.length + 1, () => {
            const f = williamsFractal("slot");
            return f.up.current;
        });
        // Bar 0..3 (= 2*length - 1 = 3) emit NaN.
        for (let i = 0; i < 4; i += 1) {
            expect(Number.isNaN(out[i])).toBe(true);
        }
    });

    it("emits NaN at non-fractal centres in a synthetic stream", () => {
        const bars = syntheticBars(50, 11);
        const out = harness(bars, bars.length + 1, () => {
            const f = williamsFractal("slot", { length: 2 });
            return f.up.current;
        });
        // Most bars in a random stream are NOT fractals; assert at
        // least some bars emit NaN (sparsity check).
        let nanCount = 0;
        for (let i = 4; i < out.length; i += 1) {
            if (Number.isNaN(out[i])) nanCount += 1;
        }
        // Generously: at least 50% of post-warmup bars are non-fractal.
        expect(nanCount).toBeGreaterThan((out.length - 4) * 0.5);
    });
});

describe("ta.williamsFractal tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(15, 11);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
            williamsFractal("slot", { length: 2 }),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const last = bars[bars.length - 1];
        tick(ctxRef, { ...last, high: last.high + 100 }, () =>
            williamsFractal("slot", { length: 2 }),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(3, 13);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, () =>
            williamsFractal("slot", { length: 2 }),
        );
        const head = tick(ctxRef, bars[2], () => {
            const f = williamsFractal("slot", { length: 2 });
            return { up: f.up.current, down: f.down.current };
        });
        expect(Number.isNaN(head.up)).toBe(true);
        expect(Number.isNaN(head.down)).toBe(true);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(15, 13);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
            williamsFractal("slot", { length: 2 }),
        );
        const last = bars[bars.length - 1];
        const tickBar = { ...last, high: last.high + 5, low: last.low - 5 };
        const a = tick(ctxRef, tickBar, () => {
            const f = williamsFractal("slot", { length: 2 });
            return { up: f.up.current, down: f.down.current };
        });
        const b = tick(ctxRef, tickBar, () => {
            const f = williamsFractal("slot", { length: 2 });
            return { up: f.up.current, down: f.down.current };
        });
        if (Number.isNaN(a.up)) expect(Number.isNaN(b.up)).toBe(true);
        else expect(b.up).toBe(a.up);
        if (Number.isNaN(a.down)) expect(Number.isNaN(b.down)).toBe(true);
        else expect(b.down).toBe(a.down);
    });

    it("ticking the last closed bar's own values reproduces the close output", () => {
        // Build a known up-fractal centre then tick the last bar with
        // its own values — should reproduce the close output.
        const highs = [10, 11, 15, 11, 10, 12];
        const lows = [9, 10, 14, 10, 9, 11];
        const bars = highs.map((h, i) => makeBar(h, lows[i], i));
        const closedOut = harness(bars, bars.length + 1, () => {
            const f = williamsFractal("slot", { length: 2 });
            return { up: f.up.current, down: f.down.current };
        });
        const lastClosed = closedOut[closedOut.length - 1];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
            williamsFractal("slot", { length: 2 }),
        );
        const last = bars[bars.length - 1];
        const tickHead = tick(ctxRef, last, () => {
            const f = williamsFractal("slot", { length: 2 });
            return { up: f.up.current, down: f.down.current };
        });
        if (Number.isNaN(lastClosed.up)) expect(Number.isNaN(tickHead.up)).toBe(true);
        else expect(tickHead.up).toBe(lastClosed.up);
        if (Number.isNaN(lastClosed.down)) expect(Number.isNaN(tickHead.down)).toBe(true);
        else expect(tickHead.down).toBe(lastClosed.down);
    });
});
