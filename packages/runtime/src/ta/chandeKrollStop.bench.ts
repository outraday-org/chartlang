// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { chandeKrollStop } from "./chandeKrollStop";
import { benchHotLoop } from "./__fixtures__/benchHotLoop";

describe("ta.chandeKrollStop hot loop", () => {
    bench(
        "ta.chandeKrollStop over 10 000 bars × defaults",
        () => {
            const sink = benchHotLoop(10_000, 1, () => chandeKrollStop("slot").long.current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
