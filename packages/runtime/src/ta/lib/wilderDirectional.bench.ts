// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { syntheticBars } from "../__fixtures__/syntheticBars.js";
import { wilderDirectional } from "./wilderDirectional.js";

function buildSeries(
    n: number,
    seed: number,
): {
    high: Float64Array;
    low: Float64Array;
    close: Float64Array;
} {
    const bars = syntheticBars(n, seed);
    const high = new Float64Array(n);
    const low = new Float64Array(n);
    const close = new Float64Array(n);
    for (let i = 0; i < n; i += 1) {
        high[i] = bars[i].high;
        low[i] = bars[i].low;
        close[i] = bars[i].close;
    }
    return { close, high, low };
}

describe("wilderDirectional hot loop", () => {
    const { high, low, close } = buildSeries(10_000, 1);
    bench(
        "wilderDirectional over 10 000 bars × length=14",
        () => {
            const out = wilderDirectional(high, low, close, 14);
            if (!Number.isFinite(out.plusDi[out.plusDi.length - 1])) {
                throw new Error("non-finite sink");
            }
        },
        { iterations: 5 },
    );
});
