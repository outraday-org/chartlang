// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { volatilityStop } from "./volatilityStop";

describe("ta.volatilityStop hot loop", () => {
    bench(
        "ta.volatilityStop over 10 000 bars × length=20 × multiplier=2",
        () => {
            const sink = benchHotLoop(10_000, 1, () => {
                const v = volatilityStop("slot", { length: 20, multiplier: 2 });
                const val = v.value.current;
                return Number.isFinite(val) ? val : 0;
            });
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
