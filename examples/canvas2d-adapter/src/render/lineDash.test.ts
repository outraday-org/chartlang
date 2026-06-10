// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { dashPattern } from "./lineDash.js";

describe("dashPattern", () => {
    it("returns [] for solid", () => {
        expect(dashPattern("solid")).toEqual([]);
    });

    it("returns [6, 4] for dashed", () => {
        expect(dashPattern("dashed")).toEqual([6, 4]);
    });

    it("returns [2, 4] for dotted", () => {
        expect(dashPattern("dotted")).toEqual([2, 4]);
    });
});
