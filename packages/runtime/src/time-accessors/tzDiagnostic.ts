// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { pushDiagnostic } from "../emit/index.js";
import type { RuntimeContext } from "../runtimeContext.js";

/**
 * Build the `onDstUnsupported(tz)` reporter the `time.*` and `session.*`
 * accessor factories share. A DST-bearing IANA zone the UTC-first runtime
 * cannot honour warns at most once per distinct tz per mount, deduped on
 * `ctx.diagnosedTzKeys` — so a script using BOTH `time.*` and `session.isOpen`
 * on one DST zone fires `tz-dst-unsupported` once total.
 *
 * @since 1.5
 * @stable
 * @example
 *     // import { buildTzDstReporter } from "@invinite-org/chartlang-runtime";
 *     // const report = buildTzDstReporter(ctx);
 *     // report("America/New_York");
 */
export function buildTzDstReporter(ctx: RuntimeContext): (tz: string) => void {
    return (tz) => {
        const key = `tz-dst-unsupported|${tz}`;
        if (ctx.diagnosedTzKeys.has(key)) return;
        ctx.diagnosedTzKeys.add(key);
        pushDiagnostic(ctx.emissions, {
            kind: "diagnostic",
            severity: "warning",
            code: "tz-dst-unsupported",
            message: `Timezone \`${tz}\` needs DST data unavailable in this build; calendar fields used UTC.`,
            slotId: null,
            bar: ctx.barIndex(),
        });
    };
}
