// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { EMA_CROSS, MULTI_EXPORT_COMPOSITION } from "./__fixtures__/scripts.js";
import { compile } from "./api.js";

describe("compile — bench", () => {
    bench("EMA-cross end-to-end compile", async () => {
        await compile(EMA_CROSS, { apiVersion: 1, sourcePath: "ema-cross.chart.ts" });
    });

    bench("multi-export composition end-to-end compile", async () => {
        await compile(MULTI_EXPORT_COMPOSITION, {
            apiVersion: 1,
            sourcePath: "composition.chart.ts",
        });
    });
});
