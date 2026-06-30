// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { createTimeNamespace } from "./timeAccessors.js";

const FIXTURE = Date.UTC(2024, 0, 2, 13, 45, 30);

describe("time.year hot loop", () => {
    bench(
        "time.year over 100 000 calls",
        () => {
            const time = createTimeNamespace(
                () => "UTC",
                () => 0,
                () => 0,
                () => {},
            );
            let sink = 0;
            for (let i = 0; i < 100_000; i += 1) {
                sink += time.year(FIXTURE + i * 60_000);
            }
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
