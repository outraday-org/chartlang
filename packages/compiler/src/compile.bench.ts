// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { EMA_CROSS } from "./__fixtures__/scripts";
import { compile } from "./api";

describe("compile — bench", () => {
    bench("EMA-cross end-to-end compile", async () => {
        await compile(EMA_CROSS, { apiVersion: 1, sourcePath: "ema-cross.chart.ts" });
    });
});
