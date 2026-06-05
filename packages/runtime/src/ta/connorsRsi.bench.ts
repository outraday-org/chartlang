// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { connorsRsi } from "./connorsRsi";

describe("ta.connorsRsi hot loop", () => {
    bench(
        "ta.connorsRsi over 10 000 bars × default opts (3, 2, 100)",
        () => {
            const sink = benchHotLoop(10_000, 1, (bar) => connorsRsi("slot", bar.close).current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
