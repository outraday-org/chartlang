// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { rvgi } from "./rvgi.js";

describe("ta.rvgi hot loop", () => {
    bench(
        "ta.rvgi over 10 000 bars × default opts (10)",
        () => {
            const sink = benchHotLoop(10_000, 1, (bar) => rvgi("slot").rvgi.current);
            if (!Number.isFinite(sink) && !Number.isNaN(sink)) {
                throw new Error("unexpected sink");
            }
        },
        { iterations: 5 },
    );
});
