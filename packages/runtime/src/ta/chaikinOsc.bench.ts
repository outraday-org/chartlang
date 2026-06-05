// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { chaikinOsc } from "./chaikinOsc";

describe("ta.chaikinOsc hot loop", () => {
    bench(
        "ta.chaikinOsc over 10 000 bars × default opts (3, 10)",
        () => {
            const sink = benchHotLoop(10_000, 1, () => chaikinOsc("slot").current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
