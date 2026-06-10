// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { mulberry32 } from "./__fixtures__/syntheticBars.js";
import { visibleRangeVolumeProfile } from "./visibleRangeVolumeProfile.js";

type Expected = Readonly<{
    bucketCount: number;
    bucketsHash: string;
    poc: number | null;
    valHigh: number | null;
    valLow: number | null;
}>;

const FIXTURE_DIR = fileURLToPath(
    new URL("./__fixtures__/visibleRangeVolumeProfile/", import.meta.url),
);

function readExpected(name: string): Expected {
    return JSON.parse(readFileSync(`${FIXTURE_DIR}${name}.json`, "utf8")) as Expected;
}

function uptrendBars(): Bar[] {
    const out: Bar[] = [];
    for (let i = 0; i < 100; i += 1) {
        const close = 100 + i * 0.35;
        out.push({
            close,
            high: close + 0.45,
            interval: "1m",
            low: close - 0.35,
            open: close - 0.1,
            symbol: "T",
            time: 1_700_000_000_000 + i * 60_000,
            volume: 1_000 + i * 7,
        });
    }
    return out;
}

function meanRevertingBars(): Bar[] {
    const rand = mulberry32(721);
    const out: Bar[] = [];
    let close = 100;
    for (let i = 0; i < 200; i += 1) {
        close += (100 - close) * 0.09 + (rand() - 0.5) * 2.2;
        out.push({
            close,
            high: close + 0.3 + rand() * 0.4,
            interval: "1m",
            low: close - 0.3 - rand() * 0.4,
            open: close + (rand() - 0.5) * 0.6,
            symbol: "T",
            time: 1_700_000_000_000 + i * 60_000,
            volume: 500 + Math.floor(rand() * 3_000),
        });
    }
    return out;
}

function gapBars(): Bar[] {
    const out: Bar[] = [];
    for (let i = 0; i < 50; i += 1) {
        const gap = i >= 25 ? 12 : 0;
        const close = i === 30 ? Number.NaN : 80 + gap + i * 0.08;
        const finiteClose = Number.isFinite(close) ? close : 94;
        out.push({
            close,
            high: finiteClose + 0.55,
            interval: "1m",
            low: finiteClose - 0.55,
            open: finiteClose - 0.2,
            symbol: "T",
            time: 1_700_000_000_000 + i * 60_000,
            volume: i === 30 ? 0 : 800 + i * 11,
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

function actualFor(bars: ReadonlyArray<Bar>): Expected {
    const out = harness(bars, bars.length + 1, (_bar, ctx) => {
        const result = visibleRangeVolumeProfile("slot", { rowSize: 24 });
        const plot = ctx.emissions.plots[ctx.emissions.plots.length - 1];
        const buckets =
            plot !== undefined && plot.style.kind === "horizontal-histogram"
                ? plot.style.buckets
                : [];
        return {
            bucketCount: buckets.length,
            bucketsHash: hashBuckets(buckets),
            poc: Number.isFinite(result.poc.current) ? result.poc.current : null,
            valHigh: Number.isFinite(result.valHigh.current) ? result.valHigh.current : null,
            valLow: Number.isFinite(result.valLow.current) ? result.valLow.current : null,
        };
    });
    const head = out[out.length - 1];
    if (head === undefined) throw new Error("missing golden output");
    return head;
}

describe("ta.visibleRangeVolumeProfile goldens", () => {
    it("matches the 100-bar synthetic uptrend fixture", () => {
        expect(actualFor(uptrendBars())).toEqual(readExpected("uptrend"));
    });

    it("matches the 200-bar mean-reverting random-walk fixture", () => {
        expect(actualFor(meanRevertingBars())).toEqual(readExpected("mean-reverting"));
    });

    it("matches the 50-bar price-gap fixture with NaN handling", () => {
        expect(actualFor(gapBars())).toEqual(readExpected("gap"));
    });
});
