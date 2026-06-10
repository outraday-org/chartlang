// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { rvgi } from "./rvgi.js";

describe("ta.rvgi", () => {
    it("emits NaN through warmup (defaults length=10)", () => {
        const bars = syntheticBars(40, 5);
        const out = harness(bars, bars.length + 1, (bar) => {
            const r = rvgi("slot");
            return { rvgi: r.rvgi.current, signal: r.signal.current };
        });
        // numerator/denominator defined at bar 3 (4-bar window); SMA needs
        // another 9 bars; rvgi first defined at bar 12; signal at bar 15.
        for (let i = 0; i < 12; i += 1) expect(Number.isNaN(out[i].rvgi)).toBe(true);
        for (let i = 0; i < 15; i += 1) expect(Number.isNaN(out[i].signal)).toBe(true);
        expect(Number.isFinite(out[bars.length - 1].rvgi)).toBe(true);
        expect(Number.isFinite(out[bars.length - 1].signal)).toBe(true);
    });

    it("flat-range bars produce NaN at rvgi", () => {
        const bars = Array.from({ length: 30 }, (_, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: 100,
            high: 100,
            low: 100,
            close: 100,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(bars, bars.length + 1, (bar) => rvgi("slot").rvgi.current);
        // co = close - open = 0, hl = high - low = 0 → denominator = 0 →
        // denSma = 0 → rvgi NaN.
        for (let i = 13; i < bars.length; i += 1) {
            expect(Number.isNaN(out[i])).toBe(true);
        }
    });

    it("returns the same RvgiResult identity on every call", () => {
        const bars = syntheticBars(40, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            identities.add(rvgi("slot"));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => rvgi("oops")).toThrowError(/ta.rvgi called outside an active script step/);
    });

    it("custom opts override defaults", () => {
        const bars = syntheticBars(40, 7);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => rvgi("slot", { length: 5 }).rvgi.current,
        );
        // Warmup `5 + 3 - 1 = 7` (numerator at bar 3 + 4 SMA bars).
        expect(Number.isFinite(out[out.length - 1])).toBe(true);
    });
});

describe("ta.rvgi tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(30, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) => rvgi("slot"));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickBar = { ...bars[bars.length - 1], close: bars[bars.length - 1].close + 5 };
        tick(ctxRef, tickBar, () => rvgi("slot"));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });
});
