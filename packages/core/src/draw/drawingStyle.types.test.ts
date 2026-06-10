// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

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
} from "./drawingStyle.js";

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
});
