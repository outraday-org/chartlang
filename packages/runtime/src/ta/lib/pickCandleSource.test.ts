// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { pickCandleSource } from "./pickCandleSource.js";

const SAMPLE: Bar = {
    time: 0,
    open: 10,
    high: 14,
    low: 8,
    close: 12,
    volume: 0,
    symbol: "T",
    interval: "1m",
};

describe("pickCandleSource", () => {
    it("returns the raw OHLC fields verbatim", () => {
        expect(pickCandleSource(SAMPLE, "open")).toBe(10);
        expect(pickCandleSource(SAMPLE, "high")).toBe(14);
        expect(pickCandleSource(SAMPLE, "low")).toBe(8);
        expect(pickCandleSource(SAMPLE, "close")).toBe(12);
    });

    it("computes hl2 as (high + low) / 2", () => {
        expect(pickCandleSource(SAMPLE, "hl2")).toBe(11);
    });

    it("computes hlc3 as (high + low + close) / 3", () => {
        expect(pickCandleSource(SAMPLE, "hlc3")).toBeCloseTo(34 / 3, 12);
    });

    it("computes ohlc4 as (open + high + low + close) / 4", () => {
        expect(pickCandleSource(SAMPLE, "ohlc4")).toBe(11);
    });

    it("computes hlcc4 as (high + low + close + close) / 4", () => {
        expect(pickCandleSource(SAMPLE, "hlcc4")).toBe(11.5);
    });
});
