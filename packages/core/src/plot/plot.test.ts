// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { hline, plot } from "./plot.js";
import type { PlotKind, PlotOptsStyle } from "./plot.js";

describe("plot callable hole", () => {
    it("plot throws outside-runtime sentinel for scalar input", () => {
        expect(() => plot(42)).toThrow("plot called outside compiled runtime");
    });

    it("plot throws outside-runtime sentinel for series input", () => {
        expect(() => plot({ current: 0, length: 0 }, { color: "#000" })).toThrow(
            "plot called outside compiled runtime",
        );
    });

    it("hline throws outside-runtime sentinel", () => {
        expect(() => hline(70, { color: "#ef4444", lineStyle: "dashed" })).toThrow(
            "hline called outside compiled runtime",
        );
    });
});

describe("PlotKind and PlotOptsStyle types", () => {
    it("accept the Phase-5 plot kind inventory", () => {
        const kinds: ReadonlyArray<PlotKind> = [
            "line",
            "step-line",
            "horizontal-line",
            "histogram",
            "area",
            "filled-band",
            "label",
            "marker",
            "shape",
            "character",
            "arrow",
            "candle-override",
            "bar-override",
            "bg-color",
            "bar-color",
            "horizontal-histogram",
        ];
        expect(kinds).toHaveLength(16);
    });

    it("accepts each new PlotOptsStyle variant", () => {
        const styles: ReadonlyArray<PlotOptsStyle> = [
            { kind: "shape", shape: "flag", size: 8, location: "below" },
            { kind: "character", char: "A", size: 12, location: "above" },
            { kind: "arrow", direction: "up", size: 10 },
            { kind: "candle-override", bull: "#26a69a", bear: "#ef5350", doji: "#999999" },
            { kind: "bar-override", color: "#f59e0b" },
            { kind: "bg-color", color: "#1d4ed8", transp: 80 },
            { kind: "bar-color", color: "#a855f7" },
            { kind: "horizontal-histogram", buckets: [{ price: 100, volume: 20 }] },
        ];
        expect(styles.map((style) => style.kind)).toEqual([
            "shape",
            "character",
            "arrow",
            "candle-override",
            "bar-override",
            "bg-color",
            "bar-color",
            "horizontal-histogram",
        ]);
    });
});
