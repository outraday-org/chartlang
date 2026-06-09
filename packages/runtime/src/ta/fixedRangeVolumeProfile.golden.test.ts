// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { mulberry32 } from "./__fixtures__/syntheticBars";
import { fixedRangeVolumeProfile } from "./fixedRangeVolumeProfile";

type Expected = Readonly<{
    bucketCount: number;
    bucketsHash: string;
    poc: number | null;
    valHigh: number | null;
    valLow: number | null;
}>;

const FIXTURE_DIR = fileURLToPath(
    new URL("./__fixtures__/fixedRangeVolumeProfile/", import.meta.url),
);

function readExpected(name: string): Expected {
    return JSON.parse(readFileSync(`${FIXTURE_DIR}${name}.json`, "utf8")) as Expected;
}

function syntheticBars(count: number, seed: number): Bar[] {
    const rand = mulberry32(seed);
    const out: Bar[] = [];
    let close = 100;
    for (let i = 0; i < count; i += 1) {
        close += (rand() - 0.48) * 1.8;
        out.push({
            close,
            high: close + 0.2 + rand() * 0.6,
            interval: "1m",
            low: close - 0.2 - rand() * 0.6,
            open: close + (rand() - 0.5) * 0.5,
            symbol: "T",
            time: 1_700_000_000_000 + i * 60_000,
            volume: 500 + Math.floor(rand() * 3_000),
        });
    }
    return out;
}

function hashBuckets(
    buckets: ReadonlyArray<{ readonly price: number; readonly volume: number }>,
): string {
    const tuples = buckets.map((bucket) => [
        Number(bucket.price.toFixed(8)),
        Number(bucket.volume.toFixed(8)),
    ]);
    return createHash("sha256").update(JSON.stringify(tuples)).digest("hex");
}

function actualFor(bars: ReadonlyArray<Bar>, fromIndex: number, toIndex: number): Expected {
    const out = harness(bars, bars.length + 1, () => {
        const result = fixedRangeVolumeProfile("slot", {
            from: bars[fromIndex].time,
            to: bars[toIndex].time,
            rowSize: 24,
        });
        return {
            bucketCount: result.buckets.length,
            bucketsHash: hashBuckets(result.buckets),
            poc: Number.isFinite(result.poc.current) ? result.poc.current : null,
            valHigh: Number.isFinite(result.valHigh.current) ? result.valHigh.current : null,
            valLow: Number.isFinite(result.valLow.current) ? result.valLow.current : null,
        };
    });
    const head = out[out.length - 1];
    if (head === undefined) throw new Error("missing golden output");
    return head;
}

describe("ta.fixedRangeVolumeProfile goldens", () => {
    it("matches the 200-bar fixture for range 50-150", () => {
        expect(actualFor(syntheticBars(200, 501), 50, 150)).toEqual(
            readExpected("bars-200-range-50-150"),
        );
    });

    it("matches the 500-bar fixture for range 100-400", () => {
        expect(actualFor(syntheticBars(500, 250), 100, 400)).toEqual(
            readExpected("bars-500-range-100-400"),
        );
    });

    it("matches the 100-bar fixture for range 0-99", () => {
        expect(actualFor(syntheticBars(100, 101), 0, 99)).toEqual(
            readExpected("bars-100-range-0-99"),
        );
    });
});
