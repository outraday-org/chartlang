// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Series } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { barssince } from "./barssince";

function boolSeries(value: boolean): Series<boolean> {
    return { current: value, length: 1 } as unknown as Series<boolean>;
}

const THRESHOLD_MS = 1500;

describe("ta.barssince threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        let i = 0;
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, (_bar) => {
            const cond = i % 13 === 0;
            i += 1;
            return barssince("slot", boolSeries(cond)).current;
        });
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
