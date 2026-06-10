// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
    advanceDirectionalClose,
    initDirectionalState,
    tickDirectional,
} from "./directionalState.js";

const arbOhlcSeries = fc
    .integer({ min: 5, max: 25 })
    .chain((n) =>
        fc.tuple(
            fc.constant(n),
            fc.array(
                fc.tuple(
                    fc.double({ min: 10, max: 1000, noNaN: true }),
                    fc.double({ min: 1, max: 100, noNaN: true }),
                    fc.double({ min: 0.1, max: 5, noNaN: true }),
                ),
                { minLength: n, maxLength: n },
            ),
        ),
    );

type Bar = { high: number; low: number; close: number };

function build(tuples: ReadonlyArray<readonly [number, number, number]>): Bar[] {
    return tuples.map(([base, drift, spread]) => {
        const close = base + drift;
        return {
            high: Math.max(base, close) + spread,
            low: Math.min(base, close) - spread,
            close,
        };
    });
}

describe("directionalState — property invariants", () => {
    it("tickDirectional replay matches close-side advance at the same input", () => {
        fc.assert(
            fc.property(arbOhlcSeries, ([_n, tuples]) => {
                const bars = build(tuples);
                if (bars.length < 5) return;
                const length = 3;
                const s = initDirectionalState(length);
                for (let i = 0; i < bars.length - 1; i += 1) {
                    advanceDirectionalClose(s, bars[i].high, bars[i].low, bars[i].close);
                }
                const last = bars[bars.length - 1];
                advanceDirectionalClose(s, last.high, last.low, last.close);
                const closePlus = s.plusDi;
                const closeMinus = s.minusDi;
                const tick = tickDirectional(s, last.high, last.low, last.close);
                if (Number.isFinite(closePlus)) {
                    expect(tick.plusDi).toBeCloseTo(closePlus, 8);
                    expect(tick.minusDi).toBeCloseTo(closeMinus, 8);
                }
            }),
        );
    });

    it("close-side DI values stay in [0, 100] once defined", () => {
        fc.assert(
            fc.property(arbOhlcSeries, ([_n, tuples]) => {
                const bars = build(tuples);
                const length = 3;
                const s = initDirectionalState(length);
                for (const b of bars) {
                    const out = advanceDirectionalClose(s, b.high, b.low, b.close);
                    if (Number.isFinite(out.plusDi)) {
                        expect(out.plusDi).toBeGreaterThanOrEqual(0);
                        expect(out.plusDi).toBeLessThanOrEqual(100);
                        expect(out.minusDi).toBeGreaterThanOrEqual(0);
                        expect(out.minusDi).toBeLessThanOrEqual(100);
                    }
                }
            }),
        );
    });
});
