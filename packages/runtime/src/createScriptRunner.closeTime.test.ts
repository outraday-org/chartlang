// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { defineIndicator } from "@invinite-org/chartlang-core";
import type { Bar, CompiledScriptObject } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { createScriptRunner } from "./createScriptRunner.js";

// 2024-11-27 is a regular NASDAQ session (16:00 America/New_York = 21:00Z);
// 2024-11-29 is the Black Friday half day (13:00 ET = 18:00Z). Both daily bars
// are bucketed on the UTC day boundary, so `start + 1D` lands at midnight UTC —
// the wrong instant, and the reason `Bar.closeTime` exists.
const DAY_MS = 86_400_000;
const REGULAR_START = Date.UTC(2024, 10, 27);
const REGULAR_CLOSE = Date.UTC(2024, 10, 27, 21);
const HALF_DAY_START = Date.UTC(2024, 10, 29);
const HALF_DAY_CLOSE = Date.UTC(2024, 10, 29, 18);

function makeCapabilities(): Capabilities {
    return {
        plots: capabilities.allLines(),
        drawings: new Set(),
        alerts: new Set(),
        alertConditions: false,
        logs: false,
        inputs: new Set(),
        intervals: [
            { value: "1m", label: "1 minute", group: "minute" },
            { value: "1D", label: "1 day", group: "daily" },
        ],
        multiTimeframe: false,
        multiSymbol: false,
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        maxLookback: 10,
        maxTickHz: 10,
    };
}

function dailyBar(time: number, closeTime?: number): Bar {
    const base = {
        time,
        open: 100,
        high: 101,
        low: 99,
        close: 100.5,
        volume: 1_000,
        symbol: "TQQQ",
        interval: "1D",
    };
    return closeTime === undefined ? base : { ...base, closeTime };
}

function minuteBar(time: number): Bar {
    return {
        time,
        open: 100,
        high: 101,
        low: 99,
        close: 100.5,
        volume: 10,
        symbol: "TQQQ",
        interval: "1m",
    };
}

// Records `time_close()`'s lowered call — `time.timeClose(bar.time)` — once per
// step, plus (optionally) the same accessor asked about the PREVIOUS bar start
// and the committed bar count the step saw.
function probe(sink: number[], previous?: number[], committed?: number[]): CompiledScriptObject {
    return defineIndicator({
        name: "close-time-probe",
        apiVersion: 1,
        compute: (ctx) => {
            sink.push(ctx.time.timeClose(ctx.bar.time));
            previous?.push(ctx.time.timeClose(ctx.bar.time - DAY_MS));
            committed?.push(ctx.bar.close.length);
        },
    });
}

describe("createScriptRunner — host-supplied bar close reaches time.timeClose", () => {
    it("returns the real 16:00 ET close for a regular 1D bar", async () => {
        const sink: number[] = [];
        const runner = createScriptRunner({
            compiled: probe(sink),
            capabilities: makeCapabilities(),
        });
        await runner.onBarClose(dailyBar(REGULAR_START, REGULAR_CLOSE));
        await runner.dispose();
        expect(sink).toEqual([REGULAR_CLOSE]);
        expect(sink[0]).not.toBe(REGULAR_START + DAY_MS);
    });

    it("follows an early close on a half day", async () => {
        const sink: number[] = [];
        const runner = createScriptRunner({
            compiled: probe(sink),
            capabilities: makeCapabilities(),
        });
        await runner.onBarClose(dailyBar(HALF_DAY_START, HALF_DAY_CLOSE));
        await runner.dispose();
        expect(sink).toEqual([HALF_DAY_CLOSE]);
    });

    it("keeps the bar start + interval fallback for an ordinary intraday bar", async () => {
        const sink: number[] = [];
        const runner = createScriptRunner({
            compiled: probe(sink),
            capabilities: makeCapabilities(),
        });
        const start = Date.UTC(2024, 10, 27, 15, 30);
        await runner.onBarClose(minuteBar(start));
        await runner.dispose();
        expect(sink).toEqual([start + 60_000]);
    });

    it("keeps the fallback when a 1D host supplies no close fact", async () => {
        const sink: number[] = [];
        const runner = createScriptRunner({
            compiled: probe(sink),
            capabilities: makeCapabilities(),
        });
        await runner.onBarClose(dailyBar(REGULAR_START));
        await runner.dispose();
        expect(sink).toEqual([REGULAR_START + DAY_MS]);
    });

    it("ignores malformed host values instead of reporting them", async () => {
        const sink: number[] = [];
        const runner = createScriptRunner({
            compiled: probe(sink),
            capabilities: makeCapabilities(),
        });
        // Non-finite, then a close at/behind the bar start.
        await runner.onBarClose(dailyBar(REGULAR_START, Number.NaN));
        await runner.onBarClose(dailyBar(REGULAR_START + DAY_MS, REGULAR_START));
        await runner.dispose();
        expect(sink).toEqual([REGULAR_START + DAY_MS, REGULAR_START + 2 * DAY_MS]);
    });

    it("lets a tick revise the same bar's close without committing a second bar", async () => {
        const sink: number[] = [];
        const committed: number[] = [];
        const runner = createScriptRunner({
            compiled: probe(sink, undefined, committed),
            capabilities: makeCapabilities(),
        });
        await runner.onBarClose(dailyBar(REGULAR_START, REGULAR_CLOSE));
        // The venue turned out to be on a shortened schedule: the still-forming
        // bar is restated with an earlier close.
        const revised = Date.UTC(2024, 10, 27, 18);
        await runner.onBarTick(dailyBar(REGULAR_START, revised));
        await runner.dispose();

        expect(sink).toEqual([REGULAR_CLOSE, revised]);
        // The tick replaced the head rather than appending: the OHLCV history
        // the script sees is still one bar deep, and `bar.time` never moved.
        expect(committed).toEqual([1, 1]);
    });

    it("falls back for a historical timestamp even while the head bar carries a close", async () => {
        const sink: number[] = [];
        const previous: number[] = [];
        const runner = createScriptRunner({
            compiled: probe(sink, previous),
            capabilities: makeCapabilities(),
        });
        await runner.onBarClose(dailyBar(REGULAR_START, REGULAR_CLOSE));
        await runner.dispose();
        expect(sink).toEqual([REGULAR_CLOSE]);
        // `bar.time - 1D` is not the current bar, so the interval fallback wins.
        expect(previous).toEqual([REGULAR_START]);
    });
});
