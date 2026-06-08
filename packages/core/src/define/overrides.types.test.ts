// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import type { ScaleAxis, ScriptOverrides, ValueFormat } from "./overrides";

function describeFormat(format: ValueFormat): string {
    if (format === "price") return "price";
    if (format === "volume") return "volume";
    if (format === "percent") return "percent";
    expectTypeOf(format).toEqualTypeOf<"compact">();
    return "compact";
}

function describeScale(scale: ScaleAxis): string {
    if (scale === "price") return "price";
    if (scale === "left") return "left";
    if (scale === "right") return "right";
    expectTypeOf(scale).toEqualTypeOf<"new">();
    return "new";
}

describe("script override types", () => {
    it("narrows ValueFormat and ScaleAxis unions", () => {
        expectTypeOf(describeFormat("compact")).toEqualTypeOf<string>();
        expectTypeOf(describeScale("new")).toEqualTypeOf<string>();
    });

    it("keeps requiresIntervals readonly", () => {
        const overrides: ScriptOverrides = {
            requiresIntervals: ["1D", "1W"] as const,
        };
        expectTypeOf(overrides.requiresIntervals).toEqualTypeOf<
            ReadonlyArray<string> | undefined
        >();
    });
});
