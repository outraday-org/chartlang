// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { smi } from "./smi";

describe("ta.smi", () => {
    it("emits NaN through the warmup window (defaults 10/3/5/3)", () => {
        const bars = syntheticBars(60, 7);
        const out = harness(bars, bars.length + 1, (bar) => {
            const s = smi("slot");
            return { smi: s.smi.current, signal: s.signal.current };
        });
        // smi warmup ≥ kLength + firstSmoothing + secondSmoothing − 3 =
        // 10 + 3 + 5 − 3 = 15 bars NaN at smi.
        for (let i = 0; i < 15; i += 1) expect(Number.isNaN(out[i].smi)).toBe(true);
        expect(Number.isFinite(out[bars.length - 1].smi)).toBe(true);
        expect(Number.isFinite(out[bars.length - 1].signal)).toBe(true);
    });

    it("smi ∈ [-100, 100] after warmup (small FP epsilon)", () => {
        const bars = syntheticBars(80, 11);
        const out = harness(bars, bars.length + 1, (bar) => {
            const s = smi("slot");
            return { smi: s.smi.current, signal: s.signal.current };
        });
        const EPSILON = 1e-9;
        for (const { smi: v } of out) {
            if (Number.isFinite(v)) {
                expect(v).toBeGreaterThanOrEqual(-100 - EPSILON);
                expect(v).toBeLessThanOrEqual(100 + EPSILON);
            }
        }
    });

    it("returns the same SmiResult identity on every call", () => {
        const bars = syntheticBars(40, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            identities.add(smi("slot"));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("flat-range bars emit NaN at smi (zero denominator)", () => {
        const bars: Bar[] = Array.from({ length: 60 }, (_, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: 100,
            high: 100,
            low: 100,
            close: 100,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(bars, bars.length + 1, (bar) => smi("slot").smi.current);
        // Once smoothed denominator is zero, smi must be NaN.
        for (let i = 30; i < bars.length; i += 1) {
            expect(Number.isNaN(out[i])).toBe(true);
        }
    });

    it("respects custom opts", () => {
        const bars = syntheticBars(50, 4);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) =>
                smi("slot", { kLength: 5, firstSmoothing: 2, secondSmoothing: 2, dLength: 2 })
                    .signal.current,
        );
        // Warmup roughly 5 + 2 + 2 + 2 − 4 = 7.
        expect(Number.isFinite(out[bars.length - 1])).toBe(true);
    });

    it("throws when called outside an active script step", () => {
        expect(() => smi("oops")).toThrowError(/ta.smi called outside an active script step/);
    });
});

describe("ta.smi tick-mode", () => {
    it("replaces the head without advancing length", () => {
        const bars = syntheticBars(50, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) => smi("slot"));
        const before = ctxRef.ctx.stream.ohlcv.close.length;
        const tickBar = { ...bars[bars.length - 1], close: bars[bars.length - 1].close + 2 };
        tick(ctxRef, tickBar, () => smi("slot"));
        expect(ctxRef.ctx.stream.ohlcv.close.length).toBe(before);
    });

    it("opts.offset > 0 returns a shifted view (identity-stable per offset)", () => {
        const bars = syntheticBars(80, 3);
        const out = harness(bars, bars.length + 1, () => {
            const a = smi("slot", { offset: 2 });
            const b = smi("slot", { offset: 2 });
            return a === b;
        });
        for (const v of out) expect(v).toBe(true);
    });
});
