// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { DEFAULT_LIMITS, watchStep } from "./limits.js";

describe("DEFAULT_LIMITS", () => {
    it("matches the documented Phase-1 defaults", () => {
        expect(DEFAULT_LIMITS).toEqual({
            maxHeapBytes: 64 * 1024 * 1024,
            maxCpuMsPerStep: 50,
            maxRingBufferBars: 5_000,
            maxLoadTimeoutMs: 30_000,
        });
    });

    it("is frozen", () => {
        expect(Object.isFrozen(DEFAULT_LIMITS)).toBe(true);
    });
});

describe("watchStep", () => {
    it("returns the resolved value with overshoot 0 under budget", async () => {
        const { result, overshoot } = await watchStep(async () => 42, 1_000);
        expect(result).toBe(42);
        expect(overshoot).toBe(0);
    });

    it("reports observed elapsed ms when over budget but still returns the result", async () => {
        const { result, overshoot } = await watchStep(async () => {
            await new Promise((r) => setTimeout(r, 25));
            return "done";
        }, 1);
        expect(result).toBe("done");
        expect(overshoot).toBeGreaterThan(1);
    });

    it("rethrows when fn rejects", async () => {
        await expect(
            watchStep(async () => {
                throw new Error("boom");
            }, 50),
        ).rejects.toThrow("boom");
    });
});
