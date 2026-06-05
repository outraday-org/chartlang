// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { cmo } from "./cmo";

describe("ta.cmo hot loop", () => {
    bench(
        "ta.cmo over 10 000 bars × length=9",
        () => {
            const sink = benchHotLoop(10_000, 1, (bar) => cmo("slot", bar.close, 9).current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
