// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { TA_REGISTRY, ta } from "./registry";

describe("TA_REGISTRY", () => {
    it("ships exactly 9 entries", () => {
        const keys = Object.keys(TA_REGISTRY);
        expect(keys.length).toBe(9);
    });

    it("exposes the 9 Phase-1 primitives by name", () => {
        const expected = [
            "sma",
            "ema",
            "stdev",
            "bb",
            "rsi",
            "macd",
            "atr",
            "crossover",
            "crossunder",
        ];
        for (const name of expected) {
            expect(name in TA_REGISTRY).toBe(true);
            expect(typeof (TA_REGISTRY as unknown as Record<string, unknown>)[name]).toBe(
                "function",
            );
        }
    });

    it("is frozen", () => {
        expect(Object.isFrozen(TA_REGISTRY)).toBe(true);
    });

    it("`ta` equals TA_REGISTRY by identity", () => {
        expect(ta).toBe(TA_REGISTRY);
    });
});
