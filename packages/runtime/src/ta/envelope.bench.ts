// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { envelope } from "./envelope.js";

describe("ta.envelope hot loop", () => {
    bench(
        "ta.envelope over 10 000 bars × length=20",
        () => {
            const sink = benchHotLoop(
                10_000,
                1,
                (b) => envelope("slot", b.close, { length: 20 }).middle.current,
            );
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
