// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { syntheticBars } from "../__fixtures__/syntheticBars.js";
import { linearRegression } from "./linearRegression.js";

const N = 10_000;
const source = (() => {
    const bars = syntheticBars(N, 1);
    const out = new Float64Array(N);
    for (let i = 0; i < N; i += 1) out[i] = bars[i].close;
    return out;
})();

describe("linearRegression hot loop", () => {
    bench(
        "linearRegression over 10 000 bars × length=20",
        () => {
            const out = linearRegression(source, 20);
            if (!Number.isFinite(out.value[N - 1])) {
                throw new Error("non-finite sink");
            }
        },
        { iterations: 5 },
    );
});
