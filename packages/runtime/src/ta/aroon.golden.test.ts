// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { aroon } from "./aroon";
import { harness } from "./__fixtures__/runPrimitive";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars";

describe("ta.aroon — golden", () => {
    it("matches the pinned hashes for 100 bars × length=14", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, () => {
            const r = aroon("slot", 14);
            return { up: r.up.current, down: r.down.current };
        });
        // Hashes captured during implementation against
        // syntheticBars(100, 42); re-pin if the math intentionally changes.
        expect(hashFloat64Array(out.map((o) => o.up))).toBe("abd5f99d");
        expect(hashFloat64Array(out.map((o) => o.down))).toBe("5ffa4cc0");
    });
});
