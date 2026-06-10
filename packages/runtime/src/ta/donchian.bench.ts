// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { donchian } from "./donchian.js";

describe("ta.donchian hot loop", () => {
    bench(
        "ta.donchian over 10 000 bars × length=20",
        () => {
            const sink = benchHotLoop(10_000, 1, () => donchian("slot", 20).middle.current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
