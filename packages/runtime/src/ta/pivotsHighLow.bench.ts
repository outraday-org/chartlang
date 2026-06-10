// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { pivotsHighLow } from "./pivotsHighLow.js";

describe("ta.pivotsHighLow hot loop", () => {
    bench(
        "ta.pivotsHighLow over 10 000 bars × leftLength=4 × rightLength=4",
        () => {
            const sink = benchHotLoop(10_000, 1, () => {
                const p = pivotsHighLow("slot", { leftLength: 4, rightLength: 4 });
                const v = p.high.current;
                return Number.isFinite(v) ? v : 0;
            });
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
