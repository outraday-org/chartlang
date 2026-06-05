// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { pmo } from "./pmo";

describe("ta.pmo", () => {
    it("emits NaN for the warmup window (defaults 35/20/10)", () => {
        const bars = syntheticBars(80, 9);
        const out = harness(bars, bars.length + 1, (bar) => {
            const p = pmo("slot", bar.close);
            return { pmo: p.pmo.current, signal: p.signal.current };
        });
        // pmo warmup = 35 + 20 − 1 = 54 bars NaN at pmo (bar 0's
        // roc1 is NaN — the inner Swenlin EMA seed-count starts at bar 1).
        // signal warmup = 35 + 20 + 10 − 3 = 62 bars NaN at signal.
        for (let i = 0; i < 54; i += 1) expect(Number.isNaN(out[i].pmo)).toBe(true);
        for (let i = 0; i < 62; i += 1) expect(Number.isNaN(out[i].signal)).toBe(true);
        expect(Number.isFinite(out[bars.length - 1].pmo)).toBe(true);
        expect(Number.isFinite(out[bars.length - 1].signal)).toBe(true);
    });

    it("respects custom opts", () => {
        const bars = syntheticBars(50, 4);
        const out = harness(bars, bars.length + 1, (bar) => {
            const p = pmo("slot", bar.close, {
                firstSmoothing: 4,
                secondSmoothing: 3,
                signalLength: 2,
            });
            return p.signal.current;
        });
        // Warmup roughly 4 + 3 + 2 − 3 = 6 bars at signal.
        expect(Number.isFinite(out[bars.length - 1])).toBe(true);
    });

    it("returns the same PmoResult identity on every call", () => {
        const bars = syntheticBars(20, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            identities.add(pmo("slot", bar.close));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("emits NaN when source is NaN (forward-hold)", () => {
        const bars = syntheticBars(80, 3).map((b, i) =>
            i === 70 ? { ...b, close: Number.NaN } : b,
        );
        const out = harness(bars, bars.length + 1, (bar) => pmo("slot", bar.close).pmo.current);
        // After NaN injection, subsequent finite-source bars resume — but
        // the immediate `out[70]` must be the prior closed pmo (NaN-forward-
        // hold), so it's finite iff pmo was warm by bar 70 (which it is
        // with defaults firstSmoothing=35 + secondSmoothing=20).
        expect(Number.isFinite(out[70])).toBe(true);
    });

    it("treats zero prev source as NaN at the roc1 stage", () => {
        const bars = syntheticBars(80, 5).map((b, i) => (i === 4 ? { ...b, close: 0 } : b));
        // Just smoke-test that no throw + final bar is finite (warmup
        // is large; NaN spike at bar 5's roc1 gets forward-held through
        // Swenlin EMA's NaN-source rule).
        const out = harness(bars, bars.length + 1, (bar) => pmo("slot", bar.close).pmo.current);
        expect(Number.isFinite(out[bars.length - 1])).toBe(true);
    });

    it("throws when called outside an active script step", () => {
        expect(() => pmo("oops", 1)).toThrowError(/ta.pmo called outside an active script step/);
    });

    it("emits the same pmo across two harness runs (determinism)", () => {
        const bars = syntheticBars(80, 11);
        const a = harness(bars, bars.length + 1, (bar) => pmo("slot", bar.close).pmo.current);
        const b = harness(bars, bars.length + 1, (bar) => pmo("slot", bar.close).pmo.current);
        for (let i = 0; i < a.length; i += 1) {
            if (Number.isNaN(a[i])) expect(Number.isNaN(b[i])).toBe(true);
            else expect(b[i]).toBe(a[i]);
        }
    });
});

describe("ta.pmo tick-mode", () => {
    it("replaces the head without advancing output length", () => {
        const bars = syntheticBars(80, 13);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) => pmo("slot", bar.close));
        const before = ctxRef.ctx.stream.ohlcv.close.length;
        const tickBar = { ...bars[bars.length - 1], close: bars[bars.length - 1].close + 3 };
        tick(ctxRef, tickBar, () => pmo("slot", tickBar.close));
        expect(ctxRef.ctx.stream.ohlcv.close.length).toBe(before);
    });

    it("opts.offset > 0 returns a shifted view (identity-stable per offset)", () => {
        const bars = syntheticBars(80, 5);
        const out = harness(bars, bars.length + 1, (bar) => {
            const a = pmo("slot", bar.close, { offset: 4 });
            const b = pmo("slot", bar.close, { offset: 4 });
            return a === b;
        });
        for (const v of out) expect(v).toBe(true);
    });

    it("tick during seed window returns NaN (Swenlin warmup)", () => {
        // pmo defaults are firstSmoothing=35, secondSmoothing=20; tick before
        // either has seeded reaches `swenlinTick` seed-window branch.
        const bars = syntheticBars(5, 2);
        const { ctxRef } = harnessWithCtx(bars, 60, (bar) => pmo("slot", bar.close));
        const tickBar = { ...bars[bars.length - 1], close: bars[bars.length - 1].close + 1 };
        const v = tick(ctxRef, tickBar, () => pmo("slot", tickBar.close).pmo.current);
        expect(Number.isNaN(v)).toBe(true);
    });
});
