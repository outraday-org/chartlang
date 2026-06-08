// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { IntervalDescriptor, TimeframeView } from "@invinite-org/chartlang-core";

function parsePrefix(value: string): number | null {
    const match = /^(\d+)/.exec(value);
    return match === null ? null : Number(match[1]);
}

const GROUP_SECONDS: Readonly<Record<string, number>> = Object.freeze({
    second: 1,
    minute: 60,
    hour: 3_600,
    daily: 86_400,
    weekly: 604_800,
    monthly: 2_629_800,
    quarterly: 7_889_400,
    yearly: 31_557_600,
});

const INTRADAY_GROUPS = new Set(["second", "minute", "hour"]);
const MONTHLY_LONGER = new Set(["monthly", "quarterly", "yearly"]);

/**
 * Build a frozen `timeframe.*` view from the current bar interval and
 * adapter interval descriptor.
 *
 * @since 0.4
 * @experimental
 * @example
 *     const view = makeTimeframeView("5m", {
 *         value: "5m",
 *         label: "5 minutes",
 *         group: "minute",
 *     });
 *     void view.inSeconds;
 */
export function makeTimeframeView(
    interval: string,
    descriptor: IntervalDescriptor | undefined,
): TimeframeView {
    const group = descriptor?.group ?? "";
    const prefix = parsePrefix(interval) ?? Number.NaN;
    const unitSeconds = GROUP_SECONDS[group] ?? Number.NaN;
    const inSeconds =
        Number.isFinite(prefix) && Number.isFinite(unitSeconds) ? prefix * unitSeconds : Number.NaN;

    return Object.freeze({
        period: interval,
        isintraday: INTRADAY_GROUPS.has(group),
        isdaily: group === "daily",
        isweekly: group === "weekly",
        ismonthly: MONTHLY_LONGER.has(group),
        inSeconds,
    });
}
