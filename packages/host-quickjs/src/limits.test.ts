// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { DEFAULT_QUICKJS_LIMITS } from "./limits";

describe("DEFAULT_QUICKJS_LIMITS", () => {
    it("matches the documented Phase-5 defaults", () => {
        expect(DEFAULT_QUICKJS_LIMITS).toEqual({
            maxHeapBytes: 64 * 1024 * 1024,
            maxStepMs: 1,
        });
    });

    it("is frozen", () => {
        expect(Object.isFrozen(DEFAULT_QUICKJS_LIMITS)).toBe(true);
    });
});
