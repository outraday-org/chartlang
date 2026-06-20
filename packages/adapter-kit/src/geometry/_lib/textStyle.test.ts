// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import {
    HALIGN_TO_TEXTALIGN,
    SIZE_TO_PX,
    VALIGN_TO_TEXTBASELINE,
    resolveTextOpts,
} from "./textStyle.js";

describe("text-style lookup tables", () => {
    it("maps sizes, halign, and valign", () => {
        expect(SIZE_TO_PX.normal).toBe(12);
        expect(SIZE_TO_PX.huge).toBe(20);
        expect(HALIGN_TO_TEXTALIGN.center).toBe("center");
        expect(VALIGN_TO_TEXTBASELINE.middle).toBe("middle");
    });
});

describe("resolveTextOpts", () => {
    it("applies the normal / center / middle / black defaults", () => {
        expect(resolveTextOpts({})).toEqual({
            font: "12px sans-serif",
            align: "center",
            baseline: "middle",
            color: "#000000",
        });
    });

    it("resolves explicit fields", () => {
        expect(
            resolveTextOpts({ size: "large", halign: "left", valign: "top", color: "#10b981" }),
        ).toEqual({
            font: "16px sans-serif",
            align: "left",
            baseline: "top",
            color: "#10b981",
        });
    });
});
