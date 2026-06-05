// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { pvo } from "./pvo";

describe("ta.pvo hot loop", () => {
    bench(
        "ta.pvo over 10 000 bars × default opts (12, 26, 9)",
        () => {
            const sink = benchHotLoop(10_000, 1, () => pvo("slot").signal.current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
