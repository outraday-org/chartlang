// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { bench, describe } from "vitest";

import { bucketLtfBarsByMainContainment } from "./bucketLtfBarsByMainContainment.js";

function makeBars(count: number, stepMs: number): ReadonlyArray<Bar> {
    return Array.from({ length: count }, (_, i) => {
        const value = i + 1;
        return {
            time: i * stepMs,
            open: value,
            high: value,
            low: value,
            close: value,
            volume: value,
            symbol: "TEST",
            interval: "1m",
            hl2: value,
            hlc3: value,
            ohlc4: value,
            hlcc4: value,
        };
    });
}

const main = makeBars(1_500, 60_000);
const ltf = makeBars(6_000, 15_000);

describe("bucketLtfBarsByMainContainment hot loop", () => {
    bench(
        "two-pointer kernel — 6 000 LTF bars × 1 500 main bars",
        () => {
            const buckets = bucketLtfBarsByMainContainment(main, ltf);
            if (buckets.length !== main.length) throw new Error("bad output length");
        },
        { iterations: 1 },
    );

    bench(
        "naive filter baseline — 6 000 LTF bars × 1 500 main bars",
        () => {
            const buckets = main.map((m, i) => {
                const next = main[i + 1];
                const hi = next === undefined ? Number.POSITIVE_INFINITY : next.time;
                return ltf.filter((bar) => bar.time >= m.time && bar.time < hi);
            });
            if (buckets.length !== main.length) throw new Error("bad output length");
        },
        { iterations: 1 },
    );
});
