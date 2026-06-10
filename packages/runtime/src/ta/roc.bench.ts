// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { roc } from "./roc.js";

describe("ta.roc hot loop", () => {
    bench(
        "ta.roc over 10 000 bars × length=12",
        () => {
            const sink = benchHotLoop(10_000, 1, (bar) => roc("slot", bar.close, 12).current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
