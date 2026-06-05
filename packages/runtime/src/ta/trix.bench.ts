// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { trix } from "./trix";
import { benchHotLoop } from "./__fixtures__/benchHotLoop";

describe("ta.trix hot loop", () => {
    bench(
        "ta.trix over 10 000 bars × length=18, signal=9",
        () => {
            const sink = benchHotLoop(10_000, 1, (bar) => trix("slot", bar.close, 18).trix.current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
