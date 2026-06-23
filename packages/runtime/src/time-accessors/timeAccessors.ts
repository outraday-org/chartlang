// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Time, TimeNamespace } from "@invinite-org/chartlang-core";

import type { RuntimeContext } from "../runtimeContext.js";
import { daysFromCivil, splitEpoch } from "./civil.js";
import { buildTzDstReporter } from "./tzDiagnostic.js";
import { resolveOffsetMinutes } from "./tzOffset.js";

/**
 * Resolve a tz argument, falling back to the mount default then `"UTC"`.
 * Shared by the `time.*` and `session.*` accessor factories so both honour the
 * identical explicit → `syminfo.timezone` → `"UTC"` precedence.
 *
 * @since 1.5
 * @stable
 * @example
 *     // import { resolveTz } from "@invinite-org/chartlang-runtime";
 *     // resolveTz(undefined, () => ""); // "UTC"
 */
export function resolveTz(tz: string | undefined, getDefaultTz: () => string): string {
    if (tz !== undefined && tz !== "") return tz;
    const fallback = getDefaultTz();
    return fallback === "" ? "UTC" : fallback;
}

function isInt(value: number): boolean {
    return Number.isInteger(value);
}

/**
 * Build a frozen `time` namespace whose accessors do pure integer epoch math
 * (Howard Hinnant `civil_from_days`) — **no `Date`, no `Intl`** — so output is
 * byte-reproducible across hosts. The factory closes over the mount's default
 * timezone, the live bar interval (for {@link TimeNamespace.timeClose}), and a
 * `tz-dst-unsupported` reporter; the accessor bodies themselves are stateless.
 *
 * v1 honours UTC + fixed-offset zones only. A DST-bearing IANA zone resolves to
 * UTC and invokes `onDstUnsupported(tz)` (once-per-tz dedup lives in the
 * caller). Non-finite / out-of-range inputs yield `NaN`; the accessors never
 * throw.
 *
 * @since 1.5
 * @stable
 * @example
 *     // import { createTimeNamespace } from "@invinite-org/chartlang-runtime";
 *     // const time = createTimeNamespace(() => "UTC", () => 60_000, () => {});
 *     // time.year(0); // 1970
 */
export function createTimeNamespace(
    getDefaultTz: () => string,
    getIntervalMs: () => number,
    onDstUnsupported: (tz: string) => void,
): TimeNamespace {
    function offsetFor(tz: string | undefined): number {
        const resolved = resolveTz(tz, getDefaultTz);
        const { offsetMin, dstUnsupported } = resolveOffsetMinutes(resolved);
        if (dstUnsupported) onDstUnsupported(resolved);
        return offsetMin;
    }

    function field<K extends "y" | "m" | "d" | "hh" | "mm" | "ss">(
        t: Time,
        tz: string | undefined,
        key: K,
    ): number {
        const offsetMin = offsetFor(tz);
        if (!Number.isFinite(t)) return Number.NaN;
        return splitEpoch(t, offsetMin)[key];
    }

    return Object.freeze<TimeNamespace>({
        year: (t, tz) => field(t, tz, "y"),
        month: (t, tz) => field(t, tz, "m"),
        dayofmonth: (t, tz) => field(t, tz, "d"),
        hour: (t, tz) => field(t, tz, "hh"),
        minute: (t, tz) => field(t, tz, "mm"),
        second: (t, tz) => field(t, tz, "ss"),
        dayofweek: (t, tz) => {
            const offsetMin = offsetFor(tz);
            if (!Number.isFinite(t)) return Number.NaN;
            // Pine convention: 1=Sunday .. 7=Saturday (splitEpoch dow is 0=Sun).
            return splitEpoch(t, offsetMin).dow + 1;
        },
        timestamp: (year, month, day, hour, minute, second, tz) => {
            const offsetMin = offsetFor(tz);
            const hh = hour ?? 0;
            const mm = minute ?? 0;
            const ss = second ?? 0;
            if (
                !isInt(year) ||
                !isInt(month) ||
                !isInt(day) ||
                !isInt(hh) ||
                !isInt(mm) ||
                !isInt(ss) ||
                month < 1 ||
                month > 12 ||
                day < 1 ||
                day > 31 ||
                hh < 0 ||
                hh > 23 ||
                mm < 0 ||
                mm > 59 ||
                ss < 0 ||
                ss > 59
            ) {
                return Number.NaN;
            }
            return (
                daysFromCivil(year, month, day) * 86_400_000 +
                (hh * 3600 + mm * 60 + ss) * 1000 -
                offsetMin * 60_000
            );
        },
        timeClose: (t, tz) => {
            // `tz` is accepted for surface symmetry; the close instant is
            // tz-invariant (start + interval). A DST tz still flags for
            // consistency with the other accessors.
            offsetFor(tz);
            if (!Number.isFinite(t)) return Number.NaN;
            return t + getIntervalMs();
        },
    });
}

/**
 * Install-time builder: bind {@link createTimeNamespace} to a mount's
 * {@link RuntimeContext}. The default timezone resolves from the live
 * `syminfo.timezone` view, the bar interval from `timeframe.inSeconds`, and the
 * `tz-dst-unsupported` diagnostic dedupes once per distinct tz on
 * `ctx.diagnosedTzKeys`. `buildComputeContext` calls this per bar (like the
 * `state` / `request` / `runtime` namespaces, NOT a module constant like `ta`):
 * the returned namespace is a pure view bound to the mount's `RuntimeContext`,
 * so it is cheap to rebuild and is not relied upon to be identity-stable across
 * bars (the script receives a fresh `ctx` each bar).
 *
 * @since 1.5
 * @stable
 * @example
 *     // import { buildTimeNamespace } from "@invinite-org/chartlang-runtime";
 *     // const time = buildTimeNamespace(state.runtimeContext);
 *     // void time.year;
 */
export function buildTimeNamespace(ctx: RuntimeContext): TimeNamespace {
    return createTimeNamespace(
        () => ctx.views.syminfo.timezone,
        () => ctx.views.timeframe.inSeconds * 1000,
        buildTzDstReporter(ctx),
    );
}
