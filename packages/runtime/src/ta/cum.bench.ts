// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { cum } from "./cum.js";

describe("ta.cum hot loop", () => {
    bench(
        "ta.cum over 10 000 bars of volume",
        () => {
            const sink = benchHotLoop(10_000, 1, (bar) => cum("slot", bar.volume).current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
