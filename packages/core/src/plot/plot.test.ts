// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { barcolor, bgcolor, hline, plot } from "./plot.js";
import type {
    BarColorOpts,
    BgColorOpts,
    HLineOpts,
    PlotKind,
    PlotOpts,
    PlotOptsStyle,
} from "./plot.js";

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

    it("bgcolor throws outside-runtime sentinel", () => {
        expect(() => bgcolor("#000")).toThrow("bgcolor called outside compiled runtime");
        expect(() => bgcolor("#1d4ed8", { transp: 80, title: "heat" })).toThrow(
            "bgcolor called outside compiled runtime",
        );
    });

    it("barcolor throws outside-runtime sentinel", () => {
        expect(() => barcolor("#000")).toThrow("barcolor called outside compiled runtime");
        expect(() => barcolor("#a855f7", { title: "trend tint" })).toThrow(
            "barcolor called outside compiled runtime",
        );
    });
});

describe("BgColorOpts and BarColorOpts types", () => {
    it("bgcolor accepts a color and an optional transp/title opts bag", () => {
        const callShape: (color: string, opts?: BgColorOpts) => void = bgcolor;
        const withTransp: BgColorOpts = { transp: 80 };
        const withTitle: BgColorOpts = { title: "RSI heat" };
        const empty: BgColorOpts = {};
        // @ts-expect-error transp is a number, not a string
        const bad: BgColorOpts = { transp: "x" };
        void callShape;
        void withTransp;
        void withTitle;
        void empty;
        void bad;
    });

    it("barcolor accepts a color and a title-only opts bag (no transp)", () => {
        const callShape: (color: string, opts?: BarColorOpts) => void = barcolor;
        const withTitle: BarColorOpts = { title: "trend tint" };
        const empty: BarColorOpts = {};
        // @ts-expect-error bar-color carries no transparency
        const bad: BarColorOpts = { transp: 80 };
        void callShape;
        void withTitle;
        void empty;
        void bad;
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

describe("PlotOpts.z render-order key", () => {
    it("accepts an optional finite z and rejects non-numbers", () => {
        const layered: PlotOpts = { z: 2 };
        const fractional: PlotOpts = { z: 1.5 };
        const behind: PlotOpts = { z: -1 };
        const noZ: PlotOpts = { color: "#000" };
        // @ts-expect-error z is a number, not a string
        const bad: PlotOpts = { z: "x" };
        void layered;
        void fractional;
        void behind;
        void noZ;
        void bad;
    });
});

describe("HLineOpts.pane", () => {
    it("accepts the three-variant pane shape", () => {
        const overlay: HLineOpts = { pane: "overlay" };
        const fresh: HLineOpts = { pane: "new" };
        const named: HLineOpts = { pane: "rsi" };
        void overlay;
        void fresh;
        void named;
    });
});
