// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Series } from "@invinite-org/chartlang-core";
import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { valuewhen } from "./valuewhen";

function boolSeries(value: boolean): Series<boolean> {
    return { current: value, length: 1 } as unknown as Series<boolean>;
}

describe("ta.valuewhen hot loop", () => {
    bench(
        "ta.valuewhen over 10 000 bars × every-7th-true",
        () => {
            let i = 0;
            const sink = benchHotLoop(10_000, 1, (bar) => {
                const cond = i % 7 === 0;
                i += 1;
                return valuewhen("slot", boolSeries(cond), bar.close, 0).current;
            });
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
