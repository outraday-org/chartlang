// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { ultimateOsc } from "./ultimateOsc";

describe("ta.ultimateOsc hot loop", () => {
    bench(
        "ta.ultimateOsc over 10 000 bars × default opts (7, 14, 28)",
        () => {
            const sink = benchHotLoop(10_000, 1, () => ultimateOsc("slot").current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
