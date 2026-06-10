// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { Float64RingBuffer } from "./ringBuffer.js";

const ITERATIONS = 100_000;
const CAPACITY = 64;

describe("Float64RingBuffer hot loop", () => {
    bench(
        "Float64RingBuffer.append + at(0)",
        () => {
            const buf = new Float64RingBuffer(CAPACITY);
            let sink = 0;
            for (let i = 0; i < ITERATIONS; i += 1) {
                buf.append(i);
                sink += buf.at(0);
            }
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 20 },
    );
});
