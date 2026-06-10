// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import {
    advanceDirectionalClose,
    type DirectionalState,
    initDirectionalState,
    tickDirectional,
} from "./directionalState.js";

describe("initDirectionalState", () => {
    it("allocates a zero-/NaN-initialised record with the requested length", () => {
        const s = initDirectionalState(14);
        expect(s.length).toBe(14);
        expect(s.barCount).toBe(0);
        expect(s.seedPlusDm).toBe(0);
        expect(s.seedMinusDm).toBe(0);
        expect(s.seedTr).toBe(0);
        for (const v of [
            s.prevHigh,
            s.prevLow,
            s.prevClose,
            s.prevPrevHigh,
            s.prevPrevLow,
            s.prevPrevClose,
            s.smoothedPlusDm,
            s.smoothedMinusDm,
            s.smoothedTr,
            s.prevClosedSmoothedPlusDm,
            s.prevClosedSmoothedMinusDm,
            s.prevClosedSmoothedTr,
            s.plusDi,
            s.minusDi,
        ]) {
            expect(Number.isNaN(v)).toBe(true);
        }
    });
});

describe("advanceDirectionalClose", () => {
    it("seeds prev-* snapshots on the first bar and emits NaN DI", () => {
        const s = initDirectionalState(3);
        const out = advanceDirectionalClose(s, 10, 8, 9);
        expect(Number.isNaN(out.plusDi)).toBe(true);
        expect(Number.isNaN(out.minusDi)).toBe(true);
        expect(s.barCount).toBe(1);
        expect(s.prevHigh).toBe(10);
        expect(s.prevLow).toBe(8);
        expect(s.prevClose).toBe(9);
        expect(s.seedTr).toBe(2);
    });

    it("accumulates seed window inside [2, length] without emitting DI", () => {
        const s = initDirectionalState(3);
        advanceDirectionalClose(s, 10, 8, 9);
        const out = advanceDirectionalClose(s, 11, 9, 10);
        expect(Number.isNaN(out.plusDi)).toBe(true);
        expect(Number.isNaN(out.minusDi)).toBe(true);
        expect(s.barCount).toBe(2);
        expect(s.seedPlusDm).toBeGreaterThan(0);
    });

    it("completes the seed at barCount === length + 1 and emits first DI pair", () => {
        const s = initDirectionalState(3);
        advanceDirectionalClose(s, 10, 8, 9);
        advanceDirectionalClose(s, 11, 9, 10);
        advanceDirectionalClose(s, 12, 10, 11);
        const out = advanceDirectionalClose(s, 13, 11, 12);
        expect(Number.isFinite(out.plusDi)).toBe(true);
        expect(Number.isFinite(out.minusDi)).toBe(true);
        expect(s.barCount).toBe(4);
        expect(Number.isFinite(s.smoothedPlusDm)).toBe(true);
        expect(Number.isFinite(s.smoothedTr)).toBe(true);
    });

    it("smooths post-seed via Wilder recurrence (Math.fround-stable arithmetic)", () => {
        const s = initDirectionalState(3);
        for (const c of [
            [10, 8, 9],
            [11, 9, 10],
            [12, 10, 11],
            [13, 11, 12],
        ]) {
            advanceDirectionalClose(s, c[0], c[1], c[2]);
        }
        const before = s.smoothedTr;
        const out = advanceDirectionalClose(s, 14, 12, 13);
        expect(s.barCount).toBe(5);
        expect(s.smoothedTr).not.toBe(before);
        expect(Number.isFinite(out.plusDi)).toBe(true);
        expect(Number.isFinite(out.minusDi)).toBe(true);
        expect(s.prevClosedSmoothedTr).toBe(before);
    });

    it("returns 0 DI when the smoothed TR completes at 0 (flat seed window)", () => {
        const s = initDirectionalState(2);
        advanceDirectionalClose(s, 5, 5, 5);
        advanceDirectionalClose(s, 5, 5, 5);
        const out = advanceDirectionalClose(s, 5, 5, 5);
        expect(out.plusDi).toBe(0);
        expect(out.minusDi).toBe(0);
    });

    it("falls back to 0 DI when post-seed smoothed TR collapses to 0", () => {
        const s = initDirectionalState(2);
        advanceDirectionalClose(s, 5, 5, 5);
        advanceDirectionalClose(s, 5, 5, 5);
        advanceDirectionalClose(s, 5, 5, 5);
        const out = advanceDirectionalClose(s, 5, 5, 5);
        expect(out.plusDi).toBe(0);
        expect(out.minusDi).toBe(0);
    });

    it("holds prior DI forward on a NaN input bar without advancing barCount", () => {
        const s = initDirectionalState(3);
        advanceDirectionalClose(s, 10, 8, 9);
        advanceDirectionalClose(s, 11, 9, 10);
        advanceDirectionalClose(s, 12, 10, 11);
        advanceDirectionalClose(s, 13, 11, 12);
        const priorPlus = s.plusDi;
        const priorMinus = s.minusDi;
        const priorBars = s.barCount;
        const out = advanceDirectionalClose(s, Number.NaN, 12, 13);
        expect(out.plusDi).toBe(priorPlus);
        expect(out.minusDi).toBe(priorMinus);
        expect(s.barCount).toBe(priorBars);
    });

    it("uses high - low as TR on a NaN-prevClose bar via the defensive fallback", () => {
        // The branch is c8-ignored — exercise it for completeness.
        const s: DirectionalState = {
            length: 3,
            barCount: 4,
            prevHigh: 12,
            prevLow: 10,
            prevClose: Number.NaN,
            prevPrevHigh: 11,
            prevPrevLow: 9,
            prevPrevClose: 10,
            seedPlusDm: 1,
            seedMinusDm: 1,
            seedTr: 6,
            smoothedPlusDm: 1,
            smoothedMinusDm: 1,
            smoothedTr: 6,
            prevClosedSmoothedPlusDm: 1,
            prevClosedSmoothedMinusDm: 1,
            prevClosedSmoothedTr: 6,
            plusDi: 16.6,
            minusDi: 16.6,
        };
        const out = advanceDirectionalClose(s, 13, 11, 12);
        expect(Number.isFinite(out.plusDi)).toBe(true);
        expect(Number.isFinite(out.minusDi)).toBe(true);
    });
});

describe("tickDirectional", () => {
    it("returns NaN before the seed window completes", () => {
        const s = initDirectionalState(3);
        advanceDirectionalClose(s, 10, 8, 9);
        advanceDirectionalClose(s, 11, 9, 10);
        const out = tickDirectional(s, 12, 10, 11);
        expect(Number.isNaN(out.plusDi)).toBe(true);
        expect(Number.isNaN(out.minusDi)).toBe(true);
    });

    it("holds prior DI forward when fed a NaN tick after the seed", () => {
        const s = initDirectionalState(3);
        for (const c of [
            [10, 8, 9],
            [11, 9, 10],
            [12, 10, 11],
            [13, 11, 12],
            [14, 12, 13],
        ]) {
            advanceDirectionalClose(s, c[0], c[1], c[2]);
        }
        const out = tickDirectional(s, Number.NaN, 13, 14);
        expect(out.plusDi).toBe(s.plusDi);
        expect(out.minusDi).toBe(s.minusDi);
    });

    it("replays against the seed-completion snapshot when barCount === length + 1", () => {
        const s = initDirectionalState(3);
        advanceDirectionalClose(s, 10, 8, 9);
        advanceDirectionalClose(s, 11, 9, 10);
        advanceDirectionalClose(s, 12, 10, 11);
        advanceDirectionalClose(s, 13, 11, 12);
        // barCount === 4 === length + 1; tick should substitute the
        // bar-4 contribution onto the seed snapshot.
        const out = tickDirectional(s, 13.5, 11.5, 12.5);
        expect(Number.isFinite(out.plusDi)).toBe(true);
        expect(Number.isFinite(out.minusDi)).toBe(true);
    });

    it("Wilder-smooths against the prior-closed snapshot in the post-seed path", () => {
        const s = initDirectionalState(3);
        for (const c of [
            [10, 8, 9],
            [11, 9, 10],
            [12, 10, 11],
            [13, 11, 12],
            [14, 12, 13],
        ]) {
            advanceDirectionalClose(s, c[0], c[1], c[2]);
        }
        const replay = tickDirectional(s, 14, 12, 13);
        // Re-running tickDirectional with the same input as the most
        // recent close-side advance must reproduce s.plusDi / s.minusDi.
        expect(replay.plusDi).toBeCloseTo(s.plusDi, 10);
        expect(replay.minusDi).toBeCloseTo(s.minusDi, 10);
    });
});
