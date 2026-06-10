// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Series } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars.js";
import { valuewhen } from "./valuewhen.js";

function boolSeries(value: boolean): Series<boolean> {
    return { current: value, length: 1 } as unknown as Series<boolean>;
}

describe("ta.valuewhen — golden", () => {
    it("matches the pinned hash for 100 bars × every-7th-true condition", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(
            bars,
            bars.length + 1,
            (bar, ctx) =>
                valuewhen("slot", boolSeries(ctx.barIndex() % 7 === 0), bar.close, 0).current,
        );
        const h = hashFloat64Array(out);
        expect(h).toBe("3ea7f2c9");
    });
});
