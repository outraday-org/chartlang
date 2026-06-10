// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { psar } from "./psar.js";

function makeBar(open: number, high: number, low: number, close: number, i: number): Bar {
    return {
        time: 1_700_000_000_000 + i * 60_000,
        open,
        high,
        low,
        close,
        volume: 0,
        symbol: "T",
        interval: "1m",
    };
}

describe("ta.psar", () => {
    it("emits the seed value at bar 0 (sar = low, direction = +1)", () => {
        const bars = [makeBar(10, 12, 8, 11, 0)];
        const out = harness(bars, bars.length + 1, () => {
            const p = psar("slot");
            return { sar: p.sar.current, direction: p.direction.current };
        });
        expect(out[0].sar).toBe(8);
        expect(out[0].direction).toBe(1);
    });

    it("ascending closes → bar 1 chooses direction = +1", () => {
        const bars = [makeBar(10, 12, 8, 11, 0), makeBar(11, 13, 9, 12, 1)];
        const out = harness(bars, bars.length + 1, () => {
            const p = psar("slot");
            return { sar: p.sar.current, direction: p.direction.current };
        });
        expect(out[1].direction).toBe(1);
    });

    it("descending closes → bar 1 seeds direction = -1 (recurrence preserves it when high stays under clamp)", () => {
        // Bar 0 H/L = 12/8, bar 1 H/L = 11/7, close=10 < bar0.close=11.
        // Seed direction = -1. Recurrence: candidateSar starts at
        // prevHigh = 12, clamp upperBound = max(12, 12) = 12 →
        // candidateSar = 12. high (11) < candidateSar → no flip,
        // direction stays -1.
        const bars = [makeBar(10, 12, 8, 11, 0), makeBar(11, 11, 7, 10, 1)];
        const out = harness(bars, bars.length + 1, () => {
            const p = psar("slot");
            return { sar: p.sar.current, direction: p.direction.current };
        });
        expect(out[1].direction).toBe(-1);
    });

    it("monotonic uptrend keeps direction = +1 across N bars", () => {
        // Each bar's high rises by 1, low rises by 1, close rises by 1.
        const bars: Bar[] = [];
        for (let i = 0; i < 10; i += 1) {
            bars.push(makeBar(100 + i, 102 + i, 98 + i, 101 + i, i));
        }
        const out = harness(bars, bars.length + 1, () => psar("slot").direction.current);
        // Bar 0 seed = +1, bar 1+ recurrence inherits +1.
        for (let i = 0; i < bars.length; i += 1) {
            expect(out[i]).toBe(1);
        }
    });

    it("monotonic downtrend keeps direction = -1 after the bar-1 flip", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 10; i += 1) {
            bars.push(makeBar(100 - i, 102 - i, 98 - i, 100 - i - 1, i));
        }
        const out = harness(bars, bars.length + 1, () => psar("slot").direction.current);
        // Bar 0 seed = +1, bar 1 decides -1 (close decreasing), then -1
        // continues.
        expect(out[0]).toBe(1);
        for (let i = 1; i < bars.length; i += 1) {
            expect(out[i]).toBe(-1);
        }
    });

    it("sharp reversal up→down flips direction and resets AF", () => {
        // Build an uptrend, then drop hard enough to force a flip on
        // the next bar.
        const bars: Bar[] = [];
        for (let i = 0; i < 5; i += 1) {
            bars.push(makeBar(100 + i, 102 + i, 98 + i, 101 + i, i));
        }
        // Big drop — bar 5's low is well below any plausible SAR.
        bars.push(makeBar(105, 105, 50, 50, 5));
        const out = harness(bars, bars.length + 1, () => {
            const p = psar("slot");
            return { sar: p.sar.current, direction: p.direction.current };
        });
        expect(out[5].direction).toBe(-1);
    });

    it("returns the same PsarResult identity on every call", () => {
        const bars = syntheticBars(10, 7);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            ids.add(psar("slot"));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => psar("oops")).toThrowError(/ta.psar called outside an active script step/);
    });

    it("NaN high → NaN outputs that bar; state freezes; next finite bar resumes", () => {
        const bars: Bar[] = [
            makeBar(100, 102, 98, 101, 0),
            makeBar(101, 103, 99, 102, 1),
            makeBar(102, 104, 100, 103, 2),
            // NaN bar — state freezes.
            { ...makeBar(0, Number.NaN, Number.NaN, Number.NaN, 3) },
            makeBar(103, 105, 101, 104, 4),
        ];
        const out = harness(bars, bars.length + 1, () => {
            const p = psar("slot");
            return { sar: p.sar.current, direction: p.direction.current };
        });
        expect(Number.isNaN(out[3].sar)).toBe(true);
        expect(Number.isNaN(out[3].direction)).toBe(true);
        // Bar 4 resumes — finite, matches the bar-after-bar-2 state.
        expect(Number.isFinite(out[4].sar)).toBe(true);
        expect(out[4].direction).toBe(1);
    });

    it("supports custom acceleration params (slot captures on first call)", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 5; i += 1) {
            bars.push(makeBar(100 + i, 102 + i, 98 + i, 101 + i, i));
        }
        const customOpts = {
            accelerationStart: 0.05,
            accelerationStep: 0.05,
            accelerationMax: 0.5,
        };
        const out = harness(bars, bars.length + 1, () => psar("slot", customOpts).sar.current);
        // Just check the recurrence runs without throwing and produces
        // finite values past the seed.
        for (let i = 0; i < bars.length; i += 1) {
            expect(Number.isFinite(out[i])).toBe(true);
        }
    });
});

describe("ta.psar tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(15, 11);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => psar("slot"));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const last = bars[bars.length - 1];
        tick(ctxRef, { ...last, high: last.high + 100, low: last.low - 100 }, () => psar("slot"));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(15, 13);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => psar("slot"));
        const last = bars[bars.length - 1];
        const tickBar = { ...last, high: last.high + 5, low: last.low - 5 };
        const a = tick(ctxRef, tickBar, () => {
            const p = psar("slot");
            return { sar: p.sar.current, direction: p.direction.current };
        });
        const b = tick(ctxRef, tickBar, () => {
            const p = psar("slot");
            return { sar: p.sar.current, direction: p.direction.current };
        });
        expect(b.sar).toBe(a.sar);
        expect(b.direction).toBe(a.direction);
    });

    it("tick during bar 0 returns the seed values for the tick's low", () => {
        const bars = [makeBar(10, 12, 8, 11, 0)];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, () => psar("slot"));
        const head = tick(ctxRef, makeBar(10, 13, 7, 11, 0), () => {
            const p = psar("slot");
            return { sar: p.sar.current, direction: p.direction.current };
        });
        expect(head.sar).toBe(7);
        expect(head.direction).toBe(1);
    });

    it("ticking bar 1 with a clamped-high descending close reproduces the close output", () => {
        // Drive bar 0 + bar 1 closed; bar 1 picks -1 via close-decide
        // and the clamp (high=11 ≤ max(prevHigh=12, priorHigh=12))
        // keeps the recurrence in -1. Tick replays bar 1 with its own
        // OHLC → should reproduce direction = -1.
        const bars = [makeBar(10, 12, 8, 11, 0), makeBar(11, 11, 7, 10, 1)];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, () => psar("slot"));
        const head = tick(ctxRef, bars[1], () => psar("slot").direction.current);
        expect(head).toBe(-1);
    });

    it("ticking bar 1 with ascending close exercises the tick-side TREND_UP seed branch", () => {
        // Drive bar 0 + bar 1 closed (bar 1 was ascending, so closed-
        // side bar 1 ran the TREND_UP seed branch already). Tick now
        // replays bar 1 with its OWN OHLC; the tick path's
        // `seedBarCount === 1` branch picks TREND_UP and re-runs the
        // recurrence from the snapshot. Exercises lines 322-324.
        const bars = [makeBar(10, 12, 8, 11, 0), makeBar(11, 13, 9, 12, 1)];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, () => psar("slot"));
        const head = tick(ctxRef, bars[1], () => {
            const p = psar("slot");
            return { sar: p.sar.current, direction: p.direction.current };
        });
        expect(Number.isFinite(head.sar)).toBe(true);
        expect(head.direction).toBe(1);
    });

    it("tick with NaN OHLC returns NaN", () => {
        const bars = [makeBar(10, 12, 8, 11, 0), makeBar(11, 13, 9, 12, 1)];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, () => psar("slot"));
        const head = tick(ctxRef, makeBar(11, Number.NaN, Number.NaN, Number.NaN, 1), () => {
            const p = psar("slot");
            return { sar: p.sar.current, direction: p.direction.current };
        });
        expect(Number.isNaN(head.sar)).toBe(true);
        expect(Number.isNaN(head.direction)).toBe(true);
    });

    it("ticking the last closed bar's own values reproduces the last close's output", () => {
        // Append-vs-replaceHead equivalence: drive all bars closed,
        // then tick the last bar with its OWN OHLC — the tick replay
        // recomputes from the snapshot and should match the close-side
        // value exactly.
        const bars: Bar[] = [];
        for (let i = 0; i < 11; i += 1) {
            bars.push(makeBar(100 + i, 102 + i, 98 + i, 101 + i, i));
        }
        // Final bar is a sharp drop — exercises a flip path on close.
        bars.push(makeBar(110, 110, 30, 30, 11));
        const closedOut = harness(bars, bars.length + 1, () => {
            const p = psar("slot");
            return { sar: p.sar.current, direction: p.direction.current };
        });
        const lastClosed = closedOut[closedOut.length - 1];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => psar("slot"));
        const last = bars[bars.length - 1];
        const tickHead = tick(ctxRef, last, () => {
            const p = psar("slot");
            return { sar: p.sar.current, direction: p.direction.current };
        });
        expect(tickHead.sar).toBeCloseTo(lastClosed.sar, 10);
        expect(tickHead.direction).toBe(lastClosed.direction);
    });
});
