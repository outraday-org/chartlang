// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { hashFloat64Array, syntheticBars } from "../ta/__fixtures__/syntheticBars.js";
import { ArrayStateSlot } from "./arrayStateSlot.js";

/**
 * Golden hashes for the rolling `stdev` / `median` series a script would emit
 * by pushing each closed bar's close into a `state.array(14)` and reading the
 * reduction per bar. The bar-close lifecycle (`push` → `onBarClose`) commits the
 * tentative ring exactly as the runtime does, so the window is a true 14-bar
 * FIFO. Generated from the implementation — the deterministic behavioural
 * contract for the reductions, identical in spirit to the `ta.*` goldens.
 */
describe("state.array reductions — golden", () => {
    it("pins the rolling stdev / median series for 100 bars × window=14", () => {
        const bars = syntheticBars(100, 42);
        const slot = new ArrayStateSlot(14);
        const stdevSeries: number[] = [];
        const medianSeries: number[] = [];
        for (const bar of bars) {
            slot.handle.push(bar.close);
            slot.onBarClose();
            stdevSeries.push(slot.handle.stdev());
            medianSeries.push(slot.handle.median());
        }
        expect(hashFloat64Array(stdevSeries)).toBe("8e5745ab");
        expect(hashFloat64Array(medianSeries)).toBe("13aeedaf");
    });
});
