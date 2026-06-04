// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { alert, hline, plot, ta } from "./primitives";
import { TA_REGISTRY } from "./ta";

describe("primitives — ta seam (Task 7 wired)", () => {
    it("`ta` re-exports TA_REGISTRY by identity", () => {
        expect(ta).toBe(TA_REGISTRY);
    });

    it("exposes the 9 Phase-1 stateful primitives", () => {
        for (const name of [
            "sma",
            "ema",
            "stdev",
            "bb",
            "rsi",
            "macd",
            "atr",
            "crossover",
            "crossunder",
        ] as const) {
            expect(typeof (ta as unknown as Record<string, unknown>)[name]).toBe("function");
        }
    });
});

describe("primitives — emit re-exports (Task 8 seam)", () => {
    it("plot is a function", () => {
        expect(typeof plot).toBe("function");
    });

    it("hline is a function", () => {
        expect(typeof hline).toBe("function");
    });

    it("alert is a function", () => {
        expect(typeof alert).toBe("function");
    });

    it("plot throws the sentinel when called outside an active script step", () => {
        expect(() => plot(0)).toThrow("plot called outside an active script step");
    });

    it("hline throws the sentinel when called outside an active script step", () => {
        expect(() => hline(70)).toThrow("hline called outside an active script step");
    });

    it("alert throws the sentinel when called outside an active script step", () => {
        expect(() => alert("hi")).toThrow("alert called outside an active script step");
    });
});
