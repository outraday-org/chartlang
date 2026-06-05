// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { adx } from "./adx";
import { benchHotLoop } from "./__fixtures__/benchHotLoop";

describe("ta.adx hot loop", () => {
    bench(
        "ta.adx over 10 000 bars × length=14",
        () => {
            const sink = benchHotLoop(10_000, 1, () => adx("slot", 14).current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
