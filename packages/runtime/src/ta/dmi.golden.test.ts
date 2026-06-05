// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { dmi } from "./dmi";
import { harness } from "./__fixtures__/runPrimitive";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars";

describe("ta.dmi — golden", () => {
    it("matches the pinned hashes for 100 bars × length=14", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, () => {
            const r = dmi("slot", 14);
            return { plusDi: r.plusDi.current, minusDi: r.minusDi.current };
        });
        // Hashes captured during implementation against
        // syntheticBars(100, 42); re-pin if the math intentionally changes.
        expect(hashFloat64Array(out.map((o) => o.plusDi))).toBe("7b10e16e");
        expect(hashFloat64Array(out.map((o) => o.minusDi))).toBe("d4591e3d");
    });
});
