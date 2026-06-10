// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { pivotsStandard } from "./pivotsStandard.js";

describe("ta.pivotsStandard hot loop", () => {
    bench(
        "ta.pivotsStandard over 10 000 bars × classic system",
        () => {
            const sink = benchHotLoop(10_000, 1, () => {
                const p = pivotsStandard("slot", { system: "classic" });
                const v = p.pp.current;
                return Number.isFinite(v) ? v : 0;
            });
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
