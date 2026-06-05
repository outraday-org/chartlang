// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars";
import { kama } from "./kama";

describe("ta.kama — golden", () => {
    it("matches the pinned hash for 100 bars × {length:10, fast:2, slow:30}", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => kama("slot", bar.close, { length: 10, fastLength: 2, slowLength: 30 }).current,
        );
        const h = hashFloat64Array(out);
        expect(h).toBe("0786851a");
    });
});
