// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { syntheticBars } from "../__fixtures__/syntheticBars";
import { pearson } from "./pearson";

const N = 10_000;
const { a, b } = (() => {
    const bars = syntheticBars(N, 1);
    const av = new Float64Array(N);
    const bv = new Float64Array(N);
    for (let i = 0; i < N; i += 1) {
        av[i] = bars[i].close;
        bv[i] = bars[i].open;
    }
    return { a: av, b: bv };
})();

describe("pearson hot loop", () => {
    bench(
        "pearson over 10 000 bars × length=20",
        () => {
            const out = pearson(a, b, 20);
            if (!Number.isFinite(out[N - 1])) {
                throw new Error("non-finite sink");
            }
        },
        { iterations: 5 },
    );
});
