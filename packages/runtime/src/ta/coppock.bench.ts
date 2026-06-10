// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { coppock } from "./coppock.js";

describe("ta.coppock hot loop", () => {
    bench(
        "ta.coppock over 10 000 bars × default opts (11, 14, 10)",
        () => {
            const sink = benchHotLoop(10_000, 1, (bar) => coppock("slot", bar.close).current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
