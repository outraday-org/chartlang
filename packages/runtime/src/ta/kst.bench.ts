// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { kst } from "./kst.js";

describe("ta.kst hot loop", () => {
    bench(
        "ta.kst over 10 000 bars × default opts",
        () => {
            const sink = benchHotLoop(10_000, 1, (bar) => kst("slot", bar.close).kst.current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
