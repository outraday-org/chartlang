// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import { draw } from "./draw.js";
import type {
    ArrowMarkerOpts,
    ArrowOpts,
    BrushStyle,
    FibOpts,
    FrameOpts,
    HighlighterStyle,
    LineDrawStyle,
    PathOpts,
    RegressionTrendOpts,
    ShapeStyle,
    TextOpts,
    ZOrdered,
} from "./drawingStyle.js";
import type { TableOpts } from "./table.js";
import type { WorldPoint } from "./worldPoint.js";

describe("drawingStyle bags", () => {
    it("LineDrawStyle carries optional color/lineWidth/lineStyle/extend flags", () => {
        expectTypeOf<LineDrawStyle["color"]>().toEqualTypeOf<string | undefined>();
        expectTypeOf<LineDrawStyle["lineWidth"]>().toEqualTypeOf<number | undefined>();
        expectTypeOf<LineDrawStyle["extendLeft"]>().toEqualTypeOf<boolean | undefined>();
        expectTypeOf<LineDrawStyle["extendRight"]>().toEqualTypeOf<boolean | undefined>();
    });

    it("ShapeStyle carries stroke / fill / fillAlpha", () => {
        expectTypeOf<ShapeStyle["stroke"]>().toEqualTypeOf<string | undefined>();
        expectTypeOf<ShapeStyle["fill"]>().toEqualTypeOf<string | undefined>();
        expectTypeOf<ShapeStyle["fillAlpha"]>().toEqualTypeOf<number | undefined>();
    });

    it("HighlighterStyle requires color + alpha", () => {
        expectTypeOf<HighlighterStyle["color"]>().toEqualTypeOf<string>();
        expectTypeOf<HighlighterStyle["alpha"]>().toEqualTypeOf<number>();
    });

    it("BrushStyle requires stroke + fill", () => {
        expectTypeOf<BrushStyle["stroke"]>().toEqualTypeOf<string>();
        expectTypeOf<BrushStyle["fill"]>().toEqualTypeOf<string>();
    });

    it("TextOpts pins the size + halign + valign enums", () => {
        expectTypeOf<NonNullable<TextOpts["size"]>>().toEqualTypeOf<
            "tiny" | "small" | "normal" | "large" | "huge"
        >();
        expectTypeOf<NonNullable<TextOpts["halign"]>>().toEqualTypeOf<
            "left" | "center" | "right"
        >();
        expectTypeOf<NonNullable<TextOpts["valign"]>>().toEqualTypeOf<
            "top" | "middle" | "bottom"
        >();
    });

    it("ArrowOpts extends LineDrawStyle with an optional label", () => {
        expectTypeOf<ArrowOpts["label"]>().toEqualTypeOf<string | undefined>();
        expectTypeOf<ArrowOpts["color"]>().toEqualTypeOf<string | undefined>();
    });

    it("ArrowMarkerOpts carries color + text", () => {
        expectTypeOf<ArrowMarkerOpts["color"]>().toEqualTypeOf<string | undefined>();
        expectTypeOf<ArrowMarkerOpts["text"]>().toEqualTypeOf<string | undefined>();
    });

    it("PathOpts extends LineDrawStyle with an optional closed flag", () => {
        expectTypeOf<PathOpts["closed"]>().toEqualTypeOf<boolean | undefined>();
    });

    it("FibOpts carries optional levels array + flags", () => {
        expectTypeOf<NonNullable<FibOpts["levels"]>>().toEqualTypeOf<ReadonlyArray<number>>();
        expectTypeOf<FibOpts["showLabels"]>().toEqualTypeOf<boolean | undefined>();
        expectTypeOf<FibOpts["extendLeft"]>().toEqualTypeOf<boolean | undefined>();
    });

    it("RegressionTrendOpts pins the source enum + multiplier + band flags", () => {
        expectTypeOf<NonNullable<RegressionTrendOpts["source"]>>().toEqualTypeOf<
            "close" | "open" | "high" | "low" | "hl2" | "hlc3" | "ohlc4" | "hlcc4"
        >();
        expectTypeOf<RegressionTrendOpts["stdevMultiplier"]>().toEqualTypeOf<number | undefined>();
    });

    it("FrameOpts carries optional label + bgColor", () => {
        expectTypeOf<FrameOpts["label"]>().toEqualTypeOf<string | undefined>();
        expectTypeOf<FrameOpts["bgColor"]>().toEqualTypeOf<string | undefined>();
    });

    it("ZOrdered carries an optional finite z", () => {
        expectTypeOf<ZOrdered["z"]>().toEqualTypeOf<number | undefined>();
    });

    it("every draw option bag inherits the optional z mixin", () => {
        expectTypeOf<LineDrawStyle["z"]>().toEqualTypeOf<number | undefined>();
        expectTypeOf<ShapeStyle["z"]>().toEqualTypeOf<number | undefined>();
        expectTypeOf<HighlighterStyle["z"]>().toEqualTypeOf<number | undefined>();
        expectTypeOf<BrushStyle["z"]>().toEqualTypeOf<number | undefined>();
        expectTypeOf<TextOpts["z"]>().toEqualTypeOf<number | undefined>();
        expectTypeOf<ArrowOpts["z"]>().toEqualTypeOf<number | undefined>();
        expectTypeOf<ArrowMarkerOpts["z"]>().toEqualTypeOf<number | undefined>();
        expectTypeOf<PathOpts["z"]>().toEqualTypeOf<number | undefined>();
        expectTypeOf<FibOpts["z"]>().toEqualTypeOf<number | undefined>();
        expectTypeOf<RegressionTrendOpts["z"]>().toEqualTypeOf<number | undefined>();
        expectTypeOf<FrameOpts["z"]>().toEqualTypeOf<number | undefined>();
    });

    it("TableOpts does NOT carry z — tables are a viewport HUD layer, not part of the world-space (z, band, seq) sort (v1)", () => {
        expectTypeOf<TableOpts>().not.toHaveProperty("z");
    });

    it("z is optional and rejects non-numbers on a draw option bag", () => {
        const layered: LineDrawStyle = { z: -1 };
        const noZ: LineDrawStyle = { color: "#000" };
        // @ts-expect-error z is a number, not a string
        const bad: LineDrawStyle = { z: "x" };
        void layered;
        void noZ;
        void bad;
    });

    it("draw.line accepts a z render-order key", () => {
        const a: WorldPoint = { time: 0, price: 0 };
        const b: WorldPoint = { time: 1, price: 1 };
        // Type-only assertion: the stub throws at runtime, so this is never
        // invoked — we only assert the option bag type-checks.
        const call = (): ReturnType<typeof draw.line> => draw.line(a, b, { z: -1 });
        void call;
    });
});
