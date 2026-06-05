// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Series } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars";
import { barssince } from "./barssince";

function boolSeries(value: boolean): Series<boolean> {
    return { current: value, length: 1 } as unknown as Series<boolean>;
}

describe("ta.barssince — golden", () => {
    it("matches the pinned hash for 100 bars × every-13th-true condition", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(
            bars,
            bars.length + 1,
            (_bar, ctx) => barssince("slot", boolSeries(ctx.barIndex() % 13 === 0)).current,
        );
        const h = hashFloat64Array(out);
        expect(h).toBe("af68aa7c");
    });
});
