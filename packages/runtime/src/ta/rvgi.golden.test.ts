// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars";
import { rvgi } from "./rvgi";

describe("ta.rvgi — golden", () => {
    it("matches the pinned hash for 100 bars × default opts (10)", () => {
        const bars = syntheticBars(100, 42);
        const rs: number[] = [];
        const ss: number[] = [];
        harness(bars, bars.length + 1, (bar) => {
            const r = rvgi("slot");
            rs.push(r.rvgi.current);
            ss.push(r.signal.current);
            return null;
        });
        expect(hashFloat64Array([...rs, ...ss])).toBe("296a86c7");
    });
});
