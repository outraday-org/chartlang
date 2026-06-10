// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { barstate } from "./barstate.js";

describe("barstate", () => {
    it("defaults every field to false", () => {
        expect(barstate).toEqual({
            isfirst: false,
            islast: false,
            isnew: false,
            ishistory: false,
            isrealtime: false,
            isconfirmed: false,
        });
    });

    it("is frozen", () => {
        expect(Object.isFrozen(barstate)).toBe(true);
        expect(() => Object.assign(barstate, { isfirst: true })).toThrow(TypeError);
    });
});
