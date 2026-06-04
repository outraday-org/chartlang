// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { ta } from "./ta";

describe("ta callable holes", () => {
    it("ta.sma throws outside-runtime sentinel", () => {
        expect(() => ta.sma({ current: 0, length: 0 }, 1)).toThrow(
            "ta.sma called outside compiled runtime",
        );
    });

    it("ta.ema throws outside-runtime sentinel", () => {
        expect(() => ta.ema({ current: 0, length: 0 }, 1)).toThrow(
            "ta.ema called outside compiled runtime",
        );
    });

    it("ta.stdev throws outside-runtime sentinel", () => {
        expect(() => ta.stdev({ current: 0, length: 0 }, 1)).toThrow(
            "ta.stdev called outside compiled runtime",
        );
    });

    it("ta.bb throws outside-runtime sentinel", () => {
        expect(() => ta.bb({ current: 0, length: 0 }, 1)).toThrow(
            "ta.bb called outside compiled runtime",
        );
    });

    it("ta.rsi throws outside-runtime sentinel", () => {
        expect(() => ta.rsi({ current: 0, length: 0 }, 1)).toThrow(
            "ta.rsi called outside compiled runtime",
        );
    });

    it("ta.macd throws outside-runtime sentinel", () => {
        expect(() => ta.macd({ current: 0, length: 0 })).toThrow(
            "ta.macd called outside compiled runtime",
        );
    });

    it("ta.atr throws outside-runtime sentinel", () => {
        expect(() => ta.atr(14)).toThrow("ta.atr called outside compiled runtime");
    });

    it("ta.crossover throws outside-runtime sentinel", () => {
        expect(() => ta.crossover({ current: 0, length: 0 }, 0)).toThrow(
            "ta.crossover called outside compiled runtime",
        );
    });

    it("ta.crossunder throws outside-runtime sentinel", () => {
        expect(() => ta.crossunder({ current: 0, length: 0 }, 0)).toThrow(
            "ta.crossunder called outside compiled runtime",
        );
    });

    it("ta is frozen", () => {
        expect(Object.isFrozen(ta)).toBe(true);
    });
});
