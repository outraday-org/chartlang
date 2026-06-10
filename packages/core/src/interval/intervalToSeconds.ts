// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { IntervalDescriptor } from "../types";

const MULTIPLIERS = Object.freeze({
    s: 1,
    "": 60,
    m: 60,
    H: 3_600,
    h: 3_600,
    D: 86_400,
    W: 604_800,
    M: 2_592_000,
    Y: 31_536_000,
});

/**
 * Convert an {@link IntervalDescriptor} to its effective second count.
 *
 * The helper prefers `intervalSeconds` when present. Otherwise it parses
 * `value` as `<positive-integer><suffix>`, where no suffix means Pine-style
 * minutes. Month and year suffixes use fixed 30-day and 365-day
 * approximations; adapters that need calendar-exact durations should provide
 * `intervalSeconds`.
 *
 * @throws Error when the override is non-positive / non-finite, or `value`
 * cannot be parsed.
 * @since 0.6
 * @stable
 * @example
 *     intervalToSeconds({ value: "1D", label: "1 day", group: "day" });
 *     intervalToSeconds({ value: "custom", label: "custom", group: "x", intervalSeconds: 7 });
 */
export function intervalToSeconds(d: IntervalDescriptor): number {
    if (d.intervalSeconds !== undefined) {
        if (!Number.isFinite(d.intervalSeconds) || d.intervalSeconds <= 0) {
            throw new Error(
                `intervalToSeconds: intervalSeconds must be a positive finite number; received ${d.intervalSeconds}`,
            );
        }
        return Math.round(d.intervalSeconds);
    }

    const match = /^(\d+)([smHhDWMY]?)$/.exec(d.value);
    if (match === null) {
        throw new Error(
            `intervalToSeconds: cannot parse interval value ${JSON.stringify(d.value)}`,
        );
    }

    const n = Number.parseInt(match[1], 10);
    if (!Number.isFinite(n) || n <= 0) {
        throw new Error(
            `intervalToSeconds: numeric prefix must be a positive integer; received ${JSON.stringify(d.value)}`,
        );
    }

    const suffix = match[2] as keyof typeof MULTIPLIERS;
    const multiplier = MULTIPLIERS[suffix];
    return n * multiplier;
}
