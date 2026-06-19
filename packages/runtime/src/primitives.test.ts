// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { DRAWING_KINDS, KIND_CAMELCASE } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { alert, draw, hline, plot, ta } from "./primitives.js";
import { TA_REGISTRY } from "./ta/index.js";

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

describe("primitives — draw seam (Phase-3 Tasks 3 + 5 wired)", () => {
    it("exposes the Task-5 line-family methods on the runtime namespace", () => {
        for (const name of [
            "line",
            "horizontalLine",
            "horizontalRay",
            "verticalLine",
            "crossLine",
            "trendAngle",
        ] as const) {
            expect(typeof (draw as unknown as Record<string, unknown>)[name]).toBe("function");
        }
    });

    it("throws the active-step sentinel for shipped line-family methods", () => {
        // Task 5 ships the runtime impl — without an active context the
        // dual-overload throws the runtime sentinel, not core's stub
        // sentinel.
        expect(() => draw.horizontalLine(0)).toThrow(
            "draw.horizontalLine called outside an active script step",
        );
    });

    it("ships a real runtime impl for every DrawingKind (no core stubs after Task 18)", () => {
        // Phase-3 cardinality gate: after Task 18 the runtime
        // `DRAW_NAMESPACE` carries a real impl for every wired
        // `DrawingKind`. Each method must throw the runtime sentinel
        // (`"called outside an active script step"`) when called bare
        // — NOT the core stub sentinel
        // (`"called outside compiled runtime"`).
        expect(DRAWING_KINDS.length).toBe(63);
        for (const kind of DRAWING_KINDS) {
            const camel = KIND_CAMELCASE.get(kind);
            if (camel === undefined) throw new Error(`missing camel mapping for ${kind}`);
            const method = (draw as unknown as Record<string, () => unknown>)[camel];
            expect(typeof method).toBe("function");
            expect(() => method()).toThrow(
                new RegExp(`^draw\\.${camel} called outside an active script step$`),
            );
        }
    });
});
