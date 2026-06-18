// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Price, WorldPoint } from "@invinite-org/chartlang-core";
import { intervalToSeconds } from "@invinite-org/chartlang-core";

import type { Float64RingBuffer } from "./ringBuffer.js";

/**
 * Parse a bar-interval string to its spacing in milliseconds, or `NaN` when
 * the string is not a parseable interval. `intervalToSeconds` throws on an
 * unparseable descriptor; this wrapper swallows that so `bar.point` stays a
 * non-throwing, graceful-degradation helper.
 */
function intervalSpacingMs(interval: string): number {
    try {
        return intervalToSeconds({ value: interval, label: interval, group: "" }) * 1000;
    } catch {
        return Number.NaN;
    }
}

/**
 * The median delta between the most recent retained bar times, used to
 * extrapolate future-bar timestamps. Walks the newest `min(length - 1, cap)`
 * deltas (cap keeps the scan O(1) on long histories) and returns the median;
 * `NaN` when fewer than two bars are retained or every delta is non-finite.
 */
function medianSpacingMs(time: Float64RingBuffer): number {
    const pairs = Math.min(time.length - 1, 100);
    if (pairs < 1) return Number.NaN;
    const deltas: number[] = [];
    for (let i = 0; i < pairs; i += 1) {
        const delta = time.at(i) - time.at(i + 1);
        if (Number.isFinite(delta)) deltas.push(delta);
    }
    if (deltas.length === 0) return Number.NaN;
    deltas.sort((a, b) => a - b);
    const mid = deltas.length >> 1;
    return deltas.length % 2 === 1 ? deltas[mid] : (deltas[mid - 1] + deltas[mid]) / 2;
}

/**
 * Resolve a `bar.point(offset, price)` call to the time-based
 * {@link WorldPoint} the rest of the drawing pipeline already speaks.
 *
 * `offset === 0` reads the live `bar.time`; `offset < 0` reads the real
 * historical timestamp `|offset|` bars back from the time ring buffer
 * (`NaN` past retention); `offset > 0` extrapolates `lastTime + offset *
 * spacing`, where `spacing` is the median retained-bar delta and falls back
 * to the parsed bar interval when fewer than two bars are retained. `price`
 * passes through unchanged. Never throws.
 *
 * @since 0.9
 * @stable
 * @example
 *     // const wp = resolveBarPoint(stream.ohlcv.time, "1D", currentTime, -10, 42);
 */
export function resolveBarPoint(
    time: Float64RingBuffer,
    interval: string,
    currentTime: number,
    offset: number,
    price: Price,
): WorldPoint {
    if (offset === 0) return { time: currentTime, price };
    if (offset < 0) return { time: time.at(-offset), price };
    const spacing = (() => {
        const median = medianSpacingMs(time);
        return Number.isFinite(median) ? median : intervalSpacingMs(interval);
    })();
    return { time: currentTime + offset * spacing, price };
}
