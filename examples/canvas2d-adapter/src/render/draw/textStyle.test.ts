// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import {
    HALIGN_TO_TEXTALIGN,
    resolveTextOpts,
    SIZE_TO_PX,
    VALIGN_TO_TEXTBASELINE,
} from "./textStyle.js";

describe("SIZE_TO_PX", () => {
    it("maps every named size keyword to its pixel value", () => {
        expect(SIZE_TO_PX).toEqual({
            tiny: 8,
            small: 10,
            normal: 12,
            large: 16,
            huge: 20,
        });
    });
});

describe("HALIGN_TO_TEXTALIGN", () => {
    it("maps every halign keyword to its canvas textAlign value", () => {
        expect(HALIGN_TO_TEXTALIGN).toEqual({
            left: "left",
            center: "center",
            right: "right",
        });
    });
});

describe("VALIGN_TO_TEXTBASELINE", () => {
    it("maps every valign keyword to its canvas textBaseline value", () => {
        expect(VALIGN_TO_TEXTBASELINE).toEqual({
            top: "top",
            middle: "middle",
            bottom: "bottom",
        });
    });
});

describe("resolveTextOpts", () => {
    it("defaults to 12px center/middle #000000 when every field is omitted", () => {
        expect(resolveTextOpts({})).toEqual({
            font: "12px sans-serif",
            textAlign: "center",
            textBaseline: "middle",
            fillStyle: "#000000",
        });
    });

    it("honours explicit size + color + halign + valign", () => {
        expect(
            resolveTextOpts({
                size: "large",
                color: "#10b981",
                halign: "right",
                valign: "bottom",
            }),
        ).toEqual({
            font: "16px sans-serif",
            textAlign: "right",
            textBaseline: "bottom",
            fillStyle: "#10b981",
        });
    });

    it.each(["tiny", "small", "normal", "large", "huge"] as const)(
        "maps size = '%s' to the matching pixel font",
        (size) => {
            const r = resolveTextOpts({ size });
            expect(r.font).toBe(`${SIZE_TO_PX[size]}px sans-serif`);
        },
    );
});
