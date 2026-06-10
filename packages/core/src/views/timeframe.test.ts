// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { timeframe } from "./timeframe.js";

describe("timeframe", () => {
    it("defaults every field to the empty sentinel", () => {
        expect(timeframe.period).toBe("");
        expect(timeframe.isintraday).toBe(false);
        expect(timeframe.isdaily).toBe(false);
        expect(timeframe.isweekly).toBe(false);
        expect(timeframe.ismonthly).toBe(false);
        expect(Number.isNaN(timeframe.inSeconds)).toBe(true);
    });

    it("is frozen", () => {
        expect(Object.isFrozen(timeframe)).toBe(true);
        expect(() => Object.assign(timeframe, { period: "1D" })).toThrow(TypeError);
    });
});
