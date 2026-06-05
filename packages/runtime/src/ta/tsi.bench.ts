// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { tsi } from "./tsi";

describe("ta.tsi hot loop", () => {
    bench(
        "ta.tsi over 10 000 bars × default opts (25, 13, 13)",
        () => {
            const sink = benchHotLoop(10_000, 1, (bar) => tsi("slot", bar.close).tsi.current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
