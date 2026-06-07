// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { draw } from "./draw";

describe("draw throwing stub", () => {
    it("throws when a top-level draw method is called outside the runtime", () => {
        expect(() => draw.horizontalLine(100)).toThrow(
            "draw.horizontalLine called outside compiled runtime",
        );
    });

    it("throws when draw.line is called outside the runtime", () => {
        expect(() =>
            draw.line({ time: 0, price: 0 }, { time: 1, price: 1 }, { color: "#000" }),
        ).toThrow("draw.line called outside compiled runtime");
    });

    it("throws when draw.text is called outside the runtime", () => {
        expect(() => draw.text({ time: 0, price: 0 }, "hello")).toThrow(
            "draw.text called outside compiled runtime",
        );
    });

    it("throws for a fib-family flat method (draw.fibRetracement)", () => {
        expect(() =>
            draw.fibRetracement({ time: 0, price: 0 }, { time: 1, price: 1 }),
        ).toThrow("draw.fibRetracement called outside compiled runtime");
    });

    it("throws for a gann-family flat method (draw.gannBox)", () => {
        expect(() => draw.gannBox({ time: 0, price: 0 }, { time: 1, price: 1 })).toThrow(
            "draw.gannBox called outside compiled runtime",
        );
    });

    it("throws for an elliott-family flat method (draw.elliottImpulseWave)", () => {
        expect(() =>
            draw.elliottImpulseWave([
                { time: 0, price: 0 },
                { time: 1, price: 1 },
                { time: 2, price: 0.5 },
                { time: 3, price: 1.5 },
                { time: 4, price: 1 },
            ]),
        ).toThrow("draw.elliottImpulseWave called outside compiled runtime");
    });

    it("throws for a pattern-family flat method (draw.abcdPattern)", () => {
        expect(() =>
            draw.abcdPattern([
                { time: 0, price: 0 },
                { time: 1, price: 1 },
                { time: 2, price: 0.5 },
                { time: 3, price: 1.5 },
            ]),
        ).toThrow("draw.abcdPattern called outside compiled runtime");
    });
});
