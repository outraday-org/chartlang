// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { maRibbon } from "./maRibbon.js";

describe("ta.maRibbon hot loop", () => {
    bench(
        "ta.maRibbon over 10 000 bars × 5 default sma sub-slots",
        () => {
            const sink = benchHotLoop(10_000, 1, (bar) => {
                const r = maRibbon("slot", bar.close);
                return r.ma_10.current + r.ma_50.current;
            });
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
