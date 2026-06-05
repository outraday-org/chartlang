// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { ppo } from "./ppo";

describe("ta.ppo hot loop", () => {
    bench(
        "ta.ppo over 10 000 bars × default opts (12, 26, 9)",
        () => {
            const sink = benchHotLoop(10_000, 1, (bar) => ppo("slot", bar.close).signal.current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
