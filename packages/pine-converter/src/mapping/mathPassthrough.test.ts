// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";
import { MATH_PASSTHROUGH_MAP, mathLookup } from "./mathPassthrough.js";

describe("MATH_PASSTHROUGH_MAP", () => {
    it("passes 1:1 numeric functions to Math.*", () => {
        expect(MATH_PASSTHROUGH_MAP.get("math.abs")?.chartlang).toBe("Math.abs");
        expect(MATH_PASSTHROUGH_MAP.get("math.max")?.chartlang).toBe("Math.max");
        expect(MATH_PASSTHROUGH_MAP.get("math.sqrt")?.chartlang).toBe("Math.sqrt");
    });

    it("carries inline-helper notes for aggregates and constants", () => {
        expect(MATH_PASSTHROUGH_MAP.get("math.avg")?.notes).toContain("helper");
        expect(MATH_PASSTHROUGH_MAP.get("math.pi")?.chartlang).toBe("Math.PI");
        expect(MATH_PASSTHROUGH_MAP.get("math.pi")?.notes).toContain("constant");
    });

    it("flags math.random and math.round_to_mintick as REJECTs", () => {
        expect(MATH_PASSTHROUGH_MAP.get("math.random")?.chartlang).toBeNull();
        expect(MATH_PASSTHROUGH_MAP.get("math.round_to_mintick")?.chartlang).toBeNull();
    });
});

describe("mathLookup", () => {
    it("resolves a mappable member", () => {
        expect(mathLookup("math.floor")?.chartlang).toBe("Math.floor");
    });

    it("returns null for unknown members and REJECTs", () => {
        expect(mathLookup("math.gamma")).toBeNull();
        expect(mathLookup("math.random")).toBeNull();
    });
});
