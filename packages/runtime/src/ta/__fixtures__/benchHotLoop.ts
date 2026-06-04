// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";

import { harness } from "./runPrimitive";
import { syntheticBars } from "./syntheticBars";

/**
 * Drive `n` synthetic bars through `step`, returning a sink value the
 * caller can probe so the JIT can't elide the loop. Shared by every
 * `<id>.bench.ts` / `<id>.bench.test.ts` pair.
 */
export function benchHotLoop(
    n: number,
    seed: number,
    step: (bar: Bar) => number | boolean,
): number {
    const bars = syntheticBars(n, seed);
    const out = harness(bars, n + 1, step);
    let sink = 0;
    for (const v of out) {
        if (typeof v === "boolean") sink += v ? 1 : 0;
        else if (Number.isFinite(v)) sink += v;
    }
    return sink;
}
