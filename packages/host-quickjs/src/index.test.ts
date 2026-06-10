// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import * as publicSurface from "./index.js";

describe("public surface", () => {
    it("exports the runtime values", () => {
        expect(publicSurface.createQuickJsHost).toEqual(expect.any(Function));
        expect(publicSurface.DEFAULT_QUICKJS_LIMITS).toEqual({
            maxHeapBytes: 64 * 1024 * 1024,
            maxStepMs: 1,
        });
    });

    it("removes the placeholder package version export", () => {
        expect("PACKAGE_VERSION" in publicSurface).toBe(false);
    });
});
