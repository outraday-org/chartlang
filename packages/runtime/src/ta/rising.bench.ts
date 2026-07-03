// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { rising } from "./rising.js";

describe("ta.rising hot loop", () => {
    bench(
        "ta.rising over 10 000 bars × length=3",
        () => {
            const sink = benchHotLoop(
                10_000,
                1,
                (bar) => rising("slot", bar.close, 3).current,
            );
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
