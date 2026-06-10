// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Series } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { readSourceValue } from "./sourceValue.js";

describe("readSourceValue", () => {
    it("passes numbers through verbatim", () => {
        expect(readSourceValue(12.5)).toBe(12.5);
        expect(readSourceValue(Number.NaN)).toBeNaN();
    });

    it("reads .current off a Series-shaped object", () => {
        const series: Series<number> = {
            current: 42,
            length: 1,
        } as Series<number>;
        expect(readSourceValue(series)).toBe(42);
    });
});
