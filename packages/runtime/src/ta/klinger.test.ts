// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { klinger } from "./klinger.js";

describe("ta.klinger", () => {
    it("seeds Klinger and signal from the first zero-VF bar", () => {
        const bars = syntheticBars(80, 5);
        const out = harness(bars, bars.length + 1, (bar) => {
            const k = klinger("slot");
            return { klinger: k.klinger.current, signal: k.signal.current };
        });
        expect(out[0]).toEqual({ klinger: 0, signal: 0 });
        expect(
            out.every(
                ({ klinger: line, signal }) => Number.isFinite(line) && Number.isFinite(signal),
            ),
        ).toBe(true);
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
        // With volume=0 every bar, vf and both seeded EMAs stay at zero.
        for (let i = 0; i < bars.length; i += 1) {
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
        expect(out.every(Number.isFinite)).toBe(true);
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
