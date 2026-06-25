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

    it("carries inline-helper notes for constants", () => {
        expect(MATH_PASSTHROUGH_MAP.get("math.pi")?.chartlang).toBe("Math.PI");
        expect(MATH_PASSTHROUGH_MAP.get("math.pi")?.notes).toContain("constant");
    });

    it("routes the chart-aware extras to the chartlang math namespace", () => {
        // `avg`/`sum` are the variadic scalar reducers; `round_to_mintick`
        // gets its `syminfo.mintick` step injected by the emitter.
        expect(MATH_PASSTHROUGH_MAP.get("math.avg")?.chartlang).toBe("math.avg");
        expect(MATH_PASSTHROUGH_MAP.get("math.sum")?.chartlang).toBe("math.sum");
        expect(MATH_PASSTHROUGH_MAP.get("math.round_to_mintick")?.chartlang).toBe(
            "math.roundToMintick",
        );
    });

    it("keeps math.sign on bare Math.sign (no-rewrap decision)", () => {
        expect(MATH_PASSTHROUGH_MAP.get("math.sign")?.chartlang).toBe("Math.sign");
    });

    it("flags math.random as a REJECT", () => {
        expect(MATH_PASSTHROUGH_MAP.get("math.random")?.chartlang).toBeNull();
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
