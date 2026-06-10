// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Series } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { valuewhen } from "./valuewhen.js";

function boolSeries(value: boolean): Series<boolean> {
    return { current: value, length: 1 } as unknown as Series<boolean>;
}

const THRESHOLD_MS = 1500;

describe("ta.valuewhen threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        let i = 0;
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, (bar) => {
            const cond = i % 7 === 0;
            i += 1;
            return valuewhen("slot", boolSeries(cond), bar.close, 0).current;
        });
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
