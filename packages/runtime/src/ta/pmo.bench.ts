// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { pmo } from "./pmo.js";

describe("ta.pmo hot loop", () => {
    bench(
        "ta.pmo over 10 000 bars × default opts (35, 20, 10)",
        () => {
            const sink = benchHotLoop(10_000, 1, (bar) => pmo("slot", bar.close).pmo.current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
