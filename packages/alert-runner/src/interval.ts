// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { intervalToSeconds } from "@invinite-org/chartlang-core";

import { AlertRunnerError } from "./errors.js";

/**
 * Bar duration of a chartlang interval token in milliseconds, through core's
 * `intervalToSeconds` (`"1m"` minute, `"1h"` hour, `"1D"` day, `"1W"` week,
 * `"1M"` a fixed 30-day month). Throws an `AlertRunnerError`
 * (`"invalid-argument"`) for a token it cannot parse.
 *
 * @since 1.0
 * @stable
 * @example
 *     import { intervalMs } from "@invinite-org/chartlang-alert-runner";
 *     const hour = intervalMs("1h"); // 3_600_000
 *     void hour;
 */
export function intervalMs(interval: string): number {
    try {
        return intervalToSeconds({ value: interval, label: interval, group: "alert" }) * 1000;
    } catch (cause) {
        throw new AlertRunnerError(
            "invalid-argument",
            `unknown interval ${JSON.stringify(interval)}`,
            {
                cause,
            },
        );
    }
}
