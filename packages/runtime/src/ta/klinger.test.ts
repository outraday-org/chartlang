// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { klinger } from "./klinger.js";

describe("ta.klinger", () => {
    it("emits NaN through warmup (defaults 34, 55, 13)", () => {
        const bars = syntheticBars(80, 5);
        const out = harness(bars, bars.length + 1, (bar) => {
            const k = klinger("slot");
            return { klinger: k.klinger.current, signal: k.signal.current };
        });
        // Conservatively assert NaN for the first 30 bars (fast EMA seeds
        // at bar 33 for default fastLength=34); the signal needs further
        // warmup beyond that.
        for (let i = 0; i < 30; i += 1) expect(Number.isNaN(out[i].signal)).toBe(true);
    });

    it("zero-volume bars produce vf = 0 (no throw, output finite or NaN)", () => {
        const bars = Array.from({ length: 100 }, (_, i) => ({
            time: 1_700_000_000_000 + i * 60_000,
            open: 100 + i,
            high: 101 + i,
            low: 99 + i,
            close: 100 + i,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }));
        const out = harness(bars, bars.length + 1, (bar) => klinger("slot").klinger.current);
        // With volume=0 every bar, vf is always 0 → EMAs converge to 0 →
        // klinger = 0 - 0 = 0 once both EMAs are warmed.
        for (let i = 60; i < bars.length; i += 1) {
            expect(out[i]).toBe(0);
        }
    });

    it("returns the same KlingerResult identity on every call", () => {
        const bars = syntheticBars(80, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            identities.add(klinger("slot"));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => klinger("oops")).toThrowError(
            /ta.klinger called outside an active script step/,
        );
    });

    it("custom opts override defaults", () => {
        const bars = syntheticBars(60, 8);
        const out = harness(bars, bars.length + 1, (bar) => {
            const k = klinger("slot", { fastLength: 5, slowLength: 8, signalLength: 3 });
            return k.signal.current;
        });
        // Warmup `slowLength + signalLength - 2 = 9` → finite at tail.
        expect(Number.isFinite(out[out.length - 1])).toBe(true);
    });
});

describe("ta.klinger tick-mode", () => {
    it("replaces the head without advancing the output length", () => {
        const bars = syntheticBars(80, 2);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) => klinger("slot"));
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const tickBar = { ...bars[bars.length - 1], close: bars[bars.length - 1].close + 5 };
        tick(ctxRef, tickBar, () => klinger("slot"));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        expect(lengthAfter).toBe(lengthBefore);
    });
});
