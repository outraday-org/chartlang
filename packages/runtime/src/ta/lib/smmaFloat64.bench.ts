// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { syntheticBars } from "../__fixtures__/syntheticBars";
import { smmaFloat64 } from "./smmaFloat64";

const SOURCE = new Float64Array(syntheticBars(10_000, 1).map((b) => b.close));

describe("smmaFloat64 hot loop", () => {
    bench(
        "smmaFloat64 over 10 000 bars × length=20",
        () => {
            const out = smmaFloat64(SOURCE, 20);
            if (!Number.isFinite(out[out.length - 1])) {
                throw new Error("non-finite tail");
            }
        },
        { iterations: 10 },
    );
});
