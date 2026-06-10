// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Series } from "@invinite-org/chartlang-core";
import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { barssince } from "./barssince.js";

function boolSeries(value: boolean): Series<boolean> {
    return { current: value, length: 1 } as unknown as Series<boolean>;
}

describe("ta.barssince hot loop", () => {
    bench(
        "ta.barssince over 10 000 bars × every-13th-true",
        () => {
            let i = 0;
            const sink = benchHotLoop(10_000, 1, (_bar) => {
                const cond = i % 13 === 0;
                i += 1;
                return barssince("slot", boolSeries(cond)).current;
            });
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
