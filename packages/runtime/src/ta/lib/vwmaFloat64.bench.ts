// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { syntheticBars } from "../__fixtures__/syntheticBars.js";
import { vwmaFloat64 } from "./vwmaFloat64.js";

const BARS = syntheticBars(10_000, 1);
const SOURCE = new Float64Array(BARS.map((b) => b.close));
// `+ 1` guarantees every bar has positive volume so the bench's
// tail-finite assertion is robust against the synthetic generator's
// occasional zero-volume bar (Math.floor(rand() * 10_000) can be 0).
const VOLUME = new Float64Array(BARS.map((b) => b.volume + 1));

describe("vwmaFloat64 hot loop", () => {
    bench(
        "vwmaFloat64 over 10 000 bars × length=20",
        () => {
            const out = vwmaFloat64(SOURCE, VOLUME, 20);
            if (!Number.isFinite(out[out.length - 1])) {
                throw new Error("non-finite tail");
            }
        },
        { iterations: 10 },
    );
});
