// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { aroon } from "./aroon.js";
import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";

describe("ta.aroon hot loop", () => {
    bench(
        "ta.aroon over 10 000 bars × length=14",
        () => {
            const sink = benchHotLoop(10_000, 1, () => aroon("slot", 14).up.current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
