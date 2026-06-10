// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DiagnosticCode } from "@invinite-org/chartlang-adapter-kit";

import type { RuntimeContext } from "../runtimeContext";

/**
 * Emit a request diagnostic at most once per code, slot, interval, and kind.
 *
 * @since 0.6
 * @stable
 * @example
 *     const key = "request diagnostics are deduped by callsite";
 *     void key;
 */
export function pushOnce(
    ctx: RuntimeContext,
    code: DiagnosticCode,
    slotId: string,
    interval: string,
    kind: "security" | "lowerTf",
    message: string,
): void {
    const key = `${code}|${slotId}|${interval}|${kind}`;
    if (ctx.diagnosedRequestKeys.has(key)) return;
    ctx.diagnosedRequestKeys.add(key);
    ctx.emissions.diagnostics.push({
        kind: "diagnostic",
        severity: "warning",
        code,
        message,
        slotId,
        bar: ctx.barIndex(),
    });
}
