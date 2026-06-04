// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { Float64RingBuffer } from "./ringBuffer";
import { makeSeriesView } from "./seriesView";

const ITERATIONS = 100_000;
const CAPACITY = 64;

describe("makeSeriesView hot loop", () => {
    bench(
        "Series Proxy: view.current + view.length",
        () => {
            const buf = new Float64RingBuffer(CAPACITY);
            const view = makeSeriesView<number>(buf);
            let sink = 0;
            for (let i = 0; i < ITERATIONS; i += 1) {
                buf.append(i);
                sink += view.current + view.length;
            }
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 20 },
    );
});
