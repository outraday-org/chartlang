// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { SessionNamespace, Time } from "@invinite-org/chartlang-core";

import type { RuntimeContext } from "../runtimeContext.js";
import { splitEpoch } from "./civil.js";
import { parseSessionWindowMinutes } from "./sessionWindow.js";
import { resolveTz } from "./timeAccessors.js";
import { buildTzDstReporter } from "./tzDiagnostic.js";
import { resolveOffsetMinutes } from "./tzOffset.js";

/**
 * Build a frozen `session` namespace whose `isOpen` tests half-open membership
 * of an epoch's local minute-of-day against a parsed `"HH:MM-HH:MM"` window —
 * pure integer epoch math (Howard Hinnant `civil_from_days` via
 * {@link splitEpoch}), **no `Date`, no `Intl`** — so the result is
 * byte-reproducible across hosts. The factory closes over the mount's default
 * timezone and a `tz-dst-unsupported` reporter; the `isOpen` body is stateless.
 *
 * Membership is half-open `[start, end)` (the `end` minute is OUT, matching
 * `ta.sessionVolumeProfile` and Pine `time()`); a window with `end <= start`
 * (e.g. `"2200-0400"`) is treated as a midnight wrap `[start, 1440) ∪ [0, end)`.
 * A non-finite `t` or a malformed `spec` yields `false`; the accessor never
 * throws. A DST-bearing IANA zone resolves to UTC and invokes
 * `onDstUnsupported(tz)` (once-per-tz dedup lives in the caller) — fired only
 * once the call is otherwise well-formed (finite `t`, parseable `spec`).
 *
 * Unlike `ta.sessionVolumeProfile`, which defaults its window to
 * `syminfo.session`, `isOpen` takes the `spec` as an explicit argument (often
 * from `input.session`) and never reads `syminfo.session` itself.
 *
 * @since 1.5
 * @stable
 * @example
 *     // import { createSessionNamespace } from "@invinite-org/chartlang-runtime";
 *     // const session = createSessionNamespace(() => "UTC", () => {});
 *     // session.isOpen(0, "0000-1200"); // true (00:00 UTC is in [00:00, 12:00))
 */
export function createSessionNamespace(
    getDefaultTz: () => string,
    onDstUnsupported: (tz: string) => void,
): SessionNamespace {
    return Object.freeze<SessionNamespace>({
        isOpen(t: Time, spec: string, tz?: string): boolean {
            if (!Number.isFinite(t)) return false;
            const parsed = parseSessionWindowMinutes(spec);
            if (parsed === null) return false;

            const resolved = resolveTz(tz, getDefaultTz);
            const { offsetMin, dstUnsupported } = resolveOffsetMinutes(resolved);
            if (dstUnsupported) onDstUnsupported(resolved);

            const { hh, mm } = splitEpoch(t, offsetMin);
            const minuteOfDay = hh * 60 + mm;
            const { startMinutes, endMinutes } = parsed;
            if (endMinutes <= startMinutes) {
                // Midnight-wrap window: [start, 1440) ∪ [0, end).
                return minuteOfDay >= startMinutes || minuteOfDay < endMinutes;
            }
            return minuteOfDay >= startMinutes && minuteOfDay < endMinutes;
        },
    });
}

/**
 * Install-time builder: bind {@link createSessionNamespace} to a mount's
 * {@link RuntimeContext}. The default timezone resolves from the live
 * `syminfo.timezone` view; the `tz-dst-unsupported` diagnostic dedupes on the
 * SAME `ctx.diagnosedTzKeys` set the `time.*` accessors use, so a script using
 * both `time.*` and `session.isOpen` on one DST zone warns once total.
 * `buildComputeContext` calls this per bar (like the `state` / `request` /
 * `runtime` namespaces, NOT a module constant like `ta`): the returned namespace
 * is a pure view bound to the mount's `RuntimeContext`, so it is cheap to rebuild
 * and is not relied upon to be identity-stable across bars.
 *
 * @since 1.5
 * @stable
 * @example
 *     // import { buildSessionNamespace } from "@invinite-org/chartlang-runtime";
 *     // const session = buildSessionNamespace(state.runtimeContext);
 *     // void session.isOpen;
 */
export function buildSessionNamespace(ctx: RuntimeContext): SessionNamespace {
    return createSessionNamespace(() => ctx.views.syminfo.timezone, buildTzDstReporter(ctx));
}
