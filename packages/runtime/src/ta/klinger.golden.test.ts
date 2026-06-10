// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars.js";
import { klinger } from "./klinger.js";

describe("ta.klinger — golden", () => {
    it("matches the pinned hash for 100 bars × default opts (34, 55, 13)", () => {
        const bars = syntheticBars(100, 42);
        const ks: number[] = [];
        const ss: number[] = [];
        harness(bars, bars.length + 1, (bar) => {
            const k = klinger("slot");
            ks.push(k.klinger.current);
            ss.push(k.signal.current);
            return null;
        });
        expect(hashFloat64Array([...ks, ...ss])).toBe("a105d5b5");
    });
});
