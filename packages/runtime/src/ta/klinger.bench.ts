// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { klinger } from "./klinger";

describe("ta.klinger hot loop", () => {
    bench(
        "ta.klinger over 10 000 bars × default opts (34, 55, 13)",
        () => {
            const sink = benchHotLoop(10_000, 1, (bar) => klinger("slot").klinger.current);
            if (!Number.isFinite(sink) && !Number.isNaN(sink)) {
                throw new Error("unexpected sink");
            }
        },
        { iterations: 5 },
    );
});
