// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";

import { AlertRunnerError } from "./errors.js";
import type { AlertBar } from "./types.js";

/**
 * Throws `"invalid-argument"` unless every OHLCV field is a finite number and
 * `closeTime`, when present, is finite too.
 *
 * @since 1.0
 * @internal
 * @example
 *     assertAlertBar({ time: 0, open: 1, high: 1, low: 1, close: 1, volume: 0 }, "bar");
 */
export function assertAlertBar(bar: AlertBar, what: string): void {
    const fields = [bar.time, bar.open, bar.high, bar.low, bar.close, bar.volume];
    if (fields.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
        throw new AlertRunnerError(
            "invalid-argument",
            `${what}: every OHLCV field must be a finite number`,
        );
    }
    if (bar.closeTime !== undefined && !Number.isFinite(bar.closeTime)) {
        throw new AlertRunnerError(
            "invalid-argument",
            `${what}: closeTime must be finite when present`,
        );
    }
}

/**
 * Throws `"invalid-argument"` unless `bars` are valid and strictly ascending by time.
 *
 * @since 1.0
 * @internal
 * @example
 *     assertAscending([], "history");
 */
export function assertAscending(bars: ReadonlyArray<AlertBar>, what: string): void {
    let previous = Number.NEGATIVE_INFINITY;
    for (const bar of bars) {
        assertAlertBar(bar, what);
        if (bar.time <= previous) {
            throw new AlertRunnerError(
                "invalid-argument",
                `${what}: bar times must be strictly ascending`,
            );
        }
        previous = bar.time;
    }
}

/**
 * Build the runtime `Bar` the guest receives. Derived sources are computed
 * here; `point` is a stub because functions never cross the QuickJS JSON
 * membrane (the guest rebuilds its own).
 *
 * @since 1.0
 * @internal
 * @example
 *     const bar = toRuntimeBar({ time: 0, open: 1, high: 2, low: 0, close: 1, volume: 0 }, "AAPL", "1h");
 *     void bar.hl2;
 */
export function toRuntimeBar(bar: AlertBar, symbol: string, interval: string): Bar {
    const { time, open, high, low, close, volume } = bar;
    return {
        time,
        open,
        high,
        low,
        close,
        volume,
        symbol,
        interval,
        hl2: (high + low) / 2,
        hlc3: (high + low + close) / 3,
        ohlc4: (open + high + low + close) / 4,
        hlcc4: (high + low + close + close) / 4,
        ...(bar.closeTime === undefined ? {} : { closeTime: bar.closeTime }),
        point: (_offset: number, price: number) => ({ time, price }),
    };
}

/**
 * The plain OHLCV projection of a bar (drops every field the runner does not own).
 *
 * @since 1.0
 * @internal
 * @example
 *     const plain = projectBar({ time: 0, open: 1, high: 2, low: 0, close: 1, volume: 0 });
 *     void plain;
 */
export function projectBar(bar: AlertBar): AlertBar {
    return {
        time: bar.time,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
        ...(bar.closeTime === undefined ? {} : { closeTime: bar.closeTime }),
    };
}
