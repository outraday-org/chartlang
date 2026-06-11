// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { createHash } from "node:crypto";
import { readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
    GOLDEN_BARS_PATH,
    generateGoldenBars,
    serialiseGoldenBars,
    writeGoldenBars,
} from "./generateGoldenBars.js";

const BAR_COUNT = 10_000;
const SEGMENT = 2_500;

function meanClose(
    bars: ReturnType<typeof generateGoldenBars>,
    start: number,
    end: number,
): number {
    let sum = 0;
    for (let i = start; i < end; i += 1) sum += bars[i].close;
    return sum / (end - start);
}

function stddevReturn(
    bars: ReturnType<typeof generateGoldenBars>,
    start: number,
    end: number,
): number {
    const rets: number[] = [];
    for (let i = start + 1; i < end; i += 1) {
        rets.push((bars[i].close - bars[i - 1].close) / bars[i - 1].close);
    }
    const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
    const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / rets.length;
    return Math.sqrt(variance);
}

describe("generateGoldenBars", () => {
    it("emits exactly 10 000 bars", () => {
        const bars = generateGoldenBars();
        expect(bars.length).toBe(BAR_COUNT);
    });

    it("uses 1D interval and the GOLDEN symbol throughout", () => {
        const bars = generateGoldenBars();
        for (const bar of bars) {
            expect(bar.interval).toBe("1D");
            expect(bar.symbol).toBe("GOLDEN");
        }
    });

    it("monotonically increases bar time by 1 day", () => {
        const bars = generateGoldenBars();
        const MS_PER_DAY = 86_400_000;
        for (let i = 1; i < bars.length; i += 1) {
            expect(bars[i].time - bars[i - 1].time).toBe(MS_PER_DAY);
        }
    });

    it("respects OHLC invariants (low ≤ open/close ≤ high)", () => {
        const bars = generateGoldenBars();
        for (const bar of bars) {
            expect(bar.low).toBeLessThanOrEqual(bar.open);
            expect(bar.low).toBeLessThanOrEqual(bar.close);
            expect(bar.high).toBeGreaterThanOrEqual(bar.open);
            expect(bar.high).toBeGreaterThanOrEqual(bar.close);
            expect(bar.volume).toBeGreaterThan(0);
        }
    });

    it("matches segment-level statistical expectations", () => {
        const bars = generateGoldenBars();

        // Trend segment drifts upward — final mean close exceeds starting.
        const trendStart = meanClose(bars, 0, 100);
        const trendEnd = meanClose(bars, SEGMENT - 100, SEGMENT);
        expect(trendEnd).toBeGreaterThan(trendStart);

        // High-vol stddev exceeds the trend segment's stddev.
        const trendSigma = stddevReturn(bars, 0, SEGMENT);
        const highVolSigma = stddevReturn(bars, SEGMENT * 2, SEGMENT * 3);
        expect(highVolSigma).toBeGreaterThan(trendSigma * 2);

        // Low-vol stddev is well below the trend segment's stddev.
        const lowVolSigma = stddevReturn(bars, SEGMENT * 3, SEGMENT * 4);
        expect(lowVolSigma).toBeLessThan(trendSigma);
    });

    it("is deterministic — two runs yield byte-identical JSON", () => {
        const a = serialiseGoldenBars(generateGoldenBars());
        const b = serialiseGoldenBars(generateGoldenBars());
        expect(a).toBe(b);
    });

    it("emits the on-disk JSON in the canonical (4-space, trailing newline) form", () => {
        const json = serialiseGoldenBars(generateGoldenBars());
        expect(json.endsWith("\n")).toBe(true);
        expect(json.startsWith("[\n    {")).toBe(true);
    });
});

describe("on-disk goldenBars.json", () => {
    // The generator's gaussian/sine path goes through Math.log / Math.cos /
    // Math.sin, which ECMAScript only requires to be implementation-
    // approximated — arm64 macOS and x64 Linux differ in the last ulp, so a
    // byte-hash of the serialised JSON is NOT portable across platforms.
    // The committed fixture is the canonical artifact (scenario hashes are
    // pinned against it); this gate instead asserts the regenerated bars
    // match it within 1 ulp-scale relative tolerance, which still catches
    // manual edits and real generator drift on every platform.
    it("matches the in-memory generator (fixture-determinism gate)", () => {
        const onDisk = JSON.parse(readFileSync(GOLDEN_BARS_PATH, "utf8")) as ReturnType<
            typeof generateGoldenBars
        >;
        const inMemory = generateGoldenBars();
        expect(onDisk.length).toBe(inMemory.length);
        const NUMERIC_KEYS = [
            "time",
            "open",
            "high",
            "low",
            "close",
            "volume",
            "hl2",
            "hlc3",
            "ohlc4",
            "hlcc4",
        ] as const;
        for (let i = 0; i < inMemory.length; i += 1) {
            const a = onDisk[i];
            const b = inMemory[i];
            expect(a.symbol).toBe(b.symbol);
            expect(a.interval).toBe(b.interval);
            for (const key of NUMERIC_KEYS) {
                const av = a[key] as number;
                const bv = b[key] as number;
                const tolerance = Math.max(1e-9, Math.abs(bv) * 1e-9);
                if (Math.abs(av - bv) > tolerance) {
                    expect.fail(
                        `bar[${i}].${key} drifted beyond tolerance: on-disk ${av} vs regenerated ${bv}`,
                    );
                }
            }
        }
    });

    it("two same-process serialisations are byte-identical (hash self-check)", () => {
        const sha = (s: string): string => createHash("sha256").update(s).digest("hex");
        const a = serialiseGoldenBars(generateGoldenBars());
        const b = serialiseGoldenBars(generateGoldenBars());
        expect(sha(a)).toBe(sha(b));
    });
});

describe("writeGoldenBars", () => {
    it("writes the canonical JSON to the supplied path", () => {
        const target = join(tmpdir(), `chartlang-golden-${Date.now()}.json`);
        try {
            writeGoldenBars(target);
            const written = readFileSync(target, "utf8");
            const expected = serialiseGoldenBars(generateGoldenBars());
            expect(written).toBe(expected);
        } finally {
            try {
                unlinkSync(target);
            } catch {
                /* ignore cleanup errors */
            }
        }
    });
});
