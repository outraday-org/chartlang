// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";

import type { Bar } from "@invinite-org/chartlang-core";

/**
 * Frozen sequence of synthetic OHLCV bars used by the conformance suite.
 * 10 000 bars across four 2 500-bar regimes (trend / range / high-vol /
 * low-vol). Deterministic — re-running {@link generateGoldenBars} yields
 * a byte-identical array.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { generateGoldenBars } from "@invinite-org/chartlang-conformance";
 *     const bars: GoldenBars = generateGoldenBars();
 *     // bars.length === 10_000
 *     void bars;
 */
export type GoldenBars = ReadonlyArray<Bar>;

const SEED = 0xc0de;
const BAR_COUNT = 10_000;
const SEGMENT = 2_500;
const MS_PER_DAY = 86_400_000;
const START_TIME = 1_700_000_000_000;
const BASE_PRICE = 100;
const BASE_SIGMA = 0.005;
const TREND_DRIFT = 0.001;
const LOW_VOL_DRIFT = 0.0002;
const BASE_VOLUME = 1_000;
const VOLUME_SCALE = 10;

/**
 * Mulberry32 — a tiny deterministic 32-bit PRNG. Produces uniform
 * `[0, 1)` doubles from a single 32-bit state. Public-domain
 * implementation by Tommy Ettinger (2017).
 */
function mulberry32(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Box-Muller draw from a `rng()` source — converts two uniform `[0, 1)`
 * draws into one standard-normal value. Used to produce per-bar log
 * returns with controllable σ.
 */
function gaussian(rng: () => number): number {
    const u1 = Math.max(rng(), Number.EPSILON);
    const u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

type SegmentSpec = {
    readonly drift: number;
    readonly sigma: number;
    readonly meanReverting: boolean;
};

const SEGMENTS: ReadonlyArray<SegmentSpec> = Object.freeze([
    // 0-2499: linear drift +0.1%/bar with sin-wave noise, low vol.
    { drift: TREND_DRIFT, sigma: BASE_SIGMA, meanReverting: false },
    // 2500-4999: mean-reverting around a flat baseline, moderate vol.
    { drift: 0, sigma: BASE_SIGMA * 2, meanReverting: true },
    // 5000-7499: σ = 4× base, no drift.
    { drift: 0, sigma: BASE_SIGMA * 4, meanReverting: false },
    // 7500-9999: σ = 0.25× base, slight drift.
    { drift: LOW_VOL_DRIFT, sigma: BASE_SIGMA * 0.25, meanReverting: false },
]);

function buildBar(index: number, time: number, prevClose: number, rng: () => number): Bar {
    const segment = SEGMENTS[Math.min(SEGMENTS.length - 1, Math.floor(index / SEGMENT))];
    const noise = gaussian(rng) * segment.sigma;
    const sineWave = Math.sin(index / 25) * segment.sigma * 0.5;
    const meanReversion = segment.meanReverting ? (BASE_PRICE - prevClose) * 0.01 : 0;
    const ret = segment.drift + noise + sineWave + meanReversion / prevClose;
    const close = Math.max(0.01, prevClose * (1 + ret));

    const openShift = gaussian(rng) * segment.sigma * 0.5;
    const open = Math.max(0.01, prevClose * (1 + openShift));
    const wickHigh = Math.abs(gaussian(rng)) * segment.sigma * 0.5;
    const wickLow = Math.abs(gaussian(rng)) * segment.sigma * 0.5;
    const top = Math.max(open, close) * (1 + wickHigh);
    const bottom = Math.min(open, close) * (1 - wickLow);
    const high = Math.max(top, open, close);
    const low = Math.min(bottom, open, close);

    const volume = BASE_VOLUME * (1 + Math.abs(ret) * VOLUME_SCALE);

    return Object.freeze({
        time,
        open,
        high,
        low,
        close,
        volume,
        symbol: "GOLDEN",
        interval: "1D",
        hl2: (high + low) / 2,
        hlc3: (high + low + close) / 3,
        ohlc4: (open + high + low + close) / 4,
        hlcc4: (high + low + close + close) / 4,
    });
}

/**
 * Build the canonical 10 000-bar fixture. Deterministic: the seeded
 * Mulberry32 PRNG plus the four-segment spec produces a byte-identical
 * array on every run.
 *
 * Segments (2 500 bars each):
 *
 *  1. Trend — linear drift `+0.1%`/bar with a low-amplitude sine-wave
 *     noise floor. Volatility low.
 *  2. Range — mean-reverting toward `BASE_PRICE`, moderate volatility.
 *  3. High-vol — σ = 4× base, no drift.
 *  4. Low-vol — σ = 0.25× base, slight upward drift.
 *
 * Volume tracks `BASE_VOLUME * (1 + |return| * 10)` so volume rises with
 * absolute returns — useful for indicators that read `bar.volume`.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { generateGoldenBars } from "@invinite-org/chartlang-conformance";
 *     const bars = generateGoldenBars();
 *     // bars[0].symbol === "GOLDEN"
 *     // bars[0].interval === "1D"
 *     void bars;
 */
export function generateGoldenBars(): GoldenBars {
    const rng = mulberry32(SEED);
    const bars: Bar[] = [];
    let prevClose = BASE_PRICE;
    for (let i = 0; i < BAR_COUNT; i += 1) {
        const bar = buildBar(i, START_TIME + i * MS_PER_DAY, prevClose, rng);
        bars.push(bar);
        prevClose = bar.close;
    }
    return Object.freeze(bars);
}

/**
 * Serialise the golden-bars fixture to a JSON string in the on-disk
 * canonical form: pretty-printed (4-space indent) with a trailing
 * newline. Pulled into a named export so the determinism test can hash
 * the in-memory bytes without re-reading the file.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { serialiseGoldenBars, generateGoldenBars } from "@invinite-org/chartlang-conformance";
 *     const json = serialiseGoldenBars(generateGoldenBars());
 *     // json.endsWith("\n") === true
 *     void json;
 */
export function serialiseGoldenBars(bars: GoldenBars): string {
    return `${JSON.stringify(bars, null, 4)}\n`;
}

/**
 * Write the canonical golden-bars JSON to `targetPath` (absolute or
 * resolved against CWD). Used by the CLI invocation and covered by the
 * fixture-determinism test.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { writeGoldenBars } from "@invinite-org/chartlang-conformance";
 *     // writeGoldenBars("/tmp/goldenBars.json");
 *     const fn: typeof writeGoldenBars = writeGoldenBars;
 *     void fn;
 */
export function writeGoldenBars(targetPath: string): void {
    const absolute = resolvePath(targetPath);
    writeFileSync(absolute, serialiseGoldenBars(generateGoldenBars()), "utf8");
}

/**
 * Absolute path to the on-disk `goldenBars.json` fixture inside the
 * conformance package. Resolved from this module's URL so the path is
 * correct whether the runner imports from `src/` (tests) or `dist/`
 * (consumer-repo install).
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { GOLDEN_BARS_PATH } from "@invinite-org/chartlang-conformance";
 *     // GOLDEN_BARS_PATH endsWith "fixtures/goldenBars.json"
 *     void GOLDEN_BARS_PATH;
 */
export const GOLDEN_BARS_PATH: string = resolvePath(
    dirname(fileURLToPath(import.meta.url)),
    "../../fixtures/goldenBars.json",
);

/* v8 ignore start */
// Direct-script invocation guard. Not exercised by the test suite — the
// helpers above (`generateGoldenBars`, `serialiseGoldenBars`,
// `writeGoldenBars`) carry the unit-test coverage; this block is the
// thin `pnpm tsx generateGoldenBars.ts` entry point.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    writeGoldenBars(GOLDEN_BARS_PATH);
    process.stdout.write(`wrote ${GOLDEN_BARS_PATH}\n`);
}
/* v8 ignore stop */
