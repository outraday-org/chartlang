// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { STATEFUL_PRIMITIVES } from "./statefulPrimitives";

const EXPECTED = [
    "ta.sma",
    "ta.ema",
    "ta.stdev",
    "ta.bb",
    "ta.rsi",
    "ta.macd",
    "ta.atr",
    "ta.crossover",
    "ta.crossunder",
    "plot",
    "hline",
    "alert",
] as const;

describe("STATEFUL_PRIMITIVES", () => {
    it("contains exactly 12 entries", () => {
        expect(STATEFUL_PRIMITIVES.size).toBe(12);
    });

    it("contains every Phase-1 stateful primitive name", () => {
        for (const name of EXPECTED) {
            expect(STATEFUL_PRIMITIVES.has(name)).toBe(true);
        }
    });

    it("is frozen", () => {
        expect(Object.isFrozen(STATEFUL_PRIMITIVES)).toBe(true);
    });
});
