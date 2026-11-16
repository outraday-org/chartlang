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
            maxLoadTimeoutMs: 30_000,
            maxSteps: Number.POSITIVE_INFINITY,
        });
        expect(publicSurface.QUICKJS_STEPS_PER_INTERRUPT_POLL).toBe(10_000);
        expect(new publicSurface.QuickJsStepAbortedError("x", "steps").reason).toBe("steps");
    });

    it("removes the placeholder package version export", () => {
        expect("PACKAGE_VERSION" in publicSurface).toBe(false);
    });
});
