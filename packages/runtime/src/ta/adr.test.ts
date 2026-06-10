// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { adr } from "./adr.js";
import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";

const MS_PER_DAY = 86_400_000;
// UTC midnight (2023-11-14T00:00:00Z). Aligned to the day boundary so
// `Math.floor(BASE / MS_PER_DAY)` returns a whole-day key and adding
// `hourOffset * 3_600_000` stays on the same day.
const BASE = 1_699_920_000_000;

function dailyBar(dayOffset: number, hourOffset: number, high: number, low: number): Bar {
    const time = BASE + dayOffset * MS_PER_DAY + hourOffset * 3_600_000;
    return {
        time,
        open: low,
        high,
        low,
        close: low,
        volume: 0,
        symbol: "T",
        interval: "1h",
    };
}

describe("ta.adr", () => {
    it("emits NaN until `length` completed daily bars have been folded in", () => {
        // 14 daily bars; ranges [1..14]. ADR(14) is NaN until day 15
        // (because the in-progress day is never included in the average).
        const bars: Bar[] = [];
        for (let i = 0; i < 14; i += 1) {
            bars.push(dailyBar(i, 0, 100 + (i + 1), 100));
        }
        const out = harness(bars, bars.length + 1, () => adr("slot", { length: 14 }).current);
        for (let i = 0; i < 14; i += 1) expect(Number.isNaN(out[i])).toBe(true);
    });

    it("returns the mean of completed daily ranges once warm", () => {
        // 15 daily bars at one bar/day. Ranges: bar[i].high - bar[i].low.
        // ADR at bar 15 should average the first 14 completed days
        // (bars 0..13); bar 14 is the in-progress day.
        const bars: Bar[] = [];
        for (let i = 0; i < 15; i += 1) {
            bars.push(dailyBar(i, 0, 100 + (i + 1), 100));
        }
        const out = harness(bars, bars.length + 1, () => adr("slot", { length: 14 }).current);
        // After bar 14, 14 days have committed (days 0..13 with ranges
        // 1..14); ADR = (1 + 2 + ... + 14) / 14 = 105 / 14 = 7.5.
        expect(out[14]).toBeCloseTo(7.5, 10);
    });

    it("aggregates multiple bars within the same UTC calendar day", () => {
        // Two bars per day, 14 days. Day k has bars at h=0 with
        // high=100+k, low=100, and h=12 with high=100+k+5, low=99.
        // Daily range = (100 + k + 5) - 99 = k + 6.
        const bars: Bar[] = [];
        for (let day = 0; day < 14; day += 1) {
            bars.push(dailyBar(day, 0, 100 + day, 100));
            bars.push(dailyBar(day, 12, 100 + day + 5, 99));
        }
        // Add one bar on day 14 to trigger the commit of day 13.
        bars.push(dailyBar(14, 0, 150, 100));
        const out = harness(bars, bars.length + 1, () => adr("slot", { length: 14 }).current);
        // Final close: 14 completed days, ranges [6, 7, 8, ..., 19].
        // Sum = 14 * (6 + 19) / 2 = 14 * 12.5 = 175. ADR = 175 / 14 = 12.5.
        const finalAdr = out[out.length - 1];
        expect(finalAdr).toBeCloseTo(12.5, 10);
    });

    it("defaults to length=14 when opts is omitted", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 14; i += 1) {
            bars.push(dailyBar(i, 0, 110, 100));
        }
        const out = harness(bars, bars.length + 1, () => adr("slot").current);
        for (let i = 0; i < 14; i += 1) expect(Number.isNaN(out[i])).toBe(true);
        // One more bar to trigger commit + warm:
        bars.push(dailyBar(14, 0, 110, 100));
        const out2 = harness(bars, bars.length + 1, () => adr("slot").current);
        // Each daily range = 10; ADR = 10.
        expect(out2[14]).toBeCloseTo(10, 10);
    });

    it("returns the same Series identity on every call", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 5; i += 1) {
            bars.push(dailyBar(i, 0, 110, 100));
        }
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, () => {
            const s = adr("slot", { length: 3 });
            identities.add(s);
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => adr("oops")).toThrowError(/ta.adr called outside an active script step/);
    });

    it("skips NaN bars from the daily aggregation", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 4; i += 1) {
            bars.push(dailyBar(i, 0, 110, 100));
        }
        // Inject a NaN-high bar mid-day on day 4 — it should NOT corrupt
        // the day's aggregate or commit a NaN range.
        bars.push({
            ...dailyBar(4, 0, 110, 100),
            high: Number.NaN,
        });
        bars.push(dailyBar(4, 12, 115, 100));
        // Trigger commit of day 4:
        bars.push(dailyBar(5, 0, 110, 100));
        const out = harness(bars, bars.length + 1, () => adr("slot", { length: 3 }).current);
        // After day 5 starts (bar index 6), 3 days committed: days
        // 1..3 with ranges 10, 10, 10 → wait, ring length=3 → days
        // 2,3,4 → 10, 10, 15. ADR = 35/3 ≈ 11.667.
        // (NaN high on day 4 was skipped, but the h=12 bar on day 4
        // (high=115, low=100) folded in normally → day 4 range = 15.)
        expect(out[out.length - 1]).toBeCloseTo(35 / 3, 10);
    });

    it("non-finite time is skipped (no commit, no aggregation update)", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 3; i += 1) {
            bars.push(dailyBar(i, 0, 110, 100));
        }
        // Bar with NaN time:
        bars.push({ ...dailyBar(3, 0, 110, 100), time: Number.NaN });
        // Day-4 bar: commits day 2 (the last finite day) — wait, by then
        // we've folded 3 days (0, 1, 2). Day 3 NaN-time bar is skipped.
        // Day-4 bar commits day 2 — actually the third real day
        // committed is day 1 (when day 2 starts), and day 2 when day 4
        // (day_key=4) starts, committing day 2's high/low.
        bars.push(dailyBar(4, 0, 110, 100));
        const out = harness(bars, bars.length + 1, () => adr("slot", { length: 2 }).current);
        // After bar 4 (the final), days committed: day 0 (committed
        // when day 1 started), day 1 (committed when day 2 started),
        // day 2 (committed when day 4 started — NaN-time bar didn't
        // change currentDayKey). Ring length=2 → days 1, 2 with ranges
        // 10, 10. ADR = 10.
        expect(out[out.length - 1]).toBeCloseTo(10, 10);
    });
});

describe("ta.adr tick-mode", () => {
    it("tick does not commit a new day — emits the cached SMA", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 15; i += 1) {
            bars.push(dailyBar(i, 0, 100 + (i + 1), 100));
        }
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => adr("slot", { length: 14 }));
        const closeHead = adrHead(ctxRef);
        // A tick — even at a NEXT-day timestamp — should not advance
        // the day boundary or commit a range. The runtime guarantees
        // ticks happen inside the in-progress bar; the calendar-day
        // boundary derived from `bar.time` reflects the close-side
        // state of the last close. So the emitted value remains the
        // cached SMA.
        const tickHead = tick(
            ctxRef,
            bars[bars.length - 1],
            () => adr("slot", { length: 14 }).current,
        );
        expect(tickHead).toBeCloseTo(closeHead, 10);
    });

    it("two identical ticks produce the same head", () => {
        const bars: Bar[] = [];
        for (let i = 0; i < 16; i += 1) {
            bars.push(dailyBar(i, 0, 100 + (i + 1), 100));
        }
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => adr("slot", { length: 14 }));
        const a = tick(ctxRef, bars[bars.length - 1], () => adr("slot", { length: 14 }).current);
        const b = tick(ctxRef, bars[bars.length - 1], () => adr("slot", { length: 14 }).current);
        expect(b).toBe(a);
    });

    it("tick during warmup returns NaN", () => {
        const bars: Bar[] = [dailyBar(0, 0, 110, 100), dailyBar(1, 0, 110, 100)];
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, () => adr("slot", { length: 14 }));
        const head = tick(ctxRef, bars[1], () => adr("slot", { length: 14 }).current);
        expect(Number.isNaN(head)).toBe(true);
    });
});

function adrHead(ctxRef: { ctx: { stream: { taSlots: Map<string, unknown> } } }): number {
    // Probe the last appended value without driving another close.
    const slot = ctxRef.ctx.stream.taSlots.get("slot") as
        | { outBuffer: { at: (n: number) => number } }
        | undefined;
    return slot ? slot.outBuffer.at(0) : Number.NaN;
}
