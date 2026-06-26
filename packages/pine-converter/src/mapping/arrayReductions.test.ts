// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";
import {
    ARRAY_REDUCTION_MAP,
    ARRAY_SORT_ORDER_MAP,
    arrayReductionLookup,
} from "./arrayReductions.js";

describe("ARRAY_REDUCTION_MAP", () => {
    it("maps each reduction onto its chartlang handle method", () => {
        expect(ARRAY_REDUCTION_MAP.get("array.avg")?.chartlang).toBe("avg");
        expect(ARRAY_REDUCTION_MAP.get("array.sum")?.chartlang).toBe("sum");
        expect(ARRAY_REDUCTION_MAP.get("array.stdev")?.chartlang).toBe("stdev");
        expect(ARRAY_REDUCTION_MAP.get("array.variance")?.chartlang).toBe("variance");
        expect(ARRAY_REDUCTION_MAP.get("array.median")?.chartlang).toBe("median");
        expect(ARRAY_REDUCTION_MAP.get("array.range")?.chartlang).toBe("range");
        expect(ARRAY_REDUCTION_MAP.get("array.percentile_linear_interpolation")?.chartlang).toBe(
            "percentile",
        );
        expect(ARRAY_REDUCTION_MAP.get("array.indexof")?.chartlang).toBe("indexOf");
        expect(ARRAY_REDUCTION_MAP.get("array.includes")?.chartlang).toBe("includes");
        expect(ARRAY_REDUCTION_MAP.get("array.sort")?.chartlang).toBe("sort");
    });

    it("flags nearest-rank percentile as a REJECT", () => {
        expect(ARRAY_REDUCTION_MAP.get("array.percentile_nearest_rank")?.chartlang).toBeNull();
        expect(ARRAY_REDUCTION_MAP.get("array.percentile_nearest_rank")?.notes).toContain(
            "nearest-rank",
        );
    });

    it("carries the correct arity for each family", () => {
        expect(ARRAY_REDUCTION_MAP.get("array.avg")?.arity).toBe("none");
        expect(ARRAY_REDUCTION_MAP.get("array.stdev")?.arity).toBe("optional");
        expect(ARRAY_REDUCTION_MAP.get("array.percentile_linear_interpolation")?.arity).toBe(
            "value",
        );
        expect(ARRAY_REDUCTION_MAP.get("array.sort")?.arity).toBe("sort");
    });

    it("keys every entry under the array.* namespace", () => {
        for (const key of ARRAY_REDUCTION_MAP.keys()) {
            expect(key.startsWith("array.")).toBe(true);
        }
    });
});

describe("ARRAY_SORT_ORDER_MAP", () => {
    it("maps Pine order enums to the chartlang literal", () => {
        expect(ARRAY_SORT_ORDER_MAP.get("order.ascending")).toBe("asc");
        expect(ARRAY_SORT_ORDER_MAP.get("order.descending")).toBe("desc");
    });
});

describe("arrayReductionLookup", () => {
    it("resolves a mappable reduction", () => {
        expect(arrayReductionLookup("array.median")?.chartlang).toBe("median");
    });

    it("returns null for unknown members and REJECTs", () => {
        expect(arrayReductionLookup("array.standardize")).toBeNull();
        expect(arrayReductionLookup("array.percentile_nearest_rank")).toBeNull();
    });
});
