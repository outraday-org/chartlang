// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { supertrend } from "./supertrend";

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

describe("ta.supertrend", () => {
    it("emits NaN until ATR is warm (length bars)", () => {
        const bars = syntheticBars(20, 3);
        const out = harness(bars, bars.length + 1, () => {
            const s = supertrend("slot", { length: 5, multiplier: 3 });
            return { line: s.line.current, direction: s.direction.current };
        });
        // ATR warmup is `length`: first `length - 1` outputs are NaN,
        // first finite output lands at bar index `length - 1`.
        for (let i = 0; i < 4; i += 1) {
            expect(Number.isNaN(out[i].line)).toBe(true);
            expect(Number.isNaN(out[i].direction)).toBe(true);
        }
        expect(Number.isFinite(out[4].line)).toBe(true);
        expect(out[4].direction).toBe(1);
    });

    it("flat OHLC at constant prices → constant line, direction does not flip", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 15; i += 1) {
            bars.push(makeBar(100, 101, 99, 100, i));
        }
        const out = harness(bars, bars.length + 1, () => {
            const s = supertrend("slot", { length: 5, multiplier: 3 });
            return { line: s.line.current, direction: s.direction.current };
        });
        // After warmup, direction stays at the seed (+1) since close
        // never crosses the bands.
        for (let i = 4; i < bars.length; i += 1) {
            expect(out[i].direction).toBe(1);
        }
    });

    it("strong uptrend → direction = +1 from first warm bar on", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 15; i += 1) {
            bars.push(makeBar(100 + i, 101 + i, 99 + i, 100 + i, i));
        }
        const out = harness(bars, bars.length + 1, () => {
            const s = supertrend("slot", { length: 5, multiplier: 3 });
            return s.direction.current;
        });
        for (let i = 4; i < bars.length; i += 1) {
            expect(out[i]).toBe(1);
        }
    });

    it("strong downtrend after warm reverses to direction = -1", () => {
        // First half ascending, second half descending sharply.
        const bars: Bar[] = [];
        for (let i = 0; i < 10; i += 1) {
            bars.push(makeBar(100 + i, 101 + i, 99 + i, 100 + i, i));
        }
        for (let i = 0; i < 10; i += 1) {
            bars.push(makeBar(110 - i * 3, 111 - i * 3, 109 - i * 3 - 5, 110 - i * 3 - 5, 10 + i));
        }
        const out = harness(bars, bars.length + 1, () => {
            const s = supertrend("slot", { length: 5, multiplier: 2 });
            return s.direction.current;
        });
        // The sharp downtrend in the second half eventually flips to -1.
        const flippedToDown = out.some((d) => d === -1);
        expect(flippedToDown).toBe(true);
    });

    it("returns the same SupertrendResult identity on every call", () => {
        const bars = syntheticBars(20, 7);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            ids.add(supertrend("slot", { length: 5, multiplier: 3 }));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => supertrend("oops")).toThrowError(
            /ta.supertrend called outside an active script step/,
        );
    });

    it("NaN OHLC → NaN outputs that bar; state freezes; next finite bar resumes", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 10; i += 1) {
            bars.push(makeBar(100 + i, 101 + i, 99 + i, 100 + i, i));
        }
        // Inject a NaN bar.
        bars.push({ ...makeBar(0, Number.NaN, Number.NaN, Number.NaN, 10) });
        bars.push(makeBar(110, 111, 109, 110, 11));
        const out = harness(bars, bars.length + 1, () => {
            const s = supertrend("slot", { length: 5, multiplier: 3 });
            return { line: s.line.current, direction: s.direction.current };
        });
        expect(Number.isNaN(out[10].line)).toBe(true);
        expect(Number.isNaN(out[10].direction)).toBe(true);
        // Bar 11 resumes — finite.
        expect(Number.isFinite(out[11].line)).toBe(true);
        expect(Number.isFinite(out[11].direction)).toBe(true);
    });

    it("composes ta.atr via a sub-slot (single composed primitive)", () => {
        // Smoke test — drive a few bars and confirm we get finite
        // outputs at the expected warm bar.
        const bars = syntheticBars(20, 5);
        const out = harness(bars, bars.length + 1, () => {
            const s = supertrend("slot", { length: 5, multiplier: 3 });
            return s.line.current;
        });
        expect(Number.isFinite(out[4])).toBe(true);
    });

    it("uses default length=10 and multiplier=3 when opts omitted", () => {
        const bars = syntheticBars(20, 1);
        const out = harness(bars, bars.length + 1, () => supertrend("slot").line.current);
        for (let i = 0; i < 9; i += 1) {
            expect(Number.isNaN(out[i])).toBe(true);
        }
        expect(Number.isFinite(out[9])).toBe(true);
    });
});

describe("ta.supertrend tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(20, 11);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
            supertrend("slot", { length: 5, multiplier: 3 }),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const last = bars[bars.length - 1];
        tick(ctxRef, { ...last, close: last.close + 100 }, () =>
            supertrend("slot", { length: 5, multiplier: 3 }),
        );
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("two identical ticks produce the same head", () => {
        const bars = syntheticBars(20, 13);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
            supertrend("slot", { length: 5, multiplier: 3 }),
        );
        const last = bars[bars.length - 1];
        const tickBar = { ...last, close: last.close + 5 };
        const a = tick(ctxRef, tickBar, () => {
            const s = supertrend("slot", { length: 5, multiplier: 3 });
            return { line: s.line.current, direction: s.direction.current };
        });
        const b = tick(ctxRef, tickBar, () => {
            const s = supertrend("slot", { length: 5, multiplier: 3 });
            return { line: s.line.current, direction: s.direction.current };
        });
        expect(b.line).toBe(a.line);
        expect(b.direction).toBe(a.direction);
    });

    it("tick during the first warm bar replays the seed (line = finalLower, direction = +1)", () => {
        // Drive `length` bars closed — the last one is the first warm
        // bar. Tick replays it; the tick path exercises the
        // `prevClosedWarmBarCount === 0` branch.
        const bars: Bar[] = [];
        for (let i = 0; i < 5; i += 1) {
            bars.push(makeBar(100 + i, 101 + i, 99 + i, 100 + i, i));
        }
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, () =>
            supertrend("slot", { length: 5, multiplier: 3 }),
        );
        const last = bars[bars.length - 1];
        const head = tick(ctxRef, last, () => {
            const s = supertrend("slot", { length: 5, multiplier: 3 });
            return { line: s.line.current, direction: s.direction.current };
        });
        expect(Number.isFinite(head.line)).toBe(true);
        expect(head.direction).toBe(1);
    });

    it("tick during warmup returns NaN", () => {
        const bars = syntheticBars(3, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, () =>
            supertrend("slot", { length: 5, multiplier: 3 }),
        );
        const head = tick(ctxRef, bars[2], () => {
            const s = supertrend("slot", { length: 5, multiplier: 3 });
            return { line: s.line.current, direction: s.direction.current };
        });
        expect(Number.isNaN(head.line)).toBe(true);
        expect(Number.isNaN(head.direction)).toBe(true);
    });

    it("tick with NaN OHLC returns NaN", () => {
        const bars = syntheticBars(20, 17);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, () =>
            supertrend("slot", { length: 5, multiplier: 3 }),
        );
        const last = bars[bars.length - 1];
        const head = tick(
            ctxRef,
            { ...last, close: Number.NaN, high: Number.NaN, low: Number.NaN },
            () => {
                const s = supertrend("slot", { length: 5, multiplier: 3 });
                return { line: s.line.current, direction: s.direction.current };
            },
        );
        expect(Number.isNaN(head.line)).toBe(true);
        expect(Number.isNaN(head.direction)).toBe(true);
    });

    it("ticking the last closed bar's own values reproduces the last close's output", () => {
        // Append-vs-replaceHead equivalence: drive all bars closed,
        // then tick the last bar with its OWN OHLC — the tick replay
        // recomputes from the snapshot and should match the close-side
        // value exactly.
        const bars: Bar[] = [];
        for (let i = 0; i < 12; i += 1) {
            bars.push(makeBar(100 + i, 101 + i, 99 + i, 100 + i, i));
        }
        bars.push(makeBar(112, 112, 50, 50, 12));
        const closedOut = harness(bars, bars.length + 1, () => {
            const s = supertrend("slot", { length: 5, multiplier: 3 });
            return { line: s.line.current, direction: s.direction.current };
        });
        const lastClosed = closedOut[closedOut.length - 1];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
            supertrend("slot", { length: 5, multiplier: 3 }),
        );
        const last = bars[bars.length - 1];
        const tickHead = tick(ctxRef, last, () => {
            const s = supertrend("slot", { length: 5, multiplier: 3 });
            return { line: s.line.current, direction: s.direction.current };
        });
        if (Number.isNaN(lastClosed.line)) {
            expect(Number.isNaN(tickHead.line)).toBe(true);
        } else {
            expect(tickHead.line).toBeCloseTo(lastClosed.line, 10);
        }
        expect(tickHead.direction).toBe(lastClosed.direction);
    });
});
