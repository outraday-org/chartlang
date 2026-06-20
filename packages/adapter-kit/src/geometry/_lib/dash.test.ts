// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { dashPattern } from "./dash.js";

describe("dashPattern", () => {
    it("maps each line style to its canonical segment array", () => {
        expect(dashPattern("solid")).toEqual([]);
        expect(dashPattern("dashed")).toEqual([6, 4]);
        expect(dashPattern("dotted")).toEqual([2, 4]);
    });
});
