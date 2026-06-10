// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { atr } from "./atr.js";

describe("ta.atr hot loop", () => {
    bench(
        "ta.atr over 10 000 bars × length=14",
        () => {
            const sink = benchHotLoop(10_000, 1, () => atr("slot", 14).current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
