// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { EMA_CROSS } from "./__fixtures__/scripts.js";
import { transformAndAnalyse } from "./api.js";

describe("transformAndAnalyse — bench", () => {
    bench(
        "ema-cross",
        () => {
            transformAndAnalyse(EMA_CROSS, { sourcePath: "ema-cross.chart.ts" });
        },
        { iterations: 20 },
    );
});
