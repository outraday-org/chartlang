// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";
import { ENUM_VALUE_MAP, enumLookup } from "./enums.js";

describe("ENUM_VALUE_MAP", () => {
    it("maps the three core line styles to chartlang LineStyle literals", () => {
        expect(ENUM_VALUE_MAP.get("line.style_solid")?.chartlang).toBe("solid");
        expect(ENUM_VALUE_MAP.get("line.style_dotted")?.chartlang).toBe("dotted");
        expect(ENUM_VALUE_MAP.get("line.style_dashed")?.chartlang).toBe("dashed");
    });

    it("collapses arrow line styles to dashed with a warning note", () => {
        const m = ENUM_VALUE_MAP.get("line.style_arrow_both");
        expect(m?.chartlang).toBe("dashed");
        expect(m?.notes).toContain("arrow heads not modeled");
    });

    it("decomposes extend.* into extendLeft/extendRight objects", () => {
        expect(ENUM_VALUE_MAP.get("extend.none")?.chartlang).toEqual({
            extendLeft: false,
            extendRight: false,
        });
        expect(ENUM_VALUE_MAP.get("extend.left")?.chartlang).toEqual({
            extendLeft: true,
            extendRight: false,
        });
        expect(ENUM_VALUE_MAP.get("extend.right")?.chartlang).toEqual({
            extendLeft: false,
            extendRight: true,
        });
        expect(ENUM_VALUE_MAP.get("extend.both")?.chartlang).toEqual({
            extendLeft: true,
            extendRight: true,
        });
    });

    it("maps label shape glyphs to draw kinds and callouts to frame", () => {
        expect(ENUM_VALUE_MAP.get("label.style_square")?.chartlang).toBe("rectangle");
        expect(ENUM_VALUE_MAP.get("label.style_arrowup")?.chartlang).toBe("arrow-mark-up");
        expect(ENUM_VALUE_MAP.get("label.style_circle")?.chartlang).toBe("marker");
        expect(ENUM_VALUE_MAP.get("label.style_label_up")?.chartlang).toBe("frame");
    });

    it("maps sizes, with auto downgraded to normal", () => {
        expect(ENUM_VALUE_MAP.get("size.large")?.chartlang).toBe("large");
        expect(ENUM_VALUE_MAP.get("size.auto")?.chartlang).toBe("normal");
        expect(ENUM_VALUE_MAP.get("size.auto")?.notes).toContain("no auto");
    });

    it("maps text alignment and position kebab-case", () => {
        expect(ENUM_VALUE_MAP.get("text.align_center")?.chartlang).toBe("center");
        expect(ENUM_VALUE_MAP.get("text.align_top")?.chartlang).toBe("top");
        expect(ENUM_VALUE_MAP.get("position.bottom_right")?.chartlang).toBe("bottom-right");
    });

    it("flags text format / font family as unmappable", () => {
        expect(ENUM_VALUE_MAP.get("text.format_bold")?.chartlang).toBeNull();
        expect(ENUM_VALUE_MAP.get("font.family_monospace")?.chartlang).toBeNull();
    });

    it("maps named colors to hex strings", () => {
        expect(ENUM_VALUE_MAP.get("color.black")?.chartlang).toBe("#000000");
        expect(ENUM_VALUE_MAP.get("color.white")?.chartlang).toBe("#FFFFFF");
    });

    it("records xloc/yloc handoffs as unmappable here", () => {
        expect(ENUM_VALUE_MAP.get("xloc.bar_index")?.chartlang).toBeNull();
        expect(ENUM_VALUE_MAP.get("yloc.abovebar")?.chartlang).toBeNull();
        expect(ENUM_VALUE_MAP.get("yloc.price")?.chartlang).toBe("price");
    });
});

describe("enumLookup", () => {
    it("resolves a mappable enum", () => {
        expect(enumLookup("line.style_dashed")?.chartlang).toBe("dashed");
    });

    it("returns null for unknown and REJECT entries", () => {
        expect(enumLookup("line.style_unknown")).toBeNull();
        expect(enumLookup("text.format_bold")).toBeNull();
    });
});
