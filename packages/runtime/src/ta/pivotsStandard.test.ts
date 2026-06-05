// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { pivotsStandard } from "./pivotsStandard";

const MS_PER_DAY = 86_400_000;

function makeBarAt(time: number, high: number, low: number, close: number, i: number): Bar {
    return {
        time,
        open: (high + low) / 2,
        high,
        low,
        close,
        volume: 0,
        symbol: "T",
        interval: "1D",
        // i intentionally unused beyond doc placeholder
    } satisfies Bar & { _i?: number };
}

describe("ta.pivotsStandard", () => {
    it("emits NaN at every output until the first UTC-day boundary fires", () => {
        // 10 bars within a single UTC day → no prevDay yet.
        const t0 = Math.floor(1_700_000_000_000 / MS_PER_DAY) * MS_PER_DAY;
        const bars: Bar[] = [];
        for (let i = 0; i < 10; i += 1) {
            bars.push(makeBarAt(t0 + i * 60_000, 110 + i, 100 + i, 105 + i, i));
        }
        const out = harness(bars, bars.length + 1, () => {
            const p = pivotsStandard("slot", { system: "classic" });
            return {
                pp: p.pp.current,
                r1: p.r1.current,
                s1: p.s1.current,
                r2: p.r2.current,
                s2: p.s2.current,
                r3: p.r3.current,
                s3: p.s3.current,
            };
        });
        for (const o of out) {
            expect(Number.isNaN(o.pp)).toBe(true);
            expect(Number.isNaN(o.r1)).toBe(true);
            expect(Number.isNaN(o.s1)).toBe(true);
        }
    });

    it("after first day boundary, classic formula matches manual calc", () => {
        // Day 1: bars at high=110/low=100/close=105 each bar; the
        // day's aggregate ends up high=110/low=100/close=105.
        // Day 2: a single bar at the start of day 2.
        const t0 = Math.floor(1_700_000_000_000 / MS_PER_DAY) * MS_PER_DAY;
        const bars: Bar[] = [];
        // Day 1: three bars all within the same day.
        bars.push(makeBarAt(t0 + 0, 110, 100, 105, 0));
        bars.push(makeBarAt(t0 + 60_000, 108, 102, 106, 1));
        bars.push(makeBarAt(t0 + 120_000, 109, 101, 104, 2));
        // Day 2: bar at the start of the next UTC day.
        bars.push(makeBarAt(t0 + MS_PER_DAY, 120, 110, 115, 3));
        const out = harness(bars, bars.length + 1, () => {
            const p = pivotsStandard("slot", { system: "classic" });
            return { pp: p.pp.current, r1: p.r1.current, s1: p.s1.current };
        });
        // First 3 outputs: NaN (within day 1).
        for (let i = 0; i < 3; i += 1) expect(Number.isNaN(out[i].pp)).toBe(true);
        // Day 2 fires; prevDay = (max(110, 108, 109)=110, min(100,
        // 102, 101)=100, close=104). pp = (110+100+104)/3 = 314/3.
        const expectedPp = (110 + 100 + 104) / 3;
        expect(out[3].pp).toBeCloseTo(expectedPp, 10);
        // r1 = 2p - l = 2*expectedPp - 100.
        expect(out[3].r1).toBeCloseTo(2 * expectedPp - 100, 10);
        expect(out[3].s1).toBeCloseTo(2 * expectedPp - 110, 10);
    });

    it("fibonacci formula", () => {
        const t0 = Math.floor(1_700_000_000_000 / MS_PER_DAY) * MS_PER_DAY;
        const bars: Bar[] = [
            makeBarAt(t0, 110, 100, 105, 0),
            makeBarAt(t0 + MS_PER_DAY, 120, 110, 115, 1),
        ];
        const out = harness(bars, bars.length + 1, () => {
            const p = pivotsStandard("slot", { system: "fibonacci" });
            return { pp: p.pp.current, r1: p.r1.current, r3: p.r3.current };
        });
        const expectedPp = (110 + 100 + 105) / 3;
        const range = 110 - 100;
        expect(out[1].pp).toBeCloseTo(expectedPp, 10);
        expect(out[1].r1).toBeCloseTo(expectedPp + 0.382 * range, 10);
        expect(out[1].r3).toBeCloseTo(expectedPp + range, 10);
    });

    it("camarilla formula", () => {
        const t0 = Math.floor(1_700_000_000_000 / MS_PER_DAY) * MS_PER_DAY;
        const bars: Bar[] = [
            makeBarAt(t0, 110, 100, 105, 0),
            makeBarAt(t0 + MS_PER_DAY, 120, 110, 115, 1),
        ];
        const out = harness(bars, bars.length + 1, () => {
            const p = pivotsStandard("slot", { system: "camarilla" });
            return { pp: p.pp.current, r1: p.r1.current, r3: p.r3.current };
        });
        const range = 110 - 100;
        expect(out[1].pp).toBeCloseTo((110 + 100 + 105) / 3, 10);
        expect(out[1].r1).toBeCloseTo(105 + (1.1 * range) / 12, 10);
        expect(out[1].r3).toBeCloseTo(105 + (1.1 * range) / 4, 10);
    });

    it("woodie formula uses (h+l+2c)/4 for pp", () => {
        const t0 = Math.floor(1_700_000_000_000 / MS_PER_DAY) * MS_PER_DAY;
        const bars: Bar[] = [
            makeBarAt(t0, 110, 100, 105, 0),
            makeBarAt(t0 + MS_PER_DAY, 120, 110, 115, 1),
        ];
        const out = harness(bars, bars.length + 1, () => {
            const p = pivotsStandard("slot", { system: "woodie" });
            return { pp: p.pp.current };
        });
        const expectedPp = (110 + 100 + 2 * 105) / 4;
        expect(out[1].pp).toBeCloseTo(expectedPp, 10);
    });

    it("within-day bars carry the same prevDay-derived levels", () => {
        const t0 = Math.floor(1_700_000_000_000 / MS_PER_DAY) * MS_PER_DAY;
        const bars: Bar[] = [
            makeBarAt(t0, 110, 100, 105, 0),
            makeBarAt(t0 + MS_PER_DAY, 120, 110, 115, 1),
            // Second bar within day 2: the high goes UP (120 → 125)
            // so the in-progress day's aggregate grows, but the
            // prevDay-derived pivot levels don't change.
            makeBarAt(t0 + MS_PER_DAY + 60_000, 125, 112, 118, 2),
        ];
        const out = harness(bars, bars.length + 1, () => {
            const p = pivotsStandard("slot", { system: "classic" });
            return { pp: p.pp.current, r1: p.r1.current };
        });
        // Levels at bar 1 (day 2 start) and bar 2 (still day 2)
        // derive from day 1's (110, 100, 105).
        expect(out[1].pp).toBe(out[2].pp);
        expect(out[1].r1).toBe(out[2].r1);
    });

    it("default system is classic", () => {
        const t0 = Math.floor(1_700_000_000_000 / MS_PER_DAY) * MS_PER_DAY;
        const bars: Bar[] = [
            makeBarAt(t0, 110, 100, 105, 0),
            makeBarAt(t0 + MS_PER_DAY, 120, 110, 115, 1),
        ];
        const out = harness(bars, bars.length + 1, () => pivotsStandard("slot").pp.current);
        const expectedPp = (110 + 100 + 105) / 3;
        expect(out[1]).toBeCloseTo(expectedPp, 10);
    });

    it("NaN bar leaves the in-progress day aggregate unchanged", () => {
        const t0 = Math.floor(1_700_000_000_000 / MS_PER_DAY) * MS_PER_DAY;
        const bars: Bar[] = [
            makeBarAt(t0, 110, 100, 105, 0),
            // NaN high/low: should not corrupt the day aggregate.
            {
                ...makeBarAt(t0 + 60_000, 0, 0, 0, 1),
                high: Number.NaN,
                low: Number.NaN,
                close: Number.NaN,
            },
            makeBarAt(t0 + MS_PER_DAY, 120, 110, 115, 2),
        ];
        const out = harness(bars, bars.length + 1, () => {
            const p = pivotsStandard("slot", { system: "classic" });
            return p.pp.current;
        });
        // PrevDay's high stays at 110, low at 100 → pp = (110 + 100 + 105) / 3.
        const expectedPp = (110 + 100 + 105) / 3;
        expect(out[2]).toBeCloseTo(expectedPp, 10);
    });

    it("returns the same PivotsStandardResult identity on every call", () => {
        const bars = syntheticBars(50, 7);
        const ids = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            ids.add(pivotsStandard("slot"));
            return null;
        });
        expect(ids.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => pivotsStandard("oops")).toThrowError(
            /ta.pivotsStandard called outside an active script step/,
        );
    });
});

describe("ta.pivotsStandard tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const t0 = Math.floor(1_700_000_000_000 / MS_PER_DAY) * MS_PER_DAY;
        const bars: Bar[] = [
            makeBarAt(t0, 110, 100, 105, 0),
            makeBarAt(t0 + MS_PER_DAY, 120, 110, 115, 1),
        ];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => pivotsStandard("slot"));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const last = bars[bars.length - 1];
        tick(ctxRef, { ...last, close: last.close + 50 }, () => pivotsStandard("slot"));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });

    it("ticking the last closed bar's own values reproduces the close output", () => {
        const t0 = Math.floor(1_700_000_000_000 / MS_PER_DAY) * MS_PER_DAY;
        const bars: Bar[] = [
            makeBarAt(t0, 110, 100, 105, 0),
            makeBarAt(t0 + MS_PER_DAY, 120, 110, 115, 1),
            makeBarAt(t0 + MS_PER_DAY + 60_000, 121, 111, 116, 2),
        ];
        const closedOut = harness(bars, bars.length + 1, () => {
            const p = pivotsStandard("slot");
            return { pp: p.pp.current, r1: p.r1.current };
        });
        const lastClosed = closedOut[closedOut.length - 1];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => pivotsStandard("slot"));
        const last = bars[bars.length - 1];
        const tickHead = tick(ctxRef, last, () => {
            const p = pivotsStandard("slot");
            return { pp: p.pp.current, r1: p.r1.current };
        });
        expect(tickHead.pp).toBeCloseTo(lastClosed.pp, 10);
        expect(tickHead.r1).toBeCloseTo(lastClosed.r1, 10);
    });

    it("tick on the seed bar returns NaN at all outputs", () => {
        const t0 = Math.floor(1_700_000_000_000 / MS_PER_DAY) * MS_PER_DAY;
        const bars: Bar[] = [makeBarAt(t0, 110, 100, 105, 0)];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, () => pivotsStandard("slot"));
        const head = tick(ctxRef, bars[0], () => {
            const p = pivotsStandard("slot");
            return { pp: p.pp.current, r1: p.r1.current };
        });
        expect(Number.isNaN(head.pp)).toBe(true);
        expect(Number.isNaN(head.r1)).toBe(true);
    });
});
