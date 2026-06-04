// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { RuntimeContext } from "../runtimeContext";
import { pushDiagnostic } from "./emissionsQueue";

/**
 * Resolve the pane requested by a `plot()` call against the Phase-1
 * runtime contract: every non-`"overlay"` pane folds back to
 * `"overlay"` and a `unsupported-pane` diagnostic is pushed.
 *
 * Phase 1's canvas2d adapter declares `subPanes: 0`; even adapters
 * that grow `subPanes >= 1` later get the runtime fold until Phase 2
 * lights up sub-pane routing. The two branches differ only in the
 * diagnostic `message` — both still return `"overlay"`.
 *
 * @since 0.1
 * @example
 *     // import { resolvePane } from "@invinite-org/chartlang-runtime/emit";
 *     // const pane = resolvePane(undefined, ctx, "demo.ts:1:1#0");
 *     // pane === "overlay"
 */
export function resolvePane(
    requested: string | undefined,
    ctx: RuntimeContext,
    slotId: string,
): "overlay" {
    const pane = requested ?? "overlay";
    if (pane === "overlay") return "overlay";
    if (ctx.capabilities.subPanes >= 1) {
        pushDiagnostic(ctx.emissions, {
            kind: "diagnostic",
            severity: "warning",
            code: "unsupported-pane",
            message: `Pane "${pane}" requested but Phase-1 runtime flattens to overlay.`,
            slotId,
            bar: ctx.barIndex(),
        });
        return "overlay";
    }
    pushDiagnostic(ctx.emissions, {
        kind: "diagnostic",
        severity: "warning",
        code: "unsupported-pane",
        message: `Adapter declares subPanes: 0; pane "${pane}" folded to overlay.`,
        slotId,
        bar: ctx.barIndex(),
    });
    return "overlay";
}
