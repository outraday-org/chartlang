// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { bbw } from "./bbw.js";

describe("ta.bbw hot loop", () => {
    bench(
        "ta.bbw over 10 000 bars × length=20",
        () => {
            const sink = benchHotLoop(10_000, 1, (bar) => bbw("slot", bar.close, 20).current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
